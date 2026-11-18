import SwiftUI

/*
  Missions in the clip (2026-11-18) — the app's camera chrome and sheets
  (`components/ui/mission-chrome.tsx`, `mission-sheet.tsx`, `name-picker.tsx`)
  in SwiftUI. Same copy, same rules:

  - "Missions 1/3" under the roll counter opens the list; tapping an open
    mission arms the next shot, "Next photo: …" sits at the viewfinder's top
    edge with an × to let it go.
  - In Your shots, a photo can be marked afterwards ("Which mission?").
  - 11 offers the names the host listed for personal missions.
  - No intro sheet in the clip (the user's call), and no haptics.
*/

// MARK: Camera chrome

/// "Missions 1/3" — opens the list.
struct MissionCapsule: View {
  let done: Int
  let total: Int
  let action: () -> Void

  private var all: Bool { total > 0 && done >= total }

  var body: some View {
    Button(action: action) {
      HStack(spacing: 5) {
        Image(systemName: all ? "checkmark" : "scope")
          .font(.system(size: 12, weight: .medium))
        Text("Missions \(done)/\(total)")
          .font(Fonts.medium(13))
          .monospacedDigit()
          .dynamicTypeSize(...DynamicTypeSize.xxLarge)
      }
      .foregroundStyle(all ? Theme.green : Theme.text)
      .padding(.horizontal, 11)
      .frame(height: 28)
      .glass(Capsule(), interactive: true)
      .padding(8)
      .contentShape(Rectangle())
      .padding(-8)
    }
    .buttonStyle(PressScaleStyle())
    .accessibilityLabel("Missions, \(done) of \(total) done")
    .accessibilityHint("Shows your missions")
  }
}

/// "Next photo: …" at the viewfinder's top edge, with an × to let it go.
struct ArmedNote: View {
  let text: String
  let clear: () -> Void

  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: "scope")
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(Theme.text)
      (Text("Next photo: ").foregroundStyle(Theme.textMuted) + Text(text).foregroundStyle(Theme.text))
        .font(Fonts.body(13))
        .lineLimit(2)
      Button(action: clear) {
        Image(systemName: "xmark")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(Theme.text)
          .frame(width: 28, height: 28)
          .contentShape(Rectangle())
      }
      .buttonStyle(PressScaleStyle(scale: 0.85))
      .accessibilityLabel("Not for a mission")
    }
    .padding(.leading, 12)
    .padding(.trailing, 6)
    .padding(.vertical, 3)
    // Fade a wrapper, never the glass itself.
    .glass(Capsule())
    .padding(.horizontal, 18)
    .frame(maxHeight: .infinity, alignment: .top)
    // Arrives from the capsule that armed it, and leaves the same way.
    .transition(reduceMotion ? .opacity : .offset(y: -10).combined(with: .opacity))
  }
}

// MARK: Sheets

/// The list on the camera: tap an open mission, the next photo is for it.
struct MissionListSheet: View {
  @EnvironmentObject private var model: ClipModel
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    let done = model.missions.filter { $0.photoId != nil }.count
    SheetBody(
      plain: "Your ",
      emphasis: "missions.",
      lede: done == model.missions.count
        ? "All done. Photos stay hidden until the film is developed."
        : "Pick one, then take the photo."
    ) {
      ForEach(model.missions) { mission in
        let isDone = mission.photoId != nil
        let isArmed = mission.id == model.armedId
        MissionRow(mission: mission, dimmed: isDone) {
          if isDone {
            Label("Done", systemImage: "checkmark").foregroundStyle(Theme.green)
          } else if isArmed {
            Label("Next photo", systemImage: "scope").foregroundStyle(Theme.text)
          } else {
            Image(systemName: "camera").foregroundStyle(Theme.textMuted)
          }
        } action: {
          model.arm(mission)
          dismiss()
        }
        .disabled(isDone)
        .accessibilityLabel(isDone ? "\(mission.body). Done." :
          isArmed ? "\(mission.body). Your next photo is for this." : mission.body)
      }
    }
  }
}

/// "Which mission?" — marks a photo afterwards, from Your shots.
struct MissionPicker: View {
  let photoId: String
  let done: () -> Void
  @EnvironmentObject private var model: ClipModel
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    let current = model.mission(for: photoId)
    SheetBody(
      plain: "Which ",
      emphasis: "mission?",
      lede: "Mark what this photo was for. Nobody sees it until the film is developed."
    ) {
      ForEach(model.missions) { mission in
        let here = mission.id == current?.id
        let elsewhere = !here && mission.photoId != nil
        MissionRow(
          mission: mission,
          detail: elsewhere ? "Done with another photo. Picking it moves it here." : nil
        ) {
          if here { Image(systemName: "checkmark").foregroundStyle(Theme.text) }
        } action: {
          here ? done() : pick(mission.id)
        }
        .accessibilityLabel(here ? "\(mission.body). This photo." :
          elsewhere ? "\(mission.body). Done with another photo." : mission.body)
      }
      PlainRow(text: "Not a mission") {
        if current == nil { Image(systemName: "checkmark").foregroundStyle(Theme.text) }
      } action: {
        current == nil ? done() : pick(nil)
      }
      if let error {
        Text(error)
          .font(Fonts.body(13))
          .foregroundStyle(Theme.textMuted)
      }
    }
    .disabled(busy)
  }

  private func pick(_ missionId: String?) {
    busy = true
    error = nil
    Task {
      defer { busy = false }
      do {
        try await model.tag(photoId: photoId, missionId: missionId)
        done()
      } catch let failure as ClipError where failure.hint == "event_closed" {
        error = "The film is developed. Missions are locked."
      } catch let failure as ClipError where failure.hint == "not_yours" {
        error = "That mission isn’t one of yours."
      } catch {
        self.error = messageFor(error)
      }
    }
  }
}

