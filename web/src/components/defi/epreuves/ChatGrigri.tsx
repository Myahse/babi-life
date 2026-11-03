import { useEffect, useRef, useState } from 'react'
import { Flash, Hud, beep, fx } from './kit'
import { t } from '../../../lib/i18n'

// « Le chat de Mamie Rose », chapter 1 (game/epreuves.go): Grigri at the market, after the alloco's smell.
// Between the baskets, the stalls' cats and hens put their heads up and down again: tap Grigri, the grey
// one with the red collar, each time he shows; not the others (the market cats, the hens) — the sellers
// shoo you off and it costs time. Ten times Grigri before he's off with his fish.

const TIME = 40
const GOAL = 10
const HOLES = 9
type Who = 'grigri' | 'roux' | 'noir' | 'poule'
type Up = { who: Who; until: number; id: number }

export default function ChatGrigri({ onEnd }: { onEnd: (score: number) => void }) {
  const [ups, setUps] = useState<(Up | null)[]>(Array(HOLES).fill(null))
  const [got, setGot] = useState(0)
  const [lost, setLost] = useState(0)
  const [now, setNow] = useState(0)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const st = useRef({ t0: performance.now(), next: 0.6, id: 0, over: false, wrong: 0 })

  useEffect(() => {
    const tick = setInterval(() => {
      const s = st.current
      const n = (performance.now() - s.t0) / 1000
      setNow(n)
      setUps((u) => {
        const v = u.map((x) => (x && x.until > n ? x : null))
        if (!s.over && n >= s.next) {
          const free = v.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0)
          if (free.length) {
            const hole = free[Math.floor(Math.random() * free.length)]
            const r = Math.random()
            // Quicker as it goes on.
            const stay = Math.max(0.6, 1.3 - n * 0.017)
            v[hole] = { who: r < 0.4 ? 'grigri' : r < 0.6 ? 'roux' : r < 0.8 ? 'noir' : 'poule', until: n + stay, id: ++s.id }
          }
          s.next = n + Math.max(0.35, 0.8 - n * 0.01)
        }
        return v
      })
    }, 50)
    return () => clearInterval(tick)
  }, [])

  const left = TIME - now - lost
  useEffect(() => {
    const s = st.current
    if (s.over || (left > 0 && got < GOAL)) return
    s.over = true
    if (got >= GOAL) setFlash({ text: t('Grigri est repéré !'), at: Date.now() })
    setTimeout(() => onEnd(Math.round(Math.min(1, got / GOAL) * 80 + (got >= GOAL ? Math.max(0, left / TIME) * 20 : 0) - s.wrong * 3)), 1000)
  }, [left, got, onEnd])

  const tap = (i: number, at: { x: number; y: number }) => {
    const u = ups[i]
    if (!u || st.current.over) return
    setUps((v) => v.map((x, k) => (k === i ? null : x)))
    if (u.who === 'grigri') {
      setGot((g) => g + 1)
      fx.good(at.x, at.y, got + 1 >= GOAL ? t('Grigri !') : `${got + 1}/${GOAL}`)
      if (got + 1 >= GOAL) fx.win()
      beep(880, 0.15, 0.12, { type: 'triangle', to: 1200 })
    } else {
      st.current.wrong++
      setLost((l) => l + 2)
      fx.bad(at.x, at.y, '−2 s')
      beep(u.who === 'poule' ? 700 : 300, 0.2, 0.12, { type: 'square', to: u.who === 'poule' ? 1000 : 200 })
      setFlash({ text: u.who === 'poule' ? t('Cot cot ! Une poule…') : t('Pas Grigri !'), at: Date.now() })
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[linear-gradient(#ffd8a8,#e8a15a)]">
      <Hud title={t('Trouver Grigri')} left={left} done={`${got}/${GOAL}`} />
      <div className="mx-auto mt-20 flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#3d2b1f]">
        <Cat who="grigri" small /> {t('Grigri : gris, collier rouge')}
      </div>
      <div className="mx-auto grid w-full max-w-[420px] flex-1 grid-cols-3 content-center gap-3 p-4">
        {ups.map((u, i) => (
          <button key={i} onClick={(e) => tap(i, fx.local(e))} className="relative aspect-square overflow-hidden rounded-2xl" aria-label={t('Panier')}>
            {/* The cat or the hen, up from behind the basket */}
            <div className={`absolute inset-x-0 bottom-[30%] flex justify-center transition-transform duration-150 ${u ? 'translate-y-0' : 'translate-y-[120%]'}`}>{u && <Cat who={u.who} />}</div>
            {/* The basket in front */}
            <div className="absolute inset-x-1 bottom-1 h-[42%] rounded-b-[40%] rounded-t-lg bg-[repeating-linear-gradient(90deg,#b07a3c_0_6px,#8a5a2b_6px_12px)] shadow-[inset_0_6px_0_rgba(0,0,0,0.2)]" />
            <div className="absolute inset-x-3 bottom-[40%] h-3 rounded-full bg-[#e03131]/80" style={{ background: ['#e03131', '#2f9e44', '#fab005'][i % 3] }} />
          </button>
        ))}
      </div>
      <Flash text={flash.text} at={flash.at} />
      <p className="pb-4 text-center text-xs font-bold text-[#3d2b1f]">{t('Touche Grigri, seulement lui !')}</p>
    </div>
  )
}

function Cat({ who, small }: { who: Who; small?: boolean }) {
  const z = small ? 22 : 64
  if (who === 'poule')
    return (
      <svg width={z} height={z} viewBox="0 0 64 64">
        <ellipse cx="32" cy="40" rx="20" ry="16" fill="#fff" />
        <circle cx="42" cy="22" r="10" fill="#fff" />
        <path d="M40 10 l4 -6 l3 6 l3 -5 l2 7z" fill="#e03131" />
        <path d="M51 22 l8 3 l-8 3z" fill="#fab005" />
        <circle cx="45" cy="20" r="2" fill="#111" />
      </svg>
    )
  const fur = { grigri: '#868e96', roux: '#f08c00', noir: '#212529' }[who]
  return (
    <svg width={z} height={z} viewBox="0 0 64 64">
      <path d="M12 26 L16 6 L28 18 Z M52 26 L48 6 L36 18 Z" fill={fur} />
      <ellipse cx="32" cy="34" rx="22" ry="20" fill={fur} />
      <circle cx="24" cy="32" r="4" fill={who === 'noir' ? '#ffd43b' : '#c0eb75'} />
      <circle cx="40" cy="32" r="4" fill={who === 'noir' ? '#ffd43b' : '#c0eb75'} />
      <circle cx="24" cy="32" r="1.6" fill="#111" />
      <circle cx="40" cy="32" r="1.6" fill="#111" />
      <path d="M29 40 h6 l-3 3z" fill="#ff8fab" />
      {who === 'grigri' && <rect x="16" y="50" width="32" height="5" rx="2" fill="#e03131" />}
      {who === 'grigri' && <circle cx="32" cy="57" r="3" fill="#fab005" />}
    </svg>
  )
}
