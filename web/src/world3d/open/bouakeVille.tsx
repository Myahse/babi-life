import { useMemo } from 'react'
import * as THREE from 'three'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { put, blocksMat, type Part } from './kit3d'
import { Bulbs, Club, Fire, Maquis, Market, People, Sign, plasticSet, seatsAround, stringLights, useFire, usePeople, useSign, type ClubSpec, type MaquisSpec, type MarketSpec, type Who } from './villeKit'
import type { Pose } from '../../avatar/Human'
import { t as tr } from '../../lib/i18n'

// Bouaké's places (the update « bouake-vivant », backend game/villes.go) that stood as the map's plain
// buildings, in the game's blocks:
// - the Allocodrome of the rue Bernard-Dadié (where the map has it): the women frying the plantain in their
//   basins of oil on the wood fires, the fish on the grills, the long tables under the sheds, the bulbs;
// - the Grand marché (rebuilt: the big covered market of the town), its gate on the street, its hall of
//   steel under two roofs, its alleys of stalls, the kita pagnes woven in the region hung to sell;
// - the Maquis Ambiance d'Air France and Le Gbêkê Night (the game's, invented names and signs).
// All layouts are the game's own, not surveyed.

/* ---------- The Allocodrome ---------- */

/** A frying station: three stones and the fire, the black basin of oil, the alloco frying, the stool, the table of bowls. Facing +z. */
const FRYER: Part[] = [
  [-0.4, 0.15, 0, 0.3, 0.3, 0.3, '#6d6a62'], [0.4, 0.15, 0, 0.3, 0.3, 0.3, '#6d6a62'], [0, 0.15, -0.4, 0.3, 0.3, 0.3, '#6d6a62'],
  [0, 0.45, 0, 1.2, 0.3, 1.2, '#1c1c1e'], [0, 0.61, 0, 1.0, 0.04, 1.0, '#e0b030'], [0.2, 0.64, 0.1, 0.5, 0.06, 0.3, '#f08c00'],
  [0, 0.2, -1.1, 0.45, 0.4, 0.45, '#8a6a3c'], [1.4, 0.4, 0, 1, 0.8, 0.8, '#8a6a3c'], [1.2, 0.86, 0.1, 0.36, 0.12, 0.36, '#e8590c'], [1.6, 0.86, -0.15, 0.36, 0.12, 0.36, '#f08c00'], [1.5, 0.84, 0.25, 0.4, 0.06, 0.2, '#8a6040'],
]
/** Where the fryers stand along the front (x), and their fires. */
const FRYERS = [-11, -6.5, -2, 6.5, 11]
const FRYER_FIRES: [number, number, number][] = FRYERS.map((x) => [x, 9.6, 0])

