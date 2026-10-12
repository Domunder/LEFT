/**
 * 19 · Lockscreen Live Activity — the config plugin that makes it buildable.
 *
 * The project is managed (CNG): there is no `ios/` directory in the repo, it is
 * generated at build time. A Live Activity needs a **second native target** — a
 * WidgetKit extension — which nothing in `app.json` can express, so it has to be
 * added to the Xcode project by hand, here.
 *
 * **This is JavaScript, not TypeScript, on purpose.** Config plugins are loaded
 * by `@expo/config` during prebuild, outside the Metro/Babel pipeline that
 * resolves TS. A `.ts` plugin would need its own build step to be loadable.
 *
 * ## Why hand-rolled
 *
 * `@bacons/apple-targets` does this more generally and is what most SDK 54 Live
 * Activity guides reach for — but it is explicitly experimental, it takes
 * ownership of target generation, and it does not save writing any of the Swift.
 * `expo-live-activity` (software-mansion-labs) is deprecated per its own repo.
 * `@expo/config-plugins` ships with Expo and exposes everything needed.
 *
 * The honest cost: `withXcodeProject` below is the fiddliest code in this
 * repository, and `@bacons/apple-targets` exists precisely because wiring an
 * Xcode target by hand is unpleasant. **If this breaks and resists fixing, that
 * package is the escape hatch** — it would replace this file and keep the Swift.
 *
 * ## What cannot be verified here
 *
 * **None of this can be tested from Windows.** There is no Xcode and no
 * simulator, so the plugin's correctness is genuinely unknown until it runs on
 * an EAS build machine. It is written carefully rather than confidently.
 *
 * It also cannot run in Expo Go, and — importantly — **cannot run in the current
 * dev client either**, which was built before this target existed. It needs:
 *
 *     eas build -p ios --profile development
 *
 * `eas.json` already has that profile, so nothing there changes.
 *
 * ## Prerequisite outside this repo
 *
 * The app group `group.com.leftmoment.app` must exist in the Apple Developer portal
 * and be attached to **both** bundle identifiers, or the build fails at signing.
 * EAS can create it during credential setup, but it is a portal-side fact, not
 * something code can assert.
 */

const fs = require('fs');
const path = require('path');

const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withPlugins,
  withRunOnce,
  withXcodeProject,
} = require('@expo/config-plugins');

/** The extension's target and folder name. */
const TARGET_NAME = 'LeftBudgetWidget';

/** Must match `LiveActivity.appGroup` in src/constants/theme.ts. */
const APP_GROUP = 'group.com.leftmoment.app';
// Fallback when the app target has no team yet — EAS can inject credentials
// after prebuild, and an unsigned extension fails the build outright.
const APPLE_TEAM_ID = 'ZFJBLRVHLD';

/**
 * The floor for the whole feature. Live Activities landed in 16.1, but
 * `ActivityContent` and `staleDate` arrived in 16.2 and the app side uses them.
 */
const DEPLOYMENT_TARGET = '16.2';

/** Everything copied into the generated `ios/LeftBudgetWidget/`. */
const SOURCE_FILES = [
  'LeftBudgetAttributes.swift',
  'LeftBudgetLiveActivity.swift',
  'LeftBudgetWidget.swift',
];

const SUPPORT_FILES = ['Info.plist', `${TARGET_NAME}.entitlements`];

/** Compiled into both the extension and the app's native module. */
const SHARED_ATTRIBUTES = 'LeftBudgetAttributes.swift';

/** The local Expo module the app calls into; CocoaPods builds it separately. */
const MODULE_IOS_DIR = path.join('modules', 'left-live-activity', 'ios');

/**
 * Tell the *app* it may start Live Activities.
 *
 * Without `NSSupportsLiveActivities`, `Activity.request()` throws at runtime
 * with an error that does not obviously name this key as the cause.
 */
const withLiveActivityInfoPlist = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults.NSSupportsLiveActivities = true;
    // Lets the activity be updated more often than the default budget allows.
    // Harmless if unused; required the moment updates get frequent.
    mod.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return mod;
  });

/**
 * Put the app and the extension in one app group.
 *
 * They are separate processes. The group is the only ground they share, and both
 * sides must declare it — the extension does so in its own entitlements file.
 */
const withAppGroup = (config) =>
  withEntitlementsPlist(config, (mod) => {
    const key = 'com.apple.security.application-groups';
    const groups = new Set(mod.modResults[key] ?? []);
    groups.add(APP_GROUP);
    mod.modResults[key] = [...groups];
    return mod;
  });

/**
 * Copy the Swift and its plists into the generated project.
 *
 * A "dangerous" mod because there is no first-class API for "write files into
 * the ios directory" — the operation is outside what the config system models.
 */
