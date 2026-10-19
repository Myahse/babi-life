import { useMemo, useRef, useState } from 'react'
import { FieldFence } from './fieldFence'
import { inZone } from '../obstacles'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
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

export function StreetLife({ nav, seed, night }: { nav: Nav; seed: string; night: boolean }) {
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
  const courts = useMemo(() => spotsOf(nav, 41, 36, false), [nav])
  const stalls = useMemo(() => spotsOf(nav, 19, 24, true), [nav])
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
    const avoid = [nextFoot, nextBasket].flatMap((s) => (s ? [s.at] : []))
    const next = nearest(stalls.filter((s) => !inZone(s.at[0], s.at[1], 2)), 3, avoid).map((s) => ({ ...s, goods: GOODS[Math.floor(s.seed * GOODS.length)] }))
    if (next.map((v) => v.id).join() !== vendors.map((v) => v.id).join()) setVendors(next)
  })
  return (
    <>
      <NoShadows>
        {shown.map((s) => (
          <group key={s.id} position={[s.at[0], 0, s.at[1]]} rotation={[0, s.rot, 0]}>
            {s.kind === 'grin' ? <Grin seed={s.id} /> : s.kind === 'foot' ? <Foot seed={s.id} /> : night ? <Travail seed={s.id} /> : <Causerie seed={s.id} />}
          </group>
        ))}
      </NoShadows>
      {post && <PolicePost spot={post} />}
      {foot && <Pitch spot={foot} night={night} />}
      {basket && <Court spot={basket} night={night} />}
      {vendors.map((v) => (
        <Marchand key={v.id} vendor={v} />
      ))}
    </>
  )
}

const wood = new THREE.MeshLambertMaterial({ color: '#7a5233' })
const iron = new THREE.MeshLambertMaterial({ color: '#2a2a2a' })
const coal = new THREE.MeshLambertMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 0.8 })
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

function spotsOf(nav: Nav, salt: number, minLen: number, sparse: boolean): Spot[] {
  const out: Spot[] = []
  for (const e of nav.edges) {
    if (e.width < 5.5 || e.len < minLen || nav.ys[e.a] || nav.ys[e.b]) continue
    if (sparse && hash(e.a, e.b, salt) > 0.2) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
    let at: XZ | null = null
    for (const side of [1, -1]) {
      for (const extra of [11, 7]) {
        const off = e.width / 2 + extra
        const p: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
        if (nav.walkable(p[0], p[1])) {
          at = p
          break
        }
      }
      if (at) break
    }
    if (!at) continue
    out.push({ id: `${salt}:${Math.round(at[0])}:${Math.round(at[1])}`, at, rot: Math.atan2(ux, uz), seed: hash(at[0], at[1], salt) })
  }
  return out
}

/** A street spot for basketball (a court) rather than football (a pitch): fixed by its seed. */
const isCourt = (s: Spot) => s.seed < 0.4

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

/** Le grin: three men on benches around the little stove and its teapot. */
function Grin({ seed }: { seed: string }) {
  const cast = useCast(seed, 3, true)
  return (
    <group>
      <mesh material={iron} position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.36, 8]} />
      </mesh>
      <mesh material={coal} position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 8]} />
      </mesh>
      <mesh material={teapot} position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.13, 8, 6]} />
      </mesh>
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
              <Human look={p.look} gender={p.gender} pose={i === 1 ? 'drink' : 'sit'} seed={p.seed} />
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
            <Human look={p.look} gender={p.gender} pose={i === 0 ? 'talk' : i === 1 ? 'idle' : 'talk'} seed={p.seed + 7} />
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
          <Human look={p.look} gender={p.gender} pose={i === 1 ? 'cheer' : 'dance'} seed={p.seed + offset} />
        </group>
      ))}
      {/* The grand-frère, facing them, notes flying from his hand */}
      <group position={[0.2, 0, 1.9]} rotation={[0, Math.PI, 0]}>
        <Human look={{ ...cast[3].look, outfit: 'boubou', accessory: 'chain' }} gender="homme" pose="throw" seed={cast[3].seed} />
        <NoteShower from={[0.3, 1.72, 0.3]} toward={[0, 0.35, 1]} rate={2.4} fan={4} seed={offset} />
      </group>
      {/* And the ones who watch and shout */}
      {cast.slice(4).map((p, i) => (
        <group key={i} position={[(i ? 1 : -1) * 1.9, 0, 1.2]} rotation={[0, (i ? 1 : -1) * 2.2, 0]}>
          <Human look={p.look} gender={p.gender} pose="cheer" seed={p.seed} />
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
      <mesh ref={ball} material={white}>
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
            <Human look={p.look} gender={p.gender} pose={i % 2 ? 'cheer' : 'idle'} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
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
      <mesh ref={ball} material={hoop}>
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
            <Human look={p.look} gender={p.gender} pose={i % 2 ? 'cheer' : 'wave'} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
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
          <Human look={look} gender={vendor.seed < 0.5 ? 'femme' : 'homme'} pose="idle" seed={vendor.seed * 80} />
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
          <Human look={officers[0].look} gender={officers[0].gender} pose="wave" seed={officers[0].seed} />
        </group>
        <group position={[0.1, 0, -0.6]} rotation={[0, -2.2, 0]}>
          <Human look={officers[1].look} gender={officers[1].gender} pose="idle" seed={officers[1].seed} />
        </group>
      </NoShadows>
    </group>
  )
}
