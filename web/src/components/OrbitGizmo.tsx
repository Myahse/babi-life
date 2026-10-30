import { useEffect, useRef, useState } from 'react'
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
}: {
  /** Current view, read every frame. Heading is clockwise from north; polar is 0 overhead. */
  read: () => Pose
  onYaw: (radians: number) => void
  onPitch: (radians: number) => void
  onNorth: () => void
  className?: string
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
      const ry = Math.max(6, Math.cos(polar) * 30)
      ground.current?.setAttribute('ry', String(ry))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [read])

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
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={key}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" aria-hidden>
        <circle cx={CX} cy={CX} r={48} fill="none" stroke="#161a2b" strokeOpacity={0.08} strokeWidth={8} />
        <ellipse ref={ground} cx={CX} cy={CX} rx={30} ry={18} fill="#ff7a00" fillOpacity={0.1} stroke="#ff7a00" strokeWidth={2} />
        <g ref={rose}>
          <circle ref={north} cx={CX} cy={CX - RIM} r={13} fill="transparent" />
          {(
            [
              ['N', CX, CX - RIM + 5, '#ff7a00', 16],
              ['E', CX + RIM, CX + 4, '#5b6178', 12],
              ['S', CX, CX + RIM + 4, '#5b6178', 12],
              ['O', CX - RIM, CX + 4, '#5b6178', 12],
            ] as const
          ).map(([letter, x, y, fill, size]) => (
            <g key={letter} data-up="" data-x={x} data-y={y}>
              <text x={x} y={y} textAnchor="middle" fill={fill} fontFamily={letter === 'N' ? 'Baloo 2, system-ui' : 'Nunito, system-ui'} fontSize={size} fontWeight="800">
                {letter}
              </text>
            </g>
          ))}
        </g>
        {/* Fixed: the way the camera looks, while the rose turns under it. */}
        <path d={`M${CX} 7 L${CX + 5} 15 L${CX - 5} 15 Z`} fill="#ff7a00" />
      </svg>
    </div>
  )
}
