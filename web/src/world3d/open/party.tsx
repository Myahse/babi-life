import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { Vehicle } from '../vehicles'
import { turnTo } from './shared'
import { RP_TABLES } from './ruePrincesse'
import { BLOCKHAUSS_TABLES } from './blockhauss'
import type { XZ } from './geo'
import type { Npc } from './OpenWorld'

// The party nights at the famous spots: the Rue Princesse in Yopougon and
// the maquis of Blockhauss on the lagoon. From roughly 20 h to 4 h, busiest
// from Thursday to Saturday, the party is seen from far: coloured beams
// sweeping the sky and a glow over the place. Up close: the DJ and his
// atalaku on the mic, the sound system, the dance floor packed with
// coupé-décalé, the tables drinking, the brochettes, the alloco and the
// cigarette seller, the moto-taxis waiting, people arriving and leaving in
// little groups, a couple, someone filming, a quarrel that friends calm down.
// People talk to one another (and say so in bubbles), and they react to the
// Sim: they turn to it, call it over, offer a drink, make room on the floor.
// Everything is worked out from the shared clock: every player sees the same.
//
// In the landmark's frame (+z toward the street), drawn inside its group.

type Seller = 'brochette' | 'alloco' | 'cigarette'
type Spot = [number, number, number] // x, z, facing
export type PartyLayout = {
  /** The name the atalaku shouts. */
  where: string
  /** The dance floor: centre x, z, width, depth. */
  floor: [number, number, number, number]
  dj: Spot
  speakers: Spot[]
  tables: XZ[]
  sellers: { at: Spot; kind: Seller }[]
  motos: Spot[]
  /** From the street to the floor: who arrives walks it, who leaves walks it back. */
  way: XZ[]
  /** The projectors: x, y, z. */
  beams: [number, number, number][]
  couple: Spot
  film: Spot
  fight: Spot
  /** Where friends stand talking, two or three together. */
  talk: XZ[]
  colours: string[]
}

export const PARTIES: Record<string, PartyLayout> = {
  'yop-rue-princesse': {
    where: 'Yopougon',
    floor: [0, -2, 2.6, 24],
    dj: [0, -26.6, 0],
    speakers: [[-2.6, -26.4, 0], [2.6, -26.4, 0], [-3.1, -14, Math.PI / 2], [3.1, -14.4, -Math.PI / 2]],
    tables: RP_TABLES,
    sellers: [
      { at: [-2.5, 25.2, Math.PI / 2], kind: 'brochette' },
      { at: [2.6, 25.2, -Math.PI / 2], kind: 'alloco' },
      { at: [2.9, 12.8, -Math.PI / 2], kind: 'cigarette' },
    ],
    motos: [[6.2, 27.4, -Math.PI / 2], [7.3, 27.4, -Math.PI / 2], [8.4, 27.4, -Math.PI / 2], [-6.4, 27.4, -Math.PI / 2], [-7.5, 27.4, -Math.PI / 2]],
    way: [[0, 34], [0, 26.5], [0, 11]],
    beams: [[-8.25, 6.8, 19.5], [8.25, 6.8, 6], [-8.25, 6.8, -7.5], [8.25, 6.8, -21], [0, 0.6, -28.2]],
    couple: [-2.7, 13, 0],
    film: [1.1, 11.6, Math.PI],
    fight: [0, 19.6, 0],
    talk: [[-2.9, -14.2], [2.9, -7.4], [-2.9, 0]],
    colours: ['#ff2d95', '#2de2ff', '#ffd23f', '#a35bff', '#5bff8a'],
  },
  'cocody-blockhauss-maquis': {
    where: 'Blockhauss',
    floor: [0, -6, 9, 7],
    dj: [0, -14, 0],
    speakers: [[-3.4, -14, 0], [3.4, -14, 0], [-6.2, -2.2, Math.PI / 4], [6.2, -2.2, -Math.PI / 4]],
    tables: BLOCKHAUSS_TABLES,
    sellers: [
      { at: [6.6, 17, -Math.PI / 2], kind: 'brochette' },
      { at: [-5.2, 18.6, Math.PI / 2], kind: 'alloco' },
      { at: [12.6, 14, -Math.PI / 2], kind: 'cigarette' },
    ],
    motos: [[14.2, 21, -Math.PI / 2], [15.3, 21, -Math.PI / 2], [16.4, 21, -Math.PI / 2], [17.5, 21, -Math.PI / 2]],
    way: [[0, 31], [0, 21.5], [0, -1]],
    beams: [[-15, 0.5, -24.5], [15, 0.5, -24.5], [-6, 0.5, -25], [6, 0.5, -25], [0, 3.4, -15]],
    couple: [8, -23.6, Math.PI],
    film: [-3.6, -0.6, Math.PI + 0.3],
    fight: [3.2, 14, 0],
    talk: [[-15.6, 7.5], [15.4, 8.6], [-7.5, -19], [9, 2.5]],
    colours: ['#2de2ff', '#ff2d95', '#ffd23f', '#5bff8a', '#a35bff'],
  },
}

/* ---------- When ---------- */

const DAY = 86400
/** Thursday to Saturday nights are the big ones (the game's epoch is a Monday). */
const WEEK = [0.35, 0.35, 0.45, 0.75, 1, 1, 0.55]
/**
 * How lively the party is at a time, from 0 (nothing) to 1 (packed). A
 * night belongs to the evening it started: 2 a.m. on Saturday is still
 * Friday night.
 */
