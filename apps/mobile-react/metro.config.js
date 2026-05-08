const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Resolve modules from both the app's local node_modules and the hoisted root node_modules.
// Do NOT add workspaceRoot to watchFolders — that shifts Metro's server root and breaks
// bundle URL resolution (entry file gets resolved against the monorepo root instead of projectRoot).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
