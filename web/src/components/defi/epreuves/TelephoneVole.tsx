import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, rnd, useHud, fx } from './kit'
import { Stage3D, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { Prop } from '../jeux/props'
import { t } from '../../../lib/i18n'

// « Le téléphone de Prisca », chapter 3 (game/epreuves.go): the gare routière, the crowd between the
// gbakas, and the boy who took the phone somewhere in it. In the gare in the game's 3D blocks: the gbakas
// lined up behind, the crowd walking across the tarmac, each person in blocks with their cap, their bag on
// the back, their shirt, tall or small. The coxers tell what they saw, one thing at a time (his cap, his
// bag, his shirt, his size): tap him as soon as you're sure (a guess before the last clue can pay, or
// cost). The quicker, the better; a wrong one costs (the man tapped stops and turns round, not pleased).

const TIME = 40
const CLUE_EVERY = 4
const PEOPLE = 22

type Look = { cap: '' | 'rouge' | 'bleue'; bag: '' | 'bleu' | 'noir'; shirt: number; small: boolean }
type Person = Look & { x: number; z: number; vx: number; phase: number; skin: string; pants: string; stop: number }

const SHIRTS = ['#fab005', '#2f9e44', '#e03131', '#f8f9fa', '#7048e8']
const SHIRT_NAMES = () => [t('un t-shirt jaune'), t('un t-shirt vert'), t('un t-shirt rouge'), t('un t-shirt blanc'), t('un t-shirt violet')]
const CAPS = ['', 'rouge', 'bleue'] as const
const BAGS = ['', 'bleu', 'noir'] as const
const SKINS = ['#6b4430', '#8d5a3b', '#4a2e20', '#a06a45']
/** The crowd's band on the tarmac. */
const HW = 2.6

const same = (a: Look, b: Look) => a.cap === b.cap && a.bag === b.bag && a.shirt === b.shirt && a.small === b.small

/** The crowd: the boy, people who look like him in one or two ways (so each clue rules some out), and no one exactly like him. */
function crowd(): { people: Look[]; kevin: number } {
  const kevin: Look = { cap: CAPS[1 + Math.floor(Math.random() * 2)], bag: BAGS[1 + Math.floor(Math.random() * 2)], shirt: Math.floor(Math.random() * SHIRTS.length), small: Math.random() < 0.5 }
  const people: Look[] = [kevin]
  while (people.length < PEOPLE) {
    // Most share the first clues (the cap, then the bag…): the last clues are what tell him apart.
    const n = people.length
    const p: Look = {
      cap: n < 14 ? kevin.cap : CAPS[Math.floor(Math.random() * 3)],
      bag: n < 9 ? kevin.bag : BAGS[Math.floor(Math.random() * 3)],
      shirt: n < 5 ? kevin.shirt : Math.floor(Math.random() * SHIRTS.length),
      small: Math.random() < 0.5,
    }
    if (!same(p, kevin)) people.push(p)
  }
  const order = people.map((_, i) => i).sort(() => Math.random() - 0.5)
  return { people: order.map((i) => people[i]), kevin: order.indexOf(0) }
}

/** A person's height (the small ones and the tall thin ones). */
const tall = (p: Look) => (p.small ? 0.78 : 1.12)

export default function TelephoneVole({ onEnd }: { onEnd: (score: number) => void }) {
  const init = useMemo(() => {
    const c = crowd()
    const people: Person[] = c.people.map((p, i) => ({ ...p, x: rnd(-HW, HW), z: -1.0 + (((i * 37) % 100) / 100) * 4.8, vx: rnd(-0.45, 0.45) || 0.2, phase: rnd(0, 6), skin: SKINS[i % 4], pants: i % 3 ? '#343a40' : '#1864ab', stop: 0 }))
    return { people, kevin: c.kevin, look: c.people[c.kevin] }
  }, [])
  const s = useRef({ ...init, wrong: 0, over: false, now: 0, found: -1, started: false })
  const [hud, setHud] = useHud({ left: TIME, clues: 1 })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [found, setFound] = useState(-1)

  const clueText = (look: Look, n: number) =>
    [
      look.cap === 'rouge' ? t('« Il avait une casquette rouge. »') : t('« Il avait une casquette bleue. »'),
      look.bag === 'bleu' ? t('« Un sac à dos bleu. »') : t('« Un sac à dos noir. »'),
      t('« Il portait {s}. »', { s: SHIRT_NAMES()[look.shirt] }),
      look.small ? t('« Il est petit, hein. »') : t('« Il est grand, mince. »'),
    ].slice(0, n)

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const clues = Math.min(4, 1 + Math.floor(now / CLUE_EVERY))
    const left = TIME - now
    if (!st.over && left <= 0) {
      st.over = true
      setFlash({ text: t('Il s’est fondu dans la foule…'), at: Date.now() })
      setTimeout(() => onEnd(10), 1100)
    }
    setHud({ left: Math.max(0, left), clues })
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.over) return
    // The one under the finger: the nearest body on the screen (the front ones first, being bigger).
    let pick = -1
    let bd = Infinity
    st.people.forEach((p, i) => {
      const h = tall(p)
      const a = screenOf(p.x, h * 0.75, p.z)
      const b = screenOf(p.x, h * 1.5, p.z)
      const r = Math.abs(b.y - a.y) * 1.1
      const d = Math.hypot(e.x - a.x, e.y - (a.y + b.y) / 2)
      if (d < r && d - p.z * 3 < bd) ((bd = d - p.z * 3), (pick = i))
    })
    if (pick < 0) return
    if (pick === st.kevin) {
      st.over = true
      st.found = pick
      setFound(pick)
      beep(660, 0.12, 0.14)
      beep(990, 0.25, 0.14)
      setFlash({ text: t('C’est lui !'), at: Date.now() })
      fx.good(e.x, e.y, t('Kevin !'))
      fx.win()
      // Found as soon as the last clue is said (or before, guessed right): 100; then every second lost, and each wrong one, costs.
      setTimeout(() => onEnd(Math.round(Math.max(25, 100 - st.wrong * 15 - Math.max(0, st.now - CLUE_EVERY * 3) * 4))), 1100)
    } else {
      st.wrong++
      // The one tapped stops and turns round.
      st.people[pick].stop = 1.2
      beep(170, 0.2, 0.12, { type: 'square' })
      setFlash({ text: t('Eh, c’est pas moi !'), at: Date.now() })
      fx.bad(e.x, e.y, '✗')
    }
  }

  const look = s.current.look
  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 6, 7.5]} look={[0, 0.5, 1.2]} fov={40} fit={[HW * 2 + 0.6, 6.4]} bg="#f3d9a4" touch={touch} onReady={() => (s.current.started = true)}>
        <Gare />
        <Crowd s={s} found={found} tick={tick} />
      </Stage3D>
      <Hud title={t('Repérer Kevin')} left={hud.left} done={t('{n} indice(s)', { n: hud.clues })} />
      <div className="pointer-events-none absolute inset-x-3 top-14 z-10 space-y-1">
        {clueText(look, hud.clues).map((c, i) => (
          <div key={i} className="animate-pop w-fit rounded-2xl bg-white/90 px-3 py-1 text-xs font-extrabold text-[#212529] shadow">
            {t('Le coxer :')} {c}
          </div>
        ))}
      </div>
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white drop-shadow">{t('Touche le garçon dès que tu es sûr·e. Plus tôt = mieux.')}</p>
    </div>
  )
}

