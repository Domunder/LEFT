import ActivityKit
import Foundation

/// What the clip's Live Activity shows. **Keep identical to
/// `targets/clip/RollActivity.swift`** — the clip starts the activity with this
/// type and the extension draws it; ActivityKit matches them by name and
/// shape. (One shared file would be `targets/_shared`, but that folder is also
/// compiled into the React Native app, which has no use for it.)
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
