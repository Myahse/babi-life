import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Sim } from '../lib/types'
import { iconFor, kindColors } from '../components/icons'
import { IconTile } from '../components/ui'
import { Character } from './Character'
import { randomLook, workLook } from '../avatar/options'
import { rng } from './themes'
import { OutdoorAction, outdoorLook, outdoorPose } from './OutdoorAction'
import { HOME_ID, SIDEWALK, type Lot } from './layout'
import { cameraTurn, moveInput, running } from './input'
import { whereabouts } from './whereabouts'
import { worldTime } from '../lib/worldClock'
import { SIM_SLOT, matchFor, onField, simSeat, toField, worldFacing } from './open/match'
import { blocked, blockedFixed, topAt, vehicleAt } from './obstacles'
import { gridWay } from './gridPath'
import { usePhotoMode } from './photoCam'
import { stopEmote, useEmote } from './emoteNow'
import { Swimmer } from './Swimmer'
import { Vehicle } from './vehicles'
import type { Pose } from '../avatar/Human'

type XZ = [number, number]

const SPEED = 1.9 // metres per second: a brisk walk
const RUN = 4.6 // running: a real run, nothing like a car
/** Further than this, the Sim runs there by itself. */
const RUN_FROM = 90
/** Further than this, the Sim hails a moto-taxi and rides there behind the driver. */
const RIDE_FROM = 220
const RIDE = 9 // a moto-taxi in town: about 32 km/h
/** Busy doing these, the Sim goes up and down a way by the place: a stroll, a hike, laps of the stadium. (The zoo: the player walks it freely.) */
const LOOPS: Record<string, { speed: number; run?: boolean; len: number }> = {
  'balade-lagune': { speed: 1.2, len: 14 },
  hike: { speed: 1.4, len: 18 },
  'stade-footing': { speed: 3.2, run: true, len: 26 },
  // Hanging out with a friend: a slow walk up and down the street, side by side.
  'ami-trainer': { speed: 1.1, len: 16 },
}
const UP = new THREE.Vector3(0, 1, 0)
const EAVES: XZ[] = [[0, 0], [1.1, 0], [-1.1, 0], [0, 1.1], [0, -1.1]]
/** Closer than this, a walk goes straight round what's in the way (gridWay), not by the streets. */
const NEAR_WALK = 110

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

/** Where the Sim does a home action on its own furniture: walked to from `from`, then settled `at` (y up), turned `rot`. */
export type HomeSpot = { at: XZ; y: number; rot: number; pose: Pose; lying: boolean; from: XZ; /** A stool under the Sim (at the table). */ stool?: boolean; /** The spot is in a wall (the piece is against one on both sides). */ wall?: boolean; /** Swimming lengths of the pool: half the length (m). */ swim?: number; /** Watching TV: the screen (on, while watching). */ screen?: { at: XZ; rot: number } }

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
  /** Closer still: over the shoulder, at head height (the third-person view). */
  shoulder?: boolean
  /** Busy at home, in one's own house: the piece of furniture it's done on. */
  homeSpot?: HomeSpot
  /** Inside a place (doing something there): not drawn in the street. */
  hidden?: boolean
}

