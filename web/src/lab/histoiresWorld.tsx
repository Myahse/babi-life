import { useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import type { Look } from '../lib/types'
import { DEFAULT_LOOK } from '../avatar/options'
import type { Pose } from '../avatar/Human'
import { DetailHuman } from '../avatar/DetailHuman'
import { Box, Sign, TableSet } from '../world3d/props'
import { NoteShower } from '../world3d/money'

// « Les histoires se racontent » (FILM=histoires): the film's own scenes, made for it
// (none of the other films' sets), with the game's detailed persos (avatar/DetailHuman.tsx,
// the update « sims-detailles »). Each is drawn at t seconds into its shot (lab/poster.tsx):
//   hist:terrasse   Awa on her rooftop at sunset, the city lighting up behind (+ -tel, -djai)
//   hist:grin       the vieux Koné's tea under the mango tree (+ -retour: the grandson arrives)
//   hist:cour       the haunted courtyard at night: the flickering bulb, steps on the roof
//   hist:pari       the maquis at night, Boris showing his muscles, the friends filming
//   hist:maudit     Tantie Bintou's maquis gone red: the sick clients, the whispers
//   hist:ciel       a plane over the clouds (under the map of the trips)
//   hist:fin        everyone of the film together on the rooftop

const L = (l: Partial<Look>): Look => ({ ...DEFAULT_LOOK, ...l })
/** Awa as she is now, in the detailed persos. */
export const AWA = L({ outfit: 'pagne', hair: 'headwrap', accessory: 'earrings', pattern: 'cercles', outfitColor: '#ff7a00', skin: '#6e4024' })
const KONE = L({ outfit: 'boubou', hair: 'short', beard: 'full', accessory: 'none', outfitColor: '#2a6cf0', skin: '#3f2210', hairColor: '#d8d2c8' })
const PETIT = L({ outfit: 'blouson', hair: 'degrade', accessory: 'watch', outfitColor: '#212529', skin: '#8a5532' })
const VOISIN = L({ outfit: 'chemise-pagne', hair: 'bald', beard: 'moustache', accessory: 'none', pattern: 'losanges', outfitColor: '#00a862', skin: '#583119' })
const BRIGITTE = L({ outfit: 'kaba', hair: 'headwrap', accessory: 'none', pattern: 'feuilles', outfitColor: '#7b5cff', skin: '#583119' })
const BORIS = L({ outfit: 'debardeur', hair: 'degrade', accessory: 'chain', outfitColor: '#f8f9fa', skin: '#4a2814', body: 'fort' })
const AMI1 = L({ outfit: 'jersey', hair: 'short', accessory: 'cap', outfitColor: '#ff8200', skin: '#6e4024' })
const AMI2 = L({ outfit: 'casual', hair: 'locks', accessory: 'none', outfitColor: '#2a6cf0', skin: '#8a5532' })
const AMIE = L({ outfit: 'casual', hair: 'braids', accessory: 'earrings', outfitColor: '#d6336c', skin: '#a46c42' })
const BINTOU = L({ outfit: 'pagne', hair: 'headwrap', accessory: 'earrings', pattern: 'losanges', outfitColor: '#e03131', skin: '#4a2814', body: 'fort' })
const CLIENT1 = L({ outfit: 'chemise', hair: 'short', accessory: 'none', outfitColor: '#74c0fc', skin: '#583119' })
const CLIENT2 = L({ outfit: 'survet', hair: 'short', accessory: 'none', outfitColor: '#2f9e44', skin: '#6e4024' })
const COMMERE1 = L({ outfit: 'pagne', hair: 'headwrap', accessory: 'none', pattern: 'cercles', outfitColor: '#00a862', skin: '#6e4024' })
const COMMERE2 = L({ outfit: 'robe', hair: 'weave', accessory: 'bag', outfitColor: '#ffd43b', skin: '#8a5532' })

function Cam({ at, look }: { at: [number, number, number]; look: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  camera.position.set(...at)
  camera.lookAt(...look)
  return null
}

function P({ look, gender, pose, at, turn = 0, seed = 1, take }: { look: Look; gender: 'femme' | 'homme'; pose: Pose; at: [number, number, number]; turn?: number; seed?: number; take?: number }) {
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <DetailHuman look={look} gender={gender} pose={pose} seed={seed} take={take} />
    </group>
  )
}

/** Bulbs on a wire, sagging between two points. */
function Bulbs({ from, to, n = 12, colors = ['#ffd43b'], sag = 0.35 }: { from: [number, number, number]; to: [number, number, number]; n?: number; colors?: string[]; sag?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const k = i / (n - 1)
        const p: [number, number, number] = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k - Math.sin(k * Math.PI) * sag, from[2] + (to[2] - from[2]) * k]
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshBasicMaterial color={colors[i % colors.length]} toneMapped={false} />
          </mesh>
        )
      })}
    </>
  )
}

