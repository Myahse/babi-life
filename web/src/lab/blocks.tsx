import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Look } from '../lib/types'
import { BlockBaby, BlockHuman } from '../avatar/BlockHuman'
import { LowHuman } from '../avatar/LowHuman'
import type { Pose } from '../avatar/Human'
import { ACCESSORIES, BEARDS, DEFAULT_LOOK, FEMME_OUTFITS, HAIRS, OUTFIT_DEFAULT_COLOR, OUTFITS, PATTERNS } from '../avatar/options'
import { NoteShower } from '../world3d/money'

// Dev-only lab (/lab.html): a row of blocky Sims, one per outfit, hair and
// accessory, to check them side by side. ?pose=walk sets everyone's pose,
// ?face zooms on the heads, ?row=2 shows the second row of looks;
// ?pose=throw shows the travaillement, notes and all; ?far shows the
// low-detail Sims seen from afar, ?baby the babies in the same looks;
// ?all=outfits|hairs|accessories|beards|patterns&row=n lays out every
// choice, six at a time.

const q = new URLSearchParams(location.search)
const pose = (q.get('pose') ?? 'idle') as Pose
const face = q.has('face')
const row = Number(q.get('row') ?? 0)
const far = q.has('far')
const baby = q.has('baby')
const all = q.get('all')

/** Every choice of one kind, on a Sim each, for ?all=. */
function everyChoice(kind: string): Sample[] {
  const skins = ['#6e4024', '#a46c42', '#583119', '#8a5532']
  switch (kind) {
    case 'outfits':
      return OUTFITS.map((o, i) => L({ outfit: o.id, hair: i % 2 ? 'short' : 'braids', accessory: 'none', skin: skins[i % 4], outfitColor: OUTFIT_DEFAULT_COLOR[o.id] ?? ['#ff7a00', '#7b5cff', '#00a862', '#d6336c', '#0f9d8a', '#c9a227'][i % 6] }, FEMME_OUTFITS.has(o.id) || i % 2 === 0 ? 'femme' : 'homme'))
    case 'hairs':
      return HAIRS.map((h, i) => L({ hair: h.id, outfit: 'casual', accessory: 'none', outfitColor: '#2a6cf0', skin: skins[i % 4] }, ['degrade', 'mohawk', 'short', 'bald'].includes(h.id) ? 'homme' : 'femme'))
    case 'accessories':
      return ACCESSORIES.map((a, i) => L({ accessory: a.id, hair: 'short', outfit: 'casual', outfitColor: ['#00a862', '#f4efe6', '#d6336c', '#74c0fc'][i % 4], skin: skins[i % 4] }, a.id === 'earrings' || a.id === 'beads' ? 'femme' : 'homme'))
    case 'beards':
      return BEARDS.map((b, i) => L({ beard: b.id, hair: 'short', outfit: 'chemise', accessory: 'none', skin: skins[i % 4] }))
    default:
      return PATTERNS.map((pt, i) => L({ outfit: 'pagne', pattern: pt.id, hair: 'headwrap', accessory: 'none', outfitColor: ['#ff7a00', '#2a6cf0', '#00a862', '#d6336c'][i % 4] }, 'femme'))
  }
}

type Sample = { look: Partial<Look>; gender: 'femme' | 'homme'; headScale?: number; scale?: number }
const L = (look: Partial<Look>, gender: 'femme' | 'homme' = 'homme', extra: Partial<Sample> = {}): Sample => ({ look, gender, ...extra })

const ROWS: Sample[][] = [
  [
    L({ outfit: 'pagne', hair: 'headwrap', accessory: 'earrings', pattern: 'cercles', outfitColor: '#ff7a00' }, 'femme'),
    L({ outfit: 'boubou', hair: 'short', accessory: 'none', beard: 'full', outfitColor: '#2a6cf0', skin: '#583119' }),
    L({ outfit: 'casual', hair: 'afro', accessory: 'glasses', outfitColor: '#d6336c', skin: '#a46c42' }),
    L({ outfit: 'robe', hair: 'bun', accessory: 'chain', pattern: 'losanges', outfitColor: '#7b5cff', body: 'mince' }, 'femme'),
    L({ outfit: 'suit', hair: 'bald', accessory: 'none', beard: 'bouc', outfitColor: '#1f2a44', body: 'fort' }),
    L({ outfit: 'jersey', hair: 'short', accessory: 'cap', outfitColor: '#ff8200', marks: 'bagarre' }),
  ],
  [
    L({ outfit: 'debardeur', hair: 'locks', accessory: 'chain', outfitColor: '#f8f9fa', body: 'rond', marks: 'genou' }),
    L({ outfit: 'survet', hair: 'braids', outfitColor: '#00a862', hairColor: '#5a3418' }, 'femme'),
    L({ outfit: 'basket', hair: 'short', accessory: 'capback', outfitColor: '#1d428a', beard: 'moustache' }),
    L({ outfit: 'pagne', hair: 'weave', pattern: 'feuilles', outfitColor: '#00a862', eyes: '#2b4466', body: 'rond' }, 'femme'),
    L({ outfit: 'pagne', hair: 'short', accessory: 'none', pattern: 'rayures', outfitColor: '#b02e0c', body: 'fort' }),
    L({ outfit: 'casual', hair: 'afro', accessory: 'none', outfitColor: '#f2b705' }, 'homme', { headScale: 1.2, scale: 0.62 }),
  ],
]

function Lab() {
  // ?all=…&page=n: six at a time, in one row.
  const samples = all ? everyChoice(all).slice(row * 6, row * 6 + 6) : (ROWS[row] ?? ROWS[0])
  const gap = 0.9
  const perRow = samples.length
  const x0 = (-(Math.min(perRow, samples.length) - 1) * gap) / 2
  return (
    <Canvas shadows dpr={[1, 2]} style={{ width: '100vw', height: '100vh' }} camera={face ? { position: [0, 1.6, 3.6], fov: 32 } : { position: [0, 1.4, 6.2], fov: 38 }}>
      <color attach="background" args={['#f3e9dc']} />
      <hemisphereLight args={['#fff4e6', '#c0704f', 1.2]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.9} color="#ffd1a6" />
      <ambientLight intensity={0.45} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshLambertMaterial color="#e6d3bd" />
      </mesh>
      {samples.map((s, i) => (
        <group key={i} position={[x0 + (i % perRow) * gap, 0, -Math.floor(i / perRow) * 1.6]} scale={s.scale ?? 1}>
          {baby ? (
            <BlockBaby look={{ ...DEFAULT_LOOK, ...s.look }} gender={s.gender} pose={pose} seed={i} />
          ) : far ? (
            <LowHuman look={{ ...DEFAULT_LOOK, ...s.look }} gender={s.gender} pose={pose} seed={i} speed={pose === 'run' ? 6 : 1.4} />
          ) : (
            <BlockHuman look={{ ...DEFAULT_LOOK, ...s.look }} gender={s.gender} pose={pose} seed={i} headScale={s.headScale} speed={pose === 'run' ? 6 : 1.4} />
          )}
          {pose === 'throw' && <NoteShower from={[0.3, 1.72, 0.3]} toward={[0, 0.35, 1]} seed={i} />}
        </group>
      ))}
      <OrbitControls target={face ? [0, 1.5, 0] : [0, 0.9, 0]} />
    </Canvas>
  )
}

createRoot(document.getElementById('root')!).render(<Lab />)
