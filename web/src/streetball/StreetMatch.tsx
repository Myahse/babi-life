import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RotateCcw, Trophy, Users, X } from 'lucide-react'
import type { Look } from '../lib/types'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { COUNTDOWN, GBE_REACH, HOOP, HOOP_TO, METER_GOOD, NO_INPUT, buttons, createGame, outcome, seat, shootoutScore, step, type Game, type Geste, type Input, type Rules, type Sport, type Stats } from './game'
import { holdScenes } from '../world3d/hold'
import { BallView, Crowd, Follow, Ground, PlayerView, upright } from './scene'
import { HAZE, Sky } from './looks'
import { FarGrow, GroundShade } from '../avatar/LowHuman'
import { NearUpTo } from '../avatar/Human'
import { Referee } from './stadium'
import { GbeTrail, StreetGround } from './rue'
import { StreetCourt } from './panier'
import { likesFor } from '../world3d/fans'
import { serverNow } from '../lib/worldClock'
import { rumble, stickOwner, useGamepad, usePadConnected } from '../lib/gamepad'
import { sfx } from '../lib/sfx'
import { MatchNet, fetchMatch, leaveMatch, type CourtEntry, type CourtMatch } from './online'

// The street match the player plays (game.ts, scene.tsx): opened when the
// Sim plays basketball or football. Three minutes, the score, the moves.
// Phone: the stick on the left; Passe, Tir, Crochet and Défense on the right.
// Keyboard: arrows / WASD / ZQSD to run, Space to shoot, J (or X) to pass,
// K (or C) for the crossover, L (or E) to defend (held: the stance).
// The console's football (`rules` with a referee, switching or the eleven)
// has more: Shift (RT) sprints, Space (B) held charges the shot, U (Y) the
// through ball, I (X) the lob or cross, Tab or R (LB) changes player.
// Le foot de rue (`rules.street`) has the moves instead (StreetPad): on the
// phone, the Geste button (a tap, a swipe each way, held for the keepy-ups)
// and Feinte; on the keyboard K passement, U roulette, I petit pont,
// O sombrero, C feinte de frappe, H aile de pigeon, N talonnade, G held the
// jongles; Space with the style gauge full is the Gbê.
// Le basket de rue (basketball with `rules.street`) the same way: the Geste
// button's tap the crossover, a swipe up between the legs, down behind the
// back, left the spin, right the hesitation, held the dribble show; Feinte
// the pump fake, swiped the step-back; on the keyboard K, O, I, U, H, G held,
// C, N (the foot's keys for the same gestures); Tir with the gauge full is the
// basket's Gbê.

export type MatchResult = { sport: Sport; score: [number, number]; result: 'win' | 'loss' | 'draw'; stats: Stats; /** A draw settled on penalties: the shoot-out's score. */ pens?: [number, number] }

type Props = {
  sport: Sport
  name: string
  look: Look
  gender: 'femme' | 'homme'
  onExit: (r: MatchResult | null) => void
  /** The labs: the same match every time. */
  seed?: number
  /** At a court: the match with the other players there (streetball/online.ts). */
  online?: { token: string; simId: string; match: CourtMatch; /** A game against a player (components/pvp): the hub's "pvp" room, no court to ask who's there. */ pvp?: boolean }
  /** The console's match at the salle de jeux (components/defi/Foot.tsx): its length, the other side's strength, the golden goal. No replay: the console goes on. */
  rules?: Rules
  /** The console: the two sides' names and shirts (the player's first), and their three letters for the scoreboard. */
  teams?: [string, string]
  kits?: [string, string]
  shorts?: [string, string]
}

/** The two teams' kits: the player's team in orange, the others in green (or blue on the court). */
const KITS: Record<Sport, [string, string]> = { basket: ['#ff7a00', '#1d4ed8'], foot: ['#ff7a00', '#009e60'] }
const KEEPER = '#141416'
/** With a referee (in black), the keepers in their own colours. */
const KEEPERS = ['#fcc419', '#7950f2']

/** The players seen from afar (avatar/LowHuman.tsx): bigger and broader at the stadium, seen from high up. */
const FAR_STADIUM = { grow: 0.6, from: 10, over: 34, wide: 0.6 }
const FAR_PITCH = { grow: 0.15, from: 20, over: 40 }

