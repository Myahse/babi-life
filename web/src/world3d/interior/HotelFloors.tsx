import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ArrowDown, ArrowDownUp, BedDouble, ConciergeBell, DoorClosed, DoorOpen, KeyRound, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { ActionResult, HotelView, Interaction, Sim, Stay, World } from '../../lib/types'
import { amount, duration, openAt } from '../../game/rules'
import { iconFor } from '../../components/icons'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { ActionProps, TvOn, Zzz } from './ActionProps'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, RichAO } from './bigPlace'
import { isRoomAct, setLift, useLift } from '../hotelLift'
import { CorridorDecor, LOOKS, PLAIN, RoomDecor, WindowWall, type Look } from './hotelStyles'
import { t as tr, tx } from '../../lib/i18n'

// Every hotel's floors (backend game/hotels.go, sims/hotel.go): its lifts
// from the hall to each floor, the corridor with its numbered doors (a green
// light: free; red: someone's in; gold: yours), the rooms one visits before
// renting one (standard, superior at the ends, suites at the top), for a few
// hours or for nights. Once it's yours: sleep, shower, a bath, the TV, and
// room service to the door. The hall is the hotel's own scene (HotelInside,
// IvoireInside), wrapped in HotelStay.

type Act = (label: string, icon: string, kind: string, call: () => Promise<ActionResult>) => Promise<boolean>

/* ---------- The corridor ---------- */

const GAP = 4.4
const CW = 1.6 // half the corridor's width
const doorX = (n: number) => 5 + Math.floor((n - 1) / 2) * GAP
const doorZ = (n: number) => (n % 2 ? -CW : CW)

