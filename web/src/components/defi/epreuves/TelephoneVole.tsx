import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, rnd, useHud, type Frame, type Touch, fx, drawPerson } from './kit'
import { t } from '../../../lib/i18n'

// « Le téléphone de Prisca », chapter 3 (game/epreuves.go): the gare routière, the crowd between the
// gbakas, and the boy who took the phone somewhere in it. The coxers tell what they saw, one thing at a
// time (his cap, his bag, his shirt, his size): tap him as soon as you're sure (a guess before the last
// clue can pay, or cost). The quicker, the better; a wrong one costs (the man tapped isn't pleased).

const TIME = 40
const CLUE_EVERY = 4
const PEOPLE = 22

type Look = { cap: '' | 'rouge' | 'bleue'; bag: '' | 'bleu' | 'noir'; shirt: number; small: boolean }
type Person = Look & { x: number; y: number; vx: number; phase: number }

const SHIRTS = ['#fab005', '#2f9e44', '#e03131', '#f8f9fa', '#7048e8']
const SHIRT_NAMES = () => [t('un t-shirt jaune'), t('un t-shirt vert'), t('un t-shirt rouge'), t('un t-shirt blanc'), t('un t-shirt violet')]
const CAPS = ['', 'rouge', 'bleue'] as const
const BAGS = ['', 'bleu', 'noir'] as const

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

