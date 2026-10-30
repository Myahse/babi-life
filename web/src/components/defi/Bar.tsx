import { useEffect, useRef, useState } from 'react'
import { Banknote, Beer, GlassWater, LogOut, RefreshCw } from 'lucide-react'
import { haptic } from '../../lib/native'
import { gesture } from '../../world3d/gesture'
import { t as tr, tx } from '../../lib/i18n'

// The pot with the friends at the maquis, played (the update « gestes-maison »):
// sat at the table, the bottle in front. « Boire » a sip at a time: the
// ambiance rises, and so does the alcohol. The glass empty, « Se resservir »
// (a round, 500 Djai). « Lancer l'argent » on the table's dancers: the ambiance
// jumps (the banknotes are paid). Drink water now and then: the alcohol comes
// down. Past the line, you're drunk: the evening ends there, badly. « Se lever »
// when the ambiance is up: a good evening. (Paid and counted by the server:
// backend sims/defi.go barNight.)

const ROUND = 500
const ROUNDS = 6
const BILLETS = 1000
const DRUNK = 100

export function BarDefi({ money, onEnd }: { /** What the Sim has: no round nor banknote past it. */ money: number; onEnd: (score: number, extra: string) => void }) {
  const [glass, setGlass] = useState(1)
  const [alcohol, setAlcohol] = useState(0)
  const [ambiance, setAmbiance] = useState(0)
  const [rounds, setRounds] = useState(0)
  const [billets, setBillets] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const done = useRef(false)
  const left = money - rounds * ROUND - billets
  const say = (t: string) => {
    setSaid(t)
    setTimeout(() => setSaid(null), 1400)
  }
  // The alcohol goes down slowly, the ambiance too if nothing happens.
  useEffect(() => {
    const t = setInterval(() => {
      setAlcohol((a) => Math.max(0, a - 0.6))
      setAmbiance((a) => Math.max(0, a - 0.25))
    }, 250)
    return () => clearInterval(t)
  }, [])
  const end = (drunk: boolean) => {
    if (done.current) return
    done.current = true
    const score = drunk ? Math.round(ambiance * 0.3) : Math.round(Math.min(100, ambiance) * (alcohol > 70 ? 0.85 : 1))
    setTimeout(() => onEnd(score, `tournees:${rounds};billets:${billets}${drunk ? ';soul' : ''}`), drunk ? 1600 : 300)
  }
  const drink = () => {
    if (done.current || glass <= 0) return
    haptic('light')
    gesture('drink', 1400)
    setGlass((g) => Math.max(0, g - 0.25))
    setAmbiance((a) => Math.min(100, a + 7))
    const a = alcohol + 9
    setAlcohol(a)
    if (a >= DRUNK) {
      haptic('error')
      say(tr('Tu as trop bu… tout tourne !'))
      end(true)
    } else if (a > 75) say(tr('Doucement, ça monte !'))
  }
  const refill = () => {
    if (done.current || glass > 0) return
    if (rounds >= ROUNDS) return say(tr('Le serveur : « C’est la dernière, hein ! »'))
    if (left < ROUND) return say(tr('Plus assez pour une tournée.'))
    gesture('cheer', 1400)
    setRounds((r) => r + 1)
    setGlass(1)
    setAmbiance((a) => Math.min(100, a + 6))
    say(tr('Le serveur ouvre une autre bouteille !'))
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
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={sway ? { animation: `bar-sway ${3 - sway / 4}s ease-in-out infinite`, ['--sway' as string]: `${sway}deg` } : undefined}>
      <style>{'@keyframes bar-sway { 0%,100% { transform: rotate(calc(var(--sway) * -1)) } 50% { transform: rotate(var(--sway)) } }'}</style>
      {said && <div className="mx-auto mb-2 animate-pop rounded-2xl bg-[#0f1230]/85 px-4 py-2 text-center text-[14px] font-extrabold text-white">{said}</div>}
      <div className="card pointer-events-auto mx-auto w-full max-w-[560px] p-3">
        <div className="flex items-end gap-3">
          {/* (The glass itself is the one in the perso's hand, in the bar: only the gauges here.) */}
          <div className="min-w-0 flex-1 space-y-2">
            <Gauge label={tr('Verre')} value={glass * 100} color="#e8a400" />
            <Gauge label={tr('Ambiance')} value={ambiance} color="#00a862" />
            <Gauge label={tr('Alcool')} value={alcohol} color={alcohol > 75 ? '#ff3d57' : '#ffa000'} line={DRUNK} />
            <div className="text-[11.5px] font-extrabold text-[var(--color-ink-soft)]">
              {tx('Tournées {rounds}/{ROUNDS} · billets {0} · reste {1}', { rounds, ROUNDS, 0: billets.toLocaleString('fr-FR'), 1: Math.max(0, left).toLocaleString('fr-FR') })}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          <Btn icon={Beer} label={tr('Boire')} onClick={drink} on={glass > 0} />
          <Btn icon={RefreshCw} label={tr('Resservir')} onClick={refill} on={glass <= 0} />
          <Btn icon={GlassWater} label={tr('De l’eau')} onClick={water} on />
          <Btn icon={Banknote} label={tr('Billets')} onClick={throwMoney} on={left >= BILLETS} />
          <Btn icon={LogOut} label={tr('Se lever')} onClick={() => end(false)} on />
        </div>
      </div>
    </div>
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

function Btn({ icon: Icon, label, onClick, on }: { icon: typeof Beer; label: string; onClick: () => void; on: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-extrabold ${on ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`} onClick={onClick}>
      <Icon size={20} strokeWidth={2.4} />
      {label}
    </button>
  )
}
