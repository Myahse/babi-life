import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Canvas, advance, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import '../index.css'
import type { Block, Look } from '../lib/types'
import { BlockHuman } from '../avatar/BlockHuman'
import type { Pose } from '../avatar/Human'
import { DEFAULT_LOOK } from '../avatar/options'
import { House } from '../world3d/build/House'
import { Scene } from '../components/Scene'
import { Logo } from '../components/ui'
import { freezeWorldTime } from '../lib/worldClock'

// Dev-only (/poster.html): the game's own blocky Sims for the flyer and the
// video (marketing/). Stills: ?scene=crew|house|dance&t=2 (&alpha for a
// transparent background). The video: ?video, drawn frame by frame by
// marketing/video.mjs through window.__frame(t), which holds the shared
// clock and the 3D scene at that instant.

const q = new URLSearchParams(location.search)
const VIDEO = q.has('video')
const ALPHA = q.has('alpha')
type SceneId = 'crew' | 'house' | 'build' | 'dance'

/** The materials as the server has them (game/build.go). */
const MATERIALS = [
  { id: 'banco', label: 'Banco', color: '#a8673b', price: 75, unlock: 0 },
  { id: 'bois', label: 'Planches', color: '#9c6b3c', price: 100, unlock: 0 },
  { id: 'parpaing', label: 'Parpaing', color: '#9a9a94', price: 150, unlock: 0 },
  { id: 'tole', label: 'Tôle', color: '#a9b4bd', price: 120, unlock: 0 },
  { id: 'verre', label: 'Vitre', color: '#9fd3e8', price: 400, unlock: 200, glass: true },
  { id: 'jaune', label: 'Peinture jaune', color: '#f2c94c', price: 200, unlock: 200 },
]

/** A small house on the plot: cement footing, banco walls, a wooden door, windows, a tin roof. */
const HOUSE: Block[] = (() => {
  const out: Block[] = []
  const [x0, x1, z0, z1] = [2, 9, 3, 8]
  for (let y = 0; y < 4; y++)
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const wall = x === x0 || x === x1 || z === z0 || z === z1
        if (!wall) continue
        const door = z === z1 && (x === 5 || x === 6) && y < 2
        if (door) continue
        const window = y === 1 && ((z === z1 && (x === 3 || x === 8)) || ((x === x0 || x === x1) && (z === 5 || z === 6)))
        const m = y === 0 ? 'parpaing' : window ? 'verre' : y === 3 ? 'jaune' : 'banco'
        out.push([x, y, z, m])
      }
  // The door frame in planks, and the roof in tin with an overhang.
  for (const x of [4, 7]) for (let y = 0; y < 2; y++) out.push([x, y, z1, 'bois'])
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) out.push([x, 4, z, 'tole'])
  // No double blocks (the door frame replaced banco there).
  const seen = new Map<string, Block>()
  for (const b of out) seen.set(`${b[0]},${b[1]},${b[2]}`, b)
  return [...seen.values()].sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0])
})()

const L = (look: Partial<Look>): Look => ({ ...DEFAULT_LOOK, ...look })
const CREW: { look: Look; gender: 'femme' | 'homme'; pose: Pose }[] = [
  { gender: 'homme', pose: 'wave', look: L({ skin: '#6e4024', hair: 'short', outfit: 'debardeur', outfitColor: '#f8f9fa', bottomColor: '', accessory: 'capback', accessoryColor: '#ff7a00' }) },
  { gender: 'femme', pose: 'cheer', look: L({ skin: '#8a5532', hair: 'headwrap', outfit: 'pagne', outfitColor: '#ff7a00', accessory: 'earrings', pattern: 'cercles' }) },
  { gender: 'homme', pose: 'hero', look: L({ skin: '#a46c42', hair: 'locks', outfit: 'boubou', outfitColor: '#00a862', accessory: 'chain', beard: 'bouc' }) },
  { gender: 'femme', pose: 'dance', look: L({ skin: '#583119', hair: 'braids', outfit: 'survet', outfitColor: '#7b5cff', accessory: 'none' }) },
  { gender: 'homme', pose: 'talk', look: L({ skin: '#3f2210', hair: 'afro', outfit: 'jersey', outfitColor: '#ff8200', accessory: 'glasses' }) },
]

