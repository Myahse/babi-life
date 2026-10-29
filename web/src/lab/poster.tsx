import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Canvas, advance, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import '../index.css'
import type { Block, Look } from '../lib/types'
import { BlockHuman } from '../avatar/BlockHuman'
import type { Pose } from '../avatar/Human'
import { DEFAULT_LOOK, HAIRS, randomLook } from '../avatar/options'
import { House, materialTexture } from '../world3d/build/House'
import { FurnitureSet } from '../world3d/build/Furniture'
import type { Furniture, Piece } from '../lib/types'
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
import { FullDetail } from '../avatar/Human'
import { OUTFITS, OUTFIT_DEFAULT_COLOR } from '../avatar/options'
import type { Sim } from '../lib/types'
import { Map as MapIcon, MessageCircle, Newspaper, Eye, Heart, Check, Lock, ShieldCheck, PhoneCall, TriangleAlert } from 'lucide-react'
import { StreetStall } from '../world3d/open/stalls'
import { StreetSpot } from '../world3d/open/streetPeople'
import { Pram } from '../world3d/Pram'
import { NouchiCorner } from '../world3d/open/nouchis'
import { Shower } from '../world3d/interior/ActionProps'
import { NaveWorld, NAVE_VIEW } from '../world3d/interior/CathedralInside'
import { Grin } from '../world3d/open/streetlife'
import { Character } from '../world3d/Character'
import { rng } from '../world3d/themes'
import { BebeOverlay, BebeWorld, type BebeScreen } from './bebeFilm'

// Dev-only (/poster.html): the game's own blocky Sims for the flyer and the
// video (marketing/). Stills: ?scene=crew|house|dance&t=2 (&alpha for a
// transparent background). The video: ?video, drawn frame by frame by
// marketing/video.mjs through window.__frame(t), which holds the shared
// clock and the 3D scene at that instant.

const q = new URLSearchParams(location.search)
const VIDEO = q.has('video')
const ALPHA = q.has('alpha')
/** marketing/top20.mjs: &only=<scene> draws that scene alone (its clock from 0; &from=<s>: when its take starts in the film), &overlay only what goes over the game filmed. */
const ONLY = q.get('only') as SceneId | null
const OVERLAY = q.has('overlay')
type SceneId = 'poussette' | 'crew' | 'house' | 'build' | 'dance' | 'gbaka' | 'gnango' | 'princesse' | `famille-${string}` | 'palais' | 'basket' | 'fete' | 'cause' | 'look' | 'siporex' | 'phone' | 'visages' | 'coiffures' | 'selfie' | 'yop' | 'garba' | 'brochette' | 'plateau' | 'stade' | 'concert' | 'couloir' | 'amis' | 'salon' | 'douche' | 'zoo' | 'loto' | 'chambre' | 'chambre-choc' | 'cabine' | 'keke' | 'mt-yop' | 'mt-gbaka' | 'mt-maquis' | 'mt-stade' | 'mt-village' | 'mt-salon' | 'tourf' | 'messe' | 'grin' | 'zouglou' | 'lions' | `bebe:${string}` | 'bebe-bapteme' | 'bebe-bagarre' | 'bebe-creche' | 'bebe-balade' | 'bebe-grandit'
/**
 * Which film: ?video (the launch), ?video=bouger (getting about: gbaka,
 * Gnango, Rue Princesse), ?video=bande-annonce (the trailer: gnambro or
 * laté?), ?video=decouverte (everything there is to do, one by one) or
 * ?video=live (Awa streams from her phone and shows the game, on her voice:
 * marketing/out/voix-live.mp3) or ?video=merci (Awa thanks the community for
 * 1 500 followers, asks about the weekend, wishes a good week and teases the
 * good news ahead: marketing/scripts/merci-1500.md, voice voix-merci.mp3) or
 * ?video=gameplay (how you play: born gnambro, the goal is debout, six steps
 * to get there, the money going up and down; its beat: marketing/beat.py) or
 * ?video=arnaque (Awa was scammed through a link on Gbairai: her Waye account
 * emptied, what to remember: marketing/scripts/arnaque-waye.md, voice voix-arnaque.mp3) or
 * ?video=keke (Keke, Awa's friend, asks Babi « what do you want in Babi Life? »:
 * marketing/scripts/keke-micro-trottoir.md, voice voix-keke.mp3) or
 * ?video=top20 (« 20 trucs à faire dans Babi Life », Awa telling them: the game
 * filmed being played, by marketing/top20.mjs, under what's drawn here with
 * &overlay, timed on Awa's voice (&times=: when each line starts, then the end);
 * the scenes it films from here with &only=grin|messe|zouglou|tourf:
 * marketing/scripts/top20.md, voice voix-top20.mp3 over its beat son-top20.mp3) or
 * ?video=sortie (Awa, at home, opens the gift she teased in « merci »: the game
 * comes out on Wednesday 28 October; what's new lately (politics, matches
 * with friends, Flashé, playing offline), sign up now:
 * marketing/scripts/sortie-28-octobre.md, voice voix-sortie.mp3) or
 * ?video=bienvenue (Awa welcomes the new players on opening night: born in a
 * family drawn by lot, a baby to look after, then the phone and the city:
 * marketing/scripts/bienvenue.md, voice voix-bienvenue.mp3).
 */
type FilmId = 'lancement' | 'bouger' | 'bande-annonce' | 'decouverte' | 'live' | 'merci' | 'gameplay' | 'arnaque' | 'keke' | 'top20' | 'sortie' | 'bienvenue' | 'bebe'
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

/** Awa, who streams the game (the wish list's guide): orange kaba, headwrap, earrings. */
// Awa: her kaba and headscarf in the live; a new look for « Merci » (braids, a kente top and skirt, her jewels), kept at home since.
const AWA =
  FILM === 'merci' || FILM === 'sortie' || FILM === 'bienvenue'
    ? L({ skin: '#8a5532', hair: 'braids', hairColor: '#24160e', outfit: 'jupe', outfitColor: '#12a37a', pattern: 'kente', accessory: 'earrings,beads,watch,bag' })
    : L({ skin: '#8a5532', hair: 'headwrap', outfit: 'kaba', outfitColor: '#ff7a00', pattern: 'cercles', accessory: 'earrings' })

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

/** Awa's living room (« Merci »): the game's own furniture, the morning light through the window. */
const SALON_FURNITURE: Furniture[] = [
  { id: 'canape', label: 'Canapé', icon: 'sofa', w: 2, d: 1, h: 1, price: 0, comfort: 0, color: '#7a4a8a' },
  { id: 'tele', label: 'Télé', icon: 'tv', w: 1, d: 1, h: 1, price: 0, comfort: 0, color: '#222222' },
  { id: 'ventilo', label: 'Ventilateur', icon: 'fan', w: 1, d: 1, h: 2, price: 0, comfort: 0, color: '#3a8fd8' },
  { id: 'table', label: 'Table', icon: 'utensils', w: 1, d: 2, h: 1, price: 0, comfort: 0, color: '#8a5a32' },
  { id: 'chaises', label: 'Chaises', icon: 'armchair', w: 1, d: 1, h: 1, price: 0, comfort: 0, color: '#e8e3d6' },
]
// Corners in the room's own metres (x from -6, z from 0 at the back wall).
const SALON_PIECES: Piece[] = [
  [-1, 0, 0.6, 0, 'canape'],
  [-3.2, 0, 0.5, 0, 'tele'],
  [1.7, 0, 1.2, 0, 'ventilo'],
  [3.6, 0, 2.2, 0, 'table'],
  [2.5, 0, 2.6, 0, 'chaises'],
]

function Salon({ t, gift }: { t: number; gift?: boolean }) {
  const tiles = useMemo(() => {
    const tx = materialTexture({ id: 'carreau', label: '', color: '#e9e4d8', price: 0, unlock: 0 }).clone()
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping
    tx.repeat.set(12, 8)
    tx.needsUpdate = true
    return tx
  }, [])
  // The phone in her hand moves a little: the image too.
  const shake: [number, number] = [Math.sin(t * 2.3) * 0.03 + Math.sin(t * 5.1) * 0.012, Math.cos(t * 1.9) * 0.025]
  const wall = '#f3e2a9'
  return (
    <>
      <hemisphereLight args={['#fff6e6', '#b98a5a', 1.15]} />
      <directionalLight position={[3, 6, 9]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={6} shadow-camera-bottom={-6} />
      <pointLight position={[2.6, 2.2, 1.6]} intensity={6} distance={6} color="#fff1c9" />
      <ambientLight intensity={0.45} />
      <Camera at={[0.4 + shake[0], 2.1 + shake[1], 9.6]} look={[0.2, 1.45, 3.6]} />
      {/* The tiled floor, the walls painted pale yellow, a skirting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshLambertMaterial map={tiles} />
      </mesh>
      <mesh position={[0, 1.6, -0.05]} receiveShadow>
        <boxGeometry args={[12, 3.2, 0.1]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      {[-6, 6].map((x) => (
        <mesh key={x} position={[x, 1.6, 4]} receiveShadow>
          <boxGeometry args={[0.1, 3.2, 8]} />
          <meshLambertMaterial color={wall} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, 0.02]}>
        <boxGeometry args={[12, 0.12, 0.04]} />
        <meshLambertMaterial color="#8a5a32" />
      </mesh>
      {/* The window, its burglar bars and the morning sky */}
      <mesh position={[2.6, 1.7, 0.01]}>
        <boxGeometry args={[1.8, 1.2, 0.02]} />
        <meshBasicMaterial color="#bfe6ff" />
      </mesh>
      {[-0.6, 0, 0.6].map((dx) => (
        <mesh key={dx} position={[2.6 + dx, 1.7, 0.03]}>
          <boxGeometry args={[0.05, 1.2, 0.03]} />
          <meshLambertMaterial color="#444" />
        </mesh>
      ))}
      <mesh position={[2.6, 1.7, 0.02]}>
        <boxGeometry args={[1.95, 1.35, 0.01]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      {/* The family photo and the calendar */}
      <mesh position={[-1.6, 2.35, 0.03]}>
        <boxGeometry args={[0.9, 0.65, 0.03]} />
        <meshLambertMaterial color="#6b4426" />
      </mesh>
      <mesh position={[-1.6, 2.35, 0.05]}>
        <boxGeometry args={[0.76, 0.52, 0.01]} />
        <meshLambertMaterial color="#e7b98a" />
      </mesh>
      <mesh position={[0.6, 2.3, 0.03]}>
        <boxGeometry args={[0.55, 0.75, 0.01]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.6, 2.55, 0.04]}>
        <boxGeometry args={[0.55, 0.22, 0.01]} />
        <meshLambertMaterial color="#d6202a" />
      </mesh>
      {/* A plant in its pot */}
      <mesh position={[-4.2, 0.25, 1.2]} castShadow>
        <cylinderGeometry args={[0.25, 0.2, 0.5, 10]} />
        <meshLambertMaterial color="#b4492f" />
      </mesh>
      <mesh position={[-4.2, 0.85, 1.2]} castShadow>
        <boxGeometry args={[0.6, 0.8, 0.6]} />
        <meshLambertMaterial color="#3f9a4a" />
      </mesh>
      <group position={[-6, 0, 0]}>
        <FurnitureSet pieces={SALON_PIECES.map((p) => [p[0] + 6, p[1], p[2], p[3], p[4]] as Piece)} catalog={SALON_FURNITURE} />
      </group>
      {/* Awa in her living room, talking to her phone */}
      <group position={[0, 0, 4.4]} rotation={[0, 0.08 + Math.sin(t * 0.7) * 0.08, 0]}>
        <BlockHuman look={AWA} gender="femme" pose={gift ? 'talk' : Math.floor(t / 1.4) % 3 === 2 ? 'wave' : 'talk'} seed={11} />
      </group>
    </>
  )
}

/** Keke, Awa's friend (« keke »): orange cap backwards, the Éléphants' jersey, his chain. */
const KEKE = L({ skin: '#6e4024', hair: 'degrade', outfit: 'jersey', outfitColor: '#ff8200', accessory: 'capback,chain', accessoryColor: '#ff7a00' })

/** The people Keke asks, each in their quarter. */
const MT: Record<string, { name: string; where: string; job: string; wish: string; icon: string; look: Look; gender: 'femme' | 'homme'; pose: Pose; cap: string }> = {
  'mt-yop': { name: 'Mariam', where: 'Yopougon', job: 'Étudiante', wish: 'Mariage', icon: '💍', gender: 'femme', pose: 'cheer', look: L({ skin: '#7a4a2c', hair: 'braids', outfit: 'robe', outfitColor: '#d6336c', accessory: 'earrings,bag' }), cap: '« Mon mariage ! La dot, le pagne, la fête… »' },
  'mt-gbaka': { name: 'Moussa', where: 'Adjamé', job: 'Apprenti gbaka', wish: 'Gbaka', icon: '🚐', gender: 'homme', pose: 'wave', look: L({ skin: '#4a2a16', hair: 'short', outfit: 'debardeur', outfitColor: '#f8f9fa', accessory: 'cap', accessoryColor: '#00a862' }), cap: '« Conduire mon gbaka : Adjamé ! Adjamé ! »' },
  'mt-maquis': { name: 'Tantie Adjoua', where: 'Treichville', job: 'Vendeuse', wish: 'Maquis', icon: '🍗', gender: 'femme', pose: 'talk', look: L({ skin: '#5e3519', hair: 'headwrap', outfit: 'pagne', outfitColor: '#2b8a3e', pattern: 'cercles', accessory: 'earrings' }), cap: '« Ouvrir mon maquis : poisson braisé, attiéké ! »' },
  'mt-stade': { name: 'Junior', where: 'Cocody', job: 'Élève', wish: 'La CAN', icon: '⚽', gender: 'homme', pose: 'cheer', look: L({ skin: '#8a5532', hair: 'twists', outfit: 'jersey', outfitColor: '#00a862', accessory: 'none' }), cap: '« La CAN ! Jouer avec les Éléphants ! »' },
  'mt-village': { name: 'Vieux Koffi', where: 'Abobo', job: 'Retraité', wish: 'Village', icon: '🏡', gender: 'homme', pose: 'sit', look: L({ skin: '#5a3420', hair: 'short', hairColor: '#d9d9d9', outfit: 'boubou', outfitColor: '#e9e4d8', beard: 'full', accessory: 'kufi' }), cap: '« Aller au village voir la famille. C’est ça, la vie. »' },
  'mt-salon': { name: 'Prisca', where: 'Marcory', job: 'Coiffeuse', wish: 'Salon', icon: '💇🏾‍♀️', gender: 'femme', pose: 'talk', look: L({ skin: '#9a6440', hair: 'afro', outfit: 'casual', outfitColor: '#7b5cff', accessory: 'earrings,watch' }), cap: '« Mon salon de coiffure : les tresses à tout Babi ! »' },
}

/** Keke's street interview: the person in their quarter, Keke at the side filming them with his phone; or Keke alone, to the camera. */
function MicroTrottoir({ scene, t }: { scene: SceneId; t: number }) {
  const who = MT[scene]
  const tree = (x: number, z: number, k = 1) => (
    <group key={`${x},${z}`} position={[x, 0, z]} scale={k}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.35, 2.4, 0.35]} />
        <meshLambertMaterial color="#6b4426" />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <boxGeometry args={[2.4, 1.8, 2.4]} />
        <meshLambertMaterial color="#2f8a3a" />
      </mesh>
    </group>
  )
  const wall = (c: string) => (
    <mesh position={[0, 1.6, -3]} receiveShadow>
      <boxGeometry args={[30, 3.2, 0.3]} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
  return (
    <>
      <color attach="background" args={['#9fd4f2']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[5, 10, 8]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <Camera at={[0.5 + Math.sin(t * 0.6) * 0.15, 1.85, 7.6]} look={[0.2, 1.3, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 30]} />
        <meshLambertMaterial color={scene === 'mt-village' ? '#b9744a' : '#c9b48a'} />
      </mesh>
      {scene === 'keke' && (
        <>
          {wall('#f2d7a0')}
          <Sign p={[-1.6, 2.6, -2.8]} w={2.6} text="CARREFOUR" bg="#1f6fd0" fg="#ffffff" />
          {tree(3.2, -2)}
        </>
      )}
      {scene === 'mt-yop' && (
        <>
          {wall('#efe3c8')}
          {tree(-2.6, -2)}
          {tree(2.8, -2.2, 0.9)}
          <mesh position={[1.6, 0.25, -1.4]} castShadow>
            <boxGeometry args={[1.6, 0.12, 0.45]} />
            <meshLambertMaterial color="#7a5233" />
          </mesh>
        </>
      )}
      {scene === 'mt-gbaka' && (
        <group position={[-1.6, 0, -2.6]} rotation={[0, -0.15, 0]}>
          <Vehicle p={[0, 0, 0]} kind="gbaka" color="#f4c430" trim="#00a862" />
        </group>
      )}
      {scene === 'mt-maquis' && (
        <>
          {wall('#e8590c')}
          <Sign p={[0, 2.7, -2.8]} w={3} text="MAQUIS CHEZ ADJOUA" bg="#ffd43b" fg="#7a2a00" />
          <TableSet p={[-2.2, 0.18, -1.2]} c="#2a6cf0" />
          <TableSet p={[2.3, 0.18, -1.0]} c="#e8432f" />
          <mesh position={[2.3, 2.4, -1.0]} castShadow>
            <coneGeometry args={[1.3, 0.5, 10]} />
            <meshLambertMaterial color="#e8432f" />
          </mesh>
        </>
      )}
      {scene === 'mt-stade' && (
        <>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[k * 5, 1.6, -3]}>
              <boxGeometry args={[5, 3.2, 0.3]} />
              <meshLambertMaterial color={['#ff8200', '#ffffff', '#009a44'][k + 1]} />
            </mesh>
          ))}
          <mesh position={[0.9, 0.2, 0.9]} castShadow>
            <sphereGeometry args={[0.2, 14, 10]} />
            <meshLambertMaterial color="#f4f4f4" />
          </mesh>
        </>
      )}
      {scene === 'mt-village' && (
        <>
          {wall('#d9c7a0')}
          {tree(-0.4, -1.4, 1.5)}
          <mesh position={[0, 0.22, 0.05]} castShadow>
            <boxGeometry args={[0.55, 0.44, 0.55]} />
            <meshLambertMaterial color="#8a5a32" />
          </mesh>
        </>
      )}
      {scene === 'mt-salon' && (
        <>
          {wall('#f7c6d9')}
          <Sign p={[0, 2.7, -2.8]} w={3} text="SALON PRISCA" bg="#d6336c" fg="#ffffff" />
          <mesh position={[-2, 1.4, -2.84]}>
            <boxGeometry args={[1.6, 1.2, 0.02]} />
            <meshBasicMaterial color="#cfe8f2" />
          </mesh>
        </>
      )}
      {who ? (
        <>
          <group position={[-0.35, 0, 0.3]} rotation={[0, 0.35, 0]}>
            <BlockHuman look={who.look} gender={who.gender} pose={Math.floor(t / 1.5) % 3 === 2 && who.pose !== 'sit' ? 'talk' : who.pose} seed={7} />
          </group>
          {/* Keke at the side, filming them */}
          <group position={[1.25, 0, 0.9]} rotation={[0, -1.75, 0]}>
            <BlockHuman look={KEKE} gender="homme" pose="film" seed={5} />
          </group>
        </>
      ) : (
        <group position={[0, 0, 0.6]} rotation={[0, Math.sin(t * 0.8) * 0.1, 0]}>
          <BlockHuman look={KEKE} gender="homme" pose={Math.floor(t / 1.6) % 3 === 0 ? 'wave' : 'talk'} seed={5} />
        </group>
      )}
    </>
  )
}

