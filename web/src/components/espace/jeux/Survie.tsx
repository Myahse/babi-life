import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '../../../world3d/props'
import { JeuShell, Stage, scoreOf } from '../../defi/jeux/Shell'
import { juice, snd } from '../../defi/jeux/juice'
import { haptic } from '../../../lib/native'
import { t as tr } from '../../../lib/i18n'
import { Suited, levelOf } from './common'

// La survie en mer (backend game/espaceCarriere.go: selection-survie, module-survie, touriste-survie): the
// Pirogue capsule has splashed down off Sassandra, rocking on the swell; the agency's boat is on its way. Do the
// drill in the right order, before the clock runs out: the life vest, the hatch, the raft, the dye in the sea,
// the signal mirror. A wrong step costs points; the instructor's divers are in the water all along.

type Step = { id: string; label: string }
const STEPS = (): Step[] => [
  { id: 'gilet', label: tr('Enfiler le gilet') },
  { id: 'ecoutille', label: tr('Ouvrir l’écoutille') },
  { id: 'radeau', label: tr('Gonfler le radeau') },
  { id: 'colorant', label: tr('Verser le colorant') },
  { id: 'miroir', label: tr('Faire signe au bateau') },
]
const TIME = { touriste: 22, selection: 26, module: 22 } as const

function Sea({ done }: { done: number }) {
  const capsule = useRef<THREE.Group>(null)
  const boat = useRef<THREE.Group>(null)
  const waves = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (capsule.current) {
      capsule.current.position.y = 0.35 + Math.sin(t * 1.4) * 0.12
      capsule.current.rotation.z = Math.sin(t * 1.1) * 0.12
      capsule.current.rotation.x = Math.sin(t * 0.8) * 0.06
    }
    if (boat.current) {
      const want = done >= 5 ? 1.6 : 5.5
      boat.current.position.x += (want - boat.current.position.x) * Math.min(1, dt * 0.8)
      boat.current.position.y = 0.2 + Math.sin(t * 1.6 + 1) * 0.08
    }
    if (waves.current) waves.current.children.forEach((w, i) => (w.position.x = ((t * 0.5 + i * 1.3) % 9) - 4.5))
  })
  return (
    <group>
      <group ref={waves}>
        {[...Array(7)].map((_, i) => (
          <Box key={i} p={[0, 0.03, -3 + i * 0.95]} s={[1.2, 0.06, 0.1]} c="#a5d8ff" />
        ))}
      </group>
      {/* The Pirogue, blue, its hatch open after step 2 */}
      <group ref={capsule} position={[-1.2, 0.35, 0]}>
        <Box p={[0, 0.5, 0]} s={[1.6, 1.1, 1.6]} c="#1c3d6e" />
        <Box p={[0, 1.2, 0]} s={[1, 0.35, 1]} c="#274b80" />
        <Box p={[0, -0.05, 0]} s={[1.9, 0.2, 1.9]} c="#5b3a1e" />
        <Box p={[0, 0.6, 0.82]} s={[0.6, 0.6, 0.04]} c={done >= 2 ? '#0b1a30' : '#adb5bd'} />
        <Box p={[0, 1.1, 0.82]} s={[0.5, 0.12, 0.04]} c="#ff7a00" />
        {/* The flotation collar */}
        {[-1, 1].map((s) => (
          <Box key={s} p={[s * 1.05, 0.1, 0]} s={[0.25, 0.35, 1.4]} c="#ffd43b" />
        ))}
      </group>
      {/* The trainee: in the hatch, then out on the raft */}
      <group position={done >= 3 ? [0.6, 0.28, 0.9] : [-1.2, done >= 2 ? 1.05 : 0.55, 0.6]} scale={0.55}>
        <Suited pose={done >= 3 ? 'sit' : 'stand'} />
        {done >= 1 && <Box p={[0, 1.05, 0.2]} s={[0.62, 0.5, 0.1]} c="#ff922b" />}
      </group>
      {done >= 3 && (
        <group position={[0.6, 0.1, 0.9]}>
          <Box p={[0, 0.05, 0]} s={[1.3, 0.22, 1.1]} c="#ff922b" />
          <Box p={[0, 0.18, 0]} s={[1, 0.06, 0.8]} c="#e8590c" />
        </group>
      )}
      {/* The dye: a green-yellow patch spreading on the water */}
      {done >= 4 && <Box p={[0, 0.02, 1.2]} s={[3.2, 0.02, 2.2]} c="#a9e34b" />}
      {/* The agency's boat, coming */}
      <group ref={boat} position={[5.5, 0.2, -1.6]}>
        <Box p={[0, 0.25, 0]} s={[2.2, 0.5, 0.9]} c="#f8f9fa" />
        <Box p={[0.2, 0.7, 0]} s={[0.9, 0.5, 0.7]} c="#dee2e6" />
        <Box p={[0, 0.25, 0.46]} s={[2.2, 0.12, 0.02]} c="#ff7a00" />
        <Box p={[0.5, 1.15, 0]} s={[0.06, 0.6, 0.06]} c="#495057" />
        <Box p={[0.68, 1.35, 0]} s={[0.36, 0.22, 0.02]} c="#ff7a00" />
      </group>
      {done >= 5 && <Box p={[0.6, 1.4, 0.9]} s={[0.18, 0.18, 0.02]} c="#fff9db" glow={1} />}
    </group>
  )
}

