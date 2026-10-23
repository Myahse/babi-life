// The game's code (web/src) is written for Vite and the browser. Two things change here:
// its JSX goes through our runtime (src/dom/jsx-runtime.ts: <div> → a React Native view),
// and import.meta.env (Vite's) becomes Expo's: __DEV__, and EXPO_PUBLIC_* for the VITE_* values.
const preset = require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] })

// The site's API by default: the app has no page address for '/api/v1' to be relative to.
const API = 'https://babi-life-jnvy.onrender.com/api/v1'

function viteEnv({ types: t }) {
  const env = (name) => t.memberExpression(t.memberExpression(t.identifier('process'), t.identifier('env')), t.identifier(name))
  const or = (a, b) => t.logicalExpression('||', a, b)
  const VALUES = {
    DEV: () => t.identifier('__DEV__'),
    PROD: () => t.unaryExpression('!', t.identifier('__DEV__')),
    MODE: () => t.conditionalExpression(t.identifier('__DEV__'), t.stringLiteral('development'), t.stringLiteral('production')),
    VITE_API_URL: () => or(env('EXPO_PUBLIC_API_URL'), t.stringLiteral(API)),
    // No Mapbox in the app: the offline board is the map (GameMap.tsx).
    VITE_MAPBOX_TOKEN: () => t.identifier('undefined'),
    VERCEL_GIT_COMMIT_SHA: () => env('EXPO_PUBLIC_COMMIT_SHA'),
  }
  const isImportMeta = (n) => t.isMetaProperty(n) && n.meta.name === 'import' && n.property.name === 'meta'
  return {
    name: 'babi-vite-env',
    visitor: {
      MemberExpression(path) {
        const { node } = path
        // import.meta.env.NAME
        if (t.isMemberExpression(node.object) && isImportMeta(node.object.object) && t.isIdentifier(node.object.property, { name: 'env' }) && t.isIdentifier(node.property)) {
          const name = node.property.name
          path.replaceWith(VALUES[name] ? VALUES[name]() : name.startsWith('VITE_') ? env(`EXPO_PUBLIC_${name.slice(5)}`) : t.identifier('undefined'))
          return
        }
        // import.meta.url: the site's address (a base for new URL(…)).
        if (isImportMeta(node.object) && t.isIdentifier(node.property, { name: 'url' })) path.replaceWith(t.stringLiteral('https://www.lifeinbabi.com/'))
      },
    },
  }
}

const path = require('path')
const game = path.resolve(__dirname, '../web/src') + path.sep

module.exports = function (api) {
  api.cache(true)
  return {
    presets: [preset],
    plugins: [viteEnv],
    // Only the game's JSX is HTML; the app's own (src/) is React Native's.
    overrides: [{ test: (file) => !!file && file.startsWith(game), presets: [[preset, { jsxRuntime: 'automatic', jsxImportSource: 'babi-dom' }]] }],
  }
}