const EPOCH = 1_000_000 // a fixed instant on the shared clock: every render is the same

/** Where each of the five stands: in a row on a wide picture, in two rows on a tall one. */
function useSpots() {
  const { width, height } = useThree((s) => s.size)
  return width >= height
    ? CREW.map((_, i) => [(i - 2) * 0.95, Math.abs(i - 2) * -0.25, (2 - i) * 0.12] as [number, number, number])
    : ([[-0.55, 0.55, 0.15], [0.55, 0.55, -0.15], [-1.05, -0.45, 0.3], [0, -0.6, 0], [1.05, -0.45, -0.3]] as [number, number, number][])
}

function Camera({ at, look }: { at: [number, number, number]; look: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  camera.position.set(...at)
  camera.lookAt(...look)
  return null
}

/** One scene of the video (or a still), at t seconds into it. */
function World({ scene, t }: { scene: SceneId; t: number }) {
  const night = scene === 'dance'
  const spots = useSpots()
  const wide = useThree((s) => s.size.width >= s.size.height)
  const grass = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')!
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
        const k = n - Math.floor(n)
        g.fillStyle = k > 0.8 ? '#7cc255' : k < 0.2 ? '#62a443' : '#6fb24b'
        g.fillRect(x, y, 1, 1)
      }
    const tex = new THREE.CanvasTexture(c)
    tex.magFilter = tex.minFilter = THREE.NearestFilter
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(40, 40)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
  const ground = scene !== 'crew' && (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshLambertMaterial map={grass} color={night ? '#6a6fa8' : '#ffffff'} />
    </mesh>
  )
  const lights = (
    <>
      <hemisphereLight args={[night ? '#8f9cff' : '#fff4e6', night ? '#2a2a4e' : '#c0704f', night ? 0.8 : 1.2]} />
      <directionalLight position={[4, 9, 6]} intensity={night ? 0.6 : 2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <directionalLight position={[-4, 3, -3]} intensity={0.7} color="#ffd1a6" />
      <ambientLight intensity={night ? 0.35 : 0.4} />
    </>
  )
  if (scene === 'crew') {
    return (
      <>
        {lights}
        <Camera at={[Math.sin(t * 0.08) * 0.8, 1.3, (wide ? 6.4 : 8.6) - t * 0.12]} look={[0, 0.85, 0]} />
        {CREW.map((c, i) => (
          <group key={i} position={[spots[i][0], 0, spots[i][1]]} rotation={[0, spots[i][2], 0]}>
            <BlockHuman look={c.look} gender={c.gender} pose={c.pose} seed={i * 1.7} />
          </group>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial opacity={0.25} />
        </mesh>
      </>
    )
  }
  if (scene === 'house' || scene === 'build') {
    // Building: the blocks go up one after another, bottom to top.
    const shown = scene === 'build' ? HOUSE.slice(0, Math.min(HOUSE.length, Math.floor(Math.max(0, t - 0.4) * 34))) : HOUSE
    const a = scene === 'build' ? 0.5 + t * 0.09 : 0.62
    const r = wide ? 15.5 : 31
    return (
      <>
        {lights}
        <Camera at={[Math.sin(a) * r, wide ? 7 : 9, Math.cos(a) * r]} look={[0, wide ? 2 : 1.6, 0]} />
        {ground}
        <group position={[-6, 0, -6]}>
          <House blocks={shown} materials={MATERIALS} />
        </group>
        {/* The builder, and a neighbour waving */}
        <group position={[-1.2, 0, 5.4]} rotation={[0, 0.5, 0]}>
          <BlockHuman look={CREW[2].look} gender="homme" pose={scene === 'build' && shown.length < HOUSE.length ? 'busy' : 'cheer'} seed={3} />
        </group>
        <group position={[1.6, 0, 5.8]} rotation={[0, -0.4, 0]}>
          <BlockHuman look={CREW[1].look} gender="femme" pose="wave" seed={5} />
        </group>
      </>
    )
  }
  // Dance: a night in the courtyard, string lights, everyone doing the coupé-décalé.
  const bulbs = [...Array(14)].map((_, i) => [-5 + i * (10 / 13), 3.2 - Math.sin((i / 13) * Math.PI) * 0.6, -1.5] as [number, number, number])
  return (
    <>
      {lights}
      <Camera at={[Math.sin(t * 0.15) * 1.6, 1.9, wide ? 7.5 : 9]} look={[0, 0.9, 0]} />
      {ground}
      {bulbs.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshBasicMaterial color={['#ffc233', '#ff7a00', '#00b86b', '#ffffff'][i % 4]} />
        </mesh>
      ))}
      <pointLight position={[0, 3, 1]} intensity={14} distance={12} color="#ffc27a" />
      {CREW.map((c, i) => (
        <group key={i} position={[spots[i][0] * 1.15, 0, spots[i][1]]} rotation={[0, spots[i][2], 0]}>
          <BlockHuman look={c.look} gender={c.gender} pose={i % 2 ? 'cheer' : 'dance'} seed={i * 2.3} />
        </group>
      ))}
    </>
  )
}

/* ---------- The video: 25 seconds, scene after scene ---------- */

const SHOTS: { from: number; to: number; scene: SceneId; title?: string; sub?: string }[] = [
  { from: 0, to: 3.2, scene: 'crew' },
  { from: 3.2, to: 9, scene: 'crew', title: 'Crée ton Sim', sub: 'Pagne wax, boubou, survêt… à ton style' },
  { from: 9, to: 15.5, scene: 'build', title: 'Construis ta maison', sub: 'Bloc par bloc : banco, parpaing, tôle…' },
  { from: 15.5, to: 20.5, scene: 'dance', title: 'Vis Abidjan avec tes amis', sub: 'Les vrais quartiers, au même moment' },
  { from: 20.5, to: 25, scene: 'house' },
]
const VIDEO_LENGTH = 25 // seconds (marketing/video.mjs reads the same)

const fade = (t: number, a: number, b: number, d = 0.45) => Math.max(0, Math.min(1, (t - a) / d, (b - t) / d))

function Video({ t, qr, url, placeholder }: { t: number; qr: string; url: string; placeholder: boolean }) {
  const shot = SHOTS.find((s) => t >= s.from && t < s.to) ?? SHOTS[SHOTS.length - 1]
  const local = t - shot.from
  const black = 1 - Math.min(1, fade(t, shot.from, shot.to, 0.35) + (shot.from === 0 ? 1 : 0))
  const intro = t < 3.2
  const outro = t >= 20.5
  const pop = (start: number) => {
    const k = Math.max(0, Math.min(1, (t - start) / 0.5))
    return { opacity: k, transform: `translateY(${(1 - k) * 30}px) scale(${0.85 + 0.15 * k})` }
  }
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--color-night)] font-display text-white">
      <div className="absolute inset-0" style={{ opacity: shot.scene === 'dance' ? 0.25 : 1 }}>
        <Scene className="h-full w-full" />
      </div>
      <div className="absolute inset-0" style={{ opacity: intro ? 0 : outro ? 0.35 : 1 }}>
        <Canvas frameloop="never" shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} dpr={2} camera={{ fov: 40, near: 0.1, far: 100 }}>
          <World scene={shot.scene} t={local} />
        </Canvas>
      </div>
      {/* Captions */}
      {shot.title && (
        <div className="absolute inset-x-0 top-[9%] flex flex-col items-center px-8 text-center">
          <div className="rounded-full bg-[var(--color-orange)] px-6 py-2 text-[40px] leading-tight font-extrabold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" style={pop(shot.from + 0.3)}>
            {shot.title}
          </div>
          <div className="mt-4 rounded-2xl bg-[#0f1230]/70 px-5 py-2 font-sans text-[24px] font-extrabold backdrop-blur" style={pop(shot.from + 0.7)}>
            {shot.sub}
          </div>
        </div>
      )}
      {intro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8 text-center">
          <div style={pop(0.2)}>
            <Logo size={84} />
          </div>
          <h1 className="text-[64px] leading-[0.95] font-extrabold tracking-[-0.02em]">
            <span className="block" style={pop(0.8)}>Ta vie.</span>
            <span className="block" style={pop(1.3)}>Ton quartier.</span>
            <span className="block text-[var(--color-orange)]" style={pop(1.8)}>Ton Babi.</span>
          </h1>
        </div>
      )}
      {outro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div style={pop(20.7)}>
            <Logo size={72} />
          </div>
          <div className="text-[52px] leading-[1] font-extrabold" style={pop(21.1)}>
            Bientôt sur
            <br />
            ton téléphone
          </div>
          <div className="flex flex-col items-center gap-4 rounded-[32px] bg-white p-6 text-[var(--color-ink)] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]" style={pop(21.6)}>
            <div className="text-[30px] leading-tight font-extrabold">Inscris-toi sur la liste</div>
            {qr && <img src={qr} alt="" className="h-[220px] w-[220px] [image-rendering:pixelated]" />}
            <div className="font-sans text-[24px] font-extrabold text-[var(--color-orange)]">{url}</div>
            {placeholder && <div className="rounded-lg bg-[#ffeef1] px-3 py-1 font-sans text-[16px] font-extrabold text-[#d81b3f]">ADRESSE PROVISOIRE</div>}
          </div>
          <div className="font-sans text-[22px] font-extrabold text-white/85" style={pop(22.1)}>
            Gratuit · 100 % ivoirien
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: black }} />
      {/* The flag's three stripes, at the bottom */}
      <div className="absolute inset-x-0 bottom-0 flex h-2">
        <i className="flex-1 bg-[#ff8200]" />
        <i className="flex-1 bg-white" />
        <i className="flex-1 bg-[#009a44]" />
      </div>
    </div>
  )
}

