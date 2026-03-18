const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix react-native-web vendor path resolution for SDK 55
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
};

// Ensure .js.flow files are not resolved before .js
config.resolver.sourceExts = config.resolver.sourceExts.filter(
  (ext) => ext !== 'flow'
);

module.exports = config;