function Ground({ c, size = 40 }: { c: string; size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

/** A mango tree: its trunk and its round dark leaves. */
function Mango({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  const blobs: [number, number, number, number][] = [[0, 3.1, 0, 1.4], [1.0, 2.8, 0.3, 1.0], [-1.0, 2.9, -0.2, 1.1], [0.3, 3.7, -0.4, 1.0], [-0.4, 2.6, 0.8, 0.9]]
  return (
    <group position={p} scale={s}>
      <Box p={[0, 1.2, 0]} s={[0.4, 2.4, 0.4]} c="#6b4423" />
      {blobs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshLambertMaterial color={i % 2 ? '#2b7a3a' : '#23662f'} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** The city far behind, its windows lighting up as night falls. */
function Skyline({ z = -16, lit = 1 }: { z?: number; lit?: number }) {
  const blocks = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ x: -18 + i * 2.4 + ((i * 7) % 3) * 0.3, h: 3 + ((i * 37) % 9), w: 1.6 + ((i * 13) % 4) * 0.3 })), [])
  return (
    <group position={[0, 0, z]}>
      {blocks.map((b, i) => (
        <group key={i}>
          <Box p={[b.x, b.h / 2 - 2, 0]} s={[b.w, b.h, 1.5]} c={i % 3 ? '#4b3463' : '#3c2a55'} />
          {Array.from({ length: Math.floor(b.h / 1.1) }, (_, j) =>
            (i * 3 + j * 5) % 4 !== 0 ? (
              <mesh key={j} position={[b.x + (j % 2 ? 0.35 : -0.35), j * 1.1 - 1.2, 0.76]}>
                <planeGeometry args={[0.35, 0.4]} />
                <meshBasicMaterial color="#ffd27a" transparent opacity={lit * (0.5 + ((i + j) % 3) * 0.25)} toneMapped={false} />
              </mesh>
            ) : null,
          )}
        </group>
      ))}
    </group>
  )
}

function Terrasse({ t, mode }: { t: number; mode: string }) {
  const pose: Pose = mode === 'tel' ? 'phone' : mode === 'djai' ? (Math.floor(t / 0.9) % 2 ? 'cheer' : 'dance') : Math.floor(t / 1.6) % 3 === 2 ? 'wave' : 'talk'
  const sway = Math.sin(t * 0.35)
  const cam: [number, number, number] = mode === 'tel' ? [1.8 + sway * 0.2, 1.6, 3.0] : mode === 'djai' ? [sway * 0.4, 1.5, 4.4 - t * 0.08] : [0.5 + sway * 0.25, 1.45, 3.9 - t * 0.04]
  return (
    <>
      <color attach="background" args={['#f59a62']} />
      <fog attach="fog" args={['#f2a070', 14, 34]} />
      <hemisphereLight args={['#ffd9b0', '#8a4b6b', 1.1]} />
      <directionalLight position={[-6, 4, 3]} intensity={2.2} color="#ffb070" castShadow shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={0.35} />
      {/* The setting sun */}
      <mesh position={[-9, 2.2, -24]}>
        <circleGeometry args={[2.6, 32]} />
        <meshBasicMaterial color="#fff1b8" toneMapped={false} />
      </mesh>
      <Skyline lit={0.8} />
      {/* The rooftop: its tiles, its low wall, its pots, its chair */}
      {Array.from({ length: 10 }, (_, i) => Array.from({ length: 6 }, (_, j) => <Box key={`${i}-${j}`} p={[-4.5 + i, -0.05, -2 + j]} s={[0.98, 0.1, 0.98]} c={(i + j) % 2 ? '#e6cfae' : '#d8bb94'} />))}
      <Box p={[0, 0.5, -2.6]} s={[10, 1, 0.25]} c="#f3e3c3" />
      <Box p={[0, 1.02, -2.6]} s={[10, 0.06, 0.4]} c="#d9c4a0" />
      {[-3.4, 3.2].map((x) => (
        <group key={x} position={[x, 0, -2.0]}>
          <Box p={[0, 0.3, 0]} s={[0.55, 0.6, 0.55]} c="#c2410c" />
          <mesh position={[0, 0.95, 0]}>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshLambertMaterial color="#2f9e44" flatShading />
          </mesh>
        </group>
      ))}
      <group position={[-1.7, 0, -0.8]} rotation={[0, 0.5, 0]}>
        <Box p={[0, 0.45, 0]} s={[0.55, 0.06, 0.55]} c="#1c7ed6" />
        <Box p={[0, 0.8, -0.26]} s={[0.55, 0.65, 0.06]} c="#1c7ed6" />
        <Box p={[0, 0.22, 0]} s={[0.45, 0.44, 0.45]} c="#1c7ed6" />
      </group>
      <Bulbs from={[-4.5, 2.6, -2.4]} to={[4.5, 2.6, -2.4]} n={16} colors={['#ffd43b', '#ff922b', '#ffe066']} />
      <P look={AWA} gender="femme" pose={pose} at={[0, 0, 0]} turn={mode === 'tel' ? 0.5 : 0} seed={11} take={Math.floor(t / 1.6)} />
      {mode === 'djai' && <NoteShower from={[0, 3.4, 0.4]} toward={[0, -0.2, 0.3]} rate={3} fan={4} keep={4} seed={3} />}
      <Cam at={cam} look={[0, mode === 'tel' ? 1.3 : mode === 'djai' ? 1.25 : 1.6, 0]} />
    </>
  )
}

function Grin({ t, retour }: { t: number; retour: boolean }) {
  // The grandson comes in from the right with his suitcase, and the old man gets up.
  const walk = retour ? Math.max(1.7, 4.2 - t * 0.9) : 99
  const arrived = retour && walk <= 1.7
  const glow = 0.7 + 0.3 * Math.sin(t * 9)
  const cam: [number, number, number] = retour ? [1.0, 1.6, 5.6 - t * 0.15] : [Math.sin(t * 0.2) * 1.2 + 0.4, 1.9, 5.2]
  return (
    <>
      <color attach="background" args={['#ffcf8a']} />
      <fog attach="fog" args={['#ffd59a', 12, 30]} />
      <hemisphereLight args={['#fff1d6', '#a0703a', 1.2]} />
      <directionalLight position={[5, 7, 4]} intensity={2.4} color="#ffd8a0" castShadow shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={0.35} />
      <Ground c="#d6ad74" />
      {/* The compound's wall behind, its blue gate */}
      <Box p={[0, 1.2, -4]} s={[16, 2.4, 0.3]} c="#e8c18a" />
      <Box p={[2.6, 1.0, -3.84]} s={[1.6, 2.0, 0.06]} c="#1971c2" />
      <Box p={[0, 2.45, -4]} s={[16, 0.12, 0.45]} c="#c99a5e" />
      <Mango p={[-2.2, 0, -1.6]} s={1.15} />
      {/* The bench, the brazier and the teapot, the little glasses */}
      <Box p={[0.2, 0.44, -0.9]} s={[2.4, 0.08, 0.45]} c="#8b5a2b" />
      {[-0.85, 1.25].map((x) => (
        <Box key={x} p={[x, 0.2, -0.9]} s={[0.08, 0.4, 0.4]} c="#6b4423" />
      ))}
      <Box p={[0.5, 0.14, 0.15]} s={[0.36, 0.28, 0.36]} c="#343a40" />
      <mesh position={[0.5, 0.3, 0.15]}>
        <boxGeometry args={[0.3, 0.04, 0.3]} />
        <meshBasicMaterial color="#ff6b1a" transparent opacity={glow} toneMapped={false} />
      </mesh>
      <mesh position={[0.5, 0.44, 0.15]} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 0.22, 10]} />
        <meshLambertMaterial color="#1c7ed6" />
      </mesh>
      <Box p={[-0.35, 0.08, 0.25]} s={[0.5, 0.04, 0.3]} c="#adb5bd" />
      {[-0.5, -0.35, -0.2].map((x) => (
        <mesh key={x} position={[x, 0.15, 0.25]}>
          <cylinderGeometry args={[0.03, 0.025, 0.09, 8]} />
          <meshLambertMaterial color="#ffe8a3" transparent opacity={0.85} />
        </mesh>
      ))}
      <P look={KONE} gender="homme" pose={arrived ? (t % 2.4 < 1.2 ? 'wave' : 'hug') : retour ? 'sit' : Math.floor(t / 2) % 2 ? 'talk' : 'sit'} at={arrived ? [0.2, 0, -0.4] : [-0.2, 0, -0.9]} seed={4} take={arrived ? 1 : 0} />
      <P look={VOISIN} gender="homme" pose={retour ? 'sit' : Math.floor(t / 1.7) % 2 ? 'drink' : 'sit'} at={[0.9, 0, -0.9]} seed={6} />
      {retour && (
        <group position={[walk, 0, 0.1]}>
          <P look={PETIT} gender="homme" pose={arrived ? 'wave' : 'walk'} at={[0, 0, 0]} turn={-Math.PI / 2 + (arrived ? 1.2 : 0)} seed={8} />
          <Box p={[0.05, 0.35, arrived ? 0.5 : 0.32]} s={[0.25, 0.55, 0.42]} c="#495057" />
        </group>
      )}
      <Cam at={cam} look={retour ? [0.9, 1.0, -0.4] : [0.3, 1.0, -0.6]} />
    </>
  )
}

