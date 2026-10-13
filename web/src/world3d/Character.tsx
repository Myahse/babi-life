import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { Mat } from './props'

// The player's Sim as a low-poly 3D figure. `walking` swings arms and legs,
// `busy` makes it bounce while an activity runs.

function useWax(color: string) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = color
    g.fillRect(0, 0, 64, 64)
    g.strokeStyle = '#fff6e3'
    g.lineWidth = 5
    for (const [x, y] of [[16, 16], [48, 48]]) {
      g.beginPath()
      g.arc(x, y, 10, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = '#2a1810'
      g.beginPath()
      g.arc(x, y, 4, 0, Math.PI * 2)
      g.fill()
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(2, 2)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [color])
}

function Hair({ style, color, accent }: { style: string; color: string; accent: string }) {
  switch (style) {
    case 'afro':
      return (
        <mesh position={[0, 0.2, -0.05]}>
          <icosahedronGeometry args={[0.62, 1]} />
          <Mat color={color} />
        </mesh>
      )
    case 'headwrap':
      return (
        <group>
          <mesh position={[0, 0.3, -0.02]} scale={[1, 0.9, 1]}>
            <sphereGeometry args={[0.52, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
            <Mat color={accent} />
          </mesh>
          <mesh position={[0.18, 0.78, -0.05]} rotation={[0, 0, -0.5]}>
            <icosahedronGeometry args={[0.24, 0]} />
            <Mat color={accent} />
          </mesh>
        </group>
      )
    case 'braids':
    case 'locks':
      return (
        <group>
          <mesh position={[0, 0.12, -0.02]}>
            <sphereGeometry args={[0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color={color} />
          </mesh>
          {[-0.38, -0.2, 0, 0.2, 0.38].map((x) => (
            <mesh key={x} position={[x, -0.3, -0.25]}>
              <cylinderGeometry args={[0.06, 0.06, style === 'braids' ? 1 : 0.7, 5]} />
              <Mat color={color} />
            </mesh>
          ))}
        </group>
      )
    case 'short':
      return (
        <mesh position={[0, 0.1, -0.02]}>
          <sphereGeometry args={[0.49, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
          <Mat color={color} />
        </mesh>
      )
    default:
      return null
  }
}

type Props = { look: Look; gender: Sim['gender']; walking?: boolean; busy?: boolean; moodColor?: string }

export function Character({ look, gender, walking, busy, moodColor = '#00b86b' }: Props) {
  const wax = useWax(look.outfitColor)
  const body = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const plumbob = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const swing = walking ? Math.sin(t * 10) * 0.6 : 0
    legL.current!.rotation.x = swing
    legR.current!.rotation.x = -swing
    armL.current!.rotation.x = -swing * 0.8
    armR.current!.rotation.x = busy ? -2.4 + Math.sin(t * 8) * 0.3 : swing * 0.8
    body.current!.position.y = walking ? Math.abs(Math.sin(t * 10)) * 0.08 : busy ? Math.abs(Math.sin(t * 6)) * 0.15 : Math.sin(t * 2) * 0.02
    plumbob.current!.rotation.y = t * 1.5
    plumbob.current!.position.y = 3.25 + Math.sin(t * 2) * 0.08
  })

  const femme = gender === 'femme'
  const dress = femme && (look.outfit === 'pagne' || look.outfit === 'boubou')
  const top = look.outfit === 'jersey' ? '#ff7a00' : look.outfit === 'suit' ? '#26324a' : look.outfitColor
  const legs = look.outfit === 'suit' ? '#26324a' : look.outfit === 'jersey' ? '#ffffff' : '#3563a8'
  const sleeves = look.outfit === 'boubou' || look.outfit === 'suit'
  const clothMat = look.outfit === 'pagne' ? <meshLambertMaterial map={wax} flatShading /> : <Mat color={top} />

  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} />
      </mesh>
      <group ref={body}>
        {/* Legs */}
        {[
          [legL, -0.17],
          [legR, 0.17],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.85, 0]}>
            <mesh position={[0, -0.42, 0]} castShadow>
              <boxGeometry args={[0.24, 0.8, 0.26]} />
              <Mat color={dress ? look.skin : legs} />
            </mesh>
            <mesh position={[0, -0.8, 0.06]}>
              <boxGeometry args={[0.26, 0.14, 0.38]} />
              <Mat color={look.outfit === 'suit' ? '#1c1c22' : '#f1f3f5'} />
            </mesh>
          </group>
        ))}
        {/* Torso / dress */}
        {dress ? (
          <mesh position={[0, 1.18, 0]} castShadow>
            <cylinderGeometry args={[0.36, 0.56, 1.1, 8]} />
            {clothMat}
          </mesh>
        ) : (
          <mesh position={[0, 1.28, 0]} castShadow>
            <boxGeometry args={[0.7, 0.8, 0.4]} />
            {clothMat}
          </mesh>
        )}
        {look.outfit === 'jersey' && (
          <mesh position={[0, 1.2, 0.205]}>
            <boxGeometry args={[0.71, 0.12, 0.02]} />
            <Mat color="#00b86b" />
          </mesh>
        )}
        {look.outfit === 'suit' && (
          <mesh position={[0, 1.42, 0.205]}>
            <boxGeometry args={[0.18, 0.45, 0.02]} />
            <Mat color="#ffffff" />
          </mesh>
        )}
        {/* Arms */}
        {[
          [armL, -0.45],
          [armR, 0.45],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.62, 0]}>
            <mesh position={[0, -0.33, 0]} castShadow>
              <boxGeometry args={[0.18, 0.62, 0.2]} />
              {sleeves ? clothMat : <Mat color={look.skin} />}
            </mesh>
            <mesh position={[0, -0.68, 0]}>
              <icosahedronGeometry args={[0.11, 0]} />
              <Mat color={look.skin} />
            </mesh>
          </group>
        ))}
        {/* Head */}
        <group position={[0, 2.15, 0]}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.48, 1]} />
            <Mat color={look.skin} />
          </mesh>
          {[-0.16, 0.16].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.43]}>
              <sphereGeometry args={[0.065, 6, 6]} />
              <meshBasicMaterial color="#1d1d1d" />
            </mesh>
          ))}
          <mesh position={[0, -0.17, 0.44]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.1, 0.025, 4, 8, Math.PI]} />
            <meshBasicMaterial color="#5c1f1f" />
          </mesh>
          {femme && [-0.48, 0.48].map((x) => (
            <mesh key={x} position={[x, -0.12, 0]}>
              <sphereGeometry args={[0.06, 6, 6]} />
              <Mat color="#ffc233" />
            </mesh>
          ))}
          <Hair style={look.hair} color={look.hairColor} accent={look.outfitColor === '#f4efe6' ? '#ff7a00' : look.outfitColor} />
        </group>
      </group>
      {/* The losange */}
      <mesh ref={plumbob} position={[0, 3.25, 0]}>
        <octahedronGeometry args={[0.24, 0]} />
        <meshLambertMaterial color={moodColor} emissive={moodColor} emissiveIntensity={0.55} flatShading />
      </mesh>
    </group>
  )
}
