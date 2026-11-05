import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Crosshair, Globe, Swords, Trophy, Bot, Zap } from 'lucide-react'
import { rumble, stickOwner, useGamepad } from '../lib/gamepad'
import { haptic } from '../lib/native'
import { sfx } from '../lib/sfx'
import type { Look } from '../lib/types'
import { randomLook } from '../avatar/options'
import { Portrait } from '../avatar/portrait'
import { reactToResult, setExpression } from '../avatar/expressions'
import { rng } from '../world3d/themes'
import { keyOpen, useFeatures } from '../lib/features'
import { openPvp } from '../components/pvp/games'
import { Stick, useKeys } from '../components/defi/arcade'
import { createFight, ESCAPE_CD, fightScore, NO_PAD, ROUND_TIME, SPECIAL_NAME, stepFight, type ArenaId, type Fight, type FightEvent, type Pad, type Style } from './engine'
import { aiPad, newMind, skillOf } from './ai'
import { StormCanvas, TitleCanvas, VersusCanvas, type CamDir, type FighterLook } from './Scene'
import type { StormNet } from './net'
import { ARENA_IDS } from './net'
import { t as tr, tx } from '../lib/i18n'

// Adjamé Storm 4 (the update « combat-arene »): the fighting game of the
// salle de jeux, a whole game of its own. The title (the logo in the game's
// blocks), the modes (against the computer at three levels, the ladder of
// the whole roster one after the other, online against a player through
// « Jouer contre un joueur »), the fighters (the player's own Sim and the
// characters of Abidjan, each its style and its special), the arenas (real
// spots of Abidjan), then the fight: free on the ground of the arena
// (engine.ts), the camera behind the player (Scene.tsx), a stick and six
// buttons on a phone, the keys on a computer, a controller.

type Me = { look: Look; gender: 'femme' | 'homme' }

/** A fighter of the roster: its name, where it's from, how it fights. */
export type Hero = { id: string; name: string; from: string; about: string; gender: 'femme' | 'homme'; seed: number; style: Style; look?: Partial<Look> }
export const ROSTER: Hero[] = [
  { id: 'toi', name: tr('Toi'), from: tr('Ton quartier'), about: tr('Équilibré·e. Spécial : le coupé-décalé, une rafale de coups en fonçant.'), gender: 'homme', seed: 3, style: { sp: 'coupe', pow: 1, spd: 1 } },
  { id: 'yao', name: tr('Petit Yao'), from: tr('Gare d’Adjamé'), about: tr('Apprenti gbaka, rapide et léger. Spécial : le tourbillon, qui frappe tout autour.'), gender: 'homme', seed: 41, style: { sp: 'tourbillon', pow: 0.9, spd: 1.14 }, look: { body: 'mince', height: 0.95, outfit: 'debardeur', outfitColor: '#f6c445', bottomColor: '#2b3a67', hair: 'degrade', skin: '#7a4a2a', beard: 'none' } },
  { id: 'go', name: tr('La Go de Yop'), from: tr('Yopougon'), about: tr('Vive, des jambes partout. Spécial : l’envol, un coup de pied volant de loin.'), gender: 'femme', seed: 77, style: { sp: 'envol', pow: 0.95, spd: 1.08 }, look: { body: 'mince', height: 1.02, outfit: 'jogging', outfitColor: '#ff3d7f', bottomColor: '#1d1d24', hair: 'cornrows', hairColor: '#1a1010', skin: '#5b3620' } },
  { id: 'akissi', name: tr('Tantie Akissi'), from: tr('Marché de Treichville'), about: tr('Les bras du marché, elle ne recule pas. Spécial : le coupé-décalé.'), gender: 'femme', seed: 23, style: { sp: 'coupe', pow: 1.08, spd: 0.96 }, look: { body: 'fort', height: 1.0, outfit: 'pagne', outfitColor: '#e8590c', hair: 'headwrap', skin: '#6e4024' } },
  { id: 'boss', name: tr('Le Boss d’Adjamé'), from: tr('Black Market'), about: tr('Lourd, lent, chaque coup fait mal. Spécial : le marteau, il saute et écrase le sol.'), gender: 'homme', seed: 12, style: { sp: 'marteau', pow: 1.2, spd: 0.88 }, look: { body: 'fort', height: 1.1, outfit: 'blouson', outfitColor: '#1f2937', bottomColor: '#111827', hair: 'bald', skin: '#3e2516' } },
]

