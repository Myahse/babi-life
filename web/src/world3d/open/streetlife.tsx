import { useEffect, useMemo, useRef, useState } from 'react'
import { Trophy, Volleyball } from 'lucide-react'
import { FieldFence } from './fieldFence'
import { StaticMerge } from '../staticMerge'
import { inZone } from '../obstacles'
import { Solid } from '../Solid'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { TalkHuman } from '../Talkable'
import { NoteShower } from '../money'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'
import { worldTime } from '../../lib/worldClock'

// Life at the street side, around the Sim: le grin, children playing football,
// people talking in a ring, a lit pitch and a basketball court with a crowd,
// and the marchands (oranges, eau glacée, crédit, pain). The courts stay lit
// after dark. Everything stands on the real streets, at the same corners.

type Kind = 'grin' | 'foot' | 'causerie'
type Scene = { id: string; kind: Kind; at: XZ; rot: number; seed: number }
type Spot = { id: string; at: XZ; rot: number; seed: number }
type Vendor = Spot & { goods: (typeof GOODS)[number] }

const SCENE_NEAR = 260
const SCENE_MAX = 4
const COURT_NEAR = 380
const GOODS = [
  { label: 'Oranges', color: '#f08c00' },
  { label: 'Eau glacée', color: '#3aa0e8' },
  { label: 'Crédit', color: '#f2c14b' },
  { label: 'Pain', color: '#e6c48a' },
] as const

export function StreetLife({ nav, seed, night, taken, onPlay, doing }: { nav: Nav; seed: string; night: boolean; /** ground already given to a place, a field, a lot */ taken: Taken[]; /** Join the boys' game on the street's pitch or court (backend sims/street.go: foot:…, basket:…): what they say. */ onPlay?: (vendor: string) => Promise<string | null>; /** What the Sim is doing (an interaction id) */ doing?: string }) {
  const scenes = useMemo(() => {
    const out: Scene[] = []
    for (const e of nav.edges) {
      if (e.width > 12 || e.len < 24 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const h = hash(Math.round(m[0]), Math.round(m[1]), 191)
      if (h > 0.09) continue
      const side = hash(Math.round(m[1]), 7) < 0.5 ? 1 : -1
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      const off = e.width / 2 + 4.5
      const at: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
      if (!nav.walkable(at[0], at[1])) continue
      const kind: Kind = h < 0.03 ? 'grin' : h < 0.06 ? 'foot' : 'causerie'
      out.push({ id: `${seed}:${Math.round(at[0])}:${Math.round(at[1])}`, kind, at, rot: Math.atan2(ux, uz), seed: h * 1000 })
    }
    return out
  }, [nav, seed])
  // Police checkpoints on the big roads: a patrol car on the shoulder, cones, two officers.
  const posts = useMemo(() => {
    const out: Spot[] = []
    for (const e of nav.edges) {
      if (e.width < 9 || e.len < 40 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const h = hash(Math.round(m[0]), Math.round(m[1]), 613)
      if (h > 0.12) continue
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      // On the right-hand shoulder (traffic drives on the right).
      const off = e.width / 2 + 1.2
      out.push({ id: `police:${Math.round(m[0])}:${Math.round(m[1])}`, at: [m[0] + uz * off, m[1] - ux * off], rot: Math.atan2(ux, uz), seed: h })
    }
    return out
  }, [nav])
  const [post, setPost] = useState<Spot | null>(null)
  const courts = useMemo(() => spotsOf(nav, 41, 36, false, (seed) => (seed < 0.4 ? COURT_HALF : PITCH_HALF), taken), [nav, taken])
  const stalls = useMemo(() => spotsOf(nav, 19, 24, true, undefined, taken), [nav, taken])
  const [shown, setShown] = useState<Scene[]>([])
  const [foot, setFoot] = useState<Spot | null>(null)
  const [basket, setBasket] = useState<Spot | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = scenes
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < SCENE_NEAR && !inZone(x.s.at[0], x.s.at[1], 2))
      .sort((a, b) => a.d - b.d)
      .slice(0, SCENE_MAX)
      .map((x) => x.s)
    if (near.map((s) => s.id).join() !== shown.map((s) => s.id).join()) setShown(near)
    const nextPost = posts.map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) })).filter((x) => x.d < 320 && !inZone(x.s.at[0], x.s.at[1], 2)).sort((a, b) => a.d - b.d)[0]?.s ?? null
    if (nextPost?.id !== post?.id) setPost(nextPost)
    // Each spot is always the same game (a pitch or a court), whether seen from afar or up close.
    // Not on a match field's fenced ground either (its own fence aside).
    const playable = courts.filter((s) => !inZone(s.at[0], s.at[1], 12, `fence:${s.id}`))
    const nextFoot = nearest(playable.filter((s) => !isCourt(s)), 1)[0] ?? null
    const nextBasket = nearest(playable.filter(isCourt), 1, nextFoot ? [nextFoot.at] : [])[0] ?? null
    if (nextFoot?.id !== foot?.id) setFoot(nextFoot)
    if (nextBasket?.id !== basket?.id) setBasket(nextBasket)
    // In development, for tests in the browser: the street's pitch and court now drawn.
    if (import.meta.env.DEV) Object.assign(globalThis, { __streetCourts: { foot: nextFoot, basket: nextBasket } })
    const avoid = [nextFoot, nextBasket].flatMap((s) => (s ? [s.at] : []))
    const next = nearest(stalls.filter((s) => !inZone(s.at[0], s.at[1], 2)), 3, avoid).map((s) => ({ ...s, goods: GOODS[Math.floor(s.seed * GOODS.length)] }))
    if (next.map((v) => v.id).join() !== vendors.map((v) => v.id).join()) setVendors(next)
  })
  return (
    <>
      <NoShadows>
        {shown.map((s) => (
          <group key={s.id} position={[s.at[0], 0, s.at[1]]} rotation={[0, s.rot, 0]}>
            {s.kind === 'grin' ? (
              <Solid parts>
                <Grin seed={s.id} />
              </Solid>
            ) : s.kind === 'foot' ? (
              <>
                <Foot seed={s.id} />
                {/* After dark the children play on under a lamp (its poles not walked through) */}
                <Solid parts>{night && <Lights night w={8} d={6} />}</Solid>
              </>
            ) : night ? (
              <Solid parts>
                <Travail seed={s.id} />
              </Solid>
            ) : (
              <Causerie seed={s.id} />
            )}
          </group>
        ))}
      </NoShadows>
      {/* Their tables, benches, posts and hoops: not walked through */}
      <Solid parts>{post && <PolicePost spot={post} />}</Solid>
      <Solid parts>{foot && <Pitch spot={foot} night={night} />}</Solid>
      <Solid parts>{basket && <Court spot={basket} night={night} />}</Solid>
      {foot && <PlayHere spot={foot} sport="foot" half={8} onPlay={onPlay} playing={doing === 'street-foot'} />}
      {basket && <PlayHere spot={basket} sport="basket" half={5.5} onPlay={onPlay} playing={doing === 'street-basket'} />}
      {vendors.map((v) => (
        <Solid key={v.id} parts>
          <Marchand vendor={v} />
        </Solid>
      ))}
    </>
  )
}

