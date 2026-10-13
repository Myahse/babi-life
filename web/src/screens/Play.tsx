import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Briefcase, DoorOpen, Hourglass, Newspaper, Square, Bus, CarTaxiFront, ChevronLeft, ChevronRight, Clock3, Dice5, Footprints, House, Lock, Map as MapIcon, MapPin, MessageCircle, ReceiptText, Smartphone, Sparkles, TriangleAlert, UserRound, Wallet, X, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import type { ActionResult, City, Commune, HappeningNow, Interaction, JournalEvent, Sim, World, Ride } from '../lib/types'
import { useWorld } from '../store/world'
import { useSession } from '../store/session'
import { WorldMap } from './WorldMap'
import { Joystick } from '../components/Joystick'
import { TravelCTA, type OnTravel } from '../components/TravelCTA'
import { Portrait } from '../avatar/portrait'
import { Neighbourhood } from '../world3d/Neighbourhood'
import { iconFor, kindColors } from '../components/icons'
import { Chip, Coin, DayNight, IconTile, MotiveRing, Plumbob, Row, needColor } from '../components/ui'
import { NEEDS, amount, atHome, blockedBy, clock, duration, mood, openAt, openingLabel, predict, shift } from '../game/rules'
import { BankApp, HomeApp, JobsApp, type Act } from './phoneApps'
import { NewsApp, topicOf } from './NewsApp'
import { DriverCall, newCall, type Call } from '../components/DriverCall'
import { rideLook } from '../game/rides'

type Toast = { id: number; title: string; text?: string; money: number; tone: 'random' | 'done' | 'error' | 'promo' | 'event'; kind?: string; icon?: string }

function useIsDesktop() {
  const q = '(min-width: 1024px)'
  const [match, setMatch] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return match
}