export function partyLevel(t = worldTime()) {
  const h = (((t / 3600) % 24) + 24) % 24
  const night = ((Math.floor((t - 6 * 3600) / DAY) % 7) + 7) % 7
  const hour = h >= 19 && h < 20 ? 0.25 : h >= 20 && h < 21 ? 0.55 : h >= 21 && h < 22 ? 0.8 : h >= 22 || h < 3 ? 1 : h < 4 ? 0.7 : h < 5 ? 0.35 : 0
  return WEEK[night] * hour
}

function usePartyLevel() {
  const [level, setLevel] = useState(() => Math.round(partyLevel() * 20) / 20)
  const tick = useRef(0)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 4) return
    tick.current = 0
    const l = Math.round(partyLevel() * 20) / 20
    if (l !== level) setLevel(l)
  })
  return level
}

/* ---------- The sound: louder as the Sim comes near (read by Play's Soundtrack) ---------- */

const loud = new Map<string, number>()
const listeners = new Set<() => void>()
let heard: { id: string | null; level: number } = { id: null, level: 0 }
function setLoud(id: string, v: number) {
  if ((loud.get(id) ?? 0) === v) return
  if (v > 0) loud.set(id, v)
  else loud.delete(id)
  let best: { id: string | null; level: number } = { id: null, level: 0 }
  for (const [k, l] of loud) if (l > best.level) best = { id: k, level: l }
  if (best.id === heard.id && best.level === heard.level) return
  heard = best
  listeners.forEach((f) => f())
}
/** The party the Sim hears, and how loud (0–1): the nearest, in steps of a tenth. */
export function usePartySound() {
  return useSyncExternalStore(
    (f) => (listeners.add(f), () => void listeners.delete(f)),
    () => heard,
    () => heard,
  )
}

/* ---------- Who ---------- */

const NAMES = {
  femme: ['Awa', 'Adjoua', 'Fatou', 'Akissi', 'Grâce', 'Nadège', 'Ange', 'Tatiana', 'Prisca', 'Josiane', 'Mariam', 'Carine', 'Inès', 'Rokia'],
  homme: ['Kouadio', 'Yao', 'Moussa', 'Serge', 'Didier', 'Junior', 'Arouna', 'Fabrice', 'Brice', 'Hervé', 'Wilfried', 'Zié', 'Cédric', 'Ismaël'],
}
type Who = Npc
function people(seed: string, n: number) {
  const r = rng(seed)
  return [...Array(n)].map((_, i): Who => {
    const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
    const look = randomLook(gender, r)
    // Dressed for the night out.
    const outfit = gender === 'femme' ? ['robe', 'jupe', 'casual', 'kaba'][Math.floor(r() * 4)] : ['chemise', 'bazin', 'blouson', 'chemise-pagne', 'casual'][Math.floor(r() * 5)]
    const names = NAMES[gender]
    return { id: `${seed}-${i}`, name: names[Math.floor(r() * names.length)], gender, look: { ...look, outfit }, seed: Math.floor(r() * 100000) }
  })
}

/* ---------- What they say ---------- */

const CHAT = [
  'On est ensemble !',
  'Gbê est mieux que drap !',
  'Môgô, faut pas fatiguer !',
  'Laisse-le, c’est son morceau !',
  'Y a fohi, on est là !',
  'Sers-nous deux sucreries !',
  'Demain on dort, ce soir on bouge !',
  'Le DJ a mis le feu dèh !',
  'C’est chaud ici !',
  'Tu as vu son décalé ? Hum !',
  'Ce soir on va faire boucan !',
  'Hahaha, tu es fou toi !',
  'Santé ! À nous !',
  'Ma go, tu es en forme oh !',
  'On rentre pas avant 4 h hein !',
]
const ATALAKU = (where: string) => [`On dit quoi ${where} ?!`, 'Les mains en l’air !', 'Coupé ! Décalé !', 'Ambiance facile !', 'C’est le boucan ce soir !', 'Faut pas dormir oh !', 'DJ, envoie le son !', 'Tout le monde au milieu !']
const FIGHT = ['Tu me cherches ?!', 'Laisse, laisse ! C’est pas bagarre ici !', 'Pardon, on est venus s’amuser !']
const PEACE = ['On est ensemble, c’est fini !', 'C’est rien, mon frère !']
function toSim(simGender: 'femme' | 'homme') {
  const toi = simGender === 'femme' ? ['Ma go', 'Ma sœur', 'Ma chérie'] : ['Mon gars', 'Mon frère', 'Le boss']
  const t = toi[Math.floor(Math.random() * toi.length)]
  return {
    table: ['Bonne arrivée ! Viens t’asseoir avec nous !', `${t}, on t’offre une sucrerie, assieds-toi !`, 'Viens, il reste une chaise ici !', 'Santé ! Viens trinquer avec nous !'],
    dance: ['Viens on va danser !', `${t}, tu danses pas ? Viens !`, 'Montre-nous ton décalé !', 'Faut pas rester là-bas, viens au milieu !'],
    floor: ['Ambiance ! Place, place !', `Eh ${t.toLowerCase()} danse oh !`, 'Coupé-décalé ! Vas-y !'],
    brochette: ['Brochettes chaudes ! 500 seulement !', `${t}, viens goûter mes brochettes !`],
    alloco: ['Alloco, alloco ! Ça sort du feu !', 'Alloco-poisson, c’est bon dèh !'],
    cigarette: ['Cigarette, bonbon, chewing-gum !', 'Crédit aussi y a !'],
    moto: ['Moto ! On te dépose où ?', `${t}, moto ? Je te dépose !`],
  }
}

