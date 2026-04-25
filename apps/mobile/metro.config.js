// Metro config with NativeWind + monorepo support.
// Reaches out of apps/mobile to resolve workspace packages (@rcao-quiz/sdk).

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1) Watch the entire workspace so changes in packages/sdk hot-reload here.
config.watchFolders = [workspaceRoot];

// 2) Resolve modules from both the app and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3) Disable hierarchical lookup so pnpm's hoisted layout doesn't surprise us.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });
