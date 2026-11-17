import Foundation
import Network

/*
  The clip's upload queue — its copy of `mobile/src/lib/upload-queue.ts` (and
  `web/src/shoot/queue.ts`), on files in the App Group folder.

  The shutter develops the frame and writes it here; claim → upload → mark
  happen in `drain()`, each step recorded, so a clip closed mid-upload or a
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
}

extension Notification.Name {
  /// `userInfo`: "eventId", and "shotsLeft" (an Int, absent for unlimited).
  static let shotClaimed = Notification.Name("left.clip.shotClaimed")
  /// `userInfo`: "id", "eventId", and "reason" when the server refused it.
  static let shotFinished = Notification.Name("left.clip.shotFinished")
}

actor UploadQueue {
  static let shared = UploadQueue()

  private let folder = ClipConfig.sharedFolder.appendingPathComponent("clip-shots", isDirectory: true)
  private var draining = false
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
  func enqueue(_ shot: QueuedShot, photo: DevelopedPhoto) throws {
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    try photo.original.write(to: url(shot.id, ".jpg"), options: .atomic)
    try photo.thumb.write(to: url(shot.id, "_thumb.jpg"), options: .atomic)
    try write(shot)
    Task { await self.drain() }
  }

  /// Frames not yet claimed — what the counter subtracts from the server's.
  func unclaimed(eventId: String, userId: String) -> Int {
    all().filter { $0.eventId == eventId && $0.userId == userId && !$0.claimed }.count
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
        var info: [String: Any] = ["eventId": shot.eventId]
        if let left { info["shotsLeft"] = left }
        post(.shotClaimed, info)
      } catch let refusal as ClipError where refusal == .rollEmpty || refusal == .eventClosed {
        remove(shot.id)
        post(.shotFinished, ["id": shot.id, "eventId": shot.eventId,
                             "reason": refusal == .rollEmpty ? "roll_empty" : "event_closed"])
        return
      }
    }

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
          finish(shot)
          return
        }
        throw error
      }
      shot.uploaded = true
      try write(shot)
    }

    try await server.markPhotoUploaded(photoId: shot.id, width: shot.width, height: shot.height)
    finish(shot)
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
