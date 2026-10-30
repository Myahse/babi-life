import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { serverNow } from '../../lib/worldClock'
import { Drive } from '../defi/Course'
import type { Rival } from '../defi/race/engine'
import { PvpLine } from './line'
import type { RunProps } from './play'

// La course à deux against a real player (update « jeux-en-ligne »): the
// console's race (defi/Course.tsx), the other car driven from its phone
// (raceNet.ts): the first player runs it.

export function CoursePvp({ sim, token, m, other, seat, report, quit }: RunProps) {
  const [line, setLine] = useState<PvpLine | null>(null)
  useEffect(() => {
    const l = new PvpLine(token, sim.id, m.id)
    setLine(l)
    return () => l.close()
  }, [token, sim.id, m.id])
  // The other's car: its name, a colour of its own, driven by its phone (full skill: no help).
  const rival = useMemo<Rival>(() => ({ id: 'garage', name: other.name, about: '', color: '#1c7ed6', skill: 1, eyes: 1, nitro: 0 }), [other.name])
  const [go, setGo] = useState(() => serverNow() >= m.start)
  useEffect(() => {
    if (go) return
    const t = setTimeout(() => setGo(true), Math.max(0, m.start - serverNow()))
    return () => clearTimeout(t)
  }, [go, m.start])
  const versus = useMemo(() => line && { line, host: seat === 0, onOver: (first: boolean) => report(first ? sim.id : other.id) }, [line, seat, report, sim.id, other.id])
  return (
    <div className="fixed inset-0 z-[90] bg-[#1a1030]" data-pvp="course">
      {versus && go ? <Drive rival={rival} versus={versus} onEnd={() => undefined} /> : <div className="grid h-full place-items-center font-display text-2xl font-extrabold text-white">Contre {other.name}…</div>}
      <button className="absolute top-[150px] right-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white" onClick={quit} aria-label="Quitter la course">
        <X size={17} strokeWidth={2.6} />
      </button>
    </div>
  )
}
