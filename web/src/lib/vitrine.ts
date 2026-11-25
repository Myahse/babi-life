import { create } from 'zustand'

// La vitrine des panneaux (the update « pub-vitrine », components/Vitrine.tsx): a board tapped in the street
// (world3d/open/billboards.tsx) opens its ad's showcase; an empty board, how to put one's ad there.
export type VitrineAd = { id: string; advertiser: string; title: string; type: 'image' | 'video'; url: string; link?: string; appName?: string; icon?: string }
export const useVitrine = create<{ ad: VitrineAd | null; empty: boolean; commune: string; open: (ad: VitrineAd | null, commune: string) => void; close: () => void }>((set) => ({
  ad: null,
  empty: false,
  commune: '',
  open: (ad, commune) => set({ ad, empty: !ad, commune }),
  close: () => set({ ad: null, empty: false }),
}))
// (In development, a test opens it without finding a board on the screen.)
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __vitrine: useVitrine })