/** A side's three letters from its name (« Les Lagunaires »: LAG). */
const short3 = (n: string) =>
  n
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(les|le|la|l')\s*/i, '')
    .replace(/[^a-z]/gi, '')
    .slice(0, 3)
    .toUpperCase()

const mmss = (s: number) => {
  const t = Math.max(0, Math.ceil(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

type Hud = {
  score: [number, number]
  left: number
  time: number
  flash: string | null
  has: boolean
  dunk: boolean
  over: boolean
  clear: boolean
  /** At a court, seconds before the whistle (the others are coming). */
  waiting: number
  /** The console's football: the breath left, Tir held so far, what to do at a set piece. */
  stamina: number
  charge: number
  /** Basketball: the shot meter (−1: none). */
  meter: number
  hint: string | null
  /** The console's hands move from player to player (else, online at the stadium, each keeps its own). */
  switching: boolean
  /** The shoot-out's kicks so far, each side's (in or not). */
  pens: [boolean[], boolean[]] | null
  /** Le foot de rue: the style gauge (full: the Gbê), and what the people along the wall shout. */
  style: number
  shout: { text: string; k: number } | null
  /** Le basket de rue: the Gbê would be the flying dunk (close enough), and the player waits behind the wall for a turn. */
  fly: boolean
  bench: boolean
}

/** At a set piece, what the hands can do. */
function hintOf(g: Game): string | null {
  // Basketball, the first half-minute: how the shot meter goes (le basket de rue: once its moves have been told). Behind the wall: when it's one's turn.
  if (g.sport === 'basket' && g.street && g.ps[g.me].out) return 'Tu attends ton tour derrière le mur : tu rentres au prochain panier.'
  if (g.sport === 'basket') return g.time < 30 && (!g.street || g.time > 9) && g.ball.owner === g.me && g.phase === 'play' ? 'Tiens Tir : la jauge monte. Lâche dans le vert pour un tir parfait.' : null
  const sp = g.set
  if (!sp) return null
  const mine = sp.team === g.ps[g.me].team
  const so = !!g.shootout
  if (!mine) return sp.kind === 'pen' ? `${so ? 'Tir au but' : 'Penalty'} contre toi : le stick en haut ou en bas, ton gardien plonge de ce côté.` : null
  if (sp.taker !== g.me) return null
  switch (sp.kind) {
    case 'pen':
      return so ? 'Tir au but : vise un côté avec le stick, tiens Tir un peu (trop fort, ça passe au-dessus), lâche pour frapper.' : 'Penalty : vise avec le stick, tiens Tir pour la puissance, lâche pour frapper.'
    case 'free':
      return 'Coup franc : vise avec le stick ; Tir (tenu) frappe au but, Passe ou Centre pour un partenaire.'
    case 'corner':
      return 'Corner : Centre (ou Tir) dans la surface, Passe pour le jouer court.'
    case 'throw':
      return 'Touche : vise avec le stick et Passe.'
    default:
      return null
  }
}

function hudOf(g: Game, waiting = 0, shout: Hud['shout'] = null): Hud {
  const b = buttons(g)
  const me = g.ps[g.me]
  return {
    score: [g.score[0], g.score[1]],
    left: g.length - Math.max(0, g.time),
    time: g.time,
    flash: g.flash?.text ?? null,
    has: b.has,
    dunk: b.dunk,
    over: g.phase === 'over',
    // Basketball: won back under the basket, the player's team has to take it out past the arc.
    clear: g.sport === 'basket' && !g.cleared && g.poss === me.team && g.phase === 'play',
    waiting,
    stamina: me.stamina,
    charge: me.charge,
    meter: me.meter,
    hint: hintOf(g),
    switching: g.switching,
    pens: g.shootout ? [[...g.shootout.kicks[0]], [...g.shootout.kicks[1]]] : null,
    style: me.style,
    shout,
    fly: Math.hypot(me.x - HOOP[0], me.z - HOOP[1]) < GBE_REACH,
    bench: me.out,
  }
}

/** What the people along the wall shout at a move, a nutmeg or a sombrero, a Gbê. */
const SHOUTS = {
  geste: ['Hooo !', 'Ça c’est ivoirien !', 'Mets-lui encore !', 'Dêh ! Regarde ça !', 'C’est le Zidane du quartier !', 'On dit quoi ?!'],
  ankle: ['Hooo ! Il l’a tué !', 'Va chercher !', 'Yako, mon frère…', 'Ça c’est ivoirien !', 'Il est où ? Il est où ?!'],
  gbe: ['GBÊÊÊ !', 'Frappe de mule !', 'Le filet a crié !', 'C’est quel pied ça ?!'],
}
/** Le basket de rue's wall: at a move, a man left on the ground, a dunk, the Gbê. */
const HOOP_SHOUTS = {
  geste: ['Hooo !', 'Il danse avec lui !', 'Mets-lui encore !', 'Dêh ! Regarde ça !', 'C’est le Bronx ici !', 'On dit quoi ?!'],
  ankle: ['Il l’a cassé !', 'Hooo ! Il est assis !', 'Ramassez-le !', 'Ses chevilles sont où ?!', 'Yako, mon frère…'],
  dunk: ['Sur sa tête !', 'Le terrain est gâté !', 'Hooo ! Dunk !', 'C’est le Bronx ici !'],
  gbe: ['GBÊÊÊ !', 'Le cercle a plié !', 'Il vole, il vole !', 'C’est le Bronx ici !'],
}

export default function StreetMatch({ sport, name, look, gender, onExit, seed, online, rules, teams, kits: kitsProp, shorts }: Props) {
  // The console's football: its extra moves and its HUD.
  const fifa = sport === 'foot' && !!rules && !!(rules.referee || rules.switching || rules.size === 11)
  // Le foot de rue and le basket de rue: the street's rules and moves (not the console's: a replay, the film of it).
  const street = !!rules?.street && rules.size !== 11
  const hoops = street && sport === 'basket'
  const consoleRules = rules && !street ? rules : undefined
  const kits = kitsProp ?? KITS[sport]
  // The scoreboard's three letters: the console's own, else from the names.
  const labels = shorts ?? (teams ? [short3(teams[0]), short3(teams[1])] : null)
  // The stadium's eleven: a bigger ground to light and to see across.
  const big = sport === 'foot' && rules?.size === 11
  const [round, setRound] = useState(0)
  const game = useMemo(() => {
    let s = (seed ?? Math.floor(Math.random() * 1e9)) + round * 7919
    const r = () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const g = createGame(sport, name, r, rules)
    // At a court the player holds the place the match gave it.
    if (online) {
      const mine = online.match.entries.find((e) => e.sim === online.simId)
      if (mine && g.ps[mine.slot]) {
        g.ps[g.me].human = false
        g.ps[g.me].name = g.ps[mine.slot].name
        g.me = mine.slot
        g.ps[g.me].human = true
        g.ps[g.me].name = name
      }
    }
    return g
  }, [sport, name, seed, round, online, rules])
  // The other players at the court: who's there (polled), and the line to them.
  const [entries, setEntries] = useState<CourtEntry[]>(online?.match.entries ?? [])
  // Opened in an effect (not a memo) so it's closed with the screen, and opened again if React mounts it twice.
  const [net, setNet] = useState<MatchNet | null>(null)
  useEffect(() => {
    if (!online) return
    const n = new MatchNet(online.token, online.simId, online.match.id, online.pvp ? 'pvp' : 'match')
    setNet(n)
    return () => {
      n.close()
      setNet(null)
    }
  }, [online])
  useEffect(() => {
    if (!online || online.pvp) return
    const t = setInterval(() => fetchMatch(online.token, online.match.id).then((m) => m && setEntries(m.entries)), 3000)
    return () => clearInterval(t)
  }, [online])
  // The players who came play their place; one who went is the AI's again.
  useEffect(() => {
    if (!net) return
    const fix = () => {
      for (const p of game.ps) {
        const e = entries.find((x) => x.slot === p.id)
        p.human = p.id === game.me || (!!e && net.here(e.sim))
        if (e && p.id !== game.me) p.name = e.name
        // The street's fifth place (four a side): a ninth and tenth player come on all the same.
        if (game.street && game.sport === 'foot' && p.role === 0) p.out = !p.human
      }
      // Le basket de rue: before the whistle, the players who came onto the court (after it, at the next basket).
      seat(game)
    }
    fix()
    const t = setInterval(fix, 1000)
    return () => clearInterval(t)
  }, [net, entries, game])
  // In development, the match is reachable from the console (the labs drive it).
  if (import.meta.env.DEV) (globalThis as { streetMatch?: Game }).streetMatch = game
  // The players' looks: the player's own, in the team's colours; the others, the quarter's faces.
  const looks = useMemo(() => {
    const r = rng(`street-${sport}`)
    return game.ps.map((p) => {
      const kit = p.keeper ? (rules?.referee ? KEEPERS[p.team] : KEEPER) : kits[p.team]
      const outfit = sport === 'basket' ? 'basket' : 'jersey'
      if (p.id === game.me) return { look: { ...look, outfit, outfitColor: kit, accessory: 'none' }, gender }
      const e = entries.find((x) => x.slot === p.id)
      if (e) return { look: { ...e.look, outfit, outfitColor: kit, accessory: 'none' }, gender: e.gender }
      const g: 'femme' | 'homme' = sport === 'basket' && r() < 0.25 ? 'femme' : 'homme'
      const base = randomLook(g, r)
      return { look: { ...base, outfit, outfitColor: kit, accessory: 'none', hair: base.hair === 'headwrap' ? 'short' : base.hair }, gender: g }
    })
  }, [game, sport, look, gender, entries, kits])
  // The console's hands can hold Tir (the power) and the sprint: starting them defined is what tells the game.
  // The hands that can hold Tir: the console's football (the power), the basketball's shot meter.
  const fresh = (): Input => (fifa ? { ...NO_INPUT, charge: false, sprint: false } : sport === 'basket' ? { ...NO_INPUT, charge: false } : { ...NO_INPUT })
  const input = useRef<Input>(fresh())
  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, [])
  const [hud, setHud] = useState<Hud>(() => hudOf(game))
  useKeyboard(input, fifa, sport === 'basket', street)
  usePad(input, sport, fifa, street)
  const padOn = usePadConnected()
  const sceneSeed = `${sport}-${seed ?? 'street'}`
  // The world underneath holds still during the match.
  const held = useRef<(() => void) | null>(null)
  useEffect(() => () => held.current?.(), [])

  return (
    <div className="fixed inset-0 z-50 touch-none select-none" style={{ background: HAZE }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 50, near: 0.3, far: big ? 700 : 400, position: [0, 9, 14] }} onCreated={({ gl }) => void (held.current = holdScenes(gl.domElement))}>
        {/* The players have their own shade on the grass (scene.tsx Blob): the far figures add none. */}
        <GroundShade.Provider value={false}>
        <color attach="background" args={[HAZE]} />
        <fog attach="fog" args={[HAZE, big ? 160 : 70, big ? 520 : 260]} />
        {/* The afternoon: a warm sun high to the side, the sky's blue from above and the grass's green from below. */}
        <hemisphereLight args={['#e3f1ff', '#6f8f4f', 1.05]} />
        <directionalLight color="#fff1dc" position={big ? [40, 70, 30] : [18, 30, 14]} intensity={1.85} castShadow shadow-mapSize={[big ? 2048 : 1024, big ? 2048 : 1024]} shadow-camera-left={big ? -70 : -24} shadow-camera-right={big ? 70 : 24} shadow-camera-top={big ? 60 : 24} shadow-camera-bottom={big ? -60 : -24} shadow-camera-far={big ? 200 : 100} />
        <Sky radius={big ? 600 : 330} />
        <Suspense fallback={null}>
          {hoops ? <StreetCourt g={game} seed={sceneSeed} /> : street ? <StreetGround g={game} seed={sceneSeed} /> : <Ground g={game} seed={sceneSeed} teams={teams} />}
          {street && <GbeTrail g={game} />}
          {/* The players seen from afar a little bigger (more at the stadium, from high up), so they read as people, not sticks. */}
          <FarGrow.Provider value={big ? FAR_STADIUM : FAR_PITCH}>
            {/* The players and the referee in full, running and kicking, far up the pitch too (the crowd stays the simple figures). */}
            <NearUpTo.Provider value={big ? 70 : 45}>
              {game.ps.map((p, i) => (
                <PlayerView key={`${round}-${p.id}`} g={game} i={i} look={looks[i].look} gender={looks[i].gender} kit={kits[p.team]} />
              ))}
              <Referee g={game} />
            </NearUpTo.Provider>
            <Crowd g={game} seed={sceneSeed} />
          </FarGrow.Provider>
          <BallView g={game} />
        </Suspense>
        <Loop game={game} input={input} onHud={setHud} net={net} entries={entries} start={online?.match.start ?? 0} simId={online?.simId ?? ''} />
        <Follow g={game} />
        </GroundShade.Provider>
      </Canvas>

      {/* The score, the clock */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Like on TV: each side's colour and three letters, the score in the middle, the clock. */}
        <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
          <span className="flex items-center gap-1.5 bg-[#0f1230]/90 py-1.5 pr-2.5 pl-2">
            <span className="h-5 w-1.5 rounded-full" style={{ background: kits[0] }} />
            {labels && <span className="text-[13px] font-extrabold tracking-wide">{labels[0]}</span>}
          </span>
          <span className="flex items-center bg-white px-2.5 font-display text-[24px] leading-none font-extrabold text-[#0f1230] tabular-nums">
            {hud.score[0]}
            <span className="mx-1 text-[16px] opacity-40">-</span>
            {hud.score[1]}
          </span>
          <span className="flex items-center gap-1.5 bg-[#0f1230]/90 py-1.5 pr-2 pl-2.5">
            {labels && <span className="text-[13px] font-extrabold tracking-wide">{labels[1]}</span>}
            <span className="h-5 w-1.5 rounded-full" style={{ background: kits[1] }} />
          </span>
          <span className="flex items-center bg-[#ff8200] px-2 text-[13px] font-extrabold whitespace-nowrap tabular-nums">{game.extra ? (sport === 'basket' ? 'Panier en or' : 'But en or') : hud.pens ? <Pens pens={hud.pens} /> : mmss(hud.left)}</span>
        </div>
        <button
          className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0f1230]/70 text-white"
          onClick={() => {
            if (online && !online.pvp) void leaveMatch(online.token, online.simId, online.match.id)
            onExit(null)
          }}
          aria-label="Quitter le match"
        >
          <X size={22} />
        </button>
      </div>
      {hud.clear && <div className="pointer-events-none absolute top-[max(4.6rem,calc(env(safe-area-inset-top)+4rem))] left-1/2 -translate-x-1/2 rounded-xl bg-[#0f1230]/70 px-3 py-1 text-xs font-extrabold whitespace-nowrap text-white">Ressors la balle derrière l'arc !</div>}

      {hud.time < 1 && hud.waiting <= 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div key={Math.ceil(-hud.time)} className="animate-up font-display text-[110px] leading-none font-extrabold text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]">
            {hud.time < 0 ? Math.ceil(-hud.time) : 'Jouez !'}
          </div>
        </div>
      )}
      {hud.flash && hud.time >= 1 && !hud.over && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(4.8rem,calc(env(safe-area-inset-top)+4.2rem))] text-center">
          <span key={hud.flash} className="animate-up inline-block rounded-2xl bg-[#ffd43b] px-4 py-2 font-display text-2xl font-extrabold text-[#141416] shadow-lg">
            {hud.flash}
          </span>
        </div>
      )}

      {hud.hint && !hud.over && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(8.4rem,calc(env(safe-area-inset-top)+7.8rem))] px-4 text-center">
          <span className="inline-block max-w-md rounded-xl bg-[#0f1230]/75 px-3 py-1.5 text-xs font-extrabold text-white">{hud.hint}</span>
        </div>
      )}
      {fifa && !hud.over && <Gauges hud={hud} />}
      {sport === 'basket' && !hud.over && hud.meter >= 0 && <ShotMeter v={hud.meter} />}
      {street && !hud.over && !hud.bench && <StyleGauge v={hud.style} high={!(touch && !padOn)} ready={hoops ? (hud.fly ? 'Gbê prêt ! Tir : il s’envole !' : 'Gbê prêt ! Tir : en feu !') : undefined} />}
      {street && !hud.over && hud.time > 0 && hud.time < 9 && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(4.8rem,calc(env(safe-area-inset-top)+4.2rem))] px-4 text-center">
          {hoops ? (
            <span className="inline-block max-w-sm rounded-xl bg-[#0f1230]/75 px-3 py-1.5 text-xs font-extrabold text-white">
              {touch && !padOn ? 'Geste : tape, glisse ↑ ↓ ← →, ou tiens pour le show.' : padOn ? 'Les gestes : stick droit, X, Y, RB, LB.' : 'Les gestes : K O I U H C N, G tenu pour le show.'} Face au défenseur, au bon moment : il est par terre ! Le premier à {HOOP_TO} (2 derrière l’arc) ; qui marque garde la balle.
            </span>
          ) : (
            <span className="inline-block max-w-sm rounded-xl bg-[#0f1230]/75 px-3 py-1.5 text-xs font-extrabold text-white">{touch && !padOn ? 'Geste : tape, glisse ↑ ↓ ← →, ou tiens pour jongler.' : 'Les gestes : K U I O C H N, G tenu pour jongler.'} Face à un défenseur, au bon moment : il est dans le vent !</span>
          )}
        </div>
      )}
      {street && !hud.over && hud.shout && <Shout key={hud.shout.k} text={hud.shout.text} k={hud.shout.k} />}
      {!hud.over && (fifa ? <FifaPad input={input} hud={hud} touch={touch && !padOn} pad={padOn} /> : street ? <StreetPad input={input} hud={hud} sport={sport} touch={touch && !padOn} pad={padOn} /> : <Pad input={input} hud={hud} sport={sport} touch={touch && !padOn} pad={padOn} />)}
      {online && hud.waiting > 0 && <Waiting entries={entries} cap={online.match.cap} left={hud.waiting} sport={sport} />}

      {hud.over && (
        <Result
          game={game}
          played={!!consoleRules}
          kits={kits}
          onExit={() => {
            if (online && !online.pvp) void leaveMatch(online.token, online.simId, online.match.id)
            onExit({ sport, score: [game.score[0], game.score[1]], result: outcome(game), stats: { ...game.stats }, pens: shootoutScore(game) ?? undefined })
          }}
          // At a court the next match is the court's: back on from the street.
          onReplay={
            online || consoleRules
              ? undefined
              : () => {
                  input.current = fresh()
                  setRound((r) => r + 1)
                }
          }
        />
      )}
    </div>
  )
}

