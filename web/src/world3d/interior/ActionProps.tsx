import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '../props'
import { Controller } from './GamingRoom'
import { worldTime } from '../../lib/worldClock'
import { Human } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { Bottle, Sparkler } from '../clubNight'
import { sizeOf } from '../Character'
import type { Look } from '../../lib/types'
import { Balloons, Cinema, Gossip, Clothes, Cocktail, Coffee, Conference, Counter, Desk, Doctor, Fitting, Foam, Gallery, HairMoves, Manicure, Market, Mother, RoomService, Roulette, SchoolBag, Show, Visit, Wedding, YardBall, type Papers, type Tray } from './doings'

// What shows what the Sim is doing, around it: the water of the shower, the
// plate of garba, the bottle, the blanket, the notebook, the prayer mat…
// In the Sim's own frame (it faces +z; lying, +z is up and +y runs from
// the feet to the head), so it goes wherever the Sim is put.

const BOX = new THREE.BoxGeometry(1, 1, 1)
const water = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.7 })
const steam = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false })

/** The table top, in front of a Sim sitting at it. */
const TABLE: [number, number, number] = [0, 0.77, 0.52]

/** Hairdressing, at the barbier's or the salon. */
const HAIR = /^(degrade|boule-a-zero|taille-barbe|tresses|tissage|chignon|coupe-courte|iroquoise|nattes|vanilles|macarons|carre)$/

/** What's laid on a counter for each errand (doings.tsx Counter). */
const PAPERS: Record<string, Papers> = { 'etat-civil': 'register', legalisation: 'stamp', 'declaration-perte': 'form', 'porter-plainte': 'typing', renseignement: 'map', 'abonnement-salle': 'signup', medicaments: 'boxes' }
const TRAYS: Record<string, Tray> = { 'rs-petitdej': 'petitdej', 'rs-club': 'club', 'rs-poisson': 'poisson', 'rs-glace': 'glace', 'rs-cocktail': 'cocktail' }
const BABY = /^(biberon|bouillie|hochet|calin)$/

/**
 * kind: the place's kind ('house' for one's own house, whose furniture has
 * its own shower head; 'room' for a hotel room); stage: the Sim's age, for
 * what it carries; partner: the one it marries.
 */
