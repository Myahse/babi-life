import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Hud, beep, fx, rnd } from './kit'
import { Stage3D } from './stage'
import { Box } from '../../../world3d/props'
import { MondeMesh, useMondes, type Monde } from '../../../world3d/mondes'
import { Bust3D } from './bust'
import { setExpression } from '../../../avatar/expressions'
import { t } from '../../../lib/i18n'

// « Le cacao de Daloa », chapter 2 (game/epreuves.go): at the maquis, the planters show what the pisteur
// weighed. The sack on the scale, the needle swinging, settling; and what the pisteur wrote in his book.
// Read the needle yourself: « Juste » if he wrote what it says, « Truqué ! » if he wrote less. Ten sacks,
// a few seconds each. At the maquis in the game's 3D blocks: the beam, the hanging scale and its dial,
// the needle swinging, the jute sack of beans on the hook, swaying as it's hung; the planter beside it.

const ROUNDS = 10
const MAX = 100 // kg on the dial

export default function CacaoDaloa({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ k: 0, real: 0, said: 0, rigged: false, start: 0, needle: 0, v: 0, good: 0, over: false, now: 0, w: 0, h: 0, locked: false, started: false })
  const [view, setView] = useState({ k: 0, said: 0, good: 0, show: false })

  const newSack = (now: number) => {
    const st = s.current
    st.real = Math.round(rnd(52, 92))
    st.rigged = Math.random() < 0.5
    st.said = st.rigged ? st.real - Math.round(rnd(4, 12)) : st.real
    st.start = now
    st.needle = 0
    st.v = 0
    st.locked = false
    setView({ k: st.k, said: st.said, good: st.good, show: false })
  }

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    if (st.start === 0 && st.k === 0) newSack(now + 0.001)
    // The needle: a spring towards the weight, swinging then settling.
    const target = now - st.start > 0.3 ? st.real : 0
    st.v += (target - st.needle) * 30 * dt
    st.v *= Math.pow(0.04, dt)
    st.needle += st.v * dt
    if (!view.show && now - st.start > 1.2) setView((v) => ({ ...v, show: true }))
  }

  const answer = (rigged: boolean, e: React.MouseEvent) => {
    const st = s.current
    if (st.locked || st.over || !view.show) return
    st.locked = true
    const spot = fx.local(e)
    const ok = rigged === st.rigged
    if (ok) {
      st.good++
      // Quick and right: a little more.
      beep(700, 0.1, 0.12)
      fx.good(spot.x, spot.y - 40, st.rigged ? t('Démasqué !') : t('Juste'))
      setExpression('planteur', st.rigged ? 'proud' : 'smile', 1200)
    } else {
      beep(170, 0.25, 0.12, { type: 'square' })
      fx.bad(spot.x, spot.y - 40, t('C’était {n} kg', { n: st.real }))
      setExpression('planteur', 'disappointed', 1400)
    }
    st.k++
    setView((v) => ({ ...v, good: st.good }))
    setTimeout(() => {
      if (st.k >= ROUNDS) {
        st.over = true
        const score = Math.round((st.good / ROUNDS) * 100)
        if (score >= 80) fx.win(st.w)
        onEnd(score)
      } else newSack(st.now)
    }, 900)
  }

  return (
    <div className="absolute inset-0 bg-[#3b2a1a] select-none">
      <Stage3D cam={[0, 1.8, 4.2]} look={[0, 1.7, 0]} fov={40} fit={[1.8, 1.0]} bg="#3b2a1a" onReady={() => (s.current.started = true)}>
        <Scale s={s} tick={tick} />
      </Stage3D>
      <div className="pointer-events-none absolute top-14 right-3 h-20 w-20 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#c08a52,#3b2a1a)] shadow">
        <Bust3D seed={6060} gender="homme" faceId="planteur" over={{ hair: 'short', outfit: 'chemise-pagne', accessory: 'cap' }} className="h-full w-full" cam={[0, 1.5, 1.5]} look={[0, 1.42, 0]} />
      </div>
      <Hud title={t('Juste ou truqué')} done={`${Math.min(view.k + 1, ROUNDS)}/${ROUNDS} · ${view.good} ✓`} />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className={`rounded-2xl bg-[#fff8e6] px-4 py-2 text-center text-sm font-extrabold text-[#3d2b1f] shadow transition ${view.show ? 'opacity-100' : 'opacity-0'}`}>{t('Le carnet du pisteur : « {n} kg »', { n: view.said })}</div>
        <div className="flex w-full max-w-[380px] gap-3">
          <button onClick={(e) => answer(false, e)} className="h-16 flex-1 rounded-[22px] bg-[#2f9e44] font-display text-lg font-extrabold text-white shadow-[0_5px_0_#1b5e2b] active:translate-y-1">
            {t('Juste')}
          </button>
          <button onClick={(e) => answer(true, e)} className="h-16 flex-1 rounded-[22px] bg-[#e03131] font-display text-lg font-extrabold text-white shadow-[0_5px_0_#8f1d1d] active:translate-y-1">
            {t('Truqué !')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The dial's face, drawn once on a texture: a mark every kilo, a long one every five, the number every ten. */
function useDial() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const g = c.getContext('2d')!
    g.fillStyle = '#fffaf0'
    g.fillRect(0, 0, 512, 512)
    g.translate(256, 256)
    for (let kg = 0; kg <= MAX; kg++) {
      const a = Math.PI * 0.75 + (kg / MAX) * Math.PI * 1.5
      const long = kg % 10 === 0 ? 46 : kg % 5 === 0 ? 30 : 16
      g.strokeStyle = '#212529'
      g.lineWidth = kg % 5 === 0 ? 5 : 3
      g.beginPath()
      g.moveTo(Math.cos(a) * 236, Math.sin(a) * 236)
      g.lineTo(Math.cos(a) * (236 - long), Math.sin(a) * (236 - long))
      g.stroke()
      if (kg % 10 === 0) {
        g.fillStyle = '#212529'
        g.font = 'bold 34px sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(String(kg), Math.cos(a) * 160, Math.sin(a) * 160)
      }
    }
    g.fillStyle = '#c92a2a'
    g.font = 'bold 30px sans-serif'
    g.fillText('kg', 0, 90)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

/** The beam, the scale (its body, its dial, the needle), the hook and the sack, swaying as it's hung. */
/**
 * The weighing at the maquis of Daloa: beaten earth, the plank wall, the beam in rough wood on its post
 * with the iron bracket, the sacks of beans stacked and the beans spilled on a tarp drying, the pisteur's
 * table with his ledger, a hurricane lamp hung.
 */
function daloaSet(m: Monde) {
  const r = m.r
  m.box([0, -0.1, 0], [8, 0.2, 6], '#5c3a21', 'terre', undefined, 0)
  m.box([0, 1.4, -1.6], [8, 3, 0.2], '#6b4a2f', 'bois', undefined, 0.04)
  for (let k = 0; k < 6; k++) m.box([-3.5 + k * 1.4, 1.4, -1.49], [0.08, 3, 0.04], '#4a3020', 'bois', undefined, 0)
  m.box([0, 2.85, -0.1], [3.2, 0.16, 0.16], '#4a2e20', 'ecorce', undefined, 0.04)
  m.box([-1.5, 1.4, -0.1], [0.16, 2.9, 0.16], '#4a2e20', 'ecorce', undefined, 0.04)
  m.beam([-1.5, 2.3, -0.1], [-1.0, 2.78, -0.1], 0.06, '#3a3a3a', 'tole')
  // The sacks stacked on the right, the beans drying on a tarp on the left.
  for (let k = 0; k < 5; k++) m.box([1.5 + (k % 3) * 0.6, 0.3 + Math.floor(k / 3) * 0.55, -1.0 + (k % 2) * 0.1], [0.55, 0.55, 0.45], '#b08a5a', 'tissage', [0, r() * 0.3, 0], 0.05)
  m.box([-2.2, 0.01, 0.2], [1.6, 0.02, 1.2], '#1971c2', 'rayure', undefined, 0.02)
  for (let k = 0; k < (m.lite ? 12 : 40); k++) m.box([-2.2 + (r() - 0.5) * 1.4, 0.03, 0.2 + (r() - 0.5) * 1.0], [0.04, 0.025, 0.03], r() < 0.5 ? '#6b3a1c' : '#4a2814', 'plastique', [0, r() * 3, 0], 0.1)
  // The pisteur's table and ledger, the lamp.
  m.box([-2.6, 0.75, -0.9], [1.0, 0.05, 0.6], '#8a6440', 'bois')
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box([-2.6 + sx * 0.45, 0.37, -0.9 + sz * 0.25], [0.05, 0.74, 0.05], '#6b4a2e', 'bois', undefined, 0)
  m.box([-2.5, 0.79, -0.9], [0.3, 0.02, 0.22], '#f8f9fa', 'plastique', [0, 0.2, 0], 0)
  m.box([-2.48, 0.8, -0.9], [0.02, 0.01, 0.2], '#1c7ed6', 'plastique', [0, 0.2, 0], 0)
  m.box([1.2, 2.5, -1.45], [0.14, 0.2, 0.14], '#8a2a1a', 'tole', undefined, 0)
  m.box([1.2, 2.66, -1.45], [0.02, 0.12, 0.02], '#3a3a3a', 'tole', undefined, 0)
}

function Scale({ s, tick }: { s: React.RefObject<{ needle: number; start: number; now: number }>; tick: (dt: number) => void }) {
  const dial = useDial()
  const needle = useRef<THREE.Group>(null)
  const sack = useRef<THREE.Group>(null)
  // « Mini-jeux réalistes »: the maquis of Daloa dressed (see daloaSet); the scale and the sack as they were.
  const mondes = useMondes()
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const st = s.current
    const n = needle.current
    // On the dial, 0 kg at the bottom left, clockwise (the texture's angles, as seen from the front).
    if (n) n.rotation.z = -(Math.PI * 0.75 + (Math.max(0, Math.min(MAX, st.needle)) / MAX) * Math.PI * 1.5)
    const k = sack.current
    if (k) {
      const since = st.now - st.start
      k.rotation.z = Math.sin(since * 5) * 0.25 * Math.exp(-since * 2.5)
      k.position.y = since < 0.3 ? 0.4 * (1 - since / 0.3) : 0
    }
  })
  return (
    <group>
      {mondes !== 'off' ? (
        <MondeMesh tier={mondes} seed="cacao-daloa" make={daloaSet} />
      ) : (
        <>
          <Box p={[0, -0.1, 0]} s={[8, 0.2, 6]} c="#5c3a21" />
          <Box p={[0, 1.4, -1.6]} s={[8, 3, 0.2]} c="#6b4a2f" />
          {/* The beam and its post */}
          <Box p={[0, 2.85, -0.1]} s={[3.2, 0.16, 0.16]} c="#4a2e20" />
          <Box p={[-1.5, 1.4, -0.1]} s={[0.16, 2.9, 0.16]} c="#4a2e20" />
        </>
      )}
      {/* The scale: its body, its dial facing us, the needle */}
      <Box p={[0, 2.62, 0]} s={[0.06, 0.32, 0.06]} c="#adb5bd" />
      <mesh position={[0, 2.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.18, 16]} />
        <meshLambertMaterial color="#c92a2a" flatShading />
      </mesh>
      <mesh position={[0, 2.08, 0.095]}>
        <circleGeometry args={[0.44, 32]} />
        <meshBasicMaterial map={dial} />
      </mesh>
      <group ref={needle} position={[0, 2.08, 0.11]}>
        {/* Points along +x at rotation 0, turned to the weight's angle */}
        <mesh position={[0.17, 0, 0]}>
          <boxGeometry args={[0.36, 0.025, 0.01]} />
          <meshBasicMaterial color="#e03131" />
        </mesh>
        <mesh>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshBasicMaterial color="#212529" />
        </mesh>
      </group>
      {/* The hook and the sack of beans */}
      <group position={[0, 1.58, 0]}>
        <Box p={[0, 0, 0]} s={[0.04, 0.2, 0.04]} c="#868e96" />
        <group ref={sack} position={[0, 0, 0]}>
          <group position={[0, -0.12, 0]}>
            <Box p={[0, -0.5, 0]} s={[0.62, 0.8, 0.5]} c="#b08a5a" />
            <Box p={[0, -0.08, 0]} s={[0.3, 0.12, 0.26]} c="#9c7a4a" />
            <Box p={[0, -0.5, 0.255]} s={[0.4, 0.08, 0.01]} c="#7a5230" />
          </group>
        </group>
      </group>
    </group>
  )
}