/* ---------- The scene ---------- */

/** What the party knows of the Sim, in its frame: where it is, whether it's near, on the floor, standing still. */
type Sense = { x: number; z: number; near: boolean; close: boolean; onFloor: boolean; still: boolean }

/** Said aloud over someone's head for a few seconds. */
type Said = { key: string; text: string } | null

const NEAR = 120 // metres: the crowd is drawn when the Sim is this close
const HEAR = 140 // and heard from this far

export function Party({ id, night, simGender = 'homme', onTalk }: { id: string; night: boolean; simGender?: 'femme' | 'homme'; onTalk?: (npc: Npc) => void }) {
  const layout = PARTIES[id]
  const level = usePartyLevel()
  const on = night && level > 0 && !!layout
  const root = useRef<THREE.Group>(null)
  const sense = useRef<Sense>({ x: 1e6, z: 1e6, near: false, close: false, onFloor: false, still: false })
  const [near, setNear] = useState(false)
  const [said, setSaid] = useState<Said>(null)
  const tick = useRef(0)
  const nextChat = useRef(3)
  const nextCall = useRef(2.5)
  const v = useMemo(() => new THREE.Vector3(), [])
  const cast = useMemo(() => people(`party${id}`, 104), [id])

  useFrame((_, dt) => {
    const g = root.current
    if (!g || !layout) return
    tick.current += dt
    if (tick.current < 0.25) return
    const step = tick.current
    tick.current = 0
    // Where the Sim is, in the party's frame.
    g.updateWorldMatrix(true, false)
    g.worldToLocal(v.set(whereabouts.sim[0], whereabouts.simY, whereabouts.sim[1]))
    const [fx, fz, fw, fd] = layout.floor
    const d = Math.hypot(v.x - fx, v.z - fz)
    const s = sense.current
    s.x = v.x
    s.z = v.z
    s.near = on && d < 45
    s.close = on && d < 26
    s.onFloor = on && Math.abs(v.x - fx) < fw / 2 + 0.8 && Math.abs(v.z - fz) < fd / 2 + 0.8
    s.still = whereabouts.simPose === 'idle'
    const n = on && d < NEAR
    if (n !== near) setNear(n)
    setLoud(id, on ? Math.round(level * Math.max(0, Math.min(1, (HEAR - d) / (HEAR - 18))) * 10) / 10 : 0)
    if (!n) return
    // People talking to one another: a line now and then over someone's head.
    nextChat.current -= step
    if (s.near && nextChat.current <= 0) {
      nextChat.current = 3.5 + Math.random() * 3
      const r = Math.random()
      if (r < 0.3) setSaid({ key: 'atalaku', text: pick(ATALAKU(layout.where)) })
      else setSaid({ key: `talk${Math.floor(Math.random() * layout.talk.length)}-${Math.floor(Math.random() * 2)}`, text: pick(CHAT) })
    }
    // And to the Sim: whoever's nearest of the ones with something to offer.
    nextCall.current -= step
    if (s.close && nextCall.current <= 0) {
      nextCall.current = 22 + Math.random() * 14
      const lines = toSim(simGender)
      const options: { key: string; who: Who; text: string; d: number }[] = []
      const dist = (x: number, z: number) => Math.hypot(v.x - x, v.z - z)
      layout.sellers.forEach((sl, i) => options.push({ key: `seller${i}`, who: cast[80 + i], text: pick(lines[sl.kind]), d: dist(sl.at[0], sl.at[1]) }))
      if (layout.motos.length) options.push({ key: 'moto', who: cast[84], text: pick(lines.moto), d: dist(layout.motos[0][0], layout.motos[0][1]) + 2 })
      layout.talk.forEach(([x, z], i) => options.push({ key: `talk${i}-0`, who: cast[60 + i * 3], text: pick(lines.dance), d: dist(x, z) }))
      options.push({ key: 'host', who: cast[86], text: pick(s.onFloor ? lines.floor : lines.table), d: dist(layout.tables[0][0], layout.tables[0][1]) })
      const best = options.sort((a, b) => a.d - b.d)[Math.random() < 0.7 ? 0 : 1] ?? options[0]
      setSaid({ key: best.key, text: best.text })
    }
  })
  useEffect(() => {
    if (!said) return
    const t = setTimeout(() => setSaid(null), 3800)
    return () => clearTimeout(t)
  }, [said])
  useEffect(() => () => setLoud(id, 0), [id])

  if (!layout) return null
  const talk = (who: Who) => onTalk?.(who)
  const bubbleFor = (key: string, who: Who) => (said?.key === key ? <Bubble name={who.name} text={said.text} onClick={() => talk(who)} /> : null)
  return (
    <group ref={root}>
      {on && <Beams layout={layout} level={level} />}
      {on && <Glow layout={layout} level={level} />}
      {on && near && (
        <NoShadows>
          <Crowd layout={layout} level={level} cast={cast} sense={sense} bubbleFor={bubbleFor} onTalk={talk} />
        </NoShadows>
      )}
    </group>
  )
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

function Bubble({ name, text, onClick }: { name: string; text: string; onClick: () => void }) {
  return (
    <Html position={[0, 2.35, 0]} center zIndexRange={[25, 0]}>
      <button onClick={onClick} className="rounded-2xl rounded-bl-sm border border-black/5 bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">
        <span className="text-[var(--color-orange)]">{name}</span> · {text}
      </button>
    </Html>
  )
}

/* ---------- Seen from far: the beams and the glow ---------- */

/** A beam: a long cone, bright at the projector, fading up into the sky. */
const BEAM_GEO = (() => {
  const g = new THREE.CylinderGeometry(9, 0.35, 170, 14, 1, true)
  g.translate(0, 85, 0)
  return g
})()
function fade(stops: [number, string][]) {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 128)
  for (const [k, col] of stops) grad.addColorStop(k, col)
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 128)
  return new THREE.CanvasTexture(c)
}
const beamMat = new THREE.MeshBasicMaterial({
  map: fade([[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0.16)'], [0.9, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0.7)']]),
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  fog: false,
})

