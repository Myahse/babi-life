import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { defaultColors, fullLook } from './options'
import type { Pose } from './Human'

// A blocky Sim seen from afar: the same boxes as BlockHuman (a cube head, a
// box torso, arms and legs), the same colours (skin, hair, outfit, shoes), the
// same proportions and the walk, but a dozen plain boxes in flat colours
// instead of the painted sheet, which nobody sees at that distance. The
// street's crowd, cars and boats stay light enough for a phone.

const HEAD = 0.32
const NECK_Y = 1.36
const TORSO_BOTTOM = 0.82
const HIP_Y = 0.84
const LEG = 0.84
const SHOULDER_Y = 1.3
const ARM = 0.52
const BODY: Record<string, { w: number; limb: number; depth: number }> = {
  mince: { w: 0.88, limb: 0.88, depth: 0.9 },
  moyen: { w: 1, limb: 1, depth: 1 },
  fort: { w: 1.15, limb: 1.16, depth: 1.1 },
  rond: { w: 1.2, limb: 1.12, depth: 1.28 },
}

/** A unit box hanging from its top face (limbs), and a centred one. */
const hanging = new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0)
const centred = new THREE.BoxGeometry(1, 1, 1)
const mats = new Map<string, THREE.MeshLambertMaterial>()
const mat = (c: string) => {
  let m = mats.get(c)
  if (!m) mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}

const LONG = new Set(['pagne', 'boubou', 'robe', 'kaba', 'jupe', 'bazin', 'uniforme', 'abaya', 'blouse'])
/** Long robes, men's and women's alike. */
const ROBES = new Set(['boubou', 'bazin', 'soutane', 'imam'])
/** Outfits whose sleeves cover the whole arm. */
const LONG_SLEEVES = new Set(['suit', 'survet', 'boubou', 'bazin', 'chemise', 'blouson', 'sweat', 'soutane', 'pasteur', 'imam', 'abaya', 'blouse', 'bleu'])

export function LowHuman({ look, gender, pose = 'idle', seed = 0, speed }: { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; speed?: number }) {
  const l = fullLook(look)
  const femme = gender === 'femme'
  const dc = defaultColors(l, femme)
  const top = l.outfitColor
  const bottom = l.bottomColor || dc.bottom
  const shoe = l.shoeColor || dc.shoe
  const long = (femme && LONG.has(l.outfit)) || ROBES.has(l.outfit) || (!femme && l.outfit === 'abaya')
  const { w, limb, depth } = BODY[l.body] ?? BODY.moyen
  const tw = 0.34 * w * (femme ? 0.92 : 1)
  const td = 0.18 * depth
  const lw = (tw / 2) * 0.98
  const ld = 0.16 * limb
  const aw = (femme ? 0.115 : 0.13) * limb
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
  const sleeve = LONG_SLEEVES.has(l.outfit) ? 1 : l.outfit === 'debardeur' || l.outfit === 'basket' || l.outfit === 'souscorps' ? 0 : 0.35
  // The veil, the imam's cap: they're what shows on the head from afar.
  const veiled = femme && l.outfit === 'abaya'
  const capped = l.accessory === 'kufi' || l.outfit === 'imam' || (!femme && l.outfit === 'abaya')
  const hair = veiled ? l.bottomColor || top : capped ? '#f8f9fa' : l.hair === 'headwrap' ? top : l.hairColor
  const shape = veiled ? 'headwrap' : l.hair
  return (
    <group scale={l.height * (femme ? 0.96 : 1)} position={[0, seatDrop, 0]}>
      {/* Legs: trousers or bare legs, the shoe at the bottom */}
      {[0, 1].map((i) => (
        <group key={i} ref={legs[i]} position={[(i ? 1 : -1) * (tw / 4), HIP_Y, 0]}>
          <mesh geometry={hanging} material={mat(long ? l.skin : bottom)} scale={[lw, LEG - 0.08, ld]} />
          <mesh geometry={hanging} material={mat(shoe)} position={[0, -(LEG - 0.08), 0.01]} scale={[lw * 1.04, 0.08, ld * 1.15]} />
        </group>
      ))}
      {/* Torso, with the bottom's colour at the waist, or a long skirt or robe */}
      <mesh geometry={centred} material={mat(top)} position={[0, (NECK_Y + TORSO_BOTTOM) / 2 + 0.05, 0]} scale={[tw, NECK_Y - TORSO_BOTTOM - 0.1, td]} castShadow />
      {long ? (
        <mesh geometry={hanging} material={mat(bottom)} position={[0, 0.97, 0]} scale={[tw * 1.12, 0.7, td * 1.25]} />
      ) : (
        <mesh geometry={centred} material={mat(bottom)} position={[0, TORSO_BOTTOM + 0.05, 0]} scale={[tw, 0.1, td]} />
      )}
      {/* Arms: the sleeve, then skin down to the hand */}
      {[0, 1].map((i) => (
        <group key={i} ref={arms[i]} position={[(i ? 1 : -1) * (tw / 2 + aw / 2 + 0.006), SHOULDER_Y, 0]}>
          <mesh geometry={hanging} material={mat(l.skin)} position={[0, 0.03, 0]} scale={[aw * 0.98, ARM + 0.03, aw * 0.98]} />
          {sleeve > 0 && <mesh geometry={hanging} material={mat(top)} position={[0, 0.03, 0]} scale={[aw, (ARM + 0.03) * sleeve, aw]} />}
        </group>
      ))}
      {/* The cube head, and the hair (or the headwrap) as a slightly bigger cap */}
      <mesh geometry={centred} material={mat(l.skin)} position={[0, NECK_Y + HEAD / 2, 0]} scale={HEAD} castShadow />
      {(shape !== 'bald' || capped) && (
        <mesh
          geometry={centred}
          material={mat(hair)}
          position={[0, NECK_Y + HEAD * (veiled ? 0.7 : shape === 'afro' || shape === 'headwrap' ? 1.05 : 0.86), -0.012]}
          scale={veiled ? [HEAD * 1.18, HEAD * 1.2, HEAD * 1.18] : shape === 'afro' ? [HEAD * 1.4, HEAD * 0.6, HEAD * 1.3] : shape === 'headwrap' ? [HEAD * 1.15, HEAD * 0.5, HEAD * 1.15] : [HEAD * 1.08, HEAD * 0.32, HEAD * 1.08]}
        />
      )}
    </group>
  )
}
