import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { accessoryColor, fullLook, hasAcc } from './options'
import { FullDetail, useCastShadows, usePoseRig, type Gait, type Pose, type RigStyle } from './Human'
import { isDance } from './dances'
import { FilmingPhone, RinseGlass, Toothbrush } from './BlockHuman'
import { worldTime } from '../lib/worldClock'
import { Wad } from '../world3d/money'
import { H, NECK_Y, SHOULDER_Y, build, builtLook, lollipop, mayBuild, type Built } from './detail/build'
import { FOREARM, HIP_Y, THIGH, UPPER_ARM } from './detail/outfits'
import { FaceOverlay, faceMaterial } from './face'
import { useFaceMood } from './expressions'
import { EAR_AT, HANG_Y, leaveLook, mayBuildReal, useLook } from './detail/real'
import { hdNow } from './hd'
import { capOf, joinSlots, leaveSlots, rankSlots, usePersos, type PersosTier, type Slot } from './persos'

// « Persos réalistes » (the update « persos-realistes »): the detailed Sim (detail/build.ts, every
// look of options.ts) with its atlas at 1 cm a texel (a weave in the cloth, strands in the hair, the
// face's lines rounded), a matte standard material lit by the sky like the street (« lumiere-
// realiste »), and the whole body baked into ONE skinned mesh (detail/real.ts): a Sim is two draw
// calls (body, face) instead of DetailHuman's eleven or BlockHuman's twenty-four. The bones are the
// joints usePoseRig moves, so every pose, dance, fight, sport and held thing works as before; the
// loose hair and the earrings have their own bones and lag behind the head's moves.
//
// Only the nearest Sims get it (persos.ts: the player's own and the creator's always, then the
// nearest within 14 m, up to 4/10/20 by device; anywhere in « mon-quartier »'s small world, up to 12/30/60); the
// others are drawn exactly as today.

type Props = { gait?: Gait; look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; headScale?: number; speed?: number; take?: number; clock?: () => number; fitted?: boolean; hold?: React.ReactNode; faceId?: string; full?: boolean }

const STYLE: RigStyle = { snap: 1.1, swing: 1, elbow: 1, knee: 1, headBob: 0.4 }

/**
 * Today's Sim (`Classic`: BlockHuman or DetailHuman), or the realistic one when the update is open
 * and this Sim is among the nearest. The switch is made a few times a second at most.
 */
export function PersoSwitch<P extends Props>({ props, Classic }: { props: P; Classic: (p: P) => React.ReactNode }) {
  const tier = usePersos()
  if (tier === 'off') return <Classic {...props} />
  return <PersoLod props={props} Classic={Classic} tier={tier} />
}

const at = new THREE.Vector3()
function PersoLod<P extends Props>({ props, Classic, tier }: { props: P; Classic: (p: P) => React.ReactNode; tier: Exclude<PersosTier, 'off'> }) {
  const mood = useFaceMood()
  const full = useContext(FullDetail) || !!props.full
  const prio = full || props.faceId === 'me' || mood?.id === 'me'
  const slot = useMemo<Slot>(() => ({ d: prio ? 0 : Infinity, prio, ok: prio }), []) // eslint-disable-line react-hooks/exhaustive-deps
  slot.prio = prio
  const [real, setReal] = useState(slot.ok)
  const anchor = useRef<THREE.Group>(null)
  useEffect(() => {
    joinSlots(slot)
    return () => leaveSlots(slot)
  }, [slot])
  useFrame(({ camera }) => {
    if (!anchor.current) return
    slot.d = anchor.current.getWorldPosition(at).distanceTo(camera.position)
    rankSlots(performance.now(), capOf(tier))
    if (slot.ok !== real) setReal(slot.ok)
  })
  return <group ref={anchor}>{real ? <RealHuman {...props} tier={tier} fallback={<Classic {...props} />} /> : <Classic {...props} />}</group>
}

