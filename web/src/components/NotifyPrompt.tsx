import { useEffect, useState } from 'react'
import { Bell, BellOff, X } from 'lucide-react'
import { SETTINGS_HELP, askLater, enablePush, pushState, shouldAsk, type PushState } from '../lib/push'

// Asking for notifications: once in the game (a card, after a few seconds:
// « Active les notifications »), and a little banner in Gbairai and the
// betting apps while they're off. Refused: how to turn them on in the
// phone's settings.

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
    try {
      setState(await enablePush())
    } catch {
      setState('off')
    }
  }
  return { state, enable }
}

/** The card in the game, asked once (then a week after « Plus tard »). */
export function NotifyPrompt() {
  const { state, enable } = usePush()
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (state !== 'off' || !shouldAsk()) return
    const t = setTimeout(() => setShow(true), 6000)
    return () => clearTimeout(t)
  }, [state])
  if (!show || state === 'on' || state === 'unsupported') return null
  return (
    <div className="absolute inset-x-0 top-[18%] z-30 flex justify-center px-4">
      <div className="sheet w-full max-w-[380px] rounded-[24px] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-orange)] text-white">
            <Bell size={22} strokeWidth={2.6} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight font-extrabold">Active les notifications</p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-ink-soft)]">
              {state === 'denied' ? SETTINGS_HELP : 'On te prévient quand un ami t’écrit sur Gbairai, et quand les matchs de ton pari sont finis.'}
            </p>
          </div>
          <button className="text-[var(--color-ink-soft)]" aria-label="Fermer" onClick={() => (askLater(), setShow(false))}>
            <X size={18} />
          </button>
        </div>
        {state !== 'denied' && (
          <div className="mt-3 flex gap-2">
            <button className="btn flex-1 !py-2.5" onClick={() => void enable().then(() => setShow(false))}>
              <Bell size={16} /> Activer
            </button>
            <button className="flex-1 rounded-2xl bg-[var(--color-canvas)] py-2.5 text-sm font-extrabold" onClick={() => (askLater(), setShow(false))}>
              Plus tard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The banner in an app (Gbairai, the betting apps) while notifications are off. */
export function NotifyBanner({ what, dark }: { what: string; dark?: boolean }) {
  const { state, enable } = usePush()
  if (state !== 'off' && state !== 'denied') return null
  return (
    <div className={`mb-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold ${dark ? 'bg-[#17291f] text-white' : 'bg-[#fff4e8] text-[var(--color-ink)]'}`}>
      <BellOff size={16} className="shrink-0 text-[var(--color-orange)]" />
      <span className="min-w-0 flex-1">{state === 'denied' ? SETTINGS_HELP : `Active les notifications pour savoir ${what}.`}</span>
      {state === 'off' && (
        <button className="shrink-0 rounded-full bg-[var(--color-orange)] px-3 py-1 font-extrabold text-white" onClick={() => void enable()}>
          Activer
        </button>
      )}
    </div>
  )
}