export function Survie({ id, onEnd }: { id: string; onEnd: (score: number) => void }) {
  const level = levelOf(id)
  // The tourists: getting out only (the vest, the hatch, the raft).
  const steps = useMemo(() => STEPS().slice(0, level === 'touriste' ? 3 : 5), [level])
  const order = useMemo(() => [...steps].sort(() => Math.random() - 0.5), [steps])
  const [done, setDone] = useState(0)
  const doneRef = useRef(0)
  const [left, setLeft] = useState<number>(TIME[level])
  const [said, setSaid] = useState<string | null>(null)
  const mistakes = useRef(0)
  const over = useRef(false)
  const end = useRef(onEnd)
  end.current = onEnd
  const finish = (n: number) => {
    if (over.current) return
    over.current = true
    juice.finish(scoreOf(n, steps.length, mistakes.current), n >= steps.length ? tr('Le bateau d’Astrélia te récupère : exercice réussi.') : tr('Le temps est passé : les plongeurs t’aident à finir, on recommencera.'), (x) => end.current(x))
  }
  useEffect(() => {
    const t0 = performance.now()
    const idt = setInterval(() => {
      const l = Math.max(0, TIME[level] - (performance.now() - t0) / 1000)
      setLeft(l)
      if (l <= 0) {
        clearInterval(idt)
        finish(doneRef.current)
      }
    }, 200)
    return () => clearInterval(idt)
  }, [level]) // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (s: Step) => {
    if (over.current) return
    if (steps[done].id === s.id) {
      const n = done + 1
      doneRef.current = n
      setDone(n)
      snd.splash()
      juice.good({ at: [0, 2, 0.5], text: s.label })
      setSaid(null)
      if (n >= steps.length) finish(n)
    } else {
      mistakes.current++
      haptic('light')
      juice.bad({ soft: true })
      setSaid(tr('Pas encore : d’abord « {0} ».', { 0: steps[done].label }))
    }
  }
  return (
    <JeuShell
      title={level === 'touriste' ? tr('Sortir de la capsule en mer') : tr('La survie en mer')}
      how={tr('La Pirogue a amerri : fais les gestes dans le bon ordre avant que le temps passe. Le bateau d’Astrélia arrive.')}
      goal={tr('{0} gestes, dans l’ordre !', { 0: steps.length })}
      status={tr('{0}/{1} · {2} s', { 0: done, 1: steps.length, 2: Math.ceil(left) })}
      said={said}
      controls={
        <div className="grid w-full grid-cols-2 gap-2">
          {order.map((s) => {
            const ok = steps.findIndex((x) => x.id === s.id) < done
            return (
              <button key={s.id} disabled={ok} className={`tile min-h-[48px] px-2 py-2 text-[13.5px] leading-tight font-extrabold active:scale-[0.97] ${ok ? '!bg-[#d3f9d8] opacity-60' : ''}`} onClick={() => tap(s)}>
                {s.label}
              </button>
            )
          })}
        </div>
      }
    >
      <Stage decor="eau" cam={[0.6, 5, 8.6]} look={[0.6, 0.5, 0]} fov={44}>
        <Sea done={done} />
      </Stage>
    </JeuShell>
  )
}
