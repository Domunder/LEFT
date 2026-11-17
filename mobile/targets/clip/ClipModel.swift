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
    /// 12: the host has not started the event.
    case waiting(EventInfo)
    /// 13: shooting.
    case camera(EventInfo)
    /// The album's developing state: countdown, then "get the app".
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
  }

  /// The counter: the server's last count minus unclaimed frames, floored at
  /// zero, so the roll cannot be overdrawn offline. nil is unlimited.
  var shotsLeft: Int? {
    guard let serverLeft else { return nil }
    return max(0, serverLeft - unclaimed - developingNow)
  }

  var event: EventInfo? {
    switch phase {
    case let .waiting(e), let .camera(e), let .developing(e): return e
    default: return nil
    }
  }

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

  func retry() {
    guard let code else { phase = .noInvite; return }
    Task { await enter(code: code) }
  }

  private func enter(code: String) async {
    self.code = code
    memberships.set(code, forKey: Self.lastCodeKey)
    guard ClipConfig.isConfigured else {
      phase = .failed(messageFor(ClipError.notConfigured))
      return
    }
    guard let eventId = memberships.string(forKey: "left.clip.event.\(code)"),
          await Server.shared.userId != nil
    else {
      phase = .name(code: code)
      return
    }
    await load(eventId: eventId, code: code)
  }

  private func load(eventId: String, code: String) async {
    busy = true
    defer { busy = false }
    do {
      let event = try await Server.shared.getEvent(eventId)
      guard let member = try await Server.shared.getMyMember(eventId: eventId) else {
        // Not a member under this identity (a new one after a lost session).
        memberships.removeObject(forKey: "left.clip.event.\(code)")
        phase = .name(code: code)
        return
      }
      serverLeft = event.rollSize.map { max(0, $0 - member.shotsTaken) }
      await recount(event)
      route(event)
    } catch {
      phase = .failed(messageFor(error))
    }
  }

  // MARK: 11

  func join(name: String) {
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
        busy = false
        await load(eventId: eventId, code: code)
      } catch {
        nameError = messageFor(error)
      }
    }
  }

  // MARK: Routing

  private func route(_ event: EventInfo) {
    if event.isDeveloped() || rollUsedUp(event) {
      phase = .developing(event)
    } else if event.status == .setup {
      phase = .waiting(event)
    } else {
      phase = .camera(event)
    }
    startPolling()
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
    case .camera where fresh.isDeveloped():
      phase = .developing(fresh)
    case .camera:
      phase = .camera(fresh)
    case .developing:
      phase = .developing(fresh)
    default:
      break
    }
  }

  // MARK: The roll

  private func recount(_ event: EventInfo) async {
    guard let userId = await Server.shared.userId else { return }
    unclaimed = await UploadQueue.shared.unclaimed(eventId: event.id, userId: userId)
  }

  /// The shutter fired: count the frame before it is developed and queued.
  func shotStarted() {
    developingNow += 1
  }

  /// The frame is in the queue (or was lost while developing).
  func shotQueued(_ ok: Bool) {
    developingNow = max(0, developingNow - 1)
    guard let event else { return }
    Task { await recount(event) }
  }

  private func claimed(_ note: Notification) {
    guard let event, note.userInfo?["eventId"] as? String == event.id else { return }
    if event.rollSize != nil, let left = note.userInfo?["shotsLeft"] as? Int {
      serverLeft = left
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
    Task {
      await recount(event)
      if reason == "event_closed" { await refresh() }
    }
  }
}
