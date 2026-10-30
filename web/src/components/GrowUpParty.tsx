import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PartyPopper } from 'lucide-react'
import type { Sim } from '../lib/types'
import { sceneDpr } from '../lib/device'
import { randomLook } from '../avatar/options'
import { familyCast } from '../avatar/Family'
import { Character } from '../world3d/Character'
import { Box } from '../world3d/props'
import { Balloons } from '../world3d/interior/doings'
import { rng } from '../world3d/themes'
import type { Pose } from '../avatar/Human'
import { t } from '../lib/i18n'

// Growing up by milestones (the update « grandir-par-etapes », backend
// sims/grandir.go): the baby whose « premières fois » are all done becomes a
// child, the child whose « étapes » are becomes a teenager, on the server;
// here, the family's courtyard throws the party. The Sim in the middle at its
// old size, then — pop — at its new one, cheering; papa, maman and the
// neighbours' children clapping, the balloons, the confetti falling. All of
// it the game's own 3D: the characters, the boxes, the balloons.

type Grown = 'enfant' | 'ado'

function Turn() {
  useFrame(({ camera, clock }) => {
    const a = 0.15 + Math.sin(clock.elapsedTime * 0.08) * 0.55
    camera.position.set(Math.sin(a) * 4.2, 2.0, Math.cos(a) * 4.2)
    camera.lookAt(0, 0.8, 0)
  })
  return null
}

/** The confetti: little boxes of the flag's and the party's colours, falling and turning. */
function Confetti() {
  const fall = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 0.2), [])
  const colors = useMemo(() => ['#f08c00', '#ffffff', '#2f9e44', '#ffd43b', '#ff6b9a', '#4dabf7'].map((c) => new THREE.Color(c)), [])
  const N = 90
  useEffect(() => {
    for (let i = 0; i < N; i++) fall.current?.setColorAt(i, colors[i % colors.length])
    if (fall.current?.instanceColor) fall.current.instanceColor.needsUpdate = true
  }, [colors])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!fall.current) return
    for (let i = 0; i < N; i++) {
      const k = (t * 0.22 + i / N) % 1
      o.position.set(Math.sin(i * 7.1) * 2.4, 3.6 - k * 3.6, Math.sin(i * 3.7) * 2.0)
      o.rotation.set(t * 2 + i, t * 1.3 + i, 0)
      o.scale.setScalar(0.06)
      o.updateMatrix()
      fall.current.setMatrixAt(i, o.matrix)
    }
    fall.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={fall} args={[box, undefined, N]} frustumCulled={false}>
      <meshLambertMaterial />
    </instancedMesh>
  )
}

/** The Sim: at its old stage till `grown`, then at the new one, popping up and jumping for joy. */
function Star({ sim, from, to, grown }: { sim: Pick<Sim, 'look' | 'gender'>; from: string; to: Grown; grown: boolean }) {
  const g = useRef<THREE.Group>(null)
  const since = useRef<number | null>(null)
  useFrame(({ clock }) => {
    if (!g.current) return
    if (grown && since.current == null) since.current = clock.elapsedTime
    const k = since.current == null ? 1 : Math.min(1, (clock.elapsedTime - since.current) / 0.45)
    // The pop: from small to a little over, then its size.
    const s = since.current == null ? 1 : 0.6 + 0.4 * k + Math.sin(k * Math.PI) * 0.18
    g.current.scale.setScalar(s)
    g.current.position.y = grown ? Math.abs(Math.sin(clock.elapsedTime * 3.2)) * 0.12 : 0
  })
  return (
    <group ref={g}>
      <Character look={sim.look} gender={sim.gender} stage={grown ? to : from} pose={grown ? 'cheer' : 'idle'} marker={false} seed={1} />
    </group>
  )
}

