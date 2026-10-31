import { createContext, useContext, useState, type ComponentProps } from 'react'
import { StyleSheet, View } from 'react-native'
import { GLView as RealGLView } from 'expo-gl'

// expo-gl for React Three Fiber's canvas (metro.config.js gives it this file): its GL view drawn
// smaller and stretched to the canvas's box (the screen's compositor scales it, for nothing). expo-gl
// draws at the phone's full pixel ratio, and a phone's 2.5 to 3.5 is up to ten times the pixels of
// what the game asks for (dpr 1.25 to 1.5): the scenes slow down to a crawl on a phone's GPU. The
// canvas (fiber.tsx) says by how much; its touches, its size and its labels stay the box's own.

export * from 'expo-gl'

/** The share of the box the GL view draws (1: all of it, at the phone's pixel ratio). */
export const GLScale = createContext(1)

export function GLView(props: ComponentProps<typeof RealGLView>) {
  const s = useContext(GLScale)
  const [box, setBox] = useState({ w: 0, h: 0 })
  if (s >= 1) return <RealGLView {...props} />
  const { w, h } = box
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 && h > 0 && <RealGLView {...props} style={{ position: 'absolute', left: (w - w * s) / 2, top: (h - h * s) / 2, width: w * s, height: h * s, transform: [{ scale: 1 / s }] }} />}
    </View>
  )
}