export function ActionProps({ id, kind, lying, stage = 'adulte', partner, bath }: { id?: string; kind: string; lying: boolean; stage?: string; partner?: { look: Look; gender: 'femme' | 'homme' }; /** A hotel room with a bathtub. */ bath?: boolean }) {
  // (Cooking: the pot is on the stove, drawn where the stove is.)
  if (!id || id === 'cook-attieke') return null
  if (HAIR.test(id) && (kind === 'barbier' || kind === 'salon')) return <Hairdresser id={id} salon={kind === 'salon'} />
  // Before the TV of the salle de jeux: the controller in the hands.
  if (/^console-|^tournoi-console$/.test(id)) return <Controller />
  if (id === 'manucure') return <Manicure />
  if (id === 'retouche') return <Fitting />
  if (id === 'shower' || id === 'logement-douche' || id === 'chambre-douche' || (id === 'chambre-bain' && !bath)) return <Shower fixtures={kind !== 'house' && kind !== 'room'} />
  if (id === 'chambre-bain') return <Foam />
  if (id === 'bain-bebe') return <Mother doing="bain" />
  if (BABY.test(id)) return <Mother doing={id as 'biberon' | 'bouillie' | 'hochet' | 'calin'} />
  if (id === 'jouer-cour') return <YardBall scale={sizeOf(stage).scale} />
  if (id === 'aller-ecole') return <SchoolBag scale={sizeOf(stage).scale} />
  if (lying && /^(sleep|nap|nuit-hotel|chambre-dormir|chambre-sieste|passer-nuit)$/.test(id)) return <Blanket />
  if (id === 'consultation' && lying) return <Doctor />
  if (id === 'visite-malade') return <Visit />
  if (id === 'pray') return <PrayerMat />
  // The gbairai told standing (at the market, the maquis): someone to tell it to. (Seated at the tailor's, the barber's, among the customers.)
  if (id === 'gbairai' && kind !== 'couture' && kind !== 'barbier' && kind !== 'salon') return <Gossip />
  // At a counter: the papers, the stamp, the boxes.
  if (PAPERS[id]) return <Counter kind={PAPERS[id]} top={kind === 'pharmacie' ? 1.13 : 1.105} />
  if (id === 'conseil' && kind === 'pharmacie') return <Counter kind="advice" top={1.13} />
  if (id === 'mariage-civil') return <Wedding spouse={partner} />
  // The market: buying, haggling, selling.
  if (id === 'buy-food' || id === 'courses') return <Market how="buy" />
  if (id === 'bargain') return <Market how="bargain" />
  if (id === 'sell-goods') return <Market how="sell" />
  if (id === 'spectacle') return <Show />
  // The orphanage: the story book held open to the little ones, the pot of rice to serve, the envelope of the gift.
  if (id === 'lire-enfants') return <StoryBook />
  if (id === 'repas-enfants') return <ServingPot />
  if (id === 'don-orphelinat' || id === 'grand-don-orphelinat') return <Box p={[0.22, 1.02, 0.3]} s={[0.24, 0.02, 0.14]} c="#f1f3f5" />
  if (id === 'exposition') return <Gallery />
  if (kind === 'cinema' && (id === 'film' || id === 'film-popcorn')) return <Cinema popcorn={id === 'film-popcorn'} />
  // The desk: the library's books, the exam, the paper's ads, the coffee, the talk on the screen.
  if (id === 'bibliotheque' || id === 'bu') return <Desk what="books" />
  if (id === 'partiel') return <Desk what="exam" />
  if (id === 'read-ads') return <Desk what="paper" />
  if (id === 'coffee-break') return <Coffee />
  if (id === 'conference' || id === 'conference-u')
    return (
      <>
        <Notebook />
        <Conference at={kind === 'universite' ? [0.4, 1.4, 5.1] : [0, 1.6, 3.83]} />
      </>
    )
  if (id === 'devoirs' || (/cours|biblio|write|amphi/.test(id) && kind !== 'office') || (id === 'conseil' && kind === 'mairie')) return <Notebook />
  // The bottles on the club's VIP table (in front of the sofa): whisky, or champagne with its sparkler.
  if (id === 'bouteille-whisky') return <Bottle p={[0.25, 0.44, 0.9]} whisky />
  // The round for the whole club: the bottle held up high, its sparkler lit, on the dance floor.
  if (id === 'tournee-vendredi')
    return (
      <>
        <Bottle p={[0.32, 1.95, 0.1]} />
        <Sparkler p={[0.32, 2.3, 0.1]} />
      </>
    )
  if (id === 'champagne-vip')
    return (
      <>
        <Bottle p={[0.2, 0.44, 0.9]} />
        <Sparkler p={[0.2, 0.79, 0.9]} />
      </>
    )
  // Room service on the room's desk; the cocktail at the hotel's bar.
  if (TRAYS[id]) return <RoomService what={TRAYS[id]} />
  // (On the hotel bar's counter, the Sim up on its stool.)
  if (id === 'bar-hotel') return <Cocktail p={[0.05, 0.95, 0.85]} />
  if (id === 'casino-ivoire') return <Roulette />
  if (id === 'vetements') return <Clothes />
  if (id.startsWith('anniversaire'))
    return (
      <>
        <Dish kind="gateau" />
        <Balloons />
      </>
    )
  const dish = dishFor(id)
  if (dish) return <Dish kind={dish} />
  if (/^(drink|milkshake|coffee|sucrerie)/.test(id) || id.includes('drink')) return <Drinks milk={id === 'milkshake'} />
  return null
}

/* ---------- The shower ---------- */

