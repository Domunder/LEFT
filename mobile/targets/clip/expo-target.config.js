/**
 * The App Clip: a small native SwiftUI camera a guest opens by scanning an
 * invite QR code, without installing LEFT. See CLAUDE.md → "The App Clip".
 *
 * Read by `@bacons/apple-targets` at prebuild, which adds the target to the
 * Xcode project and embeds it in the app. `plugins/with-app-clip.js` does the
 * rest (version, Supabase settings, the generated looks).
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'clip',
  name: 'LEFTClip',
  displayName: 'LEFT',
  // com.leftmoment.app.clip
  bundleIdentifier: '.clip',
  // iOS 17 is where a QR-invoked clip may be 15 MB (16 allows 10 MB).
  deploymentTarget: '17.0',
  icon: '../../assets/images/icon.png',
  // The package assumes a React Native clip and would bundle the JS. This one
  // is SwiftUI only — keeping React Native out is what keeps it small.
  exportJs: false,
  frameworks: ['AVFoundation', 'Metal', 'MetalKit', 'StoreKit', 'Network'],
  colors: {
    $accent: '#f0ede8',
    // Info.plist's UILaunchScreen: the page colour, so the launch is not white.
    LaunchBackground: '#101010',
  },
  entitlements: {
    'com.apple.developer.associated-domains': ['appclips:leftmoment.com'],
    // Shared with the full app: the clip's session (the hand-off) and its queue.
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