const wood = new THREE.MeshLambertMaterial({ color: '#7a5233' })
const iron = new THREE.MeshLambertMaterial({ color: '#2a2a2a' })
const teapot = new THREE.MeshLambertMaterial({ color: '#3f8fd6' })
const ballMat = new THREE.MeshLambertMaterial({ color: '#f4f4f4' })
const grass = new THREE.MeshLambertMaterial({ color: '#2f9e4a' })
const stripe = new THREE.MeshLambertMaterial({ color: '#278a40' })
const concrete = new THREE.MeshLambertMaterial({ color: '#d5d0c6' })
const line = new THREE.MeshBasicMaterial({ color: '#ffffff' })
const white = new THREE.MeshLambertMaterial({ color: '#f4f4f4' })
const hoop = new THREE.MeshLambertMaterial({ color: '#e25b2a' })
const pole = new THREE.MeshLambertMaterial({ color: '#b7bcc4' })
const lampOff = new THREE.MeshLambertMaterial({ color: '#d9dde2' })
const lampOn = new THREE.MeshLambertMaterial({ color: '#fff2cc', emissive: '#fff2cc', emissiveIntensity: 1.8 })
const pool = new THREE.MeshBasicMaterial({ color: '#fff1cc', transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending })
const stallWood = new THREE.MeshLambertMaterial({ color: '#8a5a32' })
const goodsMat = new Map<string, THREE.MeshLambertMaterial>()
const goodsMaterial = (c: string) => {
  let m = goodsMat.get(c)
  if (!m) goodsMat.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}

/** Ground the game has already given away (a place it built, a landmark, a field, a player's lot): a circle. */
export type Taken = { at: XZ; r: number }

