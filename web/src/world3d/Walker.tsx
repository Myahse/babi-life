import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Sim } from '../lib/types'
import { iconFor, kindColors } from '../components/icons'
import { IconTile } from '../components/ui'
import { Character } from './Character'
import { HOME_ID, SIDEWALK, type Lot } from './layout'
import { moveInput } from './input'

type XZ = [number, number]

const SPEED = 4.2 // metres per second: a brisk walk, so errands don't drag
/** A walk never takes longer than this many seconds: far away, the Sim hurries. */
const LONGEST_WALK = 40

function pathLength(pts: XZ[], from: XZ) {
  let t = 0
  let prev = from
  for (const p of pts) {
    t += Math.hypot(p[0] - prev[0], p[1] - prev[1])
    prev = p
  }
  return t
}

const NEAR_DOOR = 2.6 // metres from a door to be "at" a place

/** How the Sim gets around: where it may stand, and the way to somewhere. */
export type WalkNav = {
  walkable: (x: number, z: number) => boolean
  /** The way from a to b (a place's door when `door`), or null if there is none. */
  route: (a: XZ, b: XZ, door: boolean) => XZ[] | null
  /** Keep the camera over the playable area. */
  bounds?: { x0: number; x1: number; z0: number; z1: number }
  /** Where the Sim starts when it isn't busy anywhere and has no home here. */
  start?: XZ
}

type Props = {
  sim: Sim
  stage: string
  lots: Lot[]
  nav: WalkNav
  moodColor: string
  goTo: { placeId: string; nonce: number } | null
  onArrive: (placeId: string) => void
  busy: { icon: string; kind: string } | null
  stationAt: string | null
  nameTag?: string
  labels: boolean
  onNear?: (placeId: string | null) => void
  frozen: boolean
  recenter: number
  onFreeCamera?: (free: boolean) => void
  /** A perspective camera (the open world) rather than the isometric one. */
  perspective?: boolean
  /** Close behind the Sim, like Minecraft's third-person view, rather than high above. */
  close?: boolean
}

