import { useEffect, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { serverNow } from '../../lib/worldClock'
import { tx } from '../../lib/i18n'

/** A move's time against a player on the spot (« Jouer contre un joueur »): the seconds left to the one who plays; then it's lost. */
export function MoveClock({ deadline, dark }: { deadline?: number; dark?: boolean }) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    const tick = () => setLeft(deadline ? Math.max(0, Math.ceil((deadline - serverNow()) / 1000)) : 0)
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [deadline])
  if (!deadline) return null
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-extrabold tabular-nums ${left <= 15 ? 'bg-[#d81b3f] text-white' : dark ? 'bg-black/25 text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink)]'}`} data-pvp="clock">
      <Hourglass size={12} /> {tx('{left} s', { left })}
    </span>
  )
}
