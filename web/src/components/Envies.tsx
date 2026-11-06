import { useEffect, useState, useSyncExternalStore } from 'react'
import { Check, RefreshCw, Star } from 'lucide-react'
import { iconFor } from './icons'
import { IconTile } from './ui'
import { api } from '../lib/api'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { duration } from '../game/rules'
import { openPanel } from '../game/vie'
import type { ActionResult, Perk, Sim, Wish } from '../lib/types'
import { t as tr } from '../lib/i18n'

// Le mode vie's wishes (« envies », the update « mode-vie », backend sims/envies.go): up to three small
// wants the server picks for the Sim, as cards by the mood button; tapped, the panel says what each
// brings and how long it lasts, lets one be changed for another (a few a day), and holds the rewards
// shop where the points de bonheur buy perks for good. A wish fulfilled bursts in the middle of the
// screen (its points, blocks flying out, a sound), the Sim cheering. Nothing per frame.

const WISH: [string, string] = ['#ffd54f', '#ff9800']
const PERK: [string, string] = ['#b39dff', '#6d4aff']

/** The points' colour, the game's orange-gold. */
const GOLD = '#ff9800'

/**
 * The cards, in one small bar just over the mood button: the points, then each wish's tile (a tap on any
 * opens the panel, where each is said in full). Kept low and narrow: clear of the house's floor buttons
 * and the top bar on a phone held upright.
 */
export function WishCards({ sim }: { sim: Sim }) {
  const wishes = sim.life?.wishes ?? []
  const points = sim.life?.points ?? 0
  return (
    <button className="hud pointer-events-auto flex h-10 items-center gap-1 rounded-full py-1 pr-1 pl-2 active:scale-95" onClick={() => (haptic('light'), openPanel('envies'))} aria-label={tr('Envies et récompenses')}>
      <Star size={14} strokeWidth={3} style={{ color: GOLD }} fill={GOLD} />
      <span className="tnum pr-0.5 text-[12px] font-extrabold">{points}</span>
      {wishes.map((w) => (
        <span key={w.goal} className="animate-pop short:hidden" title={w.label}>
          <IconTile icon={iconFor(w.icon)} colors={WISH} size={32} radius={16} />
        </span>
      ))}
    </button>
  )
}

