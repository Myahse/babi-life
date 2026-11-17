import { useState } from 'react'
import { Truck } from 'lucide-react'
import type { QuartierMove } from '../../lib/types'
import { api, errorText } from '../../lib/api'
import { t as tr } from '../../lib/i18n'
import { SIM_CHANGED } from '../../lib/live'
import { toast } from '../../lib/overlays'
import { haptic } from '../../lib/native'
import { IconTile } from '../ui'

// « Mon quartier » (update « mon-quartier »): the Sim moved house (another commune, a house of its own across the
// commune) and its quartier stayed round the old home. This card offers to move it round the new one: every
// building goes onto the same lot there, with its level, its staff and the money waiting in it; the reputation and
// the level stay (backend sims/monquartier.go quartierMove). « Le laisser ici » keeps it where it is: the card
// isn't shown again for this home, « Gérer » still offers the move.

/** Where the quartier would go, in words: « à Yopougon », or how far across the same commune. */
export function moveWhere(m: QuartierMove): string {
  return m.distance > 0 ? tr('à {0} m de ton quartier', { 0: m.distance }) : m.communeName === 'Plateau' ? tr('au Plateau') : tr('à {0}', { 0: m.communeName })
}

/** Ask the server to move the quartier (or keep it), say what happened, read the quartier again. */
export async function answerMove(simId: string, follow: boolean): Promise<boolean> {
  try {
    const r = await api.quartierMove(simId, follow)
    haptic(follow ? 'success' : 'light')
    toast({ tone: 'done', title: follow ? tr('Ton quartier a déménagé') : tr('Ton quartier reste ici'), text: r.outcome.text, money: 0, icon: 'house', key: 'quartier-move' })
    window.dispatchEvent(new CustomEvent(SIM_CHANGED, { detail: simId }))
    return true
  } catch (e) {
    toast({ tone: 'error', title: tr('Pas possible'), text: errorText(e, tr('Erreur')), money: 0 })
    return false
  }
}

export function DemenageQuartier({ simId, move, name }: { simId: string; move: QuartierMove; name: string }) {
  const [busy, setBusy] = useState(false)
  const go = async (follow: boolean) => {
    setBusy(true)
    await answerMove(simId, follow)
    setBusy(false)
  }
  return (
    <div className="card animate-pop pointer-events-auto w-full p-3" data-quartier-move>
      <div className="flex items-start gap-3">
        <IconTile icon={Truck} colors={['#ffb066', '#e8731f']} size={42} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="label">{tr('Tu as déménagé')}</div>
          <div className="font-display text-[15px] font-extrabold">{tr('Déplacer {0} {1} ?', { 0: name, 1: moveWhere(move) })}</div>
          <div className="mt-1 text-[12px] leading-snug font-semibold text-[var(--color-ink-soft)]">{move.buildings > 0 ? tr('Tes {0} bâtiments suivent sur les mêmes terrains, avec leur niveau, leurs employés et leurs gains. Ta réputation reste.', { 0: move.buildings }) : tr('Ta réputation et ton niveau restent.')}</div>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button className="btn btn-soft !py-2 !text-sm" disabled={busy} onClick={() => void go(false)}>
          {tr('Le laisser ici')}
        </button>
        <button className="btn !bg-[#e8731f] !py-2 !text-sm" disabled={busy} onClick={() => void go(true)}>
          <Truck size={15} className="mr-1 inline" /> {tr('Déplacer')}
        </button>
      </div>
    </div>
  )
}
