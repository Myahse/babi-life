// The app shares the game's code with the website: it imports web/src (as @web/…). Packages are
// always taken from this app's node_modules (one React, one three), and a file.native.ts next to
// a web file is picked instead of it (React Native's own rule). The web's icons (lucide-react)
// are their React Native twins here.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const root = __dirname
const web = path.resolve(root, '../web/src')
const config = getDefaultConfig(root)

config.watchFolders = [web]
config.resolver.nodeModulesPaths = [path.resolve(root, 'node_modules')]
config.resolver.disableHierarchicalLookup = true
const twins = { 'lucide-react': 'lucide-react-native' }
const resolve = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, name, platform) => {
  const to = twins[name] ?? name
  return resolve ? resolve(context, to, platform) : context.resolveRequest(context, to, platform)
}

module.exports = config