/**
 * Spots beside the streets, set back from them. With a size (half its length
 * across the street, half its width along it: a pitch, a court), the whole of
 * it is looked at, a step round it too: no street, building, water or ground
 * already taken anywhere on it, or the spot isn't one.
 */
/** A seller's table, the seller behind it and a step round them (half sizes, m). */
const STALL_HALF: [number, number] = [1.6, 1.4]

export function spotsOf(nav: Nav, salt: number, minLen: number, sparse: boolean, size?: (seed: number) => [number, number], taken: Taken[] = []): Spot[] {
  const out: Spot[] = []
  const clear = (at: XZ, ux: number, uz: number, [hl, hw]: [number, number]) => {
    if (taken.some((t) => Math.hypot(t.at[0] - at[0], t.at[1] - at[1]) < t.r + Math.hypot(hl, hw))) return false
    for (let a = -hl; a <= hl + 0.01; a += hl / Math.ceil(hl / 2))
      for (let b = -hw; b <= hw + 0.01; b += hw / Math.ceil(hw / 2)) {
        // Across the street (a), along it (b).
        const q: XZ = [at[0] + uz * a + ux * b, at[1] - ux * a + uz * b]
        if (!nav.walkable(q[0], q[1])) return false
        const n = nav.nearest(q, 30)
        if (n && n.dist < nav.edges[n.edge].width / 2 + 1) return false
      }
    return true
  }
  for (const e of nav.edges) {
    if (e.width < 5.5 || e.len < minLen || nav.ys[e.a] || nav.ys[e.b]) continue
    if (sparse && hash(e.a, e.b, salt) > 0.2) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
    // What it is (a pitch or a court) is the street's: its size follows.
    const seed = hash(Math.round(m[0]), Math.round(m[1]), salt)
    const half = size?.(seed)
    let at: XZ | null = null
    for (const side of [1, -1]) {
      for (const extra of half ? [2, 6] : [11, 7]) {
        // A sized one: its near edge `extra` metres from the street's.
        const off = e.width / 2 + extra + (half ? half[0] : 0)
        const p: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
        // A seller's table too is looked at all round (table, seller, a step): set off one street
        // only, it could stand in the next one (a cross street, a parallel one), in the traffic.
        if (clear(p, ux, uz, half ?? STALL_HALF)) {
          at = p
          break
        }
      }
      if (at) break
    }
    if (!at) continue
    out.push({ id: `${salt}:${Math.round(at[0])}:${Math.round(at[1])}`, at, rot: Math.atan2(ux, uz), seed: half ? seed : hash(at[0], at[1], salt) })
  }
  return out
}

/** A street spot for basketball (a court) rather than football (a pitch): fixed by its seed. */
const isCourt = (s: Spot) => s.seed < 0.4
/** Their half sizes, across the street and along it: the fence and a step round it. */
const PITCH_HALF: [number, number] = [12.5, 8]
const COURT_HALF: [number, number] = [9.5, 6]

function nearest(all: Spot[], n: number, avoid: XZ[] = []) {
  const [sx, sz] = whereabouts.sim
  return all
    .filter((s) => avoid.every((p) => Math.hypot(p[0] - s.at[0], p[1] - s.at[1]) > 22))
    .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
    .filter((x) => x.d < COURT_NEAR)
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.s)
}

