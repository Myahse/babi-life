import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FullDetail, Human, type Pose } from '../avatar/Human'
import { AWA_HOME, AWA_NIGHT, KEKE_HOME, KEKE_NIGHT } from './paiyaLooks'

// « Samedi, c'est paiya ! » (marketing/scripts/samedi-paiya.md): the dressing, as the film shows it
// (?view=dressingroom). Awa in her kente; a flash and she's in her gold bazin dress. The camera goes
// over to Keke in his jersey and cap; a flash and he's in white bazin, the chain, the sunglasses.
// The times are the scene's own (from its start), on the clock the film moves by hand.

/** When Awa changes, when the camera turns to Keke, when he changes (seconds into the scene). */
const AWA_FLASH = 0.6
const PAN = [1.25, 1.75] as const
const KEKE_FLASH = 1.85

/** &t0=: seconds the scene holds still first (a film's take lets the looks load before it starts). */
const T0 = Number(new URLSearchParams(location.search).get('t0') ?? 0)
const now = (e: number) => Math.max(0, e - T0)

const AWA_X = -1.3
const KEKE_X = 1.3

/** A flash of light and a burst of little stars round someone changing. */
function Flash({ at, x }: { at: number; x: number }) {
  const g = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2
        return { dir: new THREE.Vector3(Math.cos(a), 0.4 + ((i * 7) % 10) / 10, Math.sin(a) * 0.35), c: i % 3 ? '#ffd43b' : '#ffffff' }
      }),
    [],
  )
  useFrame(({ clock }) => {
    const t = now(clock.elapsedTime) - at
    const on = t > 0 && t < 0.9
    if (g.current) {
      g.current.visible = on
      g.current.children.forEach((m, i) => {
        const s = stars[i]
        if (!s) return
        m.position.copy(s.dir).multiplyScalar(0.2 + t * 2.2)
        m.position.y += 1.1
        m.scale.setScalar(Math.max(0, 1 - t / 0.9) * 0.05)
      })
    }
    if (light.current) light.current.intensity = on ? Math.max(0, 1 - t / 0.5) * 60 : 0
  })
  return (
    <group position={[x, 0, 0.3]}>
      <pointLight ref={light} position={[0, 1.4, 0.8]} distance={6} color="#fff3c4" />
      <group ref={g}>
        {stars.map((s, i) => (
          <mesh key={i}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={s.c} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** One of the two: the home look until the flash, then the night's; a little pose for the mirror after. */
function Changer({ x, home, night, gender, at, seed }: { x: number; home: typeof AWA_HOME; night: typeof AWA_HOME; gender: 'femme' | 'homme'; at: number; seed: number }) {
  const [state, setState] = useState<{ dressed: boolean; pose: Pose }>({ dressed: false, pose: 'idle' })
  useFrame(({ clock }) => {
    const t = now(clock.elapsedTime)
    const dressed = t >= at + 0.12
    const pose: Pose = !dressed ? 'idle' : t < at + 1.1 ? 'hero' : 'dance'
    if (dressed !== state.dressed || pose !== state.pose) setState({ dressed, pose })
  })
  return (
    <group position={[x, 0, 0]} rotation={[0, x < 0 ? 0.25 : -0.25, 0]}>
      <Human look={state.dressed ? night : home} gender={gender} pose={state.pose} seed={seed} />
    </group>
  )
}

/** The camera: on Awa, then over to Keke, a slow push in all along. */
function Camera() {
  const camera = useThree((s) => s.camera)
  useFrame(({ clock }) => {
    const t = now(clock.elapsedTime)
    const k = Math.min(1, Math.max(0, (t - PAN[0]) / (PAN[1] - PAN[0])))
    const e = k * k * (3 - 2 * k)
    const x = AWA_X + (KEKE_X - AWA_X) * e
    const push = Math.min(1, t / 4) * 0.5
    camera.position.set(x * 0.9, 1.35, 3.6 - push)
    camera.lookAt(x, 1.05, 0)
  })
  return null
}

/** The room: a parquet floor, a wall with its big mirror and its bulbs, the rail of clothes, a rug. */
function Room() {
  const rail = useMemo(() => ['#ff7a00', '#12a37a', '#d9a521', '#f8f9fa', '#1d4ed8', '#c92a2a', '#7048e8', '#212529', '#e8457a', '#0ca678'], [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshLambertMaterial color="#8b5a35" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.2]} receiveShadow>
        <circleGeometry args={[2.6, 40]} />
        <meshLambertMaterial color="#b02a4a" />
      </mesh>
      <mesh position={[0, 2, -1.6]} receiveShadow>
        <planeGeometry args={[12, 4]} />
        <meshLambertMaterial color="#f1e3cf" />
      </mesh>
      {/* The mirror, its frame of bulbs */}
      <mesh position={[0, 1.55, -1.58]}>
        <planeGeometry args={[1.5, 2.1]} />
        <meshStandardMaterial color="#cfe4f2" metalness={0.6} roughness={0.15} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => {
        const side = i < 7
        const k = i % 7
        return (
          <mesh key={i} position={side ? [-0.82, 0.6 + k * 0.32, -1.55] : [0.82, 0.6 + k * 0.32, -1.55]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshBasicMaterial color="#fff2c2" />
          </mesh>
        )
      })}
      {/* The rail of clothes, on both sides */}
      {[-3.4, 3.4].map((rx) => (
        <group key={rx} position={[rx, 0, -1]}>
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[1.8, 0.04, 0.04]} />
            <meshLambertMaterial color="#c0c4c8" />
          </mesh>
          {[-0.9, 0.9].map((px) => (
            <mesh key={px} position={[px, 0.9, 0]}>
              <boxGeometry args={[0.04, 1.8, 0.04]} />
              <meshLambertMaterial color="#c0c4c8" />
            </mesh>
          ))}
          {rail.map((c, i) => (
            <mesh key={i} position={[-0.8 + i * 0.18, 1.3, 0]}>
              <boxGeometry args={[0.1, 0.9, 0.42]} />
              <meshLambertMaterial color={c} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export function DressingRoom() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [-1.2, 1.35, 3.6], fov: 42 }} style={{ background: '#2a1a24' }}>
        <hemisphereLight args={['#fff4e6', '#5a3a2a', 1.1]} />
        <directionalLight position={[2, 5, 4]} intensity={1.4} castShadow />
        <spotLight position={[0, 4, 2.5]} angle={0.7} penumbra={0.6} intensity={30} color="#ffe7c2" />
        <FullDetail.Provider value>
          <Room />
          {/* The night looks once more, hidden behind the wall: their textures are made before the flash, not on it. */}
          <group position={[0, 0, -3]}>
            <Human look={AWA_NIGHT} gender="femme" pose="idle" seed={3} />
            <Human look={KEKE_NIGHT} gender="homme" pose="idle" seed={5} />
          </group>
          <Changer x={AWA_X} home={AWA_HOME} night={AWA_NIGHT} gender="femme" at={AWA_FLASH} seed={3} />
          <Changer x={KEKE_X} home={KEKE_HOME} night={KEKE_NIGHT} gender="homme" at={KEKE_FLASH} seed={5} />
        </FullDetail.Provider>
        <Flash at={AWA_FLASH} x={AWA_X} />
        <Flash at={KEKE_FLASH} x={KEKE_X} />
        <Camera />
      </Canvas>
    </div>
  )
}
