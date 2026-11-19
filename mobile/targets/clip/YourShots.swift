import SwiftUI
import UIKit

/*
  Your photos in the clip (2026-11-18; restyled to the app's `(capture)/roll`
  later the same day: a full screen with a back button, "Your photos.", the count, a
  contact sheet newest first) — the guest's own frames, from the tile left of
  the shutter. Others' stay hidden until the film is developed; that is RLS,
  nothing here can widen it.

  Smaller than the app's on purpose (the clip must stay light): a contact
  sheet, and a tap opens the frame with "Mission · …" and the "Mission"
  action; a swipe sideways goes to the next or previous frame (2026-11-19, the
  user). No pinch, no shared-element return — the app's `PhotoViewer` is the
  full version.
*/
struct YourShotsSheet: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @Environment(\.dismiss) private var dismiss
  @State private var open: ShotItem?

  private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 3)

  var body: some View {
    let count = model.shots.count
    VStack(alignment: .leading, spacing: 0) {
      // The app's `(capture)/roll`: back to the camera, "Your photos.", a contact sheet.
      Button { dismiss() } label: {
        Image(systemName: "chevron.left")
          .font(.system(size: 16, weight: .medium))
          .foregroundStyle(Theme.text)
          .frame(width: 44, height: 44)
          .background(Theme.field, in: Circle())
          .overlay(Circle().stroke(Theme.hairline, lineWidth: 1))
      }
      .buttonStyle(PressScaleStyle())
      .accessibilityLabel("Back to the camera")
      .padding(.horizontal, Theme.gutter)
      .padding(.top, 16)

      VStack(alignment: .leading, spacing: 6) {
        Headline(plain: "Your ", emphasis: "photos.", size: 34)
        Text(count == 0
          ? "Only you can see these until the film is developed."
          : "\(count) so far. Only you can see these until the film is developed.")
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textMuted)
      }
      .padding(.horizontal, Theme.gutter)
      .padding(.vertical, 20)

      if model.shots.isEmpty {
        Text("Nothing yet. Your photos show up here as you take them.")
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textMuted)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .padding(.horizontal, Theme.gutter)
      } else {
        ScrollView {
          LazyVGrid(columns: columns, spacing: 3) {
            ForEach(Array(model.shots.reversed().enumerated()), id: \.element.id) { index, shot in
              let mission = model.mission(for: shot.id)
              Button { open = shot } label: {
                Color(hex: 0x141316)
                  .aspectRatio(3 / 4, contentMode: .fit)
                  .overlay { ShotImage(url: shot.thumb).scaledToFill() }
                  .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                  .overlay(alignment: .topTrailing) {
                    if mission != nil {
                      Image(systemName: "scope")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.text)
                        .frame(width: 22, height: 22)
                        .background(Theme.badgeScrim, in: Circle())
                        .padding(6)
                    }
                  }
              }
              .buttonStyle(PressScaleStyle(scale: 0.97))
              .accessibilityLabel("Photo \(index + 1) of \(count)" + (mission.map { ", for the mission: \($0.body)" } ?? ""))
            }
          }
          .padding(.bottom, 24)
        }
      }
    }
    .background(Theme.bg.ignoresSafeArea())
    .presentationBackground(Theme.bg)
    .task { await model.loadShots() }
    .fullScreenCover(item: $open) { shot in
      ShotDetail(start: shot.id, event: event)
        .environmentObject(model)
    }
  }
}

/// The frames, one at a time and in the grid's order (newest first): swipe
/// sideways between them; "Mission · …" and "Mission" follow the frame shown.
private struct ShotDetail: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @Environment(\.dismiss) private var dismiss
  @State private var picking = false
  @State private var current: String

  init(start: String, event: EventInfo) {
    self.event = event
    _current = State(initialValue: start)
  }

  private var canTag: Bool { !model.missions.isEmpty && !event.isDeveloped() }
  private var shots: [ShotItem] { model.shots.reversed() }

  var body: some View {
    let shot = shots.first { $0.id == current } ?? shots.first
    VStack(spacing: 0) {
      HStack {
        Button { dismiss() } label: {
          Image(systemName: "chevron.down")
            .font(.system(size: 16, weight: .medium))
            .foregroundStyle(Theme.text)
            .frame(width: 44, height: 44)
            .glass(Circle(), interactive: true)
        }
        .buttonStyle(PressScaleStyle())
        .accessibilityLabel("Close")
        Spacer()
      }
      .padding(.horizontal, 16)

      TabView(selection: $current) {
        ForEach(shots) { item in
          // The thumbnail first, the original over it once it has loaded.
          ZStack {
            ShotImage(url: item.thumb).scaledToFit()
            ShotImage(url: item.full, placeholder: false).scaledToFit()
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .padding(.vertical, 12)
          .tag(item.id)
        }
      }
      .tabViewStyle(.page(indexDisplayMode: .never))
      .accessibilityLabel(shots.firstIndex { $0.id == current }.map { "Photo \($0 + 1) of \(shots.count)" } ?? "Photo")
      .accessibilityAdjustableAction { direction in
        guard let index = shots.firstIndex(where: { $0.id == current }) else { return }
        let next = direction == .increment ? index + 1 : index - 1
        if shots.indices.contains(next) { current = shots[next].id }
      }

      VStack(spacing: 14) {
        if let shot, let mission = model.mission(for: shot.id) {
          HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: "scope").font(.system(size: 12))
            (Text("Mission · ").foregroundStyle(Theme.textMuted) + Text(mission.body).foregroundStyle(Theme.text))
              .font(Fonts.body(14))
              .lineLimit(2)
          }
          .foregroundStyle(Theme.text)
          .padding(.vertical, 8)
          .padding(.horizontal, 14)
          .glass(RoundedRectangle(cornerRadius: 16, style: .continuous))
          .padding(.horizontal, Theme.gutter)
        }
        if canTag {
          Button { picking = true } label: {
            Label("Mission", systemImage: "scope")
              .font(Fonts.medium(15))
              .foregroundStyle(Theme.text)
              .padding(.horizontal, 18)
              .frame(height: 44)
              .glass(Capsule(), interactive: true)
          }
          .buttonStyle(PressScaleStyle())
          .accessibilityLabel(shot.flatMap { model.mission(for: $0.id) }.map { "Mission: \($0.body). Change it." } ?? "Mark this photo for a mission")
        }
      }
      .padding(.bottom, 16)
    }
    .background(Color.black.ignoresSafeArea())
    .sheet(isPresented: $picking) {
      MissionPicker(photoId: current) { picking = false }
        .environmentObject(model)
    }
  }
}

/// A frame from a file (still queued) or a signed URL (uploaded).
private struct ShotImage: View {
  let url: URL?
  var placeholder = true

  var body: some View {
    if let url, url.isFileURL {
      if let image = UIImage(contentsOfFile: url.path) {
        Image(uiImage: image).resizable()
      } else {
        fallback
      }
    } else if let url {
      AsyncImage(url: url) { phase in
        if let image = phase.image {
          image.resizable()
        } else {
          fallback
        }
      }
    } else {
      fallback
    }
  }

  @ViewBuilder private var fallback: some View {
    if placeholder { Theme.field } else { Color.clear }
  }
}
