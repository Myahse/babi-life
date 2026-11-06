import { useState } from 'react'
import { Gamepad2, Sparkles, X } from 'lucide-react'
import { iconFor } from './icons'
import { IconTile } from './ui'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { cancel, enqueue, openPie, setAlwaysPlay, setFreeWill, useLife, type LifeOrder, type PieOption } from '../game/lifeMode'
import { t as tr } from '../lib/i18n'

// Le mode vie's controls (the update « mode-vie », game/lifeMode.ts): the orders queued at the top of the
// screen (the one under way with its progress round it; a tap takes one off), free will's switch and the
// games' setting beside them, and the wheel that opens where an object or someone was tapped.

/** The queue, at the top: `progress` the order under way's share done (0..1), `onCancel` when it's the one being done (to stop it). */
export function LifeQueue({ progress, onCancelCurrent, onPlay, doing }: { progress: number; onCancelCurrent: () => void; /** The action under way has a game: played now, for a better result. */ onPlay?: () => void; /** An action under way not from the queue (begun elsewhere, before): shown first all the same, a tap stops it. */ doing?: { label: string; icon: string; colors: [string, string] } }) {
  const { queue, started, freeWill, alwaysPlay } = useLife()
  const [menu, setMenu] = useState(false)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(8.25rem,calc(var(--sat,env(safe-area-inset-top))+7.75rem))] z-30 flex flex-col items-center gap-1.5 px-3 lg:top-[7.5rem]">
      <div className="hud pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full p-1.5">
        <button aria-label={tr('Réglages du mode vie')} className={`grid h-11 shrink-0 place-items-center rounded-full px-2.5 text-[11px] leading-none font-extrabold transition-transform active:scale-90 ${freeWill ? 'bg-[var(--color-orange)] text-white' : 'bg-black/10 text-[var(--color-ink-soft)]'}`} onClick={() => setMenu((m) => !m)}>
          <Sparkles size={16} strokeWidth={2.6} />
          <span className="mt-0.5">{freeWill ? tr('Libre') : tr('Ordres')}</span>
        </button>
        {doing && !started && <QueueIcon order={{ key: 0, kind: 'act', id: 'doing', ...doing }} current first progress={progress} onTap={() => (haptic('light'), onCancelCurrent())} />}
        {queue.length === 0 && !doing && <span className="px-2 text-[12px] font-extrabold text-[var(--color-ink-soft)]">{freeWill ? tr('Il vit sa vie… touche un objet') : tr('Touche un objet pour donner un ordre')}</span>}
        {queue.map((o, i) => (
          <QueueIcon key={o.key} order={o} current={o.key === started} first={i === 0} progress={o.key === started ? progress : 0} onTap={() => (haptic('light'), cancel(o.key) && onCancelCurrent())} />
        ))}
      </div>
      {onPlay && (
        <button className="animate-pop pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#2563eb] px-3 py-2 text-[12px] font-extrabold text-white shadow-lg ring-2 ring-white active:scale-95" onClick={() => (haptic('medium'), onPlay())}>
          <Gamepad2 size={15} strokeWidth={2.6} /> {tr('Jouer pour un meilleur résultat')}
        </button>
      )}
      {menu && (
        <div className="card animate-pop pointer-events-auto w-[min(320px,calc(100vw-24px))] space-y-1 p-2 text-[13px] font-extrabold">
          <Toggle on={freeWill} label={tr('Libre arbitre')} hint={tr('Sans ordre, ton perso choisit tout seul selon ses besoins')} onChange={setFreeWill} />
          <Toggle on={alwaysPlay} label={tr('Toujours jouer les mini-jeux')} hint={tr("Sinon l'action se fait toute seule (résultat normal), le mini-jeu peut faire mieux")} onChange={setAlwaysPlay} />
          <button className="w-full rounded-xl py-1.5 text-xs text-[var(--color-ink-soft)]" onClick={() => setMenu(false)}>
            {tr('Fermer')}
          </button>
        </div>
      )}
    </div>
  )
}

