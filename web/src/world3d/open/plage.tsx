import { useMemo } from 'react'
import * as THREE from 'three'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'
import { alongShore, type At } from './shoreline'

// La plage de Port-Bouët: Abidjan's beach on the open sea, between the boulevard and the Gulf of
// Guinea. As people know it: the wet sand where the waves break (the « barre », with its currents:
// a lifeguard's tower, the red flag up, « baignade dangereuse »), the fishermen's painted pirogues
// pulled up on the sand, the parasols and plastic chairs, the row of beach maquis under their
// paillotes (braised fish, attiéké, drinks), coconut palms, the horses one rides along the water,
// a football game on the sand, and the way in from the boulevard with the beach's name. The names
// of the maquis and the layout are the game's.
//
// The landmark's frame: +z toward the land (the boulevard), the sea behind (−z). places.ts sets it
// with its back to the nearest shore (ON_SHORE) and gives it the shore's line either way: the beach
// follows it for a few hundred metres.

const M = {
  wet: new THREE.MeshLambertMaterial({ color: '#b8925c', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  dry: new THREE.MeshLambertMaterial({ color: '#e6cf9c', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  path: new THREE.MeshLambertMaterial({ color: '#cdb487', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  wood: new THREE.MeshLambertMaterial({ color: '#8a6440' }),
  post: new THREE.MeshLambertMaterial({ color: '#5c4630' }),
  thatch: new THREE.MeshLambertMaterial({ color: '#c79a52' }),
  plastic: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  red: new THREE.MeshLambertMaterial({ color: '#e03131' }),
  white: new THREE.MeshLambertMaterial({ color: '#f8f9fa' }),
  iron: new THREE.MeshLambertMaterial({ color: '#495057' }),
  trunk: new THREE.MeshLambertMaterial({ color: '#8a6a48' }),
  palm: new THREE.MeshLambertMaterial({ color: '#3d8b3a' }),
  wall: new THREE.MeshLambertMaterial({ color: '#f1e3c8' }),
  tin: new THREE.MeshLambertMaterial({ color: '#a9b0b6' }),
  coal: new THREE.MeshLambertMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 0.9 }),
  black: new THREE.MeshLambertMaterial({ color: '#1c1c1e' }),
  horse: new THREE.MeshLambertMaterial({ color: '#6b4226' }),
  horseLight: new THREE.MeshLambertMaterial({ color: '#d9c3a0' }),
  mane: new THREE.MeshLambertMaterial({ color: '#2b1a10' }),
  coconut: new THREE.MeshLambertMaterial({ color: '#4c7a2a' }),
  bulbDay: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  bulbNight: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
}
const CONE = new THREE.ConeGeometry(1, 1, 10)
const DISC = new THREE.CylinderGeometry(1, 1, 1, 14)

/** The pirogues' colours, as the fishermen paint them (the flag's, blue, yellow, red, in bands). */
const PIROGUE = [
  ['#1c7ed6', '#fcc419'],
  ['#e03131', '#ffffff'],
  ['#ff8200', '#009a44'],
  ['#fcc419', '#1c7ed6'],
  ['#009a44', '#e03131'],
  ['#ffffff', '#1c7ed6'],
]
const PARASOLS = ['#e03131', '#1c7ed6', '#fcc419', '#ff8200', '#009a44', '#f783ac', '#ffffff']
/** The beach maquis' names (the game's). */
const MAQUIS = ['MAQUIS LA BARRE', 'CHEZ TANTIE ROSE', 'LE BON POISSON', 'MAQUIS VRIDI-PLAGE', 'LA PAILLOTE', 'CHEZ YAO']

export function PlagePortBouet({ night, shore }: { night: boolean; /** The sea's edge it follows, in its frame (places.ts ON_SHORE). */ shore?: [number, number][] }) {
  const mats = useMemo(() => {
    const gate = lettering('PLAGE DE PORT-BOUËT', '#0b4f6c', '#ffe066', '#ffe066')
    const danger = lettering('BAIGNADE DANGEREUSE', '#e03131', '#ffffff', '#ffffff')
    const maquis = MAQUIS.map((m, i) => lettering(m, i % 2 ? '#0b4f6c' : '#f4efe6', i % 2 ? '#ffe066' : '#b42318', i % 2 ? '#ffe066' : '#b42318'))
    return {
      gate: signMaterial(gate.t),
      gateAspect: gate.aspect,
      danger: signMaterial(danger.t),
      dangerAspect: danger.aspect,
      maquis: maquis.map((l) => ({ m: signMaterial(l.t), aspect: l.aspect })),
      pirogues: PIROGUE.map(([a, b]) => [new THREE.MeshLambertMaterial({ color: a }), new THREE.MeshLambertMaterial({ color: b })]),
      parasols: PARASOLS.map((c) => new THREE.MeshLambertMaterial({ color: c })),
    }
  }, [])
  mats.gate.emissiveIntensity = night ? 1 : 0
  for (const q of mats.maquis) q.m.emissiveIntensity = night ? 0.8 : 0

  const beach = useMemo(() => {
    const { at, every, ribbon, dMid, total } = alongShore(shore ?? [[-60, -35], [60, -35]])
    const within = (d: number) => d > 8 && d < total - 8
    // The fishermen's corner, on one side of the middle: pirogues side by side, their bows to the sea.
    const pirogues: [number, number, number][] = []
    for (let d = dMid - 190; d < dMid - 70; d += 9) if (within(d)) pirogues.push(at(d, 12 + ((d * 7) % 5)))
    // Parasols and their chairs, in two staggered rows from the middle on.
    const parasols: [number, number, number][] = []
    for (let d = dMid - 50; d < dMid + 170; d += 11) {
      if (within(d)) parasols.push(at(d, 20))
      if (within(d + 5.5)) parasols.push(at(d + 5.5, 28))
    }
    // The beach maquis: a paillote and its tables every 26 m, along the land's side.
    const maquis: [number, number, number][] = []
    for (let d = dMid - 160; d < dMid + 190; d += 26) if (within(d) && Math.abs(d - dMid) > 12) maquis.push(at(d, 44))
    return {
      wet: ribbon(-1, 7, 0.035),
      dry: ribbon(7, 62, 0.025),
      path: ribbon(52, 56, 0.04),
      pirogues,
      parasols,
      maquis,
      palms: every(15, 58).filter((_, i) => i % 3 !== 1),
      tower: at(dMid + 30, 9),
      flag: at(dMid + 34, 5),
      horses: [at(dMid + 70, 4), at(dMid + 78, 3.5), at(dMid - 30, 4.5)],
      football: within(dMid + 205) ? at(dMid + 205, 26) : null,
      coconuts: [at(dMid + 10, 50), at(dMid - 60, 50)],
    }
  }, [shore])

  // The tables and chairs under each paillote: white plastic, four chairs to a table.
  const furniture = useMemo(() => {
    const out: At[] = []
    for (const [x, z] of [[-3.5, 3], [3.5, 3], [0, -2]]) {
      out.push({ p: [x, 0.72, z], s: [0.9, 0.06, 0.9] }, { p: [x, 0.36, z], s: [0.12, 0.72, 0.12] })
      for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]] as const) {
        out.push({ p: [x + ox, 0.23, z + oz], s: [0.45, 0.46, 0.45] }, { p: [x + ox * 1.25, 0.6, z + oz * 1.25], s: oz ? [0.45, 0.55, 0.08] : [0.08, 0.55, 0.45] })
      }
    }
    return out
  }, [])

  return (
    <group>
      {/* The sand: wet where the waves reach, dry up to the boulevard, a trodden path along the maquis */}
      <mesh geometry={beach.wet} material={M.wet} receiveShadow />
      <mesh geometry={beach.dry} material={M.dry} receiveShadow />
      <mesh geometry={beach.path} material={M.path} />

      {/* The fishermen's pirogues pulled up on the sand, bows to the sea, painted in bands */}
      {beach.pirogues.map(([x, z, ry], i) => {
        const [a, b] = mats.pirogues[i % mats.pirogues.length]
        const len = 9 + (i % 3) * 1.5
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, ry + (((i * 13) % 7) - 3) * 0.04, 0]}>
            <mesh position={[0, 0.35, 0]} scale={[1.3, 0.7, len]} geometry={BOX} material={a} castShadow />
            <mesh position={[0, 0.62, 0]} scale={[1.34, 0.14, len - 0.4]} geometry={BOX} material={b} />
            <mesh position={[0, 0.55, -len / 2 - 0.5]} rotation={[0.35, 0, 0]} scale={[0.7, 0.6, 1.4]} geometry={BOX} material={a} />
            <mesh position={[0, 0.55, len / 2 + 0.4]} rotation={[-0.3, 0, 0]} scale={[0.8, 0.6, 1]} geometry={BOX} material={a} />
            <mesh position={[0, 0.45, 0]} scale={[1.1, 0.06, 0.25]} geometry={BOX} material={M.wood} />
            {/* The net heaped in it, now and then */}
            {i % 3 === 0 && <mesh position={[0, 0.75, 1.2]} scale={[0.9, 0.3, 1.6]} geometry={BOX} material={M.mane} />}
          </group>
        )
      })}

      {/* Parasols and their chairs */}
      {beach.parasols.map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 1.2, 0]} scale={[0.07, 2.4, 0.07]} geometry={BOX} material={M.white} />
          <mesh position={[0, 2.45, 0]} scale={[1.6, 0.55, 1.6]} geometry={CONE} material={mats.parasols[i % mats.parasols.length]} castShadow />
          {[-0.75, 0.75].map((s) => (
            <group key={s} position={[s, 0, -0.6]} rotation={[0, Math.PI, 0]}>
              <mesh position={[0, 0.25, 0]} scale={[0.6, 0.06, 1.5]} geometry={BOX} material={i % 2 ? M.plastic : mats.parasols[(i + 2) % mats.parasols.length]} />
              <mesh position={[0, 0.55, 0.65]} rotation={[-0.6, 0, 0]} scale={[0.6, 0.6, 0.06]} geometry={BOX} material={M.plastic} />
            </group>
          ))}
        </group>
      ))}

      {/* The beach maquis: a big paillote over the tables, the kitchen shack and its grill, the name */}
      {beach.maquis.map(([x, z, ry], i) => {
        const sign = mats.maquis[i % mats.maquis.length]
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
            {[[-4.5, -3.5], [4.5, -3.5], [-4.5, 4], [4.5, 4]].map(([px, pz], k) => (
              <mesh key={k} position={[px, 1.5, pz]} scale={[0.2, 3, 0.2]} geometry={BOX} material={M.post} castShadow />
            ))}
            <mesh position={[0, 3.6, 0.2]} scale={[6.8, 1.6, 6.2]} geometry={CONE} material={M.thatch} castShadow />
            <Blocks at={furniture} material={M.plastic} />
            {/* The kitchen behind, on the boulevard's side */}
            <group position={[0, 0, 8.5]}>
              <mesh position={[0, 1.4, 0]} scale={[5, 2.8, 3]} geometry={BOX} material={M.wall} castShadow />
              <mesh position={[0, 2.95, 0]} scale={[5.6, 0.12, 3.6]} geometry={BOX} material={M.tin} />
              <mesh position={[0, 2.2, -1.53]} rotation={[0, Math.PI, 0]} scale={[Math.min(4.8, 0.6 * sign.aspect), 0.6, 1]} geometry={PLANE} material={sign.m} />
              <mesh position={[0, 3.5, 1.6]} scale={[Math.min(5, 0.65 * sign.aspect), 0.65, 1]} geometry={PLANE} material={sign.m} />
              {/* The fish grill in front of it */}
              <mesh position={[2.8, 0.5, -2.2]} scale={[1.3, 0.5, 0.6]} geometry={BOX} material={M.black} castShadow />
              <mesh position={[2.8, 0.77, -2.2]} scale={[1.2, 0.04, 0.5]} geometry={BOX} material={M.coal} />
            </group>
            {/* A string of bulbs across the paillote's front */}
            {[-3, -1.5, 0, 1.5, 3].map((bx) => (
              <mesh key={bx} position={[bx, 2.75, -3.6]} scale={[0.2, 0.2, 0.2]} geometry={BOX} material={night ? M.bulbNight : M.bulbDay} />
            ))}
            {night && i % 2 === 0 && <pointLight position={[0, 2.6, 0]} intensity={5} distance={12} color="#ffcf87" />}
          </group>
        )
      })}

      {/* Coconut palms, near the boulevard */}
      {beach.palms.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 1.7, (i % 2 ? -1 : 1) * 0.12]}>
          <mesh position={[0, 4.5, 0]} scale={[0.4, 9, 0.4]} geometry={BOX} material={M.trunk} castShadow />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[Math.cos(k * 1.05) * 1.6, 9, Math.sin(k * 1.05) * 1.6]} rotation={[0, -k * 1.05, -0.4]} scale={[3.4, 0.12, 0.8]} geometry={BOX} material={M.palm} castShadow />
          ))}
        </group>
      ))}

      {/* The lifeguard's tower, the red flag, the warning */}
      <group position={[beach.tower[0], 0, beach.tower[1]]} rotation={[0, beach.tower[2], 0]}>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([px, pz], k) => (
          <mesh key={k} position={[px, 1.6, pz]} scale={[0.15, 3.2, 0.15]} geometry={BOX} material={M.white} />
        ))}
        <mesh position={[0, 3.3, 0]} scale={[2.6, 0.15, 2.6]} geometry={BOX} material={M.wood} />
        <mesh position={[0, 4.3, 0.9]} scale={[2.6, 1.8, 0.1]} geometry={BOX} material={M.red} />
        <mesh position={[0, 5.3, 0]} scale={[2.9, 0.15, 2.9]} geometry={BOX} material={M.red} />
        <mesh position={[0, 1.7, 1.6]} rotation={[0.35, 0, 0]} scale={[0.7, 0.06, 3.4]} geometry={BOX} material={M.wood} />
      </group>
      <group position={[beach.flag[0], 0, beach.flag[1]]} rotation={[0, beach.flag[2], 0]}>
        <mesh position={[0, 2.5, 0]} scale={[0.08, 5, 0.08]} geometry={BOX} material={M.white} />
        <mesh position={[0.6, 4.6, 0]} scale={[1.2, 0.75, 0.04]} geometry={BOX} material={M.red} />
        <mesh position={[0, 1.4, 0.1]} scale={[0.1, 1.5, 0.1]} geometry={BOX} material={M.iron} />
        <mesh position={[0, 2.1, 0.17]} scale={[Math.min(3.4, 0.4 * mats.dangerAspect), 0.4, 1]} geometry={PLANE} material={mats.danger} />
        <mesh position={[0, 2.1, 0.03]} rotation={[0, Math.PI, 0]} scale={[Math.min(3.4, 0.4 * mats.dangerAspect), 0.4, 1]} geometry={PLANE} material={mats.danger} />
      </group>

      {/* The horses one rides along the water */}
      {beach.horses.map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry + Math.PI / 2 + i * 0.4, 0]}>
          <mesh position={[0, 1.2, 0]} scale={[0.6, 0.65, 1.7]} geometry={BOX} material={i === 1 ? M.horseLight : M.horse} castShadow />
          <mesh position={[0, 1.75, 0.95]} rotation={[-0.6, 0, 0]} scale={[0.35, 0.9, 0.4]} geometry={BOX} material={i === 1 ? M.horseLight : M.horse} />
          <mesh position={[0, 2.1, 1.35]} scale={[0.32, 0.32, 0.7]} geometry={BOX} material={i === 1 ? M.horseLight : M.horse} />
          <mesh position={[0, 1.95, 0.85]} rotation={[-0.6, 0, 0]} scale={[0.1, 0.8, 0.45]} geometry={BOX} material={M.mane} />
          {[[-0.22, 0.6], [0.22, 0.6], [-0.22, -0.6], [0.22, -0.6]].map(([lx, lz], k) => (
            <mesh key={k} position={[lx, 0.45, lz]} scale={[0.14, 0.9, 0.14]} geometry={BOX} material={i === 1 ? M.horseLight : M.horse} />
          ))}
          <mesh position={[0, 1.58, -0.05]} scale={[0.66, 0.1, 0.7]} geometry={BOX} material={M.red} />
        </group>
      ))}

      {/* Football on the sand: two goals of wood */}
      {beach.football && (
        <group position={[beach.football[0], 0, beach.football[1]]} rotation={[0, beach.football[2] + Math.PI / 2, 0]}>
          {[-14, 14].map((gx) => (
            <group key={gx} position={[0, 0, gx]}>
              {[-1.6, 1.6].map((px) => (
                <mesh key={px} position={[px, 1, 0]} scale={[0.12, 2, 0.12]} geometry={BOX} material={M.wood} />
              ))}
              <mesh position={[0, 2, 0]} scale={[3.3, 0.12, 0.12]} geometry={BOX} material={M.wood} />
            </group>
          ))}
        </group>
      )}

      {/* The coconut sellers' carts */}
      {beach.coconuts.map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 0.8, 0]} scale={[1.8, 0.15, 1]} geometry={BOX} material={M.wood} />
          {[-0.7, 0.7].map((wx) => (
            <mesh key={wx} position={[wx, 0.35, 0.55]} rotation={[0, 0, Math.PI / 2]} scale={[0.35, 0.08, 0.35]} geometry={DISC} material={M.black} />
          ))}
          {[[-0.5, 0], [0, 0.15], [0.5, 0], [-0.25, -0.2], [0.25, -0.2], [0, 0.2]].map(([cx, cz], k) => (
            <mesh key={k} position={[cx, 1.05 + (k > 3 ? 0.25 : 0), cz]} scale={[0.32, 0.32, 0.32]} geometry={BOX} material={M.coconut} />
          ))}
        </group>
      ))}

      {/* The way in from the boulevard: two posts and the beach's name, lit at night */}
      <group position={[0, 0, 26]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 5, 2, 0]} scale={[0.45, 4, 0.45]} geometry={BOX} material={M.post} castShadow />
        ))}
        <mesh position={[0, 4.1, 0]} scale={[10.6, 1.2, 0.3]} geometry={BOX} material={M.black} castShadow />
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 4.1, s * 0.16]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[Math.min(10.2, 1 * mats.gateAspect), 1, 1]} geometry={PLANE} material={mats.gate} />
        ))}
      </group>
    </group>
  )
}
