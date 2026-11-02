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

export function BaieCocody({ night }: { night: boolean }) {
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

  // The quay: its stone edge, the railing's posts and two rails, all along the water.
  const quay = useMemo(() => {
    const stone: At[] = [{ p: [0, 0.25, QUAY + 0.3], s: [HALF * 2, 0.5, 1.2] }]
    const rail: At[] = [
      { p: [0, 1.15, QUAY + 0.5], s: [HALF * 2, 0.08, 0.08] },
      { p: [0, 0.7, QUAY + 0.5], s: [HALF * 2, 0.05, 0.05] },
    ]
    for (let x = -HALF + 0.5; x <= HALF; x += 2) rail.push({ p: [x, 0.7, QUAY + 0.5], s: [0.07, 0.9, 0.07] })
    return { stone, rail }
  }, [])

  // Along the promenade: palms in a row, lamps by the railing, benches turned to the water.
  const walk = useMemo(() => {
    const palms: [number, number][] = []
    const lamps: [number, number][] = []
    const benches: At[] = []
    for (let x = -HALF + 4; x <= HALF - 3; x += 8) {
      palms.push([x, WALK.z1 - 1.2])
      lamps.push([x + 4, QUAY + 2])
      if (Math.abs(x) > 6) {
        benches.push({ p: [x, 0.45, QUAY + 4], s: [2, 0.08, 0.5] }, { p: [x, 0.75, QUAY + 4.25], s: [2, 0.45, 0.06] })
        for (const s of [-0.85, 0.85]) benches.push({ p: [x + s, 0.22, QUAY + 4], s: [0.08, 0.44, 0.45] })
      }
    }
    return { palms, lamps, benches }
  }, [])

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

  // The pontoon out on the bay from the quay, and the boats along it.
  const pontoon = useMemo(() => {
    const deck: At[] = [{ p: [-26, 0.32, QUAY - 9], s: [2.4, 0.18, 18] }, { p: [-26, 0.32, QUAY - 18.5], s: [12, 0.18, 2.4] }]
    const floats: At[] = []
    for (let z = QUAY - 1; z > QUAY - 19; z -= 3) floats.push({ p: [-26, 0.12, z], s: [2.6, 0.24, 1.2] })
    const boats: { at: [number, number]; r: number; len: number }[] = [
      { at: [-29.5, QUAY - 7], r: 0, len: 6 },
      { at: [-22.5, QUAY - 11], r: 0, len: 7.5 },
      { at: [-30, QUAY - 15], r: 0.1, len: 5 },
      { at: [-21, QUAY - 22.5], r: Math.PI / 2, len: 8 },
    ]
    return { deck, floats, boats }
  }, [])

  return (
    <group>
      {/* The ground: the lawn, the paved promenade and its terracotta band, the paths */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 4]} scale={[HALF * 2, 34, 1]} geometry={PLANE} material={M.lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, (WALK.z0 + WALK.z1) / 2]} scale={[HALF * 2, WALK.z1 - WALK.z0, 1]} geometry={PLANE} material={M.paving} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, QUAY + 6.5]} scale={[HALF * 2, 1.2, 1]} geometry={PLANE} material={M.band} />
      {paths.map((a, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, a.ry ?? 0]} position={a.p} scale={[a.s[0], a.s[2], 1]} geometry={PLANE} material={M.path} receiveShadow />
      ))}

      {/* The quay and its railing */}
      <Blocks at={quay.stone} material={M.quay} />
      <Blocks at={quay.rail} material={M.rail} />

      {/* Coconut palms along the promenade */}
      {walk.palms.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 1.3, (i % 2 ? -1 : 1) * 0.06]}>
          <mesh position={[0, 4, 0]} scale={[0.4, 8, 0.4]} geometry={BOX} material={M.trunk} castShadow />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[Math.cos(k * 1.05) * 1.5, 8, Math.sin(k * 1.05) * 1.5]} rotation={[0, -k * 1.05, -0.4]} scale={[3.2, 0.12, 0.8]} geometry={BOX} material={M.palm} castShadow />
          ))}
        </group>
      ))}
      {/* The lamps: a slim post, two lanterns */}
      {walk.lamps.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.2, 0]} scale={[0.14, 4.4, 0.14]} geometry={BOX} material={M.iron} />
          <mesh position={[0, 4.4, 0]} scale={[1.4, 0.08, 0.08]} geometry={BOX} material={M.iron} />
          {[-0.65, 0.65].map((s) => (
            <mesh key={s} position={[s, 4.15, 0]} scale={[0.32, 0.45, 0.32]} geometry={BOX} material={night ? M.lampNight : M.lampDay} />
          ))}
          {night && i % 2 === 0 && <pointLight position={[0, 4, 0]} intensity={6} distance={14} color="#ffd8a0" />}
        </group>
      ))}
      <Blocks at={walk.benches} material={M.wood} />

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

      {/* The pontoon on the water, its floats, the boats along it */}
      <Blocks at={pontoon.deck} material={M.wood} />
      <Blocks at={pontoon.floats} material={M.float} />
      {pontoon.boats.map((b, i) => (
        <group key={i} position={[b.at[0], 0, b.at[1]]} rotation={[0, b.r, 0]}>
          <mesh position={[0, 0.35, 0]} scale={[1.8, 0.7, b.len]} geometry={BOX} material={M.hull} castShadow />
          <mesh position={[0, 0.5, b.len / 2 + 0.3]} rotation={[0, Math.PI / 4, 0]} scale={[1.27, 0.7, 1.27]} geometry={BOX} material={M.hull} />
          <mesh position={[0, 0.45, 0]} scale={[1.84, 0.12, b.len - 0.2]} geometry={BOX} material={M.stripe} />
          <mesh position={[0, 1.05, -b.len * 0.1]} scale={[1.2, 0.7, b.len * 0.3]} geometry={BOX} material={M.kiosk} />
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
