// One clock for everyone: the server's. Each phone measures how far its own
// clock is from the server's and every animation in the world reads the
// shared time, so two players looking at the same street see the same
// passers-by at the same spot, the same step of the same dance.

import { API_BASE as BASE } from './env'

/** The game's epoch (Monday 1 January 2024, UTC), as on the server. */
const EPOCH_MS = Date.UTC(2024, 0, 1)

/** A clock that never goes back (Date.now can jump when the phone resyncs). */
const origin = performance.timeOrigin ?? Date.now() - performance.now() // (no timeOrigin in the app's engine)
const local = () => origin + performance.now()

let offset = 0 // server − local, ms
let bestRtt = Infinity
let synced = false

/**
 * Takes one measurement: sent and received on the local clock, the server's
 * time in between. The quickest round trip is the most accurate; later ones
 * nudge the offset instead of jumping, so nothing on screen skips.
 */
export function clockSample(sentAt: number, serverMs: number, receivedAt: number) {
  const rtt = receivedAt - sentAt
  if (rtt < 0 || rtt > Math.max(1500, bestRtt * 3)) return
  bestRtt = Math.min(bestRtt, rtt)
  const target = serverMs + rtt / 2 - receivedAt
  offset = synced ? offset + (target - offset) * 0.25 : target
  synced = true
}

/** Now, on the server's clock (ms since 1970). */
export const serverNow = () => local() + offset

let frozen: number | null = null
/** Holds the shared clock at one instant (null lets it run): for rendering a video frame by frame. */
export function freezeWorldTime(t: number | null) {
  frozen = t
}

/** Seconds since the game's epoch on the shared clock: what animations read. */
export const worldTime = () => frozen ?? (serverNow() - EPOCH_MS) / 1000

/** The local clock, for timing a sample. */
export const localNow = local

/** A few quick measurements against the API, then one every five minutes. */
export async function syncClock() {
  for (let i = 0; i < 4; i++) {
    const sent = local()
    try {
      const res = await fetch(`${BASE}/time`, { cache: 'no-store' })
      const { now } = (await res.json()) as { now: number }
      clockSample(sent, now, local())
    } catch {
      return // offline: the phone's own clock will do
    }
  }
}

let started = false
export function startClockSync() {
  if (started) return
  started = true
  void syncClock()
  setInterval(() => void syncClock(), 5 * 60 * 1000)
}
