import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Pose } from '../../avatar/Human'
import { OUTFIT_DEFAULT_COLOR, randomLook } from '../../avatar/options'

/** The school's uniform, khaki (the girls' skirt blue: avatar/options). */
const UNIFORM = OUTFIT_DEFAULT_COLOR.uniforme
import type { Look, Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { Character, sizeOf } from '../Character'
import { Box } from '../props'
import { rng } from '../themes'
import { Talkable } from '../Talkable'
import { doingOf, type Npc } from '../talk'

// A day at school, seen (« Aller à l'école », « Aller à la crèche »): the
// child at its table-banc among the class, the maître at the blackboard, then
// the récré in the cour under the mango tree (the ball, the skipping rope, the
// clapping games) with its friend from childhood, then back to class; the
// baby at the crèche on the mats with the others, the nounous round them.
// Which part of the day it is comes from how far the activity has gone.

type V3 = [number, number, number]
export type SchoolPart = 'classe' | 'recre' | 'creche'

/** The part of the day: class, the récré in the middle, class again; the crèche all along. */
export function schoolPart(interactionId: string | undefined, progress: number): SchoolPart {
  if (interactionId === 'creche') return 'creche'
  return progress > 0.4 && progress < 0.62 ? 'recre' : 'classe'
}

/** What's going on, said at the top of the screen. */
export const SCHOOL_LINE: Record<SchoolPart, string> = {
  classe: 'En classe · le maître fait la leçon',
  recre: 'La récré ! Tout le monde dans la cour',
  creche: 'À la crèche · on joue avec les autres bébés',
}

/** A classmate (the same ones every day for this Sim). */
type Kid = { look: Look; gender: 'femme' | 'homme'; seed: number }

function useClass(simId: string, n: number): Kid[] {
  return useMemo(() => {
    const r = rng(`classe:${simId}`)
    return [...Array(n)].map((_, i) => {
      const gender = r() < 0.5 ? 'femme' : 'homme'
      const l = randomLook(gender, r)
      return { gender, seed: i * 3.1 + 1, look: { ...l, outfit: 'uniforme', outfitColor: UNIFORM, beard: 'none', accessory: 'none', marks: 'none' } }
    })
  }, [simId, n])
}

/** A table-banc: the bench and the desk in one, two pupils side by side. */
function TableBanc({ p, k }: { p: V3; k: number }) {
  const seat = 0.43 * k
  const desk = 0.74 * k
  return (
    <group position={p}>
      <Box p={[0, desk, -0.25 * k]} s={[1.3 * k + 0.3, 0.05, 0.45 * k]} c="#8a5a32" />
      <Box p={[0, seat, 0.28 * k]} s={[1.3 * k + 0.3, 0.05, 0.32 * k]} c="#7a4e2a" />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Box p={[sx * (0.65 * k + 0.1), desk / 2, -0.25 * k]} s={[0.06, desk, 0.4 * k]} c="#5c3a1e" />
          <Box p={[sx * (0.65 * k + 0.1), seat / 2, 0.28 * k]} s={[0.06, seat, 0.28 * k]} c="#5c3a1e" />
        </group>
      ))}
      {/* The exercise books open on the desk */}
      {[-0.32, 0.32].map((x) => (
        <Box key={x} p={[x * k, desk + 0.03, -0.22 * k]} s={[0.3 * k, 0.01, 0.2 * k]} c="#f8f9fa" />
      ))}
    </group>
  )
}

/** The maître's hand on the blackboard: chalk lines appearing as the lesson goes on. */
function Board() {
  const chalk = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    chalk.current?.children.forEach((c, i) => (c.visible = (t * 0.3) % 6 > i * 0.6))
  })
  return (
    <group position={[0, 0, -3.92]}>
      <Box p={[0, 1.65, 0]} s={[4.2, 1.5, 0.06]} c="#5c3a1e" />
      <Box p={[0, 1.65, 0.035]} s={[4, 1.32, 0.02]} c="#2f5d46" />
      <group ref={chalk}>
        {[...Array(9)].map((_, i) => (
          <Box key={i} p={[-1.6 + (i % 3) * 1.25 + 0.4, 2.1 - Math.floor(i / 3) * 0.32, 0.05]} s={[0.6 + ((i * 7) % 3) * 0.2, 0.04, 0.005]} c="#f1f3f5" />
        ))}
      </group>
      {/* The flag, orange white green, by the board */}
      {['#f77f00', '#ffffff', '#009e60'].map((c, i) => (
        <Box key={c} p={[2.75 + i * 0.22, 2.1, 0.03]} s={[0.22, 0.5, 0.02]} c={c} />
      ))}
    </group>
  )
}

