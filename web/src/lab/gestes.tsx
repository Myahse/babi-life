import { createRoot } from 'react-dom/client'
import '../index.css'
import { GarbaDefi } from '../components/defi/Garba'
import { AllocoDefi } from '../components/defi/Alloco'
import { BarDefi } from '../components/defi/Bar'
import { DodoDefi, ReveDefi } from '../components/defi/Reve'
import { GestesDefi } from '../components/defi/Gestes'

// A lab page for the played actions (components/defi/*): ?g=garba|alloco|bar|reve|dodo|douche|caca, over
// a stand-in for the scene behind (no game, no server): to look at them and play them alone.
const LOOK = { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'casual', outfitColor: '#ff7a00', body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', marks: 'none', wear: 'neuf' } as never
const g = new URLSearchParams(location.search).get('g') ?? 'garba'
const done = (s: number, extra?: string | boolean) => {
  document.title = `score ${s} ${extra ?? ''}`
  document.body.dataset.score = String(s)
}
const scene = g === 'reve' || g === 'dodo' ? '#2a2140' : g === 'bar' ? 'linear-gradient(#3b2414, #1a0f08)' : 'linear-gradient(#cfa77a, #8a5a32)'
createRoot(document.getElementById('root')!).render(
  <div style={{ position: 'fixed', inset: 0, background: scene }}>
    {g === 'garba' ? <GarbaDefi onEnd={done} /> : g === 'alloco' ? <AllocoDefi onEnd={done} /> : g === 'bar' ? <BarDefi money={20000} onEnd={done} /> : g === 'reve' ? <ReveDefi look={LOOK} onEnd={done} /> : g === 'dodo' ? <DodoDefi look={LOOK} onEnd={done} /> : <GestesDefi kind={g as 'douche'} look={LOOK} onEnd={done} />}
  </div>,
)