/** The haunted courtyard at night: the bulb that flickers, the empty room's pale light, steps on the tin roof. */
function Cour({ t }: { t: number }) {
  const flicker = Math.sin(t * 23) > 0.3 || Math.sin(t * 7.3) > 0.85 ? 0.25 : 1
  const step = Math.floor((t - 1.9) / 0.22)
  const ghost = 0.35 + 0.35 * Math.sin(t * 2.3)
  const shake = 0.012 * Math.sin(t * 13)
  return (
    <>
      <color attach="background" args={['#070b24']} />
      <fog attach="fog" args={['#070b24', 7, 22]} />
      <hemisphereLight args={['#4a5a9a', '#1a1410', 0.55]} />
      <directionalLight position={[-6, 9, 4]} intensity={0.9} color="#9fb4ff" castShadow shadow-mapSize={[1024, 1024]} />
      <mesh position={[-7, 9, -18]}>
        <circleGeometry args={[1.4, 32]} />
        <meshBasicMaterial color="#e7ecff" toneMapped={false} />
      </mesh>
      <Ground c="#3d3326" />
      {/* Three rooms in a row, their doors, their tin roof */}
      {[-2.8, 0, 2.8].map((x, i) => (
        <group key={x} position={[x, 0, -3]}>
          <Box p={[0, 1.2, 0]} s={[2.7, 2.4, 1.6]} c={i === 2 ? '#8a7a66' : '#9c8b74'} />
          <Box p={[-0.4, 0.95, 0.81]} s={[0.8, 1.9, 0.04]} c={i === 2 ? '#0a0a12' : '#4a3426'} />
          <Box p={[0.75, 1.4, 0.81]} s={[0.55, 0.5, 0.04]} c={i === 2 ? '#0a0a12' : '#2b2f3a'} />
          <Box p={[0, 2.5, 0.15]} s={[2.9, 0.08, 2.1]} r={0.12} c="#7d8592" />
        </group>
      ))}
      {/* The empty room's door, ajar, and something pale inside */}
      <mesh position={[2.4, 0.95, -2.17]}>
        <planeGeometry args={[0.7, 1.8]} />
        <meshBasicMaterial color="#bcd0ff" transparent opacity={ghost * 0.5} toneMapped={false} />
      </mesh>
      {/* Dust jumping off the roof, a step after another */}
      {t > 1.9 &&
        t < 3.4 &&
        Array.from({ length: Math.min(6, step + 1) }, (_, k) => {
          const age = t - 1.9 - k * 0.22
          return (
            <mesh key={k} position={[-3.6 + k * 1.3, 2.62 + age * 0.4, -2.9]}>
              <boxGeometry args={[0.18, 0.06, 0.18]} />
              <meshBasicMaterial color="#cfd4dc" transparent opacity={Math.max(0, 0.9 - age * 1.2)} />
            </mesh>
          )
        })}
      {/* The bulb over the doors */}
      <mesh position={[0.6, 2.25, -2.1]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshBasicMaterial color={flicker > 0.5 ? '#fff3bf' : '#5c5a40'} toneMapped={false} />
      </mesh>
      <pointLight position={[0.6, 2.1, -1.9]} intensity={6 * flicker} distance={7} color="#ffe8a3" />
      <Mango p={[-4.6, 0, -0.6]} s={1.1} />
      <directionalLight position={[1, 3, 8]} intensity={1.1} color="#a9b8ff" />
      <pointLight position={[0.9, 1.1, 1.0]} intensity={3} distance={3} color="#ffd8a0" />
      <mesh position={[0.85, 0.95, 0.75]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshBasicMaterial color="#ffe8a3" toneMapped={false} />
      </mesh>
      <P look={BRIGITTE} gender="femme" pose={t > 1.8 ? 'lookup' : 'idle'} at={[0.4, 0, 0.4]} turn={-0.25} seed={9} take={t > 1.8 ? 1 : 0} />
      <Cam at={[0.2 + shake, 1.55 + shake, 6.0 - t * 0.2]} look={[0.2, 1.4, -1.5]} />
    </>
  )
}

/** The maquis at night: Boris and his muscles, the friends filming, laughing. */
function Pari({ t }: { t: number }) {
  const a = 0.3 * Math.sin(t * 0.3) - 0.1
  return (
    <>
      <color attach="background" args={['#160f33']} />
      <fog attach="fog" args={['#160f33', 10, 26]} />
      <hemisphereLight args={['#7a6ad8', '#3a2a1a', 0.7]} />
      <pointLight position={[0, 3, 1.5]} intensity={18} distance={12} color="#ffcf87" castShadow />
      <ambientLight intensity={0.3} />
      <Ground c="#5d5249" />
      <Box p={[0, 1.6, -3.5]} s={[12, 3.2, 0.3]} c="#e8590c" />
      <Box p={[0, 0.5, -3.33]} s={[12, 1, 0.04]} c="#1c7ed6" />
      <Sign p={[0, 2.5, -3.3]} w={4} text="MAQUIS LE BON COIN" bg="#ffd43b" fg="#161a2b" />
      <Bulbs from={[-5, 3.1, -3.2]} to={[5, 3.1, -3.2]} n={18} colors={['#ff6b6b', '#ffd43b', '#69db7c', '#74c0fc']} />
      <TableSet p={[-3.2, 0, -1.6]} c="#e03131" />
      <TableSet p={[3.4, 0, -1.4]} c="#1c7ed6" />
      {/* Bottles on the tables */}
      {[[-3.3, -1.6], [-3.0, -1.5], [3.3, -1.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.92, z]}>
          <cylinderGeometry args={[0.05, 0.05, 0.28, 8]} />
          <meshLambertMaterial color="#2b8a3e" />
        </mesh>
      ))}
      <P look={BORIS} gender="homme" pose={Math.floor(t / 1.3) % 2 ? 'hero' : 'cheer'} at={[0, 0, 0]} seed={5} take={Math.floor(t / 1.3)} />
      <P look={AMI1} gender="homme" pose="film" at={[-1.5, 0, 1.0]} turn={2.2} seed={2} />
      <P look={AMIE} gender="femme" pose="film" at={[1.6, 0, 1.1]} turn={-2.3} seed={3} />
      <P look={AMI2} gender="homme" pose={Math.floor(t / 0.8) % 2 ? 'cheer' : 'clap'} at={[1.9, 0, -0.6]} turn={-1.3} seed={7} take={Math.floor(t / 0.8)} />
      <Cam at={[Math.sin(a) * 5.8, 1.8, Math.cos(a) * 5.8]} look={[0, 1.3, -0.4]} />
    </>
  )
}

