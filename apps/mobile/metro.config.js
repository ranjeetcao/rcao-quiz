// Metro config with NativeWind + monorepo support.
// Reaches out of apps/mobile to resolve workspace packages (@rcao-quiz/sdk)
// and Expo's own deps that pnpm hoists to the workspace-root node_modules.

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1) Watch the entire workspace so changes in packages/sdk hot-reload here.
config.watchFolders = [workspaceRoot];

// 2) Resolve modules from both the app and the workspace root.
//    Hierarchical lookup must stay enabled (the default) so that when Expo's
//    URL-path-based bundle requests (e.g. `/../../node_modules/expo-router/...`)
//    fall through to the project root, Metro can still find the file in the
//    workspace-root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3) Honour `exports` maps in package.json. Required for the SDK's deep
//    imports like `@rcao-quiz/sdk/components` to resolve.
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: './global.css' });
