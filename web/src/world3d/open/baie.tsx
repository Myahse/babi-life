import { useMemo } from 'react'
import * as THREE from 'three'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'

// La Baie de Cocody: the promenade on the bay's Cocody bank, on the ground won
// from the water by the bay's works (the « Sauvegarde et valorisation de la baie
// de Cocody »: quays for walking, a sports plain, an urban park, a marina; the
// Alassane-Ouattara bridge crosses the bay just north of it). As the game draws
// it: the quay along the water with its white railing, the wide paved promenade
// under the coconut palms and the lamps, benches turned to the water and the
// Plateau beyond, the lawn with its paths and a fountain in the middle, an
// outdoor gym, a little playground, two kiosks, the pontoon out on the water
// with its boats, and the way in with the bay's name. The layout and the big
// letters are made up for the game, not surveyed.
//
// The landmark's frame: +z toward the land (the way in), the water behind (−z):
// places.ts sets it with its back to the nearest shore (ON_SHORE), the quay's
// edge on the water's.

/** The quay's edge (the water beyond it), and the promenade between it and the lawn. */
const QUAY = -21
const WALK = { z0: -20.5, z1: -8 }
const HALF = 42

const M = {
  lawn: new THREE.MeshLambertMaterial({ color: '#5f9e48', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  paving: new THREE.MeshLambertMaterial({ color: '#d9d2c3', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  band: new THREE.MeshLambertMaterial({ color: '#b9846a', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  path: new THREE.MeshLambertMaterial({ color: '#e8e1d2', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  quay: new THREE.MeshLambertMaterial({ color: '#bfbab0' }),
  rail: new THREE.MeshLambertMaterial({ color: '#f1f3f5' }),
  wood: new THREE.MeshLambertMaterial({ color: '#9a6a3c' }),
  iron: new THREE.MeshLambertMaterial({ color: '#2f3640' }),
  trunk: new THREE.MeshLambertMaterial({ color: '#8a6a48' }),
  palm: new THREE.MeshLambertMaterial({ color: '#3d8b3a' }),
  bush: new THREE.MeshLambertMaterial({ color: '#2f7a35' }),
  flower: new THREE.MeshLambertMaterial({ color: '#e8590c' }),
  basin: new THREE.MeshLambertMaterial({ color: '#cfc8b8' }),
  pool: new THREE.MeshLambertMaterial({ color: '#3cb7d6', emissive: '#22b6d6', emissiveIntensity: 0 }),
  jet: new THREE.MeshLambertMaterial({ color: '#e7f8ff', emissive: '#bfefff', emissiveIntensity: 0, transparent: true, opacity: 0.75 }),
  lampDay: new THREE.MeshLambertMaterial({ color: '#fff9db' }),
  lampNight: new THREE.MeshBasicMaterial({ color: '#ffe8a3' }),
  kiosk: new THREE.MeshLambertMaterial({ color: '#f8f9fa' }),
  orange: new THREE.MeshLambertMaterial({ color: '#ff8200' }),
  green: new THREE.MeshLambertMaterial({ color: '#009a44' }),
  hull: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  stripe: new THREE.MeshLambertMaterial({ color: '#1c7ed6' }),
  float: new THREE.MeshLambertMaterial({ color: '#868e96' }),
  play: new THREE.MeshLambertMaterial({ color: '#fcc419' }),
  turf: new THREE.MeshLambertMaterial({ color: '#2f9e44', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  court: new THREE.MeshLambertMaterial({ color: '#1c7ed6', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  thatch: new THREE.MeshLambertMaterial({ color: '#c79a52' }),
  playRed: new THREE.MeshLambertMaterial({ color: '#e03131' }),
}
const DISC = new THREE.CylinderGeometry(1, 1, 1, 24)
const CONE = new THREE.ConeGeometry(1, 1, 10)

type At = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The big letters of the bay's name by the quay, each its own colour (the flag's, and the lagoon's blue). */
const LETTERS = 'BAIE DE COCODY'
const LETTER_COLORS = ['#ff8200', '#ffffff', '#009a44', '#1c7ed6']

/** One big letter in pixels, filling its block's face (lettering() is made for wide signs: one letter came out thin). */
function bigLetter(ch: string, bg: string, ink: string) {
  const c = document.createElement('canvas')
  c.width = 10
  c.height = 14
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, 10, 14)
  g.fillStyle = ink
  g.font = 'bold 14px monospace'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(ch, 5, 8)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function BaieCocody({ night, shore }: { night: boolean; /** The water's edge it follows, in its frame (places.ts ON_SHORE); without it, a straight quay. */ shore?: [number, number][] }) {
  const mats = useMemo(() => {
    const gate = lettering('BAIE DE COCODY', '#0b3d5c', '#ffffff', '#ff8200')
    const glace = lettering('GLACES · JUS', '#ffffff', '#e8590c', '#e8590c')
    const eau = lettering('EAU · SUCRERIES', '#ffffff', '#1c7ed6', '#1c7ed6')
    const letters = [...LETTERS].map((ch, i) => (ch === ' ' ? null : bigLetter(ch, LETTER_COLORS[i % LETTER_COLORS.length], i % 4 === 1 ? '#0b3d5c' : '#ffffff')))
    return {
      gate: signMaterial(gate.t),
      gateAspect: gate.aspect,
      glace: signMaterial(glace.t),
      glaceAspect: glace.aspect,
      eau: signMaterial(eau.t),
      eauAspect: eau.aspect,
      letters: letters.map((l) => (l ? signMaterial(l) : null)),
    }
  }, [])
  mats.gate.emissiveIntensity = night ? 1 : 0
  mats.glace.emissiveIntensity = night ? 0.7 : 0
  mats.eau.emissiveIntensity = night ? 0.7 : 0
  for (const l of mats.letters) if (l) l.emissiveIntensity = night ? 0.85 : 0
  M.pool.emissiveIntensity = night ? 0.5 : 0
  M.jet.emissiveIntensity = night ? 0.8 : 0

  // All along the water's edge: the quay, the promenade, the lawn behind it and what stands on them.
  const along = useMemo(() => buildAlong(shore ?? [[-HALF, QUAY], [HALF, QUAY]]), [shore])

  // The lawn's paths: one from the way in to the fountain, then to the quay, and two crossing it.
  const paths: At[] = useMemo(
    () => [
      { p: [0, 0.05, 9], s: [4, 0.02, 26] },
      { p: [0, 0.05, -6], s: [3, 0.02, 4] },
      { p: [-21, 0.05, 2], s: [38, 0.02, 2.4], ry: 0.18 },
      { p: [21, 0.05, 2], s: [38, 0.02, 2.4], ry: -0.18 },
    ],
    [],
  )

  // The outdoor gym: pull-up bars, parallel bars, a sit-up bench, on a rubber floor.
  const gym: At[] = useMemo(() => {
    const out: At[] = []
    for (const [x, z] of [[28, 6], [33, 6], [28, 12]] as const) {
      out.push({ p: [x - 0.9, 1.1, z], s: [0.1, 2.2, 0.1] }, { p: [x + 0.9, 1.1, z], s: [0.1, 2.2, 0.1] }, { p: [x, 2.2, z], s: [1.9, 0.08, 0.08] })
    }
    out.push({ p: [33, 0.5, 12], s: [0.08, 1, 1.8] }, { p: [33.8, 0.5, 12], s: [0.08, 1, 1.8] }, { p: [33.4, 1, 12], s: [0.9, 0.06, 1.8] })
    out.push({ p: [37, 0.35, 9], s: [0.6, 0.12, 1.8], ry: 0.3 })
    return out
  }, [])

  return (
    <group>
      {/* All along the water: the lawn, the paved promenade and its terracotta band, the lawn's own path */}
      <mesh geometry={along.lawn} material={M.lawn} receiveShadow />
      <mesh geometry={along.paving} material={M.paving} receiveShadow />
      <mesh geometry={along.band} material={M.band} />
      <mesh geometry={along.lawnPath} material={M.path} receiveShadow />
      {paths.map((a, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, a.ry ?? 0]} position={a.p} scale={[a.s[0], a.s[2], 1]} geometry={PLANE} material={M.path} receiveShadow />
      ))}

      {/* The quay and its railing */}
      <Blocks at={along.stone} material={M.quay} />
      <Blocks at={along.rail} material={M.rail} />

      {/* Coconut palms along the promenade */}
      {along.palms.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 1.3, (i % 2 ? -1 : 1) * 0.06]}>
          <mesh position={[0, 4, 0]} scale={[0.4, 8, 0.4]} geometry={BOX} material={M.trunk} castShadow />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[Math.cos(k * 1.05) * 1.5, 8, Math.sin(k * 1.05) * 1.5]} rotation={[0, -k * 1.05, -0.4]} scale={[3.2, 0.12, 0.8]} geometry={BOX} material={M.palm} castShadow />
          ))}
        </group>
      ))}
      {/* The lamps: a slim post, two lanterns along the quay */}
      {along.lamps.map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 2.2, 0]} scale={[0.14, 4.4, 0.14]} geometry={BOX} material={M.iron} />
          <mesh position={[0, 4.4, 0]} scale={[1.4, 0.08, 0.08]} geometry={BOX} material={M.iron} />
          {[-0.65, 0.65].map((s) => (
            <mesh key={s} position={[s, 4.15, 0]} scale={[0.32, 0.45, 0.32]} geometry={BOX} material={night ? M.lampNight : M.lampDay} />
          ))}
          {night && i % 4 === 0 && <pointLight position={[0, 4, 0]} intensity={6} distance={16} color="#ffd8a0" />}
        </group>
      ))}
      <Blocks at={along.benches} material={M.wood} />
      {/* Bushes and flowers along the lawn */}
      {along.bushes.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.5, 0]} scale={[1.3, 1, 1.3]} geometry={DISC} material={M.bush} castShadow />
          <mesh position={[0, 1.05, 0]} scale={[1.1, 0.12, 1.1]} geometry={DISC} material={i % 3 ? M.flower : M.play} />
        </group>
      ))}

      {/* The bay's name in big letters by the quay, read from the lawn, the water behind them */}
      {mats.letters.map((m, i) =>
        m ? (
          <mesh key={i} position={[(i - (LETTERS.length - 1) / 2) * 1.55, 1.15, QUAY + 2.8]} scale={[1.4, 2, 0.5]} geometry={BOX} material={[M.kiosk, M.kiosk, M.kiosk, M.kiosk, m, M.kiosk]} castShadow />
        ) : null,
      )}

      {/* The fountain in the middle of the lawn: its round basin, the water, the jets */}
      <group position={[0, 0, -1]}>
        <mesh position={[0, 0.3, 0]} scale={[5, 0.6, 5]} geometry={DISC} material={M.basin} receiveShadow />
        <mesh position={[0, 0.62, 0]} scale={[4.5, 0.04, 4.5]} geometry={DISC} material={M.pool} />
        <mesh position={[0, 1.6, 0]} scale={[0.5, 2.2, 0.5]} geometry={CONE} material={M.jet} />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <mesh key={k} position={[Math.cos(k * 1.05) * 2.6, 1.1, Math.sin(k * 1.05) * 2.6]} scale={[0.22, 1, 0.22]} geometry={CONE} material={M.jet} />
        ))}
      </group>
      {/* Beds of flowers and bushes round the lawn */}
      {[[-12, 12], [12, 12], [-30, 14], [30, -2], [-36, 6], [16, -4], [-16, -4]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.5, 0]} scale={[1.3, 1, 1.3]} geometry={DISC} material={M.bush} castShadow />
          <mesh position={[0, 1.05, 0]} scale={[1.1, 0.12, 1.1]} geometry={DISC} material={M.flower} />
        </group>
      ))}

      {/* The outdoor gym, on its rubber floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[32, 0.06, 9]} scale={[12, 10, 1]} geometry={PLANE} material={M.band} />
      <Blocks at={gym} material={M.iron} />

      {/* The playground: a slide and a swing */}
      <group position={[-32, 0, -1]}>
        <mesh position={[0, 1.2, 0]} scale={[1.6, 0.12, 1.6]} geometry={BOX} material={M.playRed} />
        {[[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].map(([x, z], k) => (
          <mesh key={k} position={[x, 0.6, z]} scale={[0.1, 1.2, 0.1]} geometry={BOX} material={M.iron} />
        ))}
        <mesh position={[0, 0.65, 2]} rotation={[0.55, 0, 0]} scale={[0.9, 0.06, 2.6]} geometry={BOX} material={M.play} />
        <mesh position={[4, 2.2, 0]} scale={[3.2, 0.1, 0.1]} geometry={BOX} material={M.playRed} />
        {[-1.5, 1.5].map((s) => (
          <mesh key={s} position={[4 + s, 1.1, 0]} scale={[0.1, 2.2, 0.1]} geometry={BOX} material={M.playRed} />
        ))}
        <mesh position={[4, 0.5, 0]} scale={[0.7, 0.06, 0.35]} geometry={BOX} material={M.play} />
      </group>

      {/* Two kiosks on the promenade */}
      {[
        [-14, mats.glace, mats.glaceAspect, M.orange],
        [14, mats.eau, mats.eauAspect, M.green],
      ].map(([x, sign, aspect, roof], i) => (
        <group key={i} position={[x as number, 0, WALK.z1 + 2.5]}>
          <mesh position={[0, 1.2, 0]} scale={[3, 2.4, 2.4]} geometry={BOX} material={M.kiosk} castShadow />
          <mesh position={[0, 2.6, 0]} scale={[3.8, 0.25, 3.2]} geometry={BOX} material={roof as THREE.Material} castShadow />
          <mesh position={[0, 2, -1.22]} rotation={[0, Math.PI, 0]} scale={[Math.min(2.8, 0.45 * (aspect as number)), 0.45, 1]} geometry={PLANE} material={sign as THREE.Material} />
        </group>
      ))}

      {/* The sports plain: a five-a-side pitch and a basketball court on the lawn, turned along the shore */}
      {along.pitch && (
        <group position={[along.pitch[0], 0, along.pitch[1]]} rotation={[0, along.pitch[2], 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[32, 19, 1]} geometry={PLANE} material={M.turf} receiveShadow />
          <Blocks at={PITCH_LINES} material={M.rail} />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 15, 0, 0]}>
              <Blocks at={GOAL} material={M.rail} />
            </group>
          ))}
        </group>
      )}
      {along.court && (
        <group position={[along.court[0], 0, along.court[1]]} rotation={[0, along.court[2], 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[28, 15, 1]} geometry={PLANE} material={M.court} receiveShadow />
          <Blocks at={COURT_LINES} material={M.rail} />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 13, 0, 0]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
              <mesh position={[-0.6, 1.6, 0]} scale={[0.15, 3.2, 0.15]} geometry={BOX} material={M.iron} />
              <mesh position={[0, 3.2, 0]} scale={[0.08, 1, 1.6]} geometry={BOX} material={M.rail} />
              <mesh position={[0.35, 2.95, 0]} scale={[0.5, 0.04, 0.5]} geometry={DISC} material={M.orange} />
            </group>
          ))}
        </group>
      )}
      {/* Paillotes on the lawn: a round thatch on four posts, a table and its benches under it */}
      {along.huts.map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          {[[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].map(([px, pz], k) => (
            <mesh key={k} position={[px, 1.35, pz]} scale={[0.18, 2.7, 0.18]} geometry={BOX} material={M.wood} castShadow />
          ))}
          <mesh position={[0, 3.35, 0]} scale={[3.4, 1.4, 3.4]} geometry={CONE} material={M.thatch} castShadow />
          <mesh position={[0, 0.75, 0]} scale={[1, 0.08, 1]} geometry={DISC} material={M.wood} />
          <mesh position={[0, 0.37, 0]} scale={[0.15, 0.74, 0.15]} geometry={BOX} material={M.wood} />
          {[-1.3, 1.3].map((bz) => (
            <mesh key={bz} position={[0, 0.42, bz]} scale={[1.8, 0.08, 0.4]} geometry={BOX} material={M.wood} />
          ))}
        </group>
      ))}

      {/* The pontoons out on the bay along the quay, their floats, the boats moored */}
      {along.pontoons.map(([x, z, ry], k) => (
        <group key={k} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <Blocks at={PONTOON.deck} material={M.wood} />
          <Blocks at={PONTOON.floats} material={M.float} />
          {PONTOON.boats.map((b, i) => (
            <group key={i} position={[b.at[0], 0, b.at[1]]} rotation={[0, b.r, 0]}>
              <mesh position={[0, 0.35, 0]} scale={[1.8, 0.7, b.len]} geometry={BOX} material={M.hull} castShadow />
              <mesh position={[0, 0.5, b.len / 2 + 0.3]} rotation={[0, Math.PI / 4, 0]} scale={[1.27, 0.7, 1.27]} geometry={BOX} material={M.hull} />
              <mesh position={[0, 0.45, 0]} scale={[1.84, 0.12, b.len - 0.2]} geometry={BOX} material={(i + k) % 2 ? M.stripe : M.orange} />
              <mesh position={[0, 1.05, -b.len * 0.1]} scale={[1.2, 0.7, b.len * 0.3]} geometry={BOX} material={M.kiosk} />
            </group>
          ))}
        </group>
      ))}

      {/* The way in from the land: two pillars and the name across, lit at night */}
      <group position={[0, 0, 21]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 4.5, 2.1, 0]} scale={[0.7, 4.2, 0.7]} geometry={BOX} material={M.quay} castShadow />
        ))}
        <mesh position={[0, 4.3, 0]} scale={[10, 1.2, 0.35]} geometry={BOX} material={M.iron} castShadow />
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 4.3, s * 0.19]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[Math.min(9.6, 1.05 * mats.gateAspect), 1.05, 1]} geometry={PLANE} material={mats.gate} />
        ))}
      </group>
    </group>
  )
}

