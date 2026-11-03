import { useMemo } from 'react'
import * as THREE from 'three'
import { randomLook } from '../../avatar/options'
import type { Pose } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { Vehicle } from '../vehicles'
import { rng } from '../themes'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'
import type { At } from './shoreline'

// Le Carrefour de la Vie, Vieux Cocody, by the Cité BAD: a big crossroads, and on its corner the
// life that gives it its name. As the game draws it: the paved corner, a row of kiosks (phone
// credit and money transfers, garba, alloco and fish, brochettes, cigarettes and sweets), a terrace
// with its plastic tables under parasols, the woro-woro waiting for fares, the barriers of the BRT's
// works along the road (the bus lane being built through the junction), a tall sign with the name,
// lamps, people about. The kiosks' names and the layout are the game's.
//
// The landmark's frame: +z toward the crossroads.

const M = {
  paving: new THREE.MeshLambertMaterial({ color: '#c8c0b2', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  kerb: new THREE.MeshLambertMaterial({ color: '#e9ecef' }),
  wall: new THREE.MeshLambertMaterial({ color: '#f1ece2' }),
  wood: new THREE.MeshLambertMaterial({ color: '#7a5233' }),
  plastic: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  red: new THREE.MeshLambertMaterial({ color: '#e03131' }),
  white: new THREE.MeshLambertMaterial({ color: '#f8f9fa' }),
  iron: new THREE.MeshLambertMaterial({ color: '#3a3d42' }),
  orange: new THREE.MeshLambertMaterial({ color: '#ff8200' }),
  green: new THREE.MeshLambertMaterial({ color: '#009a44' }),
  black: new THREE.MeshLambertMaterial({ color: '#1c1c1e' }),
  coal: new THREE.MeshLambertMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 0.9 }),
  lampOff: new THREE.MeshLambertMaterial({ color: '#d9dde2' }),
  lampOn: new THREE.MeshBasicMaterial({ color: '#fff2cc' }),
}
const CONE = new THREE.ConeGeometry(1, 1, 10)

/** The kiosks along the back of the corner: their name, their colour. */
const KIOSKS = [
  { name: 'CRÉDIT · TRANSFERT', wall: '#ff7900' },
  { name: 'GARBA CHAUD', wall: '#e8590c' },
  { name: 'ALLOCO · POISSON', wall: '#f59f00' },
  { name: 'BROCHETTES', wall: '#c92a2a' },
  { name: 'TABAC · BONBONS', wall: '#1971c2' },
]
const KX = (i: number) => -18 + i * 8.6

/** Who's about: where, turned how, doing what. */
const PEOPLE: { at: [number, number]; ry: number; pose: Pose }[] = [
  { at: [-18, -6.5], ry: Math.PI, pose: 'phone' },
  { at: [-9.6, -6.2], ry: Math.PI, pose: 'talk' },
  { at: [-1, -6.4], ry: Math.PI, pose: 'idle' },
  { at: [7.4, -6.6], ry: Math.PI, pose: 'talk' },
  { at: [9.8, 2.6], ry: 0.4, pose: 'sit' },
  { at: [13.2, 0.4], ry: -1.2, pose: 'sit' },
  { at: [-6, 9], ry: 0.3, pose: 'phone' },
  { at: [3, 10.5], ry: -2.4, pose: 'talk' },
  { at: [4.2, 9.6], ry: 0.8, pose: 'talk' },
]

