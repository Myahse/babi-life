import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import type { Look } from '../lib/types'
import { iconFor } from '../components/icons'
import { IconTile } from '../components/ui'
import { rng } from './themes'
import { SIDEWALK } from './layout'
import { Box, Mat, Sign } from './props'
import { Vehicle } from './vehicles'
import { Basket, Football } from './matches'
import { worldTime } from '../lib/worldClock'

// What is going on in the street right now (see backend/internal/game/happenings.go),
// staged on the boulevard around HAPPENING_X so the player can find it.

export const HAPPENING_X = 18
/** Where the player's Sim stands to join in. */
export const HAPPENING_DOOR: [number, number] = [HAPPENING_X - 5, SIDEWALK]
/** Happenings that close the boulevard to the usual traffic. */
export const STOPS_TRAFFIC = new Set(['mariage', 'match', 'concert', 'foot', 'controle', 'embouteillage', 'basket'])

type Person = { gender: 'femme' | 'homme'; look: Look; seed: number }

function useCrowd(n: number, seed: string, dress?: (r: () => number, gender: Person['gender']) => Partial<Look>) {
  return useMemo<Person[]>(() => {
    const r = rng(seed)
    return [...Array(n)].map(() => {
      const gender: Person['gender'] = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: { ...randomLook(gender, r), ...dress?.(r, gender) }, seed: r() * 100 }
    })
  }, [n, seed]) // eslint-disable-line react-hooks/exhaustive-deps
}

function Guest({ p, r = 0, person, pose, scale = 1 }: { p: [number, number, number]; r?: number; person: Person; pose: Pose; scale?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]} scale={scale}>
      <Human look={person.look} gender={person.gender} pose={pose} seed={person.seed} />
    </group>
  )
}

/* ---------- Wedding procession ---------- */