export function GrowUpSet({ sim, to, grown }: { sim: Pick<Sim, 'id' | 'look' | 'gender' | 'family'>; to: Grown; grown: boolean }) {
  const cast = useMemo(() => familyCast(sim.family ?? 'poignon', sim.look), [sim.family, sim.look])
  // The neighbours' children, the same ones each time for this Sim.
  const kids = useMemo(() => {
    const r = rng(`grandir:${sim.id}`)
    return [...Array(5)].map((_, i) => {
      const gender: 'femme' | 'homme' = i % 2 ? 'homme' : 'femme'
      return { gender, look: randomLook(gender, r), pose: (['clap', 'cheer', 'dance', 'clap', 'cheer'] as Pose[])[i] }
    })
  }, [sim.id])
  const from = to === 'enfant' ? 'bebe' : 'enfant'
  return (
    <>
      <hemisphereLight args={['#fff6e8', '#8a6a40', 1.3]} />
      <directionalLight position={[5, 10, 6]} intensity={1.3} />
      {/* The family's courtyard: the red earth, the low wall behind, the mango tree's trunk and leaves */}
      <Box p={[0, -0.05, 0]} s={[16, 0.1, 16]} c="#c98a52" />
      <Box p={[0, 0.6, -3.2]} s={[9, 1.2, 0.2]} c="#e9d8b8" />
      <Box p={[-2.6, 1.2, -2.4]} s={[0.35, 2.4, 0.35]} c="#6b4423" />
      <Box p={[-2.6, 2.7, -2.4]} s={[2.2, 1.0, 2.0]} c="#2f7d32" />
      <group position={[1.6, 0, -1.2]}>
        <Balloons />
      </group>
      <group position={[-1.4, 0, -0.9]}>
        <Balloons />
      </group>
      <Star sim={sim} from={from} to={to} grown={grown} />
      <group position={[-1.15, 0, -0.5]} rotation={[0, 0.6, 0]}>
        <Character look={cast.papa.look} gender="homme" stage="adulte" pose={grown ? 'cheer' : 'clap'} marker={false} seed={32} />
      </group>
      <group position={[1.15, 0, -0.5]} rotation={[0, -0.6, 0]}>
        <Character look={cast.maman.look} gender="femme" stage="adulte" pose={grown ? 'dance' : 'clap'} marker={false} seed={33} />
      </group>
      {kids.map((k, i) => {
        // In an arc behind, the camera's side left open.
        const a = Math.PI + 0.35 + (i / (kids.length - 1)) * (Math.PI - 0.7)
        return (
          <group key={i} position={[Math.cos(a) * 2.2, 0, Math.sin(a) * 1.6 - 0.4]} rotation={[0, -a - Math.PI / 2, 0]}>
            <Character look={k.look} gender={k.gender} stage={to === 'enfant' ? 'enfant' : 'ado'} pose={grown ? k.pose : 'clap'} marker={false} seed={50 + i} />
          </group>
        )
      })}
      {grown && <Confetti />}
    </>
  )
}

/** The party, over the game: the courtyard, the line, « Youpi ! » to go on. */
export function GrowUpParty({ sim, to, onEnd }: { sim: Sim; to: Grown; onEnd: () => void }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const k = setTimeout(() => setGrown(true), 1600)
    return () => clearTimeout(k)
  }, [])
  const name = sim.firstName
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#f7d9a8]">
      <div className="relative min-h-0 flex-1">
        <Canvas dpr={sceneDpr} camera={{ fov: 45 }}>
          <Turn />
          <GrowUpSet sim={sim} to={to} grown={grown} />
        </Canvas>
        <div className="pointer-events-none absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] text-center">
          <span className="rounded-full bg-black/45 px-4 py-2 text-[13px] font-extrabold tracking-wider text-white uppercase">{to === 'enfant' ? t('{name} devient enfant !', { name }) : t('{name} devient ado !', { name })}</span>
        </div>
      </div>
      <div className="bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p key={String(grown)} className="animate-pop min-h-[3.5rem] text-[16px] leading-snug font-extrabold text-[var(--color-ink)]">
          {to === 'enfant'
            ? grown
              ? t("Toutes ses premières fois sont faites : {name} a 3 ans ! Place à l'école, aux copains, et à ses étapes d'enfant.", { name })
              : t('Le sourire, la bouillie, les premiers pas… {name} a tout vécu.', { name })
            : grown
              ? t("Toutes ses étapes d'enfant sont faites : {name} a 12 ans ! Le collège, et son premier téléphone.", { name })
              : t("L'école, les bonnes notes, les copains, les matchs… {name} a bien grandi.", { name })}
        </p>
        <button className="btn mt-3 w-full" onClick={onEnd}>
          <PartyPopper size={18} /> {t('Youpi !')}
        </button>
      </div>
    </div>
  )
}