function Beams({ layout, level }: { layout: PartyLayout; level: number }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(BEAM_GEO, beamMat, layout.beams.length)
    const c = new THREE.Color()
    layout.beams.forEach((_, i) => m.setColorAt(i, c.set(layout.colours[i % layout.colours.length])))
    m.frustumCulled = false
    m.renderOrder = 5
    return m
  }, [layout])
  const o = useMemo(() => new THREE.Object3D(), [])
  const at = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const t = worldTime()
    // Up close a beam is a haze, not a wall of colour: fainter when the camera is in the party.
    const d = mesh.getWorldPosition(at).distanceTo(camera.position)
    beamMat.opacity = (0.22 + level * 0.3) * Math.min(1, Math.max(0.3, (d - 15) / 60))
    layout.beams.forEach(([x, y, z], i) => {
      // Each sweeps the sky on its own slow figure, now crossing the others.
      o.position.set(x, y, z)
      o.rotation.set(Math.sin(t * 0.45 + i * 1.9) * 0.42, 0, Math.cos(t * 0.31 + i * 2.7) * 0.42)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <primitive object={mesh} />
      {/* The projectors themselves, on the roofs and on the ground */}
      {layout.beams.map(([x, y, z], i) => (
        <mesh key={i} geometry={PROJECTOR} material={projectorMat} position={[x, y + 0.2, z]} />
      ))}
    </>
  )
}