/** The ball between the Sim and its friend, kicked back and forth. */
function Ball({ a, b }: { a: V3; b: V3 }) {
  const m = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime()
    const k = (Math.sin(t * 1.8) + 1) / 2
    m.current?.position.set(a[0] + (b[0] - a[0]) * k, 0.12 + Math.abs(Math.sin(t * 3.6)) * 0.25, a[2] + (b[2] - a[2]) * k)
  })
  return (
    <mesh ref={m}>
      <sphereGeometry args={[0.12, 12, 10]} />
      <meshLambertMaterial color="#ffffff" />
    </mesh>
  )
}

/** The skipping rope turning round the one jumping. */
function Rope({ p }: { p: V3 }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.rotation.x = worldTime() * 7
  })
  return (
    <group position={[p[0], 0.75, p[2]]} ref={g}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.6, 0.03, 0.03]} />
        <meshLambertMaterial color="#e64980" />
      </mesh>
    </group>
  )
}

/** Someone of the school one can tap to talk to (a classmate, the maître, a nounou, the friend). */
function Person({ npc, p, r = 0, pose, stage, look, gender, seed }: { npc?: Npc; p: V3; r?: number; pose: Pose; stage: string; look: Look; gender: 'femme' | 'homme'; seed: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      {npc ? (
        <Talkable npc={npc} pose={pose}>
          {(shown) => <Character look={look} gender={gender} pose={shown} stage={stage} marker={false} seed={seed} />}
        </Talkable>
      ) : (
        <Character look={look} gender={gender} pose={pose} stage={stage} marker={false} seed={seed} />
      )}
    </group>
  )
}

/** The friend from childhood, as the scene needs them. */
export type Buddy = { id: string; name: string; look: Look; gender: 'femme' | 'homme' }

