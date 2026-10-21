import { useMemo } from 'react'
import * as THREE from 'three'
import { Human, type Pose } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'

// Two of Yopougon's places, in blocks:
// - the Gare de Siporex, on the route de Dabou: gbakas in files under their
//   destination boards, the apprentis calling, the shelter, the kiosks;
// - the Place Ficgayo, about a hectare of paving in the middle of the
//   commune, where the shows, veillées and meetings happen: the stage under
//   its awning, the speakers, the flags, and at night the crowd dancing.
// Their layouts are the game's; what's known of the places is in the
// backend's sources (world/world.go). Frame: +z toward the main road.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const laterite = new THREE.MeshLambertMaterial({ color: '#b9895a', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const paving = new THREE.MeshLambertMaterial({ color: '#cfc5b3', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const plaster = new THREE.MeshLambertMaterial({ color: '#f1ece2' })
const tin = new THREE.MeshLambertMaterial({ color: '#a9b0b6' })
const iron = new THREE.MeshLambertMaterial({ color: '#3a3d42' })
const wood = new THREE.MeshLambertMaterial({ color: '#7a5233' })
const black = new THREE.MeshLambertMaterial({ color: '#1c1c1e' })
const painted = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const leaves = new THREE.MeshLambertMaterial({ color: '#2f7d32' })
const lampOff = new THREE.MeshLambertMaterial({ color: '#d9dde2' })
const lampOn = new THREE.MeshBasicMaterial({ color: '#fff2cc' })
const glow = new THREE.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })

/** People of a place: looks drawn from its name, so everyone sees the same. */
function useCast(seed: string, n: number) {
  return useMemo(() => {
    const r = rng(seed)
    return [...Array(n)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'homme' : 'femme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [seed, n])
}

/** A lamp post: a mast, an arm, the lamp, lit at night. */
function lamps(at: [number, number][]) {
  const masts: Block[] = []
  const heads: Block[] = []
  for (const [x, z] of at) {
    masts.push({ p: [x, 3, z], s: [0.3, 6, 0.3] })
    heads.push({ p: [x, 6.1, z], s: [0.9, 0.3, 0.9] })
  }
  return { masts, heads }
}

/** A mango tree in blocks: a trunk and two layers of leaves. */
function trees(at: [number, number][]) {
  const trunks: Block[] = []
  const crowns: Block[] = []
  at.forEach(([x, z], i) => {
    trunks.push({ p: [x, 1.5, z], s: [0.75, 3, 0.75] })
    crowns.push({ p: [x, 4.1, z], s: [4.5, 2.2, 4.5], c: i % 2 ? '#2f7d32' : '#357f2c' }, { p: [x, 5.6, z], s: [3, 1.2, 3], c: '#3c8d36' })
  })
  return { trunks, crowns }
}

// ---------------------------------------------------------------- the gare

const LINES = [
  { to: 'ADJAMÉ', body: '#f4c430', trim: '#00a862' },
  { to: 'DABOU', body: '#2b8a3e', trim: '#ffd43b' },
  { to: 'SONGON', body: '#1971c2', trim: '#ffffff' },
  { to: 'NIANGON', body: '#f4c430', trim: '#c92a2a' },
  { to: 'ATTÉCOUBÉ', body: '#e8590c', trim: '#ffffff' },
]
const FILE_X = (i: number) => (i - (LINES.length - 1) / 2) * 8.5
const FILE_Z = [1, -6, -13]
const KIOSKS = [
  { name: 'TICKETS', wall: '#1971c2' },
  { name: 'GARBA', wall: '#e8590c' },
  { name: 'CABINE', wall: '#ff7900' },
  { name: 'BOUTIQUE', wall: '#2b8a3e' },
]

export function GareSiporex({ night }: { night: boolean }) {
  const cast = useCast('yop-gare-siporex', LINES.length + 6)
  const mats = useMemo(() => {
    const gate = lettering('GARE DE SIPOREX', '#00a862', '#ffffff', '#ffd43b')
    return {
      gate: signMaterial(gate.t),
      gateAspect: gate.aspect,
      boards: LINES.map((l) => {
        const b = lettering(l.to, '#ffffff', '#1c1c1e', l.trim === '#ffffff' ? l.body : l.trim)
        return { m: signMaterial(b.t), aspect: b.aspect }
      }),
      kiosks: KIOSKS.map((k) => {
        const b = lettering(k.name, '#ffffff', k.wall)
        return { wall: new THREE.MeshLambertMaterial({ color: k.wall }), sign: signMaterial(b.t), aspect: b.aspect }
      }),
    }
  }, [])
  for (const s of [mats.gate, ...mats.boards.map((b) => b.m), ...mats.kiosks.map((k) => k.sign)]) s.emissiveIntensity = night ? 0.9 : 0

  const { masts, heads } = useMemo(() => lamps([[-24, 8], [24, 8], [-24, -14], [24, -14], [0, 8]]), [])
  // The shelter at the back: tin on posts, benches beneath.
  const shelter = useMemo(() => {
    const posts: Block[] = []
    const benches: Block[] = []
    for (let x = -15; x <= 15; x += 6) {
      posts.push({ p: [x, 1.5, -20.5], s: [0.25, 3, 0.25] }, { p: [x, 1.5, -25], s: [0.25, 3, 0.25] })
      if (x < 15) benches.push({ p: [x + 3, 0.45, -23.5], s: [4.5, 0.12, 0.6] }, { p: [x + 3, 0.22, -23.5], s: [0.15, 0.45, 0.5] })
    }
    return { posts, benches }
  }, [])

  let who = 0
  const person = (p: [number, number, number], ry: number, pose: Pose) => {
    const c = cast[who++ % cast.length]
    return (
      <group key={who} position={p} rotation={[0, ry, 0]}>
        <TalkHuman id={`yopougon:120:${Math.round((c.seed) * 1000)}`} look={c.look} gender={c.gender} pose={pose} seed={c.seed} />
      </group>
    )
  }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -4]} scale={[58, 46, 1]} geometry={PLANE} material={laterite} receiveShadow />

      {/* The files of gbakas, each under its destination board */}
      {LINES.map((l, i) => (
        <group key={l.to}>
          {FILE_Z.map((z, k) => (
            <Vehicle key={k} p={[FILE_X(i), 0, z]} r={-Math.PI / 2} kind="gbaka" color={l.body} trim={l.trim} seed={i * 3 + k} />
          ))}
          <group position={[FILE_X(i) - 2.4, 0, 5.5]}>
            <mesh position={[0, 1.6, 0]} scale={[0.15, 3.2, 0.15]} geometry={BOX} material={iron} castShadow />
            <mesh position={[0, 3.3, 0.09]} scale={[0.5 * mats.boards[i].aspect, 0.5, 1]} geometry={PLANE} material={mats.boards[i].m} />
          </group>
        </group>
      ))}
      {/* The apprentis, at the head of their file, calling the passengers */}
      {LINES.map((_, i) => person([FILE_X(i) + 1.8, 0, 5], 0.3 * (i % 2 ? 1 : -1), 'wave'))}

      {/* The shelter, people waiting on its benches */}
      <mesh position={[0, 3.1, -22.75]} rotation={[0.06, 0, 0]} scale={[32, 0.15, 6]} geometry={BOX} material={tin} castShadow receiveShadow />
      <Blocks at={shelter.posts} material={iron} />
      <Blocks at={shelter.benches} material={wood} />
      {[-9, -2, 6].map((x) => (
        <group key={x} position={[x, -0.0, -23.3]}>{person([0, 0, 0], 0, 'sit')}</group>
      ))}

      {/* The kiosks along the side */}
      {KIOSKS.map((k, i) => (
        <group key={k.name} position={[26, 0, 2 - i * 6.5]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[0, 1.5, 0]} scale={[4.5, 3, 3]} geometry={BOX} material={mats.kiosks[i].wall} castShadow receiveShadow />
          <mesh position={[0, 1.4, 1.51]} scale={[3, 1.2, 1]} geometry={PLANE} material={black} />
          <mesh position={[0, 2.6, 1.53]} scale={[Math.min(4.2, 0.6 * mats.kiosks[i].aspect), 0.6, 1]} geometry={PLANE} material={mats.kiosks[i].sign} />
          <mesh position={[0, 3.1, 0.6]} scale={[5, 0.12, 4.5]} geometry={BOX} material={tin} castShadow />
        </group>
      ))}
      {person([23, 0, 2], Math.PI / 2, 'talk')}
      {person([23, 0, -11], Math.PI / 2, 'idle')}
      {person([-6, 0, 9], Math.PI, 'walk')}

      {/* The gate on the route de Dabou */}
      <group position={[0, 0, 15]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 9, 3, 0]} scale={[1.2, 6, 1.2]} geometry={BOX} material={plaster} castShadow />
        ))}
        <mesh position={[0, 6.6, 0]} scale={[19.5, 1.5, 0.9]} geometry={BOX} material={black} castShadow />
        {[1, -1].map((s) => (
          <mesh key={s} rotation={[0, s > 0 ? 0 : Math.PI, 0]} position={[0, 6.6, s * 0.46]} scale={[Math.min(18.5, 1.25 * mats.gateAspect), 1.25, 1]} geometry={PLANE} material={mats.gate} />
        ))}
      </group>
      <Blocks at={masts} material={iron} />
      <Blocks key={night ? 'n' : 'd'} at={heads} material={night ? lampOn : lampOff} />
    </group>
  )
}

