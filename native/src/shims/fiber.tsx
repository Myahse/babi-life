import { createContext, useMemo, type ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { Canvas as NativeCanvas, type CanvasProps } from '@react-three/fiber/native'
import { El } from '../dom/elements'
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
  // The web's canvas fills its parent (r3f's own wrapper: relative, 100% × 100%, overflow hidden).
  return (
    <El __tag="div" className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      {/* (The drawing's resolution is the screen's: expo-gl draws at the phone's pixel ratio.) */}
      <NativeCanvas {...rest} style={StyleSheet.absoluteFill}>
        <HtmlLayer.Provider value={layer}>{children}</HtmlLayer.Provider>
      </NativeCanvas>
      <LayerHost layer={layer} />
    </El>
  )
}
