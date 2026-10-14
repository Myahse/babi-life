import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// The alloco tanties: a stall at the edge of the street (a table, the pot of
// oil on the charcoal stove, the basin of plantain, a parasol) and the tantie
// behind it. Tap her to buy 300 F of alloco… when she has some left. When she
// hasn't, it's « Ya pas banane oh ! ». The stalls stand on the real streets
// around the Sim, always at the same corners.

type Stall = { id: string; at: XZ; rot: number; seed: number }

const NEAR = 320 // metres: stalls drawn around the Sim
const MAX = 5
const REACH = 25 // metres: close enough to buy

export function AllocoStalls({ nav, seed, onBuy }: { nav: Nav; seed: string; onBuy?: (vendor: string) => Promise<string | null> }) {
  // Every possible stall of the loaded streets: a few street sides, chosen by
  // where they are, so a stall is found again at the same place.
  const all = useMemo(() => {
    const out: Stall[] = []
    for (const e of nav.edges) {
      if (e.width > 10 || e.len < 30 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      if (hash(Math.round(m[0]), Math.round(m[1]), 77) > 0.07) continue
      const side = hash(Math.round(m[1]), 3) < 0.5 ? 1 : -1
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      const off = e.width / 2 + 3
      const at: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
      if (!nav.walkable(at[0], at[1])) continue
      // Facing the street.
      const rot = Math.atan2(m[0] - at[0], m[1] - at[1])
      out.push({ id: `alloco:${seed}:${Math.round(at[0])}:${Math.round(at[1])}`, at, rot, seed: hash(at[0], at[1]) })
    }
    return out
  }, [nav, seed])

  // The few nearest the Sim, rechecked as it walks.
  const [shown, setShown] = useState<Stall[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = all
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => x.s)
    if (near.map((s) => s.id).join() !== shown.map((s) => s.id).join()) setShown(near)
  })
  return (
    <>
      {shown.map((s) => (
        <AllocoStall key={s.id} stall={s} onBuy={onBuy} />
      ))}
    </>
  )
}

const wood = new THREE.MeshLambertMaterial({ color: '#8a5a32' })
const cloth = new THREE.MeshLambertMaterial({ color: '#e8d6a8' })
const iron = new THREE.MeshLambertMaterial({ color: '#2a2a2a' })
const oil = new THREE.MeshLambertMaterial({ color: '#c98a1c', emissive: '#5a3200', emissiveIntensity: 0.4 })
const coal = new THREE.MeshLambertMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 0.8 })
const plantain = new THREE.MeshLambertMaterial({ color: '#e7c23a' })
const fried = new THREE.MeshLambertMaterial({ color: '#d9822b' })
const basin = new THREE.MeshLambertMaterial({ color: '#2f7fd0' })

/** One stall and its tantie. Local +z faces the street. */
export function AllocoStall({ stall, onBuy }: { stall: Stall; onBuy?: (vendor: string) => Promise<string | null> }) {
  const look = useMemo(() => randomLook('femme', rng(stall.id)), [stall.id])
  const parasol = useMemo(() => ['#e8432f', '#1f9a4a', '#f2a81d', '#2f7fd0'][Math.floor(stall.seed * 4)], [stall.seed])
  const [said, setSaid] = useState<string | null>(null)
  const [near, setNear] = useState(false)
  const shout = useRef(0)
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(clear.current), [])
  const say = (text: string, ms = 6000) => {
    setSaid(text)
    clearTimeout(clear.current)
    clear.current = setTimeout(() => setSaid(null), ms)
  }
  useFrame((_, dt) => {
    const d = Math.hypot(stall.at[0] - whereabouts.sim[0], stall.at[1] - whereabouts.sim[1])
    if (d < 30 !== near) setNear(d < 30)
    // She calls out to the passers-by now and then.
    shout.current -= dt
    if (d < 45 && shout.current <= 0) {
      shout.current = 14 + stall.seed * 10
      if (!said) say('Alloco chaud, 300 F !', 3500)
    }
  })
  const tap = async () => {
    const d = Math.hypot(stall.at[0] - whereabouts.sim[0], stall.at[1] - whereabouts.sim[1])
    if (d > REACH) return say('Approche, mon enfant !', 3000)
    if (!onBuy) return
    say('…', 20000)
    const text = await onBuy(stall.id)
    if (text) say(text)
    else setSaid(null)
  }
  return (
    <group position={[stall.at[0], 0, stall.at[1]]} rotation={[0, stall.rot, 0]} onClick={(e) => (e.stopPropagation(), void tap())}>
      {/* The table, its cloth, the basin of plantain and the fried pieces */}
      <mesh position={[0, 0.85, 0.9]} material={cloth} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.08, 0.8]} />
      </mesh>
      {[
        [-0.7, 0.55],
        [0.7, 0.55],
        [-0.7, 1.25],
        [0.7, 1.25],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.42, z]} material={wood}>
          <boxGeometry args={[0.07, 0.84, 0.07]} />
        </mesh>
      ))}
      <mesh position={[-0.4, 0.98, 0.9]} material={basin}>
        <cylinderGeometry args={[0.32, 0.24, 0.18, 12]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.52 + (i % 2) * 0.22, 1.1, 0.82 + Math.floor(i / 2) * 0.16]} rotation={[0, i * 0.7, 0.3]} material={plantain}>
          <boxGeometry args={[0.36, 0.07, 0.08]} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={`f${i}`} position={[0.25 + (i % 3) * 0.13, 0.93, 0.8 + Math.floor(i / 3) * 0.17]} rotation={[0, i, 0]} material={fried}>
          <boxGeometry args={[0.1, 0.06, 0.1]} />
        </mesh>
      ))}
      {/* The charcoal stove and the pot of oil, beside her */}
      <group position={[1.15, 0, 0.2]}>
        <mesh position={[0, 0.25, 0]} material={iron}>
          <cylinderGeometry args={[0.3, 0.22, 0.5, 10]} />
        </mesh>
        <mesh position={[0, 0.51, 0]} material={coal}>
          <cylinderGeometry args={[0.24, 0.24, 0.03, 10]} />
        </mesh>
        <mesh position={[0, 0.66, 0]} material={iron}>
          <cylinderGeometry args={[0.38, 0.26, 0.26, 14, 1, true]} />
        </mesh>
        <mesh position={[0, 0.76, 0]} rotation={[-Math.PI / 2, 0, 0]} material={oil}>
          <circleGeometry args={[0.36, 14]} />
        </mesh>
      </group>
      {/* The parasol */}
      <mesh position={[-0.95, 1.3, 0.35]} material={wood}>
        <cylinderGeometry args={[0.03, 0.03, 2.6, 6]} />
      </mesh>
      <mesh position={[-0.95, 2.65, 0.35]} castShadow>
        <coneGeometry args={[1.6, 0.6, 8, 1, true]} />
        <meshLambertMaterial color={parasol} side={THREE.DoubleSide} />
      </mesh>
      {/* The tantie, behind her table */}
      <Human look={look} gender="femme" pose="idle" seed={stall.seed * 100} />
      {/* What she says */}
      {(said || near) && (
        <Html position={[0, 2.4, 0]} center zIndexRange={[25, 0]}>
          <button
            onClick={() => void tap()}
            className={`rounded-2xl rounded-bl-sm border border-black/5 px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)] transition active:scale-95 ${said === 'Ya pas banane oh !' ? 'bg-[#ffe08a] text-[#5a3a00]' : 'bg-white text-[var(--color-ink)]'}`}
          >
            {said ?? 'Alloco ? Viens prendre !'}
          </button>
        </Html>
      )}
    </group>
  )
}