/** Tantie Bintou's maquis gone red: the clients bent over, two women whispering in front. */
function Maudit({ t }: { t: number }) {
  const pulse = 0.75 + 0.25 * Math.sin(t * 3)
  return (
    <>
      <color attach="background" args={['#240606']} />
      <fog attach="fog" args={['#2e0909', 6, 20]} />
      <hemisphereLight args={['#ff8a7a', '#2a0a0a', 0.6]} />
      <pointLight position={[0, 3, 0]} intensity={16 * pulse} distance={12} color="#ff4d3d" castShadow />
      <ambientLight intensity={0.2} />
      <Ground c="#4a2a22" />
      <Box p={[0, 1.6, -3.6]} s={[12, 3.2, 0.3]} c="#7a2e1d" />
      <Sign p={[0, 2.5, -3.4]} w={4.2} text="CHEZ TANTIE BINTOU" bg="#c92a2a" fg="#fff3bf" />
      {/* The counter and its pots */}
      <Box p={[0, 0.5, -2.6]} s={[3.2, 1, 0.7]} c="#5c3a21" />
      {[-0.9, 0, 0.9].map((x) => (
        <mesh key={x} position={[x, 1.15, -2.6]}>
          <cylinderGeometry args={[0.22, 0.2, 0.3, 12]} />
          <meshLambertMaterial color="#868e96" />
        </mesh>
      ))}
      <P look={BINTOU} gender="femme" pose={Math.floor(t / 1.6) % 2 ? 'despair' : 'idle'} at={[0, 0, -3.1]} seed={4} />
      <TableSet p={[-2.8, 0, -0.8]} c="#e8590c" />
      <TableSet p={[2.8, 0, -0.9]} c="#e8590c" />
      <P look={CLIENT1} gender="homme" pose="despair" at={[-2.8, 0, 0.35]} turn={Math.PI} seed={6} />
      <P look={CLIENT2} gender="homme" pose={Math.floor(t / 1.1) % 2 ? 'stumble' : 'flinch'} at={[2.4, 0, 0.4]} turn={-0.4} seed={7} take={Math.floor(t / 1.1)} />
      {/* The two neighbours in front, whispering */}
      <P look={COMMERE1} gender="femme" pose="talk" at={[-0.85, 0, 1.0]} turn={1.2} seed={8} />
      <P look={COMMERE2} gender="femme" pose={Math.floor(t / 1.2) % 2 ? 'talk' : 'idle'} at={[0.25, 0, 1.15]} turn={-1.4} seed={9} />
      <Cam at={[-1.2 + t * 0.25, 1.7, 6.0]} look={[0, 1.3, -0.8]} />
    </>
  )
}

