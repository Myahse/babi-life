import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { JeuShell, Stage } from '../Shell'
import { audio, juice, noise, snd } from '../juice'
import type { EngineProps, Jeu } from '../types'
import { t as tr } from '../../../../lib/i18n'

// Over the coals (the braiseuse's corn, the update « cuisine-ivoire »): four pieces on the grill, each
// cooking on the side that's down. A gauge over each one fills with that side: tap the piece to turn it
// when it's in the gold, and once both sides are golden, tap again to take it off onto the plate. Left too
// long, a side goes black and the piece is lost in smoke. New ones come on as the old ones go, to the last.

type Item = Extract<Jeu, { engine: 'griller' }>['item']
const SLOTS = 4
const SX = [-2.1, -0.7, 0.7, 2.1]
const GRILL_Y = 0.95
/** The gold: a side done just right; past BURNT it's lost. */
const GOLD_LO = 0.62
const GOLD_HI = 0.92
const BURNT = 1.18

type Piece = { on: boolean; cook: [number, number]; down: 0 | 1; rate: number; flip: number; gone: number; burnt: boolean }
type St = { pieces: Piece[]; started: number; served: number; sum: number; over: boolean; sizzle: number }

/** What each piece looks like raw and golden (and its size on the grill). */
const LOOK: Record<Item, { raw: string; gold: string; s: [number, number, number] }> = {
  mais: { raw: '#f2d257', gold: '#d18f16', s: [0.42, 0.42, 1.3] },
  igname: { raw: '#f4ecd8', gold: '#d39a52', s: [0.5, 0.34, 1.1] },
  banane: { raw: '#f7d046', gold: '#c4741c', s: [0.38, 0.32, 1.25] },
  brochette: { raw: '#c9726b', gold: '#83431c', s: [0.34, 0.34, 1.2] },
  poisson: { raw: '#aeb5bd', gold: '#7a5230', s: [0.5, 0.3, 1.35] },
}
const BLACK = new THREE.Color('#241710')
/** The glow over a piece whose side down is ready (gold), and getting too hot (red): seen without the gauge. */
const READY = new THREE.Color('#ffb020')
const HOT = new THREE.Color('#ff2a00')

/** A side's quality as it's left: gold 1, near it a little, raw or burnt nothing. */
const quality = (c: number) => (c >= GOLD_LO && c <= GOLD_HI ? 1 : c >= GOLD_LO - 0.12 && c <= GOLD_HI + 0.12 ? 0.6 : c >= 0.35 && c < BURNT ? 0.25 : 0)

