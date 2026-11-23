import Foundation
import SwiftUI

/// Where the guest is, and the roll counter. The app's 11 → 12 → 13 → the
/// album's developing state, as one small state machine.
@MainActor
final class ClipModel: ObservableObject {
  enum Phase: Equatable {
    /// Launched; waiting a moment for the invocation URL.
    case starting
    /// Opened without an invite (from the App Library, with nothing joined).
    case noInvite
    /// 11: the guest types the name the group will see.
    case name(code: String)
    /// 11.5: how this moment works, once per moment and phone (`Intro.swift`).
    case intro(EventInfo)
    /// 12: the host has not started the event.
    case waiting(EventInfo)
    /// 13: shooting.
    case camera(EventInfo)
    /// The album: the gallery before the reveal while the film develops, the
    /// group's album once it is developed.
    case developing(EventInfo)
    case failed(String)
  }

  @Published private(set) var phase: Phase = .starting
  @Published private(set) var busy = false
  @Published var nameError: String?

  /// `shots_left` as the server last said it (nil is the unlimited roll).
  @Published private(set) var serverLeft: Int?
  /// Frames taken but not yet claimed: in the queue, or still developing.
  @Published private(set) var unclaimed = 0
  @Published private(set) var developingNow = 0
  /// The queue's revision of `unclaimed` (`UnclaimedCount`).
  private var countRevision = -1

  // Missions — the guest half, as in the app's camera and Your shots.
  /// The guest's cards, with tags still in the queue applied.
  @Published private(set) var missions: [Mission] = []
  /// The mission the next shot is for.
  @Published var armedId: String?
  /// 11's "Are you one of these?": names the host listed that nobody else
  /// holds, and the guest's pick. Also read on 12 for "Are you on the list?".
  @Published private(set) var names: [MissionName] = []
  @Published var pickedName: String?
  /// 11's "Add your name" was tapped: the field instead of a host's name.
  @Published var typingName = false
  /// False until 11 has its first answer, so the field does not flash before the list.
  @Published private(set) var namesLoaded = false
  /// Back on 11 from 12 to switch to or from a host's name (2026-11-19, the user).
  @Published private(set) var changingName = false
  /// The name the group sees now, for 11's field when changing it.
  @Published private(set) var memberName: String?
  /// Your shots: uploaded frames and those still in the queue.
  @Published private(set) var shots: [ShotItem] = []
  /// The gallery before the reveal (2026-11-23): everyone else's photos, as
  /// smudges, newest first. The guest's own are `shots`.
  @Published private(set) var theirTiles: [GalleryTile] = []

  /// The album of a developed moment: every uploaded photo, oldest first, and
  /// the guest's own frames still on their way up.
  @Published private(set) var album: [AlbumItem] = []
  @Published private(set) var albumState: AlbumState = .loading
  /// How many people are on the roster, for the album's "M people".
  @Published private(set) var rosterCount = 0
  /// The signed-in guest, for "is this the host?".
  @Published private(set) var userId: String?
  /// "Develop now" is on its way to the server.
  @Published private(set) var ending = false
  @Published var endError: String?

  /// The server's last answer, kept for when it cannot be asked (no signal).
  private var serverMissions: [Mission] = []
  /// Storage path → signed URL, so a frame is signed once.
  private var signed: [String: URL] = [:]
  /// The event `album` belongs to.
  private var albumEventId: String?
  /// When the oldest URL in `signed` was made: they are valid for an hour.
  private var signedSince = Date()
  /// The roster's names by user id, for the gallery's tiles.
  private var rosterNames: [String: String] = [:]

  private var code: String?
  private var poll: Task<Void, Never>?
  private var observers: [NSObjectProtocol] = []

  /// Invite code → event id, so a guest who opens the link again is the
  /// same member, not asked for their name twice.
  private let memberships = UserDefaults.standard
  private static let lastCodeKey = "left.clip.lastCode"