/** A plane crossing the clouds, under the map of the trips. */
function Ciel({ t }: { t: number }) {
  const x = -6 + t * 2.6
  return (
    <>
      <color attach="background" args={['#6cc0ff']} />
      <hemisphereLight args={['#ffffff', '#6aa0d8', 1.3]} />
      <directionalLight position={[3, 6, 5]} intensity={1.4} />
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[((i * 5.3 - t * 0.8) % 30) - 12, -3 + (i % 3) * 0.6, -4 - (i % 4) * 2]}>
          {[0, 0.9, -0.8, 0.3].map((dx, j) => (
            <mesh key={j} position={[dx, (j % 2) * 0.4, 0]}>
              <icosahedronGeometry args={[0.9 - j * 0.12, 0]} />
              <meshLambertMaterial color="#ffffff" flatShading />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[x, -2.2 + Math.sin(t) * 0.15, 0]} rotation={[0, Math.PI / 2, 0.05]} scale={0.8}>
        <Box p={[0, 0, 0]} s={[0.7, 0.7, 3.4]} c="#f8f9fa" />
        <Box p={[0, 0, 1.85]} s={[0.5, 0.5, 0.4]} c="#f8f9fa" />
        <Box p={[0, 0.05, 0.1]} s={[4.2, 0.1, 0.8]} c="#ff7a00" />
        <Box p={[0, 0.6, -1.5]} s={[0.1, 0.9, 0.6]} c="#00b86b" />
        <Box p={[0, 0.1, -1.5]} s={[1.6, 0.08, 0.5]} c="#ff7a00" />
        <Box p={[0.36, 0.12, 0.8]} s={[0.02, 0.18, 1.6]} c="#1c7ed6" />
      </group>
      <Cam at={[0, 0, 8]} look={[0, -0.6, 0]} />
    </>
  )
}

/** Everyone of the film, together on the rooftop at nightfall. */
function Fin({ t }: { t: number }) {
  const crew: [Look, 'femme' | 'homme', number][] = [[KONE, 'homme', -2.4], [BRIGITTE, 'femme', -1.2], [AWA, 'femme', 0], [BORIS, 'homme', 1.2], [BINTOU, 'femme', 2.4]]
  return (
    <>
      <color attach="background" args={['#3b2a6b']} />
      <fog attach="fog" args={['#3b2a6b', 14, 34]} />
      <hemisphereLight args={['#b9a6ff', '#4a2a3a', 0.9]} />
      <directionalLight position={[2, 5, 6]} intensity={1.6} color="#ffd8a8" />
      <Skyline lit={1} />
      {Array.from({ length: 10 }, (_, i) => Array.from({ length: 6 }, (_, j) => <Box key={`${i}-${j}`} p={[-4.5 + i, -0.05, -2 + j]} s={[0.98, 0.1, 0.98]} c={(i + j) % 2 ? '#c9b291' : '#b89e7c'} />))}
      <Box p={[0, 0.5, -2.6]} s={[10, 1, 0.25]} c="#d9c8a8" />
      <Bulbs from={[-4.5, 2.6, -2.4]} to={[4.5, 2.6, -2.4]} n={16} colors={['#ffd43b', '#ff922b', '#ffe066']} />
      {crew.map(([look, g, x], i) => (
        <P key={i} look={look} gender={g} pose={(Math.floor(t / 0.9) + i) % 3 === 0 ? 'cheer' : 'wave'} at={[x, 0, 0]} seed={i * 3 + 1} take={Math.floor(t / 0.9)} />
      ))}
      <Cam at={[0, 1.9, 6.4]} look={[0, 1.2, 0]} />
    </>
  )
}

/** One scene of the film, at t seconds into its shot. */
export function HistoiresWorld({ scene, t }: { scene: string; t: number }) {
  const [name, mode = ''] = scene.slice(5).split('-')
  if (name === 'terrasse') return <Terrasse t={t} mode={mode} />
  if (name === 'grin') return <Grin t={t} retour={mode === 'retour'} />
  if (name === 'cour') return <Cour t={t} />
  if (name === 'pari') return <Pari t={t} />
  if (name === 'maudit') return <Maudit t={t} />
  if (name === 'ciel') return <Ciel t={t} />
  if (name === 'fin') return <Fin t={t} />
  return null
}

/** Awa's face in her corner, the detailed perso talking. */
export function HistAwaFace({ t, size, talking }: { t: number; size: number; talking?: boolean }) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas frameloop="never" gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} dpr={2} camera={{ fov: 30, near: 0.1, far: 20, position: [0, 1.62, size > 100 ? 1.5 : 1.05] }} onCreated={({ camera }) => camera.lookAt(0, 1.56, 0)}>
        <hemisphereLight args={['#fff4e6', '#c0704f', 1.3]} />
        <directionalLight position={[1, 2, 3]} intensity={1.6} />
        <DetailHuman look={AWA} gender="femme" pose={talking ? (Math.floor(t / 1.5) % 3 === 2 ? 'wave' : 'talk') : 'idle'} seed={11} take={Math.floor(t / 1.5)} />
      </Canvas>
    </div>
  )
}