/** The gare: the tarmac and its painted lines, the gbakas lined up behind, the shelter's roof. */
function Gare() {
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[14, 0.2, 14]} c="#8a8f98" />
      {[-1.6, 0.4, 2.4].map((z) => (
        <Box key={z} p={[0, 0.003, z]} s={[10, 0.006, 0.06]} c="#c9ccd1" />
      ))}
      {[-3.3, -1.1, 1.1, 3.3].map((x, i) => (
        <group key={x} position={[x, 0, -3.2]} rotation={[0, Math.PI / 2, 0]} scale={1.6}>
          <Prop id={i % 2 ? 'gbaka' : 'voiture'} />
        </group>
      ))}
      <Box p={[0, 2.6, -4.4]} s={[12, 0.12, 1.6]} c="#e8590c" />
    </group>
  )
}

/** The crowd walking, each in blocks: legs swinging, shirt, head, cap and backpack. */
function Crowd({ s, found, tick }: { s: React.RefObject<{ people: Person[]; over: boolean; started: boolean }>; found: number; tick: (dt: number) => void }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    tick(dt)
    const st = s.current
    const now = performance.now() / 1000
    st.people.forEach((p, i) => {
      const g = refs.current[i]
      if (!g) return
      const walking = st.started && !st.over && p.stop <= 0
      if (p.stop > 0) p.stop -= dt
      if (walking) {
        p.x += p.vx * dt
        if (p.x < -HW || p.x > HW) p.vx *= -1
      }
      g.position.set(p.x, walking ? Math.abs(Math.sin(now * 7 + p.phase)) * 0.03 : 0, p.z)
      // Facing the way it goes; stopped (tapped by mistake), it turns to look at you.
      const face = p.stop > 0 ? 0 : p.vx > 0 ? Math.PI / 2 : -Math.PI / 2
      g.rotation.y += (face - g.rotation.y) * Math.min(1, dt * 10)
      const legs = g.children[0] as THREE.Group
      const sw = walking ? Math.sin(now * 7 + p.phase) * 0.5 : 0
      legs.children[0].rotation.x = sw
      legs.children[1].rotation.x = -sw
    })
  })
  const st = s.current
  return (
    <group>
      {st.people.map((p, i) => {
        const h = tall(p)
        const w = p.small ? 1 : 0.9
        return (
          <group key={i} ref={(el) => void (refs.current[i] = el)} position={[p.x, 0, p.z]}>
            {/* Legs, from the hips */}
            <group position={[0, h * 0.62, 0]}>
              <group position={[-0.07 * w, 0, 0]}>
                <Box p={[0, -h * 0.31, 0]} s={[0.1 * w, h * 0.62, 0.11]} c={p.pants} />
              </group>
              <group position={[0.07 * w, 0, 0]}>
                <Box p={[0, -h * 0.31, 0]} s={[0.1 * w, h * 0.62, 0.11]} c={p.pants} />
              </group>
            </group>
            {/* The shirt, the arms, the head */}
            <Box p={[0, h * 0.62 + h * 0.27, 0]} s={[0.3 * w, h * 0.54, 0.24]} c={SHIRTS[p.shirt]} />
            <Box p={[-0.19 * w, h * 0.62 + h * 0.25, 0]} s={[0.07, h * 0.44, 0.08]} c={p.skin} />
            <Box p={[0.19 * w, h * 0.62 + h * 0.25, 0]} s={[0.07, h * 0.44, 0.08]} c={p.skin} />
            <Box p={[0, h * 1.16 + 0.12, 0]} s={[0.22, 0.24, 0.22]} c={p.skin} />
            <Box p={[0.05, h * 1.16 + 0.15, 0.111]} s={[0.04, 0.04, 0.01]} c="#111" />
            <Box p={[-0.05, h * 1.16 + 0.15, 0.111]} s={[0.04, 0.04, 0.01]} c="#111" />
            {p.cap && (
              <group>
                <Box p={[0, h * 1.16 + 0.26, 0]} s={[0.24, 0.08, 0.24]} c={p.cap === 'rouge' ? '#e03131' : '#1c7ed6'} />
                <Box p={[0, h * 1.16 + 0.23, 0.15]} s={[0.2, 0.03, 0.12]} c={p.cap === 'rouge' ? '#e03131' : '#1c7ed6'} />
              </group>
            )}
            {p.bag && <Box p={[0, h * 0.62 + h * 0.3, -0.15]} s={[0.24 * w, h * 0.36, 0.13]} c={p.bag === 'bleu' ? '#1864ab' : '#111'} />}
            {i === found && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.32, 0.44, 12]} />
                <meshBasicMaterial color="#69db7c" />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}
