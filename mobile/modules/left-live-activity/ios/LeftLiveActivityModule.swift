//
//  The app side of screen 19.
//
//  **This is a different target from the widget extension, and it has to be.**
//  The extension is a separate process launched by WidgetKit; JavaScript cannot
//  call into it. So the app owns starting, updating and ending the activity, and
//  the extension only ever draws whatever state it is handed.
//
//  Everything here is guarded twice — once at compile time (`canImport`) and once
//  at run time (`#available`) — because the module is loaded on every iOS build
//  including ones below 16.2, and a Live Activity that is merely unavailable must
//  degrade to nothing rather than crash the camera screen that called it.
//
//  ## The limit worth knowing
//
//  `Activity.update` only reaches the lock screen while **this process is
//  running**. Updating a backgrounded app's activity requires an ActivityKit push
//  token and an APNs `liveactivity` push, and none of that exists here. In
//  practice: a phone in a pocket shows the budget as it was when the app was last
//  foregrounded. That is the gap between this scaffold and the feature the
//  artboard implies, and it is not small.
//

import ExpoModulesCore

#if canImport(ActivityKit)
import ActivityKit
#endif

public class LeftLiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("LeftLiveActivity")

        /// Whether an activity can be started at all.
        ///
        /// False on iOS below 16.2, and false when the user has turned Live
        /// Activities off for LEFT in Settings — which they can do at any time,
        /// including while one is running.
        Function("areActivitiesEnabled") { () -> Bool in
            #if canImport(ActivityKit)
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            #endif
            return false
        }

        /// Start one, returning its id so the caller can end exactly this one.
        ///
        /// Returns nil rather than throwing when Live Activities are unavailable:
        /// the camera screen calls this on mount and an unavailable widget must
        /// not be an error the user sees.
        AsyncFunction("startActivity") { (
            eventId: String,
            eventName: String,
            usedSeconds: Int,
            budgetSeconds: Int
        ) -> String? in
            #if canImport(ActivityKit)
            if #available(iOS 16.2, *) {
                guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }

                let attributes = LeftBudgetAttributes(eventName: eventName, eventId: eventId)
                let state = LeftBudgetAttributes.ContentState(
                    usedSeconds: usedSeconds,
                    budgetSeconds: budgetSeconds,
                    lastFilmedBy: nil,
                    lastClipSeconds: nil
                )

                do {
                    let activity = try Activity.request(
                        attributes: attributes,
                        content: ActivityContent(state: state, staleDate: nil),
                        pushType: nil
                    )
                    return activity.id
                } catch {
                    // Throwing here would surface as a red screen on a feature
                    // that is decoration. Nil reads as "not running", which is true.
                    return nil
                }
            }
            #endif
            return nil
        }

        /// Push new numbers into every running activity.
        ///
        /// Every activity rather than one by id: there is only ever one — the app
        /// films one event at a time — and iterating avoids holding an id across a
        /// process restart that would have invalidated it anyway.
        AsyncFunction("updateActivity") { (
            usedSeconds: Int,
            budgetSeconds: Int,
            lastFilmedBy: String?,
            lastClipSeconds: Int?
        ) -> Void in
            #if canImport(ActivityKit)
            if #available(iOS 16.2, *) {
                let state = LeftBudgetAttributes.ContentState(
                    usedSeconds: usedSeconds,
                    budgetSeconds: budgetSeconds,
                    lastFilmedBy: lastFilmedBy,
                    lastClipSeconds: lastClipSeconds
                )

                for activity in Activity<LeftBudgetAttributes>.activities {
                    await activity.update(ActivityContent(state: state, staleDate: nil))
                }
            }
            #endif
        }

        /// Take it off the lock screen.
        ///
        /// `.immediate` rather than letting it linger: the event is over, and an
        /// activity that outlived it would sit there showing a budget nobody can
        /// spend. Called when the event flips to 'processing'.
        AsyncFunction("endActivity") { () -> Void in
            #if canImport(ActivityKit)
            if #available(iOS 16.2, *) {
                for activity in Activity<LeftBudgetAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            #endif
        }
    }
}