const PROJECTOR = new THREE.BoxGeometry(0.6, 0.4, 0.6)
const projectorMat = new THREE.MeshLambertMaterial({ color: '#202024' })
const domeMat = new THREE.MeshBasicMaterial({ map: fade([[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,1)']]), color: '#ff5cc8', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
const DOME = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const poolMat = new THREE.MeshBasicMaterial({ map: fade([[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,1)']]), color: '#ffb36b', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })

/** The haze over the place, lit from below in the party's colours, and the warm light on the ground. */
function Glow({ layout, level }: { layout: PartyLayout; level: number }) {
  const dome = useRef<THREE.Mesh>(null)
  const [fx, fz] = layout.floor
  const at = useMemo(() => new THREE.Vector3(), [])
  const col = useMemo(() => new THREE.Color(), [])
  const cols = useMemo(() => layout.colours.map((c) => new THREE.Color(c)), [layout])
  useFrame(({ camera }) => {
    const m = dome.current
    if (!m) return
    // Seen from outside it's the glow over the roofs; from inside, it would only wash the scene out.
    const d = m.getWorldPosition(at).distanceTo(camera.position)
    const t = worldTime() * 0.15
    const k = Math.floor(t) % cols.length
    col.copy(cols[k]).lerp(cols[(k + 1) % cols.length], t % 1)
    domeMat.color.copy(col)
    domeMat.opacity = (0.05 + level * 0.11) * Math.min(1, Math.max(0, (d - 40) / 80))
  })
  return (
    <>
      <mesh ref={dome} geometry={DOME} material={domeMat} position={[fx, 0, fz]} scale={[38, 26, 38]} renderOrder={4} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[fx, 0.09, fz]} material={poolMat}>
        <circleGeometry args={[22, 24]} />
      </mesh>
    </>
  )
}
// The disc's texture goes from the edge (0) to the middle (1) along v: map it radially.
poolMat.onBeforeCompile = (s) => {
  s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', 'float rr = 1.0 - length(vMapUv - 0.5) * 2.0; diffuseColor.a *= clamp(rr, 0.0, 1.0) * clamp(rr, 0.0, 1.0);')
}

/* ---------- Up close: the crowd ---------- */

type CrowdProps = { layout: PartyLayout; level: number; cast: Who[]; sense: React.RefObject<Sense>; bubbleFor: (key: string, who: Who) => React.ReactNode; onTalk: (who: Who) => void }

function Crowd({ layout, level, cast, sense, bubbleFor, onTalk }: CrowdProps) {
  const [fx, fz, fw, fd] = layout.floor
  const [dx, dz] = layout.dj
  // The dancers: spread over the floor (a sunflower pattern squeezed into its rectangle), facing the DJ or a partner.
  const dancers = useMemo(() => {
    const out: { p: XZ; r: number }[] = []
    const n = 18
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996
      const k = Math.sqrt((i + 0.5) / n)
      const p: XZ = [fx + Math.cos(a) * k * (fw / 2 - 0.3), fz + Math.sin(a) * k * (fd / 2 - 0.3)]
      // Every third one dances facing the one before: a dance-off.
      const r = i % 3 === 2 ? Math.atan2(out[i - 1].p[0] - p[0], out[i - 1].p[1] - p[1]) : Math.atan2(dx - p[0], dz - p[1]) + Math.sin(i * 3.1) * 0.5
      out.push({ p, r })
    }
    return out
  }, [fx, fz, fw, fd, dx, dz])
  const shownDancers = Math.round(6 + 12 * level)
  // The seats: four round each table; filled with the night, at most 16.
  const seats = useMemo(() => {
    const out: { p: XZ; r: number; t: number }[] = []
    layout.tables.forEach(([x, z], t) => {
      for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]] as const) out.push({ p: [x + ox, z + oz], r: Math.atan2(-ox, -oz), t })
    })
    const r = rng(`seats${layout.where}`)
    return out.map((s) => ({ ...s, k: r() })).sort((a, b) => a.k - b.k)
  }, [layout])
  const seated = seats.slice(0, Math.round(6 + 10 * level))
  // The bottles on the tables that have someone.
  const busyTables = useMemo(() => [...new Set(seated.map((s) => s.t))], [seated])

  let n = 0
  const next = () => cast[n++ % 60]
  return (
    <group>
      <DJ at={layout.dj} who={cast[90]} atalaku={cast[91]} bubble={bubbleFor('atalaku', cast[91])} onTalk={onTalk} />
      {layout.speakers.map((s, i) => (
        <Speaker key={i} at={s} />
      ))}
      <FloorLights layout={layout} />
      {dancers.slice(0, shownDancers).map((d, i) => {
        const who = next()
        return <Person key={`d${i}`} who={who} p={d.p} r={d.r} pose={i % 7 === 3 ? 'cheer' : 'dance'} sense={sense} react={{ r: 4.5, pose: 'cheer', floor: true }} onTalk={onTalk} />
      })}
      {seated.map((s, i) => {
        const who = next()
        return <Person key={`s${i}`} who={who} p={s.p} r={s.r} pose={i % 4 === 1 ? 'eat' : 'drink'} sense={sense} react={{ r: 3.2, pose: 'drink' }} onTalk={onTalk} />
      })}
      <Bottles tables={busyTables.map((t) => layout.tables[t])} />
      {/* Friends standing talking, facing one another; the one who invites someone to dance */}
      {layout.talk.map(([x, z], i) => {
        const trio = i % 2 === 0
        const members = trio ? 3 : 2
        return [...Array(members)].map((_, k) => {
          const a = (k / members) * Math.PI * 2 + i
          const p: XZ = [x + Math.sin(a) * 0.62, z + Math.cos(a) * 0.62]
          const who = cast[60 + i * 3 + k]
          return <Person key={`t${i}-${k}`} who={who} p={p} r={a + Math.PI} pose={k === 1 && trio ? 'cheer' : 'talk'} sense={sense} react={{ r: 5, pose: 'wave' }} onTalk={onTalk} bubble={bubbleFor(`talk${i}-${k}`, who)} />
        })
      })}
      <Invite table={layout.tables[1]} who={cast[75]} onTalk={onTalk} />
      <Host table={layout.tables[0]} who={cast[86]} sense={sense} bubble={bubbleFor('host', cast[86])} onTalk={onTalk} />
      {/* The couple, the one filming */}
      <group position={[layout.couple[0], 0, layout.couple[1]]} rotation={[0, layout.couple[2], 0]}>
        <Person who={cast[100]} p={[-0.28, 0]} r={Math.PI / 2} pose="hug" onTalk={onTalk} />
        <Person who={{ ...cast[101], gender: cast[100].gender === 'femme' ? 'homme' : 'femme', look: randomLook(cast[100].gender === 'femme' ? 'homme' : 'femme', rng(`couple${layout.where}`)) }} p={[0.28, 0]} r={-Math.PI / 2} pose="hug" onTalk={onTalk} />
      </group>
      <Filmer at={layout.film} who={cast[102]} onTalk={onTalk} />
      {level >= 0.5 && <Fight at={layout.fight} cast={[cast[77], cast[78], cast[79]]} onTalk={onTalk} />}
      {layout.sellers.map((s, i) => (
        <SellerStand key={i} at={s.at} kind={s.kind} who={cast[80 + i]} buyers={[cast[87 + i], cast[93 + i]]} level={level} bubble={bubbleFor(`seller${i}`, cast[80 + i])} onTalk={onTalk} />
      ))}
      {layout.motos.map(([x, z, r], i) => (
        <Vehicle key={i} p={[x, 0, z]} r={r} kind="moto" color={['#c92a2a', '#1c7ed6', '#212529', '#f08c00', '#2b8a3e'][i % 5]} seed={i} />
      ))}
      {layout.motos.length > 0 && (
        <Person who={cast[84]} p={[layout.motos[0][0] + 0.2, layout.motos[0][1] - 1.6]} r={Math.PI} pose="talk" sense={sense} react={{ r: 7, pose: 'wave' }} onTalk={onTalk} bubble={bubbleFor('moto', cast[84])} />
      )}
      <Arrivals way={layout.way} cast={cast.slice(40, 52)} groups={level >= 0.7 ? 3 : 2} />
    </group>
  )
}

/** Someone at the party: tap to talk. Turns to the Sim when it comes close (and changes what it's doing). */
function Person({ who, p, r = 0, pose, sense, react, bubble, onTalk }: { who: Who; p: XZ; r?: number; pose: Pose; sense?: React.RefObject<Sense>; react?: { r: number; pose: Pose; floor?: boolean }; bubble?: React.ReactNode; onTalk: (who: Who) => void }) {
  const ref = useRef<THREE.Group>(null)
  const [turned, setTurned] = useState(false)
  useFrame(() => {
    const g = ref.current
    const s = sense?.current
    if (!g || !s || !react) return
    const d = Math.hypot(s.x - p[0], s.z - p[1])
    // On the floor, the dancers round the Sim make room and cheer it on; elsewhere, people look round at it.
    const on = s.near && d < react.r && (!react.floor || (s.onFloor && s.still))
    if (on !== turned) setTurned(on)
    g.rotation.y = turnTo(g.rotation.y, on && d > 0.3 ? Math.atan2(s.x - p[0], s.z - p[1]) : r, 0.15)
  })
  return (
    <group ref={ref} position={[p[0], 0, p[1]]} rotation={[0, r, 0]} onClick={(e) => (e.stopPropagation(), onTalk(who))}>
      <Human look={who.look} gender={who.gender} pose={turned && react ? react.pose : pose} seed={who.seed % 100} />
      {bubble}
    </group>
  )
}

const M = {
  black: new THREE.MeshLambertMaterial({ color: '#141416' }),
  grey: new THREE.MeshLambertMaterial({ color: '#3a3a3f' }),
  cone: new THREE.MeshLambertMaterial({ color: '#4a4a4f' }),
  wood: new THREE.MeshLambertMaterial({ color: '#7a5233' }),
  pagne: new THREE.MeshLambertMaterial({ color: '#f08c00' }),
  coal: new THREE.MeshLambertMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 1 }),
  meat: new THREE.MeshLambertMaterial({ color: '#7a3a1a' }),
  oil: new THREE.MeshLambertMaterial({ color: '#d9a02a', emissive: '#7a4a00', emissiveIntensity: 0.4 }),
  plantain: new THREE.MeshLambertMaterial({ color: '#f2b631' }),
  basin: new THREE.MeshLambertMaterial({ color: '#c0c7cf' }),
  screen: new THREE.MeshBasicMaterial({ color: '#cfe8ff' }),
  bulb: new THREE.MeshBasicMaterial({ color: '#fff2c4' }),
  green: new THREE.MeshLambertMaterial({ color: '#2f6b2a' }),
  brown: new THREE.MeshLambertMaterial({ color: '#6b3a12' }),
  glass: new THREE.MeshLambertMaterial({ color: '#d8e6f0' }),
  led: new THREE.MeshBasicMaterial({ color: '#ff2d95' }),
}
const BOX = new THREE.BoxGeometry(1, 1, 1)
const B = ({ p, s, m, r = 0 }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; r?: number }) => <mesh geometry={BOX} material={m} position={p} scale={s} rotation={[0, r, 0]} />

