import { useEffect } from 'react'
import { API_BASE } from './env'
import { useSession } from '../store/session'
import { featuresKnown, keyOpenNow, onFeatures } from './features'
import { inApp } from './native'
import { lightPhoneNow } from './lightPhone'

// The update « mesures-chargement » (backend auth/perf.go, the admin's « Chargement »): how long the game takes to
// load on the players' own phones, and whether they leave while it does. Each loading is one small sample:
//   - « start »: from the page's start (the game opened straight away) or the game screen's (after the home page),
//     to the HUD shown (its buttons work: the first interaction possible), the street's first chunk drawn, the
//     street « ready » (most pieces round the Sim drawn: the « Ta rue se construit » card gone), the first tap;
//     the frames a second once it stands (world3d/open/slowProbe.tsx);
//   - « trip »: another commune's street, from its start, and in total from the departure (api.travel).
// With each, the street's chunks found in the phone's cache, built afresh or still in memory, the map tiles kept
// or downloaded and their bytes (the street's workers count them, world3d/open/chunkJob.ts), the page's own bytes
// (PerformanceResourceTiming), the device, and whether the page was hidden or closed before the street was ready
// (« quit », with the screen it was on, lib/premiersPas.ts).
// Cheap: nothing at all while the update is shut; samples kept here and sent together, the start's once it's
// over, the trips' when the page is hidden (or three are waiting), at most MAX_SENDS requests a page.

export const MESURES = 'mesures-chargement'
const HEARD_KEY = 'babi.mesures'
const MAX_SENDS = 5
/** The most samples a request carries (the server takes 8). */
const PER_SEND = 6
/** How long a start waits for the street's frames a second once ready. */
const FPS_WAIT = 25_000
/** A departure older than this is not the trip of the street now starting. */
const DEPART_FRESH = 5 * 60_000

type Kind = 'start' | 'trip'
type Counts = { chunkHit: number; chunkMiss: number; memHit: number; tileHit: number; tileMiss: number; tileBytes: number; netBytes: number }
type Phase = { kind: Kind; commune: string; t0: number; depart?: number; hud?: number; chunk?: number; ready?: number; tap?: number; fps?: number; base: Counts; closed: boolean }
type Sample = { kind: Kind; commune: string; hud: number; chunk: number; ready: number; tap: number; total: number; quit: boolean; screen: string; chunkHit: number; chunkMiss: number; memHit: number; tileHit: number; tileMiss: number; tileKB: number; netKB: number; fps: number }

const counts: Counts = { chunkHit: 0, chunkMiss: 0, memHit: 0, tileHit: 0, tileMiss: 0, tileBytes: 0, netBytes: 0 }
const now = () => (typeof performance === 'undefined' ? 0 : performance.now())

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
/** Open as the server says, or before it has answered, as it said last time (a player leaving in the first seconds is the point). */
const on = () => (featuresKnown() ? keyOpenNow(MESURES) : read(HEARD_KEY) === '1')
onFeatures(() => {
  if (!featuresKnown()) return
  try {
    localStorage.setItem(HEARD_KEY, keyOpenNow(MESURES) ? '1' : '0')
  } catch {
    // Private mode: as the server says, once it has.
  }
})

// The page opened straight on the game (signed in, on /jeu or /): its start counts from the page's own.
const direct = typeof location !== 'undefined' && !!useSession.getState().token && (location.pathname === '/jeu' || location.pathname === '/')
let start: Phase | null = direct ? { kind: 'start', commune: '', t0: 0, base: { ...counts }, closed: false } : null
/** The loading under way (the start, or the last trip's street). */
let current: Phase | null = start
let departAt = 0
let sends = 0
const queue: Sample[] = []
let screenNow: () => string = () => ''
/** The game screen has been there (useMesures). */
let gameSeen = false
const device = { strong: false, tier: '' }

