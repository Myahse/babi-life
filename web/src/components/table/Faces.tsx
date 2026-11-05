import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Look } from '../../lib/types'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { lookAt, randomLook } from '../../avatar/options'
import { setExpression, type Expression } from '../../avatar/expressions'
import { sceneDpr } from '../../lib/device'

// The people across the table (dames, 8 américain, awalé, Ludo): their real 3D busts in the game's blocks,
// side by side in one small canvas, living the game: they think on their turn, grin when they take, frown
// when they lose a piece, cheer or sulk at the end (avatar/expressions.ts through each one's faceId). A
// player of the game with no look given gets one drawn from their name, the same on every phone.

export type TablePerson = { id: string; name: string; look?: Look; gender?: 'femme' | 'homme' }

/** What happened to someone at the table, as their face shows it. */
export type TableMood = 'think' | 'good' | 'great' | 'bad' | 'won' | 'lost' | 'surprised' | 'calm'
const FACE: Record<TableMood, Expression> = { think: 'thinking', good: 'grin', great: 'laugh', bad: 'annoyed', won: 'cheer', lost: 'disappointed', surprised: 'surprised', calm: 'smile' }
const faceId = (id: string) => `table:${id}`

/** Shows a mood on someone's face at the table for a while (`ms`). */
export function tableMood(id: string, mood: TableMood, ms = 2200) {
  setExpression(faceId(id), FACE[mood], ms)
}

/** A string's hash, for a look drawn from a name. */
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const seeded = (seed: number) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9), ((seed >>> 0) % 100000) / 100000)
/** First names heard as a woman's (the game's tanties and players); the others by the name's end. */
const WOMEN = /^(tantie|tata|maman|mémé|mama|awa|aya|mariam|fanta|aminata|adjoua|akissi|affoué|amenan|bintou|fatou|salimata|ramatou|rokia|nadia|grace|ruth|sarah|la reine|lareine)/i
export const genderOf = (name: string): 'femme' | 'homme' => (WOMEN.test(name) || /(a|ette|ine|elle)$/i.test(name.split(/[\s_]/)[0] ?? '') ? 'femme' : 'homme')

/** Someone's bust at the table: posed, its face its own. */
function Bust({ p, x, pose, turn, lean }: { p: TablePerson; x: number; pose: Pose; turn: number; lean: boolean }) {
  const gender = p.gender ?? genderOf(p.name)
  const look = useMemo(() => lookAt(p.look ?? randomLook(gender, seeded(hash(p.name)))), [p.look, p.name, gender])
  const ref = useRef<THREE.Group>(null)
  // On its turn it leans in over the board, its head down a little; then back.
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const k = 1 - Math.exp(-dt * 5)
    g.rotation.x += ((lean ? 0.16 : 0) - g.rotation.x) * k
    g.position.z += ((lean ? 0.08 : 0) - g.position.z) * k
  })
  return (
    <group position={[x, 0, 0]} rotation={[0, turn, 0]}>
      <group ref={ref}>
        <Human look={look} gender={gender} pose={pose} seed={hash(p.name) % 97} fitted full faceId={faceId(p.id)} />
      </group>
    </group>
  )
}

/**
 * The people across the table, in a strip `height` px tall: each one's bust, turned a little toward the
 * middle; the one whose turn it is (`playing`) leans in, its hand at its chin.
 */
export default function TableFaces({ people, playing, height = 92, className = '' }: { people: TablePerson[]; playing?: string | null; height?: number; className?: string }) {
  const n = people.length
  // Spaced so the heads fit the strip's width at any count (1 to 3).
  const gap = 0.85
  const width = Math.max(1, n) * gap
  return (
    <div className={`pointer-events-none relative ${className}`} style={{ height }}>
      <Canvas dpr={sceneDpr} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} camera={{ position: [0, 1.52, 1.7], fov: 22 }} onCreated={({ camera }) => camera.lookAt(0, 1.4, 0)}>
        <hemisphereLight args={['#fff7e6', '#8a6a4a', 2]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[0.8, 2.5, 4]} intensity={2.2} />
        <NoShadows>
          <group scale={Math.min(1, 2.6 / width)}>
            {people.map((p, i) => {
              const x = (i - (n - 1) / 2) * gap
              const me = playing === p.id
              return <Bust key={p.id} p={p} x={x} pose="idle" turn={-x * 0.5} lean={me} />
            })}
          </group>
        </NoShadows>
      </Canvas>
    </div>
  )
}
