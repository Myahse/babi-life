import { createRoot } from 'react-dom/client'
import '../index.css'
import { GarbaDefi } from '../components/defi/Garba'
import { AllocoDefi } from '../components/defi/Alloco'
import { BarDefi } from '../components/defi/Bar'
import { DodoDefi, ReveDefi } from '../components/defi/Reve'
import { GestesDefi } from '../components/defi/Gestes'
import { TripLoading } from '../components/TripLoading'
import { DoucheJeu } from '../components/defi/Douche'
import { JeuDefi, JEUX } from '../components/defi/jeux'
import { PropsGallery } from './PropsGallery'
import type { Jeu } from '../components/defi/jeux/types'
import { demo as demoChoisir } from '../components/defi/jeux/engines/Choisir'
import { demo as demoAttraper } from '../components/defi/jeux/engines/Attraper'
import { demo as demoNettoyer } from '../components/defi/jeux/engines/Nettoyer'
import { demo as demoRythme } from '../components/defi/jeux/engines/Rythme'
import { demo as demoTenir } from '../components/defi/jeux/engines/Tenir'
import { demo as demoViser } from '../components/defi/jeux/engines/Viser'
import { demo as demoCourse } from '../components/defi/jeux/engines/Course'
import { demo as demoQuiz } from '../components/defi/jeux/engines/Quiz'
import { demo as demoPhoto } from '../components/defi/jeux/engines/Photo'
import { demo as demoAssembler } from '../components/defi/jeux/engines/Assembler'
import { demo as demoEquilibre } from '../components/defi/jeux/engines/Equilibre'
import { demo as demoRepondre } from '../components/defi/jeux/engines/Repondre'

// A lab page for the played actions (components/defi/*): ?g=garba|alloco|bar|reve|dodo|douche|caca, an
// action's own game ?g=jeu:<id> (jeux/configs), an engine's demo ?g=demo:<engine> (jeux/engines), over
// a stand-in for the scene behind (no game, no server): to look at them and play them alone.
const LOOK = { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'casual', outfitColor: '#ff7a00', body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', marks: 'none', wear: 'neuf' } as never
const g = new URLSearchParams(location.search).get('g') ?? 'garba'
const done = (s: number, extra?: string | boolean) => {
  document.title = `score ${s} ${extra ?? ''}`
  document.body.dataset.score = String(s)
}
const DEMOS: Record<string, Jeu | null> = { choisir: demoChoisir, attraper: demoAttraper, nettoyer: demoNettoyer, rythme: demoRythme, tenir: demoTenir, viser: demoViser, course: demoCourse, quiz: demoQuiz, photo: demoPhoto, assembler: demoAssembler, equilibre: demoEquilibre, repondre: demoRepondre }
const scene = g === 'reve' || g === 'dodo' ? '#2a2140' : g === 'bar' ? 'linear-gradient(#3b2414, #1a0f08)' : 'linear-gradient(#cfa77a, #8a5a32)'
createRoot(document.getElementById('root')!).render(
  <div style={{ position: 'fixed', inset: 0, background: scene }}>
    {g === 'laver' ? <DoucheJeu look={LOOK} onEnd={done} /> : g.startsWith('props') ? <PropsGallery from={Number(g.split(':')[1]?.split('-')[0] ?? 0)} to={g.includes(':') ? Number(g.split('-')[1]) : undefined} /> : g.startsWith('demo:') ? <JeuDefi act={{ id: '', icon: '', label: '' }} jeu={DEMOS[g.slice(5)] ?? undefined} onEnd={done} /> : g.startsWith('jeu:') ? <JeuDefi act={{ id: g.slice(4), icon: '', label: g.slice(4) }} jeu={JEUX[g.slice(4)]} onEnd={done} /> : g.startsWith('act:') ? <GestesDefi kind="geste" act={{ id: g.slice(4), icon: '' }} look={LOOK} onEnd={done} /> : g === 'taxi' || g === 'gbaka' || g === 'woro' || g === 'moto' ? <TripLoading mode={g} to="Yopougon" look={LOOK} onDone={() => done(100)} /> : g === 'garba' ? <GarbaDefi onEnd={done} /> : g === 'alloco' ? <AllocoDefi onEnd={done} /> : g === 'bar' ? <BarDefi money={20000} onEnd={done} /> : g === 'reve' ? <ReveDefi look={LOOK} onEnd={done} /> : g === 'dodo' ? <DodoDefi look={LOOK} scenes onEnd={done} /> : <GestesDefi kind={g as 'douche'} look={LOOK} scenes onEnd={done} />}
  </div>,
)
