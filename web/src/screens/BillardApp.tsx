import { useState } from 'react'
import { BillardDefi } from '../components/defi/Billard'

/**
 * Billard 225 (backend world/apps.go « billard »): the maquis's American pool on the phone, against the
 * regulars (components/defi/Billard.tsx, billard/pool.ts), wherever the Sim is. For the pleasure of the game,
 * no stake and nothing earned (the défi at the maquis's table pays its bonus).
 */
export function BillardApp() {
  // A new game each time one ends (« Rejouer »): back to choosing the opponent.
  const [round, setRound] = useState(0)
  return (
    <div className="-mx-3 -mt-1 h-[calc(100dvh-150px)] min-h-[560px] overflow-hidden rounded-b-[20px] bg-[#0b2a1b]">
      <BillardDefi key={round} phone onEnd={() => setRound((r) => r + 1)} />
    </div>
  )
}