/** The realistic Sim; `fallback` is drawn while its look is being built (a few ms, within a frame's budget). */
export function RealHuman(props: Props & { tier: Exclude<PersosTier, 'off'>; fallback: React.ReactNode }) {
  const { look, gender, pose = 'idle', headScale = 1, fitted, full } = props
  const young = headScale > 1 && !fitted
  const child = headScale >= 1.2
  const l = fullLook(look)
  const femme = gender === 'femme'
  const loo = pose === 'toilet'
  const lookKey = JSON.stringify(l)
  const [tries, retry] = useState(0)
  const b = useMemo(() => {
    const o = { femme, young, child, loo, real: true }
    return builtLook(l, o) ?? (full || (mayBuild() && mayBuildReal()) ? build(l, o) : null)
  }, [lookKey, femme, young, child, loo, full, tries]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (b) return
    const id = requestAnimationFrame(() => retry((n) => n + 1))
    return () => cancelAnimationFrame(id)
  }, [b, tries])
  // The look's atlas is kept while someone wears it (freed a while after the last one goes).
  useEffect(() => {
    if (!b?.key) return
    const k = b.key
    useLook(k)
    return () => leaveLook(k)
  }, [b])
  if (!b?.skinned) return <>{props.fallback}</>
  return <RealBody {...props} b={b} l={l} young={young} />
}