/** The player's Sim: walks to places, with the pad or by tapping the ground; the camera follows. */
export function Walker({ sim, stage, lots, nav, moodColor, goTo, onArrive, busy, stationAt, nameTag, labels, onNear, frozen, recenter, onFreeCamera, perspective, close, shoulder, homeSpot, hidden }: Props) {
  const group = useRef<THREE.Group>(null)
  const path = useRef<[number, number][]>([])
  const target = useRef<string | null>(null)
  const [walking, setWalking] = useState(false)
  // The phone's camera open: the Sim holds its phone up (snapshot.tsx draws what it sees).
  const photoMode = usePhotoMode()
  // An emote played from the sheet: while standing; walking off ends it.
  const emote = useEmote()
  useEffect(() => {
    if (walking || busy) stopEmote()
  }, [walking, busy])
  const speed = useRef(SPEED)
  const [run, setRun] = useState(false)
  const autoRun = useRef(false)
  // Far away: on the back of a moto-taxi.
  const riding = useRef(false)
  const [ride, setRide] = useState(false)
  /** How the Sim goes a way this long: walking, running, or by moto-taxi. */
  const setPace = (far: number) => {
    riding.current = far > RIDE_FROM
    autoRun.current = !riding.current && far > RUN_FROM
    speed.current = riding.current ? RIDE : autoRun.current ? RUN : SPEED
    setRide(riding.current)
  }
  // The way the Sim is going, drawn on the ground.
  const [route, setRoute] = useState<XZ[] | null>(null)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  // Busy on a pitch or a court: playing takes a place in the match there;
  // watching, the Sim stands on the touchline.
  const fieldLot = busy && stationAt ? lots.find((l) => l.id === stationAt && l.field) : undefined
  const inMatch = !!fieldLot && !!busy?.id && /^play-/.test(busy.id)
  const onTouchline = !!fieldLot && /^(play-|watch-match)/.test(busy?.id ?? '')
  // Strolling (LOOPS): the way's start, its direction and length, and when it began.
  const loop = useRef<{ x: number; z: number; fx: number; fz: number; len: number; t0: number } | null>(null)
  const [looping, setLooping] = useState(false)
  const loopKind = busy?.id ? LOOPS[busy.id] : undefined
  // At home on the furniture: walking to it, then settled on it.
  const homeGoing = useRef<HomeSpot | null>(null)
  const [settled, setSettled] = useState<HomeSpot | null>(null)
  // Getting onto the furniture takes a moment: from where the Sim stood, eased.
  const settling = useRef<{ x: number; z: number; rot: number; t: number } | null>(null)
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
  /** Where the camera looks: the Sim's head over the shoulder, its chest close up, the ground from above. */
  const lookHeight = close ? (shoulder ? 1.75 : 1.4) : 0
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
    const [back, up] = close ? (shoulder ? [4.4, 2.5] : [9, 4.2]) : [62, 56]
    const g = group.current.position
    t.set(g.x, lookHeight, g.z)
    camera.position.set(g.x + flat.x * back, up, g.z + flat.z * back)
    wantDist.current = Math.hypot(back, up - lookHeight)
    controls.update()
    setFree(false)
  }, [close, shoulder, controls]) // eslint-disable-line react-hooks/exhaustive-deps
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
    const way = findWay([p.x, p.z], lot.door, true)
    if (way) path.current = way.slice(1)
    else {
      // No way through (too far, not loaded yet): straight there, as by moto-taxi.
      group.current!.position.set(lot.door[0], 0, lot.door[1])
      path.current = [lot.door]
    }
    setPace(pathLength(path.current, [p.x, p.z]))
    target.current = lot.id
    setRoute([...path.current])
    setFree(false)
    setWalking(true)
  }, [goTo, lots]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Tap the ground: the Sim walks there, the shortest way round what's in the way. */
  const walkToPoint = (x: number, z: number) => {
    if (frozen || !nav.walkable(x, z)) return
    const p = group.current!.position
    const way = findWay([p.x, p.z], [x, z], false)
    if (!way) return
    path.current = way.slice(1)
    setPace(pathLength(path.current, [p.x, p.z]))
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
  /** Room for the body, the cars aside (they'll have moved on): for planning a way. */
  const roomFixed = (x: number, z: number) => {
    const R = 0.35
    if (!nav.walkable(x, z) || !nav.walkable(x + R, z) || !nav.walkable(x - R, z) || !nav.walkable(x, z + R) || !nav.walkable(x, z - R)) return false
    return !blockedFixed(x, z, R)
  }
  /**
   * The way from a to b: close by, straight round the walls, trees and
   * stalls (never the long way by the streets); further, along the streets,
   * with the bits from the Sim to the street and from the street to b found
   * the same way round.
   */
  const findWay = (a: XZ, b: XZ, door: boolean): XZ[] | null => {
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < NEAR_WALK) {
      const near = gridWay(a, b, roomFixed)
      if (near) return near
    }
    const way = nav.route(a, b, door)
    if (!way || way.length < 3) return way
    const first = gridWay(a, way[1], roomFixed) ?? [a, way[1]]
    const n = way.length
    const last = gridWay(way[n - 2], b, roomFixed) ?? [way[n - 2], b]
    return [...first, ...way.slice(2, n - 2), ...last]
  }
  const waited = useRef(0)
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
    // At home, the action done on its piece of furniture: walk up to it, then onto it.
    if (homeSpot && !padWalking.current) {
      if (settled !== homeSpot && !path.current.length) {
        const [fx, fz] = homeSpot.from
        if (Math.hypot(g.position.x - fx, g.position.z - fz) > 0.6 && homeGoing.current !== homeSpot) {
          homeGoing.current = homeSpot
          const way = findWay([g.position.x, g.position.z], homeSpot.from, false)
          path.current = way ? way.slice(1) : [homeSpot.from]
          target.current = null
          speed.current = SPEED
          autoRun.current = false
          setRoute([...path.current])
          setWalking(true)
        } else {
          settling.current = { x: g.position.x, z: g.position.z, rot: g.rotation.y, t: 0 }
          setSettled(homeSpot)
        }
      } else if (settled === homeSpot) {
        const st = settling.current
        let k = 1
        if (st) {
          st.t += dt
          k = Math.min(1, st.t / 0.6)
          if (k >= 1) settling.current = null
        }
        const e = k * k * (3 - 2 * k)
        const from = st ?? { x: homeSpot.at[0], z: homeSpot.at[1], rot: homeSpot.rot }
        // The shortest way round to the spot's facing.
        const turn = Math.atan2(Math.sin(homeSpot.rot - from.rot), Math.cos(homeSpot.rot - from.rot))
        g.position.set(from.x + (homeSpot.at[0] - from.x) * e, homeSpot.y * e, from.z + (homeSpot.at[1] - from.z) * e)
        g.rotation.y = from.rot + turn * e
      }
    } else if (settled) {
      // Done: up and off the furniture, in front of it.
      g.position.set(settled.from[0], 0, settled.from[1])
      homeGoing.current = null
      setSettled(null)
    }
    // Strolling: along the way and back, again and again, as far as there's room.
    if (loopKind && !path.current.length && !padWalking.current) {
      if (!loop.current) {
        const [x, z] = [g.position.x, g.position.z]
        // Across the way the Sim faces (that's the building), then the other way if there's no room.
        const ways: XZ[] = [[Math.cos(g.rotation.y), -Math.sin(g.rotation.y)], [-Math.cos(g.rotation.y), Math.sin(g.rotation.y)], [-Math.sin(g.rotation.y), -Math.cos(g.rotation.y)]]
        let best = { fx: 0, fz: 1, len: 0 }
        for (const [fx, fz] of ways) {
          let len = 0
          while (len < loopKind.len && roomAt(x + fx * (len + 0.5), z + fz * (len + 0.5))) len += 0.5
          if (len > best.len) best = { fx, fz, len }
        }
        loop.current = { x, z, ...best, t0: worldTime() }
      }
      const l = loop.current
      if (l.len >= 2) {
        const s = ((worldTime() - l.t0) * loopKind.speed) % (2 * l.len)
        const back = s > l.len
        const d = back ? 2 * l.len - s : s
        g.position.set(l.x + l.fx * d, 0, l.z + l.fz * d)
        g.rotation.y = Math.atan2(back ? -l.fx : l.fx, back ? -l.fz : l.fz)
        if (!looping) setLooping(true)
      }
    } else if (loop.current) {
      loop.current = null
      setLooping(false)
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
    } else if (onTouchline && fieldLot?.field && !path.current.length && !padWalking.current) {
      // Watching: to the free seat on the bench on the street's side, sitting
      // there facing the field, up on the feet for a goal or a dunk.
      const f = fieldLot.field
      const side = toField(f, fieldLot.door)[1] >= 0 ? 1 : -1
      const [x, z] = onField(f, ...simSeat(f, side))
      const [dx, dz] = [x - g.position.x, z - g.position.z]
      const d = Math.hypot(dx, dz)
      let pose: Pose
      if (d > 0.05) {
        const step = Math.min(d, SPEED * Math.min(dt, 0.25))
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
        g.rotation.y = Math.atan2(dx, dz)
        pose = 'walk'
      } else {
        g.rotation.y = worldFacing(f, side > 0 ? -Math.PI / 2 : Math.PI / 2)
        const mo = matchFor(fieldLot.id, f).moment(worldTime())
        pose = mo.kind === 'goal' || mo.kind === 'dunk' ? 'cheer' : 'sit'
      }
      if (pose !== matchPose) setMatchPose(pose)
    }
    // Talking with someone: face them.
    const face = whereabouts.faceTo
    if (face && !path.current.length && !padWalking.current && Math.hypot(face[0] - g.position.x, face[1] - g.position.z) > 0.3) {
      const want = Math.atan2(face[0] - g.position.x, face[1] - g.position.z)
      const d = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y))
      g.rotation.y += d * Math.min(1, dt * 8)
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
        setRoute(path.current.length ? [...path.current] : null)
        if (!path.current.length) {
          setWalking(false)
          // Face the building and hand over to the action menu.
          const lot = lots.find((l) => l.id === target.current)
          if (lot) g.rotation.y = Math.atan2(lot.x - g.position.x, lot.z - g.position.z)
          if (target.current) onArrive(target.current)
        }
      } else {
        const nx = g.position.x + (dx / dist) * step
        const nz = g.position.z + (dz / dist) * step
        g.rotation.y = Math.atan2(dx, dz)
        // A car in the way: wait for it to pass; still there after a while, find another way round it.
        if (vehicleAt(nx, nz) && !vehicleAt(g.position.x, g.position.z)) {
          waited.current += dt
          if (waited.current > 2.5) {
            waited.current = 0
            const end = path.current[path.current.length - 1]
            const round = gridWay([g.position.x, g.position.z], end, roomAt)
            if (round) {
              path.current = round.slice(1)
              setRoute([...path.current])
            }
          }
        } else {
          waited.current = 0
          g.position.x = nx
          g.position.z = nz
        }
      }
    }
    // Running with the pad (Shift, the button), or on a long way.
    if (riding.current && !path.current.length) {
      riding.current = false
      setRide(false)
    }
    const nowRunning = !riding.current && ((padWalking.current && running()) || (path.current.length > 0 && (autoRun.current || running())))
    if (path.current.length && !riding.current && running() && speed.current < RUN) speed.current = RUN
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
    whereabouts.simPose = busy ? (busy.kind === 'chat' ? 'talk' : 'busy') : walking ? (run ? 'run' : 'walk') : (emote ?? 'idle')
    // Camera follows the Sim, keeping whatever angle the player chose.
    if (controls && !free.current && !gesture.current) {
      const want = new THREE.Vector3(g.position.x, lookHeight, g.position.z)
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
      <group ref={group} visible={!hidden}>
        {ride ? (
          // On the moto-taxi, behind the driver (the moto's front is its +x: turned to face the way).
          <>
            <group position={[0, 0, 0.45]} rotation={[0, -Math.PI / 2, 0]}>
              <Vehicle p={[0, 0, 0]} kind="moto" color="#c92a2a" />
            </group>
            <group position={[0, 0.42, -0.15]}>
              <Character look={sim.look} gender={sim.gender} walking={false} running={false} busy={false} pose="sit" moodColor={moodColor} stage={stage} />
            </group>
          </>
        ) : settled?.swim ? (
          <Swimmer len={settled.swim} look={{ ...sim.look, outfit: 'maillot', accessory: 'none' }} gender={sim.gender} stage={stage} />
        ) : settled ? (
          // On the furniture at home: lying in the bed (the head towards its head), sitting, at the stove, in the shower.
          <group rotation={settled.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
            {settled.stool && (
              <mesh position={[0, 0.2 - settled.y, -0.05]}>
                <boxGeometry args={[0.38, 0.4, 0.38]} />
                <meshLambertMaterial color="#7a5233" />
              </mesh>
            )}
            <Character look={busy?.id === 'shower' ? { ...sim.look, outfit: 'serviette', accessory: 'none' } : sim.look} gender={sim.gender} walking={false} running={false} busy={false} pose={settled.pose} moodColor={moodColor} stage={stage} />
          </group>
        ) : (
          <Character look={busy?.id === 'work' ? workLook(sim.look, sim.career, sim.careerLevel) : outdoorLook(sim.look, busy?.id)} gender={sim.gender} walking={walking || looping} running={run || (looping && !!loopKind?.run)} busy={!!busy && !looping} marker={!photoMode} pose={photoMode && photoMode !== 'film' && !busy && !walking ? 'phone' : emote && !busy && !walking ? emote : busy?.kind === 'chat' ? 'talk' : (inMatch || onTouchline) && !walking ? matchPose : outdoorPose(busy?.id)} moodColor={moodColor} stage={stage} speed={looping && loopKind ? loopKind.speed : run ? RUN : SPEED} />
        )}
        {/* Hanging out: the friend walks along beside the Sim */}
        {busy?.id === 'ami-trainer' && <Buddy sim={sim} walking={looping} stage={stage} />}
        {/* Outdoors, what the Sim is doing is set around it (the ball, the towel, the bus stop…) */}
        {busy && !walking && !onTouchline && <OutdoorAction id={busy.id} />}
        {labels && nameTag && !hidden && (
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

/** The friend one hangs out with (« Traîner ensemble »), walking at the Sim's side. */
function Buddy({ sim, walking, stage }: { sim: Sim; walking: boolean; stage: string }) {
  const name = sim.activity?.kind === 'do' ? sim.activity.placeName : undefined
  const friend = sim.friends?.find((f) => f.name === name)
  const gender = friend?.gender ?? (sim.gender === 'femme' ? 'femme' : 'homme')
  const look = useMemo(() => randomLook(gender, rng(`partner${friend?.id ?? name ?? 'ami'}`)), [gender, friend?.id, name])
  return (
    <group position={[0.85, 0, 0.1]}>
      <Character look={look} gender={gender} walking={walking} pose={walking ? undefined : 'talk'} marker={false} moodColor="#3b82f6" stage={stage} speed={1.1} />
    </group>
  )
}