/// Headline, lede and rows, scrolling once they outgrow the sheet.
private struct SheetBody<Rows: View>: View {
  let plain: String
  let emphasis: String
  let lede: String
  @ViewBuilder let rows: Rows

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        Headline(plain: plain, emphasis: emphasis, size: 30)
        Text(lede)
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textMuted)
          .fixedSize(horizontal: false, vertical: true)
          .padding(.top, 8)
        VStack(spacing: 8) { rows }
          .padding(.top, 20)
      }
      .padding(.horizontal, Theme.gutter)
      .padding(.top, 28)
      .padding(.bottom, 24)
    }
    .scrollBounceBehavior(.basedOnSize)
    .background(Theme.card.ignoresSafeArea())
    .presentationDetents([.medium, .large])
    .presentationDragIndicator(.visible)
    .presentationBackground(Theme.card)
  }
}

private struct MissionRow<Trailing: View>: View {
  let mission: Mission
  var detail: String?
  var dimmed = false
  @ViewBuilder let trailing: Trailing
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          if mission.personal {
            Eyebrow(text: "Just for you")
          }
          Text(mission.body)
            .font(Fonts.body(16))
            .foregroundStyle(dimmed ? Theme.textDim : Theme.text)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
          if let detail {
            Text(detail)
              .font(Fonts.body(13))
              .foregroundStyle(Theme.textMuted)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        trailing
          .font(Fonts.medium(13))
          .labelStyle(.titleAndIcon)
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 14)
      .background(Theme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.hairline, lineWidth: 1))
      .contentShape(Rectangle())
    }
    .buttonStyle(PressScaleStyle(scale: 0.98))
  }
}

private struct PlainRow<Trailing: View>: View {
  let text: String
  @ViewBuilder let trailing: Trailing
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack {
        Text(text)
          .font(Fonts.body(16))
          .foregroundStyle(Theme.text)
          .frame(maxWidth: .infinity, alignment: .leading)
        trailing.font(Fonts.medium(13))
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 14)
      .background(Theme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.hairline, lineWidth: 1))
      .contentShape(Rectangle())
    }
    .buttonStyle(PressScaleStyle(scale: 0.98))
    .accessibilityLabel(text)
  }
}

// MARK: 11 — "Are you one of these?"

/// The names the host listed for personal missions (`name-picker.tsx`): 02's
/// choice pills, solid off-white when chosen, a hairline outline when not.
/// "None of these" is a real choice and the default, so the group is a set of
/// radio buttons. Picking a name fills the name field (`NameScreen`).
struct NamePicker: View {
  @EnvironmentObject private var model: ClipModel
  var onPick: (MissionName?) -> Void = { _ in }

  var body: some View {
    if !model.names.isEmpty {
      VStack(alignment: .leading, spacing: 0) {
        Text("Are you one of these?")
          .font(Fonts.body(16))
          .foregroundStyle(Theme.text)
        Text("The host planned something for you.")
          .font(Fonts.body(13))
          .foregroundStyle(Theme.textFaint)
          .padding(.top, 4)
        FlowLayout(spacing: 8) {
          ForEach(model.names) { name in
            chip(name.name, selected: model.pickedName == name.id) {
              model.pickedName = name.id
              onPick(name)
            }
          }
          chip("None of these", selected: model.pickedName == nil) {
            model.pickedName = nil
            onPick(nil)
          }
        }
        .padding(.top, 14)
      }
      .transition(.opacity)
    }
  }

  private func chip(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(label)
        .font(Fonts.medium(15))
        .foregroundStyle(selected ? Theme.onLight : Theme.text)
        .multilineTextAlignment(.leading)
        .padding(.vertical, 11)
        .padding(.horizontal, 16)
        .background(selected ? Theme.text : .clear, in: Capsule())
        .overlay(Capsule().stroke(selected ? Theme.text : Theme.hairlineStrong, lineWidth: 1))
    }
    .buttonStyle(PressScaleStyle(scale: 0.96))
    .disabled(model.busy)
    .accessibilityLabel(label)
    .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
  }
}

/// Chips that wrap onto the next line.
private struct FlowLayout: Layout {
  var spacing: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
    let height = rows.last.map { $0.y + $0.height } ?? 0
    return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    for row in arrange(width: bounds.width, subviews: subviews) {
      var x = bounds.minX
      for index in row.indices {
        let size = subviews[index].sizeThatFits(.unspecified)
        subviews[index].place(at: CGPoint(x: x, y: bounds.minY + row.y), proposal: ProposedViewSize(size))
        x += size.width + spacing
      }
    }
  }

  private struct Row { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0; var y: CGFloat = 0 }

  private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
    var rows: [Row] = [Row()]
    for (index, view) in subviews.enumerated() {
      let size = view.sizeThatFits(.unspecified)
      var row = rows[rows.count - 1]
      let needed = row.indices.isEmpty ? size.width : row.width + spacing + size.width
      if needed > width, !row.indices.isEmpty {
        let y = row.y + row.height + spacing
        rows.append(Row(indices: [index], width: size.width, height: size.height, y: y))
        continue
      }
      row.indices.append(index)
      row.width = needed
      row.height = max(row.height, size.height)
      rows[rows.count - 1] = row
    }
    return rows
  }
}

/// Gives on press-in, like the app's `PressScale`.
struct PressScaleStyle: ButtonStyle {
  var scale: CGFloat = 0.95

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .scaleEffect(configuration.isPressed ? scale : 1)
      .animation(.spring(response: 0.2, dampingFraction: 1), value: configuration.isPressed)
  }
}