export function Allocodrome({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(tr('ALLOCODROME'), '#f08c00', '#1c1c1e', night, 0.9)
  const fire = useFire()
  const mats = useMemo(
    () => ({
      ground: new THREE.MeshLambertMaterial({ color: '#a9a598', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      tube: new THREE.MeshLambertMaterial({ color: '#d8dde2', emissive: '#eef6ff', emissiveIntensity: 0 }),
    }),
    [],
  )
  mats.tube.emissiveIntensity = night ? 1.3 : 0
  const b = useMemo(() => {
    const out: At[] = []
    const bulbs: At[] = []
    const cables: At[] = []
    // The two sheds: posts, tin roofs; long wooden tables and benches under them.
    for (const z of [-8, 1]) {
      for (let x = -14; x <= 14; x += 7) out.push({ p: [x, 1.6, z - 2.8], s: [0.2, 3.2, 0.2], c: '#6b4a2a' }, { p: [x, 1.6, z + 2.8], s: [0.2, 3.2, 0.2], c: '#6b4a2a' })
      out.push({ p: [0, 3.25, z], s: [30, 0.12, 6.4], c: '#a9b0b6' })
      for (let x = -11; x <= 11; x += 5.5)
        put(out, [x, z, 0], [[0, 0.75, 0, 4, 0.08, 1.2, '#8a6a3c'], [-1.6, 0.37, 0, 0.12, 0.74, 1, '#6b4a2a'], [1.6, 0.37, 0, 0.12, 0.74, 1, '#6b4a2a'], [0, 0.42, 1.1, 4, 0.08, 0.4, '#7a5a32'], [0, 0.42, -1.1, 4, 0.08, 0.4, '#7a5a32'], [0.6, 0.9, 0.2, 0.08, 0.26, 0.08, '#2b5a2a'], [-0.8, 0.82, -0.2, 0.36, 0.1, 0.36, '#f08c00']])
      stringLights(bulbs, cables, [-15, 3.6, z - 3], [15, 3.6, z - 3], 16, z)
      stringLights(bulbs, cables, [-15, 3.6, z + 3], [15, 3.6, z + 3], 16, z + 2)
    }
    // The frying women's row along the street, under a strip of sheet roof.
    for (const x of FRYERS) put(out, [x, 9.6, 0], FRYER)
    out.push({ p: [0, 2.8, 9.6], s: [26, 0.1, 3], c: '#8f979e' })
    for (const x of [-13, 0, 13]) out.push({ p: [x, 1.4, 11], s: [0.14, 2.8, 0.14], c: '#6b4a2a' })
    // Plastic tables out on the open ground between, the arch over the way in.
    for (const [x, z] of [[-9, 5.6], [-3.4, 5.6], [3.4, 5.6], [9, 5.6]]) put(out, [x, z, 0], plasticSet(x < 0 ? '#ffffff' : '#c92a2a'))
    put(out, [0, 13.6, 0], [[-3.6, 2.4, 0, 0.4, 4.8, 0.4, '#f1ece2'], [3.6, 2.4, 0, 0.4, 4.8, 0.4, '#f1ece2'], [0, 4.9, 0, 8, 1.2, 0.4, '#f1ece2']])
    out.push(...cables)
    const tubes: At[] = [-10, 0, 10].flatMap((x) => [-8, 1].map((z): At => ({ p: [x, 3.1, z], s: [1.6, 0.08, 0.14] })))
    return { out, bulbs, tubes }
  }, [])
  const people = usePeople('allocodrome', [
    // (A woman at every other fryer: the others are between two batches.)
    ...FRYERS.filter((_, i) => i % 2 === 0).map((x, i): Who => ({ p: [x, 0, 8.5], ry: 0, pose: i % 2 ? 'cook' : 'busy', gender: 'femme', dress: { outfit: 'pagne', outfitColor: ['#e8590c', '#2f9e44', '#f0b429'][i] } })),
    ...[-11, 5.5].flatMap((x, i) => [-8, 1].map((z, k): Who => ({ p: [x + 0.8, 0, z + (k ? 1.1 : -1.1)], ry: k ? Math.PI : 0, pose: (['eat', 'drink', 'sitlaugh'] as Pose[])[(i + k) % 3] }))),
    ...seatsAround(-3.4, 5.6).slice(0, 1).map(([x, z, ry]): Who => ({ p: [x, 0, z], ry, pose: 'eat' })),
    { p: [1.5, 0, 11.6], ry: Math.PI, pose: 'pay' },
  ])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 1]} material={mats.ground} receiveShadow>
        <planeGeometry args={[34, 30]} />
      </mesh>
      <Blocks at={b.out} material={mat} color />
      <Bulbs at={b.bulbs} night={night} />
      <Blocks at={b.tubes} material={mats.tube} />
      <Fire fire={fire} at={FRYER_FIRES} />
      <Sign s={sign} w={7.6} p={[0, 4.9, 13.82]} />
      <People list={people} />
    </group>
  )
}

/* ---------- The Grand marché ---------- */

/** A kita pagne hung to sell: the woven strips sewn side by side, gold, green and red. */
const KITA: Part[] = [[0, 1.55, 0, 1.6, 1.6, 0.04, '#f0b429'], ...[-0.6, -0.2, 0.2, 0.6].map((x, i): Part => [x, 1.55, 0.03, 0.12, 1.6, 0.02, i % 2 ? '#2f9e44' : '#c92a2a']), [0, 1.2, 0.03, 1.6, 0.12, 0.02, '#1c1c1e'], [0, 1.9, 0.03, 1.6, 0.12, 0.02, '#1c1c1e']]
const KITA2: Part[] = KITA.map((p) => [p[0], p[1], p[2], p[3], p[4], p[5], p[6] === '#f0b429' ? '#1c7ed6' : p[6]] as Part)

