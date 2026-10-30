import { useEffect, useState } from 'react'
import { Search, Swords, Trophy, Users, X } from 'lucide-react'
import { api, type PvpGameId, type PvpRank } from '../../lib/api'
import type { Player, Sim } from '../../lib/types'
import { Portrait } from '../../avatar/portrait'
import { IconTile } from '../ui'
import { PVP_GAMES } from './games'

// « Jouer contre un joueur » for one game: « Trouver un adversaire » (the
// queue), the friends online, the players online in the city (the players'
// list, components/Players.tsx), the stake between adults where the game
// takes one, and the game's « Classement ».

const STAKES = [0, 100, 500, 1000, 2000, 5000, 10000]

export function PvpSheet({ sim, game, to, adult, onClose, onChallenge, onQueue }: { sim: Sim; game: PvpGameId; /** A player picked already (from the players' list). */ to?: string; /** The Sim is a grown-up (a stake can be put down). */ adult: boolean; onClose: () => void; onChallenge: (to: string, stake: number) => void; onQueue: () => void }) {
  const look = PVP_GAMES[game]
  const [friends, setFriends] = useState<Player[] | null>(null)
  const [city, setCity] = useState<Player[] | null>(null)
  const [rank, setRank] = useState<{ top: PvpRank[]; mine: PvpRank } | null>(null)
  const [stake, setStake] = useState(0)
  const [max, setMax] = useState(0)
  useEffect(() => {
    void api
      .around(sim.id)
      .then((a) => setFriends(a.friends.filter((p) => p.online)))
      .catch(() => setFriends([]))
    void api
      .everyone(sim.id)
      .then((r) => setCity(r.players))
      .catch(() => setCity([]))
    void api
      .pvpRanking(sim.id, game)
      .then(setRank)
      .catch(() => setRank(null))
    void api
      .pvpGames(sim.id)
      .then((r) => setMax(r.games.find((g) => g.id === game)?.max ?? 0))
      .catch(() => setMax(0))
  }, [sim.id, game])
  const bets = look.bets && adult && max > 0
  const friendIds = new Set(friends?.map((p) => p.id))
  // The city's players who aren't friends (the friends are listed first); a picked one at the top.
  const others = (city ?? []).filter((p) => !friendIds.has(p.id))
  const picked = to ? [...(friends ?? []), ...others].find((p) => p.id === to) : undefined
  const row = (p: Player) => {
    const grownUp = p.stage === 'adulte'
    const why = look.adult && !grownUp ? '18 ans et plus' : stake > 0 && !grownUp ? 'Pas de mise avec un mineur' : null
    return (
      <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.3)]" data-pvp-player={p.firstName}>
        <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#f3e2c7] to-[#c8894a]">
          <Portrait look={p.look} gender={p.gender} framing="head" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] font-extrabold">{p.username ? `@${p.username}` : p.firstName}</div>
          <div className="truncate text-[11px] font-bold text-[var(--color-ink-soft)]">{why ?? (p.friend ? 'Ami·e · en ligne' : `En ligne${p.commune ? ` · ${p.commune}` : ''}`)}</div>
        </div>
        <button className="btn !px-3 !py-1.5 !text-xs" style={{ background: look.colors[1] }} disabled={!!why} onClick={() => onChallenge(p.id, stake)}>
          <Swords size={13} /> Défier
        </button>
      </li>
    )
  }
  return (
    <div className="fixed inset-0 z-[94] flex flex-col justify-end bg-[#0f1230]/55" onClick={onClose} data-pvp="sheet">
      <div className="sheet animate-up mx-auto max-h-[86%] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <IconTile icon={look.icon} colors={look.colors} size={46} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="label">Jouer contre un joueur</div>
            <div className="font-display text-[19px] font-extrabold">{look.title}</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{look.how}</p>

        <button className="btn mt-3 w-full !py-3" style={{ background: look.colors[1] }} onClick={onQueue} data-pvp="queue">
          <Search size={17} /> Trouver un adversaire
        </button>
        <p className="mt-1 text-center text-[11px] font-bold text-[var(--color-ink-soft)]">Le premier joueur qui cherche le même jeu. Personne ? Tu joues contre l’ordinateur.</p>

        {bets && (
          <>
            <div className="label mt-4">Mise (Djai, chacun)</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {STAKES.filter((s) => s <= max && s <= sim.money).map((s) => (
                <button key={s} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${s === stake ? 'bg-[#16161c] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`} onClick={() => setStake(s)}>
                  {s === 0 ? 'Pour le plaisir' : s.toLocaleString('fr-FR')}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] font-bold text-[var(--color-ink-soft)]">Entre adultes seulement. Le gagnant prend tout, dans la limite de ce qu’on peut gagner par jour ; un défi aléatoire se joue sans mise.</p>
          </>
        )}

        {picked && (
          <>
            <div className="label mt-4">Défier</div>
            <ul className="mt-1 space-y-1.5">{row(picked)}</ul>
          </>
        )}
        <div className="label mt-4 flex items-center gap-1">
          <Users size={13} /> Tes amis en ligne
        </div>
        {friends === null ? (
          <div className="mt-1 h-12 animate-pulse rounded-2xl bg-[var(--color-canvas)]" />
        ) : friends.length ? (
          <ul className="mt-1 space-y-1.5">{friends.filter((p) => p.id !== to).map(row)}</ul>
        ) : (
          <p className="mt-1 rounded-2xl bg-[var(--color-canvas)] p-3 text-[13px] font-bold text-[var(--color-ink-soft)]">Aucun ami en ligne en ce moment.</p>
        )}
        <div className="label mt-4">En ligne dans la ville</div>
        {city === null ? (
          <div className="mt-1 h-12 animate-pulse rounded-2xl bg-[var(--color-canvas)]" />
        ) : others.length ? (
          <ul className="mt-1 space-y-1.5">{others.filter((p) => p.id !== to).slice(0, 30).map(row)}</ul>
        ) : (
          <p className="mt-1 rounded-2xl bg-[var(--color-canvas)] p-3 text-[13px] font-bold text-[var(--color-ink-soft)]">Personne d’autre en ligne dans la ville : essaie « Trouver un adversaire ».</p>
        )}

        <div className="label mt-4 flex items-center gap-1">
          <Trophy size={13} /> Classement
        </div>
        {rank && rank.top.length ? (
          <ol className="mt-1 space-y-1">
            {rank.top.map((r, i) => (
              <li key={r.id} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-extrabold ${r.id === sim.id ? 'bg-[#fff3c4]' : 'bg-[var(--color-canvas)]'}`}>
                <span className="w-5 text-[var(--color-ink-soft)]">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="tabular-nums">
                  {r.wins} V · {r.losses} D
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-[13px] font-bold text-[var(--color-ink-soft)]">Pas encore de partie gagnée : sois le premier du classement !</p>
        )}
        {rank && (rank.mine.wins > 0 || rank.mine.losses > 0) && (
          <p className="mt-1.5 text-[12px] font-extrabold text-[var(--color-ink-soft)]">
            Toi : {rank.mine.wins} victoire{rank.mine.wins > 1 ? 's' : ''}, {rank.mine.losses} défaite{rank.mine.losses > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
