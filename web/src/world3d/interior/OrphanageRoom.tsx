import { Box } from '../props'
import type { Pose } from '../../avatar/Human'

// The orphanage (game kind 'orphelinat': the Orphelinat de filles of
// Grand-Bassam, the pouponnières, the centres de protection de la petite
// enfance): one big bright room. The children play in a ring on the mat in
// the middle, its squares of every colour, the blocks and a ball about; in the
// corner at the back the bookshelf and the bench where stories are read, the
// little ones on stools before it; the low table where they eat, by the
// left wall, the washing drying on its line behind it; the directrice's desk
// by the door, the box for the gifts on it.

type V3 = [number, number, number]
type Spot = { p: V3; r?: number; pose: Pose; /** A child: drawn small, never a stranger's to chat up (Interior.tsx). */ kid?: boolean; g?: 'femme' | 'homme' }

/** The ring on the mat: its middle, how far round, the children's places (angle round it): the nounou's (0) and the Sim's (π, at the front) left free. */
const RING = { x: 0, z: -0.4, r: 1.25 }
const RING_KIDS = [0.85, 1.65, 2.4, 3.9, 4.65, 5.45]
/** The reading corner (the Sim on the bench), and the stools of the children before it. */
const READ = { x: 3.9, z: -2.9 }
const LISTENERS: [number, number][] = [
  [3.2, -1.9],
  [3.9, -1.7],
  [4.6, -1.9],
]
/** The children at the low table, eating. */
const EATERS: [number, number, number][] = [
  [-4.6, 0.2, Math.PI / 2],
  [-4.6, 1.2, Math.PI / 2],
  [-3.0, 0.2, -Math.PI / 2],
  [-3.0, 1.2, -Math.PI / 2],
]
const MAT = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#ffa94d']

