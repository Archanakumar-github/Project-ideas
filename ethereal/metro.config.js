// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// The web build ships SQLite as WebAssembly (sql.js); bundle the .wasm file as an asset.
config.resolver.assetExts.push('wasm')

module.exports = config
