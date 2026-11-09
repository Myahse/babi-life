import { create } from 'zustand'

/**
 * « Écran dégagé » (a player's ask: the screen too full, a phone on its side above all): one tap hides what
 * sits over the street on the sides (the mini-map and « Où aller ? », the next goal, the view and emote
 * buttons, le mode vie's buttons and the wishes, an invitation's card: its count stays on the players'
 * button), leaving the top bar, the joystick, what's to do where one stands, the needs and the phone. Kept
 * on the phone (localStorage), so it stays as the player left it.
 */
const KEY = 'babi.ecranDegage'

const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const useClearView = create<{ on: boolean; toggle: () => void }>((set, get) => ({
  on: read(),
  toggle: () => {
    const on = !get().on
    try {
      localStorage.setItem(KEY, on ? '1' : '0')
    } catch {
      // (No storage: for this page only.)
    }
    set({ on })
  },
}))
