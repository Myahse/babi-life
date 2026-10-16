import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// The people of the street, each at their own street, always the same:
// - le fou du quartier, who walks up and down talking to nobody, his
//   clothes in rags, now and then in nothing but old torn shorts;
// - the pastor at the roadside with his Bible and his little amplifier,
//   preaching the good news to whoever passes, a few stopping to listen;
// - the pupils in their khaki and blue uniforms, bags on their backs, walking
//   to school in the morning and home at noon and in the evening (school
//   days: not Wednesday afternoon, not the weekend);
// - at the Plateau, the fonctionnaires: suits, shirts and skirts, the
//   briefcase or the folder under the arm, coming in late in the morning and
//   going home well before the offices close (« la descente », from 14 h 30;
//   from noon on Fridays, in pagne as the offices wear it that day).
// From the shared clock: the same words and steps on every screen.

type Kind = 'fou' | 'pasteur' | 'ecole' | 'bureau'
type Spot = { id: string; kind: Kind; at: XZ; rot: number; w: number; len: number; seed: number }

const NEAR = 240 // metres: drawn around the Sim
const MAX = 4

/** Seconds since Monday 00:00 → [day 0..6, hour as a fraction]. */
const clock = () => {
  const t = worldTime()
  return [Math.floor(t / 86400) % 7, ((t / 3600) % 24) as number] as const
}

/** Who is out at this time: fous all day (not deep in the night), the pastor mornings and late afternoons, pupils at school hours. */
function outNow(kind: Kind, day: number, h: number) {
  if (kind === 'fou') return h >= 6 && h < 23
  if (kind === 'pasteur') return (h >= 7 && h < 12) || (h >= 16 && h < 19.5)
  if (kind === 'bureau') return officeWalk(day, h) !== 0
  return schoolWalk(day, h) > 0
}

/** Pupils on the way: 1 at the rush (to school, home at noon, home in the evening), 0 otherwise. */
export function schoolWalk(day: number, h: number) {
  if (day > 4) return 0
  if (h >= 6.5 && h < 7.75) return 1
  if (h >= 12 && h < 13) return 1
  if (day !== 2 && h >= 17 && h < 18) return 1
  return 0
}

/** The fonctionnaires: 1 going in (7 h 30 – 9 h 30, late), -1 going home (from 14 h 30, from noon on Friday), 0 otherwise. */
export function officeWalk(day: number, h: number) {
  if (day > 4) return 0
  if (h >= 7.5 && h < 9.5) return 1
  if (day === 4 ? h >= 12 && h < 15 : h >= 14.5 && h < 16.5) return -1
  return 0
}

export function StreetPeople({ nav, seed }: { nav: Nav; seed: string }) {
  const all = useMemo(() => {
    const out: Spot[] = []
    const plateau = seed.includes('plateau')
    for (const e of nav.edges) {
      if (e.width < 6 || e.len < 40 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const h = hash(Math.round(m[0]), Math.round(m[1]), 377)
      // Pupils on many streets, a pastor here and there, a fou rarely; at the Plateau, the offices' people on the avenues too.
      const kind: Kind | null = plateau && h > 0.7 ? 'bureau' : e.width > 14 ? null : h < 0.012 ? 'fou' : h < 0.03 ? 'pasteur' : h < 0.1 ? 'ecole' : null
      if (!kind) continue
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      out.push({ id: `${kind}:${seed}:${Math.round(m[0])}:${Math.round(m[1])}`, kind, at: m, rot: Math.atan2(-uz, ux), w: e.width, len: e.len, seed: hash(m[0], m[1], 5) })
    }
    return out
  }, [nav, seed])
  const [shown, setShown] = useState<Spot[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [day, h] = clock()
    const [sx, sz] = whereabouts.sim
    const near = all
      .filter((s) => outNow(s.kind, day, h))
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => x.s)
    if (near.map((s) => s.id).join() !== shown.map((s) => s.id).join()) setShown(near)
  })
  return (
    <>
      {shown.map((s) => (
        <StreetSpot key={s.id} spot={s} />
      ))}
    </>
  )
}

