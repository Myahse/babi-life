import { useEffect, useRef } from 'react'
import { tableSfx } from '../../lib/tableSfx'

// A die that rolls (Ludo, the godé): a cube of six faces in 3D, thrown when `roll` changes: it tumbles
// over and over, bounces three times lower each time (a knock on the table each), and comes to rest on
// `value`. Between throws it lies still on its last face. The pips are the cube's own little blocks.

/** The pips of each face, on a 3 × 3 grid (0..8, read left to right, top to bottom). */
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
/** Where each face sits on the cube, and the turn that brings it to the front: 1 front, 6 back, 3 right, 4 left, 2 top, 5 bottom. */
const FACES: Record<number, { place: string; x: number; y: number }> = {
  1: { place: 'rotateY(0deg)', x: 0, y: 0 },
  6: { place: 'rotateY(180deg)', x: 0, y: 180 },
  3: { place: 'rotateY(90deg)', x: 0, y: -90 },
  4: { place: 'rotateY(-90deg)', x: 0, y: 90 },
  2: { place: 'rotateX(90deg)', x: -90, y: 0 },
  5: { place: 'rotateX(-90deg)', x: 90, y: 0 },
}
const rest = (v: number) => `rotateX(${FACES[v].x - 18}deg) rotateY(${FACES[v].y + 22}deg)`

export function Die({ value, roll, size = 48, color = '#fffaf0', pip = '#16161c', onLanded }: { value: number | null; /** Changes for each throw (a counter). */ roll: number; size?: number; color?: string; pip?: string; onLanded?: () => void }) {
  const cube = useRef<HTMLDivElement>(null)
  const hop = useRef<HTMLDivElement>(null)
  const shown = useRef(value ?? 1)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      if (cube.current) cube.current.style.transform = rest(value ?? 1)
      return
    }
    const v = value ?? 1
    const c = cube.current
    const h = hop.current
    if (!c || !h) return
    // Tumbling: whole turns on two axes (a different throw each time), ending on the value's face.
    const tx = 360 * (2 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1)
    const ty = 360 * (1 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1)
    const from = rest(shown.current)
    const to = rest(v)
    const mid = `rotateX(${FACES[v].x - 18 + tx * 0.75}deg) rotateY(${FACES[v].y + 22 + ty * 0.75}deg)`
    const dur = 900
    tableSfx.rattle(220)
    const spin = c.animate([{ transform: from }, { transform: mid, offset: 0.55 }, { transform: to }], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' })
    // Up, down, and three bounces lower each time.
    const lift = size * 1.3
    h.animate(
      [
        { transform: 'translateY(0) scale(1)', offset: 0 },
        { transform: `translateY(${-lift}px) scale(1.12)`, offset: 0.22, easing: 'ease-in' },
        { transform: 'translateY(0) scale(1)', offset: 0.44, easing: 'ease-out' },
        { transform: `translateY(${-lift * 0.35}px)`, offset: 0.6, easing: 'ease-in' },
        { transform: 'translateY(0)', offset: 0.74, easing: 'ease-out' },
        { transform: `translateY(${-lift * 0.1}px)`, offset: 0.84, easing: 'ease-in' },
        { transform: 'translateY(0)', offset: 0.92 },
        { transform: 'translateY(0)', offset: 1 },
      ],
      { duration: dur },
    )
    const knocks = [0.44, 0.74, 0.92].map((at, k) => window.setTimeout(() => tableSfx.bounce(1 - k * 0.35), at * dur))
    spin.onfinish = () => {
      shown.current = v
      onLanded?.()
    }
    return () => (knocks.forEach(clearTimeout), spin.cancel())
  }, [roll]) // eslint-disable-line react-hooks/exhaustive-deps
  const half = size / 2
  const r = Math.max(3, size * 0.12)
  return (
    <div className="relative" style={{ width: size, height: size, perspective: size * 8 }}>
      {/* Its shadow on the table, under it */}
      <div className="absolute inset-x-[8%] -bottom-[14%] h-[22%] rounded-full bg-black/30 blur-[3px]" />
      <div ref={hop} className="absolute inset-0 [transform-style:preserve-3d]">
        <div ref={cube} className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: rest(value ?? 1) }}>
          {/* The body inside, square-edged, filling the rounded faces' seams */}
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <div key={`in${f}`} className="absolute inset-[4%]" style={{ transform: `${FACES[f].place} translateZ(${half * 0.9}px)`, background: '#d9d2c0' }} />
          ))}
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <div key={f} className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-[14%] [backface-visibility:hidden]" style={{ transform: `${FACES[f].place} translateZ(${half}px)`, background: color, borderRadius: r, boxShadow: `inset 0 0 0 ${Math.max(1, size / 24)}px rgba(0,0,0,0.12), inset 0 -${size / 10}px ${size / 6}px rgba(0,0,0,0.12)` }}>
              {Array.from({ length: 9 }, (_, k) => (
                <span key={k} className="m-auto block" style={{ width: size * 0.15, height: size * 0.15, borderRadius: size * 0.03, background: PIPS[f].includes(k) ? (f === 1 ? '#d81b3f' : pip) : 'transparent', boxShadow: PIPS[f].includes(k) ? 'inset 0 1.5px 0 rgba(255,255,255,0.25)' : undefined }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
