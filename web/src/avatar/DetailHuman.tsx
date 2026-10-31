import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { accessoryColor, fullLook, hasAcc } from './options'
import { tint } from './textures'
import { fidgetAt, useCastShadows, usePoseRig, type Pose, type RigStyle } from './Human'
import { FilmingPhone, RinseGlass, Toothbrush } from './BlockHuman'
import { worldTime } from '../lib/worldClock'
import { Wad } from '../world3d/money'
import { TX } from './detail/atlas'
import { BABY_OUTFIT_IDS, H, NECK_Y, SHOULDER_Y, build, buildBaby, builtLook, lollipop, mayBuild, type Built } from './detail/build'
import { LowHuman } from './LowHuman'
import { FOREARM, HIP_Y, THIGH, UPPER_ARM } from './detail/outfits'

// « Les persos plus détaillés » (the update « sims-detailles »): the same
// blocky Sim as BlockHuman (the same proportions, joints, poses and looks),
// with more to it: a 16-texel face (eyes with whites, iris and catchlight,
// lids, brows, the nose's shading, two-tone lips), ears and a thumb as little
// blocks, shoes with a sole, cuffs, collars, belts and buckles, pockets, the
// pagne's knot and folds, hair in layered blocks, and a bevel and ambient
// occlusion baked into every box. Every box of a body segment is merged into
// one mesh over one atlas per look (detail/build.ts), cached and shared by
// every Sim dressed the same: about ten draw calls a Sim, fewer than
// BlockHuman's (each lock, cap and earring of which is a mesh of its own).

type Props = { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; /** Children have bigger heads for their size (1 = adult). */ headScale?: number; /** Walking speed (m/s): the steps follow it. */ speed?: number; /** A count: when it changes, the pose starts over. */ take?: number; /** The seconds into the pose, kept by something else. */ clock?: () => number; /** The look is already fitted to the Sim's age (options lookAt): a child's own accessories show. */ fitted?: boolean; /** Something in the right hand (the games' mic, the ball before the shot), at the fist. */ hold?: React.ReactNode }

const STYLE: RigStyle = { snap: 1.1, swing: 1, elbow: 1, knee: 1, headBob: 0.4 }

const flat = new Map<string, THREE.Material>()
const flatMat = (c: string) => {
  let m = flat.get(c)
  if (!m) flat.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}
const LID = new THREE.BoxGeometry(4 * TX, 2 * TX, 0.004)
const MOUTH = new THREE.BoxGeometry(5 * TX, 2 * TX, 0.004)

/** How many boxes, meshes and triangles one look costs (the lab's counter). */
export function detailCost(look: Look, gender: Sim['gender'], headScale = 1) {
  const b = build(fullLook(look), { femme: gender === 'femme', young: headScale > 1, child: headScale >= 1.2 })
  return { boxes: b.boxes, meshes: Object.keys(b.geos).length, tris: b.tris, atlas: b.atlas }
}

export function DetailHuman(props: Props & { /** Built at once, whatever it costs (the creator, the pictures). */ full?: boolean }) {
  const { look, gender, pose = 'idle', headScale = 1, fitted, full } = props
  // A child seen in the street wears nothing on top of its clothes; a player's child wears what fits its age.
  const young = headScale > 1 && !fitted
  const child = headScale >= 1.2
  const l = fullLook(look)
  const femme = gender === 'femme'
  const loo = pose === 'toilet'
  const lookKey = JSON.stringify(l)
  // A new look is built when the frame has time for it (build.ts mayBuild): meanwhile, the far figure.
  const [tries, retry] = useState(0)
  const b = useMemo(() => {
    const o = { femme, young, child, loo }
    return builtLook(l, o) ?? (full || mayBuild() ? build(l, o) : null)
  }, [lookKey, femme, young, child, loo, full, tries]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (b) return
    const id = requestAnimationFrame(() => retry((n) => n + 1))
    return () => cancelAnimationFrame(id)
  }, [b, tries])
  if (!b) return <LowHuman look={look} gender={gender} pose={pose} seed={props.seed} speed={props.speed} />
  return <DetailBody {...props} b={b} l={l} young={young} />
}