export function StreetSpot({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.at[0], 0, spot.at[1]]} rotation={[0, spot.rot, 0]}>
      {spot.kind === 'fou' ? <Fou spot={spot} /> : spot.kind === 'pasteur' ? <Pasteur spot={spot} /> : spot.kind === 'bureau' ? <Fonctionnaires spot={spot} /> : <Pupils spot={spot} />}
    </group>
  )
}

/** Something said in the street, over someone's head. */
function Say({ text, y = 2.3, tone = 'white' }: { text: string; y?: number; tone?: 'white' | 'gold' }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[20, 0]}>
      <div className={`rounded-2xl rounded-bl-sm px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)] ${tone === 'gold' ? 'bg-[#fff3c4]' : 'bg-white'}`}>{text}</div>
    </Html>
  )
}

// ——— Le fou ———

const FOU_WORDS = ['Eux tous ils vont voir !', 'C’est moi le président…', 'Hé ! Hé ! Laisse ça !', 'Le ciel est tombé hier…', 'Mon argent là, rends ça !', 'Hmm hmm hmm…', 'Ils m’ont pas vu venir !', 'Abidjan c’est pour moi !']

function Fou({ spot }: { spot: Spot }) {
  const who = useMemo(() => {
    const r = rng(spot.id)
    const gender: 'femme' | 'homme' = r() < 0.15 ? 'femme' : 'homme'
    const base = randomLook(gender, r)
    // His clothes in rags, barefoot, the hair grown wild; some days in nothing but old torn shorts.
    const shorts = gender === 'homme' && r() < 0.5
    const look: Look = {
      ...base,
      outfit: shorts ? 'maillot' : gender === 'femme' ? 'pagne' : r() < 0.5 ? 'souscorps' : 'debardeur',
      outfitColor: ['#8a7d63', '#6b6250', '#9c8f73', '#5f6a55'][Math.floor(r() * 4)],
      bottomColor: '#5b5040',
      shoeColor: base.skin,
      wear: 'dechire',
      hair: gender === 'femme' ? 'afro' : r() < 0.6 ? 'afro' : 'locks',
      beard: gender === 'homme' ? 'full' : 'none',
      accessory: 'none',
      marks: 'griffures',
    }
    return { gender, look: look as Required<Look>, seed: r() * 100 }
  }, [spot.id])
  const ref = useRef<THREE.Group>(null)
  const [state, setState] = useState<{ pose: Pose; say: string | null }>({ pose: 'walk', say: null })
  const side = spot.seed < 0.5 ? 1 : -1
  const reach = Math.min(spot.len / 2 - 4, 16)
  useFrame(() => {
    const t = worldTime()
    // Up and down the street, stopping now and then to argue with the air.
    const cycle = 40
    const c = (t + spot.seed * cycle) % cycle
    const stopped = c > 28
    const leg = Math.floor((t + spot.seed * cycle) / cycle)
    const dir = leg % 2 ? 1 : -1
    const k = Math.min(1, c / 28)
    const x = dir * reach * (2 * k - 1)
    const z = side * (spot.w / 2 + 1)
    const g = ref.current
    if (g) {
      g.position.set(x, 0, z + Math.sin(t * 0.6) * 0.3)
      g.rotation.y = stopped ? -side * Math.PI / 2 + Math.sin(t * 0.7) * 0.6 : dir > 0 ? Math.PI / 2 : -Math.PI / 2
    }
    const pose: Pose = stopped ? 'rant' : 'walk'
    const say = stopped ? FOU_WORDS[Math.floor(hash(leg, spot.seed * 100) * FOU_WORDS.length)] : null
    if (pose !== state.pose || say !== state.say) setState({ pose, say })
  })
  return (
    <group ref={ref}>
      <NoShadows>
        <Human look={who.look} gender={who.gender} pose={state.pose} seed={who.seed} />
      </NoShadows>
      {state.say && <Say text={state.say} />}
    </group>
  )
}

// ——— Le pasteur ———

