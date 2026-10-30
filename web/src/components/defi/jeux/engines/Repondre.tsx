import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage, Who } from '../Shell'
import type { Decor, EngineProps, Host, Jeu } from '../types'
import { MicCrowd, MIC_CAM, MIC_BAR, MIC_HEART } from './RepondreMic'
import { t as tr } from '../../../../lib/i18n'

// Talk (the client, the friend, the patient): they face you and say something, three replies; the one
// that fits pleases them (a heart), the others annoy them. Their mood, a bar of blocks beside them, makes the score.
// At the mic (the commentator, the tournament's speaker): the player's own Sim holds it, in front of
// a crowd who cheer the right line and boo the wrong one (RepondreMic.tsx).

const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v)
const oneOf = (l: string[]) => l[Math.floor(Math.random() * l.length)]

const BLOCKS = 8
const BAR_COLORS = ['#e03131', '#f03e3e', '#f76707', '#fd7e14', '#fcc419', '#94d82d', '#51cf66', '#2f9e44']
// Who's there, a little turned to the camera (over the player's shoulder, to the right).
const NPC: [number, number, number] = [0, 0, -0.6]
const CAM: [number, number, number] = [0.6, 1.55, 1.6]

/** Behind them: the sky outdoors, a wall indoors (with its plinth). */
function Backdrop({ decor }: { decor: Decor }) {
  const out = ['etal', 'sable', 'herbe', 'eau', 'bitume', 'terre', 'piste', 'ciel'].includes(decor)
  return out ? (
    <group>
      <Box p={[0, 2.5, -3.6]} s={[12, 6, 0.2]} c="#8fd0f2" />
      <Box p={[-2.6, 0.9, -3.4]} s={[3, 1.8, 0.3]} c="#d9c3a0" />
      <Box p={[2.9, 0.7, -3.4]} s={[2.4, 1.4, 0.3]} c="#e0b089" />
    </group>
  ) : (
    <group>
      <Box p={[0, 2.5, -3.6]} s={[12, 6, 0.2]} c="#efe2c8" />
      <Box p={[0, 0.15, -3.45]} s={[12, 0.3, 0.1]} c="#a9825a" />
    </group>
  )
}

/** The mood: a column of blocks, lit up to where it's at; it jumps when it moves, shakes when it drops. */
function MoodBar({ mood, beat, down, at = [-0.62, 0.95, -0.5] }: { mood: number; beat: number; down: boolean; at?: [number, number, number] }) {
  const blocks = useRef<(THREE.Group | null)[]>([])
  const g = useRef<THREE.Group>(null)
  const t = useRef(9)
  useEffect(() => void (t.current = 0), [beat])
  useFrame((_, dt) => {
    t.current += dt
    const lit = Math.round(mood)
    blocks.current.forEach((b, i) => {
      if (!b) return
      const want = i < lit ? 1 : 0.7
      const pop = i === lit - 1 && !down ? Math.max(0, 0.35 - t.current) * 1.6 : 0
      const s = THREE.MathUtils.lerp(b.scale.x, want + pop, Math.min(1, dt * 12))
      b.scale.set(s, s, s)
    })
    if (g.current) g.current.position.x = at[0] + (down ? Math.sin(t.current * 40) * Math.max(0, 0.4 - t.current) * 0.15 : 0)
  })
  const lit = Math.round(mood)
  return (
    <group ref={g} position={at}>
      <Box p={[0, -0.04, 0]} s={[0.26, 0.04, 0.26]} c="#343a40" />
      {[...Array(BLOCKS)].map((_, i) => (
        <group key={i} ref={(r) => void (blocks.current[i] = r)} position={[0, 0.07 + i * 0.115, 0]}>
          <Box p={[0, 0, 0]} s={[0.18, 0.095, 0.18]} c={i < lit ? BAR_COLORS[i] : '#868e96'} glow={i < lit ? 0.25 : undefined} />
        </group>
      ))}
      <group position={[0, 0.03 + BLOCKS * 0.115, 0]} scale={0.22}>
        <Prop id="coeur" />
      </group>
    </group>
  )
}

/** A heart popping up over their head, rising, then gone. */
function Heart({ onDone, at = [NPC[0] + 0.5, 1.4, NPC[2] + 0.35] }: { onDone: () => void; at?: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    const k = t.current
    if (!g.current) return
    const s = k < 0.25 ? (k / 0.25) * 0.45 : k < 1.0 ? 0.45 - Math.sin((k - 0.25) * 12) * 0.04 : Math.max(0, 0.45 - (k - 1.0) * 1.8)
    g.current.scale.setScalar(s)
    g.current.position.y = at[1] + k * 0.3
    g.current.rotation.y = Math.sin(k * 5) * 0.4
    if (k > 1.3) onDone()
  })
  return (
    <group ref={g} position={at} scale={0}>
      <Prop id="coeur" />
    </group>
  )
}

/** Who you talk to: facing you, a hop when pleased, a shake of the head when not. */
function Npc({ host, pose, beat }: { host: Host; pose: 'talk' | 'cheer' | 'rant'; beat: number }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  const face = Math.atan2(CAM[0] - NPC[0], CAM[2] - NPC[2]) * 0.8
  useEffect(() => void (t.current = 0), [beat])
  useFrame((_, dt) => {
    t.current += dt
    const k = t.current
    if (!g.current) return
    g.current.position.y = pose === 'cheer' ? Math.max(0, Math.sin(Math.min(k, 0.6) * Math.PI * 1.67)) * 0.1 : 0
    g.current.rotation.y = face + (pose === 'rant' ? Math.sin(k * 24) * Math.max(0, 0.5 - k) * 0.35 : Math.sin(k * 0.9) * 0.04)
  })
  return (
    <group ref={g} position={NPC} rotation={[0, face, 0]}>
      <Who host={host} seed={5} pose={pose} />
    </group>
  )
}

