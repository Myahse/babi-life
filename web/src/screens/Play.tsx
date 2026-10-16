import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Cake, Hammer, Eye, LocateFixed, Mountain, Navigation, Briefcase, DoorOpen, Hourglass, Newspaper, Square, Shirt, Scissors, Bus, CarTaxiFront, ChevronLeft, ChevronRight, Clock3, Dice5, Footprints, House, Lock, Map as MapIcon, MapPin, MessageCircle, ReceiptText, Smartphone, Sparkles, TriangleAlert, UserRound, Users, X, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import type { ActionResult, City, Commune, HappeningNow, Interaction, JournalEvent, Sim, World, Ride, Place } from '../lib/types'
import { useWorld } from '../store/world'
import { useSession } from '../store/session'
import { useLive } from '../lib/live'
import { WorldMap } from './WorldMap'
import { Joystick, RunButton } from '../components/Joystick'
import { cameraTurn } from '../world3d/input'
import { whereabouts } from '../world3d/whereabouts'
import { OrbitGizmo } from '../components/OrbitGizmo'
import { FirstSteps } from '../components/FirstSteps'
import { TravelCTA, type OnTravel } from '../components/TravelCTA'
import { Portrait } from '../avatar/portrait'
import { Neighbourhood } from '../world3d/Neighbourhood'
import { OpenWorld } from '../world3d/open/OpenWorld'
import { iconFor, kindColors } from '../components/icons'
import { Chip, Coin, DayNight, IconTile, MotiveRing, MoodPin, Row, needColor } from '../components/ui'
import { NEEDS, ageBlock, amount, atHome, blockedBy, lifeOf, clock, duration, mood, openAt, openingLabel, predict, shift } from '../game/rules'
import { DOORS_OPEN, eventAt, useStadium, when } from '../lib/stadium'
import { HomeApp, JobsApp, type Act } from './phoneApps'
import { NewsApp, topicOf } from './NewsApp'
import { RideFlow, type FlowRequest } from '../components/RideFlow'
import { INDOOR, Interior } from '../world3d/Interior'
import { ARENAS, Arena } from '../world3d/interior/Arena'
import { AppLogo } from '../components/AppLogo'
import { GolvoApp, deliveryState, type Delivery } from './GolvoApp'
import { GbairaiApp } from './GbairaiApp'
import { WayeApp } from './WayeApp'
import { StoreApp } from './StoreApp'
import { FriendsApp } from './FriendsApp'
import { InviteBanner, PlayersChip, PlayersSheet, usePlayers } from '../components/Players'
import { SoundToggle, Soundtrack } from '../components/Soundtrack'
import { MiniMap, WhereTo } from '../components/Navigator'
import { ChatSheet } from '../components/ChatSheet'
import type { Npc } from '../world3d/open/OpenWorld'
import type { Track } from '../audio/music'

/** Building one's house: its own screen, downloaded when opened. */
const BuildMode = lazy(() => import('../components/BuildMode'))

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

// In development, ?hour=22 shows the street at that hour (to check the night).
const HOUR_OVERRIDE = import.meta.env.DEV && new URLSearchParams(location.search).get('hour') ? Number(new URLSearchParams(location.search).get('hour')) : undefined
const MAP_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

/**
 * The commune with its places from the map added (for the menus, names and
 * kinds of what the Sim walks to), the same object while neither changes.
 */
const withMap = new WeakMap<Commune, { list: Place[]; merged: Commune }>()
function withMapPlaces(c: Commune, list: Place[]): Commune {
  if (!list.length) return c
  const had = withMap.get(c)
  if (had?.list === list) return had.merged
  const merged = { ...c, places: [...c.places, ...list] }
  withMap.set(c, { list, merged })
  own.set(merged, c)
  return merged
}
/** The commune as the server sends it, without the map's places (the world adds its own). */
const own = new WeakMap<Commune, Commune>()
const ownPlaces = (c: Commune) => own.get(c) ?? c

const streetPose = () => ({ heading: whereabouts.heading, polar: whereabouts.polar })

