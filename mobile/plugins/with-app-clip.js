/**
 * The App Clip's half of prebuild — what `@bacons/apple-targets` does not do.
 *
 * `@bacons/apple-targets` reads `targets/clip/expo-target.config.js`, adds the
 * SwiftUI target to the Xcode project, embeds it in the app and writes its
 * entitlements. This plugin then:
 *
 *  1. regenerates `targets/clip/LooksGenerated.swift` from
 *     `src/constants/looks.ts`, so the clip can never bake a stale recipe;
 *  2. gives the clip the app's version (the package hardcodes "1.0", and App
 *     Store Connect refuses a clip whose version differs from its app's);
 *  3. hands the clip the Supabase URL and publishable key — the same
 *     `EXPO_PUBLIC_*` values the app is built with — as build settings that
 *     its Info.plist reads (`LEFTSupabaseScheme`/`Host`, `LEFTSupabaseKey`);
 *  4. moves the Live Activity extension (`targets/clip-activity`) from the
 *     main app into the clip. `@bacons/apple-targets` embeds every widget in
 *     the main app; Apple wants a clip's Live Activity extension embedded in
 *     the clip and nowhere else. The package re-adds the main app's
 *     dependency on every prebuild, so this runs every time.
 *
 * **Must be listed before `@bacons/apple-targets` in app.json.** Mods run in
 * reverse order of registration, so listing it first makes its Xcode action
 * run after the package has created the target.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

// The same copy `@bacons/apple-targets` uses (it is that package's dependency, not ours).
const { PBXCopyFilesBuildPhase } = require(
  require.resolve('@bacons/xcode', { paths: [path.dirname(require.resolve('@bacons/apple-targets/package.json'))] })
);

const CLIP_PRODUCT = 'LEFTClip';
const ACTIVITY_PRODUCT = 'LEFTClipActivity';
const EMBED_EXTENSIONS = 'Embed Foundation Extensions';

/** Embed the Live Activity extension in the clip, not in the main app. */
function embedActivityInClip(project, clip, version) {
  const targets = project.rootObject.props.targets;
  const activity = targets.find((t) => t.props.productName === ACTIVITY_PRODUCT);
  if (!activity) return;
  const main = project.rootObject.getMainAppTarget('ios');
  const product = activity.props.productReference;

  let clipPhase = clip.props.buildPhases.find(
    (phase) => PBXCopyFilesBuildPhase.is(phase) && phase.props.name === EMBED_EXTENSIONS
  );
  if (!clipPhase) {
    clipPhase = clip.createBuildPhase(PBXCopyFilesBuildPhase, {
      name: EMBED_EXTENSIONS,
      // 13: the PlugIns folder.
      dstSubfolderSpec: 13,
      dstPath: '',
      files: [],
    });
  }

  for (const phase of main.props.buildPhases) {
    if (!PBXCopyFilesBuildPhase.is(phase)) continue;
    const moving = phase.props.files.filter((file) => file.props.fileRef?.uuid === product.uuid);
    if (moving.length === 0) continue;
    phase.props.files = phase.props.files.filter((file) => !moving.includes(file));
    for (const file of moving) {
      if (!clipPhase.props.files.some((f) => f.props.fileRef?.uuid === product.uuid)) {
        clipPhase.props.files.push(file);
      }
    }
  }

  main.props.dependencies = main.props.dependencies.filter((dependency) => {
    const onActivity =
      dependency.props.target?.uuid === activity.uuid ||
      dependency.props.targetProxy?.props.remoteGlobalIDString === activity.uuid;
    if (onActivity) dependency.removeFromProject();
    return !onActivity;
  });
  clip.addDependency(activity);

  // App Store Connect refuses an extension whose version differs from its app's.
  for (const configuration of activity.props.buildConfigurationList.props.buildConfigurations) {
    configuration.props.buildSettings.MARKETING_VERSION = version;
  }
}

function withAppClip(config) {
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      execFileSync(process.execPath, [path.join(config.modRequest.projectRoot, 'scripts/sync-clip-looks.mjs')], {
        stdio: 'inherit',
      });
      return config;
    },
  ]);

  config = withXcodeProjectBeta(config, (config) => {
    const project = config.modResults;
    const clip = project.rootObject.props.targets.find((t) => t.props.productName === CLIP_PRODUCT);
    if (!clip) {
      throw new Error(
        `[with-app-clip] No "${CLIP_PRODUCT}" target. List ./plugins/with-app-clip before @bacons/apple-targets in app.json.`
      );
    }

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const key =
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!url || !key) {
      console.warn('[with-app-clip] EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY are not set — the clip will say it is not set up.');
    }

    // The URL goes in as scheme and host: an unquoted `//` in project.pbxproj
    // would read as the start of a comment, and the writer does not quote it.
    const parsed = url ? new URL(url) : null;
    for (const configuration of clip.props.buildConfigurationList.props.buildConfigurations) {
      Object.assign(configuration.props.buildSettings, {
        MARKETING_VERSION: config.version ?? '1.0.0',
        LEFT_SUPABASE_SCHEME: parsed ? parsed.protocol.replace(':', '') : '',
        LEFT_SUPABASE_HOST: parsed ? parsed.host : '',
        LEFT_SUPABASE_KEY: key,
      });
    }
    embedActivityInClip(project, clip, config.version ?? '1.0.0');
    return config;
  });

  return config;
}

module.exports = withAppClip;
