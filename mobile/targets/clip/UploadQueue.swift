import Foundation
import Network

/*
  The clip's upload queue — its copy of `mobile/src/lib/upload-queue.ts` (and
  `web/src/shoot/queue.ts`), on files in the App Group folder.

  The shutter develops the frame and writes it here; claim → tag → upload →
  mark happen in `drain()`, each step recorded, so a clip closed mid-upload or a
  venue with no signal loses nothing that was taken: the next launch drains
  what is left. The photo id is minted at the shutter, which makes the claim
  idempotent — a retry never spends a second frame.

  Accepted, as in the app: frames still unclaimed when the event ends are
  refused by the server and dropped. And frames still queued when the full app
  replaces the clip stay in the App Group folder — the app does not drain them.
*/

struct QueuedShot: Codable, Identifiable {
  let id: String
  let eventId: String
  let userId: String
  let takenAt: String
  let width: Int
  let height: Int
  var claimed: Bool
  var uploaded: Bool
  /// The mission this frame is for (armed at the shutter, or picked in Your
  /// shots while it waited). Optional fields decode as nil from older entries.
  var missionId: String?
  /// The tag changed and the server has not heard it yet.
  var missionDirty: Bool?
  var tagAttempts: Int?
}

/// A frame still in the queue, with its files.
struct LocalShot {
  let shot: QueuedShot
  let original: URL
  let thumb: URL
}

extension Notification.Name {
  /// `userInfo`: "eventId", "unclaimed" and "revision" (an `UnclaimedCount`),
  /// and "shotsLeft" (an Int, absent for unlimited).
  static let shotClaimed = Notification.Name("left.clip.shotClaimed")
  /// `userInfo`: "id", "eventId", and when the server refused it "reason",
  /// "unclaimed" and "revision".
  static let shotFinished = Notification.Name("left.clip.shotFinished")
  /// A queued frame's mission tag reached the server, or was dropped. `userInfo`: "eventId".
  static let shotTagged = Notification.Name("left.clip.shotTagged")
}

/// What the counter subtracts from the server's count. `revision` grows with
/// every change to the queue, so an older count never overwrites a newer one:
/// the shutter's, the claim's and a re-read can reach the model in any order.
struct UnclaimedCount: Sendable {
  let count: Int
  let revision: Int
}

/// A refused tag is retried this often before it is dropped (never the photo).
private let maxTagAttempts = 3

