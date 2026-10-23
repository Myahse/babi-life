import type { ReactNode } from 'react'
import { Portal } from '../dom/portal'

// react-dom for the game's code on the phone: what it sends to document.body
// is drawn in the screen's layer (dom/portal.tsx), over everything.

/** Its children over the whole screen (the container is the page's body: there's one place). */
export function createPortal(children: ReactNode, _container?: unknown, key?: string | null) {
  return <Portal key={key ?? undefined}>{children}</Portal>
}

/** React Native renders a state change when it's ready; the callback runs now. */
export function flushSync<T>(f: () => T): T {
  return f()
}
