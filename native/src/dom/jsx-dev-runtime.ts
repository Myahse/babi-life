import { Fragment } from 'react/jsx-runtime'
import { jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime'
import { El } from './elements'
import { HTML_TAGS } from './tags'

// The development JSX (sources and line numbers kept): the same as jsx-runtime.ts.
export function jsxDEV(type: any, props: any, key: any, isStatic: boolean, source: any, self: any) {
  if (typeof type === 'string' && HTML_TAGS.has(type)) return reactJsxDEV(El, { ...props, __tag: type }, key, isStatic, source, self)
  return reactJsxDEV(type, props, key, isStatic, source, self)
}
export { Fragment }

export type { JSX } from 'react/jsx-dev-runtime'