// --------------------------------------------------------- the place Ficgayo

const SQUARE = 64
const STRIPES = ['#f77f00', '#ffffff', '#009e60']

export function PlaceFicgayo({ night }: { night: boolean }) {
  const cast = useCast('yop-ficgayo', 24)
  const mats = useMemo(() => {
    const name = lettering('PLACE FICGAYO', '#f1ece2', '#1c1c1e', '#f77f00')
    const stage = lettering('YOP CITY', '#1a1a2e', '#ff9f1c', '#ffd43b')
    return {
      name: signMaterial(name.t),
      nameAspect: name.aspect,
      stage: signMaterial(stage.t),
      stageAspect: stage.aspect,
      canopy: new THREE.MeshLambertMaterial({ color: '#f8f9fa', side: THREE.DoubleSide }),
      spotsOff: new THREE.MeshLambertMaterial({ color: '#495057' }),
      spotsOn: new THREE.MeshBasicMaterial({ color: '#ffe8a3' }),
    }
  }, [])
  mats.name.emissiveIntensity = night ? 0.5 : 0
  mats.stage.emissiveIntensity = night ? 1 : 0

  const half = SQUARE / 2
  const { masts, heads } = useMemo(() => {
    const at: [number, number][] = []
    for (let i = -2; i <= 2; i++) at.push([i * 14, half - 2], [i * 14, -half + 2])
    for (const z of [-14, 0, 14]) at.push([half - 2, z], [-half + 2, z])
    return lamps(at)
  }, [half])
  const { trunks, crowns } = useMemo(() => trees([[-half + 4, half - 6], [half - 4, half - 6], [-half + 4, -half + 9], [half - 4, -half + 9], [-half + 4, 7], [half - 4, 7]]), [half])
  // A grid of joints in the paving, every 3 m: blocks again.
  const joints = useMemo(() => {
    const out: Block[] = []
    for (let x = -half + 3; x < half; x += 3) out.push({ p: [x, 0.055, 0], s: [0.08, 0.01, SQUARE] })
    for (let z = -half + 3; z < half; z += 3) out.push({ p: [0, 0.055, z], s: [SQUARE, 0.01, 0.08] })
    return out
  }, [half])
  // The stage's truss: a frame of beams, with its lamps along the top.
  const truss = useMemo(() => {
    const beams: Block[] = [
      { p: [-8, 4.5, -20], s: [0.4, 7.5, 0.4] },
      { p: [8, 4.5, -20], s: [0.4, 7.5, 0.4] },
      { p: [0, 8.2, -20], s: [16.4, 0.4, 0.4] },
    ]
    const spots: Block[] = [...Array(7)].map((_, i) => ({ p: [-6 + i * 2, 7.8, -19.8], s: [0.5, 0.5, 0.5] }))
    return { beams, spots }
  }, [])

  // Stalls under parasols along the sides: drinks, alloco, phone credit.
  const stalls = useMemo(() => {
    const tops: Block[] = []
    const poles: Block[] = []
    const tables: Block[] = []
    const colours = ['#e03131', '#f08c00', '#1971c2', '#2b8a3e', '#ff7900', '#c2255c']
    let i = 0
    for (const side of [-1, 1])
      for (const z of [-6, 4, 14]) {
        const x = side * (half - 7)
        tops.push({ p: [x, 2.6, z], s: [3, 0.25, 3], c: colours[i++ % colours.length] })
        poles.push({ p: [x, 1.3, z], s: [0.1, 2.6, 0.1] })
        tables.push({ p: [x - side * 0.9, 0.45, z], s: [0.9, 0.9, 2.1], c: '#8a5a32' })
      }
    return { tops, poles, tables }
  }, [half])
  const dancers = night ? 20 : 4
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} scale={[SQUARE, SQUARE, 1]} geometry={PLANE} material={paving} receiveShadow />
      <Blocks at={joints} material={plaster} />

      {/* The stage at the back: its platform, the backdrop, the awning */}
      <group>
        <mesh position={[0, 0.75, -24]} scale={[18, 1.5, 9]} geometry={BOX} material={black} castShadow receiveShadow />
        <mesh position={[0, 0.75, -19.45]} scale={[18, 1.5, 0.1]} geometry={BOX} material={painted} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-6 + i * 6, 0.75, -19.38]} scale={[6, 1.5, 1]} geometry={PLANE}>
            <meshLambertMaterial color={STRIPES[i]} />
          </mesh>
        ))}
        <mesh position={[0, 5, -28.3]} scale={[18, 7, 0.4]} geometry={BOX} material={black} castShadow />
        <mesh position={[0, 6, -28.05]} scale={[1.6 * mats.stageAspect, 1.6, 1]} geometry={PLANE} material={mats.stage} />
        <mesh position={[0, 9, -24]} rotation={[-0.08, 0, 0]} scale={[20, 0.2, 10]} geometry={BOX} material={mats.canopy} castShadow />
        <Blocks at={truss.beams} material={iron} />
        <Blocks key={night ? 'n' : 'd'} at={truss.spots} material={night ? mats.spotsOn : mats.spotsOff} />
        {/* The speakers, stacked on both sides of the stage */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 11, 0, -21]}>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[0, 0.75 + k * 1.5, 0]} scale={[1.5, 1.5, 1.5]} geometry={BOX} material={black} castShadow />
            ))}
          </group>
        ))}
      </group>

      <Blocks at={stalls.tops} material={painted} color />
      <Blocks at={stalls.poles} material={iron} />
      <Blocks at={stalls.tables} material={painted} color />
      {cast.slice(14, 20).map((c, i) => (
        <group key={`v${i}`} position={[(i < 3 ? -1 : 1) * (half - 9.2), 0, [-6, 4, 14][i % 3]]} rotation={[0, i < 3 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <TalkHuman id={`yopougon:280:${Math.round((c.seed) * 1000)}`} look={c.look} gender={c.gender} pose={i % 2 ? 'talk' : 'idle'} seed={c.seed} />
        </group>
      ))}
      {night && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, -13]} scale={[26, 16, 1]} geometry={PLANE} material={glow} />}

      {/* The crowd in front of the stage: a few by day, the whole quarter at night */}
      {cast.slice(0, dancers).map((c, i) => {
        const a = i * 2.39996
        const r = 2 + Math.sqrt(i) * 2.2
        return (
          <group key={i} position={[Math.cos(a) * r, 0, -12 + Math.sin(a) * r * 0.6]} rotation={[0, Math.PI + (Math.cos(a * 3) * 0.4), 0]}>
            <TalkHuman id={`yopougon:291:${Math.round((c.seed) * 1000)}`} look={c.look} gender={c.gender} pose={night ? 'dance' : i % 2 ? 'talk' : 'idle'} seed={c.seed} />
          </group>
        )
      })}
      {!night &&
        cast.slice(20, 24).map((c, i) => (
          <group key={`w${i}`} position={[-18 + i * 11, 0, 14 - (i % 2) * 8]} rotation={[0, i * 1.7, 0]}>
            <Human look={c.look} gender={c.gender} pose="walk" seed={c.seed} />
          </group>
        ))}

      {/* The name on a low wall at the front, and the flags */}
      <group position={[0, 0, half - 1]}>
        <mesh position={[0, 0.9, 0]} scale={[21, 1.8, 0.9]} geometry={BOX} material={plaster} castShadow />
        <mesh position={[0, 0.95, 0.46]} scale={[Math.min(20, 1.3 * mats.nameAspect), 1.3, 1]} geometry={PLANE} material={mats.name} />
        {[-13, -11, 11, 13].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 4, 0]} scale={[0.15, 8, 0.15]} geometry={BOX} material={iron} castShadow />
            {STRIPES.map((c, i) => (
              <mesh key={c} position={[0.35 + i * 0.6, 7.2, 0]} scale={[0.6, 1.2, 0.05]} geometry={BOX}>
                <meshLambertMaterial color={c} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      <Blocks at={trunks} material={wood} />
      <Blocks at={crowns} material={leaves} color />
      <Blocks at={masts} material={iron} />
      <Blocks key={night ? 'ln' : 'ld'} at={heads} material={night ? lampOn : lampOff} />
    </group>
  )
}