/** The pitch's white lines (32 × 19 m): the sides, the halfway line, the centre spot. */
const PITCH_LINES: At[] = [
  { p: [0, 0.08, 9.4], s: [32, 0.02, 0.15] },
  { p: [0, 0.08, -9.4], s: [32, 0.02, 0.15] },
  { p: [15.9, 0.08, 0], s: [0.15, 0.02, 19] },
  { p: [-15.9, 0.08, 0], s: [0.15, 0.02, 19] },
  { p: [0, 0.08, 0], s: [0.15, 0.02, 19] },
  { p: [0, 0.08, 0], s: [0.6, 0.02, 0.6] },
]
/** A small goal (3 × 2 m), its mouth to +x. */
const GOAL: At[] = [
  { p: [0, 1, -1.5], s: [0.12, 2, 0.12] },
  { p: [0, 1, 1.5], s: [0.12, 2, 0.12] },
  { p: [0, 2, 0], s: [0.12, 0.12, 3.1] },
]
/** The court's lines (28 × 15 m). */
const COURT_LINES: At[] = [
  { p: [0, 0.08, 7.4], s: [28, 0.02, 0.12] },
  { p: [0, 0.08, -7.4], s: [28, 0.02, 0.12] },
  { p: [13.9, 0.08, 0], s: [0.12, 0.02, 15] },
  { p: [-13.9, 0.08, 0], s: [0.12, 0.02, 15] },
  { p: [0, 0.08, 0], s: [0.12, 0.02, 15] },
]

