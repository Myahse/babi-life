import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage } from '../Shell'
import type { Decor, EngineProps, Item, PropId } from '../types'
import { t as tr } from '../../../../lib/i18n'

// The photo (the zoo, the planes at the airport, the museum's artworks, made for every action): the
// subjects go by on the decor, near and far; one is asked (« Le lion ! »): shoot when it's in the
// viewfinder, the better centred the better. A flash for each shot.

/** Those that fly: they go by high. */
const FLY = new Set<PropId>(['avion', 'oiseau', 'papillon', 'perroquet', 'nuage', 'ballon-fete', 'etoile', 'bulle'])
/** Those that go head first (the others face the lens as they slide by: a painting, a statue). */
const AHEAD = new Set<PropId>(['lion', 'girafe', 'elephant', 'singe', 'perroquet', 'crocodile', 'tortue', 'oiseau', 'papillon', 'avion', 'poisson-vivant', 'crabe', 'kart', 'velo', 'pirogue'])
const INDOORS = new Set<Decor>(['parquet', 'carrelage', 'bureau', 'scene', 'table', 'comptoir', 'etagere'])
const DEPTHS = [-2.4, -0.7, 1.1]
/** The viewfinder's half size, in screen terms (-1..1). */
const FRAME = 0.4
const CAM: [number, number, number] = [0, 2.2, 8.2]

type Walker = { key: number; item: Item; x: number; z: number; y: number; dir: number; v: number; ph: number; shot?: number }
type St = { t: number; key: number; walkers: Walker[]; next: number; flash: number; frame: { c: string; at: number }; good: number; quality: number; wrong: number; blank: number; done: boolean }

/** A subject going by: walking with a little hop (or flying, bobbing); shot, it jumps and hurries off. */
function WalkerMesh({ w, st }: { w: Walker; st: { current: St } }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const o = g.current
    if (!o) return
    const t = st.current.t
    const hop = FLY.has(w.item.prop) ? Math.sin(t * 2 + w.ph) * 0.15 : Math.abs(Math.sin(t * 5 + w.ph)) * 0.08
    const jump = w.shot !== undefined ? Math.sin(Math.min(1, (t - w.shot) / 0.4) * Math.PI) * 0.6 : 0
    o.position.set(w.x, w.y + hop + jump, w.z)
    o.rotation.y = AHEAD.has(w.item.prop) ? (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.sin(t * 1.5 + w.ph) * 0.25
  })
  return (
    <group ref={g} position={[w.x, w.y, w.z]}>
      <group scale={1.7}>
        <Prop id={w.item.prop} />
      </group>
    </group>
  )
}

/** The subjects on the scene: re-listed only when one comes or goes. */
function Walkers({ st }: { st: { current: St } }) {
  const [list, setList] = useState<Walker[]>([])
  const sig = useRef('')
  useFrame(() => {
    const k = st.current.walkers.map((w) => w.key).join(',')
    if (k !== sig.current) {
      sig.current = k
      setList([...st.current.walkers])
    }
  })
  return (
    <>
      {list.map((w) => (
        <WalkerMesh key={w.key} w={w} st={st} />
      ))}
    </>
  )
}