export const ARENA_INFO: Record<ArenaId, { name: string; where: string; when: string; colors: [string, string] }> = {
  terrain: { name: tr('Le terrain vague'), where: tr('Adjamé, derrière la gare'), when: tr('La nuit'), colors: ['#3b1d5c', '#120d24'] },
  treichville: { name: tr('La rue du maquis'), where: tr('Treichville'), when: tr('La nuit'), colors: ['#5c1d3b', '#120d24'] },
  cour: { name: tr('La cour commune'), where: tr('Yopougon'), when: tr('En plein jour'), colors: ['#e8b86d', '#8a5a2a'] },
  plage: { name: tr('La plage'), where: tr('Grand-Bassam'), when: tr('Au coucher du soleil'), colors: ['#f0a46a', '#7a3a5a'] },
}

const LEVELS = [tr('Facile'), tr('Normal'), tr('Difficile')]
const BEST = 'babi.storm.best'

const heroLook = (h: Hero, me?: Me): FighterLook => (h.id === 'toi' ? { look: me?.look ?? randomLook('homme', rng('me')), gender: me?.gender ?? 'homme', seed: 3 } : { look: { ...randomLook(h.gender, rng(`storm-${h.id}`)), ...h.look } as Look, gender: h.gender, seed: h.seed })

type Screen = { s: 'title' } | { s: 'how' } | { s: 'pick'; mode: 'ai' | 'ladder' } | { s: 'arena'; mode: 'ai'; me: number; foe: number; level: number } | { s: 'fight'; mode: 'ai' | 'ladder'; me: number; foe: number; level: number; arena: ArenaId; step: number; beaten: number } | { s: 'next'; me: number; step: number; beaten: number }

/** The whole game: the title, the menus, the fights. `onEnd` gets the run's score (0–100). */
export function StormGame({ me, onEnd, onStart }: { me?: Me; onEnd: (score: number) => void; /** A fight is on (or off again). */ onStart?: (on: boolean) => void }) {
  const [sc, setSc] = useState<Screen>({ s: 'title' })
  const feats = useFeatures()
  useEffect(() => {
    onStart?.(sc.s === 'fight')
  }, [sc.s, onStart])
  useEffect(() => () => onStart?.(false), [onStart])
  const myLook = useMemo(() => heroLook(ROSTER[0], me), [me])
  if (sc.s === 'title') return <Title who={myLook} online={keyOpen(feats, 'jeux-en-ligne')} onPick={(m) => (m === 'online' ? openPvp('storm') : m === 'how' ? setSc({ s: 'how' }) : setSc({ s: 'pick', mode: m }))} />
  if (sc.s === 'how') return <How onBack={() => setSc({ s: 'title' })} />
  if (sc.s === 'pick') return <Pick me={me} mode={sc.mode} onBack={() => setSc({ s: 'title' })} onGo={(mine, foe, level) => (sc.mode === 'ladder' ? setSc({ s: 'next', me: mine, step: 0, beaten: 0 }) : setSc({ s: 'arena', mode: 'ai', me: mine, foe, level }))} />
  if (sc.s === 'arena') return <ArenaPick onBack={() => setSc({ s: 'pick', mode: 'ai' })} onGo={(arena) => setSc({ s: 'fight', mode: 'ai', me: sc.me, foe: sc.foe, level: sc.level, arena, step: 0, beaten: 0 })} />
  if (sc.s === 'next') {
    // The ladder: everyone else in the roster, from the easiest, a new place each time.
    const foes = ROSTER.map((_, k) => k).filter((k) => k !== sc.me)
    const foe = foes[sc.step]
    return <LadderStep me={me} mine={sc.me} foes={foes} step={sc.step} onGo={() => setSc({ s: 'fight', mode: 'ladder', me: sc.me, foe, level: sc.step / (foes.length - 1), arena: ARENA_IDS[sc.step % ARENA_IDS.length], step: sc.step, beaten: sc.beaten })} />
  }
  const mine = ROSTER[sc.me]
  const foe = ROSTER[sc.foe]
  return (
    <StormMatch
      key={`${sc.mode}${sc.step}${sc.foe}`}
      looks={[heroLook(mine, me), heroLook(foe, me)]}
      styles={[mine.style, foe.style]}
      names={[mine.id === 'toi' ? tr('TOI') : mine.name.toUpperCase(), foe.name.toUpperCase()]}
      arena={sc.arena}
      level={sc.mode === 'ladder' ? sc.level : sc.level / 2}
      onOver={(won, F) => {
        const a = F.f[0]
        if (sc.mode === 'ai') {
          const score = fightScore(F.wins[0], F.wins[1], a.hp, F.dealt[0], sc.level)
          keepBest(score)
          return onEnd(score)
        }
        const beaten = sc.beaten + (won ? 1 : 0)
        const foes = ROSTER.length - 1
        if (won && sc.step + 1 < foes) return setSc({ s: 'next', me: sc.me, step: sc.step + 1, beaten })
        // The ladder over: by how far it went (all of it: 100).
        const score = beaten >= foes ? 100 : Math.round(Math.min(90, beaten * 22 + Math.min(12, F.dealt[0] / 10)))
        keepBest(score)
        onEnd(score)
      }}
    />
  )
}

