import { create } from 'zustand'
import { api, errorText } from '../lib/api'
import type { World } from '../lib/types'
import { t } from '../lib/i18n'

type WorldState = { world: World | null; error: string | null; load: () => Promise<void> }

export const useWorld = create<WorldState>((set, get) => ({
  world: null,
  error: null,
  load: async () => {
    if (get().world) return
    try {
      set({ world: await api.world(), error: null })
    } catch (e) {
      set({ error: errorText(e, t('Serveur injoignable')) })
    }
  },
}))

export function findCommune(world: World, cityId: string, communeId: string) {
  const city = world.cities.find((c) => c.id === cityId)
  return { city, commune: city?.communes.find((c) => c.id === communeId) }
}
