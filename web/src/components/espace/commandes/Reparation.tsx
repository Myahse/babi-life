import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Anchor, Wrench } from 'lucide-react'
import { t as tr } from '../../../lib/i18n'
import { haptic } from '../../../lib/native'
import { snd } from '../../defi/jeux/juice'
import { B } from '../../../world3d/espace/blocs'
import { Combinaison } from '../../../world3d/espace/Combinaison'
import { Terre } from '../../../world3d/espace/Terre'
import { Stars } from '../../../world3d/espace/placeholders'
import { clamp, Frame, Hold, Tap, useTicker, type Ended } from './Frame'
import { Fused } from './Fused'
import type { GameProps } from './types'

// La réparation (backend game.ReparationID, « station-reparation »): a spacewalk to change one module of a solar
// panel (the station's airlock, as SortieEVA's walk: the hand-holds along the truss, the tether, the oxygen). On
// the way, the tether's hook is moved to each yellow ring (never more than two hand-holds past the last one); at
// the panel the four bolts come off in a cross, the old module is pulled out, the new one pushed in gently (too
// fast, it bounces off its rails), the four bolts go back, and back to the airlock. The oxygen out: the tether
// reels the Sim back in, « retour au sas », nobody hurt.

const HOLDS: [number, number][] = [
  [1.6, 0.7],
  [3.2, -0.7],
  [4.8, 0.7],
  [6.4, -0.7],
  [8, 0.7],
  [9.6, -0.7],
]
/** The rings the tether hooks onto (hand-holds' indexes); -1 is the airlock's, hooked at the start. */
const RINGS = [1, 3, 5]
const PANEL_X = 11.6
/** The bolts, at the module's corners, and their order: in a cross. */
const BOLTS: [number, number][] = [
  [PANEL_X + 0.2, 0.9],
  [PANEL_X + 1.8, -0.9],
  [PANEL_X + 1.8, 0.9],
  [PANEL_X + 0.2, -0.9],
]
const AIR = 110
const STEPS = HOLDS.length * 2 + 10

type Phase = 'aller' | 'devisser' | 'tirer' | 'pousser' | 'visser' | 'retour'

type Live = { at: THREE.Vector3; air: number; slide: number; slideV: number; push: boolean; pull: boolean; reel: boolean }