/** The match steps every frame (in small steps, so a slow phone plays the same); the HUD is refreshed ten times a second. */
function Loop({ game, input, onHud, net, entries, start, simId }: { game: Game; input: React.MutableRefObject<Input>; onHud: (h: Hud) => void; net: MatchNet | null; entries: CourtEntry[]; start: number; simId: string }) {
  const acc = useRef(0)
  const sent = useRef(0)
  const said = useRef<string | null>(null)
  const synced = useRef(false)
  // The last big moment heard (by its time: the game keeps only the last dozen), the referee's last whistle, the end.
  const seen = useRef(-99)
  const whistled = useRef(-9)
  const ended = useRef(false)
  const started = useRef(false)
  const shout = useRef<Hud['shout']>(null)
  const size = useThree((s) => s.size)
  useFrame((_, dtRaw) => {
    let total = Math.min(Math.max(dtRaw, 0), 0.25)
    // The labs step the match by hand, frame by frame (globalThis.streetLab = { frames, dt }).
    const lab = import.meta.env.DEV ? (globalThis as { streetLab?: { frames: number; dt: number } }).streetLab : undefined
    if (lab) {
      if (lab.frames <= 0) return
      lab.frames--
      total = lab.dt
    }
    const steps = Math.max(1, Math.ceil(total / (1 / 60)))
    const dt = total / steps
    // Football on a phone held upright: the camera looks up the pitch from
    // behind the player's own goal, so up the screen is the way its team
    // attacks (+x for team 0, -x for team 1) and right is +z (or -z).
    const inp = input.current
    const turned = game.sport === 'foot' && upright(size)
    const away = game.ps[game.me].team === 1
    const mine = turned ? (away ? { ...inp, mx: inp.mz, mz: -inp.mx } : { ...inp, mx: -inp.mz, mz: inp.mx }) : { ...inp }
    // At a court: nothing moves before the whistle; then the first player
    // there runs the match, the others draw what it sends.
    const waiting = start > 0 ? Math.max(0, (start - serverNow()) / 1000) : 0
    const boss = net ? net.host(entries) : simId
    const host = boss === simId
    if (net) net.press(inp)
    // At a court, nothing runs before the line to the others is open: alone, this phone would start a match of its own.
    const offline = start > 0 && !net
    // boss is null while the court is still finding out who runs it; "" (no court: the street, the labs) is this phone.
    if (waiting <= 0 && boss !== null && !offline) {
      // Taking over a match no one has run yet (its first player went): on the court's clock, not from the countdown.
      if (host && net && !synced.current) {
        const elapsed = (serverNow() - start) / 1000 - COUNTDOWN
        if (elapsed > game.time + 1) {
          game.time = elapsed
          if (elapsed >= 0) game.phase = 'play'
        }
      }
      if (net) synced.current = true
      if (host) {
        const others = net?.inputs(entries)
        for (let i = 0; i < steps; i++) {
          step(game, dt, i === 0 ? mine : { ...mine, pass: false, shoot: false, skill: false, defend: false, through: false, lob: false, swap: false, geste: null }, others)
          // The others' presses count once, on the first small step.
          if (i === 0 && others) for (const [k, v] of others) others.set(k, { ...v, pass: false, shoot: false, skill: false, defend: false, through: false, lob: false, swap: false, geste: null })
        }
        if (net && game.flash && game.flash.text !== said.current) net.say(game.flash.text)
        said.current = game.flash?.text ?? null
      } else if (!net!.apply(game, boss)) {
        // The match's phone has gone quiet: this one plays on from where it was.
        for (let i = 0; i < steps; i++) step(game, dt, i === 0 ? mine : { ...mine, pass: false, shoot: false, skill: false, defend: false, through: false, lob: false, swap: false, geste: null }, net!.inputs(entries))
      }
    }
    // A controller shakes for a goal or a basket (hard for one's own team), and for one's own big move.
    for (const m of game.moments) {
      if (m.t <= seen.current) continue
      seen.current = m.t
      const mine = m.team === game.ps[game.me].team
      if (m.kind === 'goal' || m.kind === 'basket' || m.kind === 'three' || m.kind === 'dunk') rumble(mine ? 0.9 : 0.35, mine ? 320 : 160)
      else if (m.by === game.me) rumble(0.5, 120)
      if (m.kind === 'goal') sfx.roar()
      // The street: the wall shouts at a move, roars at a nutmeg, a sombrero, a Gbê (on the court, a man left on the ground, a dunk).
      if (game.street && game.sport === 'basket' && (m.kind === 'geste' || m.kind === 'ankle' || m.kind === 'gbe' || m.kind === 'dunk')) {
        const list = HOOP_SHOUTS[m.kind]
        shout.current = { text: list[Math.floor(Math.random() * list.length)], k: m.t }
        if (m.kind === 'geste') sfx.swish()
        else sfx.roar()
      } else if (game.street && (m.kind === 'geste' || m.kind === 'ankle' || m.kind === 'gbe')) {
        const list = SHOUTS[m.kind]
        shout.current = { text: list[Math.floor(Math.random() * list.length)], k: m.t }
        if (m.kind === 'geste') sfx.swish()
        else sfx.roar()
        if (m.kind === 'gbe') sfx.kick(1)
      }
    }
    if (shout.current && game.time - shout.current.k > 1.8) shout.current = null
    // The referee's whistle: the kick-off, a foul, a set piece, the end (three long ones).
    if (game.sport === 'foot') {
      if (game.referee && game.ref.whistle > whistled.current) {
        whistled.current = game.ref.whistle
        sfx.whistle()
      }
      if (!started.current && game.time >= 0 && game.referee) {
        started.current = true
        sfx.whistle()
      }
      if (game.phase === 'over' && !ended.current) {
        ended.current = true
        if (game.referee) sfx.whistle(true)
      }
    }
    // The buttons are presses, not holds.
    inp.pass = inp.shoot = inp.skill = inp.defend = false
    inp.through = inp.lob = inp.swap = false
    inp.geste = null
    if (net) {
      sent.current += total
      if (sent.current > 0.075) {
        sent.current = 0
        const me = game.ps[game.me]
        net.send(mine, [me.x, me.z], host && waiting <= 0 ? game : null)
      }
    }
    acc.current += total
    // The HUD ten times a second; the shot meter climbing, every few hundredths (it's timed by the eye).
    if (acc.current > (game.ps[game.me].meter >= 0 ? 0.03 : 0.1)) {
      acc.current = 0
      onHud(hudOf(game, waiting, shout.current))
    }
  })
  return null
}

