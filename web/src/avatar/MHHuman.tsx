import { useEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Look, Sim } from '../lib/types'
import { defaultColors, fullLook, WAX_OUTFITS } from './options'
import { tint, waxTexture } from './textures'
import { usePoseRig, useCastShadows, type Pose } from './Human'

// A person on MakeHuman's body (CC0, see tools/avatar/build_makehuman.py):
// the real shape of a young African adult, with the creator's body types and
// a child's proportions as morphs, a skeleton the poses move, and the clothes
// painted on the skin with clean cut lines (a little thickness under them),
// the skirt of the pagne and the robe, the hair, the beard, the eyes.

const URL = { femme: '/models/human-femme.glb', homme: '/models/human-homme.glb' }
useGLTF.preload(URL.femme)
useGLTF.preload(URL.homme)

type V3 = [number, number, number]
type Info = {
  bones: string[]
  parents: (string | null)[]
  joints: Record<string, V3>
  morphs: string[]
  jointDeltas: Record<string, Record<string, V3>>
  landmarks: Record<string, V3 | number> & { face: Record<string, V3>; height: number }
}

const node = (b: string) => THREE.PropertyBinding.sanitizeNodeName(b)
/** Index 0 of each pair is the side at -x: MakeHuman's right (".R"). */
const SIDE = ['.R', '.L'] as const
const DOWN = new THREE.Vector3(0, -1, 0)
const v3 = (a: V3) => new THREE.Vector3(...a)

/* ---------- What the clothes cover ---------- */

/**
 * How an outfit dresses the body. Along the arm, 0 is the shoulder, 1 the
 * elbow, 2 the wrist; along the leg, 0 the hip, 1 the knee, 2 the ankle.
 */
type Cut = {
  sleeve: number
  leg: number
  /** Where the shoes start (along the leg); sandals only have a sole. */
  shoe: number
  sandal?: boolean
  /** How far below the waist the top comes down (m): a tee over the jeans, a jacket; a belt shows if it's tucked in. */
  hem: number
  belt?: boolean
  /** Neckline: how far below the base of the neck, and how deep in front (m). */
  neck: number
  vneck: number
  skirt: boolean
  /** The skirt's hem: 1 its full length (the ankles), less is shorter; its flare. */
  skirtHem?: number
  flare?: number
  /** 0 plain, 1 wax on the top, 2 on the bottom (and skirt), 3 both. */
  wax: number
  /** 1 jersey trim, 2 three stripes (survêtement), 3 shirt and tie (costume), 4 embroidery (boubou), 5 ribbed (débardeur), 6 basket number. */
  detail: number
}

function cutFor(l: Required<Look>, femme: boolean): Cut {
  const base = { sleeve: 0.4, leg: 1.92, shoe: 1.88, hem: 0.035, neck: 0.02, vneck: 0.02, skirt: false, wax: 0, detail: 0 }
  switch (l.outfit) {
    case 'pagne':
      return femme ? { ...base, sleeve: 0.45, shoe: 2.0, sandal: true, hem: -0.02, skirt: true, skirtHem: 1, flare: 1.05, wax: 3 } : { ...base, sleeve: 0.45, wax: 1 }
    case 'boubou':
      return { ...base, sleeve: 1.75, shoe: 2.0, sandal: true, neck: 0.03, vneck: 0.05, skirt: true, skirtHem: 1, flare: 1.35, wax: 0, detail: 4 }
    case 'robe':
      if (!femme) return cutFor({ ...l, outfit: 'casual' }, femme)
      return { ...base, sleeve: 0.12, neck: 0.04, vneck: 0.07, skirt: true, skirtHem: 0.85, flare: 1.1, wax: 3 }
    case 'suit':
      return { ...base, sleeve: 1.95, hem: 0.14, neck: 0.0, vneck: 0.12, detail: 3 }
    case 'jersey':
      return { ...base, sleeve: 0.42, leg: 0.5, shoe: 1.9, detail: 1 }
    case 'debardeur':
      return { ...base, sleeve: 0.0, leg: 0.5, shoe: 2.0, sandal: true, hem: 0.05, neck: 0.05, vneck: 0.06, detail: 5 }
    case 'survet':
      return { ...base, sleeve: 1.95, hem: 0.06, neck: 0.0, vneck: 0.0, detail: 2 }
    case 'basket':
      return { ...base, sleeve: 0.0, leg: 0.85, neck: 0.05, vneck: 0.08, detail: 6 }
    default: // casual: jean & tee-shirt
      return { ...base, hem: 0.0, belt: true }
  }
}

/* ---------- The body's material: skin, clothes, face ---------- */

