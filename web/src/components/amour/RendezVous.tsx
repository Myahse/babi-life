import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Ear, Gift, Heart, Laugh, MessageCircleHeart, X } from 'lucide-react'
import type { ActionResult, Friend, Look, Sim } from '../../lib/types'
import { api, errorText } from '../../lib/api'
import { sceneDpr, weakDevice } from '../../lib/device'
import { sfx } from '../../lib/sfx'
import { randomLook } from '../../avatar/options'
import { setExpression, type Expression } from '../../avatar/expressions'
import type { Pose } from '../../avatar/Human'
import { Character } from '../../world3d/Character'
import { Box } from '../../world3d/props'
import { rng } from '../../world3d/themes'
import { SETS } from '../prologue/sets'
import type { Choice, DateKindId, DateScore, Reaction } from '../../game/amour'
import { CHOICE_LINES, DATE_KINDS, pickLine, react, reactLines } from '../../game/amourDates'
import { t, locale } from '../../lib/i18n'

// A date, played (the update « vie-amoureuse », backend sims/amour.go amourRdv): its own little scene, like
// the baptism's (components/Bapteme.tsx), drawn only while it plays (the street paused meanwhile). The set
// is the stories' (prologue SETS: the maquis under its bulbs, the lagoon in the golden hour, the rooftop
// over the mall); the two Sims are the game's own (Character: the detailed or realistic look when those
// updates are open). The partner comes up, they hug; four moments: the partner says something, the player
// answers (a mot doux, a joke, a gift if there's one in the bag, listening) and the partner's face answers
// (blush and heart eyes, a laugh, a pout), little hearts of blocks rising; then the tender moment (la bise,
// or sitting close by the water, the head leaning), and the selfie, frozen as a polaroid. The server scores
// the answers (never the phone). On a weak phone: the two Sims, a table, the light; no set, no shadows.

const ME = 'rdv-me'
const THEM = 'rdv-partner'

type Phase = 'arrive' | 'hug' | 'line' | 'answer' | 'react' | 'final' | 'pose' | 'photo'
type Spot = { x: number; z: number; rot: number; lean?: number }

/** Where the two stand (or sit) and what they do, by phase; the camera's place and what it looks at. */
type Stage = { me: Spot; them: Spot; mePose: Pose; themPose: Pose; cam: [number, number, number]; look: [number, number, number] }

const seated = (k: DateKindId) => k !== 'rdv-lagune'