  init() {
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: .shotClaimed, object: nil, queue: .main) { [weak self] note in
      MainActor.assumeIsolated { self?.claimed(note) }
    })
    observers.append(center.addObserver(forName: .shotFinished, object: nil, queue: .main) { [weak self] note in
      MainActor.assumeIsolated { self?.finished(note) }
    })
    observers.append(center.addObserver(forName: .shotTagged, object: nil, queue: .main) { [weak self] note in
      MainActor.assumeIsolated { self?.tagged(note) }
    })
  }

  /// The counter: the server's last count minus unclaimed frames, floored at
  /// zero, so the roll cannot be overdrawn offline. nil is unlimited.
  var shotsLeft: Int? {
    guard let serverLeft else { return nil }
    return max(0, serverLeft - unclaimed - developingNow)
  }

  /// What the Live Activity shows, while the guest is in the camera or
  /// waiting for the film (`LiveRoll.sync`). nil elsewhere — which changes
  /// nothing on the Lock Screen.
  var liveRoll: LiveRollSnapshot? {
    guard let code else { return nil }
    let event: EventInfo
    switch phase {
    case let .camera(e), let .developing(e): event = e
    default: return nil
    }
    return LiveRollSnapshot(
      eventId: event.id, eventName: event.name, endsAt: event.endsAt, code: code,
      state: .init(
        shotsLeft: shotsLeft,
        missionsDone: missions.filter { $0.photoId != nil }.count,
        missionsTotal: missions.count,
        developed: event.isDeveloped()
      )
    )
  }

  var event: EventInfo? {
    switch phase {
    case let .intro(e), let .waiting(e), let .camera(e), let .developing(e): return e
    default: return nil
    }
  }

  /// The code the guest joined with, for 12's invite QR.
  var inviteCode: String? { code }

  /// The caller hosts this moment: the gallery offers "Develop now". True in
  /// a demo; just as true for a host who opens their own invite in the clip.
  var isHost: Bool {
    guard let host = event?.hostId, let userId else { return false }
    return host == userId
  }

  /// The demo (`start_demo()`). Remembered per event on this phone, because
  /// only the rows the two RPCs return say so.
  var isDemo: Bool {
    guard let event else { return false }
    return event.demo != nil || memberships.bool(forKey: Self.demoKey(event.id))
  }

  private static func demoKey(_ eventId: String) -> String { "left.clip.demo.\(eventId)" }

  // MARK: Invocation

  /// The clip is opened by its invocation URL; give it a moment to arrive
  /// before falling back to the last invite.
  func launched() {
    if let raw = ProcessInfo.processInfo.environment["_XCAppClipURL"], let url = URL(string: raw) {
      open(url)
      return
    }
    Task {
      try? await Task.sleep(nanoseconds: 1_200_000_000)
      guard phase == .starting else { return }
      if let last = memberships.string(forKey: Self.lastCodeKey) {
        await enter(code: last)
      } else {
        phase = .noInvite
      }
    }
  }

  func open(_ url: URL) {
    guard let code = parseInviteCode(url) else {
      phase = .failed("This link isn’t a LEFT invite. Ask the host to send it again.")
      return
    }
    Task { await enter(code: code) }
  }

  /// Whether "Try again" has anything to try: a link that was not an invite
  /// left no code, and retrying it used to land on "Scan an invite".
  var canRetry: Bool { code != nil }

  func retry() {
    guard let code else { return }
    Task { await enter(code: code) }
  }

  private func enter(code: String) async {
    self.code = code
    guard ClipConfig.isConfigured else {
      phase = .failed(messageFor(ClipError.notConfigured))
      return
    }
    // The demo's code is not an invite: nothing is joined, and it is asked
    // for again every time the link is opened.
    if code == ClipConfig.demoCode {
      await startDemo()
      return
    }
    memberships.set(code, forKey: Self.lastCodeKey)
    guard let eventId = memberships.string(forKey: "left.clip.event.\(code)"),
          await Server.shared.userId != nil
    else {
      phase = .name(code: code)
      return
    }
    await load(eventId: eventId, code: code)
  }

  /// `start_demo()`: a live moment of the visitor's own with the sample
  /// guests' photos in it — or the demo they already have (running, or just
  /// developed). No name, no waiting, no intro: straight to the camera, and
  /// from there on under the event's real id and invite code.
  private func startDemo() async {
    if phase != .starting { phase = .starting }
    busy = true
    do {
      _ = try await Server.shared.ensureGuest()
      let event = try await Server.shared.startDemo()
      let real = event.inviteCode ?? ClipConfig.demoCode
      code = real
      memberships.set(real, forKey: Self.lastCodeKey)
      memberships.set(event.id, forKey: "left.clip.event.\(real)")
      memberships.set(true, forKey: Self.demoKey(event.id))
      memberships.set(true, forKey: Self.introKey(event.id))
      busy = false
      await load(eventId: event.id, code: real)
    } catch {
      busy = false
      phase = .failed(messageFor(error))
    }
  }

  private func load(eventId: String, code: String) async {
    busy = true
    defer { busy = false }
    do {
      userId = await Server.shared.userId
      // Membership first: RLS hides the event from a non-member, so asking
      // for the event first read "no such event" — "this invite link doesn't
      // work" — for a guest whose roster row is gone (2026-11-19: the old
      // guest was deleted, the clip still remembered the event).
      guard let member = try await Server.shared.getMyMember(eventId: eventId) else {
        // Not a member under this identity (a new one after a lost session).
        memberships.removeObject(forKey: "left.clip.event.\(code)")
        phase = .name(code: code)
        return
      }
      let event = try await Server.shared.getEvent(eventId)
      serverLeft = event.rollSize.map { max(0, $0 - member.shotsTaken) }
      memberName = member.displayName
      await recount(event)
      route(event)
    } catch {
      phase = .failed(messageFor(error))
    }
  }

  // MARK: 11

  /// `personId`: the host's name the guest chose; nil when they typed their
  /// own, which gives back a name they held (when the event has names at all).
  func join(name: String, personId: String?) {
    guard case let .name(code) = phase, !busy else { return }
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard (1...ClipConfig.maxNameLength).contains(trimmed.count) else { return }
    busy = true
    nameError = nil
    Task {
      defer { busy = false }
      do {
        _ = try await Server.shared.ensureGuest()
        // The name on the account, as 11 writes it; the roster has its own.
        try? await Server.shared.setDisplayName(trimmed)
        let eventId = try await Server.shared.joinEvent(code: code, name: trimmed)
        memberships.set(eventId, forKey: "left.clip.event.\(code)")
        if !names.isEmpty {
          do {
            try await Server.shared.claimMissionName(eventId: eventId, personId: personId)
          } catch ClipError.missionNameTaken {
            // Stay on 11; the name leaves the list. The join stands; Continue
            // joins again, which changes nothing.
            names.removeAll { $0.id == personId }
            pickedName = nil
            nameError = messageFor(ClipError.missionNameTaken)
            await loadNames()
            return
          } catch {
            // Never in the way of joining.
          }
        }
        changingName = false
        busy = false
        await load(eventId: eventId, code: code)
      } catch {
        nameError = messageFor(error)
      }
    }
  }

  /// 11 opens: its first answer decides what is chosen.
  func beginNames() {
    namesLoaded = false
  }

  /// 11's names, asked again every few seconds so a name someone else takes
  /// disappears; 12 asks too, for its link. Needs a signed-in guest, so the
  /// anonymous sign-in happens here rather than on Continue — as on the web camera.
  func loadNames() async {
    guard let code else { return }
    let first = !namesLoaded
    do {
      _ = try await Server.shared.ensureGuest()
      names = try await Server.shared.missionNames(code: code)
    } catch {
      // A failed refresh keeps the list it had; a failed first load is the field alone.
      if first { names = [] }
    }
    guard case .name = phase else { return }
    namesLoaded = true
    if first {
      if let mine = names.first(where: \.isMine) {
        pickedName = mine.id
        typingName = false
      } else {
        pickedName = nil
        // Back from 12 under their own name: the field, filled, is their choice.
        typingName = changingName && !names.isEmpty
      }
    } else if let picked = pickedName, !names.contains(where: { $0.id == picked }) {
      pickedName = nil
      nameError = messageFor(ClipError.missionNameTaken)
    }
  }

  /// 12 → 11, to switch to or from a host's name. Only while waiting: once
  /// the event starts the missions are dealt and nothing moves.
  func changeName() {
    guard case .waiting = phase, let code else { return }
    nameError = nil
    changingName = true
    namesLoaded = false
    phase = .name(code: code)
  }

  /// 11's back button when changing: back to 12 as it was.
  func cancelChangeName() {
    guard changingName, case let .name(code) = phase,
          let eventId = memberships.string(forKey: "left.clip.event.\(code)")
    else { return }
    changingName = false
    nameError = nil
    Task { await load(eventId: eventId, code: code) }
  }

  // MARK: Routing

  private func route(_ event: EventInfo) {
    if event.isDeveloped() || rollUsedUp(event) {
      phase = .developing(event)
    } else if !introSeen(event.id) {
      // Before 12 or the camera, once per moment — a late joiner too, as in the app.
      phase = .intro(event)
    } else if event.status == .setup {
      phase = .waiting(event)
    } else {
      phase = .camera(event)
    }
    startPolling()
    Task {
      await loadMissions()
      await loadShots()
    }
  }

  // MARK: 11.5 — the intro

  /// `lib/guest-intro.ts`: once per moment and phone.
  private static func introKey(_ eventId: String) -> String { "left.clip.intro-seen.\(eventId)" }

  private func introSeen(_ eventId: String) -> Bool {
    memberships.bool(forKey: Self.introKey(eventId))
  }

  /// "Got it" or "Skip": on to wherever the moment is now (12, the camera, or developing).
  func finishIntro() {
    guard case let .intro(event) = phase else { return }
    memberships.set(true, forKey: Self.introKey(event.id))
    route(event)
    // The event may have moved on while the guest read.
    Task { await refresh() }
  }

  /// 12's "How it works".
  func replayIntro() {
    if case let .waiting(event) = phase { phase = .intro(event) }
  }

  private func rollUsedUp(_ event: EventInfo) -> Bool {
    shotsLeft == 0 && unclaimed == 0 && developingNow == 0 && !event.isDeveloped()
  }

  /// The camera's countdown is a way to the developing state, as in the app.
  func showDeveloping() {
    if case let .camera(event) = phase { phase = .developing(event) }
  }

  func backToCamera() {
    if case let .developing(event) = phase, !event.isDeveloped(), shotsLeft != 0 {
      phase = .camera(event)
    }
  }

  /// No realtime in the clip: ask again every 15 s and on every foreground.
  private func startPolling() {
    poll?.cancel()
    poll = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: ClipConfig.pollSeconds * 1_000_000_000)
        guard !Task.isCancelled else { return }
        await self?.refresh()
      }
    }
  }

  func refresh() async {
    guard let current = event else { return }
    guard let fresh = try? await Server.shared.getEvent(current.id) else { return }
    switch phase {
    case .waiting where fresh.status != .setup || fresh.isDeveloped():
      route(fresh)
    case .waiting:
      // A new name or event image from the host shows without a restart.
      phase = .waiting(fresh)
    case .camera where fresh.isDeveloped():
      phase = .developing(fresh)
    case .camera:
      phase = .camera(fresh)
    case .developing:
      phase = .developing(fresh)
      // The gallery fills in as the group shoots; the album as late uploads land.
      if fresh.isDeveloped() {
        await loadAlbum()
      } else {
        await loadShots()
        await loadGallery()
      }
    default:
      break
    }
  }

  // MARK: The roll

  private func recount(_ event: EventInfo) async {
    guard let userId = await Server.shared.userId else { return }
    apply(await UploadQueue.shared.unclaimed(eventId: event.id, userId: userId))
  }

  /// Take the queue's count unless a newer one is already shown.
  private func apply(_ count: UnclaimedCount) {
    guard count.revision >= countRevision else { return }
    countRevision = count.revision
    unclaimed = count.count
  }

  private func unclaimedCount(in note: Notification) -> UnclaimedCount? {
    guard let count = note.userInfo?["unclaimed"] as? Int,
          let revision = note.userInfo?["revision"] as? Int else { return nil }
    return UnclaimedCount(count: count, revision: revision)
  }

  /// The shutter fired: count the frame before it is developed and queued.
  func shotStarted() {
    developingNow += 1
  }

  /// The frame is in the queue (with the queue's count), or was lost while
  /// developing (nil). The frame moves from "developing" to "unclaimed" in
  /// one step: re-reading the queue afterwards let the counter go back up for
  /// a moment and roll down a second time (2026-11-19, the user).
  func shotQueued(_ count: UnclaimedCount?) {
    developingNow = max(0, developingNow - 1)
    if let count { apply(count) }
    guard let event else { return }
    Task {
      await applyQueueTags()
      await loadShots()
    }
  }

  private func claimed(_ note: Notification) {
    guard let event, note.userInfo?["eventId"] as? String == event.id else { return }
    // The server's count and the queue's, in the same step: a claimed frame
    // leaves `unclaimed` exactly when the server starts counting it.
    if event.rollSize != nil, let left = note.userInfo?["shotsLeft"] as? Int {
      serverLeft = left
    }
    if let count = unclaimedCount(in: note) {
      apply(count)
      if case .camera = phase, rollUsedUp(event) { phase = .developing(event) }
      return
    }
    Task {
      await recount(event)
      if case .camera = phase, rollUsedUp(event) { phase = .developing(event) }
    }
  }

  private func finished(_ note: Notification) {
    guard let event, note.userInfo?["eventId"] as? String == event.id else { return }
    let reason = note.userInfo?["reason"] as? String
    if reason == "roll_empty" { serverLeft = 0 }
    if let count = unclaimedCount(in: note) { apply(count) }
    Task {
      await recount(event)
      if reason == "event_closed" { await refresh() }
      await loadShots()
      // A frame that was still uploading when the film was developed is in
      // the album now.
      if self.event?.isDeveloped() == true { await loadAlbum() }
    }
  }

  private func tagged(_ note: Notification) {
    guard let event, note.userInfo?["eventId"] as? String == event.id else { return }
    Task { await loadMissions() }
  }

  // MARK: Missions

  /// Ask the server, then lay the queue's unsent tags over its answer.
  func loadMissions() async {
    guard let event else { return }
    // No missions in a demo.
    if isDemo {
      serverMissions = []
      missions = []
      return
    }
    if let fresh = try? await Server.shared.myMissions(eventId: event.id) { serverMissions = fresh }
    await applyQueueTags()
  }

  /// A frame re-tagged while it waits in the queue counts as tagged already,
  /// so the list and the capsule are right with no signal.
  private func applyQueueTags() async {
    guard let event, let userId = await Server.shared.userId else { return }
    var list = serverMissions
    for local in await UploadQueue.shared.local(eventId: event.id, userId: userId) where local.shot.missionDirty == true {
      for i in list.indices where list[i].photoId == local.shot.id { list[i].photoId = nil }
      if let target = local.shot.missionId, let i = list.firstIndex(where: { $0.id == target }) {
        list[i].photoId = local.shot.id
      }
    }
    missions = list
    if let armedId, list.first(where: { $0.id == armedId })?.photoId != nil { self.armedId = nil }
  }

  func arm(_ mission: Mission?) {
    armedId = mission?.id
  }

  /// "This photo was for that mission" (nil: for none). A frame still queued
  /// is re-tagged there; one that has left goes straight to the server.
  func tag(photoId: String, missionId: String?) async throws {
    if await UploadQueue.shared.setMission(id: photoId, missionId: missionId) {
      await applyQueueTags()
      return
    }
    try await Server.shared.setPhotoMission(photoId: photoId, missionId: missionId)
    await loadMissions()
  }

  func mission(for photoId: String) -> Mission? {
    missions.first { $0.photoId == photoId }
  }

  // MARK: Your shots

  /// The guest's own frames: what is still in the queue (from its files) and
  /// what the server holds (signed URLs). Offline, the server's half is what
  /// it was last time.
  func loadShots() async {
    guard let event, let userId = await Server.shared.userId else { return }
    let local = await UploadQueue.shared.local(eventId: event.id, userId: userId)
    var items = local.map {
      ShotItem(id: $0.shot.id, takenAt: parseTimestamp($0.shot.takenAt) ?? .distantPast,
               thumb: $0.thumb, full: $0.original, queued: true)
    }
    let queuedIds = Set(items.map(\.id))
    do {
      let remote = try await Server.shared.myPhotos(eventId: event.id).filter { !queuedIds.contains($0.id) }
      await sign(remote.flatMap { [$0.thumbPath, $0.storagePath].compactMap { $0 } })
      items += remote.map {
        ShotItem(id: $0.id, takenAt: parseTimestamp($0.takenAt) ?? .distantPast,
                 thumb: $0.thumbPath.flatMap { signed[$0] }, full: $0.storagePath.flatMap { signed[$0] },
                 queued: false)
      }
    } catch {
      items += shots.filter { !$0.queued && !queuedIds.contains($0.id) }
    }
    shots = items.sorted { $0.takenAt < $1.takenAt }
  }

  /// Sign what is not signed yet, a batch at a time. A failed batch leaves
  /// its paths unsigned (the tiles stay dark) and is asked for again next time.
  private func sign(_ paths: [String]) async {
    if Date().timeIntervalSince(signedSince) > ClipConfig.signedURLLifetime {
      signed = [:]
    }
    if signed.isEmpty { signedSince = Date() }
    var missing: [String] = []
    var seen = Set<String>()
    for path in paths where signed[path] == nil && !seen.contains(path) {
      seen.insert(path)
      missing.append(path)
    }
    var start = 0
    while start < missing.count {
      let end = min(start + ClipConfig.signBatch, missing.count)
      let batch = Array(missing[start..<end])
      if let urls = try? await Server.shared.signedURLs(batch) {
        signed.merge(urls) { _, new in new }
      }
      start = end
    }
  }

  // MARK: Develop now

  /// The host develops the film early (`end_event()`), then the album. Frames
  /// still in the queue keep uploading — the server takes claims and uploads
  /// after the developing — and the album reloads as each one lands.
  func developNow() {
    guard case let .developing(event) = phase, isHost, !ending, !event.isDeveloped() else { return }
    ending = true
    endError = nil
    Task {
      defer { ending = false }
      do {
        let fresh = try await Server.shared.endEvent(event.id)
        guard self.event?.id == fresh.id else { return }
        if fresh.demo != nil { memberships.set(true, forKey: Self.demoKey(fresh.id)) }
        phase = .developing(fresh)
        await loadAlbum()
      } catch {
        endError = messageFor(error)
      }
    }
  }

  // MARK: The album

  /// "M people": the roster, or — before it is known — everyone with a photo.
  var albumPeople: Int {
    max(rosterCount, Set(album.compactMap(\.userId)).count)
  }

  /// Photo id → the photographer's name, for the viewer's caption.
  var albumAuthors: [String: String] {
    var names: [String: String] = [:]
    for item in album { names[item.id] = item.author }
    return names
  }

  /// "Try again" on the album's error state.
  func reloadAlbum() {
    Task { await loadAlbum() }
  }

  /// Every uploaded photo of the developed moment (RLS opens them all to a
  /// member after the reveal), the roster's names, and signed URLs for the
  /// paths exactly as the rows give them. The guest's own frames still in the
  /// queue are in it too, from their files. A failed reload keeps what is shown.
  func loadAlbum() async {
    guard let event, event.isDeveloped() else { return }
    if albumEventId != event.id {
      // Another moment's album has nothing to say here.
      albumEventId = event.id
      album = []
      rosterCount = 0
      albumState = .loading
    } else if albumState != .loaded {
      albumState = .loading
    }
    do {
      let rows = try await Server.shared.albumPhotos(eventId: event.id)
      if let names = try? await Server.shared.roster(eventId: event.id) {
        rosterNames = names
        rosterCount = names.count
      }
      await sign(rows.flatMap { [$0.thumbPath, $0.storagePath].compactMap { $0 } })
      let me = await Server.shared.userId
      var local: [LocalShot] = []
      if let me { local = await UploadQueue.shared.local(eventId: event.id, userId: me) }
      // The phase may have moved on while the server answered.
      guard self.event?.id == event.id else { return }

      var items: [AlbumItem] = []
      for row in rows {
        let author: String
        if let id = row.userId, let name = rosterNames[id] {
          author = name
        } else {
          author = "A guest"
        }
        var thumb: URL?
        if let path = row.thumbPath { thumb = signed[path] }
        var full: URL?
        if let path = row.storagePath { full = signed[path] }
        items.append(AlbumItem(
          shot: ShotItem(id: row.id, takenAt: parseTimestamp(row.takenAt) ?? .distantPast,
                         thumb: thumb ?? full, full: full ?? thumb, queued: false),
          userId: row.userId, author: author
        ))
      }
      let uploaded = Set(items.map(\.id))
      for frame in local where !uploaded.contains(frame.shot.id) {
        var author = memberName ?? "You"
        if let me, let name = rosterNames[me] { author = name }
        items.append(AlbumItem(
          shot: ShotItem(id: frame.shot.id, takenAt: parseTimestamp(frame.shot.takenAt) ?? .distantPast,
                         thumb: frame.thumb, full: frame.original, queued: true),
          userId: me, author: author
        ))
      }
      items.sort { $0.shot.takenAt < $1.shot.takenAt }
      if items != album { album = items }
      albumState = .loaded
    } catch {
      // What is on screen stays; only a first load says what went wrong.
      if albumState != .loaded { albumState = .failed(messageFor(error)) }
    }
  }

  // MARK: The gallery before the reveal

  /// Every photo of the event so far: the guest's own (sharp, from `shots`)
  /// and everyone else's (`theirTiles`), newest first.
  var galleryTiles: [GalleryTile] {
    let mine = shots.map { GalleryTile(id: $0.id, userId: nil, takenAt: $0.takenAt, kind: .mine($0)) }
    let ids = Set(mine.map(\.id))
    return (mine + theirTiles.filter { !ids.contains($0.id) }).sorted { $0.takenAt > $1.takenAt }
  }

  /// "from M people": everyone with a photo in the gallery, the guest included.
  var galleryPeople: Int {
    Set(theirTiles.compactMap(\.userId)).count + (shots.isEmpty ? 0 : 1)
  }

  /// `event_gallery()` and the roster's names. Offline, or on a server
  /// without the function yet, the gallery stays as it was.
  func loadGallery() async {
    guard let event, !event.isDeveloped(), let userId = await Server.shared.userId else { return }
    guard let rows = try? await Server.shared.eventGallery(eventId: event.id) else { return }
    if let names = try? await Server.shared.roster(eventId: event.id) { rosterNames = names }
    // The phase may have moved on while the server answered.
    guard self.event?.id == event.id else { return }
    let tiles = rows.filter { $0.userId != userId }.map { row in
      GalleryTile(
        id: row.id, userId: row.userId,
        takenAt: parseTimestamp(row.takenAt) ?? .distantPast,
        kind: .theirs(
          blurhash: row.blurhash,
          author: rosterNames[row.userId] ?? "A guest",
          portrait: (row.height ?? 4) >= (row.width ?? 3)
        )
      )
    }
    if tiles != theirTiles { theirTiles = tiles }
  }
}

/// One tile of the gallery before the reveal.
struct GalleryTile: Identifiable, Equatable {
  enum Kind: Equatable {
    /// The guest's own frame, sharp; opens in the viewer.
    case mine(ShotItem)
    /// Someone else's: its smudge (nil while the upload is on its way, or from
    /// a phone that sent none), the photographer's name, and its shape.
    case theirs(blurhash: String?, author: String, portrait: Bool)
  }

  let id: String
  /// The photographer; nil for the guest's own.
  let userId: String?
  let takenAt: Date
  let kind: Kind
}

/// One print of a developed album: the photo and who took it.
struct AlbumItem: Identifiable, Equatable {
  let shot: ShotItem
  /// The photographer; nil when their account is gone.
  let userId: String?
  let author: String

  var id: String { shot.id }
}

enum AlbumState: Equatable {
  case loading
  case loaded
  case failed(String)
}

/// A frame in Your shots. `thumb` and `full` are files while it is queued,
/// signed URLs once it is uploaded.
struct ShotItem: Identifiable, Equatable {
  let id: String
  let takenAt: Date
  let thumb: URL?
  let full: URL?
  let queued: Bool
}
