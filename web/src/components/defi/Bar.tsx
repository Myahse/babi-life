import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Banknote, Beer, GlassWater, LogOut, RefreshCw } from 'lucide-react'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import { weakDevice } from '../../lib/device'
import { gesture } from '../../world3d/gesture'
import { t as tr, tx, locale } from '../../lib/i18n'

// The pot with the friends at the maquis, played (the update « gestes-maison »):
// sat at the table, the bottle in front. « Boire » held: the perso drinks, a
// gulp at a time, the ambiance rising and the alcohol too (too long in one go
// and it chokes). The glass empty, « Resservir » held pours from the bottle (a
// round, 500 Djai): the bottle tips more and more, the beer rises with its
// head of foam; poured too fast it foams over the glass. « Billets » on the
// table's dancers: the ambiance jumps (the banknotes are paid). Water now and
// then: the alcohol comes down. Past the line, you're drunk: the evening ends
// there, badly. « Se lever » when the ambiance is up: a good evening. (Paid and
// counted by the server: backend sims/defi.go barNight.)

const ROUND = 500
const ROUNDS = 6
const BILLETS = 1000
const DRUNK = 100

/** The glass and the bottle as they are now (the little 3D view reads it every frame). */
type Pour = { beer: number; foam: number; tip: number; drinking: boolean; pouring: boolean }

