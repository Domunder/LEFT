// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    /*
      Three React Compiler rules that arrived with eslint-config-expo 58 and are
      off on purpose:

      - `immutability` flags every `shared.value = x`, which is how Reanimated
        shared values are written (the camera, the shutter, every gesture).
      - `refs` and `set-state-in-effect` flag patterns the camera screen and its
        session hook rely on. Those files are `'use no memo'` and were tuned on
        a device; rewriting them to satisfy a lint rule is not worth a
        regression there. Revisit in M6.
    */
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
