import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PixelRatio, StyleSheet, View, type GestureResponderEvent } from 'react-native'
import * as THREE from 'three'
import { Canvas as NativeCanvas, useFrame, useThree, type CanvasProps } from '@react-three/fiber/native'
import { bubble, El, webEvent } from '../dom/elements'
import type { DomNode } from '../dom/node'
import { Layer, LayerHost } from '../dom/portal'
import { GLScale } from './glview'

// React Three Fiber for the game's code on the phone: its native side (expo-gl),
// with a <Canvas> that takes the web's className and style, as a <div> holding
// the canvas would, and a layer over it for drei's <Html> labels (drei.tsx).
//
// Made light for a phone (the game's scenes are the website's, made for a computer too):
// - drawn at the game's own resolution, never above 1.25 pixels a point (expo-gl draws at the
//   phone's 2.5 to 3.5: glview.tsx draws smaller and stretches), and without multisampling;
// - 30 frames a second at most (a phone's screen asks for 60 to 120, and each frame is the
//   JavaScript's: the scene's, the game's and the views');
// - what it costs written in the phone's log every 5 seconds (« [perf] », adb logcat).

export * from '@react-three/fiber/native'

/** The layer over the canvas the labels inside it are drawn in. */
export const HtmlLayer = createContext<Layer | null>(null)

/** The most pixels a point a scene is drawn with in the app. */
const MAX_DPR = 1.25
/** The most frames a second. */
const MAX_FPS = 30

type WebCanvasProps = Omit<CanvasProps, 'style'> & { className?: string; style?: Record<string, unknown>; dpr?: number | [number, number]; eventSource?: unknown; eventPrefix?: string; resize?: unknown; fallback?: ReactNode }

export function Canvas({ className, style, children, dpr, eventSource: _source, eventPrefix: _prefix, resize: _resize, fallback: _fallback, gl, frameloop, ...rest }: WebCanvasProps) {
  const layer = useMemo(() => new Layer(), [])
  const box = useRef<DomNode | null>(null)
  // The resolution asked for, as it is at first (a change later would make the GL view anew).
  const [scale] = useState(() => {
    const asked = Array.isArray(dpr) ? dpr[1] : (dpr ?? MAX_DPR)
    return Math.min(1, Math.min(asked, MAX_DPR) / PixelRatio.get())
  })
  // The renderer as the game asks for it (its gl props), without multisampling, its pixel ratio the GL view's.
  const renderer = useMemo(() => {
    if (typeof gl === 'function' || (gl && 'render' in (gl as object))) return gl
    return (defaults: Record<string, unknown>) => {
      const r = new THREE.WebGLRenderer({ ...defaults, ...(gl as object), antialias: false } as THREE.WebGLRendererParameters)
      const set = r.setPixelRatio.bind(r)
      r.setPixelRatio = (v: number) => set(v * scale)
      return r
    }
  }, [gl, scale])
  // Drawn when asked for, at most MAX_FPS times a second (FrameCap); « never » stays never.
  const loop = frameloop === 'never' || frameloop === 'demand' ? frameloop : 'demand'
  // The scene keeps the touch (its own pointer events, React Three Fiber's): the boxes round it hear it too, as the
  // web's canvas bubbles its pointer events (« Régler la circulation »: a tap on the crossroads, a swipe across it).
  const tell = (name: string, type: string) => (e: GestureResponderEvent) => box.current && bubble(box.current, name, webEvent(type, e, box.current))
  // The web's canvas fills its parent (r3f's own wrapper: relative, 100% × 100%, overflow hidden).
  return (
    <El __tag="div" ref={box} className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      <View style={StyleSheet.absoluteFill} onTouchStart={tell('onPointerDown', 'pointerdown')} onTouchMove={tell('onPointerMove', 'pointermove')} onTouchEnd={tell('onPointerUp', 'pointerup')} onTouchCancel={tell('onPointerCancel', 'pointercancel')}>
        <GLScale.Provider value={scale}>
          <NativeCanvas {...rest} gl={renderer as CanvasProps['gl']} frameloop={loop} style={StyleSheet.absoluteFill}>
            {frameloop !== 'never' && frameloop !== 'demand' && <FrameCap fps={MAX_FPS} />}
            <PerfLog />
            <HtmlLayer.Provider value={layer}>{children}</HtmlLayer.Provider>
          </NativeCanvas>
        </GLScale.Provider>
      </View>
      <LayerHost layer={layer} />
    </El>
  )
}

/** A frame asked for at most `fps` times a second (the canvas draws on demand). */
function FrameCap({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const step = 1000 / fps
    let last = 0
    let raf = requestAnimationFrame(function tick(t) {
      raf = requestAnimationFrame(tick)
      // (A few ms early is on time: the screen's frames come every 8 to 17 ms.)
      if (t - last < step - 4) return
      last = t
      invalidate()
    })
    return () => cancelAnimationFrame(raf)
  }, [fps, invalidate])
  return null
}

/** What a scene costs, in the phone's log every 5 seconds: frames, the JavaScript's time a frame (all of it: js; drawing: render), what the GPU is sent, and the views drawn again. */
function PerfLog() {
  const gl = useThree((s) => s.gl)
  const st = useRef({ t0: 0, frames: 0, work: 0, frame: 0, start: 0, worst: 0, last: 0, views: 0 })
  useEffect(() => {
    // Every frame's own time: the scene's updates (useFrame) to the GPU's commands sent (render).
    const render = gl.render.bind(gl)
    gl.render = (scene, camera) => {
      const t = performance.now()
      render(scene, camera)
      const end = performance.now()
      st.current.work += end - t
      // The whole frame's JavaScript: from the first of the scene's updates to the GPU's commands sent.
      if (st.current.start) st.current.frame += end - st.current.start
      st.current.start = 0
    }
    return () => void (gl.render = render)
  }, [gl])
  // (First of the frame's updates.)
  useFrame(() => void (st.current.start = performance.now()), -1e9)
  useFrame(() => {
    const s = st.current
    const now = performance.now()
    if (!s.t0) {
      s.t0 = now
      s.last = now
      s.views = viewsDrawn()
      return
    }
    s.worst = Math.max(s.worst, now - s.last)
    s.last = now
    s.frames++
    if (now - s.t0 < 5000) return
    const secs = (now - s.t0) / 1000
    const i = gl.info
    const views = viewsDrawn()
    const buf = gl.getDrawingBufferSize(new THREE.Vector2())
    console.log(`[perf] fps=${(s.frames / secs).toFixed(1)} worst=${s.worst.toFixed(0)}ms js=${(s.frame / Math.max(1, s.frames)).toFixed(1)}ms render=${(s.work / Math.max(1, s.frames)).toFixed(1)}ms calls=${i.render.calls} tris=${i.render.triangles} geo=${i.memory.geometries} tex=${i.memory.textures} progs=${i.programs?.length ?? 0} buffer=${buf.x}x${buf.y} shadows=${gl.shadowMap.enabled} views/s=${((views - s.views) / secs).toFixed(0)}`)
    Object.assign(s, { t0: now, frames: 0, work: 0, frame: 0, worst: 0, views })
  })
  return null
}

/** How many of the game's elements were drawn so far (dom/elements.tsx counts them). */
const viewsDrawn = () => (globalThis as { __babiViews?: number }).__babiViews ?? 0
