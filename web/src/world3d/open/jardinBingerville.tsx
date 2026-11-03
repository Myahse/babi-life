import { useMemo } from 'react'
import * as THREE from 'three'
import { rng } from '../themes'
import { BOX } from './ruePrincesse'

// The botanical garden of Bingerville (bingerville-jardin), laid out in 1904 when Bingerville was the
// colony's capital, after photos of it: the gate on the street, two square brick pillars and their beam;
// the red-earth alley going in under the tunnel of giant bamboo bowing over it, a low fence of split
// bamboo along it; then the palmeraie, the oil palms in rows on the lawn either side; at the back the open
// lawn of the giant trees (the kapoks' buttress roots, the high crowns). Frame: +z the street, x along it.

const plain = (color: string) => new THREE.MeshLambertMaterial({ color })

function signMaterial() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 96
  const g = c.getContext('2d')!
  g.fillStyle = '#1f5f3a'
  g.fillRect(0, 0, 512, 96)
  g.strokeStyle = '#e9d8a6'
  g.lineWidth = 4
  g.strokeRect(6, 6, 500, 84)
  g.fillStyle = '#f1e9d2'
  g.font = 'bold 34px serif'
  g.textAlign = 'center'
  g.fillText('JARDIN BOTANIQUE', 256, 44)
  g.font = 'bold 26px serif'
  g.fillText('DE BINGERVILLE · 1904', 256, 78)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t })
}

/** A giant tree: its buttress roots, its straight pale trunk, its crown high up in lumps. */
function Giant({ x, z, h, seed, m }: { x: number; z: number; h: number; seed: string; m: Record<string, THREE.Material> }) {
  const r = useMemo(() => rng(seed), [seed])
  const lumps = useMemo(() => Array.from({ length: 6 }, () => [(r() - 0.5) * 11, h + (r() - 0.3) * 3, (r() - 0.5) * 11, 3.5 + r() * 3] as const), [r, h])
  return (
    <group position={[x, 0, z]}>
      {[0, 1.3, 2.6, 3.9, 5.2].map((a) => (
        <mesh key={a} geometry={BOX} material={m.bark} position={[Math.sin(a) * 1.0, 1.0, Math.cos(a) * 1.0]} rotation={[0, a, 0]} scale={[0.25, 2.0, 1.8]} />
      ))}
      <mesh geometry={BOX} material={m.bark} position={[0, h / 2, 0]} scale={[1.3, h, 1.3]} castShadow />
      {lumps.map(([lx, ly, lz, s], i) => (
        <mesh key={i} position={[lx, ly, lz]} material={i % 2 ? m.leaf : m.leaf2} castShadow>
          <icosahedronGeometry args={[s, 0]} />
        </mesh>
      ))}
    </group>
  )
}