// The LEDs on the booth and the speakers change colour with the music: one material, shared.
const LED_COLOURS = ['#ff2d95', '#2de2ff', '#ffd23f', '#a35bff', '#5bff8a'].map((c) => new THREE.Color(c))
function useLeds() {
  useFrame(() => {
    const beat = Math.floor((worldTime() * 128) / 60)
    M.led.color.copy(LED_COLOURS[beat % LED_COLOURS.length])
  })
}

/** The DJ behind his table and laptop, the atalaku beside him on the mic. */
function DJ({ at, who, atalaku, bubble, onTalk }: { at: Spot; who: Who; atalaku: Who; bubble: React.ReactNode; onTalk: (w: Who) => void }) {
  useLeds()
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, at[2], 0]}>
      <B p={[0, 0.5, 0.75]} s={[2, 1, 0.7]} m={M.black} />
      <B p={[0, 0.5, 1.11]} s={[1.9, 0.9, 0.02]} m={M.pagne} />
      <B p={[0, 0.06, 1.13]} s={[1.9, 0.08, 0.02]} m={M.led} />
      <B p={[0, 1.02, 1.11]} s={[1.9, 0.04, 0.02]} m={M.led} />
      <group position={[-0.3, 1.04, 0.7]}>
        <B p={[0, 0, 0]} s={[0.5, 0.03, 0.35]} m={M.grey} />
        <B p={[0, 0.17, -0.16]} s={[0.5, 0.32, 0.02]} m={M.screen} r={0} />
      </group>
      <B p={[0.45, 1.05, 0.7]} s={[0.6, 0.06, 0.4]} m={M.grey} />
      <Person who={who} p={[0, 0]} pose="busy" onTalk={onTalk} />
      <Person who={{ ...atalaku, gender: 'homme', look: { ...atalaku.look, outfit: 'chemise-pagne' } }} p={[1.5, 1.3]} r={0.3} pose="rant" bubble={bubble} onTalk={onTalk} />
    </group>
  )
}

/** A tower of speakers: the bass at the bottom, its cone thumping on the beat, the LED strip on top. */
function Speaker({ at }: { at: Spot }) {
  const bass = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = ((worldTime() * 128) / 60) % 1
    const s = 0.55 + Math.max(0, 1 - k * 4) * 0.08
    bass.current?.scale.set(s, s, 0.02)
  })
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, at[2], 0]}>
      <B p={[0, 0.65, 0]} s={[1, 1.3, 0.8]} m={M.black} />
      <B p={[0, 1.75, 0]} s={[0.85, 0.9, 0.7]} m={M.black} />
      <B p={[0, 2.45, 0]} s={[0.6, 0.5, 0.55]} m={M.black} />
      <mesh ref={bass} position={[0, 0.65, 0.41]} geometry={BOX} material={M.cone} scale={[0.55, 0.55, 0.02]} />
      <B p={[0, 1.75, 0.36]} s={[0.45, 0.45, 0.02]} m={M.cone} />
      <B p={[0, 2.45, 0.28]} s={[0.35, 0.2, 0.02]} m={M.cone} />
      <B p={[0, 2.73, 0]} s={[0.6, 0.05, 0.55]} m={M.led} />
    </group>
  )
}

