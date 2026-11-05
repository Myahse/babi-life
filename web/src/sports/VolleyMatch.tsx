import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RotateCcw, Trophy } from 'lucide-react'
import type { Look } from '../lib/types'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { holdScenes } from '../world3d/hold'
import { Sky, HAZE } from '../streetball/looks'
import { PALAIS_HAZE } from '../streetball/palais'
import { GroundShade } from '../avatar/LowHuman'
import { NearUpTo } from '../avatar/Human'
import { fetchMatch, leaveMatch, type CourtEntry, type CourtMatch } from '../streetball/online'
import { t as tr } from '../lib/i18n'
import { AIR, BALL_R, createVolley, seeded, setTo, stepVolley, type VInput, type Volley, type VolleyRules } from './volley'
import { VCAM, VolleyAids, VolleyBall, VolleyCam, VolleyGround, VolleyPlayer, type VVenue } from './volleyScene'
import { VolleyFeel, hitStop } from './feel'
import { SportTape, playTape, startTape, type SportReplay } from './tape'
import { Call, Close, Comment, Countdown, Hold, ReplayBars, Stick, useKeys, type Hands } from './kit'
import { SportNet } from './net'
import { coast, vHands, vInput, volleyWire } from './wire'

// The volleyball match one plays: at the Palais des Sports six against six (the player an outside hitter of
// its side, the setter and the others the AI), on the beaches of Grand-Bassam, Port-Bouët or Assinie two
// against two; or with the other players at the court (twelve places at the Palais, four on a beach). The stick
// runs (the player goes alone to the ball when it's its touch: the assist) and aims the spike; « Passe » plays the
// touch (bump, set, a free ball over), pressed just before the ball comes; « Smash » jumps for the spike (pressed
// as the setter's ball starts down); « Feinte » tips it over the block; « Contre » at the net when they attack.
// The serve: Passe for the float, Smash for the jump serve, pressed again at the toss's top.

type Props = {
  name: string
  look: Look
  gender: 'femme' | 'homme'
  onExit: () => void
  seed?: number
  rules?: VolleyRules
  /** A beach (two against two on the sand); none: the Palais des Sports, indoors. */
  beach?: 'bassam' | 'portbouet' | 'assinie'
  online?: { token: string; simId: string; match: CourtMatch }
}

const NAMES_M = ['Koffi', 'Yao', 'Bamba', 'Serge', 'Ali', 'Konan', 'Didier', 'Jules', 'Moussa', 'Kader', 'Brice']
const NAMES_F = ['Awa', 'Fanta', 'Aya', 'Mariam', 'Adjoua', 'Nadège', 'Sali', 'Grâce', 'Akissi', 'Ruth', 'Inès']
const KEYS: Record<string, string> = { KeyJ: 'a', Space: 'a', KeyK: 'b', KeyL: 'c' }
const JUDGE: Record<string, () => string> = { Parfait: () => tr('Parfait !'), Bien: () => tr('Bien'), 'Trop tôt': () => tr('Trop tôt'), 'En retard': () => tr('En retard'), 'Raté !': () => tr('Raté !'), Raté: () => tr('Raté'), Auto: () => tr('J’ai !') }

type Hud = {
  time: number
  phase: Volley['phase']
  pts: [number, number]
  sets: [number, number]
  to: number
  serving: 0 | 1
  mine: boolean
  my: string | null
  block: boolean
  call: { text: string; k: number } | null
  judge: { text: string; k: number } | null
  say: { text: string; k: number } | null
  replay: boolean
}