/** The page's bytes downloaded (each resource's transferSize: 0 when it came from the browser's cache). */
if (typeof PerformanceObserver !== 'undefined') {
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) counts.netBytes += (e as PerformanceResourceTiming).transferSize || 0
    }).observe({ type: 'resource', buffered: true })
    const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
    counts.netBytes += nav?.transferSize ?? 0
  } catch {
    // An old browser: no bytes.
  }
}

const ms = (at: number | undefined, from: number) => (at === undefined ? 0 : Math.max(1, Math.min(600_000, Math.round(at - from))))
const clampN = (n: number) => Math.max(0, Math.min(2000, n))

function sampleOf(p: Phase, quit: boolean): Sample {
  const d = (k: keyof Counts) => counts[k] - p.base[k]
  return {
    kind: p.kind,
    commune: p.commune,
    hud: ms(p.hud, p.t0),
    chunk: ms(p.chunk, p.t0),
    ready: ms(p.ready, p.t0),
    tap: ms(p.tap, p.t0),
    total: p.depart === undefined ? 0 : ms(p.ready ?? (quit ? now() : undefined), p.depart),
    quit,
    // (The game calls it « rue » from the first chunk on; not ready yet, it was still loading.)
    screen: quit ? (screenNow() === 'rue' && p.ready === undefined ? 'chargement' : screenNow()) : '',
    chunkHit: clampN(d('chunkHit')),
    chunkMiss: clampN(d('chunkMiss')),
    memHit: clampN(d('memHit')),
    tileHit: clampN(d('tileHit')),
    tileMiss: clampN(d('tileMiss')),
    tileKB: Math.min(500_000, Math.round(d('tileBytes') / 1024)),
    netKB: Math.min(500_000, Math.round(d('netBytes') / 1024)),
    fps: p.fps === undefined ? 0 : Math.max(1, Math.min(240, Math.round(p.fps))),
  }
}

/** A loading over: its sample waits to go (quit: the page went before the street was ready). */
function close(p: Phase | null, quit = false) {
  if (!p || p.closed) return
  p.closed = true
  if (!on()) return
  queue.push(sampleOf(p, quit))
}

function deviceNow() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } }
  const cores = nav.hardwareConcurrency ?? 0
  const mem = nav.deviceMemory ?? 0
  // The classes the admin splits by: a small phone as lib/device.ts reads one, a computer with a real graphics card (world3d/open/lumiere.ts).
  const weak = (cores > 0 && cores <= 4) || (mem > 0 && mem <= 4)
  const net = nav.connection?.effectiveType ?? ''
  return {
    class: weak ? 'faible' : device.strong ? 'fort' : 'normal',
    cores: Math.min(256, cores),
    mem: Math.min(64, mem),
    dpr: Math.min(8, Math.round((window.devicePixelRatio || 1) * 100) / 100),
    tier: device.tier,
    light: lightPhoneNow(),
    net: ['slow-2g', '2g', '3g', '4g'].includes(net) ? net : '',
    app: inApp(),
  }
}

/** Sends what waits (keepalive: the page may be going). No Idempotency-Key, unlike api.ts: a lost sample is no harm, and one key is a row more on the server. */
function flush() {
  const token = useSession.getState().token
  if (!on() || !token) return void (queue.length = 0)
  while (queue.length && sends < MAX_SENDS) {
    sends++
    const body = JSON.stringify({ device: deviceNow(), samples: queue.splice(0, PER_SEND) })
    void fetch(`${API_BASE}/me/perf`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body, keepalive: true }).catch(() => undefined)
  }
  queue.length = 0
}

// Hidden (the app left, the tab changed, the page closing): what is loading counts as left during it, all goes now.
if (typeof document !== 'undefined') {
  const leave = () => {
    // Opened on the game but gone elsewhere before its screen came (to make a perso): no game loading to count.
    if (start && !gameSeen && location.pathname !== '/jeu' && location.pathname !== '/') start.closed = true
    for (const p of [start, current]) if (p && !p.closed) close(p, p.ready === undefined)
    // Gone during a trip, before the new street even started (the ride's own screen): a trip left too.
    if (departAt && now() - departAt < DEPART_FRESH) close({ kind: 'trip', commune: '', t0: departAt, depart: departAt, base: { ...counts }, closed: false }, true)
    departAt = 0
    flush()
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && leave())
  addEventListener('pagehide', leave)
  // The first tap or key once the HUD is there: the game answered a real player.
  const tapped = () => {
    if (start && !start.closed && start.hud !== undefined && start.tap === undefined) start.tap = now()
  }
  addEventListener('pointerdown', tapped, { capture: true, passive: true })
  addEventListener('keydown', tapped, { capture: true, passive: true })
}

