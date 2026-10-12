/**
 * Babel configuration.
 *
 * This file existed only implicitly until the camera screen needed it. Expo
 * supplies `babel-preset-expo` by default, so a project with no config still
 * builds — which is why there was none here.
 *
 * **`react-native-worklets/plugin` is what makes Reanimated work**, and it has to
 * be listed explicitly. It rewrites functions marked `'worklet'` (and the
 * callbacks passed to gesture handlers and `useAnimatedStyle`) so they can run on
 * the UI thread. Without it those functions are compiled as ordinary JavaScript
 * and throw when the UI thread tries to call them — at *runtime*, after a clean
 * bundle, which surfaces as a white screen rather than a build error.
 *
 * That is exactly what 13's pinch gesture hit: `at()` in lib/pair.ts is marked
 * `'worklet'` but is only ever called from inside `useAnimatedStyle`, which
 * Reanimated handles itself, so nothing had needed the plugin before. The pinch's
 * `onStart`/`onUpdate` are the app's first true worklet callbacks.
 *
 * It must stay **last** in the list: it needs to see the code after every other
 * transform has run.
 *
 * Note this is `react-native-worklets/plugin`, not the `react-native-reanimated/plugin`
 * of Reanimated 3 and earlier. Worklets moved into their own package for
 * Reanimated 4; the old path still exists in node_modules and is the wrong one.
 */

module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
