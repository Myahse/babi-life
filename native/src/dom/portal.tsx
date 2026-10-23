import { Suspense, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

// What the web draws over everything wherever it's written: a `fixed` box (a
// sheet, a toast, a dialog), a createPortal(…, document.body), drei's <Html>
// labels over a 3D street. React Native has no such place: an absolute view
// sits in its parent. So these are drawn in a layer of their own, the
// screen's (App.tsx) or a canvas's, above the rest.

export class Layer {
  private nodes = new Map<number, ReactNode>()
  private order: number[] = []
  private seen = new Set<() => void>()
  private n = 0
  version = 0
  open() {
    return ++this.n
  }
  set(id: number, node: ReactNode) {
    if (!this.nodes.has(id)) this.order.push(id)
    this.nodes.set(id, node)
    this.bump()
  }
  drop(id: number) {
    if (!this.nodes.delete(id)) return
    this.order = this.order.filter((x) => x !== id)
    this.bump()
  }
  private bump() {
    this.version++
    this.seen.forEach((f) => f())
  }
  subscribe = (f: () => void) => {
    this.seen.add(f)
    return () => void this.seen.delete(f)
  }
  list() {
    return this.order.map((id) => [id, this.nodes.get(id)] as const)
  }
}

/** The screen's own layer, over the whole app. */
export const screen = new Layer()

/** Its children drawn in the layer (the screen's by default), as long as it's there. */
export function Portal({ layer = screen, children }: { layer?: Layer; children?: ReactNode }) {
  const id = useRef(0)
  if (!id.current) id.current = layer.open()
  // Each render hands the layer what to draw now (unchanged children: React leaves them be).
  useLayoutEffect(() => {
    layer.set(id.current, children)
  })
  useLayoutEffect(() => () => layer.drop(id.current), [layer])
  return null
}

/** Where a layer is drawn: over its parent, touches going through where nothing is. */
export function LayerHost({ layer = screen }: { layer?: Layer }) {
  useSyncExternalStore(layer.subscribe, () => layer.version)
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Each in its own Suspense: what one waits for (a lazy part) mustn't take the whole layer, or the app, with it. */}
      {layer.list().map(([id, node]) => (
        <Suspense key={id} fallback={null}>
          {node}
        </Suspense>
      ))}
    </View>
  )
}
