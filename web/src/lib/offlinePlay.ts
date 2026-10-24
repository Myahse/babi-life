import { api, ApiError, offlinePlay } from './api'
import { keptData } from './offline'
import { actionLength, duration, openAt, predict } from '../game/rules'
import { useSession } from '../store/session'
import type { ActionResult, ChatMessage, Interaction, JournalEvent, Outcome, Sim } from './types'

// Played without network: the game goes on on the phone as the server would
// have it (the time it's open and seen goes by, an action started at a place
// takes its time and pays at the end, put away it's held), and what the
// player does is kept, in order, with when: an action started or stopped, a
// défi, a message, and every minute that the game is there. Once online,
// before anything else, it's all sent to the server (backend sims/sync.go),
// which plays it again on its own rules and answers with the Sim as it is:
// that one counts, the phone only guessed. Kept on the phone until sent
// (localStorage: the game closed offline and opened again online, it's sent then).
// Not offline: what needs others or the server's draw (a trip, a match on a
// court, a purchase in an app, a chat in the street): « pas de réseau ».

type Step = { at: number; do: 'beat' | 'pause' | 'interact' | 'stop' | 'defi' | 'message'; placeId?: string; interactionId?: string; label?: string; kind?: string; score?: number; to?: string; body?: string }
/** A Sim played offline: as the phone has it at `at` (ms), whether the game is there, what was done. */
type Played = { sim: Sim; at: number; playing: boolean; steps: Step[]; journal: JournalEvent[] }

const KEY = 'babi.offline.'
/** The server's offlineAfter and heartbeat (backend sims/clock.go): silent longer, the Sim lived a minute more, then held. */
const SILENT = 150_000
const HEARTBEAT = 60_000

const played = new Map<string, Played>()
/** The Sim as the server last sent it, and when: where offline play starts from. */
const seen = new Map<string, { sim: Sim; at: number; journal: JournalEvent[] }>()

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage)
try {
  const ls = storage()
  for (let i = 0; ls && i < ls.length; i++) {
    const k = ls.key(i)
    if (k?.startsWith(KEY)) played.set(k.slice(KEY.length), JSON.parse(ls.getItem(k)!) as Played)
  }
} catch {
  // Nothing kept, or unreadable: nothing to send.
}
function save(id: string, p: Played) {
  played.set(id, p)
  try {
    storage()?.setItem(KEY + id, JSON.stringify(p))
  } catch {
    // Full: it's still in memory while the game is open.
  }
}
function drop(id: string) {
  played.delete(id)
  try {
    storage()?.removeItem(KEY + id)
  } catch {
    // Nothing to remove.
  }
}

const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const shown = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
let lines = 0
const line = (kind: JournalEvent['kind'], text: string, money: number, gameTime: number): JournalEvent => ({ id: -++lines, kind, text, money, gameTime: Math.floor(gameTime), at: new Date().toISOString() })

/** The action picked at a place (Play): what it is there (its length, cost, effect), for the phone to play it. */
let pick: { placeId: string; it: Interaction; kind: string; name: string } | null = null
export function picking(placeId: string, it: Interaction, place: { kind: string; name: string }) {
  pick = { placeId, it, ...place }
}

/**
 * Synced: the server's answer, for the game on screen (Play). Sent as the game opened again
 * (before Play was there): told once it is (`late`: its Sim is old by then, only what was counted).
 */
type Synced = (res: ActionResult, late?: boolean) => void
const synced = new Set<Synced>()
let untold: ActionResult | null = null
export function onSynced(f: Synced) {
  synced.add(f)
  if (untold) {
    const res = untold
    untold = null
    setTimeout(() => f(res, true), 0)
  }
  return () => void synced.delete(f)
}

/* ---------- The Sim's time, on the phone (mirrors backend sims/clock.go) ---------- */

/** Brought up to `now`: lived while the game was there, held while it was away. */
function settle(p: Played, now: number): JournalEvent[] {
  const ms = now - p.at
  p.at = now
  if (ms <= 0) return []
  if (!p.playing) return (hold(p.sim, ms / 60000), [])
  if (ms > SILENT) {
    const ev = live(p.sim, HEARTBEAT / 60000)
    hold(p.sim, (ms - HEARTBEAT) / 60000)
    return ev
  }
  return live(p.sim, ms / 60000)
}