function stageOf(kind: DateKindId, phase: Phase, beat: number, reaction: Reaction | null, choice: Choice | null): Stage {
  const sit = seated(kind)
  // At the table, face to face across it; by the water, side by side turned to each other.
  const me: Spot = sit ? { x: -0.62, z: 0, rot: Math.PI / 2 } : { x: -0.42, z: 0, rot: Math.PI / 2 - 0.35 }
  const them: Spot = sit ? { x: 0.62, z: 0, rot: -Math.PI / 2 } : { x: 0.42, z: 0, rot: -Math.PI / 2 + 0.35 }
  const headY = sit ? 1.15 : 1.5
  const base: Stage = { me, them, mePose: sit ? 'sit' : 'idle', themPose: sit ? 'sit' : 'talk', cam: [0, headY + 0.25, 2.7], look: [0, headY - 0.2, 0] }
  switch (phase) {
    case 'arrive':
      // The partner walks up from the side; the Sim waits, standing.
      return { ...base, me: { x: -0.3, z: 0.95, rot: Math.PI / 2 }, them: { x: 0.25, z: 0.95, rot: -Math.PI / 2 }, mePose: 'wave', themPose: 'walk', cam: [0.3, 1.6, 4.4], look: [0, 1.2, 0.9] }
    case 'hug':
      return { ...base, me: { x: -0.27, z: 0.95, rot: Math.PI / 2 }, them: { x: 0.27, z: 0.95, rot: -Math.PI / 2 }, mePose: 'hug', themPose: 'hug', cam: [1.0, 1.55, 3.0], look: [0, 1.35, 0.95] }
    case 'line':
      // Over the Sim's shoulder onto the partner talking.
      return { ...base, themPose: sit ? 'sit' : 'talk', cam: [-2.1, headY + 0.4, 1.5 + beat * 0.06], look: [them.x - 0.15, headY - 0.1, 0] }
    case 'answer':
      return { ...base, mePose: sit ? (choice === 'blague' ? 'sitlaugh' : 'sit') : choice === 'blague' ? 'laugh' : 'talk', cam: [2.1, headY + 0.4, 1.5], look: [me.x + 0.15, headY - 0.1, 0] }
    case 'react': {
      const pose: Pose = reaction === 'match' ? (sit ? 'sitclap' : 'heart') : reaction === 'fine' ? (sit ? 'sitlaugh' : 'laugh') : sit ? 'sit' : 'shrug'
      // Close on the partner's face: what they felt.
      return { ...base, themPose: pose, cam: [-1.5, headY + 0.25, 1.25], look: [them.x, headY - 0.02, 0] }
    }
    case 'final':
      return sit
        ? // Up from the table, close, la bise on the cheek.
          { ...base, me: { x: -0.24, z: 0.85, rot: Math.PI / 2 }, them: { x: 0.24, z: 0.85, rot: -Math.PI / 2 }, mePose: 'bise', themPose: 'bise', cam: [1.4, 1.6, 2.4], look: [0, 1.45, 0.85] }
        : // Sitting close by the water, the partner's head leaning on the Sim's shoulder, the sun before them.
          { ...base, me: { x: -0.24, z: 0.4, rot: Math.PI, lean: 0 }, them: { x: 0.24, z: 0.4, rot: Math.PI, lean: 0.16 }, mePose: 'sitground', themPose: 'sitground', cam: [0.2, 1.25, 2.6], look: [0, 0.6, 0] }
    case 'pose':
    case 'photo':
      // The selfie: side by side, turned to the phone held up before them.
      return { ...base, me: { x: -0.22, z: 0.9, rot: 0.12 }, them: { x: 0.22, z: 0.9, rot: -0.12, lean: 0.08 }, mePose: 'film', themPose: 'kiss', cam: [0, 1.62, 2.35], look: [0, 1.45, 0.9] }
  }
}

/* ---------- Hearts made of blocks ---------- */

// A heart drawn in cubes (seven wide), shared by all of them: one geometry, one material.
const HEART_CELLS: [number, number][] = [
  [-2, 2],
  [-1, 2],
  [1, 2],
  [2, 2],
  [-3, 1],
  [-2, 1],
  [-1, 1],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [-3, 0],
  [-2, 0],
  [-1, 0],
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [-2, -1],
  [-1, -1],
  [0, -1],
  [1, -1],
  [2, -1],
  [-1, -2],
  [0, -2],
  [1, -2],
  [0, -3],
]
const CUBE = 0.024
const heartGeo = (() => {
  const g = new THREE.BoxGeometry(CUBE * 0.92, CUBE * 0.92, CUBE * 0.92)
  const parts = HEART_CELLS.map(([x, y]) => g.clone().translate(x * CUBE, y * CUBE, 0))
  const pos: number[] = []
  const nor: number[] = []
  for (const p of parts) {
    const n = p.toNonIndexed()
    pos.push(...(n.getAttribute('position').array as Float32Array))
    nor.push(...(n.getAttribute('normal').array as Float32Array))
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return out
})()
const heartMats = ['#ff4d8d', '#ff7aa8', '#e8336d'].map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 }))

const POOL = 10
type HeartP = { on: boolean; t: number; x: number; y: number; z: number; vx: number; spin: number }
/** The hearts in flight: spawned by the moments, rising and swaying, shrinking away. No allocation per frame. */
const hearts: HeartP[] = Array.from({ length: POOL }, () => ({ on: false, t: 0, x: 0, y: 0, z: 0, vx: 0, spin: 0 }))
function spawnHearts(x: number, y: number, z: number, n: number) {
  let k = 0
  for (const h of hearts) {
    if (h.on || k >= n) continue
    Object.assign(h, { on: true, t: -k * 0.12, x: x + (Math.random() - 0.5) * 0.3, y, z: z + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 0.25, spin: (Math.random() - 0.5) * 2 })
    k++
  }
}

