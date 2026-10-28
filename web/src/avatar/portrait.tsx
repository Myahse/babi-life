import { useEffect, useLayoutEffect, useState } from 'react'
import { advance, createRoot, extend, useThree, type ReconcilerRoot, type RootState } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { Baby, Human } from './Human'
import { sizeOf } from '../world3d/Character'
import { lookAt } from './options'

// One hidden WebGL canvas renders every still picture of a Sim (creator
// thumbnails, HUD portrait, map pin): phones only allow a handful of live
// WebGL contexts, so tiles can't each have their own <Canvas>.

export type Framing = 'head' | 'bust' | 'full'

const FRAMES: Record<Framing, { y: number; dist: number }> = {
  head: { y: 1.53, dist: 1.3 },
  bust: { y: 1.3, dist: 2.4 },
  full: { y: 0.86, dist: 4.7 },
}
// A baby sitting (at 1.5×): its own frames.
const BABY_FRAMES: Record<Framing, { y: number; dist: number }> = {
  head: { y: 0.72, dist: 1.25 },
  bust: { y: 0.62, dist: 1.6 },
  full: { y: 0.48, dist: 2.7 },
}
const SIZE = 320

let root: ReconcilerRoot<HTMLCanvasElement> | null = null
let canvas: HTMLCanvasElement
let chain: Promise<unknown> = Promise.resolve()
const cache = new Map<string, Promise<string>>()

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))

/** The pictures' own scene, advanced by itself: the page's other scenes (the street, a video) draw on their own, and one may not have its context yet. */
let studio: RootState | null = null

function Studio({ look, gender, framing, stage, onReady }: { look: Look; gender: Sim['gender']; framing: Framing; stage?: string; onReady: () => void }) {
  const camera = useThree((s) => s.camera)
  studio = useThree()
  // A child framed as small as it is; a baby, sitting, scaled up to fill the picture.
  const baby = stage === 'bebe'
  const young = stage && !baby && stage !== 'adulte' ? sizeOf(stage) : null
  const h = baby ? 1 : (look.height ?? 1) * (young ? young.scale * 1.08 : 1)
  const worn = stage ? lookAt(look, stage) : look
  const f = (baby ? BABY_FRAMES : FRAMES)[framing]
  useLayoutEffect(() => {
    camera.position.set(0, f.y * h + 0.05, f.dist * h)
    camera.lookAt(0, f.y * h, 0)
    camera.updateProjectionMatrix()
  }, [camera, f, h])
  // Tell render() this exact Sim is in the scene: a heavy outfit can take
  // longer than a frame to build, and a fixed wait would capture the last one.
  useLayoutEffect(onReady, [onReady])
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d9b27c', 1.4]} />
      <directionalLight position={[1.5, 3, 4]} intensity={2.2} />
      <ambientLight intensity={0.5} />
      <group rotation={[0, framing === 'full' ? -0.25 : -0.18, 0]}>
        {baby ? (
          <group scale={1.5}>
            <Baby look={worn} fitted gender={gender} pose="idle" seed={0} />
          </group>
        ) : young ? (
          <group scale={young.scale}>
            <Human look={worn} fitted gender={gender} pose={framing === 'full' ? 'hero' : 'idle'} seed={-Math.PI / 2} headScale={young.head} />
          </group>
        ) : (
          <Human look={worn} gender={gender} pose={framing === 'full' ? 'hero' : 'idle'} seed={-Math.PI / 2} />
        )}
      </group>
    </>
  )
}

async function render(look: Look, gender: Sim['gender'], framing: Framing, stage?: string) {
  if (!root) {
    extend(THREE as unknown as Parameters<typeof extend>[0]) // <Canvas> does this; a bare root must
    canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    root = createRoot(canvas)
  }
  await root.configure({
    size: { width: SIZE, height: SIZE, top: 0, left: 0 },
    dpr: 1,
    frameloop: 'never',
    gl: { preserveDrawingBuffer: true, alpha: true, antialias: true },
    camera: { fov: 24, near: 0.1, far: 50 },
  })
  await new Promise<void>((done) => {
    const timeout = setTimeout(done, 2000)
    root!.render(<Studio look={look} gender={gender} framing={framing} stage={stage} onReady={() => (clearTimeout(timeout), done())} />)
  })
  await frame()
  if (studio) advance(performance.now(), true, studio)
  return canvas.toDataURL('image/png')
}

/** A still picture of a Sim, as a data URL. Calls are queued and cached. */
export function snapshot(look: Look, gender: Sim['gender'], framing: Framing, stage?: string) {
  const key = JSON.stringify([look, gender, framing, stage])
  let p = cache.get(key)
  if (!p) {
    p = chain.then(() => render(look, gender, framing, stage))
    chain = p.catch(() => undefined)
    cache.set(key, p)
  }
  return p
}

export function Portrait({ look, gender, framing = 'head', className = '', alt = '', stage }: { look: Look; gender: Sim['gender']; framing?: Framing; className?: string; alt?: string; /** Pictured at its age (« Changer de look »). */ stage?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const key = JSON.stringify([look, gender, framing, stage])
  useEffect(() => {
    let live = true
    snapshot(look, gender, framing, stage).then((s) => live && setSrc(s))
    return () => {
      live = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return src ? <img src={src} alt={alt} draggable={false} className={`block h-full w-full object-cover ${className}`} /> : <span className={`block h-full w-full animate-pulse rounded-[inherit] bg-black/5 ${className}`} />
}