function hudOf(g: Volley, feel: VolleyFeel | null, replay: boolean): Hud {
  const me = g.ps[g.me]
  const plan = me.plan
  const atNet = Math.abs(me.z) < 2 && !!g.attack && g.ps[g.attack.by].team !== me.team
  return {
    time: g.time,
    phase: g.phase,
    pts: g.score.pts,
    sets: g.score.sets,
    to: setTo(g),
    serving: g.serving,
    mine: g.phase === 'serve' && g.rot[g.serving][0] === g.me,
    my: plan ? plan.kind : null,
    block: atNet,
    call: g.call && g.time - g.call.t < 1.8 ? { text: g.call.text, k: g.call.t } : null,
    judge: g.judge && g.time - g.judge.t < 1.2 ? { text: g.judge.text, k: g.judge.t } : null,
    say: feel?.comment ?? null,
    replay,
  }
}

export default function VolleyMatch({ name, look, gender, onExit, seed, rules, beach, online }: Props) {
  const [round, setRound] = useState(0)
  const venue: VVenue = beach ?? 'palais'
  const women = gender === 'femme'
  const game = useMemo(() => {
    const r = seeded((seed ?? Math.floor(Math.random() * 1e9)) + round * 7919)
    const pool = [...(women ? NAMES_F : NAMES_M)].sort(() => r() - 0.5)
    const g = createVolley(name, pool, r, { ...rules, beach: !!beach, women })
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
  }, [name, seed, round, rules, beach, women, online])
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
  if (import.meta.env.DEV) Object.assign(globalThis, { volley: game, volleyCam: VCAM })
  const looks = useMemo(() => {
    const r = rng(`volley-${venue}-${round}`)
    const kit = (team: number) => (beach ? (team === 0 ? '#ff8200' : '#1d4ed8') : team === 0 ? '#ff8200' : '#009e60')
    const outfit = beach ? 'debardeur' : 'jersey'
    return game.ps.map((p) => {
      const e = entries.find((x) => x.slot === p.id)
      const base = p.id === game.me ? { look, gender } : e ? { look: e.look, gender: e.gender } : { look: randomLook(gender, r), gender }
      return { look: { ...base.look, outfit, outfitColor: kit(p.team), accessory: 'none', hair: base.look.hair === 'headwrap' ? 'short' : base.look.hair } as Look, gender: base.gender }
    })
  }, [game, look, gender, entries, round, venue, beach])
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
  const over = hud.phase === 'over'
  const indoor = !beach
  const bg = indoor ? PALAIS_HAZE : HAZE
  const myTeam = game.ps[game.me].team
  const label = hud.mine ? tr('Service') : hud.block ? tr('Contre') : hud.my === 'set' ? tr('Passe') : hud.my === 'bump' || hud.my === 'dig' ? tr('Manchette') : tr('Passe')

  return (
    <div className="fixed inset-0 z-50 touch-none select-none" style={{ background: bg }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 48, near: 0.3, far: 500, position: [0, 7, 18] }} onCreated={({ gl }) => void (held.current = holdScenes(gl.domElement))}>
        <GroundShade.Provider value={false}>
          <color attach="background" args={[bg]} />
          <fog attach="fog" args={[bg, indoor ? 40 : 90, indoor ? 120 : 330]} />
          <hemisphereLight args={indoor ? ['#fff4e0', '#6b4a2e', 1.3] : ['#e3f1ff', '#c9a86a', 1.1]} />
          <directionalLight color="#fff1dc" position={indoor ? [6, 30, 8] : [18, 30, -10]} intensity={indoor ? 1.4 : 2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-far={90} />
          {!indoor && <Sky radius={330} />}
          <Suspense fallback={null}>
            <VolleyGround g={game} venue={venue} />
            <NearUpTo.Provider value={50}>
              {game.ps.map((p, i) => (
                <VolleyPlayer key={`${round}-${p.id}`} g={game} i={i} look={looks[i].look} gender={looks[i].gender} />
              ))}
            </NearUpTo.Provider>
            <VolleyBall g={game} />
            <VolleyAids g={game} />
          </Suspense>
          <Loop game={game} hands={hands} onHud={setHud} net={net} entries={entries} start={online?.match.start ?? 0} />
          <VolleyCam g={game} />
        </GroundShade.Provider>
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,var(--sat,env(safe-area-inset-top)))]">
        <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
          {[myTeam, myTeam === 0 ? 1 : 0].map((t, k) => (
            <span key={t} className={`flex items-center gap-1.5 bg-[#0f1230]/90 py-1.5 ${k ? 'order-3 pr-2 pl-2.5' : 'pr-2.5 pl-2'}`}>
              {k === 0 && <span className={`h-2 w-2 rounded-full ${hud.serving === t ? 'bg-[#ffd43b]' : 'bg-transparent'}`} />}
              <span className="text-[13px] font-extrabold">{k === 0 ? tr('NOUS') : tr('EUX')}</span>
              <span className="rounded bg-white/15 px-1 text-[11px] font-bold tabular-nums">{hud.sets[t]}</span>
              {k === 1 && <span className={`h-2 w-2 rounded-full ${hud.serving === t ? 'bg-[#ffd43b]' : 'bg-transparent'}`} />}
            </span>
          ))}
          <span className="order-2 flex items-center bg-white px-2.5 font-display text-[24px] leading-none font-extrabold text-[#0f1230] tabular-nums">
            {hud.pts[myTeam]}
            <span className="mx-1 text-[16px] opacity-40">-</span>
            {hud.pts[myTeam === 0 ? 1 : 0]}
          </span>
          <span className="order-4 flex items-center bg-[#ff8200] px-2 text-[11px] font-extrabold whitespace-nowrap">{tr('en {to}', { to: hud.to })}</span>
        </div>
        <div className="pointer-events-auto">
          <Close onClick={leave} />
        </div>
      </div>
      {hud.time < 1 && !hud.replay && <Countdown time={hud.time} />}
      {hud.call && !over && !hud.replay && <Call text={hud.call.text} k={hud.call.k} tone={/Faute|Out|touche/.test(hud.call.text) ? 'red' : 'yellow'} />}
      {hud.judge && !hud.replay && <div className="pointer-events-none absolute right-4 bottom-[calc(13.5rem+var(--sab,env(safe-area-inset-bottom)))] rounded-xl bg-white/90 px-3 py-1 font-display text-base font-extrabold text-[#0f1230]">{JUDGE[hud.judge.text]?.() ?? hud.judge.text}</div>}
      {!over && !hud.replay && hud.time > 0 && (hud.mine || hud.my || hud.block) && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(5.2rem,calc(var(--sat,env(safe-area-inset-top))+4.6rem))] px-4 text-center">
          <span className="inline-block max-w-sm rounded-xl bg-[#0f1230]/75 px-3 py-1.5 text-xs font-extrabold text-white">
            {hud.mine
              ? touch
                ? tr('À toi de servir : Passe (flottant) ou Smash (smashé), puis encore une fois en haut. Le stick vise.')
                : tr('À toi de servir : J (flottant) ou K (smashé), puis encore une fois en haut ; les flèches visent.')
              : hud.block
                ? tr('Ils attaquent : Contre, saute avec leur attaquant !')
                : hud.my === 'spike'
                  ? tr('La passe est pour toi : Smash quand le cercle rouge se referme, le stick vise ! (Feinte par-dessus le contre.)')
                  : hud.my === 'set'
                    ? tr('À toi la passe : Passe quand le cercle se referme.')
                    : tr('À toi : Manchette quand le cercle se referme !')}
          </span>
        </div>
      )}
      {hud.say && !over && !hud.replay && <Comment text={hud.say.text} k={hud.say.k} />}
      {hud.replay && <ReplayBars onSkip={() => void (skip.current = true)} />}
      {!over && !hud.replay && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))]">
          <Stick hands={hands} />
          <div className="grid grid-cols-2 gap-3">
            <Hold hands={hands} k="c" label={tr('Feinte')} color="#ca8a04" dim={hud.my !== 'spike'} keyName={touch ? undefined : 'L'} />
            <Hold hands={hands} k="b" label={hud.mine ? tr('Smashé') : tr('Smash')} color="#e03131" big dim={!hud.mine && hud.my !== 'spike'} keyName={touch ? undefined : 'K'} />
            <Hold hands={hands} k="a" label={label} color={hud.block ? '#7950f2' : '#2563eb'} big keyName={touch ? undefined : 'J'} />
          </div>
        </div>
      )}
      {over && <Result g={game} onExit={leave} onReplay={online ? undefined : () => setRound((r) => r + 1)} />}
    </div>
  )
}

