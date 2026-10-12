//
//  19 · Lockscreen Live Activity — the views.
//
//  Transcribed from the artboard's lock-screen card: a 32pt off-white rounded
//  square holding a dark film icon, "LEFT" against a relative timestamp, one line
//  of message, a 5pt progress bar, and a used/left row at 10pt.
//
//  **The palette is duplicated from constants/theme.ts by necessity.** A widget
//  extension is a separate process and cannot import JavaScript, so there is no
//  way to share the tokens. `Palette` below is the mirror; when `Colors` moves,
//  this moves with it.
//
//  **The Dynamic Island presentations are invented.** The artboard draws only the
//  lock screen. On any device with an Island that is the presentation people
//  actually see while the phone is unlocked and in their hand — which at an event
//  is most of the time — so shipping without them would mean a Live Activity that
//  is invisible exactly when the group is filming.
//
//  Two things the artboard shows that are deliberately not reproduced:
//   - the second, older notification beneath the card. That is a *push*
//     notification, not part of this activity, and nothing in the app sends one.
//   - the German copy ("Anna hat 8s gefilmt"). Every other screen in the app is
//     English; the strings here match 18's.
//

import ActivityKit
import SwiftUI
import WidgetKit

/// Mirrors `Colors` in src/constants/theme.ts. Edit both together.
private enum Palette {
    static let text = Color(red: 0.941, green: 0.929, blue: 0.910)      // #f0ede8
    static let onLight = Color(red: 0.024, green: 0.024, blue: 0.031)   // #060608
    static let rec = Color(red: 1.0, green: 0.231, blue: 0.231)         // #ff3b3b

    static let textMuted = text.opacity(0.55)
    static let textFaint = text.opacity(0.40)
    static let track = Color.white.opacity(0.15)
    static let cardStroke = Color.white.opacity(0.10)
}

/// The film-strip mark — the artboard's rounded rect with two vertical bars.
private struct FilmMark: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 9, style: .continuous)
            .fill(Palette.text)
            .frame(width: 32, height: 32)
            .overlay {
                Image(systemName: "film")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Palette.onLight)
            }
    }
}

/// The 5pt bar. Red once the group is nearly out, matching 13's own bar.
private struct BudgetBar: View {
    let state: LeftBudgetAttributes.ContentState

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.track)
                Capsule()
                    .fill(state.isCritical ? Palette.rec : Palette.text)
                    .frame(width: max(0, geometry.size.width * state.fraction))
            }
        }
        .frame(height: 5)
    }
}

/// The lock-screen and notification-centre presentation.
private struct LockScreenView: View {
    let context: ActivityViewContext<LeftBudgetAttributes>

    private var message: String {
        let state = context.state
        guard let who = state.lastFilmedBy, let seconds = state.lastClipSeconds else {
            // Before anyone has filmed there is no event to narrate, so the card
            // states the budget rather than inventing an author.
            return "\(state.remainingSeconds)s left of \(context.attributes.eventName)."
        }
        return "\(who) filmed \(seconds)s. \(state.remainingSeconds)s left — \(context.attributes.eventName)."
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            FilmMark()

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline) {
                    Text("LEFT")
                        .font(.system(size: 13, weight: .semibold))
                        .kerning(0.26)
                        .foregroundStyle(Palette.text.opacity(0.85))
                    Spacer()
                    // Relative, and re-rendered by the system as it ages.
                    Text(Date(), style: .relative)
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.textFaint)
                }

                Text(message)
                    .font(.system(size: 14))
                    .foregroundStyle(Palette.text)
                    .lineSpacing(2)
                    .padding(.top, 3)

                BudgetBar(state: context.state)
                    .padding(.top, 10)

                HStack {
                    Text("\(context.state.usedSeconds)s used")
                    Spacer()
                    Text("\(context.state.remainingSeconds)s left")
                }
                .font(.system(size: 10))
                .foregroundStyle(Palette.textFaint)
                .padding(.top, 5)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        // The system paints the card's own material behind this; the artboard's
        // rgba(255,255,255,0.09) fill is that material, not a colour we set.
        .activityBackgroundTint(Color.black.opacity(0.35))
        .activitySystemActionForegroundColor(Palette.text)
    }
}

struct LeftBudgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LeftBudgetAttributes.self) { context in
            LockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    FilmMark()
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.remainingSeconds)s")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(context.state.isCritical ? Palette.rec : Palette.text)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(context.attributes.eventName)
                            .font(.system(size: 13))
                            .foregroundStyle(Palette.textMuted)
                        BudgetBar(state: context.state)
                    }
                }
            } compactLeading: {
                Image(systemName: "film")
                    .foregroundStyle(Palette.text)
            } compactTrailing: {
                // The one number worth the space: how much the group has left.
                Text("\(context.state.remainingSeconds)s")
                    .foregroundStyle(context.state.isCritical ? Palette.rec : Palette.text)
            } minimal: {
                Image(systemName: "film")
                    .foregroundStyle(context.state.isCritical ? Palette.rec : Palette.text)
            }
            .keylineTint(Palette.text)
        }
    }
}
