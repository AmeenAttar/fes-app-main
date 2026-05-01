const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {string} — e.g. `artifacts/fes-app` */
const projectRoot = __dirname;
/** Repo root (`fes-app-main`) so pnpm-linked hoists resolve from Metro */
const workspaceRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.unstable_enableSymlinks = true;

module.exports = config;