const SERMON = ['Jésus revient bientôt !', 'Repentez-vous, mes frères !', 'Dieu a un plan pour ta vie !', 'Alléluia ! Dites amen !', 'Le diable est un menteur !', 'Donne ta vie à Christ aujourd’hui !', 'Il n’est pas trop tard !', 'Gloire à Dieu !']
const LISTENER_WORDS = ['Amen !', 'Alléluia !', 'Amen, pasteur !']

const M = {
  amp: new THREE.MeshLambertMaterial({ color: '#202226' }),
  grille: new THREE.MeshLambertMaterial({ color: '#4a4d55' }),
  bible: new THREE.MeshLambertMaterial({ color: '#2a1d14' }),
  page: new THREE.MeshLambertMaterial({ color: '#f4efe6' }),
  red: new THREE.MeshLambertMaterial({ color: '#b42318' }),
  mic: new THREE.MeshLambertMaterial({ color: '#111111' }),
  briefcase: new THREE.MeshLambertMaterial({ color: '#3a2618' }),
  folder: new THREE.MeshLambertMaterial({ color: '#d9c38a' }),
  bag: ['#1f6fd0', '#b42318', '#2f9e44', '#6d28d9', '#f08c00', '#17171a'].map((c) => new THREE.MeshLambertMaterial({ color: c })),
}

function Pasteur({ spot }: { spot: Spot }) {
  const cast = useMemo(() => {
    const r = rng(spot.id)
    const pastor = { look: { ...randomLook('homme', r), outfit: 'pasteur', outfitColor: '#17171a', accessory: r() < 0.5 ? 'glasses' : 'croix' } as Required<Look>, seed: r() * 100 }
    // Who stops to listen: women with their bags, a man on his way, a mother.
    const listeners = [...Array(4)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.65 ? 'femme' : 'homme'
      const a = -0.9 + i * 0.6 + (r() - 0.5) * 0.2
      return { gender, look: randomLook(gender, r), seed: r() * 100, at: [Math.sin(a) * 3.2, 0, Math.cos(a) * 3.2] as [number, number, number], rot: a + Math.PI }
    })
    return { pastor, listeners }
  }, [spot.id])
  const side = spot.seed < 0.5 ? 1 : -1
  const [state, setState] = useState({ line: 0, listen: 0, amen: -1 })
  useFrame(() => {
    const t = worldTime()
    // A line every 6 s; the crowd grows and thins over minutes.
    const line = Math.floor(t / 6)
    const listen = Math.max(1, Math.round(2.5 + 1.5 * Math.sin(t / 240 + spot.seed * 9)))
    const amen = line % 3 === 2 ? line % listen : -1
    if (line !== state.line || listen !== state.listen || amen !== state.amen) setState({ line, listen, amen })
  })
  const words = SERMON[Math.floor(hash(state.line, spot.seed * 100) * SERMON.length)]
  return (
    // On the sidewalk, facing the road (the people passing).
    <group position={[0, 0, side * (spot.w / 2 + 1.6)]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
      <NoShadows>
        <group>
          <Human look={cast.pastor.look} gender="homme" pose="rant" seed={cast.pastor.seed} />
          <Say key={state.line} text={`${words} 📖`} y={2.45} tone="gold" />
        </group>
        {cast.listeners.slice(0, state.listen).map((l, i) => (
          <group key={i} position={l.at} rotation={[0, l.rot, 0]}>
            <Human look={l.look} gender={l.gender} pose={state.amen === i ? 'cheer' : 'idle'} seed={l.seed} />
            {state.amen === i && <Say text={LISTENER_WORDS[i % LISTENER_WORDS.length]} y={2.1} />}
          </group>
        ))}
      </NoShadows>
      {/* The little amplifier on the ground, its microphone on a stand, the Bible on top */}
      <group position={[0.9, 0, -0.3]}>
        <mesh position={[0, 0.3, 0]} material={M.amp} castShadow>
          <boxGeometry args={[0.45, 0.6, 0.35]} />
        </mesh>
        <mesh position={[0, 0.32, 0.18]} material={M.grille}>
          <boxGeometry args={[0.36, 0.4, 0.01]} />
        </mesh>
        <mesh position={[0, 0.63, 0]} material={M.bible}>
          <boxGeometry args={[0.24, 0.05, 0.3]} />
        </mesh>
        <mesh position={[0, 0.63, 0]} material={M.page}>
          <boxGeometry args={[0.22, 0.04, 0.31]} />
        </mesh>
        <mesh position={[0.06, 0.66, 0.04]} material={M.red}>
          <boxGeometry args={[0.02, 0.005, 0.2]} />
        </mesh>
      </group>
      <group position={[-0.55, 0, 0.35]}>
        <mesh position={[0, 0.7, 0]} material={M.mic}>
          <cylinderGeometry args={[0.015, 0.015, 1.4, 6]} />
        </mesh>
        <mesh position={[0, 1.42, 0.04]} rotation={[0.6, 0, 0]} material={M.mic}>
          <cylinderGeometry args={[0.035, 0.02, 0.16, 8]} />
        </mesh>
      </group>
    </group>
  )
}

