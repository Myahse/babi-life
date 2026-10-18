import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Hammer, Lock, Pickaxe, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { ActionResult, Block, Material, Sim, World } from '../lib/types'
import { amount } from '../game/rules'
import { Character } from '../world3d/Character'
import { House, materialTexture } from '../world3d/build/House'
import { Coin } from './ui'

// Building one's own house, Minecraft-style, on the Sim's plot: tap the
// ground or the face of a block to put a block there, or switch to « Casser »
// to take one down (half its price back). Basic materials are there from the
// start; better ones unlock as the house grows. Edits are saved in small
// batches, paid from the Sim's money, and everyone in the commune sees the
// house where the Sim lives.

type Cell = [number, number, number]
const key = ([x, y, z]: Cell) => `${x},${y},${z}`

export default function BuildMode({ world, sim, onResult, onClose }: { world: World; sim: Sim; onResult: (res: ActionResult) => void; onClose: () => void }) {
  const { w: W, d: D, h: H } = world.plot ?? { w: 12, d: 12, h: 8 }
  const materials = world.materials ?? []
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [built, setBuilt] = useState(0)
  const [pick, setPick] = useState(materials[0]?.id ?? 'banco')
  const [mode, setMode] = useState<'place' | 'remove'>('place')
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<Cell | null>(null)

  const reload = () =>
    api
      .plot(sim.id)
      .then((p) => {
        setBlocks(p.blocks)
        setBuilt(p.built)
      })
      .catch(() => setError('Le terrain ne charge pas. Réessaie.'))
  useEffect(() => void reload(), [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Edits waiting to be saved: sent together a moment after the last tap.
  const queue = useRef<{ place: Map<string, Block>; remove: Map<string, Cell> }>({ place: new Map(), remove: new Map() })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingCost, setPendingCost] = useState(0)
  const priceOf = (id: string) => materials.find((m) => m.id === id)?.price ?? 0
  const flush = () => {
    timer.current = null
    const q = queue.current
    if (!q.place.size && !q.remove.size) return
    queue.current = { place: new Map(), remove: new Map() }
    const place = [...q.place.values()]
    setPendingCost(0)
    api
      .build(sim.id, place, [...q.remove.values()])
      .then((res) => {
        setBuilt((b) => b + place.length)
        onResult(res)
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Pas de réseau : rien n’a été enregistré.')
        void reload()
      })
  }
  const later = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 600)
  }
  // Leaving saves what's left.
  useEffect(() => () => void (timer.current && (clearTimeout(timer.current), flush())), []) // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => new Map((blocks ?? []).map((b) => [key([b[0], b[1], b[2]]), b])), [blocks])
  const inside = ([x, y, z]: Cell) => x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H
  const material = materials.find((m) => m.id === pick)
  const money = sim.money - pendingCost
  const placedSoFar = built + queue.current.place.size

  const place = (c: Cell) => {
    if (!blocks || !material || !inside(c) || grid.has(key(c))) return
    if (material.unlock > placedSoFar) return setError(`${material.label} : construis encore ${material.unlock - placedSoFar} blocs pour le débloquer.`)
    if (money < material.price) return setError("Pas assez d'argent pour ce bloc.")
    const b: Block = [c[0], c[1], c[2], material.id]
    queue.current.place.set(key(c), b)
    setPendingCost((p) => p + material.price)
    setBlocks([...blocks, b])
    setError(null)
    later()
  }
  const remove = (c: Cell) => {
    const b = grid.get(key(c))
    if (!blocks || !b) return
    // Placed in this same batch: just not sent.
    if (queue.current.place.delete(key(c))) setPendingCost((p) => p - priceOf(b[3]))
    else {
      queue.current.remove.set(key(c), c)
      setPendingCost((p) => p - Math.floor(priceOf(b[3]) / 2))
    }
    setBlocks(blocks.filter((x) => x !== b))
    setError(null)
    later()
  }

  // Where a tap lands: next to the face touched, or the block itself to break it.
  const onBlock = (c: Cell, n: Cell, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return // that was a drag to turn the view
    if (mode === 'remove') remove(c)
    else place([c[0] + n[0], c[1] + n[1], c[2] + n[2]])
  }
  const onGround = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || mode === 'remove') return
    e.stopPropagation()
    place([Math.floor(e.point.x + W / 2), 0, Math.floor(e.point.z + D / 2)])
  }
  const ghost = hover && (mode === 'remove' || (inside(hover) && !grid.has(key(hover)))) ? hover : null

  return (
    <div className="absolute inset-0 z-40 bg-[#9fd8f5]">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [11, 11, 15], fov: 40 }} onPointerMissed={() => setHover(null)}>
        <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
        <directionalLight position={[8, 14, 6]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
        <ambientLight intensity={0.35} />
        {/* The plot: grass, a grid of blocks, a kerb round it */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={onGround} onPointerMove={(e) => (e.stopPropagation(), setHover(mode === 'remove' ? null : [Math.floor(e.point.x + W / 2), 0, Math.floor(e.point.z + D / 2)]))}>
          <planeGeometry args={[W, D]} />
          <meshLambertMaterial map={grass(W, D)} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[W + 30, D + 30]} />
          <meshLambertMaterial color="#cbb38c" />
        </mesh>
        <group position={[-W / 2, 0, -D / 2]}>
          {blocks && <House blocks={blocks} materials={materials} onBlock={onBlock} onHover={(c, n) => setHover(c && n && mode === 'place' ? [c[0] + n[0], c[1] + n[1], c[2] + n[2]] : c)} />}
          {ghost && (
            <mesh position={[ghost[0] + 0.5, ghost[1] + 0.5, ghost[2] + 0.5]} raycast={() => null}>
              <boxGeometry args={[1.02, 1.02, 1.02]} />
              <meshBasicMaterial color={mode === 'remove' ? '#ff4d6d' : '#ffffff'} transparent opacity={0.35} depthWrite={false} />
            </mesh>
          )}
        </group>
        {/* The Sim, beside the plot, for scale */}
        <group position={[W / 2 + 1.4, 0, 1]} rotation={[0, -Math.PI / 2, 0]}>
          <Character look={sim.look} gender={sim.gender} pose="idle" />
        </group>
        <OrbitControls makeDefault target={[0, 1.5, 0]} minPolarAngle={0.3} maxPolarAngle={1.45} minDistance={8} maxDistance={32} />
      </Canvas>

      {/* Top: the money, and done */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="hud pointer-events-auto flex h-11 items-center gap-2 rounded-full px-4">
          <Hammer size={18} strokeWidth={2.6} className="text-[var(--color-orange)]" />
          <span className="font-display text-lg font-extrabold">Mon terrain</span>
          <span className="text-xs font-extrabold text-[var(--color-ink-soft)] max-sm:hidden">{blocks?.length ?? 0} blocs</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hud flex h-11 items-center gap-1.5 rounded-full pr-4 pl-1.5">
            <Coin size={30} />
            <span className="tnum font-display text-lg font-extrabold">{amount(money)}</span>
          </div>
          <button className="icon-btn hud" onClick={onClose} aria-label="Terminer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* Bottom: place or break, and the materials */}
      <div className="absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && (
          <p className="sheet mx-auto mb-2 w-fit max-w-full rounded-2xl px-4 py-2 text-sm font-bold text-[#d81b3f]" role="status">
            {error}
          </p>
        )}
        <div className="sheet mx-auto flex max-w-[720px] items-stretch gap-2 rounded-[24px] p-2">
          <div className="flex shrink-0 flex-col gap-1">
            {(
              [
                ['place', Hammer, 'Poser'],
                ['remove', Pickaxe, 'Casser'],
              ] as const
            ).map(([id, Icon, label]) => (
              <button key={id} onClick={() => (setMode(id), setHover(null))} aria-pressed={mode === id} className={`flex h-11 w-[84px] items-center justify-center gap-1.5 rounded-2xl text-sm font-extrabold transition ${mode === id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)]'}`}>
                <Icon size={16} strokeWidth={2.6} /> {label}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {materials.map((m) => (
              <MaterialTile key={m.id} m={m} picked={pick === m.id && mode === 'place'} locked={m.unlock > placedSoFar} toGo={m.unlock - placedSoFar} onPick={() => (setPick(m.id), setMode('place'))} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MaterialTile({ m, picked, locked, toGo, onPick }: { m: Material; picked: boolean; locked: boolean; toGo: number; onPick: () => void }) {
  const swatch = useMemo(() => (materialTexture(m).image as HTMLCanvasElement).toDataURL(), [m])
  return (
    <button onClick={onPick} disabled={locked} className={`flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 transition ${picked ? 'bg-[#fff4e8] ring-2 ring-[var(--color-orange)]' : 'bg-[var(--color-canvas)]'} ${locked ? 'opacity-55 grayscale-[0.6]' : 'active:scale-95'}`}>
      <span className="relative block h-10 w-10 rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ backgroundImage: `url(${swatch})`, backgroundSize: 'cover', imageRendering: 'pixelated' }}>
        {locked && <Lock size={16} strokeWidth={2.8} className="absolute inset-0 m-auto text-white drop-shadow" />}
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight font-extrabold">{m.label}</span>
      <span className="text-[10px] leading-none font-bold text-[var(--color-ink-soft)]">{locked ? `à ${toGo} blocs` : `${amount(m.price)} Djai`}</span>
    </button>
  )
}

/** Grass with a faint grid of one-metre squares, pixel style. */
let grassTex: THREE.CanvasTexture | null = null
function grass(w: number, d: number) {
  if (!grassTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')!
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
        const k = n - Math.floor(n)
        g.fillStyle = x === 0 || y === 0 ? '#5d9a3e' : k > 0.8 ? '#7cc255' : k < 0.2 ? '#62a443' : '#6fb24b'
        g.fillRect(x, y, 1, 1)
      }
    grassTex = new THREE.CanvasTexture(c)
    grassTex.magFilter = grassTex.minFilter = THREE.NearestFilter
    grassTex.generateMipmaps = false
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
    grassTex.colorSpace = THREE.SRGBColorSpace
  }
  grassTex.repeat.set(w, d)
  return grassTex
}