function live(s: Sim, mins: number): JournalEvent[] {
  const events: JournalEvent[] = []
  const a = s.activity
  if (a && s.gameMinutes + mins >= a.end) {
    const to = Math.max(0, a.end - s.gameMinutes)
    s.needs = predict(s, to)
    s.gameMinutes += to
    mins -= to
    s.activity = null
    if (a.kind === 'travel' && a.trip) {
      s.city = a.trip.city
      s.commune = a.trip.commune
      events.push(line('travel', a.trip.label, -a.trip.fare, a.start))
    } else {
      const cost = a.interaction.cost
      if (cost < 0) s.money -= cost
      events.push(line('interaction', `${a.placeName} — ${a.interaction.label}`, -cost || 0, a.start))
    }
  }
  s.needs = predict(s, mins)
  if (s.activity) s.activity.applied = Math.min(1, Math.max(0, (s.gameMinutes + mins - s.activity.start) / Math.max(1, s.activity.end - s.activity.start)))
  s.gameMinutes += mins
  return events
}

function hold(s: Sim, mins: number) {
  s.gameMinutes += mins
  if (s.bornAt) s.bornAt += mins
  if (s.activity) {
    s.activity.start += mins
    s.activity.end += mins
  }
  s.friends?.forEach((f) => (f.seen += mins))
}

/* ---------- Answered on the phone ---------- */

async function playedOf(id: string): Promise<Played | null> {
  const had = played.get(id)
  if (had) return had
  let from = seen.get(id)
  if (!from) {
    // Opened without network: the Sim as it was kept, from now.
    const kept = await keptData<ActionResult>(`${useSession.getState().user?.id ?? 'guest'} /sims/${id}`)
    if (!kept?.sim) return null
    from = { sim: kept.sim, at: Date.now(), journal: kept.journal ?? [] }
  }
  const p: Played = { sim: copy(from.sim), at: from.at, playing: shown(), steps: [], journal: from.journal.slice(0, 30) }
  played.set(id, p)
  return p
}

function step(id: string, p: Played, s: Omit<Step, 'at'>) {
  // In order, one after the other even within the same millisecond (a stop, then what takes over).
  const at = Math.max(Date.now(), (p.steps.at(-1)?.at ?? 0) + 1)
  p.steps.push({ at, ...s })
  p.playing = s.do !== 'pause'
  save(id, p)
}

function result(id: string, p: Played, outcome: Outcome, fresh: JournalEvent[]): ActionResult {
  p.journal = [...fresh.slice().reverse(), ...p.journal].slice(0, 30)
  save(id, p)
  return { sim: copy(p.sim), outcome, journal: p.journal, fresh }
}

const refuse = (text: string): never => {
  throw new ApiError(422, text)
}
const needsNetwork = (text: string): never => {
  throw new ApiError(0, text)
}

/** What the phone answers in the server's place: these reads and writes on a Sim; the rest, not. */
const ANSWERED = new Set(['pause', 'interact', 'stop', 'defi', 'gbairai'])