/** A clump of giant bamboo by the alley: its culms rise and bow over the path (side -1 on the left, 1 on the right), so the two rows make the tunnel. */
function Bamboo({ x, z, side, seed, m }: { x: number; z: number; side: number; seed: string; m: Record<string, THREE.Material> }) {
  const r = useMemo(() => rng(seed), [seed])
  const culms = useMemo(
    () =>
      Array.from({ length: 14 }, () => {
        const len = 9 + r() * 6
        const lean = 0.35 + r() * 0.5
        return { dx: (r() - 0.5) * 2.4, dz: (r() - 0.5) * 2.4, len, lean, twist: (r() - 0.5) * 0.4, c: r() }
      }),
    [r],
  )
  return (
    <group position={[x, 0, z]}>
      {culms.map(({ dx, dz, len, lean, twist, c }, i) => {
        // Bowing towards the path: the culm leans its top over x = 0.
        const tilt = -side * lean
        const cx = dx + Math.sin(-tilt) * (len / 2)
        const cy = Math.cos(tilt) * (len / 2)
        return (
          <group key={i}>
            <mesh geometry={BOX} material={c < 0.35 ? m.bambooDry : i % 2 ? m.bamboo : m.bamboo2} position={[cx, cy, dz]} rotation={[twist, 0, tilt]} scale={[0.12, len, 0.12]} />
            {/* The leaves at the top, light and high */}
            {i % 3 === 0 && (
              <mesh position={[dx + Math.sin(-tilt) * len, Math.cos(tilt) * len, dz]} material={m.bambooLeaf}>
                <icosahedronGeometry args={[1.3, 0]} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

/** An oil palm of the palmeraie: the trunk scaly and grey-green, the crown of long fronds, the dry ones hanging under it. */
function OilPalm({ x, z, h, a, m }: { x: number; z: number; h: number; a: number; m: Record<string, THREE.Material> }) {
  return (
    <group position={[x, 0, z]} rotation={[0, a, 0]}>
      <mesh geometry={BOX} material={m.palmTrunk} position={[0, h / 2, 0]} scale={[0.6, h, 0.6]} castShadow />
      <mesh geometry={BOX} material={m.palmTrunk2} position={[0, h * 0.25, 0]} scale={[0.7, h * 0.3, 0.7]} />
      {[0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4].map((f) => (
        <mesh key={f} geometry={BOX} material={m.palm} position={[Math.sin(f) * 2.2, h + 0.3, Math.cos(f) * 2.2]} rotation={[0.45, f, 0]} scale={[0.7, 0.08, 4.2]} />
      ))}
      {[0.4, 2.2, 4.0].map((f) => (
        <mesh key={f} geometry={BOX} material={m.palmDry} position={[Math.sin(f) * 0.9, h - 1.4, Math.cos(f) * 0.9]} rotation={[1.2, f, 0]} scale={[0.5, 0.06, 3]} />
      ))}
    </group>
  )
}

// The alley: from the gate (z 7.5) through the bamboo tunnel (to z -16), the palmeraie (to z -40), the
// lawn of the giant trees at the back.
const TUNNEL = [4, -1, -6, -11, -16]
const PALM_ROWS = [-20, -25, -30, -35, -40]

export function JardinBingerville({ night }: { night: boolean }) {
  const m = useMemo(
    () => ({
      lawn: new THREE.MeshLambertMaterial({ color: '#5aa83f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      litter: new THREE.MeshLambertMaterial({ color: '#9a7a52', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      path: new THREE.MeshLambertMaterial({ color: '#d08a5c', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      brick: plain('#c4643a'),
      brickDark: plain('#8f4526'),
      wall: plain('#d9cfbd'),
      bark: plain('#a59a8a'),
      leaf: plain('#2f7a33'),
      leaf2: plain('#3d8f3e'),
      bamboo: plain('#9bb84a'),
      bamboo2: plain('#7fa03a'),
      bambooDry: plain('#b8a160'),
      bambooLeaf: plain('#8fbf4a'),
      fence: plain('#a88a55'),
      palmTrunk: plain('#6f7a62'),
      palmTrunk2: plain('#5b6650'),
      palm: plain('#3f9a3a'),
      palmDry: plain('#a8935a'),
      pole: plain('#d8dde2'),
      lamp: new THREE.MeshBasicMaterial({ color: '#fff4d6' }),
      bin: plain('#2f9e6a'),
      bench: plain('#6b4423'),
      sign: signMaterial(),
    }),
    [],
  )
  return (
    <group>
      {/* The ground: the bamboo's dry litter in front, the green lawn behind, the red-earth alley through it all */}
      <mesh geometry={BOX} material={m.litter} position={[0, 0.01, -5]} scale={[30, 0.02, 25]} receiveShadow />
      <mesh geometry={BOX} material={m.lawn} position={[0, 0.01, -34]} scale={[60, 0.02, 34]} receiveShadow />
      <mesh geometry={BOX} material={m.path} position={[0, 0.02, -20]} scale={[6, 0.02, 56]} receiveShadow />
      {/* The low wall along the street, the gate: two square brick pillars, the beam over them, the sign */}
      {[-16, 16].map((x) => (
        <mesh key={x} geometry={BOX} material={m.wall} position={[x, 0.8, 7.5]} scale={[26, 1.6, 0.5]} />
      ))}
      {[-3.4, 3.4].map((x) => (
        <group key={x}>
          <mesh geometry={BOX} material={m.brick} position={[x, 2.4, 7.5]} scale={[1.1, 4.8, 1.1]} castShadow />
          <mesh geometry={BOX} material={m.brickDark} position={[x, 0.3, 7.5]} scale={[1.3, 0.6, 1.3]} />
        </group>
      ))}
      <mesh geometry={BOX} material={m.brick} position={[0, 5.0, 7.5]} scale={[8.0, 0.6, 1.0]} castShadow />
      <mesh geometry={BOX} material={m.sign} position={[0, 6.0, 7.5]} scale={[6.4, 1.2, 0.2]} />
      {/* The bamboo tunnel: the clumps both sides bowing over the alley, the low fence of split bamboo along it */}
      {TUNNEL.map((z, i) => (
        <group key={z}>
          <Bamboo x={-5.2} z={z} side={-1} seed={`bam-l${i}`} m={m} />
          <Bamboo x={5.2} z={z + 2} side={1} seed={`bam-r${i}`} m={m} />
        </group>
      ))}
      {[-3.3, 3.3].map((x) => Array.from({ length: 30 }, (_, i) => <mesh key={`${x}${i}`} geometry={BOX} material={m.fence} position={[x, 0.3, 6 - i * 0.75]} scale={[0.12, 0.6 - (i % 2) * 0.12, 0.6]} />))}
      {/* A street lamp, a green bin, as in the alley */}
      <mesh geometry={BOX} material={m.pole} position={[-3.8, 3, -3]} scale={[0.15, 6, 0.15]} />
      <mesh geometry={BOX} material={m.pole} position={[-3.2, 6, -3]} scale={[1.2, 0.12, 0.15]} />
      <mesh geometry={BOX} material={m.lamp} position={[-2.7, 5.85, -3]} scale={[0.4, 0.15, 0.3]} />
      <mesh geometry={BOX} material={m.bin} position={[3.8, 0.4, -8]} scale={[0.6, 0.8, 0.6]} />
      {/* The palmeraie: the oil palms in rows both sides, on the lawn */}
      {PALM_ROWS.map((z, i) => [-4.5, -9, -13.5, -18, 4.5, 9, 13.5, 18].map((x, j) => <OilPalm key={`${i}${j}`} x={x + ((i + j) % 2) * 0.6} z={z + (j % 3) * 0.7} h={9 + ((i * 3 + j) % 4) * 1.2} a={(i * 7 + j) * 0.6} m={m} />))}
      {/* The open lawn at the back and its giant trees */}
      {[
        [-12, -48, 17],
        [11, -50, 19],
        [-24, -44, 15],
        [25, -46, 16],
        [7, -60, 18],
      ].map(([x, z, h], i) => (
        <Giant key={i} x={x} z={z} h={h} seed={`jardin-${i}`} m={m} />
      ))}
      <group position={[-4.5, 0, -46]}>
        <mesh geometry={BOX} material={m.bench} position={[0, 0.45, 0]} scale={[2, 0.08, 0.5]} />
        <mesh geometry={BOX} material={m.bench} position={[0, 0.8, -0.25]} scale={[2, 0.6, 0.06]} />
      </group>
      {night && <pointLight position={[0, 5, 7]} intensity={6} distance={14} color="#ffd8a0" />}
      {night && <pointLight position={[-2.7, 5.6, -3]} intensity={5} distance={12} color="#fff1c4" />}
    </group>
  )
}
