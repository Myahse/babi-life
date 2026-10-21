import { useSyncExternalStore } from 'react'

// The hotel's lift panel (world3d/interior/HotelFloors), opened from the
// hotel's menu (« Les chambres ») as well as by its own button. Apart, so the
// menu doesn't load the 3D to open it.

let open = false
const listeners = new Set<() => void>()
export const setLift = (v: boolean) => ((open = v), listeners.forEach((f) => f()))
/** The lift's panel, opened from the hotel's menu. */
export const openLift = () => setLift(true)
export const useLift = () => useSyncExternalStore((f) => (listeners.add(f), () => void listeners.delete(f)), () => open)
/** What's done in one's hotel room: up there, not in the hall. */
export const isRoomAct = (id?: string) => !!id && (id.startsWith('chambre-') || id.startsWith('rs-'))
