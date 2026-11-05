import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Furniture } from '../../lib/types'
import { FurnitureSet } from './Furniture'

// The house editor's helpers (components/BuildMode): the camera that frames the lot in the part of
// the screen the panels leave free and stays on it, the dust of blocks put down or knocked down, the
// spot aimed at (green where it goes, red where it doesn't), and the catalogue's pictures, drawn once
// from the pieces' own 3D models.

type Controls = THREE.EventDispatcher<{ change: object }> & { target: THREE.Vector3; enabled: boolean; update: () => void; minDistance: number; maxDistance: number }

/**
 * Frames a lot w × d (centred on the origin) in what the panels leave of the screen: `top` and
 * `bottom` pixels are covered. It flies in at the start, keeps the point looked at on the lot
 * (a pan can't lose it), and glides up or down to the floor being worked on (`floor`, metres).
 */
export function BuildCamera({ w, d, top, bottom, floor }: { w: number; d: number; top: number; bottom: number; floor: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as unknown as Controls | null
  // The free band's middle: the projection shifted so the lot sits there, not under the panels.
  useLayoutEffect(() => {
    const shift = (bottom - top) / 2
    camera.setViewOffset(size.width, size.height, 0, shift, size.width, size.height)
    camera.updateProjectionMatrix()
    return () => {
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }, [camera, size.width, size.height, top, bottom])
  // How far back the whole lot fits, across and up the free band.
  const fit = useMemo(() => {
    // (Seen three-quarters from above, the lot's far corners sit a little inside its circle.)
    const r = (Math.hypot(w, d) / 2) * 0.86 + 0.5
    const half = THREE.MathUtils.degToRad(camera.fov / 2)
    const band = Math.max(0.3, (size.height - top - bottom) / size.height)
    const tanV = Math.tan(half) * band
    const tanH = Math.tan(half) * (size.width / size.height)
    return r / Math.min(tanV, tanH)
  }, [w, d, camera.fov, size.width, size.height, top, bottom])
  const intro = useRef(0)
  const dir = useMemo(() => new THREE.Vector3(0.55, 0.72, 0.85).normalize(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    if (!controls) return
    controls.minDistance = 4
    controls.maxDistance = fit * 1.6
    // The point looked at stays over the lot (and a little round it).
    const clamp = () => {
      const t = controls.target
      t.x = THREE.MathUtils.clamp(t.x, -w / 2 - 2, w / 2 + 2)
      t.z = THREE.MathUtils.clamp(t.z, -d / 2 - 2, d / 2 + 2)
    }
    controls.addEventListener('change', clamp)
    return () => controls.removeEventListener('change', clamp)
  }, [controls, fit, w, d])
  useFrame((_, dt) => {
    if (!controls) return
    // The fly-in: from high above, down to the lot in under a second.
    if (intro.current < 1) {
      intro.current = Math.min(1, intro.current + dt / 0.9)
      const k = 1 - Math.pow(1 - intro.current, 3)
      const far = fit * (1.9 - 0.9 * k)
      tmp.copy(dir).multiplyScalar(far)
      tmp.y += (1 - k) * fit * 0.6
      camera.position.copy(tmp).add(controls.target)
      controls.update()
    }
    // To the floor worked on, gently (the camera moves with the point it looks at).
    const want = floor + 1
    const dy = want - controls.target.y
    if (Math.abs(dy) > 0.01) {
      const step = dy * Math.min(1, dt * 6)
      controls.target.y += step
      camera.position.y += step
      controls.update()
    }
  })
  return null
}

const DUST = 64
const dustGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16)
const dustMat = new THREE.MeshLambertMaterial({ vertexColors: false })
type Burst = { at: [number, number, number]; color: string; n?: number; up?: number }
const bursts: Burst[] = []
/** A puff of little blocks from a cell (a block put down, knocked down, a piece put on the floor). */
export function dust(b: Burst) {
  bursts.push(b)
}

/** The puffs of little blocks: one instanced mesh, nothing made while it runs. */
export function Dust() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const st = useMemo(() => ({ p: new Float32Array(DUST * 3), v: new Float32Array(DUST * 3), life: new Float32Array(DUST), next: 0, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), pos: new THREE.Vector3(), c: new THREE.Color() }), [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    st.m.makeScale(0, 0, 0)
    for (let i = 0; i < DUST; i++) {
      mesh.setMatrixAt(i, st.m)
      mesh.setColorAt(i, st.c.set('#ffffff'))
    }
  }, [st])
  useFrame((_, dt) => {
    const mesh = ref.current
    if (!mesh) return
    dt = Math.min(dt, 0.05)
    while (bursts.length) {
      const b = bursts.shift()!
      for (let k = 0; k < (b.n ?? 8); k++) {
        const i = st.next
        st.next = (st.next + 1) % DUST
        st.p[i * 3] = b.at[0] + (Math.random() - 0.5) * 0.8
        st.p[i * 3 + 1] = b.at[1] + Math.random() * 0.3
        st.p[i * 3 + 2] = b.at[2] + (Math.random() - 0.5) * 0.8
        const a = Math.random() * Math.PI * 2
        const sp = 1 + Math.random() * 1.6
        st.v[i * 3] = Math.cos(a) * sp
        st.v[i * 3 + 1] = (b.up ?? 2.4) + Math.random() * 1.4
        st.v[i * 3 + 2] = Math.sin(a) * sp
        st.life[i] = 0.55 + Math.random() * 0.25
        mesh.setColorAt(i, st.c.set(b.color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12))
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    let any = false
    for (let i = 0; i < DUST; i++) {
      if (st.life[i] <= 0) continue
      any = true
      st.life[i] -= dt
      st.v[i * 3 + 1] -= 9.8 * dt
      st.p[i * 3] += st.v[i * 3] * dt
      st.p[i * 3 + 1] = Math.max(0.08, st.p[i * 3 + 1] + st.v[i * 3 + 1] * dt)
      st.p[i * 3 + 2] += st.v[i * 3 + 2] * dt
      const k = Math.max(0, Math.min(1, st.life[i] / 0.3))
      st.e.set(st.life[i] * 7, st.life[i] * 5, 0)
      st.q.setFromEuler(st.e)
      st.s.setScalar(k)
      st.pos.set(st.p[i * 3], st.p[i * 3 + 1], st.p[i * 3 + 2])
      mesh.setMatrixAt(i, st.m.compose(st.pos, st.q, st.s))
    }
    if (any || st.next) mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[dustGeo, dustMat, DUST]} frustumCulled={false} raycast={() => null} />
}

const okMat = new THREE.MeshBasicMaterial({ color: '#2fd36a', transparent: true, opacity: 0.45, depthWrite: false })
const badMat = new THREE.MeshBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: 0.5, depthWrite: false })
const okEdge = new THREE.LineBasicMaterial({ color: '#1f9e4f' })
const badEdge = new THREE.LineBasicMaterial({ color: '#d81b3f' })
const unitBox = new THREE.BoxGeometry(1, 1, 1)
const unitEdges = new THREE.EdgesGeometry(unitBox)
const plane = new THREE.PlaneGeometry(1, 1)

