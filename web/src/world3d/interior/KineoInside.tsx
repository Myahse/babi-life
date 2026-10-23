import { SpotActions } from '../SpotActions'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { CinemaFilm, CinemaSalle, Sim } from '../../lib/types'
import { api } from '../../lib/api'
import { worldTime } from '../../lib/worldClock'
import { NoShadows, type Pose } from '../../avatar/Human'
import { LowHuman } from '../../avatar/LowHuman'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { Character } from '../Character'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { Guest, mat, sign, useBigWalk, type XZ } from './bigPlace'
import { Cinema } from './doings'
import { drawReel, REEL_H, REEL_W } from './filmReel'

// Inside a Kinéo cinema (game/cinema.go). Come in: the lobby, the ticket
// machines and the counter, the popcorn under its lamp, this week's posters
// on the walls, the doors of the screens. With a ticket (sims/cinema.go): the
// screen's room, in the dark, the rows going up from the screen (A at the
// front), the film lit on the screen, the Sim in its own seat among the
// town come to see it; the big red reclining seats of a VIP room.

type Seance = { film: string; salle: number; seats: string[]; vip?: boolean }

const FALLBACK: CinemaFilm = { id: '', title: 'Kinéo', genre: '', minutes: 100, rating: '', tagline: '', colors: ['#c8102e', '#14161f'] }

/** The film shown, from this week's programme of the cinema. */
function useFilm(cinema: string, id?: string) {
  const [film, setFilm] = useState<CinemaFilm | null>(null)
  useEffect(() => {
    if (!id) return
    void api.cinemaProgram(cinema).then((p) => setFilm(p.films.find((f) => f.id === id) ?? null), () => undefined)
  }, [cinema, id])
  return film
}

/** The screen's picture: the film's colours and its title, as its opening would show it. */
function screenTexture(f: CinemaFilm) {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 272
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 640, 272)
  grad.addColorStop(0, f.colors[0])
  grad.addColorStop(1, f.colors[1])
  g.fillStyle = grad
  g.fillRect(0, 0, 640, 272)
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.fillRect(0, 190, 640, 82)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.font = '800 46px sans-serif'
  g.fillText(f.title, 320, 245, 600)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function KineoInside({ sim, placeId, interactionId, roam, night, stage }: { sim: Sim; placeId: string; interactionId?: string; roam?: boolean; night: boolean; stage: string }) {
  const seance = sim.activity?.kind === 'do' && sim.activity.placeId === placeId ? (sim.activity.seance as Seance | undefined) : undefined
  // A film with a ticket, or one bought at the counter: in the room.
  if (seance || interactionId === 'film' || interactionId === 'film-popcorn') return <Room sim={sim} placeId={placeId} seance={seance} popcorn={interactionId === 'film-popcorn'} stage={stage} />
  return <Lobby sim={sim} placeId={placeId} roam={roam} night={night} stage={stage} />
}

/* ---------- The screen's room ---------- */

/** The rooms, as the server has them (sizes for the drawing; the seats' letters and numbers the same). */
const SALLES: Record<string, CinemaSalle[]> = {
  'marcory-kineo': [
    { n: 1, rows: 6, cols: 10, aisles: [5], vip: true, price: 10000, name: 'Salle 1 · VIP' },
    { n: 2, rows: 6, cols: 10, aisles: [5], vip: true, price: 10000, name: 'Salle 2 · VIP' },
    ...[3, 4, 5, 6].map((n) => ({ n, rows: 11, cols: 20, aisles: [4, 16], price: 4500, name: `Salle ${n}` })),
  ],
  'cocody-kineo': [{ n: 1, rows: 12, cols: 15, aisles: [3, 12], price: 3500, name: 'Salle unique' }],
}

