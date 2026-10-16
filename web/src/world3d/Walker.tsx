import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Sim } from '../lib/types'
import { iconFor, kindColors } from '../components/icons'
import { IconTile } from '../components/ui'
import { Character } from './Character'
import { workLook } from '../avatar/options'
import { OutdoorAction, outdoorLook, outdoorPose } from './OutdoorAction'
import { HOME_ID, SIDEWALK, type Lot } from './layout'
import { cameraTurn, moveInput, running } from './input'
import { whereabouts } from './whereabouts'
import { worldTime } from '../lib/worldClock'
import { SIM_SLOT, matchFor, onField, worldFacing } from './open/match'
import { blocked, topAt } from './obstacles'
import type { Pose } from '../avatar/Human'

type XZ = [number, number]

const SPEED = 3.2 // metres per second: a brisk walk (long ways are run: autoRun)
const RUN = 8.5 // running
/** Further than this, the Sim runs there by itself. */
const RUN_FROM = 90
const UP = new THREE.Vector3(0, 1, 0)
const EAVES: XZ[] = [[0, 0], [1.1, 0], [-1.1, 0], [0, 1.1], [0, -1.1]]
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
  /** How high the building at this spot goes (0 in the open): the close camera stays out of walls. */
  roofAt?: (x: number, z: number) => number
  /** The height of the ground (a bridge's deck), when it isn't flat. */
  heightAt?: (x: number, z: number) => number
}

