import { useLayoutEffect, useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { tint } from '../../avatar/textures'
import type { Block, Material } from '../../lib/types'
import { reflects, type BatTier } from '../batiments'

// A house built block by block on a plot (game/build.go), Minecraft-style:
// one-metre cubes with 16×16 pixel textures, crisp, no smoothing. The blocks
// of one material are one instanced mesh, so a whole house is a handful of
// draw calls. Coordinates are the plot's: x, z from its corner, y up.

const S = 16
const textures = new Map<string, THREE.CanvasTexture>()
const materials = new Map<string, THREE.Material>()

/** A stable 0..1 value per pixel, for grain. */
const hash = (x: number, y: number, k = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453
  return n - Math.floor(n)
}

/** Paints a material's 16×16 face. */
function paint(m: Material, g: CanvasRenderingContext2D) {
  const px = (x: number, y: number, c: string) => {
    g.fillStyle = c
    g.fillRect(x, y, 1, 1)
  }
  const c = m.color
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const n = hash(x, y) - 0.5
      let col = tint(c, n * 0.12)
      switch (m.id) {
        case 'banco': // sun-dried earth bricks, straw in the mud
          if (y % 4 === 3) col = tint(c, -0.22)
          else if (hash(x, y, 1) > 0.9) col = tint(c, 0.35)
          break
        case 'bois': // planks, a dark gap between
          col = y % 4 === 3 ? tint(c, -0.4) : tint(c, (Math.floor(y / 4) % 2 ? -0.08 : 0.04) + n * 0.1 + (hash(x >> 2, y >> 2, 2) > 0.85 ? -0.12 : 0))
          break
        case 'parpaing': // cement blocks and their joints
          if (y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 15) col = tint(c, -0.25)
          else if (hash(x, y, 3) > 0.92) col = tint(c, -0.15)
          break
        case 'tole': // corrugated iron: ridges, a little rust
          col = tint(c, x % 4 < 2 ? 0.18 : -0.18)
          if (hash(x, y, 4) > 0.96) col = '#9a5a2e'
          break
        case 'brique': {
          const off = Math.floor(y / 4) % 2 ? 4 : 0
          col = y % 4 === 3 || (x + off) % 8 === 7 ? '#d8cfc0' : tint(c, n * 0.2)
          break
        }
        case 'carreau':
          col = x % 8 === 7 || y % 8 === 7 ? tint(c, -0.18) : tint(c, n * 0.05)
          break
        case 'verre':
          col = x === 0 || y === 0 || x === S - 1 || y === S - 1 ? '#e8eef2' : x + y === 8 || x + y === 10 ? 'rgba(255,255,255,0.7)' : 'rgba(170,215,235,0.35)'
          break
        case 'marbre':
          col = Math.abs(Math.sin((x + y * 0.6) * 0.5 + hash(x >> 2, y >> 2) * 2)) < 0.12 ? tint(c, -0.25) : tint(c, n * 0.04)
          break
        default: // painted plaster
          col = tint(c, n * 0.08 + (y === S - 1 ? -0.1 : 0))
      }
      if (m.id === 'verre') g.clearRect(x, y, 1, 1)
      px(x, y, col)
    }
}

/** A material's pixel texture (shared): also shown as a swatch in the builder. */
export function materialTexture(m: Material) {
  let t = textures.get(m.id)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = c.height = S
    paint(m, c.getContext('2d')!)
    t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.SRGBColorSpace
    textures.set(m.id, t)
  }
  return t
}

export function blockMaterial(m: Material) {
  let mat = materials.get(m.id)
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ map: materialTexture(m), transparent: !!m.glass, depthWrite: !m.glass })
    materials.set(m.id, mat)
  }
  return mat
}

// « Bâtiments réalistes » (world3d/batiments.ts): the same blocks, still square (they touch, and the
// builder picks them by their faces), with a finer texture (32 texels a metre: the mortar, the
// straw in the banco, the rust on the tôle, the grout and a chipped corner on the tiles, the trowel
// on the plaster) and, from `normal`, physical materials: the tiles, the marble and the glass
// reflect the room.
const R = 32
const realTextures = new Map<string, THREE.CanvasTexture>()
const realMaterials = new Map<string, THREE.Material>()