/** Water falling from the shower head over the Sim, and the steam rising. */
export function Shower({ fixtures = true }: { /** The pipe, the head, the bucket: not where the furniture has its own. */ fixtures?: boolean }) {
  const drops = useRef<THREE.InstancedMesh>(null)
  const puffs = useRef<THREE.InstancedMesh>(null)
  const N = 46
  const seeds = useMemo(() => [...Array(N)].map((_, i) => [Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5, Math.sin(i * 37.719) * 0.5 + 0.5]), [])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const t = worldTime()
    if (drops.current) {
      seeds.forEach(([a, b, c], i) => {
        const k = (t * 1.6 + c) % 1
        const r = 0.08 + a * 0.32
        const ang = b * Math.PI * 2
        o.position.set(Math.cos(ang) * r * (0.6 + k * 0.6), 2.15 - k * 2.15, Math.sin(ang) * r * (0.6 + k * 0.6))
        o.scale.set(0.025, 0.16, 0.025)
        o.updateMatrix()
        drops.current!.setMatrixAt(i, o.matrix)
      })
      drops.current.instanceMatrix.needsUpdate = true
    }
    if (puffs.current) {
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.25 + i / 6) % 1
        o.position.set(Math.sin(i * 2.1) * 0.35, 0.6 + k * 1.9, Math.cos(i * 2.1) * 0.35)
        o.scale.setScalar(0.25 + k * 0.4)
        o.updateMatrix()
        puffs.current.setMatrixAt(i, o.matrix)
      }
      puffs.current.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group>
      {fixtures && (
        <>
          {/* The pipe up the wall, the shower head */}
          <Box p={[0, 2.25, -0.55]} s={[0.05, 0.05, 0.5]} c="#c3c7cf" />
          <Box p={[0, 1.2, -0.78]} s={[0.05, 2.1, 0.05]} c="#c3c7cf" />
          <Box p={[0, 2.2, -0.3]} s={[0.22, 0.06, 0.22]} c="#9aa0a8" />
          {/* The bucket and the soap, Abidjan style */}
          <Box p={[0.55, 0.2, 0.3]} s={[0.32, 0.4, 0.32]} c="#2a6cf0" />
          <Box p={[0.55, 0.36, 0.3]} s={[0.26, 0.04, 0.26]} c="#9fd8ff" />
          <Box p={[-0.5, 0.05, 0.35]} s={[0.12, 0.05, 0.07]} c="#ffd43b" />
        </>
      )}
      <instancedMesh ref={drops} args={[BOX, water, N]} frustumCulled={false} />
      <instancedMesh ref={puffs} args={[BOX, steam, 6]} frustumCulled={false} />
    </group>
  )
}

/* ---------- The hairdresser, the tailor ---------- */

/**
 * Behind the Sim in the chair (it faces the mirror, +z): the barber or the
 * hairdresser, the tool going over the head the way the style is done
 * (doings.tsx HairMoves: the clippers, the razor along the beard, the
 * scissors, the comb braiding, the needle of the tissage).
 */
function Hairdresser({ id, salon }: { id: string; salon: boolean }) {
  const look = useMemo(() => {
    let n = salon ? 41 : 17
    return randomLook(salon ? 'femme' : 'homme', () => ((n = (n * 16807) % 2147483647) / 2147483647))
  }, [salon])
  return (
    <group>
      <group position={[0.1, -0.06, -0.62]}>
        <Human look={look} gender={salon ? 'femme' : 'homme'} pose="busy" seed={5} />
      </group>
      <HairMoves id={id} />
      {/* The cape over the client */}
      <Box p={[0, 0.85, 0.05]} s={[0.62, 0.55, 0.36]} c={salon ? '#f783ac' : '#2b2f3a'} />
    </group>
  )
}

/** A sewing machine on its table, the needle going, the wax going under it. */
export function SewingTable({ seed = 0 }: { seed?: number }) {
  const needle = useRef<THREE.Mesh>(null)
  const cloth = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime() + seed * 3.1
    if (needle.current) needle.current.position.y = 0.97 + Math.abs(Math.sin(t * 14)) * 0.035
    if (cloth.current) cloth.current.position.x = -0.1 + ((t * 0.05) % 0.2)
  })
  return (
    <group>
      <Box p={[0, 0.74, 0]} s={[1.3, 0.05, 0.7]} c="#8a5a32" />
      {[-0.6, 0.6].map((x) => (
        <Box key={x} p={[x, 0.36, 0]} s={[0.06, 0.72, 0.6]} c="#3b2a1a" />
      ))}
      {/* The machine: its base, the column, the arm, the wheel */}
      <Box p={[0, 0.8, 0]} s={[0.5, 0.07, 0.22]} c="#1b1b1f" />
      <Box p={[0.18, 0.93, 0]} s={[0.1, 0.22, 0.14]} c="#1b1b1f" />
      <Box p={[0.02, 1.05, 0]} s={[0.38, 0.08, 0.12]} c="#1b1b1f" />
      <Box p={[0.26, 0.97, 0.08]} s={[0.04, 0.14, 0.14]} c="#c9a227" />
      <mesh ref={needle} position={[-0.14, 0.97, 0]}>
        <boxGeometry args={[0.012, 0.08, 0.012]} />
        <meshLambertMaterial color="#c3c7cf" />
      </mesh>
      {/* The wax under the needle, going through little by little */}
      <mesh ref={cloth} position={[-0.1, 0.775, 0.12]}>
        <boxGeometry args={[0.6, 0.008, 0.4]} />
        <meshLambertMaterial color={seed % 2 ? '#2a6cf0' : '#f08c00'} />
      </mesh>
    </group>
  )
}