type Props = {
  sim: Sim
  stage: string
  lots: Lot[]
  nav: WalkNav
  moodColor: string
  goTo: { placeId: string; nonce: number } | null
  onArrive: (placeId: string) => void
  busy: { icon: string; kind: string; /** The activity, to show it (outdoors). */ id?: string } | null
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
  const [run, setRun] = useState(false)
  const autoRun = useRef(false)
  // The way the Sim is going, drawn on the ground.
  const [route, setRoute] = useState<XZ[] | null>(null)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  // Busy on a pitch or a court: playing takes a place in the match there;
  // watching, the Sim stands on the touchline.
  const fieldLot = busy && stationAt ? lots.find((l) => l.id === stationAt && l.field) : undefined
  const inMatch = !!fieldLot && !!busy?.id && /^play-/.test(busy.id)
  const onTouchline = !!fieldLot && /^(play-|watch-match)/.test(busy?.id ?? '')
  const [matchPose, setMatchPose] = useState<Pose>('idle')

  // Start where the Sim is busy, else at home, else on the sidewalk. Only
  // once: the place list changes later (a happening starts, an activity
  // ends) and the Sim must never teleport.
  const placed = useRef(false)
  const born = useRef(performance.now())
  useEffect(() => {
    if (placed.current || !controls) return
    // Busy at a place from the map: it comes a moment later. Wait for it a
    // little; past that, start at home for now and go there once it comes.
    const mapStation = !!stationAt && stationAt.includes('-osm-') && !lots.some((l) => l.id === stationAt)
    if (mapStation && performance.now() - born.current < 4000) return
    provisional.current = mapStation
    const at = lots.find((l) => l.id === stationAt) ?? lots.find((l) => l.id === HOME_ID)
    const [x, z] = at?.door ?? nav.start ?? [0, SIDEWALK]
    group.current!.position.set(x, 0, z)
    // The camera starts right over the Sim, out in the street, looking at it
    // with the place behind (never from inside the house).
    if (controls) {
      const off = camera.position.clone().sub(controls.target)
      const out = at ? new THREE.Vector2(x - at.x, z - at.z) : new THREE.Vector2()
      if (out.lengthSq() > 0.25) {
        out.normalize()
        const flat = Math.hypot(off.x, off.z)
        off.set(out.x * flat, off.y, out.y * flat)
      }
      controls.target.set(x, controls.target.y, z)
      camera.position.copy(controls.target).add(off)
      controls.update()
    }
    if (at) group.current!.rotation.y = at.z < 0 ? Math.PI : 0
    placed.current = true
  }, [lots, stationAt, controls]) // eslint-disable-line react-hooks/exhaustive-deps

  const provisional = useRef(false)
  useEffect(() => {
    if (!provisional.current || !stationAt || started.current || path.current.length) return
    const at = lots.find((l) => l.id === stationAt)
    if (!at) return
    provisional.current = false
    const [x, z] = at.door
    const g = group.current!
    if (controls) {
      const d = new THREE.Vector3(x - g.position.x, 0, z - g.position.z)
      controls.target.add(d)
      camera.position.add(d)
      controls.update()
    }
    g.position.set(x, 0, z)
  }, [lots, stationAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // The camera follows the Sim, unless the player dragged it away to look
  // around; walking (or the recentre button) brings it back.
  const free = useRef(false)
  const gesture = useRef(false)
  /** How far behind the Sim the player wants the close camera (walls may bring it in). */
  const wantDist = useRef(9.7)
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
    wantDist.current = Math.hypot(back, up - 1.4)
    controls.update()
    setFree(false)
  }, [close, controls]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!controls) return
    const start = () => (gesture.current = true)
    const end = () => {
      gesture.current = false
      wantDist.current = camera.position.distanceTo(controls.target)
      const g = group.current
      if (g && Math.hypot(controls.target.x - g.position.x, controls.target.z - g.position.z) > 3) setFree(true)
    }
    controls.addEventListener('start', start)
    controls.addEventListener('end', end)
    return () => (controls.removeEventListener('start', start), controls.removeEventListener('end', end))
  }, [controls]) // eslint-disable-line react-hooks/exhaustive-deps

  // Each order to go somewhere starts one walk: the place list changing on
  // the way (places from the map coming in) must not start it again, or
  // the Sim would slow down forever, never arriving.
  const started = useRef<Props['goTo']>(null)
  useEffect(() => {
    if (!goTo || started.current === goTo) return
    const lot = lots.find((l) => l.id === goTo.placeId)
    if (!lot) return
    started.current = goTo
    const p = group.current!.position
    const way = nav.route([p.x, p.z], lot.door, true)
    if (way) path.current = way.slice(1)
    else {
      // No way through (too far, not loaded yet): straight there, as by moto-taxi.
      group.current!.position.set(lot.door[0], 0, lot.door[1])
      path.current = [lot.door]
    }
    const far = pathLength(path.current, [p.x, p.z])
    autoRun.current = far > RUN_FROM
    speed.current = Math.max(autoRun.current ? RUN : SPEED, far / LONGEST_WALK)
    target.current = lot.id
    setRoute([...path.current])
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
    const far = pathLength(path.current, [p.x, p.z])
    autoRun.current = far > RUN_FROM
    speed.current = Math.max(autoRun.current ? RUN : SPEED, far / LONGEST_WALK)
    target.current = null
    setRoute([...path.current])
    setFree(false)
    setWalking(true)
  }

  /**
   * Room for the Sim's body here: not in a building (its walls all round,
   * not just its middle), nor in a car, a tree, a post, a stall.
   */
  const roomAt = (x: number, z: number) => {
    const R = 0.35
    if (!nav.walkable(x, z) || !nav.walkable(x + R, z) || !nav.walkable(x - R, z) || !nav.walkable(x, z + R) || !nav.walkable(x, z - R)) return false
    return !blocked(x, z, R)
  }
  whereabouts.roomAt = roomAt
  const near = useRef<string | null>(null)
  const padWalking = useRef(false)
  const orbit = useRef({ sph: new THREE.Spherical(), offset: new THREE.Vector3() })
  useFrame((_, dt) => {
    if (cameraTurn.yaw || cameraTurn.pitch || cameraTurn.snap) {
      if (controls) {
        const offset = orbit.current.offset.copy(camera.position).sub(controls.target)
        const sph = orbit.current.sph.setFromVector3(offset)
        if (cameraTurn.snap) {
          const r = sph.radius || (close ? 10 : 48)
          offset.set(0, Math.cos(sph.phi) * r, Math.sin(sph.phi) * r)
        } else {
          sph.theta -= cameraTurn.yaw
          const minP = perspective ? 0.25 : 0.5
          const maxP = perspective ? 1.4 : 1.05
          sph.phi = THREE.MathUtils.clamp(sph.phi + cameraTurn.pitch, minP, maxP)
          offset.setFromSpherical(sph)
        }
        camera.position.copy(controls.target).add(offset)
        controls.update()
      }
      cameraTurn.yaw = 0
      cameraTurn.pitch = 0
      cameraTurn.snap = false
    }
    const g = group.current!
    // The pad (or the keyboard) walks the Sim freely, relative to the camera.
    const input = moveInput()
    const strength = Math.min(1, Math.hypot(input.x, input.y))
    if (!frozen && strength > 0.05) {
      if (path.current.length) setRoute(null)
      path.current = []
      target.current = null
      if (free.current) setFree(false)
      const fwd = new THREE.Vector3(controls ? controls.target.x - camera.position.x : -1, 0, controls ? controls.target.z - camera.position.z : -1).normalize()
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
      const dir = right.multiplyScalar(input.x).add(fwd.multiplyScalar(input.y)).normalize()
      const step = (running() ? RUN : SPEED) * strength * Math.min(dt, 0.25)
      const [x, z] = [g.position.x + dir.x * step, g.position.z + dir.z * step]
      // Slide along walls: try the full step, then each axis on its own.
      // (Caught inside something, a car that stopped on it say: it may step out.)
      if (roomAt(x, z) || !roomAt(g.position.x, g.position.z)) g.position.set(x, 0, z)
      else if (roomAt(x, g.position.z)) g.position.x = x
      else if (roomAt(g.position.x, z)) g.position.z = z
      else {
        // Straight into a post or a trunk: step round it, a little to one side.
        for (const a of [0.5, -0.5, 1, -1]) {
          const [c, s] = [Math.cos(a), Math.sin(a)]
          const [sx, sz] = [g.position.x + (dir.x * c - dir.z * s) * step, g.position.z + (dir.x * s + dir.z * c) * step]
          if (roomAt(sx, sz)) {
            g.position.set(sx, 0, sz)
            break
          }
        }
      }
      g.rotation.y = Math.atan2(dir.x, dir.z)
      if (!padWalking.current) {
        padWalking.current = true
        setWalking(true)
      }
    } else if (padWalking.current) {
      padWalking.current = false
      setWalking(false)
    }
    // In the match: where the Sim's place in it is, now.
    if (inMatch && fieldLot?.field && !path.current.length && !padWalking.current) {
      const f = fieldLot.field
      const m = matchFor(fieldLot.id, f)
      const s = m.player(0, SIM_SLOT[f.sport], worldTime())
      const [x, z] = onField(f, s.u, s.v)
      g.position.set(x, 0, z)
      g.rotation.y = worldFacing(f, s.face)
      if (s.pose !== matchPose) setMatchPose(s.pose)
    } else if (onTouchline && fieldLot && !path.current.length && !padWalking.current) g.rotation.y = Math.atan2(fieldLot.x - g.position.x, fieldLot.z - g.position.z)
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
        setRoute(path.current.length ? [...path.current] : null)
        if (!path.current.length) {
          setWalking(false)
          // Face the building and hand over to the action menu.
          const lot = lots.find((l) => l.id === target.current)
          if (lot) g.rotation.y = Math.atan2(lot.x - g.position.x, lot.z - g.position.z)
          if (target.current) onArrive(target.current)
        }
      } else {
        g.position.x += (dx / dist) * step
        g.position.z += (dz / dist) * step
        g.rotation.y = Math.atan2(dx, dz)
      }
    }
    // Running with the pad (Shift, the button), or on a long way.
    const nowRunning = (padWalking.current && running()) || (path.current.length > 0 && (autoRun.current || running()))
    if (path.current.length && running() && speed.current < RUN) speed.current = RUN
    if (nowRunning !== run) setRun(nowRunning)
    // For the mini-map: where the Sim is, which way the camera looks.
    whereabouts.sim = [g.position.x, g.position.z]
    if (controls) {
      const dx = controls.target.x - camera.position.x
      const dy = camera.position.y - controls.target.y
      const dz = controls.target.z - camera.position.z
      whereabouts.heading = Math.atan2(dx, -dz)
      whereabouts.polar = Math.acos(THREE.MathUtils.clamp(dy / (Math.hypot(dx, dy, dz) || 1), -1, 1))
    }
    // Up and down bridges.
    if (nav.heightAt) g.position.y = nav.heightAt(g.position.x, g.position.z)
    // What the other players see of this Sim.
    whereabouts.simY = g.position.y
    whereabouts.simHeading = g.rotation.y
    whereabouts.simPose = busy ? (busy.kind === 'chat' ? 'talk' : 'busy') : walking ? (run ? 'run' : 'walk') : 'idle'
    // Camera follows the Sim, keeping whatever angle the player chose.
    if (controls && !free.current && !gesture.current) {
      const want = new THREE.Vector3(g.position.x, close ? 1.4 : 0, g.position.z)
      // Smooth, and as quick on a slow phone as on a fast computer.
      const delta = want.sub(controls.target).multiplyScalar(1 - Math.exp(-5 * Math.min(dt, 0.25)))
      controls.target.add(delta)
      camera.position.add(delta)
      // Close up, walking ahead with the pad: the camera swings slowly round
      // behind the Sim, so "up" on the pad keeps meaning "where I'm looking".
      if (close && padWalking.current && moveInput().y > 0.3) {
        const off = camera.position.clone().sub(controls.target)
        let d = g.rotation.y + Math.PI - Math.atan2(off.x, off.z)
        d = Math.atan2(Math.sin(d), Math.cos(d))
        off.applyAxisAngle(UP, d * (1 - Math.exp(-1.2 * Math.min(dt, 0.25))))
        camera.position.copy(controls.target).add(off)
      }
      controls.update()
    }
    // Close behind the Sim, the camera never goes through a wall: it comes in
    // front of the building in the way, and goes back out once past it.
    if (close && controls && nav.roofAt && !gesture.current) {
      const t = controls.target
      const off = camera.position.clone().sub(t)
      const dist = off.length()
      if (dist > 0.01) {
        off.divideScalar(dist)
        // How high the buildings go here, a metre round (roofs overhang their walls).
        const roofNear = (x: number, z: number) => {
          let h = 0
          for (const [a, b] of EAVES) h = Math.max(h, nav.roofAt!(x + a, z + b), topAt(x + a, z + b))
          return h
        }
        // How far the camera can go back along `dir` before meeting a building.
        const room = (dir: THREE.Vector3) => {
          for (let s = 1; s <= 24; s++) {
            const d = (wantDist.current * s) / 24
            const [x, z] = [t.x + dir.x * d, t.z + dir.z * d]
            if (roofNear(x, z) > t.y + dir.y * d - 0.4) return d - 0.6
          }
          return wantDist.current
        }
        let free = room(off)
        let flipped = false
        // A wall right behind (the Sim at a door): look from the street side instead.
        if (free < 3.2) {
          const other = new THREE.Vector3(-off.x, off.y, -off.z)
          const there = room(other)
          if (there > free) {
            off.copy(other)
            free = there
            flipped = true
          }
        }
        free = Math.max(1.6, free)
        const next = free < dist ? free : dist + (free - dist) * (1 - Math.exp(-3 * Math.min(dt, 0.25)))
        if (flipped) camera.position.copy(t).addScaledVector(off, Math.min(free, dist))
        else if (Math.abs(next - dist) > 0.001) camera.position.copy(t).addScaledVector(off, next)
      }
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
        // Close up, a drag turns around the Sim. From above, a drag slides the
        // view and a right-drag (or two fingers) turns it.
        touches={{ ONE: close ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        mouseButtons={{ LEFT: close ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: close ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE }}
        enableDamping
        zoomSpeed={1.6}
        minZoom={2.2}
        maxZoom={70}
        minDistance={6}
        maxDistance={perspective ? 1800 : 420}
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
      {route && <RouteDots route={route} from={group} heightAt={nav.heightAt} />}
      <group ref={group}>
        <Character look={busy?.id === 'work' ? workLook(sim.look, sim.career, sim.careerLevel) : outdoorLook(sim.look, busy?.id)} gender={sim.gender} walking={walking} running={run} busy={!!busy} pose={busy?.kind === 'chat' ? 'talk' : inMatch && !walking ? matchPose : outdoorPose(busy?.id)} moodColor={moodColor} stage={stage} speed={run ? RUN : SPEED} />
        {/* Outdoors, what the Sim is doing is set around it (the ball, the towel, the bus stop…) */}
        {busy && !walking && !onTouchline && <OutdoorAction id={busy.id} />}
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

/** The way to go, as dots on the ground, and a marker bobbing over where it ends. */
function RouteDots({ route, from, heightAt }: { route: XZ[]; from: React.RefObject<THREE.Group | null>; heightAt?: (x: number, z: number) => number }) {
  const MAX = 400
  const dots = useRef<THREE.InstancedMesh>(null)
  const pin = useRef<THREE.Group>(null)
  const m = useRef(new THREE.Object3D())
  useFrame(() => {
    const mesh = dots.current
    const g = from.current
    if (!mesh || !g) return
    // Dots every 2 m from the Sim along the way.
    const pts: XZ[] = [[g.position.x, g.position.z], ...route]
    let n = 0
    let next = 1 // where the next dot falls, in metres along the way
    let start = 0
    for (let i = 1; i < pts.length && n < MAX; i++) {
      const [ax, az] = pts[i - 1]
      const [bx, bz] = pts[i]
      const len = Math.hypot(bx - ax, bz - az)
      for (; next < start + len && n < MAX; next += 2) {
        const t = (next - start) / len
        const [x, z] = [ax + (bx - ax) * t, az + (bz - az) * t]
        m.current.position.set(x, (heightAt?.(x, z) ?? 0) + 0.12, z)
        m.current.updateMatrix()
        mesh.setMatrixAt(n++, m.current.matrix)
      }
      start += len
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    const end = route[route.length - 1]
    if (pin.current && end) {
      pin.current.position.set(end[0], (heightAt?.(end[0], end[1]) ?? 0) + 2.6 + Math.sin(worldTime() * 3) * 0.25, end[1])
      pin.current.rotation.y = worldTime() * 1.5
    }
  })
  return (
    <>
      <instancedMesh ref={dots} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 10]} />
        <meshBasicMaterial color="#ff7a00" transparent opacity={0.85} />
      </instancedMesh>
      <group ref={pin}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.5, 1.1, 4]} />
          <meshBasicMaterial color="#ff7a00" />
        </mesh>
      </group>
    </>
  )
}
