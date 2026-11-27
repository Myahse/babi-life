import { worldTime } from '../../lib/worldClock'

/** Minutes and seconds (or hours and minutes) from one game minute to another: the launches' countdowns. */
export function countdown(to: number, now: number) {
  const s = Math.max(0, Math.round((to - now) * 60))
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The minute the launches go by: the shared clock while the Sim keeps up with it (its own minute is whole minutes from the server), else its own. */
export function liveMinute(own: number) {
  const shared = worldTime() / 60
  return Math.abs(shared - own) < 2 ? shared : own
}
