import { Building2, House } from 'lucide-react'
import type { Sim, World } from '../../lib/types'
import { SimAvatar } from '../SimAvatar'
import { Plumbob, needColor } from '../ui'
import { iconFor, kindColors } from '../icons'
import { mood } from '../../game/rules'

export type Focus = { cityId?: string; communeId?: string }

export type PinData = {
  id: string
  lat: number
  lng: number
  label: string
  variant: 'city' | 'commune' | 'place' | 'sim'
  /** Place kind (for colour and icon). */
  kind?: string
  icon?: string
  home?: boolean
  active?: boolean
  hasSim?: boolean
  /** Extra stem length (px) so labels that would collide stack upwards; set by declutter(). */
  lift?: number
  /** Which way the label sits relative to its stem; set by declutter(). */
  align?: 'center' | 'start' | 'end'
  onClick?: () => void
}

export type Bounds = [west: number, south: number, east: number, north: number]
export type Padding = { top: number; bottom: number; left: number; right: number }

export const CIV_BOUNDS: Bounds = [-8.7, 4.3, -2.4, 10.8]

export type MapHandlers = {
  onCity: (cityId: string) => void
  onCommune: (cityId: string, communeId: string) => void
  onPlace: (placeId: string) => void
}

// Home is not a real place in the world data: it sits next to the centre of
// the Sim's home commune.
export const homePosition = (lat: number, lng: number) => ({ lat: lat - 0.004, lng: lng - 0.012 })

export function pinsFor(world: World, focus: Focus, sim: Sim | null, selectedPlace: string | null, h: MapHandlers): PinData[] {
  const city = world.cities.find((c) => c.id === focus.cityId)
  const commune = city?.communes.find((c) => c.id === focus.communeId)
  const pins: PinData[] = []

  if (!city) {
    for (const c of world.cities) {
      pins.push({ id: c.id, lat: c.lat, lng: c.lng, label: c.name, variant: 'city', home: c.id === sim?.homeCity, hasSim: c.id === sim?.city, onClick: () => h.onCity(c.id) })
    }
  } else if (!commune) {
    for (const cm of city.communes) {
      const here = city.id === sim?.city && cm.id === sim?.commune
      pins.push({
        id: cm.id, lat: cm.lat, lng: cm.lng, label: cm.name, variant: 'commune',
        home: city.id === sim?.homeCity && cm.id === sim?.homeCommune, hasSim: here,
        onClick: () => h.onCommune(city.id, cm.id),
      })
    }
  } else {
    for (const p of commune.places) {
      pins.push({ id: p.id, lat: p.lat, lng: p.lng, label: p.name, kind: p.kind, icon: world.kinds[p.kind]?.icon, variant: 'place', active: selectedPlace === p.id, onClick: () => h.onPlace(p.id) })
    }
    if (sim && sim.homeCity === city.id && sim.homeCommune === commune.id) {
      pins.push({ id: 'home', ...homePosition(commune.lat, commune.lng), label: 'Chez toi', kind: 'home', icon: 'house', variant: 'place', active: selectedPlace === 'home', onClick: () => h.onPlace('home') })
    }
    if (sim && city.id === sim.city && commune.id === sim.commune) {
      pins.push({ id: 'sim', lat: commune.lat + 0.0015, lng: commune.lng - 0.002, label: sim.firstName, variant: 'sim' })
    }
  }
  return pins
}

type Box = { l: number; r: number; t: number; b: number }
type Layout = { lift?: number; align?: PinData['align'] }

// Screen-space footprint of a pin, relative to its anchor point.
function footprint(p: PinData, x: number, y: number, { lift = 0, align = 'center' }: Layout): Box {
  const w = (p.variant === 'commune' ? 26 : 30) + p.label.length * (p.variant === 'commune' ? 6.4 : 6.8)
  const t = y - lift
  switch (p.variant) {
    case 'city':
    case 'commune': {
      const l = align === 'start' ? x - 14 : align === 'end' ? x + 14 - w : x - w / 2
      return { l, r: l + w, t: t - 40, b: t }
    }
    case 'place':
      return align === 'end' ? { l: x - 28 - w, r: x + 26, t: t - 58, b: t } : { l: x - 26, r: x + 28 + w, t: t - 58, b: t }
    default:
      return { l: x - 32, r: x + 32, t: t - 84, b: t }
  }
}

const ALIGNS: Record<PinData['variant'], NonNullable<PinData['align']>[]> = {
  city: ['center', 'start', 'end'],
  commune: ['center', 'start', 'end'],
  place: ['start', 'end'],
  sim: ['center'],
}

/**
 * Label de-collision in screen space, placing pins from the bottom of the
 * screen up. Each pin tries its label centred, then to the right, then to the
 * left, and only then climbs on a longer stem, staying below `top` (the HUD).
 * Returns overrides per pin id.
 */
export function declutter(pins: PinData[], project: (lng: number, lat: number) => [number, number], width: number, top = 0): Record<string, Layout> {
  const items = pins.map((p) => ({ p, xy: project(p.lng, p.lat) })).sort((a, b) => b.xy[1] - a.xy[1])
  // The Sim never moves out of the way; everyone else avoids it.
  const placed: Box[] = items.filter((i) => i.p.variant === 'sim').map((i) => footprint(i.p, i.xy[0], i.xy[1], {}))
  const inside = (b: Box) => b.l > 4 && b.r < width - 4 && b.t > top
  const clear = (b: Box) => inside(b) && !placed.some((q) => b.l < q.r && b.r > q.l && b.t < q.b && b.b > q.t)
  const out: Record<string, Layout> = {}
  for (const { p, xy } of items) {
    if (p.variant === 'sim') continue
    let best: Layout | null = null
    for (let lift = 0; lift <= 98 && !best; lift += 14) {
      for (const align of ALIGNS[p.variant]) {
        if (clear(footprint(p, xy[0], xy[1], { lift, align }))) {
          best = { lift, align }
          break
        }
      }
    }
    // Nothing fits: stay at the anchor, with the label at least on screen.
    best ??= { lift: 0, align: ALIGNS[p.variant].find((align) => inside(footprint(p, xy[0], xy[1], { align }))) ?? ALIGNS[p.variant][0] }
    placed.push(footprint(p, xy[0], xy[1], best))
    if (best.lift || best.align !== 'center') out[p.id] = best
  }
  return out
}

