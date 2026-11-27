import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FlaskConical, X } from 'lucide-react'
import type { Sim } from '../../lib/types'
import { api } from '../../lib/api'
import { t as tr } from '../../lib/i18n'
import { toast } from '../../lib/overlays'
import { B } from '../../world3d/espace/blocs'

// The Station Akwaba's experiments as a little game (the lab's « labo-plantes », « labo-cristaux »,
// « labo-attieke »; backend sims/espaceVie.go): in the glovebox things float; catch the right ones (the water
// for the beans, the crystals' seeds, the grains of attiéké that drift apart) and leave the air bubbles. Twenty
// seconds; the score (0–100) counts for the action's skill points, never money.

const SECONDS = 20
const N = 7

type Item = { good: boolean; p: THREE.Vector3; v: THREE.Vector3; born: number }

function theme(id: string) {
  if (id === 'labo-plantes') return { color: '#4dabf7', what: tr('les gouttes d’eau pour les haricots'), title: tr('Les haricots sans pesanteur') }
  if (id === 'labo-cristaux') return { color: '#66d9e8', what: tr('les germes de cristal'), title: tr('Les cristaux qui flottent') }
  return { color: '#fff3bf', what: tr('les grains d’attiéké'), title: tr('L’attiéké en apesanteur') }
}

const spawn = (good: boolean, t: number): Item => ({ good, p: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.5), v: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, 0), born: t })

function Box({ color, items, onTap }: { color: string; items: React.MutableRefObject<Item[]>; onTap: (i: number) => void }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }, dt) => {
    const d = Math.min(0.05, dt)
    items.current.forEach((it, i) => {
      it.p.addScaledVector(it.v, d)
      if (Math.abs(it.p.x) > 2.2) it.v.x *= -1
      if (Math.abs(it.p.y) > 1.6) it.v.y *= -1
      const g = refs.current[i]
      if (g) {
        g.position.copy(it.p)
        g.rotation.set(clock.elapsedTime * 0.7 + i, clock.elapsedTime * 0.5, 0)
        g.scale.setScalar(Math.min(1, (clock.elapsedTime - it.born) * 3))
      }
    })
  })
  return (
    <>
      <color attach="background" args={['#0b1220']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 6]} intensity={1.2} />
      <B p={[0, 0, -1.2]} s={[5.4, 4, 0.1]} c="#dde3ea" />
      <B p={[0, -2.05, 0]} s={[5.4, 0.1, 2.5]} c="#adb5bd" />
      <B p={[0, 2.05, 0]} s={[5.4, 0.1, 2.5]} c="#f783ac" glow />
      {items.current.map((it, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} onClick={(e) => (e.stopPropagation(), onTap(i))}>
          {it.good ? <B p={[0, 0, 0]} s={[0.34, 0.34, 0.34]} c={color} glow /> : <B p={[0, 0, 0]} s={[0.42, 0.42, 0.42]} c="#ffffff" o={0.35} />}
          <mesh>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function Experience({ sim, interactionId, onClose }: { sim: Sim; interactionId: string; onClose: () => void }) {
  const th = useMemo(() => theme(interactionId), [interactionId])
  const start = useRef(performance.now() / 1000)
  const items = useRef<Item[]>(Array.from({ length: N }, (_, i) => spawn(i % 3 !== 0, 0)))
  const [, redraw] = useState(0)
  const [left, setLeft] = useState(SECONDS)
  const [hits, setHits] = useState({ good: 0, bad: 0 })
  const [said, setSaid] = useState<string | null>(null)
  const done = useRef(false)
  const score = Math.max(0, Math.min(100, hits.good * 8 - hits.bad * 6))
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, SECONDS - (performance.now() / 1000 - start.current))
      setLeft(l)
      if (l <= 0 && !done.current) {
        done.current = true
        clearInterval(t)
      }
    }, 200)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (left > 0 || said) return
    api
      .espaceJeu(sim.id, 'labo', Math.max(1, score))
      .then((r) => setSaid(r.outcome.text))
      .catch((e) => setSaid(String(e?.message ?? e)))
  }, [left]) // eslint-disable-line react-hooks/exhaustive-deps
  const onTap = (i: number) => {
    if (left <= 0) return
    const it = items.current[i]
    setHits((h) => (it.good ? { ...h, good: h.good + 1 } : { ...h, bad: h.bad + 1 }))
    items.current[i] = spawn(Math.random() > 0.35, performance.now() / 1000 - start.current)
    redraw((n) => n + 1)
  }
  return (
    <div className="animate-up absolute inset-0 z-50 bg-black text-white">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 50, position: [0, 0, 6] }} onCreated={({ clock }) => void (clock.elapsedTime = 0)}>
        <Box color={th.color} items={items} onTap={onTap} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-3 top-[max(1rem,var(--sat,env(safe-area-inset-top)))] flex items-start gap-2">
        <div className="hud flex flex-1 flex-col gap-1 rounded-2xl p-3">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <FlaskConical size={16} className="text-[#ff7a00]" /> {th.title}
          </div>
          <p className="text-xs font-bold opacity-85">{tr('Attrape {what}, pas les bulles d’air.', { what: th.what })}</p>
          <div className="flex gap-3 text-xs font-extrabold tabular-nums">
            <span>{tr('{n} s', { n: Math.ceil(left) })}</span>
            <span>{tr('Score {score}/100', { score })}</span>
          </div>
        </div>
        <button className="hud pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full" aria-label={tr('Fermer')} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {said && (
        <div className="absolute inset-x-4 bottom-[calc(var(--sab,env(safe-area-inset-bottom))+2rem)]">
          <button
            className="w-full rounded-2xl bg-[#ff7a00] py-3 text-sm font-extrabold"
            onClick={() => {
              toast({ tone: 'event', title: th.title, text: said, money: 0, icon: 'brain' })
              onClose()
            }}
          >
            {tr('Noter l’expérience')}
          </button>
        </div>
      )}
    </div>
  )
}
