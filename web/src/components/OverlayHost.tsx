import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BadgeCheck, Dice5, Sparkles, TriangleAlert } from 'lucide-react'
import { dismissToast, useCard, useOverlays, useShown, type Toast } from '../lib/overlays'
import { amount } from '../game/rules'
import { Helper } from './Helper'
import { iconFor, kindColors } from './icons'
import { Coin, IconTile } from './ui'
import { t as tr } from '../lib/i18n'
import { OfflineBanner } from './InstallButton'
import { useOnline } from '../lib/pwa'

// Draws lib/overlays.ts over the game: the card of the moment (an invitation, the door…, brought here by
// <LaneCard>), the toast under it, and the pops over the scene. Their place is found from the HUD as it is on
// screen (default or « écran simple », upright or sideways, a small phone): the band under the top bar where
// nothing of the HUD is (the mini-map, the compass, the buttons, the next goal), else the next free band lower
// down, never over the needs, the bar at the bottom, the pad or the phone. On a phone the upper half can be full
// (the mini-map and the next goal on the left, the compass on the right): the toast then takes the steady card's
// place (data-yield: the next goal, « À faire maintenant »), which steps aside while it's there.

type Box = { l: number; t: number; r: number; b: number; yields?: boolean }
type Spot = { x: number; y: number; w: number }

const GUTTER = 12
// (A stable ref: the store told only when the place itself changes.)
const cardSlot = (el: HTMLElement | null) => void (useOverlays.getState().cardEl !== el && useOverlays.setState({ cardEl: el }))
const steadySlot = (el: HTMLElement | null) => void (useOverlays.getState().steadyEl !== el && useOverlays.setState({ steadyEl: el }))
// What the HUD is: its pills (.hud), its buttons and cards (.btn, .card), the tour's targets, and what says it is (data-hud).
const HUD = '[data-hud], .hud, .btn, .card, [data-tour]'

/** The HUD's boxes on screen, relative to the root (not the 3D's floating names and bubbles, not the sheets, not the host itself). */
function hudBoxes(root: HTMLElement, host: HTMLElement): Box[] {
  const o = root.getBoundingClientRect()
  const scenes = [...root.querySelectorAll('canvas')].map((c) => c.parentElement).filter((p): p is HTMLElement => !!p)
  const out: Box[] = []
  for (const el of root.querySelectorAll<HTMLElement>(HUD)) {
    if (host.contains(el) || el.closest('.sheet, [data-overlay-skip]') || scenes.some((s) => s.contains(el))) continue
    const r = el.getBoundingClientRect()
    // (A big box that isn't the HUD's own is a sheet or a scene: not in the way.)
    if (r.width < 4 || r.height < 4 || (!el.hasAttribute('data-hud') && r.width * r.height > o.width * o.height * 0.4)) continue
    if (r.bottom <= o.top || r.top >= o.bottom || r.right <= o.left || r.left >= o.right) continue
    out.push({ l: r.left - o.left, t: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top, yields: !!el.closest('[data-yield]') })
  }
  return out
}

/**
 * The first band from y0 down to y1 where a box of height h and at least minW wide fits between the HUD's boxes:
 * its place, as wide as it may be up to maxW, centred on the screen when it can be (or on the left of the band).
 */
export function freeSpot(boxes: Box[], vw: number, h: number, minW: number, maxW: number, y0: number, y1: number, left = false): Spot | null {
  const gap = 6
  for (let y = Math.max(0, y0); y + h <= y1; y += 6) {
    const band = boxes.filter((b) => b.t < y + h + gap && b.b > y - gap).sort((a, b) => a.l - b.l)
    let x = GUTTER
    let best: { l: number; r: number } | null = null
    for (const b of [...band, { l: vw - GUTTER, r: vw, t: 0, b: 0 }]) {
      const r = Math.min(b.l - gap, vw - GUTTER)
      if (r - x >= minW && (!best || r - x > best.r - best.l)) best = { l: x, r }
      x = Math.max(x, b.r + gap)
    }
    if (best) {
      const w = Math.min(maxW, best.r - best.l)
      const centred = Math.min(Math.max((vw - w) / 2, best.l), best.r - w)
      return { x: left ? best.l : centred, y, w }
    }
  }
  return null
}

/** The host: in screens/Play's root. Two layers: the steady card with the HUD (z 20, under the sheets), the card of the
 * moment, the toast and the pops over it (z 55; under a darkened card toasts and pops wait, and the phone holds them). */