/** Awa's bedroom at night (« arnaque »): the bed, the bedside lamp, the night at the window; her phone's light on her face. Shocked: her head in her hands. */
function Chambre({ t, shock }: { t: number; shock?: boolean }) {
  const wall = '#3d4a73'
  const shake: [number, number] = [Math.sin(t * 2.1) * 0.025, Math.cos(t * 1.7) * 0.02]
  // The screen's glow flickers a little as she scrolls.
  const glow = shock ? 0 : 2.2 + Math.sin(t * 7) * 0.25
  return (
    <>
      <color attach="background" args={['#0b1026']} />
      <hemisphereLight args={['#6f7fc0', '#2a2238', 0.55]} />
      <ambientLight intensity={0.2} />
      {/* The bedside lamp, warm, and the cold light of the phone */}
      <pointLight position={[-2.2, 1.3, 1.6]} intensity={5} distance={5} color="#ffbe6b" />
      <pointLight position={[0.1, 1.45, 4.85]} intensity={glow} distance={1.6} color="#9fd0ff" />
      <Camera at={[0.9 + shake[0], 2.3 + shake[1], 12.2]} look={[0, 1.25, 3.4]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshLambertMaterial color="#6b4a33" />
      </mesh>
      <mesh position={[0, 1.6, -0.05]}>
        <boxGeometry args={[12, 3.2, 0.1]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      {[-6, 6].map((x) => (
        <mesh key={x} position={[x, 1.6, 4]}>
          <boxGeometry args={[0.1, 3.2, 8]} />
          <meshLambertMaterial color={wall} />
        </mesh>
      ))}
      {/* The window on the night: the moon, the lights of the next building */}
      <mesh position={[2.4, 1.8, 0.01]}>
        <boxGeometry args={[1.6, 1.1, 0.02]} />
        <meshBasicMaterial color="#14204a" />
      </mesh>
      <mesh position={[2.85, 2.1, 0.03]}>
        <circleGeometry args={[0.13, 20]} />
        <meshBasicMaterial color="#fff4cf" />
      </mesh>
      {[[1.9, 1.5], [2.2, 1.6], [2.6, 1.45], [2.0, 1.75]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.03]}>
          <planeGeometry args={[0.1, 0.08]} />
          <meshBasicMaterial color="#ffd27a" />
        </mesh>
      ))}
      {[-0.55, 0, 0.55].map((dx) => (
        <mesh key={dx} position={[2.4 + dx, 1.8, 0.04]}>
          <boxGeometry args={[0.04, 1.1, 0.03]} />
          <meshLambertMaterial color="#222" />
        </mesh>
      ))}
      {/* The bed, its pagne cover; the bedside table and its lamp */}
      <mesh position={[0, 0.25, 2.2]} castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.5, 2.4]} />
        <meshLambertMaterial color="#5a3820" />
      </mesh>
      <mesh position={[0, 0.58, 2.3]}>
        <boxGeometry args={[2.0, 0.18, 2.2]} />
        <meshLambertMaterial color="#e86a1f" />
      </mesh>
      <mesh position={[0, 0.72, 1.25]}>
        <boxGeometry args={[1.6, 0.14, 0.4]} />
        <meshLambertMaterial color="#f4efe6" />
      </mesh>
      <mesh position={[0, 0.9, 1.0]}>
        <boxGeometry args={[2.1, 1.1, 0.12]} />
        <meshLambertMaterial color="#4a2e1a" />
      </mesh>
      <mesh position={[-2.2, 0.35, 1.6]}>
        <boxGeometry args={[0.7, 0.7, 0.6]} />
        <meshLambertMaterial color="#6b4426" />
      </mesh>
      <mesh position={[-2.2, 0.95, 1.6]}>
        <cylinderGeometry args={[0.15, 0.22, 0.35, 12]} />
        <meshBasicMaterial color="#ffd89a" />
      </mesh>
      {/* Awa: on her phone, then her head in her hands */}
      <group position={[0.1, 0, 4.4]} rotation={[0, shock ? Math.sin(t * 3) * 0.12 : 0.1, 0]}>
        <BlockHuman look={AWA} gender="femme" pose={shock ? (Math.floor(t / 1.1) % 2 ? 'rant' : 'stumble') : Math.floor(t / 2.4) % 3 === 2 ? 'talk' : 'phone'} seed={11} />
      </group>
    </>
  )
}

/** The Waye kiosk by the road, the next morning (« arnaque »): its parasol, the agent behind his counter shaking his head, Awa telling him. */
function Cabine({ t }: { t: number }) {
  const agent = useMemo(() => L({ skin: '#5a3420', hair: 'short', outfit: 'chemise', outfitColor: '#1aa6e6', accessory: 'none', beard: 'bouc' }), [])
  return (
    <>
      <color attach="background" args={['#9fd4f2']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.25]} />
      <directionalLight position={[6, 10, 8]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
      <Camera at={[2.6 + Math.sin(t * 0.4) * 0.3, 2.6, 12.5]} look={[0.4, 1.5, 1.2]} />
      {/* The red earth of the roadside, the road behind, a wall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
        <planeGeometry args={[40, 20]} />
        <meshLambertMaterial color="#b9744a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -4]}>
        <planeGeometry args={[40, 5]} />
        <meshLambertMaterial color="#3d3d42" />
      </mesh>
      <mesh position={[0, 1.2, -7]}>
        <boxGeometry args={[40, 2.4, 0.3]} />
        <meshLambertMaterial color="#e9d8a6" />
      </mesh>
      {/* The kiosk: blue, its counter, its sign, its parasol */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 2.2, 1.6]} />
        <meshLambertMaterial color="#1aa6e6" />
      </mesh>
      <mesh position={[0, 1.15, 0.82]}>
        <boxGeometry args={[2.2, 0.9, 0.04]} />
        <meshLambertMaterial color="#0f2a3d" />
      </mesh>
      {/* The counter, out in front, on its blue front panel */}
      <mesh position={[0, 1.02, 1.75]} castShadow>
        <boxGeometry args={[2.7, 0.08, 0.5]} />
        <meshLambertMaterial color="#f4f1ea" />
      </mesh>
      <mesh position={[0, 0.5, 1.9]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 1.0, 0.2]} />
        <meshLambertMaterial color="#1590c9" />
      </mesh>
      <Sign p={[0, 2.55, 0.81]} w={2.4} text="WAYE · DÉPÔT RETRAIT" bg="#ffd43b" fg="#0f2a3d" />
      <mesh position={[-1.9, 1.3, 0.6]}>
        <cylinderGeometry args={[0.04, 0.04, 2.6, 8]} />
        <meshLambertMaterial color="#666" />
      </mesh>
      <mesh position={[-1.9, 2.6, 0.6]} castShadow>
        <coneGeometry args={[1.5, 0.6, 12]} />
        <meshLambertMaterial color="#1aa6e6" />
      </mesh>
      {/* The agent, behind the counter, shaking his head */}
      <group position={[0, 0, 1.2]} rotation={[0, Math.sin(t * 5) * (Math.floor(t / 1.6) % 2 ? 0.25 : 0.05), 0]}>
        <BlockHuman look={agent} gender="homme" pose={Math.floor(t / 1.6) % 2 ? 'talk' : 'idle'} seed={4} />
      </group>
      {/* Awa, in front, telling him */}
      <group position={[1.9, 0, 2.7]} rotation={[0, -Math.PI / 2 - 0.6, 0]}>
        <BlockHuman look={AWA} gender="femme" pose={Math.floor(t / 1.3) % 3 === 1 ? 'rant' : 'talk'} seed={11} />
      </group>
      {/* Someone waiting their turn */}
      <group position={[-1.6, 0, 2.8]} rotation={[0, Math.PI - 0.4, 0]}>
        <BlockHuman look={CREW[0].look} gender="homme" pose="phone" seed={3} />
      </group>
    </>
  )
}