export function CarrefourVie({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const name = lettering('CARREFOUR DE LA VIE', '#0b3d5c', '#ffffff', '#ff8200')
    const brt = lettering('TRAVAUX · BRT ABIDJAN', '#fcc419', '#1c1c1e', '#1c1c1e')
    return {
      name: signMaterial(name.t),
      nameAspect: name.aspect,
      brt: signMaterial(brt.t),
      brtAspect: brt.aspect,
      kiosks: KIOSKS.map((k) => {
        const l = lettering(k.name, '#ffffff', k.wall, k.wall)
        return { sign: signMaterial(l.t), aspect: l.aspect, wall: new THREE.MeshLambertMaterial({ color: k.wall }) }
      }),
      parasols: ['#e03131', '#fcc419'].map((c) => new THREE.MeshLambertMaterial({ color: c })),
    }
  }, [])
  mats.name.emissiveIntensity = night ? 1 : 0
  for (const k of mats.kiosks) k.sign.emissiveIntensity = night ? 0.8 : 0

  // The BRT's barriers along the road: red and white blocks in a line, a gap at the way in.
  const barriers = useMemo(() => {
    const red: At[] = []
    const white: At[] = []
    for (let x = -21; x <= 21; x += 2.1) {
      if (Math.abs(x) < 3) continue
      ;(Math.round(x / 2.1) % 2 ? red : white).push({ p: [x, 0.5, 15.5], s: [2, 1, 0.5] })
    }
    return { red, white }
  }, [])

  // The terrace: three tables, four chairs each.
  const terrace = useMemo(() => {
    const out: At[] = []
    for (const [x, z] of [[9, 1], [14, 3], [12, -2.5]]) {
      out.push({ p: [x, 0.72, z], s: [0.9, 0.06, 0.9] }, { p: [x, 0.36, z], s: [0.12, 0.72, 0.12] })
      for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]] as const) out.push({ p: [x + ox, 0.23, z + oz], s: [0.45, 0.46, 0.45] }, { p: [x + ox * 1.25, 0.6, z + oz * 1.25], s: oz ? [0.45, 0.55, 0.08] : [0.08, 0.55, 0.45] })
    }
    return out
  }, [])

  const cast = useMemo(() => {
    const r = rng('carrefour-vie')
    return PEOPLE.map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [])

  return (
    <group>
      {/* The corner's paving and its kerb on the road side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 2]} scale={[48, 32, 1]} geometry={PLANE} material={M.paving} receiveShadow />
      <mesh position={[0, 0.1, 17.8]} scale={[48, 0.2, 0.4]} geometry={BOX} material={M.kerb} />

      {/* The kiosks: a box, its counter, its awning in its colour, its name */}
      {KIOSKS.map((_, i) => {
        const k = mats.kiosks[i]
        return (
          <group key={i} position={[KX(i), 0, -10]}>
            <mesh position={[0, 1.3, 0]} scale={[6.4, 2.6, 3.4]} geometry={BOX} material={M.wall} castShadow receiveShadow />
            <mesh position={[0, 0.55, 1.75]} scale={[6.4, 1.1, 0.2]} geometry={BOX} material={k.wall} />
            <mesh position={[0, 1.15, 2.1]} scale={[6, 0.08, 0.7]} geometry={BOX} material={M.wood} />
            <mesh position={[0, 2.85, 2.2]} rotation={[0.35, 0, 0]} scale={[6.8, 0.1, 1.8]} geometry={BOX} material={k.wall} castShadow />
            <mesh position={[0, 3.25, 1.72]} scale={[Math.min(6, 0.6 * k.aspect), 0.6, 1]} geometry={PLANE} material={k.sign} />
            {/* The garba's, the alloco's and the brochettes' fires out front */}
            {(i === 1 || i === 2 || i === 3) && (
              <group position={[2.2, 0, 3.2]}>
                <mesh position={[0, 0.45, 0]} scale={[1.2, 0.45, 0.6]} geometry={BOX} material={M.black} castShadow />
                <mesh position={[0, 0.7, 0]} scale={[1.1, 0.04, 0.5]} geometry={BOX} material={M.coal} />
              </group>
            )}
          </group>
        )
      })}

      {/* The terrace under two parasols */}
      <Blocks at={terrace} material={M.plastic} />
      {[[10.5, 0], [13.5, 1.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.25, 0]} scale={[0.08, 2.5, 0.08]} geometry={BOX} material={M.white} />
          <mesh position={[0, 2.55, 0]} scale={[2.6, 0.7, 2.6]} geometry={CONE} material={mats.parasols[i]} castShadow />
        </group>
      ))}

      {/* The woro-woro waiting for fares along the kerb */}
      {[-14, -6.5, 1].map((x, i) => (
        <Vehicle key={i} p={[x, 0, 12.4]} r={Math.PI / 2} kind="woro" seed={i * 5 + 2} />
      ))}

      {/* The BRT's works: the barriers, the sign */}
      <Blocks at={barriers.red} material={M.red} />
      <Blocks at={barriers.white} material={M.white} />
      <group position={[16, 0, 14.8]}>
        {[-1.4, 1.4].map((x) => (
          <mesh key={x} position={[x, 1, 0]} scale={[0.1, 2, 0.1]} geometry={BOX} material={M.iron} />
        ))}
        <mesh position={[0, 1.8, 0.06]} scale={[Math.min(3.2, 0.5 * mats.brtAspect), 0.5, 1]} geometry={PLANE} material={mats.brt} />
      </group>

      {/* The tall sign with the crossroads' name, lit at night */}
      <group position={[-21.5, 0, 9]}>
        <mesh position={[0, 3, 0]} scale={[0.5, 6, 0.5]} geometry={BOX} material={M.iron} castShadow />
        <mesh position={[0, 6.6, 0]} scale={[1.6, 1.4, 0.35]} geometry={BOX} material={M.black} />
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 7.2, s * 0.19]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[Math.min(7, 0.9 * mats.nameAspect), 0.9, 1]} geometry={PLANE} material={mats.name} />
        ))}
      </group>

      {/* Two lamps */}
      {[-8, 18].map((x) => (
        <group key={x} position={[x, 0, 16.4]}>
          <mesh position={[0, 3.5, 0]} scale={[0.25, 7, 0.25]} geometry={BOX} material={M.iron} />
          <mesh position={[0, 7, -0.8]} scale={[0.5, 0.25, 1.8]} geometry={BOX} material={night ? M.lampOn : M.lampOff} />
          {night && <pointLight position={[0, 6.6, -1]} intensity={6} distance={18} color="#ffe8b0" />}
        </group>
      ))}

      {/* The people of the corner: at the kiosks, at the terrace, waiting for a woro-woro */}
      {PEOPLE.map((p, i) => (
        <group key={i} position={[p.at[0], 0, p.at[1]]} rotation={[0, p.ry, 0]}>
          <TalkHuman id={`cocody:carrefour-vie:${i}`} look={cast[i].look} gender={cast[i].gender} pose={p.pose} seed={cast[i].seed} />
        </group>
      ))}
    </group>
  )
}
