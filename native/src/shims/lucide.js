// The game's icons (lucide-react): their React Native twins, drawn as one of
// our elements (dom/elements.tsx, the 'icon' tag) so they take the classes
// the web gives them (h-4 w-4, text-white, absolute, animate-spin) and the
// text's colour as currentColor. Every name is looked up when it's first
// used, so the whole set needn't be wrapped.
const { forwardRef, createElement } = require('react')
const Lucide = require('lucide-react-native')
const { El } = require('../dom/elements')

const made = new Map()
function wrap(name) {
  const Icon = Lucide[name]
  if (typeof Icon !== 'function' && typeof Icon !== 'object') return Icon
  const W = forwardRef((props, ref) => createElement(El, { ...props, ref, __tag: 'icon', __icon: Icon }))
  W.displayName = name
  // An inline box in a line, as an <svg> is (elements.tsx kindOf).
  W.__inline = true
  return W
}

module.exports = new Proxy(
  {},
  {
    get(_, name) {
      if (name === '__esModule') return true
      if (typeof name !== 'string') return undefined
      if (!made.has(name)) made.set(name, wrap(name))
      return made.get(name)
    },
  },
)