const BODY_VERT_HEAD = /* glsl */ `
attribute vec2 _zone;
varying vec2 vZone;
varying vec3 vRest;
varying vec3 vRestN;
uniform float uSleeve, uLeg, uShoe, uWaist, uHemY, uNeck, uVneck, uTop, uSandal, uBelt, uArmX, uArmY;
float clothAt(vec2 z, vec3 p) {
  if (z.y > -0.5) {
    if (z.y > uShoe) return uSandal > 0.5 ? (p.y < 0.016 ? 3.0 : 0.0) : 3.0;
    return z.y < uLeg ? 2.0 : 0.0;
  }
  if (z.x > -0.5) return uSleeve > 0.05 && z.x < uSleeve ? 1.0 : 0.0;
  if (p.y < uHemY) return 2.0;
  // No sleeves: a clean armhole, narrow at the shoulder, opening under the arm.
  if (uSleeve < 0.05 && (z.x > -0.95 || (p.y > uArmY - 0.17 && abs(p.x) > uArmX - 0.055 + 0.04 * smoothstep(uArmY, uArmY - 0.14, p.y)))) return 0.0;
  // The neckline goes round the neck: away from it (the shoulders) it's all
  // covered; near it, below the line, lower in front for a V or a scoop.
  float front = max(0.0, p.z) * 4.0 * smoothstep(0.08, 0.0, abs(p.x));
  if (abs(p.x) > 0.075 + uTop * 0.6 && p.y < uNeck + 0.05) return 1.0;
  if (p.y < uNeck - front * uVneck - uTop * 0.4 * smoothstep(0.03, 0.09, abs(p.x))) return 1.0;
  return 0.0;
}
`

const BODY_FRAG_HEAD = /* glsl */ `
varying vec2 vZone;
varying vec3 vRest;
varying vec3 vRestN;
uniform float uSleeve, uLeg, uShoe, uWaist, uHemY, uNeck, uVneck, uTop, uSandal, uBelt, uArmX, uArmY;
uniform vec3 uSkin, uTopC, uBottomC, uShoeC, uBrow, uLips, uTrim;
uniform float uWax, uDetail, uBeard, uSkirtOn;
uniform sampler2D uWaxMap;
uniform vec3 uEyeL, uEyeR, uMouth, uChin, uNose;
float clothAt(vec2 z, vec3 p) {
  if (z.y > -0.5) {
    if (z.y > uShoe) return uSandal > 0.5 ? (p.y < 0.016 ? 3.0 : 0.0) : 3.0;
    return z.y < uLeg ? 2.0 : 0.0;
  }
  if (z.x > -0.5) return uSleeve > 0.05 && z.x < uSleeve ? 1.0 : 0.0;
  if (p.y < uHemY) return 2.0;
  // No sleeves: a clean armhole, narrow at the shoulder, opening under the arm.
  if (uSleeve < 0.05 && (z.x > -0.95 || (p.y > uArmY - 0.17 && abs(p.x) > uArmX - 0.055 + 0.04 * smoothstep(uArmY, uArmY - 0.14, p.y)))) return 0.0;
  // The neckline goes round the neck: away from it (the shoulders) it's all
  // covered; near it, below the line, lower in front for a V or a scoop.
  float front = max(0.0, p.z) * 4.0 * smoothstep(0.08, 0.0, abs(p.x));
  if (abs(p.x) > 0.075 + uTop * 0.6 && p.y < uNeck + 0.05) return 1.0;
  if (p.y < uNeck - front * uVneck - uTop * 0.4 * smoothstep(0.03, 0.09, abs(p.x))) return 1.0;
  return 0.0;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
/** The wax print, wrapped round the body. */
vec3 waxAt(vec3 p) {
  float u = atan(p.x, p.z) / 6.2832 * 3.0;
  return texture2D(uWaxMap, vec2(u, p.y * 3.2)).rgb;
}
`