function paintReal(m: Material, g: CanvasRenderingContext2D) {
  const img = g.createImageData(R, R)
  const c = m.color
  const put = (x: number, y: number, col: string, a = 255) => {
    const n = parseInt(col.slice(1), 16)
    const i = (y * R + x) * 4
    img.data[i] = n >> 16
    img.data[i + 1] = (n >> 8) & 255
    img.data[i + 2] = n & 255
    img.data[i + 3] = a
  }
  for (let y = 0; y < R; y++)
    for (let x = 0; x < R; x++) {
      const n = hash(x, y, 9) - 0.5
      const blot = hash(x >> 3, y >> 3, 10) - 0.5
      let col = tint(c, n * 0.08 + blot * 0.06)
      let a = 255
      switch (m.id) {
        case 'banco': {
          // Sun-dried bricks in courses, the mud between them, straw, the rain's erosion.
          const off = (y >> 3) % 2 ? 8 : 0
          if (y % 8 === 7 || (x + off) % 16 === 15) col = tint(c, -0.25 + n * 0.05)
          else if (hash(x, y, 1) > 0.92) col = tint(c, 0.32)
          else if (hash(x >> 1, y, 2) > 0.95) col = tint(c, -0.15)
          break
        }
        case 'bois': {
          const plank = y >> 3
          col = y % 8 === 7 ? tint(c, -0.42) : tint(c, (plank % 2 ? -0.08 : 0.04) + Math.sin(x * 0.7 + plank * 3 + Math.sin(y) * 0.8) * 0.06 + n * 0.06)
          if (hash(x >> 2, plank, 3) > 0.9 && Math.hypot((x % 8) - 4, (y % 8) - 3) < 1.6) col = tint(c, -0.3)
          break
        }
        case 'parpaing': {
          const off = (y >> 4) % 2 ? 16 : 0
          if (y % 16 === 15 || (x + off) % 32 === 31) col = tint(c, -0.22)
          else if (hash(x, y, 3) > 0.9) col = tint(c, -0.14)
          else if (hash(x, y, 4) > 0.95) col = tint(c, 0.1)
          break
        }
        case 'tole': {
          col = tint(c, x % 8 < 4 ? 0.16 + n * 0.05 : -0.16 + n * 0.05)
          // Rust running down from the nails and the bottom edge.
          if ((hash(x >> 2, 0, 4) > 0.75 && hash(x, y, 5) > 0.6 - y / 80) || (y > 26 && hash(x, y, 6) > 0.5)) col = tint('#9a5a2e', n * 0.2)
          break
        }
        case 'brique': {
          const off = (y >> 3) % 2 ? 8 : 0
          col = y % 8 === 7 || (x + off) % 16 === 15 ? tint('#d8cfc0', n * 0.1) : tint(c, n * 0.18 + (hash((x + off) >> 4, y >> 3, 7) - 0.5) * 0.18)
          break
        }
        case 'carreau': {
          col = x % 16 === 15 || y % 16 === 15 ? tint(c, -0.2) : tint(c, n * 0.04 + (hash(x >> 4, y >> 4, 8) - 0.5) * 0.06)
          if (hash(x >> 4, y >> 4, 11) > 0.8 && x % 16 < 2 && y % 16 < 2) col = tint(c, -0.28)
          break
        }
        case 'verre':
          // The frame, the pane (mostly clear), two streaks of light.
          if (x < 2 || y < 2 || x > R - 3 || y > R - 3) col = '#e8eef2'
          else if (Math.abs(x + y - 18) < 1 || Math.abs(x + y - 23) < 0.6) [col, a] = ['#ffffff', 170]
          else [col, a] = ['#aad7eb', 80]
          break
        case 'marbre':
          col = Math.abs(Math.sin((x + y * 0.6) * 0.26 + hash(x >> 3, y >> 3) * 2)) < 0.08 ? tint(c, -0.28) : tint(c, n * 0.03)
          break
        default: {
          // Painted plaster: a faint mottle, the trowel, a darker foot.
          col = tint(c, n * 0.05 + blot * 0.05 + (y > R - 3 ? -0.1 : 0) + (Math.abs(((x + y * 0.4) % 11) - 5.5) < 0.5 ? -0.03 : 0))
        }
      }
      put(x, y, col, a)
    }
  g.putImageData(img, 0, 0)
}

