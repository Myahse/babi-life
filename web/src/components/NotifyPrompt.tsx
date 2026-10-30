import { useEffect, useState } from 'react'
import { Bell, BellOff, X } from 'lucide-react'
import { askLater, enablePush, pushHelp, pushState, shouldAsk, syncPush, type PushState } from '../lib/push'
import { t as tr } from '../lib/i18n'

// Asking for notifications: once in the game (a card, after a few seconds:
// « Active les notifications »), and a little banner in Gbairai, the betting
// apps and the profile while they're off. Refused, or blocked by the browser
// (Brave, an iPhone without the home screen): how to turn them on (pushHelp).

function usePush() {
  const [state, setState] = useState<PushState | null>(null)
  useEffect(() => {
    let alive = true
    void pushState().then((s) => alive && setState(s), () => alive && setState('unsupported'))
    return () => {
      alive = false
    }
  }, [])
  const enable = async () => {
    let s: PushState = 'off'
    try {
      s = await enablePush()
    } catch {
      /* no network: stays off */
    }
    setState(s)
    return s
  }
  return { state, enable }
}

// What the card and the banner can offer: a button while it can still come on here.
const canTry = (s: PushState | null) => s === 'off' || s === 'blocked'

/** The card in the game, asked once (then a week after « Plus tard »). */
export function NotifyPrompt() {
  const { state, enable } = usePush()
  const [show, setShow] = useState(false)
  // Allowed already: this phone's subscription given to the server again (it may have forgotten it).
  useEffect(() => {
    if (state === 'on') void syncPush()
  }, [state])
  useEffect(() => {
    if ((state !== 'off' && state !== 'install' && state !== 'blocked') || !shouldAsk()) return
    const t = setTimeout(() => setShow(true), 6000)
    return () => clearTimeout(t)
  }, [state])
  if (!show || state === 'on' || state === 'unsupported') return null
  const help = pushHelp(state)
  return (
    // On its own over the dimmed game (above the toasts and the « Entrer » button), so nothing lands on it.
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f1230]/45 px-4">
      <div className="sheet w-full max-w-[380px] rounded-[24px] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-orange)] text-white">
            <Bell size={22} strokeWidth={2.6} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight font-extrabold">{tr('Active les notifications')}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-ink-soft)]">
              {help || tr('On te prévient quand un ami t’écrit sur Gbairai, t’invite ou veut être ton ami, quand les matchs de ton pari sont finis et quand il y a du nouveau à Babi.')}
            </p>
          </div>
          <button className="text-[var(--color-ink-soft)]" aria-label={tr('Fermer')} onClick={() => (askLater(), setShow(false))}>
            <X size={18} />
          </button>
        </div>
        {canTry(state) && (
          <div className="mt-3 flex gap-2">
            {/* Closed only once they're on: refused or blocked, the card says why and how. */}
            <button className="btn flex-1 !py-2.5" onClick={() => void enable().then((s) => s === 'on' && setShow(false))}>
              <Bell size={16} /> {state === 'blocked' ? tr('Réessayer') : tr('Activer')}
            </button>
            <button className="flex-1 rounded-2xl bg-[var(--color-canvas)] py-2.5 text-sm font-extrabold" onClick={() => (askLater(), setShow(false))}>
              {tr('Plus tard')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The banner in an app (Gbairai, the betting apps, the profile) while notifications are off. */
export function NotifyBanner({ what, dark }: { what: string; dark?: boolean }) {
  const { state, enable } = usePush()
  if (state === null || state === 'on') return null
  const help = pushHelp(state)
  return (
    <div className={`mb-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold ${dark ? 'bg-[#17291f] text-white' : 'bg-[#fff4e8] text-[var(--color-ink)]'}`}>
      <BellOff size={16} className="shrink-0 text-[var(--color-orange)]" />
      <span className="min-w-0 flex-1">{help || tr('Active les notifications pour savoir {what}.', { what })}</span>
      {canTry(state) && (
        <button className="shrink-0 rounded-full bg-[var(--color-orange)] px-3 py-1 font-extrabold text-white" onClick={() => void enable()}>
          {state === 'blocked' ? tr('Réessayer') : tr('Activer')}
        </button>
      )}
    </div>
  )
}
