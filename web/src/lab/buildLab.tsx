import { useEffect, useState } from 'react'
import BuildMode from '../components/BuildMode'
import { api } from '../lib/api'
import type { Sim, World } from '../lib/types'
import { useWorld } from '../store/world'

// Development only (city.html?view=build): the house editor alone, on the logged-in player's first
// Sim and its lot (the session in localStorage, as in the game), without the street behind it. To
// try the build flow quickly: buy a lot, pick a plan, place, move and turn furniture.

export function BuildLab() {
  const [world, setWorld] = useState<World | null>(null)
  const [sim, setSim] = useState<Sim | null>(null)
  const [open, setOpen] = useState(true)
  useEffect(() => {
    void api.world().then((w) => (setWorld(w), useWorld.setState({ world: w })))
    void api.sims().then((s) => setSim(s[0] ?? null))
  }, [])
  if (!world || !sim) return <p className="p-4">…</p>
  if (!open)
    return (
      <button className="btn m-4" onClick={() => setOpen(true)}>
        Construire
      </button>
    )
  return <BuildMode world={world} sim={sim} onResult={(r) => r.sim && setSim(r.sim)} onClose={() => setOpen(false)} />
}