function RealBody({ b, l, young, gender, pose = 'idle', seed = 0, headScale = 1, speed, take, clock, hold, faceId, gait, tier }: Props & { b: Built; l: Required<Look>; young: boolean; tier: Exclude<PersosTier, 'off'> }) {
  const femme = gender === 'femme'
  const cast = useCastShadows()
  const loo = pose === 'toilet'
  const { d } = b

  const root = useRef<THREE.Bone>(null)
  const head = useRef<THREE.Bone>(null)
  const chest = useRef<THREE.Bone>(null)
  const hang = useRef<THREE.Bone>(null)
  const ear = useRef<THREE.Bone>(null)
  const hip = [useRef<THREE.Bone>(null), useRef<THREE.Bone>(null)]
  const knee = [useRef<THREE.Bone>(null), useRef<THREE.Bone>(null)]
  const shoulder = [useRef<THREE.Bone>(null), useRef<THREE.Bone>(null)]
  const elbow = [useRef<THREE.Bone>(null), useRef<THREE.Bone>(null)]
  const hem = [useRef<THREE.Bone>(null), useRef<THREE.Bone>(null)]
  usePoseRig({ root, head, chest, hip, knee, shoulder, elbow }, pose, seed, speed, STYLE, take, clock, gait)

  // The skin: bound once to the bones (identity inverses: each segment is built in its joint's frame).
  const mesh = useRef<THREE.SkinnedMesh>(null)
  useLayoutEffect(() => {
    const m = mesh.current
    const bones = [chest, head, hang, ear, hip[0], knee[0], hip[1], knee[1], shoulder[0], elbow[0], shoulder[1], elbow[1], hem[0], hem[1]].map((r) => r.current!)
    if (!m || bones.some((x) => !x)) return
    const sk = new THREE.Skeleton(
      bones,
      bones.map(() => new THREE.Matrix4()),
    )
    m.bind(sk, new THREE.Matrix4())
    // The whole Sim whatever its pose, in the mesh's frame (computing it from the bones would be stale or costly).
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.3)
    m.visible = true
    return () => sk.dispose()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const body = useRef<THREE.Group>(null)
  const fall = useRef({ y: 0, v: 0, squash: 0 })
  const faceMat = faceMaterial(b, () => b.face ?? null, { kind: 'detail', look: l, femme, beard: young || headScale >= 1.2 ? 'none' : l.beard, shades: !young && hasAcc(l, 'sunglasses'), elder: headScale < 1.2 && l.hairColor === '#d8d2c8', real: true, hd: hdNow() })
  // The secondary motion (not on the small phones): the hair and the earrings follow the head late, on springs.
  const lag = useRef({ hx: 0, vx: 0, hz: 0, vz: 0, ex: 0, evx: 0, ez: 0, evz: 0, yaw: 0, pitch: 0, roll: 0 })
  // The long skirt below the knee (pagne, robe, boubou): its pitch in the body's frame as it swings, its sway.
  const cloth = useRef({ p: [0, 0], vp: [0, 0], z: [0, 0], vz: [0, 0], ready: false })
  const swing = tier !== 'simple'
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const r = root.current
    const bd = body.current
    if (r && bd && dt > 0) {
      const f = fall.current
      const v = (r.position.y - f.y) / dt
      if (f.v < -0.4 && v >= -0.05 && r.position.y < 0.03) f.squash = Math.min(1, -f.v / 2.5)
      f.y = r.position.y
      f.v = v
      f.squash *= Math.exp(-10 * dt)
      bd.scale.set(1 + f.squash * 0.06, 1 - f.squash * 0.12, 1 + f.squash * 0.06)
    }
    if (swing && dt > 0) {
      // The cloth under the knee lags behind the shin's swing (a spring on the shin's pitch), trails a
      // little behind as the Sim walks and sways from side to side with the steps. Two springs a leg.
      const c = cloth.current
      const fastC = pose === 'run' || isDance(pose) ? 1 : pose === 'walk' || pose === 'dribble' ? 0.6 : 0
      const tc = worldTime() + seed
      for (let i = 0; i < 2; i++) {
        const hb = hem[i].current
        const hp = hip[i].current
        const kn = knee[i].current
        if (!hb || !hp || !kn) continue
        const shinPitch = hp.rotation.x + kn.rotation.x
        if (!c.ready) c.p[i] = shinPitch
        const a = (shinPitch - c.p[i]) * 38 - c.vp[i] * 6.5
        c.vp[i] += a * dt
        c.p[i] += c.vp[i] * dt
        const za = (Math.sin(tc * (3 + fastC * 2.6) + i * Math.PI) * 0.05 * fastC - c.z[i]) * 30 - c.vz[i] * 5
        c.vz[i] += za * dt
        c.z[i] += c.vz[i] * dt
        hb.rotation.set(Math.max(-0.35, Math.min(0.35, c.p[i] - shinPitch + fastC * 0.07)), 0, (i ? 1 : -1) * Math.max(-0.12, Math.min(0.12, c.z[i])))
      }
      c.ready = true
    }
    const hd = head.current
    if (!swing || !hd || dt <= 0) return
    const g = lag.current
    // How fast the head turns, nods and tilts (and the body bobs): what the loose things lag behind.
    const yawV = (hd.rotation.y - g.yaw) / dt
    const pitchV = (hd.rotation.x - g.pitch) / dt
    const rollV = (hd.rotation.z - g.roll) / dt
    g.yaw = hd.rotation.y
    g.pitch = hd.rotation.x
    g.roll = hd.rotation.z
    const fast = pose === 'run' || isDance(pose) || pose === 'cheer' ? 1 : pose === 'walk' || pose === 'dribble' ? 0.5 : 0.12
    const t = worldTime() + seed
    const spring = (x: number, v: number, target: number, k = 60, c = 7): [number, number] => {
      const a = (target - x) * k - v * c
      const nv = v + a * dt
      return [x + nv * dt, nv]
    }
    // The hair: back with the walk's speed, swinging with the steps, and late on the head's turns.
    const hairX = fast * 0.1 + Math.sin(t * (2.2 + fast * 4)) * 0.07 * fast - pitchV * 0.05
    const hairZ = Math.sin(t * (1.7 + fast * 3) + 1) * 0.05 * fast - (rollV + yawV * 0.5) * 0.05
    ;[g.hx, g.vx] = spring(g.hx, g.vx, Math.max(-0.5, Math.min(0.5, hairX)), 45, 6)
    ;[g.hz, g.vz] = spring(g.hz, g.vz, Math.max(-0.4, Math.min(0.4, hairZ)), 45, 6)
    if (hang.current) hang.current.rotation.set(g.hx, 0, g.hz)
    // The earrings: little pendulums, quicker.
    const earX = -pitchV * 0.12 + Math.sin(t * 7.5) * 0.12 * fast
    const earZ = -rollV * 0.12 - yawV * 0.06
    ;[g.ex, g.evx] = spring(g.ex, g.evx, Math.max(-0.6, Math.min(0.6, earX)), 90, 5)
    ;[g.ez, g.evz] = spring(g.ez, g.evz, Math.max(-0.6, Math.min(0.6, earZ)), 90, 5)
    if (ear.current) ear.current.rotation.set(g.ex, 0, g.ez)
  })

  const sucette = !young && hasAcc(l, 'sucette') && !['film', 'toilet', 'brush', 'throw'].includes(pose) ? lollipop(accessoryColor(l, 'sucette')) : null
  return (
    <group scale={l.height * (femme ? 0.96 : 1)}>
      <group ref={body}>
        <bone ref={root}>
          <bone ref={chest} />
          <bone ref={head} position={[0, NECK_Y, 0]} scale={headScale}>
            <bone ref={hang} position={[0, HANG_Y, 0]} />
            <bone ref={ear} position={EAR_AT} />
            <FaceOverlay material={faceMat} size={H} pose={pose} seed={seed} faceId={faceId} head={head} lips />
          </bone>
          {[0, 1].map((i) => (
            <bone key={`l${i}`} ref={hip[i]} position={[(i ? 1 : -1) * d.hipX, HIP_Y, 0]}>
              <bone ref={knee[i]} position={[0, -THIGH, 0]}>
                <bone ref={hem[i]} />
              </bone>
            </bone>
          ))}
          {[0, 1].map((i) => (
            <bone key={`a${i}`} ref={shoulder[i]} position={[(i ? 1 : -1) * d.shX, SHOULDER_Y, 0]}>
              <bone ref={elbow[i]} position={[0, -UPPER_ARM, 0]}>
                {/* A lollipop in the right hand, when it is free */}
                {i === 1 && sucette && <mesh geometry={sucette.geo} material={sucette.material} position={[0, -FOREARM - 0.02, d.aw / 2 + 0.01]} castShadow={cast} />}
                {/* The travaillement: the wad of notes in the left hand */}
                {pose === 'throw' && i === 0 && (
                  <group position={[0, -FOREARM + 0.02, d.aw / 2 + 0.03]} rotation={[0.3, 0, 0]}>
                    <Wad />
                  </group>
                )}
                {/* Filming: the phone held up in the right hand, its screen lit */}
                {pose === 'film' && i === 1 && <FilmingPhone y={-FOREARM - 0.03} />}
                {/* On the toilets: the phone in the right hand, its screen up to the face */}
                {loo && i === 1 && (
                  <group position={[0, -FOREARM - 0.04, 0.03]} rotation={[0.9, 0, 0]}>
                    <FilmingPhone y={0} />
                  </group>
                )}
                {/* Brushing the teeth: the brush in the right hand, the glass of water in the left */}
                {pose === 'brush' && i === 1 && <Toothbrush y={-FOREARM - 0.02} />}
                {pose === 'brush' && i === 0 && <RinseGlass y={-FOREARM - 0.02} />}
                {hold && i === 1 && <group position={[0, -FOREARM - 0.04, 0]}>{hold}</group>}
              </bone>
            </bone>
          ))}
        </bone>
        <skinnedMesh ref={mesh} geometry={b.skinned} material={b.material} castShadow={cast} visible={false} frustumCulled />
      </group>
    </group>
  )
}
