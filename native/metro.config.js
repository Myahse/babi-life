// The app shares the game's code with the website: it imports web/src (as @web/…). Packages are
// always taken from this app's node_modules (one React, one three), and a file.native.ts next to
// a web file is picked instead of it (React Native's own rule). What the game's code imports
// from the web's world (react-dom, drei, the router, the icons…) is its phone twin in src/shims;
// the shims themselves get the real packages.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const root = __dirname
const web = path.resolve(root, '../web/src')
const shims = path.resolve(root, 'src/shims')
const config = getDefaultConfig(root)

config.watchFolders = [web]
config.resolver.nodeModulesPaths = [path.resolve(root, 'node_modules')]
config.resolver.disableHierarchicalLookup = true

const at = (f) => path.resolve(root, f)
// Always: the JSX runtime (babel.config.js) and what has no package here.
const ALWAYS = {
  'babi-dom/jsx-runtime': at('src/dom/jsx-runtime.ts'),
  'babi-dom/jsx-dev-runtime': at('src/dom/jsx-dev-runtime.ts'),
  'react-router-dom': at('src/shims/react-router-dom.tsx'),
  '@react-oauth/google': at('src/shims/google-oauth.tsx'),
  '@react-three/drei': at('src/shims/drei.tsx'),
  '@react-three/postprocessing': at('src/shims/postprocessing.tsx'),
  'virtual:pwa-register': at('src/shims/pwa-register.ts'),
  'mapbox-gl': at('src/shims/mapbox-gl.ts'),
}
// In the game's code and ours (not a package's, nor a shim's: it imports the package itself): the phone twin.
const TWINS = {
  // (react-native-web, for a look in the browser, has the real one.)
  'react-dom': at('src/shims/react-dom.tsx'),
  'react-dom/client': at('src/shims/react-dom-client.tsx'),
  three: at('src/shims/three.ts'),
  'lucide-react': at('src/shims/lucide.js'),
  '@react-three/fiber': at('src/shims/fiber.tsx'),
}
const empty = at('src/shims/empty.js')

const resolve = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, name, platform) => {
  const file = (filePath) => ({ type: 'sourceFile', filePath })
  if (ALWAYS[name]) return file(ALWAYS[name])
  // The game's code (tsconfig.json's paths are for the type checker only: app.json turns them off here).
  if (name.startsWith('@web/')) name = path.join(web, name.slice(5))
  const origin = context.originModulePath
  const fromShim = origin.startsWith(shims + path.sep)
  const fromGame = origin.startsWith(web + path.sep) || (origin.startsWith(root + path.sep) && !origin.includes(`${path.sep}node_modules${path.sep}`))
  if (TWINS[name] && fromGame && !fromShim) return file(TWINS[name])
  if (name === '@react-three/fiber' && fromShim) name = '@react-three/fiber/native'
  // React Three Fiber's GL view: drawn at the resolution the canvas asks for (src/shims/glview.tsx).
  if (name === 'expo-gl' && origin.includes(`${path.sep}@react-three${path.sep}fiber${path.sep}`)) return file(at('src/shims/glview.tsx'))
  // Stylesheets (index.css, fonts): the app styles with its own (src/dom).
  if (name.endsWith('.css')) return file(empty)
  return resolve ? resolve(context, name, platform) : context.resolveRequest(context, name, platform)
}

module.exports = config
