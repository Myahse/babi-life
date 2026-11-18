import { Building2, Home } from 'lucide-react'
import { IconTile } from '../ui'
import { t as tr } from '../../lib/i18n'
import type { QuartierMode } from './useQuartier'

// Where to go when the game opens (update « mon-quartier »): one's own quartier, or the world of Babi where
// everyone is. Asked once a visit to the game (sessionStorage: a reload in the same tab doesn't ask again), the
// place one was last offered first; « Aller à Babi » and « Rentrer au quartier » still go from one to the other
// any time. A card of the game's one queue (lib/overlays, CARD.monde): after the arrival and the tutorial.

const ASKED = 'babi.monde.choisi'

/** Already chosen in this visit to the game. */
export function mondeChosen() {
  try {
    return sessionStorage.getItem(ASKED) === '1'
  } catch {
    return true
  }
}

function markChosen() {
  try {
    sessionStorage.setItem(ASKED, '1')
  } catch {
    // (No storage: asked again next time, nothing more.)
  }
}

export function ChoixMonde({ name, last, onPick }: { name: string; /** Where the player was last: offered first. */ last: QuartierMode; onPick: (w: 'quartier' | 'babi') => void }) {
  const pick = (w: 'quartier' | 'babi') => (markChosen(), onPick(w))
  const babiFirst = last === 'babi'
  const quartier = (
    <button key="quartier" className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-transform active:scale-[0.98] ${!babiFirst ? 'border-[#1c7a4a] bg-[#e9f9ef]' : 'border-[var(--color-line)] bg-white'}`} onClick={() => pick('quartier')} data-monde="quartier">
      <IconTile icon={Home} colors={['#4fbf85', '#1c7a4a']} size={46} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block font-display text-[17px] font-extrabold">{tr('Mon quartier')}</span>
        <span className="mt-0.5 block text-[12px] leading-snug font-semibold text-[var(--color-ink-soft)]">{tr('Ta maison, tes terrains, tes bâtiments : construis, aménage, reçois tes amis.')}</span>
      </span>
    </button>
  )
  const babi = (
    <button key="babi" className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-transform active:scale-[0.98] ${babiFirst ? 'border-[#e8731f] bg-[#fff1df]' : 'border-[var(--color-line)] bg-white'}`} onClick={() => pick('babi')} data-monde="babi">
      <IconTile icon={Building2} colors={['#ffb066', '#e8731f']} size={46} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block font-display text-[17px] font-extrabold">{tr('Le monde de Babi')}</span>
        <span className="mt-0.5 block text-[12px] leading-snug font-semibold text-[var(--color-ink-soft)]">{tr('Abidjan et tout le monde : les rues, le travail, les maquis, les autres joueurs en ligne.')}</span>
      </span>
    </button>
  )
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-[#0f1230]/55 p-3 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] backdrop-blur-[3px] sm:items-center" data-choix-monde>
      <div className="card animate-pop pointer-events-auto w-full max-w-[420px] p-4">
        <div className="label">{tr('Bienvenue')}</div>
        <div className="font-display text-[22px] leading-tight font-extrabold">{tr('Où va {0} aujourd’hui ?', { 0: name })}</div>
        <div className="mt-1 text-[12px] font-semibold text-[var(--color-ink-soft)]">{tr('Tu passes de l’un à l’autre quand tu veux.')}</div>
        <div className="mt-3 space-y-2">{babiFirst ? [babi, quartier] : [quartier, babi]}</div>
      </div>
    </div>
  )
}