/** The body's colour at a point of its rest pose, before light. */
const BODY_FRAG_COLOR = /* glsl */ `
  vec3 c = uSkin;
  vec3 p = vRest;
  float cloth = clothAt(vZone, p);
  // Face: lips a little darker and redder, eyebrows, the beard.
  float face = step(uChin.y - 0.02, p.y) * step(0.0, p.z);
  vec2 m = (p.xy - uMouth.xy) / vec2(0.026, 0.011);
  float lips = smoothstep(1.0, 0.75, length(m)) * face * step(uMouth.z - 0.03, p.z);
  c = mix(c, uLips, lips * 0.75);
  for (int i = 0; i < 2; i++) {
    vec3 e = i == 0 ? uEyeL : uEyeR;
    vec2 b = vec2((p.x - e.x) / 0.024, (p.y - (e.y + 0.021 + 0.004 * (1.0 - pow((p.x - e.x) / 0.024, 2.0)))) / 0.0035);
    float brow = smoothstep(1.0, 0.6, length(b)) * step(e.z - 0.01, p.z);
    c = mix(c, uBrow, brow * 0.9);
  }
  if (uBeard > 0.5) {
    float below = smoothstep(uNose.y - 0.022, uNose.y - 0.03, p.y) * step(uChin.y - 0.025, p.y);
    float front2 = smoothstep(0.02, 0.07, p.z);
    float side = abs(p.x);
    float r = 0.0;
    // 1 moustache, 2 bouc (goatee), 3 full beard.
    if (uBeard < 1.5) r = smoothstep(0.012, 0.004, abs(p.y - (uMouth.y + 0.013))) * step(side, 0.03);
    else if (uBeard < 2.5) r = (smoothstep(0.012, 0.004, abs(p.y - (uMouth.y + 0.013))) * step(side, 0.026) + step(p.y, uMouth.y - 0.012) * step(side, 0.022)) * below;
    else r = below * smoothstep(0.075, 0.05, side) * (1.0 - lips);
    r *= front2 * (0.75 + 0.25 * hash(floor(p.xy * 900.0)));
    c = mix(c, uBrow, clamp(r, 0.0, 1.0) * 0.92);
  }
  if (cloth > 0.5) {
    vec3 f = cloth < 1.5 ? uTopC : cloth < 2.5 ? uBottomC : uShoeC;
    if (cloth > 2.5 && p.y < 0.022) f = uSandal > 0.5 ? uShoeC : mix(uShoeC, vec3(0.08), step(0.5, dot(uShoeC, vec3(0.33))) * 0.0 + 0.35);
    if (cloth > 1.5 && cloth < 2.5 && uBelt > 0.5 && vZone.x < -0.5 && vZone.y < -0.5 && abs(p.y - (uHemY - 0.012)) < 0.011) f = vec3(0.12, 0.08, 0.06);
    bool waxed = (cloth < 1.5 && mod(uWax, 2.0) > 0.5) || (cloth > 1.5 && cloth < 2.5 && uWax > 1.5);
    if (waxed) f = waxAt(p);
    // Details: the jersey's trim, the tracksuit's stripes, the shirt and tie…
    if (uDetail > 0.5 && uDetail < 1.5 && cloth < 1.5 && ((vZone.x > -0.5 && vZone.x > uSleeve - 0.06) || (vZone.x < -0.5 && p.y > uNeck - 0.035))) f = uTrim;
    if (uDetail > 1.5 && uDetail < 2.5 && cloth < 2.5) {
      float outward = vRestN.x * sign(p.x);
      float band = step(0.8, outward) * step(abs(vRestN.z), 0.42) * step(0.5, fract(vRestN.z * 3.6 + 0.5));
      if (vZone.x > -0.5 || vZone.y > -0.5) f = mix(f, uTrim, band);
    }
    if (uDetail > 2.5 && uDetail < 3.5 && cloth < 1.5 && vZone.x < -0.5 && p.z > 0.0) {
      float v = uNeck - p.y;
      float open = step(abs(p.x), 0.012 + v * 0.18) * step(v, 0.2);
      f = mix(f, vec3(0.97), open);
      float tie = step(abs(p.x), 0.008 + v * 0.03) * step(v, 0.26) * step(0.01, v);
      f = mix(f, uTrim, tie);
    }
    if (uDetail > 3.5 && uDetail < 4.5 && cloth < 1.5 && vZone.x < -0.5 && p.z > 0.0) {
      float v = uNeck - p.y;
      float gold = step(abs(abs(p.x) - (0.03 + v * 0.1)), 0.006) * step(v, 0.16) + step(abs(p.x), 0.014) * step(0.14, v) * step(v, 0.3);
      f = mix(f, vec3(0.91, 0.72, 0.24), clamp(gold, 0.0, 1.0));
    }
    if (uDetail > 4.5 && uDetail < 5.5 && cloth < 1.5) f *= 0.93 + 0.07 * step(0.5, fract(p.x * 260.0));
    // The basketball vest: a trim round the neck.
    if (uDetail > 5.5 && cloth < 1.5 && vZone.x < -0.5 && abs(p.x) < 0.075 + uTop * 0.6 && p.y > uNeck - uVneck * 4.0 * max(0.0, p.z) * smoothstep(0.08, 0.0, abs(p.x)) - 0.025) f = uTrim;
    // Fabric: a faint weave so it doesn't look like skin.
    f *= 0.96 + 0.04 * hash(floor(p.xy * 700.0));
    c = f;
  }
  diffuseColor.rgb = c;
`

export type BodyUniforms = Record<string, THREE.IUniform>

function bodyMaterial(u: BodyUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = BODY_VERT_HEAD + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vZone = _zone; vRest = position; vRestN = normal;
      float cl = clothAt(_zone, position);
      // Clothes have a thickness; trouser legs fall straight from the knee,
      // shoes are a size up; the front of the crotch is smoothed under cloth.
      float th = cl > 2.5 ? 0.011 : cl > 1.5 ? 0.004 + (_zone.y > -0.5 ? 0.006 + 0.016 * smoothstep(0.7, 1.8, _zone.y) : 0.0) : cl > 0.5 ? 0.0025 + (_zone.x > -0.5 ? 0.001 + 0.008 * smoothstep(0.2, 1.4, _zone.x) : 0.0) : 0.0;
      transformed += normal * th;
      if (cl > 1.5 && cl < 2.5 && _zone.x < -0.5 && abs(position.x) < 0.07 && position.y < uWaist - 0.06) transformed.z -= max(0.0, position.z - 0.035) * 0.65;`,
    )
    sh.fragmentShader = BODY_FRAG_HEAD + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${BODY_FRAG_COLOR}`)
  }
  m.customProgramCacheKey = () => 'babi-body'
  return m
}

