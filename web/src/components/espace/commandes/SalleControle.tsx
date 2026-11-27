import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Radar } from 'lucide-react'
import { t as tr } from '../../../lib/i18n'
import { haptic } from '../../../lib/native'
import { snd } from '../../defi/jeux/juice'
import { B } from '../../../world3d/espace/blocs'
import { buildCalao, setCalaoFlames } from '../../../world3d/espace/calao'
import { clamp, Frame, Tap, type Ended } from './Frame'
import { Fused } from './Fused'
import type { GameProps } from './types'

// La salle de contrôle (backend game.ControleJeuID, « controle-lancement »: the mission controller's shift, at the
// Plateau's siège or a spaceport's pad): a Calao's launch followed on the consoles. Before the launch the flight
// director polls each system: read its telemetry, answer « GO » when it's within its limits, « NO GO » when it
// isn't (the team then fixes it and polls again). After the lift-off, call « TOP » at the right moment of each
// staging (the boosters empty, the tower let go, the first stage spent). Wrong or late, the launch is held
// (« lancement reporté » if it goes badly): nobody hurt, on recommence.

type Poll = { sys: string; read: string; ok: boolean; fix?: string }
type Call = { name: string; what: string; at: number }

/** The systems polled, each with its reading in limits and the one out of them. */
const SYSTEMS: { sys: string; good: string; bad: string; fix: string }[] = [
  { sys: tr('Météo'), good: tr('Vent au sol 12 km/h (limite 30)'), bad: tr('Vent au sol 41 km/h (limite 30)'), fix: tr('Le vent retombe : 18 km/h (limite 30)') },
  { sys: tr('Propulsion'), good: tr('Pression des réservoirs 98 % (95–105)'), bad: tr('Pression des réservoirs 88 % (95–105)'), fix: tr('Pression remontée : 99 % (95–105)') },
  { sys: tr('Guidage'), good: tr('Écart de la centrale 0,1° (max 0,5°)'), bad: tr('Écart de la centrale 1,4° (max 0,5°)'), fix: tr('Centrale recalée : 0,2° (max 0,5°)') },
  { sys: tr('Pas de tir'), good: tr('Bras de la tour : 3 sur 3 écartés'), bad: tr('Bras de la tour : 2 sur 3 écartés'), fix: tr('Bras de la tour : 3 sur 3 écartés') },
  { sys: tr('Pirogue'), good: tr('Écoutille fermée, cabine à 101 kPa'), bad: tr('Écoutille : capteur « ouverte »'), fix: tr('Écoutille refermée, cabine à 101 kPa') },
  { sys: tr('Liaisons'), good: tr('Sassandra, Kourou, Abidjan : 3 sur 3'), bad: tr('Station de Kourou : pas de signal'), fix: tr('Kourou revenue : 3 sur 3') },
]
const POLL_S = 6
const CALLS: Call[] = [
  { name: tr('Séparation des boosters'), what: tr('Ergols des boosters'), at: 0 },
  { name: tr('Largage de la tour de sauvetage'), what: tr('Altitude jusqu’au largage'), at: 0 },
  { name: tr('Séparation du premier étage'), what: tr('Ergols du premier étage'), at: 0 },
]
/** A call's gauge runs down over this long; « TOP » at its end (within WINDOW seconds) is perfect. */
const CALL_S = 4
const WINDOW = 0.35

/** The polls of this launch: one or two systems out of limits (polled again once fixed). */
function makePolls(): Poll[] {
  const bad = new Set<number>()
  bad.add(Math.floor(Math.random() * SYSTEMS.length))
  if (Math.random() < 0.6) bad.add(Math.floor(Math.random() * SYSTEMS.length))
  return SYSTEMS.map((s, i) => (bad.has(i) ? { sys: s.sys, read: s.bad, ok: false, fix: s.fix } : { sys: s.sys, read: s.good, ok: true }))
}

