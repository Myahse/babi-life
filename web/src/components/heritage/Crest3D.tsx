import { useLayoutEffect, useState } from 'react'
import { advance, createRoot, extend, useThree, type ReconcilerRoot, type RootState } from '@react-three/fiber'
import * as THREE from 'three'
import type { Crest } from '../../lib/types'
import { crestGeometry, crestMaterial } from './crestArt'

// The family's crest in 3D (update « heritage », phase 3): the blocks of crestArt.ts as one mesh, on a house's
// plaque in the street and in Mon quartier; and as a still picture (one hidden canvas for every crest, as the
// Sims' portraits: phones only allow a few live WebGL contexts) for « Ma famille », the ranking, the profile,
// the passation's card and Babi Direct.

/** The crest itself, `size` tall, its face towards +z. */
export function Crest3D({ crest, size = 1, position, rotation }: { crest: Crest; size?: number; position?: [number, number, number]; rotation?: [number, number, number] }) {
  return <mesh geometry={crestGeometry(crest)} material={crestMaterial()} scale={size} position={position} rotation={rotation} />
}

/** A plaque over a door: a dark wooden board, the crest on it. `size`: the crest's height. */
export function CrestPlaque({ crest, size = 0.7, position, rotation }: { crest: Crest; size?: number; position?: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.05 * size]}>
        <boxGeometry args={[size * 1.05, size * 1.18, 0.06 * size]} />
        <meshLambertMaterial color="#5a3a1e" />
      </mesh>
      <Crest3D crest={crest} size={size} />
    </group>
  )
}

/** A post at a house's front with the crest on top, facing the street (+z): for a home with no gate of its own. */
export function CrestPost({ crest, at }: { crest: Crest; at: [number, number] }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, 0.9, -0.06]} castShadow>
        <boxGeometry args={[0.14, 1.8, 0.14]} />
        <meshLambertMaterial color="#5a3a1e" />
      </mesh>
      <CrestPlaque crest={crest} size={0.7} position={[0, 2.1, 0]} />
    </group>
  )
}

/* ---------- Still pictures ---------- */

const SIZE = 192
let root: ReconcilerRoot<HTMLCanvasElement> | null = null
let canvas: HTMLCanvasElement
let chain: Promise<unknown> = Promise.resolve()
let studio: RootState | null = null
const pictures = new Map<string, Promise<string>>()
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))

function Studio({ crest, onReady }: { crest: Crest; onReady: () => void }) {
  const camera = useThree((s) => s.camera)
  studio = useThree()
  useLayoutEffect(() => {
    camera.position.set(0.48, 0.22, 2.7)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera])
  useLayoutEffect(onReady, [onReady])
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d9b27c', 1.5]} />
      <directionalLight position={[2, 3, 4]} intensity={2} />
      <ambientLight intensity={0.45} />
      <Crest3D crest={crest} size={1} rotation={[0, -0.22, 0]} />
    </>
  )
}

async function render(crest: Crest) {
  if (!root) {
    extend(THREE as unknown as Parameters<typeof extend>[0])
    canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    root = createRoot(canvas)
  }
  await root.configure({ size: { width: SIZE, height: SIZE, top: 0, left: 0 }, dpr: 1, frameloop: 'never', gl: { preserveDrawingBuffer: true, alpha: true, antialias: true }, camera: { fov: 22, near: 0.1, far: 20 } })
  await new Promise<void>((done) => {
    const t = setTimeout(done, 1500)
    root!.render(<Studio crest={crest} onReady={() => (clearTimeout(t), done())} />)
  })
  await frame()
  if (studio) advance(performance.now(), true, studio)
  return canvas.toDataURL('image/png')
}

/** A crest's still picture (a data URL), queued and cached. */
export function crestSnapshot(crest: Crest): Promise<string> {
  const key = `${crest.shape}|${crest.colors.join()}|${crest.emblem}`
  let p = pictures.get(key)
  if (!p) {
    p = chain.then(() => render(crest))
    chain = p.catch(() => undefined)
    pictures.set(key, p)
  }
  return p
}

/** The crest as a picture, filling its box. */
export function CrestPicture({ crest, className = '' }: { crest: Crest; className?: string }) {
  const key = `${crest.shape}|${crest.colors.join()}|${crest.emblem}`
  const [src, setSrc] = useState<{ key: string; url: string } | null>(null)
  useLayoutEffect(() => {
    let live = true
    crestSnapshot(crest).then((url) => live && setSrc({ key, url }))
    return () => {
      live = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return src?.key === key ? <img src={src.url} alt="" draggable={false} className={`block h-full w-full object-contain ${className}`} /> : <span className={`block h-full w-full animate-pulse rounded-lg bg-black/5 ${className}`} />
}
