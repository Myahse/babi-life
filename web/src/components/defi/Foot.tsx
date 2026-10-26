import { lazy, Suspense, useMemo, useState } from 'react'
import type { Look } from '../../lib/types'
import { randomLook } from '../../avatar/options'
import { rng } from '../../world3d/themes'

// Le foot à la console, as it's played at the salle de jeux vidéo: the
// street's own football in 3D (streetball/), five against five, the orange
// of the Éléphants against the boys of the quarter, on the console's rules:
// a shorter match, the other side as strong as its rank, and in the
// tournament (the quarter-final, the semi, the final, each side harder) a
// draw played on to the golden goal. The stick runs, « Passe », « Tir »,
// « Crochet », « Défense », as in the street.

const StreetMatch = lazy(() => import('../../streetball/StreetMatch'))

/** The console's match: 100 seconds. */
const LENGTH = 100

export type FootRound = { name: string; diff: number; label?: string }
export const FOOT_MODES: Record<'match' | 'defi' | 'tournoi', FootRound[]> = {
  match: [{ name: 'Les gars du quartier', diff: 0.82 }],
  defi: [{ name: 'Le caïd du quartier', diff: 0.92 }],
  tournoi: [
    { name: "Les Lions d'Abobo", diff: 0.85, label: 'Quart de finale' },
    { name: 'Koumassi FC', diff: 0.97, label: 'Demi-finale' },
    { name: 'Yop City', diff: 1.05, label: 'Finale' },
  ],
}

/** The match result as a score out of 100: a win from 65, by the goals between; a draw 50; a loss under 40. */
export function matchScore(mine: number, theirs: number) {
  const d = mine - theirs
  if (d > 0) return Math.min(100, 55 + d * 10 + Math.min(10, mine * 2))
  if (d === 0) return 50
  return Math.max(4, 42 - 12 * (-d - 1) + Math.min(6, mine * 3) - 6)
}

export function FootDefi({ mode, me, onEnd, onQuit }: { mode: keyof typeof FOOT_MODES; me?: { look: Look; gender: 'femme' | 'homme' }; onEnd: (score: number) => void; /** Left mid-match: nothing sent. */ onQuit?: () => void }) {
  const rounds = FOOT_MODES[mode]
  const [round, setRound] = useState(0)
  const [between, setBetween] = useState<{ won: boolean; mine: number; theirs: number } | null>(null)
  const player = useMemo(() => me ?? { look: randomLook('homme', rng('console')), gender: 'homme' as const }, [me])
  // Kept from render to render: a new one would start the match over.
  const rules = useMemo(() => ({ length: LENGTH, foe: rounds[round].diff, golden: rounds.length > 1 }), [rounds, round])
  const done = (mine: number, theirs: number) => {
    const won = mine > theirs
    if (rounds.length === 1) return onEnd(matchScore(mine, theirs))
    setBetween({ won, mine, theirs })
  }
  const next = () => {
    const b = between!
    setBetween(null)
    // The tournament: a third for each round won, all of it for the cup; out, a little for how close.
    if (!b.won) return onEnd(Math.min(100, Math.round(round * 33 + matchScore(b.mine, b.theirs) / 10)))
    if (round + 1 >= rounds.length) return onEnd(100)
    setRound(round + 1)
  }
  const rival = rounds[round]
  if (between)
    return (
      <div className="grid h-full place-items-center bg-[#0b1a10] p-5">
        <div className="card animate-pop w-full max-w-[320px] p-5 text-center">
          <div className="label">{rival.label}</div>
          <div className="mt-1 font-display text-[30px] leading-tight font-extrabold">
            {between.mine} – {between.theirs}
          </div>
          <p className="mt-2 text-[15px] font-bold">
            {between.won ? (round + 1 >= rounds.length ? 'Champion du tournoi ! 🏆' : `Qualifié·e ! Prochain : ${rounds[round + 1].label}, contre ${rounds[round + 1].name}.`) : `Éliminé·e par ${rival.name}.`}
          </p>
          <button className="btn mt-4 w-full" onClick={next}>
            {between.won && round + 1 < rounds.length ? 'Jouer le match suivant' : 'Voir le résultat'}
          </button>
        </div>
      </div>
    )
  return (
    <Suspense
      fallback={
        <div className="grid h-full place-items-center bg-[#0b1a10] font-display text-xl font-extrabold text-white">
          {rival.label ?? 'Le match'} : contre {rival.name}…
        </div>
      }
    >
      <StreetMatch key={round} sport="foot" name="Toi" look={player.look} gender={player.gender} rules={rules} onExit={(r) => (r ? done(r.score[0], r.score[1]) : onQuit?.())} />
    </Suspense>
  )
}