function keepBest(s: number) {
  try {
    if (s > Number(localStorage.getItem(BEST) ?? 0)) localStorage.setItem(BEST, String(s))
  } catch {
    /* private mode: not kept */
  }
}

/* ---------- The title ---------- */

const panel = 'bg-[radial-gradient(circle_at_50%_0%,#3b1d5c,#120d24)]'
const menuBtn = 'flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left font-display text-[19px] font-extrabold text-white shadow-[0_4px_0_rgba(0,0,0,0.35)] transition active:translate-y-0.5'

function Title({ who, online, onPick }: { who: FighterLook; online: boolean; onPick: (m: 'ai' | 'ladder' | 'online' | 'how') => void }) {
  return (
    <div className={`flex h-full flex-col ${panel} text-white`}>
      <div className="relative min-h-0 flex-1">
        <TitleCanvas who={who} text={tr('ADJAMÉ')} sub={tr('STORM 4')} />
      </div>
      <div className="space-y-2.5 px-5 pb-[max(1.2rem,var(--sab,env(safe-area-inset-bottom)))]">
        <button className={`${menuBtn} bg-[#e03131]`} onClick={() => (sfx.bell(), onPick('ai'))}>
          <Bot size={22} /> {tr('Contre l’ordinateur')}
        </button>
        <button className={`${menuBtn} bg-[#7048e8]`} onClick={() => (sfx.bell(), onPick('ladder'))}>
          <Trophy size={22} /> {tr('L’échelle : tous les combattants')}
        </button>
        {online && (
          <button className={`${menuBtn} bg-[#1c7ed6]`} onClick={() => onPick('online')}>
            <Globe size={22} /> {tr('En ligne, contre un joueur')}
          </button>
        )}
        <button className="w-full py-1 text-center text-[14px] font-extrabold text-white/70 underline" onClick={() => onPick('how')}>
          {tr('Comment jouer')}
        </button>
      </div>
    </div>
  )
}

