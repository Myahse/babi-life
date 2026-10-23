import { useEffect, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import type { DomNode } from './node'

/** A <canvas> in a browser's look at the app: the browser's own canvas (node.ts), its picture as an address, a few times a second. */
export function CanvasView({ dom, box, pe, handlers, hostRef }: { dom: DomNode; box: Record<string, any>; pe: boolean; handlers: Record<string, any> | null; hostRef: (n: any) => void }) {
  const [snap, setSnap] = useState('')
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 100 || !dom.drawing) return
      last = t
      setSnap(dom.drawing.toDataURL())
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dom])
  return (
    <View ref={hostRef} style={box} pointerEvents={pe ? 'none' : undefined} {...(handlers ?? {})}>
      {!!snap && <Image source={{ uri: snap }} style={StyleSheet.absoluteFill} />}
    </View>
  )
}
