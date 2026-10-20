import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Car, Clock3, Crown, Gem, Hand, MessageCircle, Minus, PiggyBank, Plus, Snowflake, UserRound, X } from 'lucide-react'
import type { Commune, Ride, RideApp, RideClass, World } from '../lib/types'
import { amount, clock, tollOf, withToll } from '../game/rules'
import { routeIn } from '../game/roads'
import { classFare, inkOn, rideLook } from '../game/rides'
import { AppLogo } from './AppLogo'
import { DriverCall, newCall, type Call } from './DriverCall'
import { aCommune, deCommune } from '../lib/french'

/** A ride being arranged in town: hailing at the roadside, or booking an app. */
export type FlowRequest = { cityId: string; from: Commune; to: Commune; kind: 'street' | string; offer?: number; fare: number; party: number; money?: number }

export function RideFlow({ world, req, gameMinutes, onBoard, onClose }: { world: World; req: FlowRequest; gameMinutes: number; onBoard: (ride: Ride, label: string) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true">
      {req.kind === 'street' ? <Roadside world={world} req={req} gameMinutes={gameMinutes} onBoard={onBoard} onClose={onClose} /> : <AppBooking world={world} req={req} onBoard={onBoard} onClose={onClose} />}
    </div>
  )
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const chance = (p: number) => Math.random() < p
function weighted<T>(items: [T, number][]): T {
  let r = Math.random() * items.reduce((t, [, w]) => t + w, 0)
  for (const [x, w] of items) if ((r -= w) <= 0) return x
  return items[items.length - 1][0]
}
const rush = (h: number) => (h >= 6 && h < 9) || (h >= 16 && h < 20)
const night = (h: number) => h >= 22 || h < 5

function Party({ party, setParty }: { party: number; setParty: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs font-extrabold whitespace-nowrap text-[var(--color-ink-soft)]">
      <UserRound size={14} /> Vous êtes
      <button className="icon-btn h-7 w-7 bg-[var(--color-canvas)]" onClick={() => setParty(Math.max(1, party - 1))} aria-label="Un de moins" disabled={party <= 1}>
        <Minus size={14} />
      </button>
      <span className="w-4 text-center text-sm text-[var(--color-ink)] tabular-nums">{party}</span>
      <button className="icon-btn h-7 w-7 bg-[var(--color-canvas)]" onClick={() => setParty(Math.min(4, party + 1))} aria-label="Un de plus" disabled={party >= 4}>
        <Plus size={14} />
      </button>
    </div>
  )
}

/* ---------------- At the roadside ---------------- */

type Kind = 'woro' | 'compteur' | 'gbaka' | 'car' | 'moto'
type Passing = { id: number; kind: Kind; color: string; trim?: string; taken: number; dest: string; refuses: boolean; born: number }
type Talk = { who: 'toi' | 'chauffeur' | 'info'; text: string }

const PASS_MS = 6500 // a vehicle crossing the scene
const STOP_AT = 0.46
const CAR_COLORS = ['#f1f3f5', '#212529', '#adb5bd', '#c92a2a', '#1c7ed6', '#868e96']

/**
 * Waiting by the road. Vehicles go by at random: a woro-woro (four seats,
 * maybe already full, going somewhere that may not be your way), a taxi
 * compteur (stops only if it's empty, then takes your group), and traffic you
 * can't hail. Wave, ask, get in.
 */
function Roadside({ world, req, gameMinutes, onBoard, onClose }: { world: World; req: FlowRequest; gameMinutes: number; onBoard: (ride: Ride, label: string) => void; onClose: () => void }) {
  const { from, to } = req
  const hour = clock(gameMinutes).hour
  const woroHere = !!from.woro && !from.woro.none
  // Over the 3e pont, the toll is on the fare.
  const toll = tollOf(routeIn(world, req.cityId, from.id, to.id)?.bridges)
  const communes = world.cities.find((c) => c.id === req.cityId)!.communes.filter((c) => c.id !== from.id)
  const [party, setParty] = useState(req.party)
  const [car, setCar] = useState<Passing | null>(null)
  const [now, setNow] = useState(Date.now())
  const [stopped, setStopped] = useState<{ at: number; yes: boolean | null } | null>(null)
  const [talk, setTalk] = useState<Talk[]>([{ who: 'info', text: woroHere ? `Les woro-woro ${from.woro!.label}s ${deCommune(from.name)} et les taxis compteur passent par ici.` : `Pas de woro-woro ${aCommune(from.name)} : guette un taxi compteur libre.` }])
  const [waved, setWaved] = useState(false)
  const nextId = useRef(1)
  const timers = useRef<number[]>([])
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const say = (t: Talk) => setTalk((x) => [...x.slice(-3), t])

  // The clock of the scene.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50)
    return () => clearInterval(id)
  }, [])

  // Send the next vehicle after a random gap; fewer at night.
  const spawn = () => {
    const kind = weighted<Kind>([
      ['woro', woroHere ? (night(hour) ? 0.2 : 0.42) : 0],
      ['compteur', 0.26],
      ['gbaka', night(hour) ? 0.04 : 0.12],
      ['car', 0.16],
      ['moto', 0.05],
    ])
    const busy = rush(hour)
    const taken =
      kind === 'woro' ? weighted<number>(busy ? [[0, 0.05], [1, 0.1], [2, 0.2], [3, 0.3], [4, 0.35]] : [[0, 0.25], [1, 0.25], [2, 0.2], [3, 0.15], [4, 0.15]]) : kind === 'compteur' ? (chance(busy ? 0.55 : 0.4) ? 1 + Math.floor(Math.random() * 3) : 0) : 1
    const color = kind === 'woro' ? from.woro!.color! : kind === 'compteur' ? (world.compteur?.color ?? '#ff7a00') : kind === 'gbaka' ? '#f4c430' : kind === 'moto' ? '#c92a2a' : pick(CAR_COLORS)
    setCar({ id: nextId.current++, kind, color, trim: kind === 'woro' ? from.woro?.trim : kind === 'gbaka' ? '#00a862' : undefined, taken, dest: chance(0.42) ? to.id : pick(communes).id, refuses: chance(0.12), born: Date.now() })
    setWaved(false)
  }
  useEffect(() => {
    later(900, spawn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pos = !car ? -1 : stopped ? STOP_AT : (now - car.born) / PASS_MS
  // Gone past: the next one comes after a gap.
  useEffect(() => {
    if (car && !stopped && pos > 1.15) {
      setCar(null)
      later((night(hour) ? 3000 : 1200) + Math.random() * (night(hour) ? 6000 : 3500), spawn)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos > 1.15])

  const free = car ? 4 - car.taken : 0
  const hailable = !!car && !stopped && !waved && (car.kind === 'woro' || car.kind === 'compteur') && pos > 0.03 && pos < STOP_AT
  const destName = (id: string) => communes.find((c) => c.id === id)?.name ?? to.name

  const leave = (c: Passing) => {
    // Pull away: carry on from the stop.
    setStopped(null)
    setCar({ ...c, born: Date.now() - STOP_AT * PASS_MS })
  }

  const wave = () => {
    if (!car) return
    setWaved(true)
    say({ who: 'toi', text: '✋' })
    if (car.kind === 'woro' && free === 0) return later(500, () => say({ who: 'info', text: 'Plein ! Il ne s\'arrête pas.' }))
    if (car.kind === 'woro' && free < party) return later(500, () => say({ who: 'info', text: `Il ne reste que ${free} place${free > 1 ? 's' : ''}, vous êtes ${party}. Il passe.` }))
    if (car.kind === 'compteur' && car.taken > 0) return later(500, () => say({ who: 'info', text: 'Occupé : il y a déjà un client, il ne s\'arrête pas.' }))
    // It stops: say where you're going, the driver says yes or no.
    const c = car
    setStopped({ at: Date.now(), yes: null })
    later(600, () => say({ who: 'toi', text: `${to.name} ?` }))
    later(1500, () => {
      const yes = c.kind === 'woro' ? c.dest === to.id : !c.refuses
      say({ who: 'chauffeur', text: yes ? (c.kind === 'woro' ? `${to.name}, oui ! Monte, ${free - party > 0 ? `il reste de la place derrière` : 'on part'}.` : `${to.name} ? Ok, monte.`) : c.kind === 'woro' ? `Non, moi je vais ${aCommune(destName(c.dest))}.` : `Non, ${to.name} c'est trop loin avec les bouchons.` })
      setStopped({ at: Date.now(), yes })
      if (!yes) later(1400, () => leave(c))
    })
  }

  const board = () => {
    if (!car) return
    const app = car.kind as 'woro' | 'compteur'
    onBoard({ app, party }, `${app === 'woro' ? 'En woro-woro' : 'En taxi compteur'} vers ${to.name}`)
  }

  const woroFare = req.fare * party
  const label = !car
    ? 'La route est calme…'
    : car.kind === 'woro'
      ? `Woro-woro ${from.woro?.label} · ${free === 0 ? 'plein' : `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`}`
      : car.kind === 'compteur'
        ? `Taxi compteur · ${car.taken ? 'occupé' : 'libre'}`
        : car.kind === 'gbaka'
          ? 'Gbaka'
          : car.kind === 'moto'
            ? 'Moto'
            : 'Voiture'

  return (
    <div className="animate-pop w-full max-w-[400px] overflow-hidden rounded-[28px] bg-[var(--color-surface)] shadow-2xl">
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="label">Au bord de la route · {from.name}</div>
          <div className="font-display text-xl leading-tight font-extrabold">Direction {to.name}</div>
        </div>
        <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Abandonner">
          <X size={18} />
        </button>
      </div>

      {/* The road: vehicles go by from left to right. */}
      <div className="relative h-36 overflow-hidden bg-[linear-gradient(#9dd3a8_0_28%,#c9b28a_28%_34%,#3c4152_34%_92%,#c9b28a_92%)]">
        <div className="absolute top-[62%] right-0 left-0 h-[3px] bg-[repeating-linear-gradient(90deg,#f8f9fa_0_22px,transparent_22px_44px)] opacity-80" />
        <div className="absolute bottom-[8%] left-[46%] flex flex-col items-center">
          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[var(--color-orange)] text-white shadow">
            <Hand size={14} />
          </span>
          <span className="mt-0.5 rounded bg-black/40 px-1 text-[9px] font-extrabold text-white">toi{party > 1 ? ` +${party - 1}` : ''}</span>
        </div>
        {car && (
          <div className="absolute top-[30%] transition-[left] duration-300 ease-out" style={{ left: `${pos * 130 - 22}%` }}>
            <div className={`mb-1 w-max -translate-x-1/4 rounded-full px-2 py-0.5 text-[10px] font-extrabold shadow ${hailable ? 'bg-white text-[var(--color-ink)]' : 'bg-black/50 text-white'}`}>{label}</div>
            <VehicleSide kind={car.kind} color={car.color} trim={car.trim} taken={car.taken} />
          </div>
        )}
      </div>

      <div className="flex min-h-[112px] flex-col justify-end gap-1.5 bg-[var(--color-canvas)] px-4 py-3">
        {talk.map((t, i) => (
          <div key={i} className={`animate-pop max-w-[85%] rounded-2xl px-3 py-1.5 text-sm font-bold ${t.who === 'toi' ? 'self-end rounded-br-sm bg-[var(--color-orange)] text-white' : t.who === 'chauffeur' ? 'self-start rounded-bl-sm bg-white' : 'self-center bg-transparent text-center text-xs text-[var(--color-ink-soft)]'}`}>
            {t.text}
          </div>
        ))}
      </div>

      <div className="grid gap-3 p-4">
        {stopped?.yes ? (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-soft" onClick={() => car && leave(car)}>
              Laisser passer
            </button>
            <button className="btn btn-emerald text-[15px] whitespace-nowrap" onClick={board}>
              Monter · {amount(car?.kind === 'woro' ? woroFare : estimateMeter(req.fare, toll))} Djai
            </button>
          </div>
        ) : (
          <button className="btn" onClick={wave} disabled={!hailable}>
            <Hand size={20} /> {hailable ? 'Faire signe' : stopped ? 'Il s\'arrête…' : car && (car.kind === 'woro' || car.kind === 'compteur') && pos < 0.03 ? 'Il arrive…' : 'Attends un taxi…'}
          </button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Party party={party} setParty={setParty} />
          <span className="text-[11px] font-extrabold text-[var(--color-ink-soft)]">
            {woroHere ? `Woro ${amount(req.fare)} Djai/place · ` : ''}compteur ~{amount(estimateMeter(req.fare, toll))} Djai
          </span>
        </div>
      </div>
    </div>
  )
}

// Mirrors world.CompteurQuote's fare from the woro-woro seat price (and the 3e pont's toll).
const estimateMeter = (seat: number, toll = 0) => withToll(seat, toll, 2, 500, 50)

/** A vehicle seen from the side, with heads in the windows for its passengers. */
function VehicleSide({ kind, color, trim, taken }: { kind: Kind; color: string; trim?: string; taken: number }) {
  if (kind === 'moto') {
    return (
      <svg width="56" height="40" viewBox="0 0 56 40" aria-hidden>
        <circle cx="12" cy="31" r="7" fill="#1d1d24" />
        <circle cx="44" cy="31" r="7" fill="#1d1d24" />
        <path d="M12 31 L24 18 L38 18 L44 31" stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="30" cy="8" r="6" fill="#6b4a32" />
      </svg>
    )
  }
  const long = kind === 'gbaka'
  const w = long ? 150 : 112
  const seats = long ? 5 : 3
  return (
    <svg width={w} height="56" viewBox={`0 0 ${w} 56`} aria-hidden>
      <path d={long ? `M6 44 V16 Q6 8 14 8 H${w - 14} Q${w - 4} 8 ${w - 4} 20 V44 Z` : `M4 44 V30 Q4 24 12 23 L28 10 Q31 8 36 8 H74 Q80 8 84 12 L96 23 Q${w - 4} 24 ${w - 4} 32 V44 Z`} fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
      {trim && <rect x="5" y="36" width={w - 10} height="7" fill={trim} />}
      {kind === 'compteur' && <rect x="44" y="2" width="20" height="7" rx="2" fill="#ffe066" stroke="rgba(0,0,0,0.25)" />}
      {/* The apprenti hanging out of the gbaka's door */}
      {long && (
        <g>
          <rect x={w - 52} y="14" width="9" height="20" rx="3" fill="#ff8200" />
          <circle cx={w - 47.5} cy="9" r="5" fill="#5a3b26" />
          <path d={`M${w - 43} 18 L${w - 33} 8`} stroke="#5a3b26" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {[...Array(seats)].map((_, i) => {
        const x = long ? 18 + i * 25 : 32 + i * 20
        return (
          <g key={i}>
            <rect x={x} y={long ? 12 : 12} width={long ? 20 : 17} height="12" rx="2.5" fill="#2a3446" />
            {i < Math.min(seats, kind === 'woro' ? taken + 1 : taken + 1) && <circle cx={x + (long ? 10 : 8.5)} cy="21" r="4" fill={i === 0 ? '#5a3b26' : '#8a5a3b'} />}
          </g>
        )
      })}
      <circle cx={long ? 26 : 26} cy="46" r="8" fill="#1d1d24" />
      <circle cx={w - 26} cy="46" r="8" fill="#1d1d24" />
      <circle cx={long ? 26 : 26} cy="46" r="3" fill="#adb5bd" />
      <circle cx={w - 26} cy="46" r="3" fill="#adb5bd" />
    </svg>
  )
}

/* ---------------- Booking an app ---------------- */

type Stage = 'choose' | 'search' | 'refused' | 'call' | 'coming' | 'cancelled' | 'arrived'
const SECONDS_PER_MIN = 5 // the driver's minutes go by quickly
const APP_CARS: [string, string][] = [
  ['#f1f3f5', 'blanche'],
  ['#adb5bd', 'grise'],
  ['#212529', 'noire'],
  ['#1c7ed6', 'bleue'],
]
/** The cars that come in each class: older and smaller in Éco, big and dark in Confort+. */
const CLASS_CARS: Record<string, { cars: [string, string][]; kind: string; eta: [number, number]; drop: number }> = {
  eco: { cars: [['#adb5bd', 'grise'], ['#f1f3f5', 'blanche'], ['#c92a2a', 'rouge'], ['#1c7ed6', 'bleue']], kind: 'Petite berline', eta: [2, 4], drop: 0.18 },
  confort: { cars: [['#f1f3f5', 'blanche'], ['#868e96', 'gris métal'], ['#212529', 'noire']], kind: 'Berline récente', eta: [3, 6], drop: 0.1 },
  confortplus: { cars: [['#141416', 'noire'], ['#2b2d42', 'gris anthracite'], ['#f8f9fa', 'blanc nacré']], kind: 'SUV haut de gamme', eta: [6, 10], drop: 0.04 },
  goyave: { cars: [['#0b0b0f', 'noire laquée'], ['#e9e3d5', 'champagne']], kind: 'Berline de luxe', eta: [0, 0], drop: 0 },
}
const CLASS_ICON: Record<string, typeof Car> = { eco: PiggyBank, confort: Snowflake, confortplus: Gem, goyave: Crown }
/** Goyave: the car is already there, no search, no wait. */
const instant = (c?: RideClass) => c?.id === 'goyave'

/**
 * Booking Gnango or iDrive: looking for a driver (on iDrive, one has to take
 * your price), the driver's call, the wait while they come. The driver can
 * drop the ride on the way, and you can cancel too, without paying.
 */
function AppBooking({ world, req, onBoard, onClose }: { world: World; req: FlowRequest; onBoard: (ride: Ride, label: string) => void; onClose: () => void }) {
  const app = world.rideApps!.find((a) => a.id === req.kind)!
  const classes = app.classes ?? []
  const [cls, setCls] = useState<RideClass | undefined>(classes[0])
  const [stage, setStage] = useState<Stage>(classes.length ? 'choose' : 'search')
  const [call, setCall] = useState<Call | null>(null)
  const [car, setCar] = useState<[string, string]>(APP_CARS[0])
  const kind = cls ? CLASS_CARS[cls.id] : undefined
  const [left, setLeft] = useState(0)
  const [drop, setDrop] = useState<number | null>(null) // seconds left when the driver gives up
  const [tries, setTries] = useState(0)

  // Look for a driver.
  useEffect(() => {
    if (stage !== 'search') return
    const t = setTimeout(
      () => {
        const p = app.model === 'offer' ? offerChance(req.offer ?? 0, quoteOf(req)) : 0.96
        if (!chance(p)) return setStage('refused')
        const c = newCall(rideLook(world, app.id, undefined, cls?.id), app.id, req.offer ?? fareOf(cls), req.from.name)
        // The better the class, the fewer cars about: they come from further away, but rarely let you down.
        if (kind) c.eta = kind.eta[0] + Math.floor(Math.random() * (kind.eta[1] - kind.eta[0] + 1))
        setCall(c)
        setCar(pick(kind ? kind.cars : APP_CARS))
        setLeft(c.eta * SECONDS_PER_MIN)
        // Some drivers accept and then don't come.
        setDrop(chance(kind ? kind.drop : app.model === 'offer' ? 0.22 : 0.15) ? Math.floor(Math.random() * c.eta * SECONDS_PER_MIN * 0.8) + 2 : null)
        setStage('call')
      },
      1800 + Math.random() * 2500,
    )
    return () => clearTimeout(t)
  }, [stage, tries]) // eslint-disable-line react-hooks/exhaustive-deps

  // The driver on the way.
  useEffect(() => {
    if (stage !== 'coming') return
    const t = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [stage])
  useEffect(() => {
    if (stage !== 'coming') return
    if (drop !== null && left <= drop) setStage('cancelled')
    else if (left <= 0) setStage('arrived')
  }, [left, stage, drop])

  if (stage === 'call' && call) return <DriverCall call={call} onClose={() => setStage('coming')} embedded />

  const retry = () => (setTries((n) => n + 1), setStage('search'))
  const mins = Math.max(1, Math.ceil(left / SECONDS_PER_MIN))
  const fareOf = (c?: RideClass) => classFare(req.fare, c)
  const fare = req.offer ?? fareOf(cls)
  const name = cls ? `${app.name} ${cls.name}` : app.name

  // Ordering: a driver is looked for, except in Goyave where one is already waiting at the door.
  function order() {
    if (!instant(cls)) return setStage('search')
    const c = newCall(rideLook(world, app.id, undefined, cls?.id), app.id, fareOf(cls), req.from.name)
    c.eta = 0
    setCall(c)
    setCar(pick(CLASS_CARS.goyave.cars))
    setDrop(null)
    setStage('arrived')
  }

  if (stage === 'choose')
    return <ClassPicker app={app} req={req} classes={classes} cls={cls} setCls={setCls} fareOf={fareOf} onOrder={order} onClose={onClose} />

  return (
    <div className="animate-pop w-full max-w-[380px] rounded-[28px] bg-[var(--color-surface)] p-5 shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: car[0], color: inkOn(car[0]), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}>
          <Car size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="label">
            {name} · {req.from.name} → {req.to.name}
          </div>
          <div className="font-display text-xl leading-tight font-extrabold">
            {stage === 'search' ? 'Recherche d\'un chauffeur…' : stage === 'refused' ? 'Personne n\'a accepté' : stage === 'cancelled' ? `${call?.driver} a annulé` : stage === 'arrived' ? `${call?.driver} est là !` : `${call?.driver} arrive`}
          </div>
        </div>
      </div>

      {stage === 'search' && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
          <div className="h-full w-1/3 animate-[shimmer_1.2s_linear_infinite] rounded-full bg-[var(--color-orange)]" />
        </div>
      )}

      {stage === 'refused' && <p className="mt-3 text-sm font-bold text-[var(--color-ink-soft)]">{app.model === 'offer' ? `Aucun chauffeur n'a pris ${amount(fare)} Djai. Propose un peu plus, ou réessaie.` : 'Aucun chauffeur disponible pour l\'instant.'}</p>}

      {stage === 'coming' && call && (
        <div className="mt-4 grid gap-2">
          <div className="flex items-center justify-between rounded-2xl bg-[var(--color-canvas)] px-3 py-2 text-sm font-extrabold">
            <span>
              {kind ? kind.kind : 'Voiture'} {car[1]} · {call.plate}
            </span>
            <span className="tabular-nums">dans {mins} min</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div className="h-full rounded-full bg-[var(--color-emerald)] transition-[width] duration-1000 ease-linear" style={{ width: `${100 - (left / (call.eta * SECONDS_PER_MIN)) * 100}%` }} />
          </div>
        </div>
      )}

      {stage === 'arrived' && instant(cls) && call && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#141416] p-3 text-sm font-bold text-[#f3e6c4]">
          <Crown size={16} className="mt-0.5 shrink-0 text-[#d4b052]" />
          {`${kind?.kind} ${car[1]} devant toi, plaque ${call.plate}. ${call.driver}, en costume, t'ouvre la portière : « Bonjour, bienvenue à bord. Rafraîchissement ? »`}
        </div>
      )}

      {stage === 'cancelled' && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl rounded-tl-sm bg-[var(--color-canvas)] p-3 text-sm font-bold">
          <MessageCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-ink-soft)]" />
          {pick([`Désolé, je ne peux plus venir. Annule la course s'il te plaît.`, `Je suis bloqué dans les bouchons, je ne viens plus. Annule de ton côté.`, `Mon client d'avant m'a retenu, je laisse tomber. Désolé !`])}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {stage === 'arrived' ? (
          <>
            <button className="btn btn-soft" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-emerald text-[15px] whitespace-nowrap" onClick={() => onBoard({ app: app.id, class: cls?.id, offer: req.offer, party: req.party }, `En ${name} vers ${req.to.name}`)}>
              Monter · {amount(fare)} Djai
            </button>
          </>
        ) : stage === 'refused' || stage === 'cancelled' ? (
          <>
            <button className="btn btn-soft" onClick={onClose}>
              Fermer
            </button>
            <button className="btn" onClick={retry}>
              Chercher un autre
            </button>
          </>
        ) : (
          <button className="btn btn-soft col-span-2" onClick={onClose}>
            Annuler la course
          </button>
        )}
      </div>
    </div>
  )
}

const quoteOf = (req: FlowRequest) => req.fare
// Mirrors world.OfferChance.
const offerChance = (offer: number, quote: number) => Math.max(0, Math.min(1, (offer / quote - 0.6) / 0.4))

/**
 * The app opens on the trip and its kinds of car, as in the real apps: Éco
 * (the cheapest, a small car that is often a bit tired), Confort (newer, air
 * conditioning guaranteed), Confort+ (a big saloon or an SUV, the best-rated
 * drivers, water on the seat). Each shows its price and how soon it can come.
 */
function ClassPicker({ app, req, classes, cls, setCls, fareOf, onOrder, onClose }: { app: RideApp; req: FlowRequest; classes: RideClass[]; cls?: RideClass; setCls: (c: RideClass) => void; fareOf: (c?: RideClass) => number; onOrder: () => void; onClose: () => void }) {
  const chosen = cls ?? classes[0]
  return (
    <div className="animate-pop w-full max-w-[380px] overflow-hidden rounded-[28px] bg-[var(--color-surface)] shadow-2xl">
      {/* The app's header: its logo, the trip */}
      <div className="flex items-center gap-3 bg-[#141416] px-4 py-3.5 text-white">
        <AppLogo id={app.id} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight font-extrabold text-[#ffd166]">{app.name}</div>
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-white/75">
            <span className="truncate">{req.from.name}</span>
            <ArrowRight size={12} strokeWidth={3} className="shrink-0" />
            <span className="truncate">{req.to.name}</span>
          </div>
        </div>
        <button className="icon-btn h-9 w-9 bg-white/10 text-white" onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 p-3" role="radiogroup" aria-label="Catégorie de voiture">
        {classes.map((c) => {
          const look = CLASS_CARS[c.id]
          const Icon = CLASS_ICON[c.id] ?? Car
          const on = c.id === chosen.id
          const [col] = look?.cars[0] ?? ['#adb5bd']
          const short = req.money !== undefined && req.money < fareOf(c)
          return (
            <button
              key={c.id}
              role="radio"
              aria-checked={on}
              disabled={short}
              onClick={() => setCls(c)}
              className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition disabled:opacity-45 ${on ? 'border-[#ffd166] bg-[#fff8e1]' : instant(c) ? 'border-[#d4b052]/40 bg-[#fbf6ea]' : 'border-transparent bg-[var(--color-canvas)]'}`}
            >
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: col, color: inkOn(col), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}>
                <Car size={c.id === 'goyave' ? 32 : c.id === 'confortplus' ? 30 : c.id === 'confort' ? 26 : 22} className={instant(c) ? 'text-[#d4b052]' : undefined} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-display text-base leading-tight font-extrabold">
                  {c.name}
                  <Icon size={14} className="text-[var(--color-ink-soft)]" />
                </span>
                <span className="block truncate text-[11.5px] font-bold text-[var(--color-ink-soft)]">{c.cars}</span>
                <span className="block truncate text-[11.5px] font-bold text-[var(--color-ink-soft)]">{short ? 'Pas assez de Djai' : c.perks}</span>
              </span>
              <span className="w-[68px] shrink-0 text-right">
                <span className="block font-display text-[15px] font-extrabold tabular-nums">{amount(fareOf(c))}</span>
                <span className="flex items-center justify-end gap-0.5 text-[11px] font-bold text-[var(--color-ink-soft)]">
                  <Clock3 size={11} /> {instant(c) ? 'Immédiat' : look ? `${look.eta[0]}-${look.eta[1]} min` : ''}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="px-3 pb-3">
        <button className="btn w-full text-[15px]" style={{ background: '#ffd166', color: '#141416' }} onClick={onOrder} disabled={req.money !== undefined && req.money < fareOf(chosen)}>
          Commander {app.name} {chosen.name} · {amount(fareOf(chosen))} Djai
        </button>
      </div>
    </div>
  )
}
