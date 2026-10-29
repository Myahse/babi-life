import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Swords } from 'lucide-react'
import { api, type Duel } from '../lib/api'
import { DUEL_IN } from '../lib/live'
import type { Look, Sim } from '../lib/types'
import type { Act } from '../screens/phoneApps'
import { IconTile } from './ui'
import { DuelMatch } from './defi/Combat'
import { FightNet } from './defi/combat/net'

// Player against player at the street fight (update « combat-joueurs »,
// backend sims/duel.go): the challenge that comes (say yes or no), the one
// sent (waiting for the answer), then the fight itself, both phones playing
// it at once (defi/combat/net.ts). Two babies: their baby fight.

type View = { duel: Duel; other: { id: string; look: Look; gender: 'femme' | 'homme' } }

export function DuelLayer({ sim, token, on, act }: { sim: Sim; token: string | null; on: boolean; act: Act }) {
  const [view, setView] = useState<View | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const last = useRef<View | null>(null)
  const refresh = useCallback(() => {
    api
      .duel(sim.id)
      .then((r) => {
        const v = r.duel && r.other ? { duel: r.duel, other: r.other } : null
        // Our challenge gone without a fight: the other said no, or let it be.
        const was = last.current
        if (was && was.duel.from === sim.id && was.duel.state === 'pending' && !v) setNote(`${was.duel.names[1]} n'a pas accepté le combat.`)
        last.current = v
        setView(v)
      })
      .catch(() => undefined)
  }, [sim.id])
  useEffect(() => {
    if (!on) return
    refresh()
    const again = () => refresh()
    window.addEventListener(DUEL_IN, again)
    // Without the live line (a lost connection), every few seconds while something's going on.
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), last.current ? 4000 : 20000)
    return () => (window.removeEventListener(DUEL_IN, again), clearInterval(t))
  }, [on, refresh, view?.duel.id, view?.duel.state])
  useEffect(() => {
    if (!note) return
    const k = setTimeout(() => setNote(null), 4000)
    return () => clearTimeout(k)
  }, [note])
  if (!on) return null
  const d = view?.duel
  const mine = d?.from === sim.id
  const otherName = d ? (mine ? d.names[1] : d.names[0]) : ''
  const what = d?.baby ? 'la bagarre de bébés' : 'le combat de rue'
  return (
    <>
      {note && <div className="card animate-pop pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto max-w-[420px] p-3 text-center text-sm font-extrabold">{note}</div>}
      {d?.state === 'pending' && !mine && (
        <div className="card animate-pop fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto max-w-[420px] p-3">
          <div className="flex items-center gap-3">
            <IconTile icon={Swords} colors={['#ff6b6b', '#c92a2a']} size={42} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="label">{otherName} te défie</div>
              <div className="font-display text-[15px] font-extrabold">{d.baby ? 'Bagarre de bébés !' : 'Un combat de rue, toi contre moi !'}</div>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2 !text-sm" onClick={() => void api.answerDuel(sim.id, d.id, false).finally(refresh)}>
              Pas maintenant
            </button>
            <button className="btn !bg-[#c92a2a] !py-2 !text-sm" onClick={() => void api.answerDuel(sim.id, d.id, true).finally(refresh)}>
              <Swords size={16} /> On y va !
            </button>
          </div>
        </div>
      )}
      {d?.state === 'pending' && mine && (
        <div className="card pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto flex max-w-[420px] items-center gap-3 p-3">
          <IconTile icon={Swords} colors={['#ff6b6b', '#c92a2a']} size={36} />
          <div className="text-sm font-extrabold">
            Défi envoyé à {otherName} pour {what}… <span className="text-[var(--color-ink-soft)]">en attente de sa réponse</span>
          </div>
        </div>
      )}
      {d?.state === 'on' && token && view && (
        <Fight
          key={d.id}
          sim={sim}
          token={token}
          view={view}
          onOver={(won, gone, quit) => {
            last.current = null
            setView(null)
            void act(gone ? 'Combat interrompu' : won ? 'Victoire au combat' : 'Combat perdu', 'swords', 'social', () => api.endDuel(sim.id, d.id, won, !!gone))
            if (gone && !quit) setNote(`${otherName} a quitté le combat.`)
          }}
        />
      )}
    </>
  )
}

function Fight({ sim, token, view, onOver }: { sim: Sim; token: string; view: View; onOver: (won: boolean, gone?: boolean, quit?: boolean) => void }) {
  const { duel, other } = view
  const host = duel.from === sim.id
  // The line to the other phone: opened with the fight, closed with it (made in the effect, so a remount opens a new one).
  const [net, setNet] = useState<FightNet | null>(null)
  useEffect(() => {
    const n = new FightNet(token, sim.id, duel.id, host)
    setNet(n)
    return () => n.close()
  }, [token, sim.id, duel.id, host])
  const done = useRef(false)
  const over = useCallback(
    (won: boolean, gone?: boolean, quit?: boolean) => {
      if (done.current) return
      done.current = true
      // A moment on the last word, then back to the street.
      setTimeout(() => onOver(won, gone, quit), gone ? 0 : 600)
    },
    [onOver],
  )
  const name = host ? duel.names[1] : duel.names[0]
  const versus = useMemo(() => net && { name, look: other.look, gender: other.gender, net, onOver: over }, [name, other.look, other.gender, net, over])
  const me = useMemo(() => ({ look: sim.look, gender: sim.gender }), [sim.look, sim.gender])
  return (
    <div className="fixed inset-0 z-[90] bg-[#0f0b22]">
      {versus && <DuelMatch me={me} baby={duel.baby} versus={versus} />}
      <button className="absolute top-12 right-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-sm font-extrabold text-white" onClick={() => over(false, true, true)} aria-label="Quitter le combat">
        ✕
      </button>
    </div>
  )
}