export function OverlayHost() {
  const host = useRef<HTMLDivElement>(null)
  const lane = useRef<HTMLDivElement>(null)
  const popEl = useRef<HTMLDivElement>(null)
  const steadyEl = useRef<HTMLDivElement>(null)
  const { toast, pop } = useShown()
  const card = useOverlays((s) => s.holder && !s.wants[s.holder]?.dim)
  const yielded = useOverlays((s) => s.yielded)
  const [spot, setSpot] = useState<Spot | null>(null)
  const [popSpot, setPopSpot] = useState<Spot | null>(null)
  const [steady, setSteady] = useState<(Spot & { h?: number }) | null>(null)
  // The steady card's height in full, last seen (back to full once that fits again).
  const fullH = useRef(0)
  // No network: its line in the same place (it used to lie over the top bar, the money and the hour).
  const offline = !useOnline()
  const busy = !!toast || !!card || offline
  // The places, measured when what shows changes, the screen turns, and now and then (the HUD moves: a sheet, the goal).
  useLayoutEffect(() => {
    const measure = () => {
      const root = host.current?.parentElement
      if (!root || !host.current) return
      const vw = root.clientWidth
      const vh = root.clientHeight
      const boxes = hudBoxes(root, host.current)
      const top = parseFloat(getComputedStyle(host.current).getPropertyValue('--sat')) || 0
      const st = useOverlays.getState()
      // The steady card (the next goal, « À faire maintenant »): the first free band from the top, on the left like
      // the rest of the HUD's left side; no room in full (a small phone, sideways), its short form.
      const sh = steadyEl.current?.scrollHeight ?? 0
      let sBox: Box | null = null
      if (sh > 0) {
        const sw = Math.min(300, vw - GUTTER * 2)
        if (!st.steadyShort) fullH.current = sh
        const place = (h: number) => {
          const f = freeSpot(boxes, vw, h, sw, sw, top + 8, vh * 0.8, true)
          return f && { ...f, w: sw }
        }
        let at: (Spot & { h?: number }) | null = st.steadyShort && fullH.current ? place(fullH.current) : place(sh)
        if (st.steadyShort && at) useOverlays.setState({ steadyShort: false })
        else if (!at && !st.steadyShort) useOverlays.setState({ steadyShort: true })
        at ??= st.steadyShort ? place(sh) : null
        // Not even the short form: the tallest free band, the card scrolling in it (never over a button).
        for (let h = Math.floor(sh / 12) * 12; !at && h >= 48; h -= 12) {
          const f = place(h)
          if (f) at = { ...f, h }
        }
        const s = at ?? { x: GUTTER, y: Math.round(vh * 0.3), w: sw, h: 0 }
        sBox = { l: s.x, t: s.y, r: s.x + s.w, b: s.y + (s.h ?? sh), yields: true }
        setSteady((o) => (o && Math.abs(o.y - s.y) < 10 && Math.abs(o.x - s.x) < 10 && o.h === s.h ? o : s))
      }
      if (!busy && !pop) {
        if (st.yielded) useOverlays.setState({ yielded: false })
        return
      }
      const all = sBox ? [...boxes, sBox] : boxes
      // The toast and the card of the moment: under the top bar, down to the middle of the screen at most (the Sim stands lower).
      const h = lane.current?.offsetHeight || 64
      const minW = Math.min(280, vw - GUTTER * 2)
      const fixed = all.filter((b) => !b.yields)
      const s = freeSpot(all, vw, h, minW, 400, top + 8, vh * 0.62) ?? freeSpot(fixed, vw, h, minW, 400, top + 8, vh * 0.62) ?? { x: (vw - Math.min(400, vw - 24)) / 2, y: Math.round(vh * 0.36), w: Math.min(400, vw - 24) }
      // Over a steady card: it steps aside meanwhile.
      const over = busy && all.some((b) => b.yields && b.l < s.x + s.w && b.r > s.x && b.t < s.y + h && b.b > s.y)
      if (st.yielded !== over) useOverlays.setState({ yielded: over })
      setSpot((o) => (o && Math.abs(o.y - s.y) < 10 && Math.abs(o.x - s.x) < 10 && Math.abs(o.w - s.w) < 10 ? o : s))
      if (pop) {
        const ph = popEl.current?.offsetHeight || 70
        const taken = busy ? [...all, { l: s.x, t: s.y, r: s.x + s.w, b: s.y + h }] : all
        const p = freeSpot(taken, vw, ph, Math.min(220, vw - 24), 360, Math.max(vh * 0.26, busy ? s.y + h + 8 : 0), vh * 0.7) ?? { x: (vw - Math.min(360, vw - 24)) / 2, y: Math.round(vh * 0.3), w: Math.min(360, vw - 24) }
        setPopSpot((o) => (o && Math.abs(o.y - p.y) < 10 && Math.abs(o.x - p.x) < 10 ? o : p))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (lane.current) ro.observe(lane.current)
    if (steadyEl.current) ro.observe(steadyEl.current)
    const every = setInterval(measure, 1200)
    window.addEventListener('resize', measure)
    return () => (ro.disconnect(), clearInterval(every), window.removeEventListener('resize', measure))
  }, [busy, toast?.id, pop?.id, card]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    // (No z-index of its own: its two layers stand among the HUD's.)
    <div ref={host} data-overlay-host className="pointer-events-none absolute inset-0">
      <div ref={steadyEl} className={`absolute z-20 flex flex-col items-start gap-1.5 transition-[top,left] duration-300 ease-out ${yielded ? 'invisible' : ''}`} style={steady ? { left: steady.x, top: steady.y, width: steady.w, ...(steady.h !== undefined ? { maxHeight: steady.h, overflowY: 'auto', pointerEvents: 'auto', visibility: steady.h ? undefined : 'hidden' } : {}) } : { left: GUTTER, top: '40%', width: 300, visibility: 'hidden' }}>
        <div ref={steadySlot} className="contents" />
      </div>
      <div className="absolute inset-0 z-[55]">
        <div ref={lane} className="absolute flex flex-col gap-2 transition-[top,left,width] duration-300 ease-out" style={spot ? { left: spot.x, top: spot.y, width: spot.w } : { left: GUTTER, right: GUTTER, top: '5.5rem', visibility: busy ? 'hidden' : undefined }}>
          {offline && <OfflineBanner inGame />}
          <div ref={cardSlot} className="contents" />
          {toast && <ToastCard key={toast.id} toast={toast} onDone={() => dismissToast(toast.id)} />}
        </div>
        {pop && (
          <div ref={popEl} key={pop.id} className="absolute flex justify-center" style={popSpot ? { left: popSpot.x, top: popSpot.y, width: popSpot.w } : { left: GUTTER, right: GUTTER, top: '30%' }}>
            {pop.node}
          </div>
        )}
      </div>
    </div>
  )
}

/** The steady card (the next goal, « À faire maintenant », the quartier's bar): one place, found by the host in the HUD's free space. */
export function Steady({ children }: { children: ReactNode }) {
  const el = useOverlays((s) => s.steadyEl)
  return el ? createPortal(children, el) : null
}

/** A card over the game shown only in its turn (lib/overlays' queue); `lane`: drawn in the host's place (an invitation), not dim. */
export function CardGate({ id, prio, on, dim = true, lane, first, children }: { id: string; prio: number; on: boolean; dim?: boolean; lane?: boolean; first?: boolean; children: ReactNode }) {
  const mine = useCard(id, prio, on, dim && !lane, first)
  if (!mine) return null
  return lane ? <LaneCard>{children}</LaneCard> : children
}

/** A card brought into the host's place (one at a time: its owner holds lib/overlays' useCard, not dim). */
export function LaneCard({ children }: { children: ReactNode }) {
  const el = useOverlays((s) => s.cardEl)
  return el ? createPortal(children, el) : null
}

function ToastCard({ toast: t, onDone }: { toast: Toast; onDone: () => void }) {
  const icon = t.tone === 'random' ? Dice5 : t.tone === 'promo' ? BadgeCheck : t.tone === 'error' ? TriangleAlert : t.icon ? iconFor(t.icon) : Sparkles
  const colors: [string, string] =
    t.tone === 'random' || t.tone === 'event' ? ['#ffd54f', '#ffa000'] : t.tone === 'promo' ? ['#69e2a0', '#00a862'] : t.tone === 'error' ? ['#ff8a9b', '#ff3d57'] : kindColors(t.kind ?? '')
  return (
    // A tap: what it tells of (if anything), and it goes (the next one comes).
    <div
      role="button"
      onClick={() => (t.onTap?.(), onDone())}
      className={`toast-card card motion-toast pointer-events-auto flex cursor-pointer items-center gap-2.5 p-2.5 active:scale-[0.98] ${t.tone === 'random' || t.tone === 'event' ? 'ring-2 ring-[var(--color-gold)]' : t.tone === 'promo' ? 'ring-2 ring-[var(--color-emerald)]' : ''}`}
    >
      {/* Something that didn't go through: Koffi comes to say it, kindly */}
      {t.tone === 'error' ? <Helper size={38} offline={t.title === tr('Hors ligne')} /> : <IconTile icon={icon} colors={colors} size={38} />}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[14.5px] leading-tight font-extrabold">{t.title}</div>
        {t.text && <div className="line-clamp-2 text-[12.5px] leading-snug font-semibold text-[var(--color-ink-soft)]">{t.text}</div>}
      </div>
      {t.money !== 0 && <MoneyDelta value={t.money} />}
    </div>
  )
}

export function MoneyDelta({ value }: { value: number }) {
  return (
    <span className={`flex shrink-0 items-center gap-1 font-display text-base font-extrabold ${value > 0 ? 'text-[var(--color-emerald-deep)]' : 'text-[#d81b3f]'}`}>
      {value > 0 ? '+' : '−'}
      {amount(Math.abs(value))}
      <Coin size={16} />
    </span>
  )
}