const spotMats = ['#ff2d95', '#2de2ff', '#ffd23f', '#a35bff'].map((c) => new THREE.MeshBasicMaterial({ map: poolMat.map, color: c, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }))
spotMats.forEach((m) => (m.onBeforeCompile = poolMat.onBeforeCompile))
/** Coloured spots from the projectors, chasing one another over the dancers. */
function FloorLights({ layout }: { layout: PartyLayout }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const [fx, fz, fw, fd] = layout.floor
  useFrame(() => {
    const t = worldTime()
    refs.current.forEach((m, i) => {
      if (!m) return
      m.position.set(fx + Math.sin(t * 0.9 + i * 1.7) * (fw / 2), 0.1, fz + Math.cos(t * 0.63 + i * 2.3) * (fd / 2))
    })
  })
  return (
    <>
      {spotMats.map((m, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} rotation={[-Math.PI / 2, 0, 0]} material={m}>
          <circleGeometry args={[2.2, 18]} />
        </mesh>
      ))}
    </>
  )
}

/** Bottles and glasses on the tables taken. */
function Bottles({ tables }: { tables: XZ[] }) {
  return (
    <>
      {tables.map(([x, z], i) => (
        <group key={i} position={[x, 0.75, z]}>
          <B p={[-0.15, 0.13, -0.1]} s={[0.08, 0.26, 0.08]} m={i % 2 ? M.green : M.brown} />
          <B p={[0.12, 0.13, 0.05]} s={[0.08, 0.26, 0.08]} m={M.brown} />
          <B p={[0.05, 0.06, -0.2]} s={[0.07, 0.12, 0.07]} m={M.glass} />
        </group>
      ))}
    </>
  )
}

/** Someone by a table calling the friends sitting there to the floor: waving them over, then showing them the step. */
function Invite({ table, who, onTalk }: { table: XZ; who: Who; onTalk: (w: Who) => void }) {
  const [x, z] = table
  const [wave, setWave] = useState(true)
  useFrame(() => {
    const w = Math.floor(worldTime() / 6) % 2 === 0
    if (w !== wave) setWave(w)
  })
  return <Person who={who} p={[x, z - 1.9]} r={0} pose={wave ? 'wave' : 'dance'} onTalk={onTalk} />
}

/** The one who welcomes the Sim: stands by the first table and waves it over when it comes near. */
function Host({ table, who, sense, bubble, onTalk }: { table: XZ; who: Who; sense: React.RefObject<Sense>; bubble: React.ReactNode; onTalk: (w: Who) => void }) {
  return <Person who={who} p={[table[0] + 0.2, table[1] + 1.8]} r={Math.PI} pose="talk" sense={sense} react={{ r: 9, pose: 'wave' }} bubble={bubble} onTalk={onTalk} />
}

/** Someone filming the dance floor with a phone held up. */
function Filmer({ at, who, onTalk }: { at: Spot; who: Who; onTalk: (w: Who) => void }) {
  return <Person who={who} p={[at[0], at[1]]} r={at[2]} pose="film" onTalk={onTalk} />
}

/**
 * A quarrel: two square up, shouting, a friend between them holding one
 * back; then they listen; then they hug, it's over. Then it starts again a
 * while later (somebody else's beer spilt). Same moment on every screen.
 */
function Fight({ at, cast, onTalk }: { at: Spot; cast: Who[]; onTalk: (w: Who) => void }) {
  const [phase, setPhase] = useState(0)
  useFrame(() => {
    const k = (worldTime() + 13) % 70
    const p = k < 16 ? 0 : k < 26 ? 1 : k < 36 ? 2 : 3
    if (p !== phase) setPhase(p)
  })
  if (phase === 3) return null
  const [a, b, c] = cast
  const men = (w: Who): Who => ({ ...w, gender: 'homme', look: w.gender === 'homme' ? w.look : randomLook('homme', rng(`fight${w.id}`)) })
  const gap = phase === 2 ? 0.3 : 0.75
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, at[2], 0]}>
      <Person who={men(a)} p={[-gap, 0]} r={Math.PI / 2} pose={phase === 0 ? 'rant' : phase === 1 ? 'idle' : 'hug'} onTalk={onTalk} bubble={phase === 0 ? <Bubble name={men(a).name} text={FIGHT[0]} onClick={() => onTalk(a)} /> : phase === 2 ? <Bubble name={men(a).name} text={PEACE[(Math.floor(worldTime() / 70) % 2)]} onClick={() => onTalk(a)} /> : null} />
      <Person who={men(b)} p={[gap, 0]} r={-Math.PI / 2} pose={phase === 0 ? 'rant' : phase === 1 ? 'talk' : 'hug'} onTalk={onTalk} />
      <Person who={c} p={phase === 2 ? [0, 1.1] : [-0.1, 0.45]} r={phase === 2 ? Math.PI : -Math.PI / 2 - 0.4} pose={phase === 0 ? 'guard' : phase === 1 ? 'talk' : 'cheer'} onTalk={onTalk} bubble={phase === 1 ? <Bubble name={c.name} text={FIGHT[1 + (Math.floor(worldTime() / 70) % 2)]} onClick={() => onTalk(c)} /> : null} />
    </group>
  )
}