/** The street sellers (world3d/open/stalls.tsx; backend sims/street.go): what buying from each is called. */
const STREET_SELLERS: Record<string, [string, string]> = {
  alloco: ["L'alloco de la tantie", 'banana'],
  porc: ['Le porc au four', 'drumstick'],
  cafe: ['Le café du pousse-pousse', 'coffee'],
  the: ['Le thé avec les gars', 'cup-soda'],
  garba: ['Le garba du garbadrome', 'fish'],
  brochette: ['Le pain brochette', 'sandwich'],
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
  const [flow, setFlow] = useState<FlowRequest | null>(null)
  // Looking at the street rather than inside the place the Sim is in.
  const [outside, setOutside] = useState(false)
  // A Golvo order on its way, and the phone app to open.
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [phoneApp, setPhoneApp] = useState<PhoneAppId | null>(null)
  // The other players in the commune, and the invitations they send.
  const [players, setPlayers] = useState<{ focus: string | null } | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])
  // The camera dragged away from the Sim, and the way back.
  const [freeCam, setFreeCam] = useState(false)
  const [recenter, setRecenter] = useState(0)
  // The real streets (open world): from Mapbox with a token, else from
  // OpenFreeMap (no key). The classic street if they don't load, or ?classic.
  const [classic, setClassic] = useState(() => new URLSearchParams(location.search).has('classic'))
  // The commune's places from the map, as the open world loads them around the Sim.
  const [mapPlaces, setMapPlaces] = useState<Place[]>([])
  // Three views of the street: close behind the perso (the default), over its
  // shoulder (third person), or from above. The choice is remembered.
  const [view, setView] = useState<'pres' | 'epaule' | 'haut'>(() => {
    try {
      const v = localStorage.getItem('babi.view')
      if (v === 'pres' || v === 'epaule' || v === 'haut') return v
      return localStorage.getItem('babi.closeView') === 'false' ? 'haut' : 'pres'
    } catch {
      return 'pres'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('babi.view', view)
    } catch {
      /* private window */
    }
  }, [view])
  const closeView = view !== 'haut'
  const NEXT_VIEW = { pres: 'epaule', epaule: 'haut', haut: 'pres' } as const
  const [whereTo, setWhereTo] = useState(false)
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
        if (e.kind === 'robbed') toast({ tone: 'random', title: 'Les nouchis du couloir !', text: e.text, money: e.money })
        else if (e.kind === 'random') toast({ tone: 'random', title: 'Imprévu !', text: e.text, money: e.money })
        else if (e.kind === 'career') toast({ tone: 'promo', title: 'Promotion !', text: e.text.replace(/^Promotion ! /, ''), money: 0 })
        else if (e.kind === 'travel') toast({ tone: 'done', title: 'Bien arrivé·e !', text: e.text, money: e.money, icon: 'car-taxi-front', kind: 'transport' })
        else toast({ tone: 'done', title: 'Terminé', text: e.text, money: e.money })
      }, 300 + i * 700),
    )
    if (bills.length) setTimeout(() => toast({ tone: 'random', title: 'Samedi, jour du loyer', text: bills.map((b) => b.text).join(' '), money: bills.reduce((t, b) => t + b.money, 0) }), 300 + rest.length * 700)
  }

  // Talking to someone in the street (and who, while the chat lasts).
  const [chat, setChat] = useState<Npc | null>(null)
  // Someone calling out to the Sim, for a few seconds.
  const [calling, setCalling] = useState<{ npc: Npc; text: string } | null>(null)
  useEffect(() => {
    if (!calling) return
    const t = setTimeout(() => setCalling(null), 7000)
    return () => clearTimeout(t)
  }, [calling])
  const talkedTo = useRef<string | null>(null)
  const say = async (topic: string, label: string, phrase?: string) => {
    const npc = chat!
    talkedTo.current = npc.id
    let said: string | null = null
    await run(label, 'messages-square', 'social', async () => {
      const res = await api.chat(sim!.id, { id: npc.id, name: npc.name, gender: npc.gender, seed: npc.seed }, topic, phrase)
      said = res.outcome.text
      return res
    })
    return said
  }

  const run: Act = async (label, icon, kind, call) => {
    setPending({ label, icon, kind })
    try {
      const res = await call()
      apply(res)
      if (res.outcome.text) toast({ tone: 'done', title: res.outcome.text, money: res.outcome.money, kind, icon })
      if (kind === 'social') refreshPlayers()
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
    setOutside(false)
    run(it.label, it.icon, kind, () => api.interact(sim!.id, id, it.id))
  }
  // The ride shows on the map: the route, and the taxi moving along it.
  // In town, a ride is arranged first (hailed at the roadside, or an app
  // driver coming); the trip starts once the Sim is in the car. The ride
  // shows on the map: the route, and the taxi moving along it.
  const travel = (cityId: string, communeId: string, label: string, ride?: Ride, fare = 0) => {
    setPlaceId(null)
    setOverlay('map')
    const fromCity = world.cities.find((x) => x.id === sim!.city)!
    const from = fromCity.communes.find((x) => x.id === sim!.commune)!
    const to = world.cities.find((x) => x.id === cityId)?.communes.find((x) => x.id === communeId)
    if (ride?.app && to) return setFlow({ cityId, from, to, kind: ride.app, offer: ride.offer, fare, party: ride.party ?? 1 })
    run(label, 'bus', 'transport', () => api.travel(sim!.id, cityId, communeId, ride))
  }
  const board = (ride: Ride, label: string) => {
    const f = flow!
    setFlow(null)
    run(label, 'bus', 'transport', () => api.travel(sim!.id, f.cityId, f.to.id, ride))
  }

  const collect = () => {
    const d = delivery!
    run(d.dish.label, d.dish.icon, 'eat', () => api.order(sim!.id, d.place.id, d.dish.id)).then((ok) => ok && setDelivery(null))
  }

  // Building one's house on the plot; the houses are fetched again after.
  const [building, setBuilding] = useState(false)
  const [plotsVersion, setPlotsVersion] = useState(0)

  // Live: the other players in the commune, every few seconds.
  const [around, refreshPlayers] = usePlayers(base?.sim.id, `${sim?.city}/${sim?.commune}`)
  // …and where they are in the street, a few times a second.
  useLive(base?.sim.id, classic ? 'street' : 'open', `${sim?.city}/${sim?.commune}`)

  if (!sim) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-night)] text-white">
        <div className="flex flex-col items-center gap-3">
          <MoodPin size={22} />
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
  const commune = withMapPlaces(city.communes.find((x) => x.id === sim.commune)!, classic ? [] : mapPlaces)
  const unseen = journal.filter((e) => e.id > seen).length
  const placeName = (id: string) => (id === 'home' ? 'Chez toi' : id === 'happening' ? (street?.happening?.label ?? 'En ce moment') : (commune.places.find((p) => p.id === id)?.name ?? ''))
  // Inside a place: while doing something there, or looking at what it offers.
  const atHomeNow = sim.city === sim.homeCity && sim.commune === sim.homeCommune
  const inside = (() => {
    if (doing) {
      if (doing.placeId === 'golvo') return atHomeNow ? { id: 'home', kind: 'home', it: doing.interaction.id } : null
      if (!doing.placeId) return null
      const kind = doing.placeId === 'home' ? 'home' : ARENAS.has(doing.placeId) ? 'arena' : (doing.placeKind ?? '')
      return INDOOR.has(kind) || kind === 'arena' ? { id: doing.placeId, kind, it: doing.interaction.id } : null
    }
    if (placeId && placeId !== 'happening') {
      // A covered hall (the Palais des Sports) has its own inside.
      const kind = placeId === 'home' ? 'home' : ARENAS.has(placeId) ? 'arena' : commune.places.find((p) => p.id === placeId)?.kind
      return kind && (INDOOR.has(kind) || kind === 'arena') ? { id: placeId, kind, it: undefined } : null
    }
    return null
  })()
  const showInside = !!inside && !outside
  // The music of where the Sim is: the club and the maquis inside, and in
  // the street, the fanfare of a wedding cortège or a concert.
  const happeningId = street?.happening?.id
  const track: Track | null = showInside
    ? inside!.kind === 'club'
      ? 'club'
      : inside!.kind === 'maquis'
        ? 'maquis'
        : null
    : happeningId === 'mariage'
      ? 'fanfare'
      : happeningId === 'concert' || happeningId === 'femua'
        ? 'club'
        : happeningId === 'anniversaire' || happeningId === 'bapteme'
          ? 'maquis'
          : null
  const trackSeed = showInside ? inside!.id : `${commune.id}${happeningId ?? ''}`

  return (
    <div className="relative h-full overflow-hidden bg-[var(--color-night)] select-none">
      {showInside && (
        <div className="absolute inset-0 z-[1]">
          {inside!.kind === 'arena' ? (
            <Arena sim={sim} placeId={inside!.id} interactionId={inside!.it} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} others={around.players.filter((p) => p.activity?.placeId === inside!.id)} />
          ) : (
            <Interior sim={sim} kind={inside!.kind} placeId={inside!.id} interactionId={inside!.it} housing={sim.housing} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} others={around.players.filter((p) => p.activity?.placeId === inside!.id && inside!.id !== 'home')} />
          )}
        </div>
      )}
      <div className={`absolute inset-0 ${showInside ? 'invisible' : ''}`}>
        {(() => {
          const street = {
            world,
            commune,
            sim,
            moodColor: moodHex,
            hour: HOUR_OVERRIDE ?? c.hour,
            goTo,
            onPick: walkTo,
            onArrive: (id: string) => (setOutside(false), setPlaceId(id)),
            busy: doing ? { icon: doing.interaction.icon, kind: doing.placeKind ?? '', id: doing.interaction.id } : pending,
            stationAt: doing?.placeId ?? null,
            nameTag: user?.username ? `@${user.username}` : sim.firstName,
            happening,
            onNear: setNear,
            frozen: !!sim.activity || !!pending,
            players: around.players,
            onPickPlayer: (id: string) => setPlayers({ focus: id }),
            recenter,
            onFreeCamera: setFreeCam,
            closeView,
            shoulderView: view === 'epaule',
            onTalk: (npc: Npc) => setChat(npc),
            onCall: (npc: Npc, text: string) => !sim.activity && !chat && setCalling({ npc, text }),
            talkingTo: chat?.id ?? (doing?.placeKind === 'chat' ? talkedTo.current : null),
            plotsVersion,
            onStreetBuy: async (vendor: string, choice?: string) => {
              let said: string | null = null
              // Which seller (the id's prefix: porc, cafe, the; else alloco), as the API does.
              const [label, icon] = STREET_SELLERS[vendor.split(':')[0]] ?? STREET_SELLERS.alloco
              await run(label, icon, 'market', async () => {
                const res = await api.street(sim.id, vendor, choice)
                said = res.outcome.text
                return res
              })
              return said
            },
            onRobbed: async (spot: string) => {
              try {
                const res = await api.robbed(sim.id, spot)
                apply(res)
                // Taken: the journal's event says it (announce); nothing taken: say why here.
                if (!res.outcome.money) toast({ tone: 'random', title: 'Les nouchis du couloir', text: res.outcome.text, money: 0 })
                return res.outcome.text
              } catch {
                return null
              }
            },
          }
          return classic ? <Neighbourhood key={commune.id} {...street} /> : <OpenWorld key={commune.id} {...street} commune={ownPlaces(commune)} token={MAP_TOKEN ?? ''} onFail={() => setClassic(true)} onMapPlaces={setMapPlaces} />
        })()}
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
              {commune.name} · {lifeOf(world, sim).stage?.label ?? ''}, {lifeOf(world, sim).age < 1 ? "moins d'un an" : `${lifeOf(world, sim).age} an${lifeOf(world, sim).age > 1 ? 's' : ''}`}
            </span>
          </span>
        </Link>

        {/* The money and the hour, then the camera's controls under them (in the flow, so a wrapped row on a phone pushes them down instead of hiding them). */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            <SoundToggle />
            <PlayersChip count={around.players.length} invites={around.invites.length} onOpen={() => setPlayers({ focus: null })} />
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
          {inside && (
            <button className="hud pointer-events-auto rounded-full px-4 py-2 text-sm font-extrabold" onClick={() => setOutside((o) => !o)}>
              {outside ? `Entrer · ${placeName(inside.id) || 'Chez toi'}` : 'Voir la rue'}
            </button>
          )}
          {!showInside && !placeId && !overlay && (
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              {!classic && (
                <button className="hud flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => setView((v) => NEXT_VIEW[v])} title="Changer de vue">
                  {/* What the next tap gives */}
                  {view === 'epaule' ? <Mountain size={17} strokeWidth={2.6} className="text-[var(--color-emerald)]" /> : <Eye size={17} strokeWidth={2.6} className="text-[var(--color-emerald)]" />}
                  {{ pres: 'Vue épaule', epaule: 'Vue de haut', haut: 'Vue de près' }[view]}
                </button>
              )}
              <OrbitGizmo
                read={streetPose}
                onYaw={(d) => (cameraTurn.yaw += d)}
                onPitch={(d) => (cameraTurn.pitch += d)}
                onNorth={() => (cameraTurn.snap = true)}
              />
            </div>
          )}
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

      <Soundtrack track={track} seed={trackSeed} />
      {/* Finding the way: the mini-map, and every place of the quarter */}
      {!showInside && !placeId && !overlay && !players && (
        <div className="pointer-events-none absolute top-[5.5rem] left-3 z-20 flex flex-col items-start gap-2 lg:left-5">
          <MiniMap onWalk={walkTo} />
          <button className="hud pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => setWhereTo(true)}>
            <Navigation size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" /> Où aller ?
          </button>
        </div>
      )}
      {whereTo && <WhereTo world={world} onWalk={(id) => (setWhereTo(false), walkTo(id))} onClose={() => setWhereTo(false)} />}
      {freeCam && !placeId && !overlay && (
        <button className="hud motion-pop absolute right-3 bottom-[6.25rem] z-20 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold lg:right-5 lg:bottom-[7.5rem]" onClick={() => setRecenter((n) => n + 1)}>
          <LocateFixed size={18} strokeWidth={2.6} className="text-[var(--color-orange)]" /> Revenir à moi
        </button>
      )}

      {!classic && <FirstSteps hidden={showInside || !!placeId || !!overlay || !!players || whereTo || !!sim.activity || !!pending} />}
      {/* The pad: walk the Sim freely (arrow keys / WASD work too) */}
      {!placeId && !overlay && !sim.activity && (
        <div className="pointer-events-none absolute bottom-[6.25rem] left-3 z-20 lg:bottom-[7.5rem] lg:left-5">
          <RunButton />
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
        <InteractionMenu world={world} sim={sim} city={city} commune={commune} placeId={placeId} desktop={desktop} onClose={() => setPlaceId(null)} onPick={interact} onTravel={travel} onStop={stop} onBuild={() => (setPlaceId(null), setBuilding(true))} />
      )}
      {building && (
        <Suspense fallback={null}>
          <BuildMode world={world} sim={sim} onResult={apply} onClose={() => (setBuilding(false), setPlotsVersion((v) => v + 1))} />
        </Suspense>
      )}

      {players && <PlayersSheet sim={sim} around={around} communeName={commune.name} focus={players.focus} act={run} onClose={() => setPlayers(null)} />}
      {!players && !placeId && !overlay && (() => {
        const inv = around.invites.find((i) => !dismissed.includes(i.id))
        return inv ? (
          <InviteBanner
            key={inv.id}
            invite={inv}
            onAnswer={(a) => (setDismissed((d) => [...d, inv.id]), run(a === 'accepter' ? `Rejoindre ${inv.fromName}` : 'Refuser', a === 'accepter' ? 'users' : 'x', 'social', () => api.answerInvite(sim.id, inv.id, a)))}
          />
        ) : null
      })()}

      {sim.activity && !placeId && <ActivityBar sim={sim} onStop={stop} stopping={!!pending} onRoute={() => setOverlay('map')} />}

      <div className="pointer-events-none absolute top-[5.5rem] left-1/2 z-40 flex w-[min(400px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2 lg:top-24">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>

      {overlay === 'phone' && (
        <Phone
          world={world}
          sim={sim}
          commune={ownPlaces(commune)}
          journal={journal}
          time={c.time}
          act={run}
          startApp={phoneApp}
          delivery={delivery}
          onDelivery={setDelivery}
          onCollect={collect}
          onClose={() => (setOverlay(null), setPhoneApp(null))}
          onMap={() => setOverlay('map')}
          onWalk={walkTo}
        />
      )}
      {overlay === 'map' && <WorldMap world={world} sim={sim} night={c.isNight} desktop={desktop} onClose={() => setOverlay(null)} onTravel={travel} onWalk={(id) => (setOverlay(null), walkTo(id))} />}
      {delivery && overlay !== 'phone' && <DeliveryPill delivery={delivery} now={now} onOpen={() => (setPhoneApp('golvo'), setOverlay('phone'))} />}
      {calling && !chat && (
        <div className="absolute top-[max(5.5rem,env(safe-area-inset-top))] left-1/2 z-20 w-[min(92vw,380px)] -translate-x-1/2 animate-up">
          <div className="hud flex items-center gap-3 rounded-2xl p-2.5 pl-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-lg font-extrabold text-white" style={{ background: calling.npc.look.outfitColor }}>
              {calling.npc.name[0]}
            </div>
            <div className="min-w-0 flex-1 text-sm font-bold">
              <span className="font-extrabold text-[var(--color-orange)]">{calling.npc.name}</span> t'appelle : « {calling.text} »
            </div>
            <button className="btn shrink-0 px-3 py-2 text-sm" onClick={() => (setChat(calling.npc), setCalling(null))}>
              Répondre
            </button>
          </div>
        </div>
      )}
      {chat && <ChatSheet npc={chat} simGender={sim.gender} onSay={say} onClose={() => setChat(null)} />}
      {flow && <RideFlow world={world} req={flow} gameMinutes={sim.gameMinutes} onBoard={board} onClose={() => setFlow(null)} />}
    </div>
  )
}