/** The player's Sim: walks to places, with the pad or by tapping the ground; the camera follows. */
export function Walker({ sim, stage, lots, nav, moodColor, goTo, onArrive, busy, stationAt, nameTag, labels, onNear, frozen, recenter, onFreeCamera, perspective, close }: Props) {
  const group = useRef<THREE.Group>(null)
  const path = useRef<[number, number][]>([])
  const target = useRef<string | null>(null)
  const [walking, setWalking] = useState(false)
  const speed = useRef(SPEED)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)

  // Start where the Sim is busy, else at home, else on the sidewalk. Only
  // once: the place list changes later (a happening starts, an activity
  // ends) and the Sim must never teleport.
  const placed = useRef(false)
  useEffect(() => {
    if (placed.current || !controls) return
    const at = lots.find((l) => l.id === stationAt) ?? lots.find((l) => l.id === HOME_ID)
    const [x, z] = at?.door ?? nav.start ?? [0, SIDEWALK]
    group.current!.position.set(x, 0, z)
    // The camera starts right over the Sim.
    if (controls) {
      const d = new THREE.Vector3(x - controls.target.x, 0, z - controls.target.z)
      controls.target.add(d)
      camera.position.add(d)
      controls.update()
    }
    if (at) group.current!.rotation.y = at.z < 0 ? Math.PI : 0
    placed.current = true
  }, [lots, stationAt, controls]) // eslint-disable-line react-hooks/exhaustive-deps

  // The camera follows the Sim, unless the player dragged it away to look
  // around; walking (or the recentre button) brings it back.
  const free = useRef(false)
  const gesture = useRef(false)
  const setFree = (f: boolean) => {
    if (free.current !== f) {
      free.current = f
      onFreeCamera?.(f)
    }
  }
  useEffect(() => setFree(false), [recenter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Switching views: the camera keeps its heading, and moves in or out.
  useEffect(() => {
    if (!perspective || !controls || !group.current) return
    const t = controls.target
    const flat = new THREE.Vector3(camera.position.x - t.x, 0, camera.position.z - t.z)
    if (flat.lengthSq() < 0.01) flat.set(1, 0, 1)
    flat.normalize()
    const [back, up] = close ? [9, 4.2] : [62, 56]
    const g = group.current.position
    t.set(g.x, close ? 1.4 : 0, g.z)
    camera.position.set(g.x + flat.x * back, up, g.z + flat.z * back)
    controls.update()
    setFree(false)
  }, [close, controls]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!controls) return
    const start = () => (gesture.current = true)
    const end = () => {
      gesture.current = false
      const g = group.current
      if (g && Math.hypot(controls.target.x - g.position.x, controls.target.z - g.position.z) > 3) setFree(true)
    }
    controls.addEventListener('start', start)
    controls.addEventListener('end', end)
    return () => (controls.removeEventListener('start', start), controls.removeEventListener('end', end))
  }, [controls]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!goTo) return
    const lot = lots.find((l) => l.id === goTo.placeId)
    if (!lot) return
    const p = group.current!.position
    const way = nav.route([p.x, p.z], lot.door, true)
    if (way) path.current = way.slice(1)
    else {
      // No way through (too far, not loaded yet): straight there, as by moto-taxi.
      group.current!.position.set(lot.door[0], 0, lot.door[1])
      path.current = [lot.door]
    }
    speed.current = Math.max(SPEED, pathLength(path.current, [p.x, p.z]) / LONGEST_WALK)
    target.current = lot.id
    setFree(false)
    setWalking(true)
  }, [goTo, lots]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Tap the ground: the Sim walks there, along the streets. */
  const walkToPoint = (x: number, z: number) => {
    if (frozen || !nav.walkable(x, z)) return
    const p = group.current!.position
    const way = nav.route([p.x, p.z], [x, z], false)
    if (!way) return
    path.current = way.slice(1)
    speed.current = Math.max(SPEED, pathLength(path.current, [p.x, p.z]) / LONGEST_WALK)
    target.current = null
    setFree(false)
    setWalking(true)
  }

  const near = useRef<string | null>(null)
  const padWalking = useRef(false)
  useFrame((_, dt) => {
    const g = group.current!
    // The pad (or the keyboard) walks the Sim freely, relative to the camera.
    const input = moveInput()
    const strength = Math.min(1, Math.hypot(input.x, input.y))
    if (!frozen && strength > 0.05) {
      path.current = []
      target.current = null
      if (free.current) setFree(false)
      const fwd = new THREE.Vector3(controls ? controls.target.x - camera.position.x : -1, 0, controls ? controls.target.z - camera.position.z : -1).normalize()
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
      const dir = right.multiplyScalar(input.x).add(fwd.multiplyScalar(input.y)).normalize()
      const step = SPEED * strength * Math.min(dt, 0.25)
      const [x, z] = [g.position.x + dir.x * step, g.position.z + dir.z * step]
      // Slide along walls: try the full step, then each axis on its own.
      if (nav.walkable(x, z)) g.position.set(x, 0, z)
      else if (nav.walkable(x, g.position.z)) g.position.x = x
      else if (nav.walkable(g.position.x, z)) g.position.z = z
      g.rotation.y = Math.atan2(dir.x, dir.z)
      if (!padWalking.current) {
        padWalking.current = true
        setWalking(true)
      }
    } else if (padWalking.current) {
      padWalking.current = false
      setWalking(false)
    }
    // Standing at a door: offer to go in.
    if (onNear) {
      let best: Lot | null = null
      let bestD = NEAR_DOOR
      for (const l of lots) {
        const d = Math.hypot(l.door[0] - g.position.x, l.door[1] - g.position.z)
        if (d < bestD) [best, bestD] = [l, d]
      }
      const id = path.current.length ? null : (best?.id ?? null)
      if (id !== near.current) {
        near.current = id
        onNear(id)
      }
    }
    if (path.current.length) {
      const [tx, tz] = path.current[0]
      const dx = tx - g.position.x
      const dz = tz - g.position.z
      const dist = Math.hypot(dx, dz)
      // Real speed even at a low frame rate (cheap phones): only cap huge gaps, like a tab switch.
      const step = Math.min(dist, speed.current * Math.min(dt, 0.25))
      if (dist < 0.05) {
        path.current.shift()
        if (!path.current.length) {
          setWalking(false)
          // Face the building and hand over to the action menu.
          const lot = lots.find((l) => l.id === target.current)
          if (lot) g.rotation.y = lot.z < 0 ? Math.PI : 0
          if (target.current) onArrive(target.current)
        }
      } else {
        g.position.x += (dx / dist) * step
        g.position.z += (dz / dist) * step
        g.rotation.y = Math.atan2(dx, dz)
      }
    }
    // Camera follows the Sim, keeping whatever angle the player chose.
    if (controls && !free.current && !gesture.current) {
      const want = new THREE.Vector3(g.position.x, close ? 1.4 : 0, g.position.z)
      // Smooth, and as quick on a slow phone as on a fast computer.
      const delta = want.sub(controls.target).multiplyScalar(1 - Math.exp(-5 * Math.min(dt, 0.25)))
      controls.target.add(delta)
      camera.position.add(delta)
      controls.update()
    }
    // Looking around stays over the playable area.
    if (controls && nav.bounds) {
      const t = controls.target
      const b = nav.bounds
      const cx = THREE.MathUtils.clamp(t.x, b.x0, b.x1) - t.x
      const cz = THREE.MathUtils.clamp(t.z, b.z0, b.z1) - t.z
      if (cx || cz) {
        t.x += cx
        t.z += cz
        camera.position.x += cx
        camera.position.z += cz
      }
    }
  })

  return (
    <>
      <OrbitControls
        makeDefault
        enablePan
        screenSpacePanning={false}
        // One finger (or the mouse) drags the view; two fingers zoom and turn.
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        enableDamping
        zoomSpeed={1.6}
        minZoom={2.2}
        maxZoom={70}
        minDistance={6}
        maxDistance={420}
        minPolarAngle={perspective ? 0.25 : 0.5}
        maxPolarAngle={perspective ? 1.4 : 1.05}
      />
      {/* The ground you can tap to walk to (a drag isn't a tap). */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.3, 0]}
        onClick={(e) => {
          if (e.delta > 6 || e.intersections[0]?.object !== e.object) return
          walkToPoint(e.point.x, e.point.z)
        }}
      >
        <planeGeometry args={nav.bounds ? [nav.bounds.x1 - nav.bounds.x0 + 16, nav.bounds.z1 - nav.bounds.z0 + 8] : [8000, 8000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={group}>
        <Character look={sim.look} gender={sim.gender} walking={walking} busy={!!busy} moodColor={moodColor} stage={stage} />
        {labels && nameTag && (
          <Html position={[0, 2.45, 0]} center zIndexRange={[28, 20]}>
            <span className="pointer-events-none rounded-md bg-[#0f1230]/80 px-1.5 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white">{nameTag}</span>
          </Html>
        )}
        {labels && (
          // Always mounted, content toggled: drei's <Html> breaks when unmounted mid-scene.
          <Html position={[0, 2.95, 0]} center zIndexRange={[30, 20]}>
            {busy ? (
              <div className="motion-pop">
                <div className="motion-breathe rounded-2xl border border-black/5 bg-white p-1 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]">
                  <IconTile icon={iconFor(busy.icon)} colors={kindColors(busy.kind)} size={32} radius={11} />
                </div>
              </div>
            ) : (
              <span />
            )}
          </Html>
        )}
      </group>
    </>
  )
}
