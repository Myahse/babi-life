import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Bath, Check, Heart, Milk, Moon, Sparkles, Volume2 } from 'lucide-react'
import type { Look, Sim } from '../lib/types'
import { DEFAULT_LOOK, randomLook } from '../avatar/options'
import { Human, type Pose } from '../avatar/Human'
import { Character } from '../world3d/Character'
import { Pram } from '../world3d/Pram'
import { babyCare } from '../world3d/HomeInside'
import { ActionProps } from '../world3d/interior/ActionProps'
import { Box } from '../world3d/props'
import { rng } from '../world3d/themes'
import { BaptemeSet } from '../components/Bapteme'
import { Bedroom } from '../components/defi/combat/Scene'
import { iconFor } from '../components/icons'

// « Tout ce que ton bébé peut faire » (FILM=bebe, marketing/scripts/bebe.md):
// the baby's things in the game, one by one, drawn here frame by frame at
// t seconds into each shot (lab/poster.tsx films them): its scenes in 3D
// (the house with maman, the baptism, the cousins' fight, the crèche, the
// pram, growing up) and, over them, the game's own screens being played (the
// gauges, the four little games, the « premières fois », the choices).

export type BebeScreen = 'soins' | 'pleure' | 'bapteme' | 'coucou' | 'cubes' | 'pas' | 'hochet' | 'bagarre' | 'firsts' | 'talent' | 'mot' | 'creche' | 'balade' | 'grandit'

const L = (l: Partial<Look>): Look => ({ ...DEFAULT_LOOK, ...l })
/** The film's baby: a little boy of a poignon family, his grenouillère, his tétine. */
const BEBE = L({ skin: '#8a5532', hair: 'short', outfit: 'grenouillere', outfitColor: '#ffd43b', accessory: 'tetine' })
const SIM = { id: 'film-bebe', firstName: 'Kouadio', gender: 'homme', family: 'poignon', look: BEBE } as unknown as Sim

const clamp01 = (k: number) => Math.max(0, Math.min(1, k))
const ease = (k: number) => k * k * (3 - 2 * k)

