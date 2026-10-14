import { useLayoutEffect, useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { tint } from '../../avatar/textures'
import type { Block, Material } from '../../lib/types'

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

const CUBE = new THREE.BoxGeometry(1, 1, 1)

type Props = {
  blocks: Block[]
  materials: Material[]
  cast?: boolean
  /** The builder: a block was clicked (its cell, and the face's outward normal). */
  onBlock?: (cell: [number, number, number], normal: [number, number, number], e: ThreeEvent<MouseEvent>) => void
  onHover?: (cell: [number, number, number] | null, normal?: [number, number, number]) => void
}

export function House({ blocks, materials: list, cast = true, onBlock, onHover }: Props) {
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
        return mat ? <Blocks key={id} blocks={bs} material={mat} cast={cast} onBlock={onBlock} onHover={onHover} /> : null
      })}
    </group>
  )
}

function Blocks({ blocks, material, cast, onBlock, onHover }: { blocks: Block[]; material: Material; cast: boolean } & Pick<Props, 'onBlock' | 'onHover'>) {
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
      key={Math.ceil(blocks.length / 64)}
      ref={ref}
      args={[CUBE, blockMaterial(material), Math.ceil(blocks.length / 64) * 64]}
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
