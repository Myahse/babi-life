import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Look, Sim } from '../lib/types'
import { defaultColors, fullLook, hasAcc } from './options'
import { salatStep, type Pose } from './Human'
import { FilmingPhone } from './BlockHuman'

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

// Each part's boxes are baked into one geometry with their colours painted on
// the vertices: a person is five meshes (the body, two legs, two arms) of one
// shared material, and people who look alike share the geometries too.
const material = new THREE.MeshLambertMaterial({ vertexColors: true })
type Box = { c: string; s: [number, number, number]; p?: [number, number, number]; hang?: boolean }
const baked = new Map<string, THREE.BufferGeometry>()
function part(boxes: Box[]) {
  const key = JSON.stringify(boxes)
  let g = baked.get(key)
  if (g) return g
  const parts = boxes.map((b) => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    if (b.hang) box.translate(0, -0.5, 0)
    box.scale(...b.s)
    if (b.p) box.translate(...b.p)
    const flat = box.toNonIndexed()
    box.dispose()
    const col = new THREE.Color(b.c)
    const n = flat.attributes.position.count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) colors.set([col.r, col.g, col.b], i * 3)
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return flat
  })
  g = mergeGeometries(parts, false) ?? parts[0]
  for (const x of parts) if (x !== g) x.dispose()
  // A crowd has only so many looks; past that, the oldest go.
  if (baked.size > 600) {
    const first = baked.keys().next().value
    if (first !== undefined) {
      baked.get(first)?.dispose()
      baked.delete(first)
    }
  }
  baked.set(key, g)
  return g
}