/** The skirt (pagne, robe, boubou): its length and flare, the wax print. */
function skirtMaterial(u: BodyUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = `uniform float uHem, uFlare, uTopY; varying vec3 vRest;\n` + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float k = clamp((uTopY - position.y) / uTopY, 0.0, 1.0);
      transformed.y = uTopY - (uTopY - position.y) * uHem;
      transformed.xz *= 1.0 + (uFlare - 1.0) * k;
      vRest = transformed;`,
    )
    sh.fragmentShader =
      `uniform vec3 uBottomC; uniform float uWax; uniform sampler2D uWaxMap; varying vec3 vRest;\n` +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 f = uBottomC;
        if (uWax > 1.5) f = texture2D(uWaxMap, vec2(atan(vRest.x, vRest.z) / 6.2832 * 3.0, vRest.y * 3.2)).rgb;
        diffuseColor.rgb = f;`,
      )
  }
  m.customProgramCacheKey = () => 'babi-skirt'
  return m
}

/** The hair cap: pushed out from the head (short hair, afro, the headwrap's cloth). */
function hairMaterial(u: BodyUniforms) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = `attribute float _edge; uniform float uPuff, uPuffLow, uCurl; uniform vec3 uHeadC; varying vec3 vHairP;\nfloat hh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n` + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      // Out along the surface, rounder (towards the head's centre) the more
      // it puffs; thinning to nothing at the hairline. An afro is curly.
      vec3 out_ = normalize(mix(normal, normalize(position - uHeadC), clamp(uPuff * 14.0, 0.0, 0.95)));
      float up = 0.45 + 0.55 * smoothstep(uPuffLow, uHeadC.y + 0.08, position.y);
      float bump = 1.0 + uCurl * 0.12 * sin(position.x * 160.0) * sin(position.y * 170.0) * sin(position.z * 150.0);
      float edge = smoothstep(0.0, 1.0, _edge);
      transformed += out_ * (0.0025 + uPuff * up * bump) * (0.25 + 0.75 * edge);
      vHairP = position;`,
    )
    sh.fragmentShader =
      `uniform vec3 uHair; uniform float uPuff, uWrap; varying vec3 vHairP;\nfloat hh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n` +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        // Tight curls: a fine grain of light and dark.
        // A headwrap is cloth, in folds.
        `#include <color_fragment>\ndiffuseColor.rgb = uWrap > 0.5 ? uHair * (0.86 + 0.14 * sin(vHairP.y * 240.0 + vHairP.x * 90.0 + sin(vHairP.z * 60.0) * 3.0)) : uHair * (0.8 + 0.35 * hh(floor(vHairP * 900.0)));`,
      )
  }
  m.customProgramCacheKey = () => 'babi-hair'
  return m
}

/* ---------- The person ---------- */

type Props = { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; headScale?: number; speed?: number }

const color = (c: string) => new THREE.Color(c)

