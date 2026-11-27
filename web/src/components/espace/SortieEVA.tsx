import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Satellite, X } from 'lucide-react'
import type { Sim } from '../../lib/types'
import { api } from '../../lib/api'
import { t as tr } from '../../lib/i18n'
import { toast } from '../../lib/overlays'
import { B } from '../../world3d/espace/blocs'
import { Combinaison } from '../../world3d/espace/Combinaison'
import { Terre } from '../../world3d/espace/Terre'
import { Stars } from '../../world3d/espace/placeholders'

// The spacewalk (the station's « Sortie dans l'espace », backend sims/espaceVie.go): out of the airlock, tethered,
// from hand-hold to hand-hold along the truss to the solar panel that's out; its three bolts tightened; back the
// same way. The oxygen gauge empties as it goes (a wrong hand-hold costs a little): empty, the tether reels the
// Sim back into the airlock, nobody hurt, the walk scored as far as it went. The score (0–100) counts for the
// action's skill points (never money).

const HOLDS: [number, number][] = [
  [1.6, 0.7],
  [3.2, -0.7],
  [4.8, 0.7],
  [6.4, -0.7],
  [8, 0.7],
  [9.6, -0.7],
  [11.2, 0.7],
]
const PANEL_X = 13.4
const BOLTS: [number, number][] = [
  [PANEL_X + 0.4, 1.1],
  [PANEL_X + 1.6, -0.2],
  [PANEL_X + 0.8, -1.3],
]
/** Seconds of oxygen. */
const AIR = 55

type Phase = 'aller' | 'boulons' | 'retour' | 'fin'