type Stage = { kind: 'ready'; start: number } | { kind: 'poll'; poll: Poll; start: number } | { kind: 'hold'; poll: Poll; start: number } | { kind: 'count'; start: number } | { kind: 'call'; call: Call; idx: number; start: number } | { kind: 'orbit'; start: number }

/** The room: the rows of consoles and their screens, the controllers at them, the big screen with the pad. */
function Room({ lit }: { lit: boolean }) {
  const screens = ['#4dabf7', '#40c057', '#4dabf7', '#ffd43b', '#4dabf7']
  return (
    <group>
      <B p={[0, -0.1, 0]} s={[16, 0.2, 14]} c="#343a40" />
      {/* The front wall, open on the big screen */}
      <B p={[0, 0.6, -6.2]} s={[16, 1.2, 0.3]} c="#212529" />
      <B p={[0, 5.6, -6.2]} s={[16, 3, 0.3]} c="#212529" />
      {[-1, 1].map((sx) => <B key={sx} p={[sx * 6.85, 2.65, -6.2]} s={[2.3, 2.9, 0.3]} c="#212529" />)}
      <B p={[0, 7, 0]} s={[16, 0.2, 14]} c="#1b1e24" />
      {[-7.9, 7.9].map((x) => <B key={x} p={[x, 3.5, 0]} s={[0.2, 7.2, 14]} c="#25282e" />)}
      {/* The big screen's frame (the pad behind it), the countdown's bar under it */}
      <B p={[0, 4, -6]} s={[11.4, 0.3, 0.4]} c="#495057" />
      <B p={[0, 1.2, -6]} s={[11.4, 0.3, 0.4]} c="#495057" />
      <B p={[0, 0.7, -5.95]} s={[6, 0.4, 0.1]} c={lit ? '#ff7a00' : '#7a3c00'} glow />
      <B p={[-6.7, 5.4, -5.9]} s={[1.6, 1, 0.1]} c="#1c3d6e" />
      <B p={[-6.7, 5.4, -5.84]} s={[0.6, 0.6, 0.02]} c="#ff7a00" />
      {/* Three rows of consoles, rising to the back */}
      {[0, 1, 2].map((row) => (
        <group key={row} position={[0, row * 0.45, -2.6 + row * 2.6]}>
          <B p={[0, 0.2, 0.5]} s={[14, 0.4, 2.2]} c="#2b2f36" />
          {[-5.2, -2.6, 0, 2.6, 5.2].map((x, k) => (
            <group key={x} position={[x, 0, 0]}>
              <B p={[0, 0.95, 0]} s={[2.1, 1.1, 0.8]} c="#495057" />
              <B p={[0, 1.65, -0.2]} s={[1.6, 0.8, 0.1]} c="#111418" r={[-0.25, 0, 0]} />
              <B p={[0, 1.65, -0.14]} s={[1.4, 0.62, 0.02]} c={screens[(k + row) % screens.length]} glow r={[-0.25, 0, 0]} />
              {/* A controller at the console, headset on */}
              <group position={[0, 0.4, 1.1]}>
                <B p={[0, 0.55, 0]} s={[0.55, 0.7, 0.4]} c={['#1c3d6e', '#f4f4f1', '#ff7a00'][(k + row) % 3]} />
                <B p={[0, 1.12, 0]} s={[0.34, 0.36, 0.34]} c={['#8d5524', '#5a3825', '#c68642', '#3b2219'][(k * 3 + row) % 4]} />
                <B p={[0, 1.33, 0]} s={[0.38, 0.06, 0.38]} c="#212529" />
                <B p={[0.2, 1.12, -0.05]} s={[0.06, 0.16, 0.16]} c="#212529" />
              </group>
            </group>
          ))}
        </group>
      ))}
      <pointLight position={[0, 6, 2]} intensity={10} distance={18} color="#cfe3ff" />
    </group>
  )
}

