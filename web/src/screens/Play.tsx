import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Briefcase, Newspaper, Building2, Bus, CarTaxiFront, ChevronLeft, ChevronRight, Clock3, Dice5, Footprints, House, Lock, Map as MapIcon, MapPin, MessageCircle, ReceiptText, Smartphone, Sparkles, TriangleAlert, UserRound, Wallet, X, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import type { City, Commune, HappeningNow, Interaction, JournalEvent, Sim, World } from '../lib/types'
import { useWorld } from '../store/world'
import { GameMap } from '../components/map/GameMap'
import { boundsFor, pinsFor, type Focus, type Padding } from '../components/map/pins'
import { Portrait } from '../avatar/portrait'
import { Neighbourhood } from '../world3d/Neighbourhood'
import { iconFor, kindColors } from '../components/icons'
import { Chip, Coin, DayNight, IconTile, MotiveRing, Plumbob, Row, needColor } from '../components/ui'
import { NEEDS, amount, atHome, available, clock, decay, duration, hours, mood, shift, trip } from '../game/rules'
import { BankApp, HomeApp, JobsApp, type Act } from './phoneApps'
import { NewsApp, topicOf } from './NewsApp'

const MAX_LOCAL_CATCH_UP = 180 // game minutes, mirrors the server cap
const SHEET_PEEK = 0.38 // share of the screen the mobile sheet covers when collapsed

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
  const [toasts, setToasts] = useState<Toast[]>([])
  const [street, setStreet] = useState<HappeningNow | null>(null)
  const announced = useRef('')

  useEffect(() => {
    api.sims().then(async (sims) => {
      if (!sims.length) return navigate('/creer', { replace: true })
      const full = await api.sim(sims[0].id)
      setBase({ sim: full, at: Date.now() })
      setJournal(full.journal)
      setSeen(full.journal[0]?.id ?? 0)
    })
  }, [navigate])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Between server round-trips the clock and needs advance locally.
  const sim = useMemo(() => {
    if (!base) return null
    const mins = Math.min(Math.floor((now - base.at) / 1000), MAX_LOCAL_CATCH_UP)
    return { ...base.sim, gameMinutes: base.sim.gameMinutes + mins, needs: decay(base.sim.needs, mins) }
  }, [base, now])

  const slot = sim ? Math.floor(sim.gameMinutes / 120) : -1
  const where = sim?.commune
  useEffect(() => {
    if (!where || slot < 0) return
    let live = true
    api
      .happening(where, slot * 120 + 1)
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

  const run: Act = async (label, icon, kind, call) => {
    setPending({ label, icon, kind })
    const started = Date.now()
    try {
      const res = await call()
      await new Promise((r) => setTimeout(r, Math.max(0, 2200 - (Date.now() - started))))
      setBase({ sim: res.sim, at: Date.now() })
      setJournal(res.journal)
      toast({ tone: 'done', title: res.outcome.text, money: res.outcome.money, kind, icon })
      if (res.outcome.promotion) setTimeout(() => toast({ tone: 'promo', title: 'Promotion !', text: res.outcome.promotion!.replace(/^Promotion ! /, ''), money: 0 }), 400)
      if (res.outcome.random) setTimeout(() => toast({ tone: 'random', title: 'Imprévu !', text: res.outcome.random!.text, money: res.outcome.random!.money }), 600)
      const bills = res.outcome.bills ?? []
      if (bills.length) setTimeout(() => toast({ tone: 'random', title: 'Samedi, jour du loyer', text: bills.map((b) => b.text).join(' '), money: bills.reduce((t, b) => t + b.money, 0) }), 900)
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
  const travel = (cityId: string, communeId: string, label: string) => {
    setPlaceId(null)
    setOverlay(null)
    run(label, 'bus', 'transport', () => api.travel(sim!.id, cityId, communeId))
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
  const city = world.cities.find((x) => x.id === sim.city)!
  const commune = city.communes.find((x) => x.id === sim.commune)!
  const unseen = journal.filter((e) => e.id > seen).length

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
          busy={pending}
          happening={happening}
        />
      </div>

      {/* ---------- Top HUD ---------- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-5">
        <Link to="/profil" className="hud pointer-events-auto flex items-center gap-2.5 rounded-full py-1 pr-4 pl-1 transition active:scale-95">
          <span className="block rounded-full p-[3px]" style={{ background: `conic-gradient(${moodHex} ${mood(sim.needs) * 3.6}deg, #e7e9f2 0)` }}>
            <span className="block h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]">
              <Portrait look={sim.look} gender={sim.gender} framing="head" />
            </span>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[17px] font-extrabold">{sim.firstName}</span>
            <span className="flex items-center gap-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
              <MapPin size={11} strokeWidth={3} />
              {commune.name} · {city.name}
            </span>
          </span>
        </Link>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          <div key={sim.money} className="hud animate-pop flex h-11 items-center gap-1.5 rounded-full pr-4 pl-1.5">
            <Coin size={30} />
            <span className="tnum font-display text-lg font-extrabold">{amount(sim.money)}</span>
          </div>
          <div className="hud flex h-11 items-center gap-1.5 rounded-full px-3">
            <DayNight night={c.isNight} />
            <span className="tnum font-display text-lg font-extrabold">{c.time}</span>
            <span className="text-xs font-extrabold text-[var(--color-ink-soft)] max-sm:hidden">
              {c.weekday} · J{c.day}
            </span>
          </div>
        </div>
      </header>

      {/* ---------- Bottom HUD: needs, map, phone ---------- */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-5">
        <button className="hud pointer-events-auto flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[22px] font-display text-[11px] font-extrabold active:scale-95" onClick={() => setOverlay('map')}>
          <MapIcon size={24} strokeWidth={2.4} className="text-[var(--color-emerald)]" />
          Carte
        </button>
        <div className="hud pointer-events-auto flex flex-1 justify-around gap-1 rounded-[26px] px-2 py-2 sm:max-w-md sm:flex-none sm:gap-3 sm:px-4">
          {NEEDS.map((n) => (
            <MotiveRing key={n.key} value={sim.needs[n.key]} icon={n.icon} label={desktop ? n.label : undefined} size={desktop ? 52 : 44} />
          ))}
        </div>
        <button
          className="pointer-events-auto relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[22px] bg-gradient-to-b from-[#ff9a2e] to-[#f56d00] font-display text-[11px] font-extrabold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_4px_0_#e05a00,0_12px_24px_-8px_rgba(224,90,0,0.6)] active:translate-y-0.5"
          onClick={() => (setOverlay('phone'), setSeen(journal[0]?.id ?? 0))}
        >
          <Smartphone size={24} strokeWidth={2.4} />
          Phone
          {unseen > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--color-rose)] px-1 text-xs text-white ring-2 ring-white">{unseen}</span>}
        </button>
      </footer>

      {street?.happening && !placeId && !pending && (
        <button
          className="animate-pop absolute bottom-[6.5rem] left-1/2 z-20 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--color-gold)] py-1.5 pr-4 pl-1.5 text-left text-[#5a3a00] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] ring-2 ring-white lg:bottom-[7.5rem]"
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
        <HappeningSheet now={street} sim={sim} hour={c.hour} commune={commune} onClose={() => setPlaceId(null)} onJoin={(it) => (setPlaceId(null), run(it.label, it.icon, 'happening', () => api.interact(sim.id, 'happening', it.id)))} />
      )}
      {placeId && placeId !== 'happening' && (
        <InteractionMenu world={world} sim={sim} city={city} commune={commune} placeId={placeId} hour={c.hour} desktop={desktop} onClose={() => setPlaceId(null)} onPick={interact} onTravel={travel} />
      )}

      {pending && <ActionProgress {...pending} name={sim.firstName} />}

      <div className="pointer-events-none absolute top-[5.5rem] left-1/2 z-40 flex w-[min(400px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2 lg:top-24">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>

      {overlay === 'phone' && (
        <Phone world={world} sim={sim} commune={commune} journal={journal} time={c.time} act={run} onClose={() => setOverlay(null)} onMap={() => setOverlay('map')} onWalk={walkTo} />
      )}
      {overlay === 'map' && <TravelMap world={world} sim={sim} desktop={desktop} onClose={() => setOverlay(null)} onTravel={travel} onWalk={walkTo} />}
    </div>
  )
}

/* ---------- Travel map (the old map view, now a full-screen overlay) ---------- */

function TravelMap({ world, sim, desktop, onClose, onTravel, onWalk }: { world: World; sim: Sim; desktop: boolean; onClose: () => void; onTravel: ExploreProps['onTravel']; onWalk: (id: string) => void }) {
  const [focus, setFocus] = useState<Focus>({ cityId: sim.city })
  const [expanded, setExpanded] = useState(false)
  const c = clock(sim.gameMinutes)
  const bounds = useMemo(() => boundsFor(world, focus), [world, focus])
  const here = (cityId?: string, communeId?: string) => cityId === sim.city && communeId === sim.commune
  const pins = useMemo(
    () =>
      pinsFor(world, focus, sim, null, {
        onCity: (cityId) => setFocus({ cityId }),
        onCommune: (cityId, communeId) => setFocus({ cityId, communeId }),
        onPlace: (id) => here(focus.cityId, focus.communeId) && onWalk(id),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, focus, sim.city, sim.commune],
  )
  const padding = useMemo<Padding>(
    () => (desktop ? { top: 110, bottom: 60, left: 440, right: 80 } : { top: 90, bottom: Math.round(window.innerHeight * SHEET_PEEK) + 30, left: 24, right: 24 }),
    [desktop],
  )
  const city = world.cities.find((x) => x.id === focus.cityId)
  const commune = city?.communes.find((x) => x.id === focus.communeId)

  return (
    <div className="animate-up absolute inset-0 z-50 bg-[var(--color-night)]">
      <GameMap pins={pins} bounds={bounds} night={c.isNight} sim={sim} padding={padding} />
      <button className="hud absolute top-3 right-3 z-20 grid h-12 w-12 place-items-center rounded-full lg:top-5 lg:right-5" onClick={onClose} aria-label="Fermer la carte">
        <X size={24} strokeWidth={2.6} />
      </button>
      <aside
        className="sheet absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-[28px] transition-[height] duration-300 ease-out lg:top-5 lg:bottom-5 lg:left-5 lg:!h-auto lg:w-[400px] lg:rounded-[28px]"
        style={{ height: `${(expanded ? 0.72 : SHEET_PEEK) * 100}%` }}
      >
        <button className="mx-auto flex h-5 w-16 shrink-0 items-center justify-center lg:hidden" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Réduire' : 'Agrandir'}>
          <span className="h-1.5 w-10 rounded-full bg-[var(--color-line)]" />
        </button>
        <div onScroll={(e) => !desktop && !expanded && e.currentTarget.scrollTop > 24 && setExpanded(true)} className="flex-1 overflow-y-auto px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-5 lg:pt-5">
          <Explore
            world={world}
            sim={sim}
            city={city}
            commune={commune}
            setFocus={(f) => (setFocus(f), setExpanded(false))}
            onPlace={(id) => (here(city?.id, commune?.id) ? onWalk(id) : undefined)}
            onTravel={onTravel}
          />
        </div>
      </aside>
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
    { id: 'profile', label: 'Profil', icon: UserRound, colors: ['#ff8a9b', '#ff3d57'], open: () => navigate('/profil') },
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
              <div className="grid grid-cols-3 gap-x-3 gap-y-5">
                {APPS.map((a) => (
                  <button key={a.id} onClick={a.open} className="flex flex-col items-center gap-1.5 active:scale-95">
                    <span className="relative">
                      <IconTile icon={a.icon} colors={a.colors} size={60} radius={18} />
                      {((a.id === 'messages' && journal.length > 0) || (a.id === 'home' && sim.rentArrears > 0) || (a.id === 'jobs' && !sim.career)) && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--color-rose)] ring-2 ring-white" />
                      )}
                    </span>
                    <span className="text-xs font-extrabold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">{a.label}</span>
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
                  <ul className="space-y-2">
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

/* ---------- Explore panel ---------- */

type ExploreProps = {
  world: World
  sim: Sim
  city?: City
  commune?: Commune
  setFocus: (f: Focus) => void
  onPlace: (id: string) => void
  onTravel: (cityId: string, communeId: string, label: string) => void
}

function Explore({ world, sim, city, commune, setFocus, onPlace, onTravel }: ExploreProps) {
  const simCity = world.cities.find((c) => c.id === sim.city)!
  const simCommune = simCity.communes.find((c) => c.id === sim.commune)!
  const here = (cityId: string, communeId?: string) => cityId === sim.city && (!communeId || communeId === sim.commune)
  const back = commune ? () => setFocus({ cityId: city!.id }) : city ? () => setFocus({}) : undefined

  return (
    <div className="animate-up" key={`${city?.id}-${commune?.id}`}>
      <div className="mb-3 flex items-start gap-2">
        {back && (
          <button className="icon-btn -ml-1 shrink-0 bg-[var(--color-canvas)]" onClick={back} aria-label="Retour">
            <ChevronLeft size={22} strokeWidth={2.6} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="label">{commune ? city!.name : city ? "Côte d'Ivoire" : 'Carte'}</div>
          <h2 className="font-display text-[26px] leading-tight font-extrabold">{commune?.name ?? city?.name ?? 'Où aller ?'}</h2>
          <p className="text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{commune?.blurb ?? city?.blurb ?? 'Choisis une ville. Le car coûte du temps… et des francs.'}</p>
        </div>
      </div>

      {commune && !here(city!.id, commune.id) && <TravelCTA world={world} sim={sim} cityId={city!.id} communeId={commune.id} onTravel={onTravel} />}

      <ul className="space-y-2">
        {!city &&
          world.cities.map((c) => {
            const t = trip(simCity.id, simCommune, c.id, c.communes[0])
            return (
              <Row key={c.id} icon={c.id === sim.homeCity ? House : Building2} colors={['#ffa040', '#ff6a00']} title={c.name} sub={c.blurb} onClick={() => setFocus({ cityId: c.id })}>
                {here(c.id) ? <HereChip /> : <FareChip fare={t.fare} minutes={t.minutes} />}
              </Row>
            )
          })}

        {city &&
          !commune &&
          city.communes.map((cm) => {
            const t = trip(simCity.id, simCommune, city.id, cm)
            const home = city.id === sim.homeCity && cm.id === sim.homeCommune
            return (
              <Row key={cm.id} icon={home ? House : MapPin} colors={home ? ['#ffa040', '#ff6a00'] : ['#69e2a0', '#00a862']} title={cm.name} sub={cm.blurb} onClick={() => setFocus({ cityId: city.id, communeId: cm.id })}>
                {here(city.id, cm.id) ? <HereChip /> : <FareChip fare={t.fare} />}
              </Row>
            )
          })}

        {commune && (
          <>
            {sim.homeCity === city!.id && sim.homeCommune === commune.id && (
              <Row icon={House} colors={kindColors('home')} title="Chez toi" sub="Dormir, se doucher, cuisiner" onClick={() => onPlace('home')}>
                <ChevronRight size={20} className="text-[var(--color-ink-soft)]" />
              </Row>
            )}
            {commune.places.map((p) => {
              const k = world.kinds[p.kind]
              return (
                <Row key={p.id} icon={iconFor(k.icon)} colors={kindColors(p.kind)} title={p.name} sub={`${k.label} · ${k.interactions.length} activités`} onClick={() => onPlace(p.id)}>
                  <ChevronRight size={20} className="text-[var(--color-ink-soft)]" />
                </Row>
              )
            })}
          </>
        )}
      </ul>
    </div>
  )
}

const HereChip = () => <Chip tone="good">Tu es ici</Chip>

function FareChip({ fare, minutes }: { fare: number; minutes?: number }) {
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="flex items-center gap-1 font-display text-sm font-extrabold">
        <Coin size={15} />
        {amount(fare)}
      </span>
      {minutes !== undefined && <span className="text-[11px] font-bold text-[var(--color-ink-soft)]">{duration(minutes)}</span>}
    </span>
  )
}

function TravelCTA({ world, sim, cityId, communeId, onTravel }: { world: World; sim: Sim; cityId: string; communeId: string; onTravel: ExploreProps['onTravel'] }) {
  const fromCity = world.cities.find((c) => c.id === sim.city)!
  const from = fromCity.communes.find((c) => c.id === sim.commune)!
  const toCity = world.cities.find((c) => c.id === cityId)!
  const to = toCity.communes.find((c) => c.id === communeId)!
  const t = trip(fromCity.id, from, toCity.id, to)
  const bus = t.mode === 'car'
  const label = bus ? `En car vers ${toCity.name}` : `En woro-woro vers ${to.name}`
  return (
    <div className="mb-3 rounded-[22px] bg-gradient-to-br from-[#fff4e8] to-[#ffe6cc] p-3">
      <div className="mb-2.5 flex items-center gap-2.5">
        <IconTile icon={bus ? Bus : CarTaxiFront} colors={['#ffa040', '#ff6a00']} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-base font-extrabold">{bus ? 'Prendre le car' : 'Prendre un woro-woro'}</div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">
            {from.name} → {to.name}
          </div>
        </div>
        <Chip>
          <Clock3 size={12} /> {duration(t.minutes)}
        </Chip>
      </div>
      <button className="btn w-full" disabled={sim.money < t.fare} onClick={() => onTravel(cityId, communeId, label)}>
        Y aller · <Coin size={22} /> {amount(t.fare)}
      </button>
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
  hour: number
  desktop: boolean
  onClose: () => void
  onPick: (it: Interaction, kind: string) => void
  onTravel: ExploreProps['onTravel']
}

function InteractionMenu({ world, sim, city, commune, placeId, hour, desktop, onClose, onPick, onTravel }: MenuProps) {
  const place = placeId === 'home' ? { name: 'Chez toi', kind: 'home' } : commune.places.find((p) => p.id === placeId)!
  const kind = world.kinds[place.kind]
  const colors = kindColors(place.kind)
  const here = sim.city === city.id && sim.commune === commune.id
  const home = world.housings.find((h) => h.id === sim.housing)!
  const career = world.careers.find((c) => c.id === sim.career && c.kind === place.kind)
  const items = [...(career ? [shift(career, sim.careerLevel)] : []), ...kind.interactions.map((it) => (placeId === 'home' ? atHome(it, home) : it))]
  const state = (it: Interaction) => ({ open: available(it, hour), broke: it.cost > 0 && sim.money < it.cost })

  // Desktop: the Sims radial menu around the place.
  if (desktop && here) {
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
        {here ? (
          <div className="grid gap-2">
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

function ActionButton({ it, colors, open, broke, onPick, compact }: { it: Interaction; colors: [string, string]; open: boolean; broke: boolean; onPick: () => void; compact?: boolean }) {
  const disabled = !open || broke
  const ups = NEEDS.filter((n) => it.effect[n.key] >= 10)
  return (
    <button
      disabled={disabled}
      onClick={onPick}
      className={`flex items-center gap-3 rounded-[20px] p-2.5 text-left transition ${compact ? 'w-60 bg-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.45)] hover:scale-105' : 'w-full bg-[var(--color-canvas)] active:scale-[0.98]'} ${disabled ? 'opacity-55 grayscale-[0.6] hover:scale-100' : ''}`}
    >
      <IconTile icon={disabled && !open ? Lock : iconFor(it.icon)} colors={colors} size={44} />
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
          {!open && <Chip tone="bad">{hours(it)}</Chip>}
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

function HappeningSheet({ now, sim, hour, commune, onClose, onJoin }: { now: HappeningNow; sim: Sim; hour: number; commune: Commune; onClose: () => void; onJoin: (it: Interaction) => void }) {
  const h = now.happening!
  const left = Math.max(0, now.end - sim.gameMinutes)
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full overflow-hidden rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-[#ffd54f] to-[#ffa000] p-4 text-[#5a3a00]">
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
            <ActionButton it={h.join} colors={['#ffd54f', '#ffa000']} open={available(h.join, hour)} broke={h.join.cost > 0 && sim.money < h.join.cost} onPick={() => onJoin(h.join!)} />
          ) : (
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">Rien à faire ici à part regarder… et attendre que ça passe.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Feedback ---------- */

function ActionProgress({ label, icon, kind, name }: { label: string; icon: string; kind: string; name: string }) {
  // Non-blocking: the Sim acts it out in the 3D scene, this just shows progress.
  return (
    <div className="pointer-events-none absolute bottom-28 left-1/2 z-30 w-[min(320px,85vw)] -translate-x-1/2 lg:bottom-32">
      <div className="card animate-pop flex items-center gap-3 p-3">
        <IconTile icon={iconFor(icon)} colors={kindColors(kind)} size={44} />
        <div className="min-w-0 flex-1">
          <div className="label">{name}</div>
          <div className="truncate font-display text-base leading-tight font-extrabold">{label}</div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#22d388] to-[#00b86b]" style={{ animation: 'grow 2.2s ease-in-out forwards' }} />
          </div>
        </div>
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
                {c.weekday} · Jour {c.day} · {c.time}
              </div>
            </div>
            {e.money !== 0 && <MoneyDelta value={e.money} />}
          </li>
        )
      })}
    </ol>
  )
}