/** One piece on the grill: its two sides coloured by how cooked each is, turned over, taken off; its gauge. */
function OnGrill({ i, item, st, onTap }: { i: number; item: Item; st: { current: St }; onTap: (i: number) => void }) {
  const look = LOOK[item]
  const g = useRef<THREE.Group>(null)
  const top = useMemo(() => new THREE.MeshLambertMaterial({ color: look.raw, flatShading: true }), [look])
  const bottom = useMemo(() => new THREE.MeshLambertMaterial({ color: look.raw, flatShading: true }), [look])
  const raw = useMemo(() => new THREE.Color(look.raw), [look])
  const gold = useMemo(() => new THREE.Color(look.gold), [look])
  const gauge = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const gaugeG = useRef<THREE.Group>(null)
  const smoke = useRef<(THREE.Mesh | null)[]>([])
  const paint = (m: THREE.MeshLambertMaterial, c: number) => {
    m.color.copy(raw).lerp(gold, Math.min(1, c / 0.8))
    if (c > GOLD_HI) m.color.lerp(BLACK, Math.min(1, (c - GOLD_HI) / (BURNT - GOLD_HI)))
  }
  useFrame(({ clock }, dt) => {
    const p = st.current.pieces[i]
    const o = g.current
    if (!o) return
    o.visible = p.on || p.gone > 0
    // The side up is the one not cooking: the camera sees the top and the front's lower half (the side down).
    paint(top, p.cook[1 - p.down])
    paint(bottom, p.cook[p.down])
    const d = p.cook[p.down]
    const hot = d > GOLD_HI
    const glow = !p.on ? 0 : hot ? 0.35 + Math.sin(clock.elapsedTime * 18) * 0.15 : d >= GOLD_LO ? 0.3 + Math.sin(clock.elapsedTime * 6) * 0.08 : 0
    top.emissive.copy(hot ? HOT : READY)
    top.emissiveIntensity = glow
    bottom.emissive.copy(hot ? HOT : READY)
    bottom.emissiveIntensity = glow
    p.flip = Math.max(0, p.flip - dt * 4)
    p.gone = Math.max(0, p.gone - dt * 2.2)
    const lift = p.flip > 0 ? Math.sin(p.flip * Math.PI) * 0.5 : 0
    const off = !p.on && p.gone > 0 ? 1 - p.gone : 0
    o.position.set(SX[i] + (p.burnt ? 0 : off * 0.6), GRILL_Y + lift + off * (p.burnt ? 0.2 : 1.6), off * (p.burnt ? 0 : 1.6))
    o.rotation.z = p.flip * Math.PI
    o.scale.setScalar(p.burnt && !p.on ? Math.max(0.01, p.gone) : 1)
    // The gauge: the side down, filling; the gold band lit.
    const c = p.cook[p.down]
    if (gaugeG.current) gaugeG.current.visible = p.on
    for (let k = 0; k < gauge.current.length; k++) {
      const m = gauge.current[k]
      if (!m) continue
      const mid = ((k + 0.5) / 6) * BURNT
      const full = mid <= c
      const band = mid >= GOLD_LO && mid <= GOLD_HI
      m.color.set(full ? (mid > GOLD_HI ? '#ff3d57' : band ? '#2fd158' : '#ffb020') : band ? '#1d6b33' : '#3a3f4a')
    }
    // Smoke: more as it chars.
    const puff = p.on ? Math.max(0, c - 0.7) * 2 : 0
    for (let k = 0; k < smoke.current.length; k++) {
      const m = smoke.current[k]
      if (!m) continue
      const ph = (clock.elapsedTime * 0.8 + k / 3 + i * 0.27) % 1
      m.visible = puff > 0.05
      m.position.set(SX[i] + Math.sin(ph * 6 + k) * 0.15, GRILL_Y + 0.35 + ph * 0.9, 0)
      m.scale.setScalar(0.12 + ph * 0.3 * Math.min(1.5, puff))
    }
  })
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onTap(i)
  }
  return (
    <>
      <group ref={g} onPointerDown={tap}>
        <mesh material={top} position={[0, look.s[1] * 0.25, 0]}>
          <boxGeometry args={[look.s[0], look.s[1] / 2, look.s[2]]} />
        </mesh>
        <mesh material={bottom} position={[0, -look.s[1] * 0.25, 0]}>
          <boxGeometry args={[look.s[0], look.s[1] / 2, look.s[2]]} />
        </mesh>
        {item === 'brochette' && <Box p={[0, 0, 0]} s={[0.05, 0.05, 1.8]} c="#c9a06a" />}
        {item === 'mais' && <Box p={[0, 0, 0.78]} s={[0.3, 0.3, 0.26]} c="#9bbf6a" />}
        {/* A wider block to tap (a finger is bigger than a corn cob) */}
        <mesh visible={false}>
          <boxGeometry args={[1.2, 1.2, 1.8]} />
        </mesh>
      </group>
      <group ref={gaugeG} position={[SX[i], GRILL_Y + 0.9, -0.9]}>
        <Box p={[0, 0.55, -0.06]} s={[0.36, 1.25, 0.06]} c="#22252e" />
        {[...Array(6)].map((_, k) => (
          <mesh key={k} position={[0, 0.05 + k * 0.2, 0]}>
            <boxGeometry args={[0.26, 0.16, 0.08]} />
            <meshBasicMaterial ref={(m) => void (gauge.current[k] = m)} color="#3a3f4a" />
          </mesh>
        ))}
      </group>
      {[0, 1, 2].map((k) => (
        <mesh key={k} ref={(m) => void (smoke.current[k] = m)} visible={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="#868e96" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

/** The grill: its legs, the coals glowing under the bars. */
function Grill() {
  const coal = useRef<THREE.MeshLambertMaterial>(null)
  useFrame(({ clock }) => {
    if (coal.current) coal.current.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 7) * 0.15 + Math.sin(clock.elapsedTime * 13) * 0.1
  })
  return (
    <group>
      <Box p={[0, 0.35, 0]} s={[6, 0.7, 2.2]} c="#3b3b3b" />
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[5.6, 0.08, 1.9]} />
        <meshLambertMaterial ref={coal} color="#ff6a1a" emissive="#ff4d00" emissiveIntensity={1} />
      </mesh>
      {[-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((z) => (
        <Box key={z} p={[0, 0.8, z]} s={[5.9, 0.04, 0.04]} c="#adb5bd" />
      ))}
      <pointLight position={[0, 1.2, 0.8]} color="#ff8a30" intensity={3} distance={5} />
    </group>
  )
}

/** The pieces cooking, the sizzle heard, the burnt ones lost, new ones put on. */
function Cook({ st, count, onBurnt, onDone }: { st: { current: St }; count: number; onBurnt: (i: number) => void; onDone: () => void }) {
  useFrame((_, dt0) => {
    const s = st.current
    if (s.over) return
    const dt = juice.dt(Math.min(0.05, dt0))
    let cooking = 0
    for (let i = 0; i < s.pieces.length; i++) {
      const p = s.pieces[i]
      if (!p.on) {
        // A new one put on, a moment after the last went.
        if (p.gone <= 0 && s.started < count) {
          Object.assign(p, newPiece(), { on: true })
          s.started++
        }
        continue
      }
      cooking++
      p.cook[p.down] += p.rate * dt
      if (p.cook[p.down] >= BURNT) {
        p.on = false
        p.burnt = true
        p.gone = 1
        s.served++
        onBurnt(i)
      }
    }
    s.sizzle -= dt
    const c = cooking ? audio() : null
    if (c && s.sizzle <= 0) {
      s.sizzle = 0.09 + Math.random() * 0.08
      noise(c.currentTime, 0.06, 5200 + Math.random() * 2500, 1.5, 0.02 + cooking * 0.008)
    }
    if (s.served >= count) {
      s.over = true
      onDone()
    }
  })
  return null
}

const newPiece = (): Piece => ({ on: false, cook: [0, 0], down: 0, rate: 0.09 + Math.random() * 0.06, flip: 0, gone: 0, burnt: false })

export function Griller({ jeu, onEnd }: EngineProps<'griller'>) {
  const count = jeu.count ?? 8
  const st = useRef<St>({ pieces: [...Array(SLOTS)].map(newPiece), started: 0, served: 0, sum: 0, over: false, sizzle: 0 })
  const [served, setServed] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1000)
  }
  const tap = (i: number) => {
    const s = st.current
    const p = s.pieces[i]
    if (!p || !p.on || s.over) return
    const at: [number, number, number] = [SX[i], GRILL_Y + 0.6, 0.3]
    const down = p.cook[p.down]
    const up = p.cook[1 - p.down]
    // Both sides golden (or near): off the grill onto the plate.
    if (up >= GOLD_LO - 0.12 && down >= GOLD_LO - 0.12) {
      const q = (quality(up) + quality(down)) / 2
      p.on = false
      p.gone = 1
      s.sum += q
      s.served++
      setServed(s.served)
      snd.whoosh(0.3)
      gesture('cook', 500)
      if (q >= 0.8) juice.good({ at, perfect: q === 1, text: q === 1 ? tr('Doré à point !') : tr('Bien braisé'), colors: [LOOK[jeu.item].gold, '#ffd43b', '#ffffff'] })
      else juice.bad({ at, text: tr('Pas très beau…'), soft: true })
      return
    }
    // Else turned over: the side that was down judged.
    p.down = (1 - p.down) as 0 | 1
    p.flip = 1
    haptic('light')
    snd.tap()
    gesture('cook', 400)
    if (down < GOLD_LO - 0.12) {
      juice.bad({ at, text: tr('Pas encore cuit !'), soft: true })
      say(tr('Attends que ça dore'))
    } else if (quality(down) === 1) juice.good({ at, text: tr('Tourné au bon moment'), quiet: false, colors: ['#ffd43b', '#ff922b', '#ffffff'] })
    else juice.good({ at, text: tr('Tourné'), quiet: true })
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = Number(e.key)
      if (k >= 1 && k <= SLOTS) tap(k - 1)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })
  const finish = () => {
    const s = st.current
    const sc = Math.max(5, Math.round((s.sum / count) * 100))
    gesture('cheer', 1500)
    juice.finish(sc, sc >= 85 ? tr('Tout est doré : la braiseuse t’embauche !') : sc >= 50 ? tr('Bien braisé, ça sent bon dans la rue.') : tr('Un peu de charbon dans la bouche…'), onEnd)
  }
  return (
    <JeuShell title={jeu.title} how={jeu.how} goal={tr('Tourne quand c’est doré !')} status={tr('{served}/{count} sortis du feu', { served, count })} said={said}>
      <Stage decor={jeu.decor} cam={[0, 4.6, 5.2]} look={[0, 0.9, 0]} fov={46}>
        <Grill />
        {SX.map((_, i) => (
          <OnGrill key={i} i={i} item={jeu.item} st={st} onTap={tap} />
        ))}
        <Cook
          st={st}
          count={count}
          onBurnt={(i) => {
            setServed(st.current.served)
            juice.bad({ at: [SX[i], GRILL_Y + 0.6, 0.3], text: tr('Brûlé !') })
            say(tr('Ça a brûlé…'))
            const c = audio()
            if (c) noise(c.currentTime, 0.3, 900, 0.8, 0.12, 300)
          }}
          onDone={finish}
        />
      </Stage>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:griller). */
export const demo: Extract<Jeu, { engine: 'griller' }> = { engine: 'griller', title: tr('Le maïs braisé'), how: tr('Tourne chaque épi quand la jauge est dans le vert, puis retire-le quand les deux côtés sont dorés.'), decor: 'terre', item: 'mais' }
