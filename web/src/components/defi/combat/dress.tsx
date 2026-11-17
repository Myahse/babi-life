import * as THREE from 'three'
import { B, Bag, Bottle, Chair, Decal, Dressing, M, Mural, steelMat, stainsMat, Towel, TM } from '../../../streetball/decor'
import { STAGE } from './engine'

// « Mini-jeux réalistes », phase 2: the street fight's improvised ring (streetball/decor.tsx's
// props), drawn only while the update is open: the far rope strung between two oil drums with their
// poles (the crowd leans on it), each fighter's corner (a plastic chair, a towel, a bottle, the bag),
// a fire drum, crates, graffiti low on the shop fronts, the road stained. The near side stays open
// for the camera; nothing is in the fight's way.

/** An oil drum: the ribs, the rust, the paint long faded. */
const drumMat = () =>
  TM('drum', 32, 64, (g, r) => {
    g.fillStyle = '#2f5f8a'
    g.fillRect(0, 0, 32, 64)
    for (let i = 0; i < 160; i++) {
      g.fillStyle = r() < 0.6 ? 'rgba(120,58,26,0.6)' : 'rgba(255,255,255,0.08)'
      g.fillRect(Math.floor(r() * 32), Math.floor(r() * 64), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2))
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'
    for (const y of [20, 42]) g.fillRect(0, y, 32, 2)
  })
const fireMat = new THREE.MeshBasicMaterial({ color: '#ffb347' })
const ropeMat = new THREE.MeshLambertMaterial({ color: '#d9c9a3' })

function Drum({ p, pole }: { p: [number, number, number]; pole?: boolean }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.45, 0]} material={drumMat()} castShadow>
        <cylinderGeometry args={[0.29, 0.29, 0.9, 12]} />
      </mesh>
      {pole && <B p={[0, 1.2, 0]} s={[0.07, 1.4, 0.07]} m={steelMat('#4a4e55')} />}
    </group>
  )
}

export function FightSet() {
  const X = STAGE + 0.25
  return (
    <Dressing>
      {(tier) => (
        <>
          {/* The far rope: two strands between the drums, sagging a little */}
          <Drum p={[-X, 0, -2.3]} pole />
          <Drum p={[X, 0, -2.3]} pole />
          {[0.75, 1.25].map((y) => (
            <group key={y}>
              <B p={[-X / 2, y - 0.03, -2.3]} s={[X, 0.035, 0.035]} m={ropeMat} r={[0, 0, -0.012]} cast={false} />
              <B p={[X / 2, y - 0.03, -2.3]} s={[X, 0.035, 0.035]} m={ropeMat} r={[0, 0, 0.012]} cast={false} />
            </group>
          ))}
          {/* The corners: a chair, the towel over it, a bottle, the bag */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (X + 0.6), 0, 0.9]}>
              <Chair p={[0, 0, 0]} rot={-s * Math.PI / 2} c={s > 0 ? '#e03131' : '#1c7ed6'} />
              <Towel p={[0, 0.45, 0.05]} c="#f8f9fa" />
              <Bag p={[s * 0.3, 0, 0.6]} rot={0.4} c="#212529" band={s > 0 ? '#e03131' : '#1c7ed6'} />
              {tier !== 'simple' && <Bottle p={[-s * 0.35, 0, 0.35]} k={s > 0 ? 2 : 0} />}
            </group>
          ))}
          {/* The fire drum down the street, crates to sit on */}
          <Drum p={[-8.6, 0, -1.4]} />
          <mesh position={[-8.6, 0.95, -1.4]} material={fireMat}>
            <coneGeometry args={[0.22, 0.4, 6]} />
          </mesh>
          {tier !== 'simple' &&
            [
              [8.4, 0.3, -2.0, '#2b8a3e'],
              [8.9, 0.3, -1.4, '#f08c00'],
              [8.6, 0.9, -1.7, '#2b8a3e'],
            ].map(([x, y, z, c]) => <B key={`${x}${y}`} p={[x as number, y as number, z as number]} s={[0.55, 0.6, 0.4]} m={M(c as string)} />)}
          {/* Graffiti low on the fronts, the road stained round the ring */}
          <Mural p={[-11, 1.0, -6.09]} w={4.2} h={1.6} seed={2} />
          <Mural p={[6.8, 1.0, -6.09]} w={4.0} h={1.6} seed={8} />
          {tier !== 'simple' && <Mural p={[11.2, 1.0, -6.09]} w={4.0} h={1.6} seed={4} />}
          <Decal p={[1.5, 0.008, -0.5]} w={5} d={4} m={stainsMat()} />
          <Decal p={[-3, 0.008, 1.5]} w={4} d={3} m={stainsMat()} rot={1.2} />
        </>
      )}
    </Dressing>
  )
}
