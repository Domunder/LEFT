import SwiftUI

/*
  LEFT's App Clip. Scanning an invite QR code (`https://leftmoment.com/j/{CODE}`)
  opens this without installing the app: a name, the camera, the roll, the
  gallery while the film develops, and the group's album once it is developed
  (looking only; saving and sharing are the full app's). `/j/TRYLEFT` is the
  demo: a moment of the visitor's own, with sample guests in it.

  SwiftUI and system frameworks only — no React Native, no packages — so the
  clip stays far under the 15 MB a QR-invoked clip may weigh. See CLAUDE.md →
  "The App Clip".
*/
@main
struct LEFTClipApp: App {
  @StateObject private var model = ClipModel()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(model)
        .preferredColorScheme(.dark)
        // The invocation: a QR code, an App Clip Code, Safari's card, a link.
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
          if let url = activity.webpageURL { model.open(url) }
        }
        .onOpenURL { model.open($0) }
        .task {
          await UploadQueue.shared.start()
          model.launched()
        }
        .onChange(of: scenePhase) { _, phase in
          guard phase == .active else { return }
          Task {
            await UploadQueue.shared.drain()
            await model.refresh()
          }
        }
        // "4 left" on the Lock Screen and in the Dynamic Island.
        .onChange(of: model.liveRoll, initial: true) { _, snapshot in
          LiveRoll.sync(snapshot)
        }
    }
  }
}