export function SchoolDay({ sim, stage, part, buddy, night }: { sim: Sim; stage: string; part: SchoolPart; buddy?: Buddy; night?: boolean }) {
  const kids = useClass(sim.id, 12)
  const k = sizeOf(stage).scale
  const teacher = useMemo(() => {
    const r = rng(`maitre:${sim.id}`)
    const gender = r() < 0.5 ? 'femme' : 'homme'
    return { gender, look: { ...randomLook(gender, r), outfit: gender === 'femme' ? 'pagne' : 'chemise', accessory: 'glasses' } as Look }
  }, [sim.id]) as { gender: 'femme' | 'homme'; look: Look }
  const buddyNpc: Npc | undefined = buddy && { id: buddy.id, name: buddy.name, gender: buddy.gender, seed: 7, look: buddy.look, doing: undefined }
  const me = { ...sim.look, outfit: part === 'creche' ? sim.look.outfit : 'uniforme', outfitColor: part === 'creche' ? sim.look.outfitColor : UNIFORM, accessory: 'none' } as Look
  const buddyLook = buddy && ({ ...buddy.look, outfit: part === 'creche' ? buddy.look.outfit : 'uniforme', outfitColor: part === 'creche' ? buddy.look.outfitColor : UNIFORM, accessory: 'none' } as Look)

  // Class: three rows of table-bancs, two to a desk; the Sim at the second row on the left, its friend beside it.
  const rows = [-1.6, 0, 1.6]
  const cols = [-2.4, 0, 2.4]
  const seats: { p: V3; who: 'me' | 'buddy' | number }[] = []
  let n = 0
  rows.forEach((z, ri) =>
    cols.forEach((x, ci) =>
      [-0.32, 0.32].forEach((dx, di) => {
        const at: V3 = [x + dx * k, 0, z + 0.28 * k]
        if (ri === 1 && ci === 0) seats.push({ p: at, who: di === 0 ? 'me' : buddy ? 'buddy' : n++ })
        else if (n < kids.length) seats.push({ p: at, who: n++ })
      }),
    ),
  )

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: part === 'recre' ? [7, 6.5, 10] : [4.5, 5.6, 7.5], fov: 42 }} style={{ background: night ? '#1a1f3a' : '#a9d3f0' }}>
      <hemisphereLight args={['#fff6e8', '#7a6040', 1.1]} />
      <directionalLight position={[6, 12, 8]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={0.25} />
      {part === 'classe' && (
        <group>
          {/* The classroom: the floor, the walls cut away on the camera's side, the windows */}
          <Box p={[0, -0.05, 0]} s={[9, 0.1, 8.2]} c="#c9b28a" />
          <Box p={[0, 1.5, -4.05]} s={[9, 3, 0.1]} c="#f2e3c3" />
          <Box p={[-4.55, 1.5, 0]} s={[0.1, 3, 8.2]} c="#f2e3c3" />
          <Box p={[0, 0.5, -4.0]} s={[9, 1, 0.02]} c="#3a6ea5" />
          {[-2, 0.5, 3].map((z) => (
            <Box key={z} p={[-4.5, 1.7, z]} s={[0.04, 0.9, 1.2]} c="#cfe8f2" />
          ))}
          <Board />
          {/* The maître's desk and the maître at the board, the chalk in hand */}
          <Box p={[2.6, 0.38, -2.9]} s={[1.4, 0.76, 0.7]} c="#6b4426" />
          <Person npc={{ id: `maitre:${sim.id}`, name: teacher.gender === 'femme' ? 'La maîtresse' : 'Le maître', gender: teacher.gender, seed: 5, look: teacher.look, doing: doingOf('talk') }} p={[-0.6, 0, -3.3]} r={0.2} pose="talk" stage="adulte" look={teacher.look} gender={teacher.gender} seed={5} />
          {rows.map((z) => cols.map((x) => <TableBanc key={`${x}${z}`} p={[x, 0, z]} k={k} />))}
          {seats.map((s, i) =>
            s.who === 'me' ? (
              <Person key={i} p={s.p} r={Math.PI} pose="write" stage={stage} look={me} gender={sim.gender} seed={0} />
            ) : s.who === 'buddy' && buddy && buddyLook ? (
              <Person key={i} npc={buddyNpc} p={s.p} r={Math.PI} pose="write" stage={stage} look={buddyLook} gender={buddy.gender} seed={7} />
            ) : typeof s.who === 'number' ? (
              <Person key={i} p={s.p} r={Math.PI} pose="write" stage={stage} look={kids[s.who].look} gender={kids[s.who].gender} seed={kids[s.who].seed} />
            ) : null,
          )}
        </group>
      )}
      {part === 'recre' && (
        <group>
          {/* The cour: red earth, the school's front, the mango tree's shade */}
          <Box p={[0, -0.05, 0]} s={[22, 0.1, 18]} c="#c98a52" />
          <Box p={[0, 1.6, -7]} s={[16, 3.2, 1]} c="#f2e3c3" />
          <Box p={[0, 0.6, -6.45]} s={[16, 1.2, 0.05]} c="#3a6ea5" />
          {[-6, -3, 0, 3, 6].map((x) => (
            <Box key={x} p={[x, 1.6, -6.46]} s={[1.6, 1.8, 0.05]} c="#2b2b30" />
          ))}
          <mesh position={[-6, 1.5, 2]} castShadow>
            <cylinderGeometry args={[0.35, 0.5, 3, 8]} />
            <meshLambertMaterial color="#6b4a2e" />
          </mesh>
          <mesh position={[-6, 4, 2]} castShadow>
            <sphereGeometry args={[2.8, 12, 10]} />
            <meshLambertMaterial color="#2f7d32" />
          </mesh>
          {/* The Sim and its friend kicking the ball to each other */}
          <Person p={[0, 0, 1.5]} r={Math.PI} pose="kick" stage={stage} look={me} gender={sim.gender} seed={0} />
          {buddy && buddyLook ? <Person npc={buddyNpc} p={[0, 0, -1.5]} pose="kick" stage={stage} look={buddyLook} gender={buddy.gender} seed={7} /> : <Person p={[0, 0, -1.5]} pose="kick" stage={stage} look={kids[0].look} gender={kids[0].gender} seed={1} />}
          <Ball a={[0, 0, 1.1]} b={[0, 0, -1.1]} />
          {/* The skipping rope, the clapping game, the ones running about */}
          <Person p={[4.5, 0, 0]} pose="cheer" stage={stage} look={kids[1].look} gender={kids[1].gender} seed={2} />
          <Rope p={[4.5, 0, 0]} />
          <Person p={[3.6, 0, 0]} r={Math.PI / 2} pose="busy" stage={stage} look={kids[2].look} gender={kids[2].gender} seed={3} />
          <Person p={[5.4, 0, 0]} r={-Math.PI / 2} pose="busy" stage={stage} look={kids[3].look} gender={kids[3].gender} seed={4} />
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2
            return <Person key={i} p={[3 + Math.cos(a) * 0.9, 0, 4 + Math.sin(a) * 0.9]} r={-a - Math.PI / 2} pose="clap" stage={stage} look={kids[4 + i].look} gender={kids[4 + i].gender} seed={5 + i} />
          })}
          {[0, 1, 2].map((i) => (
            <Person key={i} p={[-3 + i * 1.2, 0, 5]} r={0.4 * i} pose="run" stage={stage} look={kids[8 + i].look} gender={kids[8 + i].gender} seed={9 + i} />
          ))}
          {/* The maître keeping an eye on them, by the door */}
          <Person p={[6.5, 0, -5]} r={-2.4} pose="idle" stage="adulte" look={teacher.look} gender={teacher.gender} seed={5} />
        </group>
      )}
      {part === 'creche' && (
        <group>
          <Box p={[0, -0.05, 0]} s={[9, 0.1, 8]} c="#f3e7d3" />
          <Box p={[0, 1.4, -4]} s={[9, 2.8, 0.1]} c="#ffe8a8" />
          <Box p={[-4.5, 1.4, 0]} s={[0.1, 2.8, 8]} c="#ffd0e0" />
          {/* The mats, the cots, the toys */}
          {[
            ['#ff8fb1', -1.5, 0],
            ['#74c0fc', 1.2, 0.4],
            ['#8ce99a', -0.2, 2.2],
          ].map(([c, x, z]) => (
            <Box key={c as string} p={[x as number, 0.02, z as number]} s={[2, 0.04, 1.6]} c={c as string} />
          ))}
          {[-3, -1.5, 0].map((x) => (
            <group key={x} position={[x, 0, -3.3]}>
              <Box p={[0, 0.5, 0]} s={[1.1, 0.06, 0.7]} c="#f8f9fa" />
              {[-0.5, 0.5].map((sx) => [-0.3, 0.3].map((sz) => <Box key={`${sx}${sz}`} p={[sx, 0.45, sz]} s={[0.05, 0.9, 0.05]} c="#e9ecef" />))}
            </group>
          ))}
          {['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c'].map((c, i) => (
            <Box key={c} p={[0.6 + (i % 2) * 0.22, 0.1 + Math.floor(i / 2) * 0.2, 1.2]} s={[0.2, 0.2, 0.2]} c={c} />
          ))}
          {/* The Sim among the babies, its friend from the crèche beside it */}
          <Person p={[-1.5, 0.04, 0]} pose="busy" stage="bebe" look={sim.look} gender={sim.gender} seed={0} />
          {buddy && <Person npc={buddyNpc} p={[-0.9, 0.04, 0.2]} r={-1} pose="clap" stage="bebe" look={buddy.look} gender={buddy.gender} seed={7} />}
          {kids.slice(0, 4).map((b, i) => (
            <Person key={i} p={[1.0 + (i % 2) * 0.6, 0.04, 0.2 + Math.floor(i / 2) * 0.6 + (i === 3 ? 1.5 : 0)]} r={i} pose={i % 2 ? 'idle' : 'busy'} stage="bebe" look={{ ...b.look, outfit: 'casual' }} gender={b.gender} seed={b.seed} />
          ))}
          {/* The nounous, kneeling with the little ones */}
          <Person npc={{ id: `nounou:${sim.id}`, name: 'Tantie nounou', gender: 'femme', seed: 11, look: teacher.look, doing: undefined }} p={[-1.5, 0, 1.0]} r={Math.PI} pose="pray" stage="adulte" look={{ ...teacher.look, outfit: 'blouse' }} gender="femme" seed={11} />
          <Person p={[1.3, 0, 1.4]} r={Math.PI} pose="pray" stage="adulte" look={{ ...kids[5].look, outfit: 'blouse', beard: 'none' }} gender="femme" seed={12} />
        </group>
      )}
      <OrbitControls makeDefault target={part === 'recre' ? [1, 0.6, 0.5] : [-1, 0.6, -0.5]} enablePan={false} minDistance={4} maxDistance={20} minPolarAngle={0.35} maxPolarAngle={1.3} enableDamping />
    </Canvas>
  )
}