export default function TelephoneVole({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ people: [] as Person[], kevin: 0, look: null as Look | null, wrong: 0, over: false, w: 0, h: 0, now: 0, misses: [] as { x: number; y: number; at: number }[], found: -1 })
  const [hud, setHud] = useHud({ left: TIME, clues: 1 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const clueText = (look: Look, n: number) =>
    [
      look.cap === 'rouge' ? t('« Il avait une casquette rouge. »') : t('« Il avait une casquette bleue. »'),
      look.bag === 'bleu' ? t('« Un sac à dos bleu. »') : t('« Un sac à dos noir. »'),
      t('« Il portait {s}. »', { s: SHIRT_NAMES()[look.shirt] }),
      look.small ? t('« Il est petit, hein. »') : t('« Il est grand, mince. »'),
    ].slice(0, n)

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.now = now
    if (st.w !== w) {
      st.w = w
      st.h = h
      const c = crowd()
      st.kevin = c.kevin
      st.look = c.people[c.kevin]
      st.people = c.people.map((p, i) => ({ ...p, x: rnd(0.05, 0.95) * w, y: h * 0.42 + (((i * 37) % 100) / 100) * h * 0.42, vx: rnd(-22, 22), phase: rnd(0, 6) }))
      st.people.sort((a, b) => a.y - b.y)
      st.kevin = st.people.findIndex((p) => same(p, c.people[c.kevin]))
    }
    const clues = Math.min(4, 1 + Math.floor(now / CLUE_EVERY))
    const left = TIME - now
    if (!st.over && left <= 0) {
      st.over = true
      setFlash({ text: t('Il s’est fondu dans la foule…'), at: now })
      setTimeout(() => onEnd(10), 1100)
    }
    setHud({ left: Math.max(0, left), clues })
    // The gare: the tarmac, the gbakas lined up, the sun.
    g.fillStyle = '#f3d9a4'
    g.fillRect(0, 0, w, h * 0.32)
    g.fillStyle = '#8a8f98'
    g.fillRect(0, h * 0.32, w, h * 0.68)
    for (let i = 0; i < 4; i++) {
      const x = (i / 4) * w + 8
      g.fillStyle = ['#e8590c', '#fab005', '#2f9e44', '#1c7ed6'][i]
      g.fillRect(x, h * 0.2, w / 4 - 16, h * 0.14)
      g.fillStyle = '#cfe8ff'
      g.fillRect(x + 6, h * 0.22, w / 4 - 28, h * 0.05)
      g.fillStyle = '#222'
      g.beginPath()
      g.arc(x + 14, h * 0.34, 7, 0, Math.PI * 2)
      g.arc(x + w / 4 - 30, h * 0.34, 7, 0, Math.PI * 2)
      g.fill()
    }
    for (const [i, p] of st.people.entries()) {
      if (!st.over) {
        p.x += p.vx * dt
        if (p.x < 10 || p.x > w - 10) p.vx *= -1
      }
      const sz = p.small ? 0.82 : 1.15
      const bob = Math.sin(now * 6 + p.phase) * 2
      const x = p.x
      const y = p.y + bob
      const z = 14 * sz
      // Walking: the legs' bob, the bag on the back, the cap the way he goes.
      drawPerson(g, x, y - z * 0.1, {
        shirt: SHIRTS[p.shirt],
        cap: p.cap ? (p.cap === 'rouge' ? '#e03131' : '#1c7ed6') : undefined,
        bag: p.bag ? (p.bag === 'bleu' ? '#1864ab' : '#111') : undefined,
        skin: ['#6b4430', '#8d5a3b', '#4a2e20', '#a06a45'][i % 4],
        size: sz,
        dir: p.vx > 0 ? 1 : -1,
        pants: i % 3 ? '#343a40' : '#1864ab',
      })
      if (i === st.found) {
        g.strokeStyle = '#69db7c'
        g.lineWidth = 4
        g.beginPath()
        g.arc(x, y - z, z * 1.9, 0, Math.PI * 2)
        g.stroke()
      }
    }
    st.misses = st.misses.filter((m) => now - m.at < 0.8)
    for (const m of st.misses) {
      g.strokeStyle = '#e03131'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(m.x - 10, m.y - 10)
      g.lineTo(m.x + 10, m.y + 10)
      g.moveTo(m.x + 10, m.y - 10)
      g.lineTo(m.x - 10, m.y + 10)
      g.stroke()
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (e.kind !== 'down' || st.over) return
    let pick = -1
    let bd = Infinity
    st.people.forEach((p, i) => {
      const z = 14 * (p.small ? 0.82 : 1.15)
      const d = Math.hypot(e.x - p.x, e.y - (p.y - z))
      if (d < z * 1.8 && d < bd) ((bd = d), (pick = i))
    })
    if (pick < 0) return
    if (pick === st.kevin) {
      st.over = true
      st.found = pick
      beep(660, 0.12, 0.14)
      beep(990, 0.25, 0.14)
      setFlash({ text: t('C’est lui !'), at: st.now })
      fx.good(e.x, e.y, t('Kevin !'))
      fx.win(st.w)
      // Found as soon as the last clue is said (or before, guessed right): 100; then every second lost, and each wrong one, costs.
      setTimeout(() => onEnd(Math.round(Math.max(25, 100 - st.wrong * 15 - Math.max(0, st.now - CLUE_EVERY * 3) * 4))), 1100)
    } else {
      st.wrong++
      st.misses.push({ x: e.x, y: e.y, at: st.now })
      beep(170, 0.2, 0.12, { type: 'square' })
      setFlash({ text: t('Eh, c’est pas moi !'), at: st.now })
      fx.bad(e.x, e.y, '✗')
    }
  }

  const look = s.current.look
  return (
    <div className="absolute inset-0 bg-[#8a8f98]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Repérer Kevin')} left={hud.left} done={t('{n} indice(s)', { n: hud.clues })} />
      <div className="pointer-events-none absolute inset-x-3 top-14 z-10 space-y-1">
        {look &&
          clueText(look, hud.clues).map((c, i) => (
            <div key={i} className="animate-pop w-fit rounded-2xl bg-white/90 px-3 py-1 text-xs font-extrabold text-[#212529] shadow">
              {t('Le coxer :')} {c}
            </div>
          ))}
      </div>
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white">{t('Touche le garçon dès que tu es sûr·e. Plus tôt = mieux.')}</p>
    </div>
  )
}