export function MHHuman({ look, gender, pose = 'idle', seed = 0, headScale = 1, speed }: Props) {
  const young = headScale > 1
  const l = young ? { ...fullLook(look), beard: 'none', accessory: 'none' } : fullLook(look)
  const femme = gender === 'femme'
  const gltf = useGLTF(URL[gender])
  const info = gltf.scene.userData as Info
  const shadows = useCastShadows()

  // This person's copy of the model: meshes, skeleton, materials.
  const model = useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Group
    const meshes: Record<string, THREE.SkinnedMesh> = {}
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh
      if (m.isSkinnedMesh) {
        meshes[(m.material as THREE.Material).name] = m
        m.frustumCulled = false
      }
    })
    const bone = (b: string) => root.getObjectByName(node(b)) as THREE.Bone
    const u: BodyUniforms = {
      uSleeve: { value: 0 },
      uLeg: { value: 0 },
      uShoe: { value: 0 },
      uWaist: { value: 0 },
      uHemY: { value: 0 },
      uBelt: { value: 0 },
      uArmX: { value: 0 },
      uArmY: { value: 0 },
      uNeck: { value: 0 },
      uVneck: { value: 0 },
      uTop: { value: 1 },
      uSandal: { value: 0 },
      uSkin: { value: new THREE.Color() },
      uTopC: { value: new THREE.Color() },
      uBottomC: { value: new THREE.Color() },
      uShoeC: { value: new THREE.Color() },
      uHair: { value: new THREE.Color() },
      uLips: { value: new THREE.Color() },
      uTrim: { value: new THREE.Color() },
      uWax: { value: 0 },
      uDetail: { value: 0 },
      uBeard: { value: 0 },
      uSkirtOn: { value: 0 },
      uWaxMap: { value: null },
      uEyeL: { value: v3(info.landmarks.eyeL as V3) },
      uEyeR: { value: v3(info.landmarks.eyeR as V3) },
      uMouth: { value: v3(info.landmarks.face['oris01']).lerp(v3(info.landmarks.face['oris05']), 0.5) },
      uChin: { value: v3(info.landmarks.chin as V3) },
      uNose: { value: v3(info.landmarks.nose as V3) },
      uHem: { value: 1 },
      uFlare: { value: 1 },
      uTopY: { value: (info.landmarks.waist as V3)[1] + 0.06 },
      uPuff: { value: 0 },
      uPuffLow: { value: 0 },
      uCurl: { value: 0 },
      uWrap: { value: 0 },
      uBrow: { value: new THREE.Color() },
      uHeadC: { value: v3(info.landmarks.headCenter as V3) },
    }
    meshes.body.material = bodyMaterial(u)
    meshes.skirt.material = skirtMaterial(u)
    meshes.scalp.material = hairMaterial(u)
    meshes.lashes.material = new THREE.MeshStandardMaterial({ color: '#120c0a', roughness: 1, side: THREE.DoubleSide })
    meshes.teeth.material = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.4 })
    return { root, meshes, bone, u, skeleton: meshes.body.skeleton }
  }, [gltf, info])
  useEffect(() => () => Object.values(model.meshes).forEach((m) => (m.material as THREE.Material).dispose()), [model])

  // The body type and age: morphs, and the skeleton moved to fit them.
  const body = young ? 'child' : l.body
  useMemo(() => {
    const infl: Record<string, number> = { mince: 0, fort: 0, rond: 0, child: 0, old: 0 }
    if (body in infl) infl[body] = 1
    for (const m of Object.values(model.meshes)) {
      const dict = m.morphTargetDictionary ?? {}
      for (const [k, i] of Object.entries(dict)) if (m.morphTargetInfluences) m.morphTargetInfluences[i] = infl[k] ?? 0
    }
    const world: Record<string, THREE.Vector3> = {}
    for (const b of info.bones) {
      const p = v3(info.joints[b])
      for (const [k, w] of Object.entries(infl)) if (w) p.addScaledVector(v3(info.jointDeltas[k][b]), w)
      world[b] = p
    }
    info.bones.forEach((b, i) => {
      const parent = info.parents[i]
      const bn = model.bone(b)
      bn.position.copy(world[b]).sub(parent ? world[parent] : new THREE.Vector3())
      model.skeleton.boneInverses[info.bones.indexOf(b)].makeTranslation(-world[b].x, -world[b].y, -world[b].z)
    })
    model.u.uWaist.value = world['spine04'].y - 0.02
    model.u.uNeck.value = world['neck01'].y - 0.035
    model.u.uArmX.value = world['upperarm01.L'].x
    model.u.uArmY.value = world['upperarm01.L'].y
  }, [model, info, body])

  // Colours and cuts.
  const cut = useMemo(() => cutFor(l, femme), [l.outfit, femme]) // eslint-disable-line react-hooks/exhaustive-deps
  const dc = defaultColors(l, femme)
  const u = model.u
  u.uSleeve.value = cut.sleeve
  u.uLeg.value = cut.skirt ? 0 : cut.leg
  u.uShoe.value = cut.shoe
  u.uVneck.value = cut.vneck
  u.uTop.value = cut.neck
  u.uSandal.value = cut.sandal ? 1 : 0
  u.uHemY.value = u.uWaist.value - cut.hem
  u.uBelt.value = cut.belt ? 1 : 0
  u.uSkin.value.set(l.skin)
  u.uTopC.value.set(l.outfitColor)
  u.uBottomC.value.set(cut.skirt ? l.bottomColor || l.outfitColor : l.bottomColor || (l.outfit === 'suit' ? tint(dc.bottom, -0.18) : dc.bottom))
  u.uShoeC.value.set(l.shoeColor || dc.shoe)
  u.uHair.value.set(l.hairColor)
  u.uLips.value.copy(color(l.skin).lerp(color('#5a2a2a'), 0.35))
  u.uTrim.value.set(l.outfit === 'jersey' ? '#009a44' : l.outfit === 'survet' ? '#f4f4f4' : l.outfit === 'suit' ? (l.outfitColor === '#b02e0c' || l.outfitColor === '#d6336c' ? '#14213d' : '#d6336c') : l.outfit === 'basket' ? '#f4f4f4' : tint(l.outfitColor, -0.3))
  u.uWax.value = WAX_OUTFITS.has(l.outfit) || l.outfit === 'pagne' ? cut.wax : 0
  u.uWaxMap.value = u.uWax.value ? waxTexture(cut.skirt && l.bottomColor ? l.bottomColor : l.outfitColor, l.pattern) : null
  if (u.uWaxMap.value) (u.uWaxMap.value as THREE.Texture).wrapS = (u.uWaxMap.value as THREE.Texture).wrapT = THREE.RepeatWrapping
  u.uDetail.value = cut.detail
  u.uBeard.value = femme ? 0 : ({ none: 0, moustache: 1, bouc: 2, full: 3 } as Record<string, number>)[l.beard] ?? 0
  u.uHem.value = cut.skirtHem ?? 1
  u.uFlare.value = cut.flare ?? 1
  model.meshes.skirt.visible = cut.skirt
  // Hair: the cap pushed out, more for an afro; nothing when shaved.
  const hair = l.accessory === 'cap' || l.accessory === 'capback' ? (l.hair === 'bald' ? 'bald' : 'short') : l.hair
  model.meshes.scalp.visible = hair !== 'bald'
  u.uPuff.value = hair === 'afro' ? 0.008 : hair === 'headwrap' ? 0.012 : hair === 'locks' ? 0.012 : hair === 'weave' || hair === 'bun' ? 0.006 : 0.002
  u.uPuffLow.value = (info.landmarks.eyeL as V3)[1] + (hair === 'afro' ? -0.03 : 0.01)
  u.uCurl.value = hair === 'afro' ? 1 : 0
  u.uWrap.value = hair === 'headwrap' ? 1 : 0
  u.uBrow.value.set(l.hairColor)
  if (hair === 'headwrap') u.uHair.value.set(l.outfitColor)
  for (const m of Object.values(model.meshes)) m.castShadow = shadows

  // The poses: hips, knees and head move their bones; the arms go through a
  // stand-in that adds the turn bringing them down from MakeHuman's A-pose.
  const rest = useMemo(() => {
    const out = SIDE.map((s) => {
      const up = v3(info.joints['lowerarm01' + s]).sub(v3(info.joints['upperarm01' + s])).normalize()
      const qa = new THREE.Quaternion().setFromUnitVectors(up, DOWN)
      // A third of the turn at the shoulder joint, the rest at the arm: no pinched shoulder.
      const qs = new THREE.Quaternion().slerp(qa, 0.3)
      const qsInv = qs.clone().invert()
      const fore = v3(info.joints['wrist' + s]).sub(v3(info.joints['lowerarm01' + s])).normalize()
      const qf = new THREE.Quaternion().setFromUnitVectors(fore, DOWN.clone().applyQuaternion(qa.clone().invert()))
      // The fingers, a little curled towards the palm.
      const dir = v3(info.joints['finger3-2' + s]).sub(v3(info.joints['finger3-1' + s])).normalize()
      const across = v3(info.joints['finger5-1' + s]).sub(v3(info.joints['finger2-1' + s]))
      let palm = new THREE.Vector3().crossVectors(dir, across).normalize()
      if (palm.y > 0) palm = palm.negate()
      const axis = new THREE.Vector3().crossVectors(dir, palm).normalize()
      return { qa, qf, axis, qs, qsInv }
    })
    return out
  }, [info])
  const root = useRef<THREE.Group>(null)
  const ref = (b: string) => ({ current: model.bone(b) })
  const arm = useMemo(() => [new THREE.Object3D(), new THREE.Object3D()], [])
  const fore = useMemo(() => [new THREE.Object3D(), new THREE.Object3D()], [])
  usePoseRig(
    {
      root,
      head: ref('head'),
      chest: ref('spine02'),
      hip: SIDE.map((s) => ref('upperleg01' + s)),
      knee: SIDE.map((s) => ref('lowerleg01' + s)),
      shoulder: arm.map((o) => ({ current: o })),
      elbow: fore.map((o) => ({ current: o })),
    },
    pose,
    seed,
    speed,
  )
  const q = useMemo(() => new THREE.Quaternion(), [])
  useEffect(() => {
    SIDE.forEach((s, i) => {
      for (let f = 2; f <= 5; f++) for (let k = 1; k <= 3; k++) model.bone(`finger${f}-${k}${s}`).quaternion.setFromAxisAngle(rest[i].axis, k === 1 ? 0.25 : 0.35)
    })
  }, [model, rest])
  useFrame(({ clock }) => {
    SIDE.forEach((s, i) => {
      model.bone('shoulder01' + s).quaternion.copy(rest[i].qs)
      model.bone('upperarm01' + s).quaternion.copy(rest[i].qsInv).multiply(q.setFromEuler(arm[i].rotation)).multiply(rest[i].qa)
      model.bone('lowerarm01' + s).quaternion.copy(q.setFromEuler(fore[i].rotation)).multiply(rest[i].qf)
    })
    // The jaw: talking, shouting, singing.
    const talk = pose === 'talk' || pose === 'rant' || pose === 'cheer'
    model.bone('jaw').rotation.x = talk ? Math.max(0, Math.sin(clock.elapsedTime * 9 + seed)) * 0.09 : 0
  })

  // A child's head is bigger for the body (the morph already gives a child's proportions).
  model.bone('head').scale.setScalar(young ? 1 + (headScale - 1) * 0.5 : 1)

  return (
    <group scale={l.height}>
      <group ref={root}>
        <primitive object={model.root} />
        {createPortal(<Eyes info={info} eyes={l.eyes} />, model.bone('head'))}
        {createPortal(<HeadExtras info={info} l={l} hair={hair} femme={femme} />, model.bone('head'))}
        {(l.marks === 'genou' || l.marks === 'bagarre') && createPortal(<KneeBandage info={info} />, model.bone('lowerleg01.R'))}
        {l.accessory === 'chain' && createPortal(<Chain info={info} color={l.accessoryColor || dc.accessory} />, model.bone('neck01'))}
      </group>
    </group>
  )
}

