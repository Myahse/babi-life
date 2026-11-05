import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RotateCcw, Trophy } from 'lucide-react'
import type { Look } from '../lib/types'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { holdScenes } from '../world3d/hold'
import { Sky, HAZE } from '../streetball/looks'
import { GroundShade } from '../avatar/LowHuman'
import { NearUpTo } from '../avatar/Human'
import { fetchMatch, leaveMatch, type CourtEntry, type CourtMatch } from '../streetball/online'
import { t as tr, tx } from '../lib/i18n'
import { AIR, BALL_R, boardOf, createTennis, mustServe, seeded, serveTarget, stepTennis, type ServeZone, type Shot, type TInput, type Tennis, type TennisRules } from './tennis'
import { TCAM, TennisAids, TennisBall, TennisCam, TennisGround, TennisPlayer, type Venue } from './tennisScene'
import { TennisFeel, hitStop } from './feel'
import { SportTape, playTape, startTape, type SportReplay } from './tape'
import { Call, Close, Comment, Countdown, Hold, ReplayBars, Stick, useKeys, type Hands } from './kit'
import { SportNet } from './net'
import { coast, tHands, tInput, tennisWire } from './wire'

// The tennis match one plays (opened from the game screen at a tennis court, Play.tsx; the lab: city.html?view=tennis):
// against the AI at the level picked, or against the other player at the court (the court's match, two places).
// The stick runs (the player runs alone to the ball when it's let go: the phone's assist) and aims (at the release);
// the buttons are the strokes, held for the power and released just before the ball comes; at the serve the
// same buttons toss the ball up (À plat, Lifté, Slicé), released when it's at its top.

type Props = {
  name: string
  look: Look
  gender: 'femme' | 'homme'
  onExit: () => void
  seed?: number
  rules?: TennisRules
  venue?: Venue
  online?: { token: string; simId: string; match: CourtMatch }
}

const FOES_M = ['Adama Koné', 'Yannick Kouassi', 'Fousseni Bamba', 'Kevin N’Guessan', 'Patrick Yao']
const FOES_F = ['Rachelle Konan', 'Hawa Cissé', 'Christelle Aka', 'Grâce Koffi', 'Mireille Kanga']
const LEVEL_NAMES = () => [tr('Débutant'), tr('Club'), tr('Confirmé'), tr('Pro')]
const KEYS: Record<string, Shot> = { KeyJ: 'top', Space: 'top', KeyK: 'slice', KeyL: 'lob', KeyU: 'drop', KeyI: 'flat' }
const JUDGE: Record<string, () => string> = { Parfait: () => tr('Parfait !'), 'Trop tôt': () => tr('Trop tôt'), 'Trop tard': () => tr('Trop tard'), 'En retard': () => tr('En retard') }

type Hud = { time: number; phase: Tennis['phase']; serve: boolean; /** Serving: the zone the stick picks, and which ball (0 the first, 1 the second). */ zone: ServeZone; ball: 0 | 1; call: { text: string; k: number } | null; judge: { text: string; k: number } | null; say: { text: string; k: number } | null; replay: boolean; speed: number | null; coming: boolean; board: ReturnType<typeof boardOf> }

function hudOf(g: Tennis, feel: TennisFeel | null, replay: boolean): Hud {
  const sv = g.moments.findLast((m) => m.kind === 'hit' && m.text === 'serve')
  const me = g.ps[g.me]
  return {
    time: g.time,
    phase: g.phase,
    // (Through the toss too: the serve's buttons stay under the thumb until the ball is struck.)
    serve: mustServe(g) || (g.phase === 'toss' && g.server === g.me && me.human),
    zone: serveTarget(g, me, me.aim[0]).zone,
    ball: g.fault,
    call: g.call && g.time - g.call.t < 1.8 ? { text: g.call.text, k: g.call.t } : null,
    judge: g.judge && g.time - g.judge.t < 1.2 ? { text: g.judge.text, k: g.judge.t } : null,
    say: feel?.comment ?? null,
    replay,
    speed: sv && g.time - sv.t < 2.5 && sv.by >= 0 ? Math.round((sv.v ?? 0) * 3.6) : null,
    coming: g.phase === 'rally' && g.ball.hitBy !== g.me && !g.ps[g.me].press && !g.ps[g.me].shot,
    board: boardOf(g),
  }
}

