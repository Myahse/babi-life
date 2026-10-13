import { useEffect, useRef, useState } from 'react'
import { Check, Pipette, RotateCcw } from 'lucide-react'

// A colour picker for one part of the Sim: quick presets, plus a full
// saturation/brightness square and hue bar for any colour. A picked swatch
// flashes with a flood of light.

type HSV = { h: number; s: number; v: number }

export function hexToHsv(hex: string): HSV {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: ((h * 60) + 360) % 360, s: max ? d / max : 0, v: max }
}

export function hsvToHex({ h, s, v }: HSV) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

const HEX = /^#[0-9a-f]{6}$/i

type Props = {
  label: string
  value: string // '' = the outfit's own colour
  presets: string[]
  onChange: (hex: string) => void
  /** Offer going back to the outfit's own colour, shown with this colour. */
  auto?: string
  big?: boolean
}

export function ColorPicker({ label, value, presets, onChange, auto, big }: Props) {
  const [open, setOpen] = useState(false)
  const shown = value || auto || presets[0]
  const custom = !!value && !presets.includes(value)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        {auto !== undefined && (
          <Swatch color={auto} on={!value} big={big} label={`${label} : d'origine`} onClick={() => onChange('')}>
            <RotateCcw size={14} strokeWidth={3} className="text-white drop-shadow" />
          </Swatch>
        )}
        {presets.map((c) => (
          <Swatch key={c} color={c} on={value === c || (!value && auto === undefined && c === shown)} big={big} label={c} onClick={() => onChange(c)} />
        ))}
        <button
          type="button"
          aria-label={`${label} : couleur libre`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`grid place-items-center rounded-full transition ${big ? 'h-12 w-12' : 'h-10 w-10'} ${open || custom ? 'scale-110 ring-4 ring-[var(--color-orange)] ring-offset-2' : 'ring-1 ring-black/10'}`}
          style={{ background: custom ? value : 'conic-gradient(from 0deg, #ff3d57, #ffa000, #ffe14d, #00c26e, #2a9df4, #7b5cff, #ff3dd2, #ff3d57)' }}
        >
          <Pipette size={16} strokeWidth={2.6} className="text-white drop-shadow" />
        </button>
      </div>
      {open && (
        <div className="motion-pop relative mt-3 overflow-hidden rounded-[22px] border border-[var(--color-line)] bg-white p-3 shadow-[0_10px_30px_-12px_rgba(15,18,48,0.35)]">
          <Panel value={shown} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

function Swatch({ color, on, big, label, onClick, children }: { color: string; on: boolean; big?: boolean; label: string; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`relative grid place-items-center rounded-full transition duration-300 ease-[var(--ease-spring)] ${big ? 'h-12 w-12' : 'h-10 w-10'} ${on ? 'scale-110 ring-4 ring-[var(--color-orange)] ring-offset-2' : 'ring-1 ring-black/10 hover:scale-105'}`}
      style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 45%), ${color}` }}
    >
      {on && <span key={color} className="motion-flood" style={{ background: 'white' }} />}
      {children ?? (on && <Check size={big ? 18 : 15} strokeWidth={3.4} className="motion-pop text-white drop-shadow" />)}
    </button>
  )
}

/** Saturation/brightness square, hue bar and a hex field. */
function Panel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const [text, setText] = useState(value)
  const last = useRef(value)
  // Follow outside changes (a preset tapped) without fighting the drag.
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setHsv(hexToHsv(value))
      setText(value)
    }
  }, [value])

  const commit = (next: HSV) => {
    setHsv(next)
    const hex = hsvToHex(next)
    last.current = hex
    setText(hex)
    onChange(hex)
  }

  const drag = (el: HTMLElement, e: React.PointerEvent, at: (x: number, y: number) => void) => {
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const r = el.getBoundingClientRect()
      at(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)))
    }
    move(e)
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  return (
    <div className="relative space-y-3">
      <div
        className="relative h-36 cursor-crosshair touch-none rounded-2xl"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
        onPointerDown={(e) => drag(e.currentTarget, e, (x, y) => commit({ ...hsv, s: x, v: 1 - y }))}
        role="slider"
        aria-label="Saturation et luminosité"
        aria-valuenow={Math.round(hsv.s * 100)}
      >
        <span
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-[width,height] duration-200"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }}
        />
      </div>
      <div
        className="relative h-5 cursor-pointer touch-none rounded-full"
        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        onPointerDown={(e) => drag(e.currentTarget, e, (x) => commit({ ...hsv, h: x * 360 }))}
        role="slider"
        aria-label="Teinte"
        aria-valuenow={Math.round(hsv.h)}
      >
        <span className="pointer-events-none absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-black/10" style={{ background: hsvToHex(hsv) }} />
        <input
          className="input !h-10 font-mono uppercase"
          value={text}
          maxLength={7}
          aria-label="Code couleur"
          onChange={(e) => {
            const t = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            setText(t)
            if (HEX.test(t)) commit(hexToHsv(t.toLowerCase()))
          }}
        />
      </div>
    </div>
  )
}
