import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../../lib/types'
import { haptic } from '../../lib/native'
import { gesture } from '../../world3d/gesture'
import { Character } from '../../world3d/Character'
import { Box } from '../../world3d/props'
import { DEFAULT_LOOK } from './Scenes'
import { JeuShell, Stage, scoreOf } from './jeux/Shell'

// The shower, played (the update « gestes-maison »): the perso itself under the shower, washed by the
// player. First the soap: rub each part of the body (tap it) until it foams. Then the water: rinse
// every bit of foam off. Quick and nothing forgotten, a good shower.

type Zone = { id: string; name: string; at: [number, number, number]; size: [number, number, number] }
const ZONES: Zone[] = [
  { id: 'tete', name: 'la tête', at: [0, 1.95, 0.1], size: [0.55, 0.45, 0.55] },
  { id: 'bras-g', name: 'le bras gauche', at: [-0.42, 1.3, 0.05], size: [0.3, 0.6, 0.35] },
  { id: 'bras-d', name: 'le bras droit', at: [0.42, 1.3, 0.05], size: [0.3, 0.6, 0.35] },
  { id: 'ventre', name: 'le ventre', at: [0, 1.25, 0.15], size: [0.5, 0.5, 0.3] },
  { id: 'jambes', name: 'les jambes', at: [0, 0.55, 0.12], size: [0.5, 0.7, 0.3] },
]
/** Rubs to get a part foaming. */
const RUBS = 3
type Foam = { key: number; zone: string; p: [number, number, number]; s: number }

/** A blob of foam on the body: a tap (with the water on) rinses it, it slides down and goes. */
function FoamBlob({ f, rinsing, onRinse }: { f: Foam; rinsing: boolean; onRinse: () => void }) {
  const g = useRef<THREE.Group>(null)
  const gone = useRef<number | null>(null)
  useFrame((_, dt) => {
    const o = g.current
    if (!o || gone.current === null) return
    gone.current += dt
    o.position.y -= dt * 2
    o.scale.setScalar(Math.max(0, f.s * (1 - gone.current * 2)))
  })
  return (
    <group
      ref={g}
      position={f.p}
      scale={f.s}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (!rinsing || gone.current !== null) return
        e.stopPropagation()
        gone.current = 0
        onRinse()
      }}
    >
      {[[0, 0, 0], [0.07, 0.05, 0.02], [-0.06, 0.04, 0.03]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
      ))}
      <mesh visible={false}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
      </mesh>
    </group>
  )
}

/** The water from the shower head: drops falling, once it's on. */
function Water() {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    g.current?.children.forEach((m, i) => {
      m.position.y -= dt * (4 + (i % 3))
      if (m.position.y < 0) m.position.y = 2.6
    })
  })
  const drops = useMemo(() => [...Array(26)].map((_, i) => [Math.cos(i * 2.4) * 0.35, (i * 0.37) % 2.6, Math.sin(i * 2.4) * 0.25 + 0.05] as [number, number, number]), [])
  return (
    <group ref={g}>
      {drops.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.025, 0.14, 0.025]} />
          <meshBasicMaterial color="#74c0fc" transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  )
}