/** People of the scene: their looks, drawn from the scene's id. */
function useCast(seed: string, n: number, men = false) {
  return useMemo(() => {
    const r = rng(seed)
    return [...Array(n)].map(() => {
      const gender: 'femme' | 'homme' = men || r() < 0.5 ? 'homme' : 'femme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [seed, n, men])
}

/**
 * The tea of the grin (the attaya), on the shared clock: the maker lifts the
 * teapot high and pours a long stream into the little glasses, pours from
 * glass to glass for the foam, puts it back on the embers; the steam rises;
 * a glass goes round to the one whose turn it is.
 */
function Tea({ seed }: { seed: string }) {
  const pot = useRef<THREE.Group>(null)
  const stream = useRef<THREE.Mesh>(null)
  const cup = useRef<THREE.Group>(null)
  const passed = useRef<THREE.Group>(null)
  const steam = useRef<(THREE.Mesh | null)[]>([])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff6a1a' }), [])
  const offset = useMemo(() => (hash(seed.length, seed.charCodeAt(0) || 1) * 20) | 0, [seed])
  useFrame(() => {
    const t = worldTime() + offset
    const u = (t % 12) / 12
    // 0–0.15 lift, 0.15–0.45 pour into the glass, 0.45–0.7 glass to glass, 0.7–0.8 back down, then it heats.
    const up = u < 0.15 ? u / 0.15 : u < 0.7 ? 1 : u < 0.8 ? 1 - (u - 0.7) / 0.1 : 0
    const e = up * up * (3 - 2 * up)
    if (pot.current) {
      pot.current.position.set(0.12 * e, 0.5 + 0.75 * e, 0.42 * e)
      pot.current.rotation.x = u >= 0.15 && u < 0.45 ? 0.7 : 0
    }
    const pouring = u >= 0.15 && u < 0.45
    const foaming = u >= 0.45 && u < 0.7
    if (stream.current) {
      stream.current.visible = pouring || foaming
      // From the spout (or the glass held high) down to the glass on the tray.
      const top = pouring ? 1.12 : 0.95
      stream.current.scale.set(1, top - 0.36, 1)
      stream.current.position.set(0.12, (top + 0.36) / 2, 0.55)
    }
    if (cup.current) {
      // Glass to glass: one goes up, poured into the other, and back.
      const k = foaming ? Math.abs(Math.sin(((u - 0.45) / 0.25) * Math.PI * 2)) : 0
      cup.current.position.set(0.12, 0.33 + k * 0.62, 0.55)
      cup.current.rotation.x = foaming && k > 0.6 ? 1.1 : 0
    }
    // A glass goes round: from the tray to the one whose turn it is, and drunk there.
    if (passed.current) {
      const turn = Math.floor(t / 12) % 2
      const a = ((turn + 1) / 3) * Math.PI * 2
      const g = u < 0.85 ? 0 : (u - 0.85) / 0.15
      passed.current.position.set(0.25 * (1 - g) + Math.sin(a) * 1.1 * g, 0.33 + Math.sin(g * Math.PI) * 0.25 + g * 0.5, 0.55 * (1 - g) + Math.cos(a) * 1.1 * g)
      passed.current.visible = u > 0.8
    }
    steam.current.forEach((m, i) => {
      if (!m) return
      const k = ((t * 0.45 + i / 3) % 1)
      m.position.set(Math.sin(t + i) * 0.04, 0.68 + k * 0.6, Math.cos(t * 0.7 + i) * 0.04)
      m.scale.setScalar(0.05 + k * 0.08)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k) * (up < 0.1 ? 1 : 0.2)
    })
    glow.color.setHSL(0.05, 1, 0.45 + Math.sin(t * 5) * 0.08)
  })
  return (
    <group>
      <mesh material={iron} position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.36, 8]} />
      </mesh>
      <mesh material={glow} position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 8]} />
      </mesh>
      <group ref={pot} position={[0, 0.5, 0]}>
        <mesh material={teapot}>
          <sphereGeometry args={[0.13, 8, 6]} />
        </mesh>
        <mesh material={teapot} position={[0, 0.02, 0.15]} rotation={[0.9, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.025, 0.16, 5]} />
        </mesh>
      </group>
      {/* The tray and its little glasses; the one being filled */}
      <mesh material={iron} position={[0.25, 0.29, 0.6]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 12]} />
      </mesh>
      {[0.36, 0.42].map((x) => (
        <mesh key={x} material={glassMat} position={[x, 0.33, 0.65]}>
          <cylinderGeometry args={[0.025, 0.02, 0.07, 6]} />
        </mesh>
      ))}
      <group ref={cup} position={[0.12, 0.33, 0.55]}>
        <mesh material={glassMat}>
          <cylinderGeometry args={[0.025, 0.02, 0.07, 6]} />
        </mesh>
      </group>
      <group ref={passed}>
        <mesh material={glassMat}>
          <cylinderGeometry args={[0.025, 0.02, 0.07, 6]} />
        </mesh>
      </group>
      {/* The long stream of tea */}
      <mesh ref={stream} material={teaMat} visible={false}>
        <cylinderGeometry args={[0.008, 0.008, 1, 4]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (steam.current[i] = m)}>
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
const glassMat = new THREE.MeshLambertMaterial({ color: '#e8d5a8', transparent: true, opacity: 0.8 })
const teaMat = new THREE.MeshBasicMaterial({ color: '#b5651d', transparent: true, opacity: 0.85 })