// ——— Les élèves ———

/** A schoolbag on someone's back. */
function Bag({ m, scale }: { m: THREE.Material; scale: number }) {
  return (
    <mesh position={[0, 1.15 * scale, -0.2 * scale]} material={m} castShadow>
      <boxGeometry args={[0.34 * scale, 0.4 * scale, 0.16 * scale]} />
    </mesh>
  )
}

function Pupils({ spot }: { spot: Spot }) {
  const groups = useMemo(() => {
    const r = rng(spot.id)
    // Three or four little groups, walking the same way, a few metres apart.
    const n = 3 + Math.floor(r() * 2)
    return [...Array(n)].map((_, g) => {
      const size = 2 + Math.floor(r() * 3)
      const small = r() < 0.5
      const kids = [...Array(size)].map((_, i) => {
        const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
        const base = randomLook(gender, r)
        // The uniform: khaki for the boys, the blue skirt and the light shirt for the girls.
        const look = { ...base, outfit: 'uniforme', outfitColor: gender === 'femme' ? '#dbe8f5' : '#c8b07a', accessory: 'none', beard: 'none', hair: gender === 'femme' ? (r() < 0.5 ? 'braids' : 'puffs') : 'short' } as Required<Look>
        return { gender, look, seed: r() * 100, across: (i - (size - 1) / 2) * 0.75, behind: (i % 2) * 0.6, bag: M.bag[Math.floor(r() * M.bag.length)] }
      })
      return { kids, scale: small ? 0.68 : 0.82, head: small ? 1.25 : 1.12, offset: g * (7 + r() * 6), speed: 1.05 + r() * 0.25 }
    })
  }, [spot.id])
  const refs = useRef<(THREE.Group | null)[]>([])
  const side = spot.seed < 0.5 ? 1 : -1
  // Morning: towards +x (school); noon and evening: back towards -x (home).
  const dir = () => (clock()[1] < 10 ? 1 : -1)
  const span = spot.len - 6
  useFrame(() => {
    const t = worldTime()
    const d = dir()
    groups.forEach((g, i) => {
      const el = refs.current[i]
      if (!el) return
      const run = (t * g.speed + g.offset + spot.seed * span) % span
      el.position.set(d * (run - span / 2), 0, side * (spot.w / 2 + 1.1))
      el.rotation.y = d > 0 ? Math.PI / 2 : -Math.PI / 2
    })
  })
  return (
    <NoShadows>
      {groups.map((g, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)}>
          {g.kids.map((k, j) => (
            <group key={j} position={[k.across, 0, -k.behind]}>
              <group scale={g.scale}>
                <Human look={k.look} gender={k.gender} pose="walk" seed={k.seed} headScale={g.head} />
              </group>
              <Bag m={k.bag} scale={g.scale} />
            </group>
          ))}
        </group>
      ))}
    </NoShadows>
  )
}

// ——— Les fonctionnaires du Plateau ———

