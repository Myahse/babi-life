import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { t as tr } from '../../../lib/i18n'
import { haptic } from '../../../lib/native'
import { snd } from '../../defi/jeux/juice'

// What the six games of « espace-jeux » share (components/espace/commandes): the whole screen, the 3D behind,
// the card on top (the title, what to do, the gauges), the touch buttons at the bottom, and the end: the score,
// « Réessayer » when it didn't go (nothing sent: a retry), the score sent once (POST /sims/{id}/espace/jeu,
// backend sims/espaceJeux.go) and the server's line. PG: a game failed is « on recommence » or « retour au sas ».

/** The pass mark (backend game.SpaceGamePass): from here the game is « réussi ». */
export const PASS = 50

export type Gauge = { label: string; value: number; text: string; tone?: 'ok' | 'warn' | 'bad' | 'info' }

const TONE = { ok: '#40c057', warn: '#fab005', bad: '#ff6b6b', info: '#4dabf7' }

/** One gauge: its name, its bar (0–100), its value said. */
function GaugeRow({ g }: { g: Gauge }) {
  const c = TONE[g.tone ?? 'info']
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold">
      <span className="w-[5.2rem] shrink-0 truncate opacity-85">{g.label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
        <div className={`h-full rounded-full ${g.tone === 'bad' ? 'animate-pulse' : ''}`} style={{ width: `${Math.max(0, Math.min(100, g.value))}%`, background: c }} />
      </div>
      <span className="w-[4.6rem] shrink-0 text-right tabular-nums">{g.text}</span>
    </div>
  )
}

/** A big button held down (touch, mouse): `on(true)` pressed, `on(false)` let go. */
export function Hold({ on, children, tone = '#ffffff22', wide, label }: { on: (down: boolean) => void; children: ReactNode; tone?: string; wide?: boolean; /** Its name, for an icon alone. */ label?: string }) {
  const up = () => on(false)
  return (
    <button
      aria-label={label}
      className={`grid touch-none place-items-center rounded-2xl px-2 py-3.5 text-[13px] font-extrabold text-white select-none active:scale-95 active:brightness-125 ${wide ? 'flex-[2]' : 'flex-1'}`}
      style={{ background: tone }}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        on(true)
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}

/** A button tapped. */
export function Tap({ onTap, children, tone = '#ffffff22', disabled, wide, label }: { onTap: () => void; children: ReactNode; tone?: string; disabled?: boolean; wide?: boolean; label?: string }) {
  return (
    <button aria-label={label} disabled={disabled} className={`grid place-items-center rounded-2xl px-2 py-3.5 text-[13px] font-extrabold text-white select-none active:scale-95 disabled:opacity-40 ${wide ? 'flex-[2]' : 'flex-1'}`} style={{ background: tone }} onClick={onTap}>
      {children}
    </button>
  )
}

export type Ended = { score: number; line: string }

/**
 * The game's screen. `ended` set: the score shown (« Réessayer » under the pass: `onRetry`; the score sent once
 * with `send`, its answer shown). `children`: the 3D scene (inside the Canvas).
 */
export function Frame({ title, icon: Icon, hint, gauges, controls, children, ended, onRetry, send, onClose, back, cam, bg = '#02030a' }: {
  title: string
  icon: LucideIcon
  hint: ReactNode
  gauges: Gauge[]
  controls: ReactNode
  children: ReactNode
  ended: Ended | null
  onRetry: () => void
  /** The score sent (the server's line), once. */
  send: (score: number) => Promise<string>
  onClose: () => void
  /** The last button's word (« Retour au sas », « Fermer »…). */
  back?: string
  cam?: { position: [number, number, number]; fov?: number }
  bg?: string
}) {
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sent = useRef(false)
  const submit = (score: number) => {
    if (sent.current) return
    sent.current = true
    setBusy(true)
    send(score)
      .then((text) => setSaid(text))
      .catch((e) => setSaid(String((e as Error)?.message ?? e)))
      .finally(() => setBusy(false))
  }
  // Played well: sent at once (nothing to retry); else the player chooses.
  useEffect(() => {
    if (!ended) return
    if (ended.score >= PASS) {
      haptic('success')
      snd.fanfare(ended.score >= 85 ? 3 : 2)
      submit(ended.score)
    } else {
      haptic('light')
      snd.bad()
    }
  }, [ended]) // eslint-disable-line react-hooks/exhaustive-deps
  // Échap leaves (nothing sent).
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const ok = !!ended && ended.score >= PASS
  return (
    <div className="animate-up fixed inset-0 z-[70] select-none text-white" style={{ background: bg }}>
      <Canvas dpr={[1, 1.5]} camera={{ fov: cam?.fov ?? 55, near: 0.1, far: 2000, position: cam?.position ?? [0, 3, 10] }}>
        {children}
      </Canvas>
      <div className="pointer-events-none absolute inset-x-3 top-[max(0.75rem,var(--sat,env(safe-area-inset-top)))] flex items-start gap-2">
        <div className="pointer-events-auto flex flex-1 flex-col gap-1 rounded-2xl bg-black/65 p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Icon size={16} className="text-[#ff7a00]" /> {title}
          </div>
          {gauges.map((g) => (
            <GaugeRow key={g.label} g={g} />
          ))}
          <p className="text-[11.5px] leading-snug font-bold opacity-90">{hint}</p>
        </div>
        <button className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/65" aria-label={tr('Fermer')} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {!ended && <div className="absolute inset-x-2 bottom-[max(0.6rem,var(--sab,env(safe-area-inset-bottom)))] mx-auto flex max-w-[520px] flex-col gap-2 rounded-3xl bg-black/40 p-2 backdrop-blur-[2px]">{controls}</div>}
      {ended && (
        <div className="absolute inset-x-4 bottom-[max(1.2rem,var(--sab,env(safe-area-inset-bottom)))] mx-auto flex max-w-[440px] flex-col gap-2 rounded-2xl bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[19px] font-extrabold">{ok ? tr('Réussi !') : tr('Pas encore…')}</span>
            <span className="text-[22px] font-extrabold text-[#ff7a00] tabular-nums">{ended.score}/100</span>
          </div>
          <p className="text-[13px] leading-snug font-bold opacity-90">{said ?? ended.line}</p>
          {!said && !ok && (
            <div className="flex gap-2">
              <Tap tone="#ff7a00" onTap={onRetry} wide>
                {tr('Réessayer')}
              </Tap>
              <Tap disabled={busy} onTap={() => submit(ended.score)}>
                {tr('Garder ce score')}
              </Tap>
            </div>
          )}
          {(said || (ok && busy)) && (
            <Tap tone="#ff7a00" disabled={busy} onTap={onClose}>
              {back ?? tr('Fermer')}
            </Tap>
          )}
        </div>
      )}
    </div>
  )
}

/** The HUD's own clock: `fn` read ten times a second into state (the 3D's live values shown on the card). */
export function useTicker<T>(fn: () => T, ms = 100): T {
  const [v, setV] = useState(fn)
  const f = useRef(fn)
  f.current = fn
  useEffect(() => {
    const id = setInterval(() => setV(f.current()), ms)
    return () => clearInterval(id)
  }, [ms])
  return v
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