function Hearts() {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    hearts.forEach((h, i) => {
      const m = refs.current[i]
      if (!m) return
      if (!h.on) {
        m.visible = false
        return
      }
      h.t += d
      if (h.t < 0) {
        m.visible = false
        return
      }
      const life = 2.2
      if (h.t > life) {
        h.on = false
        m.visible = false
        return
      }
      m.visible = true
      const k = h.t / life
      m.position.set(h.x + h.vx * h.t + Math.sin(h.t * 3 + i) * 0.06, h.y + h.t * 0.45, h.z)
      m.rotation.y = Math.sin(h.t * 2) * 0.6 + h.spin * h.t
      // Pops in, floats, shrinks away (no transparency: cheap on a phone).
      const s = k < 0.15 ? k / 0.15 : 1 - Math.max(0, k - 0.6) / 0.4
      m.scale.setScalar(Math.max(0.001, s * (1 + Math.sin(h.t * 9) * 0.06)))
    })
  })
  return (
    <>
      {hearts.map((_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} geometry={heartGeo} material={heartMats[i % heartMats.length]} visible={false} />
      ))}
    </>
  )
}

/* ---------- The two of them ---------- */

/** Someone at a spot, gliding there (walking while far), the lean of their body to the other. */
function Actor({ spot, pose, look, gender, face, seed, onArrive }: { spot: Spot; pose: Pose; look: Look; gender: 'femme' | 'homme'; face: string; seed: number; /** Walking up to its spot: there. */ onArrive?: () => void }) {
  const g = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const [moving, setMoving] = useState(false)
  const first = useRef(true)
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    if (first.current) {
      first.current = false
      o.position.set(spot.x + (face === THEM && pose === 'walk' ? 1.6 : 0), 0, spot.z)
      o.rotation.y = spot.rot
    }
    const d = Math.min(dt, 0.2)
    const dx = spot.x - o.position.x
    const dz = spot.z - o.position.z
    const far = Math.hypot(dx, dz)
    // Walking speed up to the spot (1.1 m/s), then settled in smoothly.
    if (far > 0.002) {
      const step = Math.min(far, d * (far > 0.3 ? 1.1 : 1.6 * far + 0.15))
      o.position.x += (dx / far) * step
      o.position.z += (dz / far) * step
    }
    const want = far > 0.3 ? Math.atan2(dx, dz) : spot.rot
    let dr = want - o.rotation.y
    dr = Math.atan2(Math.sin(dr), Math.cos(dr))
    o.rotation.y += dr * (1 - Math.exp(-8 * d))
    if (inner.current) inner.current.rotation.z += ((spot.lean ?? 0) * (face === THEM ? 1 : -1) - inner.current.rotation.z) * (1 - Math.exp(-4 * d))
    const walking = far > 0.25
    if (walking !== moving) setMoving(walking)
    if (far < 0.06 && pose === 'walk') onArrive?.()
  })
  return (
    <group ref={g}>
      <group ref={inner}>
        <Character look={look} gender={gender} stage="adulte" pose={moving ? 'walk' : pose} marker={false} seed={seed} face={{ id: face }} speed={moving ? 1.1 : undefined} />
      </group>
    </group>
  )
}

/** The camera gliding to where the moment wants it (a punch-in on a reaction), never cutting. */
function CameraRig({ cam, look, punch }: { cam: [number, number, number]; look: [number, number, number]; punch: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  // Framed for a 4:3 picture: on a phone held upright, the same width kept in view (prologue/Shot3D.tsx's way).
  useEffect(() => {
    const base = 36
    camera.fov = aspect >= 4 / 3 ? base : (2 * Math.atan(Math.tan((base * Math.PI) / 360) * (4 / 3 / aspect)) * 180) / Math.PI
    camera.updateProjectionMatrix()
  }, [camera, aspect])
  const at = useRef(new THREE.Vector3(...cam))
  const aim = useRef(new THREE.Vector3(...look))
  const goal = useMemo(() => new THREE.Vector3(), [])
  const goalLook = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }, dt) => {
    const d = Math.min(dt, 0.05)
    goal.set(...cam)
    goalLook.set(...look)
    // A reaction: a little push towards the face for a beat (the « hit-stop » of a tender moment).
    const since = clock.elapsedTime - punch
    const k = punch > 0 && since < 0.9 ? Math.sin(Math.min(1, since / 0.9) * Math.PI) * 0.18 : 0
    if (k) goal.lerp(goalLook, k)
    at.current.lerp(goal, 1 - Math.exp(-2.4 * d))
    aim.current.lerp(goalLook, 1 - Math.exp(-3 * d))
    // A breath of handheld sway, so it's never still.
    const tt = clock.elapsedTime
    camera.position.set(at.current.x + Math.sin(tt * 0.5) * 0.03, at.current.y + Math.sin(tt * 0.7) * 0.02, at.current.z)
    camera.lookAt(aim.current)
  })
  return null
}

