import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Material, Plot } from '../../lib/types'
import { serverNow } from '../../lib/worldClock'
import { House } from '../build/House'
import { rng } from '../themes'
import { BOX, lettering } from './ruePrincesse'

// A house built from a plan going up on its lot (backend sims/plot.go): the
// masons raise it row by row from when the site opened to when it's done,
// the scaffolding a little above the last row, the mixer turning, the bricks
// stacked, the sign at the front with the hour it'll be done. It's the house
// being built, not the Sim: the Sim is free meanwhile. In the lot's frame
// (its corner at the origin, +z its front).

const pole = new THREE.MeshLambertMaterial({ color: '#8a8f96' })
const plank = new THREE.MeshLambertMaterial({ color: '#b98a4e' })
const net = new THREE.MeshLambertMaterial({ color: '#2f8f4e', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
const drum = new THREE.MeshLambertMaterial({ color: '#e2862b' })
const brick = new THREE.MeshLambertMaterial({ color: '#b5523a' })
const sand = new THREE.MeshLambertMaterial({ color: '#d8c08a' })

export { building } from '../../game/chantier'

/** The share of the site done (0 → 1), from the shared clock. */
function shareDone(from: number, until: number) {
  return until > from ? Math.min(1, Math.max(0, (serverNow() - from) / (until - from))) : 1
}

export function Chantier({ plot, materials, w, d }: { plot: Plot; materials: Material[]; w: number; d: number }) {
  const until = Date.parse(plot.buildUntil ?? '') || serverNow()
  const from = Date.parse(plot.buildFrom ?? '') || until - 15 * 60000
  const [k, setK] = useState(() => shareDone(from, until))
  useEffect(() => {
    const t = setInterval(() => setK(shareDone(from, until)), 4000)
    return () => clearInterval(t)
  }, [from, until])
  // The rows of blocks up so far: the ground floor first, the roof last.
  const top = useMemo(() => plot.blocks.reduce((m, b) => Math.max(m, b[1] + 1), 1), [plot.blocks])
  const rows = Math.min(top, Math.floor(k * (top + 1)))
  const shown = useMemo(() => plot.blocks.filter((b) => b[1] < rows), [plot.blocks, rows])
  const h = Math.max(2, rows + 1.5)
  const done = new Date(until)
  const sign = useMemo(() => lettering(`CHANTIER · FINI À ${String(done.getUTCHours()).padStart(2, '0')}H${String(done.getUTCMinutes()).padStart(2, '0')}`, '#ffd23f', '#1b1d21', '#1b1d21'), [until]) // eslint-disable-line react-hooks/exhaustive-deps
  const workers = useMemo(() => {
    const r = rng(`masons${plot.key}`)
    return [0, 1, 2].map(() => ({ ...randomLook('homme', r), outfit: 'bleu', accessory: 'none' }))
  }, [plot.key])
  return (
    <group>
      {shown.length > 0 && <House blocks={shown} materials={materials} />}
      <Scaffold w={w} d={d} h={h} />
      {/* The mixer, the bricks, the sand */}
      <Mixer p={[w - 1.4, 0, d + 0.9]} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={BOX} material={brick} position={[1 + i * 0.95, 0.35, d + 1]} scale={[0.85, 0.7, 0.6]} />
      ))}
      <mesh position={[w / 2 + 1.5, 0.3, d + 1.4]} material={sand}>
        <coneGeometry args={[0.9, 0.6, 8]} />
      </mesh>
      {/* The sign at the front, with when it'll be done */}
      <group position={[w / 2 - 1, 0, d + 1.6]}>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} geometry={BOX} material={pole} position={[x, 0.9, 0]} scale={[0.08, 1.8, 0.08]} />
        ))}
        <mesh position={[0, 1.55, 0.05]}>
          <planeGeometry args={[Math.min(3.4, sign.aspect * 0.5), 0.5]} />
          <meshBasicMaterial map={sign.t} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* The masons: one at the bricks, one at the mixer, one up on the scaffolding */}
      <NoShadows>
        <group position={[w * 0.18, 0, d + 0.35]} rotation={[0, Math.PI, 0]}>
          <Human look={workers[0]} gender="homme" pose="busy" seed={41} />
        </group>
        <group position={[w * 0.7, 0, d + 0.7]} rotation={[0, Math.PI + 0.4, 0]}>
          <Human look={workers[1]} gender="homme" pose="cook" seed={42} />
        </group>
        {rows < top && (
          <group position={[-0.7, Math.max(0, h - 2.2), d * 0.5]} rotation={[0, Math.PI / 2, 0]}>
            <Human look={workers[2]} gender="homme" pose="busy" seed={43} />
          </group>
        )}
      </NoShadows>
    </group>
  )
}

/** The scaffolding round the house: poles every few metres, planks at each storey, the green net. */
function Scaffold({ w, d, h }: { w: number; d: number; h: number }) {
  const parts = useMemo(() => {
    const poles: [number, number][] = []
    for (let x = 0; x <= w; x += Math.max(2, w / Math.round(w / 3))) for (const z of [-0.8, d + 0.2]) poles.push([x - 0.4, z])
    for (let z = 0; z <= d; z += Math.max(2, d / Math.round(d / 3))) for (const x of [-0.8, w + 0.2]) poles.push([x, z - 0.4])
    return poles
  }, [w, d])
  const levels = useMemo(() => [...Array(Math.max(1, Math.floor(h / 2)))].map((_, i) => 1.8 + i * 2), [h])
  return (
    <group>
      {parts.map(([x, z], i) => (
        <mesh key={i} geometry={BOX} material={pole} position={[x, h / 2, z]} scale={[0.08, h, 0.08]} />
      ))}
      {levels.map((y) => (
        <group key={y}>
          <mesh geometry={BOX} material={plank} position={[w / 2 - 0.4, y, -0.8]} scale={[w + 0.8, 0.06, 0.5]} />
          <mesh geometry={BOX} material={plank} position={[w / 2 - 0.4, y, d + 0.2]} scale={[w + 0.8, 0.06, 0.5]} />
          <mesh geometry={BOX} material={plank} position={[-0.8, y, d / 2 - 0.4]} scale={[0.5, 0.06, d + 0.8]} />
          <mesh geometry={BOX} material={plank} position={[w + 0.2, y, d / 2 - 0.4]} scale={[0.5, 0.06, d + 0.8]} />
        </group>
      ))}
      {/* The net on the back and one side, over the top storey */}
      <mesh material={net} position={[w / 2 - 0.4, h - 1.2, -1.05]}>
        <planeGeometry args={[w + 0.8, 2.4]} />
      </mesh>
      <mesh material={net} position={[-1.05, h - 1.2, d / 2 - 0.4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[d + 0.8, 2.4]} />
      </mesh>
    </group>
  )
}

/** The cement mixer, its drum turning. */
function Mixer({ p }: { p: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 2.4
  })
  return (
    <group position={p}>
      <mesh geometry={BOX} material={pole} position={[0, 0.35, 0]} scale={[0.9, 0.12, 0.6]} />
      <group position={[0, 0.85, 0]} rotation={[0, 0, 0.6]}>
        <mesh ref={ref} material={drum}>
          <cylinderGeometry args={[0.28, 0.45, 0.8, 10]} />
        </mesh>
      </group>
      {[-0.35, 0.35].map((x) => (
        <mesh key={x} geometry={BOX} material={pole} position={[x, 0.2, 0]} scale={[0.06, 0.4, 0.06]} />
      ))}
    </group>
  )
}
