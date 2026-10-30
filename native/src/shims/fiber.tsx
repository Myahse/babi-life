import { createContext, useMemo, useRef, type ReactNode } from 'react'
import { StyleSheet, View, type GestureResponderEvent } from 'react-native'
import { Canvas as NativeCanvas, type CanvasProps } from '@react-three/fiber/native'
import { bubble, El, webEvent } from '../dom/elements'
import type { DomNode } from '../dom/node'
import { Layer, LayerHost } from '../dom/portal'

// React Three Fiber for the game's code on the phone: its native side (expo-gl),
// with a <Canvas> that takes the web's className and style, as a <div> holding
// the canvas would, and a layer over it for drei's <Html> labels (drei.tsx).

export * from '@react-three/fiber/native'

/** The layer over the canvas the labels inside it are drawn in. */
export const HtmlLayer = createContext<Layer | null>(null)

type WebCanvasProps = Omit<CanvasProps, 'style'> & { className?: string; style?: Record<string, unknown>; dpr?: number | [number, number]; eventSource?: unknown; eventPrefix?: string; resize?: unknown; fallback?: ReactNode }

export function Canvas({ className, style, children, dpr: _dpr, eventSource: _source, eventPrefix: _prefix, resize: _resize, fallback: _fallback, ...rest }: WebCanvasProps) {
  const layer = useMemo(() => new Layer(), [])
  const box = useRef<DomNode | null>(null)
  // The scene keeps the touch (its own pointer events, React Three Fiber's): the boxes round it hear it too, as the
  // web's canvas bubbles its pointer events (« Régler la circulation »: a tap on the crossroads, a swipe across it).
  const tell = (name: string, type: string) => (e: GestureResponderEvent) => box.current && bubble(box.current, name, webEvent(type, e, box.current))
  // The web's canvas fills its parent (r3f's own wrapper: relative, 100% × 100%, overflow hidden).
  return (
    <El __tag="div" ref={box} className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      <View style={StyleSheet.absoluteFill} onTouchStart={tell('onPointerDown', 'pointerdown')} onTouchMove={tell('onPointerMove', 'pointermove')} onTouchEnd={tell('onPointerUp', 'pointerup')} onTouchCancel={tell('onPointerCancel', 'pointercancel')}>
        {/* (The drawing's resolution is the screen's: expo-gl draws at the phone's pixel ratio.) */}
        <NativeCanvas {...rest} style={StyleSheet.absoluteFill}>
          <HtmlLayer.Provider value={layer}>{children}</HtmlLayer.Provider>
        </NativeCanvas>
      </View>
      <LayerHost layer={layer} />
    </El>
  )
}