declare global {
  interface Window {
    __frame?: (t: number) => void
    __setOutro?: (qr: string, url: string, placeholder: boolean) => void
    __length?: number
  }
}

function Poster() {
  const [t, setT] = useState(Number(q.get('t') ?? 2))
  const [outro, setOutro] = useState({ qr: '', url: 'lifeinbabi.com/liste', placeholder: false })
  useEffect(() => {
    // One frame: hold the clock at t, let React draw, then step the 3D scene to t.
    window.__frame = (s) => {
      freezeWorldTime(EPOCH + s)
      flushSync(() => setT(s))
      advance(s)
    }
    window.__length = VIDEO_LENGTH
    window.__setOutro = (qr, url, placeholder) => flushSync(() => setOutro({ qr, url, placeholder }))
    // Stills: a few steps, so the poses have settled.
    if (!VIDEO) for (let k = 0; k < 20; k++) setTimeout(() => window.__frame!(t - 1 + k * 0.05), 50 * k)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (VIDEO) return <Video t={t} {...outro} />
  return (
    <div className="h-full w-full" style={{ background: ALPHA ? 'transparent' : undefined }}>
      {!ALPHA && (
        <div className="absolute inset-0">
          <Scene className="h-full w-full" />
        </div>
      )}
      <Canvas frameloop="never" shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} dpr={2} camera={{ fov: 40, near: 0.1, far: 100 }}>
        <World scene={(q.get('scene') ?? 'crew') as SceneId} t={t} />
      </Canvas>
    </div>
  )
}

document.documentElement.style.background = ALPHA ? 'transparent' : '#0f1230'
document.body.style.background = 'transparent'
createRoot(document.getElementById('root')!).render(<Poster />)
