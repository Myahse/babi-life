import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Canvas as SkiaView, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia'
import type { DomNode } from './node'

/**
 * A <canvas>: what the game draws on it (its node's Skia canvas, node.ts), shown
 * as it is a few times a second (the game draws on its own clock: the mini-map
 * every 150 ms), stretched to the box as the web's is to its CSS size.
 */
export function CanvasView({ dom, box, pe, handlers, hostRef }: { dom: DomNode; box: Record<string, any>; pe: boolean; handlers: Record<string, any> | null; hostRef: (n: any) => void }) {
  const [snap, setSnap] = useState<SkImage | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 100 || !dom.drawing) return
      last = t
      setSnap((dom.drawing as unknown as { surface: { makeImageSnapshot: () => SkImage } }).surface.makeImageSnapshot())
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dom])
  return (
    <View ref={hostRef} style={box} pointerEvents={pe ? 'none' : undefined} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...(handlers ?? {})}>
      {snap && size.w > 0 && (
        <SkiaView style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkiaImage image={snap} x={0} y={0} width={size.w} height={size.h} fit="fill" />
        </SkiaView>
      )}
    </View>
  )
}
