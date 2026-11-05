import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, fx } from './kit'
import { Stage3D, ease, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { Human, NoShadows, type Pose } from '../../../avatar/Human'
import { lookAt, randomLook } from '../../../avatar/options'
import { setExpression } from '../../../avatar/expressions'
import { Prop } from '../jeux/props'
import type { PropId } from '../jeux/types'
import { t } from '../../../lib/i18n'

// « La recette de Mémé Ahou », chapter 1 (game/epreuves.go): « prouve-moi que tu as du goût ». In Mémé's
// courtyard kitchen in the game's 3D blocks: the marmite on its three stones and its fire, Mémé beside it.
// She gives the sauce graine's seasonings one after another, and marks how much with a yellow ring inside
// the marmite (« jusque-là, pas plus »). Keep the finger down anywhere: the seasoning is tipped over the
// marmite and pours (a stream of little blocks), the sauce rising toward the ring; let go on the ring.
// Too little, it's flat; too much, ruined. Five seasonings, her face at each, her look at the end.

const INGREDIENTS = () => [
  { name: t('L’huile rouge'), color: '#e8590c', speed: 34, prop: 'bouteille' as PropId },
  { name: t('Le sel'), color: '#f1f3f5', speed: 26, prop: 'sachet-eau' as PropId },
  { name: t('Le piment'), color: '#c92a2a', speed: 40, prop: 'piment' as PropId },
  { name: t('Le poisson fumé'), color: '#8a5a2b', speed: 30, prop: 'poisson' as PropId },
  { name: t('L’aubergine'), color: '#5f3dc4', speed: 36, prop: 'calebasse' as PropId },
]
/** The marmite's inside: how high 100 % is, its radius. */
const POT_H = 1.5
const POT_R = 1.0
const POT_Y = 0.5
const DROPS = 14

export default function RecetteAhou({ onEnd }: { onEnd: (score: number) => void }) {
  const list = useRef(INGREDIENTS()).current
  const marks = useRef(list.map(() => 35 + Math.random() * 50)).current
  const [k, setK] = useState(0)
  const [pouring, setPouring] = useState(false)
  const [scores, setScores] = useState<number[]>([])
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [meme, setMeme] = useState<Pose>('idle')
  // The level, moved every frame (read by the scene), and the sound's beat.
  const level = useRef(0)
  const live = useRef({ pouring: false, k: 0, beat: 0 })
  live.current.pouring = pouring
  live.current.k = k

  const stop = () => {
    if (!pouring) return
    setPouring(false)
    const lv = level.current
    const off = Math.abs(lv - marks[k])
    // Within 3 on the gauge: perfect; past 25 off: nothing.
    const sc = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, off - 3) * 4.5)))
    const next = [...scores, sc]
    setScores(next)
    beep(sc >= 80 ? 880 : sc >= 50 ? 660 : 220, 0.2, 0.12, { type: sc >= 50 ? 'sine' : 'square' })
    const mid = screenOf(0, POT_Y + POT_H, 0)
    if (sc >= 80) fx.good(mid.x, mid.y, `${sc}/100`)
    else if (sc < 50) fx.bad(mid.x, mid.y, `${sc}/100`)
    else fx.float(`${sc}/100`, mid.x, mid.y, '#ffe066')
    // Mémé tastes: she nods, she shrugs, or she's appalled.
    setExpression('ahou', sc >= 85 ? 'proud' : sc >= 50 ? 'meh' : 'disgusted', 1600)
    setMeme(sc >= 85 ? 'thumbsup' : sc >= 50 ? 'shrug' : 'facepalm')
    setFlash({ text: sc >= 85 ? t('Mémé hoche la tête') : sc >= 50 ? t('Hmm… ça ira') : lv > marks[k] ? t('Trop ! Aïe aïe aïe') : t('Pas assez…'), at: Date.now() })
    setTimeout(() => {
      setMeme('idle')
      if (k + 1 >= list.length && next.reduce((a, b) => a + b, 0) / next.length >= 80) fx.win()
      if (k + 1 >= list.length) onEnd(Math.round(next.reduce((a, b) => a + b, 0) / next.length))
      else (setK(k + 1), (level.current = 0))
    }, 900)
  }
  const touch = (f: Finger) => {
    if (f.kind === 'down' && scores.length === k && k < list.length) {
      setPouring(true)
      setExpression('ahou', 'focused', 20000)
    } else if (f.kind === 'up') stop()
  }

  const ing = list[Math.min(k, list.length - 1)]
  return (
    <div className="absolute inset-0 text-white select-none">
      <Stage3D cam={[0, 5.2, 6.2]} look={[0, 1.2, 0]} fov={40} fit={[5.4, 3.8]} bg="#3d2414" touch={touch}>
        <Kitchen />
        <Pot level={level} mark={marks[Math.min(k, list.length - 1)]} color={ing.color} live={live} speed={ing.speed} />
        <Pourer prop={ing.prop} color={ing.color} pouring={pouring} k={k} />
        <Meme pose={meme} />
      </Stage3D>
      <Hud title={t('La sauce de Mémé Ahou')} done={`${Math.min(k + 1, list.length)}/${list.length}`} />
      <div className="pointer-events-none absolute inset-x-0 top-16 text-center">
        <div className="text-xs font-bold text-white/75">{t('Mémé Ahou : « Mets-moi…')}</div>
        <div key={k} className="animate-pop font-display text-2xl font-extrabold drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]" style={{ color: ing.color === '#f1f3f5' ? '#fff' : ing.color }}>
          {ing.name} {t('jusqu’au trait »')}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(18px,env(safe-area-inset-bottom))] text-center font-display text-lg font-extrabold text-[#ffd43b] drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">{pouring ? t('Ça coule…') : t('Garde appuyé pour verser')}</div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}

/** The courtyard's corner: the beaten earth, the wall, the three stones and the fire under the marmite. */
function Kitchen() {
  const flame = useRef<THREE.Group>(null)
  useFrame(() => {
    const f = flame.current
    if (f) f.children.forEach((m, i) => (m.scale.y = 0.8 + Math.abs(Math.sin(performance.now() / (90 + i * 23) + i)) * 0.6))
  })
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[10, 0.2, 8]} c="#8a5a3a" />
      <Box p={[0, 1.6, -2.6]} s={[10, 3.4, 0.3]} c="#c98b5a" />
      <Box p={[0, 0.2, -2.42]} s={[10, 0.4, 0.06]} c="#7a4a2a" />
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5
        return <Box key={i} p={[Math.cos(a) * 0.85, 0.22, Math.sin(a) * 0.85]} s={[0.42, 0.44, 0.42]} c="#6c757d" r={a} />
      })}
      <group ref={flame} position={[0, 0.05, 0]}>
        {[-0.25, 0, 0.25].map((x, i) => (
          <mesh key={i} position={[x, 0.15, (i - 1) * 0.12]}>
            <boxGeometry args={[0.16, 0.3, 0.16]} />
            <meshLambertMaterial color={i === 1 ? '#ffd43b' : '#fd7e14'} emissive={i === 1 ? '#ffd43b' : '#fd7e14'} emissiveIntensity={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** The marmite: open at the top, Mémé's yellow ring inside, the sauce rising while it pours. */
function Pot({ level, mark, color, live, speed }: { level: React.RefObject<number>; mark: number; color: string; live: React.RefObject<{ pouring: boolean; beat: number }>; speed: number }) {
  const sauce = useRef<THREE.Mesh>(null)
  const top = useRef<THREE.MeshLambertMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const tint = useMemo(() => new THREE.Color(), [])
  const brown = useMemo(() => new THREE.Color('#6b3a1e'), [])
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    const l = live.current
    if (l.pouring) {
      level.current = Math.min(100, level.current + speed * dt)
      l.beat += dt
      if (l.beat > 0.09) ((l.beat = 0), beep(180 + Math.random() * 60, 0.05, 0.03, { type: 'triangle' }))
    }
    const s = sauce.current
    if (s) {
      const h = Math.max(0.02, (level.current / 100) * POT_H)
      s.scale.y = h
      s.position.y = POT_Y + h / 2
    }
    // The sauce's top takes the seasoning's colour as it goes in.
    if (top.current) top.current.color.copy(tint.set(color).lerp(brown, 0.45))
    if (ring.current) ring.current.position.y = ease(ring.current.position.y, POT_Y + (mark / 100) * POT_H, 8, dt)
  })
  return (
    <group>
      {/* The pot's wall (both sides), its rim, its two handles, its bottom */}
      <mesh position={[0, POT_Y + POT_H / 2, 0]}>
        <cylinderGeometry args={[POT_R + 0.08, POT_R - 0.05, POT_H, 12, 1, true]} />
        <meshLambertMaterial color="#343a40" flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, POT_Y + POT_H, 0]}>
        <cylinderGeometry args={[POT_R + 0.14, POT_R + 0.14, 0.08, 12, 1, true]} />
        <meshLambertMaterial color="#495057" flatShading side={THREE.DoubleSide} />
      </mesh>
      <Box p={[-(POT_R + 0.22), POT_Y + POT_H - 0.25, 0]} s={[0.22, 0.12, 0.42]} c="#212529" />
      <Box p={[POT_R + 0.22, POT_Y + POT_H - 0.25, 0]} s={[0.22, 0.12, 0.42]} c="#212529" />
      <mesh position={[0, POT_Y, 0]}>
        <cylinderGeometry args={[POT_R - 0.05, POT_R - 0.1, 0.06, 12]} />
        <meshLambertMaterial color="#212529" flatShading />
      </mesh>
      {/* The sauce: a block of height 1 scaled to the level */}
      <mesh ref={sauce} position={[0, POT_Y, 0]}>
        <cylinderGeometry args={[POT_R - 0.02, POT_R - 0.07, 1, 12]} />
        <meshLambertMaterial ref={top} color="#6b3a1e" flatShading />
      </mesh>
      {/* Mémé's mark: a yellow ring round the inside */}
      <mesh ref={ring} position={[0, POT_Y + 0.5 * POT_H, 0]}>
        <cylinderGeometry args={[POT_R + 0.02, POT_R + 0.02, 0.06, 12, 1, true]} />
        <meshLambertMaterial color="#ffd43b" emissive="#ffd43b" emissiveIntensity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** The seasoning over the marmite: tipped while the finger's down, a stream of little blocks into the pot. */
function Pourer({ prop, color, pouring, k }: { prop: PropId; color: string; pouring: boolean; k: number }) {
  const hand = useRef<THREE.Group>(null)
  const drops = useRef<THREE.Group>(null)
  const st = useRef(Array.from({ length: DROPS }, (_, i) => ({ y: -1, life: i / DROPS })))
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    const h = hand.current
    if (h) {
      h.rotation.z = ease(h.rotation.z, pouring ? 2.0 : 0.25, 9, dt)
      h.position.y = ease(h.position.y, pouring ? 3.0 : 3.3, 9, dt)
    }
    const g = drops.current
    if (!g) return
    st.current.forEach((d, i) => {
      const m = g.children[i]
      if (!m) return
      d.life += dt * 2.2
      if (d.life >= 1) d.life = pouring ? 0 : 1.5
      m.visible = d.life < 1
      // From the spout down into the sauce.
      m.position.set(0.55 + Math.sin(i * 7.1) * 0.05, 2.7 - d.life * 2.1, Math.cos(i * 3.3) * 0.05)
    })
  })
  return (
    <group>
      <group ref={hand} position={[1.35, 3.3, 0]}>
        <group key={k} scale={0.75} position={[0, -0.35, 0]}>
          <Prop id={prop} />
        </group>
      </group>
      <group ref={drops}>
        {Array.from({ length: DROPS }, (_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[0.09, 0.09, 0.09]} />
            <meshLambertMaterial color={color} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Mémé Ahou beside her marmite, her headwrap and her grey hair, watching. */
function Meme({ pose }: { pose: Pose }) {
  const look = useMemo(() => {
    let s = 4242
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280)
    return lookAt({ ...randomLook('femme', rnd), hair: 'headwrap', hairColor: '#cfcfcf', outfit: 'boubou', outfitColor: '#f08c00', accessory: 'glasses' })
  }, [])
  return (
    <group position={[-2.2, 0, -0.7]} rotation={[0, 0.55, 0]} scale={1.5}>
      <NoShadows>
        <Human look={look} gender="femme" pose={pose} seed={11} fitted faceId="ahou" />
      </NoShadows>
    </group>
  )
}