export function boundsFor(world: World, focus: Focus): Bounds {
  const city = world.cities.find((c) => c.id === focus.cityId)
  if (!city) return CIV_BOUNDS
  const commune = city.communes.find((c) => c.id === focus.communeId)
  const pts = commune ? [commune, homePosition(commune.lat, commune.lng), ...commune.places] : city.communes.flatMap((c) => [c, ...c.places])
  const lats = pts.map((p) => p.lat)
  const lngs = pts.map((p) => p.lng)
  const pad = commune ? 0.008 : 0.02
  return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad]
}

function Face({ sim, size }: { sim: Sim; size: number }) {
  return (
    <span className="block overflow-hidden rounded-full bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]" style={{ width: size, height: size }}>
      <SimAvatar look={sim.look} gender={sim.gender} crop="head" size={size} animated={false} />
    </span>
  )
}

/** Pins are anchored at their bottom-centre (the point on the map). */
export function Pin({ pin, sim }: { pin: PinData; sim: Sim | null }) {
  const moodHex = sim ? needColor(mood(sim.needs)) : '#00b86b'

  if (pin.variant === 'sim' && sim) {
    return (
      <div className="pointer-events-none relative flex flex-col items-center">
        <Plumbob size={14} color={moodHex} />
        <span className="relative z-10 rounded-full bg-white p-[3px] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)]">
          <span className="block overflow-hidden rounded-full bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]" style={{ width: 54, height: 54 }}>
            <SimAvatar look={sim.look} gender={sim.gender} crop="bust" size={54} />
          </span>
        </span>
        <span className="absolute bottom-[-6px] left-1/2 h-4 w-16 rounded-[50%] border-2 border-white/80" style={{ animation: 'ripple 1.8s ease-out infinite' }} />
      </div>
    )
  }

  const lift = pin.lift ?? 0
  const stem = (color: string, base: number) => (
    <>
      <span className="w-[3px] rounded-b shadow-[0_1px_2px_rgba(0,0,0,0.3)]" style={{ height: base + lift, background: color }} />
      <span className="h-2.5 w-2.5 rounded-full border-2 border-white shadow" style={{ background: color }} />
    </>
  )

  if (pin.variant === 'city' || pin.variant === 'commune') {
    const city = pin.variant === 'city'
    const big = pin.id === 'abidjan'
    const color = pin.home ? '#ff7a00' : city ? '#ff7a00' : '#00b86b'
    const dot = big ? 26 : city ? 22 : 18
    return (
      <button type="button" onClick={pin.onClick} className="group flex flex-col items-center">
        {pin.hasSim && sim && <Plumbob size={12} color={moodHex} className="mb-0.5" />}
        <span
          className={`flex items-center gap-1.5 rounded-full py-1 pr-3.5 pl-1 font-display ${pin.align === 'start' ? 'translate-x-[calc(50%-14px)]' : pin.align === 'end' ? '-translate-x-[calc(50%-14px)]' : ''} font-extrabold whitespace-nowrap shadow-[0_8px_18px_-6px_rgba(0,0,0,0.45)] transition group-hover:scale-105 ${city ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-[var(--color-ink)]'}`}
          style={{ fontSize: big ? 15 : city ? 13 : 12.5 }}
        >
          {pin.hasSim && sim ? (
            <span className="rounded-full ring-2 ring-white">
              <Face sim={sim} size={dot} />
            </span>
          ) : (
            <span className="grid place-items-center rounded-full" style={{ width: dot, height: dot, background: `linear-gradient(160deg, ${pin.home || city ? '#ffa040' : '#69e2a0'}, ${color})` }}>
              {pin.home ? <House size={dot * 0.5} color="#fff" strokeWidth={2.8} /> : city ? <Building2 size={dot * 0.5} color="#fff" strokeWidth={2.6} /> : <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
          )}
          {pin.label}
        </span>
        {stem(city ? 'var(--color-ink)' : '#fff', 8)}
      </button>
    )
  }

  // Place: a teardrop in the colour of its kind, label beside it.
  const [from, to] = kindColors(pin.kind ?? '')
  const Icon = iconFor(pin.icon ?? '')
  return (
    <button type="button" onClick={pin.onClick} className="group flex flex-col items-center">
      <span className="relative">
        <span
          className="relative grid h-12 w-12 place-items-center rounded-[50%_50%_50%_6px] border-[3px] border-white shadow-[0_8px_16px_-6px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-110"
          style={{ background: `linear-gradient(160deg, ${from}, ${to})`, transform: `rotate(-45deg)${pin.active ? ' scale(1.2)' : ''}` }}
        >
          <span style={{ transform: 'rotate(45deg)' }} className="text-white">
            <Icon size={22} strokeWidth={2.5} />
          </span>
        </span>
        <span className={`absolute top-3 ${pin.align === 'end' ? 'right-[calc(100%+6px)]' : 'left-[calc(100%+6px)]'} rounded-full bg-white/95 px-2.5 py-1 text-[12px] leading-none font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow`}>{pin.label}</span>
      </span>
      {lift ? stem(to, -4) : <span className="h-2.5" />}
    </button>
  )
}