/** The panel: the wishes (what each brings, time left, « Changer »), the points, the rewards shop. */
export function WishPanel({ sim, onResult }: { sim: Sim; onResult: (res: ActionResult) => void }) {
  const life = sim.life ?? {}
  const wishes = life.wishes ?? []
  const [perks, setPerks] = useState<Perk[] | null>(null)
  const [swaps, setSwaps] = useState(3)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let on = true
    api
      .perks()
      .then((r) => on && (setPerks(r.perks), setSwaps(r.swaps)))
      .catch(() => on && setPerks([]))
    return () => void (on = false)
  }, [])
  const owned = life.perks ?? []
  const left = Math.max(0, swaps + (owned.includes('envie-plus') ? 2 : 0) - (life.swaps ?? 0))
  const run = async (key: string, f: () => Promise<ActionResult>) => {
    setBusy(key)
    setErr('')
    try {
      const res = await f()
      onResult(res)
      return true
    } catch (e) {
      haptic('error')
      setErr(e instanceof Error ? e.message : tr('Pas possible pour le moment.'))
      return false
    } finally {
      setBusy(null)
    }
  }
  const change = async (w: Wish) => {
    haptic('light')
    if (await run(w.goal, () => api.dismissWish(sim.id, w.goal))) sfx.pop()
  }
  const buy = async (p: Perk) => {
    haptic('medium')
    if (await run(p.id, () => api.buyPerk(sim.id, p.id))) (sfx.win(), haptic('success'))
  }
  return (
    <>
      <div className="flex items-center gap-2.5 rounded-2xl p-2" style={{ background: `${GOLD}22` }}>
        <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: GOLD }}>
          <Star size={20} strokeWidth={2.8} fill="#fff" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="tnum block font-display text-base font-extrabold">{tr('{0} points de bonheur', { 0: life.points ?? 0 })}</span>
          <span className="block text-[11.5px] font-bold text-[var(--color-ink-soft)]">{tr('Réalise ses envies pour en gagner')}</span>
        </span>
      </div>
      {wishes.length === 0 && <p className="p-2 text-center text-[13px] font-bold text-[var(--color-ink-soft)]">{tr('De nouvelles envies arrivent bientôt.')}</p>}
      {wishes.map((w) => (
        <div key={w.goal} className="tile flex items-center gap-2.5 p-2">
          <IconTile icon={iconFor(w.icon)} colors={WISH} size={36} radius={12} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[14px] font-extrabold">{w.label}</span>
            <span className="block text-[11.5px] font-bold text-[var(--color-ink-soft)]">
              {tr('+{0} points', { 0: w.points })} · {tr('Encore {0}', { 0: duration(Math.max(1, w.until - sim.gameMinutes)) })}
            </span>
          </span>
          <button className="grid h-9 shrink-0 place-items-center rounded-full bg-black/5 px-2.5 text-[11.5px] font-extrabold active:scale-90 disabled:opacity-40" disabled={!!busy || left <= 0} onClick={() => void change(w)} aria-label={tr('Changer : {0}', { 0: w.label })}>
            <span className="flex items-center gap-1">
              <RefreshCw size={13} strokeWidth={3} className={busy === w.goal ? 'animate-spin' : ''} /> {tr('Changer')}
            </span>
          </button>
        </div>
      ))}
      <p className="px-1 text-[11px] font-bold text-[var(--color-ink-soft)]">{left > 0 ? tr('Encore {0} envie(s) à changer aujourd’hui', { 0: left }) : tr('Plus d’envie à changer aujourd’hui')}</p>
      {err && <p className="rounded-xl bg-[#e03a3a]/10 p-2 text-[12px] font-extrabold text-[#c02020]">{err}</p>}
      <h3 className="px-1 pt-1 font-display text-[15px] font-extrabold">{tr('Récompenses')}</h3>
      {!perks && <p className="p-2 text-center text-[13px] font-bold text-[var(--color-ink-soft)]">{tr('Un instant…')}</p>}
      {perks?.map((p) => {
        const have = owned.includes(p.id)
        const can = !have && (life.points ?? 0) >= p.cost
        return (
          <div key={p.id} className={`tile flex items-center gap-2.5 p-2 ${have ? 'opacity-80' : ''}`}>
            <IconTile icon={iconFor(p.icon)} colors={PERK} size={36} radius={12} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[14px] font-extrabold">{p.label}</span>
              <span className="block text-[11.5px] font-bold text-[var(--color-ink-soft)]">{p.hint}</span>
            </span>
            {have ? (
              <span className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#1f9d55]/12 px-2.5 text-[11.5px] font-extrabold text-[#1f7a45]">
                <Check size={14} strokeWidth={3} /> {tr('À toi')}
              </span>
            ) : (
              <button className="flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-extrabold text-white active:scale-90 disabled:opacity-45" style={{ background: can ? GOLD : '#9aa0b4' }} disabled={!can || !!busy} onClick={() => void buy(p)} aria-label={tr('Acheter : {0}', { 0: p.label })}>
                <Star size={12} strokeWidth={3} fill="#fff" />
                <span className="tnum">{p.cost}</span>
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}

/** A wish fulfilled: shown big a moment (wishBurst), its points, the blocks flying out. */
type Burst = { key: number; label: string; points: number }
let bursts: Burst[] = []
const subs = new Set<() => void>()
const tell = () => subs.forEach((f) => f())
let burstKey = 1
export function wishBurst(label: string, points: number) {
  const b = { key: burstKey++, label, points }
  bursts = [...bursts.slice(-1), b]
  tell()
  setTimeout(() => ((bursts = bursts.filter((x) => x.key !== b.key)), tell()), 2600)
}

/** The blocks that fly out of it (the game's colours, little cubes, each its own way). */
const BLOCKS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.2
  const r = 90 + (i % 3) * 34
  return { x: Math.cos(a) * r, y: Math.sin(a) * r - 30, c: ['#ffd54f', '#ff9800', '#7ee0a1', '#8fd3ff', '#ff8fb1', '#b39dff'][i % 6], s: 9 + (i % 3) * 4, d: (i % 4) * 30 }
})

export function WishBursts() {
  const list = useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => bursts,
  )
  if (!list.length) return null
  const b = list[list.length - 1]
  return (
    <div key={b.key} className="pointer-events-none absolute inset-x-0 top-[30%] z-[46] flex justify-center">
      <div className="relative">
        {BLOCKS.map((k, i) => (
          <span key={i} className="animate-wish-block absolute top-1/2 left-1/2 rounded-[3px]" style={{ width: k.s, height: k.s, background: k.c, boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.22), inset 2px 2px 0 rgba(255,255,255,0.35)', ['--x' as string]: `${k.x}px`, ['--y' as string]: `${k.y}px`, animationDelay: `${120 + k.d}ms` }} />
        ))}
        <div className="animate-wish flex items-center gap-2.5 rounded-3xl bg-white px-3.5 py-2.5 shadow-xl ring-4 ring-[#ffd54f]">
          <IconTile icon={Star} colors={WISH} size={40} radius={14} />
          <span className="leading-tight">
            <span className="block text-[11px] font-extrabold tracking-wide text-[#c06a00] uppercase">{tr('Envie réalisée !')}</span>
            <span className="block max-w-[200px] truncate font-display text-[16px] font-extrabold">{b.label}</span>
            <span className="tnum block text-[13px] font-extrabold" style={{ color: GOLD }}>
              {tr('+{0} points de bonheur', { 0: b.points })}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** The label and points of a wish line from the server (« Envie réalisée : X. +N points de bonheur »). */
export function parseWish(text: string): { label: string; points: number } {
  const m = /:\s*(.+?)\.\s*\+(\d+)/.exec(text)
  return m ? { label: m[1], points: Number(m[2]) } : { label: text, points: 0 }
}
