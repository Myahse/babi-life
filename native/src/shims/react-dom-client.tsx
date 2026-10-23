import type { ReactNode } from 'react'
import { screen } from '../dom/portal'

// A second React root (the web's map markers, the labs) drawn in the screen's layer.
export function createRoot(_container?: unknown) {
  const id = screen.open()
  return {
    render(node: ReactNode) {
      screen.set(id, node)
    },
    unmount() {
      screen.drop(id)
    },
  }
}
export type Root = ReturnType<typeof createRoot>
