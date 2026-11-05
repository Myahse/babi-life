import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { api, type PvpGameId } from '../lib/api'
import { useSession } from '../store/session'
import type { Sim } from '../lib/types'
import { PVP_IN } from '../lib/live'
import { PvpLayer } from '../components/pvp/PvpLayer'
import { HuitSheet } from '../components/Huit'
import { DamesSheet } from '../components/Dames'
import TableFaces, { tableMood, type TableMood } from '../components/table/Faces'
import { Die } from '../components/table/Die'
import { GodeApp } from '../screens/GodeApp'
import { LudoApp } from '../screens/LudoApp'
import { AwaleApp } from '../screens/AwaleApp'

// The table games on their own (tables.html), a lab for trying them and filming them, not part of the game:
// ?view=faces&n=3&mood=think&playing=Koffi  the people across a table (components/table/Faces.tsx)
// ?view=die                                  the die, thrown on a tap
// ?view=pvp&token=…&sim=…&name=…&game=awale  one player's side of a game against a player (PvpLayer), against a running API
// ?view=table&app=huit|dames&token=…&sim=…   8 américain or les dames at the table, against a running API
// ?view=gode&token=…&sim=…                  le godé against the man of the maquis, against a running API (an adult account)
// ?view=ludo|awale&token=…&sim=…            Ludo or the awalé against the computer, the player's own Sim at the table
// (&me=1 on view=faces: the player's own Sim at the end of the row)

const q = new URLSearchParams(location.search)
const view = q.get('view')
const token = q.get('token')
if (token) useSession.setState({ token })

/** The player's Sim, its look and all, from the API (the lab's own player). */
function useLabSim() {
  const [sim, setSim] = useState<Sim | null>(null)
  useEffect(() => {
    const id = q.get('sim')
    if (id) void api.sim(id).then((r) => setSim({ ...(r as unknown as { sim: Sim }).sim, money: 100000 }), () => undefined)
  }, [])
  return sim
}

function Faces() {
  const names = ['Tantie Aya', 'Koffi', 'Mariam', 'Le vieux Kouamé'].slice(0, Number(q.get('n') ?? 1))
  useEffect(() => {
    const t = setTimeout(() => names.forEach((n) => tableMood(n, (q.get('mood') ?? 'calm') as TableMood, 60000)), 500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto max-w-[420px] bg-[#8a5a2b] p-3">
      <TableFaces people={names.map((n) => ({ id: n, name: n }))} me={q.get('me') ? { name: 'Awa', gender: 'femme' } : undefined} myTurn={q.get('playing') === 'me'} playing={q.get('playing')} height={Number(q.get('h') ?? 90)} />
    </div>
  )
}

function DieLab() {
  const [n, setN] = useState(0)
  const [v, setV] = useState(6)
  return (
    <button className="grid h-screen w-full place-items-center bg-[#0b6b3a]" onClick={() => (setV(1 + Math.floor(Math.random() * 6)), setN(n + 1))}>
      <Die value={v} roll={n} size={90} />
    </button>
  )
}

function Pvp() {
  const [sim, setSim] = useState(() => ({ id: q.get('sim')!, firstName: q.get('name') ?? 'Awa' }) as unknown as Sim)
  useEffect(() => {
    // The Sim's own look and gender (a game played with its own avatar, Adjamé Storm 4's « Toi »).
    void api
      .sim(sim.id)
      .then((r) => setSim((s) => ({ ...s, ...r.sim })))
      .catch(() => undefined)
    const game = q.get('game') as PvpGameId | null
    if (game) void api.pvpQueue(sim.id, game).then(() => window.dispatchEvent(new Event(PVP_IN)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative mx-auto h-screen w-full max-w-[430px] overflow-hidden">
      <PvpLayer sim={sim} token={token} on stage="adulte" onBoard={() => undefined} onAI={() => undefined} />
    </div>
  )
}

function Table() {
  const sim = q.get('sim')!
  const me = useLabSim()
  return (
    <div className="relative mx-auto h-screen w-full max-w-[430px] overflow-hidden">
      {q.get('app') === 'huit' ? <HuitSheet simId={sim} me={me ? { name: me.firstName, look: me.look, gender: me.gender } : undefined} onClose={() => undefined} onAgain={(npcs, stake) => void api.huitStart(sim, { with: 'npc', npcs, stake }).then(() => location.reload())} /> : <DamesSheet simId={sim} me={me ? { name: me.firstName, look: me.look, gender: me.gender } : undefined} onClose={() => undefined} onAgain={(npc, stake) => void api.damesStart(sim, { with: 'npc', npc, stake }).then(() => location.reload())} />}
    </div>
  )
}

function Gode() {
  const sim = useLabSim()
  useState(() => useSession.setState((s) => ({ ...s, user: { ...(s.user ?? {}), adult: true } as never })))
  if (!sim) return null
  return (
    <div className="mx-auto h-screen max-w-[430px] overflow-y-auto bg-white px-3 pt-1">
      <GodeApp sim={sim} act={async (_l, _i, _k, call) => (await call(), true)} onConfirmAdult={async () => undefined} />
    </div>
  )
}

function Board() {
  const sim = useLabSim()
  if (!sim) return null
  return <div className="mx-auto h-screen max-w-[430px] overflow-y-auto bg-white px-3 pt-1">{view === 'ludo' ? <LudoApp sim={sim} /> : <AwaleApp sim={sim} />}</div>
}

createRoot(document.getElementById('root')!).render(view === 'faces' ? <Faces /> : view === 'die' ? <DieLab /> : view === 'pvp' ? <Pvp /> : view === 'gode' ? <Gode /> : view === 'ludo' || view === 'awale' ? <Board /> : <Table />)
