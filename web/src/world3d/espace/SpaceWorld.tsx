import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ChevronsDown, ChevronsUp, FlaskConical, Orbit, Satellite } from 'lucide-react'
import type { City, Commune, Sim, World } from '../../lib/types'
import { api } from '../../lib/api'
import { t as tr } from '../../lib/i18n'
import { toast } from '../../lib/overlays'
import { destinationOf } from '../../lib/espace'
import { Snapper, takePhoto } from '../snapshot'
import { SortieEVA } from '../../components/espace/SortieEVA'
import { Experience } from '../../components/espace/Experience'
import { B, Flotteur, pad } from './blocs'
import { Station } from './Station'
import { Lune } from './Lune'
import { Mars } from './Mars'
import { groundTrack, isNightAt, nearestCity, ORBIT_MINUTES, type LightCity } from './Terre'
import { Stars } from './placeholders'

// Up there (a city of World.espace, lib/espace.ts): what's drawn instead of the street (workstream D). The Station
// Akwaba's modules in zero g (Station.tsx: the pad below pushes the Sim about), the Moon's Base Clair-de-Terre
// (Lune.tsx), Mars's Colonie Harmattan (Mars.tsx), the capsule in cruise; the Earth below with its cities' lights
// (Terre.tsx). The places here as buttons (their sheet opens, as at a door in the street), the other modules a
// float away. EspaceInside.tsx draws the same scenes framed on what's being done, with its mini-games.

export type SpaceWorldProps = {
  city: City
  commune: Commune
  sim: Sim
  /** For the Earth's lights (every city of the game). */
  world?: Pick<World, 'cities'>
  moodColor?: string
  busy?: { icon: string; kind: string; id?: string } | null
  onArrive: (placeId: string) => void
  onFloat: (communeId: string, name: string) => void
}

/** Every city of the game as a light on the Earth. */
export function useLights(world?: Pick<World, 'cities'>): LightCity[] {
  return useMemo(() => (world?.cities ?? []).map((c) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng })), [world])
}

/** Mars's dust storm now (the happening « tempete-poussiere », backend game/espaceActs.go). */
export function useStorm(sim: Sim) {
  const [storm, setStorm] = useState(false)
  const slot = Math.floor(sim.gameMinutes / 120)
  useEffect(() => {
    if (sim.city !== 'mars') return void setStorm(false)
    let live = true
    api
      .happening(sim.city, sim.commune, slot * 120 + 1)
      .then((h) => live && setStorm(h.happening?.id === 'tempete-poussiere'))
      .catch(() => undefined)
    return () => void (live = false)
  }, [sim.city, sim.commune, slot])
  return storm
}

/** The capsule in cruise: a tight cabin, its seats, its porthole on the stars (and the Moon or Mars growing). */
function Croisiere({ sim, moodColor, to, progress }: { sim: Sim; moodColor?: string; to: 'lune' | 'mars'; progress: number }) {
  const eye = useRef(new THREE.Vector3(1.4, 1.2, 3.6))
  useFrame(({ camera }) => {
    camera.position.copy(eye.current)
    camera.lookAt(0, 0.2, -2.5)
  })
  return (
    <group>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 1.5, 0]} intensity={12} distance={10} />
      <Stars />
      {[-1, 1].map((s) => (
        <B key={s} p={[s * 2.2, 0, 0]} s={[0.2, 4, 7]} c="#dee2e6" />
      ))}
      <B p={[0, -2, 0]} s={[4.6, 0.2, 7]} c="#ced4da" />
      <B p={[0, 2, 0]} s={[4.6, 0.2, 7]} c="#f1f3f5" />
      <B p={[0, 1.9, 0]} s={[0.6, 0.05, 5]} c="#fffbe6" glow />
      {/* The control panel, its screens */}
      <B p={[0, 0.3, -3.3]} s={[4.2, 1.6, 0.4]} c="#343a40" />
      {[-1.2, 0, 1.2].map((x, i) => (
        <B key={x} p={[x, 0.4, -3.08]} s={[0.9, 0.6, 0.02]} c={i === 1 ? '#ff7a00' : '#4dabf7'} glow />
      ))}
      {/* Seats */}
      {[-1.1, 0, 1.1].map((x) => (
        <group key={x} position={[x, -1.4, 0.5]}>
          <B p={[0, 0, 0]} s={[0.9, 0.3, 1.2]} c="#1c3d6e" />
          <B p={[0, 0.7, 0.55]} s={[0.9, 1.4, 0.2]} c="#1c3d6e" />
        </group>
      ))}
      {/* The porthole: the destination growing as the cruise goes */}
      <group position={[2.1, 0.6, -1.4]}>
        <B p={[0, 0, 0]} s={[0.1, 1.2, 1.2]} c="#02030a" />
        <B p={[-0.06, 0, 0]} s={[0.02, 0.2 + progress * 0.7, 0.2 + progress * 0.7]} c={to === 'mars' ? '#c0392b' : '#ced4da'} glow />
      </group>
      <Flotteur look={sim.look} gender={sim.gender} moodColor={moodColor} home={[0, 0.2, 0]} bounds={[1.2, 1, 2]} />
    </group>
  )
}