/**
 * The spot aimed at: a box of w × h × d cells from its corner cell, green where it goes and red
 * where it doesn't, its shadow on the floor, breathing a little so it reads as « not yet put ».
 * Grabbing it (`onGrab`) lets a finger drag it.
 */
export function Aim({ at, size, ok, onGrab, solid = true }: { at: [number, number, number]; size: [number, number, number]; ok: boolean; onGrab?: (e: { pointerType: string; stopPropagation: () => void }) => void; solid?: boolean }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const k = 1 + Math.sin(clock.elapsedTime * 6) * 0.015
    g.current?.scale.set(k, 1, k)
  })
  const [w, h, d] = size
  return (
    <group position={[at[0] + w / 2, at[1], at[2] + d / 2]}>
      <group ref={g}>
        {solid && <mesh geometry={unitBox} material={ok ? okMat : badMat} position={[0, h / 2, 0]} scale={[w + 0.04, h + 0.04, d + 0.04]} raycast={() => null} renderOrder={2} />}
        <lineSegments geometry={unitEdges} material={ok ? okEdge : badEdge} position={[0, h / 2, 0]} scale={[w + 0.05, h + 0.05, d + 0.05]} raycast={() => null} />
        <mesh geometry={plane} material={ok ? okMat : badMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[w, d, 1]} raycast={() => null} />
      </group>
      {/* A larger handle than the piece itself, for a thumb */}
      {onGrab && (
        <mesh position={[0, Math.max(0.6, h / 2), 0]} scale={[Math.max(w, 1.6) + 0.6, Math.max(h, 1.2), Math.max(d, 1.6) + 0.6]} geometry={unitBox} onPointerDown={(e) => onGrab(e)}>
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  )
}

/** The catalogue's pictures (id → data URL), drawn once per session. */
const thumbs = new Map<string, string>()
const thumbListeners = new Set<() => void>()
const subscribe = (f: () => void) => (thumbListeners.add(f), () => void thumbListeners.delete(f))
/** A piece's picture, once drawn (undefined till then: show its icon). */
export function useThumb(id: string) {
  return useSyncExternalStore(subscribe, () => thumbs.get(id))
}

const PX = 112
/** Draws each piece of the catalogue once, off screen, from three quarters above, into a little picture. */
export function ThumbStudio({ catalog }: { catalog: Furniture[] }) {
  const gl = useThree((s) => s.gl)
  const [scene] = useState(() => {
    const s = new THREE.Scene()
    s.add(new THREE.HemisphereLight('#ffffff', '#9a8a70', 2.2))
    const sun = new THREE.DirectionalLight('#ffffff', 2.2)
    sun.position.set(3, 6, 4)
    s.add(sun)
    return s
  })
  const [cam] = useState(() => new THREE.PerspectiveCamera(30, 1, 0.1, 100))
  const [rt] = useState(() => new THREE.WebGLRenderTarget(PX, PX, { samples: 4 }))
  const [buf] = useState(() => new Uint8Array(PX * PX * 4))
  const [canvas] = useState(() => Object.assign(document.createElement('canvas'), { width: PX, height: PX }))
  const holder = useRef<THREE.Group>(null)
  const [n, setN] = useState(0)
  const todo = useMemo(() => catalog.filter((f) => !thumbs.has(f.id)), [catalog, n]) // eslint-disable-line react-hooks/exhaustive-deps
  const f = todo[0]
  const wait = useRef(0)
  const box = useMemo(() => new THREE.Box3(), [])
  const c = useMemo(() => new THREE.Vector3(), [])
  const s3 = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => () => rt.dispose(), [rt])
  useFrame(() => {
    if (!f || !holder.current) return
    // A frame for the piece to be made, then its picture.
    if (wait.current++ < 1) return
    wait.current = 0
    box.setFromObject(holder.current)
    box.getCenter(c)
    box.getSize(s3)
    const r = Math.max(0.5, s3.length() / 2)
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 0.92
    cam.position.set(c.x + dist * 0.62, c.y + dist * 0.55, c.z + dist * 0.56)
    cam.lookAt(c)
    const was = gl.getRenderTarget()
    const clear = gl.getClearAlpha()
    gl.setRenderTarget(rt)
    gl.setClearAlpha(0)
    gl.clear()
    gl.render(scene, cam)
    gl.readRenderTargetPixels(rt, 0, 0, PX, PX, buf)
    gl.setRenderTarget(was)
    gl.setClearAlpha(clear)
    // Linear to the screen's sRGB, and upside down (GL reads from the bottom).
    const g2 = canvas.getContext('2d')!
    const img = g2.createImageData(PX, PX)
    for (let y = 0; y < PX; y++)
      for (let x = 0; x < PX; x++) {
        const i = ((PX - 1 - y) * PX + x) * 4
        const o = (y * PX + x) * 4
        for (let k = 0; k < 3; k++) img.data[o + k] = SRGB[buf[i + k]]
        img.data[o + 3] = buf[i + 3]
      }
    g2.putImageData(img, 0, 0)
    thumbs.set(f.id, canvas.toDataURL())
    thumbListeners.forEach((l) => l())
    setN((x) => x + 1)
  })
  return f
    ? createPortal(
        <group ref={holder} key={f.id}>
          <FurnitureSet pieces={[[0, 0, 0, 0, f.id]]} catalog={catalog} />
        </group>,
        scene,
      )
    : null
}

/** Linear 0..255 to sRGB 0..255. */
const SRGB = (() => {
  const t = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const v = i / 255
    t[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055))
  }
  return t
})()

/** A house shown on the lot (a plan looked at) comes up out of the ground in under half a second, as if built fast. */
export function Rise({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    if (t.current >= 1 || !g.current) return
    t.current = Math.min(1, t.current + dt / 0.45)
    const k = 1 - Math.pow(1 - t.current, 3)
    g.current.scale.set(1, Math.max(0.02, k), 1)
  })
  return (
    <group ref={g} scale={[1, 0.02, 1]}>
      {children}
    </group>
  )
}
