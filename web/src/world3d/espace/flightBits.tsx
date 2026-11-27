import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { ThreeElements } from '@react-three/fiber'
import { Rocket, Map as MapIcon } from 'lucide-react'
import { t as tr } from '../../lib/i18n'
import { mergeBoxes, calaoMaterial } from './calao'
import { worldTime } from '../../lib/worldClock'

// What the launch (LaunchView.tsx) and the way back (Retour.tsx) share: the trip's own clock to the second, the
// planet below in blocks, the stars, the clouds, and the card over the scene.

/**
 * The trip's minute now, to the second. The launches are on the shared clock (lib/worldClock.ts: everyone sees the
 * same lift-off, the plumes in the sky too), and the Sim's own minute is whole minutes from the server: the
 * shared clock is read while the Sim keeps up with it; a Sim held behind (its app closed) goes by its own.
 */
export function useTripClock(gameMinutes: number) {
  const at = useRef({ m: gameMinutes, t: performance.now() })
  useEffect(() => {
    at.current = { m: gameMinutes, t: performance.now() }
  }, [gameMinutes])
  const [now] = useState(() => () => {
    const own = at.current.m + (performance.now() - at.current.t) / 60000
    const shared = worldTime() / 60
    return Math.abs(shared - own) < 2 ? shared : own
  })
  return now
}

type B = [number, number, number, number, number, number, string]

/**
 * The planet below, in blocks: a shell of cubes (seas, lands, ice caps, the land's colour by the latitude),
 * one merged geometry. `land`: how much is land (0..1), `palette`: the Earth's, the Moon's or Mars's.
 */
export function planetGeometry(radius: number, cells = 26, palette: 'terre' | 'lune' | 'mars' = 'terre'): THREE.BufferGeometry {
  const boxes: B[] = []
  const step = (radius * 2) / cells
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++)
      for (let k = 0; k < cells; k++) {
        const x = -radius + (i + 0.5) * step
        const y = -radius + (j + 0.5) * step
        const z = -radius + (k + 0.5) * step
        const d = Math.hypot(x, y, z)
        if (d > radius || d < radius - step * 1.75) continue
        const n = Math.sin(x * 0.011 + 1.3) + Math.cos(z * 0.009 - 0.4) + Math.sin(y * 0.013 + x * 0.004) + 0.5 * Math.sin(z * 0.03)
        let c: string
        if (palette === 'lune') c = n > 0.8 ? '#8f9196' : n > -0.4 ? '#a9abb0' : '#c4c6ca'
        else if (palette === 'mars') c = Math.abs(y) > radius * 0.9 ? '#f1e7df' : n > 0.6 ? '#9c4a2a' : n > -0.5 ? '#c1623a' : '#d98856'
        else if (Math.abs(y) > radius * 0.88) c = '#f1f5f9'
        else if (n > 0.9) c = Math.abs(y) < radius * 0.3 ? (n > 1.6 ? '#2f7d32' : '#c9a66b') : '#4c8f3a'
        else c = n > 0.6 ? '#2a72c4' : '#1d5fb8'
        boxes.push([x, y, z, step, step, step, c])
      }
  return mergeBoxes(boxes)
}

/** The planet as a mesh (cached by its size and palette). */
const planets = new Map<string, THREE.BufferGeometry>()
export function BlockPlanet({ radius, palette = 'terre', cells = 26, ...rest }: { radius: number; palette?: 'terre' | 'lune' | 'mars'; cells?: number } & ThreeElements['group']) {
  const key = `${radius}:${palette}:${cells}`
  const g = planets.get(key) ?? (planets.set(key, planetGeometry(radius, cells, palette)), planets.get(key)!)
  return (
    <group {...rest}>
      <mesh geometry={g} material={calaoMaterial()} />
    </group>
  )
}

/** The stars all round, small cubes far away (their opacity: how dark the sky is). */
export function StarField({ count = 700, radius = 2500, opacity = 1 }: { count?: number; radius?: number; opacity?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(count * 3)
    let seed = 11
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1
      const a = r() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      p.set([Math.cos(a) * s * radius, u * radius, Math.sin(a) * s * radius], i * 3)
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [count, radius])
  const mat = useMemo(() => new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, fog: false }), [])
  mat.opacity = opacity
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

/** A few clouds in blocks, flat, spread over a square of `span` metres at height y. */
export function cloudGeometry(span: number, n = 40, seed0 = 5): THREE.BufferGeometry {
  const boxes: B[] = []
  let seed = seed0
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * span
    const z = (r() - 0.5) * span
    const w = 60 + r() * 160
    for (let k = 0; k < 3; k++) boxes.push([x + (r() - 0.5) * w, (r() - 0.5) * 10, z + (r() - 0.5) * w, w * (0.4 + r() * 0.5), 12 + r() * 14, w * (0.3 + r() * 0.4), '#ffffff'])
  }
  return mergeBoxes(boxes)
}

let cloud: THREE.MeshBasicMaterial | null = null
/** The clouds' material: white all over (lit from within, no dark undersides), a little see-through. */
export const cloudMaterial = () => (cloud ??= new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88, depthWrite: false }))

/** The card over the scene: what's happening, the bar, a line under it; the big countdown in the middle. */
export function FlightCard({ title, share, line, onMap, big, data }: { title: string; share: number; line: string; onMap?: () => void; big?: ReactNode; data?: { label: string; value: string }[] }) {
  return (
    <>
      <div className="hud pointer-events-auto absolute top-[max(5.5rem,calc(var(--sat,env(safe-area-inset-top))+5rem))] left-1/2 w-[min(380px,calc(100vw-24px))] -translate-x-1/2 rounded-[22px] p-3">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <Rocket size={18} className="text-[#ff7a00]" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {onMap && (
            <button className="icon-btn bg-[var(--color-canvas)] !h-9 !w-9" onClick={onMap} aria-label={tr('Voir la carte')}>
              <MapIcon size={16} />
            </button>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
          <div className="h-full rounded-full bg-[#ff7a00] transition-[width] duration-1000" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
        <div className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]" aria-live="polite">
          {line}
        </div>
        {data && data.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {data.map((d) => (
              <div key={d.label} className="rounded-xl bg-[var(--color-canvas)] px-2 py-1 text-center">
                <div className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase">{d.label}</div>
                <div className="font-display text-sm font-extrabold tabular-nums">{d.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {big != null && (
        <div className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center font-display leading-none font-extrabold text-white tabular-nums [text-shadow:0_4px_24px_rgba(0,0,0,.55)] ${typeof big === 'string' && big.length > 3 ? 'text-[52px]' : 'text-[96px]'}`} aria-live="assertive">
          {big}
        </div>
      )}
    </>
  )
}