const GOING_IN = ['On est en retard ou bien ?', 'Le chef est déjà là ?', 'Bonjour bonjour !', 'Faut signer la présence d’abord.']
const GOING_HOME = ['Bon, on a fini pour aujourd’hui !', 'C’est la descente !', 'Le dossier là, ce sera demain.', 'On se voit demain, hein !', 'Le patron est parti, on bouge !', 'Faut éviter les embouteillages.']

function Fonctionnaires({ spot }: { spot: Spot }) {
  const friday = clock()[0] === 4
  const groups = useMemo(() => {
    const r = rng(spot.id)
    // Small groups of colleagues, walking together, a few metres apart.
    const n = 3 + Math.floor(r() * 3)
    return [...Array(n)].map((_, g) => {
      const size = 1 + Math.floor(r() * 3)
      const people = [...Array(size)].map((_, i) => {
        const gender: 'femme' | 'homme' = r() < 0.45 ? 'femme' : 'homme'
        const base = randomLook(gender, r)
        // The office clothes; on Friday the pagne, as the administration wears it.
        const outfit = friday ? (gender === 'femme' ? (r() < 0.5 ? 'pagne' : 'kaba') : 'chemise-pagne') : gender === 'femme' ? ['jupe', 'suit', 'chemise', 'pagne'][Math.floor(r() * 4)] : ['suit', 'chemise', 'chemise', 'bazin'][Math.floor(r() * 4)]
        const look = { ...base, outfit, outfitColor: friday ? base.outfitColor : ['#1f2a44', '#2b2f3a', '#f4f1ea', '#bcd4ee', '#5b3a29', '#7a1f2b'][Math.floor(r() * 6)], wear: 'neuf', marks: 'none' } as Required<Look>
        return { gender, look, seed: r() * 100, across: (i - (size - 1) / 2) * 0.8, behind: (i % 2) * 0.5, carry: r() < 0.6 ? M.briefcase : M.folder }
      })
      return { people, offset: g * (8 + r() * 8), speed: 0.9 + r() * 0.3, talk: r() }
    })
  }, [spot.id, friday])
  const refs = useRef<(THREE.Group | null)[]>([])
  const side = spot.seed < 0.5 ? 1 : -1
  const span = spot.len - 6
  const [line, setLine] = useState(-1)
  useFrame(() => {
    const t = worldTime()
    const [day, h] = clock()
    const d = officeWalk(day, h) || 1
    groups.forEach((g, i) => {
      const el = refs.current[i]
      if (!el) return
      const run = (t * g.speed + g.offset + spot.seed * span) % span
      el.position.set(d * (run - span / 2), 0, side * (spot.w / 2 + 1.1))
      el.rotation.y = d > 0 ? Math.PI / 2 : -Math.PI / 2
    })
    // Now and then one of them says something to the others.
    const k = Math.floor(t / 7)
    const next = hash(k, spot.seed * 50) < 0.5 ? k : -1
    if (next !== line) setLine(next)
  })
  const [day, h] = clock()
  const going = officeWalk(day, h)
  const words = going > 0 ? GOING_IN : GOING_HOME
  const speaker = line < 0 ? -1 : Math.floor(hash(line, 3) * groups.length)
  return (
    <NoShadows>
      {groups.map((g, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)}>
          {g.people.map((p, j) => (
            <group key={j} position={[p.across, 0, -p.behind]}>
              <Human look={p.look} gender={p.gender} pose="walk" seed={p.seed} />
              {/* The briefcase in the hand, or the folder under the arm */}
              <mesh position={p.carry === M.briefcase ? [0.36, 0.72, 0.02] : [0.3, 1.18, 0.05]} material={p.carry} castShadow>
                <boxGeometry args={p.carry === M.briefcase ? [0.1, 0.32, 0.42] : [0.05, 0.3, 0.24]} />
              </mesh>
            </group>
          ))}
          {speaker === i && <Say key={line} text={words[Math.floor(hash(line, 11) * words.length)]} y={2.45} />}
        </group>
      ))}
    </NoShadows>
  )
}

export type { Spot as StreetPeopleSpot }
