import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Banknote, Crown, FastForward, Gem, House, KeyRound, Landmark, PiggyBank, Sparkles, Sun, Users } from 'lucide-react'
import { CrestPicture } from './Crest3D'
import type { FamElder, Look, PassationCard, Sim } from '../../lib/types'
import { sfx } from '../../lib/sfx'
import { haptic } from '../../lib/native'
import { sceneDpr } from '../../lib/device'
import { setExpression } from '../../avatar/expressions'
import { randomLook } from '../../avatar/options'
import type { Pose } from '../../avatar/Human'
import { Character } from '../../world3d/Character'
import { Box } from '../../world3d/props'
import { Balloons } from '../../world3d/interior/doings'
import { rng } from '../../world3d/themes'
import { MiniScene } from '../../world3d/minijeux'
import { useMondes } from '../../world3d/mondes'
import { FamilleCour } from '../defi/mondesSets'
import { Confetti } from '../GrowUpParty'
import { CakeProp } from '../Famille'
import { elderLook, famOf, kidLook } from '../../game/famille'
import { generationLabel, heirKindLabel, tierLabel } from '../../game/heritage'
import { locale, t as tr } from '../../lib/i18n'

// « La passation » (the update « heritage », backend sims/heritage.go passation): three beats in their own
// canvas, then the summary. 1. The retirement party at dusk: the family round the elder, the cake, the
// balloons. 2. The keys handed over: a tap, the keys fly from the elder's hand to the heir's, the heir cheers.
// 3. The heir's first morning at the gate. Then what came down: the money, the duties, the elder's pot, the
// assets kept, the tier, the renom. The camera glides from beat to beat; nothing snaps. Skippable.

type Beat = 'fete' | 'cles' | 'matin' | 'bilan'

/** Where the camera looks from in each beat (it glides there). */
const CAMS: Record<Exclude<Beat, 'bilan'>, { pos: [number, number, number]; at: [number, number, number]; r: number }> = {
  fete: { pos: [0.6, 2.1, 4.6], at: [0, 0.9, 0], r: 0.35 },
  cles: { pos: [0.35, 1.55, 3.1], at: [0, 1.05, 0], r: 0.12 },
  matin: { pos: [-1.2, 1.5, 3.4], at: [0, 1.0, -0.6], r: 0.2 },
}

function CamRig({ beat }: { beat: Exclude<Beat, 'bilan'> }) {
  const at = useRef(new THREE.Vector3(0, 0.9, 0))
  const want = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const first = useRef(true)
  useFrame(({ camera, clock, size }, dt) => {
    const c = CAMS[beat]
    // A phone held upright: further back, everyone in the narrow frame.
    const back = size.width < size.height ? 1.45 : 1
    const sway = Math.sin(clock.elapsedTime * 0.25) * c.r
    want.current.set(c.pos[0] * back + sway, c.pos[1], c.pos[2] * back)
    look.current.set(c.at[0], c.at[1], c.at[2])
    const k = first.current ? 1 : 1 - Math.exp(-dt * 1.6)
    first.current = false
    camera.position.lerp(want.current, k)
    at.current.lerp(look.current, k)
    camera.lookAt(at.current)
  })
  return null
}

/** The house's keys on their ring: two keys and a little wooden tag. */
export function KeysProp() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.045, 0.008, 6, 14]} />
        <meshStandardMaterial color="#d9d2c0" metalness={0.8} roughness={0.3} />
      </mesh>
      <Box p={[0.02, -0.07, 0]} s={[0.018, 0.09, 0.008]} c="#e3b341" />
      <Box p={[0.035, -0.105, 0]} s={[0.022, 0.012, 0.008]} c="#e3b341" />
      <Box p={[-0.025, -0.065, 0]} s={[0.016, 0.08, 0.008]} c="#c0c4cc" />
      <Box p={[-0.05, -0.02, 0.002]} s={[0.05, 0.035, 0.012]} c="#9a6a3a" />
    </group>
  )
}