const withWidgetSources = (config) =>
  withDangerousMod(config, [
    'ios',
    (mod) => {
      const source = path.join(mod.modRequest.projectRoot, 'plugins', 'live-activity');
      const destination = path.join(mod.modRequest.platformProjectRoot, TARGET_NAME);

      fs.mkdirSync(destination, { recursive: true });

      for (const file of [...SOURCE_FILES, ...SUPPORT_FILES]) {
        fs.copyFileSync(path.join(source, file), path.join(destination, file));
      }

      /*
        The app side reaches the type through the local Expo module, which
        CocoaPods compiles as its own module from `modules/left-live-activity/
        ios` — the extension's copy in `ios/${TARGET_NAME}/` is outside the
        podspec's source_files glob and invisible to it. Copy the shared
        declaration in so the pod compiles its own, or LeftLiveActivityModule
        fails with "cannot find LeftBudgetAttributes in scope".

        Generated, not committed: one source of truth in plugins/live-activity.
      */
      fs.copyFileSync(
        path.join(source, SHARED_ATTRIBUTES),
        path.join(mod.modRequest.projectRoot, MODULE_IOS_DIR, SHARED_ATTRIBUTES)
      );

      return mod;
    },
  ]);

/**
 * Create the extension target and wire it into the app.
 *
 * The order matters and is not obvious: the group must exist before files can be
 * added to it, the target before build phases can hang off it, and the
 * dependency last so the app embeds a target that is fully configured.
 */
const withWidgetTarget = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;

    /*
      Idempotence guard. `withRunOnce` below prevents the plugin running twice in
      one prebuild, but a prebuild over an existing `ios/` directory would find
      the target already there — and a duplicated target fails the build with an
      error that names nothing useful.
    */
    if (project.pbxTargetByName(TARGET_NAME)) return mod;

    /*
      Only the support files go in the group. The Sources build phase below
      creates its own file references for the Swift files, and listing them in
      both places yields two references to each — which Xcode compiles twice,
      failing on duplicate symbols.
    */
    const group = project.addPbxGroup(SUPPORT_FILES, TARGET_NAME, TARGET_NAME);

    // Hang the new group off the project root, beside the app's own.
    const groups = project.hash.project.objects.PBXGroup;
    for (const key of Object.keys(groups)) {
      if (groups[key].name === undefined && groups[key].path === undefined) {
        project.addToPbxGroup(group.uuid, key);
        break;
      }
    }

    const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME);

    /*
      Paths here are resolved from `ios/`, not from the group — addPbxGroup's
      `path` argument does not carry over into a build phase's own file
      references. Bare filenames make Xcode look in `ios/` and fail with
      "Build input files cannot be found".
    */
    project.addBuildPhase(
      SOURCE_FILES.map((file) => `${TARGET_NAME}/${file}`),
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid
    );
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase(
      ['WidgetKit.framework', 'SwiftUI.framework', 'ActivityKit.framework'],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid
    );

    const bundleId = `${mod.ios?.bundleIdentifier ?? 'com.leftmoment.app'}.${TARGET_NAME}`;
    const configurations = project.pbxXCBuildConfigurationSection();

    /*
      Xcode 14 signs every bundle, extensions included, and refuses to without a
      team — the build dies at the signing phase with
      XCODE_RESOURCE_BUNDLE_CODE_SIGNING_ERROR. Inherit whatever the app target
      resolved to so this tracks the credentials EAS actually built with.
    */
    let developmentTeam = process.env.EXPO_APPLE_TEAM_ID ?? APPLE_TEAM_ID;
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key].buildSettings;
      if (settings && settings.DEVELOPMENT_TEAM) {
        // The app target wins: it reflects the credentials EAS resolved.
        developmentTeam = settings.DEVELOPMENT_TEAM;
        break;
      }
    }

    for (const key of Object.keys(configurations)) {
      const settings = configurations[key].buildSettings;
      if (!settings || settings.PRODUCT_NAME !== `"${TARGET_NAME}"`) continue;

      settings.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleId}"`;
      settings.INFOPLIST_FILE = `"${TARGET_NAME}/Info.plist"`;
      settings.CODE_SIGN_ENTITLEMENTS = `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`;
      settings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
      settings.SWIFT_VERSION = '5.0';
      settings.TARGETED_DEVICE_FAMILY = '"1"'; // iPhone only, matching the app.
      settings.SKIP_INSTALL = 'NO';
      // A widget extension is a bundle, and Swift needs its own runtime copied.
      settings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = 'NO';
      if (developmentTeam) settings.DEVELOPMENT_TEAM = developmentTeam;
    }

    /*
      The app needs the same declaration — it builds the ContentState the
      extension decodes, and the type identity has to match or updates are
      silently dropped. It gets there via the copy withWidgetSources drops into
      the local Expo module, which CocoaPods compiles separately; adding this
      file reference to the app target here does nothing, because addSourceFile
      will not create a second build file for a path already referenced in the
      group.
    */

    return mod;
  });

/**
 * The whole plugin, run at most once per prebuild.
 */
const withLiveActivity = (config) =>
  withRunOnce(config, {
    name: 'with-live-activity',
    plugin: (inner) =>
      withPlugins(inner, [
        withLiveActivityInfoPlist,
        withAppGroup,
        withWidgetSources,
        withWidgetTarget,
      ]),
  });

module.exports = withLiveActivity;
