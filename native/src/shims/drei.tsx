import { forwardRef, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated } from 'react-native'
import * as THREE from 'three'
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js'
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js'
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js'
import { useFrame, useThree, HtmlLayer } from './fiber'
import { El } from '../dom/elements'
import { Portal } from '../dom/portal'

// The four drei helpers the game uses, made for the phone: drei's web side
// draws its labels in the page and listens to the page's pointer; here the
// labels are drawn in the canvas's layer (fiber.tsx) and the controls listen
// to the canvas's touches (React Three Fiber's native canvas hands them on as
// pointer events).

/* ---------- Html: a label over a point of the 3D scene ---------- */

type HtmlProps = { children?: ReactNode; position?: [number, number, number] | THREE.Vector3; center?: boolean; zIndexRange?: [number, number]; distanceFactor?: number; style?: Record<string, unknown>; className?: string; [k: string]: unknown }

const at = new THREE.Vector3()
const eye = new THREE.Vector3()
const ahead = new THREE.Vector3()
const OFF = -100000

/** The label follows its point each frame (moved without React drawing it again); behind the camera it's gone. */
export function Html({ children, position, center, zIndexRange, distanceFactor, style, className }: HtmlProps) {
  const layer = useContext(HtmlLayer)
  const group = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const xy = useMemo(() => new Animated.ValueXY({ x: OFF, y: OFF }), [])
  const scale = useMemo(() => new Animated.Value(1), [])
  const last = useRef({ x: OFF, y: OFF, s: 1 })
  const [box, setBox] = useState({ w: 0, h: 0 })

  useFrame(() => {
    const g = group.current
    if (!g) return
    at.setFromMatrixPosition(g.matrixWorld)
    eye.setFromMatrixPosition(camera.matrixWorld)
    camera.getWorldDirection(ahead)
    const behind = at.clone().sub(eye).dot(ahead) < 0
    let x = OFF
    let y = OFF
    if (!behind) {
      const p = at.clone().project(camera)
      x = ((p.x + 1) / 2) * size.width
      y = ((1 - p.y) / 2) * size.height
    }
    const l = last.current
    if (Math.abs(x - l.x) > 0.3 || Math.abs(y - l.y) > 0.3) {
      xy.setValue({ x, y })
      l.x = x
      l.y = y
    }
    if (distanceFactor !== undefined && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      // As drei: the label shrinks with the distance, as the scene does.
      const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
      const s = distanceFactor / (2 * Math.tan(fov / 2) * at.distanceTo(eye))
      if (Math.abs(s - l.s) > 0.01) scale.setValue((l.s = s))
    }
  })

  const lift = center ? [{ translateX: -box.w / 2 }, { translateY: -box.h / 2 }] : []
  return (
    <group ref={group} position={position as [number, number, number]}>
      {layer && (
        <Portal layer={layer}>
          <Animated.View
            pointerEvents="box-none"
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout
              if (w !== box.w || h !== box.h) setBox({ w, h })
            }}
            style={{ position: 'absolute', left: 0, top: 0, zIndex: zIndexRange?.[0], transform: [{ translateX: xy.x }, { translateY: xy.y }, ...lift, { scale }] }}
          >
            <El __tag="div" className={className} style={style}>
              {children}
            </El>
          </Animated.View>
        </Portal>
      )}
    </group>
  )
}

/* ---------- OrbitControls: turn, zoom and move around a point ---------- */

type OrbitProps = { makeDefault?: boolean; camera?: THREE.Camera; target?: [number, number, number] | THREE.Vector3; enableDamping?: boolean; [k: string]: unknown }

export const OrbitControls = forwardRef<OrbitControlsImpl, OrbitProps>(function OrbitControls({ makeDefault, camera: own, enableDamping = true, ...rest }, ref) {
  const fallback = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const set = useThree((s) => s.set)
  const get = useThree((s) => s.get)
  const invalidate = useThree((s) => s.invalidate)
  const camera = (own ?? fallback) as THREE.Camera
  const controls = useMemo(() => new OrbitControlsImpl(camera), [camera])

  useFrame(() => {
    // The canvas says its size in the GL's pixels; the touches come in points (the speed of a turn is by the height).
    const el = gl.domElement as unknown as { clientWidth: number; clientHeight: number }
    el.clientWidth = size.width
    el.clientHeight = size.height
    if (controls.enabled) controls.update()
  }, -1)
  useEffect(() => {
    controls.connect(gl.domElement)
    return () => controls.disconnect()
  }, [controls, gl])
  useEffect(() => {
    const f = () => invalidate()
    controls.addEventListener('change', f)
    return () => controls.removeEventListener('change', f)
  }, [controls, invalidate])
  useEffect(() => {
    if (!makeDefault) return
    const old = get().controls
    set({ controls })
    return () => set({ controls: old })
  }, [makeDefault, controls, get, set])
  useEffect(() => () => controls.dispose(), [controls])
  return <primitive ref={ref} object={controls} enableDamping={enableDamping} {...rest} />
})

/* ---------- ContactShadows: the soft shade under what stands on the floor ---------- */

type ShadowProps = { scale?: number | [number, number]; frames?: number; opacity?: number; width?: number; height?: number; blur?: number; near?: number; far?: number; resolution?: number; smooth?: boolean; color?: THREE.ColorRepresentation; depthWrite?: boolean; renderOrder?: number; position?: [number, number, number]; [k: string]: unknown }

/**
 * drei's: the scene seen from below into a texture, blurred. Drawn with
 * three.js's own render (r3f's native one presents the frame each time it's
 * called: an offscreen pass would flash on screen).
 */
