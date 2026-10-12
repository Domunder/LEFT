//
//  19 · Lockscreen Live Activity — the shared budget, on the lock screen.
//
//  The shape of the activity. ActivityKit splits this in two and the split is
//  its rule, not a choice:
//
//    - the outer `LeftBudgetAttributes` is fixed for the life of the activity and
//      is set once, at `Activity.request`. The event's name and id never change
//      while it runs.
//    - `ContentState` is everything that moves. Every update ships one of these,
//      and it must be `Codable` because a remote update arrives as JSON in an
//      APNs payload.
//
//  This file is compiled into BOTH targets — the app (which starts and updates
//  the activity) and the widget extension (which draws it). They are separate
//  processes and share nothing but this declaration, so it must stay free of
//  anything either side cannot import.
//
//  Kept deliberately small. Everything derivable — the fraction used, whether the
//  group is nearly out — is computed in the view rather than shipped, because
//  every stored property here is bytes in a push payload with a hard size limit.
//

import ActivityKit
import Foundation

struct LeftBudgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Seconds the group has already spent.
        var usedSeconds: Int
        /// The event's whole budget. Fixed in practice, but shipped so the bar
        /// can never render against a total the app has since corrected.
        var budgetSeconds: Int
        /// Who filmed most recently, if anyone has. Nil before the first clip.
        var lastFilmedBy: String?
        /// How long their clip was.
        var lastClipSeconds: Int?

        /// What the bar fills to. Clamped: a commit capped at its hold can, in
        /// principle, leave `used` a hair over `budget`, and a bar past 100%
        /// would draw outside its own track.
        var fraction: Double {
            guard budgetSeconds > 0 else { return 0 }
            return min(1, Double(usedSeconds) / Double(budgetSeconds))
        }

        var remainingSeconds: Int {
            max(0, budgetSeconds - usedSeconds)
        }

        /// Mirrors `Camera.bar.criticalFraction` in constants/theme.ts — 15%,
        /// with a 5s floor so a 30s film still warns at a useful moment.
        /// **These two must be edited together**; a widget extension cannot
        /// import JavaScript, so the threshold necessarily exists twice.
        var isCritical: Bool {
            remainingSeconds <= max(5, Int(Double(budgetSeconds) * 0.15))
        }
    }

    /// The film's name, as the host typed it on screen 02.
    var eventName: String
    /// Lets a future deep link open the right event from the lock screen.
    var eventId: String
}