/** The keys' flight from the elder's hand to the heir's: an arc, a spin, a landing (then held). */
function FlyingKeys({ from, to, onLand }: { from: [number, number, number]; to: [number, number, number]; onLand: () => void }) {
  const g = useRef<THREE.Group>(null)
  const t0 = useRef<number | null>(null)
  const landed = useRef(false)
  useFrame(({ clock }) => {
    if (!g.current) return
    if (t0.current === null) t0.current = clock.elapsedTime
    const u = Math.min(1, (clock.elapsedTime - t0.current) / 0.85)
    // Ease out: quick from the hand, soft into the other.
    const e = 1 - (1 - u) * (1 - u)
    g.current.position.set(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + Math.sin(Math.PI * u) * 0.55, from[2] + (to[2] - from[2]) * e)
    g.current.rotation.set(0, 0, u * Math.PI * 4)
    if (u >= 1 && !landed.current) {
      landed.current = true
      onLand()
    }
  })
  return (
    <group ref={g} position={from} scale={1.6}>
      <KeysProp />
    </group>
  )
}

/** Says when the canvas has drawn a few frames: the beats' clocks start then (a slow phone compiling the
 * scene doesn't eat the party before it's even seen). */
function Drawn({ onReady }: { onReady: () => void }) {
  const n = useRef(0)
  useFrame(() => {
    if (++n.current === 6) onReady()
  })
  return null
}

/** A morning sun's warmth on the courtyard: the light rises a little as the beat goes. */
function MorningLight() {
  const l = useRef<THREE.DirectionalLight>(null)
  useFrame((_, dt) => {
    if (l.current) l.current.intensity = Math.min(1.5, l.current.intensity + dt * 0.5)
  })
  return <directionalLight ref={l} position={[-6, 6, 5]} intensity={0.6} color="#ffe2b0" />
}

type Cast = { id: string; look: Look; gender: 'femme' | 'homme'; stage: string; old?: boolean }