/* ---------- Bed, prayer, homework ---------- */

/** The pagne over the sleeper, from the feet to the chest. */
function Blanket() {
  return <Box p={[0, 0.52, 0.07]} s={[0.66, 0.98, 0.1]} c="#e8590c" />
}

/** The prayer mat under the one praying. */
function PrayerMat() {
  return (
    <group position={[0, 0.012, 0.15]}>
      <Box p={[0, 0, 0]} s={[0.75, 0.02, 1.25]} c="#2b8a3e" />
      <Box p={[0, 0.005, 0.52]} s={[0.55, 0.02, 0.12]} c="#f2b705" />
      <Box p={[0, 0.005, 0]} s={[0.55, 0.021, 0.5]} c="#7a1f3d" />
    </group>
  )
}

/** The notebook open on the table, and the pen. */
/** A picture book held open on the lap, turned to the children: its two pages, its bright cover. */
function StoryBook() {
  return (
    <group position={[0, 0.82, 0.32]} rotation={[-0.5, 0, 0]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.13, 0, 0]} rotation={[0, 0, -s * 0.18]}>
          <Box p={[0, 0, 0]} s={[0.25, 0.02, 0.32]} c="#f8f9fa" />
        </group>
      ))}
      <Box p={[0, -0.02, 0]} s={[0.54, 0.02, 0.34]} c="#e8590c" />
    </group>
  )
}

/** The big pot of rice held in both hands, its ladle in it. */
function ServingPot() {
  return (
    <group position={[0, 1.0, 0.36]}>
      <mesh>
        <cylinderGeometry args={[0.2, 0.17, 0.2, 14]} />
        <meshLambertMaterial color="#adb5bd" />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 14]} />
        <meshLambertMaterial color="#fff9db" />
      </mesh>
      <group position={[0.08, 0.2, 0]} rotation={[0, 0, -0.4]}>
        <Box p={[0, 0, 0]} s={[0.03, 0.28, 0.03]} c="#5c3d22" />
      </group>
    </group>
  )
}

function Notebook() {
  return (
    <group position={TABLE}>
      <Box p={[0, 0.01, 0]} s={[0.42, 0.02, 0.3]} c="#f8f9fa" />
      <Box p={[0, 0.021, 0]} s={[0.02, 0.005, 0.3]} c="#adb5bd" />
      <Box p={[0.12, 0.03, 0.02]} s={[0.14, 0.015, 0.015]} c="#1d4ed8" />
    </group>
  )
}

/* ---------- At table ---------- */

export type DishKind = 'garba' | 'porc' | 'poulet' | 'alloco' | 'poisson' | 'attieke' | 'burger' | 'glace' | 'bouillie' | 'gateau' | 'plat'

export function dishFor(id: string): DishKind | null {
  if (id.includes('garba')) return 'garba'
  if (id.includes('poulet') || id.includes('brochette')) return 'poulet'
  if (id.includes('alloco')) return 'alloco'
  if (id.includes('fish') || id.includes('poisson')) return 'poisson'
  if (id.includes('attieke')) return 'attieke'
  if (id.includes('burger')) return 'burger'
  if (id.includes('glace')) return 'glace'
  if (id === 'bouillie' || id === 'biberon') return 'bouillie'
  if (id.startsWith('anniversaire')) return 'gateau'
  if (/^(eat|brunch|resto|golvo)/.test(id) || id === 'logement-cuisiner') return 'plat'
  return null
}

