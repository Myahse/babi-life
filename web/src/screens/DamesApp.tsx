import { useEffect, useState } from 'react'
import { PvpButton } from '../components/pvp/PvpButton'
import { ChevronDown, Crown, Play, Swords } from 'lucide-react'
import { api } from '../lib/api'
import type { DameInvite, Player, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { t, locale } from '../lib/i18n'

// Dames 225, the game of dames on the phone: the game going on, the players
// online to sit down with (the game's own, like the men of the grin), the
// friends to challenge, and the rules. The board itself is the one of the
// grin (components/Dames.tsx), opened over the game.

const WOOD = 'linear-gradient(160deg,#b07a3c,#4a2a12)'

/** Who's online to play: the game's own players, with how many games they've won. */
const ONLINE: { name: string; wins: number }[] = [
  { name: 'KoffiDamier', wins: 214 },
  { name: 'Tonton_Brou', wins: 96 },
  { name: 'LaReineDu100', wins: 388 },
  { name: 'YopChampion', wins: 51 },
]

export function DamesApp({ sim, onOnline, onFriend, onResume }: { sim: Sim; /** Sit down with a player online (their name): the stake comes next. */ onOnline: (name: string) => void; /** Challenge a player friend: the stake comes next. */ onFriend: (p: Player) => void; /** Back to the board. */ onResume: () => void }) {
  const [state, setState] = useState<{ friends: Player[]; game: DameInvite | null } | null>(null)
  const [rules, setRules] = useState(false)
  useEffect(() => {
    api
      .around(sim.id)
      .then((a) => setState({ friends: a.friends, game: a.dames ?? null }))
      .catch(() => setState({ friends: [], game: null }))
  }, [sim.id])
  const grownFriends = state?.friends.filter((p) => p.stage !== 'enfant') ?? []
  return (
    <div className="-mx-3 -mt-2">
      <div className="px-4 pt-2 pb-4 text-white" style={{ background: WOOD }}>
        <div className="font-display text-2xl font-extrabold tracking-wide">{t('DAMES 225')}</div>
        <div className="text-sm font-bold opacity-85">{t('Le damier du grin dans ta poche')}</div>
      </div>
      <div className="px-3 pt-3 pb-4">
        <PvpButton game="dames" className="mb-3" />
        {state?.game?.status === 'playing' && (
          <button className="mb-3 flex w-full items-center gap-3 rounded-[20px] bg-[#fff4e0] p-3 text-left" onClick={onResume}>
            <Crown size={22} className="shrink-0 text-[#8a4b1f]" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-[15px] font-extrabold">{t('Ta partie en cours')}</div>
              <div className="text-xs font-bold text-[var(--color-ink-soft)]">
                {state.game.mine ? t('Tu as lancé la partie') : t('Contre {fromName}', { fromName: state.game.fromName })}
                {state.game.stake > 0 ? t(' · {0} F chacun', { 0: state.game.stake.toLocaleString(locale()) }) : ''}
              </div>
            </div>
            <span className="btn !bg-[#8a4b1f] !px-3 !py-1.5 !text-xs">
              <Play size={13} /> {t('Reprendre')}
            </span>
          </button>
        )}

        <div className="label">{t('Joueurs en ligne')}</div>
        <ul className="space-y-1.5">
          {ONLINE.map((o) => (
            <li key={o.name} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.3)]">
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold text-white" style={{ background: WOOD }}>
                {o.name.slice(0, 1)}
                <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-[var(--color-emerald)] ring-2 ring-white" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-extrabold">{o.name}</div>
                <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{o.wins} {t('parties gagnées')}</div>
              </div>
              <button className="btn !bg-[#8a4b1f] !px-3 !py-1.5 !text-xs" disabled={state?.game?.status === 'playing'} onClick={() => onOnline(o.name)}>
                <Swords size={13} /> {t('Jouer')}
              </button>
            </li>
          ))}
        </ul>

        <div className="label mt-4">{t('Défie un ami')}</div>
        {!state ? null : grownFriends.length ? (
          <ul className="space-y-1.5">
            {grownFriends.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.3)]">
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#f3e2c7] to-[#c8894a]">
                  <Portrait look={p.look} gender={p.gender} framing="head" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[15px] font-extrabold">{p.username ? `@${p.username}` : p.firstName}</div>
                  <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{p.online ? t('En ligne') : t('Hors ligne : il ou elle répondra plus tard')}</div>
                </div>
                <button className="btn !bg-[#8a4b1f] !px-3 !py-1.5 !text-xs" disabled={state.game?.status === 'playing'} onClick={() => onFriend(p)}>
                  <Swords size={13} /> {t('Défier')}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-bold text-[var(--color-ink-soft)]">{t("Pas encore d'ami·es dans le jeu : ajoute des joueurs que tu croises dans la rue, puis défie-les ici.")}</p>
        )}

        <button className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[var(--color-canvas)] px-3 py-2.5 text-left" onClick={() => setRules(!rules)}>
          <span className="font-display text-[15px] font-extrabold">{t('Les règles')}</span>
          <ChevronDown size={18} className={rules ? 'rotate-180' : ''} />
        </button>
        {rules && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">
            <li>{t('Damier de 100 cases, vingt pions chacun ; les blancs commencent.')}</li>
            <li>{t("Un pion avance d'une case en diagonale, et prend en avant comme en arrière.")}</li>
            <li>{t('La prise est obligatoire, et il faut prendre le plus de pions possible ; les pions pris sortent une fois le coup fini.')}</li>
            <li>{t('Un pion qui finit sur la dernière rangée devient dame : elle vole sur les diagonales.')}</li>
            <li>{t("Celui qui ne peut plus jouer a perdu ; 25 coups chacun avec seulement des dames et sans prise, c'est nul.")}</li>
            <li>{t('Avec une mise, chacun met la même somme ; le gagnant prend tout, la nulle rend à chacun la sienne.')}</li>
          </ul>
        )}
      </div>
    </div>
  )
}