function Camera({ at, look, near = 0.1, far = 100 }: { at: [number, number, number]; look: [number, number, number]; /** The trailer's landscapes see kilometres. */ near?: number; far?: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  // Stills only: &cam=x,y,z&look=x,y,z put the camera elsewhere (to find a shot's angle).
  if (!VIDEO || q.has('cam')) {
    const v = (k: string) => q.get(k)?.split(',').map(Number) as [number, number, number] | undefined
    at = v('cam') ?? at
    look = v('look') ?? look
    if (q.has('far')) far = Number(q.get('far'))
  }
  if (camera.near !== near || camera.far !== far) {
    camera.near = near
    camera.far = far
    camera.updateProjectionMatrix()
  }
  camera.position.set(...at)
  camera.lookAt(...look)
  return null
}

/** One scene of the video (or a still), at t seconds into it. */
function World({ scene, t }: { scene: SceneId; t: number }) {
  if (scene.startsWith('bebe')) return <BebeWorld scene={scene} t={t} />
  if (scene === 'salon') return <Salon t={t} />
  if (scene === 'poussette') return <Poussette t={t} />
  if (scene === 'chambre' || scene === 'chambre-choc') return <Chambre t={t} shock={scene === 'chambre-choc'} />
  if (scene === 'cabine') return <Cabine t={t} />
  if (scene === 'keke' || scene.startsWith('mt-')) return <MicroTrottoir scene={scene} t={t} />
  if (scene === 'tourf' || scene === 'messe') return <Plateau scene={scene} t={t} />
  if (scene === 'grin') return <GrinScene t={t} />
  if (scene === 'zouglou') return <Zouglou t={t} />
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
  if (scene === 'cause' || scene === 'selfie' || scene === 'yop' || scene === 'plateau' || scene === 'amis' || scene === 'couloir') return <Street scene={scene} t={t} />
  if (scene === 'garba' || scene === 'brochette') return <Stalls scene={scene} t={t} />
  if (scene === 'douche' || scene === 'zoo' || scene === 'loto') return <Jeu scene={scene} t={t} />
  if (scene === 'lions') return <Lions t={t} />
  if (scene === 'stade' || scene === 'concert') return <Stade scene={scene} t={t} />
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
function Street({ scene, t }: { scene: 'gbaka' | 'gnango' | 'princesse' | 'cause' | 'selfie' | 'yop' | 'plateau' | 'amis' | 'couloir'; t: number }) {
  const wide = useThree((s) => s.size.width >= s.size.height)
  const night = scene === 'princesse' || scene === 'couloir'
  if (scene === 'selfie' || scene === 'yop' || scene === 'plateau' || scene === 'amis' || scene === 'couloir') return <LiveStreet scene={scene} t={t} />
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

/* ---------- The live: Awa streams the game from her phone ---------- */

/** A street of the live: Awa filming herself (selfie), Yopougon by day, the Plateau's offices, two friends, the couloir at night. */
function LiveStreet({ scene, t }: { scene: 'selfie' | 'yop' | 'plateau' | 'amis' | 'couloir'; t: number }) {
  const wide = useThree((s) => s.size.width >= s.size.height)
  const night = scene === 'couloir'
  const plateau = scene === 'plateau'
  // The phone in her hand moves a little: the image too.
  const shake: [number, number] = [Math.sin(t * 2.3) * 0.03 + Math.sin(t * 5.1) * 0.012, Math.cos(t * 1.9) * 0.025]
  const facades: [number, number, string][] = plateau
    ? [[-9, 30, '#9fb4c8'], [-2.5, 42, '#c9d3dd'], [4.5, 26, '#7f93a8'], [11, 36, '#b5c2cf']]
    : [[-6.4, 7, '#e9a23b'], [0, 9, night ? '#2f2a5e' : '#5aa0d8'], [6.4, 6.5, night ? '#5b3f7a' : '#f2c94c'], [12.8, 8, night ? '#3a3f5e' : '#e8796b'], [-12.8, 6, night ? '#3d3550' : '#7cc28a']]
  const cam: [number, number, number] =
    scene === 'selfie' ? [0.15 + shake[0], 2.0 + shake[1], 7.3] : scene === 'plateau' ? [-19 + t * 0.25, 2.1, -1.2] : scene === 'couloir' ? [0.5 + t * 0.05, 1.6, 9.5 - t * 0.25] : [-1 + t * 0.25 + shake[0], 1.75 + shake[1], wide ? 10 : 13]
  const look: [number, number, number] = scene === 'selfie' ? [0, 1.72, 4.4] : scene === 'plateau' ? [2, 2.4, -6.5] : scene === 'couloir' ? [-1, 1.2, -6] : [0.5 + t * 0.25, 1.8, 2]
  return (
    <>
      <hemisphereLight args={[night ? '#8f9cff' : '#fff4e6', night ? '#2a2a4e' : '#c0704f', night ? 0.7 : 1.2]} />
      <directionalLight position={[4, 9, 8]} intensity={night ? 0.25 : 2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <ambientLight intensity={night ? 0.4 : 0.4} />
      {night && <pointLight position={[1.5, 3.4, 3]} intensity={18} distance={14} color="#ffc27a" />}
      <Camera at={cam} look={look} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.4]} receiveShadow>
        <planeGeometry args={[80, 7.6]} />
        <meshLambertMaterial color={night ? '#2b2d3a' : '#5b5f6b'} />
      </mesh>
      {[...Array(18)].map((_, i) => (
        <mesh key={i} position={[-34 + i * 4, 0.01, -0.4]}>
          <boxGeometry args={[2, 0.02, 0.18]} />
          <meshLambertMaterial color="#f4f4f0" />
        </mesh>
      ))}
      {[[3.9, 0.9], [-4.9, 0.9]].map(([z, d]) => (
        <mesh key={z} position={[0, 0.09, z + (z > 0 ? 1.2 : -1.2)]} receiveShadow>
          <boxGeometry args={[80, 0.18, 2.4 + d]} />
          <meshLambertMaterial color={night ? '#5b5468' : plateau ? '#d9d6cf' : '#cfc5b4'} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 10]} receiveShadow>
        <planeGeometry args={[80, 10]} />
        <meshLambertMaterial color={night ? '#3a3448' : '#cbb38c'} />
      </mesh>
      {facades.map(([x, h, c]) => (
        <mesh key={x} position={[x, h / 2, plateau ? -13 : -9.5]} castShadow receiveShadow>
          <boxGeometry args={[plateau ? 6 : 6.2, h, plateau ? 8 : 3]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
      {/* The towers' windows, in rows */}
      {plateau &&
        facades.flatMap(([x, h], k) =>
          [...Array(Math.floor(h / 2.2))].map((_, i) => (
            <mesh key={`${k}-${i}`} position={[x, 1.6 + i * 2.2, -8.95]}>
              <boxGeometry args={[5.4, 0.9, 0.05]} />
              <meshLambertMaterial color="#3d5a7a" />
            </mesh>
          )),
        )}
      {scene === 'yop' && <Sign p={[0, 5.2, -7.9]} w={4.8} text="YOPOUGON" bg="#ff7a00" />}
      {scene === 'yop' && <Sign p={[6.4, 4.2, -7.9]} w={3.6} text="PHARMACIE" bg="#00a862" />}
      {scene === 'yop' && <Sign p={[-6.4, 4.2, -7.9]} w={3.6} text="MAQUIS" bg="#d6202a" />}
      {plateau && <Sign p={[-2.5, 4.5, -8.9]} w={6} text="CITÉ ADMINISTRATIVE" bg="#1f4fa0" />}
      {(scene === 'selfie' || scene === 'amis') && <Sign p={[0, 5.2, -7.9]} w={4.8} text="YOPOUGON" bg="#ff7a00" />}
      {/* Awa, filming herself: the phone held up at arm's length */}
      {scene === 'selfie' && (
        <group position={[0, 0.18, 4.4]} rotation={[0, 0.08 + Math.sin(t * 0.7) * 0.08, 0]}>
          <BlockHuman look={AWA} gender="femme" pose={Math.floor(t / 1.4) % 3 === 2 ? 'wave' : 'talk'} seed={11} />
        </group>
      )}
      {scene === 'selfie' &&
        [CREW[0], CREW[4]].map((c, i) => (
          <group key={i} position={[-5 + ((t * 1.1 + i * 6) % 12), 0.18, 2.6 - i * 4.4]} rotation={[0, Math.PI / 2, 0]}>
            <BlockHuman look={c.look} gender={c.gender} pose="walk" seed={i + 20} />
          </group>
        ))}
      {/* Yop: people about, the pastor's corner, the pupils */}
      {scene === 'yop' && (
        <>
          <StreetSpot spot={{ id: 'pasteur:live:1', kind: 'pasteur', at: [5, 0], rot: 0, w: 8, len: 30, seed: 0.7 }} />
          <StreetSpot spot={{ id: 'ecole:live:1', kind: 'ecole', at: [-2, 0], rot: 0, w: 8, len: 30, seed: 0.3 }} />
        </>
      )}
      {/* The Plateau: the fonctionnaires going home (« la descente ») */}
      {plateau && <StreetSpot spot={{ id: 'bureau:live:2', kind: 'bureau', at: [-2, 0], rot: 0, w: 8, len: 34, seed: 0.7 }} />}
      {/* Two players meeting: a wave, then the phones */}
      {scene === 'amis' && (
        <>
          <group position={[-0.5, 0.18, 4.4]} rotation={[0, Math.PI / 2 - 0.4, 0]}>
            <BlockHuman look={AWA} gender="femme" pose={t < 2.5 ? 'wave' : 'phone'} seed={11} />
          </group>
          <group position={[1.1, 0.18, 4.4]} rotation={[0, -Math.PI / 2 + 0.4, 0]}>
            <BlockHuman look={CREW[3].look} gender="femme" pose={t < 2.5 ? 'cheer' : 'phone'} seed={2} />
          </group>
        </>
      )}
      {/* The couloir, at night: the nouchis come out */}
      {scene === 'couloir' && <NouchiCorner spot={{ id: 'nouchi:live:1', at: [-1, -7], rot: Math.PI / 2, w: 3, len: 10, seed: 0.3 }} close={16} />}
      {scene === 'couloir' && (
        <group position={[0.6, 0.18, 4.6]} rotation={[0, Math.PI + 0.3, 0]}>
          <BlockHuman look={AWA} gender="femme" pose="walk" seed={11} />
        </group>
      )}
    </>
  )
}

/** The street food: the garbadrome and the alloco tantie at noon; the pain brochette at night. */
function Stalls({ scene, t }: { scene: 'garba' | 'brochette'; t: number }) {
  const night = scene === 'brochette'
  return (
    <>
      <hemisphereLight args={[night ? '#8f9cff' : '#fff4e6', night ? '#2a2a4e' : '#c0704f', night ? 0.6 : 1.2]} />
      <directionalLight position={[4, 9, 8]} intensity={night ? 0.2 : 2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <ambientLight intensity={0.4} />
      <Camera at={night ? [1.6 + Math.sin(t * 0.3) * 0.8, 2.1, 6.4 - t * 0.12] : [-0.5 + t * 0.62, 2.3, 7]} look={night ? [0.4, 1.1, 0.5] : [-0.5 + t * 0.62, 1.2, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 40]} />
        <meshLambertMaterial color={night ? '#4a4258' : '#c9a77a'} />
      </mesh>
      {night ? (
        <StreetStall stall={{ id: 'brochette:live:1', kind: 'brochette', at: [0, 0], rot: 0, seed: 0.62 }} hour={21} crowd />
      ) : (
        <>
          <StreetStall stall={{ id: 'garba:live:1', kind: 'garba', at: [0, 0], rot: 0, seed: 0.4 }} hour={12} crowd />
          <StreetStall stall={{ id: 'alloco:live:1', kind: 'alloco', at: [6.5, 0.4], rot: -0.2, seed: 0.55 }} hour={12} crowd />
        </>
      )}
    </>
  )
}

/* ---------- The gameplay: what you do in a day ---------- */

/** The player's perso in « gameplay »: a young man, his jersey and his cap. */
const HERO = L({ skin: '#6e4024', hair: 'short', outfit: 'jersey', outfitColor: '#ff8200', accessory: 'capback', accessoryColor: '#00a862' })
/** The zoo's three cameras, as in the game (from above, close, over the shoulder), 1.5 s each. */
const ZOO_VIEWS = ['VUE DE HAUT', 'VUE DE PRÈS', "VUE À L'ÉPAULE"]
const zooView = (t: number) => Math.min(2, Math.floor(t / 1.5))

/** The shower at home, the zoo seen through the game's three cameras, the loto seller. */
function Jeu({ scene, t }: { scene: 'douche' | 'zoo' | 'loto'; t: number }) {
  const lights = (
    <>
      <hemisphereLight args={['#fff4e6', '#c0704f', 1.2]} />
      <directionalLight position={[6, 14, 8]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
      <ambientLight intensity={0.45} />
    </>
  )
  if (scene === 'douche') {
    // The bathroom: tiles, the pipe and the bucket; the perso in his towel under the water.
    return (
      <>
        {lights}
        <pointLight position={[0.6, 2.4, 1.2]} intensity={6} distance={6} color="#fff1dc" />
        <Camera at={[2 - t * 0.08, 1.9, 5.4 - t * 0.2]} look={[0, 1.45, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <meshLambertMaterial color="#d9e4e8" />
        </mesh>
        <mesh position={[0, 1.5, -0.86]} receiveShadow>
          <boxGeometry args={[6, 3, 0.1]} />
          <meshLambertMaterial color="#8fc6d9" />
        </mesh>
        <mesh position={[-1.3, 1.5, 0]} receiveShadow>
          <boxGeometry args={[0.1, 3, 6]} />
          <meshLambertMaterial color="#a9d4e2" />
        </mesh>
        {[0.4, 0.8, 1.2, 1.6, 2.0, 2.4].map((y) => (
          <mesh key={y} position={[0, y, -0.8]}>
            <boxGeometry args={[6, 0.02, 0.01]} />
            <meshBasicMaterial color="#e9f4f8" />
          </mesh>
        ))}
        <BlockHuman look={{ ...HERO, outfit: 'serviette', accessory: 'none' }} gender="homme" pose="wash" seed={2} />
        <Shower />
      </>
    )
  }
  if (scene === 'zoo') {
    // Down the zoo's main alley, the camera switching like the game's « Changer de vue ».
    // Off the alley to the elephants' wall (the elephant at x -28), then the camera switches.
    const x = -5.6 - Math.min(4.8, t * 1.1)
    const z = -10.4
    const v = zooView(t)
    const at: [number, number, number] = v === 0 ? [x + 4, 19, z + 2] : v === 1 ? [x - 3.2, 2.1, z + 2.6] : [x + 2.6, 3.1, z + 0.7]
    const look: [number, number, number] = v === 0 ? [x - 9, 0, z - 1.5] : v === 1 ? [x, 1.6, z] : [-28, 2.2, -12]
    return (
      <>
        {lights}
        <Camera at={at} look={look} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshLambertMaterial color="#6fae4b" />
        </mesh>
        <Landmark id="cocody-zoo" night={false} />
        <group position={[x, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
          <BlockHuman look={HERO} gender="homme" pose={t < 4.4 ? 'walk' : 'cheer'} seed={1} />
        </group>
        <group position={[x + 0.4, 0, z + 1.2]} rotation={[0, -Math.PI / 2, 0]}>
          <BlockHuman look={CREW[1].look} gender="femme" pose={t < 4.4 ? 'walk' : 'phone'} seed={4} />
        </group>
      </>
    )
  }
  // The loto seller's kiosk on the pavement; the perso playing his numbers.
  return (
    <>
      {lights}
      <Camera at={[2.4 + t * 0.12, 2.2, 8 - t * 0.35]} look={[0, 1.3, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      <StreetStall stall={{ id: 'loto:jeu:1', kind: 'loto', at: [0, 0], rot: 0, seed: 0.5 }} hour={12} crowd />
      <group position={[1.6, 0, 3.4]} rotation={[0, Math.PI * 0.85, 0]}>
        <BlockHuman look={HERO} gender="homme" pose={t > 1.4 ? 'phone' : 'talk'} seed={3} />
      </group>
    </>
  )
}

/** The match at the stadium, then the concert, seen from the stands. */
function Stade({ scene, t }: { scene: 'stade' | 'concert'; t: number }) {
  const concert = scene === 'concert'
  // A made-up event under way, the same at every frame: a goal 2 s into the shot.
  const demo = useMemo(() => {
    const now = (EPOCH + 63.3) / 60
    return concert
      ? { kind: 'concert' as const, title: 'DJ Garba Chaud en concert', detail: '', start: now - 30, end: now + 180, artist: 'DJ Garba Chaud', genre: 'coupé-décalé' }
      : { kind: 'match' as const, title: 'Babi Sporting – Yop City FC', detail: '', start: now - 30, end: now + 90, home: 'Babi Sporting', away: 'Yop City FC', homeGoals: [12, 30.035], awayGoals: [21] }
  }, [concert])
  const a = (concert ? 0.9 : -0.6) + t * 0.05
  return (
    <>
      <hemisphereLight args={[concert ? '#8f9cff' : '#fff4e6', concert ? '#2a2a4e' : '#c0704f', concert ? 0.5 : 1.2]} />
      <directionalLight position={[40, 80, 50]} intensity={concert ? 0.2 : 2} />
      <ambientLight intensity={0.35} />
      <Camera at={concert ? [8 - t * 0.6, 17, 22] : [Math.sin(a) * 62, 30, Math.cos(a) * 50]} look={concert ? [-44, 7, 0] : [0, 1, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshLambertMaterial color={concert ? '#3a3448' : '#b98b5c'} />
      </mesh>
      <Landmark id="plateau-stade" night={concert} demo={demo} />
    </>
  )
}


/* ---------- « tout »: the trailer's places (the plane, the Plateau, the grin) ---------- */

/** The sky behind a shot (top to horizon) and its haze; gone at the next shot. */
function Sky({ top, horizon, haze }: { top: string; horizon: string; haze?: [number, number] }) {
  const scene = useThree((s) => s.scene)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, top)
    grad.addColorStop(1, horizon)
    g.fillStyle = grad
    g.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [top, horizon])
  const [near, far] = haze ?? [0, 0]
  useLayoutEffect(() => {
    scene.background = tex
    scene.fog = far ? new THREE.Fog(horizon, near, far) : null
    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene, tex, horizon, near, far])
  return null
}

/**
 * A sky round the camera, light at the horizon, deep blue overhead: seen from a drone looking down, the
 * screen-wide gradient of <Sky> puts deep blue right above the hazy horizon, a hard line like a wall.
 */
function SkyDome({ top, horizon, r }: { top: string; horizon: string; r: number }) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(r, 48, 96)
    const [a, b] = [new THREE.Color(horizon), new THREE.Color(top)]
    const pos = g.attributes.position
    const col = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const c = a.clone().lerp(b, ease(clamp01(pos.getY(i) / r / 0.3)))
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [top, horizon, r])
  return (
    <mesh geometry={geo} renderOrder={-1}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}

/** A tower's face: windows in rows (the Cité administrative's). */
let towerTex: THREE.CanvasTexture | null = null
function towerMaterial() {
  if (!towerTex) {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = '#e9e4da'
    g.fillRect(0, 0, 64, 64)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y * 3) % 5 ? '#5b87b0' : '#8fb6d6'
        g.fillRect(x * 16 + 3, y * 16 + 4, 10, 9)
      }
    towerTex = new THREE.CanvasTexture(c)
    towerTex.colorSpace = THREE.SRGBColorSpace
    towerTex.wrapS = towerTex.wrapT = THREE.RepeatWrapping
    towerTex.magFilter = THREE.NearestFilter
  }
  return towerTex
}

/** The Cité administrative's five towers (A to E), next to the Tour F, as they stand (metres from it). */
const CITE: [number, number, number, number, number][] = [
  [-118, 150, 24, 82, 16], [-62, 168, 24, 88, 16], [-4, 150, 24, 92, 16], [54, 168, 24, 86, 16], [110, 150, 24, 80, 16],
]

function Tower({ at, w, h, d, tint = '#ffffff' }: { at: [number, number]; w: number; h: number; d: number; tint?: string }) {
  const map = useMemo(() => {
    const m = towerMaterial().clone()
    m.repeat.set(w / 8, h / 8)
    m.needsUpdate = true
    return m
  }, [w, h])
  return (
    <mesh position={[at[0], h / 2, at[1]]}>
      <boxGeometry args={[w, h, d]} />
      <meshLambertMaterial map={map} color={tint} />
    </mesh>
  )
}

/** The lagoon west of the Plateau as a shape: its two shores wind (a straight edge reads as a wall from the drone). */
const LAGOON = (() => {
  const shore = (x: number, z: number, k: number) => x + Math.sin(z / 260 + k) * 120 + Math.sin(z / 97 + k * 2) * 45
  const sh = new THREE.Shape()
  const zs = [...Array(61)].map((_, i) => -6000 + i * 200)
  sh.moveTo(shore(-520, zs[0], 0), zs[0])
  for (const z of zs) sh.lineTo(shore(-520, z, 0), z)
  for (const z of [...zs].reverse()) sh.lineTo(shore(-3300, z, 3), z)
  // The shape is drawn in x/y; laid flat (rotated -90° on x) its y becomes -z.
  return new THREE.ShapeGeometry(sh)
})()

/** The rest of the Plateau round the Cité: offices, a few towers, kept off the lagoon (west), the Cité and the landmarks. */
const PLATEAU_CITY = (() => {
  const r = rng('plateau-ville')
  const out: { at: [number, number]; w: number; h: number; d: number; tint: string }[] = []
  const clear = (x: number, z: number, cx: number, cz: number, m: number) => Math.hypot(x - cx, z - cz) < m
  while (out.length < 150) {
    const a = r() * Math.PI * 2
    const dist = 170 + r() * 1150
    const x = Math.sin(a) * dist
    const z = Math.cos(a) * dist
    if (x < -470 || (Math.abs(x) < 150 && z > 110 && z < 205) || clear(x, z, 235, 286, 90) || clear(x, z, 634, 1470, 110)) continue
    const tall = r() < 0.15
    out.push({ at: [x, z], w: 18 + r() * 24, d: 18 + r() * 24, h: tall ? 70 + r() * 60 : 14 + r() * 40, tint: ['#ffffff', '#dfe9f2', '#f4e7d2', '#cfe0ea', '#e8f0e0'][Math.floor(r() * 5)] })
  }
  return out
})()

/** The Plateau: the drone climbing the Tour F (up the facade, then back to see it over the Plateau), the mass in the cathedral. */
function Plateau({ scene, t }: { scene: 'tourf' | 'messe'; t: number }) {
  if (scene === 'messe') {
    const { altar, pit, front } = NAVE_VIEW
    return (
      <>
        <Camera at={[Math.sin(t * 0.4) * 2, 6 - t * 0.6, front - 6 - t * 4]} look={[altar[0], -pit + 2.5, altar[1]]} near={0.3} far={900} />
        <NaveWorld night={false} mass />
      </>
    )
  }
  const a = 0.5 + t * 0.12
  const up = ease(clamp01(t / 2.6))
  const back = ease(clamp01((t - 2.4) / 1.8))
  const y = 14 + up * 300 - back * 60
  const r = 175 + back * 520
  return (
    <>
      <Sky top="#3b8de0" horizon="#dcefff" haze={[1400, 5200]} />
      <SkyDome top="#2f80d8" horizon="#dcefff" r={4800} />
      <hemisphereLight args={['#fff4e6', '#8a7a62', 1.2]} />
      <directionalLight position={[300, 500, 200]} intensity={2.1} />
      <ambientLight intensity={0.35} />
      <Camera at={[Math.sin(a) * r, y, Math.cos(a) * r]} look={[0, y + 18 - up * 40 - back * 70, 0]} near={1} far={6000} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12000, 12000]} />
        <meshLambertMaterial color="#949484" />
      </mesh>
      {/* The lagoon, all along the west of the Plateau, its shores winding; the forest on the far one */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.5, 0]} geometry={LAGOON}>
        <meshLambertMaterial color="#2f78a8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6200, 0.8, 0]}>
        <planeGeometry args={[6000, 12000]} />
        <meshLambertMaterial color="#5f8a4c" />
      </mesh>
      <Landmark id="plateau-tour-f" night={false} />
      {CITE.map(([x, z, w, h, d], i) => (
        <Tower key={i} at={[x, z]} w={w} h={h} d={d} />
      ))}
      {PLATEAU_CITY.map((b, i) => (
        <Tower key={`v${i}`} {...b} />
      ))}
      <group position={[235, 0, 286]}>
        <Landmark id="plateau-cathedrale" night={false} />
      </group>
      <group position={[634, 0, 1470]}>
        <Landmark id="plateau-pyramide" night={false} />
      </group>
    </>
  )
}

/** The top 20's zoo: Awa's selfie at the lions' cage (the male on his rock behind her), a friend dabbing, the camera coming in. */
function Lions({ t }: { t: number }) {
  const k = ease(clamp01(t / 4.5))
  return (
    <>
      <hemisphereLight args={['#fff4e6', '#c0704f', 1.2]} />
      <directionalLight position={[6, 14, 8]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
      <ambientLight intensity={0.45} />
      <Sky top="#58a6ea" horizon="#ffe9c8" />
      <Camera at={[5.6 - k * 2.4, 1.95 - k * 0.25, -23.6 - k * 3]} look={[0.6 - k * 0.4, 1.7, -37]} near={0.2} far={400} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshLambertMaterial color="#6fae4b" />
      </mesh>
      <Landmark id="cocody-zoo" night={false} />
      <group position={[1.6, 0, -31.2]} rotation={[0, 0.5, 0]}>
        <BlockHuman look={CREW[1].look} gender="femme" pose="film" seed={4} />
      </group>
      <group position={[2.5, 0, -31.5]} rotation={[0, 0.25, 0]}>
        <BlockHuman look={HERO} gender="homme" pose={t < 1.6 ? 'cheer' : 'dab'} seed={1} />
      </group>
    </>
  )
}

/** Le grin by day: the tea being made, the three of them on their benches, the camera going round. */
function GrinScene({ t }: { t: number }) {
  const a = 0.5 + t * 0.2
  return (
    <>
      <Sky top="#58a6ea" horizon="#ffe9c8" />
      <hemisphereLight args={['#fff4e6', '#c0704f', 1.25]} />
      <directionalLight position={[4, 9, 6]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
      <ambientLight intensity={0.4} />
      <Camera at={[Math.sin(a) * 5.6, 2.1, Math.cos(a) * 5.6]} look={[0, 0.6, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#c9a77a" />
      </mesh>
      {/* The courtyard wall behind */}
      <mesh position={[0, 1.1, -4.2]} receiveShadow>
        <boxGeometry args={[14, 2.2, 0.3]} />
        <meshLambertMaterial color="#e3c9a0" />
      </mesh>
      <mesh position={[0, 0.25, -4.04]}>
        <boxGeometry args={[14, 0.5, 0.02]} />
        <meshLambertMaterial color="#ff8200" />
      </mesh>
      <Grin seed="bande-annonce" />
    </>
  )
}

/** Le zouglou at night outside the maquis: five of them in a line, the game's own dance moves (avatar/emotes.ts). */
const ZOUGLOU: [Pose, 'femme' | 'homme'][] = [
  ['gweta', 'femme'],
  ['zouglou', 'homme'],
  ['moonwalk', 'homme'],
  ['zouglou', 'homme'],
  ['gweta', 'femme'],
]

/** The top 20's beat (marketing/beat.py), and when the zouglou's take starts in the film (&from): the line dances on it. */
const ZOUGLOU_BPM = 128
const ZOUGLOU_IN = Number(q.get('from') ?? 0)

function Zouglou({ t }: { t: number }) {
  const looks = useMemo(() => ZOUGLOU.map(([, g], i) => randomLook(g, rng(`zouglou${i}`))), [])
  const bulbs = [...Array(16)].map((_, i) => [-6 + i * 0.8, 3.3 - Math.sin((i / 15) * Math.PI) * 0.6, -2.2] as [number, number, number])
  // Beats into the film: the line steps side to side over two beats, dips on each one, the bulbs change on it.
  const b = ((t + ZOUGLOU_IN) * ZOUGLOU_BPM) / 60
  const step = Math.sin((b * Math.PI) / 2)
  const dip = Math.abs(Math.sin(b * Math.PI))
  const hit = Math.pow(1 - (b % 1), 3)
  const x = -1.9 + t * 0.85
  return (
    <>
      <hemisphereLight args={['#8f9cff', '#2a2a4e', 0.75]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 3.2, 1.8]} intensity={16 + hit * 14} distance={14} color="#ffc27a" />
      <pointLight position={[-4, 2.5, -1]} intensity={8} distance={10} color="#ff7a00" />
      <pointLight position={[4, 2.5, -1]} intensity={4 + hit * 10} distance={10} color={Math.floor(b) % 2 ? '#00d27a' : '#ff3d7f'} />
      {/* Coming in on them from the side, low, as one would with a phone in the crowd */}
      <Camera at={[x, 1.0 + t * 0.1, 8.8 - ease(clamp01(t / 4.5)) * 3.4]} look={[x * 0.5, 1.2, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshLambertMaterial color="#4a4560" />
      </mesh>
      {/* The maquis behind: its wall, its colours, its string of bulbs */}
      <mesh position={[0, 1.6, -2.6]}>
        <boxGeometry args={[16, 3.2, 0.3]} />
        <meshLambertMaterial color="#2f6b4f" />
      </mesh>
      <mesh position={[0, 2.7, -2.44]}>
        <boxGeometry args={[16, 0.4, 0.02]} />
        <meshBasicMaterial color="#ffd166" />
      </mesh>
      {bulbs.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshBasicMaterial color={['#ffc233', '#ff7a00', '#00b86b', '#ffffff'][(i + Math.floor(b)) % 4]} />
        </mesh>
      ))}
      {ZOUGLOU.map(([pose, gender], i) => (
        <group key={i} position={[(i - 2) * 1.25 + step * 0.22, -dip * 0.06, -Math.abs(i - 2) * 0.35]} rotation={[0, (2 - i) * 0.12 + step * 0.35, 0]}>
          <Character look={looks[i]} gender={gender} pose={pose} stage="adulte" marker={false} seed={i * 1.7} />
        </group>
      ))}
    </>
  )
}

/** What Awa's followers write, as the live goes. */
const LIVE_COMMENTS: [number, string, string][] = [
  [1.5, 'koffi_225', 'Awa on est là 🔥'],
  [3.2, 'mariam.yop', 'On te voit bien !'],
  [5, 'le_vrai_bk', 'Bonsoir Babi 🇨🇮'],
  [8, 'aya.k', 'Montre-nous !'],
  [12, 'fanta.d', 'Ton pagne là est joli dèh'],
  [16, 'ibou', 'Moi je veux les lunettes 😎'],
  [21, 'kader.abobo', 'Yop c’est chez moi !!'],
  [25, 'mamie.c', 'C’est Yopougon vraiment ?'],
  [29, 'koffi_225', 'Donne-moi milieu là 😂😂'],
  [33, 'awa.fan', 'Waye même ? Ça c’est fort'],
  [39, 'le_vrai_bk', 'Pain brochette c’est la vie'],
  [45, 'aya.k', 'Le woro-woro 😭'],
  [49, 'ibou', 'Gnango c’est rapide'],
  [53, 'serge.plateau', 'Je suis fonctionnaire, c’est faux 😤'],
  [56.5, 'mariam.yop', '15 h la descente 😂😂😂'],
  [61, 'kader.abobo', 'Je vais construire ma villa'],
  [64.5, 'fanta.d', 'ALLEZ BABI SPORTING ⚽'],
  [66.5, 'koffi_225', 'BUUUT 🔥🔥🔥'],
  [68.5, 'mamie.c', 'DJ Garba Chaud 🎶'],
  [72, 'aya.k', 'Ajoute-moi Awa !'],
  [76, 'ibou', 'Gbairai c’est mieux que WhatsApp'],
  [82, 'le_vrai_bk', 'Les nouchis de mon quartier là 😂'],
  [85, 'serge.plateau', 'Téléphone dans la poche !'],
  [88, 'fanta.d', 'Bisous Awa 😘'],
]

/** The live's frame: « EN DIRECT », the viewers, Awa's name, the comments, the hearts, her face in a bubble. */
function LiveOverlay({ t, shot }: { t: number; shot: Shot }) {
  const viewers = Math.round(230 + 12000 * (1 - Math.exp(-t / 35)) + Math.sin(t * 3) * 25)
  const shown = LIVE_COMMENTS.filter(([at]) => at <= t).slice(-3)
  const hearts = [...Array(9)].map((_, i) => {
    const k = ((t * 0.55 + i * 0.37) % 1 + 1) % 1
    return { k, x: Math.sin(i * 2.7 + t) * 22, c: ['#ff3d6e', '#ff7a00', '#ffd43b', '#ff3d6e', '#ffffff'][i % 5] }
  })
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/55 to-transparent px-6 pt-8 pb-12 font-sans">
        <span className="block h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#ff7a00] bg-[#ffd8a8]">
          <AwaFace t={t} size={56} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[26px] leading-none font-extrabold">awa.babi</div>
          <div className="mt-1 text-[18px] font-bold text-white/80">Yopougon · Babi Life</div>
        </div>
        <span className="rounded-lg bg-[#ff2d55] px-3 py-1.5 text-[20px] font-extrabold tracking-wide">● EN DIRECT</span>
        <span className="flex items-center gap-1.5 rounded-lg bg-black/45 px-3 py-1.5 text-[20px] font-extrabold">
          <Eye size={20} /> {viewers.toLocaleString('fr-FR')}
        </span>
      </div>
      {shot.title && (
        <div className="absolute inset-x-0 top-[10.5%] flex justify-center px-8">
          <div className="rounded-full bg-[var(--color-orange)] px-6 py-2 text-[34px] leading-tight font-extrabold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" key={shot.from} style={{ animation: 'none', opacity: Math.min(1, (t - shot.from) / 0.4) }}>
            {shot.title}
          </div>
        </div>
      )}
      {/* Awa's face, filming herself (not in the selfie: there she's the whole picture) */}
      {shot.scene !== 'selfie' && (
        <div className="absolute top-[17%] right-6 h-[210px] w-[160px] overflow-hidden rounded-[28px] border-[4px] border-white/90 bg-[#ffb37a] shadow-[0_16px_40px_-14px_rgba(0,0,0,0.7)]">
          <AwaFace t={t} size={210} talking />
        </div>
      )}
      {/* The comments, bottom left */}
      <div className="absolute bottom-[19%] left-6 flex w-[62%] flex-col gap-2.5 font-sans">
        {shown.map(([at, who, text]) => (
          <div key={at} className="flex items-start gap-2.5 rounded-2xl bg-black/40 px-3.5 py-2" style={{ opacity: Math.min(1, (t - at) / 0.3) }}>
            <span className="text-[20px] leading-snug font-extrabold text-[#ffd43b]">{who}</span>
            <span className="text-[20px] leading-snug font-bold">{text}</span>
          </div>
        ))}
      </div>
      {/* The hearts going up on the right */}
      <div className="absolute right-10 bottom-[19%] h-[420px] w-20">
        {hearts.map((h, i) => (
          <Heart key={i} size={34} className="absolute bottom-0 left-1/2" style={{ transform: `translate(${h.x - 17}px, ${-h.k * 400}px) scale(${0.7 + h.k * 0.5})`, opacity: 1 - h.k, color: h.c, fill: h.c }} />
        ))}
      </div>
      {/* What she says, as subtitles */}
      {shot.cap && (
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center px-10">
          <div className="rounded-2xl bg-white px-5 py-2.5 text-center text-[34px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]">{shot.cap}</div>
        </div>
      )}
    </>
  )
}

/** Awa's face, as the phone's front camera sees it: talking, now and then smiling. */
function AwaFace({ t, size, talking }: { t: number; size: number; talking?: boolean }) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas frameloop="never" gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} dpr={2} camera={{ fov: 30, near: 0.1, far: 20, position: [0, 1.66, size > 100 ? 1.55 : 1.1] }} onCreated={({ camera }) => camera.lookAt(0, 1.6, 0)}>
        <hemisphereLight args={['#fff4e6', '#c0704f', 1.3]} />
        <directionalLight position={[1, 3, 3]} intensity={1.6} />
        <group rotation={[0, Math.sin(t * 0.9) * 0.15, 0]}>
          <BlockHuman look={AWA} gender="femme" pose={talking && Math.floor(t / 2.2) % 4 === 3 ? 'cheer' : 'talk'} seed={11} />
        </group>
      </Canvas>
    </div>
  )
}

/** Paying the alloco with Waye, on the phone. */
function WayePay({ t }: { t: number }) {
  const up = ease(clamp01(t / 0.5))
  const paid = t > 1.4
  return (
    <div className="absolute inset-x-0 bottom-[25%] flex justify-center font-sans" style={{ transform: `translateY(${(1 - up) * 80}%)`, opacity: up }}>
      <div className="w-[300px] rounded-[40px] bg-[#141416] p-2.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="rounded-[32px] bg-white px-5 pt-5 pb-6 text-[var(--color-ink)]">
          <div className="flex items-center gap-3">
            <AppLogo id="waye" size={46} radius={14} />
            <span className="font-display text-[26px] font-extrabold">Waye</span>
          </div>
          <div className="mt-4 text-[17px] font-bold text-[var(--color-ink-soft)]">Payer · Tantie alloco</div>
          <div className="font-display text-[46px] leading-none font-extrabold">300 F</div>
          <div className={`mt-4 flex items-center justify-center gap-2 rounded-full py-2.5 text-[20px] font-extrabold ${paid ? 'bg-[#e6f8ef] text-[var(--color-emerald-deep)]' : 'bg-[#1aa6e6] text-white'}`}>{paid ? <><Check size={22} strokeWidth={3} /> Payé</> : 'Payer'}</div>
        </div>
      </div>
    </div>
  )
}

/** Gbairai: two friends writing to each other. */
function GbairaiChat({ t }: { t: number }) {
  const up = ease(clamp01(t / 0.5))
  const lines: [number, boolean, string][] = [
    [0.6, false, 'Awa ! On va au stade samedi ?'],
    [1.8, true, 'Oui oh ! Babi Sporting contre Yop City 🔥'],
    [3.1, false, 'On se retrouve devant le garbadrome à 15 h'],
    [4.3, true, 'Ok, à samedi ! 😘'],
  ]
  return (
    <div className="absolute inset-x-0 bottom-[22%] flex justify-center font-sans" style={{ transform: `translateY(${(1 - up) * 80}%)`, opacity: up }}>
      <div className="w-[360px] rounded-[44px] bg-[#141416] p-2.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="overflow-hidden rounded-[36px] bg-white text-[var(--color-ink)]">
          <div className="flex items-center gap-3 border-b border-black/5 px-5 pt-5 pb-3">
            <AppLogo id="gbairai" size={42} radius={13} />
            <div>
              <div className="font-display text-[22px] leading-none font-extrabold">Fanta</div>
              <div className="text-[14px] font-bold text-[#2fb344]">En ligne</div>
            </div>
          </div>
          <div className="flex min-h-[250px] flex-col gap-2 p-4">
            {lines.map(([at, mine, text]) =>
              t >= at ? (
                <div key={at} className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[18px] leading-snug font-bold ${mine ? 'self-end rounded-br-sm bg-[#ffe0c7] text-[#4a2200]' : 'self-start rounded-bl-sm bg-[#f1f2f6]'}`} style={{ opacity: clamp01((t - at) / 0.25) }}>
                  {text}
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- The video: 25 seconds, scene after scene ---------- */

type Shot = { from: number; to: number; scene: SceneId; title?: string; sub?: string; /** Its number, in the film that goes through everything. */ n?: number; /** The live: what Awa says, as a subtitle. */ cap?: string; /** « Merci »: the follower counter, the gift that hides. */ counter?: boolean; tease?: boolean; /** « Arnaque »: what the phone shows, and the tip. */ phone?: 'msg' | 'page' | 'drain' | 'call' | 'masque'; tip?: number; /** « top20 »: what Awa says (the captions). */ say?: string; /** « Sortie »: the gift opens on the date; the date pinned at the top; what's new in the game, shown. */ reveal?: boolean; date?: boolean; nouveau?: 'politique' | 'matchs' | 'flashe' | 'horsligne'; /** « Bébé »: the game's screen played over the scene (lab/bebeFilm.tsx). */ screen?: BebeScreen }
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
      { from: 61, to: 66.5, scene: 'phone', n: 11, title: 'Ton téléphone', sub: 'Waye, Gnango, Garbaya, Store, les infos du pays' },
      { from: 66.5, to: 71, scene: 'crew' },
    ],
    intro: 3.4,
    outro: 66.5,
    length: 71,
    hook: ['Tout ce que', 'tu peux faire', 'à Babi'],
  },
  // Awa's live: her voice (marketing/out/voix-live.mp3, 96 s) over the game, shot by shot.
  live: {
    shots: [
      { from: 0, to: 6.1, scene: 'selfie', cap: 'Allô allô ! Vous me voyez ?' },
      { from: 6.1, to: 10.3, scene: 'selfie', cap: 'Suivez-moi, on marche ensemble !' },
      { from: 10.3, to: 19.1, scene: 'look', title: 'Ton perso', cap: 'Visage, coiffure, pagne, lunettes, sac…' },
      { from: 19.1, to: 27.1, scene: 'yop', title: 'Ton vrai quartier', cap: 'Ça, c’est Yopougon, le vrai Yop !' },
      { from: 27.1, to: 37.5, scene: 'garba', title: 'Le garbadrome', cap: '« Donne-moi grosse queue là-bas ! »' },
      { from: 37.5, to: 44.2, scene: 'brochette', title: 'Le pain brochette', cap: 'Celui-là, c’est mon péché !' },
      { from: 44.2, to: 48, scene: 'gbaka', title: 'Pour bouger', cap: 'Woro-woro, gbaka, bus SITRA…' },
      { from: 48, to: 51.2, scene: 'gnango', title: 'Gnango', cap: 'Le prix est fixé avant' },
      { from: 51.2, to: 60.3, scene: 'plateau', title: 'Le Plateau', cap: '15 h… c’est déjà la descente !' },
      { from: 60.3, to: 63.3, scene: 'house', title: 'Ta maison', cap: 'Bloc par bloc' },
      { from: 63.3, to: 67.3, scene: 'stade', title: 'Le stade', cap: 'Toute la tribune chante… BUUUT !' },
      { from: 67.3, to: 70.3, scene: 'concert', title: 'Le concert', cap: 'Les mains en l’air, Babi !' },
      { from: 70.3, to: 81, scene: 'amis', title: 'Tes amis, en vrai', cap: 'Tu leur écris sur Gbairai' },
      { from: 81, to: 86.8, scene: 'couloir', title: 'La nuit…', cap: 'Téléphone dans la poche, les yeux ouverts !' },
      { from: 86.8, to: 89.6, scene: 'selfie', cap: 'Bon, je vous laisse, mon gbaka arrive !' },
      { from: 89.6, to: 96.5, scene: 'crew' },
    ],
    intro: 0,
    outro: 89.6,
    length: 96.5,
    hook: ['', '', ''],
  },
  // « Merci la famille »: 1 500 followers, the weekend, a good week, good news ahead (marketing/scripts/merci-1500.md).
  merci: {
    // Timed on Awa's voice (marketing/out/voix-merci.mp3, 35 s): each shot starts with its sentence.
    shots: [
      { from: 0, to: 3.7, scene: 'salon', cap: 'La famille ! Bonjour bonjour, c’est Awa !' },
      { from: 3.7, to: 8.5, scene: 'salon', counter: true, cap: 'On est 1 500 sur TikTok !' },
      { from: 8.5, to: 13, scene: 'salon', cap: 'Merci ! C’est vous qui nous portez ❤️' },
      { from: 13, to: 16.5, scene: 'fete', title: 'Votre week-end ?', cap: 'Maquis, coupé-décalé…' },
      { from: 16.5, to: 17.9, scene: 'stade', title: 'Votre week-end ?', cap: '… le match au stade…' },
      { from: 17.9, to: 21.1, scene: 'concert', title: 'Votre week-end ?', cap: '… ou dodo à la maison ? Dites-nous !' },
      { from: 21.1, to: 26, scene: 'gbaka', title: 'Bonne semaine !', cap: 'Lundi : on se lève, on se met au travail 💪' },
      { from: 26, to: 30.6, scene: 'salon', tease: true, cap: 'De bonnes nouvelles arrivent… 🤫' },
      { from: 30.6, to: 36.5, scene: 'crew' },
    ],
    intro: 0,
    outro: 30.6,
    length: 36.5,
    hook: ['', '', ''],
  },
  // « On m'a arnaquée » (marketing/scripts/arnaque-waye.md): the link on Gbairai, the code given, the account emptied, what to remember.
  arnaque: {
    // Timed on Awa's voice (marketing/out/voix-arnaque.mp3, 50 s): each shot starts with its sentence.
    shots: [
      { from: 0, to: 5.58, scene: 'chambre', cap: 'Hier soir, on m’a arnaquée 😭' },
      { from: 5.58, to: 10.95, scene: 'chambre', phone: 'msg', cap: 'Un message de « Fanta » sur Gbairai…' },
      { from: 10.95, to: 16.03, scene: 'chambre', phone: 'page', cap: 'Mon numéro… et mon code secret 😬' },
      { from: 16.03, to: 22.2, scene: 'chambre-choc', phone: 'drain', cap: 'Retrait, retrait… 0 F !' },
      { from: 22.2, to: 25.82, scene: 'chambre-choc', phone: 'call', cap: 'Fanta n’a rien envoyé : piratée !' },
      { from: 25.82, to: 30.98, scene: 'cabine', cap: '« Waye ne demande jamais ton code. »' },
      { from: 30.98, to: 35.09, scene: 'cabine', tip: 1 },
      { from: 35.09, to: 39.98, scene: 'chambre', tip: 2 },
      { from: 39.98, to: 42.85, scene: 'cabine', tip: 3 },
      { from: 42.85, to: 46.35, scene: 'chambre', phone: 'masque', cap: 'Dans Babi Life, les liens sont masqués 🛡️' },
      { from: 46.35, to: 51.5, scene: 'crew' },
    ],
    intro: 0,
    outro: 46.35,
    length: 51.5,
    hook: ['', '', ''],
  },
  // Keke's street interview (marketing/scripts/keke-micro-trottoir.md): « what do you want in Babi Life? ».
  keke: {
    // Timed on the voices (marketing/out/voix-keke.mp3, 55.4 s, one file per speaker put end to end): each shot starts with its line.
    shots: [
      { from: 0, to: 5.6, scene: 'keke', cap: 'Micro-trottoir dans Babi ! 🎤' },
      { from: 5.6, to: 9.21, scene: 'keke', cap: 'Une seule question…' },
      { from: 9.21, to: 15.46, scene: 'mt-yop' },
      { from: 15.46, to: 20.67, scene: 'mt-gbaka' },
      { from: 20.67, to: 27.58, scene: 'mt-maquis' },
      { from: 27.58, to: 31.28, scene: 'mt-stade' },
      { from: 31.28, to: 37.14, scene: 'mt-village' },
      { from: 37.14, to: 41.57, scene: 'mt-salon' },
      { from: 41.57, to: 52.07, scene: 'keke', cap: 'Et toi ? Dis-le en commentaire 👇' },
      { from: 52.07, to: 58.5, scene: 'crew' },
    ],
    intro: 0,
    outro: 52.07,
    length: 58.5,
    hook: ['', '', ''],
  },
  // « Sortie » (marketing/scripts/sortie-28-octobre.md): the gift Awa teased opens on the release date, what's new lately, sign up now.
  sortie: {
    // Timed on Awa's voice (marketing/out/voix-sortie.mp3, 33.5 s): each shot starts with its sentence.
    shots: [
      { from: 0, to: 3.95, scene: 'salon', cap: 'La famille ! C’est Awa 👋' },
      { from: 3.95, to: 7.1, scene: 'salon', tease: true, cap: 'Je vous avais dit : de bonnes nouvelles… 🤫' },
      { from: 7.1, to: 12.71, scene: 'salon', reveal: true, cap: 'Babi Life sort le mercredi 28 octobre ! 🎉' },
      // What's new lately, not what everyone has seen already.
      { from: 12.71, to: 17.51, scene: 'plateau', date: true, nouveau: 'politique', title: 'La politique', cap: 'Vote pour ton maire… ou deviens président·e !' },
      { from: 17.51, to: 20.37, scene: 'basket', date: true, nouveau: 'matchs', title: 'Matchs entre amis', cap: 'Foot et basket avec tes amis, en vrai' },
      { from: 20.37, to: 21.98, scene: 'selfie', date: true, nouveau: 'flashe', title: 'Flashé', cap: 'Tes selfies avec les lentilles 📸' },
      { from: 21.98, to: 24.3, scene: 'gbaka', date: true, nouveau: 'horsligne', title: 'Sans réseau', cap: 'Pas de réseau ? Tu joues quand même !' },
      { from: 24.3, to: 28.45, scene: 'salon', date: true, cap: 'Inscris-toi : mercredi, tu joues parmi les premiers !' },
      { from: 28.45, to: 35, scene: 'crew' },
    ],
    intro: 0,
    outro: 28.45,
    length: 35,
    hook: ['', '', ''],
  },
  // « Bienvenue » (marketing/scripts/bienvenue.md): Awa welcomes the new players on opening night.
  bienvenue: {
    // Timed on Awa's voice (marketing/out/voix-bienvenue.mp3, 44.4 s): each shot starts with its sentence.
    shots: [
      { from: 0, to: 4.52, scene: 'salon', cap: 'Akwaba ! Bienvenue dans Babi Life 👋' },
      { from: 4.52, to: 6.44, scene: 'famille-gnambro', title: 'Ta famille', cap: 'Ici, tu ne choisis pas ta famille' },
      { from: 6.44, to: 8.1, scene: 'famille-poignon', title: 'Ta famille', cap: 'Gnambro, poignon, laté… le sort a décidé 🎲' },
      { from: 8.1, to: 9.8, scene: 'famille-late', title: 'Ta famille', cap: 'Gnambro, poignon, laté… le sort a décidé 🎲' },
      { from: 9.8, to: 11.52, scene: 'look', cap: 'Mais la suite, c’est toi qui l’écris ✍🏾' },
      { from: 11.52, to: 14.08, scene: 'poussette', title: 'Tu commences bébé 🍼', cap: 'Et un bébé, ça se gère hein !' },
      { from: 14.08, to: 17.16, scene: 'poussette', title: 'Tu commences bébé 🍼', cap: 'Il a faim vite, il est fatigué vite, il veut son câlin' },
      { from: 17.16, to: 19.84, scene: 'poussette', title: 'Tu commences bébé 🍼', cap: 'Occupe-toi de lui : c’est en jouant que ton perso grandit' },
      { from: 19.84, to: 24.24, scene: 'amis', title: 'Puis enfant', cap: 'L’école, la récré, les amis' },
      { from: 24.24, to: 26, scene: 'plateau', title: '18 ans', cap: 'Et à 18 ans, la vraie vie' },
      { from: 26, to: 28.8, scene: 'fete', title: '18 ans', cap: 'Le boulot, le logement, le maquis, les sorties 🎉' },
      { from: 28.8, to: 31.08, scene: 'phone', cap: 'Ton téléphone, c’est ton meilleur ami 📱' },
      { from: 31.08, to: 32.32, scene: 'phone', cap: 'Gbairai pour causer' },
      { from: 32.32, to: 33.48, scene: 'phone', cap: 'Waye pour l’argent' },
      { from: 33.48, to: 34.84, scene: 'phone', cap: 'Tikitoko pour les vidéos' },
      { from: 34.84, to: 37.64, scene: 'yop', cap: 'Et la carte pour aller partout, de Yop à Cocody' },
      { from: 37.64, to: 40.16, scene: 'cause', title: 'Un conseil', cap: 'Parle aux gens dans la rue, essaie tout…' },
      { from: 40.16, to: 42.08, scene: 'salon', cap: 'Et reviens souvent : ton perso t’attend' },
      { from: 42.08, to: 44.5, scene: 'salon', cap: 'On se voit au grin. Allez… à toi de jouer !' },
      { from: 44.5, to: 51, scene: 'crew' },
    ],
    intro: 0,
    outro: 44.5,
    length: 51,
    hook: ['', '', ''],
  },
  // « Tout ce que ton bébé peut faire » (marketing/scripts/bebe.md): the baby's things, one by one, with the game's screens played (lab/bebeFilm.tsx).
  bebe: {
    shots: [
      { from: 0, to: 3.4, scene: 'poussette' },
      { from: 3.4, to: 9.4, scene: 'bebe:soins', n: 1, title: 'Occupe-toi de lui', sub: 'Biberon, bouillie, bain, câlin : ses jauges', screen: 'soins' },
      { from: 9.4, to: 14.4, scene: 'bebe:pleurer', n: 2, title: 'Il pleure pour de vrai', sub: 'Faim, sommeil, couche : écoute-le 🔊', screen: 'pleure' },
      { from: 14.4, to: 20.4, scene: 'bebe-bapteme', n: 3, title: 'Son baptême', sub: 'Toute la famille, la grand-mère, les cadeaux', screen: 'bapteme' },
      { from: 20.4, to: 25.4, scene: 'bebe:coucou', n: 4, title: 'Coucou-caché', sub: 'Ris quand maman ouvre les mains', screen: 'coucou' },
      { from: 25.4, to: 30.4, scene: 'bebe:cubes', n: 5, title: 'La tour de cubes', sub: 'Lâche chaque cube pile dessus', screen: 'cubes' },
      { from: 30.4, to: 35.4, scene: 'bebe:premiers-pas', n: 6, title: 'Ses premiers pas', sub: 'Garde l’équilibre jusqu’à papa', screen: 'pas' },
      { from: 35.4, to: 40.4, scene: 'bebe:hochet', n: 7, title: 'Le hochet en rythme', sub: 'Secoue quand le cercle touche l’anneau', screen: 'hochet' },
      { from: 40.4, to: 46.4, scene: 'bebe-bagarre', n: 8, title: 'La bagarre de bébés', sub: 'Défends ton jouet contre le cousin', screen: 'bagarre' },
      { from: 46.4, to: 52.4, scene: 'bebe:calin', n: 9, title: 'Ses premières fois', sub: '8 à vivre : sourire, dent, premiers pas…', screen: 'firsts' },
      { from: 52.4, to: 57.4, scene: 'bebe:jouets', n: 10, title: 'Le jouet qu’il attrape', sub: 'Son talent pour toute la vie', screen: 'talent' },
      { from: 57.4, to: 62.4, scene: 'bebe:premier-mot', n: 11, title: 'Son premier mot', sub: 'Toute la famille va le répéter', screen: 'mot' },
      { from: 62.4, to: 68.4, scene: 'bebe-creche', n: 12, title: 'La crèche', sub: 'Avec les bébés des autres joueurs, de 7 h à 17 h', screen: 'creche' },
      { from: 68.4, to: 73.4, scene: 'bebe-balade', n: 13, title: 'La balade en poussette', sub: 'Les autres joueurs te voient passer', screen: 'balade' },
      { from: 73.4, to: 79.4, scene: 'bebe-grandit', n: 14, title: 'Puis il grandit', sub: '2 h de jeu bébé, puis l’enfance', screen: 'grandit' },
      { from: 79.4, to: 85.5, scene: 'crew' },
    ],
    intro: 3.4,
    outro: 79.4,
    length: 85.5,
    hook: ['Ton bébé', 'à Babi', 'fait tout ça !'],
  },
  // How you play: born gnambro, the goal is debout, six steps, the money that comes and goes.
  gameplay: {
    shots: [
      { from: 0, to: 2.4, scene: 'famille-gnambro' },
      { from: 2.4, to: 4.8, scene: 'famille-debout' },
      { from: 4.8, to: 8.6, scene: 'plateau', n: 1, title: 'TRAVAILLE', sub: 'Bureau, garba, maçon… ton job te paie' },
      { from: 8.6, to: 11.8, scene: 'douche', n: 2, title: 'OCCUPE-TOI DE TOI', sub: 'Douche, manger, dormir : surveille tes jauges' },
      { from: 11.8, to: 16.4, scene: 'zoo', n: 3, title: 'BALADE-TOI DANS BABI', sub: "Le vrai zoo d'Abidjan, en 3 vues" },
      { from: 16.4, to: 21, scene: 'loto', n: 4, title: 'TENTE TA CHANCE', sub: 'Le loto du coin, les paris sur Bet225' },
      { from: 21, to: 24.6, scene: 'fete', n: 5, title: 'FAIS LA FÊTE', sub: 'Maquis et coupé-décalé avec tes amis' },
      { from: 24.6, to: 29, scene: 'build', n: 6, title: 'CONSTRUIS TA MAISON', sub: 'Ton terrain, tes murs, tes meubles' },
      { from: 29, to: 33.4, scene: 'house' },
      { from: 33.4, to: 39, scene: 'crew' },
    ],
    intro: 0,
    outro: 33.4,
    length: 39,
    hook: ['', '', ''],
  },

  // « 20 trucs à faire dans Babi Life » (marketing/scripts/top20.md): the game filmed being played
  // (marketing/top20.mjs), what's drawn here over it (&overlay). Each line of Awa's on its activity;
  // the times here are a guide, top20.mjs gives the real ones (&times=), measured on her voice.
  top20: {
    shots: [
      { from: 0, to: 3, scene: 'crew', say: 'Tu t’ennuies ? Voilà vingt trucs à faire à Babi !' },
      ...(
        [
          ['LE SKI NAUTIQUE', 'Vingt : du ski nautique à l’île Boulay !'],
          ['PARLER NOUCHI', 'Dix-neuf : parler nouchi avec tout le monde.'],
          ['LE ZOO', 'Dix-huit : les selfies devant les lions du zoo !'],
          ['LE THÉ AU GRIN', 'Dix-sept : le thé au grin.'],
          ['LE MARCHÉ', 'Seize : faire son marché.'],
          ['LES PHOTOS', 'Quinze : prendre Babi en photo.'],
          ['LA MESSE', 'Quatorze : la messe du dimanche.'],
          ['LA PRIÈRE DU VENDREDI', 'Treize : la grande prière du vendredi.'],
          ['LE LÈCHE-VITRINE', 'Douze : le lèche-vitrine au centre commercial.'],
          ['LE CINÉ', 'Onze : le ciné, avec le pop-corn !'],
          ['LE BRUNCH', 'Dix : bruncher face à la lagune.'],
          ['LA BOÎTE', 'Neuf : la boîte, à la rue Princesse !'],
          ['LE ZOUGLOU', 'Huit : le zouglou avec les gars !'],
          ['L’AVION', 'Sept : l’avion pour Yamoussoukro.'],
          ['LA TOUR F', 'Six : la tour F en chantier !'],
          ['LES DAMES', 'Cinq : les dames. Tu mises, tu rafles tout !'],
          ['LE 8 AMÉRICAIN', 'Quatre : le 8 américain. Joker ? Pioche six !'],
          ['LE KART', 'Trois : la course de karts !'],
          ['LE BASKET', 'Deux : le basket… et panier !'],
          ['LE FOOT', 'Et numéro un… le foot du quartier. BUUUT !'],
        ] as const
      ).map(([title, say], i) => ({ from: 3 + i * 2.7, to: 5.7 + i * 2.7, scene: 'crew' as SceneId, n: 20 - i, title, say })),
      { from: 57, to: 62.5, scene: 'crew', say: 'Et il y en a plus de 160 dans le jeu ! Tu commences par lequel ?' },
    ],
    intro: 0,
    outro: 57,
    length: 62.5,
    hook: ['', '', ''],
  },
}

/** « gameplay »: what the perso earns and spends, when (the counter in the corner). */
const MONEY: [number, number, string][] = [
  [6.2, 150000, 'SALAIRE'],
  [19.7, 45000, 'PARI GAGNÉ !'],
  [22.4, -20000, 'TRAVAILLEMENT'],
  [26.4, -120000, 'CIMENT, TÔLES'],
]
const START_MONEY = 500
/** The six families, from the bottom to the top. */
const LADDER = ['GNAMBRO', 'COULÉ', 'POIGNON', 'LAGNON', 'LATÉ', 'DEBOUT']
/** Where the perso is on the ladder: at the bottom, then climbing at the end. */
const rung = (t: number) => (t < 29.6 ? 0 : Math.min(5, 1 + Math.floor((t - 29.6) / 0.65)))
const money = (t: number) => START_MONEY + MONEY.reduce((sum, [at, d]) => sum + d * ease(clamp01((t - at) / 0.6)), 0)
const cfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`

/** A word slammed onto the screen: big, then its size. */
const slam = (t: number, at: number) => {
  const k = clamp01((t - at) / 0.18)
  return { opacity: k, transform: `scale(${1.7 - 0.7 * ease(k)}) rotate(${(1 - k) * -4}deg)` }
}

/** « gameplay »: the goal and the money on top, the step, the hook, the deltas, the phone, the gauges. */
function GameplayOverlay({ t, shot }: { t: number; shot: Shot }) {
  const local = t - shot.from
  const hud = t >= 2.4
  const r = rung(t)
  const delta = MONEY.find(([at]) => t >= at && t < at + 1.5)
  const shake = delta ? Math.sin(t * 90) * 6 * (1 - clamp01((t - delta[0]) / 0.4)) : 0
  return (
    <>
      {/* The goal and the money */}
      {hud && (
        <div className="absolute inset-x-0 top-0 px-5 pt-7" style={{ opacity: clamp01((t - 2.4) / 0.3) }}>
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-2xl bg-black/55 px-4 py-2 font-sans text-[22px] leading-none font-extrabold">
              TON BUT : <span className="text-[#ffd43b]">DEBOUT</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-black/55 px-4 py-2 text-[30px] leading-none font-extrabold" style={{ transform: `translateX(${shake}px)` }}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ffc233] text-[18px] text-[#7a4a00]">F</span>
              {cfa(money(t)).replace(' F', '')}
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            {LADDER.map((name, i) => (
              <div
                key={name}
                className="flex-1 rounded-lg py-1.5 text-center font-sans text-[14px] leading-none font-extrabold"
                style={{ background: i === r ? '#ff7a00' : i < r ? '#00a862' : 'rgba(0,0,0,0.45)', color: i <= r ? '#fff' : 'rgba(255,255,255,0.6)', transform: i === r ? 'scale(1.12)' : undefined }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* The hook */}
      {t < 2.4 && (
        <div className="absolute inset-x-0 top-[30%] flex flex-col items-center gap-2 text-center" style={{ fontFamily: 'Anton, sans-serif' }}>
          <div className="text-[92px] leading-none text-white [text-shadow:0_6px_0_#000]" style={slam(t, 0.15)}>
            TU NAIS…
          </div>
          <div className="text-[120px] leading-none text-[#ff4d4d] [text-shadow:0_7px_0_#000]" style={slam(t, 0.9)}>
            GNAMBRO
          </div>
          <div className="mt-2 rounded-xl bg-black/60 px-4 py-1 font-sans text-[28px] font-extrabold" style={slam(t, 1.5)}>
            pas d'argent, pas de maison
          </div>
        </div>
      )}
      {t >= 2.4 && t < 4.8 && (
        <div className="absolute inset-x-0 top-[30%] flex flex-col items-center gap-2 text-center" style={{ fontFamily: 'Anton, sans-serif' }}>
          <div className="text-[92px] leading-none text-white [text-shadow:0_6px_0_#000]" style={slam(t, 2.55)}>
            TON BUT :
          </div>
          <div className="text-[120px] leading-none text-[#ffd43b] [text-shadow:0_7px_0_#000]" style={slam(t, 3.2)}>
            DEBOUT
          </div>
          <div className="mt-2 rounded-xl bg-black/60 px-4 py-1 font-sans text-[28px] font-extrabold" style={slam(t, 3.8)}>
            villa, piscine, la belle vie
          </div>
        </div>
      )}
      {/* The step: its number and what to do */}
      {shot.title && (
        <div className="absolute inset-x-0 top-[15.5%] flex flex-col items-center px-6 text-center">
          <div className="flex items-center gap-3" style={slam(t, shot.from + 0.1)}>
            <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-white text-[48px] text-[var(--color-orange)]" style={{ fontFamily: 'Anton, sans-serif' }}>
              {shot.n}
            </span>
            <span className="rounded-2xl bg-[var(--color-orange)] px-5 py-1 text-[54px] leading-[1.15] [text-shadow:0_3px_0_rgba(0,0,0,0.35)]" style={{ fontFamily: 'Anton, sans-serif' }}>
              {shot.title}
            </span>
          </div>
          <div className="mt-3 rounded-2xl bg-black/60 px-4 py-1.5 font-sans text-[26px] font-extrabold" style={pop(t, shot.from + 0.45)}>
            {shot.sub}
          </div>
        </div>
      )}
      {/* The zoo's cameras */}
      {shot.scene === 'zoo' && (
        <div className="absolute inset-x-0 bottom-[12%] flex justify-center" key={zooView(local)}>
          <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-3 text-[40px] leading-none text-[var(--color-ink)]" style={{ fontFamily: 'Anton, sans-serif', ...slam(local, zooView(local) * 1.5) }}>
            <Eye size={40} /> {ZOO_VIEWS[zooView(local)]}
          </div>
        </div>
      )}
      {/* The shower fills the hygiene gauge */}
      {shot.scene === 'douche' && <Gauges t={local} />}
      {/* The bet, on the phone */}
      {shot.scene === 'loto' && local > 1.5 && <BetPhone t={local - 1.5} />}
      {/* What the perso earns or spends, big in the middle */}
      {delta && (
        <div className="absolute inset-x-0 top-[31%] flex flex-col items-center text-center" style={{ opacity: 1 - clamp01((t - delta[0] - 1.1) / 0.4), transform: `translateY(${-(t - delta[0]) * 30}px)` }}>
          <div className="text-[96px] leading-none [text-shadow:0_6px_0_#000]" style={{ fontFamily: 'Anton, sans-serif', color: delta[1] > 0 ? '#3ddc84' : '#ff5252', ...slam(t, delta[0]) }}>
            {delta[1] > 0 ? '+' : '−'}
            {cfa(Math.abs(delta[1]))}
          </div>
          <div className="mt-1 rounded-xl bg-black/60 px-4 py-1 font-sans text-[28px] font-extrabold" style={slam(t, delta[0] + 0.15)}>
            {delta[2]}
          </div>
        </div>
      )}
      {/* Climbing the ladder */}
      {shot.scene === 'house' && (
        <div className="absolute inset-x-0 top-[34%] flex flex-col items-center gap-2 text-center" style={{ fontFamily: 'Anton, sans-serif' }}>
          <div className="text-[84px] leading-none [text-shadow:0_6px_0_#000]" style={slam(t, 29.15)}>
            PETIT À PETIT…
          </div>
          <div className="text-[112px] leading-none text-[#ffd43b] [text-shadow:0_7px_0_#000]" key={r} style={slam(t, Math.max(29.6, 29.6 + (r - 1) * 0.65))}>
            {LADDER[r]}
          </div>
          {r === 5 && (
            <div className="rounded-xl bg-black/60 px-4 py-1 font-sans text-[30px] font-extrabold" style={slam(t, 32.4)}>
              c'est toi qui décides 🔥
            </div>
          )}
        </div>
      )}
    </>
  )
}

const pop = (t: number, start: number) => {
  const k = clamp01((t - start) / 0.35)
  return { opacity: k, transform: `translateY(${(1 - k) * 24}px)` }
}

/** The perso's gauges: the shower takes hygiene from red to full. */
function Gauges({ t }: { t: number }) {
  const rows: [string, number, string][] = [
    ['Hygiène', 0.12 + 0.88 * ease(clamp01((t - 0.6) / 2)), '#4dabf7'],
    ['Énergie', 0.7, '#ffd43b'],
    ['Faim', 0.55, '#ff922b'],
    ['Moral', 0.45 + 0.4 * ease(clamp01((t - 1.2) / 1.6)), '#51cf66'],
  ]
  const up = ease(clamp01(t / 0.35))
  return (
    <div className="absolute inset-x-0 bottom-[8%] flex justify-center" style={{ opacity: up, transform: `translateY(${(1 - up) * 60}px)` }}>
      <div className="w-[82%] rounded-[28px] bg-white/95 p-5 font-sans text-[var(--color-ink)] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]">
        {rows.map(([name, k, c]) => (
          <div key={name} className="mb-2.5 flex items-center gap-3 last:mb-0">
            <span className="w-[120px] text-[22px] font-extrabold">{name}</span>
            <span className="h-5 flex-1 overflow-hidden rounded-full bg-[#e9ecef]">
              <i className="block h-full rounded-full" style={{ width: `${k * 100}%`, background: k < 0.25 ? '#ff5252' : c }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Bet225 on the phone: a combined bet, the goal, won. */
function BetPhone({ t }: { t: number }) {
  const up = ease(clamp01(t / 0.4))
  const goal = t > 1.6
  const won = t > 1.8
  return (
    <div className="absolute inset-x-0 bottom-[6%] flex justify-center" style={{ transform: `translateY(${(1 - up) * 110}%)`, opacity: up }}>
      <div className="w-[330px] rounded-[44px] bg-[#141416] p-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="overflow-hidden rounded-[34px] bg-[#0f2a1d] font-sans text-white">
          <div className="flex items-center justify-between bg-[#0a1f15] px-5 pt-6 pb-3">
            <span className="text-[24px] font-extrabold text-[#3ddc84]">Bet225</span>
            <span className="rounded-lg bg-[#ff2d55] px-2 py-0.5 text-[13px] font-extrabold">● EN DIRECT</span>
          </div>
          <div className="px-5 py-4">
            <div className="text-[14px] font-bold text-white/60">Championnat virtuel de Babi · 89e</div>
            <div className="mt-2 flex items-center justify-between text-[19px] font-extrabold">
              <span>Étoile de Treichville</span>
              <span className="rounded-lg bg-white/10 px-2 text-[26px]" style={goal ? { color: '#ffd43b' } : undefined}>
                {goal ? 2 : 1}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[19px] font-extrabold">
              <span>Bingerville Athletic</span>
              <span className="rounded-lg bg-white/10 px-2 text-[26px]">1</span>
            </div>
            <div className="mt-3 flex justify-between rounded-2xl bg-white/10 px-4 py-2.5 text-[17px] font-bold">
              <span>Mise 5 000 F</span>
              <span>Cote 9,00</span>
            </div>
            <div className="mt-3 rounded-2xl py-3 text-center text-[30px] leading-none font-extrabold" style={{ background: won ? '#3ddc84' : 'rgba(255,255,255,0.08)', color: won ? '#0a1f15' : 'rgba(255,255,255,0.6)', fontFamily: won ? 'Anton, sans-serif' : undefined }}>
              {won ? 'GAGNÉ ! 45 000 F' : goal ? '⚽ BUUUT !' : 'En attente…'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** « Merci »: the followers reached. */
const FOLLOWERS = 1500
/** What the community answers in « Merci ». */
const MERCI_COMMENTS: [number, string, string][] = [
  [1.2, 'koffi_225', 'Awaaa 🔥'],
  [5, 'mariam.yop', '1 500 déjà ?? 😍'],
  [7.2, 'le_vrai_bk', 'On est ensemble 🇨🇮'],
  [9.6, 'fanta.d', 'C’est mérité !'],
  [13.8, 'kader.abobo', 'Moi j’étais à Yop, Rue Princesse 😂'],
  [15.6, 'aya.k', 'Maquis jusqu’au matin 🕺'],
  [17, 'ibou', 'Babi Sporting a gagné !!'],
  [18.8, 'mamie.c', 'Moi dodo seulement 😴'],
  [20.2, 'serge.plateau', 'Église le matin, maquis le soir 😇'],
  [22.2, 'koffi_225', 'Lundi est dur 😭'],
  [24.2, 'fanta.d', 'Bonne semaine Awa !'],
  [27, 'mariam.yop', 'Dis-nous un peu 👀'],
  [28.8, 'le_vrai_bk', 'Le jeu sort bientôt ??'],
]

/** « Merci »: Awa talking to the community, the counter, the comments, the hearts, her words. */
function MerciOverlay({ t, shot }: { t: number; shot: Shot }) {
  const shown = MERCI_COMMENTS.filter(([at]) => at <= t).slice(-3)
  const local = t - shot.from
  const hearts = [...Array(t > 8.5 && t < 13 ? 16 : 9)].map((_, i) => {
    const k = ((t * 0.55 + i * 0.37) % 1 + 1) % 1
    return { k, x: Math.sin(i * 2.7 + t) * 22, c: ['#ff3d6e', '#ff7a00', '#ffd43b', '#ff3d6e', '#ffffff'][i % 5] }
  })
  // The counter: from 1 200 to 1 500, then it stays; confetti when it gets there.
  // (on the film's clock, so it stays at 1 500 afterwards)
  const k = ease(clamp01((t - 4.6) / 2.4))
  const count = Math.round(1200 + (FOLLOWERS - 1200) * k)
  // At 1 500 just as she says « Mille cinq cents ! »
  const done = shot.counter && t > 7
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/55 to-transparent px-6 pt-8 pb-12 font-sans">
        <span className="block h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#ff7a00] bg-[#ffd8a8]">
          <AwaFace t={t} size={56} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[26px] leading-none font-extrabold">awa.babi</div>
          <div className="mt-1 text-[18px] font-bold text-white/80">À la maison · Message à la famille</div>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg bg-black/45 px-3 py-1.5 text-[20px] font-extrabold">
          <Heart size={20} className="fill-[#ff3d6e] text-[#ff3d6e]" /> {count.toLocaleString('fr-FR')}
        </span>
      </div>
      {shot.title && (
        <div className="absolute inset-x-0 top-[10.5%] flex justify-center px-8">
          <div className="rounded-full bg-[var(--color-orange)] px-6 py-2 text-[38px] leading-tight font-extrabold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" style={{ opacity: Math.min(1, local / 0.4) }}>
            {shot.title}
          </div>
        </div>
      )}
      {/* The counter, big in the middle */}
      {shot.counter && (
        <div className="absolute inset-x-0 top-[27%] flex flex-col items-center font-display" style={{ opacity: clamp01(local / 0.4), transform: `scale(${done ? 1 + Math.max(0, 0.18 - (t - 7) * 0.4) : 1})` }}>
          <div className="rounded-[40px] bg-white/95 px-10 py-6 text-center text-[var(--color-ink)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
            <div className="text-[150px] leading-none font-extrabold tabular-nums">{count.toLocaleString('fr-FR')}</div>
            <div className="mt-2 text-[36px] font-extrabold text-[var(--color-orange)]">abonnés sur TikTok</div>
          </div>
          {done && <div className="mt-6 rounded-full bg-[#ff2d55] px-7 py-2 text-[40px] font-extrabold">MERCI LA FAMILLE !</div>}
        </div>
      )}
      {done && <Confetti t={t - 7} />}
      {/* Good news ahead: a gift, wrapped, shaking */}
      {shot.tease && (
        <div className="absolute inset-x-0 top-[14%] flex flex-col items-center font-display" style={{ opacity: clamp01(local / 0.5) }}>
          <div className="text-[110px] leading-none" style={{ transform: `rotate(${Math.sin(local * 9) * (local > 2 ? 10 : 3)}deg) scale(${1 + Math.sin(local * 4) * 0.04})` }}>
            🎁
          </div>
          <div className="mt-4 rounded-full bg-[#0f1230]/80 px-7 py-2.5 text-[38px] font-extrabold">Bientôt…</div>
        </div>
      )}
      {/* Awa's face, filming herself (not at home: there she's the whole picture) */}
      {shot.scene !== 'salon' && (
        <div className="absolute top-[17%] right-6 h-[210px] w-[160px] overflow-hidden rounded-[28px] border-[4px] border-white/90 bg-[#ffb37a] shadow-[0_16px_40px_-14px_rgba(0,0,0,0.7)]">
          <AwaFace t={t} size={210} talking />
        </div>
      )}
      <div className="absolute bottom-[19%] left-6 flex w-[62%] flex-col gap-2.5 font-sans">
        {shown.map(([at, who, text]) => (
          <div key={at} className="flex items-start gap-2.5 rounded-2xl bg-black/40 px-3.5 py-2" style={{ opacity: Math.min(1, (t - at) / 0.3) }}>
            <span className="text-[20px] leading-snug font-extrabold text-[#ffd43b]">{who}</span>
            <span className="text-[20px] leading-snug font-bold">{text}</span>
          </div>
        ))}
      </div>
      <div className="absolute right-10 bottom-[19%] h-[420px] w-20">
        {hearts.map((h, i) => (
          <Heart key={i} size={34} className="absolute bottom-0 left-1/2" style={{ transform: `translate(${h.x - 17}px, ${-h.k * 400}px) scale(${0.7 + h.k * 0.5})`, opacity: 1 - h.k, color: h.c, fill: h.c }} />
        ))}
      </div>
      {shot.cap && (
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center px-10">
          <div className="rounded-2xl bg-white px-5 py-2.5 text-center text-[34px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]">{shot.cap}</div>
        </div>
      )}
    </>
  )
}

/** « Sortie »: the day the game comes out (Wednesday 28 October 2026). */
const SORTIE = { weekday: 'Mercredi', day: 28, month: 'octobre' }
/** What the community answers in « Sortie ». */
const SORTIE_COMMENTS: [number, string, string][] = [
  [1.4, 'koffi_225', 'Awaaa 🔥'],
  [4.8, 'mariam.yop', 'Dis vite !! 👀'],
  [6.4, 'le_vrai_bk', 'Le jeu sort ou bien ??'],
  [9, 'fanta.d', 'ENFIN 😭🔥🔥'],
  [10.4, 'kader.abobo', 'Mercredi je suis là !'],
  [11.8, 'aya.k', 'Je prends congé mercredi 😂'],
  [14, 'ibou', 'Je me présente à la mairie de Yop 😎'],
  [15.9, 'mamie.c', 'Président Kader 2026 😂'],
  [18.4, 'serge.plateau', 'Foot à 5 mercredi soir, qui est chaud ?'],
  [20.8, 'aya.k', 'Les lentilles de Flashé 😍'],
  [22.6, 'kader.abobo', 'Même sans data ?? Ça c’est fort 🔥'],
  [25, 'koffi_225', 'Inscrit ✅'],
  [26.4, 'fanta.d', 'Tag ton gars 👇'],
  [27.6, 'le_vrai_bk', 'Awa tu es la meilleure ❤️'],
]

/** « Sortie »: an election in the Politique app, the ballot and its results so far. */
function Ballot({ t }: { t: number }) {
  const up = ease(clamp01(t / 0.5))
  const voted = t > 2.2
  const cands: [string, string, number][] = [
    ['Kader Traoré', '#ff7a00', 0.42],
    ['Aya Kouassi', '#12a37a', 0.35],
    ['Serge Yao', '#3b5bdb', 0.23],
  ]
  return (
    <div className="absolute inset-x-0 top-[23%] flex justify-center font-sans" style={{ opacity: up, transform: `translateY(${(1 - up) * 60}px)` }}>
      <div className="w-[400px] rounded-[30px] bg-white p-5 text-[var(--color-ink)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="text-[16px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">Élection du maire · Yopougon</div>
        <div className="mt-3 flex flex-col gap-2.5">
          {cands.map(([name, color, share], i) => (
            <div key={name} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[18px] font-extrabold text-white" style={{ background: color }}>{name[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[19px] leading-tight font-extrabold">{name}</div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#eef0f4]">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100 * ease(clamp01((t - 0.4) / 1.2)))}%`, background: color }} />
                </div>
              </div>
              {voted && i === 1 && <span className="rounded-full bg-[#e6f8ef] px-2.5 py-1 text-[15px] font-extrabold text-[#12a37a]">✓ Ton vote</span>}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-full py-2.5 text-center text-[20px] font-extrabold text-white" style={{ background: voted ? '#12a37a' : 'var(--color-orange)' }}>{voted ? 'A voté !' : 'Voter à la mairie'}</div>
      </div>
    </div>
  )
}

/** A calendar page: the month on its red band, the day, the weekday. */
function CalendarCard({ scale = 1 }: { scale?: number }) {
  return (
    <div className="overflow-hidden rounded-[40px] bg-white text-center text-[var(--color-ink)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]" style={{ transform: `scale(${scale})`, width: 360 }}>
      <div className="bg-[#d6202a] py-3 text-[40px] font-extrabold tracking-wide text-white uppercase">{SORTIE.month}</div>
      <div className="py-2 text-[190px] leading-[1] font-extrabold tabular-nums">{SORTIE.day}</div>
      <div className="pb-5 text-[44px] font-extrabold text-[var(--color-orange)] uppercase">{SORTIE.weekday}</div>
    </div>
  )
}

/** « Sortie »: Awa's news from home: the gift she teased opens on the date, the comments, the hearts, her words. */
function SortieOverlay({ t, shot }: { t: number; shot: Shot }) {
  const shown = SORTIE_COMMENTS.filter(([at]) => at <= t).slice(-3)
  const local = t - shot.from
  const revealed = t >= 8.6
  const hearts = [...Array(revealed ? 16 : 9)].map((_, i) => {
    const k = ((t * 0.55 + i * 0.37) % 1 + 1) % 1
    return { k, x: Math.sin(i * 2.7 + t) * 22, c: ['#ff3d6e', '#ff7a00', '#ffd43b', '#ff3d6e', '#ffffff'][i % 5] }
  })
  // The gift: shaking while she teases, then it jumps and bursts on « sort le mercredi ».
  const burst = shot.reveal ? clamp01((local - 0.6) / 0.3) : 0
  const card = shot.reveal ? ease(clamp01((local - 0.8) / 0.5)) : 0
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/55 to-transparent px-6 pt-8 pb-12 font-sans">
        <span className="block h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#ff7a00] bg-[#ffd8a8]">
          <AwaFace t={t} size={56} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[26px] leading-none font-extrabold">awa.babi</div>
          <div className="mt-1 text-[18px] font-bold text-white/80">À la maison · Grande nouvelle 📢</div>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg bg-[#ff2d55] px-3 py-1.5 text-[20px] font-extrabold">EN DIRECT</span>
      </div>
      {/* The date, pinned once it's said */}
      {shot.date && (
        <div className="absolute inset-x-0 top-[9.5%] flex flex-col items-center gap-3 px-8">
          <div className="flex items-center gap-2 rounded-full bg-white px-6 py-2 text-[34px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" style={{ opacity: Math.min(1, local / 0.4) }}>
            📅 {SORTIE.weekday} {SORTIE.day} {SORTIE.month}
          </div>
          {shot.title && (
            <div className="flex items-center gap-3">
              {shot.nouveau && (
                <span className="-rotate-[6deg] rounded-xl border-[3px] border-white bg-[#ffd43b] px-3 py-0.5 text-[26px] font-extrabold text-[#141416] shadow-[0_6px_0_rgba(0,0,0,0.3)]" style={{ transform: `rotate(-6deg) scale(${0.6 + 0.4 * ease(clamp01(local / 0.3))})` }}>
                  NOUVEAU
                </span>
              )}
              <div className="rounded-full bg-[var(--color-orange)] px-6 py-1.5 text-[30px] leading-tight font-extrabold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" style={{ opacity: Math.min(1, local / 0.5) }}>
                {shot.title}
              </div>
            </div>
          )}
        </div>
      )}
      {/* What's new: what it shows */}
      {shot.nouveau === 'politique' && <Ballot t={local} />}
      {shot.nouveau === 'horsligne' && (
        <div className="absolute inset-x-0 top-[24%] flex justify-center font-sans" style={{ opacity: ease(clamp01(local / 0.4)) }}>
          <div className="flex items-center gap-3 rounded-full bg-[#141416]/90 px-6 py-3 text-[26px] font-extrabold">
            <span className="text-[34px]">📵</span> Hors ligne · le jeu continue
          </div>
        </div>
      )}
      {/* The gift Awa teased last time: shaking, then it bursts */}
      {(shot.tease || (shot.reveal && burst < 1)) && (
        <div className="absolute inset-x-0 top-[14%] flex flex-col items-center font-display" style={{ opacity: shot.tease ? clamp01(local / 0.5) : 1 - burst }}>
          <div className="text-[130px] leading-none" style={{ transform: `rotate(${Math.sin(t * 9) * (shot.reveal || local > 2.5 ? 12 : 4)}deg) scale(${1 + (shot.reveal ? burst * 1.2 : Math.sin(local * 4) * 0.04)})` }}>
            🎁
          </div>
          {shot.tease && <div className="mt-4 rounded-full bg-[#0f1230]/80 px-7 py-2.5 text-[38px] font-extrabold">Vous vous rappelez ?</div>}
        </div>
      )}
      {/* The date, big, out of the gift */}
      {shot.reveal && card > 0 && (
        <div className="absolute inset-x-0 top-[12%] flex flex-col items-center gap-5 font-display" style={{ opacity: card }}>
          <CalendarCard scale={0.6 + card * 0.4} />
          <div className="rounded-full bg-[var(--color-orange)] px-8 py-2.5 text-[42px] font-extrabold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" style={{ opacity: clamp01((local - 1.6) / 0.4) }}>
            Babi Life sort ! 🎉
          </div>
        </div>
      )}
      {shot.reveal && local > 0.9 && <Confetti t={local - 0.9} />}
      {/* Awa's face, filming herself (not at home nor in her selfie: there she's the whole picture) */}
      {shot.scene !== 'salon' && shot.scene !== 'selfie' && shot.nouveau !== 'politique' && shot.nouveau !== 'horsligne' && (
        <div className="absolute top-[24%] right-6 h-[210px] w-[160px] overflow-hidden rounded-[28px] border-[4px] border-white/90 bg-[#ffb37a] shadow-[0_16px_40px_-14px_rgba(0,0,0,0.7)]">
          <AwaFace t={t} size={210} talking />
        </div>
      )}
      <div className="absolute bottom-[19%] left-6 flex w-[62%] flex-col gap-2.5 font-sans">
        {shown.map(([at, who, text]) => (
          <div key={at} className="flex items-start gap-2.5 rounded-2xl bg-black/40 px-3.5 py-2" style={{ opacity: Math.min(1, (t - at) / 0.3) }}>
            <span className="text-[20px] leading-snug font-extrabold text-[#ffd43b]">{who}</span>
            <span className="text-[20px] leading-snug font-bold">{text}</span>
          </div>
        ))}
      </div>
      <div className="absolute right-10 bottom-[19%] h-[420px] w-20">
        {hearts.map((h, i) => (
          <Heart key={i} size={34} className="absolute bottom-0 left-1/2" style={{ transform: `translate(${h.x - 17}px, ${-h.k * 400}px) scale(${0.7 + h.k * 0.5})`, opacity: 1 - h.k, color: h.c, fill: h.c }} />
        ))}
      </div>
      {shot.cap && (
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center px-10">
          <div className="rounded-2xl bg-white px-5 py-2.5 text-center text-[34px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]">{shot.cap}</div>
        </div>
      )}
    </>
  )
}

/** « Bienvenue »: Awa's header, what the shot is about, her face while the game is shown, her words. */
function BienvenueOverlay({ t, shot }: { t: number; shot: Shot }) {
  const local = t - shot.from
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/55 to-transparent px-6 pt-8 pb-12 font-sans">
        <span className="block h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#ff7a00] bg-[#ffd8a8]">
          <AwaFace t={t} size={56} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[26px] leading-none font-extrabold">awa.babi</div>
          <div className="mt-1 text-[18px] font-bold text-white/80">Bienvenue à Babi 👋🏾</div>
        </div>
        <span className="rounded-lg bg-[var(--color-orange)] px-3 py-1.5 text-[20px] font-extrabold">C’EST OUVERT</span>
      </div>
      {shot.title && (
        <div className="absolute inset-x-0 top-[10%] flex justify-center">
          <div className="rounded-full bg-[var(--color-orange)] px-7 py-2 text-[36px] leading-tight font-extrabold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" style={{ opacity: Math.min(1, (t - (FILMS.bienvenue.shots.find((x) => x.title === shot.title)?.from ?? shot.from)) / 0.4) }}>
            {shot.title}
          </div>
        </div>
      )}
      {shot.scene !== 'salon' && (
        <div className="absolute top-[24%] right-6 h-[210px] w-[160px] overflow-hidden rounded-[28px] border-[4px] border-white/90 bg-[#ffb37a] shadow-[0_16px_40px_-14px_rgba(0,0,0,0.7)]">
          <AwaFace t={t} size={210} talking />
        </div>
      )}
      {shot.cap && (
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center px-10">
          <div className="rounded-2xl bg-white px-5 py-2.5 text-center text-[34px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]" style={{ opacity: Math.min(1, local / 0.25) }}>
            {shot.cap}
          </div>
        </div>
      )}
    </>
  )
}

/** The baby out in its pram, maman pushing, down a quiet street; the camera in front, coming back with them. */
function Poussette({ t }: { t: number }) {
  const z = -3 + t * 0.55
  const sim = useMemo(() => ({ id: 'poster-bebe', firstName: 'Awa', gender: 'femme', family: 'poignon', look: L({ skin: '#8a5532', outfit: 'grenouillere', outfitColor: '#ffd43b', accessory: 'tetine' }) }) as unknown as Sim, [])
  return (
    <>
      <hemisphereLight args={['#fff4e6', '#c0704f', 1.15]} />
      <directionalLight position={[4, 9, 6]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <ambientLight intensity={0.4} />
      <Camera at={[0.9 + Math.sin(t * 0.3) * 0.2, 1.35, z + 3.4]} look={[0, 0.7, z]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#c9a27a" />
      </mesh>
      {[-1, 1].map((side) =>
        [...Array(9)].map((_, i) => (
          <mesh key={`${side}${i}`} position={[side * 3.4, 1.4, -14 + i * 4]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 2.8, 3.4]} />
            <meshLambertMaterial color={['#f3e2a9', '#f8f9fa', '#ffd8a8', '#c3e6cb'][(i + (side > 0 ? 2 : 0)) % 4]} />
          </mesh>
        )),
      )}
      <group position={[0, 0, z]}>
        <Pram sim={sim} walking speed={1.2} />
      </group>
    </>
  )
}

/** Confetti falling from the top, in the flag's colours and the game's. */
/** « Arnaque »: the phone in Awa's hand, in a frame. */
function ArnaquePhone({ t, children, shake = 0 }: { t: number; children: React.ReactNode; shake?: number }) {
  const up = ease(clamp01(t / 0.45))
  return (
    <div className="absolute inset-x-0 bottom-[17%] flex justify-center font-sans" style={{ transform: `translate(${shake}px, ${(1 - up) * 80}%)`, opacity: up }}>
      <div className="w-[380px] rounded-[48px] bg-[#141416] p-2.5 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)]">
        <div className="min-h-[420px] overflow-hidden rounded-[40px] bg-white text-[var(--color-ink)]">{children}</div>
      </div>
    </div>
  )
}

/** A chat bubble that appears at `at`. */
function Bubble({ t, at, mine, children }: { t: number; at: number; mine?: boolean; children: React.ReactNode }) {
  if (t < at) return null
  return (
    <div className={`max-w-[84%] rounded-2xl px-3.5 py-2 text-[19px] leading-snug font-bold ${mine ? 'self-end rounded-br-sm bg-[#ffe2c4] text-[#4a2200]' : 'self-start rounded-tl-sm bg-white shadow-sm'}`} style={{ opacity: clamp01((t - at) / 0.25), transform: `translateY(${(1 - clamp01((t - at) / 0.25)) * 10}px)` }}>
      {children}
    </div>
  )
}

/** Gbairai's conversation with « Fanta »; masked: as it shows in Babi Life, the link hidden. */
function FakeChat({ t, masked }: { t: number; masked?: boolean }) {
  const link = masked ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#eceff3] px-2 py-0.5 text-[#667781]">
      <ShieldCheck size={16} /> [lien masqué]
    </span>
  ) : (
    <span className="text-[#1971c2] underline">waye-bonus.ci/cadeau</span>
  )
  // The tap on the link (not when it's masked).
  const tap = !masked && t > 5.2 && t < 6.2
  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 text-white" style={{ background: '#c2410c' }}>
        <AppLogo id="gbairai" size={40} radius={12} />
        <div>
          <div className="font-display text-[22px] leading-none font-extrabold">Fanta</div>
          <div className="text-[14px] font-bold text-white/85">en ligne</div>
        </div>
      </div>
      <div className="relative flex min-h-[330px] flex-col gap-2 bg-[#efe6da] p-4">
        <Bubble t={t} at={masked ? 0 : 0.5}>Ma chérie !! 😍 Waye offre 50 000 F à ses clients, c’est jusqu’à ce soir seulement !</Bubble>
        <Bubble t={t} at={masked ? 0.2 : 1.7}>
          👉 {link}
        </Bubble>
        {!masked && <Bubble t={t} at={3.2} mine>C’est vrai ?? 😳</Bubble>}
        {!masked && <Bubble t={t} at={4.3}>Oui oui ! J’ai déjà reçu les miens, clique vite 🏃🏾‍♀️</Bubble>}
        {tap && <span className="absolute top-[118px] left-[150px] block h-12 w-12 rounded-full border-4 border-[#ff7a00] bg-[#ff7a00]/30" style={{ transform: `scale(${1 + (t - 5.2) * 0.6})`, opacity: 1 - (t - 5.2) }} />}
        {masked && (
          <div className="mt-2 flex items-center gap-2 self-center rounded-xl bg-[#fff3c4] px-3 py-2 text-[16px] font-extrabold text-[#5c4a00]" style={{ opacity: clamp01((t - 1) / 0.4) }}>
            <ShieldCheck size={18} /> Babi Life masque les liens
          </div>
        )}
      </div>
    </>
  )
}

/** The fake « Waye Bonus » page: the number, then the secret code typed in, then « send ». */
function FakePage({ t }: { t: number }) {
  const number = '07 58 •• •• 12'
  const typed = number.slice(0, Math.round(clamp01((t - 0.6) / 1.4) * number.length))
  const digits = Math.min(4, Math.max(0, Math.floor((t - 2.4) / 0.4)))
  const sent = t > 4.3
  return (
    <>
      <div className="flex items-center gap-2 bg-[#f1f3f5] px-4 pt-5 pb-2 text-[15px] font-bold text-[#495057]">
        <Lock size={14} /> waye-bonus.ci/cadeau
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="rounded-2xl bg-[#1aa6e6] p-4 text-center text-white">
          <div className="text-[40px] leading-none">🎁</div>
          <div className="mt-1 font-display text-[26px] leading-tight font-extrabold">Waye Bonus</div>
          <div className="text-[18px] font-bold">50 000 F offerts aujourd’hui</div>
        </div>
        <div>
          <div className="text-[14px] font-extrabold text-[#868e96]">Ton numéro Waye</div>
          <div className="mt-1 h-12 rounded-xl border-2 border-[#dee2e6] px-3 py-2 text-[22px] font-extrabold">{typed}</div>
        </div>
        <div>
          <div className="text-[14px] font-extrabold text-[#868e96]">Ton code secret</div>
          <div className="mt-1 flex h-12 items-center gap-3 rounded-xl border-2 px-3 text-[26px] font-extrabold" style={{ borderColor: digits ? '#ff7a00' : '#dee2e6' }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i}>{i < digits ? '●' : '○'}</span>
            ))}
          </div>
        </div>
        <div className="mt-1 rounded-full py-3 text-center text-[20px] font-extrabold text-white" style={{ background: sent ? '#868e96' : '#2f9e44' }}>
          {sent ? 'Envoi…' : 'Recevoir mes 50 000 F'}
        </div>
      </div>
    </>
  )
}

/** The Waye account emptied: withdrawal after withdrawal, down to 0 F. */
const DRAIN: [number, number][] = [
  [1.2, 30000],
  [2.2, 30000],
  [3.2, 27500],
]
function Drained({ t }: { t: number }) {
  const balance = 87500 - DRAIN.reduce((sum, [at, d]) => sum + d * ease(clamp01((t - at) / 0.35)), 0)
  const zero = t > 3.6
  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <AppLogo id="waye" size={42} radius={13} />
        <span className="font-display text-[24px] font-extrabold">Waye</span>
      </div>
      <div className="px-5">
        <div className="text-[16px] font-bold text-[#868e96]">Ton solde</div>
        <div className="font-display text-[60px] leading-none font-extrabold tabular-nums" style={{ color: zero ? '#e03131' : 'var(--color-ink)' }}>
          {cfa(balance)}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 px-5">
        {DRAIN.filter(([at]) => t >= at).map(([at, d], i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-[#fff0f0] px-3 py-2.5 text-[18px] font-extrabold" style={{ opacity: clamp01((t - at) / 0.2) }}>
            <span>Retrait · numéro inconnu</span>
            <span className="text-[#e03131]">−{cfa(d)}</span>
          </div>
        ))}
      </div>
      {zero && (
        <div className="mt-4 flex justify-center">
          <span className="rotate-[-8deg] rounded-xl border-[5px] border-[#e03131] px-4 py-1 font-display text-[40px] font-extrabold text-[#e03131]" style={slam(t, 3.6)}>
            ARNAQUÉE
          </span>
        </div>
      )}
    </>
  )
}

/** Calling Fanta: she sent nothing. */
function CallFanta({ t }: { t: number }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center bg-gradient-to-b from-[#1b1d2a] to-[#2b2f45] px-5 pt-10 text-white">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-[#ff7a00] font-display text-[44px] font-extrabold">F</div>
      <div className="mt-3 font-display text-[30px] font-extrabold">Fanta</div>
      <div className="flex items-center gap-2 text-[18px] font-bold text-white/70">
        <PhoneCall size={18} /> {t < 1.6 ? 'Appel…' : 'En communication'}
      </div>
      {t > 1.8 && (
        <div className="mt-8 rounded-2xl bg-white px-4 py-3 text-[20px] leading-snug font-extrabold text-[var(--color-ink)]" style={{ opacity: clamp01((t - 1.8) / 0.3) }}>
          « Moi ? J’ai rien envoyé dèh ! On a piraté mon Gbairai ! »
        </div>
      )}
    </div>
  )
}

const TIPS: { icon: typeof Lock; title: string; sub: string; color: string }[] = [
  { icon: Lock, title: 'On ne te demandera JAMAIS ton code secret', sub: 'Ni Waye, ni l’agent, ni un ami', color: '#e03131' },
  { icon: TriangleAlert, title: 'Un lien qui promet de l’argent = ARNAQUE', sub: 'Même d’un ami : appelle-le d’abord', color: '#ff7a00' },
  { icon: PhoneCall, title: 'Arnaqué·e ? Appelle vite pour bloquer ton compte', sub: 'Plus tu vas vite, plus on peut agir', color: '#2f9e44' },
]

/** « Arnaque »: Awa's story, her phone at each step, the three tips, captions. */
function ArnaqueOverlay({ t, shot }: { t: number; shot: Shot }) {
  const local = t - shot.from
  const shake = shot.phone === 'drain' && local > 1.2 && local < 4.2 ? Math.sin(t * 80) * 7 : 0
  const tip = shot.tip ? TIPS[shot.tip - 1] : null
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent px-6 pt-8 pb-12 font-sans">
        <span className="block h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#ff7a00] bg-[#ffd8a8]">
          <AwaFace t={t} size={56} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[26px] leading-none font-extrabold">awa.babi</div>
          <div className="mt-1 text-[18px] font-bold text-white/80">Story time · On m’a arnaquée</div>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg bg-[#e03131] px-3 py-1.5 text-[18px] font-extrabold">
          <TriangleAlert size={18} /> PRÉVENTION
        </span>
      </div>
      {shot.phone === 'msg' && (
        <ArnaquePhone t={local}>
          <FakeChat t={local} />
        </ArnaquePhone>
      )}
      {shot.phone === 'page' && (
        <ArnaquePhone t={local}>
          <FakePage t={local} />
        </ArnaquePhone>
      )}
      {shot.phone === 'drain' && (
        <ArnaquePhone t={local} shake={shake}>
          <Drained t={local} />
        </ArnaquePhone>
      )}
      {shot.phone === 'call' && (
        <ArnaquePhone t={local}>
          <CallFanta t={local} />
        </ArnaquePhone>
      )}
      {shot.phone === 'masque' && (
        <ArnaquePhone t={local}>
          <FakeChat t={local} masked />
        </ArnaquePhone>
      )}
      {/* The tips, one by one: big, in the middle */}
      {tip && (
        <div className="absolute inset-x-0 top-[24%] flex flex-col items-center px-8 font-display">
          <div className="rounded-full bg-[#0f1230]/85 px-6 py-2 text-[34px] font-extrabold text-white" style={pop2(local, 0)}>
            Retenez bien
          </div>
          <div className="mt-4 w-full rounded-[36px] bg-white p-6 text-center text-[var(--color-ink)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]" style={pop2(local, 0.25)}>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full text-white" style={{ background: tip.color }}>
              <span className="text-[44px] leading-none font-extrabold">{shot.tip}</span>
            </div>
            <tip.icon size={44} className="mx-auto mt-4" style={{ color: tip.color }} />
            <div className="mt-3 text-[40px] leading-[1.05] font-extrabold">{tip.title}</div>
            <div className="mt-3 font-sans text-[24px] font-bold text-[var(--color-ink-soft)]">{tip.sub}</div>
          </div>
        </div>
      )}
      {shot.cap && (
        <div className="absolute inset-x-0 bottom-[7%] flex justify-center px-10">
          <div className="rounded-2xl bg-white px-5 py-2.5 text-center text-[32px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]">{shot.cap}</div>
        </div>
      )}
    </>
  )
}

/** Up into place, from `at` seconds into the shot. */
function pop2(local: number, at: number) {
  const k = ease(clamp01((local - at) / 0.4))
  return { opacity: k, transform: `translateY(${(1 - k) * 30}px) scale(${0.9 + 0.1 * k})` }
}

/** « Keke »: the question on top, who's speaking, what they say, and the wishes adding up. */
function KekeOverlay({ t, shot }: { t: number; shot: Shot }) {
  const local = t - shot.from
  const who = MT[shot.scene]
  const shots = FILMS.keke.shots
  // The wishes said so far (one per person, from the start of their shot).
  const wishes = shots.filter((s) => MT[s.scene] && t >= s.from + 0.6).map((s) => MT[s.scene])
  // The question: big while he asks it, then up top.
  const [ask, first] = [shots[1].from, shots[2].from]
  const asked = t >= ask + 0.4
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent px-6 pt-8 pb-12 font-sans">
        <span className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-[#ff8200] bg-[#1b1d2a] font-display text-[28px] font-extrabold">K</span>
        <div className="min-w-0 flex-1">
          <div className="text-[26px] leading-none font-extrabold">keke.babi</div>
          <div className="mt-1 text-[18px] font-bold text-white/80">L’ami d’Awa · Micro-trottoir</div>
        </div>
        <span className="rounded-lg bg-[#ff8200] px-3 py-1.5 text-[18px] font-extrabold">🎤 DANS LA RUE</span>
      </div>
      {/* The question, big when he asks it, then up top */}
      {asked && (
        <div className="absolute inset-x-0 flex justify-center px-6 font-display" style={{ top: t < first ? '30%' : '11%' }}>
          <div className={`rounded-[28px] bg-white text-center font-extrabold text-[var(--color-ink)] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)] ${t < first ? 'px-7 py-5 text-[52px] leading-[1.05]' : 'px-5 py-2.5 text-[28px]'}`} style={t < first ? slam(t, ask + 0.4) : undefined}>
            Qu’est-ce que tu veux
            <br />
            dans <span className="text-[var(--color-orange)]">Babi Life</span> ?
          </div>
        </div>
      )}
      {/* Who's answering: name, quarter, job */}
      {who && (
        <div className="absolute bottom-[23%] left-6 font-sans" style={pop2(local, 0.2)}>
          <div className="rounded-t-2xl bg-[#ff8200] px-4 py-1.5 font-display text-[34px] leading-none font-extrabold">{who.name}</div>
          <div className="rounded-b-2xl rounded-tr-2xl bg-[#0f1230]/85 px-4 py-1.5 text-[20px] font-bold">
            {who.job} · {who.where}
          </div>
        </div>
      )}
      {/* The wishes, adding up on the right */}
      {wishes.length > 0 && (
        <div className="absolute top-[22%] right-5 flex flex-col items-end gap-2 font-sans">
          {wishes.map((w) => (
            <div key={w.wish} className="flex items-center gap-2 rounded-full bg-white/95 py-1.5 pr-4 pl-2 text-[22px] font-extrabold text-[var(--color-ink)] shadow-md">
              <span className="text-[26px]">{w.icon}</span>
              {w.wish}
            </div>
          ))}
        </div>
      )}
      {(who?.cap ?? shot.cap) && (
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center px-8">
          <div className="rounded-2xl bg-white px-5 py-2.5 text-center text-[32px] leading-tight font-extrabold text-[var(--color-ink)] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]">{who?.cap ?? shot.cap}</div>
        </div>
      )}
    </>
  )
}

function Confetti({ t }: { t: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[...Array(70)].map((_, i) => {
        const r = (n: number) => {
          const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
          return x - Math.floor(x)
        }
        const y = -60 - r(2) * 500 + t * (180 + r(1) * 160)
        const x = r(3) * 540 + Math.sin(t * 2 + i) * 20
        return <i key={i} className="absolute block" style={{ left: x, top: y, width: 9, height: 15, background: ['#ff8200', '#ffffff', '#009a44', '#ff3d6e', '#ffd43b'][i % 5], transform: `rotate(${t * 300 * (r(4) - 0.5) + r(5) * 360}deg)`, opacity: clamp01(3.5 - t * 0.5) }} />
      })}
    </div>
  )
}

/** What people say to each other in the street, two by two. */
const TALK: [string, string][] = [
  ["C'est comment famille ?", 'Y a fohi, on est là !'],
  ['Eh fiscalité !', 'Tombe sur moi un peu…'],
  ['Ça dit quoi ?', 'Asec ou Africa ce soir ?'],
]

/** The phone's home screen: the game's apps come up one after the other. */
function PhoneApps({ t }: { t: number }) {
  const up = ease(clamp01(t / 0.6))
  const apps: { id?: string; icon?: typeof MapIcon; bg?: string; label: string }[] = [
    { id: 'waye', label: 'Waye' },
    { id: 'gnango', label: 'Gnango' },
    { id: 'golvo', label: 'Garbaya' },
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

/* ---------- « top20 »: what goes over the game filmed (marketing/top20.mjs) ---------- */

const YELLOW = '#ffd400'

/** Awa's line as on TikTok: white boxes, black words, the words coming as she says them. */
function Captions({ say, local, span }: { say: string; local: number; span: number }) {
  const words = say.split(' ')
  const shown = Math.min(words.length, 1 + Math.floor((Math.max(0, local - 0.1) / Math.max(0.5, span - 0.6)) * words.length))
  return (
    <div className="absolute inset-x-7 top-[62%] text-center">
      <p className="text-[27px] leading-[1.45] font-extrabold text-[#111]" style={{ opacity: clamp01(local / 0.1) }}>
        <span className="box-decoration-clone rounded-lg bg-white px-2.5 py-0.5 shadow-[0_6px_0_rgba(0,0,0,0.25)]">{words.slice(0, shown).join(' ')}</span>
      </p>
    </div>
  )
}

/** The countdown as a bar of segments across the top, as on stories: done, the one now (yellow, filling), to come. */
function Countdown({ now, of, k }: { now: number; of: number; k: number }) {
  return (
    <div className="absolute inset-x-3 top-[3.2%] flex gap-[3px]">
      {Array.from({ length: of }, (_, i) => of - i).map((n) => (
        <span key={n} className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-white/30 shadow-[0_2px_0_rgba(0,0,0,0.35)]">
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: n > now ? '100%' : n === now ? `${Math.round(clamp01(k) * 100)}%` : '0%', background: n === now ? YELLOW : '#fff' }} />
        </span>
      ))}
    </div>
  )
}

/**
 * The film's times as top20.mjs measured them on Awa's voice (&times=: when the hook, each activity and
 * the end card start, then the end), else the guide's.
 */
function timed(film: (typeof FILMS)['top20']) {
  const times = q.get('times')?.split(',').map(Number)
  if (!times || times.length !== film.shots.length + 1) return film
  const shots = film.shots.map((s, i) => ({ ...s, from: times[i], to: times[i + 1] }))
  return { ...film, shots, outro: times[times.length - 2], length: times[times.length - 1] }
}

/** « top20 »: the hook, each activity's number and name, the countdown, Awa's words, and the end card. */
function Top20Overlay({ t, qr, url }: { t: number; qr: string; url: string }) {
  const film = useMemo(() => timed(FILMS.top20), [])
  const count = film.shots.filter((s) => s.n).length
  const shot = film.shots.find((s) => t >= s.from && t < s.to) ?? film.shots[film.shots.length - 1]
  const local = t - shot.from
  const hook = t < film.shots[1].from
  const outro = t >= film.outro
  const gold = shot.n === 1
  return (
    <div className="relative h-full w-full overflow-hidden font-display text-white">
      {hook && (
        <div className="absolute inset-x-0 top-[12%] flex flex-col items-center gap-1 px-6 text-center">
          <div className="text-[58px] leading-none [text-shadow:0_5px_0_#000]" style={{ fontFamily: 'Anton, sans-serif', ...slam(t, 0.15) }}>
            TU T’ENNUIES ?
          </div>
          <div className="text-[132px] leading-[1.05] [text-shadow:0_8px_0_#000]" style={{ fontFamily: 'Alfa Slab One, serif', color: YELLOW, ...slam(t, 0.75) }}>
            {count} TRUCS
          </div>
          <div className="rounded-xl bg-black px-4 py-1 text-[40px] leading-tight" style={{ fontFamily: 'Anton, sans-serif', ...slam(t, 1.3) }}>
            À FAIRE DANS BABI LIFE 👇
          </div>
        </div>
      )}
      {shot.n && !outro && (
        <div className="absolute top-[10.5%] left-4 flex flex-col items-start gap-2">
          <div
            className="flex h-[104px] w-[104px] -rotate-[7deg] flex-col items-center justify-center rounded-[28px] border-[5px] border-white text-[#111] shadow-[0_10px_0_rgba(0,0,0,0.35)]"
            style={{ background: gold ? 'linear-gradient(140deg,#fff3a0,#ffc300 45%,#e08e00)' : YELLOW, fontFamily: 'Alfa Slab One, serif', ...slam(local, 0.05) }}
          >
            <span className="text-[20px] leading-none">{gold ? '🏆 N°' : 'N°'}</span>
            <span className="text-[56px] leading-[0.95]">{shot.n}</span>
          </div>
          <div className="-rotate-[2deg] rounded-xl bg-black/85 px-4 py-1 text-[36px] leading-tight" style={{ fontFamily: 'Anton, sans-serif', color: gold ? '#ffd76a' : YELLOW, ...slam(local, 0.3) }}>
            {shot.title}
          </div>
        </div>
      )}
      {!hook && !outro && <Countdown now={shot.n ?? count} of={count} k={local / (shot.to - shot.from)} />}
      {shot.say && !outro && <Captions say={shot.say} local={local} span={shot.to - shot.from} />}
      {outro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#0b0c18]/80 px-8 text-center" style={{ opacity: clamp01((t - film.outro) / 0.35) }}>
          <div style={pop(t, film.outro + 0.2)}>
            <Logo size={70} />
          </div>
          <div className="text-[54px] leading-[1.02] [text-shadow:0_5px_0_#000]" style={{ fontFamily: 'Anton, sans-serif', ...slam(t, film.outro + 0.45) }}>
            ET TOI, TU COMMENCES
            <br />
            <span style={{ color: YELLOW }}>PAR LEQUEL ? 👇</span>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-[30px] bg-white p-5 text-[#111] shadow-[0_14px_0_rgba(0,0,0,0.35)]" style={pop(t, film.outro + 1)}>
            <div className="text-[28px] leading-tight font-extrabold">Inscris-toi, c’est gratuit</div>
            {qr && <img src={qr} alt="" className="h-[200px] w-[200px] [image-rendering:pixelated]" />}
            <div className="font-sans text-[22px] font-extrabold text-[var(--color-orange)]">{url}</div>
          </div>
          <div className="font-sans text-[21px] font-extrabold text-white/85" style={pop(t, film.outro + 1.5)}>
            + de 160 activités dans le jeu · 100 % ivoirien
          </div>
        </div>
      )}
    </div>
  )
}

/** One scene alone, nothing over it, its clock from 0 (marketing/top20.mjs films it): ?video=top20&only=<scene>. */
function Clean({ t }: { t: number }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--color-night)]">
      <div className="absolute inset-0">
        <Scene className="h-full w-full" />
      </div>
      <Canvas frameloop="never" shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} dpr={2} camera={{ fov: 40, near: 0.1, far: 100 }}>
        <FullDetail.Provider value>
          <World scene={ONLY!} t={t} />
        </FullDetail.Provider>
      </Canvas>
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
  // « gameplay » cuts hard: a white flash and a zoom punch instead of the fade to black.
  const punchy = FILM === 'gameplay'
  const black = punchy ? 0 : 1 - Math.min(1, fade(t, shot.from, shot.to, 0.35) + (shot.from === 0 ? 1 : 0))
  const flash = punchy && shot.from > 0 ? 0.75 * (1 - clamp01(local / 0.16)) : 0
  const zoom = punchy ? 1 + 0.1 * (1 - ease(clamp01(local / 0.35))) : 1
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
      <div className="absolute inset-0" style={{ opacity: intro ? 0 : outro ? 0.35 : 1, transform: `scale(${zoom})` }}>
        <Canvas frameloop="never" shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} dpr={2} camera={{ fov: 40, near: 0.1, far: 100 }}>
          <FullDetail.Provider value>
            <World scene={shot.scene} t={local} />
          </FullDetail.Provider>
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
      {/* The live: its frame, the Waye payment, the friends' chat */}
      {FILM === 'live' && !outro && <LiveOverlay t={t} shot={shot} />}
      {FILM === 'merci' && !outro && <MerciOverlay t={t} shot={shot} />}
      {FILM === 'gameplay' && !outro && <GameplayOverlay t={t} shot={shot} />}
      {FILM === 'arnaque' && !outro && <ArnaqueOverlay t={t} shot={shot} />}
      {FILM === 'keke' && !outro && <KekeOverlay t={t} shot={shot} />}
      {FILM === 'sortie' && !outro && <SortieOverlay t={t} shot={shot} />}
      {FILM === 'bienvenue' && !outro && <BienvenueOverlay t={t} shot={shot} />}
      {FILM === 'bebe' && !outro && !intro && <BebeOverlay screen={shot.screen} t={local} />}
      {FILM === 'live' && shot.scene === 'garba' && local > 5.6 && local < 10.2 && <WayePay t={local - 5.6} />}
      {FILM === 'live' && shot.scene === 'amis' && local > 3 && <GbairaiChat t={local - 3} />}
      {/* Captions */}
      {shot.title && FILM !== 'live' && FILM !== 'gameplay' && FILM !== 'sortie' && FILM !== 'bienvenue' && (
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
            {FILM === 'keke' ? (
              <>
                Et toi, tu veux quoi
                <br />
                <span className="text-[var(--color-orange)]">dans Babi Life ? 👇</span>
              </>
            ) : FILM === 'arnaque' ? (
              <>
                Partage pour protéger
                <br />
                <span className="text-[var(--color-orange)]">ta famille 🙏🏾</span>
              </>
            ) : FILM === 'merci' ? (
              <>
                Merci la famille !
                <br />
                <span className="text-[var(--color-orange)]">Bonne semaine ❤️</span>
              </>
            ) : FILM === 'bienvenue' ? (
              <>
                C’est ouvert !
                <br />
                <span className="text-[var(--color-orange)]">À toi de jouer 🎮</span>
              </>
            ) : FILM === 'bebe' ? (
              <>
                Ton bébé
                <br />
                <span className="text-[var(--color-orange)]">t’attend 🍼</span>
              </>
            ) : FILM === 'sortie' ? (
              <>
                Babi Life sort
                <br />
                <span className="text-[var(--color-orange)]">
                  {SORTIE.weekday.toLowerCase()} {SORTIE.day} {SORTIE.month}
                </span>
              </>
            ) : FILM === 'gameplay' ? (
              <>
                Et toi, tu finis
                <br />
                <span className="text-[#ffd43b]">gnambro ou debout&nbsp;?</span>
              </>
            ) : (
              <>
                Bientôt sur
                <br />
                ton téléphone
              </>
            )}
          </div>
          <div className="flex flex-col items-center gap-4 rounded-[32px] bg-white p-6 text-[var(--color-ink)] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]" style={pop(O + 1.1)}>
            <div className="text-[30px] leading-tight font-extrabold">{FILM === 'bienvenue' || FILM === 'bebe' ? 'Joue maintenant' : 'Inscris-toi sur la liste'}</div>
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
      <div className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: flash }} />
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
  if (VIDEO && ONLY) return <Clean t={t} />
  if (VIDEO && OVERLAY) return <Top20Overlay t={t} {...outro} />
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

document.documentElement.style.background = ALPHA || OVERLAY ? 'transparent' : '#0f1230'
document.body.style.background = 'transparent'
createRoot(document.getElementById('root')!).render(<Poster />)