const LONG = new Set(['pagne', 'boubou', 'robe', 'kaba', 'jupe', 'bazin', 'uniforme', 'abaya', 'blouse', 'soeur'])
/** Long robes, men's and women's alike. */
const ROBES = new Set(['boubou', 'bazin', 'soutane', 'imam'])
/** Outfits whose sleeves cover the whole arm. */
const LONG_SLEEVES = new Set(['suit', 'survet', 'boubou', 'bazin', 'chemise', 'blouson', 'sweat', 'soutane', 'pasteur', 'imam', 'abaya', 'blouse', 'bleu', 'cuisinier', 'vigile', 'soeur'])

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
  const whole = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  const phase = useRef(seed)
  useFrame((_, dt) => {
    // The salat, on the shared clock like the full-size people (Human): standing, hands folded; bowing;
    // prostrated (the legs back, the body down along the mat); sitting back on the heels.
    if (pose === 'salat') {
      const { step } = salatStep()
      const [bow, legX, drop, armX] = step === 1 ? [1.35, 0, 0, -1.1] : step === 3 ? [1.45, 1.4, -0.6, -2.2] : step === 4 ? [0, 1.45, -0.55, -0.5] : [0, 0, 0, step === 0 ? -0.55 : 0]
      if (upper.current) upper.current.rotation.x = bow
      if (whole.current) whole.current.position.y = drop
      for (const i of [0, 1]) {
        if (legs[i].current) legs[i].current!.rotation.x = legX
        if (arms[i].current) arms[i].current!.rotation.x = armX
      }
      return
    }
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
      // Arms up to cheer; the phone held up to film.
      if (arm) arm.rotation.x = pose === 'wave' && i ? -2.6 + s * 0.3 : pose === 'cheer' ? -2.8 + Math.sin(phase.current * 2 + i) * 0.15 : pose === 'film' ? (i ? -1.85 : -1.45) : walk ? -s * (run ? 0.9 : 0.45) * out : 0
    }
  })
  const seatDrop = pose === 'sit' || pose === 'eat' || pose === 'drink' || pose === 'write' ? -0.41 : 0
  const sleeve = LONG_SLEEVES.has(l.outfit) ? 1 : l.outfit === 'debardeur' || l.outfit === 'basket' || l.outfit === 'souscorps' ? 0 : 0.35
  // The veil, the imam's cap: they're what shows on the head from afar.
  const veiled = femme && (l.outfit === 'abaya' || l.outfit === 'soeur')
  const capped = hasAcc(l, 'kufi') || l.outfit === 'imam' || (!femme && l.outfit === 'abaya')
  const hair = veiled ? l.bottomColor || top : capped ? '#f8f9fa' : l.hair === 'headwrap' ? top : l.hairColor
  const shape = veiled ? 'headwrap' : l.hair
  const r3 = (n: number) => Math.round(n * 1000) / 1000
  const hairScale: [number, number, number] = veiled ? [HEAD * 1.18, HEAD * 1.2, HEAD * 1.18] : shape === 'afro' ? [HEAD * 1.4, HEAD * 0.6, HEAD * 1.3] : shape === 'headwrap' ? [HEAD * 1.15, HEAD * 0.5, HEAD * 1.15] : [HEAD * 1.08, HEAD * 0.32, HEAD * 1.08]
  const body = part([
    // Torso, with the bottom's colour at the waist, or a long skirt or robe
    { c: top, s: [r3(tw), r3(NECK_Y - TORSO_BOTTOM - 0.1), r3(td)], p: [0, r3((NECK_Y + TORSO_BOTTOM) / 2 + 0.05), 0] },
    long ? { c: bottom, s: [r3(tw * 1.12), 0.7, r3(td * 1.25)], p: [0, 0.97, 0], hang: true } : { c: bottom, s: [r3(tw), 0.1, r3(td)], p: [0, r3(TORSO_BOTTOM + 0.05), 0] },
    // The cube head, and the hair (or the headwrap) as a slightly bigger cap
    { c: l.skin, s: [HEAD, HEAD, HEAD], p: [0, NECK_Y + HEAD / 2, 0] },
    ...(shape !== 'bald' || capped ? [{ c: hair, s: hairScale.map(r3) as [number, number, number], p: [0, r3(NECK_Y + HEAD * (veiled ? 0.7 : shape === 'afro' || shape === 'headwrap' ? 1.05 : 0.86)), -0.012] as [number, number, number] }] : []),
  ])
  // Legs: trousers or bare legs, the shoe at the bottom
  const leg = part([
    { c: long ? l.skin : bottom, s: [r3(lw), LEG - 0.08, r3(ld)], hang: true },
    { c: shoe, s: [r3(lw * 1.04), 0.08, r3(ld * 1.15)], p: [0, -(LEG - 0.08), 0.01], hang: true },
  ])
  // Arms: the sleeve, then skin down to the hand
  const arm = part([
    { c: l.skin, s: [r3(aw * 0.98), ARM + 0.03, r3(aw * 0.98)], p: [0, 0.03, 0], hang: true },
    ...(sleeve > 0 ? [{ c: top, s: [r3(aw), r3((ARM + 0.03) * sleeve), r3(aw)] as [number, number, number], p: [0, 0.03, 0] as [number, number, number], hang: true }] : []),
  ])
  return (
    <group ref={whole} scale={l.height * (femme ? 0.96 : 1)} position={[0, seatDrop, 0]}>
      {[0, 1].map((i) => (
        <group key={i} ref={legs[i]} position={[(i ? 1 : -1) * (tw / 4), HIP_Y, 0]}>
          <mesh geometry={leg} material={material} />
        </group>
      ))}
      {/* Above the hips, turning about them (the salat's bow) */}
      <group ref={upper} position={[0, HIP_Y, 0]}>
        <group position={[0, -HIP_Y, 0]}>
          <mesh geometry={body} material={material} />
          {[0, 1].map((i) => (
            <group key={i} ref={arms[i]} position={[(i ? 1 : -1) * (tw / 2 + aw / 2 + 0.006), SHOULDER_Y, 0]}>
              <mesh geometry={arm} material={material} />
              {pose === 'film' && i === 1 && <FilmingPhone y={-0.56} />}
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}