function realTexture(m: Material) {
  let t = realTextures.get(m.id)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = c.height = R
    paintReal(m, c.getContext('2d')!)
    t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.anisotropy = 4
    t.colorSpace = THREE.SRGBColorSpace
    realTextures.set(m.id, t)
  }
  return t
}
const ROUGH: Record<string, number> = { carreau: 0.3, marbre: 0.18, verre: 0.05, tole: 0.5, bois: 0.65 }
/** A block's material for « bâtiments réalistes » (its tier; the room's environment from `normal`). */
export function realBlockMaterial(m: Material, tier: Exclude<BatTier, 'off'>, env: THREE.Texture | null) {
  const shiny = reflects(tier) && !!env
  const key = `${m.id}|${shiny}`
  let mat = realMaterials.get(key)
  if (!mat) {
    const base = { map: realTexture(m), transparent: !!m.glass, depthWrite: !m.glass }
    mat = shiny ? new THREE.MeshStandardMaterial({ ...base, roughness: ROUGH[m.id] ?? 0.85, metalness: m.id === 'tole' ? 0.3 : 0, envMap: env, envMapIntensity: m.glass ? 0.8 : ROUGH[m.id] ? 0.35 : 0.08 }) : new THREE.MeshLambertMaterial(base)
    realMaterials.set(key, mat)
  }
  return mat
}

const CUBE = new THREE.BoxGeometry(1, 1, 1)

type Props = {
  /** « Bâtiments réalistes »: the blocks' realistic materials (realBlockMaterial), same cubes. */
  real?: { tier: Exclude<BatTier, 'off'>; env: THREE.Texture | null }
  blocks: Block[]
  materials: Material[]
  cast?: boolean
  /** The builder: a block was clicked (its cell, and the face's outward normal). */
  onBlock?: (cell: [number, number, number], normal: [number, number, number], e: ThreeEvent<MouseEvent>) => void
  onHover?: (cell: [number, number, number] | null, normal?: [number, number, number]) => void
}

export function House({ blocks, materials: list, cast = true, onBlock, onHover, real }: Props) {
  const byMaterial = useMemo(() => {
    const m = new Map<string, Block[]>()
    for (const b of blocks) {
      const l = m.get(b[3])
      if (l) l.push(b)
      else m.set(b[3], [b])
    }
    return [...m]
  }, [blocks])
  return (
    <group>
      {byMaterial.map(([id, bs]) => {
        const mat = list.find((x) => x.id === id)
        return mat ? <Blocks key={id} blocks={bs} material={mat} cast={cast} onBlock={onBlock} onHover={onHover} real={real} /> : null
      })}
    </group>
  )
}

function Blocks({ blocks, material, cast, onBlock, onHover, real }: { blocks: Block[]; material: Material; cast: boolean } & Pick<Props, 'onBlock' | 'onHover' | 'real'>) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    blocks.forEach(([x, y, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x + 0.5, y + 0.5, z + 0.5)))
    mesh.count = blocks.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [blocks])
  const hit = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const b = e.instanceId !== undefined ? blocks[e.instanceId] : undefined
    const n = e.face?.normal
    if (!b || !n) return null
    return { cell: [b[0], b[1], b[2]] as [number, number, number], normal: [Math.round(n.x), Math.round(n.y), Math.round(n.z)] as [number, number, number] }
  }
  return (
    <instancedMesh
      // A new mesh when there are more blocks than it was made for.
      key={`${Math.ceil(blocks.length / 64)}${real ? `${real.tier}${!!real.env}` : ''}`}
      ref={ref}
      args={[CUBE, real ? realBlockMaterial(material, real.tier, real.env) : blockMaterial(material), Math.ceil(blocks.length / 64) * 64]}
      castShadow={cast && !material.glass}
      receiveShadow
      onClick={
        onBlock &&
        ((e) => {
          const h = hit(e)
          if (h) {
            e.stopPropagation()
            onBlock(h.cell, h.normal, e)
          }
        })
      }
      onPointerMove={
        onHover &&
        ((e) => {
          const h = hit(e)
          if (h) {
            e.stopPropagation()
            onHover(h.cell, h.normal)
          }
        })
      }
    />
  )
}
