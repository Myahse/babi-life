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

// The table games on their own (tables.html), a lab for trying them and filming them, not part of the game:
// ?view=faces&n=3&mood=think&playing=Koffi  the people across a table (components/table/Faces.tsx)
// ?view=die                                  the die, thrown on a tap
// ?view=pvp&token=…&sim=…&name=…&game=awale  one player's side of a game against a player (PvpLayer), against a running API
// ?view=table&app=huit|dames&token=…&sim=…   8 américain or les dames at the table, against a running API

const q = new URLSearchParams(location.search)
const view = q.get('view')
const token = q.get('token')
if (token) useSession.setState({ token })

function Faces() {
  const names = ['Tantie Aya', 'Koffi', 'Mariam', 'Le vieux Kouamé'].slice(0, Number(q.get('n') ?? 1))
  useEffect(() => {
    const t = setTimeout(() => names.forEach((n) => tableMood(n, (q.get('mood') ?? 'calm') as TableMood, 60000)), 500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto max-w-[420px] bg-[#8a5a2b] p-3">
      <TableFaces people={names.map((n) => ({ id: n, name: n }))} playing={q.get('playing')} height={Number(q.get('h') ?? 90)} />
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
  const sim = { id: q.get('sim')!, firstName: q.get('name') ?? 'Awa' } as unknown as Sim
  useEffect(() => {
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
  return (
    <div className="relative mx-auto h-screen w-full max-w-[430px] overflow-hidden">
      {q.get('app') === 'huit' ? <HuitSheet simId={sim} onClose={() => undefined} onAgain={(npcs, stake) => void api.huitStart(sim, { with: 'npc', npcs, stake }).then(() => location.reload())} /> : <DamesSheet simId={sim} onClose={() => undefined} onAgain={(npc, stake) => void api.damesStart(sim, { with: 'npc', npc, stake }).then(() => location.reload())} />}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(view === 'faces' ? <Faces /> : view === 'die' ? <DieLab /> : view === 'pvp' ? <Pvp /> : <Table />)