actor UploadQueue {
  static let shared = UploadQueue()

  private let folder = ClipConfig.sharedFolder.appendingPathComponent("clip-shots", isDirectory: true)
  private var draining = false
  private var revision = 0
  private var again = false
  private var backoff: Double = 2
  private var retry: Task<Void, Never>?
  private var monitor: NWPathMonitor?

  // MARK: Files

  private func url(_ id: String, _ suffix: String) -> URL {
    folder.appendingPathComponent(id + suffix)
  }

  private func write(_ shot: QueuedShot) throws {
    try JSONEncoder().encode(shot).write(to: url(shot.id, ".json"), options: .atomic)
  }

  private func remove(_ id: String) {
    for suffix in [".json", ".jpg", "_thumb.jpg"] {
      try? FileManager.default.removeItem(at: url(id, suffix))
    }
  }

  private func read(_ id: String) -> QueuedShot? {
    guard let data = try? Data(contentsOf: url(id, ".json")) else { return nil }
    return try? JSONDecoder().decode(QueuedShot.self, from: data)
  }

  private func all() -> [QueuedShot] {
    let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
    return names
      .filter { $0.hasSuffix(".json") }
      .compactMap { try? JSONDecoder().decode(QueuedShot.self, from: Data(contentsOf: folder.appendingPathComponent($0))) }
      .sorted { $0.takenAt < $1.takenAt }
  }

  // MARK: API

  /// Write a developed frame. The JPEGs land before the entry, so an entry
  /// always has its files.
  /// Returns the count with the new frame in it, for the shutter to hand the
  /// model in the same step that drops its "developing" frame.
  func enqueue(_ shot: QueuedShot, photo: DevelopedPhoto) throws -> UnclaimedCount {
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    try photo.original.write(to: url(shot.id, ".jpg"), options: .atomic)
    try photo.thumb.write(to: url(shot.id, "_thumb.jpg"), options: .atomic)
    try write(shot)
    revision += 1
    let count = unclaimed(eventId: shot.eventId, userId: shot.userId)
    Task { await self.drain() }
    return count
  }

  /// Frames not yet claimed — what the counter subtracts from the server's.
  func unclaimed(eventId: String, userId: String) -> UnclaimedCount {
    UnclaimedCount(count: countUnclaimed(eventId: eventId, userId: userId), revision: revision)
  }

  private func countUnclaimed(eventId: String, userId: String) -> Int {
    all().filter { $0.eventId == eventId && $0.userId == userId && !$0.claimed }.count
  }

  /// A claim or a refusal changed the count: the notification carries the new
  /// one, so the model sets it together with the server's (no re-read between).
  private func countInfo(_ shot: QueuedShot) -> [String: Any] {
    revision += 1
    return ["unclaimed": countUnclaimed(eventId: shot.eventId, userId: shot.userId), "revision": revision]
  }

  /// The guest's frames still in the queue, oldest first, with their files.
  func local(eventId: String, userId: String) -> [LocalShot] {
    all()
      .filter { $0.eventId == eventId && $0.userId == userId }
      .map { LocalShot(shot: $0, original: url($0.id, ".jpg"), thumb: url($0.id, "_thumb.jpg")) }
  }

  /// Re-tag a frame that is still queued. False when it has already left the
  /// queue — then the tag goes straight to the server.
  func setMission(id: String, missionId: String?) -> Bool {
    guard var shot = read(id) else { return false }
    shot.missionId = missionId
    shot.missionDirty = true
    shot.tagAttempts = 0
    guard (try? write(shot)) != nil else { return false }
    Task { await self.drain() }
    return true
  }

  /// Drain now, whenever the network comes back, and with backoff on failure.
  func start() {
    guard monitor == nil else { return }
    let monitor = NWPathMonitor()
    monitor.pathUpdateHandler = { path in
      if path.status == .satisfied { Task { await UploadQueue.shared.drain() } }
    }
    monitor.start(queue: DispatchQueue(label: "left.clip.network"))
    self.monitor = monitor
    Task { await drain() }
  }

  /// Work through every queued frame of the signed-in guest, oldest first.
  /// One drain at a time; a call during a drain runs it once more after.
  func drain() async {
    if draining { again = true; return }
    draining = true
    defer { draining = false }
    repeat {
      again = false
      guard let userId = await Server.shared.userId else { return }
      do {
        for shot in all() where shot.userId == userId {
          try await send(shot)
        }
        backoff = 2
      } catch {
        // Offline or a dropped request: try again later, slower each time.
        scheduleRetry()
        return
      }
    } while again
  }

  private func scheduleRetry() {
    retry?.cancel()
    let delay = backoff
    backoff = min(backoff * 2, 60)
    retry = Task {
      try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
      if !Task.isCancelled { await self.drain() }
    }
  }

  private func send(_ entry: QueuedShot) async throws {
    var shot = entry
    let server = Server.shared

    if !shot.claimed {
      do {
        let left = try await server.claimShot(eventId: shot.eventId, photoId: shot.id, takenAt: shot.takenAt)
        shot.claimed = true
        try write(shot)
        var info = countInfo(shot)
        info["eventId"] = shot.eventId
        if let left { info["shotsLeft"] = left }
        post(.shotClaimed, info)
      } catch let refusal as ClipError where refusal == .rollEmpty || refusal == .eventClosed {
        remove(shot.id)
        var info = countInfo(shot)
        info["id"] = shot.id
        info["eventId"] = shot.eventId
        info["reason"] = refusal == .rollEmpty ? "roll_empty" : "event_closed"
        post(.shotFinished, info)
        return
      }
    }

    // The tag needs the photo's row, which the claim made. Its own step: a
    // refused tag drops the tag, never the photo.
    try await settleTag(shot.id)
    shot = read(shot.id) ?? shot

    if !shot.uploaded {
      do {
        let original = try Data(contentsOf: url(shot.id, ".jpg"))
        let thumb = try Data(contentsOf: url(shot.id, "_thumb.jpg"))
        try await server.upload(
          path: Server.photoPath(eventId: shot.eventId, userId: shot.userId, photoId: shot.id, thumb: false),
          jpeg: original
        )
        try await server.upload(
          path: Server.photoPath(eventId: shot.eventId, userId: shot.userId, photoId: shot.id, thumb: true),
          jpeg: thumb
        )
      } catch {
        // The bucket refuses to overwrite a print once it is attached. A retry
        // that meets the refusal may be one whose mark already went through:
        // ask the server, and drop the entry if it holds the photo.
        if (try? await server.markPhotoUploaded(photoId: shot.id, width: shot.width, height: shot.height)) != nil {
          try await settleTag(shot.id)
          finish(shot)
          return
        }
        throw error
      }
      shot.uploaded = true
      try write(shot)
    }

    try await server.markPhotoUploaded(photoId: shot.id, width: shot.width, height: shot.height)
    // Re-tagged while it uploaded: settle that before the entry goes.
    try await settleTag(shot.id)
    finish(shot)
  }

  /// Send the entry's tag if the server has not heard it. The guest may re-tag
  /// while a request is out (the actor lets `setMission` in at every await),
  /// so the stored entry is read again after each answer. Throws only when the
  /// server could not be reached, which leaves the entry for the next drain.
  private func settleTag(_ id: String) async throws {
    for _ in 0..<4 {
      guard let shot = read(id), shot.claimed, shot.missionDirty == true else { return }
      let target = shot.missionId
      do {
        try await Server.shared.setPhotoMission(photoId: id, missionId: target)
        guard var latest = read(id) else { return }
        if latest.missionId == target {
          latest.missionDirty = false
          try? write(latest)
          post(.shotTagged, ["eventId": latest.eventId])
          return
        }
        // Re-tagged meanwhile: go round again with the new one.
      } catch let error as ClipError {
        guard var latest = read(id) else { return }
        let attempts = (latest.tagAttempts ?? 0) + 1
        if error.tagRefusedForGood || attempts >= maxTagAttempts {
          latest.missionId = nil
          latest.missionDirty = false
        }
        latest.tagAttempts = attempts
        try? write(latest)
        post(.shotTagged, ["eventId": latest.eventId])
        if latest.missionDirty == true { throw error }
        return
      }
    }
  }

  private func finish(_ shot: QueuedShot) {
    remove(shot.id)
    post(.shotFinished, ["id": shot.id, "eventId": shot.eventId])
  }

  private nonisolated func post(_ name: Notification.Name, _ info: [String: Any]) {
    DispatchQueue.main.async {
      NotificationCenter.default.post(name: name, object: nil, userInfo: info)
    }
  }
}