/* ---------- The in-game phone ---------- */

type PhoneAppId = 'here' | 'jobs' | 'home' | 'messages' | 'news' | 'store' | 'waye' | 'golvo' | 'friends' | 'gbairai'
type PhoneProps = {
  world: World
  sim: Sim
  commune: Commune
  journal: JournalEvent[]
  time: string
  act: Act
  startApp: PhoneAppId | null
  delivery: Delivery | null
  onDelivery: (d: Delivery | null) => void
  onCollect: () => void
  onClose: () => void
  onMap: () => void
  onWalk: (id: string) => void
}

function Phone({ world, sim, commune, journal, time, act, startApp, delivery, onDelivery, onCollect, onClose, onMap, onWalk }: PhoneProps) {
  const [app, setApp] = useState<PhoneAppId | null>(startApp)
  const navigate = useNavigate()
  const home = sim.homeCity === sim.city && sim.homeCommune === commune.id
  const places = [...(home ? [{ id: 'home', name: 'Chez toi', kind: 'home' }] : []), ...commune.places]
  const city = world.cities.find((c) => c.id === sim.city)!

  const life = lifeOf(world, sim)
  // A phone of one's own comes at 12; work and rent at 18.
  const ownPhone = !life.minor || life.age >= 12
  const has = (id: string) => ownPhone && (sim.apps?.includes(id) ?? false)
  // Apps from the store, once installed. The ride apps open the map to pick where to go.
  const STORE_APPS: { id: string; label: string; open: () => void }[] = [
    ...(ownPhone ? [{ id: 'store', label: 'Store', open: () => setApp('store') }] : []),
    ...(has('waye') ? [{ id: 'waye', label: 'Waye', open: () => setApp('waye') }] : []),
    ...(has('gbairai') ? [{ id: 'gbairai', label: 'Gbairai', open: () => setApp('gbairai') }] : []),
    ...(has('golvo') ? [{ id: 'golvo', label: 'Golvo', open: () => setApp('golvo') }] : []),
    ...(has('gnango') ? [{ id: 'gnango', label: 'Gnango', open: onMap }] : []),
    ...(has('idrive') ? [{ id: 'idrive', label: 'iDrive', open: onMap }] : []),
  ]
  type Tile = { id: string; label: string; icon: LucideIcon; colors: [string, string]; open: () => void }
  const APPS = (
    [
    { id: 'map', label: 'Carte', icon: MapIcon, colors: ['#69e2a0', '#00a862'], open: onMap },
    { id: 'here', label: 'Quartier', icon: MapPin, colors: ['#ffa040', '#ff6a00'], open: () => setApp('here') },
    { id: 'jobs', label: 'Boulot', icon: Briefcase, colors: ['#64b5ff', '#2a6cf0'], open: () => setApp('jobs') },
    { id: 'home', label: 'Logement', icon: House, colors: ['#ffb347', '#ff7a00'], open: () => setApp('home') },
    { id: 'news', label: 'Infos', icon: Newspaper, colors: ['#ff8a65', '#e8590c'], open: () => setApp('news') },
    { id: 'messages', label: 'Messages', icon: MessageCircle, colors: ['#b39dff', '#6c47ff'], open: () => setApp('messages') },
    { id: 'friends', label: 'Amis', icon: Users, colors: ['#ffa8c5', '#e83e8c'], open: () => setApp('friends') },
    { id: 'profile', label: 'Profil', icon: UserRound, colors: ['#ff8a9b', '#ff3d57'], open: () => navigate('/profil', { viewTransition: true }) },
    ] as Tile[]
  ).filter((a) => !life.minor || (a.id !== 'jobs' && a.id !== 'home'))
  const title: Record<PhoneAppId, string> = { here: commune.name, jobs: 'Boulot', home: 'Logement', messages: 'Messages', news: 'Infos · Côte d’Ivoire', store: 'Store', waye: 'Waye', golvo: 'Golvo', friends: 'Amis', gbairai: 'Gbairai' }

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
            <span>Oranjo CI · 4G</span>
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
                      {((a.id === 'messages' && journal.length > 0) || (a.id === 'friends' && sim.gang === 'invited') || (a.id === 'home' && sim.rentArrears > 0) || (a.id === 'jobs' && !sim.career)) && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--color-rose)] ring-2 ring-white" />
                      )}
                    </span>
                    <span className="text-xs font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">{a.label}</span>
                  </button>
                ))}
                {STORE_APPS.map((a) => (
                  <button key={a.id} onClick={a.open} className="flex flex-col items-center gap-1.5 active:scale-95">
                    <span className="relative">
                      <AppLogo id={a.id} />
                      {a.id === 'golvo' && delivery && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--color-rose)] ring-2 ring-white" />}
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
                {app === 'friends' && <FriendsApp world={world} sim={sim} act={act} />}
                {app === 'store' && <StoreApp world={world} sim={sim} act={act} onOpen={(id) => (id === 'gnango' || id === 'idrive' ? onMap() : setApp(id as PhoneAppId))} />}
                {app === 'waye' && <WayeApp world={world} sim={sim} act={act} journal={journal} renderJournal={(events) => <Journal events={events} />} />}
                {app === 'gbairai' && <GbairaiApp sim={sim} />}
                {app === 'golvo' && <GolvoApp world={world} sim={sim} delivery={delivery} onOrder={onDelivery} onCancel={() => onDelivery(null)} onCollect={onCollect} />}
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
  /** At home: build one's house on the plot. */
  onBuild: () => void
}

function InteractionMenu({ world, sim, city, commune, placeId, desktop, onClose, onPick, onTravel, onStop, onBuild }: MenuProps) {
  const place = placeId === 'home' ? { name: 'Chez toi', kind: 'home' } : commune.places.find((p) => p.id === placeId)!
  const navigate = useNavigate()
  const kind = world.kinds[place.kind]
  const colors = kindColors(place.kind)
  const here = sim.city === city.id && sim.commune === commune.id
  const home = world.housings.find((h) => h.id === sim.housing)!
  const career = world.careers.find((c) => c.id === sim.career && (c.kind === place.kind || c.also?.includes(place.kind)))
  const life = lifeOf(world, sim)
  // Things past this age (the biberon for an adult) don't show; things for later do, greyed.
  const items = [...(career ? [shift(career, sim.careerLevel)] : []), ...kind.interactions.map((it) => (placeId === 'home' ? atHome(it, home) : it))].filter((it) => ageBlock(it, life.stage?.id) !== 'Plus de ton âge')
  const busy = !!sim.activity
  const canBuild = placeId === 'home' && here && !!world.materials?.length
  const tooYoung = life.stage?.id === 'bebe' || life.stage?.id === 'enfant'
  // At the stadium: what's on, and the match or the concert only while it's on.
  const agenda = useStadium(place.kind === 'stade' ? placeId : null)
  const on = eventAt(agenda, sim.gameMinutes)
  const stadiumBlock = (it: Interaction) => {
    const k = it.id === 'stade-match' ? 'match' : it.id === 'stade-concert' ? 'concert' : null
    if (!k || on?.kind === k) return null
    const next = agenda?.agenda.find((e) => e.kind === k && e.start - DOORS_OPEN > sim.gameMinutes)
    return next ? `Prochain : ${when(next.start)}` : k === 'match' ? 'Pas de match' : 'Pas de concert'
  }
  const billing = place.kind === 'stade' && (
    <div className="rounded-[20px] bg-[#fff4e8] p-3">
      <div className="label">À l'affiche</div>
      {on ? (
        <div className="mt-1">
          <div className="font-display text-[17px] leading-tight font-extrabold">
            {on.title} {on.score && <span className="ml-1 rounded-full bg-[#141416] px-2 py-0.5 text-[13px] text-[#ffd166]">{on.score}</span>}
          </div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{sim.gameMinutes < on.start ? `Les portes sont ouvertes · ${on.detail}` : `En ce moment · ${on.detail}`}</div>
        </div>
      ) : (
        <p className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">Rien en ce moment.</p>
      )}
      <ul className="mt-2 grid gap-1">
        {agenda?.agenda
          .filter((e) => e !== on && e.start > sim.gameMinutes)
          .slice(0, 4)
          .map((e) => (
            <li key={e.start} className="flex items-baseline gap-2 text-[13px] font-bold">
              <span className="w-[118px] shrink-0 text-[var(--color-ink-soft)]">{when(e.start)}</span>
              <span className="min-w-0 truncate">{e.title}</span>
            </li>
          ))}
      </ul>
    </div>
  )
  const build = canBuild && (
    <button disabled={tooYoung} onClick={onBuild} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#fff4e8] p-2.5 text-left transition active:scale-[0.98] ${tooYoung ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={tooYoung ? Lock : Hammer} colors={colors} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">Construire ma maison</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{tooYoung ? "Quand tu seras ado" : 'Banco, planches, parpaing, tôle… bloc par bloc'}</span>
      </span>
    </button>
  )
  // The wardrobe at home and at the couturier; a new hairdo at the barber or the salon.
  const lookTab = { home: 'tenue', couture: 'tenue', boutique: 'tenue', salon: 'coiffure', barbier: 'coiffure' }[place.kind]
  const restyle = lookTab && here && (
    <button disabled={busy} onClick={() => navigate(`/look?tab=${lookTab}`, { viewTransition: true })} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#fff4e8] p-2.5 text-left transition active:scale-[0.98] ${busy ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={lookTab === 'coiffure' ? Scissors : Shirt} colors={colors} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">Changer de look</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{lookTab === 'coiffure' ? 'Coupe, couleur, barbe · 2 000 F' : 'Tenue, pagne, couleurs, accessoire · gratuit'}</span>
      </span>
    </button>
  )
  const state = (it: Interaction) => ({ open: openAt(it, sim.gameMinutes), broke: it.cost > 0 && sim.money < it.cost, busy, reason: ageBlock(it, life.stage?.id) ?? stadiumBlock(it) ?? blockedBy(it, sim, city.id, commune.id) })

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
          {(build || restyle || billing) && (
            <div className="absolute top-full left-1/2 mt-[200px] grid w-64 -translate-x-1/2 gap-2">
              {billing}
              {build}
              {restyle}
            </div>
          )}
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
            {billing}
            {build}
            {restyle}
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
                  : e.kind === 'life'
                    ? [Cake, ['#ff8ad8', '#d63aa8']]
                    : e.kind === 'social'
                      ? [Users, ['#ffa8c5', '#e83e8c']]
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

/** The Golvo courier on the way, over the street. */
function DeliveryPill({ delivery, now, onOpen }: { delivery: Delivery; now: number; onOpen: () => void }) {
  const st = deliveryState(delivery, now)
  return (
    <button className="hud absolute top-[5.5rem] left-1/2 z-30 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-extrabold whitespace-nowrap" onClick={onOpen}>
      <AppLogo id="golvo" size={30} radius={15} />
      {st.stage === 'here' ? `${delivery.courier} est là avec ta commande !` : st.stage === 'kitchen' ? `${delivery.place.name} prépare ta commande` : `${delivery.courier} arrive · ${st.minutesLeft} min`}
    </button>
  )
}
