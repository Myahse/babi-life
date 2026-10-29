import { createRoot } from 'react-dom/client'
import '../index.css'
import { GarbaDefi } from '../components/defi/Garba'
import { AllocoDefi } from '../components/defi/Alloco'
import { BarDefi } from '../components/defi/Bar'
import { DodoDefi, ReveDefi } from '../components/defi/Reve'
import { GestesDefi } from '../components/defi/Gestes'

// A lab page for the played actions (components/defi/*): ?g=garba|alloco|bar|reve|dodo|douche|caca, over
// a stand-in for the scene behind (no game, no server): to look at them and play them alone.
const g = new URLSearchParams(location.search).get('g') ?? 'garba'
const done = (s: number, extra?: string | boolean) => {
  document.title = `score ${s} ${extra ?? ''}`
  document.body.dataset.score = String(s)
}
const scene = g === 'reve' || g === 'dodo' ? '#2a2140' : g === 'bar' ? 'linear-gradient(#3b2414, #1a0f08)' : 'linear-gradient(#cfa77a, #8a5a32)'
createRoot(document.getElementById('root')!).render(
  <div style={{ position: 'fixed', inset: 0, background: scene }}>
    {g === 'garba' ? <GarbaDefi onEnd={done} /> : g === 'alloco' ? <AllocoDefi onEnd={done} /> : g === 'bar' ? <BarDefi money={20000} onEnd={done} /> : g === 'reve' ? <ReveDefi onEnd={done} /> : g === 'dodo' ? <DodoDefi onEnd={done} /> : <GestesDefi kind={g as 'douche'} onEnd={done} />}
  </div>,
)