/** Le grin: three men on benches around the little stove, the tea being made (Tea). */
export function Grin({ seed }: { seed: string }) {
  const cast = useCast(seed, 3, true)
  return (
    <group>
      <Tea seed={seed} />
      {cast.map((p, i) => {
        const a = (i / cast.length) * Math.PI * 2
        const [x, z] = [Math.sin(a) * 1.4, Math.cos(a) * 1.4]
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, a + Math.PI, 0]}>
            <mesh material={wood} position={[0, 0.22, 0.05]}>
              <boxGeometry args={[1.1, 0.06, 0.32]} />
            </mesh>
            {[-0.45, 0.45].map((lx) => (
              <mesh key={lx} material={wood} position={[lx, 0.1, 0.05]}>
                <boxGeometry args={[0.06, 0.2, 0.3]} />
              </mesh>
            ))}
            <group position={[0, -0.22, 0]}>
              {/* The maker at his teapot, one drinking, one talking */}
              <TalkHuman id={`grin:${seed}:${i}`} look={p.look} gender={p.gender} pose={i === 0 ? 'cook' : i === 1 ? 'drink' : 'talk'} seed={p.seed} />
            </group>
          </group>
        )
      })}
    </group>
  )
}

/** Children playing football: the ball goes from one to the other. */
function Foot({ seed }: { seed: string }) {
  const cast = useCast(seed, 4)
  const spots: XZ[] = [[-3, -2], [3, -2.5], [2.5, 3], [-2.5, 2.5]]
  const ball = useRef<THREE.Mesh>(null)
  // Pass n goes from player a(n−1) to a(n), with a(n) = (2n + b(n)) mod 4 and
  // b(n) a coin flip seeded by n: never to oneself, worked out from the shared
  // clock alone, so every screen sees the same pass.
  const [to, setTo] = useState(0)
  const offset = useMemo(() => rng(`foot${seed}`)() * 100, [seed])
  useFrame(() => {
    const u = (worldTime() + offset) / 1.1
    const n = Math.floor(u)
    const who = (m: number) => (2 * m + (rng(`${seed}|${m}`)() < 0.5 ? 0 : 1)) % 4
    const [a, b] = [spots[who(n - 1)], spots[who(n)]]
    if (who(n) !== to) setTo(who(n))
    const k = u - n
    ball.current?.position.set(a[0] + (b[0] - a[0]) * k, 0.12 + Math.sin(k * Math.PI) * 0.6, a[1] + (b[1] - a[1]) * k)
  })
  return (
    <group>
      {cast.map((p, i) => (
        <group key={i} position={[spots[i][0], 0, spots[i][1]]} rotation={[0, Math.atan2(-spots[i][0], -spots[i][1]), 0]} scale={0.62}>
          <Human look={p.look} gender={p.gender} pose={(i === to ? 'cheer' : 'idle') as Pose} seed={p.seed} headScale={1.2} />
        </group>
      ))}
      <mesh ref={ball} material={ballMat}>
        <sphereGeometry args={[0.12, 8, 6]} />
      </mesh>
    </group>
  )
}

/** A few people standing in a ring, talking: the gbairai at the corner. */
function Causerie({ seed }: { seed: string }) {
  const cast = useCast(seed, 3)
  return (
    <group>
      {cast.map((p, i) => {
        const a = (i / cast.length) * Math.PI * 2 + 0.3
        const [x, z] = [Math.sin(a) * 0.85, Math.cos(a) * 0.85]
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, a + Math.PI, 0]}>
            <TalkHuman id={`causerie:${seed}:${i}`} look={p.look} gender={p.gender} pose={i === 0 ? 'talk' : i === 1 ? 'idle' : 'talk'} seed={p.seed + 7} />
          </group>
        )
      })}
    </group>
  )
}

/**
 * At night, a corner turns into a little party: a sound system, three
 * dancing, and a grand-frère doing the travaillement on them, notes
 * fluttering down while the others cheer. The same notes for every player.
 */
