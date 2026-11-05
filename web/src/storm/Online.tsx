import { useEffect, useMemo, useState } from 'react'
import type { Look } from '../lib/types'
import type { PvpOther } from '../lib/api'
import { StormMatch, ROSTER } from './Game'
import { NO_PAD } from './engine'
import type { StormNet } from './net'
import { ARENA_IDS } from './net'
import { t as tr } from '../lib/i18n'

// Adjamé Storm 4 against a player (components/pvp/play.tsx): each plays its
// own Sim; the first player's phone picks the arena, the other learns it with
// the first fight it's sent.

export default function StormOnline({ me, other, net, onOver }: { me: { look: Look; gender: 'femme' | 'homme'; name: string }; other: PvpOther; net: StormNet; onOver: (won: boolean, gone?: boolean) => void }) {
  const [arena, setArena] = useState<number | null>(net.arena)
  // Not yet heard from the first player: hands sent now and then, so it knows this phone is there; the arena as soon as it says.
  useEffect(() => {
    if (arena !== null) return
    const t = setInterval(() => (net.arena !== null ? setArena(net.arena) : net.send(NO_PAD)), 200)
    return () => clearInterval(t)
  }, [net, arena])
  const versus = useMemo(() => ({ net, onOver }), [net, onOver])
  if (arena === null) return <div className="grid h-full place-items-center px-6 text-center font-display text-[18px] font-extrabold text-white">{tr('En attente de {name}…', { name: other.name })}</div>
  return (
    <StormMatch
      looks={[
        { look: me.look, gender: me.gender, seed: 3 },
        { look: other.look, gender: other.gender, seed: 9 },
      ]}
      styles={[ROSTER[0].style, ROSTER[0].style]}
      names={[me.name.toUpperCase(), other.name.toUpperCase()]}
      arena={ARENA_IDS[arena] ?? 'terrain'}
      level={0}
      versus={versus}
      onOver={() => undefined}
    />
  )
}