/** Before the whistle at a court: who has come, how many places are left, the countdown. */
function Waiting({ entries, cap, left, sport }: { entries: CourtEntry[]; cap: number; left: number; sport: Sport }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(5rem,calc(env(safe-area-inset-top)+4.5rem))] grid place-items-center px-4">
      <div className="sheet animate-up w-full max-w-sm rounded-[24px] p-4">
        <div className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Users size={20} className="text-[var(--color-orange)]" />
          {sport === 'foot' ? 'Match de foot' : 'Match de basket'} dans {Math.ceil(left)} s
        </div>
        <div className="mt-1 text-xs font-bold text-[var(--color-muted)]">
          {entries.length}/{cap} joueurs · les places libres sont prises par les gars du quartier. Tes amis te rejoignent en venant jouer ici.
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entries.map((e) => (
            <li key={e.sim} className="motion-rise rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-xs font-extrabold">
              {e.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The keys of the street's moves (K the stepover; C, the crochet key, the fake shot). */
const GESTE_KEYS: Record<string, Geste> = { KeyK: 'passement', KeyU: 'roulette', KeyI: 'petitpont', KeyO: 'sombrero', KeyC: 'crochet', KeyH: 'aile', KeyN: 'talonnade' }
/** Le basket de rue's, on the same keys as the foot's gestures (the swipe each key stands for): K the crossover, O between the legs, I behind the back, U the spin, H the hesitation, C the pump fake, N the step-back. */
const HOOP_KEYS: Record<string, Geste> = { KeyK: 'crossover', KeyO: 'entrejambe', KeyI: 'dos', KeyU: 'spin', KeyH: 'hesitation', KeyC: 'pompe', KeyN: 'stepback' }

/** The keyboard: arrows / WASD / ZQSD, Space shoot, J or X pass, K or C crossover, L or E defend; the street, its moves (GESTE_KEYS, G held the keepy-ups). */
function useKeyboard(input: React.MutableRefObject<Input>, fifa: boolean, basket: boolean, street = false) {
  useEffect(() => {
    const keys = new Set<string>()
    const apply = () => {
      const i = input.current
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('KeyQ') ? 1 : 0)
      const z = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyZ') ? 1 : 0)
      const l = Math.hypot(x, z) || 1
      i.mx = x / l
      i.mz = z / l
      i.guard = keys.has('KeyL') || keys.has('KeyE')
      // The console: Shift sprints, Space held charges the shot.
      if (fifa) {
        i.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight')
        i.charge = keys.has('Space')
      }
      // Basketball: Space held, the shot meter.
      if (basket) i.charge = keys.has('Space')
      if (street) i.juggle = keys.has('KeyG')
    }
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault()
      if (!e.repeat) {
        if (e.code === 'Space') input.current.shoot = true
        if (e.code === 'KeyJ' || e.code === 'KeyX') input.current.pass = true
        const moves = basket ? HOOP_KEYS : GESTE_KEYS
        if (street && moves[e.code]) input.current.geste = moves[e.code]
        else if (e.code === 'KeyK' || e.code === 'KeyC') input.current.skill = true
        if (e.code === 'KeyL' || e.code === 'KeyE') input.current.defend = true
        if (fifa && e.code === 'KeyU') input.current.through = true
        if (fifa && e.code === 'KeyI') input.current.lob = true
        if (fifa && (e.code === 'Tab' || e.code === 'KeyR')) input.current.swap = true
      }
      keys.add(e.code)
      apply()
    }
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code)
      apply()
    }
    const blur = () => {
      keys.clear()
      apply()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [input, fifa, basket, street])
}

/** The stick: drag the knob to run; it springs back on release. */
function Stick({ input }: { input: React.MutableRefObject<Input> }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false })
  const release = () => {
    input.current.mx = input.current.mz = 0
    setKnob({ x: 0, y: 0, on: false })
  }
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    const R = r.width * 0.38
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) [dx, dy] = [(dx / d) * R, (dy / d) * R]
    setKnob({ x: dx, y: dy, on: true })
    const m = Math.hypot(dx, dy) / R
    const k = m < 0.12 ? 0 : (m - 0.12) / 0.88 / (m || 1)
    input.current.mx = (dx / R) * k
    input.current.mz = (dy / R) * k
  }
  useEffect(() => () => void (input.current.mx = input.current.mz = 0), [input])
  return (
    <div
      ref={base}
      role="slider"
      aria-label="Courir"
      aria-valuetext={knob.on ? 'en course' : 'à l’arrêt'}
      className="pointer-events-auto relative grid h-32 w-32 shrink-0 touch-none place-items-center rounded-full border-4 border-white/50 bg-[#0f1230]/35"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={(e) => knob.on && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className="block h-14 w-14 rounded-full bg-[#ff8200] shadow-[0_6px_16px_-6px_rgba(224,90,0,0.9)]" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}

/** The four moves on the right; their labels follow what they do now (with the ball or without). */
function Pad({ input, hud, sport, touch, pad }: { input: React.MutableRefObject<Input>; hud: Hud; sport: Sport; touch: boolean; /** A controller is plugged in: its buttons on the moves. */ pad: boolean }) {
  const press = (k: 'pass' | 'shoot' | 'skill' | 'defend') => (e: React.PointerEvent) => {
    e.preventDefault()
    input.current[k] = true
    if (k === 'defend') input.current.guard = true
  }
  const lift = () => (input.current.guard = false)
  const btn = 'pointer-events-auto grid place-items-center rounded-full font-display font-extrabold shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-[3px] active:shadow-[0_3px_0_rgba(0,0,0,0.25)] transition-opacity'
  const off = 'opacity-45'
  const basket = sport === 'basket'
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Stick input={input} />
      <div className="flex flex-col items-end gap-2">
        {!touch && <span className="text-right text-[11px] font-bold text-white drop-shadow">{pad ? 'Manette : stick gauche courir · A passe · B tir · X crochet · RB défense' : 'Flèches courir · Espace tir · J passe (sans le ballon : appelle) · K crochet · L défense'}</span>}
        <div className="grid grid-cols-2 gap-3">
          <button className={`${btn} relative h-16 w-16 bg-[#2563eb] text-sm text-white`} onPointerDown={press('pass')}>
            {hud.has ? 'Passe' : 'Appelle'}
            {!touch && <Key>{pad ? 'A' : 'J'}</Key>}
          </button>
          <button
            className={`${btn} relative h-20 w-20 text-base text-white ${hud.dunk ? 'animate-pulse bg-[#e11d48]' : 'bg-[#ff8200]'} ${!hud.has && !basket ? off : ''}`}
            onPointerDown={(e) => {
              // Basketball: held, the shot meter fills; let go, the ball leaves.
              if (basket) ((e.target as HTMLElement).setPointerCapture?.(e.pointerId), (input.current.charge = true))
              press('shoot')(e)
            }}
            onPointerUp={() => basket && (input.current.charge = false)}
            onPointerCancel={() => basket && (input.current.charge = false)}
          >
            {hud.dunk ? 'Dunk !' : hud.has ? 'Tir' : basket ? 'Saut' : 'Tir'}
            {!touch && <Key>{pad ? 'B' : 'Espace'}</Key>}
          </button>
          <button className={`${btn} relative h-16 w-16 bg-[#ffd43b] text-xs text-[#141416] ${hud.has ? '' : off}`} onPointerDown={press('skill')}>
            {basket ? 'Crossover' : 'Crochet'}
            {!touch && <Key>{pad ? 'X' : 'K'}</Key>}
          </button>
          <button className={`${btn} relative h-16 w-16 bg-[#16a34a] text-xs text-white ${hud.has ? off : ''}`} onPointerDown={press('defend')} onPointerUp={lift} onPointerCancel={lift} onPointerLeave={lift}>
            Défense
            {!touch && <Key>{pad ? 'RB' : 'L'}</Key>}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * A controller: the left stick (or the cross) runs, A passes or calls, B
 * shoots or jumps, X the crossover, RB (or LB, LT) defends, held for the
 * stance. Written into the same input as the keys and the touch buttons.
 */
function usePad(input: React.MutableRefObject<Input>, sport: Sport, fifa: boolean, street = false) {
  const run = useMemo(() => stickOwner(), [])
  const guard = useRef(false)
  const held = useRef({ sprint: false, charge: false })
  const flicked = useRef(false)
  useGamepad((p) => {
    const i = input.current
    const dx = (p.held.has('right') ? 1 : 0) - (p.held.has('left') ? 1 : 0)
    const dy = (p.held.has('down') ? 1 : 0) - (p.held.has('up') ? 1 : 0)
    const [x, y] = p.lx || p.ly ? [p.lx, p.ly] : [dx, dy]
    run(x, y, (mx, mz) => ((i.mx = mx), (i.mz = mz)))
    if (p.pressed.has('a')) i.pass = true
    if (p.pressed.has('b')) i.shoot = true
    if (street) {
      // The street, as the big street games lay it out: the right stick flicked for the moves (like the Geste button's swipes),
      // X the stepover, Y the flick, RB the fake shot, LB the back-heel, the right stick pressed in held for the keepy-ups; LT defends.
      // (Le basket de rue the same: X the crossover, Y the hesitation, RB the pump fake, LB the step-back, R3 held the show; B held the shot meter.)
      const hoop = sport === 'basket'
      const r = Math.hypot(p.rx, p.ry)
      if (r > 0.7 && !flicked.current) i.geste = (hoop ? HOOP_SWIPE : SWIPE)[Math.abs(p.rx) > Math.abs(p.ry) ? (p.rx > 0 ? 'right' : 'left') : p.ry > 0 ? 'down' : 'up']
      flicked.current = r > 0.4
      if (p.pressed.has('x')) i.geste = hoop ? 'crossover' : 'passement'
      if (p.pressed.has('y')) i.geste = hoop ? 'hesitation' : 'aile'
      if (p.pressed.has('rb')) i.skill = true
      if (p.pressed.has('lb')) i.geste = hoop ? 'stepback' : 'talonnade'
      i.juggle = p.held.has('rs')
      if (hoop) {
        const charge = p.held.has('b')
        if (charge !== held.current.charge) i.charge = charge
        held.current = { ...held.current, charge }
      }
      const g = p.lt > 0.4
      if (g && !guard.current) i.defend = true
      if (g !== guard.current) i.guard = g
      guard.current = g
      return
    }
    if (fifa && sport === 'foot') {
      // The console's football, as the big football games lay it out: X the lob, Y the through ball, RB the crochet, LB changes player, RT sprints, B held the power, LT defends.
      if (p.pressed.has('x')) i.lob = true
      if (p.pressed.has('y')) i.through = true
      if (p.pressed.has('rb')) i.skill = true
      if (p.pressed.has('lb')) i.swap = true
      const now = { sprint: p.rt > 0.3, charge: p.held.has('b') }
      if (now.sprint !== held.current.sprint) i.sprint = now.sprint
      if (now.charge !== held.current.charge) i.charge = now.charge
      held.current = now
      const g = p.lt > 0.4
      if (g && !guard.current) i.defend = true
      if (g !== guard.current) i.guard = g
      guard.current = g
      return
    }
    if (p.pressed.has('x') || p.pressed.has('y')) i.skill = true
    // Basketball: B held, the shot meter.
    if (sport === 'basket') {
      const charge = p.held.has('b')
      if (charge !== held.current.charge) i.charge = charge
      held.current = { ...held.current, charge }
    }
    const g = p.held.has('rb') || p.held.has('lb') || p.lt > 0.4
    if (g && !guard.current) i.defend = true
    if (g !== guard.current) i.guard = g
    guard.current = g
  })
}

/** The console's football on a phone: the breath and, Tir held, the power. */
/** Basketball's shot meter: it climbs while Tir is held; let go in the green for « Parfait ! ». */
function ShotMeter({ v }: { v: number }) {
  const [lo, hi] = METER_GOOD
  const good = v >= lo && v <= hi
  return (
    <div className="pointer-events-none absolute right-[7.5rem] bottom-[max(12rem,calc(env(safe-area-inset-bottom)+11.5rem))] flex flex-col items-center gap-1">
      <div className="relative h-36 w-5 overflow-hidden rounded-full bg-[#0f1230]/70 ring-2 ring-white/70">
        <div className="absolute inset-x-0 bg-[#2fd27a]/80" style={{ bottom: `${lo * 100}%`, height: `${(hi - lo) * 100}%` }} />
        <div className={`absolute inset-x-0 bottom-0 ${good ? 'bg-[#fff36b]' : 'bg-white/90'}`} style={{ height: `${Math.min(1, v) * 100}%` }} />
      </div>
      <span className="rounded-full bg-[#0f1230]/70 px-2 text-[11px] font-extrabold text-white">{good ? 'Lâche !' : 'Tiens…'}</span>
    </div>
  )
}

function Gauges({ hud }: { hud: Hud }) {
  return (
    <div className="pointer-events-none absolute bottom-[max(10.5rem,calc(env(safe-area-inset-bottom)+10rem))] left-4 w-36 space-y-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-[#0f1230]/50">
        <div className={`h-full rounded-full ${hud.stamina < 0.25 ? 'bg-[#e03131]' : 'bg-[#37b24d]'}`} style={{ width: `${Math.round(hud.stamina * 100)}%` }} />
      </div>
      {hud.charge > 0 && (
        <div className="h-3 overflow-hidden rounded-full bg-[#0f1230]/60">
          <div className={`h-full rounded-full ${hud.charge > 0.85 ? 'bg-[#e03131]' : 'bg-[#ffd43b]'}`} style={{ width: `${Math.round(hud.charge * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

/**
 * The console's football buttons: Passe, Tir (held: the power), Profondeur,
 * Centre, Crochet, and Sprint held by the stick. Without the ball, Passe
 * changes player and Tir tackles. Their keys and pad buttons in the corners.
 */
function FifaPad({ input, hud, touch, pad }: { input: React.MutableRefObject<Input>; hud: Hud; touch: boolean; pad: boolean }) {
  const press = (k: 'pass' | 'through' | 'lob' | 'skill' | 'swap') => (e: React.PointerEvent) => {
    e.preventDefault()
    input.current[k] = true
  }
  const hold = (k: 'charge' | 'sprint') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      input.current[k] = true
      if (k === 'charge') input.current.shoot = true
    },
    onPointerUp: () => void (input.current[k] = false),
    onPointerCancel: () => void (input.current[k] = false),
  })
  const btn = 'pointer-events-auto relative grid place-items-center rounded-full font-display font-extrabold shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-[3px] active:shadow-[0_3px_0_rgba(0,0,0,0.25)] transition-opacity select-none'
  const off = 'opacity-45'
  const k = (keyName: string, padName: string) => !touch && <Key>{pad ? padName : keyName}</Key>
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-3">
        <Stick input={input} />
        <button className={`${btn} h-14 w-14 bg-[#0f1230]/70 text-[11px] text-white`} {...hold('sprint')}>
          Sprint
          {k('Maj', 'RT')}
        </button>
      </div>
      <div className="flex flex-col items-end gap-2">
        {!touch && <span className="text-right text-[11px] font-bold text-white drop-shadow">{pad ? 'RT sprint · B tenu tir · A passe · Y profondeur · X centre · RB crochet · LB changer' : 'Maj sprint · Espace tenu tir · J passe · U profondeur · I centre · K crochet · Tab changer'}</span>}
        <div className="grid grid-cols-3 gap-2.5">
          <button className={`${btn} h-14 w-14 bg-[#7048e8] text-[11px] text-white ${hud.has ? '' : off}`} onPointerDown={press('through')}>
            Profondeur
            {k('U', 'Y')}
          </button>
          <button className={`${btn} h-14 w-14 bg-[#0ca678] text-[11px] text-white ${hud.has ? '' : off}`} onPointerDown={press('lob')}>
            Centre
            {k('I', 'X')}
          </button>
          <button className={`${btn} h-14 w-14 bg-[#ffd43b] text-[11px] text-[#141416] ${hud.has ? '' : off}`} onPointerDown={press('skill')}>
            Crochet
            {k('K', 'RB')}
          </button>
          <button className={`${btn} col-span-1 h-16 w-16 bg-[#2563eb] text-sm text-white`} onPointerDown={press(hud.has || !hud.switching ? 'pass' : 'swap')}>
            {hud.has ? 'Passe' : hud.switching ? 'Changer' : 'Appel'}
            {k(hud.has ? 'J' : 'Tab', hud.has ? 'A' : 'LB')}
          </button>
          <button className={`${btn} col-span-2 h-16 w-full rounded-3xl text-base text-white ${hud.has ? 'bg-[#ff8200]' : 'bg-[#e03131]'}`} {...hold('charge')}>
            {hud.has ? 'Tir (tiens)' : 'Tacle'}
            {k('Espace', 'B')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The Geste button's swipes, and the move each one is. */
type Swipe = 'up' | 'down' | 'left' | 'right'
const SWIPE: Record<Swipe, Geste> = { up: 'sombrero', down: 'petitpont', left: 'roulette', right: 'aile' }
const SWIPE_LABEL: Record<Swipe | 'tap' | 'hold', string> = { up: 'Sombrero', down: 'Petit pont', left: 'Roulette', right: 'Aile de pigeon', tap: 'Passement', hold: 'Jongles' }
/** Le basket de rue's. */
const HOOP_SWIPE: Record<Swipe, Geste> = { up: 'entrejambe', down: 'dos', left: 'spin', right: 'hesitation' }
const HOOP_LABEL: Record<Swipe | 'tap' | 'hold', string> = { up: 'Entre les jambes', down: 'Dans le dos', left: 'Spin', right: 'Hésitation', tap: 'Crossover', hold: 'Show' }

/**
 * Le foot de rue on a phone: Passe, Tir (with the style gauge full, the Gbê),
 * Feinte (a tap: the fake shot; a swipe: the back-heel) and Geste: a tap the
 * stepover, a swipe up the sombrero, down the nutmeg, left the Marseille
 * turn, right the flick; held, the keepy-ups. Without the ball, Geste is
 * Défense (held: the stance). Le basket de rue: Tir held for the shot meter
 * (Saut without the ball), Geste's tap the crossover, up between the legs,
 * down behind the back, left the spin, right the hesitation, held the
 * dribble show; Feinte the pump fake, swiped the step-back.
 */
function StreetPad({ input, hud, sport, touch, pad }: { input: React.MutableRefObject<Input>; hud: Hud; sport: Sport; touch: boolean; pad: boolean }) {
  const btn = 'pointer-events-auto relative grid place-items-center rounded-full font-display font-extrabold shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-[3px] active:shadow-[0_3px_0_rgba(0,0,0,0.25)] transition-opacity select-none touch-none'
  const off = 'opacity-45'
  const press = (k: 'pass' | 'shoot') => (e: React.PointerEvent) => {
    e.preventDefault()
    input.current[k] = true
  }
  const gbe = hud.has && hud.style >= 1
  const hoop = sport === 'basket'
  // Basketball: Tir held fills the shot meter, let go the ball leaves.
  const lift = () => void (hoop && (input.current.charge = false))
  const help = hoop
    ? pad
      ? 'B tenu tir · A passe · X crossover · Y hésitation · RB feinte · LB step-back · stick droit ↑ jambes ↓ dos ← spin · R3 show · LT défense'
      : 'Espace tenu tir · J passe · L défense · K crossover · O jambes · I dos · U spin · H hésitation · C feinte · N step-back · G show'
    : pad
      ? 'B tir · A passe · X passement · Y aile de pigeon · RB feinte · LB talonnade · stick droit : ↑ sombrero ↓ petit pont ← → roulette / aile · R3 tenu jongles · LT défense'
      : 'Espace tir · J passe · L défense · K passement · U roulette · I petit pont · O sombrero · C feinte · H aile de pigeon · N talonnade · G tenu jongles'
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Stick input={input} />
      <div className="flex flex-col items-end gap-2">
        {!touch && <span className="max-w-[22rem] text-right text-[11px] font-bold text-white drop-shadow">{help}</span>}
        <div className="grid grid-cols-2 items-center justify-items-center gap-3">
          <button className={`${btn} h-16 w-16 bg-[#2563eb] text-sm text-white`} onPointerDown={press('pass')}>
            {hud.has ? 'Passe' : 'Appelle'}
            {!touch && <Key>{pad ? 'A' : 'J'}</Key>}
          </button>
          <button
            className={`${btn} h-20 w-20 text-base text-white ${gbe ? 'animate-pulse bg-gradient-to-b from-[#ffd43b] to-[#e8590c] text-lg' : hud.dunk ? 'animate-pulse bg-[#e11d48]' : 'bg-[#ff8200]'} ${hud.has || hoop ? '' : off}`}
            onPointerDown={(e) => {
              if (hoop) ((e.target as HTMLElement).setPointerCapture?.(e.pointerId), (input.current.charge = true))
              press('shoot')(e)
            }}
            onPointerUp={lift}
            onPointerCancel={lift}
          >
            {gbe ? 'GBÊ !' : hoop && hud.dunk ? 'Dunk !' : hoop && !hud.has ? 'Saut' : 'Tir'}
            {!touch && <Key>{pad ? 'B' : 'Espace'}</Key>}
          </button>
          <GesteButton input={input} has={hud.has} hoop={hoop} touch={touch} pad={pad} className={btn} />
          <FeinteButton input={input} has={hud.has} hoop={hoop} touch={touch} pad={pad} className={`${btn} ${hud.has ? '' : off}`} />
        </div>
      </div>
    </div>
  )
}

/** The Geste button: a tap, a swipe each way (the move fires as the finger crosses), held for the keepy-ups; the moves round it while it's held. */
function GesteButton({ input, has, hoop, touch, pad, className }: { input: React.MutableRefObject<Input>; has: boolean; /** Le basket de rue's moves. */ hoop: boolean; touch: boolean; pad: boolean; className: string }) {
  const [moves, labels] = hoop ? [HOOP_SWIPE, HOOP_LABEL] : [SWIPE, SWIPE_LABEL]
  const st = useRef<{ x: number; y: number; done: boolean; timer: ReturnType<typeof setTimeout> | null } | null>(null)
  const [open, setOpen] = useState<null | Swipe | 'tap' | 'hold' | 'ring'>(null)
  const end = () => {
    const s = st.current
    if (s?.timer) clearTimeout(s.timer)
    input.current.juggle = false
    input.current.guard = false
    st.current = null
    setTimeout(() => setOpen(null), 260)
  }
  useEffect(() => () => void (st.current?.timer && clearTimeout(st.current.timer)), [])
  return (
    <div className="relative">
      <button
        className={`${className} h-20 w-20 text-sm ${has ? 'bg-[#7048e8] text-white' : 'bg-[#16a34a] text-white'}`}
        onPointerDown={(e) => {
          e.preventDefault()
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          if (!has) {
            input.current.defend = true
            input.current.guard = true
            st.current = { x: e.clientX, y: e.clientY, done: true, timer: null }
            return
          }
          const s = { x: e.clientX, y: e.clientY, done: false, timer: null as ReturnType<typeof setTimeout> | null }
          // Held still: the keepy-ups, for as long as it's held.
          s.timer = setTimeout(() => {
            if (st.current !== s || s.done) return
            s.done = true
            input.current.juggle = true
            setOpen('hold')
          }, 320)
          st.current = s
          setOpen('ring')
        }}
        onPointerMove={(e) => {
          const s = st.current
          if (!s || s.done) return
          const [dx, dy] = [e.clientX - s.x, e.clientY - s.y]
          if (Math.hypot(dx, dy) < 26) return
          const dir: Swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
          s.done = true
          input.current.geste = moves[dir]
          setOpen(dir)
        }}
        onPointerUp={() => {
          const s = st.current
          if (s && !s.done) {
            input.current.geste = hoop ? 'crossover' : 'passement'
            setOpen('tap')
          }
          end()
        }}
        onPointerCancel={end}
      >
        {has ? 'Geste' : 'Défense'}
        {!touch && <Key>{pad ? 'X' : 'K'}</Key>}
        {/* Little arrows round it: there's more than a tap. */}
        {has && touch && (
          <>
            <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[9px] leading-none opacity-70">▲</span>
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] leading-none opacity-70">▼</span>
            <span className="absolute top-1/2 left-1 -translate-y-1/2 text-[9px] leading-none opacity-70">◀</span>
            <span className="absolute top-1/2 right-1 -translate-y-1/2 text-[9px] leading-none opacity-70">▶</span>
          </>
        )}
      </button>
      {open && has && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {(['up', 'down', 'left', 'right'] as Swipe[]).map((d) => (
            <span
              key={d}
              className={`absolute rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap shadow ${open === d ? 'bg-[#ffd43b] text-[#141416]' : 'bg-[#0f1230]/80 text-white'}`}
              style={d === 'up' ? { left: '50%', top: -26, transform: 'translateX(-50%)' } : d === 'down' ? { left: '50%', bottom: -16, transform: 'translateX(-50%)' } : d === 'left' ? { right: '100%', top: '50%', transform: 'translate(-6px,-50%)' } : { left: '100%', top: '50%', transform: 'translate(6px,-50%)' }}
            >
              {labels[d]}
            </span>
          ))}
          {(open === 'tap' || open === 'hold') && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd43b] px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap text-[#141416] shadow">{labels[open]}</span>}
        </div>
      )}
    </div>
  )
}

/** Feinte: a tap, the fake shot (the crochet); a swipe any way, the back-heel (le basket de rue: the pump fake, the step-back). */
function FeinteButton({ input, has, hoop, touch, pad, className }: { input: React.MutableRefObject<Input>; has: boolean; hoop: boolean; touch: boolean; pad: boolean; className: string }) {
  const st = useRef<{ x: number; y: number; done: boolean } | null>(null)
  return (
    <button
      className={`${className} h-16 w-16 bg-[#ffd43b] text-[11px] leading-tight text-[#141416]`}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        st.current = { x: e.clientX, y: e.clientY, done: false }
      }}
      onPointerMove={(e) => {
        const s = st.current
        if (!s || s.done || Math.hypot(e.clientX - s.x, e.clientY - s.y) < 26) return
        s.done = true
        input.current.geste = hoop ? 'stepback' : 'talonnade'
      }}
      onPointerUp={() => {
        if (st.current && !st.current.done) input.current.skill = true
        st.current = null
      }}
      onPointerCancel={() => void (st.current = null)}
    >
      <span>
        Feinte
        {touch && has && <span className="block text-[8px] font-bold opacity-70">{hoop ? 'glisse : step-back' : 'glisse : talonnade'}</span>}
      </span>
      {!touch && <Key>{pad ? 'RB' : 'C'}</Key>}
    </button>
  )
}

/** The style gauge: each move fills it; full, the next shot is the Gbê (`ready`: what it says then, on the court). */
function StyleGauge({ v, ready, high }: { v: number; ready?: string; /** Over the keys' help (a computer, a controller). */ high?: boolean }) {
  const full = v >= 1
  return (
    <div className={`pointer-events-none absolute right-4 w-40 ${high ? 'bottom-[max(15.4rem,calc(env(safe-area-inset-bottom)+14.9rem))]' : 'bottom-[max(13.2rem,calc(env(safe-area-inset-bottom)+12.7rem))]'}`}>
      <div className={`mb-0.5 text-right text-[11px] font-extrabold text-white drop-shadow ${full ? 'animate-pulse text-[#ffd43b]' : ''}`}>{full ? (ready ?? 'Gbê prêt ! Frappe !') : 'Style'}</div>
      <div className="h-3 overflow-hidden rounded-full bg-[#0f1230]/60 ring-2 ring-white/60">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ffd43b] via-[#ff8200] to-[#e03131] transition-[width] duration-200" style={{ width: `${Math.round(Math.min(1, v) * 100)}%` }} />
      </div>
    </div>
  )
}

/** What someone along the wall shouts, in a bubble: left or right, by the moment. */
function Shout({ text }: { text: string; k: number }) {
  // (On the left: the style gauge is on the right.)
  const left = true
  return (
    <div className={`pointer-events-none absolute top-[max(8.6rem,calc(env(safe-area-inset-top)+8rem))] ${left ? 'left-4' : 'right-4'}`}>
      <span className="animate-up relative inline-block rounded-2xl bg-white px-3 py-1.5 font-display text-lg font-extrabold text-[#141416] shadow-lg">
        {text}
        <span className={`absolute -bottom-1.5 h-3 w-3 rotate-45 bg-white ${left ? 'left-4' : 'right-4'}`} />
      </span>
    </div>
  )
}

/** On a computer: the key of a move, in the corner of its button. */
function Key({ children }: { children: string }) {
  return <kbd className="absolute -top-1.5 -right-1.5 rounded-md bg-white px-1 font-sans text-[10px] leading-4 font-extrabold text-[#141416] shadow">{children}</kbd>
}

/** The shoot-out's kicks in place of the clock, the player's side on top: green for each in, red for each missed, rings for the five still to come (sudden death: the last five). */
function Pens({ pens }: { pens: [boolean[], boolean[]] }) {
  const n = Math.max(5, pens[0].length, pens[1].length)
  const from = n - 5
  return (
    <span className="flex flex-col gap-0.5 py-0.5" aria-label="Tirs au but">
      {pens.map((row, t) => (
        <span key={t} className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, k) => {
            const i = from + k
            return <span key={k} className={`h-2.5 w-2.5 rounded-full ${i >= row.length ? 'ring-1 ring-white/45' : row[i] ? 'bg-[#40c057]' : 'bg-[#fa5252]'}`} />
          })}
        </span>
      ))}
    </span>
  )
}

/** The final whistle: the score, what the player did, what the people filming made of it. */
function Result({ game, onExit, onReplay, played, kits }: { game: Game; onExit: () => void; onReplay?: () => void; /** On the console: no film of it, and it goes on. */ played?: boolean; /** The two sides' shirts. */ kits: [string, string] }) {
  const r = outcome(game)
  const pens = shootoutScore(game)
  const s = game.stats
  const foot = game.sport === 'foot'
  const lines: [string, number][] = (
    foot
      ? [
          ['Buts', s.goals],
          ['Passes décisives', s.assists],
          ['Ballons récupérés', s.steals],
          [game.street ? 'Gestes réussis' : 'Chevilles cassées', s.ankles],
        ]
      : [
          ['Points', s.points],
          ['Dunks', s.dunks],
          ['Passes décisives', s.assists],
          ['Interceptions', s.steals],
          ['Contres', s.blocks],
          [game.street ? 'Gestes réussis' : 'Chevilles cassées', s.ankles],
        ]
  ) as [string, number][]
  // The player's best moment, filmed from the fence.
  const best = s.dunks ? 'ton dunk' : s.goals ? 'ton but' : s.ankles ? (game.street ? 'ton geste' : 'ta cheville cassée') : s.blocks ? 'ton contre' : null
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0f1230]/60 p-4">
      <div className="sheet animate-up w-full max-w-sm rounded-[28px] p-5">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-[var(--color-orange)]" />
          <div className="font-display text-2xl font-extrabold">{r === 'win' ? 'Victoire !' : r === 'loss' ? 'Défaite…' : 'Match nul'}</div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3 font-display text-4xl font-extrabold tabular-nums">
          <span className="h-5 w-5 rounded ring-1 ring-black/15" style={{ background: kits[0] }} />
          {game.score[0]} - {game.score[1]}
          <span className="h-5 w-5 rounded ring-1 ring-black/15" style={{ background: kits[1] }} />
        </div>
        {pens && <div className="text-center text-sm font-extrabold text-[var(--color-ink-soft)] tabular-nums">Tirs au but : {pens[0]} - {pens[1]}</div>}
        <ul className="mt-3 grid grid-cols-2 gap-1.5">
          {lines.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between rounded-xl bg-[var(--color-canvas)] px-3 py-1.5 text-sm font-extrabold">
              <span className="text-xs">{k}</span>
              <span className="tabular-nums">{v}</span>
            </li>
          ))}
        </ul>
        {best && !played && <p className="mt-2 rounded-xl bg-[#fff1f5] px-3 py-2 text-xs font-bold text-[#9d174d]">Au bord du terrain, on a filmé {best} : posté sur Tikitoko, ♥ {likesFor(game.score[0] + s.points + s.goals * 3)}</p>}
        <div className={`mt-4 grid gap-2 ${onReplay ? 'grid-cols-2' : ''}`}>
          <button className={`btn ${played ? '' : 'btn-soft'}`} onClick={onExit}>
            {played ? 'Continuer' : 'Sortir'}
          </button>
          {onReplay && (
            <button className="btn" onClick={onReplay}>
              <RotateCcw size={18} /> Rejouer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