export function Play() {
  const world = useWorld((s) => s.world)!
  const user = useSession((s) => s.user)
  const navigate = useNavigate()
  const desktop = useIsDesktop()

  const [base, setBase] = useState<{ sim: Sim; at: number } | null>(null)
  const [journal, setJournal] = useState<JournalEvent[]>([])
  const [seen, setSeen] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [goTo, setGoTo] = useState<{ placeId: string; nonce: number } | null>(null)
  const [overlay, setOverlay] = useState<'phone' | 'map' | null>(null)
  const [pending, setPending] = useState<{ label: string; icon: string; kind: string } | null>(null)
  // The place whose door the Sim is standing at after walking with the pad.
  const [near, setNear] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [street, setStreet] = useState<HappeningNow | null>(null)
  const [call, setCall] = useState<Call | null>(null)
  const announced = useRef('')

  useEffect(() => {
    api.sims().then(async (sims) => {
      if (!sims.length) return navigate('/creer', { replace: true })
      const res = await api.sim(sims[0].id)
      setBase({ sim: res.sim, at: Date.now() })
      setJournal(res.journal)
      setSeen(res.journal[0]?.id ?? 0)
      announce(res.fresh)
    })
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // The game runs on real time; between server round-trips the clock, needs
  // and the current activity advance locally, minute by minute.
  const sim = useMemo(() => {
    if (!base) return null
    const mins = (now - base.at) / 60000
    return { ...base.sim, gameMinutes: base.sim.gameMinutes + mins, needs: predict(base.sim, mins) }
  }, [base, now])

  // When the activity's end comes, ask the server to settle it (pay, surprises).
  const settling = useRef(false)
  const ended = !!sim?.activity && sim.gameMinutes >= sim.activity.end
  useEffect(() => {
    if (!ended || !base || settling.current) return
    settling.current = true
    api
      .sim(base.sim.id)
      .then(apply)
      .catch(() => undefined)
      .finally(() => (settling.current = false))
  }, [ended]) // eslint-disable-line react-hooks/exhaustive-deps
  // And every few minutes anyway: Saturdays, a long nap, another tab.
  useEffect(() => {
    if (!base) return
    const t = setInterval(() => api.sim(base.sim.id).then(apply).catch(() => undefined), 5 * 60000)
    return () => clearInterval(t)
  }, [base?.sim.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const slot = sim ? Math.floor(sim.gameMinutes / 120) : -1
  const where = sim?.commune
  const whereCity = sim?.city
  useEffect(() => {
    if (!where || slot < 0) return
    let live = true
    api
      .happening(whereCity ?? '', where, slot * 120 + 1)
      .then((now) => {
        if (!live) return
        setStreet(now)
        // Announce each happening once (state updaters may run twice, so not in one).
        const h = now.happening
        const key = h ? `${where}|${now.start}|${h.id}` : ''
        if (h && announced.current !== key) {
          announced.current = key
          const name = world.cities.flatMap((c) => c.communes).find((c) => c.id === where)?.name ?? ''
          setTimeout(() => toast({ tone: 'event', title: `Ça se passe à ${name} !`, text: h.text, money: 0, icon: h.icon }), 300)
        }
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [where, slot]) // eslint-disable-line react-hooks/exhaustive-deps
  // Arrived (or still walking) after it ended: say so instead of opening nothing.
  useEffect(() => {
    if (placeId === 'happening' && street && !street.happening) {
      setPlaceId(null)
      toast({ tone: 'error', title: "C'est fini !", text: 'Tu es arrivé·e trop tard, tout le monde est rentré.', money: 0 })
    }
  }, [placeId, street]) // eslint-disable-line react-hooks/exhaustive-deps
  const happening = useMemo(() => (street?.happening ? { id: street.happening.id, icon: street.happening.icon, label: street.happening.label } : null), [street])

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .news()
        .then(({ items }) => {
          const top = items[0]
          if (!top || sessionStorage.getItem('babi-flash') === top.id) return
          sessionStorage.setItem('babi-flash', top.id)
          toast({ tone: 'event', title: `Flash info · ${topicOf(top.topic).label}`, text: `${top.title} (${top.source})`, money: 0, icon: 'newspaper' })
        })
        .catch(() => undefined)
    }, 4000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts.slice(-1), { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000)
  }, [])

  function apply(res: ActionResult) {
    setBase({ sim: res.sim, at: Date.now() })
    setJournal(res.journal)
    announce(res.fresh)
  }

  /** Toasts for what happened since the last request: activities that ended, surprises, bills. */
  function announce(fresh: JournalEvent[]) {
    const bills = fresh.filter((e) => e.kind === 'bill' && e.text.startsWith('Samedi'))
    const rest = fresh.filter((e) => !bills.includes(e))
    rest.forEach((e, i) =>
      setTimeout(() => {
        if (e.kind === 'random') toast({ tone: 'random', title: 'Imprévu !', text: e.text, money: e.money })
        else if (e.kind === 'career') toast({ tone: 'promo', title: 'Promotion !', text: e.text.replace(/^Promotion ! /, ''), money: 0 })
        else if (e.kind === 'travel') toast({ tone: 'done', title: 'Bien arrivé·e !', text: e.text, money: e.money, icon: 'car-taxi-front', kind: 'transport' })
        else toast({ tone: 'done', title: 'Terminé', text: e.text, money: e.money })
      }, 300 + i * 700),
    )
    if (bills.length) setTimeout(() => toast({ tone: 'random', title: 'Samedi, jour du loyer', text: bills.map((b) => b.text).join(' '), money: bills.reduce((t, b) => t + b.money, 0) }), 300 + rest.length * 700)
  }

  const run: Act = async (label, icon, kind, call) => {
    setPending({ label, icon, kind })
    try {
      const res = await call()
      apply(res)
      if (res.outcome.text) toast({ tone: 'done', title: res.outcome.text, money: res.outcome.money, kind, icon })
      return true
    } catch (e) {
      toast({ tone: 'error', title: 'Pas possible', text: e instanceof Error ? e.message : 'Erreur', money: 0 })
      return false
    } finally {
      setPending(null)
    }
  }

  const walkTo = (id: string) => {
    setOverlay(null)
    setGoTo({ placeId: id, nonce: Date.now() })
  }
  const interact = (it: Interaction, kind: string) => {
    const id = placeId!
    setPlaceId(null)
    run(it.label, it.icon, kind, () => api.interact(sim!.id, id, it.id))
  }
  // The ride shows on the map: the route, and the taxi moving along it.
  const travel = (cityId: string, communeId: string, label: string, ride?: Ride) => {
    setPlaceId(null)
    setOverlay('map')
    const from = world.cities.find((x) => x.id === sim!.city)?.communes.find((x) => x.id === sim!.commune)
    run(label, 'bus', 'transport', () => api.travel(sim!.id, cityId, communeId, ride)).then((ok) => {
      // Booked in town: the driver calls to say they're on the way.
      if (!ok || cityId !== sim!.city || !from) return
      const mode = ride?.app ?? 'taxi'
      setCall(newCall(rideLook(world, mode, from), mode, ride?.offer ?? 0, from.name, from.woro?.label))
    })
  }

  if (!sim) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-night)] text-white">
        <div className="flex flex-col items-center gap-3">
          <Plumbob size={22} />
          <span className="font-display text-xl font-bold">Chargement de Babi…</span>
        </div>
      </div>
    )
  }

  const c = clock(sim.gameMinutes)
  const moodHex = needColor(mood(sim.needs))
  // The activity the Sim is acting out here, if any (a trip happens on the road).
  const doing = sim.activity?.kind === 'do' ? sim.activity : null
  const stop = () => run('Arrêter', 'x', '', () => api.stop(sim.id))
  const city = world.cities.find((x) => x.id === sim.city)!
  const commune = city.communes.find((x) => x.id === sim.commune)!
  const unseen = journal.filter((e) => e.id > seen).length
  const placeName = (id: string) => (id === 'home' ? 'Chez toi' : id === 'happening' ? (street?.happening?.label ?? 'En ce moment') : (commune.places.find((p) => p.id === id)?.name ?? ''))

  return (
    <div className="relative h-full overflow-hidden bg-[var(--color-night)] select-none">
      <div className="absolute inset-0">
        <Neighbourhood
          key={commune.id}
          world={world}
          commune={commune}
          sim={sim}
          moodColor={moodHex}
          hour={c.hour}
          goTo={goTo}
          onPick={walkTo}
          onArrive={(id) => setPlaceId(id)}
          busy={doing ? { icon: doing.interaction.icon, kind: doing.placeKind ?? '' } : pending}
          stationAt={doing?.placeId ?? null}
          nameTag={user?.username ? `@${user.username}` : sim.firstName}
          happening={happening}
          onNear={setNear}
          frozen={!!sim.activity || !!pending}
        />
      </div>

      {/* ---------- Top HUD ---------- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-5">
        <Link to="/profil" viewTransition className="hud pointer-events-auto flex items-center gap-2.5 rounded-full py-1 pr-4 pl-1 transition active:scale-95">
          <span className="block rounded-full p-[3px]" style={{ background: `conic-gradient(${moodHex} ${mood(sim.needs) * 3.6}deg, #e7e9f2 0)` }}>
            <span className="block h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]">
              <Portrait look={sim.look} gender={sim.gender} framing="head" />
            </span>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[17px] font-extrabold">{user?.username ? `@${user.username}` : sim.firstName}</span>
            <span className="flex items-center gap-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
              <MapPin size={11} strokeWidth={3} />
              {commune.name} · {city.name}
            </span>
          </span>
        </Link>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          <div className="hud flex h-11 items-center gap-1.5 rounded-full pr-4 pl-1.5">
            <span key={sim.money} className="motion-coin">
              <Coin size={30} />
            </span>
            <span className="tnum font-display text-lg font-extrabold">{amount(sim.money)}</span>
          </div>
          <div className="hud flex h-11 items-center gap-1.5 rounded-full px-3">
            <DayNight night={c.isNight} />
            <span className="tnum font-display text-lg font-extrabold">{c.time}</span>
            <span className="text-xs font-extrabold text-[var(--color-ink-soft)] max-sm:hidden">
              {c.weekday} {c.date}
            </span>
          </div>
        </div>
      </header>

      {/* ---------- Bottom HUD: needs, map, phone ---------- */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-5">
        <button className="hud pointer-events-auto flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-extrabold transition active:scale-95" onClick={() => setOverlay('map')}>
          <MapIcon size={24} strokeWidth={2.4} className="text-[var(--color-emerald)]" />
          Carte
        </button>
        <div className="hud pointer-events-auto flex flex-1 justify-around gap-1 rounded-[26px] px-2 py-2 sm:max-w-md sm:flex-none sm:gap-3 sm:px-4">
          {NEEDS.map((n) => (
            <MotiveRing key={n.key} value={sim.needs[n.key]} icon={n.icon} label={desktop ? n.label : undefined} size={desktop ? 52 : 44} />
          ))}
        </div>
        <button
          className="pointer-events-auto relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[22px] bg-[var(--color-orange)] text-[11px] font-extrabold text-white shadow-[0_8px_20px_-10px_rgba(224,90,0,0.8)] transition hover:bg-[#f26f00] active:scale-95"
          onClick={() => (setOverlay('phone'), setSeen(journal[0]?.id ?? 0))}
        >
          <Smartphone size={24} strokeWidth={2.4} />
          Phone
          {unseen > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--color-rose)] px-1 text-xs text-white ring-2 ring-white">{unseen}</span>}
        </button>
      </footer>

      {/* The pad: walk the Sim freely (arrow keys / WASD work too) */}
      {!placeId && !overlay && !sim.activity && (
        <div className="pointer-events-none absolute bottom-[6.25rem] left-3 z-20 lg:bottom-[7.5rem] lg:left-5">
          <Joystick disabled={!!sim.activity || !!pending} className="pointer-events-auto" />
        </div>
      )}
      {near && !placeId && !pending && !sim.activity && (
        <button
          className="motion-pop absolute bottom-[6.5rem] left-[152px] z-30 flex max-w-[calc(100vw-164px)] items-center lg:left-1/2 lg:max-w-sm lg:-translate-x-1/2 gap-2 rounded-2xl bg-[var(--color-ink)] py-2 pr-4 pl-2 text-left text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] lg:bottom-[7.5rem]"
          onClick={() => setPlaceId(near)}
        >
          <IconTile icon={DoorOpen} colors={['#ffa040', '#ff6a00']} size={32} radius={10} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-70">Entrer</span>
            <span className="block truncate text-sm font-extrabold">{placeName(near)}</span>
          </span>
        </button>
      )}

      {street?.happening && !near && !placeId && !pending && !sim.activity && (
        <button
          className="animate-pop absolute bottom-[6.5rem] left-[152px] z-20 flex max-w-[calc(100vw-164px)] items-center lg:left-1/2 lg:max-w-md lg:-translate-x-1/2 gap-2 rounded-full bg-[var(--color-gold)] py-1.5 pr-4 pl-1.5 text-left text-[#5a3a00] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] lg:bottom-[7.5rem]"
          onClick={() => walkTo('happening')}
        >
          <IconTile icon={iconFor(street.happening.icon)} colors={['#ffd54f', '#ffa000']} size={36} radius={18} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-80">En ce moment</span>
            <span className="block truncate font-display text-[15px] font-extrabold">{street.happening.label}</span>
          </span>
          <ChevronRight size={18} strokeWidth={3} className="shrink-0" />
        </button>
      )}

      {placeId === 'happening' && street?.happening && (
        <HappeningSheet now={street} sim={sim} commune={commune} onClose={() => setPlaceId(null)} onJoin={(it) => (setPlaceId(null), run(it.label, it.icon, 'happening', () => api.interact(sim.id, 'happening', it.id)))} />
      )}
      {placeId && placeId !== 'happening' && (
        <InteractionMenu world={world} sim={sim} city={city} commune={commune} placeId={placeId} desktop={desktop} onClose={() => setPlaceId(null)} onPick={interact} onTravel={travel} onStop={stop} />
      )}

      {sim.activity && !placeId && <ActivityBar sim={sim} onStop={stop} stopping={!!pending} onRoute={() => setOverlay('map')} />}

      <div className="pointer-events-none absolute top-[5.5rem] left-1/2 z-40 flex w-[min(400px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2 lg:top-24">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>

      {overlay === 'phone' && (
        <Phone world={world} sim={sim} commune={commune} journal={journal} time={c.time} act={run} onClose={() => setOverlay(null)} onMap={() => setOverlay('map')} onWalk={walkTo} />
      )}
      {overlay === 'map' && <WorldMap world={world} sim={sim} night={c.isNight} desktop={desktop} onClose={() => setOverlay(null)} onTravel={travel} onWalk={(id) => (setOverlay(null), walkTo(id))} />}
      {call && <DriverCall call={call} onClose={() => setCall(null)} />}
    </div>
  )
}