/** A seller at the party's edge: the grill or the pan or the little box of cigarettes, a bulb on a pole, one or two buying. */
function SellerStand({ at, kind, who, buyers, level, bubble, onTalk }: { at: Spot; kind: Seller; who: Who; buyers: Who[]; level: number; bubble: React.ReactNode; onTalk: (w: Who) => void }) {
  const look = kind === 'alloco' ? { ...who.look, outfit: 'pagne' } : who.look
  const seller: Who = { ...who, gender: kind === 'alloco' ? 'femme' : who.gender, look: kind === 'alloco' && who.gender !== 'femme' ? randomLook('femme', rng(`alloco${who.id}`)) : look }
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, at[2], 0]}>
      {kind === 'brochette' && (
        <group position={[0, 0, 0.75]}>
          <B p={[0, 0.45, 0]} s={[1.3, 0.9, 0.42]} m={M.black} />
          <B p={[0, 0.92, 0]} s={[1.2, 0.04, 0.36]} m={M.coal} />
          {[-0.45, -0.25, -0.05, 0.15, 0.35].map((x) => (
            <B key={x} p={[x, 0.97, 0]} s={[0.06, 0.05, 0.5]} m={M.meat} />
          ))}
        </group>
      )}
      {kind === 'alloco' && (
        <group position={[0, 0, 0.7]}>
          <B p={[0, 0.2, 0]} s={[0.55, 0.4, 0.55]} m={M.black} />
          <B p={[0, 0.41, 0]} s={[0.5, 0.03, 0.5]} m={M.coal} />
          <B p={[0, 0.48, 0]} s={[0.7, 0.1, 0.7]} m={M.oil} />
          <B p={[0.75, 0.15, 0.1]} s={[0.6, 0.3, 0.6]} m={M.basin} />
          <B p={[0.75, 0.32, 0.1]} s={[0.5, 0.05, 0.5]} m={M.plantain} />
        </group>
      )}
      {kind === 'cigarette' && (
        <group position={[0, 0, 0.6]}>
          <B p={[0, 0.45, 0]} s={[0.9, 0.9, 0.5]} m={M.wood} />
          <B p={[0, 0.92, 0]} s={[0.85, 0.06, 0.45]} m={M.glass} />
          {[-0.3, -0.1, 0.1, 0.3].map((x, i) => (
            <B key={x} p={[x, 0.98, 0]} s={[0.12, 0.06, 0.2]} m={i % 2 ? M.pagne : M.basin} />
          ))}
        </group>
      )}
      {/* The bulb on its pole */}
      <B p={[-0.8, 1.2, 0.3]} s={[0.05, 2.4, 0.05]} m={M.wood} />
      <B p={[-0.8, 2.3, 0.55]} s={[0.12, 0.14, 0.12]} m={M.bulb} />
      <Person who={seller} p={[0, 0]} pose={kind === 'cigarette' ? 'idle' : 'cook'} bubble={bubble} onTalk={onTalk} />
      {buyers.slice(0, level >= 0.6 ? 2 : 1).map((b, i) => (
        <Person key={i} who={b} p={[(i ? 0.7 : -0.5), 1.75]} r={Math.PI + (i ? -0.3 : 0.3)} pose={i ? 'talk' : 'idle'} onTalk={onTalk} />
      ))}
    </group>
  )
}

/**
 * Little groups arriving from the street and others going home, along the
 * way in: two or three walking side by side. Worked out from the clock.
 */
function Arrivals({ way, cast, groups }: { way: XZ[]; cast: Who[]; groups: number }) {
  const len = useMemo(() => way.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - way[i][0], p[1] - way[i][1]), 0), [way])
  const refs = useRef<(THREE.Group | null)[]>([])
  const PERIOD = 48
  const SPEED = 1.15
  useFrame(() => {
    const t = worldTime()
    refs.current.forEach((g, k) => {
      if (!g) return
      const u = (t + (k * PERIOD) / groups) % PERIOD
      const d = u * SPEED
      g.visible = d < len
      if (!g.visible) return
      // Even groups come in, odd ones go home.
      const along = k % 2 ? len - d : d
      let rest = along
      let i = 1
      while (i < way.length - 1 && rest > Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1])) {
        rest -= Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1])
        i++
      }
      const [a, b] = [way[i - 1], way[i]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const k2 = Math.min(1, rest / l)
      g.position.set(a[0] + (b[0] - a[0]) * k2, 0, a[1] + (b[1] - a[1]) * k2)
      const dir = Math.atan2(b[0] - a[0], b[1] - a[1])
      g.rotation.y = k % 2 ? dir + Math.PI : dir
    })
  })
  return (
    <>
      {[...Array(groups)].map((_, k) => {
        const size = k === 1 ? 2 : 3
        return (
          <group key={k} ref={(el) => void (refs.current[k] = el)}>
            {[...Array(size)].map((_, m) => {
              const w = cast[(k * 3 + m) % cast.length]
              return (
                <group key={m} position={[(m - (size - 1) / 2) * 0.75, 0, m === 1 ? -0.3 : 0]}>
                  <Human look={w.look} gender={w.gender} pose="walk" seed={w.seed % 100} speed={SPEED} />
                </group>
              )
            })}
          </group>
        )
      })}
    </>
  )
}