export function DoucheJeu({ look = DEFAULT_LOOK, gender = 'homme', onEnd }: { look?: Look; gender?: 'femme' | 'homme'; onEnd: (score: number) => void }) {
  const [rubs, setRubs] = useState<Record<string, number>>({})
  const [foam, setFoam] = useState<Foam[]>([])
  const [said, setSaid] = useState<string | null>(null)
  const st = useRef({ key: 0, t0: performance.now(), misses: 0, rinsed: 0, done: false })
  const soaped = ZONES.filter((z) => (rubs[z.id] ?? 0) >= RUBS).length
  const rinsing = soaped === ZONES.length
  const left = foam.length
  const next = ZONES.find((z) => (rubs[z.id] ?? 0) < RUBS)
  const say = (t: string) => (setSaid(t), setTimeout(() => setSaid(null), 1100))
  // Rubbing a part with the soap: foam comes there, a bit more each rub.
  const rub = (z: Zone) => {
    if (rinsing) return
    const n = rubs[z.id] ?? 0
    if (n >= RUBS) return
    haptic('light')
    gesture('wash', 900)
    setRubs({ ...rubs, [z.id]: n + 1 })
    const k = st.current.key++
    setFoam((f) => [...f, { key: k, zone: z.id, p: [z.at[0] + Math.sin(k * 2.1) * z.size[0] * 0.35, z.at[1] + Math.cos(k * 1.7) * z.size[1] * 0.3, z.at[2] + z.size[2] * 0.5], s: 0.8 + (k % 3) * 0.2 }])
    if (n + 1 === RUBS) say(`${z.name[0].toUpperCase()}${z.name.slice(1)}, bien savonné${z.id === 'jambes' || z.id === 'tete' ? 'e' : ''} !`)
  }
  const rinse = (f: Foam) => {
    haptic('light')
    gesture('wash', 700)
    setTimeout(() => setFoam((fs) => fs.filter((x) => x.key !== f.key)), 400)
    st.current.rinsed++
    if (st.current.rinsed >= ZONES.length * RUBS && !st.current.done) {
      st.current.done = true
      say('Tout propre, ça sent bon !')
      const secs = (performance.now() - st.current.t0) / 1000
      setTimeout(() => onEnd(Math.max(30, scoreOf(1, 1, st.current.misses) - Math.max(0, Math.round((secs - 25) * 1.5)))), 900)
    }
  }
  return (
    <JeuShell
      title="Sous la douche"
      how={rinsing ? 'L’eau coule : touche chaque bout de mousse pour bien te rincer.' : 'Savonne-toi : frotte chaque partie du corps jusqu’à ce qu’elle mousse.'}
      status={rinsing ? `Rince-toi · encore ${left} bout${left > 1 ? 's' : ''} de mousse` : `Savonne ${next?.name ?? ''} · ${soaped}/${ZONES.length}`}
      said={said}
      tall
    >
      <Stage decor="carrelage" cam={[0, 1.6, 4.2]} look={[0, 1.15, 0]} fov={38}>
        {/* The shower: the wall's tiles, the pipe and its head, the soap on its shelf */}
        <Box p={[0, 1.4, -0.7]} s={[3, 2.8, 0.1]} c="#cfe8f2" />
        <Box p={[0.6, 2.1, -0.55]} s={[0.06, 1.2, 0.06]} c="#9aa1a8" />
        <Box p={[0.35, 2.65, -0.4]} s={[0.55, 0.06, 0.06]} c="#9aa1a8" />
        <mesh position={[0.1, 2.6, -0.25]}>
          <cylinderGeometry args={[0.16, 0.12, 0.08, 12]} />
          <meshLambertMaterial color="#868e96" />
        </mesh>
        <Box p={[-0.8, 1.1, -0.55]} s={[0.4, 0.05, 0.2]} c="#ffffff" />
        <Box p={[-0.8, 1.17, -0.55]} s={[0.22, 0.09, 0.12]} c="#ffd43b" />
        {rinsing && <Water />}
        {/* The perso, a towel round the waist, washing */}
        <group position={[0, 0, 0]}>
          <Character look={{ ...look, outfit: 'serviette', accessory: 'none' }} gender={gender} pose="wash" marker={false} />
        </group>
        {/* The parts to soap: a tap rubs one */}
        {!rinsing &&
          ZONES.map((z) => (
            <mesh key={z.id} position={z.at} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), rub(z))}>
              <boxGeometry args={z.size} />
              <meshBasicMaterial color="#ffd43b" transparent opacity={z.id === next?.id ? 0.28 : 0} depthWrite={false} />
            </mesh>
          ))}
        {foam.map((f) => (
          <FoamBlob key={f.key} f={f} rinsing={rinsing} onRinse={() => rinse(f)} />
        ))}
        {/* A tap off the body: a miss */}
        <mesh position={[0, 1.2, -0.5]} onPointerDown={() => (st.current.misses++, haptic('error'))}>
          <planeGeometry args={[3, 2.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Stage>
    </JeuShell>
  )
}