export function orphanageRoom(): { floor: string; wall: string; dark: boolean; furniture: React.ReactNode; spots: Record<string, Spot>; crowd: Spot[] } {
  return {
    floor: '#e9d8b4',
    wall: '#fff1c1',
    dark: false,
    furniture: (
      <>
        {/* The mat in the middle, in squares of every colour; the blocks, the ball */}
        {[...Array(16)].map((_, i) => (
          <Box key={i} p={[RING.x - 1.5 + (i % 4) + 0.5, 0.02, RING.z - 1.5 + Math.floor(i / 4) + 0.5]} s={[0.98, 0.03, 0.98]} c={MAT[(i + Math.floor(i / 4)) % MAT.length]} />
        ))}
        {[
          [-0.3, -0.5, '#e03131'],
          [-0.1, -0.3, '#1971c2'],
          [0.2, -0.6, '#f08c00'],
        ].map(([x, z, c]) => (
          <Box key={String(c)} p={[x as number, 0.13, z as number]} s={[0.2, 0.2, 0.2]} c={c as string} />
        ))}
        <mesh position={[0.5, 0.15, -0.2]}>
          <sphereGeometry args={[0.13, 12, 10]} />
          <meshLambertMaterial color="#ff8787" />
        </mesh>
        {/* The reading corner: the bookshelf, the bench, the stools */}
        <Box p={[READ.x, 0.9, -4.15]} s={[1.8, 1.8, 0.35]} c="#a0522d" />
        {[0.45, 0.95, 1.45].map((y, k) => (
          <group key={y}>
            <Box p={[READ.x, y, -4.0]} s={[1.7, 0.04, 0.3]} c="#7a3e1d" />
            {[...Array(6)].map((_, i) => (
              <Box key={i} p={[READ.x - 0.7 + i * 0.27, y + 0.16, -4.0]} s={[0.12, 0.28, 0.22]} c={MAT[(i + k * 2) % MAT.length]} />
            ))}
          </group>
        ))}
        <Box p={[READ.x, 0.22, READ.z - 0.15]} s={[1.6, 0.44, 0.45]} c="#c07a3e" />
        {LISTENERS.map(([x, z]) => (
          <Box key={x} p={[x, 0.14, z]} s={[0.32, 0.28, 0.32]} c="#4dabf7" />
        ))}
        {/* The low table where they eat, its little stools, the bowls */}
        <Box p={[-3.8, 0.48, 0.7]} s={[1.0, 0.06, 2.0]} c="#f8f9fa" />
        {[-0.85, 0.85].flatMap((dz) => [-0.4, 0.4].map((dx) => <Box key={`${dx}${dz}`} p={[-3.8 + dx, 0.24, 0.7 + dz]} s={[0.06, 0.48, 0.06]} c="#adb5bd" />))}
        {EATERS.map(([x, z]) => (
          <group key={`${x}${z}`}>
            <Box p={[x, 0.14, z]} s={[0.32, 0.28, 0.32]} c="#ffd43b" />
            <Box p={[x + (x < -3.8 ? 0.42 : -0.42), 0.55, z]} s={[0.2, 0.08, 0.2]} c="#ff922b" />
          </group>
        ))}
        {/* The washing drying on its line, behind the table */}
        <Box p={[-5.7, 1.0, -2.6]} s={[0.06, 2.0, 0.06]} c="#868e96" />
        <Box p={[-3.4, 1.0, -2.6]} s={[0.06, 2.0, 0.06]} c="#868e96" />
        <Box p={[-4.55, 1.9, -2.6]} s={[2.3, 0.02, 0.02]} c="#dee2e6" />
        {[-5.3, -4.9, -4.5, -4.1, -3.7].map((x, i) => (
          <Box key={x} p={[x, 1.68, -2.6]} s={[0.3, 0.42, 0.03]} c={MAT[(i * 2) % MAT.length]} />
        ))}
        {/* The directrice's desk by the door; the box for the gifts on it */}
        <Box p={[3.9, 0.4, 2.3]} s={[1.8, 0.8, 0.8]} c="#8d6e4a" />
        <Box p={[3.4, 0.98, 2.2]} s={[0.4, 0.36, 0.3]} c="#e64980" />
        <Box p={[3.4, 1.17, 2.2]} s={[0.22, 0.02, 0.04]} c="#212529" />
        <Box p={[4.3, 0.83, 2.3]} s={[0.5, 0.04, 0.35]} c="#f8f9fa" />
        <Box p={[3.9, 0.25, 1.55]} s={[0.45, 0.5, 0.45]} c="#495057" />
      </>
    ),
    spots: {
      // In the ring on the mat, clapping the song with them.
      play: { p: [RING.x, 0.04, RING.z + RING.r], r: Math.PI, pose: 'clap' },
      // On the bench of the reading corner, the book in hand, turned to the little ones.
      read: { p: [READ.x, 0.05, READ.z - 0.15], pose: 'sit' },
      // By the low table, serving.
      table: { p: [-3.8, 0, 2.0], r: Math.PI, pose: 'busy' },
      // Before the directrice's desk, the gift.
      desk: { p: [3.9, 0, 3.1], r: Math.PI, pose: 'talk' },
      // At the washing line.
      linge: { p: [-4.5, 0, -1.9], r: Math.PI, pose: 'busy' },
      counter: { p: [3.9, 0, 3.1], r: Math.PI, pose: 'idle' },
      entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
    },
    crowd: [
      // The directrice at her desk
      { p: [3.9, 0, 1.55], pose: 'talk', g: 'femme' },
      // The nounou in the ring with them
      { p: [RING.x, 0.04, RING.z - RING.r], pose: 'clap', g: 'femme' },
      // The children: in the ring, turned to its middle…
      ...RING_KIDS.map((a): Spot => ({ p: [RING.x + Math.sin(a + Math.PI) * RING.r, 0.04, RING.z + Math.cos(a + Math.PI) * RING.r], r: a, pose: (['dance', 'clap', 'cheer', 'wave', 'dance', 'clap'] as Pose[])[RING_KIDS.indexOf(a)], kid: true })),
      // …listening to the story…
      ...LISTENERS.map(([x, z]): Spot => ({ p: [x, 0.02, z], r: Math.PI, pose: 'sit', kid: true })),
      // …and eating.
      ...EATERS.map(([x, z, r]): Spot => ({ p: [x, 0.02, z], r, pose: 'eat', kid: true })),
    ],
  }
}