/* ---------- The in-game phone ---------- */

type PhoneProps = { world: World; sim: Sim; commune: Commune; journal: JournalEvent[]; time: string; act: Act; onClose: () => void; onMap: () => void; onWalk: (id: string) => void }

function Phone({ world, sim, commune, journal, time, act, onClose, onMap, onWalk }: PhoneProps) {
  const [app, setApp] = useState<null | 'here' | 'jobs' | 'home' | 'messages' | 'bank' | 'news'>(null)
  const navigate = useNavigate()
  const home = sim.homeCity === sim.city && sim.homeCommune === commune.id
  const places = [...(home ? [{ id: 'home', name: 'Chez toi', kind: 'home' }] : []), ...commune.places]
  const city = world.cities.find((c) => c.id === sim.city)!

  const APPS: { id: string; label: string; icon: LucideIcon; colors: [string, string]; open: () => void }[] = [
    { id: 'map', label: 'Carte', icon: MapIcon, colors: ['#69e2a0', '#00a862'], open: onMap },
    { id: 'here', label: 'Quartier', icon: MapPin, colors: ['#ffa040', '#ff6a00'], open: () => setApp('here') },
    { id: 'jobs', label: 'Boulot', icon: Briefcase, colors: ['#64b5ff', '#2a6cf0'], open: () => setApp('jobs') },
    { id: 'home', label: 'Logement', icon: House, colors: ['#ffb347', '#ff7a00'], open: () => setApp('home') },
    { id: 'news', label: 'Infos', icon: Newspaper, colors: ['#ff8a65', '#e8590c'], open: () => setApp('news') },
    { id: 'messages', label: 'Messages', icon: MessageCircle, colors: ['#b39dff', '#6c47ff'], open: () => setApp('messages') },
    { id: 'bank', label: 'Mobile Money', icon: Wallet, colors: ['#ffd54f', '#ffa000'], open: () => setApp('bank') },
    { id: 'profile', label: 'Profil', icon: UserRound, colors: ['#ff8a9b', '#ff3d57'], open: () => navigate('/profil', { viewTransition: true }) },
  ]
  const title = { here: commune.name, jobs: 'Boulot', home: 'Logement', messages: 'Messages', bank: 'Mobile Money', news: 'Infos · Côte d’Ivoire' }

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-[#0f1230]/55 backdrop-blur-[3px] sm:items-center" onClick={onClose}>
      <div
        className="animate-up relative h-[min(92%,760px)] w-[min(100%,380px)] rounded-[44px] bg-[#14161f] p-2.5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] max-sm:h-[88%] max-sm:rounded-b-none max-sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-[radial-gradient(120%_80%_at_50%_0%,#ffb27a,#e0306a_55%,#3b1d6e)] max-sm:rounded-b-none">
          <div className="flex items-center justify-between px-6 pt-3 pb-1 text-xs font-extrabold text-white">
            <span className="tnum">{time}</span>
            <span className="h-5 w-20 rounded-full bg-black" />
            <span>Orange CI · 4G</span>
          </div>

          {app === null ? (
            <div className="flex-1 overflow-y-auto px-5 pt-6">
              <div className="mb-6 text-center text-white">
                <div className="font-display text-5xl leading-none font-extrabold">{time}</div>
                <div className="mt-1 text-sm font-bold opacity-80">
                  {commune.name}, {city.name}
                </div>
              </div>
              <WordOfTheDay world={world} gameMinutes={sim.gameMinutes} />
              <div className="motion-stagger grid grid-cols-3 gap-x-3 gap-y-5">
                {APPS.map((a) => (
                  <button key={a.id} onClick={a.open} className="flex flex-col items-center gap-1.5 active:scale-95">
                    <span className="relative">
                      <IconTile icon={a.icon} colors={a.colors} size={60} radius={18} />
                      {((a.id === 'messages' && journal.length > 0) || (a.id === 'home' && sim.rentArrears > 0) || (a.id === 'jobs' && !sim.career)) && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--color-rose)] ring-2 ring-white" />
                      )}
                    </span>
                    <span className="text-xs font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-1 flex-col overflow-hidden rounded-t-[28px] bg-white">
              <div className="flex items-center gap-2 p-3">
                <button className="icon-btn bg-[var(--color-canvas)]" onClick={() => setApp(null)} aria-label="Retour">
                  <ChevronLeft size={22} strokeWidth={2.6} />
                </button>
                <h3 className="font-display text-xl font-extrabold">{title[app]}</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-6">
                {app === 'here' && (
                  <ul className="motion-stagger space-y-2">
                    {places.map((p) => (
                      <Row key={p.id} icon={iconFor(p.kind === 'home' ? 'house' : world.kinds[p.kind].icon)} colors={kindColors(p.kind)} title={p.name} sub={p.kind === 'home' ? 'Dormir, se doucher, cuisiner' : world.kinds[p.kind].label} onClick={() => onWalk(p.id)}>
                        <Footprints size={18} className="text-[var(--color-ink-soft)]" />
                      </Row>
                    ))}
                  </ul>
                )}
                {app === 'jobs' && <JobsApp world={world} sim={sim} commune={commune} act={act} onWalk={onWalk} onMap={onMap} />}
                {app === 'home' && <HomeApp world={world} sim={sim} commune={commune} act={act} />}
                {app === 'messages' && <Journal events={journal} />}
                {app === 'news' && <NewsApp />}
                {app === 'bank' && <BankApp sim={sim} act={act} journal={journal} renderJournal={(events) => <Journal events={events} />} />}
              </div>
            </div>
          )}
          <div className="mx-auto mt-auto mb-2 h-1.5 w-28 shrink-0 rounded-full bg-white/70 max-sm:hidden" />
        </div>
      </div>
    </div>
  )
}

