import { Component, type ReactNode } from 'react'
import { RotateCcw, House } from 'lucide-react'
import { SplashDancer } from './SplashDancer'

// When something in the game breaks (a screen that crashes, a part of the
// site that won't download): a perso scratching its head, a plain word, and
// the way back. Never the error itself: it goes to the console only.

export function ErrorScreen() {
  return (
    <div className="grid h-full min-h-[100dvh] w-full place-items-center bg-[#fff4e8] px-6 text-center text-[var(--color-ink)]" role="alert">
      <div className="flex max-w-sm flex-col items-center">
        <div className="error-perso">
          <SplashDancer size={84} />
        </div>
        <div className="mt-1 h-2.5 w-14 rounded-[50%] bg-black/15 blur-[2px]" aria-hidden />
        <h1 className="mt-5 font-display text-[30px] leading-tight font-extrabold">Oups, ça a calé !</h1>
        <p className="mt-2 text-[15px] font-bold text-[var(--color-ink-soft)]">Le jeu a eu un petit souci. Recharge la page : ton perso t'attend, rien n'est perdu.</p>
        <button className="btn mt-6 w-full" onClick={() => location.reload()}>
          <RotateCcw size={18} /> Recharger
        </button>
        <button className="mt-3 flex items-center gap-1.5 text-sm font-extrabold text-[var(--color-ink-soft)]" onClick={() => location.assign('/')}>
          <House size={16} /> Retour à l'accueil
        </button>
      </div>
    </div>
  )
}

/** Round the whole app: a screen that throws shows ErrorScreen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false }
  static getDerivedStateFromError() {
    return { broken: true }
  }
  componentDidCatch(error: unknown) {
    console.error('Babi Life:', error)
  }
  render() {
    return this.state.broken ? <ErrorScreen /> : this.props.children
  }
}
