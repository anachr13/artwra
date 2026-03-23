/**
 * @file metro.config.js
 * @author Artwra
 * @description Metro bundler configuration for the Expo monorepo.
 *
 * Configures Metro to:
 * 1. Watch all files in the pnpm monorepo root so cross-package imports resolve.
 * 2. Resolve modules from the app's own node_modules first, then the monorepo's
 *    pnpm virtual store — required because pnpm hoists packages to the root.
 * 3. Enable symlink support so that pnpm's symlinked packages are resolved
 *    correctly, preventing HMR registration failures caused by Metro treating
 *    symlink-resolved absolute paths as relative paths from the project root.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from project root first, then monorepo root (pnpm virtual store)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Enable symlink resolution — prevents HMR crashes in pnpm workspaces where
//    Metro resolves symlinks to their real paths and then can't find them relative
//    to the project root.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