export function SpaceScene({ city, commune, sim, moodColor, kind, doing, lights, storm }: { city: City; commune: Commune; sim: Sim; moodColor?: string; kind?: string; doing?: string; lights: LightCity[]; storm?: boolean }) {
  const d = destinationOf(undefined, city.id)
  const cruise = !!d?.cruise && commune.id === d.cruise
  const v = sim.life?.espace?.voyage
  if (cruise && (d?.id === 'lune' || d?.id === 'mars')) {
    const steps = Math.max(1, v?.steps?.length ?? 1)
    const progress = v ? Math.min(1, (v.round + (v.done?.length ?? 0) / steps) / Math.max(1, v.rounds)) : 0
    return <Croisiere sim={sim} moodColor={moodColor} to={d.id} progress={progress} />
  }
  return (
    <>
      {d?.id !== 'mars' && <color attach="background" args={['#02030a']} />}
      {d?.id !== 'mars' && <Stars />}
      {d?.id === 'lune' ? (
        <Lune look={sim.look} kind={kind} doing={doing} cities={lights} />
      ) : d?.id === 'mars' ? (
        <Mars look={sim.look} kind={kind} doing={doing} storm={storm} />
      ) : (
        <Station commune={commune.id} look={sim.look} gender={sim.gender} moodColor={moodColor} kind={kind} doing={doing} cities={lights} />
      )}
    </>
  )
}

/** A button held: the pad's thrust on that axis while it's down. */
function Hold({ axis, dir, label, children }: { axis: 'x' | 'y' | 'z'; dir: 1 | -1; label: string; children: React.ReactNode }) {
  const off = () => void (pad[axis] = 0)
  return (
    <button aria-label={label} className="hud grid h-11 w-11 place-items-center rounded-full active:scale-95" onPointerDown={(e) => ((e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId), (pad[axis] = dir))} onPointerUp={off} onPointerCancel={off} onPointerLeave={off}>
      {children}
    </button>
  )
}

/** The zero-g pad: push the Sim about the module (up, down, along, across). */
export function ZeroGPad() {
  useEffect(() => () => void Object.assign(pad, { x: 0, y: 0, z: 0 }), [])
  return (
    <div className="pointer-events-auto flex items-end gap-2">
      <div className="grid grid-cols-3 gap-1">
        <span />
        <Hold axis="z" dir={-1} label={tr('Flotter en avant')}>
          <ArrowUp size={18} />
        </Hold>
        <span />
        <Hold axis="x" dir={-1} label={tr('Flotter à gauche')}>
          <ArrowLeft size={18} />
        </Hold>
        <span className="grid h-11 w-11 place-items-center text-[10px] font-extrabold text-white opacity-80">0 g</span>
        <Hold axis="x" dir={1} label={tr('Flotter à droite')}>
          <ArrowRight size={18} />
        </Hold>
        <span />
        <Hold axis="z" dir={1} label={tr('Flotter en arrière')}>
          <ArrowDown size={18} />
        </Hold>
        <span />
      </div>
      <div className="flex flex-col gap-1">
        <Hold axis="y" dir={1} label={tr('Monter')}>
          <ChevronsUp size={18} />
        </Hold>
        <Hold axis="y" dir={-1} label={tr('Descendre')}>
          <ChevronsDown size={18} />
        </Hold>
      </div>
    </div>
  )
}

/** Over the Earth: the city below (or the ocean), day or night there (one orbit in 92 minutes). */
export function OverEarth({ lights }: { lights: LightCity[] }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])
  const g = groundTrack()
  const below = nearestCity(lights, g.lat, g.lng)
  const night = isNightAt(g.lat, g.lng)
  return (
    <span className="hud flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold">
      <Satellite size={14} className="text-[#ff7a00]" />
      {below ? tr('Tu survoles {name}', { name: below.name }) : tr('Au-dessus de l’océan')}
      {' · '}
      {night ? tr('nuit') : tr('jour')}
      {' · '}
      {tr('un tour en {n} min', { n: ORBIT_MINUTES })}
    </span>
  )
}

const PHOTOS: Record<string, () => string> = {
  'station-photo': () => tr('La Terre vue de la Station Akwaba'),
  'lune-photo': () => tr('Le lever de Terre, depuis la Lune'),
  'mars-photo': () => tr('Le coucher de soleil bleu de Mars'),
}