/* ---------- Interaction menu ---------- */

type MenuProps = {
  world: World
  sim: Sim
  city: City
  commune: Commune
  placeId: string
  desktop: boolean
  onClose: () => void
  onPick: (it: Interaction, kind: string) => void
  onTravel: OnTravel
  onStop: () => void
}

function InteractionMenu({ world, sim, city, commune, placeId, desktop, onClose, onPick, onTravel, onStop }: MenuProps) {
  const place = placeId === 'home' ? { name: 'Chez toi', kind: 'home' } : commune.places.find((p) => p.id === placeId)!
  const kind = world.kinds[place.kind]
  const colors = kindColors(place.kind)
  const here = sim.city === city.id && sim.commune === commune.id
  const home = world.housings.find((h) => h.id === sim.housing)!
  const career = world.careers.find((c) => c.id === sim.career && c.kind === place.kind)
  const items = [...(career ? [shift(career, sim.careerLevel)] : []), ...kind.interactions.map((it) => (placeId === 'home' ? atHome(it, home) : it))]
  const busy = !!sim.activity
  const state = (it: Interaction) => ({ open: openAt(it, sim.gameMinutes), broke: it.cost > 0 && sim.money < it.cost, busy, reason: blockedBy(it, sim, city.id, commune.id) })

  // Desktop: the Sims radial menu around the place.
  if (desktop && here && !busy) {
    const rx = 250
    const ry = 175
    return (
      <div className="absolute inset-0 z-30 grid place-items-center bg-[#0f1230]/55 backdrop-blur-[3px]" onClick={onClose}>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button className="animate-pop relative z-10 flex flex-col items-center" onClick={onClose} aria-label="Fermer">
            <IconTile icon={iconFor(kind.icon)} colors={colors} size={96} radius={34} />
            <span className="mt-2 rounded-full bg-white px-4 py-1.5 font-display text-lg font-extrabold shadow-lg">{place.name}</span>
          </button>
          {items.map((it, i) => {
            const a = (i / items.length) * Math.PI * 2 - Math.PI / 2
            return (
              <div key={it.id} className="absolute top-1/2 left-1/2" style={{ transform: `translate(calc(-50% + ${Math.cos(a) * rx}px), calc(-50% + ${Math.sin(a) * ry}px))` }}>
                <div className="animate-pop" style={{ animationDelay: `${60 + i * 45}ms` }}>
                  <ActionButton it={it} colors={colors} {...state(it)} onPick={() => onPick(it, place.kind)} compact />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Mobile (and "not here"): a thumb-friendly action sheet.
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up max-h-[80%] w-full overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={iconFor(kind.icon)} colors={colors} size={52} />
          <div className="min-w-0 flex-1">
            <div className="label">{kind.label}</div>
            <div className="truncate font-display text-[22px] leading-tight font-extrabold">{place.name}</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        {busy && (
          <div className="mb-3 flex items-center gap-3 rounded-[20px] bg-[#fff4e8] p-3">
            <Hourglass className="shrink-0 text-[var(--color-orange)]" size={22} />
            <p className="min-w-0 flex-1 text-sm leading-snug font-bold text-[var(--color-ink-soft)]">
              {sim.firstName} est occupé·e : {sim.activity!.interaction.label.toLowerCase()}. Arrête pour faire autre chose.
            </p>
            {sim.activity!.kind === 'do' && (
              <button className="btn btn-soft shrink-0 !px-3 !py-2 !text-sm" onClick={onStop}>
                Arrêter
              </button>
            )}
          </div>
        )}
        {here ? (
          <div className="motion-stagger grid gap-2">
            {items.map((it) => (
              <ActionButton key={it.id} it={it} colors={colors} {...state(it)} onPick={() => onPick(it, place.kind)} />
            ))}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-bold text-[var(--color-ink-soft)]">
              {sim.firstName} n'est pas à {commune.name}. Vas-y d'abord pour faire une activité ici.
            </p>
            <TravelCTA world={world} sim={sim} cityId={city.id} communeId={commune.id} onTravel={onTravel} />
          </>
        )}
      </div>
    </div>
  )
}

function ActionButton({ it, colors, open, broke, busy, reason, onPick, compact }: { it: Interaction; colors: [string, string]; open: boolean; broke: boolean; busy?: boolean; reason?: string | null; onPick: () => void; compact?: boolean }) {
  const disabled = !open || broke || !!busy || !!reason
  const ups = NEEDS.filter((n) => it.effect[n.key] >= 10)
  return (
    <button
      disabled={disabled}
      onClick={onPick}
      className={`flex items-center gap-3 rounded-[20px] p-2.5 text-left transition ${compact ? 'w-60 bg-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.45)] hover:scale-105' : 'w-full bg-[var(--color-canvas)] active:scale-[0.98]'} ${disabled ? 'opacity-55 grayscale-[0.6] hover:scale-100' : ''}`}
    >
      <IconTile icon={disabled && (!open || reason) ? Lock : iconFor(it.icon)} colors={colors} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{it.label}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <Chip>
            <Clock3 size={11} /> {duration(it.minutes)}
          </Chip>
          {it.cost !== 0 && (
            <Chip tone={it.cost < 0 ? 'good' : 'gold'}>
              {it.cost < 0 ? '+' : '−'}
              {amount(Math.abs(it.cost))} F
            </Chip>
          )}
          {!open && <Chip tone="bad">{openingLabel(it)}</Chip>}
          {reason && <Chip tone="bad">{reason}</Chip>}
          {ups.map((n) => (
            <span key={n.key} className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#e3f9ee] text-[var(--color-emerald-deep)]" title={`${n.label} +`}>
              <n.icon size={12} strokeWidth={3} />
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}

/* ---------- What's going on in the street ---------- */

function HappeningSheet({ now, sim, commune, onClose, onJoin }: { now: HappeningNow; sim: Sim; commune: Commune; onClose: () => void; onJoin: (it: Interaction) => void }) {
  const h = now.happening!
  const left = Math.max(0, now.end - sim.gameMinutes)
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full overflow-hidden rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[var(--color-gold)] p-4 text-[#5a3a00]">
          <div className="flex items-center gap-3">
            <IconTile icon={iconFor(h.icon)} colors={['#ffffff66', '#ffffff22']} size={52} />
            <div className="min-w-0 flex-1">
              <div className="label !text-[#7a5200]">En ce moment à {commune.name}</div>
              <div className="font-display text-[22px] leading-tight font-extrabold">{h.label}</div>
            </div>
            <button className="icon-btn bg-white/60" onClick={onClose} aria-label="Fermer">
              <X size={22} strokeWidth={2.6} />
            </button>
          </div>
          <p className="mt-2 text-sm leading-snug font-bold">{h.text}</p>
          <div className="mt-2">
            <Chip tone="dark">
              <Clock3 size={12} /> Encore {duration(left)}
            </Chip>
          </div>
        </div>
        <div className="p-4">
          {h.join ? (
            <ActionButton it={h.join} colors={['#ffd54f', '#ffa000']} open={openAt(h.join, sim.gameMinutes)} broke={h.join.cost > 0 && sim.money < h.join.cost} busy={!!sim.activity} reason={blockedBy(h.join, sim, sim.city, commune.id)} onPick={() => onJoin(h.join!)} />
          ) : (
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">Rien à faire ici à part regarder… et attendre que ça passe.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Feedback ---------- */

/** What the Sim is busy with, on real time: progress, time left, and a way to stop. */
function ActivityBar({ sim, onStop, stopping, onRoute }: { sim: Sim; onStop: () => void; stopping: boolean; onRoute: () => void }) {
  const a = sim.activity!
  const span = Math.max(1, a.end - a.start)
  const done = Math.min(1, Math.max(0, (sim.gameMinutes - a.start) / span))
  const left = Math.max(0, Math.ceil(a.end - sim.gameMinutes))
  const travel = a.kind === 'travel'
  const icon = travel ? CarTaxiFront : iconFor(a.interaction.icon)
  const colors = travel ? (['#ffa040', '#ff6a00'] as [string, string]) : kindColors(a.placeKind ?? '')
  return (
    <div className="absolute bottom-[6.5rem] left-1/2 z-30 w-[min(360px,calc(100vw-24px))] -translate-x-1/2 lg:bottom-[7.5rem]">
      <div className="card animate-pop flex items-center gap-3 p-3">
        <IconTile icon={icon} colors={colors} size={46} />
        <div className="min-w-0 flex-1">
          <div className="label truncate">{travel ? 'En route' : a.placeName}</div>
          <div className="truncate font-display text-[15px] leading-tight font-extrabold">{travel ? a.trip!.label.replace(/^Trajet /, '') : a.interaction.label}</div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div className="h-full rounded-full bg-[var(--color-emerald)] transition-[width] duration-1000 ease-linear" style={{ width: `${done * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">{left > 0 ? `Encore ${duration(left)} · fin à ${clock(a.end).time}` : 'Presque fini…'}</div>
        </div>
        {travel && (
          <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onRoute} aria-label="Voir le trajet" title="Voir le trajet">
            <MapIcon size={20} strokeWidth={2.4} />
          </button>
        )}
        {!travel && (
          <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onStop} disabled={stopping} aria-label="Arrêter" title="Arrêter">
            <Square size={18} strokeWidth={2.8} />
          </button>
        )}
      </div>
    </div>
  )
}

function ToastCard({ toast: t }: { toast: Toast }) {
  const icon = t.tone === 'random' ? Dice5 : t.tone === 'promo' ? BadgeCheck : t.tone === 'error' ? TriangleAlert : t.icon ? iconFor(t.icon) : Sparkles
  const colors: [string, string] =
    t.tone === 'random' || t.tone === 'event' ? ['#ffd54f', '#ffa000'] : t.tone === 'promo' ? ['#69e2a0', '#00a862'] : t.tone === 'error' ? ['#ff8a9b', '#ff3d57'] : kindColors(t.kind ?? '')
  return (
    <div className={`card animate-pop pointer-events-auto flex items-center gap-3 p-3 ${t.tone === 'random' || t.tone === 'event' ? 'ring-2 ring-[var(--color-gold)]' : t.tone === 'promo' ? 'ring-2 ring-[var(--color-emerald)]' : ''}`}>
      <IconTile icon={icon} colors={colors} size={44} />
      <div className="min-w-0 flex-1">
        <div className="font-display text-[15px] leading-tight font-extrabold">{t.title}</div>
        {t.text && <div className="text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{t.text}</div>}
      </div>
      {t.money !== 0 && <MoneyDelta value={t.money} />}
    </div>
  )
}

export function MoneyDelta({ value }: { value: number }) {
  return (
    <span className={`flex shrink-0 items-center gap-1 font-display text-base font-extrabold ${value > 0 ? 'text-[var(--color-emerald-deep)]' : 'text-[#d81b3f]'}`}>
      {value > 0 ? '+' : '−'}
      {amount(Math.abs(value))}
      <Coin size={16} />
    </span>
  )
}

export function Journal({ events }: { events: JournalEvent[] }) {
  if (!events.length) return <p className="text-sm font-bold text-[var(--color-ink-soft)]">Rien pour l'instant. Va vivre ta vie !</p>
  return (
    <ol className="relative space-y-2">
      {events.map((e) => {
        const c = clock(e.gameTime)
        const [icon, colors]: [LucideIcon, [string, string]] =
          e.kind === 'random'
            ? [Dice5, ['#ffd54f', '#ffa000']]
            : e.kind === 'travel'
              ? [Bus, ['#8c9eff', '#3d4fd6']]
              : e.kind === 'bill'
                ? [ReceiptText, ['#ff8a9b', '#ff3d57']]
                : e.kind === 'career'
                  ? [BadgeCheck, ['#69e2a0', '#00a862']]
                  : [Sparkles, ['#ffa040', '#ff6a00']]
        return (
          <li key={e.id} className={`flex items-center gap-3 rounded-[20px] p-2.5 ${e.kind === 'random' ? 'bg-[#fff7df]' : 'bg-[var(--color-canvas)]'}`}>
            <IconTile icon={icon} colors={colors} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-snug font-bold">{e.text}</div>
              <div className="text-[11px] font-extrabold text-[var(--color-ink-soft)]">
                {c.stamp}
              </div>
            </div>
            {e.money !== 0 && <MoneyDelta value={e.money} />}
          </li>
        )
      })}
    </ol>
  )
}

/** "Le mot du jour": a Nouchi or Ivorian French expression, one per real day, from the checked ones only. */
function WordOfTheDay({ world, gameMinutes }: { world: World; gameMinutes: number }) {
  const words = (world.expressions ?? []).filter((e) => e.source.status === 'verified' || e.source.status === 'partial')
  if (!words.length) return null
  const e = words[Math.floor(gameMinutes / (24 * 60)) % words.length]
  return (
    <div className="mb-5 rounded-2xl bg-white/15 p-3 text-white backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold tracking-wide uppercase opacity-80">Le mot du jour · {e.lang}</span>
        {e.source.urls?.[0] && (
          <a href={e.source.urls[0]} target="_blank" rel="noreferrer" className="text-[11px] font-bold underline opacity-80">
            source
          </a>
        )}
      </div>
      <div className="mt-1 font-display text-xl leading-tight font-extrabold">« {e.text} »</div>
      <p className="text-sm leading-snug font-semibold opacity-95">{e.meaning}</p>
      <p className="mt-1 text-xs italic opacity-80">{e.example}</p>
    </div>
  )
}
