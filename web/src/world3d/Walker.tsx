import { useGesture } from './gesture'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Friend, Sim } from '../lib/types'
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
import { clearLine, gridWay } from './gridPath'
import { usePhotoMode } from './photoCam'
import { stopEmote, useEmote } from './emoteNow'
import { Swimmer } from './Swimmer'
import { Bicycle, Vehicle, type CarModel } from './vehicles'
import { HANDLING, drive, driving, useDriving } from './drive'
import { report } from './open/trafficFlow'
import { motoTaken, offerMoto, RIDES, type Taken } from './moto'
import { tripRide } from './open/tripRide'
import { askDrop, answerDrop, takeDrop } from './dropRoute'
import { along, routeLength, turnTo } from './open/shared'
import { laneStart, lanePoint, laneStretch, STADIUM_TRACKS, toWorld, type Track } from './open/stadiumTrack'
import { rooftopFor } from './open/rooftops'
import type { Pose } from '../avatar/Human'

type XZ = [number, number]

const SPEED = 1.9 // metres per second: a brisk walk
const RUN = 4.6 // running: a real run, nothing like a car
/** Further than this, a moto-taxi is offered (world3d/moto.ts): paid, the Sim rides there behind the driver. */
const RIDE_FROM = 220
/** Busy doing these, the Sim goes up and down a way by the place: a stroll, a hike, laps of the stadium. (The zoo: the player walks it freely.) */
const LOOPS: Record<string, { speed: number; run?: boolean; len: number; /** a stop at each end, side by side, to talk (seconds) */ pause?: number; /** on the street's pitch (whereabouts.pitch), end to end */ pitch?: boolean }> = {
  'balade-lagune': { speed: 1.2, len: 14 },
  hike: { speed: 1.4, len: 18 },
  // Round the zoo's paths, along the street: slowly, looking about.
  'zoo-visite': { speed: 1.0, len: 14, pause: 6 },
  'flaner-rue': { speed: 1.0, len: 20, pause: 5 },
  'stade-footing': { speed: 3.2, run: true, len: 26 },
  // A game with the quartier on the street's pitch or court: up and down it with the others.
  'street-foot': { speed: 3.4, run: true, len: 16, pitch: true },
  'street-basket': { speed: 3, run: true, len: 11, pitch: true },
  // Hanging out with a friend: a slow walk side by side, a stop to talk and laugh, and on again.
  'ami-trainer': { speed: 1.1, len: 16, pause: 9 },
}
const UP = new THREE.Vector3(0, 1, 0)
/** The moto-taxi ride's shots (metres ahead of the moto, to its right, up), each held this many seconds. */
const RIDE_SHOT = 6
const RIDE_SHOTS = [
  { ahead: -7, side: 0.6, up: 3.2 }, // behind, following
  { ahead: 0.5, side: 3.6, up: 1.6 }, // beside, riding along
  { ahead: 7, side: -1.2, up: 2.2 }, // ahead, looking back at the two of them
  { ahead: -6, side: -5, up: 13 }, // from above, the street round them
  { ahead: -3.2, side: -1.6, up: 0.8 }, // low by the back wheel
]
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
/** The poses the other players are sent (backend/internal/live/live.go: its own and the emotes'). */
const LIVE_POSES = new Set<string>(['idle', 'walk', 'run', 'busy', 'talk', 'sit', 'dance', 'wave', 'cheer', 'clap', 'shout', 'zouglou', 'gweta'])
/** Further than this from the place, busy there, the activity stops (the Sim left). */
const LEAVE = 40

/** How the Sim gets around: where it may stand, and the way to somewhere. */
export type WalkNav = {
  walkable: (x: number, z: number) => boolean
  /** The way from a to b (a place's door when `door`), or null if there is none. */
  route: (a: XZ, b: XZ, door: boolean) => XZ[] | null
  /** A vehicle's way from a to b: by the streets it can take (not the footpaths between the houses, nor the tracks over the plots). */
  drive?: (a: XZ, b: XZ) => XZ[] | null
  /** Keep the camera over the playable area. */
  bounds?: { x0: number; x1: number; z0: number; z1: number }
  /** Where the Sim starts when it isn't busy anywhere and has no home here. */
  start?: XZ
  /** How high the building at this spot goes (0 in the open): the close camera stays out of walls. */
  roofAt?: (x: number, z: number) => number
  /** The height of the ground (a bridge's deck), when it isn't flat. */
  heightAt?: (x: number, z: number) => number
  /** The nearest street to a point: where on it, which way it runs (radians, as the Sim faces), how wide: a drive starts there. */
  street?: (p: XZ) => { at: XZ; dir: number; width: number } | null
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
  /** Busy at a place, the Sim walked far from it: the activity stops there. */
  onLeave?: () => void
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
  /** Joined in what's happening in the street: its spot there (world frame), what it faces, its pose. */
  joinRole?: { at: XZ; face: XZ; pose: Pose; /** On the move with the scene (the wedding cortège): its place in it at a time, and the way it goes. */ move?: (t: number) => { at: XZ; heading: number } } | null
}