/** What's being done up there that has more to it: the photo for Babigram, the spacewalk, the lab's experiment. */
export function SpaceActions({ sim }: { sim: Sim }) {
  const a = sim.activity?.kind === 'do' ? sim.activity : null
  const id = a?.interaction.id ?? ''
  const [game, setGame] = useState<'eva' | 'labo' | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const key = `${id}@${a?.start ?? 0}`
  const played = done === key
  const publish = async () => {
    const photo = takePhoto()
    if (!photo || !a) return
    setBusy(true)
    try {
      const r = await api.gramPost(sim.id, { photo, caption: PHOTOS[id](), placeId: a.placeId ?? '', filter: '', ratio: 'carre' })
      toast({ tone: 'event', title: 'Babigram', text: r.outcome.text, money: 0, icon: 'camera' })
      setDone(key)
    } catch (e) {
      toast({ tone: 'error', title: 'Babigram', text: String((e as Error)?.message ?? e), money: 0 })
    } finally {
      setBusy(false)
    }
  }
  const btn = 'pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#ff7a00] px-4 py-2 text-xs font-extrabold text-white shadow-md active:scale-95 disabled:opacity-60'
  return (
    <>
      {PHOTOS[id] && !played && (
        <button disabled={busy} className={btn} onClick={publish}>
          <Camera size={15} /> {tr('Publier sur Babigram')}
        </button>
      )}
      {id === 'station-sortie' && !played && (
        <button className={btn} onClick={() => setGame('eva')}>
          <Satellite size={15} /> {tr('Sortir dans l’espace')}
        </button>
      )}
      {id.startsWith('labo-') && !played && (
        <button className={btn} onClick={() => setGame('labo')}>
          <FlaskConical size={15} /> {tr('Faire l’expérience')}
        </button>
      )}
      {game === 'eva' && <SortieEVA sim={sim} onClose={() => (setGame(null), setDone(key))} />}
      {game === 'labo' && <Experience sim={sim} interactionId={id} onClose={() => (setGame(null), setDone(key))} />}
    </>
  )
}

export function SpaceWorld({ city, commune, sim, world, moodColor, busy, onArrive, onFloat }: SpaceWorldProps) {
  const d = destinationOf(undefined, city.id)
  const others = city.communes.filter((c) => c.id !== commune.id && c.id !== d?.cruise)
  const cruising = !!sim.life?.espace?.voyage && !sim.life.espace.voyage.arrived
  const lights = useLights(world)
  const storm = useStorm(sim)
  const ground = (d?.id === 'lune' || d?.id === 'mars') && !cruising
  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 55, near: 0.1, far: 1000, position: [2.5, 2, 6] }}>
        <SpaceScene city={city} commune={commune} sim={sim} moodColor={moodColor} lights={lights} storm={storm} doing={sim.activity?.kind === 'do' ? sim.activity.interaction.id : undefined} />
        <Snapper />
      </Canvas>
      {/* The pad (the station, the capsule: zero g), or the big leap (the Moon, Mars) */}
      <div className="pointer-events-none absolute right-3 bottom-[calc(var(--sab,env(safe-area-inset-bottom))+12rem)]">
        {ground ? (
          <button className="hud pointer-events-auto rounded-full px-4 py-3 text-xs font-extrabold active:scale-95" onClick={() => void (pad.jump = 1)}>
            {d?.id === 'lune' ? tr('Un grand bond (1/6 g)') : tr('Un bond (1/3 g)')}
          </button>
        ) : (
          <ZeroGPad />
        )}
      </div>
      {/* The places here, and the other modules a float away (above the phone's bar). */}
      <div className="pointer-events-auto absolute right-3 bottom-[calc(var(--sab,env(safe-area-inset-bottom))+7.5rem)] left-3 flex flex-wrap justify-center gap-2">
        {commune.id === 'akwaba-coupole' && <OverEarth lights={lights} />}
        <span className="hud flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold">
          <Orbit size={14} className="text-[#ff7a00]" /> {city.name} · {commune.name}
        </span>
        <SpaceActions sim={sim} />
        {commune.places.map((p) => (
          <button key={p.id} className={`hud rounded-full px-3 py-1.5 text-xs font-extrabold ${busy?.id && busy.kind === p.kind ? 'ring-2 ring-[#ff7a00]' : ''}`} onClick={() => onArrive(p.id)}>
            {p.name}
          </button>
        ))}
        {!cruising &&
          others.map((c) => (
            <button key={c.id} className="hud rounded-full px-3 py-1.5 text-xs font-bold opacity-90" onClick={() => onFloat(c.id, c.name)}>
              {ground ? tr('Aller à {name}', { name: c.name }) : tr('Flotter vers {name}', { name: c.name })}
            </button>
          ))}
      </div>
    </div>
  )
}
