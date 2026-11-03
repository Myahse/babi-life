import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, rnd, useHud, type Frame, type Touch, fx } from './kit'
import { t } from '../../../lib/i18n'

// « Le retour de Tonton Gilbert », chapter 2 (game/epreuves.go): the arrivals hall, the belt going round
// with everyone's luggage. Tata Odette's list of Tonton's: the big red suitcase with the yellow ribbon,
// the wax bag, the carton tied up with « GILBERT » on it. Tap them as they go by; not the others (their
// owners shout). And at the end, little pink suitcases with GILBERT on them… whose are those?

const TIME = 45
type Kind = 'rouge' | 'wax' | 'carton' | 'rose' | 'noire' | 'bleue' | 'grise' | 'sac'
const HIS: Kind[] = ['rouge', 'wax', 'carton']
type Bag = { kind: Kind; u: number; gone: number; good: boolean }

export default function AvionGilbert({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ bags: [] as Bag[], next: 0, got: 0, wrong: 0, missed: 0, over: false, w: 0, h: 0, now: 0, pinks: 0, his: 0 })
  const [hud, setHud] = useHud({ left: TIME, got: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  // The belt: a loop (u from 0 to 1 along it): a long oval on the screen.
  const path = (u: number, w: number, h: number) => {
    const cx = w / 2
    const cy = h * 0.55
    const rx = w * 0.38
    const ry = h * 0.25
    const a = -Math.PI / 2 + u * Math.PI * 2
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as const
  }

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.w = w
    st.h = h
    st.now = now
    const left = TIME - now
    if (!st.over && left <= 0) {
      st.over = true
      setTimeout(() => onEnd(Math.round(Math.max(0, Math.min(100, (st.got / Math.max(1, st.his)) * 90 - st.wrong * 6 + (st.pinks ? 10 : 0))))), 900)
    }
    // A new piece of luggage out of the chute; his now and then, and near the end, the pink ones.
    if (!st.over && now >= st.next) {
      const r = Math.random()
      const kind: Kind = now > TIME * 0.65 && r < 0.18 ? 'rose' : r < 0.36 ? HIS[Math.floor(Math.random() * 3)] : (['noire', 'bleue', 'grise', 'sac'] as Kind[])[Math.floor(Math.random() * 4)]
      st.bags.push({ kind, u: 0, gone: 0, good: HIS.includes(kind) || kind === 'rose' })
      if (HIS.includes(kind) || kind === 'rose') st.his++
      st.next = now + rnd(0.7, 1.2)
    }
    const speed = 0.07 + now * 0.0012
    for (const b of st.bags) {
      if (b.gone) continue
      b.u += speed * dt
      // Round once and back into the chute: missed if it was his.
      if (b.u >= 1) {
        b.gone = now
        if (b.good) st.missed++
      }
    }
    st.bags = st.bags.filter((b) => !b.gone || now - b.gone < 0.4)
    setHud({ left: Math.max(0, left), got: st.got })
    // The hall, the belt, the chute.
    g.fillStyle = '#dee2e6'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#adb5bd'
    g.fillRect(0, 0, w, h * 0.12)
    g.fillStyle = '#fd7e14'
    g.fillRect(w * 0.25, h * 0.15, w * 0.5, 28)
    g.fillStyle = '#fff'
    g.font = 'bold 14px sans-serif'
    g.textAlign = 'center'
    g.fillText(t('ARRIVÉES · BAGAGES 3'), w / 2, h * 0.15 + 19)
    g.textAlign = 'left'
    g.strokeStyle = '#495057'
    g.lineWidth = 44
    g.beginPath()
    g.ellipse(w / 2, h * 0.55, w * 0.38, h * 0.25, 0, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = '#343a40'
    g.lineWidth = 2
    g.setLineDash([4, 8])
    g.lineDashOffset = -now * 40
    g.beginPath()
    g.ellipse(w / 2, h * 0.55, w * 0.38, h * 0.25, 0, 0, Math.PI * 2)
    g.stroke()
    g.setLineDash([])
    g.fillStyle = '#212529'
    g.fillRect(w / 2 - 34, h * 0.3 - 30, 68, 34)
    for (const b of st.bags) {
      const [x, y] = path(b.u, w, h)
      g.save()
      g.translate(x, y - (b.gone ? (now - b.gone) * 120 : 0))
      g.globalAlpha = b.gone ? Math.max(0, 1 - (now - b.gone) * 2.5) : 1
      drawBag(g, b.kind)
      g.restore()
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (e.kind !== 'down' || st.over) return
    let pick: Bag | null = null
    let bd = Infinity
    for (const b of st.bags) {
      if (b.gone) continue
      const [x, y] = path(b.u, st.w, st.h)
      const d = Math.hypot(e.x - x, e.y - y)
      if (d < 34 && d < bd) ((bd = d), (pick = b))
    }
    if (!pick) return
    const b = pick as Bag
    b.gone = st.now
    if (b.good) {
      st.got++
      if (b.kind === 'rose' && !st.pinks++) setFlash({ text: t('Des petites valises roses… « GILBERT » ?!'), at: st.now })
      beep(740, 0.1, 0.12)
      fx.good(e.x, e.y, b.kind === 'rose' ? '?!' : '+1')
    } else {
      st.wrong++
      beep(180, 0.25, 0.12, { type: 'square' })
      setFlash({ text: t('Eh ! C’est ma valise !'), at: st.now })
      fx.bad(e.x, e.y, '✗')
    }
  }

  return (
    <div className="absolute inset-0 bg-[#dee2e6]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Les bagages de Tonton')} left={hud.left} done={t('{n} pris', { n: hud.got })} />
      <div className="pointer-events-none absolute inset-x-3 top-14 z-10 flex flex-wrap gap-1 text-[11px] font-extrabold">
        <span className="rounded-full bg-white/90 px-2 py-1 text-[#c92a2a]">{t('Valise rouge, ruban jaune')}</span>
        <span className="rounded-full bg-white/90 px-2 py-1 text-[#e8590c]">{t('Sac en wax')}</span>
        <span className="rounded-full bg-white/90 px-2 py-1 text-[#8a5a2b]">{t('Carton « GILBERT »')}</span>
      </div>
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-[#343a40]">{t('Touche les bagages de Tonton quand ils passent. Pas ceux des autres !')}</p>
    </div>
  )
}

function drawBag(g: CanvasRenderingContext2D, k: Kind) {
  const box = (w: number, h: number, c: string) => {
    g.fillStyle = c
    g.fillRect(-w / 2, -h / 2, w, h)
    g.strokeStyle = 'rgba(0,0,0,0.35)'
    g.lineWidth = 2
    g.strokeRect(-w / 2, -h / 2, w, h)
  }
  switch (k) {
    case 'rouge':
      box(40, 28, '#e03131')
      g.fillStyle = '#ffd43b'
      g.fillRect(-4, -14, 8, 28)
      break
    case 'wax':
      g.fillStyle = '#e8590c'
      g.beginPath()
      g.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#1c7ed6'
      for (const [x, y] of [
        [-10, -4],
        [4, 4],
        [10, -6],
        [-4, 6],
      ]) {
        g.beginPath()
        g.arc(x, y, 3.5, 0, Math.PI * 2)
        g.fill()
      }
      break
    case 'carton':
      box(34, 26, '#c08a4a')
      g.strokeStyle = '#5c3a21'
      g.beginPath()
      g.moveTo(-17, 0)
      g.lineTo(17, 0)
      g.moveTo(0, -13)
      g.lineTo(0, 13)
      g.stroke()
      g.fillStyle = '#212529'
      g.font = 'bold 7px sans-serif'
      g.textAlign = 'center'
      g.fillText('GILBERT', 0, -3)
      g.textAlign = 'left'
      break
    case 'rose':
      box(26, 20, '#f783ac')
      g.fillStyle = '#fff'
      g.font = 'bold 6px sans-serif'
      g.textAlign = 'center'
      g.fillText('GILBERT', 0, 2)
      g.textAlign = 'left'
      break
    case 'noire':
      box(40, 28, '#212529')
      break
    case 'bleue':
      box(38, 26, '#1c7ed6')
      break
    case 'grise':
      box(36, 26, '#868e96')
      g.fillStyle = '#fab005'
      g.fillRect(-18, -2, 36, 4)
      break
    case 'sac':
      g.fillStyle = '#2b8a3e'
      g.beginPath()
      g.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2)
      g.fill()
      break
  }
}