/** The set, its own clock (the bulbs, the water) at a few frames a second: the cast isn't redrawn with it. */
function LiveSet({ set, mood }: { set: string; mood: string }) {
  const Set = SETS[set]
  const [t, setT] = useState(0)
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current > 0.2) {
      last.current = clock.elapsedTime
      setT(clock.elapsedTime)
    }
  })
  return Set ? <Set t={t} mood={mood} /> : null
}

/** A weak phone's set: the light, the ground, the sky's colour. */
function SimpleSet({ kind }: { kind: DateKindId }) {
  const sky = kind === 'rdv-lagune' ? '#f5a565' : kind === 'rdv-maquis' ? '#2a1d4f' : '#f59a62'
  return (
    <>
      <color attach="background" args={[sky]} />
      <hemisphereLight args={['#fff1d6', '#8a5a3a', 1.3]} />
      <directionalLight position={[-3, 4, 4]} intensity={1.4} color="#ffd8a8" />
      <Box p={[0, -0.05, 0]} s={[8, 0.1, 6]} c={kind === 'rdv-lagune' ? '#c8945f' : '#7d6a5a'} />
      {kind === 'rdv-lagune' && <Box p={[0, -0.03, -5]} s={[20, 0.06, 6]} c="#c9744a" />}
    </>
  )
}

/** The table for two (the maquis, the mall's terrace): its cloth, the plates or the cups, the two chairs. */
function TableForTwo({ kind }: { kind: DateKindId }) {
  const cloth = kind === 'rdv-maquis' ? '#e03131' : '#f8f9fa'
  return (
    <group>
      <Box p={[0, 0.72, 0]} s={[0.78, 0.05, 0.62]} c={cloth} />
      <Box p={[0, 0.36, 0]} s={[0.08, 0.72, 0.08]} c="#5c4a3a" />
      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box p={[0, 0.42, 0]} s={[0.46, 0.06, 0.46]} c={kind === 'rdv-maquis' ? '#1c7ed6' : '#ffd43b'} />
          <Box p={[x < 0 ? -0.22 : 0.22, 0.72, 0]} s={[0.05, 0.6, 0.46]} c={kind === 'rdv-maquis' ? '#1c7ed6' : '#ffd43b'} />
          {[-0.18, 0.18].map((z) => (
            <Box key={z} p={[0, 0.2, z]} s={[0.05, 0.4, 0.05]} c="#3d2b1f" />
          ))}
        </group>
      ))}
      {kind === 'rdv-maquis' ? (
        <>
          {/* The attiéké and the fish, a bottle each */}
          {[-0.2, 0.2].map((x) => (
            <group key={x}>
              <Box p={[x, 0.76, 0]} s={[0.2, 0.02, 0.2]} c="#f1f3f5" />
              <Box p={[x, 0.785, 0]} s={[0.12, 0.03, 0.1]} c="#fff3bf" />
              <Box p={[x * 1.2, 0.86, 0.2]} s={[0.05, 0.18, 0.05]} c="#2b8a3e" />
            </group>
          ))}
          {/* A candle in a jar */}
          <Box p={[0, 0.8, -0.2]} s={[0.06, 0.08, 0.06]} c="#ffe066" glow={1.2} />
        </>
      ) : (
        [-0.18, 0.18].map((x, i) => (
          <group key={x}>
            <Box p={[x, 0.79, 0]} s={[0.1, 0.09, 0.1]} c="#f8f9fa" />
            <Box p={[x, 0.86, 0]} s={[0.08, 0.06, 0.08]} c={i ? '#7a4a2a' : '#ffd8a8'} />
            <Box p={[x, 0.9, 0]} s={[0.05, 0.04, 0.05]} c={i ? '#ff8fab' : '#fff'} />
          </group>
        ))
      )}
    </group>
  )
}

