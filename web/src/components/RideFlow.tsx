import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Car, Clock3, Crown, Gem, Hand, MessageCircle, Minus, PiggyBank, Plus, Snowflake, UserRound, X } from 'lucide-react'
import type { Commune, Ride, RideApp, RideClass, StreetRide, World } from '../lib/types'
import { amount, clock, tollOf, withToll } from '../game/rules'
import { routeIn } from '../game/roads'
import { classFare, inkOn, motoQuote, rideLook } from '../game/rides'
import { AppLogo } from './AppLogo'
import { DriverCall, newCall, type Call } from './DriverCall'
import { aCommune, deCommune } from '../lib/french'
import { discounted } from '../lib/civic'
import { RoadsideScene, type Me } from './RoadsideScene'
import { randomLook } from '../avatar/options'

/** A ride being arranged in town: hailing at the roadside, or booking an app. */
export type FlowRequest = { cityId: string; from: Commune; to: Commune; kind: 'street' | string; offer?: number; fare: number; party: number; money?: number; /** The share off the public transport (the president's measure, lib/civic.ts). */ off?: number; /** At the roadside: the one the player chose to wait for (else the woro-woro or a taxi compteur, whichever). */ want?: StreetRide }

export function RideFlow({ world, req, gameMinutes, me, onBoard, onClose }: { world: World; req: FlowRequest; gameMinutes: number; /** Who waits at the roadside (the player's Sim). */ me?: Me; onBoard: (ride: Ride, label: string) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true">
      {req.kind === 'street' ? <Roadside world={world} req={req} gameMinutes={gameMinutes} me={me} onBoard={onBoard} onClose={onClose} /> : <AppBooking world={world} req={req} onBoard={onBoard} onClose={onClose} />}
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
 * compteur (stops only if it's empty, then takes your group), a gbaka, a
 * moto-taxi (one behind the driver), and cars you can't hail. Whichever was
 * chosen comes by more often, but any of them can be waved at. Wave, ask, get in.
 */
function Roadside({ world, req, gameMinutes, me, onBoard, onClose }: { world: World; req: FlowRequest; gameMinutes: number; me?: Me; onBoard: (ride: Ride, label: string) => void; onClose: () => void }) {
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
  const want = req.want
  const [talk, setTalk] = useState<Talk[]>([
    {
      who: 'info',
      text:
        want === 'gbaka'
          ? "Les gbakas passent par ici : l'apprenti crie où il va. Fais signe au bon."
          : want === 'compteur' || !woroHere
            ? `${woroHere ? '' : `Pas de woro-woro ${aCommune(from.name)} : `}guette un taxi compteur libre.`
            : want === 'woro'
              ? `Les woro-woro ${from.woro!.label}s ${deCommune(from.name)} passent par ici. Fais signe à celui qui va ${aCommune(to.name)}.`
              : `Les woro-woro ${from.woro!.label}s ${deCommune(from.name)} et les taxis compteur passent par ici.`,
    },
  ])
  const [waved, setWaved] = useState(false)
  // Without a Sim (the lab), someone of the town waits.
  const [who] = useState<Me>(() => me ?? { look: randomLook('femme'), gender: 'femme' })
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
    // The one chosen comes by more often (the others go past too, not for you).
    const more = (k: Kind) => (want === k ? 2.2 : 1)
    const kind = weighted<Kind>([
      ['woro', woroHere ? (night(hour) ? 0.2 : 0.42) * more('woro') : 0],
      ['compteur', 0.26 * more('compteur')],
      ['gbaka', (night(hour) ? 0.04 : 0.12) * (want === 'gbaka' ? 4 : 1)],
      ['car', 0.16],
      ['moto', night(hour) ? 0.04 : 0.1],
    ])
    const busy = rush(hour)
    const taken =
      kind === 'woro'
        ? weighted<number>(busy ? [[0, 0.05], [1, 0.1], [2, 0.2], [3, 0.3], [4, 0.35]] : [[0, 0.25], [1, 0.25], [2, 0.2], [3, 0.15], [4, 0.15]])
        : kind === 'compteur'
          ? chance(busy ? 0.55 : 0.4)
            ? 1 + Math.floor(Math.random() * 3)
            : 0
          : kind === 'gbaka'
            ? chance(busy ? 0.25 : 0.1)
              ? GBAKA_SEATS
              : 6 + Math.floor(Math.random() * 10)
            : kind === 'moto'
              ? chance(0.35)
                ? 1
                : 0
              : 1
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

  const free = car ? (car.kind === 'gbaka' ? GBAKA_SEATS : car.kind === 'moto' ? 1 : 4) - car.taken : 0
  // Waved at: anything that takes passengers (the one chosen only comes by more often), not the cars going about their business.
  const mine = (k: Kind) => k !== 'car'
  const hailable = !!car && !stopped && !waved && mine(car.kind) && pos > 0.03 && pos < STOP_AT
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
    if (car.kind === 'gbaka' && free < party) return later(500, () => say({ who: 'info', text: 'Le gbaka est plein à craquer, il ne s\'arrête même pas.' }))
    if (car.kind === 'moto' && car.taken > 0) return later(500, () => say({ who: 'info', text: 'Il a déjà un client derrière, il passe.' }))
    if (car.kind === 'moto' && party > 1) return later(500, () => say({ who: 'info', text: `Une moto, c'est une seule personne derrière : vous êtes ${party}. Il passe.` }))
    // It stops: say where you're going, the driver says yes or no.
    const c = car
    setStopped({ at: Date.now(), yes: null })
    later(600, () => say({ who: 'toi', text: `${to.name} ?` }))
    later(1500, () => {
      const yes = c.kind === 'woro' || c.kind === 'gbaka' ? c.dest === to.id : !c.refuses
      say({
        who: 'chauffeur',
        text: yes
          ? c.kind === 'gbaka'
            ? `« ${to.name} ! ${to.name} ! » Monte, on se serre !`
            : c.kind === 'woro'
              ? `${to.name}, oui ! Monte, ${free - party > 0 ? `il reste de la place derrière` : 'on part'}.`
              : c.kind === 'moto'
                ? `${to.name} ? Monte derrière, tiens-toi bien.`
                : `${to.name} ? Ok, monte.`
          : c.kind === 'gbaka'
            ? `Non, nous on va ${aCommune(destName(c.dest))} ! ${destName(c.dest)} ! ${destName(c.dest)} !`
            : c.kind === 'woro'
              ? `Non, moi je vais ${aCommune(destName(c.dest))}.`
              : c.kind === 'moto'
                ? `Non, ${to.name} je ne connais pas bien là-bas.`
                : `Non, ${to.name} c'est trop loin avec les bouchons.`,
      })
      setStopped({ at: Date.now(), yes })
      if (!yes) later(1400, () => leave(c))
    })
  }

  const board = () => {
    if (!car) return
    // The moto-taxi is the server's own ride (one passenger), the others the roadside's.
    if (car.kind === 'moto') return onBoard({ app: 'moto' }, `En moto-taxi vers ${to.name}`)
    const app = car.kind as StreetRide
    onBoard({ app, party }, `${app === 'woro' ? 'En woro-woro' : app === 'gbaka' ? 'En gbaka' : 'En taxi compteur'} vers ${to.name}`)
  }

  // req.fare: a woro-woro seat (world.Trip); the others from it.
  // (The president's « transport » measure halves the public ones, as the server does.)
  const woroFare = discounted(req.fare * party, req.off ?? 0)
  const gbakaFare = discounted(gbakaSeat(req.fare) * party, req.off ?? 0)
  const meterFare = discounted(estimateMeter(req.fare, toll), req.off ?? 0)
  const motoFare = motoQuote({ minutes: 0, fare: req.fare, toll }).fare
  const fareOf = (k?: Kind) => (k === 'woro' ? woroFare : k === 'gbaka' ? gbakaFare : k === 'moto' ? motoFare : meterFare)
  const label = !car
    ? 'La route est calme…'
    : car.kind === 'woro'
      ? `Woro-woro ${from.woro?.label} · ${free === 0 ? 'plein' : `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`}`
      : car.kind === 'compteur'
        ? `Taxi compteur · ${car.taken ? 'occupé' : 'libre'}`
        : car.kind === 'gbaka'
          ? `Gbaka · ${free <= 0 ? 'plein' : 'on se serre'}`
          : car.kind === 'moto'
            ? `Moto-taxi · ${car.taken ? 'un client derrière' : 'libre'}`
            : 'Voiture'

  return (
    <div className="animate-pop w-full max-w-[400px] overflow-hidden rounded-[28px] bg-[var(--color-surface)] shadow-2xl short:grid short:max-h-[calc(100dvh-1.5rem)] short:max-w-[760px] short:grid-cols-2">
      <div className="short:flex short:min-h-0 short:flex-col">
      <div className="flex items-start gap-3 p-4 pb-3 short:pb-2">
        <div className="min-w-0 flex-1">
          <div className="label">Au bord de la route · {from.name}</div>
          <div className="font-display text-xl leading-tight font-extrabold">Direction {to.name}</div>
        </div>
        <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Abandonner">
          <X size={18} />
        </button>
      </div>

      {/* The road in 3D: the game's vehicles go by from left to right, the Sim waves at the kerb. */}
      <div className="relative h-40 overflow-hidden bg-[#a9d3f0] short:h-auto short:min-h-[150px] short:flex-1">
        <RoadsideScene me={who} party={party} car={car} passMs={PASS_MS} stopAt={STOP_AT} stopped={!!stopped} waved={waved} board={!!stopped?.yes} hailing={!stopped && !!car && mine(car.kind) && pos < STOP_AT + 0.05} night={night(hour)} />
        {car && <div className={`pointer-events-none absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold shadow ${hailable ? 'bg-white text-[var(--color-ink)]' : 'bg-black/50 text-white'}`}>{label}</div>}
      </div>
      </div>

      <div className="short:flex short:min-h-0 short:flex-col">
      <div className="flex min-h-[112px] flex-col justify-end gap-1.5 overflow-hidden bg-[var(--color-canvas)] px-4 py-3 short:min-h-0 short:flex-1">
        {talk.map((t, i) => (
          <div key={i} className={`animate-pop max-w-[85%] rounded-2xl px-3 py-1.5 text-sm font-bold ${t.who === 'toi' ? 'self-end rounded-br-sm bg-[var(--color-orange)] text-white' : t.who === 'chauffeur' ? 'self-start rounded-bl-sm bg-white' : 'self-center bg-transparent text-center text-xs text-[var(--color-ink-soft)]'}`}>
            {t.text}
          </div>
        ))}
      </div>

      <div className="grid gap-3 p-4 short:gap-2 short:p-3">
        {stopped?.yes ? (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-soft" onClick={() => car && leave(car)}>
              Laisser passer
            </button>
            <button className="btn btn-emerald text-[15px] whitespace-nowrap" onClick={board}>
              Monter · {amount(fareOf(car?.kind))} Djai
            </button>
          </div>
        ) : (
          <button className="btn" onClick={wave} disabled={!hailable}>
            <Hand size={20} /> {hailable ? 'Faire signe' : stopped ? 'Il s\'arrête…' : car && mine(car.kind) && pos < 0.03 ? 'Il arrive…' : want === 'gbaka' ? 'Attends le gbaka…' : want === 'woro' ? 'Attends le woro-woro…' : 'Attends un taxi…'}
          </button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Party party={party} setParty={setParty} />
          <span className="text-[11px] font-extrabold text-[var(--color-ink-soft)]">
            {want === 'gbaka' ? `Gbaka ${amount(gbakaSeat(req.fare))} Djai/place` : want === 'compteur' ? `Compteur ~${amount(meterFare)} Djai` : `${woroHere ? `Woro ${amount(req.fare)} Djai/place · ` : ''}compteur ~${amount(meterFare)} Djai`}
          </span>
        </div>
      </div>
      </div>
    </div>
  )
}

// Mirrors world.CompteurQuote's fare from the woro-woro seat price (and the 3e pont's toll).
const estimateMeter = (seat: number, toll = 0) => withToll(seat, toll, 2, 500, 50)
// Mirrors world.GbakaQuote: a gbaka seat, from the woro-woro's.
const gbakaSeat = (seat: number) => Math.max(200, Math.round((seat * 0.7) / 50) * 50)
/** A gbaka's seats (the apprenti always finds one more). */
const GBAKA_SEATS = 18

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