/** A pontoon in its own frame: from the quay (z 0) out on the water (−z), its floats, the boats along it. */
const PONTOON = {
  deck: [
    { p: [0, 0.32, -9], s: [2.4, 0.18, 18] },
    { p: [0, 0.32, -18.5], s: [12, 0.18, 2.4] },
  ] as At[],
  floats: Array.from({ length: 6 }, (_, k) => ({ p: [0, 0.12, -1 - k * 3], s: [2.6, 0.24, 1.2] })) as At[],
  boats: [
    { at: [-3.5, -7], r: 0, len: 6 },
    { at: [3.5, -11], r: 0, len: 7.5 },
    { at: [-4, -15], r: 0.1, len: 5 },
    { at: [5, -22.5], r: Math.PI / 2, len: 8 },
  ] as { at: [number, number]; r: number; len: number }[],
}

/**
 * Everything that follows the water's edge, from its line (the landmark's frame): for each stretch,
 * its direction and the side of the land (the same all along, the one the landmark's middle is on),
 * then bands at a distance in from the edge (the quay, the promenade, the lawn) and things set every
 * few metres along it (palms, lamps, benches, bushes, three pontoons).
 */
function buildAlong(line: [number, number][]) {
  // The stretches, their length along the line from its start, their direction.
  const segs = line.slice(1).map((b, i) => {
    const a = line[i]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.001
    return { a, b, len, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len }
  })
  // The land's side: toward the middle (0, 0) from the stretch nearest it.
  const nearest = segs.reduce((best, sg) => (Math.hypot((sg.a[0] + sg.b[0]) / 2, (sg.a[1] + sg.b[1]) / 2) < Math.hypot((best.a[0] + best.b[0]) / 2, (best.a[1] + best.b[1]) / 2) ? sg : best), segs[0])
  const mid = [(nearest.a[0] + nearest.b[0]) / 2, (nearest.a[1] + nearest.b[1]) / 2]
  const side = -nearest.tz * -mid[0] + nearest.tx * -mid[1] >= 0 ? 1 : -1
  // A band from `o0` to `o1` metres in from the edge, at height y, thick t: a block a stretch.
  const band = (o0: number, o1: number, y: number, t: number): At[] =>
    segs.map((sg) => {
      const [nx, nz] = [-sg.tz * side, sg.tx * side]
      const o = (o0 + o1) / 2
      return { p: [(sg.a[0] + sg.b[0]) / 2 + nx * o, y, (sg.a[1] + sg.b[1]) / 2 + nz * o], s: [sg.len + 0.35, t, o1 - o0], ry: -Math.atan2(sg.tz, sg.tx) }
    })
  // Points every `step` metres along the edge, `o` in from it: x, z, and the turn that faces the land.
  const total = segs.reduce((s, sg) => s + sg.len, 0)
  const at = (d: number, o: number): [number, number, number] => {
    let k = 0
    while (k < segs.length - 1 && d > segs[k].len) d -= segs[k++].len
    const sg = segs[k]
    const u = Math.min(1, d / sg.len)
    const [nx, nz] = [-sg.tz * side, sg.tx * side]
    return [sg.a[0] + (sg.b[0] - sg.a[0]) * u + nx * o, sg.a[1] + (sg.b[1] - sg.a[1]) * u + nz * o, Math.atan2(nx, nz)]
  }
  const every = (step: number, o: number, from = step / 2) => {
    const out: [number, number, number][] = []
    for (let d = from; d < total - 1; d += step) out.push(at(d, o))
    return out
  }
  // Where along the edge the landmark's middle is: its letters and kiosks stand there, no bench in front of them.
  let dMid = 0
  {
    let acc = 0
    let best = Infinity
    for (const sg of segs) {
      const dd = Math.hypot((sg.a[0] + sg.b[0]) / 2, (sg.a[1] + sg.b[1]) / 2)
      if (dd < best) (best = dd), (dMid = acc + sg.len / 2)
      acc += sg.len
    }
  }
  const rail: At[] = [...band(0.4, 0.6, 1.15, 0.08).map((b) => ({ ...b, s: [b.s[0], 0.08, 0.08] as [number, number, number] })), ...band(0.4, 0.6, 0.7, 0.05).map((b) => ({ ...b, s: [b.s[0], 0.05, 0.05] as [number, number, number] }))]
  for (const [x, z] of every(2, 0.5, 0)) rail.push({ p: [x, 0.7, z], s: [0.07, 0.9, 0.07] })
  const benches: At[] = []
  for (const [x, z, ry] of every(12, 4.3)) {
    const [bx, bz] = [x, z]
    // (Not in front of the big letters.)
    if (Math.abs(bx) < 17 && bz < 0) continue
    const [fx, fz] = [Math.sin(ry), Math.cos(ry)]
    benches.push({ p: [bx, 0.45, bz], s: [2, 0.08, 0.5], ry: ry }, { p: [bx + fx * 0.25, 0.75, bz + fz * 0.25], s: [2, 0.45, 0.06], ry })
  }
  // A flat ribbon from `o0` to `o1` in from the edge, at height y: one surface that bends with the
  // shore (blocks a stretch left wedges open on the outside of each bend).
  const ribbon = (o0: number, o1: number, y: number) => {
    // At each point of the line, the land's side: the two stretches' sides averaged, mitred.
    const normals = line.map((_, i) => {
      const a = segs[Math.max(0, i - 1)]
      const b = segs[Math.min(segs.length - 1, i)]
      let [nx, nz] = [-(a.tz + b.tz) * side, (a.tx + b.tx) * side]
      const l = Math.hypot(nx, nz) || 1
      ;[nx, nz] = [nx / l, nz / l]
      const cos = Math.max(0.5, nx * -a.tz * side + nz * a.tx * side)
      return [nx / cos, nz / cos]
    })
    const pos: number[] = []
    const idx: number[] = []
    line.forEach(([x, z], i) => {
      const [nx, nz] = normals[i]
      pos.push(x + nx * o0, y, z + nz * o0, x + nx * o1, y, z + nz * o1)
      if (i) {
        const k = i * 2
        // Wound to face up whichever side the land is on.
        if (side > 0) idx.push(k - 2, k - 1, k, k - 1, k + 1, k)
        else idx.push(k - 2, k, k - 1, k - 1, k, k + 1)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  return {
    stone: band(0, 1.2, 0.25, 0.5),
    rail,
    paving: ribbon(0.6, 13.5, 0.04),
    band: ribbon(7, 8.2, 0.05),
    lawn: ribbon(13.5, 46, 0.03),
    lawnPath: ribbon(27, 30, 0.045),
    palms: every(9, 12.2).map(([x, z]) => [x, z] as [number, number]),
    lamps: every(15, 2, 4),
    benches,
    bushes: every(17, 37).map(([x, z]) => [x, z] as [number, number]),
    // Along the lawn, away from the middle: the sports plain (a five-a-side pitch, a basketball
    // court) and paillotes to sit in the shade, where the shore reaches that far.
    pitch: dMid - 150 > 20 ? at(dMid - 150, 30) : null,
    court: dMid + 165 < total - 20 ? at(dMid + 165, 30) : null,
    huts: [dMid - 60, dMid - 95, dMid + 62, dMid + 100].filter((d) => d > 10 && d < total - 10).map((d) => at(d, 24)),
    // Three pontoons: by the middle, and a hundred metres either way where the shore reaches that far.
    pontoons: [dMid - 110, dMid + 28, dMid + 120].filter((d) => d > 10 && d < total - 10).map((d) => at(d, 0)),
  }
}