/** The player's Sim: walks to places, with the pad or by tapping the ground; the camera follows. */
export function Walker({ sim, stage, lots, nav, moodColor, goTo, onArrive, busy, stationAt, nameTag, labels, onNear, frozen, onLeave, recenter, onFreeCamera, perspective, close, shoulder, homeSpot, hidden, joinRole }: Props) {
  const group = useRef<THREE.Group>(null)
  // At work out in the street (the gare), a task done (gesture.ts): its gesture a moment.
  const gestureNow = useGesture()
  // Come out of a building: turned from its door to the street (it faced the building going in).
  const wasHidden = useRef(hidden)
  useEffect(() => {
    const g = group.current
    if (wasHidden.current && !hidden && g) {
      let best: Lot | null = null
      let near = 8
      for (const l of lots) {
        const d = Math.hypot(l.door[0] - g.position.x, l.door[1] - g.position.z)
        if (d < near) (near = d), (best = l)
      }
      // (From the building's middle out through its door; a door at its middle: the way the building faces.)
      if (best) g.rotation.y = Math.hypot(best.door[0] - best.x, best.door[1] - best.z) > 0.5 ? Math.atan2(best.door[0] - best.x, best.door[1] - best.z) : best.rot
    }
    wasHidden.current = hidden
  }, [hidden]) // eslint-disable-line react-hooks/exhaustive-deps
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
  // Running by itself, Courir or not: only the jog onto the street's pitch (going somewhere walks, unless the player runs).
  const autoRun = useRef(false)
  // Far away: on the back of a moto-taxi.
  const riding = useRef(false)
  /** The ride's camera: the player's angle kept for after, when the shots began, until when a touch holds them. */
  const rideCam = useRef<{ saved: THREE.Vector3 | null; since: number; pause: number }>({ saved: null, since: 0, pause: 0 })
  const [ride, setRide] = useState<Taken | null>(null)
  // One's own vehicle being driven (drive.ts), and the one set on the street (once, getting on).
  const own = useDriving()
  const setOff = useRef<ReturnType<typeof driving>>(null)
  // A trip booked (open/tripRide.tsx): waving the driver down at the kerb, then in the car, not drawn.
  const [hailing, setHailing] = useState(false)
  const [aboard, setAboard] = useState(false)
  /** How the Sim goes a way this long: walking, or running if the player runs (Courir, Shift); a long way, a moto-taxi is offered (it rides once paid, in the frame loop). */
  const setPace = (far: number) => {
    riding.current = false
    autoRun.current = false
    speed.current = running() ? RUN : SPEED
    setRide(null)
    offerMoto(far > RIDE_FROM ? Math.round(far) : null)
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
  // Joined in what's happening in the street: to its place in it (a chair, the crowd), not the busy arms.
  const joining = !!joinRole && busy?.id === 'join' && stationAt === 'happening'
  // Strolling (LOOPS): the way's start, its direction and length, and when it began.
  const loop = useRef<{ x: number; z: number; fx: number; fz: number; len: number; t0: number } | null>(null)
  const [looping, setLooping] = useState(false)
  // Laps of a stadium's track: the stadium (its middle, its turn), the way in or out by the tunnel and how far along it, the angle round the lane.
  const laps = useRef<{ at: XZ; rot: number; track: Track; way: XZ[]; d: number; th: number; out: boolean } | null>(null)
  // Up on a landmark's roof: the door to come back down to.
  const onRoof = useRef<{ door: XZ } | null>(null)
  // Stopped on the stroll, turned to the friend: talking.
  const [chatting, setChatting] = useState(false)
  const loopKind = busy?.id ? LOOPS[busy.id] : undefined
  // Walking onto the street's pitch before the game (once: blocked, it plays from where it got to).
  const pitchGoing = useRef(false)
  // At home on the furniture: walking to it, then settled on it.
  const homeGoing = useRef<HomeSpot | null>(null)
  const [settled, setSettled] = useState<HomeSpot | null>(null)
  // Getting onto the furniture takes a moment: from where the Sim stood, eased.
  const settling = useRef<{ x: number; z: number; rot: number; t: number } | null>(null)
  const [matchPose, setMatchPose] = useState<Pose>('idle')
  // The activity stopped once for walking away (a new one may stop again).
  const left = useRef(false)
  // Been at the place during this activity (walking there isn't leaving it).
  const reached = useRef(false)
  // Walked off with the pad during this activity: it's the player's way now, the Sim isn't
  // taken back to its spot (the furniture, the match, the crowd) when the pad lets go.
  const padAway = useRef(false)
  useEffect(() => {
    left.current = false
    reached.current = false
    padAway.current = false
    pitchGoing.current = false
    // Doing something else than the game on the street's pitch, than the street scene joined: their ground is no one's.
    // (Not while the request is out: busy has no id then, and the place was just chosen.)
    if (busy?.id && !LOOPS[busy.id]?.pitch) whereabouts.pitch = null
    if (busy?.id && busy.id !== whereabouts.joined?.activity) whereabouts.joined = null
  }, [busy?.id, stationAt])

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
    // Development only (tests): /jeu?at=x,z starts the Sim there, in the street's metres.
    const dev = import.meta.env.DEV ? new URLSearchParams(location.search).get('at')?.split(',').map(Number) : undefined
    const [x, z] = dev?.length === 2 ? (dev as XZ) : (at?.door ?? nav.start ?? [0, SIDEWALK])
    group.current!.position.set(x, 0, z)
    // The camera starts right over the Sim, out in the street, looking at it
    // with the place behind (never from inside the house).
    if (controls) {
      const off = camera.position.clone().sub(controls.target)
      // Development only (tests): &face=x,z turns the camera to look at that point over the Sim.
      const face = import.meta.env.DEV ? new URLSearchParams(location.search).get('face')?.split(',').map(Number) : undefined
      const out = face?.length === 2 ? new THREE.Vector2(x - face[0], z - face[1]) : at ? new THREE.Vector2(x - at.x, z - at.z) : new THREE.Vector2()
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
    // No way through (too far, the map not loaded there yet): toward it on foot, the map loading
    // on the way, a new way found round each wall met (never through it); a moto-taxi is offered
    // (it used to be a free jump there).
    path.current = way ? way.slice(1) : [lot.door]
    setPace(pathLength(path.current, [p.x, p.z]))
    target.current = lot.id
    setRoute([...path.current])
    setFree(false)
    setWalking(true)
  }, [goTo, lots]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Tap the ground: the Sim walks there, the shortest way round what's in the way. */
  const walkToPoint = (x: number, z: number, sure = false) => {
    if (frozen || tripRide.boarded || driving() || !nav.walkable(x, z)) return
    // On the way to a place: asked first (dropRoute.ts); the answer comes back in the frame loop.
    const going = target.current !== null && path.current.length > 0 ? lots.find((l) => l.id === target.current) : undefined
    if (going && !sure) return askDrop({ x, z, from: going.name, moto: riding.current })
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
  const R = 0.35
  const D = R * Math.SQRT1_2
  // The body's round edge, the diagonals too (a building's corner pokes in there).
  const clear = (x: number, z: number) =>
    nav.walkable(x, z) && nav.walkable(x + R, z) && nav.walkable(x - R, z) && nav.walkable(x, z + R) && nav.walkable(x, z - R) && nav.walkable(x + D, z + D) && nav.walkable(x - D, z + D) && nav.walkable(x + D, z - D) && nav.walkable(x - D, z - D)
  const roomAt = (x: number, z: number) => clear(x, z) && !blocked(x, z, R)
  whereabouts.roomAt = roomAt
  /** Room for the body, the cars aside (they'll have moved on): for planning a way. */
  const roomFixed = (x: number, z: number) => clear(x, z) && !blockedFixed(x, z, R)
  // In development, for tests in the browser: is there room here, the cars aside?
  if (import.meta.env.DEV) Object.assign(globalThis, { __roomFixed: roomFixed, __route: nav.route, __findWay: (a: XZ, b: XZ) => findWay(a, b, true), __path: () => path.current, __walkTo: walkToPoint })
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
    // No way by the streets (they don't join, or aren't loaded all the way): across the open ground, round everything.
    if (!way || way.length < 3) return wide(a, b)
    const n = way.length
    const first = round(a, way[1])
    const last = round(way[n - 2], b)
    // Never a straight line through a wall: no way round from the street, then across the open ground.
    if (!first || !last) return wide(a, b)
    return [...first, ...way.slice(2, n - 2), ...last]
  }
  /**
   * The moto-taxi's way: by the streets, the shortest, whatever the distance (findWay walks a short
   * way straight across, and goes across the open ground when the streets fail it: on a moto, that
   * was a zigzag over the blocks, stopping at each wall). Null while the streets there aren't loaded.
   */
  const rideWay = (a: XZ, b: XZ, door: boolean): XZ[] | null => {
    // By the streets a vehicle takes; where there are none to there, by any street (never across the plots).
    const way = nav.drive?.(a, b) ?? nav.route(a, b, door)
    if (!way || way.length < 3) return null
    const n = way.length
    // To the street and from it at the end: round what's in the way, else (a door down a lane) by the
    // lane, else straight (it's short). Never through the houses.
    const first = round(a, way[1]) ?? nav.route(a, way[1], false) ?? [a, way[1]]
    const last = round(way[n - 2], b) ?? nav.route(way[n - 2], b, door) ?? [way[n - 2], b]
    return [...first, ...way.slice(2, n - 2), ...last]
  }
  /** The ride is on a way by the streets (else it asks again as the map loads). */
  const onStreets = useRef(false)
  const askedWay = useRef(0)
  /** Round whatever's between two points: on the fine grid, else on a coarser one that looks further round. */
  const round = (p: XZ, q: XZ) => gridWay(p, q, roomFixed) ?? gridWay(p, q, roomFixed, 1.5, 60)
  /** Across the open ground on a coarse grid (two-metre cells), round the buildings and what stands in the streets. */
  const wide = (a: XZ, b: XZ) => gridWay(a, b, roomFixed, 2, 60, 700 * 700)
  /**
   * Something on the way ahead (a stall, a table, a car stuck in a jam, a
   * building's corner: what the streets' graph doesn't know, or a way laid
   * straight before the map was loaded there): from here round it to the
   * first free point past it on the way, then on along the way. Null if
   * there's none close.
   */
  const detour = (from: XZ, way: XZ[]): XZ[] | null => {
    let [px, pz] = from
    let wasBlocked = false
    let walked = 0
    for (let i = 0; i < way.length && walked < 20; i++) {
      const [tx, tz] = way[i]
      const len = Math.hypot(tx - px, tz - pz)
      for (let d = 0.5; d <= len; d += 0.5) {
        const [x, z] = [px + ((tx - px) * d) / len, pz + ((tz - pz) * d) / len]
        if (!roomFixed(x, z)) wasBlocked = true
        else if (wasBlocked) {
          const round = gridWay(from, [x, z], roomFixed, 0.5, 6)
          return round ? [...round.slice(1), ...way.slice(i)] : null
        }
      }
      walked += len
      ;[px, pz] = [tx, tz]
    }
    return null
  }
  const noDetour = useRef(0)
  const walledFor = useRef(0)
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
    // Driving one's own vehicle (drive.ts): the pedals and the wheel (or the keys, the pad) drive it,
    // the way it faces; into a wall, a stall, the water or a car, it bumps back.
    const dv = driving()
    if (dv && setOff.current !== dv) {
      // Getting on: the vehicle on the nearest street, along it the way the Sim faced, on its right-hand side.
      setOff.current = dv
      const st = nav.street?.([g.position.x, g.position.z])
      if (st && Math.hypot(st.at[0] - g.position.x, st.at[1] - g.position.z) < 80) {
        const h = Math.cos(st.dir - g.rotation.y) >= 0 ? st.dir : st.dir + Math.PI
        const side = Math.max(0, Math.min(st.width / 4, st.width / 2 - 1.2))
        g.position.x = st.at[0] - Math.cos(h) * side
        g.position.z = st.at[1] + Math.sin(h) * side
        g.rotation.y = h
      }
    }
    if (!dv) setOff.current = null
    if (dv) {
      if (path.current.length) {
        path.current = []
        setRoute(null)
        setWalking(false)
      }
      const hd = HANDLING[dv.kind]
      const keys = moveInput()
      const throttle = drive.throttle || keys.y
      const wheel = drive.steer || keys.x
      // In short steps (a slow phone's long frame would jump through a wall), the real time all the same.
      const total = Math.min(dt, 0.25)
      const n = Math.ceil(total / 0.04)
      const step = total / n
      let v = drive.speed
      for (let k = 0; k < n; k++) {
        if (throttle > 0.05) {
          const want = dv.top * throttle
          v = v < 0 ? Math.min(0, v + hd.brake * step) : v < want ? Math.min(want, v + hd.accel * step) : Math.max(want, v - 1.5 * step)
        } else if (throttle < -0.05) v = v > 0 ? Math.max(0, v - hd.brake * step) : Math.max(-hd.reverse, v - 2 * step)
        else v -= Math.sign(v) * Math.min(Math.abs(v), 1.4 * step)
        // It turns as it goes (not standing still), the other way backing up.
        const h = g.rotation.y - wheel * hd.turn * step * Math.min(1, Math.abs(v) / 4) * Math.sign(v)
        const [fx, fz] = [Math.sin(h), Math.cos(h)]
        const [nx, nz] = [g.position.x + fx * v * step, g.position.z + fz * v * step]
        // Room for the nose (the tail, backing) and its two corners there?
        const nose = Math.sign(v) * hd.half
        const roomFor = (x: number, z: number) => nav.walkable(x, z) && !blockedFixed(x, z, 0.2)
        const hit = v !== 0 && ![0, -1, 1].every((c) => roomFor(nx + fx * nose + fz * hd.width * c, nz + fz * nose - fx * hd.width * c))
        const car = v !== 0 && vehicleAt(nx + fx * nose, nz + fz * nose, hd.width)
        // (Caught inside something, it may drive out.)
        if ((hit || car) && roomFor(g.position.x, g.position.z)) {
          drive.bumped = performance.now()
          v = -v * 0.25
        } else {
          g.position.x = nx
          g.position.z = nz
          drive.metres += Math.abs(v) * step
        }
        g.rotation.y = h
      }
      drive.speed = v
      // The street's traffic waits behind it, as behind any car (open/trafficFlow.tsx).
      report('me', { x: g.position.x, z: g.position.z, h: g.rotation.y, half: hd.half })
    } else report('me', null)
    // The pad (or the keyboard) walks the Sim freely, relative to the camera.
    const input = moveInput()
    const strength = Math.min(1, Math.hypot(input.x, input.y))
    // In the car on a trip, the pad has nothing to walk; driving, it drives.
    if (!frozen && strength > 0.05 && !tripRide.boarded && !dv) {
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
      // The whole step looked at, not just where it lands (a slow phone's step can be over a post).
      const stepOk = (px: number, pz: number) => roomAt(px, pz) && clearLine([g.position.x, g.position.z], [px, pz], roomAt, 0.4)
      if (stepOk(x, z) || !roomAt(g.position.x, g.position.z)) g.position.set(x, 0, z)
      else if (stepOk(x, g.position.z)) g.position.x = x
      else if (stepOk(g.position.x, z)) g.position.z = z
      else {
        // Straight into a post or a trunk: step round it, a little to one side.
        for (const a of [0.5, -0.5, 1, -1]) {
          const [c, s] = [Math.cos(a), Math.sin(a)]
          const [sx, sz] = [g.position.x + (dir.x * c - dir.z * s) * step, g.position.z + (dir.x * s + dir.z * c) * step]
          if (stepOk(sx, sz)) {
            g.position.set(sx, 0, sz)
            break
          }
        }
      }
      g.rotation.y = Math.atan2(dir.x, dir.z)
      if (busy) padAway.current = true
      if (!padWalking.current) {
        padWalking.current = true
        setWalking(true)
      }
    } else if (padWalking.current) {
      padWalking.current = false
      setWalking(false)
    }
    // At home, the action done on its piece of furniture: walk up to it, then onto it.
    if (homeSpot && !padWalking.current && !padAway.current) {
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
    // Busy at a place and walked far from it (the pad, a tap): what was being done there stops,
    // once. Near it, the Sim does it where it stands.
    // (Only once it has been there: on its way to it, it isn't leaving.)
    const station = busy && stationAt ? lots.find((l) => l.id === stationAt) : undefined
    // Up on a landmark's roof (open/rooftops.ts): the city all round; the Sim can walk about on it.
    const roof = station ? rooftopFor(station.id, busy?.id) : undefined
    if (roof && station) {
      const [cs, sn] = [Math.cos(station.rot), Math.sin(station.rot)]
      if (!onRoof.current) {
        onRoof.current = { door: station.door }
        path.current = []
        setRoute(null)
        setWalking(false)
        const [x, z] = toWorld([station.x, station.z], station.rot, roof.spot)
        g.position.set(x, roof.y, z)
        // Looking out over the city, the way the landmark faces; the camera behind it, low, to see
        // the city stretch away (the player turns it round from there).
        g.rotation.y = station.rot
        if (controls) {
          // (Askew: straight behind, the mast in the roof's middle stands between.)
          const back = station.rot + Math.PI + 0.7
          controls.target.set(x, roof.y + 1.4, z)
          camera.position.set(x + Math.sin(back) * 11, roof.y + 6, z + Math.cos(back) * 11)
          controls.update()
        }
      }
      // On it, never off its edge.
      const [dx, dz] = [g.position.x - station.x, g.position.z - station.z]
      const lx = THREE.MathUtils.clamp(dx * cs - dz * sn, -roof.half, roof.half)
      const lz = THREE.MathUtils.clamp(dx * sn + dz * cs, -roof.half, roof.half)
      ;[g.position.x, g.position.z] = toWorld([station.x, station.z], station.rot, [lx, lz])
    } else if (onRoof.current) {
      // Done: down the lift, out at the door.
      g.position.set(onRoof.current.door[0], 0, onRoof.current.door[1])
      onRoof.current = null
    }
    // (Round a stadium's track, the far side is well away from its door; on a roof, the middle may be; with
    // the cortège, the end of the street.)
    const away = station && !laps.current && !roof && !(joining && joinRole?.move) ? Math.hypot(g.position.x - station.door[0], g.position.z - station.door[1]) : 0
    if (station && away < 15) reached.current = true
    if (station && onLeave && reached.current && !left.current && away > LEAVE) {
      left.current = true
      onLeave()
    }
    // Laps of a stadium's track (open/stadiumTrack.ts): from its door in by the tunnel under the
    // stands, round and round the pitch, and once done across to the tunnel and out to the street.
    const track = busy?.id === 'stade-footing' && station ? STADIUM_TRACKS[station.id] : undefined
    if (track && station && !laps.current && !path.current.length && !padWalking.current && !padAway.current && Math.hypot(g.position.x - station.door[0], g.position.z - station.door[1]) < 15) {
      const at: XZ = [station.x, station.z]
      const w = (p: XZ) => toWorld(at, station.rot, p)
      const th = laneStart(track)
      laps.current = { at, rot: station.rot, track, way: [[g.position.x, g.position.z], w([track.tunnel, track.out]), w([track.tunnel, track.in]), w(lanePoint(track, th))], d: 0, th, out: false }
    }
    const lap = laps.current
    if (lap && (padWalking.current || padAway.current)) {
      // Off the track with the pad: the player's way now (from inside the stands, a step may go out through them).
      laps.current = null
      setLooping(false)
    } else if (lap) {
      const w = (p: XZ) => toWorld(lap.at, lap.rot, p)
      if (!lap.out && !track) {
        lap.way = [[g.position.x, g.position.z], w(lanePoint(lap.track, laneStart(lap.track))), w([lap.track.tunnel, lap.track.in]), w([lap.track.tunnel, lap.track.out])]
        lap.d = 0
        lap.out = true
      }
      // (Out, done: at a walk.)
      const speed = lap.out ? SPEED : LOOPS['stade-footing'].speed
      const step = speed * Math.min(dt, 0.25)
      const len = routeLength(lap.way)
      lap.d += step
      if (lap.d < len || lap.out) {
        // In or out by the tunnel.
        const p = along(lap.way, Math.min(lap.d, len))
        g.position.set(p.x, 0, p.z)
        g.rotation.y = turnTo(g.rotation.y, p.r, 1 - Math.exp(-8 * dt))
        if (lap.out && lap.d >= len) {
          laps.current = null
          setLooping(false)
        }
      } else {
        // Round the lane.
        lap.th += step / laneStretch(lap.track, lap.th)
        const [x, z] = w(lanePoint(lap.track, lap.th))
        const [ax, az] = w(lanePoint(lap.track, lap.th + 0.02))
        g.position.set(x, 0, z)
        g.rotation.y = turnTo(g.rotation.y, Math.atan2(ax - x, az - z), 1 - Math.exp(-8 * dt))
      }
      if (laps.current && !looping) setLooping(true)
    }
    // Strolling: along the way and back, again and again, as far as there's room.
    if (loopKind && !track && !laps.current && !path.current.length && !padWalking.current && !padAway.current) {
      const [x, z] = [g.position.x, g.position.z]
      const pitch = loopKind.pitch && whereabouts.pitch && Math.hypot(whereabouts.pitch.at[0] - x, whereabouts.pitch.at[1] - z) < 60 ? whereabouts.pitch : null
      if (!loop.current && pitch) {
        // On the street's pitch: in by its gate to one end, then end to end along it.
        const start: XZ = [pitch.at[0] - pitch.dir[0] * pitch.half, pitch.at[1] - pitch.dir[1] * pitch.half]
        const off = Math.hypot(start[0] - x, start[1] - z)
        if (!pitchGoing.current && off > 1) {
          pitchGoing.current = true
          const way = findWay([x, z], start, false)
          path.current = way ? way.slice(1) : [start]
          target.current = null
          speed.current = RUN
          autoRun.current = true
          setRoute([...path.current])
          setWalking(true)
        } else loop.current = { x, z, fx: pitch.dir[0], fz: pitch.dir[1], len: Math.max(2, pitch.half * 2 - (off > 1 ? 0 : off)), t0: worldTime() }
      } else if (!loop.current) {
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
      if (l && l.len >= 2) {
        // Out, a stop, back, a stop (no stop: on and on).
        const walkT = l.len / loopKind.speed
        const P = loopKind.pause ?? 0
        const t = (worldTime() - l.t0) % (2 * (walkT + P))
        const back = t >= walkT + P
        const still = (t >= walkT && t < walkT + P) || t >= 2 * walkT + P
        const d = !back ? Math.min(l.len, t * loopKind.speed) : Math.max(0, l.len - (t - walkT - P) * loopKind.speed)
        g.position.set(l.x + l.fx * d, 0, l.z + l.fz * d)
        g.rotation.y = Math.atan2(back ? -l.fx : l.fx, back ? -l.fz : l.fz)
        if (looping === still) setLooping(!still)
        if (chatting !== still) setChatting(still)
      }
    } else if (loop.current) {
      loop.current = null
      setLooping(false)
      setChatting(false)
    }
    // In the match: where the Sim's place in it is, now.
    if (inMatch && fieldLot?.field && !path.current.length && !padWalking.current && !padAway.current) {
      const f = fieldLot.field
      const m = matchFor(fieldLot.id, f)
      const s = m.player(0, SIM_SLOT[f.sport], worldTime())
      const [x, z] = onField(f, s.u, s.v)
      g.position.set(x, 0, z)
      g.rotation.y = worldFacing(f, s.face)
      if (s.pose !== matchPose) setMatchPose(s.pose)
    } else if (onTouchline && fieldLot?.field && !path.current.length && !padWalking.current && !padAway.current) {
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
    } else if (joining && joinRole!.move && !path.current.length && !padWalking.current && !padAway.current) {
      // Dancing with the cortège: its place in the family's ranks, as it goes up the street and back.
      // Behind (just joined, or it turned): a run to catch it up.
      const m = joinRole!.move(worldTime())
      const [dx, dz] = [m.at[0] - g.position.x, m.at[1] - g.position.z]
      const d = Math.hypot(dx, dz)
      let pose: Pose = joinRole!.pose
      if (d > 1) {
        const step = Math.min(d, RUN * Math.min(dt, 0.25))
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
        g.rotation.y = Math.atan2(dx, dz)
        pose = 'run'
      } else {
        g.position.x = m.at[0]
        g.position.z = m.at[1]
        g.rotation.y = turnTo(g.rotation.y, m.heading, 1 - Math.exp(-6 * Math.min(dt, 0.25)))
      }
      if (pose !== matchPose) setMatchPose(pose)
    } else if (joining && !path.current.length && !padWalking.current && !padAway.current) {
      const [x, z] = joinRole!.at
      const [dx, dz] = [x - g.position.x, z - g.position.z]
      const d = Math.hypot(dx, dz)
      let pose: Pose = joinRole!.pose
      if (d > 12) pose = 'idle'
      else if (d > 0.05) {
        const step = Math.min(d, SPEED * Math.min(dt, 0.25))
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
        g.rotation.y = Math.atan2(dx, dz)
        pose = 'walk'
      } else g.rotation.y = Math.atan2(joinRole!.face[0] - x, joinRole!.face[1] - z)
      if (pose !== matchPose) setMatchPose(pose)
    }
    // Talking with someone: face them.
    const face = whereabouts.faceTo
    if (face && !path.current.length && !padWalking.current && Math.hypot(face[0] - g.position.x, face[1] - g.position.z) > 0.3) {
      const want = Math.atan2(face[0] - g.position.x, face[1] - g.position.z)
      const d = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y))
      g.rotation.y += d * Math.min(1, dt * 8)
    }
    // A trip booked: to the kerb where the driver pulls up, waving as it comes; then in it, the
    // camera following the car through the streets (TripRide drives it) until the trip's end.
    const trip = tripRide.active && !path.current.length && !padWalking.current
    if (trip && tripRide.boarded) {
      g.position.x = tripRide.x
      g.position.z = tripRide.z
      g.rotation.y = tripRide.heading
    } else if (trip) {
      const [x, z] = tripRide.meet
      const [dx, dz] = [x - g.position.x, z - g.position.z]
      const d = Math.hypot(dx, dz)
      // Far from the kerb (it's the Sim's own street, so never really): it waits where it stands.
      if (d > 0.05 && d < 40) {
        const step = Math.min(d, SPEED * Math.min(dt, 0.25))
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
        g.rotation.y = Math.atan2(dx, dz)
      } else g.rotation.y = turnTo(g.rotation.y, Math.atan2(tripRide.x - g.position.x, tripRide.z - g.position.z), 1 - Math.exp(-4 * Math.min(dt, 0.25)))
      const walkingThere = d > 0.05 && d < 40
      if (walkingThere !== walking && !padWalking.current) setWalking(walkingThere)
    }
    if (trip && tripRide.boarded) {
      if (!aboard) setAboard(true)
    } else if (aboard) setAboard(false)
    // The car in sight: an arm up to it.
    const hail = trip && !tripRide.boarded && Math.hypot(tripRide.x - g.position.x, tripRide.z - g.position.z) < 45
    if (hail !== hailing) setHailing(hail)
    // Standing at a door: offer to go in.
    if (onNear) {
      let best: Lot | null = null
      let bestD = NEAR_DOOR
      for (const l of lots) {
        const d = Math.hypot(l.door[0] - g.position.x, l.door[1] - g.position.z)
        if (d < bestD) [best, bestD] = [l, d]
      }
      const id = path.current.length || tripRide.boarded ? null : (best?.id ?? null)
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
        // A wall or something standing right ahead: never through it. Round it, else a new way from
        // here; no way yet (the map still loading there), wait and ask again in a moment. Only the
        // last step onto a door, which is on its wall, may brush it. (Caught inside something: it may step out.)
        const cur: XZ = [g.position.x, g.position.z]
        const atDoor = path.current.length === 1 && dist < 1.2
        // On the moto, by the streets: it weaves through the traffic and round what's parked, it
        // never stops for it (stopping, it looked for a way round across the blocks, and got stuck).
        const weaving = riding.current && onStreets.current
        // The whole step looked at, not just where it lands (a slow phone's step can be over a post).
        const walled = !atDoor && !weaving && roomFixed(cur[0], cur[1]) && !(roomFixed(nx, nz) && clearLine(cur, [nx, nz], roomFixed, 0.4))
        if (walled && performance.now() > noDetour.current) {
          const end = path.current[path.current.length - 1]
          // Round it close by; else across the open ground (a map building may sit on the street
          // itself, the streets' way would meet it again); else by the streets.
          const other = detour(cur, path.current) ?? (Math.hypot(end[0] - cur[0], end[1] - cur[1]) < 600 ? wide(cur, end) : null)?.slice(1) ?? findWay(cur, end, target.current !== null)?.slice(1) ?? null
          if (other?.length) {
            path.current = other
            setRoute([...path.current])
          } else noDetour.current = performance.now() + 1500
        }
        walledFor.current = walled ? walledFor.current + dt : 0
        if (walled && walledFor.current > 8) {
          // Still no way round: the walk is given up where the Sim stands.
          walledFor.current = 0
          path.current = []
          setRoute(null)
          setWalking(false)
        } else if (walled) {
          // Waiting for a way round.
        } else if (!weaving && vehicleAt(nx, nz) && !vehicleAt(g.position.x, g.position.z)) {
          // A car in the way: wait for it to pass; still there after a while, find another way round it.
          waited.current += dt
          if (waited.current > 2.5) {
            waited.current = 0
            const end = path.current[path.current.length - 1]
            const other = gridWay([g.position.x, g.position.z], end, roomAt)
            if (other) {
              path.current = other.slice(1)
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
    // The moto-taxi paid for: on the back for the rest of the way; there, off it.
    const taken = motoTaken()
    if (!riding.current && path.current.length && taken) {
      riding.current = true
      speed.current = RIDES[taken.kind].speed
      setRide(taken)
      onStreets.current = false
      askedWay.current = 0
    }
    // On the moto, the way by the streets from here (the walk's way may be a straight line, the map
    // not loaded there when it began): asked again every few seconds until the streets join up.
    if (riding.current && !onStreets.current && path.current.length && performance.now() > askedWay.current) {
      askedWay.current = performance.now() + 2000
      const way = rideWay([g.position.x, g.position.z], path.current[path.current.length - 1], target.current !== null)
      if (way && way.length > 1) {
        path.current = way.slice(1)
        onStreets.current = true
        setRoute([...path.current])
      }
    }
    if (riding.current && !path.current.length) {
      riding.current = false
      setRide(null)
    }
    // There (or the way given up): no more moto-taxi to offer, nor a question about dropping the way.
    if (!path.current.length) {
      offerMoto(null)
      answerDrop(false)
    }
    // The player said to drop the way for a spot tapped on the ground.
    const drop = takeDrop()
    if (drop) walkToPoint(drop.x, drop.z, true)
    const nowRunning = !riding.current && ((padWalking.current && running()) || (path.current.length > 0 && (autoRun.current || running())))
    // Courir on or off on the way: the pace follows (a jog onto the pitch runs by itself).
    if (path.current.length && !riding.current) speed.current = autoRun.current || running() ? RUN : SPEED
    if (nowRunning !== run) setRun(nowRunning)
    // For the mini-map: where the Sim is, which way the camera looks.
    whereabouts.sim = [g.position.x, g.position.z]
    // For the screen: how much of the way is left, and how fast it goes (Play's WayLeft).
    whereabouts.way = path.current.length
      ? { to: lots.find((l) => l.id === target.current)?.name ?? null, left: pathLength(path.current, [g.position.x, g.position.z]), speed: speed.current, how: riding.current ? (motoTaken()?.kind ?? 'moto') : nowRunning ? 'run' : 'walk' }
      : null
    if (controls) {
      const dx = controls.target.x - camera.position.x
      const dy = camera.position.y - controls.target.y
      const dz = controls.target.z - camera.position.z
      whereabouts.heading = Math.atan2(dx, -dz)
      whereabouts.polar = Math.acos(THREE.MathUtils.clamp(dy / (Math.hypot(dx, dy, dz) || 1), -1, 1))
    }
    // Up and down bridges; up on a roof.
    if (onRoof.current && roof) g.position.y = roof.y
    else if (nav.heightAt) g.position.y = nav.heightAt(g.position.x, g.position.z)
    // What the other players see of this Sim.
    whereabouts.simY = g.position.y
    whereabouts.simHeading = g.rotation.y
    whereabouts.simPose = joining && LIVE_POSES.has(matchPose) ? matchPose : busy ? (busy.kind === 'chat' ? 'talk' : 'busy') : walking || looping ? (run ? 'run' : 'walk') : (emote ?? 'idle')
    // Camera follows the Sim, keeping whatever angle the player chose.
    if (controls && !free.current && !gesture.current) {
      const want = new THREE.Vector3(g.position.x, lookHeight + (onRoof.current ? g.position.y : 0), g.position.z)
      // Smooth, and as quick on a slow phone as on a fast computer.
      const delta = want.sub(controls.target).multiplyScalar(1 - Math.exp(-5 * Math.min(dt, 0.25)))
      controls.target.add(delta)
      camera.position.add(delta)
      // Driving: the camera comes round behind and a little above, looking the way it goes.
      if (dv) {
        const [back, up] = dv.kind === 'voiture' ? [9.5, 4.4] : [6.5, 3.2]
        const behind = new THREE.Vector3(g.position.x - Math.sin(g.rotation.y) * back, g.position.y + lookHeight + up, g.position.z - Math.cos(g.rotation.y) * back)
        camera.position.lerp(behind, 1 - Math.exp(-2.5 * Math.min(dt, 0.25)))
      }
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
    // On the moto-taxi, the camera films the ride: a new shot every few
    // seconds (behind, beside, ahead looking back, from above, low by the
    // wheel), gliding from one to the next; a touch on the view hands it back
    // for a while. The player's own angle comes back at the end of the ride.
    const shooting = riding.current && !!controls && !free.current
    if (controls && (shooting || rideCam.current.saved)) {
      const now = performance.now() / 1000
      const rc = rideCam.current
      if (shooting && !rc.saved) Object.assign(rc, { saved: camera.position.clone().sub(controls.target), since: now, pause: 0 })
      if (gesture.current) rc.pause = now + 6
      if (!shooting && rc.saved) {
        // Off the moto: back to the angle the player had.
        camera.position.copy(controls.target).add(rc.saved)
        rc.saved = null
        controls.update()
      } else if (now > rc.pause) {
        const shot = RIDE_SHOTS[Math.floor((now - rc.since) / RIDE_SHOT) % RIDE_SHOTS.length]
        const h = g.rotation.y
        const [fx, fz] = [Math.sin(h), Math.cos(h)]
        const want = new THREE.Vector3(g.position.x + fx * shot.ahead + fz * shot.side, g.position.y + shot.up, g.position.z + fz * shot.ahead - fx * shot.side)
        camera.position.lerp(want, 1 - Math.exp(-2.2 * Math.min(dt, 0.25)))
        controls.update()
      }
    }
    // Close behind the Sim, the camera never goes through a wall: it comes in
    // front of the building in the way, and goes back out once past it.
    if (close && controls && nav.roofAt && !gesture.current && !shooting) {
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
        // A wall right behind (the Sim at a door): look from the street side instead. Not while
        // the pad steers: its « forward » is the camera's, so a flip sends the Sim back the way it
        // came, the camera flips again at the wall, and round and round.
        if (free < 3.2 && !padWalking.current) {
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
    // Round a stadium's track: the camera over the pitch, looking out at the Sim (from outside, the
    // stands and the roof are in the way); no further than the pitch.
    const lapNow = laps.current
    if (lapNow && controls && !gesture.current && !shooting) {
      const t = controls.target
      const off = camera.position.clone().sub(t)
      const now = Math.atan2(off.x, off.z)
      const want = Math.atan2(lapNow.at[0] - t.x, lapNow.at[1] - t.z)
      const a = now + Math.atan2(Math.sin(want - now), Math.cos(want - now)) * (1 - Math.exp(-2 * Math.min(dt, 0.25)))
      const r = Math.min(Math.hypot(off.x, off.z), 24)
      camera.position.set(t.x + Math.sin(a) * r, t.y + Math.min(off.y, 18), t.z + Math.cos(a) * r)
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
      <group ref={group} visible={!hidden && !aboard}>
        {own ? (
          // One's own vehicle (drive.ts), its nose (+x) the way the Sim faces; in a car, the Sim is inside.
          own.kind === 'voiture' ? (
            <group rotation={[0, -Math.PI / 2, 0]}>
              <Vehicle p={[0, 0, 0]} kind="car" model={own.body as CarModel} color={own.color} seed={own.body === 'limo' ? (own.color === '#f4f4f2' ? 0 : 1) : own.id} />
            </group>
          ) : (
            <>
              <group rotation={[0, -Math.PI / 2, 0]}>{own.kind === 'moto' ? <Vehicle p={[0, 0, 0]} kind="moto" color={own.color} crew={false} /> : <Bicycle color={own.color} />}</group>
              <group position={[0, own.kind === 'moto' ? 0.42 : 0.5, own.kind === 'moto' ? -0.25 : -0.22]}>
                <Character look={sim.look} gender={sim.gender} walking={false} running={false} busy={false} pose="sit" moodColor={moodColor} stage={stage} />
              </group>
            </>
          )
        ) : ride?.kind === 'moto' ? (
          // On the moto-taxi, behind the driver (the moto's front is its +x: turned to face the way).
          <>
            <group position={[0, 0, 0.45]} rotation={[0, -Math.PI / 2, 0]}>
              <Vehicle p={[0, 0, 0]} kind="moto" color={ride.color} />
            </group>
            <group position={[0, 0.42, -0.15]}>
              <Character look={sim.look} gender={sim.gender} walking={false} running={false} busy={false} pose="sit" moodColor={moodColor} stage={stage} />
            </group>
          </>
        ) : ride ? (
          // In the taxi, the woro-woro, the gbaka: on a back seat by the window, the driver in front.
          <>
            <group position={ride.kind === 'gbaka' ? [0.45, 0, 1] : [0.35, 0, 0.6]} rotation={[0, -Math.PI / 2, 0]}>
              <Vehicle p={[0, 0, 0]} kind={ride.kind} color={ride.color} trim={ride.trim} crew />
            </group>
            <group position={[0, ride.kind === 'gbaka' ? 0.55 : 0.32, 0]}>
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
          // Stopped on a stroll with a friend: turned to them, talking. (On the move it walks, busy or not:
          // a ride being paid for, the place of the action still ahead; frozen, it glided along.)
          <group rotation={[0, chatting && !walking ? 0.9 : 0, 0]}>
            <Character look={busy?.id === 'work' ? workLook(sim.look, sim.career, sim.careerLevel) : outdoorLook(sim.look, busy?.id)} gender={sim.gender} walking={walking || looping} running={run || (looping && !!loopKind?.run)} busy={!!busy && !walking && !looping && !chatting} marker={!photoMode} pose={hailing && !walking ? 'wave' : photoMode && photoMode !== 'film' && !busy && !walking ? 'phone' : emote && !busy && !walking ? emote : busy?.kind === 'chat' || (chatting && !walking) ? 'talk' : (inMatch || onTouchline || joining) && !walking ? matchPose : busy?.id === 'work' && gestureNow && !walking ? gestureNow : outdoorPose(busy?.id)} moodColor={moodColor} stage={stage} speed={looping && loopKind ? loopKind.speed : run ? RUN : SPEED} />
          </group>
        )}
        {/* Hanging out: the friend walks along beside the Sim */}
        {busy?.id === 'ami-trainer' && <Buddy sim={sim} walking={looping || walking} facing={chatting && !walking} stage={stage} />}
        {/* Out with friends (an outing): they came along, at the Sim's side */}
        {!!sim.activity?.with?.length && <Companions sim={sim} walking={walking || looping} pose={outdoorPose(busy?.id)} stage={stage} />}
        {/* Outdoors, what the Sim is doing is set around it (the ball, the towel, the bus stop…) */}
        {busy && !walking && !onTouchline && <OutdoorAction id={busy.id} />}
        {labels && nameTag && !hidden && !aboard && (
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

/** Where the friends of an outing stand round the Sim: either side, then behind. */
const ALONG: [number, number, number][] = [[0.85, 0, 0.1], [-0.85, 0, 0.1], [0.5, 0, -0.9], [-0.5, 0, -0.9]]

/** The friends out with the Sim (sims/outing.go), with the face they had when met, walking along and doing as it does. */
function Companions({ sim, walking, pose, stage }: { sim: Sim; walking: boolean; pose?: Pose; stage: string }) {
  const along = (sim.activity?.with ?? []).map((id) => sim.friends?.find((f) => f.id === id)).filter((f): f is Friend => !!f)
  const ids = along.map((f) => f.id).join()
  const looks = useMemo(() => along.map((f) => f.look ?? randomLook(f.gender, rng(`partner${f.id}`))), [ids]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {along.slice(0, ALONG.length).map((f, i) => (
        <group key={f.id} position={ALONG[i]}>
          <Character look={looks[i]} gender={f.gender} walking={walking} pose={walking ? undefined : (pose ?? 'talk')} marker={false} moodColor="#3b82f6" stage={stage} speed={1.1} />
        </group>
      ))}
    </>
  )
}

/** The friend one hangs out with (« Traîner ensemble »), walking at the Sim's side. */
function Buddy({ sim, walking, facing, stage }: { sim: Sim; walking: boolean; /** Stopped to talk: turned to the Sim, talking, laughing now and then. */ facing: boolean; stage: string }) {
  const name = sim.activity?.kind === 'do' ? sim.activity.placeName : undefined
  const friend = sim.friends?.find((f) => f.name === name)
  const gender = friend?.gender ?? (sim.gender === 'femme' ? 'femme' : 'homme')
  // The face they had when met, if the game knows it (world3d/talk.ts); else one of their own.
  const look = useMemo(() => friend?.look ?? randomLook(gender, rng(`partner${friend?.id ?? name ?? 'ami'}`)), [gender, friend?.id, friend?.look, name])
  // A laugh every so often while they talk (the shared clock: the same for everyone watching).
  const [laugh, setLaugh] = useState(false)
  useFrame(() => {
    const now = facing && worldTime() % 7 > 4.6
    if (now !== laugh) setLaugh(now)
  })
  return (
    <group position={[0.85, 0, 0.1]} rotation={[0, facing ? -0.9 : 0, 0]}>
      <Character look={look} gender={gender} walking={walking} pose={walking ? undefined : laugh ? 'laugh' : 'talk'} marker={false} moodColor="#3b82f6" stage={stage} speed={1.1} />
    </group>
  )
}
