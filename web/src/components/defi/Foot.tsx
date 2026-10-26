import { lazy, Suspense, useMemo, useState } from 'react'
import type { ActionResult, Look } from '../../lib/types'
import { randomLook } from '../../avatar/options'
import { rng } from '../../world3d/themes'
import { HubMenu, MatchSetup, rulesOf, type Setup } from './foot/Hub'
import { Cup, loadCup } from './foot/Cup'
import { Career } from './foot/Career'
import { CLUBS, kitsFor, teamOf } from './foot/teams'
import { matchScore } from './foot/sim'

export { matchScore }

// Le foot à la console, as it's played at the salle de jeux vidéo: Babi
// Foot, the street's football in 3D (streetball/) on the console's rules (a
// referee, the switch from player to player, sprint, through balls, lobs,
// the charged shot). The hub (foot/Hub.tsx): the quick match, five a side in
// the maracana or eleven at the stadium, any two sides, their shirts, the
// difficulty, the length; the cup (foot/Cup.tsx), eight sides knock-out, a
// draw on penalties or the golden goal; the career (foot/Career.tsx), the
// neighbourhood's club through the seasons. The challenge against the caïd, and
// the Saturday tournament (the quarter-final, the semi, the final, each
// side harder, a draw played on to the golden goal), as before.

const StreetMatch = lazy(() => import('../../streetball/StreetMatch'))

/** The challenge's and the tournament's matches: 150 seconds, five a side. */
const LENGTH = 150

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


type Me = { look: Look; gender: 'femme' | 'homme'; money?: number; homeCommune?: string }

export function FootDefi({ mode, me, simId, onEnd, onQuit, onResult }: { mode: keyof typeof FOOT_MODES; me?: Me; /** The Sim (the career is its own); none: no career. */ simId?: string; onEnd: (score: number) => void; /** Left mid-match: nothing sent. */ onQuit?: () => void; /** A signing's answer, for the Sim's money. */ onResult?: (r: ActionResult) => void }) {
  const player = useMemo(() => me ?? { look: randomLook('homme', rng('console')), gender: 'homme' as const }, [me])
  if (mode === 'match') return <Console me={player} simId={simId} onEnd={onEnd} onQuit={onQuit} onResult={onResult} />
  return <Rounds mode={mode} me={player} onEnd={onEnd} onQuit={onQuit} />
}

/** The console's hub: the quick match, the cup, the career. */
function Console({ me, simId, onEnd, onQuit, onResult }: { me: Me; simId?: string; onEnd: (score: number) => void; onQuit?: () => void; onResult?: (r: ActionResult) => void }) {
  const [screen, setScreen] = useState<'menu' | 'quick' | 'cup' | 'career'>('menu')
  if (screen === 'quick') return <Quick me={me} onEnd={onEnd} onBack={() => setScreen('menu')} />
  if (screen === 'cup') return <Cup me={me} onEnd={onEnd} onBack={() => setScreen('menu')} />
  if (screen === 'career' && simId) return <Career me={me} simId={simId} onEnd={onEnd} onResult={onResult} onBack={() => setScreen('menu')} />
  return <HubMenu cupOn={loadCup() ? 'En cours' : null} onQuick={() => setScreen('quick')} onCup={() => setScreen('cup')} onCareer={simId ? () => setScreen('career') : undefined} onBack={onQuit} />
}

/** A match set up in the hub, against the console. */
function Quick({ me, onEnd, onBack }: { me: Me; onEnd: (score: number) => void; onBack: () => void }) {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [round, setRound] = useState(0)
  const rules = useMemo(() => (setup ? rulesOf(setup) : null), [setup])
  if (!setup || !rules) return <MatchSetup title="Match rapide" onBack={onBack} onPlay={(s) => (setSetup(s), setRound((r) => r + 1))} />
  const mine = teamOf(setup.mine)
  const theirs = teamOf(setup.theirs)
  return (
    <Suspense fallback={<Loading text={`${mine.name} contre ${theirs.name}…`} />}>
      <StreetMatch
        key={round}
        sport="foot"
        name="Toi"
        look={me.look}
        gender={me.gender}
        rules={rules}
        teams={[mine.name, theirs.name]}
        kits={kitsFor(mine, theirs)}
        // Left mid-match: back to the hub; played out: the score.
        onExit={(r) => (r ? onEnd(matchScore(r.score[0], r.score[1])) : setSetup(null))}
      />
    </Suspense>
  )
}

function Loading({ text }: { text: string }) {
  return <div className="grid h-full place-items-center bg-[#0b2e1a] px-6 text-center font-display text-xl font-extrabold text-white">{text}</div>
}

/** The challenge (one match) and the tournament (three, the golden goal for a draw). */
function Rounds({ mode, me, onEnd, onQuit }: { mode: 'defi' | 'tournoi'; me: Me; onEnd: (score: number) => void; onQuit?: () => void }) {
  const rounds = FOOT_MODES[mode]
  const [round, setRound] = useState(0)
  const [between, setBetween] = useState<{ won: boolean; mine: number; theirs: number } | null>(null)
  // Kept from render to render: a new one would start the match over.
  const rules = useMemo(() => ({ size: 5 as const, referee: true, switching: true, length: LENGTH, foe: rounds[round].diff, golden: rounds.length > 1 }), [rounds, round])
  const rival = rounds[round]
  const theirs = CLUBS.find((t) => t.name === rival.name) ?? { ...teamOf('babi'), name: rival.name, home: '#009e60', away: '#f8f9fa' }
  const mine = teamOf('babi')
  const done = (a: number, b: number) => {
    if (rounds.length === 1) return onEnd(matchScore(a, b))
    setBetween({ won: a > b, mine: a, theirs: b })
  }
  const next = () => {
    const b = between!
    setBetween(null)
    // The tournament: a third for each round won, all of it for the cup; out, a little for how close.
    if (!b.won) return onEnd(Math.min(100, Math.round(round * 33 + matchScore(b.mine, b.theirs) / 10)))
    if (round + 1 >= rounds.length) return onEnd(100)
    setRound(round + 1)
  }
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
    <Suspense fallback={<Loading text={`${rival.label ?? 'Le match'} : contre ${rival.name}…`} />}>
      <StreetMatch key={round} sport="foot" name="Toi" look={me.look} gender={me.gender} rules={rules} teams={['Ton équipe', rival.name]} kits={kitsFor(mine, theirs)} onExit={(r) => (r ? done(r.score[0], r.score[1]) : onQuit?.())} />
    </Suspense>
  )
}