/* ---------- The moment ---------- */

const CHOICE_ICON = { mot: MessageCircleHeart, blague: Laugh, cadeau: Gift, ecouter: Ear }
const CHOICE_LABEL: Record<Choice, () => string> = { mot: () => t('Mot doux'), blague: () => t('Blague'), cadeau: () => t('Cadeau'), ecouter: () => t('Écouter') }
const REACT_FACE: Record<Reaction, Expression> = { match: 'love', fine: 'laugh', wrong: 'annoyed' }
const ANSWER_FACE: Record<Choice, Expression> = { mot: 'shy', blague: 'grin', cadeau: 'smile', ecouter: 'smile' }

export function RendezVous({ sim, partner, kind, gift = false, onResult, onEnd }: { sim: Sim; partner: Friend; kind: DateKindId; /** A gift in the bag (phase 2): the « Cadeau » answer shows. */ gift?: boolean; onResult: (r: ActionResult) => void; onEnd: () => void }) {
  const k = DATE_KINDS[kind]
  const look = useMemo(() => partner.look ?? randomLook(partner.gender, rng(`partner${partner.id}`)), [partner.id, partner.gender, partner.look])
  const seed = useMemo(() => (sim.activity?.start ?? 0) + partner.seed, [sim.activity?.start, partner.seed])
  const [phase, setPhase] = useState<Phase>('arrive')
  const [beat, setBeat] = useState(0)
  const [choices, setChoices] = useState<Choice[]>([])
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [score, setScore] = useState<DateScore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [punch, setPunch] = useState(0)
  const clock = useRef<THREE.Clock | null>(null)
  const sent = useRef(false)
  // The moment's timers, cleared if it's closed halfway.
  const timers = useRef<number[]>([])
  const later = (f: () => void, ms: number) => void timers.current.push(window.setTimeout(f, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const choice = choices[beat] ?? null
  const st = stageOf(kind, phase, beat, reaction, choice)
  const sit = seated(kind)

  // The arrival: the partner walks up; there (or after a while on a slow phone), they hug, faces lit; the soft music cue.
  const hugged = useRef(false)
  const hug = () => {
    if (hugged.current) return
    hugged.current = true
    setPhase('hug')
    setExpression(ME, 'love', 2600)
    setExpression(THEM, 'love', 2600)
    spawnHearts(0, 1.85, 0.95, 3)
    sfx.love('fine')
    later(() => setPhase('line'), 2700)
  }
  useEffect(() => {
    sfx.serenade(1.2)
    later(hug, 4000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (c: Choice) => {
    if (phase !== 'line') return
    const next = [...choices]
    next[beat] = c
    setChoices(next)
    setPhase('answer')
    setExpression(ME, ANSWER_FACE[c], 1400)
    // A beat later, the partner's face answers: the server's rule, read on the phone at once.
    later(() => {
      const r = react(k.beats[beat], c, partner.lang)
      setReaction(r)
      setPhase('react')
      setExpression(THEM, REACT_FACE[r], 2400)
      setPunch(clock.current?.getElapsedTime() ?? 0)
      sfx.love(r)
      if (r === 'match') spawnHearts(0.62 * (sit ? 1 : 0.7), sit ? 1.5 : 1.9, 0, 5)
      else if (r === 'fine') spawnHearts(0.5, sit ? 1.5 : 1.9, 0, 1)
      if (navigator.vibrate) navigator.vibrate(r === 'match' ? [12, 40, 12] : 10)
    }, 1100)
    later(() => {
      setReaction(null)
      if (beat + 1 < k.beats.length) {
        setBeat(beat + 1)
        setPhase('line')
      } else finish(next)
    }, 3500)
  }

  // The four answered: the server scores them; meanwhile, the tender moment, then the selfie.
  const finish = (all: Choice[]) => {
    setPhase('final')
    setExpression(ME, 'kiss', 2600)
    setExpression(THEM, sit ? 'kiss' : 'calm', 2600)
    later(() => (sfx.smack(), spawnHearts(0, sit ? 1.75 : 1.0, sit ? 0.85 : 0.4, 6)), sit ? 900 : 600)
    if (!sent.current) {
      sent.current = true
      api
        .amourRdv(sim.id, all)
        .then((r) => (setScore(r.data), onResult(r)))
        .catch((e) => setError(errorText(e, t('Le rendez-vous n’a pas pu se finir'))))
    }
    later(() => {
      setPhase('pose')
      setExpression(ME, 'grin', 3000)
      setExpression(THEM, 'love', 3000)
    }, 4200)
    later(() => {
      sfx.shutter()
      setFlash(true)
      setPhase('photo')
      later(() => setFlash(false), 180)
    }, 5600)
  }

  const line = phase === 'line' || phase === 'answer' || phase === 'react' ? pickLine(k.beats[beat].lines(), seed + beat) : null
  const myLine = (phase === 'answer' || phase === 'react') && choice ? pickLine(CHOICE_LINES[choice](), seed + beat * 3) : null
  const theirAnswer = phase === 'react' && reaction ? pickLine(reactLines(reaction, choice ?? 'mot'), seed + beat * 7) : null
  const when = new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long' })
  const options = (['mot', 'blague', 'cadeau', 'ecouter'] as Choice[]).filter((c) => c !== 'cadeau' || gift)

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#2a1d3f]" data-rdv={kind} data-phase={phase}>
      <div className="relative min-h-0 flex-1">
        <Canvas
          dpr={(globalThis as { __video?: { dpr: number } }).__video?.dpr ?? (weakDevice ? 1 : sceneDpr)}
          shadows={!weakDevice}
          frameloop={phase === 'photo' && !flash ? 'never' : 'always'}
          camera={{ fov: 42, position: st.cam }}
          gl={{ antialias: !weakDevice, powerPreference: weakDevice ? 'low-power' : 'default' }}
          onCreated={(s) => (clock.current = s.clock)}
        >
          {weakDevice ? <SimpleSet kind={kind} /> : <LiveSet set={k.set} mood={k.mood} />}
          {sit && (
            <group position={[0, 0, 0]}>
              <TableForTwo kind={kind} />
            </group>
          )}
          <Actor spot={st.me} pose={st.mePose} look={sim.look as Look} gender={sim.gender} face={ME} seed={3} />
          <Actor spot={st.them} pose={st.themPose} look={look} gender={partner.gender} face={THEM} seed={partner.seed} onArrive={hug} />
          <Hearts />
          <CameraRig cam={st.cam} look={st.look} punch={punch} />
        </Canvas>
        {/* The place, and leaving */}
        <div className="pointer-events-none absolute inset-x-0 top-[max(0.8rem,var(--sat,env(safe-area-inset-top)))] flex items-center justify-center gap-2 px-14 text-center">
          <span className="rounded-full bg-black/45 px-4 py-1.5 text-[12px] font-extrabold tracking-wider text-white uppercase">
            <Heart size={12} className="mr-1 inline fill-[#ff4d8d] text-[#ff4d8d]" />
            {k.label()} · {partner.name}
          </span>
        </div>
        {phase !== 'photo' && (
          <button className="absolute top-[max(0.6rem,var(--sat,env(safe-area-inset-top)))] right-3 rounded-full bg-black/40 p-2 text-white" onClick={onEnd} aria-label={t('Fermer')}>
            <X size={18} />
          </button>
        )}
        {/* The moment's beats: four little hearts */}
        {phase !== 'photo' && phase !== 'arrive' && phase !== 'hug' && (
          <div className="pointer-events-none absolute inset-x-0 top-[calc(max(0.8rem,var(--sat,env(safe-area-inset-top)))+2.4rem)] flex justify-center gap-1.5">
            {k.beats.map((_, i) => (
              <Heart key={i} size={14} className={i < beat || (i === beat && phase !== 'line') ? 'fill-[#ff4d8d] text-[#ff4d8d]' : 'text-white/60'} />
            ))}
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white" />}
        {/* The selfie, frozen as a polaroid */}
        {phase === 'photo' && !flash && (
          <div className="animate-pop absolute inset-0 flex items-center justify-center p-6" data-selfie>
            <div className="pointer-events-none absolute top-1/2 left-1/2 aspect-[4/5] w-[min(78vw,360px)] -translate-x-1/2 -translate-y-[58%] -rotate-2 rounded-[6px] border-[12px] border-b-[78px] border-white shadow-[0_0_0_100vmax_rgba(20,10,30,0.55),0_18px_40px_rgba(0,0,0,0.5)]" />
            <div className="pointer-events-none absolute top-1/2 left-1/2 w-[min(78vw,360px)] -translate-x-1/2 translate-y-[calc(min(78vw,360px)*0.525-68px)] -rotate-2 px-4 text-center">
              <div className="font-display text-[16px] leading-tight font-extrabold text-[#c2255c]">{k.title()}</div>
              <div className="text-[12px] font-bold text-[#868e96]">
                {partner.name} · {when}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="min-h-[214px] bg-white px-4 pt-3 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))]">
        {(phase === 'arrive' || phase === 'hug') && (
          <p key={phase} className="animate-pop text-[16px] leading-snug font-extrabold text-[var(--color-ink)]">
            <span className="text-[#c2255c]">{partner.name} :</span> {phase === 'arrive' ? t('Mon cœur ! Tu es là !') : t('Viens là, toi… Tu m’as manqué.')}
          </p>
        )}
        {line && (
          <div className="space-y-2">
            <p key={`l${beat}`} className="animate-pop rounded-2xl rounded-tl-none bg-[#fff0f6] px-3 py-2 text-[15px] leading-snug font-bold text-[var(--color-ink)]">
              <span className="text-[#c2255c]">{partner.name} :</span> {line}
            </p>
            {myLine && (
              <p key={`m${beat}`} className="animate-pop ml-auto w-fit max-w-[88%] rounded-2xl rounded-tr-none bg-[#e7f5ff] px-3 py-2 text-right text-[15px] leading-snug font-bold text-[var(--color-ink)]">
                {myLine}
              </p>
            )}
            {theirAnswer && (
              <p key={`r${beat}`} className={`animate-pop w-fit rounded-2xl rounded-tl-none px-3 py-2 text-[15px] leading-snug font-extrabold ${reaction === 'match' ? 'bg-[#ffdeeb] text-[#a61e4d]' : reaction === 'fine' ? 'bg-[#fff3bf] text-[#7a5a00]' : 'bg-[#f1f3f5] text-[#495057]'}`}>
                {theirAnswer}
              </p>
            )}
          </div>
        )}
        {phase === 'line' && (
          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={t('Ta réponse')}>
            {options.map((c) => {
              const Icon = CHOICE_ICON[c]
              return (
                <button key={c} className="btn !min-h-[52px] !justify-start gap-2 !rounded-2xl !text-[15px]" style={{ background: c === 'mot' ? '#e64980' : c === 'blague' ? '#f59f00' : c === 'cadeau' ? '#7048e8' : '#1c7ed6' }} onClick={() => answer(c)} data-choice={c}>
                  <Icon size={20} /> {CHOICE_LABEL[c]()}
                </button>
              )
            })}
          </div>
        )}
        {(phase === 'final' || phase === 'pose') && <p className="animate-pop text-[16px] leading-snug font-extrabold text-[var(--color-ink)]">{sit ? t('Une bise, tout doucement…') : t('Assis·es tout près, sa tête sur ton épaule, le soleil se couche.')}</p>}
        {phase === 'photo' && (
          <div className="animate-pop">
            {error ? (
              <p className="text-[14px] font-bold text-[var(--color-red,#c92a2a)]">{error}</p>
            ) : score ? (
              <p className="flex items-center gap-2 text-[16px] leading-snug font-extrabold text-[var(--color-ink)]">
                <Heart size={20} className="shrink-0 fill-[#ff4d8d] text-[#ff4d8d]" />
                {t('+{n} d’amour avec {name}', { n: score.love, name: partner.name })}
              </p>
            ) : (
              <p className="text-[14px] font-bold text-[var(--color-ink-soft)]">{t('…')}</p>
            )}
            <button className="btn mt-3 w-full" style={{ background: '#e64980' }} onClick={onEnd} data-rdv-done>
              {t('Garder ce souvenir')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
