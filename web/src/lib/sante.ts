import { create } from 'zustand'
import { api, type Health } from './api'

// The Sim's illness for the screen (the update « cycle-vie »): the goal under the mini-map (go and get
// treated), what the perso says. Loaded by the game when the update is open, again on each health news.
export const useSante = create<{ health: Health | null; load: (simId: string) => void }>((set) => ({
  health: null,
  load: (simId) =>
    void api.sante(simId).then(
      (h) => set({ health: h }),
      () => set({ health: null }),
    ),
}))
