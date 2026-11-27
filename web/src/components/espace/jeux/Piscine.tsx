import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '../../../world3d/props'
import { JeuShell, Stage, scoreOf } from '../../defi/jeux/Shell'
import { juice, snd } from '../../defi/jeux/juice'
import { t as tr } from '../../../lib/i18n'
import { HoldButton, Suited, levelOf } from './common'

// La piscine (backend game/espaceCarriere.go: selection-piscine, module-piscine): in the big pool, the station's
// mock-up underwater; the trainee in the suit, weighted to float neither up nor down (« flottabilité neutre »).
// The suit drifts up by itself: hold to fin down, let go to rise. Each hand-hold of the mock-up that passes is
// caught only if the trainee is level with the rail (the band). Under water, the divers watch: nobody is at risk.

const HOLDS = { touriste: 6, selection: 7, module: 9 } as const
const SPEED = 0.9 // the mock-up passing (units a second)
const GAP = 1.6
const RAIL = 1.6 // the rail's height
const BAND = 0.35

type Live = { y: number; v: number; holding: boolean; x: number; over: boolean; caught: boolean[]; judged: boolean[] }

function Pool({ live, n }: { live: { current: Live }; n: number }) {
  const me = useRef<THREE.Group>(null)
  const mock = useRef<THREE.Group>(null)
  const holds = useRef<(THREE.MeshLambertMaterial | null)[]>([])
  const bubbles = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const l = live.current
    if (me.current) {
      me.current.position.y = l.y - 0.9
      me.current.rotation.z = Math.sin(clock.elapsedTime * 1.3) * 0.08
    }
    if (mock.current) mock.current.position.x = 3.2 - l.x
    holds.current.forEach((m, i) => m && m.color.set(l.caught[i] ? '#2fd158' : l.judged[i] ? '#ff5c7a' : '#ffd43b'))
    if (bubbles.current) bubbles.current.children.forEach((b, i) => (b.position.y = 0.4 + ((clock.elapsedTime * 0.6 + i * 0.37) % 3.4)))
  })
  return (
    <group>
      {/* The water all round (a light blue volume), the pool's tiled side behind */}
      <Box p={[0, 1.8, -2.6]} s={[8, 3.6, 0.2]} c="#a5d8ff" />
      {[...Array(8)].map((_, i) => (
        <Box key={i} p={[-3.5 + i, 1.8, -2.48]} s={[0.04, 3.6, 0.02]} c="#74c0fc" />
      ))}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[8, 3.6, 5]} />
        <meshLambertMaterial color="#4dabf7" transparent opacity={0.18} />
      </mesh>
      {/* The surface, seen from under the water */}
      <mesh position={[0, 3.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 5]} />
        <meshBasicMaterial color="#d0ebff" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      {/* The mock-up of the station: a long white module, its rail of hand-holds */}
      <group ref={mock}>
        <Box p={[(n * GAP) / 2, 0.75, -1]} s={[n * GAP + 2, 1.3, 1.4]} c="#f1f3f5" />
        <Box p={[(n * GAP) / 2, 0.75, -0.29]} s={[n * GAP + 2, 0.1, 0.04]} c="#ff7a00" />
        {[...Array(n)].map((_, i) => (
          <mesh key={i} position={[i * GAP + 1, RAIL - 0.1, -0.2]}>
            <boxGeometry args={[0.5, 0.12, 0.16]} />
            <meshLambertMaterial ref={(m) => void (holds.current[i] = m)} />
          </mesh>
        ))}
      </group>
      {/* The trainee, side-on, arms out */}
      <group ref={me} position={[-1.2, 0, 0.2]} rotation={[0, Math.PI / 2, 0]} scale={0.75}>
        <Suited pose="float" />
      </group>
      {/* The rail's band: two green marks either side of the trainee's line */}
      {[-BAND, BAND].map((d) => (
        <Box key={d} p={[-1.2, RAIL + d, -0.25]} s={[1.1, 0.05, 0.02]} c="#2fd158" glow={0.5} />
      ))}
      <group ref={bubbles}>
        {[...Array(7)].map((_, i) => (
          <Box key={i} p={[-1 + (i % 3) * 0.15, 0, 0.3]} s={[0.07, 0.07, 0.07]} c="#e7f5ff" />
        ))}
      </group>
    </group>
  )
}

export function Piscine({ id, onEnd }: { id: string; onEnd: (score: number) => void }) {
  const n = HOLDS[levelOf(id)]
  const live = useRef<Live>({ y: 2.4, v: 0, holding: false, x: 0, over: false, caught: Array(n).fill(false), judged: Array(n).fill(false) })
  const [got, setGot] = useState(0)
  const [passed, setPassed] = useState(0)
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const l = live.current
      if (l.over) return
      // The suit wants to rise a little; finning down pushes it; the water brakes it all.
      const t = now / 1000
      l.v += ((l.holding ? -1.5 : 0.75) + Math.sin(t * 0.9) * 0.35) * dt
      l.v *= Math.pow(0.35, dt)
      l.y = Math.max(0.5, Math.min(3.3, l.y + l.v * dt))
      l.x += SPEED * dt
      // A hand-hold reaching the trainee (at x = -1.2): caught if level with the rail.
      for (let i = 0; i < n; i++) {
        if (l.judged[i]) continue
        const at = 3.2 - l.x + i * GAP + 1
        if (at <= -1.2) {
          l.judged[i] = true
          const ok = Math.abs(l.y - RAIL) <= BAND
          l.caught[i] = ok
          if (ok) {
            juice.good({ at: [-1.2, RAIL + 0.4, 0.4], text: tr('Poignée !') })
            setGot((g) => g + 1)
          } else juice.bad({ at: [-1.2, l.y + 0.4, 0.4], text: l.y > RAIL ? tr('Trop haut') : tr('Trop bas'), soft: true })
          setPassed((p) => p + 1)
        }
      }
      if (l.judged.every(Boolean)) {
        l.over = true
        const c = l.caught.filter(Boolean).length
        snd.splash()
        juice.finish(scoreOf(c, n), c >= n * 0.5 ? tr('Flottabilité neutre : les plongeurs lèvent le pouce.') : tr('Tu flottais trop haut ou trop bas : on refait un passage.'), (x) => end.current(x))
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [n])
  return (
    <JeuShell
      title={tr('La piscine, en flottabilité neutre')}
      how={tr('La combinaison remonte toute seule : maintiens pour palmer vers le bas, lâche pour remonter. Reste au niveau de la rampe pour attraper chaque poignée de la maquette.')}
      goal={tr('{0} poignées !', { 0: n })}
      status={tr('{0} attrapée(s) · {1}/{2}', { 0: got, 1: passed, 2: n })}
      controls={<HoldButton onHold={(on) => void (live.current.holding = on)}>{tr('Palmer vers le bas (maintenir)')}</HoldButton>}
    >
      <Stage decor="eau" cam={[0, 1.9, 8.4]} look={[0, 1.7, 0]} fov={46}>
        <Pool live={live} n={n} />
      </Stage>
    </JeuShell>
  )
}
