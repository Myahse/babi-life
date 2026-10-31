import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PixelRatio, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'
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
// - 60 frames a second when the phone keeps up, 30 when it doesn't (each frame is the JavaScript's: the
//   scene's, the game's and the views'), always on the screen's own beat: every 2nd of a 120 Hz screen's
//   refreshes, never 3 then 4 then 3 (a 30 fps cap timed by the clock judders on a 120 Hz screen);
// - what it costs written in the phone's log every 2 seconds (« [perf] », adb logcat), and on the screen
//   while three fingers have turned it on (PerfHud: the owner reads it off his own phone).

export * from '@react-three/fiber/native'

/** The layer over the canvas the labels inside it are drawn in. */
export const HtmlLayer = createContext<Layer | null>(null)

/** The most pixels a point a scene is drawn with in the app. */
const MAX_DPR = 1.25
/** A frame's JavaScript (ms, averaged) above which the scene drops to 30 a second, and below which it goes back to 60. */
const SLOW_MS = 13
const FAST_MS = 8
/** The frame's JavaScript time, averaged (PerfLog measures it, FramePacer reads it). */
const cost = { ms: 0 }

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
  // Drawn when asked for, on the screen's beat at 60 or 30 frames a second (FramePacer); « never » stays never.
  const loop = frameloop === 'never' || frameloop === 'demand' ? frameloop : 'demand'
  // The scene keeps the touch (its own pointer events, React Three Fiber's): the boxes round it hear it too, as the
  // web's canvas bubbles its pointer events (« Régler la circulation »: a tap on the crossroads, a swipe across it).
  const tell = (name: string, type: string) => (e: GestureResponderEvent) => box.current && bubble(box.current, name, webEvent(type, e, box.current))
  // The web's canvas fills its parent (r3f's own wrapper: relative, 100% × 100%, overflow hidden).
  return (
    <El __tag="div" ref={box} className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      <View style={StyleSheet.absoluteFill} onTouchStart={(e) => (threeFingers(e), tell('onPointerDown', 'pointerdown')(e))} onTouchMove={tell('onPointerMove', 'pointermove')} onTouchEnd={tell('onPointerUp', 'pointerup')} onTouchCancel={tell('onPointerCancel', 'pointercancel')}>
        <GLScale.Provider value={scale}>
          <NativeCanvas {...rest} gl={renderer as CanvasProps['gl']} frameloop={loop} style={StyleSheet.absoluteFill}>
            {frameloop !== 'never' && frameloop !== 'demand' && <FramePacer />}
            <PerfLog />
            <HtmlLayer.Provider value={layer}>{children}</HtmlLayer.Provider>
          </NativeCanvas>
        </GLScale.Provider>
      </View>
      <LayerHost layer={layer} />
      <PerfHud />
    </El>
  )
}

/** Current frames a second asked for (PerfLog writes it in the log). */
const pace = { fps: 60 }

/**
 * A frame asked for on every refresh of the screen, or every 2nd, 3rd…: 60 frames a second while the
 * phone keeps up, 30 when a frame's JavaScript gets long, counted in the screen's own refreshes (its
 * rate measured as it goes: 60, 90 or 120 Hz), so each frame stays on screen as long as the one before.
 */
function FramePacer() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let last = 0
    let vsync = 1000 / 60
    let n = 0
    let raf = requestAnimationFrame(function tick(t) {
      raf = requestAnimationFrame(tick)
      // The screen's refresh, averaged over the ticks that came on time.
      if (last && t - last < 40) vsync += (t - last - vsync) * 0.05
      last = t
      if (pace.fps === 60 && cost.ms > SLOW_MS) pace.fps = 30
      else if (pace.fps === 30 && cost.ms > 0 && cost.ms < FAST_MS) pace.fps = 60
      const every = Math.max(1, Math.round(1000 / pace.fps / vsync))
      if (++n < every) return
      n = 0
      invalidate()
    })
    return () => cancelAnimationFrame(raf)
  }, [invalidate])
  return null
}

/** What a scene costs, in the phone's log every 2 seconds (and on PerfHud): frames, the JavaScript's time a frame (all of it: js; drawing: render), what the GPU is sent, and the views drawn again. */
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
      if (st.current.start) {
        st.current.frame += end - st.current.start
        // (Averaged over about a second, for FramePacer.)
        cost.ms += (end - st.current.start - cost.ms) * 0.05
      }
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
    if (now - s.t0 < 2000) return
    const secs = (now - s.t0) / 1000
    const i = gl.info
    const views = viewsDrawn()
    const buf = gl.getDrawingBufferSize(new THREE.Vector2())
    console.log(`[perf] fps=${(s.frames / secs).toFixed(1)}/${pace.fps} worst=${s.worst.toFixed(0)}ms js=${(s.frame / Math.max(1, s.frames)).toFixed(1)}ms render=${(s.work / Math.max(1, s.frames)).toFixed(1)}ms calls=${i.render.calls} tris=${i.render.triangles} geo=${i.memory.geometries} tex=${i.memory.textures} progs=${i.programs?.length ?? 0} buffer=${buf.x}x${buf.y} shadows=${gl.shadowMap.enabled} views/s=${((views - s.views) / secs).toFixed(0)}`)
    hud.text = `${(s.frames / secs).toFixed(0)}/${pace.fps} i/s · pire ${s.worst.toFixed(0)} ms · js ${(s.frame / Math.max(1, s.frames)).toFixed(1)} ms · rendu ${(s.work / Math.max(1, s.frames)).toFixed(1)} ms\n${i.render.calls} appels · ${(i.render.triangles / 1000).toFixed(0)}k triangles · ${buf.x}×${buf.y} · ombres ${gl.shadowMap.enabled ? 'oui' : 'non'}`
    Object.assign(s, { t0: now, frames: 0, work: 0, frame: 0, worst: 0, views })
  })
  return null
}

/** How many of the game's elements were drawn so far (dom/elements.tsx counts them). */
const viewsDrawn = () => (globalThis as { __babiViews?: number }).__babiViews ?? 0

/** The numbers on the screen (PerfHud): on or off, kept on the phone; the last ones PerfLog worked out. */
const hud = { on: kept(), text: '…', changed: () => {} }

function kept() {
  try {
    return localStorage.getItem('babi.perf') === '1'
  } catch {
    return false
  }
}

/** Three fingers on a scene turn the numbers on or off. */
function threeFingers(e: GestureResponderEvent) {
  if (e.nativeEvent.touches?.length !== 3) return
  hud.on = !hud.on
  try {
    localStorage.setItem('babi.perf', hud.on ? '1' : '0')
  } catch {
    /* for this time only */
  }
  hud.changed()
}

/** What the scene costs, on the screen, at the top left: read again every second while on. */
function PerfHud() {
  const [, redraw] = useState(0)
  const [on, setOn] = useState(hud.on)
  useEffect(() => {
    hud.changed = () => setOn(hud.on)
    return () => void (hud.changed = () => {})
  }, [])
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => redraw((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [on])
  if (!on) return null
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 6, top: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 }}>
      <Text style={{ color: '#7CFC9A', fontSize: 11, fontFamily: 'monospace' }}>{hud.text}</Text>
    </View>
  )
}
