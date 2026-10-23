import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime'
import { El } from './elements'
import { HTML_TAGS } from './tags'

// The JSX of the game's code (web/src, babel's jsxImportSource): an HTML tag
// (div, span, button, svg…) is drawn by our element (elements.tsx); anything
// else (a component, a three.js object in a <Canvas>: mesh, group…) as React
// would. Inside an R3F canvas the lowercase tags are three.js's own: they're
// told apart by the tags the game uses as HTML (tags.ts).

const to = (type: any, props: any) => (typeof type === 'string' && HTML_TAGS.has(type) ? [El, { ...props, __tag: type }] : [type, props])

export function jsx(type: any, props: any, key?: any) {
  const [t, p] = to(type, props)
  return reactJsx(t, p, key)
}
export function jsxs(type: any, props: any, key?: any) {
  const [t, p] = to(type, props)
  return reactJsxs(t, p, key)
}
export { Fragment }

// The type checker's JSX (div, svg…: React's own list), for the files written with our runtime.
export type { JSX } from 'react/jsx-runtime'
