import Foundation

/// Fixed values the clip shares with the app, the server and the website.
enum ClipConfig {
  /// The App Group both the clip and the full app carry
  /// (`ios.entitlements` in app.json). Holds the hand-off and the queue.
  static let appGroup = "group.com.leftmoment.app"

  /// Where the full app picks up the clip's identity
  /// (`mobile/src/lib/clip-handoff.ts` reads the same key).
  static let handoffKey = "left.clip.session"

  static let bucket = "photos"

  /// As `MAX_NAME_LENGTH` in the app and `event_members.display_name`.
  static let maxNameLength = 60

  /// The reserved code of the demo (`https://leftmoment.com/j/TRYLEFT`): not an
  /// invite — it is never joined, `start_demo()` answers it with a moment of
  /// the visitor's own (`20261123010000_demo.sql`).
  static let demoCode = "TRYLEFT"

  /// Signed URLs are valid for an hour; the model's cache forgets them sooner.
  static let signedURLLifetime: TimeInterval = 3000
  /// How many paths go into one signing request.
  static let signBatch = 100

  /// How often the waiting and developing screens ask the server again.
  static let pollSeconds: UInt64 = 15

  /// Written by `plugins/with-app-clip.js` from the app's `EXPO_PUBLIC_*` env.
  /// Scheme and host apart, as the plugin writes them.
  static let supabaseURL: URL? = {
    func value(_ key: String) -> String? {
      guard let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String,
            !raw.isEmpty, !raw.hasPrefix("$(")
      else { return nil }
      return raw
    }
    guard let scheme = value("LEFTSupabaseScheme"), let host = value("LEFTSupabaseHost") else { return nil }
    return URL(string: "\(scheme)://\(host)")
  }()

  static let supabaseKey: String? = {
    guard let raw = Bundle.main.object(forInfoDictionaryKey: "LEFTSupabaseKey") as? String,
          !raw.isEmpty, !raw.hasPrefix("$(")
    else { return nil }
    return raw
  }()

  static var isConfigured: Bool { supabaseURL != nil && supabaseKey != nil }

  /// The App Group's defaults; the clip's own if the entitlement is missing.
  static let shared: UserDefaults = UserDefaults(suiteName: appGroup) ?? .standard

  /// The App Group's folder, so queued frames are where the full app could
  /// one day reach them. The clip's own Application Support otherwise.
  static let sharedFolder: URL = {
    if let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) {
      return group
    }
    return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
  }()
}

/// `https://leftmoment.com/j/{CODE}` → `CODE`. Mirrors `parseInviteUrl()` in
/// `mobile/src/lib/invite.ts`.
func parseInviteCode(_ url: URL) -> String? {
  let parts = url.pathComponents.filter { $0 != "/" }
  guard let index = parts.firstIndex(where: { $0.lowercased() == "j" }), index + 1 < parts.count else {
    return nil
  }
  let code = (parts[index + 1].removingPercentEncoding ?? parts[index + 1]).uppercased()
  // `isValidCodeShape()`: no 0/O/1/I, six to twelve characters.
  let allowed = CharacterSet(charactersIn: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
  guard (6...12).contains(code.count), code.unicodeScalars.allSatisfy(allowed.contains) else { return nil }
  return code
}
