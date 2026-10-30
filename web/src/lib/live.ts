import { useEffect } from 'react'
import type { Pose } from '../avatar/Human'
import { useSession } from '../store/session'
import { whereabouts } from '../world3d/whereabouts'
import { lang } from './i18n'
import { clockSample, localNow, serverNow } from './worldClock'

// The other players of the commune, live: a WebSocket to the API sends where
// this player's Sim is a few times a second and gets everyone else's back
// (backend/internal/live). Their Sims are drawn a moment in the past,
// between two positions received, so they glide instead of jumping.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
/** Draw others at least this far behind the latest news of them: two updates' worth. */
const DELAY = 300
/** No further behind than this (a player far off, sent every two seconds: backend live.go FarEvery). */
const MAX_DELAY = 2600
/** Past the latest news, carry on the way it was going this long at most, rather than stop dead and jump. */
const AHEAD = 250

/** What a player's Sim is doing, as sent live: walking, sitting… or an emote (game/emotes.go). */
export type LivePose = Pose
type Snap = { at: number; x: number; y: number; z: number; h: number; p: LivePose }
export type LiveSample = { x: number; y: number; z: number; h: number; p: LivePose }

const snaps = new Map<string, Snap[]>()
/** How far apart each player's news comes (ms, smoothed): the near ones every tick, the far ones every two seconds, a slow network in between. */
const gaps = new Map<string, number>()
/** Whether the connection is up (for the HUD). */
export const liveStatus = { connected: false }

/** Where another player's Sim is now, on this screen; null if not heard from. */
export function sampleLive(id: string): LiveSample | null {
  const list = snaps.get(id)
  if (!list?.length) return null
  // Drawn as far in the past as the news is spaced out (two gaps and a half): it glides between two
  // positions instead of stopping at the last one and jumping when the next comes.
  const t = serverNow() - Math.min(MAX_DELAY, Math.max(DELAY, 2.5 * (gaps.get(id) ?? 0)))
  const last = list[list.length - 1]
  if (t - last.at > 10000) return null
  let i = list.findIndex((s) => s.at > t)
  if (i === 0) return list[0]
  if (i === -1) {
    // Late news: on along its last stretch a moment (if it was moving), then it waits there.
    if (list.length < 2) return last
    const prev = list[list.length - 2]
    const span = last.at - prev.at || 1
    const over = Math.min(t - last.at, AHEAD, span)
    const k = over / span
    return { x: last.x + (last.x - prev.x) * k, y: last.y, z: last.z + (last.z - prev.z) * k, h: last.h, p: last.p }
  }
  const [a, b] = [list[i - 1], list[i]]
  const k = Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at || 1)))
  const dh = Math.atan2(Math.sin(b.h - a.h), Math.cos(b.h - a.h))
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, h: a.h + dh * k, p: k < 0.5 ? a.p : b.p }
}

// In development, for tests in the browser.
if (import.meta.env.DEV) Object.assign(globalThis, { __sampleLive: sampleLive })

/** Keeps this player connected while the street is on screen. */
/** The window event when the Sim changed somewhere (detail: its id). */
export const SIM_CHANGED = 'babi:sim-changed'
/** The window event when a Gbairai message arrived for this Sim (detail: from, name, text). */
export const MESSAGE_IN = 'babi:message-in'
/** A challenge to a fight, or its answer (components/Duel.tsx). */
export const DUEL_IN = 'babi:duel-in'
/** A game against a real player: a challenge, its answer, a move (components/pvp; detail: the server's words). */
export const PVP_IN = 'babi:pvp-in'

export function useLive(simId: string | undefined, mode: 'open' | 'street', where: string) {
  const token = useSession((s) => s.token)
  useEffect(() => {
    if (!simId || !token) return
    return connect(token, simId, mode)
  }, [simId, token, mode, where])
}

function connect(token: string, sim: string, mode: 'open' | 'street') {
  let ws: WebSocket | null = null
  let closed = false
  let retry = 1000
  let timers: ReturnType<typeof setInterval>[] = []
  let last = ''
  let lastSent = 0

  const open = () => {
    ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/live')
    ws.onopen = () => {
      retry = 1000
      liveStatus.connected = true
      ws!.send(JSON.stringify({ t: 'hello', token, sim, mode, lang: lang() }))
      const ping = () => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping', c: localNow() }))
      // A few pings to set the clock, then one now and then to keep it right.
      ;[300, 900, 1800].forEach((d) => setTimeout(ping, d))
      timers.push(setInterval(ping, 20000))
      // Where this Sim is: when it changes, and every second anyway.
      timers.push(
        setInterval(() => {
          if (ws?.readyState !== WebSocket.OPEN) return
          const s = whereabouts
          const msg = { t: 'state', x: round(s.sim[0]), y: round(s.simY), z: round(s.sim[1]), h: round(s.simHeading), p: s.simPose }
          const key = JSON.stringify(msg)
          if (key === last && performance.now() - lastSent < 1000) return
          last = key
          lastSent = performance.now()
          ws.send(key)
        }, 150),
      )
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string)
      if (m.t === 'pong') clockSample(m.c, m.s, localNow())
      else if (m.t === 'leave') (snaps.delete(m.id), gaps.delete(m.id))
      // The Sim changed (on another device of the same account, or here): load it again (screens/Play.tsx).
      else if (m.t === 'sim') window.dispatchEvent(new CustomEvent(SIM_CHANGED, { detail: m.id }))
      // A Gbairai message for this Sim: the ring and the phone button that shakes (screens/Play.tsx).
      else if (m.t === 'msg') window.dispatchEvent(new CustomEvent(MESSAGE_IN, { detail: { from: m.from, name: m.name, text: m.text } }))
      // A challenge to a fight, or its answer: look again at once (components/Duel.tsx).
      else if (m.t === 'duel') window.dispatchEvent(new CustomEvent(DUEL_IN, { detail: m.id }))
      else if (m.t === 'pvp') window.dispatchEvent(new CustomEvent(PVP_IN, { detail: m }))
      else if (m.t === 'states')
        for (const s of m.players as (Snap & { id: string })[]) {
          if (s.id === sim) continue
          const list = snaps.get(s.id) ?? []
          if (list.length && list[list.length - 1].at >= s.at) continue
          if (list.length) {
            const gap = Math.min(5000, s.at - list[list.length - 1].at)
            const was = gaps.get(s.id)
            // (Quicker to come down than to go up: a player who starts walking is followed closely at once.)
            gaps.set(s.id, was === undefined ? gap : gap < was ? (was + gap) / 2 : was * 0.8 + gap * 0.2)
          }
          list.push({ at: s.at, x: s.x, y: s.y, z: s.z, h: s.h, p: s.p })
          if (list.length > 12) list.shift()
          snaps.set(s.id, list)
        }
    }
    ws.onclose = () => {
      liveStatus.connected = false
      timers.forEach(clearInterval)
      timers = []
      if (closed) return
      // Back again soon, then less and less often.
      setTimeout(() => !closed && open(), retry)
      retry = Math.min(retry * 2, 30000)
    }
  }
  open()
  return () => {
    closed = true
    snaps.clear()
    gaps.clear()
    ws?.close()
  }
}

const round = (v: number) => Math.round(v * 100) / 100
