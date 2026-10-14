import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { fullLook } from './options'
import type { Pose } from './Human'

// A person seen from afar: the same colours (skin, hair, outfit), the same
// proportions, and the walk, but a handful of simple shapes (a few hundred
// triangles) instead of the full model's detail, which nobody sees at that
// distance. The street's crowd, cars and boats stay light enough for a phone.

const geos = {
  limb: new THREE.CylinderGeometry(0.055, 0.045, 1, 6).translate(0, -0.5, 0),
  torso: new THREE.CylinderGeometry(0.17, 0.15, 1, 8),
  skirt: new THREE.CylinderGeometry(0.17, 0.27, 1, 8),
  head: new THREE.SphereGeometry(0.115, 8, 6),
  hair: new THREE.SphereGeometry(0.125, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
  wrap: new THREE.CylinderGeometry(0.11, 0.13, 0.16, 8),
  foot: new THREE.BoxGeometry(0.09, 0.06, 0.2),
}
const mats = new Map<string, THREE.MeshLambertMaterial>()
const mat = (c: string) => {
  let m = mats.get(c)
  if (!m) mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}

const LONG = new Set(['pagne', 'boubou', 'robe'])

export function LowHuman({ look, gender, pose = 'idle', seed = 0, speed }: { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; speed?: number }) {
  const l = fullLook(look)
  const femme = gender === 'femme'
  const top = l.outfitColor
  const bottom = l.bottomColor || (l.outfit === 'suit' ? top : femme && LONG.has(l.outfit) ? top : '#2b2f45')
  const long = (femme && LONG.has(l.outfit)) || l.outfit === 'boubou'
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const phase = useRef(seed)
  useFrame((_, dt) => {
    const run = pose === 'run'
    const walk = pose === 'walk' || run || pose === 'dribble'
    const seated = pose === 'sit' || pose === 'eat' || pose === 'drink' || pose === 'write'
    const v = speed ?? (run ? 8 : 1.4)
    phase.current += Math.min(dt, 0.1) * Math.PI * 2 * (run ? 1.5 + v * 0.07 : Math.min(2.1, 0.85 + v * 0.3))
    const s = Math.sin(phase.current)
    for (const i of [0, 1]) {
      const out = i ? 1 : -1
      const leg = legs[i].current
      const arm = arms[i].current
      if (leg) leg.rotation.x = seated ? -1.5 : walk ? s * (run ? 0.95 : 0.5) * out : 0
      if (arm) arm.rotation.x = pose === 'wave' && i ? -2.6 + s * 0.3 : walk ? -s * (run ? 0.9 : 0.45) * out : 0
    }
  })
  const seatDrop = pose === 'sit' || pose === 'eat' || pose === 'drink' || pose === 'write' ? -0.41 : 0
  return (
    <group scale={l.height} position={[0, seatDrop, 0]}>
      {/* Legs and feet */}
      {[0, 1].map((i) => (
        <group key={i} ref={legs[i]} position={[(i ? 1 : -1) * 0.09, 0.86, 0]}>
          <mesh geometry={geos.limb} material={mat(long ? l.skin : bottom)} scale={[1.15, 0.8, 1.15]} />
          <mesh geometry={geos.foot} material={mat(l.shoeColor || '#2a2a2a')} position={[0, -0.83, 0.05]} />
        </group>
      ))}
      {/* Body: a top, and a long skirt or robe when there is one */}
      <mesh geometry={geos.torso} material={mat(top)} position={[0, 1.13, 0]} scale={[1, 0.38, 0.8]} castShadow />
      {long ? <mesh geometry={geos.skirt} material={mat(bottom)} position={[0, 0.6, 0]} scale={[1, 0.6, 0.8]} /> : <mesh geometry={geos.torso} material={mat(bottom)} position={[0, 0.9, 0]} scale={[1, 0.12, 0.8]} />}
      {/* Arms */}
      {[0, 1].map((i) => (
        <group key={i} ref={arms[i]} position={[(i ? 1 : -1) * 0.21, 1.3, 0]}>
          <mesh geometry={geos.limb} material={mat(l.skin)} scale={[0.85, 0.5, 0.85]} />
          <mesh geometry={geos.limb} material={mat(top)} scale={[1.05, 0.2, 1.05]} />
        </group>
      ))}
      {/* Neck, head and hair (or the headwrap) */}
      <mesh geometry={geos.limb} material={mat(l.skin)} position={[0, 1.4, 0]} scale={[0.9, 0.1, 0.9]} />
      <mesh geometry={geos.head} material={mat(l.skin)} position={[0, 1.5, 0]} castShadow />
      {l.hair === 'headwrap' ? (
        <mesh geometry={geos.wrap} material={mat(top)} position={[0, 1.6, -0.01]} />
      ) : l.hair !== 'bald' ? (
        <mesh geometry={geos.hair} material={mat(l.hairColor)} position={[0, 1.52, -0.01]} scale={l.hair === 'afro' ? [1.35, 1.25, 1.3] : [1, 1, 1]} />
      ) : null}
    </group>
  )
}
