import { lazy, Suspense, useRef, useState } from 'react'
import type { ActionResult, Sim } from '../../lib/types'
import { api } from '../../lib/api'
import { CARD, useCard } from '../../lib/overlays'
import { famOf } from '../../game/famille'

// The passation's ceremony when the server has one to show (Famille.passation, the update « heritage »): a
// card over the game in its turn (lib/overlays.ts), the scene (PassationScene, its own canvas, loaded only
// then), and once seen the server forgets it. Wherever the Sim is: the house was handed down, it's the moment.

const PassationScene = lazy(() => import('./PassationScene').then((m) => ({ default: m.PassationScene })))

export function Passation({ sim, onResult }: { sim: Sim; onResult: (r: ActionResult) => void }) {
  const card = famOf(sim)?.passation
  // (Seen here: not shown again while the server's answer is on its way.)
  const [seen, setSeen] = useState<number | null>(null)
  const done = useRef(false)
  const want = !!card && seen !== card.at
  const mine = useCard('passation', CARD.passation, want, true, true)
  if (!card || !mine) return null
  const end = () => {
    if (done.current) return
    done.current = true
    setSeen(card.at)
    api
      .ancien(sim.id, '-', 'vu')
      .then(onResult, () => undefined)
      .finally(() => (done.current = false))
  }
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[80] bg-[#4a3157]" />}>
      <PassationScene sim={sim} card={card} onDone={end} />
    </Suspense>
  )
}