/** The game screen (screens/Play.tsx): opened, its HUD shown or not; and the screen's name for a player who leaves (premiersPas). */
export function useMesures(hud: boolean, screen: () => string) {
  // (In the render, not an effect: the street inside may start before this screen's effects run.)
  screenNow = screen
  gameSeen = true
  // Come to the game from the home page or the sign-in: its start counts from here.
  if (!start && !current) current = start = { kind: 'start', commune: '', t0: now(), base: { ...counts }, closed: false }
  useEffect(() => {
    if (hud && start && start.hud === undefined) start.hud = now()
  }, [hud])
}

/** Told by the street (world3d/open/OpenWorld.tsx) as it opens: a commune's street starts; the light's tier, a strong computer. */
export function streetStarts(commune: string, info: { tier: string; strong: boolean }) {
  device.tier = info.tier
  device.strong = info.strong
  // (No game screen opened: a lab drawing the street. Nothing measured.)
  if (!current) return
  // The game's first street: the start's.
  if (current.kind === 'start' && !current.commune) return void (current.commune = commune)
  const t = now()
  const fresh = !!departAt && t - departAt < DEPART_FRESH
  // The same commune's street again, no trip (back from a room, React's development double mount): not a loading to count.
  if (current.commune === commune && !fresh) return
  // Another before this one was ready (a trip on at once): sent as it got.
  close(current)
  current = { kind: 'trip', commune, t0: t, depart: fresh ? departAt : undefined, base: { ...counts }, closed: false }
  departAt = 0
}

/** A trip to another commune asked (lib/api.ts travel). */
export function departed() {
  departAt = now()
}

/** How far the street around the Sim is drawn (world3d/streetProgress.ts): its first piece, then most of it (the card gone). */
export function streetProgress(have: number, want: number) {
  const p = current
  if (!p || p.closed) return
  if (have > 0 && p.chunk === undefined) p.chunk = now()
  if (want > 0 && have >= Math.max(1, Math.ceil(want * 0.6)) && p.ready === undefined) {
    p.ready = now()
    if (p.kind === 'trip' || p.fps !== undefined) return void (close(p), p.kind === 'start' ? flush() : queue.length >= 3 && flush())
    // The start waits a little for the frames a second (the street's first seconds).
    setTimeout(() => {
      if (!p.closed) (close(p), flush())
    }, FPS_WAIT)
  }
}

/** The street's frames a second, the median of its first seconds (world3d/open/slowProbe.tsx). */
export function streetFps(fps: number) {
  const p = current
  if (!p || p.closed || p.fps !== undefined) return
  p.fps = fps
  if (p.kind === 'start' && p.ready !== undefined) (close(p), flush())
}

/** Whether the street's frames are worth measuring (the update open, a loading under way). */
export const wantsFps = () => on() && !!current && !current.closed

/** A chunk of street arrived: from the phone's cache, built afresh, or still in memory (OpenWorld's BUILT). */
export function chunkSeen(from: 'cache' | 'built' | 'mem') {
  if (from === 'cache') counts.chunkHit++
  else if (from === 'built') counts.chunkMiss++
  else counts.memHit++
}

/** The map tiles a worker found kept or downloaded since its last reply (world3d/open/chunkJob.ts). */
export function tilesSeen(t: { hit: number; miss: number; bytes: number } | undefined) {
  if (!t) return
  counts.tileHit += t.hit
  counts.tileMiss += t.miss
  counts.tileBytes += t.bytes
}
