import { useEffect, useRef, useState } from 'react'
import { Flash, Hud, beep, fx } from './kit'
import { t } from '../../../lib/i18n'

// « Le maquis de Tantie Bintou », chapter 4 (game/epreuves.go): the opening day, every table full, and
// you giving Tantie a hand. Each table calls its order (garba, alloco, poulet braisé, attiéké poisson,
// a cold drink) and waits, less and less patient. Pick the dish at the counter, then tap the table:
// served. The wrong dish, or a table left too long, and the guests grumble. As many served as you can.

const TIME = 50
const TABLES = 4
const DISHES = () => [
  { id: 'garba', label: t('Garba'), icon: '🐟' },
  { id: 'alloco', label: t('Alloco'), icon: '🍌' },
  { id: 'poulet', label: t('Poulet'), icon: '🍗' },
  { id: 'attieke', label: t('Attiéké'), icon: '🍚' },
  { id: 'boisson', label: t('Boisson'), icon: '🥤' },
]
type Order = { dish: string; since: number; wait: number } | null

export default function BintouMaquis({ onEnd }: { onEnd: (score: number) => void }) {
  const dishes = useRef(DISHES()).current
  const [now, setNow] = useState(0)
  const [orders, setOrders] = useState<Order[]>(Array(TABLES).fill(null))
  const [hand, setHand] = useState<string | null>(null)
  const [served, setServed] = useState(0)
  const [lost, setLost] = useState(0)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const st = useRef({ t0: performance.now(), next: 0.5, over: false })
  const cur = useRef<Order[]>(Array(TABLES).fill(null))

  useEffect(() => {
    const id = setInterval(() => {
      const n = (performance.now() - st.current.t0) / 1000
      setNow(n)
      // (Worked on a copy kept in a ref: no side effects inside a state updater.)
      let v = cur.current
      // A table left too long: they leave grumbling.
      if (v.some((x) => x && n - x.since > x.wait)) {
        v = v.map((x) => (x && n - x.since > x.wait ? null : x))
        setLost((l) => l + 1)
        beep(160, 0.25, 0.1, { type: 'square' })
        fx.shake(5)
      }
      if (!st.current.over && n >= st.current.next) {
        const free = v.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0)
        if (free.length) {
          const i = free[Math.floor(Math.random() * free.length)]
          v = v.map((x, k) => (k === i ? { dish: dishes[Math.floor(Math.random() * dishes.length)].id, since: n, wait: Math.max(6, 11 - n * 0.08) } : x))
        }
        st.current.next = n + Math.max(1.2, 2.6 - n * 0.03)
      }
      if (v !== cur.current) ((cur.current = v), setOrders(v))
    }, 100)
    return () => clearInterval(id)
  }, [dishes])

  const left = TIME - now
  useEffect(() => {
    if (st.current.over || left > 0) return
    st.current.over = true
    const score = Math.round(Math.max(0, Math.min(100, served * 6 - lost * 4)))
    if (score >= 80) fx.win()
    setTimeout(() => onEnd(score), 900)
  }, [left, served, lost, onEnd])

  const serve = (i: number, e: React.MouseEvent) => {
    const o = orders[i]
    const at = fx.local(e)
    if (!o || !hand || st.current.over) return
    if (o.dish === hand) {
      setServed((s) => s + 1)
      cur.current = cur.current.map((x, k) => (k === i ? null : x))
      setOrders(cur.current)
      beep(700, 0.08, 0.12)
      beep(940, 0.14, 0.12)
      fx.good(at.x, at.y, now - o.since < 3 ? t('Rapide !') : '+1')
    } else {
      setLost((l) => l + 1)
      fx.bad(at.x, at.y, t('C’est pas ça !'))
      setFlash({ text: t('« J’avais demandé autre chose ! »'), at: Date.now() })
    }
    setHand(null)
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[linear-gradient(#7a1f1f,#3b0f0f)] select-none">
      <Hud title={t('Le service de l’ouverture')} left={left} done={t('{n} servis', { n: served })} />
      <div className="mt-16 text-center text-xs font-extrabold text-[#ffd43b]">{t('MAQUIS CHEZ TANTIE BINTOU · OUVERTURE')}</div>
      {/* The tables, each its order and its patience */}
      <div className="mx-auto grid w-full max-w-[440px] flex-1 grid-cols-2 content-center gap-4 p-4">
        {orders.map((o, i) => {
          const d = o && dishes.find((x) => x.id === o.dish)
          const p = o ? Math.max(0, 1 - (now - o.since) / o.wait) : 0
          return (
            <button key={i} onClick={(e) => serve(i, e)} className={`relative flex aspect-square flex-col items-center justify-center rounded-full bg-[#f8f0e3] shadow-[0_6px_0_rgba(0,0,0,0.35)] transition active:scale-95 ${hand && o ? 'ring-4 ring-[#ffd43b]' : ''}`}>
              <span className="absolute top-2 text-[10px] font-extrabold text-[#7a1f1f]">{t('Table {n}', { n: i + 1 })}</span>
              {d ? (
                <>
                  <span className="animate-pop rounded-2xl bg-white px-3 py-1 text-3xl shadow">{d.icon}</span>
                  <span className="mt-1 text-xs font-extrabold text-[#3d2b1f]">{d.label}</span>
                  <div className="mt-1 h-2 w-20 overflow-hidden rounded-full bg-black/15">
                    <div className="h-full" style={{ width: `${p * 100}%`, background: p > 0.5 ? '#2f9e44' : p > 0.25 ? '#fab005' : '#e03131' }} />
                  </div>
                </>
              ) : (
                <span className="text-xs font-bold text-[#adb5bd]">{t('libre')}</span>
              )}
            </button>
          )
        })}
      </div>
      {/* The counter: the dish picked up */}
      <div className="mx-auto mb-[max(16px,env(safe-area-inset-bottom))] flex w-full max-w-[460px] justify-between gap-1.5 px-3">
        {dishes.map((d) => (
          <button key={d.id} onClick={() => (setHand(d.id), beep(500, 0.05, 0.06))} className={`flex flex-1 flex-col items-center rounded-2xl py-2 text-2xl shadow-[0_4px_0_rgba(0,0,0,0.4)] transition active:translate-y-0.5 ${hand === d.id ? 'bg-[#ffd43b]' : 'bg-white'}`}>
            {d.icon}
            <span className="text-[10px] font-extrabold text-[#3d2b1f]">{d.label}</span>
          </button>
        ))}
      </div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}