const skip = { current: false }

const inputOf = (h: Hands): VInput => ({ mx: h.mx, mz: h.mz, a: !!h.held.a, b: !!h.held.b, c: !!h.held.c })

function Loop({ game, hands, onHud, net, entries, start }: { game: Volley; hands: React.MutableRefObject<Hands>; onHud: (h: Hud) => void; net: SportNet | null; entries: CourtEntry[]; start: number }) {
  const feel = useMemo(() => new VolleyFeel(game), [game])
  const tape = useMemo(() => new SportTape(), [game])
  // The contact's hit-stop: the match holds a few hundredths after a touch of the player's, a spike, a stuff block.
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
      else stepVolley(g, dt, input)
      s.left = Math.max(s.left, hitStop(g, s))
      tape.record(g.time, g.ps, g.ball)
      feel.frame()
      if (feel.replayAsk !== null && g.phase === 'dead' && g.time - g.since > 0.9) {
        replay.current = startTape(tape, g.time, g.ps, g.ball, feel.replayAsk, 2.6)
        feel.replayAsk = null
      }
    } else {
      const host = net.host(entries)
      const now = Date.now()
      if (start && now < start - 3000) g.time = Math.min(g.time, -3)
      if (host === null) {
        // (The line not open yet.)
      } else if (host === entries.find((e) => e.slot === g.me)?.sim || !entries.some((e) => e.sim === host)) {
        const others = new Map<number, VInput>()
        for (const [slot, k] of net.inputs(entries)) others.set(slot, vInput(k))
        const call = g.call
        stepVolley(g, dt, input, others)
        if (g.call && g.call !== call) net.say(g.call.text)
        if (now - sent.current > 66) {
          sent.current = now
          net.send(vHands(input), volleyWire.encode(g))
        }
      } else {
        const rows = net.take(host)
        if (rows) volleyWire.decode(g, rows)
        else coast(g, AIR, BALL_R, dt)
        const w = net.word()
        if (w) g.call = { text: w, t: g.time }
        if (now - sent.current > 60) {
          sent.current = now
          net.send(vHands(input), null)
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

function Result({ g, onExit, onReplay }: { g: Volley; onExit: () => void; onReplay?: () => void }) {
  const t = g.ps[g.me].team
  const o = t === 0 ? 1 : 0
  const won = g.winner === t
  const s = g.stats
  const lines: [string, number][] = [
    [tr('Tes smashs gagnants'), s.mine.kills],
    [tr('Tes contres'), s.mine.blocks],
    [tr('Tes aces'), s.mine.aces],
    [tr('Tes défenses'), s.mine.digs],
    [tr('Attaques gagnantes (équipe)'), s.kills[t]],
    [tr('Contres (équipe)'), s.blocks[t]],
  ]
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0f1230]/60 p-4">
      <div className="sheet animate-up w-full max-w-sm rounded-[28px] p-5">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-[var(--color-orange)]" />
          <div className="font-display text-2xl font-extrabold">{won ? tr('Victoire !') : tr('Défaite…')}</div>
        </div>
        <div className="mt-2 text-center font-display text-3xl font-extrabold tabular-nums">{g.score.done.map((d) => `${d[t]}-${d[o]}`).join('  ')}</div>
        <div className="text-center text-xs font-bold text-[var(--color-ink-soft)]">{tr('Plus long échange : {n} touches', { n: s.longest })}</div>
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