export function PassationScene({ sim, card, onDone }: { sim: Sim; card: PassationCard; onDone: () => void }) {
  const [beat, setBeat] = useState<Beat>('fete')
  const [given, setGiven] = useState(false)
  const [landed, setLanded] = useState(false)
  const [ready, setReady] = useState(false)
  const mondes = useMondes()
  const f = famOf(sim)
  // The cast, read once: the elder handing down (their look as it was), the heir (the Sim now), the others.
  const { elder, heir, others } = useMemo(() => {
    const elder: Cast = { id: 'old', look: card.oldLook ?? randomLook(card.oldGender, rng(`old${card.at}`)), gender: card.oldGender, stage: 'adulte', old: card.years >= 60 }
    const heir: Cast = { id: 'heir', look: sim.look, gender: sim.gender, stage: 'adulte' }
    const others: Cast[] = []
    for (const e of (f?.elders ?? []) as FamElder[]) if (e.name !== card.old && !e.village) others.push({ id: e.id, look: elderLook(e), gender: e.gender, stage: 'adulte', old: e.stage === 'senior' })
    for (const k of f?.kids ?? []) others.push({ id: k.id, look: kidLook(k, sim.look), gender: k.gender, stage: k.stage ?? 'enfant' })
    return { elder, heir, others: others.slice(0, 6) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Each beat moves on by itself after a while (a tap moves on at once); the keys wait for the tap a little longer.
  useEffect(() => {
    if (beat === 'bilan' || !ready) return
    if (beat === 'fete') {
      sfx.applause()
      haptic('light')
    }
    if (beat === 'matin') sfx.rise()
    const ms = beat === 'fete' ? 9000 : beat === 'cles' ? 10000 : 8000
    const k = setTimeout(() => (beat === 'cles' && !given ? give() : next()), ms)
    return () => clearTimeout(k)
  }, [beat, given, ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => setBeat((b) => (b === 'fete' ? 'cles' : b === 'cles' ? 'matin' : 'bilan'))
  const give = () => {
    if (given) return
    setGiven(true)
    sfx.swish()
    haptic('medium')
    setExpression('passation-old', 'proud', 3000)
  }
  const land = () => {
    setLanded(true)
    sfx.win(true)
    haptic('heavy')
    setExpression('passation-heir', 'cheer', 3500)
  }

  const evening = beat !== 'matin'
  const sky = beat === 'matin' ? '#ffd9a0' : '#4a3157'
  // The elder and the heir face each other for the keys; at the party the elder stands in the middle.
  const elderAt: [number, number, number] = beat === 'cles' ? [-0.5, 0, 0.1] : beat === 'matin' ? [-1.6, 0, -1.6] : [0, 0, 0]
  const heirAt: [number, number, number] = beat === 'cles' ? [0.5, 0, 0.1] : beat === 'matin' ? [0, 0, 0.2] : [0.95, 0, 0.55]
  const elderPose: Pose = beat === 'fete' ? 'dance' : beat === 'cles' ? (given ? 'wave' : 'idle') : 'wave'
  const heirPose: Pose = beat === 'fete' ? 'clap' : beat === 'cles' ? (landed ? 'cheer' : 'idle') : 'cheer'
  const title = beat === 'fete' ? tr('La fête de départ de {name}', { name: card.old }) : beat === 'cles' ? tr('La remise des clés') : beat === 'matin' ? tr('Le premier matin de {name}', { name: card.heir }) : generationLabel(card.gen)

  if (beat === 'bilan') return <Summary card={card} sim={sim} onDone={onDone} />
  return (
    <div className="fixed inset-0 z-[80] flex flex-col transition-colors duration-1000" style={{ background: sky }} data-passation={beat}>
      <div className="relative min-h-0 flex-1">
        <Canvas dpr={sceneDpr} camera={{ fov: 45 }}>
          <CamRig beat={beat} />
          <Drawn onReady={() => setReady(true)} />
          <hemisphereLight args={[evening ? '#ffd2a8' : '#fff6e8', evening ? '#3a2a50' : '#8a6a40', evening ? 0.9 : 1.25]} />
          {evening ? <directionalLight position={[5, 10, 6]} intensity={0.8} color="#ffb37a" /> : <MorningLight />}
          <MiniScene kind="keep" />
          {mondes !== 'off' ? (
            <FamilleCour tier={mondes} evening={evening} />
          ) : (
            <>
              <Box p={[0, -0.05, 0]} s={[16, 0.1, 16]} c={evening ? '#8a5a3c' : '#c98a52'} />
              <Box p={[0, 0.6, -3.2]} s={[9, 1.2, 0.2]} c="#e9d8b8" />
            </>
          )}
          {beat === 'fete' && (
            <>
              <group position={[1.7, 0, -1.3]}>
                <Balloons />
              </group>
              <group position={[-0.85, 0, 0.6]} rotation={[0, 0.5, 0]}>
                <CakeProp lit />
              </group>
              {/* The string of bulbs of a party in the courtyard */}
              {[-1.6, -0.8, 0, 0.8, 1.6].map((x, i) => (
                <mesh key={x} position={[x, 2.3 - Math.abs(x) * 0.12, -1.6]}>
                  <boxGeometry args={[0.07, 0.09, 0.07]} />
                  <meshBasicMaterial color={['#ffd43b', '#ff8787', '#74c0fc', '#8ce99a', '#ffa94d'][i]} />
                </mesh>
              ))}
            </>
          )}
          {beat === 'matin' && (
            // The gate of the house, open on the street.
            <group position={[0.9, 0, -1.4]}>
              <Box p={[-0.9, 1, 0]} s={[0.25, 2, 0.25]} c="#d8cbb0" />
              <Box p={[0.9, 1, 0]} s={[0.25, 2, 0.25]} c="#d8cbb0" />
              <Box p={[-0.45, 0.9, 0.35]} s={[0.8, 1.7, 0.05]} c="#2f6f4f" r={-0.9} />
            </group>
          )}
          <group position={elderAt} rotation={[0, beat === 'cles' ? Math.PI / 2 : beat === 'matin' ? 0.6 : 0, 0]}>
            <Character look={elder.look} gender={elder.gender} pose={elderPose} marker={false} seed={4} old={elder.old} face={{ id: 'passation-old' }} hold={beat === 'cles' && !given ? <KeysProp /> : undefined} />
          </group>
          <group position={heirAt} rotation={[0, beat === 'cles' ? -Math.PI / 2 : beat === 'fete' ? -0.6 : 0.15, 0]}>
            <Character look={heir.look} gender={heir.gender} pose={heirPose} marker={false} seed={5} face={{ id: 'passation-heir' }} hold={beat === 'cles' && landed ? <KeysProp /> : beat === 'matin' ? <KeysProp /> : undefined} />
          </group>
          {beat === 'cles' && given && !landed && <FlyingKeys from={[-0.3, 1.0, 0.25]} to={[0.3, 1.0, 0.25]} onLand={land} />}
          {beat !== 'cles' &&
            others.map((c, i) => {
              const n = others.length
              const a = Math.PI + 0.5 + (n === 1 ? 0.5 : i / Math.max(1, n - 1)) * (Math.PI - 1)
              const r = beat === 'matin' ? 2.4 : 1.7
              return (
                <group key={c.id} position={[Math.cos(a) * r, 0, Math.sin(a) * 1.2 - (beat === 'matin' ? 1.2 : 0.4)]} rotation={[0, -a - Math.PI / 2, 0]}>
                  <Character look={c.look} gender={c.gender} stage={c.stage} pose={c.stage === 'bebe' ? 'idle' : beat === 'fete' ? (['clap', 'dance', 'cheer'] as Pose[])[i % 3] : 'wave'} marker={false} seed={20 + i} old={c.old} />
                </group>
              )
            })}
          {((beat === 'cles' && landed) || beat === 'fete') && <Confetti />}
        </Canvas>
        <div className="pointer-events-none absolute inset-x-0 top-[max(1rem,var(--sat,env(safe-area-inset-top)))] flex justify-center px-14">
          <span key={beat} className="animate-pop rounded-full bg-black/45 px-4 py-2 text-center text-[13px] font-extrabold tracking-wider text-white uppercase">
            {title}
          </span>
        </div>
        <button className="absolute top-[max(0.75rem,var(--sat,env(safe-area-inset-top)))] right-3 flex items-center gap-1 rounded-full bg-black/40 px-3 py-2 text-[12px] font-extrabold text-white active:scale-95" onClick={() => setBeat('bilan')}>
          <FastForward size={14} /> {tr('Passer')}
        </button>
        {/* The three beats, as dots */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {(['fete', 'cles', 'matin'] as const).map((b) => (
            <span key={b} className={`h-2 rounded-full transition-all duration-500 ${b === beat ? 'w-6 bg-white' : 'w-2 bg-white/45'}`} />
          ))}
        </div>
      </div>
      <div className="bg-white px-5 pt-4 pb-[max(1.25rem,var(--sab,env(safe-area-inset-bottom)))]">
        <p key={`${beat}${landed}`} className="animate-pop min-h-[3rem] text-[16px] leading-snug font-extrabold text-[var(--color-ink)]">
          {beat === 'fete'
            ? tr('Ce soir, toute la famille fête {name}, {n} ans : la musique, le gâteau, les anciens qui dansent.', { name: card.old, n: card.years })
            : beat === 'cles'
              ? landed
                ? tr('{heir} tient les clés de la maison. « Prends-en soin, comme je l’ai fait. »', { heir: card.heir })
                : tr('{name} sort les clés de sa poche et se tourne vers {heir}.', { name: card.old, heir: card.heir })
              : tr('Le lendemain, {heir} ouvre le portail. La maison, le nom {last} : à toi maintenant.', { heir: card.heir, last: sim.lastName })}
        </p>
        {beat === 'cles' && !given ? (
          <button className="btn mt-3 w-full" onClick={give} data-passation-cles>
            <KeyRound size={18} /> {tr('Remettre les clés à {heir}', { heir: card.heir })}
          </button>
        ) : (
          <button className="btn mt-3 w-full" disabled={beat === 'cles' && !landed} onClick={next}>
            {beat === 'matin' ? <Sun size={18} /> : <Users size={18} />} {beat === 'matin' ? tr('Voir ce que la famille te laisse') : tr('Continuer')}
          </button>
        )}
      </div>
    </div>
  )
}

/** What came down to the heir, line by line, the numbers counting up. */
function Summary({ card, sim, onDone }: { card: PassationCard; sim: Sim; onDone: () => void }) {
  const [shown, setShown] = useState(0)
  // (Six rows, seven with an heirloom: each comes in its turn.)
  const count = card.heirloom ? 7 : 6
  useEffect(() => {
    sfx.coins(4)
    const k = setInterval(() => setShown((n) => (n >= count ? (clearInterval(k), n) : (sfx.tick(1 + n * 0.08), n + 1))), 260)
    return () => clearInterval(k)
  }, [count])
  const f = (n: number) => `${n.toLocaleString(locale())} F`
  // (« Gardé dans la famille » has four things to say: they go under its label as chips, never squeezing it on a small phone.)
  const rows: { icon: typeof Banknote; label: string; value: string; tone?: string; chips?: string[] }[] = [
    { icon: Banknote, label: tr('Pour {heir}', { heir: card.heir }), value: f(card.money), tone: '#2b8a3e' },
    { icon: Landmark, label: tr('Droits de succession'), value: card.fee ? `− ${f(card.fee)}` : tr('aucun'), tone: card.fee ? '#c92a2a' : undefined },
    { icon: PiggyBank, label: tr('Cagnotte de {name}', { name: card.old }), value: f(card.pot) },
    { icon: House, label: tr('Gardé dans la famille'), value: '', chips: [tr('la maison'), tr('{n} terrain(s)', { n: card.lots }), tr('{n} immeuble(s)', { n: card.estates }), tr('{n} véhicule(s)', { n: card.vehicles })] },
    { icon: Users, label: tr('Famille'), value: card.tierFrom === card.tierTo ? tierLabel(card.tierTo) : `${tierLabel(card.tierFrom)} → ${tierLabel(card.tierTo)}` },
    { icon: Crown, label: tr('Renommée'), value: tr('+{n} (total {total})', { n: card.renom, total: card.total }), tone: '#e8590c' },
    // Phase 3: the heirloom that went down with the house, its line.
    ...(card.heirloom ? [{ icon: Gem, label: tr('Objet de famille : {name}', { name: card.heirloom.label }), value: '', chips: [tr('Génération {n}', { n: card.heirloom.gens }), `« ${card.heirloom.lines[card.heirloom.lines.length - 1]} »`, `+${card.heirloom.renom ?? 0}`] }] : []),
  ]
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#2d1f3d]/85 p-4 backdrop-blur-sm" data-passation="bilan">
      <div className="card animate-up w-full max-w-sm p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="label flex items-center gap-1.5 text-[var(--color-orange)]">
              <Sparkles size={14} /> {generationLabel(card.gen)}
            </div>
            <h2 className="mt-0.5 font-display text-[22px] leading-tight font-extrabold">{tr('{heir} reprend la maison', { heir: card.heir })}</h2>
          </div>
          {/* The family's crest (phase 3) */}
          {card.crest && (
            <span className="animate-pop h-[68px] w-[60px] shrink-0" data-bilan-crest>
              <CrestPicture crest={card.crest} />
            </span>
          )}
        </div>
        {card.crest?.devise && <p className="text-[12.5px] font-extrabold text-[#8a4b00] italic">« {card.crest.devise} »</p>}
        <p className="text-[13px] font-bold text-[var(--color-ink-soft)]">
          {heirKindLabel(card.heirKind, sim.gender)} · {tr('{name} reste à la maison, parmi les anciens.', { name: card.old })}
        </p>
        <ul className="mt-3 space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.label} className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-2xl bg-black/[0.035] px-2.5 py-2 transition-all duration-300 ${i < shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`} data-bilan-row>
              <r.icon size={18} className="shrink-0 text-[var(--color-ink-soft)]" />
              <span className="min-w-0 flex-1 text-[13px] leading-tight font-bold">{r.label}</span>
              {r.chips ? (
                <span className="flex basis-full flex-wrap gap-1 pl-[28px]">
                  {r.chips.map((c) => (
                    <span key={c} className="rounded-full bg-white px-2 py-0.5 text-[12px] font-extrabold whitespace-nowrap">
                      {c}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="max-w-[60%] text-right text-[14px] leading-tight font-extrabold" style={{ color: r.tone }}>
                  {r.value}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{tr('Les dettes ne passent jamais. Tes diplômes et tes papiers sont à refaire : repasse ton BEPC et ton bac au lycée.')}</p>
        <button className="btn mt-3 w-full" onClick={onDone} data-passation-fin>
          {tr('Commencer la vie de {heir}', { heir: card.heir })}
        </button>
      </div>
    </div>
  )
}
