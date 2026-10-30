import { Swords, Users } from 'lucide-react'
import type { PvpGameId } from '../../lib/api'
import { keyOpen, useFeatures } from '../../lib/features'
import { Row } from '../ui'
import { PVP_GAMES, PVP_ORDER, openPvp } from './games'
import { t } from '../../lib/i18n'

// Where « Jouer contre un joueur » is offered (update « jeux-en-ligne »): in
// each game's app, at the salle de jeux's défis, in the phone's « Jeux ».
// Closed, nothing shows: everything plays as before.

/** « Jouer contre un joueur » for a game (its app, a défi's intro). */
export function PvpButton({ game, className = '' }: { game: PvpGameId; className?: string }) {
  const feats = useFeatures()
  if (!keyOpen(feats, 'jeux-en-ligne')) return null
  const look = PVP_GAMES[game]
  return (
    <button className={`btn w-full !py-2.5 !text-sm ${className}`} style={{ background: look.colors[1] }} onClick={() => openPvp(game)} data-pvp-open={game}>
      <Swords size={16} /> {t('Jouer contre un joueur')}
    </button>
  )
}

/** The phone's « Jeux »: every game against a real player. */
export function PvpJeux() {
  const feats = useFeatures()
  if (!keyOpen(feats, 'jeux-en-ligne')) return null
  const games = PVP_ORDER.filter((g) => {
    const key = { dames: 'app:dames', huit: 'app:huit', awale: 'app:awale', ludo: 'app:ludo', gode: 'app:gode' }[g as string]
    return !key || keyOpen(feats, key)
  })
  return (
    <div className="mt-4 space-y-2">
      <div className="label flex items-center gap-1">
        <Users size={13} /> {t('Contre de vrais joueurs')}
      </div>
      <p className="text-sm font-bold text-[var(--color-ink-soft)]">{t('Défie un ami ou un joueur en ligne dans la ville, ou trouve un adversaire : la partie se joue en direct, chacun sur son téléphone.')}</p>
      <ul className="motion-stagger space-y-2">
        {games.map((g) => {
          const d = PVP_GAMES[g]
          return <Row key={g} icon={d.icon} colors={d.colors} title={d.title} sub={d.mode === 'direct' ? t('En direct, contre un joueur') : d.bets ? t('Coup par coup · avec ou sans mise') : t('Coup par coup')} onClick={() => openPvp(g)} />
        })}
      </ul>
    </div>
  )
}