export default function TennisMatch({ name, look, gender, onExit, seed, rules, venue = 'club', online }: Props) {
  const [round, setRound] = useState(0)
  // The opponent's level, picked before the match (online: the other player).
  const [level, setLevel] = useState<number | null>(online ? 1 : (rules?.level ?? null))
  const surface = rules?.surface ?? (venue === 'club' ? 'clay' : 'hard')
  const game = useMemo(() => {
    const r = seeded((seed ?? Math.floor(Math.random() * 1e9)) + round * 7919)
    const foes = gender === 'femme' ? FOES_F : FOES_M
    const g = createTennis(name, foes[Math.floor(r() * foes.length)], r, { ...rules, level: level ?? 1, surface })
    if (online) {
      const mine = online.match.entries.find((e) => e.sim === online.simId)
      if (mine && mine.slot === 1) {
        g.me = 1
        g.ps[0].human = false
        g.ps[1].human = true
        g.ps[1].name = name
      }
    }
    return g
  }, [name, seed, round, rules, level, surface, online, gender])
  const [entries, setEntries] = useState<CourtEntry[]>(online?.match.entries ?? [])
  const [net, setNet] = useState<SportNet | null>(null)
  useEffect(() => {
    if (!online) return
    const n = new SportNet(online.token, online.simId, online.match.id)
    setNet(n)
    const t = setInterval(() => fetchMatch(online.token, online.match.id).then((m) => m && setEntries(m.entries)), 3000)
    return () => {
      n.close()
      clearInterval(t)
      setNet(null)
    }
  }, [online])
  // The other player at the court plays its own place (the AI's while it isn't there).
  useEffect(() => {
    if (!net) return
    const fix = () => {
      for (const p of game.ps) {
        const e = entries.find((x) => x.slot === p.id)
        p.human = p.id === game.me || (!!e && net.here(e.sim))
        if (e && p.id !== game.me) p.name = e.name
      }
    }
    fix()
    const t = setInterval(fix, 1000)
    return () => clearInterval(t)
  }, [net, entries, game])
  if (import.meta.env.DEV) Object.assign(globalThis, { tennis: game, tennisCam: TCAM })
  const looks = useMemo(() => {
    const r = rng(`tennis-${round}`)
    return game.ps.map((p) => {
      const e = entries.find((x) => x.slot === p.id)
      const base =
        p.id === game.me
          ? { look, gender }
          : e
            ? { look: e.look, gender: e.gender }
            : (() => {
                const gd = gender
                return { look: randomLook(gd, r), gender: gd }
              })()
      return { look: { ...base.look, outfit: p.id === game.me ? 'debardeur' : 'jersey', outfitColor: p.id === 0 ? '#f8f9fa' : '#ffd43b', accessory: 'none' } as Look, gender: base.gender }
    })
  }, [game, look, gender, entries, round])
  const hands = useRef<Hands>({ mx: 0, mz: 0, held: {} })
  useKeys(hands, KEYS)
  const [hud, setHud] = useState<Hud>(() => hudOf(game, null, false))
  const held = useRef<(() => void) | null>(null)
  useEffect(() => () => held.current?.(), [])
  const leave = () => {
    if (online) void leaveMatch(online.token, online.simId, online.match.id)
    onExit()
  }
  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, [])
  const serving = hud.serve
  const over = hud.phase === 'over'

  return (
    <div className="fixed inset-0 z-50 touch-none select-none" style={{ background: HAZE }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 46, near: 0.3, far: 500, position: [0, 7, 22] }} onCreated={({ gl }) => void (held.current = holdScenes(gl.domElement))}>
        <GroundShade.Provider value={false}>
          <color attach="background" args={[HAZE]} />
          <fog attach="fog" args={[HAZE, 80, 320]} />
          <hemisphereLight args={['#e3f1ff', '#7f6f4f', 1.05]} />
          <directionalLight color="#fff1dc" position={[14, 30, 10]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-far={90} />
          <Sky radius={330} />
          <Suspense fallback={null}>
            <TennisGround g={game} venue={venue} />
            <NearUpTo.Provider value={60}>
              {game.ps.map((p, i) => (
                <TennisPlayer key={`${round}-${p.id}`} g={game} i={i as 0 | 1} look={looks[i].look} gender={looks[i].gender} color={i === 0 ? '#e03131' : '#1d4ed8'} />
              ))}
            </NearUpTo.Provider>
            <TennisBall g={game} />
            <TennisAids g={game} />
          </Suspense>
          {level !== null && <Loop game={game} hands={hands} onHud={setHud} net={net} entries={entries} start={online?.match.start ?? 0} />}
          <TennisCam g={game} />
        </GroundShade.Provider>
      </Canvas>

      {/* The scoreboard, as on TV: the server's ball, the sets done, the games, the points. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,var(--sat,env(safe-area-inset-top)))]">
        <Board g={game} hud={hud} />
        <div className="pointer-events-auto">
          <Close onClick={leave} />
        </div>
      </div>
      {level === null && <LevelPick onPick={setLevel} venue={venue} />}
      {level !== null && hud.time < 1 && !hud.replay && <Countdown time={hud.time} />}
      {hud.call && !over && !hud.replay && <Call text={hud.call.text} k={hud.call.k} tone={/Faute|Filet|faute/.test(hud.call.text) ? 'red' : 'yellow'} />}
      {hud.speed && !hud.replay && (
        <div className="pointer-events-none absolute top-[max(8.6rem,calc(var(--sat,env(safe-area-inset-top))+8rem))] left-3 rounded-lg bg-[#0f1230]/75 px-2 py-1 font-display text-sm font-extrabold text-white tabular-nums">{tx('Service : {v} km/h', { v: hud.speed })}</div>
      )}
      {hud.judge && !hud.replay && <div className="pointer-events-none absolute right-4 bottom-[calc(18rem+var(--sab,env(safe-area-inset-bottom)))] rounded-xl bg-white/90 px-3 py-1 font-display text-base font-extrabold text-[#0f1230]">{JUDGE[hud.judge.text]?.() ?? hud.judge.text}</div>}
      {!over && !hud.replay && hud.time > 0 && (serving || hud.coming) && (
        // (Serving, on the near half: the box across, up by the net, and the server stay in sight.)
        <div className={`pointer-events-none absolute inset-x-0 px-4 text-center ${serving ? 'top-[46%]' : 'top-[max(11rem,calc(var(--sat,env(safe-area-inset-top))+10.4rem))]'}`}>
          <span className="inline-block max-w-sm rounded-xl bg-[#0f1230]/75 px-3 py-1.5 text-xs font-extrabold text-white">
            {serving
              ? touch
                ? tr('Service : le stick vise (au T, au corps, large). Tiens un bouton, la balle monte… lâche quand le cercle se referme (vert : parfait) !')
                : tr('Service : les flèches visent (au T, au corps, large). Tiens J (lifté), I (à plat) ou K (slicé), lâche quand le cercle se referme.')
              : touch
                ? tr('Tiens un coup pour la puissance, lâche quand le cercle se referme (vert : parfait) ; tenu, le stick vise.')
                : tr('Tiens J (lifté), K (slicé), L (lob) ou U (amortie), lâche quand le cercle se referme ; les flèches visent.')}
          </span>
        </div>
      )}
      {serving && !over && !hud.replay && hud.time > 0 && (
        // The serve: which ball, and where the stick sends it (the orange marker on the court).
        <div className="pointer-events-none absolute right-4 bottom-[calc(15.5rem+var(--sab,env(safe-area-inset-bottom)))] flex items-center gap-1.5 font-display text-sm font-extrabold">
          <span className={`rounded-lg px-2 py-1 text-white ${hud.ball === 0 ? 'bg-[#e03131]' : 'bg-[#2563eb]'}`}>{hud.ball === 0 ? tr('1re balle') : tr('2e balle')}</span>
          <span className="rounded-lg bg-[#ff8200] px-2 py-1 text-white">{hud.zone === 't' ? tr('Au T') : hud.zone === 'wide' ? tr('Large') : tr('Au corps')}</span>
        </div>
      )}
      {hud.say && !over && !hud.replay && <Comment text={hud.say.text} k={hud.say.k} />}
      {hud.replay && <ReplayBars onSkip={() => void (skip.current = true)} />}
      {!over && !hud.replay && level !== null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))]">
          <Stick hands={hands} />
          {serving ? (
            <div className="grid grid-cols-2 gap-3">
              <Hold hands={hands} k="flat" label={tr('À plat')} sub={tr('fort')} color="#e03131" keyName={touch ? undefined : 'I'} />
              <Hold hands={hands} k="top" label={tr('Lifté')} sub={tr('sûr')} color="#ff8200" big keyName={touch ? undefined : 'J'} />
              <Hold hands={hands} k="slice" label={tr('Slicé')} color="#2563eb" keyName={touch ? undefined : 'K'} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Hold hands={hands} k="lob" label={tr('Lob')} color="#16a34a" keyName={touch ? undefined : 'L'} />
              <Hold hands={hands} k="top" label={tr('Lifté')} color="#ff8200" big keyName={touch ? undefined : 'J'} />
              <Hold hands={hands} k="drop" label={tr('Amortie')} color="#ca8a04" keyName={touch ? undefined : 'U'} />
              <Hold hands={hands} k="slice" label={tr('Slicé')} color="#2563eb" keyName={touch ? undefined : 'K'} />
            </div>
          )}
        </div>
      )}
      {over && <Result g={game} onExit={leave} onReplay={online ? undefined : () => setRound((r) => r + 1)} />}
    </div>
  )
}

const skip = { current: false }

/** The phone's hands as the match reads them: the stick, the first stroke button held. */
function inputOf(h: Hands): TInput {
  const order: Shot[] = ['top', 'slice', 'lob', 'drop', 'flat']
  return { mx: h.mx, mz: h.mz, hold: order.find((k) => h.held[k]) ?? null }
}

function Loop({ game, hands, onHud, net, entries, start }: { game: Tennis; hands: React.MutableRefObject<Hands>; onHud: (h: Hud) => void; net: SportNet | null; entries: CourtEntry[]; start: number }) {
  const feel = useMemo(() => new TennisFeel(game), [game])
  const tape = useMemo(() => new SportTape(), [game])
  // The contact's hit-stop: the match holds a few hundredths after a stroke (more after a perfect one).
  const stop = useRef({ seen: 0, left: 0 })
  const replay = useRef<SportReplay | null>(null)
  const last = useRef(0)
  const sent = useRef(0)
  useFrame((_, raw) => {
    // (The lab's film, frame by frame: a fixed step per frame, so many frames as it asks.)
    const lab = import.meta.env.DEV ? (globalThis as { sportsFilm?: { dt: number; budget: number } }).sportsFilm : undefined
    if (lab && lab.budget <= 0) return
    if (lab) lab.budget--
    const dt = lab ? lab.dt : Math.min(raw, 0.05)
    const input = inputOf(hands.current)
    const g = game
    if (replay.current) {
      if (!playTape(replay.current, g.ps, g.ball, dt, skip.current)) replay.current = null
      skip.current = false
    } else if (!net) {
      const s = stop.current
      if (s.left > 0) s.left -= dt
      else stepTennis(g, dt, input)
      s.left = Math.max(s.left, hitStop(g, s))
      tape.record(g.time, g.ps, g.ball)
      feel.frame()
      // A big point's replay, once the ball is dead a moment.
      if (feel.replayAsk !== null && g.phase === 'dead' && g.time - g.since > 0.8) {
        replay.current = startTape(tape, g.time, g.ps, g.ball, feel.replayAsk)
        feel.replayAsk = null
      }
    } else {
      const host = net.host(entries)
      const now = Date.now()
      // Before the whistle (the court's start), the match waits.
      if (start && now < start - 3000) g.time = Math.min(g.time, -3)
      if (host === null) {
        // (The line not open yet.)
      } else if (host === entries.find((e) => e.slot === g.me)?.sim || !entries.some((e) => e.sim === host)) {
        const others = new Map<number, TInput>()
        for (const [slot, k] of net.inputs(entries)) others.set(slot, tInput(k))
        const call = g.call
        stepTennis(g, dt, input, others)
        if (g.call && g.call !== call) net.say(g.call.text)
        if (now - sent.current > 66) {
          sent.current = now
          net.send(tHands(input), tennisWire.encode(g))
        }
      } else {
        const rows = net.take(host)
        if (rows) tennisWire.decode(g, rows)
        else coast(g, AIR, BALL_R, dt)
        const w = net.word()
        if (w) g.call = { text: w, t: g.time }
        if (now - sent.current > 60) {
          sent.current = now
          net.send(tHands(input), null)
        }
      }
      feel.frame()
    }
    last.current += raw
    if (last.current > 0.1) {
      last.current = 0
      onHud(hudOf(g, feel, !!replay.current))
    }
  })
  return null
}

function Board({ g, hud }: { g: Tennis; hud: Hud }) {
  const b = hud.board
  const row = (i: 0 | 1) => (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${b.server === i ? 'bg-[#dcf542]' : 'bg-transparent'}`} />
      <span className="w-24 truncate text-[12px] font-extrabold">{g.ps[i].name}</span>
      {b.done.map((d, k) => (
        <span key={k} className="w-4 text-center text-[12px] font-bold opacity-70 tabular-nums">
          {d[i]}
        </span>
      ))}
      <span className="w-5 text-center text-[14px] font-extrabold tabular-nums">{b.games[i]}</span>
      <span className="w-7 rounded bg-white text-center text-[13px] font-extrabold text-[#0f1230] tabular-nums">{b.pts[i]}</span>
    </div>
  )
  return (
    <div className="rounded-xl bg-[#0f1230]/90 px-2.5 py-1.5 text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
      {row(0)}
      {row(1)}
      {b.tb && <div className="mt-0.5 text-center text-[10px] font-extrabold text-[#ffd43b]">{tr('JEU DÉCISIF')}</div>}
    </div>
  )
}

function LevelPick({ onPick, venue }: { onPick: (l: number) => void; venue: Venue }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0f1230]/50 p-4">
      <div className="sheet animate-up w-full max-w-sm rounded-[28px] p-5">
        <div className="font-display text-xl font-extrabold">{venue === 'ivoire' ? tr('Le court de l’Hôtel Ivoire') : venue === 'club' ? tr('Le court en terre battue du club') : tr('Le court du Plateau')}</div>
        <p className="mt-1 text-sm font-bold text-[var(--color-ink-soft)]">{tr('Un set court, jeu décisif à 4-4. Contre qui ?')}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {LEVEL_NAMES().map((l, i) => (
            <button key={l} className={`btn ${i === 1 ? '' : 'btn-soft'}`} onClick={() => onPick(i)}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Result({ g, onExit, onReplay }: { g: Tennis; onExit: () => void; onReplay?: () => void }) {
  const won = g.winner === g.me
  const s = g.stats
  const me = g.me
  const lines: [string, string | number][] = [
    [tr('Aces'), s.aces[me]],
    [tr('Doubles fautes'), s.df[me]],
    [tr('Coups gagnants'), s.winners[me]],
    [tr('Points gagnés'), `${s.points[me]} / ${s.points[0] + s.points[1]}`],
    [tr('Service le plus rapide'), `${s.fastest[me]} km/h`],
    [tr('Plus long échange'), tr('{n} frappes', { n: s.longest })],
  ]
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0f1230]/60 p-4">
      <div className="sheet animate-up w-full max-w-sm rounded-[28px] p-5">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-[var(--color-orange)]" />
          <div className="font-display text-2xl font-extrabold">{won ? tr('Victoire !') : tr('Défaite…')}</div>
        </div>
        <div className="mt-2 text-center font-display text-3xl font-extrabold tabular-nums">{g.score.done.map((d) => `${d[me]}-${d[me === 0 ? 1 : 0]}`).join('  ')}</div>
        <div className="text-center text-xs font-bold text-[var(--color-ink-soft)]">{tx('contre {name}', { name: g.ps[me === 0 ? 1 : 0].name })}</div>
        <ul className="mt-3 grid grid-cols-2 gap-1.5">
          {lines.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between rounded-xl bg-[var(--color-canvas)] px-3 py-1.5 text-sm font-extrabold">
              <span className="text-xs">{k}</span>
              <span className="tabular-nums">{v}</span>
            </li>
          ))}
        </ul>
        <div className={`mt-4 grid gap-2 ${onReplay ? 'grid-cols-2' : ''}`}>
          <button className="btn btn-soft" onClick={onExit}>
            {tr('Sortir')}
          </button>
          {onReplay && (
            <button className="btn" onClick={onReplay}>
              <RotateCcw size={18} /> {tr('Rejouer')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
