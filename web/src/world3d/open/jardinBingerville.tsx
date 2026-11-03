import { useMemo } from 'react'
import * as THREE from 'three'
import { rng } from '../themes'
import { BOX } from './ruePrincesse'

// The botanical garden of Bingerville (bingerville-jardin), laid out in 1904 when Bingerville was the
// colony's capital: the entrance on the street, its two white pillars and its green gate, the sign; then
// the alley going in between the giant trees (the kapoks' buttress roots, the high round crowns), the
// clumps of bamboo, the palm trees, the lawn, a bench. Frame: +z the street, x along it.

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
  const lumps = useMemo(() => Array.from({ length: 5 }, () => [(r() - 0.5) * 9, h + (r() - 0.3) * 3, (r() - 0.5) * 9, 3.5 + r() * 2.5] as const), [r, h])
  return (
    <group position={[x, 0, z]}>
      {[0, 1.3, 2.6, 3.9, 5.2].map((a) => (
        <mesh key={a} geometry={BOX} material={m.bark} position={[Math.sin(a) * 1.0, 1.0, Math.cos(a) * 1.0]} rotation={[0, a, 0]} scale={[0.25, 2.0, 1.8]} />
      ))}
      <mesh geometry={BOX} material={m.bark} position={[0, h / 2, 0]} scale={[1.2, h, 1.2]} castShadow />
      {lumps.map(([lx, ly, lz, s], i) => (
        <mesh key={i} position={[lx, ly, lz]} material={i % 2 ? m.leaf : m.leaf2} castShadow>
          <icosahedronGeometry args={[s, 0]} />
        </mesh>
      ))}
    </group>
  )
}

function Bamboo({ x, z, m }: { x: number; z: number; m: Record<string, THREE.Material> }) {
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: 9 }, (_, i) => {
        const a = i * 0.7
        const lean = ((i % 3) - 1) * 0.12
        return <mesh key={i} geometry={BOX} material={i % 2 ? m.bamboo : m.bamboo2} position={[Math.sin(a) * 0.6, 4, Math.cos(a) * 0.6]} rotation={[lean, 0, -lean]} scale={[0.14, 8, 0.14]} />
      })}
      <mesh position={[0, 8, 0]} material={m.leaf2}>
        <icosahedronGeometry args={[2.0, 0]} />
      </mesh>
    </group>
  )
}

function Palm({ x, z, m }: { x: number; z: number; m: Record<string, THREE.Material> }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={BOX} material={m.trunk} position={[0, 4, 0]} scale={[0.4, 8, 0.4]} />
      {[0, 1.25, 2.5, 3.75, 5].map((a) => (
        <mesh key={a} geometry={BOX} material={m.palm} position={[Math.sin(a) * 1.5, 8, Math.cos(a) * 1.5]} rotation={[0.35, a, 0]} scale={[0.5, 0.1, 3]} />
      ))}
    </group>
  )
}

export function JardinBingerville({ night }: { night: boolean }) {
  const m = useMemo(
    () => ({
      lawn: new THREE.MeshLambertMaterial({ color: '#4f8f3a', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      path: new THREE.MeshLambertMaterial({ color: '#b5946a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      pillar: plain('#efeae0'),
      gate: plain('#1f5f3a'),
      wall: plain('#d9cfbd'),
      bark: plain('#a59a8a'),
      leaf: plain('#2f7a33'),
      leaf2: plain('#3d8f3e'),
      bamboo: plain('#9bb84a'),
      bamboo2: plain('#7fa03a'),
      trunk: plain('#8a6a45'),
      palm: plain('#2f8a3e'),
      bench: plain('#6b4423'),
      sign: signMaterial(),
    }),
    [],
  )
  return (
    <group>
      {/* The lawn and the alley going in from the gate */}
      <mesh geometry={BOX} material={m.lawn} position={[0, 0.01, -12]} scale={[56, 0.02, 40]} receiveShadow />
      <mesh geometry={BOX} material={m.path} position={[0, 0.02, -12]} scale={[5, 0.02, 40]} receiveShadow />
      {/* The low wall along the street, the two pillars, the gate open, the sign over it */}
      {[-16, 16].map((x) => (
        <mesh key={x} geometry={BOX} material={m.wall} position={[x, 0.8, 7.5]} scale={[26, 1.6, 0.5]} />
      ))}
      {[-3.2, 3.2].map((x) => (
        <group key={x}>
          <mesh geometry={BOX} material={m.pillar} position={[x, 2.2, 7.5]} scale={[1.2, 4.4, 1.2]} castShadow />
          <mesh geometry={BOX} material={m.pillar} position={[x, 4.6, 7.5]} scale={[1.5, 0.4, 1.5]} />
          {/* A gate's leaf, swung open */}
          <mesh geometry={BOX} material={m.gate} position={[x * 0.62, 1.4, 6.3]} rotation={[0, x > 0 ? -1.1 : 1.1, 0]} scale={[2.6, 2.6, 0.08]} />
        </group>
      ))}
      <mesh geometry={BOX} material={m.sign} position={[0, 5.6, 7.5]} scale={[7.4, 1.4, 0.2]} />
      {/* The giant trees along the alley */}
      {[
        [-9, -4, 16],
        [9, -8, 18],
        [-10, -18, 17],
        [10, -22, 15],
        [-20, -10, 14],
        [20, -14, 16],
      ].map(([x, z, h], i) => (
        <Giant key={i} x={x} z={z} h={h} seed={`jardin-${i}`} m={m} />
      ))}
      <Bamboo x={-5} z={0} m={m} />
      <Bamboo x={6} z={-30} m={m} />
      <Palm x={5} z={2} m={m} />
      <Palm x={-5.5} z={-26} m={m} />
      <Palm x={24} z={-2} m={m} />
      {/* A bench in the shade */}
      <group position={[-3.4, 0, -12]}>
        <mesh geometry={BOX} material={m.bench} position={[0, 0.45, 0]} scale={[2, 0.08, 0.5]} />
        <mesh geometry={BOX} material={m.bench} position={[0, 0.8, -0.25]} scale={[2, 0.6, 0.06]} />
      </group>
      {night && <pointLight position={[0, 5, 7]} intensity={6} distance={14} color="#ffd8a0" />}
    </group>
  )
}
