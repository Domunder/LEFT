import SwiftUI
import UIKit

/*
  Your shots in the clip (2026-11-18) — the guest's own frames, from the tile
  left of the shutter, as the app's `(capture)/roll`. Others' stay hidden until
  the film is developed; that is RLS, nothing here can widen it.

  Smaller than the app's on purpose (the clip must stay light): a contact
  sheet, and a tap opens the frame on its own with "Mission · …" and the
  "Mission" action. No swiping between frames, no pinch, no shared-element
  return — the app's `PhotoViewer` is the full version.
*/
struct YourShotsSheet: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @Environment(\.dismiss) private var dismiss
  @State private var open: ShotItem?

  private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 3)

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .firstTextBaseline) {
        Headline(plain: "Your ", emphasis: "shots.", size: 34)
        Spacer()
        Button("Done") { dismiss() }
          .font(Fonts.medium(15))
          .foregroundStyle(Theme.text)
      }
      .padding(.horizontal, Theme.gutter)
      .padding(.top, 24)
      Text(model.shots.isEmpty
        ? "Nothing yet. Your photos land here as you take them."
        : "Only you see these until the film is developed.")
        .font(Fonts.body(14))
        .foregroundStyle(Theme.textMuted)
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 6)

      ScrollView {
        LazyVGrid(columns: columns, spacing: 3) {
          ForEach(model.shots.reversed()) { shot in
            Button { open = shot } label: {
              Color.clear
                .aspectRatio(3 / 4, contentMode: .fit)
                .overlay { ShotImage(url: shot.thumb).scaledToFill() }
                .clipped()
                .overlay(alignment: .bottomLeading) {
                  if model.mission(for: shot.id) != nil {
                    Image(systemName: "scope")
                      .font(.system(size: 11, weight: .semibold))
                      .foregroundStyle(Theme.text)
                      .padding(5)
                      .background(.black.opacity(0.55), in: Circle())
                      .padding(6)
                  }
                }
            }
            .buttonStyle(PressScaleStyle(scale: 0.97))
            .accessibilityLabel(model.mission(for: shot.id).map { "Photo, for the mission \($0.body)" } ?? "Photo")
          }
        }
        .padding(.top, 20)
      }
    }
    .background(Theme.bg.ignoresSafeArea())
    .presentationBackground(Theme.bg)
    .task { await model.loadShots() }
    .fullScreenCover(item: $open) { shot in
      ShotDetail(shot: shot, event: event)
        .environmentObject(model)
    }
  }
}

/// One frame, on its own: the picture, "Mission · …", and "Mission".
private struct ShotDetail: View {
  let shot: ShotItem
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @Environment(\.dismiss) private var dismiss
  @State private var picking = false

  private var canTag: Bool { !model.missions.isEmpty && !event.isDeveloped() }

  var body: some View {
    VStack(spacing: 0) {
      HStack {
        Button { dismiss() } label: {
          Image(systemName: "chevron.down")
            .font(.system(size: 16, weight: .medium))
            .foregroundStyle(Theme.text)
            .frame(width: 44, height: 44)
            .background(.ultraThinMaterial, in: Circle())
        }
        .buttonStyle(PressScaleStyle())
        .accessibilityLabel("Close")
        Spacer()
      }
      .padding(.horizontal, 16)

      Spacer(minLength: 12)
      // The thumbnail first, the original over it once it has loaded.
      ZStack {
        ShotImage(url: shot.thumb).scaledToFit()
        ShotImage(url: shot.full, placeholder: false).scaledToFit()
      }
      Spacer(minLength: 12)

      VStack(spacing: 14) {
        if let mission = model.mission(for: shot.id) {
          (Text("Mission · ").foregroundStyle(Theme.textMuted) + Text(mission.body).foregroundStyle(Theme.text))
            .font(Fonts.body(14))
            .multilineTextAlignment(.center)
            .padding(.horizontal, Theme.gutter)
        }
        if canTag {
          Button { picking = true } label: {
            Label("Mission", systemImage: "scope")
          }
          .buttonStyle(PillButtonStyle(light: false))
          .padding(.horizontal, Theme.gutter)
        }
      }
      .padding(.bottom, 16)
    }
    .background(Color.black.ignoresSafeArea())
    .sheet(isPresented: $picking) {
      MissionPicker(photoId: shot.id) { picking = false }
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