/* ---------- Eyes, hair styles, accessories (in the head bone's space) ---------- */

/** Head-local position of a rest-pose point (the head bone has no rotation at rest). */
function local(info: Info, p: V3): V3 {
  const h = info.joints['head']
  return [p[0] - h[0], p[1] - h[1], p[2] - h[2]]
}

const eyeTex = new Map<string, THREE.CanvasTexture>()
function eyeTexture(iris: string) {
  let t = eyeTex.get(iris)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = '#f2ece2'
    g.fillRect(0, 0, 4, 64)
    g.fillStyle = iris
    g.fillRect(0, 0, 4, 13)
    g.fillStyle = '#080605'
    g.fillRect(0, 0, 4, 6)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    eyeTex.set(iris, t)
  }
  return t
}
const EYE = (() => {
  const g = new THREE.SphereGeometry(0.0114, 20, 14)
  g.rotateX(Math.PI / 2)
  return g
})()

function Eyes({ info, eyes }: { info: Info; eyes: string }) {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: eyeTexture(eyes), roughness: 0.15 }), [eyes])
  return (
    <>
      {(['eyeL', 'eyeR'] as const).map((k) => {
        const p = local(info, info.landmarks[k] as V3)
        return <mesh key={k} geometry={EYE} material={m} position={[p[0], p[1], p[2] - 0.0035]} />
      })}
    </>
  )
}