async function answer(method: string, path: string, body: unknown): Promise<unknown> {
  const m = path.match(/^\/sims\/([^/?]+)(?:\/([a-z]+)(?:\/([^/?]+))?)?(?:\?|$)/)
  if (!m) return undefined
  const [, id, what, other] = m
  const req = (typeof body === 'string' && body ? JSON.parse(body) : {}) as Record<string, unknown>
  const read = method === 'GET' && !what && !other
  if (!read && !(method === 'POST' && ANSWERED.has(what) && (what === 'gbairai') === !!other)) return undefined
  // An action the phone can't play (not picked at a place here: the happening in the street, a home on Dodo…).
  const k = pick
  if (what === 'interact' && (!k || k.placeId !== req.placeId || k.it.id !== req.interactionId)) return undefined
  const p = await playedOf(id)
  if (!p) return undefined
  const fresh = settle(p, Date.now())
  const s = p.sim
  if (read) {
    // The game open and seen asks every minute: it's there.
    if (shown()) step(id, p, { do: 'beat' })
    return result(id, p, { text: '', money: 0 }, fresh)
  }
  switch (what) {
    case 'pause':
      step(id, p, { do: 'pause' })
      return result(id, p, { text: '', money: 0 }, fresh)
    case 'interact': {
      const { it } = k!
      if (/^play-/.test(it.id)) needsNetwork('Un match se joue avec les autres : il faut le réseau.')
      if (s.activity) refuse("ton perso est occupé·e : arrête d'abord ce qu'il fait")
      if (!openAt(it, s.gameMinutes)) refuse('pas disponible à cette heure ou ce jour-là')
      if (it.cost > 0 && s.money < it.cost) refuse("pas assez d'argent")
      const minutes = actionLength(it.minutes)
      if (it.cost > 0) s.money -= it.cost
      s.activity = {
        kind: 'do', placeId: k!.placeId, placeKind: k!.kind, placeName: k!.name, interaction: { ...it, minutes },
        start: s.gameMinutes, end: s.gameMinutes + Math.max(minutes, 1), applied: 0, ...(it.id === 'work' ? { career: s.career } : {}),
      }
      step(id, p, { do: 'interact', placeId: k!.placeId, interactionId: it.id, label: it.label })
      return result(id, p, { text: `${s.firstName} : ${it.label} (${duration(minutes)})`, money: -Math.max(it.cost, 0) }, fresh)
    }
    case 'stop': {
      const a = s.activity
      if (!a) return refuse('ton perso ne fait rien')
      if (a.kind === 'travel') refuse("tu es en route : attends d'arriver")
      s.activity = null
      const cost = a.interaction.cost
      const earned = cost < 0 ? Math.round(-cost * a.applied) : 0
      s.money += earned
      step(id, p, { do: 'stop' })
      const ev = line('interaction', `${a.placeName} — ${a.interaction.label} (arrêté avant la fin)`, cost > 0 ? -cost : earned, a.start)
      return result(id, p, { text: ev.text, money: ev.money }, [...fresh, ev])
    }
    case 'defi': {
      const a = s.activity
      if (!a || a.kind !== 'do') return refuse("ce défi se joue pendant l'activité")
      if (a.defi) refuse('défi déjà joué cette fois-ci')
      const score = Math.max(0, Math.min(100, Number(req.score) || 0))
      a.defi = Math.max(1, score)
      step(id, p, { do: 'defi', kind: String(req.kind), score })
      return result(id, p, { text: `Défi ${score}/100. Le bonus sera compté au retour du réseau.`, money: 0 }, fresh)
    }
    default: {
      // A message to a friend (Gbairai): it leaves once online.
      const text = String(req.body ?? '').trim()
      if (!text) refuse('message vide')
      step(id, p, { do: 'message', to: decodeURIComponent(other!), body: text })
      save(id, p)
      return { id: -Date.now(), mine: true, body: text, at: new Date().toISOString() } satisfies ChatMessage
    }
  }
}

/* ---------- Sent once online ---------- */

let flushing: Promise<void> | null = null
async function flushAll() {
  for (const [id, p] of [...played]) {
    if (!p.steps.length) {
      drop(id)
      continue
    }
    const sent = p.steps.length
    try {
      const res = await api.sync(id, p.steps)
      // Done offline while it was on its way: for the next time.
      const now = played.get(id)
      if (now && now.steps.length > sent) save(id, { ...now, steps: now.steps.slice(sent) })
      else drop(id)
      if (synced.size) synced.forEach((f) => f(res))
      else untold = res
    } catch (e) {
      // Still no network: the next time. The server won't have it (not this account's Sim any more): nothing to wait for.
      if (e instanceof ApiError && e.status === 0) return
      drop(id)
    }
  }
}

offlinePlay.answer = (method, path, body) => answer(method, path, body)
offlinePlay.seen = (sim, journal) => {
  seen.set(sim.id, { sim, at: Date.now(), journal: journal ?? seen.get(sim.id)?.journal ?? [] })
  // Back online with nothing left to send: the phone plays from the server's again.
  if (played.get(sim.id)?.steps.length === 0) played.delete(sim.id)
}
offlinePlay.flush = () => {
  if (!played.size || !useSession.getState().token) return Promise.resolve()
  return (flushing ??= flushAll().finally(() => (flushing = null)))
}
/** Something played offline is waiting to be sent. */
export const pendingOffline = () => [...played.values()].some((p) => p.steps.length > 0)
