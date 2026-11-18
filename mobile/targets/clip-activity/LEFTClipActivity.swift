import ActivityKit
import SwiftUI
import WidgetKit

/*
  The clip's Live Activity (2026-11-18, the user: "it should stay in the
  notifications so I can tap and see: I still have 4 photos to take").

  Lock Screen: the event's name, "4 left" in the counter's serif, the open
  missions and the time to the reveal. Dynamic Island: the count and the
  timer. A tap opens the clip on the event's camera. Only Live Activities may
  live in a clip's widget extension â€” no Home Screen widget here.

  The app's fonts are not bundled in this extension (it would double the
  fonts' weight in the clip's 15 MB); the system serif stands in for DM Serif.
*/
@main
struct LEFTClipActivityBundle: WidgetBundle {
  var body: some Widget {
    RollLiveActivity()
  }
}

private enum Palette {
  static let bg = Color(red: 16 / 255, green: 16 / 255, blue: 16 / 255)
  static let text = Color(red: 240 / 255, green: 237 / 255, blue: 232 / 255)
  static let muted = text.opacity(0.55)
  static let faint = text.opacity(0.32)
  static let low = Color(red: 240 / 255, green: 180 / 255, blue: 120 / 255).opacity(0.95)
  static let green = Color(red: 140 / 255, green: 220 / 255, blue: 120 / 255).opacity(0.85)
}

struct RollLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RollActivityAttributes.self) { context in
      LockScreenView(attributes: context.attributes, state: context.state, stale: context.isStale)
        .activityBackgroundTint(Palette.bg)
        .activitySystemActionForegroundColor(Palette.text)
        .widgetURL(link(context.attributes))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Count(state: context.state, size: 34)
            .padding(.leading, 6)
        }
        DynamicIslandExpandedRegion(.trailing) {
          RevealTimer(attributes: context.attributes, state: context.state)
            .font(.system(size: 15, weight: .medium).monospacedDigit())
            .foregroundStyle(Palette.muted)
            .multilineTextAlignment(.trailing)
            .padding(.trailing, 6)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text(context.attributes.eventName.uppercased())
              .font(.system(size: 11, weight: .medium))
              .tracking(1.4)
              .foregroundStyle(Palette.faint)
              .lineLimit(1)
            Spacer()
            Missions(state: context.state)
          }
          .padding(.horizontal, 6)
        }
      } compactLeading: {
        Image(systemName: "camera.aperture")
          .foregroundStyle(Palette.text)
      } compactTrailing: {
        Text(context.state.shotsLeft.map { "\($0)" } ?? "âˆž")
          .font(.system(size: 15, weight: .semibold, design: .serif).monospacedDigit())
          .foregroundStyle(low(context.state) ? Palette.low : Palette.text)
      } minimal: {
        Text(context.state.shotsLeft.map { "\($0)" } ?? "âˆž")
          .font(.system(size: 14, weight: .semibold, design: .serif).monospacedDigit())
          .foregroundStyle(low(context.state) ? Palette.low : Palette.text)
      }
      .widgetURL(link(context.attributes))
      .keylineTint(Palette.text)
    }
  }
}

private func link(_ attributes: RollActivityAttributes) -> URL? {
  URL(string: "https://leftmoment.com/j/\(attributes.code)")
}

private func low(_ state: RollActivityAttributes.ContentState) -> Bool {
  (state.shotsLeft ?? .max) <= 3
}

private struct LockScreenView: View {
  let attributes: RollActivityAttributes
  let state: RollActivityAttributes.ContentState
  let stale: Bool

  var body: some View {
    HStack(alignment: .center, spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        Text(attributes.eventName.uppercased())
          .font(.system(size: 11, weight: .medium))
          .tracking(1.4)
          .foregroundStyle(Palette.faint)
          .lineLimit(1)
        if state.developed {
          Text("Your photos are developed.")
            .font(.system(size: 20, weight: .regular, design: .serif))
            .foregroundStyle(Palette.text)
        } else {
          Count(state: state, size: 40)
        }
      }
      Spacer(minLength: 8)
      VStack(alignment: .trailing, spacing: 6) {
        if !state.developed {
          RevealTimer(attributes: attributes, state: state)
            .font(.system(size: 15, weight: .medium).monospacedDigit())
            .foregroundStyle(stale ? Palette.faint : Palette.muted)
            .multilineTextAlignment(.trailing)
          Text("until itâ€™s developed")
            .font(.system(size: 11))
            .foregroundStyle(Palette.faint)
        }
        Missions(state: state)
      }
    }
    .padding(.horizontal, 20)
    .padding(.vertical, 16)
  }
}

/// "4 left" â€” warming over the last three, as on the camera.
private struct Count: View {
  let state: RollActivityAttributes.ContentState
  let size: CGFloat

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      Text(state.shotsLeft.map { "\($0)" } ?? "âˆž")
        .font(.system(size: size, weight: .regular, design: .serif).monospacedDigit())
        .foregroundStyle(low(state) ? Palette.low : Palette.text)
        .contentTransition(.numericText())
      Text(state.shotsLeft == 0 ? "left Â· roll used up" : "left")
        .font(.system(size: 14))
        .foregroundStyle(Palette.muted)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(state.shotsLeft.map { $0 == 1 ? "1 photo left" : "\($0) photos left" } ?? "Unlimited photos")
  }
}

/// The time to the reveal, ticking by itself.
private struct RevealTimer: View {
  let attributes: RollActivityAttributes
  let state: RollActivityAttributes.ContentState

  var body: some View {
    if attributes.endsAt > .now {
      Text(timerInterval: Date.now...attributes.endsAt, countsDown: true)
    } else {
      Text("Developingâ€¦")
    }
  }
}

/// "Missions 1/3" â€” only when the guest was dealt some.
private struct Missions: View {
  let state: RollActivityAttributes.ContentState

  var body: some View {
    if state.missionsTotal > 0 {
      let all = state.missionsDone >= state.missionsTotal
      HStack(spacing: 4) {
        Image(systemName: all ? "checkmark" : "scope")
          .font(.system(size: 11, weight: .medium))
        Text("Missions \(state.missionsDone)/\(state.missionsTotal)")
          .font(.system(size: 13, weight: .medium).monospacedDigit())
      }
      .foregroundStyle(all ? Palette.green : Palette.text)
    }
  }
}
