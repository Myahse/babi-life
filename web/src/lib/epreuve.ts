import { useEffect, useState } from 'react'
import { api } from './api'

// The story's épreuve due now (backend game/epreuves.go): its interaction, while the story's step is it;
// the place's menu shows that one only (the others « epreuve-… » stay hidden).

/** The épreuve the Sim's story is at, or null; asked again when `key` changes (the place, the activity). */
export function useEpreuveNow(simId: string, on: boolean, key: string) {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    if (!on) return setId(null)
    let live = true
    api
      .errands(simId)
      .then((r) => {
        const s = r.story
        if (live) setId(s && !s.waiting ? (s.steps[s.step]?.epreuve ?? null) : null)
      })
      .catch(() => live && setId(null))
    return () => {
      live = false
    }
  }, [simId, on, key])
  return id
}
