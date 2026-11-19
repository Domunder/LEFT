/**
 * The App Clip's Live Activity: "4 left", the open missions and the time to
 * the reveal on the Lock Screen and in the Dynamic Island, so a guest who put
 * the phone away can see what is left and tap back into the camera.
 *
 * Apple allows an App Clip one kind of extension: a widget extension that
 * holds Live Activities only, embedded in the clip, whose bundle ID starts with
 * the clip's, with the "App Clip Extension" capability
 * (`com.apple.developer.on-demand-install-capable`). See "Offering Live
 * Activities with your App Clip" in Apple's documentation.
 *
 * `@bacons/apple-targets` embeds every widget in the *main app*;
 * `plugins/with-app-clip.js` moves this one into the clip after prebuild.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'widget',
  name: 'LEFTClipActivity',
  displayName: 'LEFT',
  // com.leftmoment.app.clip.activity — prefixed by the clip's ID, as Apple requires.
  bundleIdentifier: '.clip.activity',
  deploymentTarget: '17.0',
  frameworks: ['ActivityKit', 'WidgetKit', 'SwiftUI'],
  entitlements: {
    // "App Clip Extension": what lets the clip carry this extension.
    'com.apple.developer.on-demand-install-capable': true,
  },
});
