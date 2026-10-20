import { useMemo } from 'react'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'
import { BOX, Blocks } from './ruePrincesse'

// The Noum Hôtel on the Plateau, as the photos of the real one show it: a wide
// podium of six floors whose left half is a white screen pierced by thousands
// of slanted slits, the hotel's name in round white letters at its corner; the
// right half in pale grey panels with narrow slit windows, a glass storey on
// top, a great white strut leaning across it, the glass lobby and its white
// awning below. On the podium's roof the pool deck, its edge in blue tiles,
// glass railings and palms; above it a slim grey tower with windows set at
// random, crowned by an overhang with the name again. Sizes are the game's
// estimates. Frame: +z toward the street.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The podium: six tall floors, the screen on the left, the panels on the right. */
const POD = { x0: -30, x1: 26, front: 0, depth: 20, h: 24 }
const SPLIT = 2
/** The tower over the podium's left half, lifted on the pool deck's glass storey. */
const TOWER = { x0: -26, x1: 2, z0: -18, z1: -4, base: POD.h + 5, floors: 18, storey: 3.3 }
const TOWER_TOP = TOWER.base + TOWER.floors * TOWER.storey

const white = new THREE.MeshLambertMaterial({ color: '#eef0f2' })
const panel = new THREE.MeshLambertMaterial({ color: '#c9ced6' })
const tiles = new THREE.MeshLambertMaterial({ color: '#3d6fc9' })
const water = new THREE.MeshLambertMaterial({ color: '#4fb6e0', emissive: '#1a5f88', emissiveIntensity: 0.3 })
const glass = new THREE.MeshLambertMaterial({ color: '#a9d6ea', transparent: true, opacity: 0.35 })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const paving = new THREE.MeshLambertMaterial({ color: '#c9c3b8', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const hedge = new THREE.MeshLambertMaterial({ color: '#3f7f34' })
const trunk = new THREE.MeshLambertMaterial({ color: '#8a6a48' })
const leaves = new THREE.MeshLambertMaterial({ color: '#2f8a3a' })
const PLANE_GEO = new THREE.PlaneGeometry(1, 1)

/** A cheap repeatable hash, so the slits and the lit rooms stay put between renders. */
const rnd = (i: number) => Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)

/** The screen: white, cut by short slanted slits in rows; at night the light of the floors shows through them. */
function screenTexture(night: boolean) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = night ? '#6b6f78' : '#dfe2e6'
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = night ? '#ffc879' : '#4a5260'
  let k = 0
  for (let y = 6; y < 256; y += 11)
    for (let x = (y % 22) * 0.8; x < 512; x += 5 + rnd(k++) * 9) {
      const [len, w] = [10 + rnd(k++) * 22, 2.5 + rnd(k++) * 2.5]
      // A parallelogram leaning to the right, like the real screen's cuts.
      g.beginPath()
      g.moveTo(x, y + 7)
      g.lineTo(x + w, y + 7)
      g.lineTo(x + w + len * 0.5, y)
      g.lineTo(x + len * 0.5, y)
      g.fill()
      x += len * 0.5
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The right half: pale panels, a narrow slit window here and there, at night some lit. */
function panelTexture(night: boolean) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 96
  const g = c.getContext('2d')!
  g.fillStyle = night ? '#5d636e' : '#c9ced6'
  g.fillRect(0, 0, 128, 96)
  g.fillStyle = night ? '#4c525c' : '#b9bfc8'
  for (let y = 0; y < 96; y += 16) g.fillRect(0, y, 128, 1)
  for (let i = 0; i < 18; i++) {
    const [x, y] = [Math.floor(rnd(i * 3 + 1) * 15) * 8 + 3, Math.floor(rnd(i * 3 + 2) * 5) * 16 + 4]
    g.fillStyle = night && rnd(i * 7) > 0.4 ? '#ffd890' : '#1f2630'
    g.fillRect(x, y, 2, 10)
  }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The tower: grey-white, the windows of each floor set off-step from the floor below, at night rooms lit. */
function towerTexture(night: boolean, bays: number) {
  const c = document.createElement('canvas')
  c.width = bays * 8
  c.height = TOWER.floors * 12
  const g = c.getContext('2d')!
  g.fillStyle = night ? '#646a74' : '#d6d9de'
  g.fillRect(0, 0, c.width, c.height)
  for (let f = 0; f < TOWER.floors; f++)
    for (let b = 0; b < bays; b++) {
      if (rnd(f * 31 + b) < 0.35) continue
      const x = b * 8 + ((f % 3) - 1) * 2 + 2
      const lit = night && rnd(f * 17 + b * 5) > 0.5
      g.fillStyle = lit ? '#ffe2a0' : night ? '#262b33' : '#3b4654'
      g.fillRect(x, f * 12 + 2, 4, 8)
    }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The name in round lowercase white letters, on nothing: the facade shows behind. */
function logo(text: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 132px sans-serif'
  g.fillText(text, 256, 82)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t, transparent: true, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.6 })
}

export function Palm({ x, y = 0, z, h = 7 }: { x: number; y?: number; z: number; h?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh geometry={BOX} position={[0, h / 2, 0]} scale={[0.45, h, 0.45]} material={trunk} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} geometry={BOX} position={[Math.cos((k * Math.PI) / 3) * 1.3, h, Math.sin((k * Math.PI) / 3) * 1.3]} rotation={[0, -(k * Math.PI) / 3, 0.35]} scale={[2.6, 0.16, 0.65]} material={leaves} />
      ))}
    </group>
  )
}

