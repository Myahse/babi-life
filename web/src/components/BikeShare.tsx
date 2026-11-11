import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Bike, Lock, Navigation, X } from 'lucide-react'
import type { Sim } from '../lib/types'
import { api, type BikeState } from '../lib/api'
import type { Act } from '../screens/phoneApps'
import { bearingTo, distanceTo } from '../world3d/whereabouts'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { drive, parkedNow, parkIn, setParked, startDrive, stopDrive, topSpeed, useDriving, useParked, walkToVehicle, type Driven } from '../world3d/drive'
import { RENTED, setBikeStation, useBikeStation } from '../world3d/bikeShare'
import { amount } from '../game/rules'
import { t as tr } from '../lib/i18n'

// Vélo Babi on the screen (backend sims/bikes.go, world/bikes.go): beside the commune's station, « Louer
// un vélo » and its prices (paid with Waye); on the bike, the time left; when it runs out the bike stops
// and locks (« Recharger » with Waye, or give it back); by a station, « Rendre le vélo ici ». A bike left
// in the street with nobody on it for ten minutes, or locked and not recharged, goes back to its station
// by itself (the server takes it back half an hour after its time).

export const RENTED_BIKE: Driven = { id: RENTED, kind: 'velo', body: 'velo', color: '#ff7a00', name: 'Vélo Babi', top: topSpeed(26) }
/** Left alone this long (ms), a hired bike goes back to its station. */
const LEFT_FOR = 10 * 60 * 1000

