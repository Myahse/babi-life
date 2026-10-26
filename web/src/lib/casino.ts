import { useEffect, useSyncExternalStore } from 'react'
import { API_BASE } from './env'

// The money games' « taux de retour » (backend odds/): what each gives back,
// on average, for 100 staked, as the team set it (or the game's own). Said in
// each game's rules, never hidden; asked when a game opens, again every minute.

export type CasinoRate = { id: string; label: string; rate: number; natural: number; set: boolean; own: boolean; variants?: Record<string, number> }

let rates: Record<string, CasinoRate> = {}
const listeners = new Set<() => void>()
let last = 0
let asking: Promise<void> | null = null

async function ask() {
  try {
    const res = await fetch(`${API_BASE}/casino/taux`)
    if (!res.ok) return
    const d = (await res.json()) as { games: CasinoRate[] }
    rates = Object.fromEntries(d.games.map((g) => [g.id, g]))
    last = Date.now()
    listeners.forEach((f) => f())
  } catch {
    // No network: as it was.
  }
}
function refresh() {
  if (asking || Date.now() - last < 60_000) return
  asking = ask().finally(() => (asking = null))
}
const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => void listeners.delete(f)
}

/** The rates now, by game id (machines, tickets, bingo, envol, trade, roulette, 21); empty until the server answers. */
export function useCasinoRates() {
  const r = useSyncExternalStore(subscribe, () => rates)
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
  }, [])
  return r
}

/** A rate as said: « 89 % » (one decimal when it has one: « 92,5 % »). */
export const pct = (r: number) => `${(Math.round(r * 1000) / 10).toLocaleString('fr-FR')} %`

/** A prize at a game's rate, for a variant (a ticket, a bingo room) whose own is `natural`: as printed untouched (the server's game.Scaled). */
export function scaled(amount: number, rate: CasinoRate | undefined, natural?: number) {
  const nat = natural ?? rate?.natural
  if (!rate || !rate.set || !nat || Math.abs(rate.rate - nat) < 1e-9) return amount
  return Math.floor((amount * rate.rate) / nat)
}
