import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Canvas, advance, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import '../index.css'
import type { Block, Look } from '../lib/types'
import { BlockHuman } from '../avatar/BlockHuman'
import type { Pose } from '../avatar/Human'
import { DEFAULT_LOOK, HAIRS } from '../avatar/options'
import { House } from '../world3d/build/House'
import { Scene } from '../components/Scene'
import { Logo } from '../components/ui'
import { freezeWorldTime } from '../lib/worldClock'
import { Vehicle } from '../world3d/vehicles'
import { Dressing } from '../world3d/open/dressing'
import { Sign, TableSet } from '../world3d/props'
import { AppLogo } from '../components/AppLogo'
import { FamilyGroup } from '../avatar/Family'
import { ArenaWorld } from '../world3d/interior/Arena'
import { Landmark } from '../world3d/open/landmarks'
import { NoteShower } from '../world3d/money'
import { OUTFITS, OUTFIT_DEFAULT_COLOR } from '../avatar/options'
import type { Sim } from '../lib/types'
import { Map as MapIcon, MessageCircle, Newspaper } from 'lucide-react'

// Dev-only (/poster.html): the game's own blocky Sims for the flyer and the
// video (marketing/). Stills: ?scene=crew|house|dance&t=2 (&alpha for a
// transparent background). The video: ?video, drawn frame by frame by
// marketing/video.mjs through window.__frame(t), which holds the shared
// clock and the 3D scene at that instant.

const q = new URLSearchParams(location.search)
const VIDEO = q.has('video')
const ALPHA = q.has('alpha')
type SceneId = 'crew' | 'house' | 'build' | 'dance' | 'gbaka' | 'gnango' | 'princesse' | `famille-${string}` | 'palais' | 'basket' | 'fete' | 'cause' | 'look' | 'siporex' | 'phone' | 'visages' | 'coiffures'
/**
 * Which film: ?video (the launch), ?video=bouger (getting about: gbaka,
 * Gnango, Rue Princesse), ?video=bande-annonce (the trailer: gnambro or
 * laté?) or ?video=decouverte (everything there is to do, one by one).
 */
type FilmId = 'lancement' | 'bouger' | 'bande-annonce' | 'decouverte'
const FILM = (q.get('video') || 'lancement') as FilmId

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

