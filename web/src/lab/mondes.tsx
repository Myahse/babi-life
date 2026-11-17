import { createRoot } from 'react-dom/client'
import '../index.css'
import type { Sim } from '../lib/types'
import { Bapteme } from '../components/Bapteme'
import { MomentScene } from '../components/Famille'
import { CoucouDefi, CubesDefi, HochetDefi, PasDefi } from '../components/defi/Bebe'
import { CirculationDefi } from '../components/defi/Circulation'
import { ChauvesSourisDefi } from '../components/defi/ChauvesSouris'
import { JeuMeProvider } from '../components/defi/jeux/me'

// Dev only (mondes.html?s=…): the story and world scenes of « mini-jeux réalistes » phase 2 mounted
// alone, to compare them shut and open (the other scenes are on gestes.html).

const q = new URLSearchParams(location.search)
const s = q.get('s') ?? 'bapteme'
const LOOK = { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'casual', outfitColor: '#ff7a00', body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', marks: 'none', wear: 'neuf' } as never
const SIM = { id: 'lab-mondes', firstName: 'Kouadio', gender: 'homme', family: 'poignon', look: LOOK, friends: [] } as unknown as Sim
const done = (n: number) => console.log('score', n)
const none = () => undefined

function Scene() {
  if (s === 'bapteme') return <Bapteme sim={SIM} onResult={none} onEnd={none} />
  if (s === 'anniv') return <MomentScene sim={SIM} scene={{ kind: 'party', who: 'self', name: 'Kouadio', stage: 'adulte', years: 30, at: 0 }} call={async () => null} onEnd={none} />
  if (s === 'adieu') return <MomentScene sim={SIM} scene={{ kind: 'farewell', f: { name: 'Mamie', gender: 'femme', gone: true } as never }} call={async () => null} onEnd={none} />
  if (s === 'circulation') return <CirculationDefi onEnd={done} />
  if (s === 'chauves') return <ChauvesSourisDefi onEnd={done} />
  const me = { look: LOOK, gender: 'homme' as const }
  if (s === 'coucou') return <CoucouDefi onEnd={done} me={me as never} />
  if (s === 'cubes') return <CubesDefi onEnd={done} me={me as never} />
  if (s === 'pas') return <PasDefi onEnd={done} me={me as never} />
  if (s === 'hochet') return <HochetDefi onEnd={done} me={me as never} />
  return null
}

createRoot(document.getElementById('root')!).render(
  <JeuMeProvider me={{ look: LOOK, gender: 'homme' }}>
    <Scene />
  </JeuMeProvider>,
)