function DetailBody({ b, l, young, gender, pose = 'idle', seed = 0, headScale = 1, speed, take, clock, hold }: Props & { b: Built; l: Required<Look>; young: boolean }) {
  const femme = gender === 'femme'
  const cast = useCastShadows()
  const loo = pose === 'toilet'
  const { d } = b
  const m = b.material

  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const chest = useRef<THREE.Group>(null)
  const hip = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const knee = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const shoulder = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const elbow = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  usePoseRig({ root, head, chest, hip, knee, shoulder, elbow }, pose, seed, speed, STYLE, take, clock)

  // A squash when landing from a jump (cheering, dancing), and back; blinking, the mouth talking, loose hair swaying.
  const body = useRef<THREE.Group>(null)
  const fall = useRef({ y: 0, v: 0, squash: 0 })
  const lids = useRef<THREE.Group>(null)
  const mouth = useRef<THREE.Mesh>(null)
  const sway = useRef<THREE.Group>(null)
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
    const t = worldTime() + seed * 7.3
    const period = 3.2 + (Math.abs(seed) % 3)
    const k = (t % period) / period
    // Asleep (or praying, eyes down): the eyes stay shut.
    const shut = pose === 'sleep' || pose === 'pray' ? 1 : k > 0.955 ? Math.sin(((k - 0.955) / 0.045) * Math.PI) : 0
    if (lids.current) {
      lids.current.visible = shut > 0.05
      for (const c of lids.current.children) c.scale.y = Math.max(0.01, shut)
    }
    const talk = pose === 'talk' || pose === 'rant' || pose === 'cheer' || pose === 'phone'
    // A yawn with the stretch (the same clock as the arms: fidgetAt).
    const fid = pose === 'idle' ? fidgetAt(worldTime() + seed, seed) : null
    const yawn = fid?.kind === 'stretch' ? fid.e * 1.8 : 0
    const open = Math.max(yawn, talk ? Math.max(0, Math.sin(t * 9 + seed)) * (pose === 'cheer' ? 1.6 : pose === 'phone' ? 0.8 : 1) : 0)
    if (mouth.current) {
      mouth.current.visible = open > 0.08
      mouth.current.scale.y = Math.max(0.01, open)
    }
    const g = sway.current
    if (g) {
      const s = pose === 'run' || pose === 'dance' || pose === 'cheer' ? 1 : pose === 'walk' || pose === 'dribble' ? 0.5 : 0.18
      const tt = worldTime() + seed
      g.rotation.x = Math.sin(tt * (2.2 + s * 4)) * 0.08 * s + s * 0.05
      g.rotation.z = Math.sin(tt * (1.7 + s * 3) + 1) * 0.05 * s
    }
  })

  const seg = (name: string) => b.geos[name] && <mesh geometry={b.geos[name]} material={m} castShadow={cast} />
  const sucette = !young && hasAcc(l, 'sucette') && !['film', 'toilet', 'brush', 'throw'].includes(pose) ? lollipop(accessoryColor(l, 'sucette')) : null
  return (
    <group scale={l.height * (femme ? 0.96 : 1)}>
      <group ref={body}>
        <group ref={root}>
          <group ref={chest}>{seg('chest')}</group>
          <group ref={head} position={[0, NECK_Y, 0]} scale={headScale}>
            {seg('head')}
            {b.loose && (
              <group ref={sway} position={[0, H * 0.62, 0]}>
                <group position={[0, -H * 0.62, 0]}>{seg('hang')}</group>
              </group>
            )}
            <group ref={lids} position={[0, H - 8 * TX, H / 2 + 0.003]} visible={false}>
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={LID} material={flatMat(tint(l.skin, -0.08))} position={[s * 3 * TX, 0, 0]} />
              ))}
            </group>
            <mesh ref={mouth} geometry={MOUTH} material={flatMat('#3b1612')} position={[0, H - 13 * TX, H / 2 + 0.003]} visible={false} />
          </group>
          {[0, 1].map((i) => (
            <group key={`l${i}`} ref={hip[i]} position={[(i ? 1 : -1) * d.hipX, HIP_Y, 0]}>
              {seg(`thigh${i}`)}
              <group ref={knee[i]} position={[0, -THIGH, 0]}>
                {seg(`shin${i}`)}
              </group>
            </group>
          ))}
          {[0, 1].map((i) => (
            <group key={`a${i}`} ref={shoulder[i]} position={[(i ? 1 : -1) * d.shX, SHOULDER_Y, 0]}>
              {seg(`upper${i}`)}
              <group ref={elbow[i]} position={[0, -UPPER_ARM, 0]}>
                {seg(`fore${i}`)}
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
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

/* ---------- A baby ---------- */

const BABY_COLORS = ['#bde0fe', '#ffc8dd', '#cdeac0', '#fff1a8', '#e2cfea']

/**
 * A baby in detailed blocks: the same shape and moves as BlockBaby (sits and
 * babbles when still, crawls when it moves, toddles its first steps, claps
 * when busy), the grown-up's detailed face at its size; a player's baby
 * (`fitted`) wears what was picked for it.
 */
export function DetailBaby({ look, gender, pose = 'idle', seed = 0, fitted }: Props) {
  const full = fullLook(look)
  const own = fitted && BABY_OUTFIT_IDS.has(full.outfit) ? full.outfit : null
  const hairdo = fitted && (full.hair === 'touffe' || full.hair === 'puffs') ? full.hair : null
  const fresh = own ? full.outfitColor : (BABY_COLORS[Math.abs(Math.round(seed * 7)) % BABY_COLORS.length] ?? '#bde0fe')
  const accs = fitted ? ['tetine', 'bavoir', 'bonnet-bebe', 'hochet'].filter((id) => hasAcc(full, id)) : []
  const cast = useCastShadows()
  const key = JSON.stringify([full, gender, fresh, own, hairdo, accs])
  const b = useMemo(() => buildBaby(full, gender === 'femme', fresh, own, hairdo, accs), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  useFrame(() => {
    const t = worldTime() + seed
    const crawl = pose === 'walk'
    const asleep = pose === 'sleep'
    // Its first steps (the défi « premiers pas »): up on its legs, toddling.
    const toddle = pose === 'stumble'
    root.current!.rotation.x = crawl ? 1.05 : 0
    root.current!.position.y = crawl ? 0.17 + Math.abs(Math.sin(t * 6)) * 0.01 : toddle ? 0.2 + Math.abs(Math.sin(t * 7)) * 0.012 : pose === 'cheer' ? Math.abs(Math.sin(t * 10)) * 0.03 : 0
    root.current!.position.z = crawl ? -0.12 : 0
    root.current!.scale.y = asleep ? 1 + Math.sin(t * 2.2) * 0.015 : 1
    head.current!.rotation.x = crawl ? -0.9 : asleep ? 0 : Math.sin(t * 1.3) * 0.08
    head.current!.rotation.z = crawl || asleep ? 0 : Math.sin(t * 0.9) * 0.1
    for (const i of [0, 1]) {
      const out = i === 0 ? -1 : 1
      const a = arms[i].current!
      const g = legs[i].current!
      if (asleep) {
        a.rotation.set(-0.15, 0, out * 0.35)
        g.rotation.set(-0.1, 0, out * 0.12)
      } else if (crawl) {
        const step = Math.sin(t * 6 + i * Math.PI)
        a.rotation.set(-1.25 + step * 0.35, 0, 0)
        g.rotation.set(-0.25 - step * 0.3, 0, 0)
      } else if (toddle) {
        a.rotation.set(-1.35 + Math.sin(t * 7 + i) * 0.12, 0, out * 0.55)
        g.rotation.set(Math.sin(t * 7 + i * Math.PI) * 0.35, 0, out * 0.06)
      } else if (pose === 'cheer') {
        a.rotation.set(-2.5 + Math.sin(t * 12 + i) * 0.25, 0, out * 0.45)
        g.rotation.set(-1.45 + Math.sin(t * 10 + i) * 0.15, 0, out * 0.3)
      } else if (pose === 'busy') {
        a.rotation.set(-1.2, 0, -out * (0.45 + Math.max(0, Math.sin(t * 9)) * 0.35))
        g.rotation.set(-1.45, 0, out * 0.25)
      } else {
        a.rotation.set(-0.5 + Math.sin(t * 2 + i * 2) * 0.35, 0, out * 0.25)
        g.rotation.set(-1.45, 0, out * 0.3)
      }
    }
  })
  const seg = (name: string) => b.geos[name] && <mesh geometry={b.geos[name]} material={b.material} castShadow={cast} />
  return (
    <group ref={root}>
      {seg('body')}
      {[0, 1].map((i) => (
        <group key={`l${i}`} ref={legs[i]} position={[(i ? 1 : -1) * 0.055, 0.1, 0]}>
          {seg(`leg${i}`)}
        </group>
      ))}
      {[0, 1].map((i) => (
        <group key={`a${i}`} ref={arms[i]} position={[(i ? 1 : -1) * 0.13, 0.33, 0]}>
          {seg(`arm${i}`)}
        </group>
      ))}
      <group ref={head} position={[0, 0.35, 0.01]}>
        {seg('head')}
      </group>
    </group>
  )
}