function Travail({ seed }: { seed: string }) {
  const cast = useCast(`${seed}travail`, 6)
  const offset = useMemo(() => rng(`${seed}tr`)() * 50, [seed])
  return (
    <group>
      {/* The sound system: two speakers on crates */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.7, 0, -1.6]}>
          <mesh position={[0, 0.25, 0]} material={wood}>
            <boxGeometry args={[0.6, 0.5, 0.5]} />
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[0.55, 1.0, 0.45]} />
            <meshLambertMaterial color="#17171a" />
          </mesh>
          <mesh position={[0, 1.05, 0.23]}>
            <boxGeometry args={[0.32, 0.32, 0.02]} />
            <meshLambertMaterial color="#3a3f4b" />
          </mesh>
        </group>
      ))}
      {/* Three dancing */}
      {cast.slice(0, 3).map((p, i) => (
        <group key={i} position={[(i - 1) * 0.95, 0, -0.5 + Math.abs(i - 1) * 0.3]} rotation={[0, (1 - i) * 0.3, 0]}>
          <TalkHuman id={`travail:${seed}:${i}`} look={p.look} gender={p.gender} pose={i === 1 ? 'cheer' : 'dance'} seed={p.seed + offset} />
        </group>
      ))}
      {/* The grand-frère, facing them, notes flying from his hand */}
      <group position={[0.2, 0, 1.9]} rotation={[0, Math.PI, 0]}>
        <TalkHuman id={`travail:${seed}:boss`} look={{ ...cast[3].look, outfit: 'boubou', accessory: 'chain' }} gender="homme" pose="throw" seed={cast[3].seed} />
        <NoteShower from={[0.3, 1.72, 0.3]} toward={[0, 0.35, 1]} rate={2.4} fan={4} seed={offset} />
      </group>
      {/* And the ones who watch and shout */}
      {cast.slice(4).map((p, i) => (
        <group key={i} position={[(i ? 1 : -1) * 1.9, 0, 1.2]} rotation={[0, (i ? 1 : -1) * 2.2, 0]}>
          <TalkHuman id={`travail:${seed}:c${i}`} look={p.look} gender={p.gender} pose="cheer" seed={p.seed} />
        </group>
      ))}
    </group>
  )
}

