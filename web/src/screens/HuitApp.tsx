import { useEffect, useState } from 'react'
import { PvpButton } from '../components/pvp/PvpButton'
import { ChevronDown, Play, Spade, Swords, Users } from 'lucide-react'
import { api } from '../lib/api'
import type { DameInvite, Player, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { t as tr } from '../lib/i18n'

// 8 américain, the card game on the phone: the game going on, the tables of
// the game's own players (two, three or four round the table), the friends
// to challenge, and the rules as they're played here. The table itself is
// components/Huit.tsx, opened over the game.

const FELT = 'linear-gradient(160deg,#1f8a55,#073f24)'

/** The tables open: the game's players sitting there, waiting for one more. */
const TABLES: { names: string[]; note: string }[] = [
  { names: [tr('Tantie Bintou')], note: tr('Tête-à-tête, ça va vite') },
  { names: [tr('Le Boss du 8'), tr('Kader Joker')], note: tr('À trois, l’as fait mal') },
  { names: [tr('Mimi Carreau'), tr('Tonton Pique'), tr('Awa la Reine')], note: tr('À quatre, le 10 et le valet tournent') },
]

/** The rules as the game plays them (backend game/huit.go). */
const RULES = [
  tr('54 cartes avec les deux jokers, 7 cartes chacun. On pose sur la même couleur ou la même valeur.'),
  tr('Le 8 va sur tout : celui qui le pose demande la couleur. On ne finit pas sur un 8.'),
  tr('Le 2 : le suivant pioche 3, sauf s’il pose un 2 ou un joker (ça s’additionne).'),
  tr('Le joker va sur tout : le suivant pioche 6, sauf s’il pose un joker. On joue ensuite sur la carte d’en dessous. On ne finit pas sur un joker.'),
  tr("L'as : le suivant pose un as, ou pioche une carte et laisse jouer le suivant."),
  tr('Le 10 et le valet : le sens change. À deux, celui qui les pose rejoue.'),
  tr('Rien ne va ? On pioche une carte ; si elle va, on peut la poser.'),
  tr("À une carte, on dit « Carte ! », sinon on pioche 2. Le premier qui n'a plus de cartes gagne, et prend toutes les mises."),
]

export function HuitApp({ sim, onTable, onFriend, onResume }: { sim: Sim; /** Sit down at a table of the game's players (their names): the stake comes next. */ onTable: (names: string[]) => void; /** Challenge a player friend: the stake comes next. */ onFriend: (p: Player) => void; /** Back to the table. */ onResume: () => void }) {
  const [state, setState] = useState<{ friends: Player[]; game: DameInvite | null } | null>(null)
  const [rules, setRules] = useState(false)
  useEffect(() => {
    api
      .around(sim.id)
      .then((a) => setState({ friends: a.friends, game: a.huit ?? null }))
      .catch(() => setState({ friends: [], game: null }))
  }, [sim.id])
  const grownFriends = state?.friends.filter((p) => p.stage !== 'enfant') ?? []
  const playing = state?.game?.status === 'playing'
  return (
    <div className="-mx-3 -mt-2">
      <div className="px-4 pt-2 pb-4 text-white" style={{ background: FELT }}>
        <div className="font-display text-2xl font-extrabold tracking-wide">{tr('8 AMÉRICAIN')}</div>
        <div className="text-sm font-bold opacity-85">{tr('Le jeu de cartes de chez nous, entre amis')}</div>
      </div>
      <div className="px-3 pt-3 pb-4">
        <PvpButton game="huit" className="mb-3" />
        {playing && (
          <button className="mb-3 flex w-full items-center gap-3 rounded-[20px] bg-[#e6f6ec] p-3 text-left" onClick={onResume}>
            <Spade size={22} className="shrink-0 text-[#0b6b3a]" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-[15px] font-extrabold">{tr('Ta partie en cours')}</div>
              <div className="text-xs font-bold text-[var(--color-ink-soft)]">
                {state!.game!.mine ? tr('Tu as lancé la partie') : tr('Contre {fromName}', { fromName: state!.game!.fromName })}
                {state!.game!.stake > 0 ? tr(' · {0} F chacun', { 0: state!.game!.stake.toLocaleString('fr-FR') }) : ''}
              </div>
            </div>
            <span className="btn !bg-[#0b6b3a] !px-3 !py-1.5 !text-xs">
              <Play size={13} /> {tr('Reprendre')}
            </span>
          </button>
        )}

        <div className="label">{tr('Les tables en ligne')}</div>
        <ul className="space-y-1.5">
          {TABLES.map((t) => (
            <li key={t.names[0]} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.3)]">
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold text-white" style={{ background: FELT }}>
                {t.names.length + 1}
                <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-[var(--color-emerald)] ring-2 ring-white" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-extrabold">{tr('Table à')} {t.names.length + 1}</div>
                <div className="truncate text-[11px] font-bold text-[var(--color-ink-soft)]">
                  {t.names.join(', ')} · {t.note}
                </div>
              </div>
              <button className="btn !bg-[#0b6b3a] !px-3 !py-1.5 !text-xs" disabled={playing} onClick={() => onTable(t.names)}>
                <Users size={13} /> {tr("S'asseoir")}
              </button>
            </li>
          ))}
        </ul>

        <div className="label mt-4">{tr('Défie un ami')}</div>
        {!state ? null : grownFriends.length ? (
          <ul className="space-y-1.5">
            {grownFriends.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.3)]">
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#f3e2c7] to-[#c8894a]">
                  <Portrait look={p.look} gender={p.gender} framing="head" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[15px] font-extrabold">{p.username ? `@${p.username}` : p.firstName}</div>
                  <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{p.online ? tr('En ligne') : tr('Hors ligne : il ou elle répondra plus tard')}</div>
                </div>
                <button className="btn !bg-[#0b6b3a] !px-3 !py-1.5 !text-xs" disabled={playing} onClick={() => onFriend(p)}>
                  <Swords size={13} /> {tr('Défier')}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-bold text-[var(--color-ink-soft)]">{tr("Pas encore d'ami·es dans le jeu : ajoute des joueurs que tu croises dans la rue, puis défie-les ici.")}</p>
        )}

        <button className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[var(--color-canvas)] px-3 py-2.5 text-left" onClick={() => setRules(!rules)}>
          <span className="font-display text-[15px] font-extrabold">{tr("Les règles d'ici")}</span>
          <ChevronDown size={18} className={rules ? 'rotate-180' : ''} />
        </button>
        {rules && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">
            {RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
