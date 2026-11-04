import { useMemo, useState } from 'react'
import { Flash, Hud, beep, fx } from './kit'
import { t } from '../../../lib/i18n'

// « Serge et Fatou », chapter 4 (game/epreuves.go): the pagnes for the dot, and the market's tanties who
// always ask Serge the top price. Three pagnes; for each, the tantie's price, and what she'd really take
// (hidden). Make an offer with the slider: too low and she's offended (« Tchrrr ! », her patience goes),
// close and she comes down, at her price or over it and it's yours. Three offers before she turns away.
// The less paid, the better; never offend her three times.

type Pagne = { name: string; ask: number; floor: number; colors: string[] }

const round = (n: number) => Math.round(n / 500) * 500
const PAGNES = (): Pagne[] =>
  [
    { name: t('Le wax « Bouquet de mariage »'), colors: ['#e8590c', '#2b8a3e', '#ffd43b'] },
    { name: t('Le kita brodé'), colors: ['#7048e8', '#ffd43b', '#fff'] },
    { name: t('Le Super wax hollandais'), colors: ['#1864ab', '#e03131', '#fab005'] },
  ].map((p) => {
    const ask = round(18000 + Math.random() * 22000)
    return { ...p, ask, floor: round(ask * (0.55 + Math.random() * 0.15)) }
  })

const F = (n: number) => `${n.toLocaleString('fr-FR')} F`

export default function SergeFatou({ onEnd }: { onEnd: (score: number) => void }) {
  const pagnes = useMemo(PAGNES, [])
  const [k, setK] = useState(0)
  const [ask, setAsk] = useState(pagnes[0].ask)
  const [offer, setOffer] = useState(round(pagnes[0].ask * 0.5))
  const [tries, setTries] = useState(3)
  const [said, setSaid] = useState(t('« Pour toi, mon fils, c’est {p}. Prix d’ami ! »', { p: F(pagnes[0].ask) }))
  const [mood, setMood] = useState(3)
  const [scores, setScores] = useState<number[]>([])
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const p = pagnes[Math.min(k, pagnes.length - 1)]

  const next = (sc: number, spot: { x: number; y: number }) => {
    const all = [...scores, sc]
    setScores(all)
    setTimeout(() => {
      if (k + 1 >= pagnes.length || mood <= 0) {
        const avg = all.reduce((a, b) => a + b, 0) / pagnes.length
        if (avg >= 70) fx.win()
        onEnd(Math.round(avg))
        return
      }
      const n = pagnes[k + 1]
      setK(k + 1)
      setAsk(n.ask)
      setOffer(round(n.ask * 0.5))
      setTries(3)
      setSaid(t('« Celui-là, c’est {p}. Je te fais pas le prix des touristes ! »', { p: F(n.ask) }))
    }, 1400)
    void spot
  }

  const propose = (e: React.MouseEvent) => {
    if (scores.length > k) return
    const spot = fx.local(e)
    const floor = p.floor
    if (offer >= ask || offer >= floor) {
      // Deal: what was saved out of what could be saved.
      const paid = Math.min(offer, ask)
      const sc = Math.round(Math.max(0, Math.min(100, ((p.ask - paid) / (p.ask - floor)) * 100)))
      beep(660, 0.12, 0.12)
      beep(880, 0.2, 0.12)
      fx.good(spot.x, spot.y - 60, F(paid))
      setSaid(paid <= floor + 500 ? t('« Ah toi, tu es dur en affaires ! C’est bon, prends. »') : t('« Marché conclu ! Que Dieu bénisse le mariage. »'))
      setFlash({ text: t('Vendu {p} !', { p: F(paid) }), at: Date.now() })
      return next(sc, spot)
    }
    const left = tries - 1
    setTries(left)
    if (offer < floor * 0.8) {
      // Offended.
      setMood((m) => m - 1)
      fx.bad(spot.x, spot.y - 60, t('Tchrrr !'))
      setSaid(t('« Tchrrr ! Tu veux me ruiner ? Mes enfants vont manger quoi ? »'))
    } else {
      // Close: she comes down halfway towards the offer, not under her floor.
      const down = Math.max(floor, round((ask + offer) / 2))
      setAsk(down)
      beep(520, 0.1, 0.1)
      fx.float(t('Elle descend'), spot.x, spot.y - 60, '#ffe066')
      setSaid(t('« Bon… parce que c’est pour une dot : {p}, dernier prix. »', { p: F(down) }))
    }
    if (left <= 0) {
      // No more offers: she sells at her last price, or not at all if offended.
      setFlash({ text: t('Elle a tourné le dos…'), at: Date.now() })
      next(10, spot)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center bg-[linear-gradient(#ffe8cc,#f4a259)] px-4 select-none">
      <Hud title={t('Marchander les pagnes')} done={`${Math.min(k + 1, pagnes.length)}/${pagnes.length}`}>
        {mood < 3 && <div className="rounded-full bg-black/45 px-2 py-1 text-xs font-extrabold">{'😤'.repeat(3 - Math.max(0, mood))}</div>}
      </Hud>
      {/* The pagne folded on the stall */}
      <div className="mt-20 flex h-28 w-48 flex-col overflow-hidden rounded-xl shadow-[0_8px_0_rgba(0,0,0,0.2)]">
        {p.colors.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: `repeating-radial-gradient(circle at ${30 + i * 20}% 50%, ${c} 0 8px, ${p.colors[(i + 1) % 3]} 8px 14px)` }} />
        ))}
      </div>
      <div className="mt-2 font-display text-lg font-extrabold text-[#5c2c06]">{p.name}</div>
      {/* The tantie and what she says */}
      <div className="mt-3 flex w-full max-w-[380px] items-start gap-2">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#8d5a3b] text-2xl">👩🏾</div>
        <div key={said} className="animate-pop rounded-2xl rounded-tl-none bg-white px-3 py-2 text-sm font-bold text-[#212529] shadow">
          {said}
        </div>
      </div>
      <div className="mt-auto mb-[max(16px,env(safe-area-inset-bottom))] w-full max-w-[380px] rounded-3xl bg-white/90 p-4 shadow-lg">
        <div className="flex items-baseline justify-between text-xs font-extrabold text-[#868e96]">
          <span>{t('Elle demande : {p}', { p: F(ask) })}</span>
          <span>{t('{n} offre(s)', { n: tries })}</span>
        </div>
        <div className="mt-1 text-center font-display text-3xl font-extrabold text-[#2b8a3e]">{F(offer)}</div>
        <input type="range" min={round(p.ask * 0.3)} max={ask} step={500} value={offer} onChange={(e) => setOffer(Number(e.target.value))} className="mt-2 w-full accent-[#2b8a3e]" />
        <button onClick={propose} className="mt-3 h-14 w-full rounded-2xl bg-[#2b8a3e] font-display text-lg font-extrabold text-white shadow-[0_5px_0_#1b5e2b] active:translate-y-1">
          {t('Proposer {p}', { p: F(offer) })}
        </button>
      </div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}