function Cam({ at, look }: { at: [number, number, number]; look: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  camera.position.set(...at)
  camera.lookAt(...look)
  return null
}

function Lights({ warm = true }: { warm?: boolean }) {
  return (
    <>
      <hemisphereLight args={[warm ? '#fff6e6' : '#fff4e6', '#b98a5a', 1.2]} />
      <directionalLight position={[3, 7, 6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={0.45} />
    </>
  )
}

/** The family's salon: the tiled floor, the pale walls, the play mat. */
function Room() {
  return (
    <>
      <color attach="background" args={['#f3e2a9']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshLambertMaterial color="#e9e4d8" />
      </mesh>
      <Box p={[0, 1.6, -2.4]} s={[14, 3.2, 0.1]} c="#f3e2a9" />
      <Box p={[0, 0.5, -2.34]} s={[14, 1, 0.02]} c="#74c0fc" />
      <Box p={[0, 0.015, 0.1]} s={[2.2, 0.03, 1.6]} c="#ff8fb1" />
      {/* The sofa behind, a little plant */}
      <Box p={[-1.8, 0.3, -1.8]} s={[2, 0.6, 0.8]} c="#7048e8" />
      <Box p={[-1.8, 0.75, -2.15]} s={[2, 0.6, 0.15]} c="#7048e8" />
      <Box p={[2.2, 0.35, -1.9]} s={[0.4, 0.7, 0.4]} c="#a0522d" />
      <mesh position={[2.2, 1.0, -1.9]}>
        <sphereGeometry args={[0.45, 12, 10]} />
        <meshLambertMaterial color="#2f9e44" />
      </mesh>
    </>
  )
}

/** What the baby does with maman in each shot (ActionProps' scenes, as in the game). */
const SOINS = ['biberon', 'bain-bebe', 'calin'] as const

/** One scene of the film, at t seconds into its shot. */
export function BebeWorld({ scene, t }: { scene: string; t: number }) {
  const care = useMemo(() => babyCare('poignon', BEBE), [])
  if (scene.startsWith('bebe:')) {
    // At home, the baby on its mat and maman with it: the soins one after the other, or the game being played.
    const what = scene.slice(5)
    const id = what === 'soins' ? SOINS[Math.min(2, Math.floor(t / 2))] : what
    const cry = id === 'pleurer'
    return (
      <>
        <Lights />
        <Room />
        <Cam at={[1.3 + Math.sin(t * 0.25) * 0.3, 1.7, 4.4 - t * 0.06]} look={[0, 0.35, 0]} />
        <Character look={BEBE} gender="homme" stage="bebe" pose={cry ? 'cry' : 'busy'} marker={false} seed={1} />
        <ActionProps id={id} kind="house" lying={false} stage="bebe" mum={care.mum} carer={care.carer} nappy={care.nappy} />
      </>
    )
  }
  if (scene === 'bebe-bapteme') {
    const a = 0.2 + Math.sin(t * 0.25) * 0.5
    return (
      <>
        <color attach="background" args={['#f7d9a8']} />
        <Cam at={[Math.sin(a) * 6.4, 2.6, Math.cos(a) * 6.4]} look={[0, 0.8, 0]} />
        <BaptemeSet sim={SIM} line={t > 2.2 ? 2 : 0} />
      </>
    )
  }
  if (scene === 'bebe-bagarre') return <Fight t={t} />
  if (scene === 'bebe-creche') return <Creche t={t} />
  if (scene === 'bebe-balade') return <Balade t={t} />
  if (scene === 'bebe-grandit') return <Grandit t={t} />
  return null
}

/** The cousins after the toy: the street fight's moves, as babies, in the bedroom. */
const MOVES: Pose[] = ['fstance', 'jab', 'cross', 'fstance', 'highkick', 'fblock', 'uppercut', 'fhit']
function Fight({ t }: { t: number }) {
  const cousin = useMemo(() => L({ skin: '#5b3620', outfit: 'grenouillere', outfitColor: '#74c0fc', accessory: 'tetine', height: 0.78 }), [])
  const me = useMemo(() => ({ ...BEBE, height: 0.78 }), [])
  const k = Math.floor(t / 0.55)
  const mine = MOVES[k % MOVES.length]
  const theirs = MOVES[(k + 4) % MOVES.length]
  const gap = 0.75 + Math.sin(t * 1.3) * 0.15
  return (
    <>
      <color attach="background" args={['#3a2a4a']} />
      <Lights />
      <Bedroom />
      <Cam at={[0.3, 1.7, 5.8]} look={[0, 0.9, 0]} />
      <group position={[-gap, 0, 0.3]} rotation={[0, Math.PI / 2, 0]} scale={[-1, 1, 1]}>
        <Human look={me} gender="homme" pose={mine} take={k} seed={3} full headScale={1.5} fitted />
      </group>
      <group position={[gap, 0, 0.3]} rotation={[0, -Math.PI / 2, 0]}>
        <Human look={cousin} gender="homme" pose={theirs} take={k} seed={9} full headScale={1.5} fitted />
      </group>
      {/* The family round, clapping */}
      {[-2.6, -1.4, 1.4, 2.6].map((x, i) => (
        <group key={x} position={[x, 0, -1.6]}>
          <Human look={{ ...randomLook(i % 2 ? 'homme' : 'femme', rng(`fam${i}`)), outfit: i % 2 ? 'boubou' : 'pagne', accessory: 'none' }} gender={i % 2 ? 'homme' : 'femme'} pose={i % 2 ? 'cheer' : 'clap'} seed={20 + i} />
        </group>
      ))}
    </>
  )
}

/** The crèche: the mats and the toys, the nounou, the baby among the other players' babies (their pins in blue). */
function Creche({ t }: { t: number }) {
  const babies = useMemo(() => [0, 1, 2, 3].map((i) => ({ ...randomLook(i % 2 ? 'femme' : 'homme', rng(`creche${i}`)), outfit: ['body', 'robe-bebe', 'salopette-bebe', 'grenouillere'][i], accessory: i === 1 ? 'bonnet-bebe' : 'none', beard: 'none' }) as Look), [])
  const nounou = useMemo(() => ({ ...randomLook('femme', rng('nounou')), outfit: 'blouse', outfitColor: '#f783ac', accessory: 'none' }) as Look, [])
  return (
    <>
      <color attach="background" args={['#ffe8a8']} />
      <Lights />
      <Cam at={[2.2 + Math.sin(t * 0.2) * 0.4, 2.4, 3.6]} look={[0, 0.3, 0.2]} />
      <Box p={[0, -0.05, 0]} s={[9, 0.1, 8]} c="#f3e7d3" />
      <Box p={[0, 1.4, -2.6]} s={[9, 2.8, 0.1]} c="#ffe8a8" />
      {[
        ['#ff8fb1', -1.1, 0],
        ['#74c0fc', 1.0, 0.3],
        ['#8ce99a', 0, 1.6],
      ].map(([c, x, z]) => (
        <Box key={c as string} p={[x as number, 0.02, z as number]} s={[1.8, 0.04, 1.4]} c={c as string} />
      ))}
      {['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c'].map((c, i) => (
        <Box key={c} p={[0.3 + (i % 2) * 0.22, 0.1 + Math.floor(i / 2) * 0.2, 0.9]} s={[0.2, 0.2, 0.2]} c={c} />
      ))}
      <group position={[-1.1, 0.04, 0.1]}>
        <Character look={BEBE} gender="homme" stage="bebe" pose="busy" marker={false} seed={1} />
      </group>
      {babies.map((l, i) => (
        <group key={i} position={[[-0.3, 0.9, 0.2, 1.3][i], 0.04, [0.5, 0.2, 1.5, 1.3][i]]} rotation={[0, Math.PI + i, 0]}>
          <Character look={l} gender={i % 2 ? 'femme' : 'homme'} stage="bebe" pose={i % 2 ? 'clap' : 'busy'} moodColor="#3b82f6" seed={20 + i} />
        </group>
      ))}
      <group position={[-1.6, 0, 0.9]} rotation={[0, Math.PI * 0.8, 0]}>
        <Human look={nounou} gender="femme" pose="pray" seed={11} />
      </group>
    </>
  )
}

/** Out in the pram: maman pushing, and another player's baby passing the other way (its pin in blue). */
function Balade({ t }: { t: number }) {
  const other = useMemo(() => ({ look: { ...randomLook('femme', rng('autre-bebe')), outfit: 'robe-bebe', accessory: 'bonnet-bebe', beard: 'none' } as Look, gender: 'femme' as const, family: 'late' }), [])
  const z = -2.5 + t * 0.55
  return (
    <>
      <color attach="background" args={['#a9d3f0']} />
      <Lights warm={false} />
      <Cam at={[2.6, 1.6, 2.6 + t * 0.2]} look={[0, 0.7, t * 0.25]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshLambertMaterial color="#c9a27a" />
      </mesh>
      {[-1, 1].map((side) =>
        [...Array(7)].map((_, i) => (
          <mesh key={`${side}${i}`} position={[side * 3.6, 1.4, -12 + i * 4]} castShadow>
            <boxGeometry args={[1.6, 2.8, 3.4]} />
            <meshLambertMaterial color={['#f3e2a9', '#f8f9fa', '#ffd8a8', '#c3e6cb'][(i + (side > 0 ? 2 : 0)) % 4]} />
          </mesh>
        )),
      )}
      <group position={[-0.6, 0, z]}>
        <Pram sim={SIM} walking speed={1.1} />
      </group>
      <group position={[0.8, 0, 4 - t * 0.55]} rotation={[0, Math.PI, 0]}>
        <Pram sim={other} walking speed={1.1} other moodColor="#3b82f6" />
      </group>
    </>
  )
}

/** Growing up: the same one, baby, child, teen, grown-up, coming one after the other. */
function Grandit({ t }: { t: number }) {
  const looks = useMemo(() => [BEBE, L({ skin: '#8a5532', hair: 'short', outfit: 'uniforme', outfitColor: '#c8b07a', accessory: 'cartable' }), L({ skin: '#8a5532', hair: 'degrade', outfit: 'survet', outfitColor: '#ff7a00' }), L({ skin: '#8a5532', hair: 'degrade', outfit: 'chemise', outfitColor: '#1c7ed6', beard: 'bouc' })], [])
  const stages = ['bebe', 'enfant', 'ado', 'adulte']
  return (
    <>
      <color attach="background" args={['#fff4e6']} />
      <Lights />
      <Cam at={[0, 1.6, 8.6]} look={[0, 1.0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshLambertMaterial color="#c98a52" />
      </mesh>
      {stages.map((st, i) => {
        const k = ease(clamp01((t - 0.4 - i * 1.1) / 0.5))
        if (k <= 0) return null
        return (
          <group key={st} position={[-1.4 + i * 0.95, 0, 0]} scale={[k, k, k]}>
            <Character look={looks[i]} gender="homme" stage={st} pose={i === 0 ? 'busy' : i === 3 ? 'wave' : 'idle'} marker={false} seed={i + 1} />
          </group>
        )
      })}
    </>
  )
}

/* ---------- The game's screens, played ---------- */

/** A phone held up in front of the scene, the game's screen in it. */
function Phone({ children, k = 1 }: { children: React.ReactNode; k?: number }) {
  return (
    <div className="absolute inset-x-0 top-[30%] flex justify-center" style={{ opacity: k, transform: `translateY(${(1 - k) * 60}px)` }}>
      <div className="h-[600px] w-[400px] overflow-hidden rounded-[44px] border-[10px] border-[#16161c] bg-[#16161c] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="relative h-full w-full overflow-hidden rounded-[34px] font-sans">{children}</div>
      </div>
    </div>
  )
}

function GameTop({ title, step, note }: { title: string; step: string; note?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 text-white">
      <div className="leading-tight">
        <div className="font-display text-[16px] font-extrabold text-white/70">{step}</div>
        <div className="font-display text-[22px] font-extrabold">{title}</div>
      </div>
      {note && <div className="rounded-full bg-white/20 px-3 py-1 text-[16px] font-extrabold">{note}</div>}
    </div>
  )
}

function GameButton({ label, down }: { label: string; down?: boolean }) {
  return <div className={`mx-4 mb-5 rounded-2xl py-4 text-center font-display text-[20px] font-extrabold text-white shadow-[0_5px_0_rgba(0,0,0,0.3)] ${down ? 'translate-y-1 bg-[#c2410c]' : 'bg-[var(--color-orange)]'}`}>{label}</div>
}

/** Coucou-caché: maman's hands open, « Coucou ! », the laugh. */
function Coucou({ t }: { t: number }) {
  const c = t % 2.2
  const open = c > 0.9 && c < 1.9
  const laughed = c > 1.15 && c < 1.9
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#ffb3c8] to-[#e64980]">
      <GameTop title="Coucou-caché avec maman" step={`${Math.min(6, 1 + Math.floor(t / 2.2))} / 6`} />
      <div className="relative mx-4 mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-[26px] bg-[#ffe3c2]">
        <div className="relative h-56 w-48">
          <div className="absolute inset-x-6 top-0 h-12 rounded-t-[22px] bg-[#1b1410]" />
          <div className="absolute inset-x-6 top-8 h-40 rounded-[18px] bg-[#8a5532]">
            <div className="absolute top-12 left-6 h-4 w-4 rounded-full bg-white" />
            <div className="absolute top-12 right-6 h-4 w-4 rounded-full bg-white" />
            <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#7a1f2b]" style={open ? { top: 96, height: 32, width: 56 } : { top: 104, height: 8, width: 40 }} />
          </div>
          {[-1, 1].map((s) => (
            <div key={s} className="absolute top-14 h-24 w-20 rounded-[16px] bg-[#a46c42] shadow-lg" style={{ left: s < 0 ? 18 : 94, transform: open ? `translateX(${s * 70}px) rotate(${s * 25}deg)` : 'none' }} />
          ))}
        </div>
        {open && !laughed && <div className="absolute top-6 font-display text-[38px] font-extrabold text-[#e05a00]">Coucou !</div>}
        {laughed && <div className="absolute inset-x-6 bottom-6 rounded-[18px] bg-white/95 p-3 text-center text-[18px] font-extrabold text-[var(--color-ink)]">Éclat de rire ! Maman fond.</div>}
      </div>
      <div className="pt-4">
        <GameButton label="Rire !" down={c > 1.1 && c < 1.25} />
      </div>
    </div>
  )
}

const CUBE_COLORS = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#b197fc', '#ff922b', '#f783ac', '#38d9a9']
/** The tower: each cube dropped near the one under it, a little narrower. */
function Cubes({ t }: { t: number }) {
  const n = Math.min(8, 1 + Math.floor(t / 0.55))
  const stack = [...Array(n)].map((_, i) => ({ x: 25 + Math.sin(i * 1.7) * 3 + i * 0.5, w: 50 - i * 2.5 }))
  const top = stack[stack.length - 1]
  const slide = 50 * (0.5 + 0.5 * Math.sin(t * 5))
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#74c0fc] to-[#1c7ed6]">
      <GameTop title="La tour de cubes" step={`${n} / 8`} note="Touche pour lâcher" />
      <div className="relative mx-4 mt-3 flex-1 overflow-hidden rounded-[26px] bg-[#fff4e8]">
        <div className="absolute inset-x-0 bottom-0 h-6 bg-[#e8c99a]" />
        {stack.map((c, i) => (
          <div key={i} className="absolute rounded-[6px] border-2 border-black/15" style={{ left: `${c.x}%`, width: `${c.w}%`, bottom: 24 + i * 34, height: 34, background: CUBE_COLORS[i % 8] }} />
        ))}
        {n < 8 && <div className="absolute rounded-[6px] border-2 border-black/15" style={{ left: `${slide}%`, width: `${top.w - 2.5}%`, bottom: 24 + n * 34 + 18, height: 34, background: CUBE_COLORS[n % 8] }} />}
      </div>
      <div className="pt-4">
        <GameButton label="Lâcher le cube" down={t % 0.55 < 0.12} />
      </div>
    </div>
  )
}

/** The first steps to papa: the baby wobbling, the needle kept in the green. */
function Pas({ t }: { t: number }) {
  const d = Math.min(100, t * 22)
  const lean = Math.sin(t * 2.6) * 0.35 + Math.sin(t * 5.3) * 0.12
  const there = d >= 100
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#8ce99a] to-[#2f9e44]">
      <GameTop title="Les premiers pas vers papa" step="1 / 1" />
      <div className="relative mx-4 mt-3 flex-1 overflow-hidden rounded-[26px] bg-[#fff4e8]">
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-[#d9b38c]" />
        <div className="absolute right-[6%] bottom-[30%] flex flex-col items-center">
          <div className="h-9 w-9 rounded-[8px] bg-[#6e4024]" />
          <div className="h-16 w-[72px] rounded-[8px] bg-[#2a6cf0]" />
          <div className="text-[14px] font-extrabold text-[var(--color-ink-soft)]">Papa</div>
        </div>
        <div className="absolute bottom-[30%] flex flex-col items-center" style={{ left: `${6 + d * 0.62}%`, transform: `rotate(${there ? 0 : lean * 35}deg)`, transformOrigin: '50% 100%' }}>
          <div className="h-8 w-8 rounded-[7px] bg-[#8a5532]" />
          <div className="h-10 w-10 rounded-[7px] bg-[#ffd43b]" />
        </div>
        <div className="absolute inset-x-8 top-5 h-3.5 rounded-full" style={{ background: 'linear-gradient(90deg, #e03131, #ffd43b 25%, #69db7c 40% 60%, #ffd43b 75%, #e03131)' }}>
          <span className="absolute -top-1 h-6 w-2 rounded-full bg-[var(--color-ink)]" style={{ left: `calc(${50 + lean * 50}% - 4px)` }} />
        </div>
        {there && <div className="absolute inset-x-6 top-14 rounded-[18px] bg-white/95 p-3 text-center text-[18px] font-extrabold text-[var(--color-ink)]">Jusqu'à papa sans tomber !</div>}
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-4">
        <div className={`mb-5 rounded-2xl py-4 text-center font-display text-[18px] font-extrabold text-white ${lean > 0.1 ? 'bg-[#c2410c]' : 'bg-[var(--color-orange)]'}`}>◀ Pencher</div>
        <div className={`mb-5 rounded-2xl py-4 text-center font-display text-[18px] font-extrabold text-white ${lean < -0.1 ? 'bg-[#c2410c]' : 'bg-[var(--color-orange)]'}`}>Pencher ▶</div>
      </div>
    </div>
  )
}

/** The rattle in rhythm: the circle closing on the ring, « Parfait ! » each beat. */
function Hochet({ t }: { t: number }) {
  const beat = 0.8
  const k = 1 - (t % beat) / beat
  const n = Math.floor(t / beat)
  const said = t % beat < 0.35 && n > 0 ? (n % 4 === 2 ? 'Bien !' : 'Parfait !') : undefined
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#4b2e83] to-[#2b1d4a]">
      <GameTop title="Le hochet en rythme" step={`${Math.min(12, n + 1)} / 12`} note={said} />
      <div className="relative mx-4 mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-[26px] bg-[#2b1d4a]">
        <div className="absolute h-32 w-32 rounded-full border-[7px] border-[#ffd43b]" />
        <div className="absolute rounded-full border-[5px] border-white/80" style={{ width: 128 + k * 170, height: 128 + k * 170 }} />
        <div className="font-display text-[48px] font-extrabold text-white" style={{ transform: `rotate(${Math.sin(t * 16) * (said ? 18 : 4)}deg)` }}>
          ♪
        </div>
      </div>
      <div className="pt-4">
        <GameButton label="Secouer le hochet" down={!!said && t % beat < 0.12} />
      </div>
    </div>
  )
}

const FIRSTS = [
  ['heart', 'Le premier sourire'],
  ['soup', 'La première bouillie'],
  ['bath', 'Le premier bain'],
  ['baby', 'La première dent'],
  ['party-popper', 'Le premier éclat de rire'],
  ['footprints', 'Les premiers pas'],
  ['users', 'Le premier jour de crèche'],
  ['messages-square', 'Le premier mot'],
] as const

/** The « premières fois » ticked one after the other, and the card of a new one. */
function Firsts({ t }: { t: number }) {
  const done = Math.min(8, 3 + Math.floor(t / 0.7))
  const card = t > 2.2 && t < 4.4
  return (
    <div className="flex h-full flex-col bg-white px-5 pt-5 text-[var(--color-ink)]">
      <div className="font-display text-[26px] font-extrabold">Mes premières fois</div>
      <div className="text-[15px] font-bold text-[var(--color-ink-soft)]">{done === 8 ? 'Toutes ! Le bébé est aux anges.' : `${done} sur 8`}</div>
      <div className="mt-3 space-y-1.5">
        {FIRSTS.map(([icon, label], i) => {
          const ok = i < done
          const I = iconFor(icon)
          return (
            <div key={label} className={`flex items-center gap-3 rounded-2xl px-3 py-1.5 ${ok ? 'bg-[#d3f9d8]' : 'bg-black/[0.04]'}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-full ${ok ? 'bg-[var(--color-emerald)] text-white' : 'bg-white text-[var(--color-ink-soft)]'}`}>{ok ? <Check size={18} strokeWidth={3} /> : <I size={18} />}</span>
              <span className="text-[16px] font-extrabold">{label}</span>
            </div>
          )
        })}
      </div>
      {card && (
        <div className="absolute inset-x-6 top-[30%] rounded-[26px] bg-white p-5 text-center shadow-2xl ring-1 ring-black/5">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#ffd43b]">
            <Sparkles size={28} />
          </div>
          <div className="mt-2 text-[13px] font-extrabold tracking-wider text-[var(--color-orange)] uppercase">Première fois !</div>
          <div className="font-display text-[24px] font-extrabold">Les premiers pas</div>
        </div>
      )}
    </div>
  )
}

const TOYS = [
  ['volleyball', 'Le ballon', 'Sportif : le foot dans le sang'],
  ['drum', 'Le tam-tam', 'Artiste : le rythme dans la peau'],
  ['book-open', 'Le livre', "Studieux : de bonnes notes d'avance"],
  ['smartphone', 'Le téléphone de papa', 'Charmeur : le verbe facile'],
] as const
const WORDS = ['Maman', 'Papa', 'Garba !', 'Dêh !', 'Ma-ma-man', 'Tonton']

/** A choice that counts: the toy it goes for, or its first word; one picked, and what it brings. */
function Choice({ t, kind }: { t: number; kind: 'talent' | 'mot' }) {
  const picked = t > 2 ? 0 : -1
  return (
    <div className="flex h-full flex-col bg-white px-5 pt-5 text-[var(--color-ink)]">
      <div className="font-display text-[26px] font-extrabold">{kind === 'talent' ? 'Quel jouet attraper ?' : 'Son premier mot ?'}</div>
      <p className="mt-1 text-[15px] font-bold text-[var(--color-ink-soft)]">{kind === 'talent' ? 'Ce que tu choisis, tu le gardes : un talent pour toute la vie.' : 'Toute la famille va le répéter. On ne choisit qu’une fois.'}</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {kind === 'talent'
          ? TOYS.map(([icon, label, gift], i) => {
              const I = iconFor(icon)
              return (
                <div key={label} className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center ${picked === i ? 'bg-[#ffd43b] ring-4 ring-[var(--color-orange)]' : 'bg-black/[0.04]'}`}>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[#ffd43b] text-[#16161c]">
                    <I size={24} />
                  </span>
                  <span className="text-[16px] font-extrabold">{label}</span>
                  <span className="text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{gift}</span>
                </div>
              )
            })
          : WORDS.map((w, i) => (
              <div key={w} className={`rounded-2xl px-3 py-4 text-center font-display text-[20px] font-extrabold ${picked === i ? 'bg-[#ffd43b] ring-4 ring-[var(--color-orange)]' : 'bg-black/[0.04]'}`}>
                « {w} »
              </div>
            ))}
      </div>
      {t > 2.6 && (
        <div className="mt-5 rounded-2xl bg-[#e9f9ef] p-4 text-center font-display text-[20px] font-extrabold text-[#0f9d58]">
          {kind === 'talent' ? 'Sportif : le foot dans le sang ⚽' : '« Maman ! » Elle en pleure de joie.'}
        </div>
      )}
    </div>
  )
}

/** The baby's gauges and its soins, each filling as it's done (as the 3D shows it). */
function Soins({ t }: { t: number }) {
  const step = Math.min(2, Math.floor(t / 2))
  const k = ease(clamp01((t % 2) / 1.6))
  const v = (i: number, base: number) => Math.round(i < step ? 95 : i === step ? base + (95 - base) * k : base)
  const gauges = [
    { label: 'Faim', Icon: Milk, value: v(0, 25), color: '#ff922b' },
    { label: 'Propreté', Icon: Bath, value: v(1, 30), color: '#4dabf7' },
    { label: 'Câlin', Icon: Heart, value: v(2, 35), color: '#f06595' },
    { label: 'Sommeil', Icon: Moon, value: 70, color: '#7048e8' },
  ]
  const acts = ['Boire le biberon', 'Le bain avec maman', 'Un câlin à maman']
  return (
    <div className="absolute inset-x-6 bottom-[7%] rounded-[28px] bg-white/95 p-4 text-[var(--color-ink)] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {gauges.map(({ label, Icon, value, color }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon size={22} style={{ color }} />
            <div className="flex-1">
              <div className="text-[14px] font-extrabold">{label}</div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {acts.map((a, i) => (
          <div key={a} className={`rounded-2xl px-2 py-2.5 text-center text-[13px] leading-tight font-extrabold ${i === step ? 'bg-[var(--color-orange)] text-white' : 'bg-black/[0.05]'}`}>
            {a}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The cousins' fight: the bars going down, the baby's anger. */
function FightHud({ t }: { t: number }) {
  const me = Math.max(35, 100 - t * 6)
  const them = Math.max(10, 100 - t * 15)
  const bar = (v: number, right: boolean) => (
    <div className={`relative h-[18px] flex-1 overflow-hidden rounded-[5px] bg-black/60 ring-2 ring-white/70 ${right ? '-scale-x-100' : ''}`}>
      <div className="absolute inset-y-0 left-0" style={{ width: `${v}%`, background: 'linear-gradient(#ffe066,#fab005)' }} />
    </div>
  )
  return (
    <>
      <div className="absolute inset-x-5 top-[64%] text-white">
        <div className="flex items-center gap-2">
          {bar(me, false)}
          <span className="grid h-11 w-14 place-items-center rounded-lg bg-black/70 font-display text-[26px] font-extrabold ring-2 ring-white/60">{Math.max(0, 60 - Math.floor(t * 2))}</span>
          {bar(them, true)}
        </div>
        <div className="mt-1 flex justify-between font-display text-[17px] font-extrabold [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">
          <span>TOI</span>
          <span>LE COUSIN KOFFI</span>
        </div>
      </div>
      {t > 3.4 && <div className="absolute inset-x-0 top-[54%] text-center font-display text-[52px] leading-none font-extrabold text-[#ffd43b] [text-shadow:0_5px_0_rgba(0,0,0,0.55)]">Colère de bébé !</div>}
    </>
  )
}

/** A word on the scene: a little card that comes in. */
function Chip({ t, at = 0.8, children, top = '74%' }: { t: number; at?: number; children: React.ReactNode; top?: string }) {
  const k = ease(clamp01((t - at) / 0.4))
  if (k <= 0) return null
  return (
    <div className="absolute inset-x-0 flex justify-center px-8" style={{ top, opacity: k, transform: `translateY(${(1 - k) * 24}px)` }}>
      <div className="flex items-center gap-2.5 rounded-full bg-white px-6 py-3 font-display text-[24px] font-extrabold text-[var(--color-ink)] shadow-[0_14px_30px_-10px_rgba(0,0,0,0.5)]">{children}</div>
    </div>
  )
}

/** The screen of each shot, over its scene. */
export function BebeOverlay({ screen, t }: { screen?: BebeScreen; t: number }) {
  const k = ease(clamp01((t - 0.3) / 0.5))
  switch (screen) {
    case 'soins':
      return <Soins t={t} />
    case 'pleure':
      return (
        <>
          <div className="absolute inset-x-0 top-[34%] flex justify-center">
            <div className="rounded-[30px] rounded-bl-md bg-white px-8 py-4 font-display text-[54px] font-extrabold text-[#e03131] shadow-xl" style={{ transform: `scale(${1 + Math.sin(t * 9) * 0.05}) rotate(${Math.sin(t * 7) * 3}deg)` }}>
              Ouinnnn ! 😭
            </div>
          </div>
          <Chip t={t} at={1.2}>
            <Volume2 size={26} className="text-[var(--color-orange)]" /> Il a faim : vite, le biberon !
          </Chip>
        </>
      )
    case 'bapteme':
      return <Chip t={t} at={3.2}>🎁 Les cadeaux de toute la famille</Chip>
    case 'coucou':
      return (
        <Phone k={k}>
          <Coucou t={t} />
        </Phone>
      )
    case 'cubes':
      return (
        <Phone k={k}>
          <Cubes t={t} />
        </Phone>
      )
    case 'pas':
      return (
        <Phone k={k}>
          <Pas t={t} />
        </Phone>
      )
    case 'hochet':
      return (
        <Phone k={k}>
          <Hochet t={t} />
        </Phone>
      )
    case 'bagarre':
      return <FightHud t={t} />
    case 'firsts':
      return (
        <Phone k={k}>
          <Firsts t={t} />
        </Phone>
      )
    case 'talent':
    case 'mot':
      return (
        <Phone k={k}>
          <Choice t={t} kind={screen} />
        </Phone>
      )
    case 'creche':
      return (
        <Chip t={t}>
          <span className="h-4 w-4 rounded-full bg-[#3b82f6]" /> Les bébés des autres joueurs
        </Chip>
      )
    case 'balade':
      return (
        <Chip t={t} at={1.4}>
          <span className="h-4 w-4 rounded-full bg-[#3b82f6]" /> Un autre joueur et son bébé
        </Chip>
      )
    case 'grandit':
      return (
        <div className="absolute inset-x-5 top-[70%] grid grid-cols-4 gap-2">
          {[
            ['Bébé', '2 h de jeu'],
            ['Enfant', "l'école"],
            ['Ado', 'les amis'],
            ['Adulte', '18 ans'],
          ].map(([a, b], i) => {
            const on = t > 0.4 + i * 1.1
            return (
              <div key={a} className={`rounded-2xl px-2 py-2.5 text-center leading-tight ${on ? 'bg-[var(--color-orange)] text-white' : 'bg-white/40 text-white/60'}`}>
                <div className="font-display text-[20px] font-extrabold">{a}</div>
                <div className="text-[13px] font-extrabold">{b}</div>
              </div>
            )
          })}
        </div>
      )
    default:
      return null
  }
}

