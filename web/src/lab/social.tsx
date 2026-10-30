import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import '../index.css'
import { api } from '../lib/api'
import { useSession } from '../store/session'
import type { ActionResult, Sim, StreetRide, World } from '../lib/types'
import { GbairaiApp } from '../screens/GbairaiApp'
import { TikitokoApp } from '../screens/TikitokoApp'
import { BetApp } from '../screens/BetApp'
import { BabigramApp } from '../screens/BabigramApp'
import { StreetStall } from '../world3d/open/stalls'
import { Snapper } from '../world3d/snapshot'
import { RideFlow } from '../components/RideFlow'
import { TravelCTA } from '../components/TravelCTA'
import { CardBack, PlayingCard } from '../components/PlayingCards'
import { HuitSheet } from '../components/Huit'
import { DamesSheet } from '../components/Dames'
import { DefiSheet } from '../components/Defi'

// The phone's social apps on their own (?app=gbairai|tikitoko&token=…&sim=…),
// against a running API (VITE_API_URL), with a street stall in 3D behind for
// the photos; the card games' table too (?app=cards|huit|dames). A lab for the
// screenshots, not part of the game.

const q = new URLSearchParams(location.search)
const token = q.get('token')
if (token) useSession.setState({ token })

/** Booking a Gnango (?app=gnango&money=…): the kinds of car, then the driver. Needs only the world. */
function RideLab() {
  const [world, setWorld] = useState<World | null>(null)
  useEffect(() => {
    void api.world().then(setWorld)
  }, [])
  if (!world) return <>Chargement…</>
  const abj = world.cities.find((c) => c.id === 'abidjan')!
  const from = abj.communes.find((c) => c.id === 'yopougon')!
  const to = abj.communes.find((c) => c.id === 'cocody')!
  // &want=gbaka (woro, compteur): waiting at the roadside for the one chosen.
  const want = q.get('want') as StreetRide | null
  return <RideFlow world={world} req={{ cityId: 'abidjan', from, to, kind: want ? 'street' : 'gnango', want: want ?? undefined, fare: Number(q.get('fare') ?? (want ? 500 : 1500)), party: 1, money: q.has('money') ? Number(q.get('money')) : undefined }} gameMinutes={12 * 60} onBoard={(r, l) => alert(`${l} ${JSON.stringify(r)}`)} onClose={() => undefined} />
}

/** « Y aller » from Yopougon to Cocody (?app=travel): how to go, each with its time and fare. */
function TravelLab() {
  const [world, setWorld] = useState<World | null>(null)
  const [said, setSaid] = useState('')
  useEffect(() => {
    void api.world().then(setWorld)
  }, [])
  if (!world) return <>Chargement…</>
  const sim = { city: 'abidjan', commune: q.get('from') ?? 'yopougon', money: 50000, apps: [], bornAt: 0, gameMinutes: 30 * (world.yearMinutes ?? 525600) } as unknown as Sim
  return (
    <div className="mx-auto max-w-[400px] p-3">
      <TravelCTA world={world} sim={sim} cityId="abidjan" communeId={q.get('to') ?? 'cocody'} onTravel={(_c, _cm, label, ride, fare) => setSaid(`${label} · ${JSON.stringify(ride ?? {})} · ${fare ?? ''}`)} />
      <p className="mt-3 text-sm font-bold">{said}</p>
    </div>
  )
}

/** The cards on their own (?app=cards): every face, the jokers, the backs. Needs nothing. */
function CardsLab() {
  return (
    <div className="flex min-h-screen flex-wrap content-start gap-2 p-3" style={{ background: 'radial-gradient(ellipse at 50% 35%, #12a564, #077a45 60%, #04522e)' }}>
      {Array.from({ length: 54 }, (_, c) => (
        <PlayingCard key={c} c={c} w={c % 13 >= 10 || c >= 52 ? 74 : 60} />
      ))}
      <CardBack w={60} />
      <CardBack w={22} />
    </div>
  )
}

/** 8 américain or les dames at the table (?app=huit|dames&token=…&sim=…), in a phone's frame, against a running API. */
function TableLab({ app }: { app: 'huit' | 'dames' }) {
  const sim = q.get('sim')!
  return (
    <div className="relative mx-auto h-screen w-full max-w-[430px] overflow-hidden bg-[#0f1230]">
      {app === 'huit' ? <HuitSheet simId={sim} onClose={() => {}} onAgain={(npcs, stake) => void api.huitStart(sim, { with: 'npc', npcs, stake }).then(() => location.reload())} /> : <DamesSheet simId={sim} onClose={() => {}} onAgain={(npc, stake) => void api.damesStart(sim, { with: 'npc', npc, stake }).then(() => location.reload())} />}
    </div>
  )
}

function Lab() {
  if (q.get('app') === 'gnango' || q.get('app') === 'ride') return <RideLab />
  if (q.get('app') === 'travel') return <TravelLab />
  if (q.get('app') === 'cards') return <CardsLab />
  // A défi on its own (?app=defi&kind=the|courses|foot|course|combat|arcade[&big][&ia=tournoi-console]), its score not sent anywhere.
  if (q.get('app') === 'defi')
    return (
      <div className="relative mx-auto h-screen w-full max-w-[430px] overflow-hidden short:max-w-none">
        <DefiSheet kind={(q.get('kind') ?? 'the') as 'the'} simId={q.get('sim') ?? 'lab'} big={q.has('big')} interactionId={q.get('ia') ?? undefined} send={async (score) => ({ outcome: { text: `Défi ${score}/100. C'est noté.`, money: 0 } }) as unknown as ActionResult} onClose={() => location.reload()} />
      </div>
    )
  if (q.get('app') === 'huit' || q.get('app') === 'dames') return <TableLab app={q.get('app') as 'huit' | 'dames'} />
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [sim, setSim] = useState<Sim | null>(null)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    void api.sim(q.get('sim')!).then((r) => setSim('sim' in r ? (r as { sim: Sim }).sim : (r as unknown as Sim)))
  }, [])
  const world = { config: { realPhotos: q.has('real') }, cities: [] } as unknown as World
  const app = q.get('app') ?? 'gbairai'
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 3, 7], fov: 50 }}>
          <color attach="background" args={['#a9d3f0']} />
          <hemisphereLight args={['#ffffff', '#b8a27c', 1.3]} />
          <Snapper />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[40, 40]} />
            <meshLambertMaterial color="#b98b5c" />
          </mesh>
          <StreetStall stall={{ id: 'garba:lab:1', kind: 'garba', at: [0, -1], rot: 0, seed: 0.4 }} hour={12} crowd />
        </Canvas>
      </div>
      <div className="relative m-4 flex w-[380px] flex-col overflow-hidden rounded-[36px] bg-white">
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-6">{sim ? app === 'bet225' || app === 'parisfoot' ? <BetApp sim={sim} act={async (_l, _i, _k, call) => (await call(), true)} app={app} /> : app === 'tikitoko' ? <TikitokoApp sim={sim} act={async (_l, _i, _k, call) => (await call(), true)} onClose={() => history.back()} /> : <GbairaiApp world={world} sim={sim} /> : 'Chargement…'}</div>
      </div>
      {/* ?app=babigram: full screen over the lab, the 3D still behind it for « Photo du jeu ». */}
      {sim && app === 'babigram' && <BabigramApp sim={sim} act={async (_l, _i, _k, call) => (await call(), true)} stories onClose={() => history.back()} />}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Lab />)