export function BarDefi({ money, onEnd }: { /** What the Sim has: no round nor banknote past it. */ money: number; onEnd: (score: number, extra: string) => void }) {
  const [glass, setGlass] = useState(1)
  const [alcohol, setAlcohol] = useState(0)
  const [ambiance, setAmbiance] = useState(0)
  const [rounds, setRounds] = useState(0)
  const [billets, setBillets] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const done = useRef(false)
  const pour = useRef<Pour>({ beer: 0.85, foam: 0.12, tip: 0, drinking: false, pouring: false })
  // What's held, and since when (s).
  const held = useRef<{ what: 'drink' | 'pour' | null; t: number; opened: boolean }>({ what: null, t: 0, opened: false })
  const left = money - rounds * ROUND - billets
  const st = useRef({ alcohol, ambiance, left, rounds })
  st.current = { alcohol, ambiance, left, rounds }
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const say = (t: string) => {
    setSaid(t)
    if (sayTimer.current) clearTimeout(sayTimer.current)
    sayTimer.current = setTimeout(() => setSaid(null), 1400)
  }
  const end = (drunk: boolean) => {
    if (done.current) return
    done.current = true
    held.current.what = null
    const { ambiance: a, alcohol: al } = st.current
    const score = drunk ? Math.round(a * 0.3) : Math.round(Math.min(100, a) * (al > 70 ? 0.85 : 1))
    setTimeout(() => onEnd(score, `tournees:${st.current.rounds};billets:${billets}${drunk ? ';soul' : ''}`), drunk ? 1600 : 300)
  }
  const endRef = useRef(end)
  endRef.current = end

  // Every frame: what's held goes on (drinking, pouring); the alcohol and the ambiance come down slowly.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let gestureAt = 0
    let soundAt = 0
    let shown = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const h = held.current
      const p = pour.current
      let dAlc = -2.4 * dt
      let dAmb = -1 * dt
      if (!done.current && h.what === 'drink' && p.beer + p.foam > 0.01) {
        h.t += dt
        // A gulp: the foam first, then the beer.
        const sip = 0.24 * dt
        const fromFoam = Math.min(p.foam, sip * 0.6)
        p.foam -= fromFoam
        p.beer = Math.max(0, p.beer - (sip - fromFoam))
        dAmb += 7 * dt
        dAlc += 10 * dt
        if (now > gestureAt) ((gestureAt = now + 1200), gesture('drink', 1400))
        // Too long in one go: it goes down the wrong way.
        if (h.t > 2.6) {
          h.what = null
          haptic('error')
          say(tr('Tu t’étrangles ! Doucement…'))
          setAmbiance((a) => Math.max(0, a - 4))
        }
      } else if (!done.current && h.what === 'pour') {
        h.t += dt
        // The bottle tips more and more as it's held: faster, and the faster, the more it foams.
        p.tip = Math.min(1, p.tip + dt * 0.9)
        const rate = 0.12 + 0.55 * p.tip
        p.beer += rate * dt * (1 - Math.min(0.7, p.tip * 0.6))
        p.foam += rate * dt * (0.15 + Math.max(0, p.tip - 0.45) * 1.6)
        if (now > soundAt) ((soundAt = now + 110), sfx.pour(Math.min(1, p.beer + p.foam), 0.2))
        // Over the brim: the foam runs down the glass, on the table.
        if (p.beer + p.foam > 1.05) {
          h.what = null
          p.foam = Math.max(0, 1 - p.beer)
          haptic('error')
          say(tr('Ça mousse partout ! Verse plus doucement.'))
          dAmb += 2
        }
      } else p.tip = Math.max(0, p.tip - dt * 3)
      // The foam settles into beer, slowly.
      if (h.what !== 'pour' && p.foam > 0.08) {
        const k = Math.min(p.foam - 0.08, 0.06 * dt)
        p.foam -= k
        p.beer += k * 0.4
      }
      p.drinking = h.what === 'drink'
      p.pouring = h.what === 'pour'
      // The page's numbers, a few times a second.
      if (now > shown) {
        shown = now + 120
        setGlass(Math.min(1, p.beer + p.foam))
        setAmbiance((a) => Math.max(0, Math.min(100, a + dAmb / dt * 0.12)))
        setAlcohol((a) => {
          const v = Math.max(0, a + dAlc / dt * 0.12)
          if (v >= DRUNK && !done.current) {
            haptic('error')
            say(tr('Tu as trop bu… tout tourne !'))
            endRef.current(true)
          }
          return v
        })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    if (alcohol > 75 && alcohol < DRUNK) say(tr('Doucement, ça monte !'))
  }, [alcohol > 75]) // eslint-disable-line react-hooks/exhaustive-deps

  const startDrink = () => {
    if (done.current || pour.current.beer + pour.current.foam <= 0.01) return
    haptic('light')
    held.current = { what: 'drink', t: 0, opened: held.current.opened }
  }
  const startPour = () => {
    if (done.current) return
    const p = pour.current
    if (p.beer + p.foam > 0.6) return say(tr('Le verre est encore plein.'))
    // A new bottle: a round, paid.
    if (!held.current.opened) {
      if (st.current.rounds >= ROUNDS) return say(tr('Le serveur : « C’est la dernière, hein ! »'))
      if (st.current.left < ROUND) return say(tr('Plus assez pour une tournée.'))
      gesture('cheer', 1400)
      setRounds((r) => r + 1)
      setAmbiance((a) => Math.min(100, a + 6))
      say(tr('Le serveur ouvre une autre bouteille !'))
    }
    held.current = { what: 'pour', t: 0, opened: true }
  }
  const stop = () => {
    const h = held.current
    // A glass well served: full, a nice head of foam, nothing spilt.
    if (h.what === 'pour') {
      const p = pour.current
      if (p.beer + p.foam > 0.85 && p.foam > 0.06 && p.foam < 0.25) (say(tr('Bien servi, la mousse juste !')), setAmbiance((a) => Math.min(100, a + 4)), haptic('success'))
      // The bottle's poured out once the glass is full.
      if (p.beer + p.foam > 0.85) h.opened = false
    }
    h.what = null
  }
  const water = () => {
    if (done.current) return
    gesture('drink', 1000)
    setAlcohol((a) => Math.max(0, a - 18))
    setAmbiance((a) => Math.max(0, a - 3))
  }
  const throwMoney = () => {
    if (done.current) return
    if (left < BILLETS) return say(tr('Plus de billets à lancer.'))
    haptic('success')
    gesture('throw', 1600)
    setBillets((b) => b + BILLETS)
    setAmbiance((a) => Math.min(100, a + 14))
    say(tr('Les billets volent, la table crie ton nom !'))
  }
  // Tipsy, the screen sways; drunk, it spins.
  const sway = alcohol > 55 ? Math.min(6, (alcohol - 55) / 7) : 0
  const empty = glass <= 0.05
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]" style={sway ? { animation: `bar-sway ${3 - sway / 4}s ease-in-out infinite`, ['--sway' as string]: `${sway}deg` } : undefined}>
      <style>{'@keyframes bar-sway { 0%,100% { transform: rotate(calc(var(--sway) * -1)) } 50% { transform: rotate(var(--sway)) } }'}</style>
      {said && <div className="mx-auto mb-2 animate-pop rounded-2xl bg-[#0f1230]/85 px-4 py-2 text-center text-[14px] font-extrabold text-white">{said}</div>}
      <div className="card pointer-events-auto mx-auto w-full max-w-[560px] p-3">
        <div className="flex items-end gap-3">
          {/* The glass and the bottle up close: the beer, its foam, the bottle tipping as it pours. */}
          <div className="h-[118px] w-[92px] shrink-0 overflow-hidden rounded-2xl bg-[#2a1a10]">
            <Canvas dpr={weakDevice ? 1 : [1, 1.5]} gl={{ alpha: true, antialias: !weakDevice }} camera={{ position: [0, 0.2, 0.85], fov: 34 }} onCreated={({ camera }) => camera.lookAt(-0.02, 0.17, 0)}>
              <hemisphereLight args={['#fff1d6', '#3a2416', 1.3]} />
              <directionalLight position={[0.5, 1, 1]} intensity={1} />
              <GlassView p={pour} />
            </Canvas>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Gauge label={tr('Ambiance')} value={ambiance} color="#00a862" />
            <Gauge label={tr('Alcool')} value={alcohol} color={alcohol > 75 ? '#ff3d57' : '#ffa000'} line={DRUNK} />
            <div className="text-[11.5px] font-extrabold text-[var(--color-ink-soft)]">
              {tx('Tournées {rounds}/{ROUNDS} · billets {0} · reste {1}', { rounds, ROUNDS, 0: billets.toLocaleString(locale()), 1: Math.max(0, left).toLocaleString(locale()) })}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          <Btn icon={Beer} label={tr('Boire')} hint={tr('tenir')} onDown={startDrink} onUp={stop} on={!empty} />
          <Btn icon={RefreshCw} label={tr('Verser')} hint={tr('tenir')} onDown={startPour} onUp={stop} on={glass <= 0.6} />
          <Btn icon={GlassWater} label={tr('De l’eau')} onDown={water} on />
          <Btn icon={Banknote} label={tr('Billets')} onDown={throwMoney} on={left >= BILLETS} />
          <Btn icon={LogOut} label={tr('Se lever')} onDown={() => end(false)} on />
        </div>
      </div>
    </div>
  )
}