function Toggle({ on, label, hint, onChange }: { on: boolean; label: string; hint: string; onChange: (on: boolean) => void }) {
  return (
    <button className="tile flex w-full items-center gap-2.5 p-2 text-left" onClick={() => (haptic('light'), onChange(!on))}>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block">{label}</span>
        <span className="block text-[11px] font-bold text-[var(--color-ink-soft)]">{hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--color-orange)]' : 'bg-black/20'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150 ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

const RING = 2 * Math.PI * 21

function QueueIcon({ order, current, first, progress, onTap }: { order: LifeOrder; current: boolean; first: boolean; progress: number; onTap: () => void }) {
  return (
    <button aria-label={tr('Annuler : {0}', { 0: order.label })} className={`animate-pop relative grid h-11 w-11 shrink-0 place-items-center transition-transform active:scale-90 ${first ? '' : 'opacity-80'}`} onClick={onTap}>
      <IconTile icon={iconFor(order.icon)} colors={order.colors} size={first ? 38 : 34} radius={19} style={{ boxShadow: order.free ? '0 0 0 2px #ffffff, 0 0 0 4px rgba(255,255,255,0.35)' : '0 0 0 2px #ffffff' }} />
      {current && (
        // The order under way: its share done round it.
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="21" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2.5" />
          <circle cx="22" cy="22" r="21" fill="none" stroke="var(--color-orange)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - Math.min(1, Math.max(0, progress)))} style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
        </svg>
      )}
      {order.play && <span className="absolute -bottom-0.5 -left-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#2563eb] text-white"><Gamepad2 size={10} strokeWidth={3} /></span>}
      <span className="absolute -top-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white">
        <X size={10} strokeWidth={3.2} />
      </span>
    </button>
  )
}

/** The wheel: round the spot tapped, what can be done there; a tap queues it (the pad on it: its game played). */
export function PieMenu() {
  const { pie, alwaysPlay } = useLife()
  if (!pie) return null
  const n = pie.options.length
  // Round the spot, as wide as there are choices; kept whole on the screen.
  const r = n <= 1 ? 0 : n <= 4 ? 86 : n <= 6 ? 100 : 118
  const [vw, vh] = [window.innerWidth, window.innerHeight]
  const pad = r + 58
  const cx = Math.min(vw - pad, Math.max(pad, pie.x))
  // (Under the queue's bar at the top, over the place's bar at the bottom.)
  const cy = Math.min(vh - pad - 90, Math.max(pad + 150, pie.y))
  const pick = (o: PieOption, play: boolean) => {
    if (o.why) {
      haptic('error')
      return
    }
    haptic('medium')
    sfx.pop()
    if (o.run) return void (openPie(null), o.run())
    enqueue({ ...o.order, play: play || (alwaysPlay && !!o.game) })
  }
  return (
    <div key={`${pie.x},${pie.y},${pie.title}`} className="absolute inset-0 z-[45]" onPointerDown={(e) => e.target === e.currentTarget && openPie(null)}>
      <div className="pointer-events-none absolute" style={{ left: cx, top: cy }}>
        <div className="animate-fade absolute -translate-x-1/2 -translate-y-1/2">
          <button className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-black/70 text-white shadow-lg active:scale-90" aria-label={tr('Fermer')} onClick={() => openPie(null)}>
            <X size={20} strokeWidth={3} />
          </button>
        </div>
        <div className="absolute -translate-x-1/2 whitespace-nowrap" style={{ top: n <= 1 ? -96 : -r - 100 }}>
          <span className="animate-fade rounded-full bg-black/70 px-3 py-1 text-[12px] font-extrabold text-white">{pie.title}</span>
        </div>
        {pie.options.map((o, i) => {
          // From the top, clockwise.
          const a = n <= 1 ? 0 : -Math.PI / 2 + (i / n) * Math.PI * 2
          const [x, y] = n <= 1 ? [0, -70] : [Math.cos(a) * r, Math.sin(a) * r]
          return (
            <div key={o.id} className="animate-pie absolute" style={{ left: 0, top: 0, ['--x' as string]: `${x}px`, ['--y' as string]: `${y}px`, animationDelay: `${i * 18}ms` }}>
              <div className="-translate-x-1/2 -translate-y-1/2">
                <button className={`pointer-events-auto flex w-[92px] flex-col items-center active:scale-90 ${o.why ? 'opacity-55' : ''}`} onClick={() => pick(o, false)} aria-label={o.label}>
                  <IconTile icon={iconFor(o.icon)} colors={o.colors} size={56} radius={28} style={{ boxShadow: '0 0 0 3px #ffffff, 0 8px 16px -6px rgba(0,0,0,0.6)' }} />
                  <span className="mt-1 line-clamp-2 rounded-xl bg-black/70 px-2 py-0.5 text-center text-[11px] leading-tight font-extrabold text-white">{o.label}</span>
                  {(o.why || o.note) && <span className="mt-0.5 max-w-[92px] truncate rounded-full bg-white/85 px-1.5 text-[9.5px] font-bold text-[var(--color-ink)]">{o.why ?? o.note}</span>}
                </button>
                {o.game && !o.why && (
                  // Its game, played for a better result than left to play by itself.
                  <button className="pointer-events-auto absolute -top-2 right-1 grid h-8 w-8 place-items-center rounded-full bg-[#2563eb] text-white shadow-lg ring-2 ring-white active:scale-90" aria-label={tr('Jouer pour un meilleur résultat')} title={tr('Jouer pour un meilleur résultat')} onClick={() => pick(o, true)}>
                    <Gamepad2 size={16} strokeWidth={2.6} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {pie.options.some((o) => o.game && !o.why) && (
          <div className="absolute -translate-x-1/2 whitespace-nowrap" style={{ top: r + 74 }}>
            <span className="animate-fade flex items-center gap-1 rounded-full bg-[#2563eb] px-2.5 py-1 text-[11px] font-extrabold text-white">
              <Gamepad2 size={13} strokeWidth={2.8} /> {tr('Jouer pour un meilleur résultat')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