function Corridor({ look, floor, rooms, night, onDoor }: { look: Look; floor: number; rooms: HotelView['rooms']; night: boolean; onDoor: (room: string) => void }) {
  const list = rooms ?? []
  const len = doorX(list.length) + 4
  const plates = useMemo(() => list.map((r) => sign(r.room, '#1b1b1f', '#f3e6c9', 256, 96)), [list.map((r) => r.room).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const shaft = useMemo(() => sign(`▲▼ ${floor}`, '#111114', '#ffb84d', 256, 96), [floor])
  return (
    <group>
      {/* The carpet with its runner, the walls, the ceiling lights */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[len / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[len, CW * 2]} />
        <meshLambertMaterial color={look.carpet} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[len / 2, 0.01, 0]}>
        <planeGeometry args={[len - 1, 0.9]} />
        <meshLambertMaterial color={look.accent} transparent opacity={0.35} />
      </mesh>
      {/* The far wall full height; the near one cut low, as in the Sims, so the corridor is seen into */}
      {look.style !== 'banco' && (
        <mesh position={[len / 2, 1.5, -(CW + 0.1)]} material={mat(look.wall)}>
          <boxGeometry args={[len, 3, 0.2]} />
        </mesh>
      )}
      <CorridorDecor look={look} len={len} cw={CW} night={night} />
      <mesh position={[len / 2, 0.5, CW + 0.1]} material={mat(look.wall)}>
        <boxGeometry args={[len, 1, 0.2]} />
      </mesh>
      {/* The lights along it, on the far wall */}
      {[...Array(Math.ceil(len / 6))].map((_, i) => (
        <group key={i}>
          {look.style !== 'banco' && (
          <mesh position={[3 + i * 6, 2.4, -CW + 0.02]} material={mat('#fff6dc', '#fff0c0')}>
            <boxGeometry args={[0.5, 0.25, 0.06]} />
          </mesh>
          )}
          <pointLight position={[3 + i * 6, 2.3, 0]} intensity={night ? 9 : 6} distance={8} color="#ffe6b8" />
        </group>
      ))}
      {/* The lifts at the end: two steel doors, the floor shown over them */}
      <mesh position={[-0.1, 1.5, 0]} material={mat(look.wall)}>
        <boxGeometry args={[0.2, 3, CW * 2 + 0.4]} />
      </mesh>
      {[-0.8, 0.8].map((z) => (
        <mesh key={z} position={[0.02, 1.1, z]} material={mat('#b9bec6')}>
          <boxGeometry args={[0.06, 2.2, 1.1]} />
        </mesh>
      ))}
      <mesh position={[0.06, 2.6, 0]} rotation={[0, Math.PI / 2, 0]} material={shaft}>
        <planeGeometry args={[1, 0.38]} />
      </mesh>
      {/* The window at the far end: the sky over Babi */}
      <mesh position={[len, 1.6, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[CW * 2, 2.4]} />
        <meshBasicMaterial color={night ? '#14204a' : look.sky} />
      </mesh>
      {/* The doors: their number, their light (free, taken, yours); a tap visits */}
      {list.map((r, i) => {
        const n = i + 1
        const z = doorZ(n)
        const s = Math.sign(z)
        const light = r.mine ? '#ffc93c' : r.taken ? '#ff4d4d' : '#3ddc84'
        // The near side's doors stop at the cut wall's height; every number faces the camera.
        const h = s > 0 ? 1 : 2.2
        return (
          <group
            key={r.room}
            position={[doorX(n), 0, z - s * 0.08]}
            onClick={(e) => {
              if (e.delta > 6) return
              e.stopPropagation()
              onDoor(r.room)
            }}
          >
            <mesh position={[0, h / 2, 0]} material={mat(r.mine ? look.accent : look.wood)}>
              <boxGeometry args={[1.1, h, 0.08]} />
            </mesh>
            <mesh position={[0, s > 0 ? 1.45 : 2.45, s > 0 ? 0.08 : 0.06]} material={plates[i]}>
              <planeGeometry args={[0.7, 0.26]} />
            </mesh>
            <mesh position={[0.42, s > 0 ? 0.8 : 1.15, s > 0 ? 0.08 : 0.06]} material={mat(light, light)}>
              <boxGeometry args={[0.12, 0.12, 0.04]} />
            </mesh>
            {r.taken && (
              // « Ne pas déranger » on the handle
              <mesh position={[0.36, s > 0 ? 0.55 : 0.95, s > 0 ? 0.09 : 0.07]} material={mat('#c62828')}>
                <boxGeometry args={[0.16, 0.28, 0.02]} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

/* ---------- A room: standard, superior, suite ---------- */

/** A room's size (half-sizes) and where things are done in it. */
const ROOM: Record<string, { hw: number; hd: number }> = { standard: { hw: 3.2, hd: 2.6 }, superieure: { hw: 4.2, hd: 3 }, suite: { hw: 6, hd: 3.6 } }
function roomSpots(type: string): Record<string, Spot> {
  const { hw, hd } = ROOM[type] ?? ROOM.standard
  const bath = type !== 'standard'
  return {
    'chambre-dormir': { at: [hw - 1.6, -hd + 1.4], rot: Math.PI / 2, pose: 'sleep', y: 0.62, lying: true, from: [hw - 3.2, -hd + 1.4] },
    'chambre-sieste': { at: [hw - 1.6, -hd + 1.4], rot: Math.PI / 2, pose: 'sleep', y: 0.62, lying: true, from: [hw - 3.2, -hd + 1.4] },
    'chambre-tele': { at: [hw - 2.6, -hd + 1.4], rot: -Math.PI / 2, pose: 'sit', y: 0.25, from: [hw - 3.4, -hd + 1.4] },
    'chambre-douche': { at: [-hw + 0.9, hd - 0.9], rot: 0, pose: 'wash', from: [-hw + 2, hd - 0.9] },
    'chambre-bain': bath ? { at: [-hw + 1.2, hd - 1], rot: Math.PI / 2, pose: 'sit', y: 0.05, from: [-hw + 2.4, hd - 1] } : { at: [-hw + 0.9, hd - 0.9], rot: 0, pose: 'wash', from: [-hw + 2, hd - 0.9] },
    rs: { at: [-hw + 1.6, -hd + 1.2], rot: Math.PI, pose: 'eat', y: 0.05, from: [-hw + 1.6, -hd + 2.2] },
  }
}

function GuestRoom({ type, look, night }: { type: string; look: Look; night: boolean }) {
  const { hw, hd } = ROOM[type] ?? ROOM.standard
  const suite = type === 'suite'
  const bath = type !== 'standard'
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[hw * 2, hd * 2]} />
        <meshLambertMaterial color={look.carpet} />
      </mesh>
      {/* The walls, low on the camera's side; the window wall at the back with the hotel's view */}
      <WindowWall look={look} night={night} hw={hw} hd={hd} />
      <RoomDecor look={look} hw={hw} hd={hd} night={night} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * hw, 1.5, 0]} material={mat(look.wall)}>
          <boxGeometry args={[0.15, 3, hd * 2]} />
        </mesh>
      ))}
      <mesh position={[0, 0.4, hd]} material={mat(look.wall)}>
        <boxGeometry args={[hw * 2, 0.8, 0.15]} />
      </mesh>
      {/* The king bed, its headboard, the bedside lamps */}
      <mesh position={[hw - 1.6, 0.32, -hd + 1.4]} material={mat('#f5f1e8')} castShadow>
        <boxGeometry args={[2.4, 0.64, 2.2]} />
      </mesh>
      <mesh position={[hw - 1.6, 0.7, -hd + 1.4]} material={mat(look.fabric)}>
        <boxGeometry args={[1.4, 0.08, 2.25]} />
      </mesh>
      <mesh position={[hw - 0.3, 0.95, -hd + 1.4]} material={mat(look.wood)}>
        <boxGeometry args={[0.2, 1.9, 2.6]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[hw - 0.6, 0.3, -hd + 1.4 + s * 1.6]} material={mat(look.wood)}>
            <boxGeometry args={[0.5, 0.6, 0.5]} />
          </mesh>
          <mesh position={[hw - 0.6, 0.75, -hd + 1.4 + s * 1.6]} material={mat('#fff6d8', night ? '#ffe2a0' : undefined)}>
            <boxGeometry args={[0.22, 0.3, 0.22]} />
          </mesh>
        </group>
      ))}
      {/* The TV on its unit across from the bed; the desk and its chair where room service comes */}
      <mesh position={[hw - 4.2, 0.35, -hd + 1.4]} material={mat(look.wood)}>
        <boxGeometry args={[0.5, 0.7, 1.8]} />
      </mesh>
      <mesh position={[hw - 4.2, 1.15, -hd + 1.4]} material={mat('#121418')}>
        <boxGeometry args={[0.08, 0.8, 1.4]} />
      </mesh>
      <mesh position={[-hw + 1.6, 0.74, -hd + 0.6]} material={mat(look.wood)}>
        <boxGeometry args={[1.8, 0.08, 0.8]} />
      </mesh>
      <mesh position={[-hw + 1.6, 0.25, -hd + 1.2]} material={mat(look.fabric)}>
        <boxGeometry args={[0.55, 0.5, 0.55]} />
      </mesh>
      {/* The bathroom in the corner behind glass: the shower, the basin; a bathtub in the bigger rooms */}
      <mesh position={[-hw + 1.4, 0.04, hd - 1.2]} material={mat('#f4f6f8')}>
        <boxGeometry args={[2.6, 0.08, 2.2]} />
      </mesh>
      <mesh position={[-hw + 2.8, 1.2, hd - 1.2]}>
        <boxGeometry args={[0.05, 2.4, 2.2]} />
        <meshLambertMaterial color="#cfe8f2" transparent opacity={0.35} />
      </mesh>
      {bath && (
        <mesh position={[-hw + 1.2, 0.3, hd - 1]} material={mat('#ffffff')}>
          <boxGeometry args={[1.8, 0.6, 0.9]} />
        </mesh>
      )}
      {/* The superior room's sofa; the suite's lounge apart, its low table, its dining table */}
      {type !== 'standard' && (
        <mesh position={[-hw + 3.6, 0.3, -hd + 1]} material={mat(look.fabric)}>
          <boxGeometry args={[1.8, 0.6, 0.8]} />
        </mesh>
      )}
      {suite && (
        <>
          <mesh position={[0, 1.5, 0]} material={mat(look.wall)}>
            <boxGeometry args={[0.15, 3, hd * 0.9]} />
          </mesh>
          <mesh position={[-hw + 3.6, 0.22, -hd + 2.4]} material={mat(look.wood)}>
            <boxGeometry args={[1.2, 0.44, 0.7]} />
          </mesh>
          <mesh position={[-2.2, 0.38, 1]} material={mat(look.wood)}>
            <boxGeometry args={[1.6, 0.76, 1]} />
          </mesh>
          <mesh position={[-2.2, 0.8, 1]} material={mat(look.accent)}>
            <boxGeometry args={[0.3, 0.1, 0.3]} />
          </mesh>
        </>
      )}
    </group>
  )
}

/* ---------- Upstairs: the corridor or a room, the Sim in it ---------- */

export function Upstairs({ sim, stage, look, view, floor, room, rooms, roomType, interactionId, night, onDoor }: { sim: Sim; stage: string; look: Look; view: 'corridor' | 'room'; floor: number; room: string | null; rooms: HotelView['rooms']; roomType: string; interactionId?: string; night: boolean; onDoor: (room: string) => void }) {
  const inRoom = view === 'room'
  const { hw, hd } = ROOM[roomType] ?? ROOM.standard
  const len = doorX((rooms ?? []).length) + 4
  const free = useMemo(() => (inRoom ? (x: number, z: number) => Math.abs(x) < hw - 0.4 && Math.abs(z) < hd - 0.4 : (x: number, z: number) => x > 0.6 && x < len - 0.5 && Math.abs(z) < CW - 0.35), [inRoom, hw, hd, len])
  const entrance: XZ = inRoom ? [0, hd - 0.8] : [1.2, 0]
  const spots = roomSpots(roomType)
  const spot = inRoom && interactionId ? (spots[interactionId.startsWith('rs-') ? 'rs' : interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, `${view}:${room}:${interactionId ?? ''}`, !interactionId, free, entrance)
  // The camera from the open side, above; in a room, the room high on the screen (its sheet takes the bottom).
  const center: [number, number, number] = inRoom ? [0, 0.4, hd * 0.75] : [4, 0.6, 0.6]
  return (
    <Canvas key={`${view}:${floor}:${room}`} shadows dpr={[1, 1.75]} camera={{ position: inRoom ? [0, 11, hd + 9] : [center[0], 8.5, 8.5], fov: 45, near: 0.2, far: 400 }} style={{ background: night ? '#0b1026' : '#d9d2c4' }}>
      <Snapper />
      <ChatFraming />
      <hemisphereLight args={['#ffffff', '#b9a98c', night ? 1 : 1.4]} />
      <directionalLight position={[8, 14, 6]} intensity={0.9} castShadow />
      <pointLight position={[0, 2.8, 0]} intensity={night ? 22 : 10} distance={14} color="#ffe2b0" />
      {inRoom ? <GuestRoom type={roomType} look={look} night={night} /> : <Corridor look={look} floor={floor} rooms={rooms} night={night} onDoor={(r) => (tap([doorX(Number(r.slice(-2))), doorZ(Number(r.slice(-2))) * 0.6]), onDoor(r))} />}
      {!interactionId && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={inRoom ? [0, 0.03, 0] : [len / 2, 0.03, 0]}
          onClick={(e) => {
            if (e.delta > 6) return
            e.stopPropagation()
            tap([e.point.x, e.point.z])
          }}
        >
          <planeGeometry args={inRoom ? [hw * 2, hd * 2] : [len, CW * 2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!interactionId} onMoved={onMoved} free={free} entrance={entrance} look={spot?.pose === 'wash' || interactionId === 'chambre-bain' ? { ...sim.look, outfit: 'serviette', accessory: 'none' } : undefined}>
        <ActionProps id={interactionId} kind="room" lying={!!spot?.lying} bath={roomType !== 'standard'} />
        {/* The TV across from the bed, on; the Z… z… of the sleeper (back upright, from the lying frame) */}
        {interactionId === 'chambre-tele' && (
          <group position={[0, 0.05, 1.55]} rotation={[0, Math.PI, 0]}>
            <TvOn />
          </group>
        )}
        {spot?.lying && (
          <group rotation={[Math.PI / 2, 0, 0]}>
            <Zzz at={[0, 0.55, -1.3]} />
          </group>
        )}
      </Guest>
      <OrbitControls makeDefault target={center} enablePan={false} minDistance={4} maxDistance={30} minPolarAngle={0.3} maxPolarAngle={1.2} enableDamping />
      <RichAO />
    </Canvas>
  )
}

/* ---------- The hotel with its floors: the hall (children), the lift, the floors and the rooms ---------- */

const TYPE_LABEL: Record<string, string> = { standard: tr('Standard'), superieure: tr('Supérieure'), suite: tr('Suite') }

/** What freeing the room early pays back (mirrors backend sims/hotel.go stayRefund): the whole nights not started. */
const refundOf = (st: Stay, now: number) => {
  const nights = Math.floor((st.until - now) / 1440)
  return st.kind !== 'hotel' || nights <= 0 || st.until <= st.from ? 0 : Math.floor((st.paid * nights * 1440) / (st.until - st.from))
}

export function HotelStay({ world, sim, placeId, stage, night, interactionId, act, onAct, children }: { world: World; sim: Sim; placeId: string; stage: string; night: boolean; interactionId?: string; act: Act; onAct: (it: Interaction) => void; children: ReactNode }) {
  const look = LOOKS[placeId] ?? PLAIN
  const [info, setInfo] = useState<HotelView | null>(null)
  const [level, setLevel] = useState(0)
  const [view, setView] = useState<'corridor' | 'room'>('corridor')
  const [room, setRoom] = useState<string | null>(null)
  const [riding, setRiding] = useState<{ from: number; to: number } | null>(null)
  const lift = useLift()
  const stay = sim.stay && sim.stay.place === placeId && sim.stay.until > sim.gameMinutes ? sim.stay : null
  const roomActs = useMemo(() => (world.kinds.hotel?.interactions ?? []).filter((it) => it.stay), [world])

  const load = (floor = level) => api.hotel(sim.id, placeId, floor).then(setInfo, () => undefined)
  useEffect(() => void load(level), [placeId, level, stay?.room, stay?.until]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setLift(false), [])

  // In one's room for what's done there: up to it. Anything else of the hotel's (the pool, the bar): down to the hall.
  useEffect(() => {
    if (isRoomAct(interactionId) && stay?.floor) {
      setLevel(stay.floor)
      setView('room')
      setRoom(stay.room ?? null)
    } else if (interactionId) {
      setLevel(0)
    }
  }, [interactionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const ride = (to: number) => {
    setLift(false)
    if (to === level) return
    setRiding({ from: level, to })
    setRoom(null)
    setView('corridor')
    setTimeout(() => (setLevel(to), setRiding(null)), 1300)
  }
  const visit = (r: string) => {
    const it = info?.rooms?.find((x) => x.room === r)
    if (!it) return
    setRoom(r)
    if (!it.taken) setTimeout(() => setView('room'), 700)
  }

  const floors = info?.hotel.floors ?? 0
  const current = info?.rooms?.find((r) => r.room === room)
  const type = current?.type ?? stay?.type ?? 'standard'
  const busy = !!sim.activity
  const [sheet, setSheet] = useState(true)
  useEffect(() => setSheet(true), [view, room])
  // « Libérer la chambre » asked: what it means first (what's paid back), then done.
  const [freeing, setFreeing] = useState(false)
  useEffect(() => setFreeing(false), [view, room, sheet])
  // The hotel's sheets go over the whole game (a portal: the inside is under the HUD), so nothing sits on them.
  const panel = 'pointer-events-auto fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[min(62vh,520px)] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_40px_-18px_rgba(0,0,0,0.55)] animate-up short:max-h-[78vh]'
  const where = level === 0 ? tr('Hall') : view === 'room' && room ? tr('Chambre {room}', { room }) : tr('Étage {level}', { level })

  return (
    <div className="absolute inset-0">
      {level === 0 ? children : <Upstairs sim={sim} stage={stage} look={look} view={view} floor={level} room={room} rooms={info?.rooms} roomType={type} interactionId={isRoomAct(interactionId) ? interactionId : undefined} night={night} onDoor={visit} />}
      {createPortal(
        <>
      {/* The lift on its way: the floors going by */}
      {riding && (
        <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-[#15161c]/85">
          <div className="text-center text-white">
            <ArrowDownUp size={34} className="mx-auto mb-2 animate-pulse" />
            <div className="font-display text-5xl font-extrabold">{riding.to === 0 ? 'RDC' : riding.to}</div>
            <div className="mt-1 text-sm font-bold opacity-80">{riding.to > riding.from ? tr('On monte…') : tr('On descend…')}</div>
          </div>
        </div>
      )}

      {/* Where one is, under one's name (nothing else up there in a place): the lift, or the room's sheet */}
      {!busy && !riding && (
        <div className="pointer-events-none fixed top-[calc(max(0.75rem,env(safe-area-inset-top))+3.9rem)] left-3 z-[25] flex flex-col items-start gap-1.5 lg:top-[6.5rem] lg:left-5">
          <button className="hud pointer-events-auto flex items-center gap-1.5 rounded-full py-2 pr-3.5 pl-3 text-sm font-extrabold active:scale-95" onClick={() => (view === 'room' && level > 0 ? setSheet(true) : setLift(true))}>
            {view === 'room' && level > 0 ? <KeyRound size={16} className="text-[#c79100]" /> : <ArrowDownUp size={16} className="text-[var(--color-orange)]" />}
            {where}
          </button>
          {level > 0 && view === 'corridor' && (
            <>
              <button className="hud pointer-events-auto rounded-full px-3 py-1.5 text-[11px] font-extrabold" onClick={() => setLift(true)}>
                {tr('Touche une porte · 🟢 libre · 🔴 occupée')}
              </button>
              {/* Out of the floors, still in the hotel: its hall (the way out of the hotel is at the bottom of the screen). */}
              <button className="hud pointer-events-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-extrabold active:scale-95" onClick={() => ride(0)}>
                <ArrowDown size={14} /> {tr('Descendre au hall')}
              </button>
            </>
          )}
          {level > 0 && view === 'room' && (
            // Out of the room, not of the hotel: into the corridor.
            <button className="hud pointer-events-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-extrabold active:scale-95" onClick={() => (setView('corridor'), setRoom(null))}>
              <DoorOpen size={14} /> {tr('Sortir de la chambre')}
            </button>
          )}
        </div>
      )}

      {/* The lift's panel: every floor */}
      {lift && info && (
        <>
        <div className="fixed inset-0 z-[59] bg-[#0f1230]/45" onClick={() => setLift(false)} />
        <div className={panel}>
          <div className="mb-2 flex items-center gap-2">
            <ArrowDownUp size={18} className="text-[var(--color-orange)]" />
            <span className="min-w-0 flex-1 font-display text-lg font-extrabold">{tr('Ascenseur ·')} {info.name}</span>
            <button className="icon-btn bg-[var(--color-canvas)] !h-9 !w-9" onClick={() => setLift(false)} aria-label={tr('Fermer')}>
              <X size={18} />
            </button>
          </div>
          {level > 0 && info.rooms && (
            // The floor one is on: its doors (the far ones too), to visit.
            <>
              <h5 className="label mb-1">{tr("Les portes de l'étage")} {level}</h5>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {info.rooms.map((r) => (
                  <button
                    key={r.room}
                    onClick={() => (setLift(false), visit(r.room))}
                    disabled={r.taken}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-extrabold ${r.mine ? 'bg-[#ffc93c] text-[#5a3a00]' : r.taken ? 'bg-[#ffe2e2] text-[#b42318] opacity-60' : 'bg-[#e6f7ee] text-[#137a42]'}`}
                  >
                    {r.room}
                    <span className="ml-1 opacity-70">{r.mine ? tr('à toi') : r.taken ? tr('occupée') : TYPE_LABEL[r.type]}</span>
                  </button>
                ))}
              </div>
              <h5 className="label mb-1">{tr('Aller à un autre étage')}</h5>
            </>
          )}
          <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">
            {tx('{stars} étoiles · {floors} étages de chambres{0}. La nuit dès {1} Djai.', { stars: info.hotel.stars, floors, 0: info.hotel.suitesFrom <= floors ? tr(', suites à partir du {suitesFrom}e', { suitesFrom: info.hotel.suitesFrom }) : '', 1: amount(info.prices.standard?.['1n'] ?? 0) })}
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {[0, ...Array.from({ length: floors }, (_, i) => i + 1)].map((f) => (
              <button
                key={f}
                onClick={() => ride(f)}
                className={`relative rounded-xl py-2.5 text-sm font-extrabold transition active:scale-95 ${f === level ? 'bg-[var(--color-ink)] text-white' : f >= info.hotel.suitesFrom ? 'bg-[#fff1c2] text-[#7a5a00]' : 'bg-[var(--color-canvas)]'}`}
              >
                {f === 0 ? 'RDC' : f}
                {stay?.floor === f && <KeyRound size={11} className="absolute top-1 right-1 text-[#c79100]" />}
              </button>
            ))}
          </div>
        </div>
        </>
      )}

      {/* In a room: to rent (visiting), or one's own (what to do, room service, the key) */}
      {!lift && level > 0 && view === 'room' && room && info && !busy && sheet && (
        <div className={panel}>
          <div className="mb-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-display text-lg font-extrabold">
                {tx('Chambre {room} · {0}', { room, 0: TYPE_LABEL[type] })}
              </span>
              <span className="block text-xs font-semibold text-[var(--color-ink-soft)]">{info.types.find((t) => t.id === type)?.hint}</span>
            </span>
            <button className="icon-btn bg-[var(--color-canvas)] !h-9 !w-9" onClick={() => setSheet(false)} aria-label={tr('Fermer')}>
              <X size={18} />
            </button>
          </div>
          {current?.mine && stay ? (
            <>
              <p className="mb-2 rounded-xl bg-[#fff6d6] px-3 py-2 text-xs font-bold text-[#7a5a00]">
                <KeyRound size={13} className="mr-1 inline" /> {tx('Ta chambre, encore {0}.', { 0: duration(stay.until - sim.gameMinutes) })}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {roomActs
                  .filter((it) => !it.id.startsWith('rs-') && (it.id !== 'chambre-bain' || type !== 'standard'))
                  .map((it) => (
                    <button key={it.id} className="flex items-center gap-2 rounded-xl bg-[var(--color-canvas)] px-2.5 py-2 text-left text-xs font-extrabold active:scale-95" onClick={() => onAct(it)}>
                      {(() => {
                        const I = iconFor(it.icon)
                        return <I size={16} className="shrink-0 text-[var(--color-orange)]" />
                      })()}
                      <span className="min-w-0">{it.label.replace(' dans ta chambre', '')}</span>
                    </button>
                  ))}
              </div>
              <h5 className="label mt-3 mb-1 flex items-center gap-1.5">
                <ConciergeBell size={13} /> {tr('Room service')}
              </h5>
              <ul className="space-y-1.5">
                {roomActs
                  .filter((it) => it.id.startsWith('rs-'))
                  .map((it) => {
                    const open = openAt(it, sim.gameMinutes)
                    return (
                      <li key={it.id}>
                        <button disabled={!open || sim.money < it.cost} className="flex w-full items-center gap-2 rounded-xl bg-[var(--color-canvas)] px-2.5 py-2 text-left text-xs font-extrabold disabled:opacity-50" onClick={() => onAct(it)}>
                          <span className="min-w-0 flex-1">{it.label.replace('Room service : ', '')}</span>
                          <span className="shrink-0">{open ? tr('{0} Djai', { 0: amount(it.cost) }) : tr('fermé')}</span>
                        </button>
                      </li>
                    )
                  })}
              </ul>
              {freeing ? (
                // Freeing the room before its time: what's paid back, then the key handed in at the desk.
                <div className="mt-3 rounded-2xl bg-[#fff1f0] p-3">
                  <p className="text-xs font-bold text-[#8a1c12]">
                    {tx('Libérer la chambre {room} maintenant ?  {0}', { room, 0: refundOf(stay, sim.gameMinutes) > 0 ? tr('Les nuits pas commencées te sont remboursées : {0} Djai.', { 0: amount(refundOf(stay, sim.gameMinutes)) }) : tr('La nuit en cours est due : rien n’est remboursé.') })}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button className="flex-1 rounded-2xl bg-white py-2 text-sm font-extrabold" onClick={() => setFreeing(false)}>
                      {tr('Garder la chambre')}
                    </button>
                    <button className="btn flex-1 !bg-[#c92a2a] !py-2 !text-sm" onClick={() => void act('Libérer la chambre', 'key-round', 'home', () => api.endStay(sim.id)).then((ok) => {
                        if (!ok) return
                        setView('corridor')
                        setRoom(null)
                        void load()
                      })}>
                      <DoorClosed size={15} /> {tr('Libérer')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button className="btn flex-1 !py-2 !text-sm" onClick={() => void act(`Prolonger : 1 nuit`, 'bed-double', 'home', () => api.bookRoom(sim.id, placeId, room, '1n')).then(() => load())}>
                    <BedDouble size={15} /> {tx('+1 nuit · {0}', { 0: amount(info.prices[type]?.['1n'] ?? 0) })}
                  </button>
                  <button className="flex-1 rounded-2xl bg-[var(--color-canvas)] py-2 text-sm font-extrabold" onClick={() => setFreeing(true)}>
                    <DoorClosed size={15} className="mr-1 inline" /> {tr('Libérer la chambre')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">{stay ? tr('Tu as déjà la chambre {room} : rends sa clé pour prendre celle-ci.', { room: stay.room }) : tr('Elle te plaît ? Choisis combien de temps : la clé est à toi tout de suite.')}</p>
              <ul className="space-y-1.5">
                {info.lengths.map((l) => {
                  const price = info.prices[type]?.[l.id] ?? 0
                  return (
                    <li key={l.id} className="flex items-center gap-2 rounded-xl bg-[var(--color-canvas)] px-3 py-2">
                      <span className="min-w-0 flex-1 text-sm font-extrabold">{l.label}</span>
                      <button
                        className="btn shrink-0 !px-3 !py-1.5 !text-sm"
                        disabled={!!stay || sim.money < price}
                        onClick={() => void act(`Louer la ${room} · ${l.label}`, 'key-round', 'home', () => api.bookRoom(sim.id, placeId, room, l.id)).then(() => load())}
                      >
                        {sim.money < price ? tr('Trop cher') : tr('{0} Djai', { 0: amount(price) })}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
        </>,
        document.body,
      )}
    </div>
  )
}