export function HotelNoum({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const lit = (map: THREE.Texture, k: number) => new THREE.MeshLambertMaterial({ map, emissive: night ? '#ffffff' : '#000000', emissiveMap: night ? map : null, emissiveIntensity: night ? k : 0 })
    const screen = screenTexture(night)
    screen.wrapS = screen.wrapT = THREE.RepeatWrapping
    screen.repeat.set(1.5, 1.5)
    const panels = panelTexture(night)
    panels.wrapS = panels.wrapT = THREE.RepeatWrapping
    panels.repeat.set(2, 1)
    return {
      screen: lit(screen, 0.55),
      panels: lit(panels, 0.4),
      tower: lit(towerTexture(night, Math.round((TOWER.x1 - TOWER.x0) / 2)), 0.45),
      towerSide: lit(towerTexture(night, Math.round((TOWER.z1 - TOWER.z0) / 2)), 0.45),
      name: logo('noum'),
      lobby: new THREE.MeshLambertMaterial({ color: night ? '#ffd9a0' : '#5f8296', emissive: '#ffb45a', emissiveIntensity: night ? 0.9 : 0 }),
      band: new THREE.MeshLambertMaterial({ color: '#9fd0e6', emissive: '#ffcf8a', emissiveIntensity: night ? 0.7 : 0 }),
    }
  }, [night])
  const podW = SPLIT - POD.x0
  const rightW = POD.x1 - SPLIT
  const tw = TOWER.x1 - TOWER.x0
  const td = TOWER.z1 - TOWER.z0
  const tcx = (TOWER.x0 + TOWER.x1) / 2
  const tcz = (TOWER.z0 + TOWER.z1) / 2
  const th = TOWER_TOP - TOWER.base
  const railing: Block[] = [
    { p: [(POD.x0 + POD.x1) / 2, POD.h + 1.8, POD.front - 0.3], s: [POD.x1 - POD.x0, 1.2, 0.08] },
    { p: [POD.x0 + 0.3, POD.h + 1.8, POD.front - POD.depth / 2], s: [0.08, 1.2, POD.depth] },
  ]
  return (
    <group>
      {/* The forecourt, the drive and the planted strip along the street */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2, 0.02, 9]} geometry={PLANE_GEO} scale={[60, 18, 1]} material={paving} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-16, 0.03, 14]} geometry={PLANE_GEO} scale={[26, 4, 1]} material={lawn} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[16, 0.03, 14]} geometry={PLANE_GEO} scale={[16, 4, 1]} material={lawn} />
      <Blocks at={[{ p: [-16, 0.5, 16], s: [26, 1, 0.8] }, { p: [16, 0.5, 16], s: [16, 1, 0.8] }]} material={hedge} />
      {/* The podium: the screen standing proud of the left half, the panelled right half */}
      <mesh geometry={BOX} position={[(POD.x0 + POD.x1) / 2, POD.h / 2, POD.front - POD.depth / 2]} scale={[POD.x1 - POD.x0, POD.h, POD.depth]} material={panel} castShadow receiveShadow />
      <mesh geometry={BOX} position={[(POD.x0 + SPLIT) / 2, POD.h / 2 + 0.5, POD.front + 0.6]} scale={[podW, POD.h - 1, 1]} material={mats.screen} castShadow />
      <mesh position={[POD.x0 + 9, POD.h - 3.4, POD.front + 1.12]} material={mats.name}>
        <planeGeometry args={[16, 5]} />
      </mesh>
      <mesh position={[SPLIT + rightW / 2, POD.h / 2 + 2, POD.front + 0.02]} material={mats.panels}>
        <planeGeometry args={[rightW, POD.h - 9]} />
      </mesh>
      {/* The glass storey on top of the right half, the rooms facing the street */}
      <mesh position={[SPLIT + rightW / 2, POD.h - 2.5, POD.front + 0.03]} material={mats.band}>
        <planeGeometry args={[rightW, 4]} />
      </mesh>
      {/* The glass lobby at the foot of the right half, under its white awning */}
      <mesh position={[SPLIT + rightW / 2 + 1, 3, POD.front + 0.04]} material={mats.lobby}>
        <planeGeometry args={[rightW - 4, 5.6]} />
      </mesh>
      <mesh geometry={BOX} position={[17, 4.6, POD.front + 3.5]} rotation={[-0.18, 0, 0]} scale={[9, 0.3, 7]} material={white} castShadow />
      <Blocks at={[{ p: [13, 2.2, POD.front + 6.5], s: [0.25, 4.4, 0.25] }, { p: [21, 2.2, POD.front + 6.5], s: [0.25, 4.4, 0.25] }]} material={white} />
      {/* The great white strut, leaning across the right half from the forecourt to the roof */}
      <mesh geometry={BOX} position={[10.5, (POD.h + 6) / 2, POD.front + 1]} rotation={[0, 0, -0.12]} scale={[1.6, POD.h + 6, 1.6]} material={white} castShadow />
      {/* The pool deck: the blue-tiled edge, the water, the glass railings, palms */}
      <mesh geometry={BOX} position={[(POD.x0 + POD.x1) / 2, POD.h + 0.6, POD.front - 0.6]} scale={[POD.x1 - POD.x0, 1.2, 1.2]} material={tiles} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, POD.h + 1.05, -2.6]} geometry={PLANE_GEO} scale={[36, 3, 1]} material={water} />
      <Blocks at={railing} material={glass} />
      {[-28, -20, -12, 6, 14, 22].map((x) => (
        <Palm key={x} x={x} y={POD.h} z={-4} h={4.5} />
      ))}
      {/* The glass storey under the tower, open on the deck */}
      <mesh geometry={BOX} position={[tcx, POD.h + 2.5, tcz]} scale={[tw - 1, 5, td - 1]} material={mats.band} />
      <mesh geometry={BOX} position={[(POD.x0 + POD.x1) / 2 - 2, TOWER.base + 0.3, -9]} scale={[POD.x1 - POD.x0 - 4, 0.6, 18]} material={white} castShadow />
      {/* The tower, its windows off-step, the crown's overhang with the name */}
      <mesh geometry={BOX} position={[tcx, TOWER.base + th / 2, tcz]} scale={[tw, th, td]} material={mats.towerSide} castShadow />
      <mesh position={[tcx, TOWER.base + th / 2, TOWER.z1 + 0.02]} material={mats.tower}>
        <planeGeometry args={[tw, th]} />
      </mesh>
      <mesh geometry={BOX} position={[tcx + 2, TOWER_TOP + 1.5, tcz + 2]} scale={[tw + 6, 3, td + 6]} material={white} castShadow />
      <mesh geometry={BOX} position={[tcx, TOWER_TOP - 2.2, tcz]} scale={[tw + 0.2, 4.4, td + 0.2]} material={white} />
      <mesh position={[tcx + 6, TOWER_TOP - 2.5, TOWER.z1 + 0.16]} material={mats.name}>
        <planeGeometry args={[9, 2.8]} />
      </mesh>
      {night && <pointLight position={[17, 4, 7]} intensity={30} distance={16} color="#ffd9a0" />}
      {/* The flags along the drive, the palms of the planted strip */}
      {[-6, -2, 2].map((x) => (
        <group key={x}>
          <mesh geometry={BOX} position={[x, 5, 13]} scale={[0.12, 10, 0.12]} material={white} />
          <Blocks at={[{ p: [x + 0.55, 9.3, 13], s: [0.5, 1.1, 0.04], c: '#ff8200' }, { p: [x + 1.05, 9.3, 13], s: [0.5, 1.1, 0.04], c: '#ffffff' }, { p: [x + 1.55, 9.3, 13], s: [0.5, 1.1, 0.04], c: '#009e60' }]} material={COLORED} color />
        </group>
      ))}
      {[-27, -21, -14, -9, 9, 25].map((x, i) => (
        <Palm key={x} x={x} z={14 - (i % 2)} />
      ))}
      {/* Cars at the door and along the planted strip */}
      <Vehicle p={[16, 0, 9]} r={Math.PI / 2} kind="car" seed={4} color="#f8f9fa" />
      <Vehicle p={[-20, 0, 10]} r={Math.PI / 2} kind="car" seed={9} color="#adb5bd" />
      <Vehicle p={[-10, 0, 10]} r={Math.PI / 2} kind="car" seed={13} color="#343a40" />
    </group>
  )
}

const COLORED = new THREE.MeshLambertMaterial({ color: '#ffffff' })

/** What one can't walk through: the podium (the tower stands on it), the awning's posts. */
export const NOUM_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: (POD.x0 + POD.x1) / 2, z: POD.front - POD.depth / 2 + 0.6, hw: (POD.x1 - POD.x0) / 2 + 0.5, hd: POD.depth / 2 + 1.2, rot: 0, top: TOWER_TOP + 3 },
  { x: 13, z: POD.front + 6.5, r: 0.5 },
  { x: 21, z: POD.front + 6.5, r: 0.5 },
]
