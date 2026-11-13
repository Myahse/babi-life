import { useEffect } from 'react'
import { api } from './api'
import { useSession } from '../store/session'
import { whereabouts } from '../world3d/whereabouts'

// The admin's « Nouveaux joueurs » (backend admin/nouveaux.go): what only the game sees of a new
// player's first minutes: the 3D street there at last (« rue »), the Sim walking or doing something in it
// (« bouge »), and the screen it is on (the last one tells where the ones who never came back left).
// Only an account's first days; each step said once (the server keeps one row per account and step).

const DAY = 86400e3
const age = () => {
  const u = useSession.getState().user
  return u ? Date.now() - new Date(u.createdAt).getTime() : Infinity
}

const said = new Set<string>()
function firstStep(step: 'rue' | 'bouge') {
  const u = useSession.getState().user
  if (!u || said.has(step) || age() > 7 * DAY) return
  said.add(step)
  const key = `babi.pas.${step}.${u.id}`
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  } catch {
    /* said again next time: the server keeps it once */
  }
  void api.funnel(step)
}

let shown = ''
let sent = ''
let timer = 0
/** The screen the player is on now (« rue », « tel:gbairai », « defi:garba »…): sent a moment later, so a quick back-and-forth sends only where it ended; only in an account's first two days. */
export function screenSeen(name: string) {
  shown = name
    .toLowerCase()
    .replace(/[^a-z0-9:_.-]/g, '-')
    .slice(0, 48)
  if (!shown || age() > 2 * DAY) return
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    if (shown === sent) return
    sent = shown
    void api.screen(shown)
  }, 1500)
}

// What the Sim does when it walks or does something (Walker.tsx whereabouts.simPose), not its idle gestures.
const MOVING = new Set<string>(['walk', 'run', 'busy', 'talk', 'sit', 'drive', 'moto', 'pedal'])

/** In the street's screen (screens/Play.tsx): the street there, the Sim moving, looked at every second; `screen`, what is on top (null: a part that says its own, the phone or the tutorial). */
export function usePremiersPas(screen: string | null) {
  useEffect(() => {
    let last = ''
    const look = () => {
      const ready = whereabouts.streetReady
      if (ready) firstStep('rue')
      if (ready && MOVING.has(whereabouts.simPose)) firstStep('bouge')
      if (screen === null) return
      const now = screen === 'rue' && !ready ? 'chargement' : screen
      if (now !== last) ((last = now), screenSeen(now))
    }
    look()
    const t = setInterval(look, 1000)
    return () => clearInterval(t)
  }, [screen])
}
