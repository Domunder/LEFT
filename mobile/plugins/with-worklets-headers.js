/**
 * Lets VisionCamera's worklets plugin compile against react-native-worklets.
 *
 * `VisionCameraWorklets` imports the `RNWorklets` clang module. One of that
 * module's public headers (`WorkletsMessageThread.h`) imports
 * `<React/RCTMessageThread.h>`, a private React-Core header. RNWorklets adds
 * the search path for it to its own target only, so the module fails to build
 * inside VisionCameraWorklets:
 *
 *   'React/RCTMessageThread.h' file not found
 *   could not build module 'RNWorklets'
 *
 * This adds the same search path to the VisionCameraWorklets pod target, in the
 * Podfile's `post_install`. Remove it once either library fixes this upstream
 * (mrousavy/react-native-vision-camera#3781).
 */

const { withPodfile } = require('expo/config-plugins');

const MARKER = '# with-worklets-headers';

const SNIPPET = `
    ${MARKER}: VisionCameraWorklets builds the RNWorklets module, which needs React-Core's private headers.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'VisionCameraWorklets'
      target.build_configurations.each do |config|
        paths = Array(config.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)')
        paths << '"$(PODS_ROOT)/Headers/Private/React-Core"'
        config.build_settings['HEADER_SEARCH_PATHS'] = paths.uniq
      end
    end
`;

module.exports = function withWorkletsHeaders(config) {
  return withPodfile(config, (podfile) => {
    const contents = podfile.modResults.contents;
    if (contents.includes(MARKER)) return podfile;

    const anchor = /post_install do \|installer\|\n/;
    if (!anchor.test(contents)) {
      throw new Error('with-worklets-headers: no post_install block found in the Podfile');
    }
    podfile.modResults.contents = contents.replace(anchor, (line) => line + SNIPPET);
    return podfile;
  });
};