function Scene({ at, phase, next, bolts, reel, onHold, onBolt }: { at: React.MutableRefObject<THREE.Vector3>; phase: Phase; next: number; bolts: boolean[]; reel: boolean; onHold: (i: number) => void; onBolt: (i: number) => void }) {
  const me = useRef<THREE.Group>(null)
  const tether = useRef<THREE.Mesh>(null)
  const pos = useRef(new THREE.Vector3(0, 0, 0))
  useFrame(({ camera, clock }, dt) => {
    const want = reel ? new THREE.Vector3(0, 0, 0) : at.current
    pos.current.lerp(want, 1 - Math.exp(-dt * (reel ? 1.5 : 4)))
    const p = pos.current
    if (me.current) {
      me.current.position.set(p.x - 0.3, p.y - 1.4, 1.9)
      me.current.rotation.set(Math.sin(clock.elapsedTime * 0.6) * 0.08, -Math.PI / 2.4, Math.sin(clock.elapsedTime * 0.5) * 0.06)
    }
    if (tether.current) {
      const len = Math.max(0.1, Math.hypot(p.x, p.y))
      tether.current.position.set(p.x / 2, p.y / 2 - 0.2, 1.7)
      tether.current.scale.set(1, len, 1)
      tether.current.rotation.z = Math.atan2(-p.x, p.y)
    }
    camera.position.lerp(new THREE.Vector3(p.x + 2, p.y + 2.4, 11), 1 - Math.exp(-dt * 2))
    camera.lookAt(p.x + 1.5, p.y - 0.4, 0)
  })
  return (
    <>
      <color attach="background" args={['#02030a']} />
      <Stars />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 15]} intensity={1.6} />
      {/* The truss, the airlock at its start, the solar wing at its end */}
      <B p={[7, 0, 0]} s={[15, 0.6, 0.6]} c="#adb5bd" />
      {Array.from({ length: 14 }, (_, i) => (
        <B key={i} p={[0.5 + i, 0, 0]} s={[0.08, 0.9, 0.9]} c="#868e96" r={[0.6, 0, 0]} />
      ))}
      <group position={[-1.6, 0, 0]}>
        <B p={[0, 0, 0]} s={[3, 3, 3]} c="#e9ecef" />
        <B p={[1.52, 0, 0]} s={[0.05, 1.8, 1.4]} c="#02030a" />
      </group>
      <group position={[PANEL_X + 1, 0, -0.3]}>
        <B p={[0, 0, 0]} s={[2.6, 3.6, 0.1]} c="#1e3a8a" />
        {[-0.6, 0.6].map((x) => [-1.2, 0, 1.2].map((y) => <B key={`${x}${y}`} p={[x, y, 0.06]} s={[1.1, 1.05, 0.02]} c={bolts.every(Boolean) ? '#3b5bdb' : (x + y) % 2 ? '#364fc7' : '#495057'} />))}
        <B p={[0, 0, 0.1]} s={[2.7, 0.06, 0.04]} c="#ced4da" />
      </group>
      {/* Far behind: the station's big solar wings and its radiators, gold and blue */}
      {[-1, 1].map((side) => (
        <group key={side} position={[6 + side * 9, 3, -9]}>
          <B p={[0, 0, 0]} s={[0.3, 0.3, 4]} c="#adb5bd" />
          {[-1, 1].map((u) => (
            <group key={u} position={[0, u * 4.2, 0]}>
              <B p={[0, 0, 0]} s={[3.2, 7, 0.08]} c="#1e3a8a" />
              {Array.from({ length: 6 }, (_, k) => (
                <B key={k} p={[0, -3 + k * 1.2, 0.06]} s={[3.1, 0.06, 0.02]} c="#c9a227" />
              ))}
            </group>
          ))}
        </group>
      ))}
      <B p={[7, -2.6, -6]} s={[5, 0.08, 2.4]} c="#f1f3f5" />
      <B p={[7, -2.6, -6]} s={[0.1, 0.1, 2.4]} c="#868e96" />
      {/* The hand-holds: the next one glows (tap it) */}
      {HOLDS.map(([x, y], i) => {
        const glow = (phase === 'aller' || phase === 'retour') && i === next
        return (
          <group key={i} position={[x, y, 0.4]}>
            <B p={[0, 0, 0]} s={[0.9, 0.16, 0.16]} c={glow ? '#ffe066' : '#f59f00'} glow={glow} />
            <mesh onClick={(e) => (e.stopPropagation(), onHold(i))}>
              <boxGeometry args={[1.4, 1, 1]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        )
      })}
      {BOLTS.map(([x, y], i) => (
        <group key={i} position={[x, y, 0]}>
          <B p={[0, 0, 0]} s={[0.3, 0.3, 0.3]} c={bolts[i] ? '#51cf66' : phase === 'boulons' ? '#ff6b6b' : '#868e96'} glow={phase === 'boulons' && !bolts[i]} />
          <mesh onClick={(e) => (e.stopPropagation(), onBolt(i))}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <mesh ref={tether}>
        <boxGeometry args={[0.04, 1, 0.04]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <group ref={me} scale={0.8}>
        <Combinaison look={undefined} reach={0.6} />
      </group>
      <group position={[0, -120, -95]} rotation={[-Math.PI / 2.6, 0, 0]}>
        <Terre radius={62} view="orbite" />
      </group>
    </>
  )
}

export function SortieEVA({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('aller')
  const [next, setNext] = useState(0)
  const [bolts, setBolts] = useState([false, false, false])
  const [air, setAir] = useState(100)
  const [reel, setReel] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const at = useRef(new THREE.Vector3(0, 0, 0))
  const airRef = useRef(100)
  const progress = useRef(0)
  const sent = useRef(false)

  const finish = (score: number, out: boolean) => {
    if (sent.current) return
    sent.current = true
    setPhase('fin')
    setReel(true)
    api
      .espaceJeu(sim.id, 'eva', score, out)
      .then((r) => setSaid(r.outcome.text))
      .catch((e) => setSaid(String(e?.message ?? e)))
  }
  useEffect(() => {
    if (phase === 'fin') return
    const t = setInterval(() => {
      airRef.current = Math.max(0, airRef.current - 100 / (AIR * 10))
      setAir(airRef.current)
      if (airRef.current <= 0) finish(Math.min(45, Math.round(progress.current * 45)), true)
    }, 100)
    return () => clearInterval(t)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (x: number, y: number) => at.current.set(x, y, 0)
  const onHold = (i: number) => {
    if (phase !== 'aller' && phase !== 'retour') return
    if (i !== next) {
      airRef.current = Math.max(0, airRef.current - 4)
      return
    }
    goTo(...HOLDS[i])
    if (phase === 'aller') {
      progress.current = (i + 1) / (HOLDS.length * 2 + 3)
      if (i === HOLDS.length - 1) setPhase('boulons')
      else setNext(i + 1)
    } else {
      progress.current = (HOLDS.length + 3 + (HOLDS.length - i)) / (HOLDS.length * 2 + 3)
      if (i === 0) {
        goTo(0, 0)
        finish(Math.round(60 + 40 * (airRef.current / 100)), false)
      } else setNext(i - 1)
    }
  }
  const onBolt = (i: number) => {
    if (phase !== 'boulons' || bolts[i]) return
    goTo(BOLTS[i][0] - 0.6, BOLTS[i][1])
    const b = bolts.map((v, k) => v || k === i)
    setBolts(b)
    progress.current = (HOLDS.length + b.filter(Boolean).length) / (HOLDS.length * 2 + 3)
    if (b.every(Boolean)) {
      setPhase('retour')
      setNext(HOLDS.length - 1)
    }
  }
  const low = air < 25
  const hint = phase === 'aller' ? tr('Touche la prise jaune qui brille pour avancer.') : phase === 'boulons' ? tr('Serre les trois boulons rouges du panneau.') : phase === 'retour' ? tr('Retour au sas, prise par prise.') : said ?? tr('Retour au sas…')
  return (
    <div className="animate-up fixed inset-0 z-[70] bg-black text-white">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 55, near: 0.1, far: 600, position: [2, 2, 9] }}>
        <Scene at={at} phase={phase} next={next} bolts={bolts} reel={reel} onHold={onHold} onBolt={onBolt} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-3 top-[max(1rem,var(--sat,env(safe-area-inset-top)))] flex items-start gap-2">
        <div className="pointer-events-auto flex flex-1 flex-col gap-1.5 rounded-2xl bg-black/65 p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Satellite size={16} className="text-[#ff7a00]" /> {tr('Sortie dans l’espace')}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-16 shrink-0">{tr('Oxygène')}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full rounded-full ${low ? 'animate-pulse bg-[#ff6b6b]' : 'bg-[#4dabf7]'}`} style={{ width: `${air}%` }} />
            </div>
            <span className="w-9 text-right tabular-nums">{Math.round(air)} %</span>
          </div>
          <p className="text-xs font-bold opacity-85">{hint}</p>
        </div>
        <button className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/65" aria-label={tr('Fermer')} onClick={() => (phase !== 'fin' && !sent.current ? finish(Math.min(45, Math.round(progress.current * 45)), false) : undefined, onClose())}>
          <X size={18} />
        </button>
      </div>
      {phase === 'fin' && said && (
        <div className="absolute inset-x-4 bottom-[calc(var(--sab,env(safe-area-inset-bottom))+2rem)]">
          <button
            className="w-full rounded-2xl bg-[#ff7a00] py-3 text-sm font-extrabold"
            onClick={() => {
              toast({ tone: 'event', title: tr('Sortie dans l’espace'), text: said, money: 0, icon: 'satellite' })
              onClose()
            }}
          >
            {tr('Retour au sas')}
          </button>
        </div>
      )}
    </div>
  )
}