/** The Sim on the court of the Palais des Sports. */
const LAB_SIM = { id: 'poster', firstName: 'Awa', lastName: 'Koné', gender: 'femme', look: CREW[3].look } as unknown as Sim

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
  const night = scene === 'dance' || scene === 'fete'
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
  if (scene.startsWith('famille-')) {
    // The birth: the family at home (famille-gnambro … famille-debout), the camera coming slowly closer.
    return (
      <>
        {lights}
        <Camera at={[Math.sin(t * 0.12) * 0.7, 1.55, (wide ? 4.8 : 6.6) - t * 0.12]} look={[0, 0.95, 0]} />
        <FamilyGroup familyId={scene.slice('famille-'.length)} look={CREW[3].look} gender="femme" />
      </>
    )
  }
  if (scene === 'palais' || scene === 'siporex') {
    // A landmark, the camera turning round it.
    const palais = scene === 'palais'
    const a = (palais ? -0.5 : 0.35) + t * 0.035
    const r = palais ? (wide ? 92 : 128) : wide ? 40 : 54
    return (
      <>
        <hemisphereLight args={['#fff4e6', '#c0704f', 1.2]} />
        <directionalLight position={[40, 80, 50]} intensity={2.2} />
        <ambientLight intensity={0.4} />
        <Camera at={[Math.sin(a) * r, palais ? 16 : 14, Math.cos(a) * r]} look={[0, palais ? 11 : 1, palais ? 0 : -4]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[600, 600]} />
          <meshLambertMaterial map={grass} />
        </mesh>
        <Landmark id={palais ? 'treich-palais' : 'yop-gare-siporex'} night={false} />
      </>
    )
  }
  if (scene === 'basket') {
    // On the court of the Palais des Sports, behind the Sim dribbling toward the hoop.
    return (
      <>
        <Camera at={[2.7 - t * 0.2, 2.6, 2.4]} look={[9.2, 1.7, 0.3]} />
        <ArenaWorld sim={LAB_SIM} placeId="treich-palais" interactionId="play-basket" stage="adulte" />
      </>
    )
  }
  if (scene === 'fete') {
    // A night at the maquis: the dancers, and the Sim raining banknotes on them.
    const bulbs = [...Array(14)].map((_, i) => [-5 + i * (10 / 13), 3.2 - Math.sin((i / 13) * Math.PI) * 0.6, -1.5] as [number, number, number])
    return (
      <>
        {lights}
        <Camera at={[2.6 + Math.sin(t * 0.2) * 0.6, 2, wide ? 6.4 : 8.2]} look={[0, 1, 0.3]} />
        {ground}
        {bulbs.map((p, i) => (
          <mesh key={i} position={p}>
            <boxGeometry args={[0.14, 0.14, 0.14]} />
            <meshBasicMaterial color={['#ffc233', '#ff7a00', '#00b86b', '#ffffff'][i % 4]} />
          </mesh>
        ))}
        <pointLight position={[0, 3, 1.5]} intensity={16} distance={12} color="#ffc27a" />
        {[CREW[1], CREW[3], CREW[4]].map((c, i) => (
          <group key={i} position={[(i - 1) * 1.1, 0, -0.6 + Math.abs(i - 1) * 0.3]} rotation={[0, (1 - i) * 0.25, 0]}>
            <BlockHuman look={c.look} gender={c.gender} pose={i === 1 ? 'cheer' : 'dance'} seed={i * 2.3} />
          </group>
        ))}
        <group position={[0.3, 0, 1.7]} rotation={[0, Math.PI, 0]}>
          <BlockHuman look={CREW[2].look} gender="homme" pose="throw" seed={7} />
          <NoteShower from={[0.3, 1.72, 0.3]} toward={[0, 0.35, 1]} seed={3} />
        </group>
      </>
    )
  }
  if (scene === 'look') {
    // The wardrobe: the same Sim, a new outfit every second.
    const outfits = ['pagne', 'boubou', 'survet', 'bazin', 'jersey', 'chemise-pagne', 'kaba', 'basket']
    const outfit = outfits[Math.floor(t / 0.9) % outfits.length]
    const known = OUTFITS.some((o) => o.id === outfit) ? outfit : 'pagne'
    const look = { ...CREW[1].look, outfit: known, outfitColor: OUTFIT_DEFAULT_COLOR[known] ?? ['#ff7a00', '#00a862', '#7b5cff', '#f2c94c'][Math.floor(t / 0.9) % 4], hair: ['headwrap', 'braids', 'puffs', 'bun'][Math.floor(t / 1.8) % 4] }
    return (
      <>
        {lights}
        <Camera at={[Math.sin(t * 0.5) * (wide ? 3.3 : 5.6), 1.4, Math.cos(t * 0.5) * (wide ? 3.3 : 5.6)]} look={[0, 1.05, 0]} />
        <BlockHuman look={look} gender="femme" pose="hero" seed={2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[0.9, 40]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
      </>
    )
  }
  if (scene === 'cause') return <Street scene="cause" t={t} />
  if (scene === 'coiffures') {
    // Every hairstyle, seven at a time (t < 5 or 10–15: the first seven), turning slowly; from behind after t = 10.
    const first = t < 5 || (t >= 10 && t < 15)
    const page = HAIRS.filter((h) => h.id !== 'bald').slice(first ? 0 : 7, first ? 7 : 14)
    return (
      <>
        {lights}
        <Camera at={[0, 1.66, wide ? 3.4 : 4.4]} look={[0, 1.45, 0]} />
        {page.map((h, i) => (
          <group key={h.id} position={[(i - (page.length - 1) / 2) * 0.66, 0, 0]} rotation={[0, (t >= 10 ? Math.PI : 0) + Math.sin(t * 0.6 + i) * 0.5, 0]}>
            <BlockHuman look={{ ...CREW[i % CREW.length].look, hair: h.id, accessory: 'none', outfit: 'chemise', hairColor: i % 3 ? '#141010' : '#5a3418' }} gender={i % 2 ? 'homme' : 'femme'} pose="idle" seed={i} />
          </group>
        ))}
      </>
    )
  }
  if (scene === 'visages') {
    // Up close: the crew's faces and hands, standing about (their gestures: fidgetAt).
    return (
      <>
        {lights}
        <Camera at={[0, 1.45, wide ? 2.6 : 3.4]} look={[0, 1.3, 0]} />
        {CREW.slice(0, 4).map((c, i) => (
          <group key={i} position={[(i - 1.5) * 0.62, 0, 0]}>
            <BlockHuman look={c.look} gender={c.gender} pose="idle" seed={i * 1.7 + 0.4} />
          </group>
        ))}
      </>
    )
  }
  if (scene === 'crew' || scene === 'phone') {
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
  if (scene === 'gbaka' || scene === 'gnango' || scene === 'princesse') return <Street scene={scene} t={t} />
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

/* ---------- Getting about: the gbaka, Gnango, the Rue Princesse ---------- */

const ease = (k: number) => k * k * (3 - 2 * k)
const clamp01 = (k: number) => Math.max(0, Math.min(1, k))

/** A street seen from the pavement: the road, the far side's shops, and what's going on. */
function Street({ scene, t }: { scene: 'gbaka' | 'gnango' | 'princesse' | 'cause'; t: number }) {
  const wide = useThree((s) => s.size.width >= s.size.height)
  const night = scene === 'princesse'
  const facades: [number, number, string][] = [[-6.4, 7, '#e9a23b'], [0, 9, night ? '#2f2a5e' : '#5aa0d8'], [6.4, 6.5, night ? '#7b3fa0' : '#f2c94c']]
  // The gbaka: comes in, stops at the gare while people climb in, goes.
  const gbakaX = t < 2.2 ? -22 + 22 * ease(clamp01(t / 2.2)) : t < 6 ? 0 : 0 + 25 * clamp01((t - 6) / 2.2) ** 2
  // The Gnango car: comes in once booked, stops in front of the Sim.
  const carX = 22 * (1 - ease(clamp01((t - 3.6) / 2.4)))
  const boarding = clamp01((t - 4.4) / 0.8)
  return (
    <>
      <hemisphereLight args={[night ? '#a9b4ff' : '#fff4e6', night ? '#3a2a5e' : '#c0704f', night ? 1.0 : 1.2]} />
      <directionalLight position={[4, 9, 8]} intensity={night ? 0.35 : 2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <ambientLight intensity={night ? 0.5 : 0.4} />
      {night && (
        <>
          <pointLight position={[-3, 3.5, 2]} intensity={22} distance={14} color="#ff2d95" />
          <pointLight position={[3, 3.5, 2]} intensity={22} distance={14} color="#2de2ff" />
          <pointLight position={[0, 3, 5]} intensity={14} distance={12} color="#ffc27a" />
        </>
      )}
      <Camera at={scene === 'princesse' ? [Math.sin(t * 0.18) * 1.2, 1.5, 15.5] : scene === 'cause' ? [0.4 + t * 0.06, 2.0, wide ? 9.5 : 14.5] : [0.6, 1.4, 17.5]} look={scene === 'cause' ? [0.4, 1.8, 3.6] : [0.4, scene === 'princesse' ? 2.9 : 3.1, 0]} />
      {/* Road, its dashed line, the pavements */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.4]} receiveShadow>
        <planeGeometry args={[60, 7.6]} />
        <meshLambertMaterial color={night ? '#2b2d3a' : '#5b5f6b'} />
      </mesh>
      {[...Array(14)].map((_, i) => (
        <mesh key={i} position={[-26 + i * 4, 0.01, -0.4]}>
          <boxGeometry args={[2, 0.02, 0.18]} />
          <meshLambertMaterial color="#f4f4f0" />
        </mesh>
      ))}
      {[[3.9, 0.9], [-4.9, 0.9]].map(([z, d]) => (
        <mesh key={z} position={[0, 0.09, z + (z > 0 ? 1.2 : -1.2)]} receiveShadow>
          <boxGeometry args={[60, 0.18, 2.4 + d]} />
          <meshLambertMaterial color={night ? '#6b6478' : '#cfc5b4'} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 10]} receiveShadow>
        <planeGeometry args={[60, 10]} />
        <meshLambertMaterial color={night ? '#3a3448' : '#cbb38c'} />
      </mesh>
      {/* The far side: shops and their signs */}
      {facades.map(([x, h, c]) => (
        <mesh key={x} position={[x, h / 2, -9.5]} castShadow receiveShadow>
          <boxGeometry args={[6.2, h, 3]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
      {scene === 'gbaka' && (
        <>
          <Sign p={[0, 5.2, -7.9]} w={5.6} text="GARE D'ADJAMÉ" bg="#00a862" />
          <Sign p={[0, 3.6, -7.9]} w={3.4} text="YOP · 300 F" bg="#ff7a00" />
          <group position={[gbakaX, 0, 1.4]}>
            <Vehicle p={[0, 0, 0]} kind="gbaka" color="#f4c430" trim="#00a862" />
          </group>
          {/* Two waiting at the stop, who climb in */}
          {boarding < 1 &&
            [0, 1].map((i) => (
              <group key={i} position={[-1.3 - i * 0.9 + boarding * (2.2 + i * 0.9), 0.18, 4.3 - boarding * 1.6]} rotation={[0, t > 4.4 ? -Math.PI * 0.75 : Math.PI * 0.9, 0]}>
                <BlockHuman look={CREW[i * 3].look} gender={CREW[i * 3].gender} pose={t > 4.4 ? 'walk' : i ? 'idle' : 'wave'} seed={i * 4} />
              </group>
            ))}
        </>
      )}
      {scene === 'gnango' && (
        <>
          <Sign p={[0, 5.2, -7.9]} w={4.4} text="COCODY" bg="#7b5cff" />
          <group position={[carX, 0, 1.4]}>
            <Vehicle p={[0, 0, 0]} kind="car" color="#212529" seed={1} />
          </group>
          <group position={[1.1, 0.18, 4.4]} rotation={[0, Math.PI * 0.85, 0]}>
            <BlockHuman look={CREW[1].look} gender="femme" pose={t > 6.2 ? 'cheer' : t > 3.4 ? 'wave' : 'talk'} seed={6} />
          </group>
        </>
      )}
      {scene === 'cause' && (
        <>
          <Sign p={[0, 5.2, -7.9]} w={4.4} text="ADJAMÉ" bg="#e8590c" />
          {/* Two who meet on the pavement, and the grin round the teapot */}
          <group position={[-0.9, 0.18, 4.4]} rotation={[0, Math.PI / 2 - 0.3, 0]}>
            <BlockHuman look={CREW[0].look} gender="homme" pose={Math.floor(t / 1.6) % 2 ? 'wave' : 'talk'} seed={1} />
          </group>
          <group position={[0.9, 0.18, 4.4]} rotation={[0, -Math.PI / 2 + 0.3, 0]}>
            <BlockHuman look={CREW[4].look} gender="homme" pose={Math.floor(t / 1.6) % 2 ? 'talk' : 'cheer'} seed={2} />
          </group>
          <TableSet p={[3.6, 0.18, 5.4]} c="#2a6cf0" />
          <group position={[4.65, 0.18, 5.4]} rotation={[0, -Math.PI / 2, 0]}>
            <BlockHuman look={CREW[2].look} gender="homme" pose="drink" seed={3} />
          </group>
          <group position={[-3.8 + t * 1.1, 0.18, 3.2]} rotation={[0, Math.PI / 2, 0]}>
            <BlockHuman look={CREW[3].look} gender="femme" pose="walk" seed={4} />
          </group>
        </>
      )}
      {scene === 'princesse' && (
        <>
          <Sign p={[0, 5.1, -7.9]} w={6} text="RUE PRINCESSE" bg="#ff2d95" />
          <group position={[0, 0, -8]}>
            <Dressing kind="club" seed={1} night />
          </group>
          {/* The maquis on the pavement: tables, and a string of bulbs over the street */}
          <TableSet p={[2.3, 0.18, 5.2]} c="#e8432f" />
          {[0, 1].map((i) => (
            <group key={i} position={[2.3 + (i ? 1.05 : -1.05), 0.18, 5.2]} rotation={[0, i ? -Math.PI / 2 : Math.PI / 2, 0]}>
              <BlockHuman look={CREW[i ? 4 : 0].look} gender="homme" pose={i ? 'drink' : 'sit'} seed={i * 3} />
            </group>
          ))}
          {[...Array(16)].map((_, i) => (
            <mesh key={i} position={[-7 + i * 0.95, 3.6 - Math.sin((i / 15) * Math.PI) * 0.7, 2.5]}>
              <boxGeometry args={[0.16, 0.16, 0.16]} />
              <meshBasicMaterial color={['#ffd36b', '#ff6b6b', '#6bd3ff', '#7cf08a'][i % 4]} />
            </mesh>
          ))}
          {/* Coupé-décalé in the street */}
          {[CREW[1], CREW[2], CREW[3]].map((c, i) => (
            <group key={i} position={[-2.2 + i * 1.15, 0, 2.2 - Math.abs(i - 1) * 0.5]} rotation={[0, (1 - i) * 0.25, 0]}>
              <BlockHuman look={c.look} gender={c.gender} pose={i === 1 ? 'cheer' : 'dance'} seed={i * 2.1 + 1} />
            </group>
          ))}
        </>
      )}
    </>
  )
}

/* ---------- The video: 25 seconds, scene after scene ---------- */

type Shot = { from: number; to: number; scene: SceneId; title?: string; sub?: string; /** Its number, in the film that goes through everything. */ n?: number }
/** Each film: its shots, when the intro ends and the outro starts, its length (marketing/video.mjs reads it). */
const FILMS: Record<FilmId, { shots: Shot[]; intro: number; outro: number; length: number; hook: [string, string, string] }> = {
  lancement: {
    shots: [
      { from: 0, to: 3.2, scene: 'crew' },
      { from: 3.2, to: 9, scene: 'crew', title: 'Crée ton perso', sub: 'Pagne wax, boubou, survêt… à ton style' },
      { from: 9, to: 15.5, scene: 'build', title: 'Construis ta maison', sub: 'Bloc par bloc : banco, parpaing, tôle…' },
      { from: 15.5, to: 20.5, scene: 'dance', title: 'Vis Abidjan avec tes amis', sub: 'Les vrais quartiers, au même moment' },
      { from: 20.5, to: 25, scene: 'house' },
    ],
    intro: 3.2,
    outro: 20.5,
    length: 25,
    hook: ['Ta vie.', 'Ton quartier.', 'Ton Babi.'],
  },
  bouger: {
    shots: [
      { from: 0, to: 3.4, scene: 'gbaka' },
      { from: 3.4, to: 11.6, scene: 'gbaka', title: 'Le gbaka', sub: "L'apprenti crie, on monte, on est serré… on arrive !" },
      { from: 11.6, to: 19.4, scene: 'gnango', title: 'Gnango', sub: 'Ton chauffeur, prix fixé, devant chez toi' },
      { from: 19.4, to: 26.6, scene: 'princesse', title: 'La Rue Princesse', sub: 'Yop by night : maquis et coupé-décalé' },
      { from: 26.6, to: 31, scene: 'princesse' },
    ],
    intro: 3.4,
    outro: 26.6,
    length: 31,
    hook: ['À Babi,', 'on bouge', 'comment ?'],
  },
  // The trailer: you don't choose where you're born, but your life is yours.
  'bande-annonce': {
    shots: [
      { from: 0, to: 3.4, scene: 'famille-gnambro' },
      { from: 3.4, to: 8.6, scene: 'famille-gnambro', title: 'Tu ne choisis pas ta famille', sub: 'Gnambro, coulé, poignon… tiré au sort' },
      { from: 8.6, to: 12.8, scene: 'famille-debout', title: 'Ou alors… laté !', sub: 'Villa, piscine, papa qui paie' },
      { from: 12.8, to: 17, scene: 'build', title: 'Ta vie, tu la construis', sub: 'Bloc par bloc, comme tu veux' },
      { from: 17, to: 21.2, scene: 'fete', title: 'Tu fais le travaillement', sub: 'Maquis, coupé-décalé, billets qui tombent' },
      { from: 21.2, to: 25.4, scene: 'basket', title: 'Tu joues au Palais', sub: 'Basket au Palais des Sports de Treichville' },
      { from: 25.4, to: 30, scene: 'palais' },
    ],
    intro: 3.4,
    outro: 25.4,
    length: 30,
    hook: ['Tu nais', 'gnambro', 'ou laté ?'],
  },
  // Everything there is to do, one by one.
  decouverte: {
    shots: [
      { from: 0, to: 3.4, scene: 'crew' },
      { from: 3.4, to: 9, scene: 'crew', n: 1, title: 'Crée ton perso', sub: 'Teint, coiffure, pagne wax, boubou, survêt…' },
      { from: 9, to: 14, scene: 'look', n: 2, title: 'Change de look', sub: "Ton armoire gratuite, le coiffeur à 2\u00a0000\u00a0F" },
      { from: 14, to: 20, scene: 'famille-gnambro', n: 3, title: 'Nais dans une famille', sub: 'Tirée au sort : de gnambro à laté' },
      { from: 20, to: 26, scene: 'build', n: 4, title: 'Construis ta maison', sub: 'Banco, parpaing, tôle… bloc par bloc' },
      { from: 26, to: 32, scene: 'gbaka', n: 5, title: 'Monte dans le gbaka', sub: "L'apprenti crie « Adjamé ! », on y va" },
      { from: 32, to: 37.5, scene: 'gnango', n: 6, title: 'Ou commande un Gnango', sub: 'Ton chauffeur, prix fixé, sur ton téléphone' },
      { from: 37.5, to: 43, scene: 'cause', n: 7, title: 'Cause avec les gens', sub: 'Saluer, gbairai, foot, « tombe sur moi »…' },
      { from: 43, to: 49, scene: 'fete', n: 8, title: 'Fais la fête', sub: 'Maquis, coupé-décalé, travaillement' },
      { from: 49, to: 55, scene: 'basket', n: 9, title: 'Fais du sport', sub: 'Basket au Palais des Sports, foot au quartier' },
      { from: 55, to: 61, scene: 'siporex', n: 10, title: "Les vrais lieux d'Abidjan", sub: 'Gare de Siporex, Rue Princesse, les ponts…' },
      { from: 61, to: 66.5, scene: 'phone', n: 11, title: 'Ton téléphone', sub: 'Waye, Gnango, Golvo, Store, les infos du pays' },
      { from: 66.5, to: 71, scene: 'crew' },
    ],
    intro: 3.4,
    outro: 66.5,
    length: 71,
    hook: ['Tout ce que', 'tu peux faire', 'à Babi'],
  },
}

/** What people say to each other in the street, two by two. */
const TALK: [string, string][] = [
  ["C'est comment famille ?", 'Y a fohi, on est là !'],
  ['Eh fiscalité !', 'Tombe sur moi un peu…'],
  ['On dit quoi ?', 'Asec ou Africa ce soir ?'],
]

/** The phone's home screen: the game's apps come up one after the other. */
function PhoneApps({ t }: { t: number }) {
  const up = ease(clamp01(t / 0.6))
  const apps: { id?: string; icon?: typeof MapIcon; bg?: string; label: string }[] = [
    { id: 'waye', label: 'Waye' },
    { id: 'gnango', label: 'Gnango' },
    { id: 'golvo', label: 'Golvo' },
    { id: 'store', label: 'Store' },
    { id: 'idrive', label: 'iDrive' },
    { icon: Newspaper, bg: '#d6336c', label: 'Infos' },
    { icon: MapIcon, bg: '#00a862', label: 'Carte' },
    { icon: MessageCircle, bg: '#7b5cff', label: 'Messages' },
  ]
  return (
    <div className="absolute inset-x-0 bottom-[7%] flex justify-center" style={{ transform: `translateY(${(1 - up) * 110}%)`, opacity: up }}>
      <div className="w-[320px] rounded-[44px] bg-[#141416] p-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="rounded-[34px] bg-[linear-gradient(170deg,#2a2f6a,#ff7a59)] px-5 pt-8 pb-7">
          <div className="text-center font-sans text-[15px] font-extrabold text-white/85">Mon téléphone</div>
          <div className="mt-5 grid grid-cols-4 gap-x-3 gap-y-5">
            {apps.map((a, i) => {
              const k = ease(clamp01((t - 0.5 - i * 0.22) / 0.4))
              const I = a.icon
              return (
                <div key={a.label} className="flex flex-col items-center gap-1.5" style={{ opacity: k, transform: `scale(${0.6 + 0.4 * k})` }}>
                  {a.id ? (
                    <AppLogo id={a.id} size={56} radius={17} />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-[17px] text-white" style={{ background: a.bg }}>
                      {I && <I size={28} strokeWidth={2.4} />}
                    </span>
                  )}
                  <span className="font-sans text-[13px] font-extrabold text-white">{a.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
const { shots: SHOTS, length: VIDEO_LENGTH } = FILMS[FILM]

/** What the apprenti calls out, one after the other. */
const CALLS = ['Adjamé ! Adjamé !', 'Yop ! Yop ! On y va !', 'Monte, y a place !', 'Serre-toi un peu !']

const fade = (t: number, a: number, b: number, d = 0.45) => Math.max(0, Math.min(1, (t - a) / d, (b - t) / d))

/** The Gnango app on a phone: looking for a driver, then found, at a fixed price. */
function GnangoPhone({ t }: { t: number }) {
  const up = t < 3.4 ? ease(clamp01((t - 0.2) / 0.6)) : 1 - ease(clamp01((t - 3.4) / 0.6))
  const found = t > 1.8
  return (
    <div className="absolute inset-x-0 bottom-[6%] flex justify-center" style={{ transform: `translateY(${(1 - up) * 110}%)`, opacity: up }}>
      <div className="w-[300px] rounded-[44px] bg-[#141416] p-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="overflow-hidden rounded-[34px] bg-[#f4f4f6] text-[var(--color-ink)]">
          <div className="flex items-center gap-3 bg-[#1b1d2a] px-4 pt-6 pb-4 text-white">
            <AppLogo id="gnango" size={46} radius={14} />
            <div>
              <div className="text-[22px] leading-none font-extrabold">Gnango</div>
              <div className="font-sans text-[13px] font-bold text-[#ffd166]">Un chauffeur, prix fixé</div>
            </div>
          </div>
          {/* The map: a few streets and the car coming */}
          <div className="relative h-[150px] bg-[#e8e4d8]">
            {[30, 80, 120].map((y) => (
              <i key={y} className="absolute inset-x-0 block h-[8px] bg-white" style={{ top: y }} />
            ))}
            {[70, 190].map((x) => (
              <i key={x} className="absolute inset-y-0 block w-[8px] bg-white" style={{ left: x }} />
            ))}
            <i className="absolute block h-4 w-4 rounded-full border-4 border-white bg-[var(--color-orange)]" style={{ left: 180, top: 112 }} />
            <i className="absolute block h-5 w-7 rounded-md bg-[#212529]" style={{ left: 60 + clamp01((t - 1.8) / 1.6) * 110, top: 72 }} />
          </div>
          <div className="p-4 font-sans">
            {found ? (
              <>
                <div className="text-[13px] font-extrabold text-[var(--color-emerald-deep)]">Chauffeur trouvé</div>
                <div className="mt-1 font-display text-[20px] leading-tight font-extrabold">Koffi · Toyota noire</div>
                <div className="mt-1 text-[14px] font-bold text-[var(--color-ink-soft)]">Arrive dans 3 min</div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                  <span className="text-[13px] font-bold text-[var(--color-ink-soft)]">Prix fixé</span>
                  <span className="font-display text-[22px] font-extrabold">2 500 F</span>
                </div>
              </>
            ) : (
              <>
                <div className="font-display text-[20px] font-extrabold">Riviera → Plateau</div>
                <div className="mt-1 text-[14px] font-bold text-[var(--color-ink-soft)]">Recherche d'un chauffeur…</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <i className="block h-full rounded-full bg-[#ffd166]" style={{ width: `${clamp01(t / 1.8) * 100}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Video({ t, qr, url, placeholder }: { t: number; qr: string; url: string; placeholder: boolean }) {
  const shot = SHOTS.find((s) => t >= s.from && t < s.to) ?? SHOTS[SHOTS.length - 1]
  const local = t - shot.from
  const black = 1 - Math.min(1, fade(t, shot.from, shot.to, 0.35) + (shot.from === 0 ? 1 : 0))
  const film = FILMS[FILM]
  const intro = t < film.intro
  const outro = t >= film.outro
  const O = film.outro
  const pop = (start: number) => {
    const k = Math.max(0, Math.min(1, (t - start) / 0.5))
    return { opacity: k, transform: `translateY(${(1 - k) * 30}px) scale(${0.85 + 0.15 * k})` }
  }
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--color-night)] font-display text-white">
      <div className="absolute inset-0" style={{ opacity: shot.scene === 'dance' || shot.scene === 'princesse' || shot.scene === 'fete' ? 0.25 : 1 }}>
        <Scene className="h-full w-full" />
      </div>
      <div className="absolute inset-0" style={{ opacity: intro ? 0 : outro ? 0.35 : 1 }}>
        <Canvas frameloop="never" shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} dpr={2} camera={{ fov: 40, near: 0.1, far: 100 }}>
          <World scene={shot.scene} t={local} />
        </Canvas>
      </div>
      {/* The apprenti calling out */}
      {shot.scene === 'gbaka' && !intro && local > 1.6 && local < 6.4 && (
        <div className="absolute top-[47%] left-[50%] max-w-[48%] rounded-3xl rounded-bl-md bg-white px-5 py-3 text-[30px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.5)]" style={pop(shot.from + 1.6)}>
          {CALLS[Math.floor((local - 1.6) / 1.25) % CALLS.length]}
        </div>
      )}
      {/* Two people meeting in the street, and what they say */}
      {shot.scene === 'cause' && !intro && local > 1.2 && (() => {
        const [a, b] = TALK[Math.floor((local - 1.2) / 1.7) % TALK.length]
        const k = (local - 1.2) % 1.7
        return (
          <>
            <div className="absolute top-[43%] left-[8%] max-w-[44%] rounded-3xl rounded-br-md bg-white px-4 py-2.5 text-[26px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.5)]" style={{ opacity: clamp01(k / 0.25) }}>
              {a}
            </div>
            <div className="absolute top-[52%] right-[8%] max-w-[44%] rounded-3xl rounded-bl-md bg-[var(--color-orange)] px-4 py-2.5 text-[26px] leading-tight font-extrabold text-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.5)]" style={{ opacity: clamp01((k - 0.6) / 0.25) }}>
              {b}
            </div>
          </>
        )
      })()}
      {shot.scene === 'phone' && !outro && <PhoneApps t={local} />}
      {/* Booking on Gnango: the phone comes up, finds a driver, goes */}
      {shot.scene === 'gnango' && local < 4.2 && <GnangoPhone t={local} />}
      {/* Captions */}
      {shot.title && (
        <div className="absolute inset-x-0 top-[9%] flex flex-col items-center px-8 text-center">
          <div className="flex items-center gap-3 rounded-full bg-[var(--color-orange)] px-6 py-2 text-[40px] leading-tight font-extrabold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" style={pop(shot.from + 0.3)}>
            {shot.n && <span className="-ml-3 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[28px] text-[var(--color-orange)]">{shot.n}</span>}
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
            <span className="block" style={pop(0.8)}>{film.hook[0]}</span>
            <span className="block" style={pop(1.3)}>{film.hook[1]}</span>
            <span className="block text-[var(--color-orange)]" style={pop(1.8)}>{film.hook[2]}</span>
          </h1>
        </div>
      )}
      {outro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div style={pop(O + 0.2)}>
            <Logo size={72} />
          </div>
          <div className="text-[52px] leading-[1] font-extrabold" style={pop(O + 0.6)}>
            Bientôt sur
            <br />
            ton téléphone
          </div>
          <div className="flex flex-col items-center gap-4 rounded-[32px] bg-white p-6 text-[var(--color-ink)] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]" style={pop(O + 1.1)}>
            <div className="text-[30px] leading-tight font-extrabold">Inscris-toi sur la liste</div>
            {qr && <img src={qr} alt="" className="h-[220px] w-[220px] [image-rendering:pixelated]" />}
            <div className="font-sans text-[24px] font-extrabold text-[var(--color-orange)]">{url}</div>
            {placeholder && <div className="rounded-lg bg-[#ffeef1] px-3 py-1 font-sans text-[16px] font-extrabold text-[#d81b3f]">ADRESSE PROVISOIRE</div>}
          </div>
          <div className="font-sans text-[22px] font-extrabold text-white/85" style={pop(O + 1.6)}>
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