function Wedding({ seed }: { seed: string }) {
  // The family all wear the same pagne, chosen for the wedding.
  const crowd = useCrowd(9, `wed${seed}`, (_, g) => ({ outfit: g === 'femme' ? 'pagne' : 'boubou', outfitColor: '#7b5cff', pattern: 'feuilles', hair: g === 'femme' ? 'headwrap' : 'short' }))
  const couple = useMemo<Person[]>(
    () => [
      { gender: 'femme', look: { ...randomLook('femme', rng(`bride${seed}`)), outfit: 'robe', outfitColor: '#f4efe6', pattern: 'cercles', hair: 'bun', accessory: 'earrings' }, seed: 1 },
      { gender: 'homme', look: { ...randomLook('homme', rng(`groom${seed}`)), outfit: 'suit', outfitColor: '#14213d', accessoryColor: '#f2b705', accessory: 'none' }, seed: 2 },
    ],
    [seed],
  )
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.position.x = HAPPENING_X - 40 + ((worldTime() * 2.6) % 80)
  })
  return (
    <group ref={group} position={[HAPPENING_X, 0, 0]}>
      {[0, -6.5, -13].map((x, i) => (
        <group key={i} position={[x, 0, 2.2]}>
          <Vehicle p={[0, 0, 0]} kind="car" color="#f8f9fa" />
          <Box p={[1.4, 1.25, 0]} s={[0.9, 0.08, 1.2]} c="#ff8fab" />
          <Box p={[1.4, 1.3, 0]} s={[0.3, 0.3, 0.3]} c="#ffffff" />
        </group>
      ))}
      <NoShadows>
        <Guest p={[-17, 0, 1.4]} r={Math.PI / 2} person={couple[0]} pose="wave" />
        <Guest p={[-17, 0, 2.6]} r={Math.PI / 2} person={couple[1]} pose="walk" />
        {crowd.map((p, i) => (
          <Guest key={i} p={[-20 - (i % 4) * 1.5, 0, 0.6 + Math.floor(i / 4) * 1.2 + (i % 2) * 0.3]} r={Math.PI / 2} person={p} pose={i % 3 ? 'walk' : 'dance'} />
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- Éléphants match on a big screen ---------- */

function useScreenTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 144
    const g = c.getContext('2d')!
    g.fillStyle = '#2f9e44'
    g.fillRect(0, 0, 256, 144)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 3
    g.strokeRect(10, 10, 236, 124)
    g.beginPath()
    g.moveTo(128, 10)
    g.lineTo(128, 134)
    g.stroke()
    g.beginPath()
    g.arc(128, 72, 22, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = 'rgba(0,0,0,0.55)'
    g.fillRect(8, 112, 120, 24)
    g.fillStyle = '#ffffff'
    g.font = 'bold 15px sans-serif'
    g.fillText('CIV  2 - 1  ', 16, 129)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

function Flag({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 2, 0]} s={[0.08, 4, 0.08]} c="#868e96" />
      {['#ff8200', '#ffffff', '#009a44'].map((c, i) => (
        <Box key={c} p={[0.35 + i * 0.5, 3.5, 0]} s={[0.5, 1, 0.04]} c={c} />
      ))}
    </group>
  )
}

function Match({ seed }: { seed: string }) {
  const screen = useScreenTexture()
  const crowd = useCrowd(14, `match${seed}`, (r) => (r() < 0.7 ? { outfit: 'jersey', outfitColor: '#ff8200' } : {}))
  const [goal, setGoal] = useState(false)
  useFrame(() => {
    const g = worldTime() % 12 < 2.5
    if (g !== goal) setGoal(g)
  })
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Box p={[0, 1.6, -3.6]} s={[0.25, 3.2, 0.25]} c="#343a40" />
      <mesh position={[0, 3.8, -3.6]}>
        <boxGeometry args={[7, 4, 0.3]} />
        <meshBasicMaterial attach="material-4" map={screen} />
        <meshLambertMaterial attach="material-0" color="#212529" />
        <meshLambertMaterial attach="material-1" color="#212529" />
        <meshLambertMaterial attach="material-2" color="#212529" />
        <meshLambertMaterial attach="material-3" color="#212529" />
        <meshLambertMaterial attach="material-5" color="#212529" />
      </mesh>
      <Flag p={[-5, 0, -3]} />
      <Flag p={[4.5, 0, -3]} />
      <NoShadows>
        {crowd.map((p, i) => (
          <Guest key={i} p={[-4.5 + (i % 5) * 2.2 + (Math.floor(i / 5) % 2) * 1, 0, 0.2 + Math.floor(i / 5) * 1.6]} r={Math.PI} person={p} pose={goal || i % 4 === 0 ? 'cheer' : 'idle'} />
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- Coupé-décalé concert ---------- */

function Concert({ seed, night }: { seed: string; night: boolean }) {
  const crowd = useCrowd(16, `concert${seed}`)
  const dj = useMemo<Person>(() => ({ gender: 'homme', look: { ...randomLook('homme', rng(`dj${seed}`)), outfit: 'casual', outfitColor: '#ffffff', accessory: 'glasses', hair: 'locks' }, seed: 3 }), [seed])
  const lights = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    lights.current.forEach((m, i) => {
      if (m) m.rotation.z = Math.sin(worldTime() * 1.8 + i * 2) * 0.5
    })
  })
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Box p={[0, 0.5, -3.4]} s={[9, 1, 4]} c="#2b2140" />
      <Box p={[0, 1.45, -2.4]} s={[2.4, 0.9, 0.9]} c="#141416" />
      <Sign p={[0, 5.2, -5.2]} w={7} text="COUPÉ-DÉCALÉ" bg="#b02bd6" />
      {[-4, 4].map((x) => (
        <group key={x}>
          <Box p={[x, 2.2, -3.6]} s={[1.3, 2.4, 1]} c="#141416" />
          {[1.6, 2.6].map((y) => (
            <mesh key={y} position={[x, y, -3.08]}>
              <circleGeometry args={[0.38, 16]} />
              <meshBasicMaterial color="#495057" />
            </mesh>
          ))}
          <Box p={[x, 2.6, -5.2]} s={[0.15, 5.2, 0.15]} c="#495057" />
        </group>
      ))}
      {['#ff3ec8', '#3bc9db', '#ffd43b'].map((c, i) => (
        <mesh key={c} ref={(m) => void (lights.current[i] = m)} position={[-3 + i * 3, 5, -4]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[1.6, 5, 16, 1, true]} />
          <meshBasicMaterial color={c} transparent opacity={night ? 0.32 : 0.14} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <NoShadows>
        <Guest p={[0, 1, -3.2]} person={dj} pose="dance" />
        {crowd.map((p, i) => (
          <Guest key={i} p={[-4 + (i % 6) * 1.6 + (Math.floor(i / 6) % 2) * 0.7, 0, 0.4 + Math.floor(i / 6) * 1.5]} r={Math.PI + (i % 3) * 0.3 - 0.3} person={p} pose={i % 5 === 0 ? 'cheer' : 'dance'} />
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- Tropical downpour ---------- */

const DROPS = 1400
function Rain() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const drops = useMemo(() => {
    const r = rng('rain')
    return [...Array(DROPS)].map(() => [r() * 120 - 60, r() * 30, r() * 80 - 40, 14 + r() * 8])
  }, [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame((_, dt) => {
    if (!mesh.current) return
    drops.forEach((d, i) => {
      d[1] -= d[3] * Math.min(dt, 0.05)
      if (d[1] < 0) d[1] += 30
      m.makeTranslation(d[0], d[1], d[2])
      mesh.current!.setMatrixAt(i, m)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, DROPS]} frustumCulled={false}>
        <boxGeometry args={[0.03, 0.9, 0.03]} />
        <meshBasicMaterial color="#cfe8ff" transparent opacity={0.55} />
      </instancedMesh>
      {[[-12, 3], [6, -2.5], [22, 1.5], [35, -3], [-30, -1]].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.06, z]}>
          <circleGeometry args={[1.5 + (i % 2), 20]} />
          <meshBasicMaterial color="#8fb3cf" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- Power cut: neighbours around lanterns ---------- */

function Blackout({ seed }: { seed: string }) {
  const crowd = useCrowd(7, `cut${seed}`)
  return (
    <group position={[HAPPENING_X, 0, SIDEWALK + 1]}>
      {[0, 6].map((x) => (
        <group key={x} position={[x - 3, 0, 0]}>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshBasicMaterial color="#ffb547" />
          </mesh>
          <pointLight position={[0, 0.8, 0]} intensity={6} distance={9} color="#ffb547" />
          <Box p={[0, 0.2, 0]} s={[1.6, 0.4, 1.6]} c="#5b3a22" />
        </group>
      ))}
      <NoShadows>
        {crowd.map((p, i) => {
          const a = (i / crowd.length) * Math.PI * 2
          return <Guest key={i} p={[Math.cos(a) * 2.8 + (i % 2 ? 3 : -3), 0, Math.sin(a) * 1.6]} r={-a - Math.PI / 2} person={p} pose="idle" />
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- Traffic jam ---------- */

function Jam() {
  const kinds = ['gbaka', 'taxi', 'woro', 'car', 'gbaka', 'taxi', 'car', 'woro', 'moto', 'taxi'] as const
  return (
    <group>
      {[2.2, -2.2].flatMap((z, lane) =>
        kinds.map((k, i) => (
          <Vehicle key={`${lane}${i}`} p={[-40 + i * 7.5 + lane * 3, 0, z]} r={z > 0 ? 0 : Math.PI} kind={k} color={k === 'woro' ? '#2a6cf0' : k === 'car' ? ['#f8f9fa', '#c92a2a', '#212529'][i % 3] : undefined} />
        )),
      )}
    </group>
  )
}

/* ---------- Police checkpoint ---------- */

function Checkpoint({ seed }: { seed: string }) {
  const officers = useMemo<Person[]>(
    () =>
      [0, 1].map((i) => {
        const gender = i ? 'femme' : 'homme'
        return { gender, look: { ...randomLook(gender, rng(`cop${seed}${i}`)), outfit: 'suit', outfitColor: '#14213d', accessory: 'cap', hair: 'short', beard: 'none' }, seed: i * 7 } as Person
      }),
    [seed],
  )
  const bar = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (bar.current) (bar.current.material as THREE.MeshBasicMaterial).color.set(Math.floor(worldTime() * 3) % 2 ? '#e03131' : '#1c7ed6')
  })
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Vehicle p={[3, 0, 2.2]} kind="car" color="#1f2a44" />
      <Box p={[3, 0.95, 2.2]} s={[4.32, 0.18, 1.82]} c="#f8f9fa" />
      <mesh ref={bar} position={[2.7, 2.1, 2.2]}>
        <boxGeometry args={[0.4, 0.2, 1.2]} />
        <meshBasicMaterial color="#e03131" />
      </mesh>
      <Vehicle p={[-6, 0, 2.2]} kind="gbaka" />
      {/* Spike strip and cones */}
      {[-1.6, -0.4, 0.8, 2].map((z) => (
        <mesh key={z} position={[-1.5, 0.35, z]}>
          <coneGeometry args={[0.22, 0.7, 10]} />
          <Mat color="#ff7a00" />
        </mesh>
      ))}
      <NoShadows>
        <Guest p={[-2.6, 0, 3.6]} r={-Math.PI / 2} person={officers[0]} pose="wave" />
        <Guest p={[0, 0, 4]} r={-Math.PI / 2} person={officers[1]} pose="idle" />
      </NoShadows>
    </group>
  )
}

/* ---------- Marker and dispatcher ---------- */

export function HappeningScene({ id, seed, night }: { id: string; seed: string; night: boolean }) {
  return (
    <group>
      {id === 'mariage' && <Wedding seed={seed} />}
      {id === 'match' && <Match seed={seed} />}
      {id === 'concert' && <Concert seed={seed} night={night} />}
      {id === 'pluie' && <Rain />}
      {id === 'delestage' && <Blackout seed={seed} />}
      {id === 'embouteillage' && <Jam />}
      {id === 'controle' && <Checkpoint seed={seed} />}
      {id === 'foot' && (
        <group position={[HAPPENING_X, 0, 0]}>
          <Football seed={seed} />
        </group>
      )}
      {id === 'basket' && (
        <group position={[HAPPENING_X - 3, 0, 0]}>
          <Basket seed={seed} />
        </group>
      )}
    </group>
  )
}

/**
 * The floating label over the happening. It stays mounted for the life of the
 * scene and only its content changes: drei's <Html> crashes ("removeChild")
 * when one is unmounted while the canvas keeps running.
 */
export function HappeningMarker({ happening, onPick }: { happening: { id: string; icon: string; label: string } | null; onPick: () => void }) {
  const show = happening && happening.id !== 'pluie'
  return (
    <Html position={[HAPPENING_X, 7.5, 0]} center zIndexRange={[25, 0]}>
      {show ? (
        <button onClick={onPick} className="motion-pop flex items-center gap-1.5 rounded-xl bg-[var(--color-gold)] py-1 pr-2.5 pl-1 text-[12.5px] font-extrabold whitespace-nowrap text-[#5a3a00] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.5)] transition duration-200 hover:scale-110 active:scale-95">
          <IconTile icon={iconFor(happening.icon)} colors={['#ffd54f', '#ffa000']} size={24} radius={8} />
          {happening.label}
        </button>
      ) : (
        <span />
      )}
    </Html>
  )
}