export function ContactShadows({ scale = 10, frames = Infinity, opacity = 1, width = 1, height = 1, blur = 1, near = 0, far = 10, resolution = 256, smooth = true, color = '#000000', depthWrite = false, renderOrder, ...props }: ShadowProps) {
  const ref = useRef<THREE.Group>(null)
  const cam = useRef<THREE.OrthographicCamera>(null)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const w = width * (Array.isArray(scale) ? scale[0] : scale || 1)
  const h = height * (Array.isArray(scale) ? scale[1] : scale || 1)
  const parts = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(resolution, resolution)
    const targetBlur = new THREE.WebGLRenderTarget(resolution, resolution)
    target.texture.generateMipmaps = targetBlur.texture.generateMipmaps = false
    const plane = new THREE.PlaneGeometry(w, h).rotateX(Math.PI / 2)
    const blurPlane = new THREE.Mesh(plane)
    const depth = new THREE.MeshDepthMaterial()
    depth.depthTest = depth.depthWrite = false
    depth.onBeforeCompile = (shader) => {
      shader.uniforms = { ...shader.uniforms, ucolor: { value: new THREE.Color(color) } }
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'uniform vec3 ucolor;\nvoid main() {\n')
      shader.fragmentShader = shader.fragmentShader.replace('vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );')
    }
    const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader)
    const vBlur = new THREE.ShaderMaterial(VerticalBlurShader)
    hBlur.depthTest = vBlur.depthTest = false
    return { target, targetBlur, plane, blurPlane, depth, hBlur, vBlur }
  }, [resolution, w, h, color])
  useEffect(() => () => (parts.target.dispose(), parts.targetBlur.dispose(), parts.plane.dispose(), parts.depth.dispose(), parts.hBlur.dispose(), parts.vBlur.dispose()), [parts])

  // Drawn off screen, into the shadow's targets: not a frame of the screen. r3f's phone side ends a
  // frame after every render (expo-gl's endFrameEXP): held back for these. (three's render is the
  // renderer's own, not its prototype's: the prototype has none.)
  const draw = (s: THREE.Object3D, c: THREE.Camera) => {
    const ctx = gl.getContext() as WebGLRenderingContext & { endFrameEXP?: () => void }
    const end = ctx.endFrameEXP
    if (end) ctx.endFrameEXP = () => undefined
    try {
      gl.render(s, c)
    } finally {
      if (end) ctx.endFrameEXP = end
    }
  }
  const blurOnce = (amount: number) => {
    const { blurPlane, hBlur, vBlur, target, targetBlur } = parts
    blurPlane.visible = true
    blurPlane.material = hBlur
    hBlur.uniforms.tDiffuse.value = target.texture
    hBlur.uniforms.h.value = amount / 256
    gl.setRenderTarget(targetBlur)
    draw(blurPlane, cam.current!)
    blurPlane.material = vBlur
    vBlur.uniforms.tDiffuse.value = targetBlur.texture
    vBlur.uniforms.v.value = amount / 256
    gl.setRenderTarget(target)
    draw(blurPlane, cam.current!)
    blurPlane.visible = false
  }
  const count = useRef(0)
  useFrame(() => {
    if (!cam.current || !ref.current || count.current >= frames) return
    count.current++
    const background = scene.background
    const override = scene.overrideMaterial
    ref.current.visible = false
    scene.background = null
    scene.overrideMaterial = parts.depth
    gl.setRenderTarget(parts.target)
    draw(scene, cam.current)
    blurOnce(blur)
    if (smooth) blurOnce(blur * 0.4)
    gl.setRenderTarget(null)
    ref.current.visible = true
    scene.overrideMaterial = override
    scene.background = background
  })
  return (
    <group rotation-x={Math.PI / 2} {...props} ref={ref}>
      <mesh renderOrder={renderOrder} geometry={parts.plane} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial transparent map={parts.target.texture} opacity={opacity} depthWrite={depthWrite} />
      </mesh>
      <orthographicCamera ref={cam} args={[-w / 2, w / 2, h / 2, -h / 2, near, far]} />
    </group>
  )
}

/* ---------- PerformanceMonitor: the frame rate, too low or high again ---------- */

type MonitorProps = { onIncline?: () => void; onDecline?: () => void; onChange?: (a: { fps: number }) => void; onFallback?: () => void; flipflops?: number; ms?: number; iterations?: number; bounds?: (refreshRate: number) => [number, number]; children?: ReactNode }

/** As drei's: the frames counted a while; under the bounds it's declining, at the top inclining; too many swings and it gives up (onFallback). */
export function PerformanceMonitor({ onIncline, onDecline, onChange, onFallback, flipflops = Infinity, ms = 250, iterations = 10, bounds = (r) => (r > 100 ? [60, 100] : [40, 60]), children }: MonitorProps) {
  const st = useRef({ t0: 0, frames: 0, samples: [] as number[], flips: 0, last: '', done: false })
  useFrame(() => {
    const s = st.current
    if (s.done) return
    const now = performance.now()
    if (!s.t0) s.t0 = now
    s.frames++
    if (now - s.t0 < ms) return
    s.samples.push((s.frames * 1000) / (now - s.t0))
    s.t0 = now
    s.frames = 0
    if (s.samples.length < iterations) return
    const fps = s.samples.reduce((a, b) => a + b, 0) / s.samples.length
    s.samples = []
    onChange?.({ fps })
    const [lo, hi] = bounds(60)
    const way = fps < lo ? 'decline' : fps >= hi - 1 ? 'incline' : ''
    if (!way) return
    if (s.last && way !== s.last) s.flips++
    s.last = way
    if (s.flips >= flipflops) {
      s.done = true
      onFallback?.()
      return
    }
    if (way === 'decline') onDecline?.()
    else onIncline?.()
  })
  return <>{children}</>
}
