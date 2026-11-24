import { create } from 'zustand'
import { api, type Pet } from './api'

// The Sim's animals for the 3D (the update « animaux »): the dog that follows it in the street
// (world3d/Walker.tsx). Loaded by the game when the update is open, again once the app « Animaux » changed them.
export const usePets = create<{ pets: Pet[]; load: (simId: string) => void }>((set) => ({
  pets: [],
  load: (simId) =>
    void api.animaux(simId).then(
      (r) => set({ pets: r.pets }),
      () => set({ pets: [] }),
    ),
}))