function How({ onBack }: { onBack: () => void }) {
  const rows: [string, string][] = [
    [tr('Le stick'), tr('Cours partout dans l’arène. Verrouillé sur l’adversaire (la cible), tu lui tournes autour en le regardant.')],
    [tr('Attaque'), tr('Appuie encore et encore : quatre coups enchaînés, le dernier envoie voler l’adversaire.')],
    [tr('Rush'), tr('Fonce sur l’adversaire (de loin, il le poursuit). Attaque pendant le rush : un coup qui l’étourdit. Le stick en arrière : un pas de recul.')],
    [tr('Saut'), tr('Saute ; Attaque en l’air : un coup de pied plongeant.')],
    [tr('Garde'), tr('Tenue, elle pare les coups de face. Garde + Attaque tout près : la saisie, qui passe la garde.')],
    [tr('Esquive'), tr('Une roulade. Pendant une série de coups, elle t’en sort (puis il faut attendre qu’elle revienne).')],
    [tr('Spécial'), tr('Jauge pleine : le coup spécial de ton combattant. Tenu sans bouger, il charge la jauge.')],
    [tr('Clavier'), tr('ZQSD (WASD) ou flèches, J attaque, Espace saut, K rush, L garde, U esquive, I spécial, Tab la cible.')],
  ]
  return (
    <div className={`flex h-full flex-col overflow-y-auto ${panel} px-4 pt-14 pb-6 text-white`}>
      <button className="mb-2 flex items-center gap-1 text-[14px] font-extrabold text-white/70" onClick={onBack}>
        <ArrowLeft size={16} /> {tr('Retour')}
      </button>
      <div className="font-display text-[26px] font-extrabold">{tr('Comment jouer')}</div>
      <div className="mt-3 space-y-2">
        {rows.map(([a, b]) => (
          <div key={a} className="rounded-2xl bg-white/10 p-3">
            <div className="font-display text-[16px] font-extrabold text-[#ffd43b]">{a}</div>
            <div className="text-[13px] leading-snug font-bold text-white/80">{b}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] font-bold text-white/70">{tr('Deux rounds gagnants. Le temps fini, celui qui a le plus de vie gagne le round.')}</p>
    </div>
  )
}

/* ---------- Choosing the fighters ---------- */

function Pick({ me, mode, onBack, onGo }: { me?: Me; mode: 'ai' | 'ladder'; onBack: () => void; onGo: (mine: number, foe: number, level: number) => void }) {
  const [mine, setMine] = useState(0)
  const [foe, setFoe] = useState<number | null>(null)
  const [level, setLevel] = useState(1)
  const [step, setStep] = useState<'me' | 'foe'>('me')
  const sel = step === 'me' ? mine : (foe ?? -1)
  const looks = useMemo(() => ROSTER.map((h) => heroLook(h, me)), [me])
  const hero = sel >= 0 ? ROSTER[sel] : null
  return (
    <div className={`flex h-full flex-col ${panel} text-white`}>
      <div className="flex items-center justify-between px-4 pt-12">
        <button className="flex items-center gap-1 text-[14px] font-extrabold text-white/70" onClick={() => (step === 'foe' ? setStep('me') : onBack())}>
          <ArrowLeft size={16} /> {tr('Retour')}
        </button>
        <div className="font-display text-[18px] font-extrabold">{step === 'me' ? tr('Ton combattant') : tr('Ton adversaire')}</div>
        <span className="w-12" />
      </div>
      <div className="relative min-h-0 flex-1">
        <VersusCanvas a={looks[mine]} b={step === 'foe' && foe !== null ? looks[foe] : null} />
        {hero && (
          <div className="pointer-events-none absolute inset-x-3 bottom-1 rounded-2xl bg-black/45 px-3 py-2">
            <div className="font-display text-[18px] leading-tight font-extrabold">
              {hero.id === 'toi' && me ? tr('Toi') : hero.name} <span className="text-[12px] font-bold text-white/60">· {hero.from}</span>
            </div>
            <div className="text-[12.5px] leading-snug font-bold text-white/80">{hero.about}</div>
            <div className="mt-1 flex gap-3 text-[11px] font-extrabold text-[#ffd43b]">
              <span>{tr('Force')} {'▮'.repeat(Math.round(hero.style.pow * 5 - 2))}</span>
              <span>{tr('Vitesse')} {'▮'.repeat(Math.round(hero.style.spd * 5 - 2))}</span>
              <span className="flex items-center gap-0.5">
                <Zap size={11} /> {SPECIAL_NAME[hero.style.sp]}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2 px-3 pt-2">
        {ROSTER.map((h, k) => {
          const off = step === 'foe' && k === mine
          const on = sel === k
          return (
            <button key={h.id} disabled={off} className={`aspect-square overflow-hidden rounded-2xl bg-white/10 ring-2 transition ${on ? 'scale-105 ring-[#ffd43b]' : 'ring-white/10'} ${off ? 'opacity-30' : ''}`} onClick={() => (sfx.tick(1 + k * 0.1), step === 'me' ? setMine(k) : setFoe(k))}>
              <Portrait look={looks[k].look} gender={looks[k].gender} framing="head" />
            </button>
          )
        })}
      </div>
      {step === 'foe' && (
        <div className="mt-2 grid grid-cols-3 gap-2 px-3">
          {LEVELS.map((l, k) => (
            <button key={l} className={`rounded-xl py-2 font-display text-[15px] font-extrabold ${level === k ? 'bg-[#ffd43b] text-[#16161c]' : 'bg-white/10 text-white'}`} onClick={() => setLevel(k)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="px-3 pt-2 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))]">
        <button
          disabled={step === 'foe' && foe === null}
          className={`${menuBtn} justify-center bg-[#e03131] disabled:opacity-40`}
          onClick={() => {
            sfx.bell()
            if (mode === 'ladder') return onGo(mine, -1, 0)
            if (step === 'me') return (setStep('foe'), setFoe(mine === 1 ? 2 : 1))
            onGo(mine, foe!, level)
          }}
        >
          <Swords size={20} /> {mode === 'ladder' ? tr('Monter l’échelle') : step === 'me' ? tr('Choisir l’adversaire') : tr('Choisir l’arène')}
        </button>
      </div>
    </div>
  )
}

function ArenaPick({ onBack, onGo }: { onBack: () => void; onGo: (a: ArenaId) => void }) {
  return (
    <div className={`flex h-full flex-col overflow-y-auto ${panel} px-4 pt-12 pb-6 text-white`}>
      <button className="mb-1 flex items-center gap-1 text-[14px] font-extrabold text-white/70" onClick={onBack}>
        <ArrowLeft size={16} /> {tr('Retour')}
      </button>
      <div className="font-display text-[24px] font-extrabold">{tr('Où se battre ?')}</div>
      <div className="mt-3 space-y-2.5">
        {ARENA_IDS.map((id) => {
          const a = ARENA_INFO[id]
          return (
            <button key={id} className="flex w-full flex-col items-start rounded-[22px] p-4 text-left shadow-[0_4px_0_rgba(0,0,0,0.35)] active:translate-y-0.5" style={{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})` }} onClick={() => (sfx.bell(), onGo(id))}>
              <span className="font-display text-[20px] leading-tight font-extrabold">{a.name}</span>
              <span className="text-[13px] font-bold text-white/85">
                {a.where} · {a.when}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LadderStep({ me, mine, foes, step, onGo }: { me?: Me; mine: number; foes: number[]; step: number; onGo: () => void }) {
  const a = heroLook(ROSTER[mine], me)
  const b = heroLook(ROSTER[foes[step]], me)
  const arena = ARENA_INFO[ARENA_IDS[step % ARENA_IDS.length]]
  useEffect(() => {
    const t = setTimeout(onGo, 2600)
    return () => clearTimeout(t)
  }, [onGo])
  return (
    <div className={`flex h-full flex-col ${panel} text-white`} onClick={onGo}>
      <div className="px-4 pt-14 text-center">
        <div className="font-display text-[15px] font-extrabold text-white/70">{tx('Combat {n} sur {of}', { n: step + 1, of: foes.length })}</div>
        <div className="mt-1 flex justify-center gap-1.5">
          {foes.map((f, k) => (
            <span key={f} className={`h-2.5 w-8 rounded-full ${k < step ? 'bg-[#ffd43b]' : k === step ? 'animate-pulse bg-white' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <VersusCanvas a={a} b={b} />
        <div className="animate-pop pointer-events-none absolute inset-x-0 top-[40%] text-center font-display text-[64px] font-extrabold text-[#ffd43b] [text-shadow:0_5px_0_rgba(0,0,0,0.5)]">VS</div>
      </div>
      <div className="px-4 pb-10 text-center">
        <div className="font-display text-[24px] font-extrabold">{ROSTER[foes[step]].name}</div>
        <div className="text-[13px] font-bold text-white/70">
          {arena.name} · {arena.where}
        </div>
      </div>
    </div>
  )
}

/* ---------- The fight ---------- */

type Hud = { hp: [number, number]; meter: [number, number]; esc: number; clock: number; wins: [number, number]; round: number; combo: number; said: string; saidAt: number; note: string; noteAt: number; phase: string }

/** Against another player (components/pvp/play.tsx): the line between the two phones, and how it ended. */
export type StormVersus = { net: StormNet; onOver: (won: boolean, gone?: boolean) => void }

type MatchProps = { looks: [FighterLook, FighterLook]; styles: [Style, Style]; names: [string, string]; arena: ArenaId; /** The computer's skill, 0–1. */ level: number; versus?: StormVersus; onOver: (won: boolean, F: Fight) => void }

export function StormMatch({ looks, styles, names, arena, level, versus, onOver }: MatchProps) {
  const F = useRef<Fight>(createFight(arena, styles))
  const mind = useRef(newMind())
  const skill = useMemo(() => skillOf(level), [level])
  const keys = useKeys()
  const cam = useRef<CamDir>({ fx: 0, fz: -1 })
  const stick = useRef({ x: 0, y: 0 })
  const held = useRef({ guard: false, charge: false })
  const presses = useRef({ attack: false, jump: false, dash: false, esc: false, sp: false })
  const [lock, setLock] = useState(true)
  const lockRef = useRef(true)
  lockRef.current = lock
  const ended = useRef(false)
  const [waiting, setWaiting] = useState<boolean | null>(null)
  const [hud, setHud] = useState<Hud>({ hp: [100, 100], meter: [0, 0], esc: 0, clock: ROUND_TIME, wins: [0, 0], round: 1, combo: 0, said: '', saidAt: 0, note: '', noteAt: 0, phase: 'intro' })
  const shown = useRef(hud)
  // The red under the life bar: what was just lost, catching up.
  const [trail, setTrail] = useState<[number, number]>([100, 100])
  useEffect(() => {
    const t = setTimeout(() => setTrail(hud.hp), 450)
    return () => clearTimeout(t)
  }, [hud.hp])
  // The keys' presses (a tap shorter than a frame still counts).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      const p = presses.current
      if (e.code === 'KeyJ') p.attack = true
      else if (e.code === 'Space') (p.jump = true), e.preventDefault()
      else if (e.code === 'KeyK' || e.code === 'ShiftLeft') p.dash = true
      else if (e.code === 'KeyU') p.esc = true
      else if (e.code === 'KeyI') p.sp = true
      else if (e.code === 'Tab') (e.preventDefault(), setLock((l) => !l))
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])
  // A controller: the left stick moves; X attacks, A jumps, B rushes, RB/LB guard, Y the special (held: charging), RT the escape, Select the lock.
  const padStick = useMemo(() => stickOwner(), [])
  const gp = useRef({ guard: false, charge: false })
  useGamepad((g) => {
    padStick(g.lx, g.ly, (x, y) => ((stick.current.x = x), (stick.current.y = y)))
    gp.current = { guard: g.held.has('rb') || g.held.has('lb') || g.lt > 0.4, charge: g.held.has('y') }
    const p = presses.current
    if (g.pressed.has('x')) p.attack = true
    if (g.pressed.has('a')) p.jump = true
    if (g.pressed.has('b')) p.dash = true
    if (g.pressed.has('y')) p.sp = true
    if (g.pressed.has('rt') || g.pressed.has('rs')) p.esc = true
    if (g.pressed.has('select') || g.pressed.has('ls')) setLock((l) => !l)
  })
  if (import.meta.env.DEV) Object.assign(globalThis, { __storm: F })

  const flashEl = useRef<HTMLDivElement>(null)
  const flashV = useRef(0)
  const onFrame = (dt: number): FightEvent[] => {
    const fight = F.current
    const k = keys.current
    // The thumb (or the keys) on the screen, turned into the arena's directions by the camera.
    let sx = stick.current.x + (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)
    let sy = stick.current.y + (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0)
    const n = Math.hypot(sx, sy)
    if (n > 1) ((sx /= n), (sy /= n))
    const { fx, fz } = cam.current
    const p = presses.current
    const mine: Pad = {
      x: -fz * sx + fx * -sy,
      z: fx * sx + fz * -sy,
      guard: held.current.guard || gp.current.guard || k.has('KeyL'),
      lock: lockRef.current,
      charge: held.current.charge || gp.current.charge || k.has('KeyI'),
      ...p,
    }
    p.attack = p.jump = p.dash = p.esc = p.sp = false
    const before = fight.saidAt
    const net = versus?.net
    if (net) {
      net.press(mine)
      if (net.gone && !ended.current) {
        ended.current = true
        versus.onOver(false, true)
        return []
      }
      if (!net.there || (!net.host && !net.take(fight) && fight.time === 0)) {
        net.send(NO_PAD, fight)
        if (waiting !== true) setWaiting(true)
        return []
      }
      if (waiting) setWaiting(false)
      // The host: the other player's style, as soon as it's known (before the first blow).
      if (net.host && fight.round === 1 && fight.phase === 'intro' && net.otherStyle >= 0) Object.assign(fight.f[1], ROSTER[net.otherStyle]?.style ?? {})
      net.take(fight)
      stepFight(fight, dt, [mine, net.remote()])
      net.send(mine, fight)
    } else {
      stepFight(fight, dt, [mine, aiPad(fight, 1, skill, mind.current)])
    }
    const evs = fight.events.splice(0)
    if (fight.saidAt !== before && fight.said === 'Combat !') sfx.bell()
    let note = ''
    for (const e of evs) {
      const mineHit = e.by === 0
      if (e.kind === 'swing') sfx.swish(e.heavy)
      else if (e.kind === 'hit' || e.kind === 'counter' || e.kind === 'throw' || e.kind === 'wall') {
        sfx.punch(e.heavy || e.kind !== 'hit')
        haptic(mineHit ? 'medium' : 'heavy')
        rumble(mineHit ? 0.35 : e.heavy ? 0.9 : 0.6, e.heavy ? 220 : 120)
        if (e.heavy || e.kind !== 'hit') {
          flashV.current = mineHit ? 0.25 : 0.38
          if (flashEl.current) flashEl.current.style.background = mineHit ? '#ffffff' : '#e03131'
        }
        // The player's face: a grin landing a big one, a grimace taking it.
        if (e.heavy) setExpression('me', mineHit ? 'proud' : 'hurt', 900)
        if (e.kind === 'counter' && mineHit) note = tr('Contre !')
        if (e.kind === 'throw' && mineHit) note = tr('Saisie !')
        if (e.kind === 'wall' && mineHit) note = tr('Dans le mur !')
      } else if (e.kind === 'block') sfx.guard()
      else if (e.kind === 'land' && e.heavy) sfx.fall()
      else if (e.kind === 'slam') (sfx.fall(), rumble(0.9, 300))
      else if (e.kind === 'dash' || e.kind === 'roll') sfx.swish(false)
      else if (e.kind === 'escape') (sfx.swish(true), (note = mineHit ? tr('Esquive !') : note))
      else if (e.kind === 'super') {
        sfx.rise()
        note = SPECIAL_NAME[fight.f[e.by].sp] + ' !'
      } else if (e.kind === 'ko') sfx.bell(3)
    }
    flashV.current = Math.max(0, flashV.current - dt * 2.2)
    if (flashEl.current) flashEl.current.style.opacity = String(flashV.current)
    const [a, b] = fight.f
    const next: Hud = {
      hp: [a.hp, b.hp],
      meter: [Math.floor(a.meter), Math.floor(b.meter)],
      esc: Math.ceil(a.esc),
      clock: Math.ceil(fight.clock),
      wins: [fight.wins[0], fight.wins[1]],
      round: fight.round,
      combo: b.combo,
      said: fight.said,
      saidAt: fight.saidAt,
      note: note || shown.current.note,
      noteAt: note ? fight.time : shown.current.noteAt,
      phase: fight.phase,
    }
    const s = shown.current
    if (next.hp[0] !== s.hp[0] || next.hp[1] !== s.hp[1] || next.meter[0] !== s.meter[0] || next.meter[1] !== s.meter[1] || next.esc !== s.esc || next.clock !== s.clock || next.combo !== s.combo || next.saidAt !== s.saidAt || next.noteAt !== s.noteAt || next.wins[0] !== s.wins[0] || next.wins[1] !== s.wins[1] || next.phase !== s.phase) {
      shown.current = next
      setHud(next)
    }
    if (fight.phase === 'over' && fight.phaseT > 2.8 && !ended.current) {
      ended.current = true
      const won = fight.wins[0] > fight.wins[1]
      haptic(won ? 'success' : 'error')
      reactToResult('me', won ? 'bigwin' : 'lost', 5000)
      if (versus) versus.onOver(won)
      else onOver(won, fight)
    }
    return evs
  }

  const t = F.current.time
  const saying = hud.said && t - hud.saidAt < (hud.said === 'Combat !' ? 0.8 : 1.5)
  const noting = hud.note && t - hud.noteAt < 1
  const bar = (v: number, back: number, right: boolean) => (
    <div className={`relative h-[16px] flex-1 overflow-hidden rounded-[5px] bg-black/60 ring-2 ring-white/70 ${right ? '-scale-x-100' : ''}`}>
      <div className="absolute inset-y-0 left-0 bg-[#e03131] transition-[width] duration-300" style={{ width: `${back}%` }} />
      <div className="absolute inset-y-0 left-0" style={{ width: `${v}%`, background: v > 50 ? 'linear-gradient(#8ce99a,#2f9e44)' : v > 25 ? 'linear-gradient(#ffc078,#fd7e14)' : 'linear-gradient(#ff8787,#e03131)' }} />
    </div>
  )
  const gauge = (v: number, right: boolean) => (
    <div className={`h-[8px] w-[46%] overflow-hidden rounded-full bg-black/55 ring-1 ring-white/30 ${right ? '-scale-x-100' : ''}`}>
      <div className={`h-full ${v >= 100 ? 'animate-pulse' : ''}`} style={{ width: `${v}%`, background: v >= 100 ? 'linear-gradient(90deg,#ff3d7f,#ffd43b)' : '#4dabf7' }} />
    </div>
  )
  const pips = (n: number) => (
    <span className="flex gap-1">
      {[0, 1].map((k) => (
        <span key={k} className={`h-2.5 w-2.5 rotate-45 ring-1 ring-white/60 ${k < n ? 'bg-[#ffc233]' : 'bg-black/40'}`} />
      ))}
    </span>
  )
  // A button: pressed (a press for the engine), and/or held (on while the finger's on it).
  const btn = (label: string, color: string, size: number, opts: { press?: keyof typeof presses.current; hold?: 'guard' | 'charge'; dim?: boolean; ring?: number; glow?: boolean }) => (
    <button
      className={`relative grid touch-none place-items-center rounded-full font-display text-[12px] leading-none font-extrabold text-white shadow-[0_4px_0_rgba(0,0,0,0.4)] select-none active:translate-y-0.5 active:brightness-125 ${opts.dim ? 'opacity-45' : ''} ${opts.glow ? 'animate-pulse ring-4 ring-[#ffd43b]' : ''}`}
      style={{ width: size, height: size, background: color }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        if (opts.press) presses.current[opts.press] = true
        if (opts.hold) held.current[opts.hold] = true
      }}
      onPointerUp={() => opts.hold && (held.current[opts.hold] = false)}
      onPointerCancel={() => opts.hold && (held.current[opts.hold] = false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
      {opts.ring !== undefined && opts.ring > 0 && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 font-display text-[18px]">{opts.ring}</span>}
    </button>
  )
  const intro = hud.phase === 'intro' && hud.round === 1
  return (
    <div className="relative h-full w-full touch-none overflow-hidden bg-[#0f0b22] select-none">
      <div className="absolute inset-0">
        <StormCanvas F={F} looks={looks} arena={arena} cam={cam} onFrame={onFrame} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-150" style={{ opacity: F.current.flash > 0 ? 0.3 : 0 }} />
      <div ref={flashEl} className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen" />
      {hud.hp[0] > 0 && hud.hp[0] <= 25 && <div className="pointer-events-none absolute inset-0 animate-pulse shadow-[inset_0_0_70px_14px_rgba(224,49,49,0.55)]" />}
      {/* The bars. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-3 text-white">
        <div className="flex items-center gap-2">
          {bar(hud.hp[0], trail[0], false)}
          <span className="grid h-10 w-12 place-items-center rounded-lg bg-black/70 font-display text-[24px] font-extrabold tabular-nums ring-2 ring-white/60">{hud.clock}</span>
          {bar(hud.hp[1], trail[1], true)}
        </div>
        <div className="mt-1 flex items-center justify-between font-display text-[13px] font-extrabold [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">
          <span className="flex items-center gap-1.5">
            {names[0]} {pips(hud.wins[0])}
          </span>
          <span className="flex items-center gap-1.5">
            {pips(hud.wins[1])} {names[1]}
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          {gauge(hud.meter[0], false)}
          {gauge(hud.meter[1], true)}
        </div>
      </div>
      {/* The fight's intro: the two names, face to face. */}
      {intro && (
        <div className="pointer-events-none absolute inset-x-0 top-[30%] flex flex-col items-center font-display font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.55)]">
          <span className="animate-pop text-[30px]">{names[0]}</span>
          <span className="text-[40px] text-[#ffd43b]">VS</span>
          <span className="animate-pop text-[30px]">{names[1]}</span>
          <span className="mt-1 text-[14px] text-white/80">{ARENA_INFO[arena].name}</span>
        </div>
      )}
      {saying && !intro && (
        <div key={hud.saidAt} className="animate-pop pointer-events-none absolute inset-x-0 top-[26%] text-center font-display text-[46px] leading-none font-extrabold text-white [text-shadow:0_5px_0_rgba(0,0,0,0.55)]" style={{ color: hud.said.startsWith('K.O') ? '#ffd43b' : hud.said === 'Défaite' ? '#ff8787' : undefined }}>
          {(({ 'Combat !': tr('Combat !'), 'Victoire !': tr('Victoire !'), Défaite: tr('Défaite') }) as Record<string, string>)[hud.said] ?? hud.said}
        </div>
      )}
      {hud.combo >= 2 && (
        <div key={hud.combo} className="animate-pop pointer-events-none absolute top-[15%] left-3 font-display text-[26px] leading-none font-extrabold text-[#ffd43b] [text-shadow:0_3px_0_rgba(0,0,0,0.6)]">
          {tx('{combo} coups !', { combo: hud.combo })}
        </div>
      )}
      {noting && (
        <div key={hud.noteAt} className="animate-pop pointer-events-none absolute top-[15%] right-3 font-display text-[22px] leading-none font-extrabold text-[#ff8a5c] [text-shadow:0_3px_0_rgba(0,0,0,0.6)]">
          {hud.note}
        </div>
      )}
      {waiting && <div className="pointer-events-none absolute inset-x-6 top-[38%] rounded-2xl bg-black/65 px-4 py-3 text-center font-display text-[17px] font-extrabold text-white">{tx('En attente de {name}…', { name: names[1] })}</div>}
      {/* The lock on the other: on (facing it), off (running free). */}
      <button className={`absolute top-[86px] left-3 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[12px] font-extrabold ${lock ? 'bg-[#ffd43b] text-[#16161c]' : 'bg-black/50 text-white'}`} onClick={() => setLock((l) => !l)}>
        <Crosshair size={14} /> {lock ? tr('Cible') : tr('Libre')}
      </button>
      {/* The stick, the left half of the bottom; the buttons on the right. */}
      <div className="absolute bottom-0 left-0 h-[44%] w-[52%]">
        <Stick value={stick.current} className="h-full w-full" />
      </div>
      <div className="pointer-events-none absolute right-2 bottom-0 pb-[max(0.8rem,var(--sab,env(safe-area-inset-bottom)))]">
        <div className="pointer-events-auto relative h-[214px] w-[200px]">
          <div className="absolute right-0 bottom-0">{btn(tr('Attaque'), '#e03131', 80, { press: 'attack' })}</div>
          <div className="absolute right-[86px] bottom-[2px]">{btn(tr('Saut'), '#2f9e44', 58, { press: 'jump' })}</div>
          <div className="absolute right-[6px] bottom-[86px]">{btn(tr('Rush'), '#f08c00', 58, { press: 'dash' })}</div>
          <div className="absolute right-[74px] bottom-[66px]">{btn(tr('Esquive'), '#1c7ed6', 54, { press: 'esc', ring: hud.esc > 0 && hud.esc <= ESCAPE_CD ? hud.esc : 0 })}</div>
          <div className="absolute right-[146px] bottom-[60px]">{btn(tr('Garde'), '#495057', 54, { hold: 'guard' })}</div>
          <div className="absolute right-[64px] bottom-[140px]">{btn(tr('Spécial'), '#ff3d7f', 60, { press: 'sp', hold: 'charge', glow: hud.meter[0] >= 100 })}</div>
        </div>
      </div>
    </div>
  )
}