/** Behind the big screen: the pad far off, the sky, the Calao lifting off and staging. */
function PadView({ clock: c }: { clock: { current: { lift: number; staged: number } } }) {
  const calao = useMemo(() => buildCalao('calao-1'), [])
  const root = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const { lift, staged } = c.current
    const s = Math.max(0, lift)
    if (root.current) root.current.position.y = 1.2 * s * s
    calao.boosters.forEach((b) => (b.visible = staged < 1))
    if (calao.tower) calao.tower.visible = staged < 2
    calao.stage1.visible = staged < 3
    setCalaoFlames(calao, lift > 0 && staged < 3 ? 1 : 0, lift > 0 && staged < 1 ? 1 : 0, staged >= 3 ? 1 : 0, clock.elapsedTime, 10 + s * 2)
  })
  return (
    <group position={[0, -57, -200]} scale={0.8}>
      <B p={[0, 40, -30]} s={[260, 120, 1]} c="#6cb7e8" />
      <B p={[0, -1, -10]} s={[260, 2, 80]} c="#4f7942" />
      <B p={[0, 0.2, 18]} s={[260, 0.4, 20]} c="#1c7ed6" />
      <B p={[0, 0.6, 0]} s={[22, 1.2, 22]} c="#adb5bd" />
      {/* The tower beside it */}
      <B p={[-9, 25, 0]} s={[3, 50, 3]} c="#c92a2a" />
      {[...Array(10)].map((_, i) => <B key={i} p={[-9, 2 + i * 5, 0]} s={[3.4, 0.3, 3.4]} c="#868e96" />)}
      <group ref={root} position={[0, 1.2, 0]}>
        <primitive object={calao.root} />
      </group>
    </group>
  )
}