/** The plate in front of the Sim, with what it ordered on it (on the table, or where it's held: at). */
export function Dish({ kind, at = TABLE }: { kind: DishKind; at?: [number, number, number] }) {
  const food = (() => {
    switch (kind) {
      case 'garba':
        // Attiéké heaped up, the fried tuna, a bit of chili and onion.
        return (
          <>
            <Box p={[-0.04, 0.05, 0]} s={[0.17, 0.07, 0.15]} c="#f2e6c9" />
            <Box p={[0.08, 0.05, 0.02]} s={[0.12, 0.05, 0.08]} c="#9a5a22" />
            <Box p={[0.02, 0.09, -0.05]} s={[0.03, 0.02, 0.03]} c="#e03131" />
            <Box p={[-0.08, 0.09, 0.04]} s={[0.03, 0.02, 0.03]} c="#d0bfff" />
          </>
        )
      case 'porc':
        // The porc au four cut in pieces, the attiéké beside, the piment.
        return (
          <>
            {[[-0.05, -0.03], [0.06, 0.02], [0.0, 0.05]].map(([x, z], i) => (
              <Box key={i} p={[x + 0.04, 0.05 + (i % 2) * 0.015, z]} s={[0.08, 0.05, 0.06]} c={i % 2 ? '#a0522d' : '#8b3a1a'} />
            ))}
            <Box p={[-0.09, 0.05, 0.02]} s={[0.1, 0.06, 0.12]} c="#f2e6c9" />
            <Box p={[0.1, 0.085, -0.06]} s={[0.03, 0.02, 0.03]} c="#e03131" />
          </>
        )
      case 'poulet':
        return (
          <>
            <Box p={[0, 0.06, 0]} s={[0.16, 0.08, 0.12]} c="#8a4a1f" />
            <Box p={[0.1, 0.05, 0.05]} s={[0.05, 0.05, 0.05]} c="#e8a33c" />
            <Box p={[-0.1, 0.05, -0.04]} s={[0.05, 0.05, 0.05]} c="#e8a33c" />
            <Box p={[0.05, 0.11, -0.04]} s={[0.03, 0.02, 0.03]} c="#2b8a3e" />
          </>
        )
      case 'alloco':
        return (
          <>
            {[[-0.06, 0.03], [0.04, -0.04], [0.07, 0.05], [-0.02, -0.07], [0, 0.03]].map(([x, z], i) => (
              <Box key={i} p={[x, 0.05 + (i % 2) * 0.02, z]} s={[0.06, 0.04, 0.05]} c={i % 2 ? '#f08c00' : '#e8a33c'} />
            ))}
          </>
        )
      case 'poisson':
        return (
          <>
            <Box p={[0, 0.05, 0]} s={[0.24, 0.05, 0.09]} c="#7a5230" />
            <Box p={[0.14, 0.05, 0]} s={[0.05, 0.07, 0.03]} c="#5c3d22" />
            <Box p={[-0.04, 0.05, 0.08]} s={[0.1, 0.04, 0.05]} c="#f2e6c9" />
          </>
        )
      case 'attieke':
        return <Box p={[0, 0.05, 0]} s={[0.2, 0.08, 0.18]} c="#f2e6c9" />
      case 'burger':
        return (
          <>
            <Box p={[0, 0.04, 0]} s={[0.13, 0.03, 0.13]} c="#d9a35a" />
            <Box p={[0, 0.065, 0]} s={[0.14, 0.025, 0.14]} c="#5c3317" />
            <Box p={[0, 0.09, 0]} s={[0.13, 0.04, 0.13]} c="#d9a35a" />
            <Box p={[0.13, 0.05, 0.04]} s={[0.04, 0.06, 0.04]} c="#ffd43b" />
          </>
        )
      case 'glace':
        return (
          <>
            <Box p={[0, 0.06, 0]} s={[0.07, 0.1, 0.07]} c="#d9a35a" />
            <Box p={[0, 0.14, 0]} s={[0.09, 0.07, 0.09]} c="#f783ac" />
          </>
        )
      case 'bouillie':
        return <Box p={[0, 0.05, 0]} s={[0.14, 0.07, 0.14]} c="#e9d8a6" />
      case 'gateau':
        return (
          <>
            <Box p={[0, 0.07, 0]} s={[0.26, 0.12, 0.26]} c="#f8f9fa" />
            <Box p={[0, 0.13, 0]} s={[0.27, 0.02, 0.27]} c="#f783ac" />
            {[-0.07, 0, 0.07].map((x) => (
              <group key={x}>
                <Box p={[x, 0.18, 0]} s={[0.015, 0.07, 0.015]} c="#74c0fc" />
                <Box p={[x, 0.225, 0]} s={[0.02, 0.025, 0.02]} c="#ffd43b" glow={1} />
              </group>
            ))}
          </>
        )
      default:
        return (
          <>
            <Box p={[-0.04, 0.05, 0]} s={[0.14, 0.06, 0.14]} c="#f2e6c9" />
            <Box p={[0.07, 0.05, 0.02]} s={[0.1, 0.05, 0.08]} c="#b8562a" />
          </>
        )
    }
  })()
  return (
    <group position={at}>
      {/* The plate, the fork beside it, a sachet of water */}
      <Box p={[0, 0.01, 0]} s={[0.34, 0.02, 0.3]} c="#ffffff" />
      {food}
      <Box p={[0.24, 0.015, 0]} s={[0.02, 0.01, 0.2]} c="#c3c7cf" />
      <Box p={[-0.28, 0.04, -0.06]} s={[0.09, 0.07, 0.04]} c="#d0ebff" />
    </group>
  )
}