function Lights({ night, w, d }: { night: boolean; w: number; d: number }) {
  return (
    <>
      {night && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} material={pool}>
          <circleGeometry args={[Math.max(w, d) * 0.7, 20]} />
        </mesh>
      )}
      {([-1, 1] as const).map((s) => (
        <group key={s} position={[s * (w / 2 + 0.6), 0, s * (d / 2 - 0.4)]}>
          <mesh position={[0, 3.2, 0]} material={pole}>
            <cylinderGeometry args={[0.07, 0.1, 6.4, 6]} />
          </mesh>
          <mesh position={[0, 6.2, 0]} material={night ? lampOn : lampOff}>
            <boxGeometry args={[0.9, 0.12, 0.35]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function people(seed: string, n: number, kit: Partial<Look>) {
  const r = rng(seed)
  return [...Array(n)].map(() => {
    const gender = r() < 0.35 ? 'femme' : 'homme'
    return { gender: gender as 'femme' | 'homme', look: { ...randomLook(gender, r), ...kit }, seed: r() * 100 }
  })
}

function Pitch({ spot, night }: { spot: Spot; night: boolean }) {
  const side = useMemo(() => people(`foot${spot.id}`, 6, { outfit: 'jersey', outfitColor: '#ff7a00' }), [spot.id])
  const watch = useMemo(() => people(`crowd${spot.id}`, 5, { outfit: 'casual' }), [spot.id])
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime() + spot.seed * 8
    ball.current?.position.set(Math.sin(t * 0.7) * 7, 0.28 + Math.abs(Math.sin(t * 2.4)) * 0.55, Math.cos(t * 0.55) * 2.2)
  })
  return (
    <StaticMerge version={night ? 1 : 0}>
    <group position={[spot.at[0], 0, spot.at[1]]} rotation={[0, spot.rot, 0]}>
      <mesh position={[0, 0.03, 0]} material={grass} receiveShadow>
        <boxGeometry args={[22, 0.06, 13]} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * 5, 0.07, 0]} material={stripe}>
          <boxGeometry args={[2.4, 0.02, 12.6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.08, 0]} material={line}>
        <boxGeometry args={[0.12, 0.02, 12.6]} />
      </mesh>
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]} material={line}>
        <ringGeometry args={[1.5, 1.66, 20]} />
      </mesh>
      {[-10.4, 10.4].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-1.3, 1.3].map((z) => (
            <mesh key={z} position={[0, 1.1, z]} material={white}>
              <cylinderGeometry args={[0.06, 0.06, 2.2, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 2.15, 0]} material={white}>
            <boxGeometry args={[0.08, 0.08, 2.7]} />
          </mesh>
        </group>
      ))}
      <mesh ref={ball} material={white} userData={{ live: true }}>
        <sphereGeometry args={[0.22, 10, 8]} />
      </mesh>
      <FieldFence hl={11.3} hw={6.8} id={spot.id} />
      <Lights night={night} w={22} d={13} />
      <NoShadows>
        {side.map((p, i) => (
          <group key={i} position={[((i % 3) - 1) * 4, 0, (i < 3 ? -1 : 1) * 2.4]}>
            <Human look={p.look} gender={p.gender} pose={i % 2 ? 'run' : 'idle'} seed={p.seed} />
          </group>
        ))}
        {watch.map((p, i) => (
          <group key={i} position={[-8 + i * 3.2, 0, 8]} rotation={[0, Math.PI, 0]}>
            <TalkHuman id={`pitch:${spot.id}:${i}`} look={p.look} gender={p.gender} pose={i % 2 ? 'cheer' : 'idle'} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
    </StaticMerge>
  )
}

function Court({ spot, night }: { spot: Spot; night: boolean }) {
  const side = useMemo(() => people(`basket${spot.id}`, 4, { outfit: 'basket', outfitColor: '#1d428a' }), [spot.id])
  const watch = useMemo(() => people(`bcrowd${spot.id}`, 4, {}), [spot.id])
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = (worldTime() * 0.35 + spot.seed) % 1
    ball.current?.position.set(-5 + k * 10, 0.45 + Math.sin(k * Math.PI) * 3.1, Math.sin(k * Math.PI * 2) * 0.6)
  })
  return (
    <StaticMerge version={night ? 1 : 0}>
    <group position={[spot.at[0], 0, spot.at[1]]} rotation={[0, spot.rot, 0]}>
      <mesh position={[0, 0.03, 0]} material={concrete} receiveShadow>
        <boxGeometry args={[16, 0.06, 9]} />
      </mesh>
      <mesh position={[0, 0.07, 0]} material={line}>
        <boxGeometry args={[0.1, 0.02, 8.6]} />
      </mesh>
      {[-7.4, 7.4].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.7, 0]} material={white}>
            <cylinderGeometry args={[0.07, 0.07, 3.4, 6]} />
          </mesh>
          <mesh position={[Math.sign(x) * -0.45, 3.25, 0]} material={hoop}>
            <boxGeometry args={[0.9, 0.06, 1.15]} />
          </mesh>
        </group>
      ))}
      <mesh ref={ball} material={hoop} userData={{ live: true }}>
        <sphereGeometry args={[0.2, 10, 8]} />
      </mesh>
      <FieldFence hl={8.3} hw={4.8} id={spot.id} />
      <Lights night={night} w={16} d={9} />
      <NoShadows>
        {side.map((p, i) => (
          <group key={i} position={[-3 + (i % 2) * 5, 0, i < 2 ? -1.4 : 1.4]}>
            <Human look={p.look} gender={p.gender} pose={i === 0 ? 'throw' : 'run'} seed={p.seed} />
          </group>
        ))}
        {watch.map((p, i) => (
          <group key={i} position={[-4.5 + i * 3, 0, 6.2]} rotation={[0, Math.PI, 0]}>
            <TalkHuman id={`court:${spot.id}:${i}`} look={p.look} gender={p.gender} pose={i % 2 ? 'cheer' : 'wave'} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
    </StaticMerge>
  )
}

const PLAY_REACH = 30 // metres from the middle: close enough to be asked in
const PLAY = {
  foot: { ask: 'Jouer avec les gars', icon: Volleyball, far: 'Approche du terrain !' },
  basket: { ask: 'Jouer au basket avec eux', icon: Trophy, far: 'Viens au playground !' },
}

/**
 * The street's pitch or court invites whoever comes near: a tap, and the boys
 * take the Sim into their game (a street activity, free); it runs up and down
 * with them (Walker LOOPS) until the game is over.
 */
function PlayHere({ spot, sport, half, onPlay, playing }: { spot: Spot; sport: 'foot' | 'basket'; half: number; onPlay?: (vendor: string) => Promise<string | null>; playing: boolean }) {
  const [near, setNear] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(clear.current), [])
  const say = (text: string, ms = 6000) => {
    setSaid(text)
    clearTimeout(clear.current)
    clear.current = setTimeout(() => setSaid(null), ms)
  }
  const away = () => Math.hypot(spot.at[0] - whereabouts.sim[0], spot.at[1] - whereabouts.sim[1])
  useFrame(() => {
    const d = away() < PLAY_REACH
    if (d !== near) setNear(d)
  })
  const p = PLAY[sport]
  const tap = async () => {
    if (!onPlay) return
    if (away() > PLAY_REACH) return say(p.far, 3000)
    // Its ground, for the Sim to run on (the pitch's length is its own x).
    whereabouts.pitch = { at: spot.at, dir: [Math.cos(spot.rot), -Math.sin(spot.rot)], half }
    say('…', 20000)
    const text = await onPlay(`${sport}:${spot.id}`)
    if (text) say(text)
    else setSaid(null)
  }
  // In the game already: only what the boys said, for a moment.
  if ((!near || playing) && !said) return null
  const Icon = p.icon
  return (
    <Html position={[spot.at[0], 3.4, spot.at[1]]} center zIndexRange={[25, 0]}>
      <button onClick={() => void tap()} className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-black/5 bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)] transition active:scale-95">
        {!said && <Icon size={15} strokeWidth={2.6} className="text-[#ff7a00]" />}
        {said ?? p.ask}
      </button>
    </Html>
  )
}