export function SalleControle({ send, onClose }: GameProps) {
  const [run, setRun] = useState(0)
  const polls = useMemo(() => makePolls(), [run]) // eslint-disable-line react-hooks/exhaustive-deps
  const [stage, setStage] = useState<Stage>(() => ({ kind: 'ready', start: performance.now() }))
  const [k, setK] = useState(0)
  const [points, setPoints] = useState(0)
  const [max, setMax] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const [now, setNow] = useState(performance.now())
  const [ended, setEnded] = useState<Ended | null>(null)
  const rocket = useRef({ lift: -1, staged: 0 })
  const answered = useRef(false)
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 80)
    return () => clearInterval(id)
  }, [])
  const el = (now - stage.start) / 1000
  const score = (p: number, m: number) => (m > 0 ? Math.round(clamp((p / m) * 100, 1, 100)) : 1)
  const finish = (p: number, m: number) => {
    const s = score(p, m)
    setEnded({ score: s, line: s >= 50 ? tr('Orbite atteinte ! Tes « go » tombaient pile : la salle applaudit.') : tr('Trop d’appels manqués : la directrice de vol reporte le lancement. On recommence ?') })
  }
  const nextPoll = (i: number) => {
    answered.current = false
    if (i < polls.length) {
      setK(i)
      setStage({ kind: 'poll', poll: polls[i], start: performance.now() })
    } else {
      setStage({ kind: 'count', start: performance.now() })
      setSaid(tr('Tout le monde est « go » : décompte final !'))
    }
  }
  // The clock of each stage: a poll unanswered in time, the hold, the countdown, the calls' gauges.
  useEffect(() => {
    if (ended) return
    if (stage.kind === 'poll' && el > POLL_S && !answered.current) {
      answered.current = true
      setMax((m) => m + 10)
      setSaid(tr('Pas de réponse : la directrice passe au suivant.'))
      if (!stage.poll.ok) setStage({ kind: 'hold', poll: stage.poll, start: performance.now() })
      else nextPoll(k + 1)
    } else if (stage.kind === 'hold' && el > 2.2) {
      answered.current = false
      setStage({ kind: 'poll', poll: { sys: stage.poll.sys, read: stage.poll.fix ?? stage.poll.read, ok: true }, start: performance.now() })
    } else if (stage.kind === 'count') {
      if (el > 5 && rocket.current.lift < 0) {
        rocket.current.lift = 0
        snd.whoosh(1)
        haptic('heavy')
        setSaid(tr('Décollage ! La Calao quitte le pas de tir.'))
      }
      if (rocket.current.lift >= 0) rocket.current.lift = el - 5
      if (el > 7) setStage({ kind: 'call', call: CALLS[0], idx: 0, start: performance.now() })
    } else if (stage.kind === 'call') {
      rocket.current.lift = Math.min(9, rocket.current.lift + 0.08)
      if (el > CALL_S + 1.2 && !answered.current) {
        answered.current = true
        setMax((m) => m + 10)
        setSaid(tr('Trop tard pour « {name} » : l’ordinateur l’a fait tout seul.', { name: stage.call.name }))
        rocket.current.staged = stage.idx + 1
        nextCall(stage.idx + 1, points, max + 10)
      }
    } else if (stage.kind === 'orbit') {
      rocket.current.lift = Math.min(10, rocket.current.lift + 0.05)
    }
  }, [now]) // eslint-disable-line react-hooks/exhaustive-deps
  const nextCall = (i: number, p: number, m: number) => {
    answered.current = false
    if (i < CALLS.length) setStage({ kind: 'call', call: CALLS[i], idx: i, start: performance.now() })
    else {
      setStage({ kind: 'orbit', start: performance.now() })
      setTimeout(() => finish(p, m), 1600)
    }
  }
  const answer = (go: boolean) => {
    if (stage.kind !== 'poll' || answered.current) return
    answered.current = true
    const right = go === stage.poll.ok
    // Quick and right: all ten; right but slow, a little less.
    const p = right ? Math.round(10 - Math.min(4, Math.max(0, el - 2))) : 0
    setPoints((x) => x + p)
    setMax((m) => m + 10)
    if (right) {
      snd.good()
      setSaid(go ? tr('{sys} : « go » !', { sys: stage.poll.sys }) : tr('Bien vu : « no go » pour {sys}. L’équipe corrige…', { sys: stage.poll.sys }))
    } else {
      snd.bad()
      haptic('light')
      setSaid(go ? tr('Aïe : {sys} était hors limites. La directrice arrête le décompte, l’équipe corrige.', { sys: stage.poll.sys }) : tr('{sys} était bon : un « no go » pour rien, on perd du temps.', { sys: stage.poll.sys }))
    }
    if (!stage.poll.ok) setStage({ kind: 'hold', poll: stage.poll, start: performance.now() })
    else nextPoll(k + 1)
  }
  const top = () => {
    if (stage.kind !== 'call' || answered.current) return
    answered.current = true
    const err = Math.abs(el - CALL_S)
    const p = err <= WINDOW ? 10 : err <= 1 ? Math.round(10 - (err - WINDOW) * 9) : 2
    snd[p >= 8 ? 'perfect' : 'good']()
    haptic('medium')
    setSaid(err <= WINDOW ? tr('{name} : pile au bon moment !', { name: stage.call.name }) : el < CALL_S ? tr('{name} : un peu tôt.', { name: stage.call.name }) : tr('{name} : un peu tard.', { name: stage.call.name }))
    rocket.current.staged = stage.idx + 1
    const np = points + p
    const nm = max + 10
    setPoints(np)
    setMax(nm)
    nextCall(stage.idx + 1, np, nm)
  }
  const retry = () => {
    rocket.current = { lift: -1, staged: 0 }
    answered.current = false
    setPoints(0)
    setMax(0)
    setSaid(null)
    setEnded(null)
    setK(0)
    setRun((n) => n + 1)
  }
  useEffect(() => {
    setStage({ kind: 'ready', start: performance.now() })
  }, [polls])
  const left = stage.kind === 'call' ? clamp(1 - el / CALL_S, 0, 1) : 0
  const tminus = stage.kind === 'ready' || stage.kind === 'poll' || stage.kind === 'hold' ? 60 - k * 9 : stage.kind === 'count' ? Math.max(0, Math.ceil(5 - el) * 2) : 0
  const hint =
    stage.kind === 'poll'
      ? tr('« {sys}, go / no go ? » — {read}', { sys: stage.poll.sys, read: stage.poll.read })
      : stage.kind === 'ready'
        ? tr('La directrice de vol va faire le tour des systèmes : lis la télémétrie, « go » si c’est dans les limites, « no go » sinon. Puis annonce les séparations.')
        : stage.kind === 'hold'
        ? tr('Décompte en attente : l’équipe de {sys} corrige…', { sys: stage.poll.sys })
        : stage.kind === 'count'
          ? tr('T−{n} s… Les moteurs s’allument.', { n: tminus })
          : stage.kind === 'call'
            ? tr('{name} : annonce « TOP » quand la jauge arrive à zéro.', { name: stage.call.name })
            : tr('La Pirogue est en orbite.')
  return (
    <Frame
      title={tr('Salle de contrôle : lancement de la Calao')}
      icon={Radar}
      hint={
        <>
          {hint}
          {said ? <span className="block text-[#ffd76a]">{said}</span> : null}
        </>
      }
      gauges={[
        stage.kind === 'call'
          ? { label: stage.call.what, value: left * 100, text: `${(left * CALL_S).toFixed(1)} s`, tone: left < 0.12 ? 'ok' : 'warn' }
          : stage.kind === 'poll'
            ? { label: tr('Réponse'), value: (1 - el / POLL_S) * 100, text: `${Math.max(0, Math.ceil(POLL_S - el))} s`, tone: el > POLL_S - 2 ? 'bad' : 'info' }
            : { label: tr('Décompte'), value: (tminus / 60) * 100, text: stage.kind === 'orbit' || rocket.current.lift >= 0 ? tr('vol') : `T−${tminus} s`, tone: 'info' },
        { label: tr('Appels justes'), value: max ? (points / max) * 100 : 0, text: `${points}/${max}`, tone: max && points / max < 0.5 ? 'warn' : 'ok' },
      ]}
      controls={
        stage.kind === 'ready' ? (
          <div className="flex gap-2">
            <Tap tone="#2b8a3e" onTap={() => nextPoll(0)} wide>
              {tr('Prendre la console')}
            </Tap>
          </div>
        ) : stage.kind === 'call' ? (
          <div className="flex gap-2">
            <Tap tone="#e8590c" onTap={top} wide>
              {tr('TOP !')}
            </Tap>
          </div>
        ) : (
          <div className="flex gap-2">
            <Tap tone="#c92a2a" disabled={stage.kind !== 'poll'} onTap={() => answer(false)}>
              {tr('NO GO')}
            </Tap>
            <Tap tone="#2b8a3e" disabled={stage.kind !== 'poll'} onTap={() => answer(true)} wide>
              {tr('GO')}
            </Tap>
          </div>
        )
      }
      ended={ended}
      onRetry={retry}
      send={send}
      onClose={onClose}
      bg="#111418"
      cam={{ position: [0, 6.2, 9.5], fov: 58 }}
    >
      <color attach="background" args={['#111418']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 8, 6]} intensity={0.7} />
      <CamLook />
      <Fused key={stage.kind === 'count' || stage.kind === 'call' ? 'on' : 'off'}>
        <Room lit={stage.kind === 'count' || stage.kind === 'call'} />
      </Fused>
      <PadView key={run} clock={rocket} />
    </Frame>
  )
}

function CamLook() {
  useFrame(({ camera }) => camera.lookAt(0, 2.6, -6))
  return null
}