/** The viewfinder, held before the lens: four corners and a cross in thin blocks (green on a good shot, red on a miss), and the flash. */
function Viewfinder({ st }: { st: { current: St } }) {
  const { camera, viewport } = useThree()
  const g = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const veil = useRef<THREE.Mesh>(null)
  const mats = useRef<THREE.MeshBasicMaterial[]>([])
  const D = 3
  const v = viewport.getCurrentViewport(camera, camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(D)))
  const fw = (v.width / 2) * FRAME
  const fh = (v.height / 2) * FRAME
  const arm = Math.min(fw, fh) * 0.45
  const th = Math.min(fw, fh) * 0.06
  useFrame(() => {
    const s = st.current
    const o = g.current
    if (!o) return
    o.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(D))
    o.quaternion.copy(camera.quaternion)
    const k = Math.max(0, 1 - (s.t - s.flash) / 0.35)
    if (light.current) light.current.intensity = k * 60
    const vm = veil.current?.material as THREE.MeshBasicMaterial | undefined
    if (vm) vm.opacity = k * 0.75
    if (veil.current) veil.current.visible = k > 0
    const f = Math.max(0, 1 - (s.t - s.frame.at) / 0.6)
    for (const m of mats.current) m.color.set('#ffffff').lerp(new THREE.Color(s.frame.c), f)
  })
  const corner = (sx: number, sy: number) => (
    <group key={`${sx}${sy}`} position={[sx * fw, sy * fh, 0]}>
      <mesh position={[-sx * arm / 2, 0, 0]}>
        <boxGeometry args={[arm, th, th]} />
        <meshBasicMaterial ref={(m) => void (m && !mats.current.includes(m) && mats.current.push(m))} color="#ffffff" />
      </mesh>
      <mesh position={[0, -sy * arm / 2, 0]}>
        <boxGeometry args={[th, arm, th]} />
        <meshBasicMaterial ref={(m) => void (m && !mats.current.includes(m) && mats.current.push(m))} color="#ffffff" />
      </mesh>
    </group>
  )
  return (
    <>
      <group ref={g}>
        {corner(-1, 1)}
        {corner(1, 1)}
        {corner(-1, -1)}
        {corner(1, -1)}
        <mesh>
          <boxGeometry args={[arm * 0.5, th * 0.6, th * 0.6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
        <mesh>
          <boxGeometry args={[th * 0.6, arm * 0.5, th * 0.6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
        {/* The flash: all white for a blink */}
        <mesh ref={veil} position={[0, 0, 1.5]} visible={false}>
          <boxGeometry args={[v.width * 2, v.height * 2, 0.01]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[CAM[0], CAM[1], CAM[2] - 1]} intensity={0} distance={30} decay={1} color="#ffffff" />
    </>
  )
}

/** The scene going on, and where each subject is in the viewfinder when the shutter goes. */
function Loop({ step, aim }: { step: { current: (dt: number) => void }; aim: { current: ((w: Walker) => THREE.Vector3) | null } }) {
  const { camera } = useThree()
  useEffect(() => {
    aim.current = (w) => new THREE.Vector3(w.x, w.y + 0.8, w.z).project(camera)
  }, [camera, aim])
  useFrame((_, dt) => step.current(Math.min(0.06, dt)))
  return null
}

export function Photo({ jeu, onEnd }: EngineProps<'photo'>) {
  const shots = jeu.shots ?? 5
  const st = useRef<St>({ t: 0, key: 0, walkers: [], next: 0, flash: -9, frame: { c: '#ffffff', at: -9 }, good: 0, quality: 0, wrong: 0, blank: 0, done: false })
  const [want, setWant] = useState<Item>(() => jeu.subjects[Math.floor(Math.random() * jeu.subjects.length)])
  const wantRef = useRef(want)
  wantRef.current = want
  const [said, setSaid] = useState<string | null>(null)
  const sayT = useRef<ReturnType<typeof setTimeout>>(undefined)
  const say = (w: string, ms = 1100) => {
    setSaid(w)
    clearTimeout(sayT.current)
    sayT.current = setTimeout(() => setSaid(null), ms)
  }
  const aim = useRef<((w: Walker) => THREE.Vector3) | null>(null)
  const finish = useRef(onEnd)
  finish.current = onEnd
  const step = useRef((dt: number) => void dt)
  step.current = (dt: number) => {
    const s = st.current
    s.t += dt
    // Three or four on the scene, the one asked among them before long.
    s.next -= dt
    const live = s.walkers.filter((w) => w.shot === undefined)
    if (s.next <= 0 && live.length < 4) {
      s.next = 1.1 + Math.random() * 1.1
      const others = jeu.subjects.filter((x) => x.name !== wantRef.current.name)
      const asked = !others.length || (!live.some((w) => w.item.name === wantRef.current.name) && Math.random() < 0.85)
      const item = asked ? wantRef.current : others[Math.floor(Math.random() * others.length)]
      const dir = Math.random() < 0.5 ? 1 : -1
      const z = FLY.has(item.prop) ? -1.5 + Math.random() * 2 : DEPTHS[Math.floor(Math.random() * DEPTHS.length)]
      s.walkers.push({ key: s.key++, item, x: -dir * 4.6, z, y: FLY.has(item.prop) ? 0.9 + Math.random() * 0.6 : 0, dir, v: 1 + Math.random() * 0.9 + s.good * 0.12, ph: Math.random() * 6 })
    }
    for (const w of s.walkers) {
      // Walk and stop, walk and stop: a moment to frame it.
      const pace = w.shot !== undefined ? 3 : 0.35 + 0.65 * Math.max(0, Math.sin(s.t * 1.3 + w.ph))
      w.x += w.dir * w.v * pace * dt
    }
    s.walkers = s.walkers.filter((w) => Math.abs(w.x) < 4.8)
  }
  const shoot = () => {
    const s = st.current
    if (s.done || !aim.current || s.t - s.flash < 0.35) return
    s.flash = s.t
    gesture('film', 900)
    // What's in the viewfinder, the nearest to its centre first.
    const inFrame = s.walkers
      .filter((w) => w.shot === undefined)
      .map((w) => ({ w, p: aim.current!(w) }))
      .filter(({ p }) => Math.abs(p.x) < FRAME && Math.abs(p.y) < FRAME && p.z < 1)
      .sort((a, b) => Math.hypot(a.p.x, a.p.y) - Math.hypot(b.p.x, b.p.y))
    const hit = inFrame.find(({ w }) => w.item.name === want.name)
    if (hit) {
      const q = Math.max(0.35, Math.min(1, 1 - Math.hypot(hit.p.x, hit.p.y) / (FRAME * 1.25)))
      hit.w.shot = s.t
      s.good++
      s.quality += q
      s.frame = { c: '#40c057', at: s.t }
      haptic('success')
      say(q > 0.8 ? tr('Magnifique !') : q > 0.55 ? tr('Belle photo !') : tr('Un peu décalé…'))
      if (s.good >= shots) {
        s.done = true
        const score = Math.round((s.quality / shots) * 100 - s.wrong * 8 - s.blank * 4)
        setTimeout(() => {
          say(tr('L’album est complet !'), 2000)
          gesture('cheer', 1500)
        }, 700)
        setTimeout(() => finish.current(Math.max(10, Math.min(100, score))), 1700)
        return
      }
      setTimeout(() => setWant(jeu.subjects.length > 1 ? jeu.subjects.filter((x) => x.name !== want.name)[Math.floor(Math.random() * (jeu.subjects.length - 1))] : want), 700)
    } else if (inFrame.length) {
      s.wrong++
      s.frame = { c: '#e03131', at: s.t }
      haptic('error')
      say(tr('Pas ça : {0} !', { 0: want.name.toLowerCase() }))
    } else {
      s.blank++
      s.frame = { c: '#e03131', at: s.t }
      haptic('light')
      say(tr('Rien dans le cadre…'))
    }
  }
  const shootRef = useRef(shoot)
  shootRef.current = shoot
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        shootRef.current()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const s = st.current
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      status={`« ${want.name} ! » · ${Math.min(s.good, shots)}/${shots} photos`}
      said={said}
      controls={
        <button className="h-16 flex-1 touch-none rounded-2xl border-b-4 border-black/30 bg-[var(--color-orange)] font-display text-[20px] font-extrabold text-white select-none active:translate-y-0.5 active:border-b-0" onPointerDown={(e) => (e.preventDefault(), shoot())}>
          {tr('Clic !')}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none" onPointerDown={() => shoot()}>
        <Stage decor={jeu.decor} cam={CAM} look={[0, 0.85, 0]} fov={40}>
          <Loop step={step} aim={aim} />
          <Walkers st={st} />
          <Viewfinder st={st} />
          {/* The back: a low wall, the sky over it (indoors, a wall) */}
          <Box p={[0, 0.3, -3.4]} s={[8, 0.6, 0.2]} c="#c9b48a" />
          <Box p={[0, 3, -3.7]} s={[14, 7, 0.1]} c={INDOORS.has(jeu.decor) ? '#efe3cf' : '#a5d8ff'} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:photo). */
export const demo: Extract<import('../types').Jeu, { engine: 'photo' }> = {
  engine: 'photo', title: tr('Safari au zoo'), how: tr('Le guide te demande un animal : déclenche quand il est dans le cadre.'), decor: 'herbe', shots: 5,
  subjects: [{ name: tr('Le lion'), prop: 'lion' }, { name: tr('La girafe'), prop: 'girafe' }, { name: tr('L’éléphant'), prop: 'elephant' }, { name: tr('Le singe'), prop: 'singe' }, { name: tr('Le perroquet'), prop: 'perroquet' }],
}