function Marchand({ vendor }: { vendor: Vendor }) {
  const look = useMemo(() => randomLook(vendor.seed < 0.5 ? 'femme' : 'homme', rng(vendor.id)), [vendor])
  return (
    <group position={[vendor.at[0], 0, vendor.at[1]]} rotation={[0, vendor.rot, 0]}>
      <mesh position={[0, 0.72, 0.7]} material={stallWood}>
        <boxGeometry args={[1.3, 0.08, 0.6]} />
      </mesh>
      {[-0.5, 0.5].map((x) =>
        [-0.2, 0.2].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.34, 0.7 + z]} material={stallWood}>
            <boxGeometry args={[0.06, 0.68, 0.06]} />
          </mesh>
        )),
      )}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.35 + i * 0.32, 0.95, 0.7]} material={goodsMaterial(vendor.goods.color)}>
          <sphereGeometry args={[0.14, 8, 6]} />
        </mesh>
      ))}
      <NoShadows>
        <group position={[0, 0, -0.4]}>
          <TalkHuman id={`marchand:${vendor.id}`} look={look} gender={vendor.seed < 0.5 ? 'femme' : 'homme'} pose="idle" seed={vendor.seed * 80} />
        </group>
      </NoShadows>
      <Html position={[0, 2.3, 0]} center zIndexRange={[12, 0]} distanceFactor={18}>
        <div className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_4px_10px_-6px_rgba(0,0,0,0.5)]">
          Marchand · {vendor.goods.label}
        </div>
      </Html>
    </group>
  )
}

/**
 * A police checkpoint on the shoulder of a big road: the patrol car, its
 * light going, the cones, one officer waving drivers over, the other by the car.
 */
export function PolicePost({ spot }: { spot: Spot }) {
  const officers = useMemo(() => people(`police${spot.id}`, 2, { outfit: 'policier', accessory: 'none', beard: 'none' }), [spot.id])
  const lamp = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => lamp.current?.color.set(Math.floor(worldTime() * 3) % 2 ? '#e03131' : '#1c7ed6'))
  return (
    <group position={[spot.at[0], 0, spot.at[1]]} rotation={[0, spot.rot, 0]}>
      {/* The patrol car, along the road */}
      <group position={[1.2, 0, -3]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[1.7, 0.7, 4.1]} />
          <meshLambertMaterial color="#1f2a44" />
        </mesh>
        <mesh position={[0, 1.15, -0.2]}>
          <boxGeometry args={[1.5, 0.55, 2.1]} />
          <meshLambertMaterial color="#f4f4f4" />
        </mesh>
        <mesh position={[0, 1.5, -0.2]}>
          <boxGeometry args={[1, 0.16, 0.3]} />
          <meshBasicMaterial ref={lamp} color="#e03131" />
        </mesh>
        {[-1.3, 1.3].map((z) =>
          [-0.85, 0.85].map((x) => (
            <mesh key={`${x}${z}`} position={[x, 0.32, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.32, 0.32, 0.22, 10]} />
              <meshLambertMaterial color="#141414" />
            </mesh>
          )),
        )}
      </group>
      {/* Cones out into the lane */}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[-0.8 - k * 0.35, 0.35, 2 + k * 1.6]}>
          <coneGeometry args={[0.22, 0.7, 10]} />
          <meshLambertMaterial color={k % 2 ? '#ffffff' : '#ff6a00'} />
        </mesh>
      ))}
      <NoShadows>
        <group position={[-1.6, 0, 1]} rotation={[0, -Math.PI / 2, 0]}>
          <TalkHuman id={`police:${spot.id}:0`} look={officers[0].look} gender={officers[0].gender} pose="wave" seed={officers[0].seed} />
        </group>
        <group position={[0.1, 0, -0.6]} rotation={[0, -2.2, 0]}>
          <TalkHuman id={`police:${spot.id}:1`} look={officers[1].look} gender={officers[1].gender} pose="idle" seed={officers[1].seed} />
        </group>
      </NoShadows>
    </group>
  )
}
