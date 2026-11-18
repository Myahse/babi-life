import { useState } from 'react'
import { BookOpen, Drum, Smartphone, Sparkles, Volleyball, type LucideIcon } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ActionResult, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { fullLook } from '../avatar/options'
import { IconTile } from './ui'
import { amount } from '../game/rules'
import { haptic } from '../lib/native'
import { sfx } from '../lib/sfx'
import { t as tr, tx } from '../lib/i18n'

// The update « naitre-adulte » (backend sims/naitre.go), its two cards over the game, each once:
//  - « Babi Life change » for a Sim that was a baby, a child or a teenager and was made an adult on this load:
//    why, what it kept, and, if its baby never chose its toy, « Petit, tu étais… » (a trait);
//  - « Merci, Pionnier » for an account that had paid « grandir vite »: the badge, the pin, the Djai.

const TALENTS: { id: string; icon: LucideIcon; label: string; colors: [string, string] }[] = [
  { id: 'ballon', icon: Volleyball, label: tr('Sportif'), colors: ['#ffb74d', '#ff7a1a'] },
  { id: 'tamtam', icon: Drum, label: tr('Artiste'), colors: ['#ff7ad9', '#b02bd6'] },
  { id: 'livre', icon: BookOpen, label: tr('Travailleur'), colors: ['#64b5ff', '#2a6cf0'] },
  { id: 'telephone', icon: Smartphone, label: tr('Charmeur'), colors: ['#69e2a0', '#00a862'] },
]

/** Which card is due now, if any (the change first). */
export const naitreCardDue = (sim: Sim) => (sim.grownNotice === 'due' ? 'grown' : sim.pionnier && !sim.pionnier.seen ? 'pionnier' : null)

export function NaitreCard({ sim, onResult }: { sim: Sim; onResult: (res: ActionResult) => void }) {
  const due = naitreCardDue(sim)
  const [talent, setTalent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!due) return null
  const askTrait = due === 'grown' && !sim.talent
  // School marks (performance) and a friend from the crèche or school: what the childhood played left.
  const school = sim.performance > 0
  const hadFriend = !!sim.friends?.some((f) => f.childhood)

  async function done() {
    setBusy(true)
    setError(null)
    try {
      if (askTrait && talent) await api.naitreSeen(sim.id, 'trait', talent)
      const res = await api.naitreSeen(sim.id, due === 'grown' ? 'notice' : 'pionnier')
      haptic('success')
      sfx.win(due === 'pionnier')
      onResult(res)
    } catch (e) {
      setError(errorText(e, tr('Erreur')))
    } finally {
      setBusy(false)
    }
  }

  const pinned = due === 'pionnier' ? { ...fullLook(sim.look), accessory: 'pin-pionnier' } : sim.look
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#0f1230]/70 p-4 backdrop-blur-[4px]">
      <div className="card animate-pop w-full max-w-md overflow-hidden">
        <div className={`relative h-[200px] ${due === 'pionnier' ? 'bg-[radial-gradient(120%_100%_at_50%_0%,#ffe08a,#c9a227_55%,#6d4c00)]' : 'bg-[radial-gradient(120%_100%_at_50%_0%,#ffe7c7,#ff9a5a_55%,#c94a6a)]'}`}>
          <div className="absolute inset-x-0 bottom-0 mx-auto aspect-square h-full">
            <Portrait look={pinned} gender={sim.gender} framing="bust" />
          </div>
          <div className="absolute top-3 left-3 rounded-full bg-black/35 px-3 py-1 text-[11px] font-extrabold tracking-wider text-white uppercase backdrop-blur">{due === 'pionnier' ? tr('Pionnier') : tr('Babi Life change')}</div>
        </div>
        <div className="space-y-3 p-4">
          {due === 'grown' ? (
            <>
              <h2 className="font-display text-[24px] leading-tight font-extrabold">{tx('{name} a 18 ans !', { name: sim.firstName })}</h2>
              <p className="text-sm leading-snug font-bold text-[var(--color-ink-soft)]">{/* A baby made an adult had no school nor friend from childhood: those lines only for who had them. */}
                {school && hadFriend
                  ? tr('On ne joue plus l’enfance : tous les joueurs vivent maintenant leur vie d’adulte. Tu as quitté la maison avec l’argent de départ de ta famille, ton logement et ton mentor. Tes notes d’école ont donné tes diplômes (dans Papiers), et ton ami d’enfance est toujours là.')
                  : tr('On ne joue plus l’enfance : tous les joueurs vivent maintenant leur vie d’adulte. Tu as quitté la maison avec l’argent de départ de ta famille, ton logement et ton mentor.')}
                {school && !hadFriend && <> {tr('Tes notes d’école ont donné tes diplômes (dans Papiers).')}</>}
                {!school && hadFriend && <> {tr('Ton ami d’enfance est toujours là.')}</>}
              </p>
              <p className="text-sm leading-snug font-bold text-[var(--color-ink-soft)]">{tr('Les nouveaux joueurs naissent toujours, puis racontent leur enfance en quelques souvenirs.')}</p>
              {askTrait && (
                <div className="rounded-2xl bg-[var(--color-canvas)] p-3">
                  <div className="label mb-2">{tr('Petit, tu étais…')}</div>
                  <div className="grid grid-cols-4 gap-2">
                    {TALENTS.map((x) => (
                      <button key={x.id} className="tile flex flex-col items-center gap-1 px-1 py-2" aria-pressed={talent === x.id} onClick={() => (setTalent(talent === x.id ? '' : x.id), haptic('light'), sfx.pop())}>
                        <IconTile icon={x.icon} colors={x.colors} size={36} radius={11} className={talent === x.id ? 'animate-pop' : ''} />
                        <span className="text-[11px] leading-tight font-extrabold">{x.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="flex items-center gap-2 font-display text-[24px] leading-tight font-extrabold">
                <Sparkles size={22} className="text-[#c9a227]" /> {tr('Merci, Pionnier !')}
              </h2>
              <p className="text-sm leading-snug font-bold text-[var(--color-ink-soft)]">{tr('Tu avais payé pour grandir plus vite. L’enfance ne se joue plus, alors on te dit merci autrement :')}</p>
              <ul className="space-y-2">
                <Gift label={tr('Le badge « Pionnier »')} value={tr('à côté de ton nom')} />
                <Gift label={tr('Le pin des Pionniers')} value={tr('dans Mon look, introuvable ailleurs')} />
                <Gift label={tr('Djai offerts')} value={`+${amount(sim.pionnier?.djai ?? 0)}`} />
                <Gift label={tr('Ton futur quartier')} value={tr('démarre au niveau 2')} />
              </ul>
            </>
          )}
          {error && <p className="motion-shake rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">{error}</p>}
          <button className="btn w-full" disabled={busy} onClick={done}>
            {due === 'pionnier' ? tr('Merci !') : tr('C’est parti')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Gift({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5">
      <span className="text-sm font-extrabold text-[var(--color-ink-soft)]">{label}</span>
      <span className="text-right font-display text-[15px] font-extrabold">{value}</span>
    </li>
  )
}

/** The badge by a Pionnier's name (the street's tag, the top bar). */
export const PIONNIER_MARK = '✦'