/** The bottles on the table (or the milkshake). */
function Drinks({ milk }: { milk: boolean }) {
  if (milk)
    return (
      <group position={TABLE}>
        <Box p={[0, 0.09, 0]} s={[0.08, 0.18, 0.08]} c="#f783ac" />
        <Box p={[0.02, 0.22, 0]} s={[0.012, 0.12, 0.012]} c="#ffffff" />
      </group>
    )
  return (
    <group position={TABLE}>
      <Box p={[-0.08, 0.13, 0]} s={[0.07, 0.26, 0.07]} c="#2b7a3d" />
      <Box p={[-0.08, 0.29, 0]} s={[0.03, 0.06, 0.03]} c="#2b7a3d" />
      <Box p={[0.1, 0.06, 0.04]} s={[0.07, 0.12, 0.07]} c="#f4f1ea" />
      <Box p={[0.1, 0.1, 0.04]} s={[0.06, 0.04, 0.06]} c="#e8a33c" />
    </group>
  )
}

/* ---------- In the room (home) ---------- */

/** The TV on, its picture changing. */
export function TvScreen() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4dabf7' }), [])
  useFrame(() => {
    const t = worldTime()
    const k = Math.floor(t * 1.3)
    mat.color.setHSL(((k * 0.37) % 1 + 1) % 1, 0.55, 0.45 + Math.sin(t * 9) * 0.04)
  })
  return (
    <mesh position={[1.5, 0.9, 3.84]} rotation={[0, Math.PI, 0]} material={mat}>
      <planeGeometry args={[1.45, 0.78]} />
    </mesh>
  )
}

/** The TV of one's own house on (build/Furniture.tsx 'tele'): its picture changing, a glow on the room. Placed at the screen, facing out. */
export function TvOn() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4dabf7' }), [])
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const t = worldTime()
    const k = Math.floor(t * 1.3)
    mat.color.setHSL(((k * 0.37) % 1 + 1) % 1, 0.6, 0.5 + Math.sin(t * 9) * 0.05)
    if (light.current) {
      light.current.color.copy(mat.color)
      light.current.intensity = 2.2 + Math.sin(t * 7) * 0.4
    }
  })
  return (
    <group>
      <mesh position={[0, 0.85, 0.008]} material={mat}>
        <planeGeometry args={[0.84, 0.46]} />
      </mesh>
      <pointLight ref={light} position={[0, 0.9, 0.6]} distance={4} decay={2} />
    </group>
  )
}

/** The pot on the stove, the steam. */
export function Pot() {
  const puffs = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const t = worldTime()
    if (!puffs.current) return
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.4 + i / 5) % 1
      o.position.set(Math.sin(i * 2.4) * 0.1, 1.15 + k * 1.1, Math.cos(i * 2.4) * 0.1)
      o.scale.setScalar(0.12 + k * 0.25)
      o.updateMatrix()
      puffs.current.setMatrixAt(i, o.matrix)
    }
    puffs.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group position={[5.2, 0, -3.6]}>
      <Box p={[0, 1.04, 0]} s={[0.42, 0.24, 0.42]} c="#3a3d42" />
      <Box p={[0, 1.17, 0]} s={[0.36, 0.02, 0.36]} c="#f2e6c9" />
      <Box p={[0.12, 1.3, 0]} s={[0.03, 0.35, 0.03]} c="#7a5233" />
      <instancedMesh ref={puffs} args={[BOX, steam, 5]} frustumCulled={false} />
    </group>
  )
}

/** Z… z… z… rising from the sleeper. */
export function Zzz({ at }: { at: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const x = c.getContext('2d')!
    x.fillStyle = '#ffffff'
    for (const [px, py] of [[3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [11, 4], [10, 5], [9, 6], [8, 7], [7, 8], [6, 9], [5, 10], [4, 11], [3, 12], [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12], [12, 12]]) x.fillRect(px, py, 1, 1)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    return t
  }, [])
  useFrame(() => {
    const t = worldTime()
    g.current?.children.forEach((z, i) => {
      const k = (t * 0.35 + i / 3) % 1
      z.position.set(Math.sin(k * 6 + i) * 0.15, k * 1.2, 0)
      z.scale.setScalar(0.18 + k * 0.25)
      ;((z as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k
    })
  })
  return (
    <group ref={g} position={at}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} color="#c5d4ff" />
        </mesh>
      ))}
    </group>
  )
}