function Room({ sim, placeId, seance, popcorn, stage }: { sim: Sim; placeId: string; seance?: Seance; popcorn: boolean; stage: string }) {
  const salle = SALLES[placeId]?.find((s) => s.n === (seance?.salle ?? 3)) ?? SALLES[placeId]?.[0] ?? SALLES['cocody-kineo'][0]
  const vip = !!salle.vip
  const film = useFilm(placeId, seance?.film) ?? FALLBACK
  // The room's measures: a seat's width, a row's depth and rise; the aisles' gaps.
  const [SW, RD, RISE] = vip ? [1.05, 1.7, 0.45] : [0.62, 1.05, 0.34]
  const xOf = (c: number) => {
    const gaps = salle.aisles.filter((a) => c >= a).length
    const width = salle.cols * SW + salle.aisles.length * 1.1
    return -width / 2 + c * SW + gaps * 1.1 + SW / 2
  }
  const zOf = (r: number) => 4 + r * RD
  const yOf = (r: number) => r * RISE
  const width = salle.cols * SW + salle.aisles.length * 1.1 + 3
  // The Sim's seat: the ticket's first, or one in the middle of the room.
  const mine = seance?.seats[0] ?? `${String.fromCharCode(65 + Math.floor(salle.rows / 2))}${Math.ceil(salle.cols / 2)}`
  const [myRow, myCol] = [mine.charCodeAt(0) - 65, Number(mine.slice(1)) - 1]
  const friends = new Set(seance?.seats.slice(1) ?? [])
  // Who else is there (the same ones whenever one comes back): about half the room.
  const crowd = useMemo(() => {
    const r = rng(`kineo-${placeId}-${salle.n}-${seance?.film ?? ''}`)
    const out: { p: [number, number, number]; look: ReturnType<typeof randomLook>; gender: 'femme' | 'homme'; pose: Pose; seed: number }[] = []
    for (let row = 0; row < salle.rows; row++)
      for (let c = 0; c < salle.cols; c++) {
        const n = `${String.fromCharCode(65 + row)}${c + 1}`
        if (n === mine || r() > (friends.has(n) ? 1 : 0.45)) continue
        const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
        out.push({ p: [xOf(c), yOf(row) + 0.05, zOf(row) + 0.1], look: randomLook(gender, r), gender, pose: r() < 0.2 ? 'eat' : r() < 0.15 ? 'drink' : 'sit', seed: r() * 100 })
      }
    return out
  }, [salle, placeId, seance?.film]) // eslint-disable-line react-hooks/exhaustive-deps
  const seats = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number] }[] = []
    for (let row = 0; row < salle.rows; row++)
      for (let c = 0; c < salle.cols; c++) {
        // The seat and its back (a VIP recliner: wider, deeper).
        out.push({ p: [xOf(c), yOf(row) + 0.22, zOf(row) + 0.15], s: [SW * 0.86, 0.44, vip ? 0.9 : 0.5] })
        out.push({ p: [xOf(c), yOf(row) + 0.62, zOf(row) + (vip ? 0.62 : 0.42)], s: [SW * 0.86, vip ? 0.9 : 0.8, 0.14] })
      }
    return out
  }, [salle]) // eslint-disable-line react-hooks/exhaustive-deps
  const steps = useMemo(() => Array.from({ length: salle.rows }, (_, row) => ({ p: [0, yOf(row) / 2, zOf(row) + RD / 2 - 0.2] as [number, number, number], s: [width, yOf(row) + 0.02, RD] as [number, number, number] })), [salle]) // eslint-disable-line react-hooks/exhaustive-deps
  const screenW = Math.min(width - 2, 22)
  const [sx, sy, sz] = [xOf(myCol), yOf(myRow), zOf(myRow)]
  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 1.75]} camera={{ position: [sx + 2.5, sy + 5, sz + 7], fov: 50, near: 0.1, far: 200 }} style={{ background: '#07070c' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          {/* The room in the half-light: the film's glow, the aisles' little lights */}
          <hemisphereLight args={['#9a8ab4', '#3a1c22', 1.25]} />
          {/* The screen, the film playing on it and its light on the room; the dark walls round it */}
          <FilmScreen film={film} width={screenW} />
          <mesh geometry={BOX} position={[0, 4, -0.3]} scale={[width + 4, 9, 0.4]} material={mat('#121218')} />
          {[-1, 1].map((k) => (
            <mesh key={k} geometry={BOX} position={[k * (width / 2 + 1.5), 4, zOf(salle.rows) / 2]} scale={[0.4, 10, zOf(salle.rows) + 4]} material={mat('#1a1622')} />
          ))}
          {/* The floor, the steps under the rows, the seats */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, zOf(salle.rows) / 2]}>
            <planeGeometry args={[width + 3, zOf(salle.rows) + 6]} />
            <meshLambertMaterial color="#2a1418" />
          </mesh>
          <Blocks at={steps} material={mat('#3a1c22')} />
          <Blocks at={seats} material={mat(vip ? '#a3122a' : '#7a1020')} />
          {/* The little lights along the aisles' steps */}
          {salle.aisles.map((a) =>
            Array.from({ length: salle.rows }, (_, row) => (
              <mesh key={`${a}-${row}`} geometry={BOX} position={[xOf(a) - SW / 2 - 0.55, yOf(row) + 0.03, zOf(row) - 0.3]} scale={[0.12, 0.04, 0.12]} material={mat('#ffcf6e', '#ffb02e')} />
            )),
          )}
          <NoShadows>
            {crowd.map((c, i) => (
              <group key={i} position={c.p} rotation={[0, Math.PI, 0]}>
                <LowHuman look={c.look} gender={c.gender} pose={c.pose} seed={c.seed} />
              </group>
            ))}
          </NoShadows>
          {/* The Sim in its seat, facing the screen; the popcorn on the lap if bought (a VIP seat comes with it) */}
          <group position={[sx, sy + 0.05, sz + 0.1]} rotation={[0, Math.PI, 0]}>
            <Character look={sim.look} gender={sim.gender} pose={popcorn || vip ? 'eat' : 'sit'} stage={stage} />
            <Cinema popcorn={popcorn || vip} />
          </group>
          <OrbitControls makeDefault target={[sx / 2, (sy + 4.2) / 2, sz / 2]} enablePan={false} minDistance={3} maxDistance={40} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/**
 * The screen with the film playing (filmReel.ts: drawn about twelve times a
 * second, enough for a picture going by), and its light on the room, in the
 * colour of the shot on screen, flickering as the pictures change.
 */
function FilmScreen({ film, width }: { film: CinemaFilm; width: number }) {
  const glow = useRef<THREE.PointLight>(null)
  const reel = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = REEL_W
    canvas.height = REEL_H
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return { g: canvas.getContext('2d')!, texture, material: new THREE.MeshBasicMaterial({ map: texture }), last: -1 }
  }, [])
  useEffect(() => () => (reel.texture.dispose(), reel.material.dispose()), [reel])
  useFrame(() => {
    const t = worldTime()
    if (t - reel.last >= 1 / 12 || t < reel.last) {
      reel.last = t
      const light = drawReel(reel.g, film, t)
      reel.texture.needsUpdate = true
      glow.current?.color.set(light)
    }
    if (glow.current) glow.current.intensity = 70 + Math.sin(t * 2.3) * 12 + Math.sin(t * 7.1) * 7
  })
  return (
    <>
      <pointLight ref={glow} position={[0, 5, 3]} intensity={70} distance={60} decay={1.2} color={film.colors[0]} />
      <mesh position={[0, 4.2, 0]} material={reel.material}>
        <planeGeometry args={[width, width * (REEL_H / REEL_W)]} />
      </mesh>
    </>
  )
}