export function Repondre({ jeu, onEnd }: EngineProps<'repondre'>) {
  const lines = jeu.lines
  const mic = jeu.crowd
  const n = lines.length
  const [k, setK] = useState(0)
  const [chose, setChose] = useState<number | null>(null)
  const [pose, setPose] = useState<'talk' | 'cheer' | 'rant'>('talk')
  const [mood, setMood] = useState(BLOCKS / 2)
  const [said, setSaid] = useState<string | null>(null)
  const [hearts, setHearts] = useState<number[]>([])
  const [beat, setBeat] = useState(0)
  const st = useRef({ mood: BLOCKS / 2, over: false, heart: 0 })
  const [line, replies, ok] = lines[k]
  const order = useMemo(() => shuffle(replies.map((_, i) => i)), [k]) // eslint-disable-line react-hooks/exhaustive-deps
  const reply = (i: number) => {
    if (chose !== null || st.current.over) return
    setChose(i)
    const good = i === ok
    // All right fills the bar, all wrong empties it.
    st.current.mood = Math.max(0, Math.min(BLOCKS, st.current.mood + ((good ? 1 : -1) * BLOCKS) / 2 / n))
    setMood(st.current.mood)
    setBeat((b) => b + 1)
    haptic(good ? 'success' : 'error')
    gesture('talk', 1200)
    setPose(good ? 'cheer' : 'rant')
    if (good) setHearts((h) => [...h, st.current.heart++])
    setSaid(good ? oneOf([tr('Ça lui plaît !'), tr('Bien envoyé !'), tr('Le courant passe !')]) : oneOf([tr('Aïe, ça passe mal…'), tr('Hum… pas terrible.'), tr('Ça l’agace…')]))
    setTimeout(
      () => {
        setSaid(null)
        if (k + 1 >= n) {
          st.current.over = true
          const score = Math.max(10, Math.round((st.current.mood / BLOCKS) * 100))
          if (score >= 60) gesture('cheer', 1500)
          onEnd(score)
          return
        }
        setChose(null)
        setPose('talk')
        setK(k + 1)
      },
      good ? 1300 : 1600,
    )
  }
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      status={
        <span className="block">
          <span className="text-[11px] tracking-wider uppercase">
            {k + 1}/{n}
          </span>
          <span className="mt-0.5 block font-display text-[16px] leading-snug text-[var(--color-ink)] [text-wrap:balance]">« {line} »</span>
        </span>
      }
      said={said}
      controls={order.map((i) => {
        const look = chose === null ? '' : i === ok ? '!bg-[#d3f9d8] ring-2 ring-[#2b8a3e]' : i === chose ? '!bg-[#ffe3e3] ring-2 ring-[#e03131]' : 'opacity-50'
        return (
          <button key={`${k}-${i}`} className={`tile flex min-h-[64px] flex-1 items-center justify-center px-2 py-2 text-center text-[13.5px] leading-tight font-extrabold text-[var(--color-ink)] transition active:scale-[0.97] ${look}`} onClick={() => reply(i)} aria-disabled={chose !== null}>
            {replies[i]}
          </button>
        )
      })}
    >
      <Stage decor={jeu.decor} cam={mic ? MIC_CAM.cam : CAM} look={mic ? MIC_CAM.look : [-0.15, 1.22, -0.6]} fov={mic ? MIC_CAM.fov : 40}>
        <Backdrop decor={jeu.decor} />
        {/* A light from where we stand, on their face */}
        <directionalLight position={[1, 2, 4]} intensity={0.7} />
        {mic ? <MicCrowd crowd={mic} said={chose === null ? null : chose === ok} beat={beat} /> : <Npc host={jeu.npc} pose={pose} beat={beat} />}
        <MoodBar mood={mood} beat={beat} down={chose !== null && chose !== ok} at={mic ? MIC_BAR : undefined} />
        {hearts.map((h) => (
          <Heart key={h} at={mic ? MIC_HEART : undefined} onDone={() => setHearts((hs) => hs.filter((x) => x !== h))} />
        ))}
      </Stage>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:repondre). */
export const demo: Extract<Jeu, { engine: 'repondre' }> = {
  engine: 'repondre', title: tr('La cliente du marché'), how: tr('Elle hésite devant ton étal : réponds-lui bien pour qu’elle achète.'), decor: 'etal', npc: 'cliente',
  lines: [
    [tr('Bonjour ma fille ! C’est combien, ce pagne-là ?'), [tr('Bonne arrivée maman ! 6 000 F, c’est du vrai wax.'), tr('Lis l’étiquette, non ?'), tr('Trop cher pour toi.')], 0],
    [tr('Hum… 6 000 ? Tu peux faire un geste ?'), [tr('Non, c’est fixe. Au revoir.'), tr('Pour toi, 5 000 F, et je t’emballe ça.'), tr('Va voir ailleurs alors.')], 1],
    [tr('Il va aller avec ma robe verte, tu crois ?'), [tr('Je sais pas, moi.'), tr('Le vert, c’est démodé.'), tr('Ah oui, orange et vert, ça claque !')], 2],
    [tr('Bon, je le prends. Tu as la monnaie sur 10 000 ?'), [tr('Oui maman, voilà tes 5 000 F. Merci !'), tr('Faut faire l’appoint !'), tr('Garde tout, c’est cadeau… non je blague.')], 0],
  ],
}
