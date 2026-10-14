import { useMemo } from 'react'
import * as THREE from 'three'

// Small low-poly props shared by buildings and the street scene. Everything
// uses flat-shaded Lambert materials: cheap on low-end Android phones and
// gives the "toy town" look.

export function Mat({ color, emissive, intensity = 0 }: { color: string; emissive?: string; intensity?: number }) {
  return <meshLambertMaterial color={color} flatShading emissive={emissive ?? '#000'} emissiveIntensity={intensity} />
}

export function Box({ p, s, c, r, glow }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; glow?: number }) {
  return (
    <mesh position={p} rotation={[0, r ?? 0, 0]} castShadow receiveShadow>
      <boxGeometry args={s} />
      <Mat color={c} emissive={glow ? c : undefined} intensity={glow} />
    </mesh>
  )
}

export function Palm({ p, h = 6, lean = 0.15 }: { p: [number, number, number]; h?: number; lean?: number }) {
  const leaves = [0, 1, 2, 3, 4, 5]
  return (
    <group position={p} rotation={[0, (p[0] * 7 + p[2] * 3) % 6, lean]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.3, h, 6]} />
        <Mat color="#8a6440" />
      </mesh>
      {leaves.map((i) => (
        <mesh key={i} position={[0, h, 0]} rotation={[0.9, (i / leaves.length) * Math.PI * 2, 0]} castShadow>
          <coneGeometry args={[0.55, 3.4, 4]} />
          <Mat color={i % 2 ? '#2f9e44' : '#37b24d'} />
        </mesh>
      ))}
      <mesh position={[0, h - 0.3, 0]}>
        <icosahedronGeometry args={[0.45, 0]} />
        <Mat color="#6b4f2a" />
      </mesh>
    </group>
  )
}

export function Tree({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 2, 6]} />
        <Mat color="#7a5230" />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow>
        <icosahedronGeometry args={[1.6, 0]} />
        <Mat color="#2b8a3e" />
      </mesh>
    </group>
  )
}

export function Lamp({ p, night }: { p: [number, number, number]; night: boolean }) {
  return (
    <group position={p}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 4, 5]} />
        <Mat color="#4a4f5c" />
      </mesh>
      <mesh position={[0, 4.05, 0]}>
        <boxGeometry args={[0.5, 0.18, 0.5]} />
        <Mat color={night ? '#ffe08a' : '#d9d9d9'} emissive={night ? '#ffd166' : undefined} intensity={night ? 1.6 : 0} />
      </mesh>
    </group>
  )
}

/** Plastic maquis table with four chairs. */
export function TableSet({ p, c = '#e03131' }: { p: [number, number, number]; c?: string }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.08, 10]} />
        <Mat color="#f8f9fa" />
      </mesh>
      <Box p={[0, 0.37, 0]} s={[0.12, 0.74, 0.12]} c="#f8f9fa" />
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        return (
          <group key={i} position={[Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05]} rotation={[0, -a + Math.PI / 2, 0]}>
            <Box p={[0, 0.45, 0]} s={[0.55, 0.08, 0.55]} c={c} />
            <Box p={[0, 0.8, -0.26]} s={[0.55, 0.7, 0.06]} c={c} />
            <Box p={[0, 0.22, 0]} s={[0.45, 0.44, 0.45]} c={c} />
          </group>
        )
      })}
    </group>
  )
}

/** Canvas texture for painted signs ("MAQUIS", "GARE"…). */
export function useSignTexture(text: string, bg: string, fg = '#ffffff') {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = bg
    g.fillRect(0, 0, 512, 128)
    g.fillStyle = fg
    g.font = '800 72px "Baloo 2", system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 70)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [text, bg, fg])
}

export function Sign({ p, w, text, bg, fg, r = 0 }: { p: [number, number, number]; w: number; text: string; bg: string; fg?: string; r?: number }) {
  const map = useSignTexture(text, bg, fg)
  return (
    <mesh position={p} rotation={[0, r, 0]}>
      <boxGeometry args={[w, w / 4, 0.15]} />
      <meshBasicMaterial attach="material-0" color={bg} />
      <meshBasicMaterial attach="material-1" color={bg} />
      <meshBasicMaterial attach="material-2" color={bg} />
      <meshBasicMaterial attach="material-3" color={bg} />
      <meshBasicMaterial attach="material-4" map={map} />
      <meshBasicMaterial attach="material-5" color={bg} />
    </mesh>
  )
}