const MARCHE: MarketSpec = {
  gate: 'GRAND MARCHÉ DE BOUAKÉ',
  sign: ['#1f5a2e', '#f4f1e6'],
  seed: 17,
  w: 38,
  d: 36,
  // Yams, tomatoes, onions, plantains, peppers, aubergines, gombo, the kita's gold.
  goods: ['#8a6a4a', '#d9480f', '#c9a0a0', '#e0c060', '#c92a2a', '#5f3dc4', '#5c940d', '#f0b429'],
  hangings: [KITA, KITA2, KITA, KITA2, KITA],
  hall: { w: 30, d: 20, h: 6, roof: '#c9d0d6' },
  // The piles of yams in front of the hall, a pushcart.
  extra: [[-5, 0.3, 14, 2.4, 0.6, 1.6, '#8a6a4a'], [-5, 0.7, 14, 1.6, 0.4, 1, '#7a5a3a'], [5, 0.3, 14, 2.4, 0.6, 1.6, '#8a6a4a'], [-2, 0.5, 6.5, 1, 0.5, 1.6, '#2f6db3'], [-2, 0.25, 7.4, 0.5, 0.5, 0.1, '#1c1c1e']],
}

export const MarcheBouake = ({ night }: { night: boolean }) => <Market spec={MARCHE} night={night} />

/* ---------- The Maquis Ambiance d'Air France, Le Gbêkê Night ---------- */

const AIR_FRANCE: MaquisSpec = {
  name: "AMBIANCE D'AIR FRANCE",
  sign: ['#1c3f94', '#ffffff'],
  wall: '#4dabf7',
  roof: 'tin',
  food: 'meat',
  plastic: ['#1971c2', '#ffffff', '#c92a2a'],
  seed: 7,
  // The dance floor of tiles out front, the speaker stacks either side: the zouglou till late.
  extra: [
    ...[...Array(12)].map((_, i): Part => [-2.25 + (i % 4) * 1.5, 0.04, 8 + Math.floor(i / 4) * 1.5, 1.5, 0.06, 1.5, (i + Math.floor(i / 4)) % 2 ? '#f4f1e6' : '#1c3f94']),
    ...[-4.4, 4.4].flatMap((x): Part[] => [[x, 0.8, 9.5, 1, 1.6, 0.9, '#1c1c1e'], [x, 2.1, 9.5, 0.9, 1, 0.8, '#1c1c1e'], [x, 0.8, 9.96, 0.6, 0.6, 0.02, '#4a4a4f'], [x, 2.1, 9.92, 0.4, 0.4, 0.02, '#4a4a4f']]),
  ],
  more: [
    { p: [-1, 0, 9], ry: Math.PI, pose: 'zouglou' },
    { p: [0.8, 0, 9.4], ry: Math.PI, pose: 'zouglou', gender: 'femme' },
    { p: [0, 0, 10.6], ry: 0, pose: 'dance', gender: 'homme' },
  ],
}
const GBEKE: ClubSpec = {
  name: 'LE GBÊKÊ NIGHT',
  neon: '#4dabf7',
  neon2: '#f783ac',
  wall: '#141428',
  seed: 11,
  bpm: 122,
  // A Baoulé mask in gold on the front, by the door: the long face, the eyes half shut, the coiffure; the kente's stripes on the other side.
  motif: [
    [-5, 3.8, 5.08, 2.2, 3.4, 0.12, '#d9b34a'], [-5, 5.8, 5.08, 2.8, 0.8, 0.12, '#c9a14a'], [-5.5, 4.4, 5.16, 0.6, 0.14, 0.04, '#2a1a0a'], [-4.5, 4.4, 5.16, 0.6, 0.14, 0.04, '#2a1a0a'],
    [-5, 3.6, 5.16, 0.24, 0.9, 0.04, '#b08a2a'], [-5, 2.7, 5.16, 0.5, 0.18, 0.04, '#2a1a0a'], [-5, 1.9, 5.08, 0.6, 0.6, 0.12, '#d9b34a'],
    ...[0, 1, 2, 3, 4].map((i): Part => [4.4 + i * 0.5, 3.8, 5.08, 0.5, 3.2, 0.1, ['#f0b429', '#2f9e44', '#c92a2a', '#1c1c1e', '#f0b429'][i]]),
  ],
}

export const MaquisAirFrance = ({ night }: { night: boolean }) => <Maquis spec={AIR_FRANCE} night={night} />
export const GbekeNight = ({ night }: { night: boolean }) => <Club spec={GBEKE} night={night} />
