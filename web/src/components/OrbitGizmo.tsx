import { useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '../lib/i18n'

// Drag the dial to orbit: sideways turns, up and down tilts. The letters
// spin with the camera, and the orange mark at the top is where you look.
// A tap on N looks north again.

const SIZE = 112
const CX = SIZE / 2
const RIM = 40

export type Pose = { heading: number; polar: number }

export function OrbitGizmo({
  read,
  onYaw,
  onPitch,
  onNorth,
  className = '',
  size = SIZE,
  mini = false,
}: {
  /** Current view, read every frame. Heading is clockwise from north; polar is 0 overhead. */
  read: () => Pose
  onYaw: (radians: number) => void
  onPitch: (radians: number) => void
  onNorth: () => void
  className?: string
  /** Width and height on screen, in pixels (the drawing scales). */
  size?: number
  /** Drawn small (a phone): no outer ring, bigger letters, so they still read at 48 px. */
  mini?: boolean
}) {
  const rose = useRef<SVGGElement>(null)
  const ground = useRef<SVGEllipseElement>(null)
  const north = useRef<SVGCircleElement>(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef({ x: 0, y: 0, moved: 0 })

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const { heading, polar } = read()
      const deg = (heading * 180) / Math.PI
      rose.current?.setAttribute('transform', `rotate(${-deg} ${CX} ${CX})`)
      // The rose turns, the letters stay upright.
      rose.current?.querySelectorAll<SVGGElement>('[data-up]').forEach((el) => {
        el.setAttribute('transform', `rotate(${deg} ${el.dataset.x} ${el.dataset.y})`)
      })
      // Overhead is a circle; toward the horizon the ground squeezes into a line.
      const ry = Math.max(6, Math.cos(polar) * (mini ? 22 : 30))
      ground.current?.setAttribute('ry', String(ry))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [read, mini])

  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 }
    setDragging(true)
  }
  function move(e: React.PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current.x = e.clientX
    drag.current.y = e.clientY
    drag.current.moved += Math.hypot(dx, dy)
    if (dx) onYaw(dx * 0.015)
    if (dy) onPitch(dy * 0.008)
  }
  function up(e: React.PointerEvent) {
    if (drag.current.moved < 8 && north.current) {
      const b = north.current.getBoundingClientRect()
      const hit = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)) < 22
      if (hit) onNorth()
    }
    setDragging(false)
  }

  function key(e: React.KeyboardEvent) {
    const turn = (yaw = 0, pitch = 0) => {
      e.preventDefault()
      e.stopPropagation()
      if (yaw) onYaw(yaw)
      if (pitch) onPitch(pitch)
    }
    if (e.key === 'ArrowLeft') turn(-0.28)
    else if (e.key === 'ArrowRight') turn(0.28)
    else if (e.key === 'ArrowUp') turn(0, -0.12)
    else if (e.key === 'ArrowDown') turn(0, 0.12)
    else if (e.key === 'Home') {
      e.preventDefault()
      e.stopPropagation()
      onNorth()
    }
  }

  return (
    <div
      role="slider"
      aria-label={t('Orbite')}
      aria-valuetext={t('Glisse pour tourner et incliner. Touche N pour le nord.')}
      tabIndex={0}
      className={`hud touch-none rounded-full select-none outline-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
      style={{ width: size, height: size }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={key}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" aria-hidden>
        {!mini && <circle cx={CX} cy={CX} r={48} fill="none" stroke="#161a2b" strokeOpacity={0.08} strokeWidth={8} />}
        <ellipse ref={ground} cx={CX} cy={CX} rx={mini ? 22 : 30} ry={18} fill="#ff7a00" fillOpacity={0.1} stroke="#ff7a00" strokeWidth={mini ? 3 : 2} />
        <g ref={rose}>
          <circle ref={north} cx={CX} cy={CX - RIM} r={13} fill="transparent" />
          {(
            [
              // The cardinal points' first letters, in the player's language (O for Ouest, W for West).
              ['n', t('Nord').charAt(0), CX, CX - RIM + (mini ? 9 : 5), '#ff7a00', mini ? 30 : 16],
              ['e', t('Est').charAt(0), CX + RIM, CX + (mini ? 8 : 4), '#5b6178', mini ? 24 : 12],
              ['s', t('Sud').charAt(0), CX, CX + RIM + (mini ? 8 : 4), '#5b6178', mini ? 24 : 12],
              ['o', t('Ouest').charAt(0), CX - RIM, CX + (mini ? 8 : 4), '#5b6178', mini ? 24 : 12],
            ] as const
          ).map(([id, letter, x, y, fill, size]) => (
            <g key={id} data-up="" data-x={x} data-y={y}>
              <text x={x} y={y} textAnchor="middle" fill={fill} fontFamily={id === 'n' ? 'Baloo 2, system-ui' : 'Nunito, system-ui'} fontSize={size} fontWeight="800">
                {letter}
              </text>
            </g>
          ))}
        </g>
        {/* Fixed: the way the camera looks, while the rose turns under it. */}
        {!mini && <path d={`M${CX} 7 L${CX + 5} 15 L${CX - 5} 15 Z`} fill="#ff7a00" />}
      </svg>
    </div>
  )
}

/**
 * On a phone, the compass folded into the camera's round button: while the street is being turned (a drag on
 * the view, or on the compass itself) and for a moment after, the small compass shows in the button's place
 * (drag it to turn, tap N for north), then fades back to the button. The street stays clear the rest of the time.
 */
export function CompassButton({ read, onYaw, onPitch, onNorth, children }: { read: () => Pose; onYaw: (radians: number) => void; onPitch: (radians: number) => void; onNorth: () => void; /** The camera's button. */ children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    let raf = 0
    let until = 0
    let shown = false
    let held = false
    let { heading, polar } = read()
    // Only a finger (or the mouse) on the view or on the compass turns it on: the camera swinging behind
    // the walking Sim on its own doesn't.
    const down = (e: PointerEvent) => {
      const el = e.target as Element | null
      if (el?.tagName === 'CANVAS' || wrap.current?.contains(el)) held = true
    }
    const up = () => {
      held = false
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const p = read()
      const now = performance.now()
      if (held && (Math.abs(p.heading - heading) > 0.003 || Math.abs(p.polar - polar) > 0.003)) until = now + 2500
      heading = p.heading
      polar = p.polar
      const want = now < until
      if (want !== shown) {
        shown = want
        setOn(want)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
    }
  }, [read])
  return (
    <div ref={wrap} className="relative grid h-10 w-10 place-items-center">
      <div className={`transition duration-300 ${on ? 'pointer-events-none scale-75 opacity-0' : ''}`} inert={on}>
        {children}
      </div>
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition duration-300 ${on ? '' : 'pointer-events-none scale-75 opacity-0'}`} inert={!on}>
        <OrbitGizmo read={read} onYaw={onYaw} onPitch={onPitch} onNorth={onNorth} size={50} mini />
      </div>
    </div>
  )
}