/* ---------- The lobby ---------- */

const W = 13 // half the lobby's width
const D = 9 // half its depth
const ENTRANCE: XZ = [0, D - 1.2]
const COUNTER: [number, number, number, number] = [-6, -5.6, 4.5, 1] // x, z, half-width, half-depth
const MACHINES: XZ[] = [
  [6.5, 4.5],
  [8.5, 4.5],
]

function freeLobby(x: number, z: number) {
  if (Math.abs(x) > W - 0.6 || Math.abs(z) > D - 0.6) return false
  if (Math.abs(x - COUNTER[0]) < COUNTER[2] + 0.5 && Math.abs(z - COUNTER[1]) < COUNTER[3] + 0.5) return false
  for (const [mx, mz] of MACHINES) if (Math.abs(x - mx) < 0.8 && Math.abs(z - mz) < 0.7) return false
  return true
}

function Lobby({ sim, placeId, roam, night, stage }: { sim: Sim; placeId: string; roam?: boolean; night: boolean; stage: string }) {
  const { way, tap, onMoved } = useBigWalk(null, undefined, roam, freeLobby, ENTRANCE)
  const [films, setFilms] = useState<CinemaFilm[]>([])
  useEffect(() => {
    void api.cinemaProgram(placeId).then((p) => setFilms(p.films), () => undefined)
  }, [placeId])
  const posters = useMemo(() => films.slice(0, 6).map((f) => new THREE.MeshBasicMaterial({ map: screenTexture(f) })), [films])
  const signs = useMemo(() => ({ brand: sign('KINÉO', '#c8102e', '#ffffff', 512, 128), snack: sign('POP-CORN · BOISSONS', '#14161f', '#ffd166', 512, 96) }), [])
  const salles = SALLES[placeId] ?? SALLES['cocody-kineo']
  const doors = useMemo(() => salles.map((s) => sign(s.vip ? `${s.n} · VIP` : String(s.n), s.vip ? '#c9a227' : '#2b2f45', '#ffffff', 256, 128)), [salles])
  const people = useMemo(() => {
    const r = rng(`kineo-hall-${placeId}`)
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: string) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, outfit: dress, outfitColor: '#c8102e' } : look, seed: r() * 100 }
    }
    return [
      // Behind the counter, in the brand's red; the queue in front of it.
      one([COUNTER[0] - 1.5, 0, COUNTER[1] - 1.4], 0, 'busy', 'casual'),
      one([COUNTER[0] + 1.5, 0, COUNTER[1] - 1.4], 0, 'busy', 'casual'),
      one([COUNTER[0] - 1, 0, COUNTER[1] + 1.6], Math.PI, 'idle'),
      one([COUNTER[0] - 1, 0, COUNTER[1] + 2.7], Math.PI, 'phone'),
      one([COUNTER[0] + 1.4, 0, COUNTER[1] + 1.7], Math.PI, 'eat'),
      // At the machines, by the posters, waiting for the doors.
      one([MACHINES[1][0], 0, MACHINES[1][1] - 0.9], 0, 'phone'),
      one([4, 0, -7.2], Math.PI, 'film'),
      one([5.2, 0, -7.1], Math.PI, 'talk'),
      one([9, 0, -2], -Math.PI / 2, 'idle', 'vigile'),
    ]
  }, [placeId])
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 11, D + 8], fov: 45, near: 0.3, far: 300 }} style={{ background: night ? '#0b1026' : '#1a1622' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={['#fff3e6', '#5a2a30', 1.5]} />
          <directionalLight position={[8, 20, 10]} intensity={1.1} castShadow />
          {[-7, 0, 7].map((x) => <pointLight key={x} position={[x, 3.6, 0]} intensity={18} distance={12} color="#ffe2b8" />)}
          <pointLight position={[COUNTER[0], 3, COUNTER[1] + 1]} intensity={30} distance={14} color="#ffd9a0" />
          {/* The carpet, the walls (low at the front, for the eye) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={(e) => {
              if (!roam || e.delta > 6) return
              e.stopPropagation()
              tap([e.point.x, e.point.z])
            }}
          >
            <planeGeometry args={[2 * W, 2 * D]} />
            <meshLambertMaterial color="#7a1020" />
          </mesh>
          <Blocks
            at={[
              { p: [0, 2, -D], s: [2 * W, 4, 0.3] },
              { p: [-W, 2, 0], s: [0.3, 4, 2 * D] },
              { p: [W, 2, 0], s: [0.3, 4, 2 * D] },
              { p: [-(W + 2) / 2, 0.5, D], s: [W - 2, 1, 0.3] },
              { p: [(W + 2) / 2, 0.5, D], s: [W - 2, 1, 0.3] },
            ]}
            material={mat('#2b2230')}
          />
          {/* The brand over the far wall, the posters along it */}
          <mesh position={[0, 3.4, -D + 0.17]} material={signs.brand}>
            <planeGeometry args={[5, 1.25]} />
          </mesh>
          {posters.map((m, i) => (
            <group key={i} position={[-10 + i * 4, 1.9, -D + 0.17]}>
              <mesh geometry={BOX} scale={[1.7, 2.5, 0.05]} material={mat('#d4af37')} />
              <mesh position={[0, 0, 0.03]} material={m}>
                <planeGeometry args={[1.55, 2.35]} />
              </mesh>
            </group>
          ))}
          {/* The counter, the popcorn under its lamp, the sign */}
          <mesh geometry={BOX} position={[COUNTER[0], 0.55, COUNTER[1]]} scale={[COUNTER[2] * 2, 1.1, COUNTER[3] * 2]} material={mat('#14161f')} castShadow />
          <mesh geometry={BOX} position={[COUNTER[0] + 2.6, 1.55, COUNTER[1] - 0.3]} scale={[1, 0.9, 0.7]} material={mat('#ffd166', '#ffb02e')} />
          <mesh position={[COUNTER[0], 3.1, COUNTER[1] - 1]} material={signs.snack}>
            <planeGeometry args={[6, 1.1]} />
          </mesh>
          {/* The ticket machines */}
          {MACHINES.map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh geometry={BOX} position={[0, 0.8, 0]} scale={[0.8, 1.6, 0.5]} material={mat('#c8102e')} castShadow />
              <mesh geometry={BOX} position={[0, 1.2, -0.26]} scale={[0.6, 0.45, 0.02]} material={mat('#9fd3f2', '#3a6f8f')} />
            </group>
          ))}
          {/* The doors of the screens, down the right wall */}
          {doors.map((m, i) => (
            <group key={i} position={[W - 0.17, 0, -6 + i * 2.6]} rotation={[0, -Math.PI / 2, 0]}>
              <mesh geometry={BOX} position={[0, 1.15, 0]} scale={[1.6, 2.3, 0.08]} material={mat('#3a2a30')} />
              <mesh position={[0, 2.65, 0.05]} material={m}>
                <planeGeometry args={[1.2, 0.6]} />
              </mesh>
            </group>
          ))}
          <NoShadows>
            {people.map((g, i) => (
              <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
                <TalkHuman id={`kineo-${placeId}-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
              </group>
            ))}
          </NoShadows>
          <Guest sim={sim} stage={stage} way={way} spot={null} steer={!!roam} onMoved={onMoved} free={freeLobby} entrance={ENTRANCE} />
          {/* What's done here, over where it's done (SpotActions): tap one, the Sim goes */}
          <SpotActions shown={!!roam} where={() => [COUNTER[0], 0, COUNTER[1] + 1.6]} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} minDistance={6} maxDistance={50} minPolarAngle={0.25} maxPolarAngle={1.3} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

