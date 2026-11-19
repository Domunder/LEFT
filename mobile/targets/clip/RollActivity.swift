import ActivityKit
import Foundation

/// What the clip's Live Activity shows. **Keep identical to
/// `targets/clip-activity/RollActivity.swift`** — the clip starts the activity
/// with this type and the extension draws it; ActivityKit matches them by name
/// and shape.
struct RollActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    /// nil is the unlimited roll.
    var shotsLeft: Int?
    var missionsDone: Int
    var missionsTotal: Int
    /// The film is developed: the activity's last state.
    var developed: Bool
  }

  var eventName: String
  var endsAt: Date
  /// Opens the clip back into this event: `https://leftmoment.com/j/{code}`.
  var code: String
}

/// What the model knows that the Live Activity shows (`ClipModel.liveRoll`).
struct LiveRollSnapshot: Equatable {
  let eventId: String
  let eventName: String
  let endsAt: Date
  let code: String
  let state: RollActivityAttributes.ContentState
}

/// Starts, updates and ends the clip's Live Activity — one per event.
///
/// Updated locally only, while the clip runs: every photo, every mission done.
/// The countdown on it ticks by itself (`Text(timerInterval:)`), so it stays
/// right with the clip closed. When the film is developed it shows that and
/// leaves the Lock Screen after an hour. Push updates (the reveal reaching a
/// phone whose clip is closed) need APNs and are not built; the activity's
/// `staleDate` is the event's end, so the system marks it out of date then.
@MainActor
enum LiveRoll {
  static func sync(_ snapshot: LiveRollSnapshot?) {
    guard let snapshot, ActivityAuthorizationInfo().areActivitiesEnabled else { return }

    let content = ActivityContent(
      state: snapshot.state,
      staleDate: snapshot.state.developed ? nil : snapshot.endsAt
    )
    let mine = Activity<RollActivityAttributes>.activities.filter { $0.attributes.code == snapshot.code }
    // Another event's activity has nothing more to say.
    for other in Activity<RollActivityAttributes>.activities where other.attributes.code != snapshot.code {
      Task { await other.end(nil, dismissalPolicy: .immediate) }
    }

    if let current = mine.first {
      guard current.content.state != snapshot.state else { return }
      Task {
        if snapshot.state.developed {
          await current.end(content, dismissalPolicy: .after(.now.addingTimeInterval(3600)))
        } else {
          await current.update(content)
        }
      }
      return
    }

    // A developed film starts nothing; the album is the app's.
    guard !snapshot.state.developed else { return }
    _ = try? Activity.request(
      attributes: RollActivityAttributes(eventName: snapshot.eventName, endsAt: snapshot.endsAt, code: snapshot.code),
      content: content,
      pushType: nil
    )
  }
}