const mats = new Map<string, THREE.MeshStandardMaterial>()
const solid = (c: string, rough = 0.7, metal = 0, double = false) => {
  const k = `${c}|${rough}|${metal}|${double}`
  let m = mats.get(k)
  if (!m) mats.set(k, (m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, side: double ? THREE.DoubleSide : THREE.FrontSide })))
  return m
}

function HeadExtras({ info, l, hair, femme }: { info: Info; l: Required<Look>; hair: string; femme: boolean }) {
  const L = info.landmarks
  const top = local(info, L.headTop as V3)
  const c = local(info, L.headCenter as V3)
  const [eL, eR] = [local(info, L.eyeL as V3), local(info, L.eyeR as V3)]
  const [earL, earR] = [local(info, L.earL as V3), local(info, L.earR as V3)]
  const hc = solid(l.hairColor, 0.95)
  const acc = l.accessoryColor || defaultColors(l, femme).accessory
  const strands = useMemo(() => {
    // Braids and locks: strands from all round the back and sides of the head.
    const r = (n: number) => ((Math.sin(n * 91.7) * 43758.5453) % 1 + 1) % 1
    return [...Array(hair === 'locks' ? 22 : 30)].map((_, i) => {
      const a = Math.PI * 0.58 + (i / ((hair === 'locks' ? 22 : 30) - 1)) * Math.PI * 0.84
      return { a, len: (hair === 'locks' ? 0.2 : femme ? 0.28 : 0.18) * (0.8 + r(i) * 0.4) }
    })
  }, [hair, femme])
  return (
    <group>
      {hair === 'afro' && <Afro info={info} color={l.hairColor} />}
      {hair === 'bun' && (
        <mesh material={hc} position={[c[0], top[1] - 0.02, c[2] - 0.07]}>
          <sphereGeometry args={[0.045, 14, 10]} />
        </mesh>
      )}
      {(hair === 'braids' || hair === 'locks') &&
        strands.map((s, i) => (
          <mesh key={i} material={hc} position={[c[0] + Math.sin(s.a) * 0.075, c[1] + 0.02 - s.len / 2, c[2] + Math.cos(s.a) * 0.085 - 0.01]} rotation={[Math.cos(s.a) * -0.12, 0, Math.sin(s.a) * 0.12]}>
            <cylinderGeometry args={[hair === 'locks' ? 0.009 : 0.006, hair === 'locks' ? 0.008 : 0.004, s.len, 5]} />
          </mesh>
        ))}
      {hair === 'weave' && (
        // A long straight weave down the back and the shoulders.
        <mesh material={solid(l.hairColor, 0.6, 0, true)} position={[c[0], c[1] - 0.06, c[2] - 0.02]} scale={[1, 1, 0.88]}>
          <cylinderGeometry args={[0.088, 0.135, 0.3, 20, 1, true, Math.PI * 0.2, Math.PI * 1.6]} />
        </mesh>
      )}
      {hair === 'headwrap' && (
        <group>
          <mesh material={solid(l.outfitColor, 0.85)} position={[c[0], top[1] - 0.035, c[2] - 0.035]} rotation={[-0.5, 0, 0]} scale={[0.95, 0.72, 1.12]}>
            <sphereGeometry args={[0.09, 20, 14]} />
          </mesh>
          <mesh material={solid(l.outfitColor, 0.85)} position={[c[0] + 0.02, top[1] + 0.03, c[2] - 0.01]} rotation={[0.3, 0.4, 0.6]}>
            <torusGeometry args={[0.03, 0.014, 8, 16]} />
          </mesh>
        </group>
      )}
      {(l.marks === 'pansement' || l.marks === 'bagarre') && (
        // A plaster in a cross on the cheekbone.
        <group position={[eL[0] + 0.018, eL[1] - 0.028, eL[2] + 0.022]} rotation={[0, 0.5, 0.4]}>
          <mesh material={solid('#e9cfa6', 0.9)}>
            <boxGeometry args={[0.03, 0.009, 0.002]} />
          </mesh>
          <mesh material={solid('#e9cfa6', 0.9)}>
            <boxGeometry args={[0.009, 0.03, 0.002]} />
          </mesh>
        </group>
      )}
      {(l.marks === 'griffures' || l.marks === 'bagarre') &&
        // Three scratches on the other cheek.
        [0, 1, 2].map((k) => (
          <mesh key={k} material={solid('#7a1f1f', 0.8)} position={[eR[0] - 0.012 - k * 0.005, eR[1] - 0.03 - k * 0.002, eR[2] + 0.018 - k * 0.003]} rotation={[0, -0.6, 0.9]}>
            <boxGeometry args={[0.022, 0.0016, 0.0016]} />
          </mesh>
        ))}
      {l.accessory === 'glasses' && (
        <group position={[0, eL[1], eL[2] + 0.016]}>
          {[eL, eR].map((e, i) => (
            <mesh key={i} material={solid(acc, 0.3)} position={[e[0], 0, 0]}>
              <torusGeometry args={[0.016, 0.0022, 6, 18]} />
            </mesh>
          ))}
          <mesh material={solid(acc, 0.3)} position={[0, 0.003, 0]}>
            <boxGeometry args={[0.018, 0.003, 0.003]} />
          </mesh>
          {[eL, eR].map((e, i) => (
            <mesh key={`arm${i}`} material={solid(acc, 0.3)} position={[e[0] * 2.3, 0.003, -0.045]}>
              <boxGeometry args={[0.003, 0.003, 0.09]} />
            </mesh>
          ))}
        </group>
      )}
      {l.accessory === 'earrings' &&
        [earL, earR].map((e, i) => (
          <mesh key={i} material={solid(acc, 0.25, 0.8)} position={[e[0] * 1.02, e[1] - 0.03, e[2] + 0.004]}>
            <torusGeometry args={[0.009, 0.0018, 6, 16]} />
          </mesh>
        ))}
      {(l.accessory === 'cap' || l.accessory === 'capback') && (
        <group position={[c[0], c[1] + 0.035, c[2] - 0.004]} rotation={[0, l.accessory === 'capback' ? Math.PI : 0, 0]}>
          <mesh material={solid(acc, 0.8)} scale={[0.86, 0.95, 1.06]}>
            <sphereGeometry args={[0.095, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={solid(acc, 0.8)} position={[0, 0.006, 0.1]} rotation={[0.12, 0, 0]} scale={[1, 1, 0.9]}>
            <cylinderGeometry args={[0.07, 0.07, 0.006, 20, 1, false, -Math.PI / 2, Math.PI]} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/**
 * An afro: a round mass of tight curls all round the head, open over the
 * face (the front below the hairline is cut away), seen from inside too.
 */
const afroMats = new Map<string, THREE.MeshStandardMaterial>()
function afroMaterial(c: string, cut: THREE.Vector3) {
  const k = `${c}|${cut.toArray().join()}`
  let m = afroMats.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uCut = { value: cut }
      sh.vertexShader = 'varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float n = sin(position.x * 140.0) * sin(position.y * 150.0) * sin(position.z * 130.0);
        transformed += normal * n * 0.006;
        vP = transformed;`)
      sh.fragmentShader = 'uniform vec3 uCut; varying vec3 vP;\nfloat hh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        // The face: in front, below the hairline (a gentle arch), nothing.
        float arch = uCut.y + 0.02 * (1.0 - smoothstep(0.0, 0.07, abs(vP.x)));
        if (vP.z > uCut.z && vP.y < arch) discard;
        if (vP.y < uCut.y - 0.06 - 0.07 * smoothstep(0.02, -0.1, vP.z)) discard;`).replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.75 + 0.4 * hh(floor(vP * 500.0));')
    }
    m.customProgramCacheKey = () => 'babi-afro'
    afroMats.set(k, m)
  }
  return m
}

function Afro({ info, color: c }: { info: Info; color: string }) {
  const L = info.landmarks
  const centre = local(info, L.headCenter as V3)
  const eye = local(info, L.eyeL as V3)
  // In the sphere's own frame: the hairline above the brows, the face's front.
  const at: V3 = [centre[0], centre[1] + 0.035, centre[2] - 0.028]
  const cut = useMemo(() => new THREE.Vector3(0, eye[1] + 0.05 - at[1], eye[2] - 0.035 - at[2]), [eye[1], eye[2], at[1], at[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh material={afroMaterial(c, cut)} position={at} scale={[1, 0.95, 1.02]}>
      <sphereGeometry args={[0.128, 32, 22]} />
    </mesh>
  )
}

/** A bandage round the right knee (in the shin bone's space: the knee is its origin). */
function KneeBandage({ info }: { info: Info }) {
  void info
  const r = 0.058
  return (
    <mesh material={solid('#f2efe8', 0.95)} position={[0, -0.02, 0.012]}>
      <cylinderGeometry args={[r, r * 0.95, 0.09, 14, 1, true]} />
    </mesh>
  )
}

function Chain({ info, color: c }: { info: Info; color: string }) {
  const n = info.joints['neck01']
  const s = info.joints['spine01']
  return (
    <mesh material={solid(c, 0.25, 0.9)} position={[0, s[1] - n[1] + 0.05, 0.04]} rotation={[1.25, 0, 0]}>
      <torusGeometry args={[0.075, 0.003, 6, 30]} />
    </mesh>
  )
}