const cylG = new THREE.CylinderGeometry(1, 1, 1, 18)
const boxG = new THREE.BoxGeometry(1, 1, 1)
const GLASS = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false })
const BEER = new THREE.MeshLambertMaterial({ color: '#e8a400', emissive: '#5a3a00' })
const FOAM = new THREE.MeshLambertMaterial({ color: '#fff8e6' })
const BOTTLE = new THREE.MeshLambertMaterial({ color: '#5a3416' })
const LABEL = new THREE.MeshLambertMaterial({ color: '#f4c430' })
const GH = 0.2
const GR = 0.06

/** The glass on the table, the bottle over it tipping as it pours, the stream. */
function GlassView({ p }: { p: React.RefObject<Pour> }) {
  const beer = useRef<THREE.Mesh>(null)
  const foam = useRef<THREE.Mesh>(null)
  const bottle = useRef<THREE.Group>(null)
  const stream = useRef<THREE.Mesh>(null)
  const glass = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const s = p.current
    if (!s) return
    const b = Math.min(1, s.beer)
    const f = Math.min(1 - b, s.foam)
    if (beer.current) ((beer.current.visible = b > 0.01), beer.current.scale.set(GR * 0.92, Math.max(0.001, b * GH), GR * 0.92), (beer.current.position.y = (b * GH) / 2 + 0.004))
    if (foam.current) ((foam.current.visible = f > 0.005), foam.current.scale.set(GR * 0.94, Math.max(0.001, f * GH), GR * 0.94), (foam.current.position.y = b * GH + (f * GH) / 2 + 0.004))
    // The bottle: up when it pours, tipped as far as it's poured; set down beside the glass otherwise.
    if (bottle.current) {
      const g = bottle.current
      const on = s.pouring ? 1 : 0
      g.position.x += ((on ? -0.22 : -0.14) - g.position.x) * Math.min(1, dt * 10)
      g.position.y += ((on ? GH + 0.13 : 0) - g.position.y) * Math.min(1, dt * 10)
      g.rotation.z += ((on ? -(1.2 + s.tip * 0.9) : 0) - g.rotation.z) * Math.min(1, dt * 10)
    }
    if (stream.current) {
      stream.current.visible = s.pouring
      const top = GH + 0.05
      const bottom = (b + f) * GH
      stream.current.scale.set(0.006 + s.tip * 0.006, Math.max(0.01, top - bottom), 0.006 + s.tip * 0.006)
      stream.current.position.set(-0.015, (top + bottom) / 2, 0)
    }
    // Drinking: the glass lifts off the table, tilted towards the mouth.
    if (glass.current) {
      const g = glass.current
      g.position.y += ((s.drinking ? 0.05 : 0) - g.position.y) * Math.min(1, dt * 8)
      g.rotation.z += ((s.drinking ? 0.5 : 0) - g.rotation.z) * Math.min(1, dt * 8)
    }
  })
  return (
    <group position={[0.03, 0, 0]}>
      <mesh geometry={boxG} position={[0, -0.01, 0]} scale={[0.6, 0.02, 0.3]}>
        <meshLambertMaterial color="#c9ccd1" />
      </mesh>
      <group ref={glass}>
        <mesh geometry={cylG} material={GLASS} position={[0, GH / 2, 0]} scale={[GR, GH, GR]} renderOrder={2} />
        <mesh ref={beer} geometry={cylG} material={BEER} />
        <mesh ref={foam} geometry={cylG} material={FOAM} />
      </group>
      <mesh ref={stream} geometry={cylG} material={BEER} visible={false} />
      {/* The bottle, its pivot at its mouth. */}
      <group ref={bottle} position={[-0.14, 0, 0]}>
        <group position={[0, 0, 0]}>
          <mesh geometry={cylG} material={BOTTLE} position={[0, 0.09, 0]} scale={[0.035, 0.18, 0.035]} />
          <mesh geometry={cylG} material={LABEL} position={[0, 0.08, 0]} scale={[0.036, 0.06, 0.036]} />
          <mesh geometry={cylG} material={BOTTLE} position={[0, 0.21, 0]} scale={[0.014, 0.07, 0.014]} />
        </group>
      </group>
    </group>
  )
}

function Gauge({ label, value, color, line }: { label: string; value: number; color: string; line?: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11.5px] font-extrabold">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.min(100, value)}%`, background: color }} />
        {line && <span className="absolute top-0 bottom-0 w-[2px] bg-[#d81b3f]" style={{ left: `${Math.min(99, line)}%` }} />}
      </div>
    </div>
  )
}

/** A button: pressed (and, held, until it's let go). */
function Btn({ icon: Icon, label, hint, onDown, onUp, on }: { icon: typeof Beer; label: string; hint?: string; onDown: () => void; onUp?: () => void; on: boolean }) {
  return (
    <button
      className={`flex touch-none flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] leading-tight font-extrabold select-none active:scale-95 ${on ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}
      onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), onDown())}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon size={20} strokeWidth={2.4} />
      {label}
      {hint && <span className="text-[9px] opacity-80">{hint}</span>}
    </button>
  )
}