export function BikeShare({ sim, run }: { sim: Sim; run: Act }) {
  const [state, setState] = useState<BikeState | null>(null)
  const [sheet, setSheet] = useState<'rent' | 'locked' | null>(null)
  const [near, setNear] = useState<'station' | null>(null)
  const [, tick] = useState(0)
  const station = useBikeStation()
  const driven = useDriving()
  const parked = useParked()
  const riding = driven?.id === RENTED
  const load = useCallback(() => api.bike(sim.id).then(setState, () => undefined), [sim.id])
  useEffect(() => {
    if (sim.city !== 'abidjan') return
    void load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load, sim.city, sim.commune])
  // The bikes in the racks of the station here, for the street to draw.
  useEffect(() => {
    const d = state?.docks.find((x) => x.id === station.dock)
    setBikeStation({ free: d?.free ?? 0 })
  }, [state, station.dock])
  const rental = state?.rental ?? null
  const until = rental ? new Date(rental.until).getTime() : 0
  const left = Math.max(0, until - Date.now())
  // Every second: the time left; the station near or not; the time up on the bike: it stops and locks.
  const leftAlone = useRef<number | null>(null)
  // The warnings given (once each per hire), the one showing; how far this hire has been ridden (m).
  const warned = useRef('')
  const [warn, setWarn] = useState<string | null>(null)
  const ridden = useRef(0)
  const [bubble, setBubble] = useState(false)
  useEffect(() => {
    const t = setInterval(() => {
      tick((n) => n + 1)
      setNear(station.at && distanceTo(station.at) < 7 ? 'station' : null)
      // Two minutes left, then thirty seconds: a word and a buzz, so the time up isn't a surprise.
      const rest = until - Date.now()
      if (rental && driving()) {
        for (const [ms, key] of [
          [120000, '2min'],
          [30000, '30s'],
        ] as const)
          if (rest < ms && rest > ms - 1500 && warned.current !== `${rental.until}${key}`) {
            warned.current = `${rental.until}${key}`
            setWarn(ms === 120000 ? tr('Plus que 2 minutes de vélo') : tr('30 secondes : recharge ou rends le vélo'))
            sfx.tick(1.5)
            haptic('medium')
            setTimeout(() => setWarn(null), 4000)
          }
        ridden.current = Math.max(ridden.current, drive.metres)
      }
      if (rental && Date.now() >= until && driving()) {
        // It stops where it is, against the kerb (the Walker parks it), locked.
        parkIn.commune = sim.commune
        stopDrive()
        setSheet('locked')
      }
      // Its bike parked somewhere with nobody on it: back to its station after a while.
      const p = parkedNow()
      if (p?.v.id === RENTED) {
        leftAlone.current ??= Date.now()
        if (Date.now() - leftAlone.current > LEFT_FOR || !rental) giveBack(false)
      } else leftAlone.current = null
    }, 1000)
    return () => clearInterval(t)
  })
  const driving = () => driven?.id === RENTED
  const giveBack = (said = true) => {
    if (riding) stopDrive()
    if (parkedNow()?.v.id === RENTED) setParked(null)
    leftAlone.current = null
    setSheet(null)
    const metres = Math.round(Math.max(ridden.current, riding ? drive.metres : 0))
    ridden.current = 0
    if (said) void run(tr('Rendre le vélo'), 'bike', 'transport', () => api.bikeReturn(sim.id, metres)).then(load)
    else void api.bikeReturn(sim.id, metres).then(load, () => undefined)
  }
  const rent = (plan: string) =>
    void run(tr('Louer un Vélo Babi'), 'bike', 'transport', () => api.bikeRent(sim.id, station.dock!, plan)).then((ok) => {
      void load()
      if (ok) ((ridden.current = 0), setSheet(null), startDrive(RENTED_BIKE))
    })
  const extend = (plan: string) =>
    void run(tr('Recharger le vélo'), 'bike', 'transport', () => api.bikeExtend(sim.id, plan)).then((ok) => {
      void load()
      if (ok) (setSheet(null), parkedNow()?.v.id === RENTED || !riding ? (setParked(null), startDrive(RENTED_BIKE)) : undefined)
    })
  if (sim.city !== 'abidjan' || sim.activity) return null
  const mm = Math.floor(left / 60000)
  const ss = Math.floor((left % 60000) / 1000)
  const plans = state?.plans ?? []
  const free = state?.docks.find((x) => x.id === station.dock)?.free ?? 0
  return (
    <>
      {/* On the bike: the time left, how far ridden, the way back to the station; the bell; by a station, give it back there */}
      {riding && rental && (
        <div className="absolute top-[calc(max(0.75rem,var(--sat,env(safe-area-inset-top)))+3.5rem)] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className={`hud rounded-full px-3 py-1.5 text-xs font-extrabold tabular-nums ${left < 120000 ? 'animate-pulse text-[#dc2626]' : ''}`}>
              <Bike size={14} className="mr-1 inline text-[var(--color-orange)]" />
              {mm}:{String(ss).padStart(2, '0')} · {(Math.max(ridden.current, drive.metres) / 1000).toFixed(1)} km
            </span>
            {station.at && !near && (
              <span className="hud rounded-full px-3 py-1.5 text-xs font-extrabold" title={tr('La station Vélo Babi')}>
                <Navigation size={13} className="mr-1 inline text-[var(--color-orange)]" style={{ transform: `rotate(${toStation(station.at)}deg)` }} />
                {Math.round(distanceTo(station.at))} m
              </span>
            )}
            {near && (
              <button className="btn !px-3 !py-1.5 !text-xs" onClick={() => giveBack()}>
                {tr('Rendre le vélo ici')}
              </button>
            )}
          </div>
          {warn && <span className="hud animate-pop rounded-full px-3 py-1 text-xs font-extrabold text-[#dc2626]">{warn}</span>}
        </div>
      )}
      {riding && (
        <button
          className="hud absolute right-3 bottom-[calc(13rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] z-30 grid h-12 w-12 place-items-center rounded-full text-[var(--color-orange)] active:scale-95"
          title={tr('Sonnette')}
          onClick={() => {
            sfx.cycleBell()
            haptic('light')
            setBubble(true)
            setTimeout(() => setBubble(false), 1200)
          }}
        >
          <Bell size={22} strokeWidth={2.6} />
          {bubble && <span className="absolute -top-7 right-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow">{tr('Dring dring !')}</span>}
        </button>
      )}
      {/* Its bike parked, still paid: back on it */}
      {!riding && rental && !rental.locked && parked?.v.id === RENTED && distanceTo([parked.x, parked.z]) < 5 && !sheet && (
        <div className="absolute inset-x-0 bottom-[calc(10.6rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] z-30 flex justify-center px-3">
          <button
            className="btn animate-pop !px-4 !py-2.5 !text-sm"
            onClick={() =>
              // To its saddle first, then on and off from where it stands.
              walkToVehicle(parked, () => {
                setParked(null)
                startDrive(RENTED_BIKE)
              })
            }
          >
            <Bike size={17} strokeWidth={2.6} /> {tr('Remonter sur le Vélo Babi')}
          </button>
        </div>
      )}
      {/* Its bike parked and locked: recharge or give it back */}
      {!riding && rental?.locked && parked?.v.id === RENTED && !sheet && (
        <div className="absolute inset-x-0 bottom-[calc(10.6rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] z-30 flex justify-center px-3">
          <button className="btn !bg-[#1f2937] !px-4 !py-2 !text-sm" onClick={() => setSheet('locked')}>
            <Lock size={16} /> {tr('Vélo verrouillé : recharger')}
          </button>
        </div>
      )}
      {/* Beside the station, no bike: hire one */}
      {!riding && !rental && near && !sheet && (
        <div className="absolute inset-x-0 bottom-[calc(10.6rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] z-30 flex justify-center px-3">
          <button className="btn animate-pop !px-4 !py-2.5 !text-sm" onClick={() => setSheet('rent')}>
            <Bike size={17} strokeWidth={2.6} /> {tr('Louer un Vélo Babi')} · {free}
          </button>
        </div>
      )}
      {sheet && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 p-3" onClick={() => setSheet(null)}>
          <div className="hud animate-up w-full max-w-sm rounded-[24px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ff7a00] text-white">{sheet === 'locked' ? <Lock size={18} /> : <Bike size={18} />}</span>
              <div className="flex-1 text-base font-extrabold">{sheet === 'locked' ? tr('Temps écoulé : vélo verrouillé') : tr('Vélo Babi')}</div>
              <button className="text-[var(--color-ink-soft)]" onClick={() => setSheet(null)}>
                <X size={20} />
              </button>
            </div>
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              {sheet === 'locked'
                ? tr('Recharge-le avec Waye pour repartir, ou rends-le : laissé là, il retourne tout seul à sa station.')
                : tr('Paie avec Waye et pars à vélo. Quand le temps est fini, le vélo se verrouille : recharge-le ou rends-le à une station.')}
            </p>
            <div className="flex flex-col gap-2">
              {plans.map((p) => (
                <button key={p.id} disabled={sim.money < p.price || (sheet === 'rent' && !free)} className="btn flex items-center justify-between !px-4 !py-2.5 !text-sm" onClick={() => (sheet === 'rent' ? rent(p.id) : extend(p.id))}>
                  <span>{tr('{n} minutes', { n: p.minutes })}</span>
                  <span>{amount(p.price)} Djai</span>
                </button>
              ))}
              {sheet === 'locked' && (
                <button className="btn !bg-[#e5e7eb] !text-[var(--color-ink)] !px-4 !py-2.5 !text-sm" onClick={() => giveBack()}>
                  {tr('Rendre le vélo')}
                </button>
              )}
              {sheet === 'rent' && !free && <p className="text-center text-xs font-bold text-[#dc2626]">{tr('Plus de vélo ici pour le moment.')}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Which way the station is, as the needle turns on screen (degrees, 0 = straight ahead, clockwise). */
const toStation = (at: [number, number]) => (bearingTo(at) * 180) / Math.PI