function Scene({ live, phase, next, clip, bolts, onHold, onBolt }: { live: Live; phase: Phase; next: number; clip: number; bolts: number; onHold: (i: number) => void; onBolt: (i: number) => void }) {
  const me = useRef<THREE.Group>(null)
  const tether = useRef<THREE.Mesh>(null)
  const oldMod = useRef<THREE.Group>(null)
  const newMod = useRef<THREE.Group>(null)
  const pos = useRef(new THREE.Vector3())
  useFrame(({ camera, clock }, dt) => {
    const d = Math.min(0.05, dt)
    const want = live.reel ? new THREE.Vector3(0, 0, 0) : live.at
    pos.current.lerp(want, 1 - Math.exp(-d * (live.reel ? 1.4 : 4)))
    const p = pos.current
    if (me.current) {
      me.current.position.set(p.x - 0.3, p.y - 1.4, 1.9)
      me.current.rotation.set(Math.sin(clock.elapsedTime * 0.6) * 0.08, -Math.PI / 2.4, Math.sin(clock.elapsedTime * 0.5) * 0.06)
    }
    // The tether: from its hook (the airlock, or the ring last hooked) to the suit.
    const hook = clip < 0 || live.reel ? new THREE.Vector3(0, 0, 1.7) : new THREE.Vector3(HOLDS[clip][0], HOLDS[clip][1], 1.7)
    if (tether.current) {
      const dx = p.x - hook.x
      const dy = p.y - 0.2 - hook.y
      const len = Math.max(0.1, Math.hypot(dx, dy))
      tether.current.position.set(hook.x + dx / 2, hook.y + dy / 2, 1.7)
      tether.current.scale.set(1, len, 1)
      tether.current.rotation.z = Math.atan2(-dx, dy)
    }
    // The old module pulled out (towards the viewer), the new one on its rails.
    if (newMod.current) {
      newMod.current.visible = phase === 'pousser' || phase === 'visser' || phase === 'retour'
      newMod.current.position.y = -3.2 * (1 - live.slide)
    }
    if (oldMod.current) {
      oldMod.current.visible = phase !== 'pousser' && phase !== 'visser' && phase !== 'retour'
      oldMod.current.position.y = phase === 'tirer' ? 3.2 * live.slide : 0
    }
    camera.position.lerp(new THREE.Vector3(p.x + 2.4, p.y + 3, 15.5), 1 - Math.exp(-d * 2))
    camera.lookAt(p.x + 2.4, p.y - 0.6, 0)
  })
  const boltsShown = phase === 'devisser' ? BOLTS.map((_, i) => i >= bolts) : BOLTS.map(() => phase !== 'tirer' && phase !== 'pousser')
  const boltColor = (i: number) => ((phase === 'devisser' || phase === 'visser') && i === bolts ? '#ff922b' : phase === 'visser' ? (i < bolts ? '#51cf66' : '#868e96') : '#ced4da')
  return (
    <>
      <color attach="background" args={['#02030a']} />
      <Stars />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 15]} intensity={1.6} />
      <Fused>
      {/* The truss, the airlock at its start */}
      <B p={[6, 0, 0]} s={[13, 0.6, 0.6]} c="#adb5bd" />
      {Array.from({ length: 12 }, (_, i) => (
        <B key={i} p={[0.5 + i, 0, 0]} s={[0.08, 0.9, 0.9]} c="#868e96" r={[0.6, 0, 0]} />
      ))}
      <group position={[-1.6, 0, 0]}>
        <B p={[0, 0, 0]} s={[3, 3, 3]} c="#e9ecef" />
        <B p={[1.52, 0, 0]} s={[0.05, 1.8, 1.4]} c="#02030a" />
        <B p={[1.55, 0, 0.9]} s={[0.1, 0.3, 0.3]} c="#ffd43b" />
      </group>
      </Fused>
      {/* The solar wing: its cells, the slot of the module being changed */}
      <group position={[PANEL_X + 1, 0, -0.3]}>
        <B p={[0, 0, -0.06]} s={[2.4, 9, 0.08]} c="#1e3a8a" />
        {[-3.4, -2.2, 2.2, 3.4].map((y) => <B key={y} p={[0, y, 0]} s={[2.2, 1.05, 0.04]} c="#364fc7" />)}
        <B p={[0, 0, 0.02]} s={[2.3, 2.3, 0.04]} c="#22252e" />
        {[-1.25, 1.25].map((x) => <B key={x} p={[x, 0, 0.1]} s={[0.1, 3, 0.12]} c="#ced4da" />)}
        <group ref={oldMod}>
          <B p={[0, 0, 0.14]} s={[2.1, 2.1, 0.08]} c="#495057" />
          <B p={[0, 0, 0.19]} s={[1.6, 0.14, 0.02]} c="#ff6b6b" r={[0, 0, 0.78]} />
          <B p={[0, 0, 0.19]} s={[1.6, 0.14, 0.02]} c="#ff6b6b" r={[0, 0, -0.78]} />
        </group>
        <group ref={newMod}>
          <B p={[0, 0, 0.14]} s={[2.1, 2.1, 0.08]} c="#3b5bdb" />
          {[-0.5, 0.5].map((x) => [-0.5, 0.5].map((y) => <B key={`${x}${y}`} p={[x, y, 0.19]} s={[0.95, 0.95, 0.02]} c="#4c6ef5" />))}
        </group>
      </group>
      <Fused>
      {[-1, 1].map((side) => (
        <group key={side} position={[6 + side * 9, 3, -9]}>
          <B p={[0, 0, 0]} s={[0.3, 0.3, 4]} c="#adb5bd" />
          {[-1, 1].map((u) => (
            <group key={u} position={[0, u * 4.2, 0]}>
              <B p={[0, 0, 0]} s={[3.2, 7, 0.08]} c="#1e3a8a" />
              {Array.from({ length: 6 }, (_, k) => <B key={k} p={[0, -3 + k * 1.2, 0.06]} s={[3.1, 0.06, 0.02]} c="#c9a227" />)}
            </group>
          ))}
        </group>
      ))}
      </Fused>
      {/* The hand-holds (the next one glows; red: too far from the hook), the tether's rings */}
      {HOLDS.map(([x, y], i) => {
        const moving = phase === 'aller' || phase === 'retour'
        const glow = moving && i === next
        const far = phase === 'aller' && i === next && i > clip + 2
        return (
          <group key={i} position={[x, y, 0.4]}>
            <B p={[0, 0, 0]} s={[0.9, 0.16, 0.16]} c={far ? '#ff6b6b' : glow ? '#ffe066' : '#f59f00'} glow={glow} />
            {RINGS.includes(i) && <B p={[0, y > 0 ? 0.35 : -0.35, 0]} s={[0.36, 0.36, 0.08]} c={i <= clip ? '#40c057' : '#ffd43b'} glow={i > clip} />}
            <mesh onClick={(e) => (e.stopPropagation(), onHold(i))}>
              <boxGeometry args={[1.4, 1, 1]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        )
      })}
      {/* The bolts, numbered by their glow: the one to do now is the brightest */}
      {BOLTS.map(([x, y], i) =>
        boltsShown[i] ? (
          <group key={i} position={[x, y, 0.1]}>
            <B p={[0, 0, 0]} s={[0.32, 0.32, 0.32]} c={boltColor(i)} glow={(phase === 'devisser' || phase === 'visser') && i === bolts} />
            <mesh onClick={(e) => (e.stopPropagation(), onBolt(i))}>
              <boxGeometry args={[0.9, 0.9, 0.9]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        ) : null,
      )}
      <mesh ref={tether}>
        <boxGeometry args={[0.04, 1, 0.04]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <group ref={me} scale={0.8}>
        <Combinaison reach={0.6} />
      </group>
      <group position={[0, -120, -95]} rotation={[-Math.PI / 2.6, 0, 0]}>
        <Terre radius={62} view="orbite" />
      </group>
    </>
  )
}

export function Reparation({ send, onClose, look }: GameProps) {
  void look
  const [run, setRun] = useState(0)
  const live = useMemo<Live>(() => ({ at: new THREE.Vector3(), air: 100, slide: 0, slideV: 0, push: false, pull: false, reel: false }), [run]) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<Phase>('aller')
  const [next, setNext] = useState(0)
  const [clip, setClip] = useState(-1)
  const [bolts, setBolts] = useState(0)
  const [errors, setErrors] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const [ended, setEnded] = useState<Ended | null>(null)
  const done = useRef(0)
  const over = useRef(false)
  const end = (e: Ended) => {
    if (over.current) return
    over.current = true
    setEnded(e)
  }
  const progress = () => done.current / STEPS
  // The oxygen, and the module's slide (pulled out, pushed in: momentum, a bounce too fast).
  const hud = useTicker(() => {
    if (!over.current) {
      live.air = Math.max(0, live.air - 100 / (AIR * 10))
      if (live.air <= 0) {
        live.reel = true
        end({ score: Math.round(clamp(progress() * 45, 5, 45)), line: tr('Oxygène à zéro : la longe te ramène doucement au sas. Personne n’a rien : on recommence ?') })
      }
      if (phase === 'tirer' && live.pull) {
        live.slide = Math.min(1, live.slide + 0.035)
        if (live.slide >= 1) {
          snd.good()
          done.current++
          live.slide = 0
          setPhase('pousser')
          setSaid(tr('L’ancien module est sorti. Pousse le neuf sur ses rails, tout doucement.'))
        }
      }
      if (phase === 'pousser') {
        live.slideV = clamp(live.slideV + (live.push ? 0.012 : 0) - live.slideV * 0.04, 0, 0.12)
        live.slide += live.slideV
        if (live.slide >= 1) {
          if (live.slideV > 0.05) {
            live.slide = 0.65
            live.slideV = 0
            setErrors((n) => n + 1)
            haptic('medium')
            setSaid(tr('Trop vite : le module rebondit sur ses butées. Plus doucement !'))
          } else {
            live.slide = 1
            live.slideV = 0
            snd.good()
            haptic('light')
            done.current++
            setPhase('visser')
            setBolts(0)
            setSaid(tr('Il est en place ! Revisse les quatre boulons, en croix.'))
          }
        }
      }
    }
    return { air: live.air, slide: live.slide, v: live.slideV }
  })
  const goTo = (x: number, y: number) => live.at.set(x, y, 0)
  const onHold = (i: number) => {
    if (phase !== 'aller' && phase !== 'retour') return
    if (i !== next) {
      live.air = Math.max(0, live.air - 3)
      setErrors((n) => n + 1)
      return
    }
    if (phase === 'aller' && i > clip + 2) {
      haptic('light')
      setSaid(tr('La longe est trop courte : accroche-la d’abord à l’anneau jaune.'))
      return
    }
    goTo(...HOLDS[i])
    done.current++
    snd.tap()
    if (phase === 'aller') {
      if (i === HOLDS.length - 1) {
        setPhase('devisser')
        setBolts(0)
        goTo(PANEL_X - 0.4, 0)
        setSaid(tr('Au panneau ! Dévisse les quatre boulons, en croix : suis le boulon orange.'))
      } else setNext(i + 1)
    } else if (i === 0) {
      goTo(0, 0)
      done.current++
      end({ score: Math.round(clamp(50 + 30 * (live.air / 100) + 20 * (1 - errors / 6), 50, 100)), line: tr('De retour au sas, le module changé : le panneau recharge la station.') })
    } else setNext(i - 1)
  }
  const onClip = () => {
    const at = phase === 'aller' ? next - 1 : -1
    if (!RINGS.includes(at) || at <= clip) {
      setSaid(tr('Pas d’anneau ici : avance jusqu’au prochain anneau jaune.'))
      return
    }
    setClip(at)
    done.current++
    haptic('light')
    snd.good()
    setSaid(tr('Clic ! La longe est accrochée.'))
  }
  const onBolt = (i: number) => {
    if (phase !== 'devisser' && phase !== 'visser') return
    if (i !== bolts) {
      live.air = Math.max(0, live.air - 2)
      setErrors((n) => n + 1)
      setSaid(tr('Pas celui-là : en croix, suis le boulon orange.'))
      return
    }
    goTo(BOLTS[i][0] - 0.6, BOLTS[i][1])
    done.current++
    snd.tap()
    if (i < BOLTS.length - 1) return setBolts(i + 1)
    if (phase === 'devisser') {
      setPhase('tirer')
      setSaid(tr('Les boulons sont défaits. Tire l’ancien module hors de son logement.'))
    } else {
      setPhase('retour')
      setNext(HOLDS.length - 1)
      goTo(...HOLDS[HOLDS.length - 1])
      setSaid(tr('Réparé ! Retour au sas, prise par prise.'))
    }
  }
  const retry = () => {
    setPhase('aller')
    setNext(0)
    setClip(-1)
    setBolts(0)
    setErrors(0)
    setSaid(null)
    setEnded(null)
    done.current = 0
    over.current = false
    setRun((n) => n + 1)
  }
  const low = hud.air < 25
  const hint =
    said ??
    (phase === 'aller' ? tr('Touche la prise jaune qui brille. Accroche ta longe à chaque anneau jaune.') : phase === 'retour' ? tr('Retour au sas, prise par prise.') : tr('Au travail sur le panneau.'))
  return (
    <Frame
      title={tr('Réparation du panneau solaire')}
      icon={Wrench}
      hint={hint}
      gauges={[
        { label: tr('Oxygène'), value: hud.air, text: `${Math.round(hud.air)} %`, tone: low ? 'bad' : 'info' },
        { label: tr('Travail'), value: progress() * 100, text: `${Math.round(progress() * 100)} %`, tone: 'ok' },
        ...(phase === 'pousser' ? [{ label: tr('Glissement'), value: (hud.v / 0.12) * 100, text: hud.v > 0.05 ? tr('trop vite') : tr('doux'), tone: (hud.v > 0.05 ? 'bad' : 'ok') as 'bad' | 'ok' }] : []),
      ]}
      controls={
        <div className="flex gap-2">
          {(phase === 'aller' || phase === 'retour') && (
            <Tap tone="#ffffff22" onTap={() => onHold(next)} wide>
              {tr('Prise suivante')}
            </Tap>
          )}
          {phase === 'aller' && (
            <Tap tone="#f59f00" onTap={onClip} wide>
              <span className="flex items-center gap-1.5"><Anchor size={16} /> {tr('Accrocher la longe')}</span>
            </Tap>
          )}
          {phase === 'tirer' && <Hold wide tone="#e8590c" on={(d) => void (live.pull = d)}>{tr('Tirer le module (maintenir)')}</Hold>}
          {phase === 'pousser' && <Hold wide tone="#1c7ed6" on={(d) => void (live.push = d)}>{tr('Pousser doucement (maintenir)')}</Hold>}
          {(phase === 'devisser' || phase === 'visser') && (
            // The four bolts as they sit on the module (top-left, top-right; bottom-left, bottom-right).
            <div className="grid flex-1 grid-cols-2 gap-2">
              {[0, 2, 3, 1].map((i) => (
                <Tap key={i} tone={i === bolts ? '#e8590c' : i < bolts ? (phase === 'visser' ? '#2b8a3e' : '#ffffff10') : '#ffffff22'} onTap={() => onBolt(i)}>
                  {i === bolts ? tr('Boulon {n}/4', { n: bolts + 1 }) : '·'}
                </Tap>
              ))}
            </div>
          )}
        </div>
      }
      ended={ended}
      onRetry={retry}
      send={send}
      onClose={onClose}
      back={tr('Retour au sas')}
      cam={{ position: [2, 2, 10], fov: 55 }}
    >
      <Scene key={run} live={live} phase={phase} next={next} clip={clip} bolts={bolts} onHold={onHold} onBolt={onBolt} />
    </Frame>
  )
}
