import { useMemo, useState } from 'react'
import { Flash, Hud, beep, fx } from './kit'
import { Bust3D } from './bust'
import { Box } from '../../../world3d/props'
import { Prop } from '../jeux/props'
import { setExpression } from '../../../avatar/expressions'
import { t } from '../../../lib/i18n'

// « Serge et Fatou », chapter 4 (game/epreuves.go): the pagnes for the dot, and the market's tanties who
// always ask Serge the top price. Three pagnes; for each, the tantie's price, and what she'd really take
// (hidden). Make an offer with the slider: too low and she's offended (« Tchrrr ! », her patience goes),
// close and she comes down, at her price or over it and it's yours. Three offers before she turns away.
// The less paid, the better; never offend her three times. The tantie and her stall in the game's 3D
// blocks (bust.tsx): her face says it (pleased, thinking it over, offended), the pagne folded before her.

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
      setExpression('tantie', paid <= floor + 500 ? 'meh' : 'laugh', 1800)
      setFlash({ text: t('Vendu {p} !', { p: F(paid) }), at: Date.now() })
      return next(sc, spot)
    }
    const left = tries - 1
    setTries(left)
    if (offer < floor * 0.8) {
      // Offended.
      setMood((m) => m - 1)
      fx.bad(spot.x, spot.y - 60, t('Tchrrr !'))
      setExpression('tantie', 'angry', 2200)
      setSaid(t('« Tchrrr ! Tu veux me ruiner ? Mes enfants vont manger quoi ? »'))
    } else {
      // Close: she comes down halfway towards the offer, not under her floor.
      const down = Math.max(floor, round((ask + offer) / 2))
      setAsk(down)
      beep(520, 0.1, 0.1)
      fx.float(t('Elle descend'), spot.x, spot.y - 60, '#ffe066')
      setExpression('tantie', 'thinking', 1800)
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
        {/* Her patience: three marks, a red one for each time she was offended */}
        <div className="flex gap-1 rounded-full bg-black/45 px-2 py-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[3px] ${i < 3 - Math.max(0, mood) ? 'bg-[#e03131]' : 'bg-white/35'}`} />
          ))}
        </div>
      </Hud>
      {/* The tantie behind her stall, the pagne folded before her */}
      <Bust3D seed={2207} gender="femme" faceId="tantie" over={{ hair: 'headwrap', outfit: 'pagne', outfitColor: p.colors[0], accessory: 'earrings' }} className="mt-14 h-48 w-full max-w-[380px]" cam={[0, 1.6, 2.4]} look={[0, 1.25, 0]} fov={34}>
        <Box p={[0, 0.75, 0.55]} s={[2.2, 0.1, 0.7]} c="#8a5a32" />
        <Box p={[0, 0.35, 0.55]} s={[2.1, 0.7, 0.6]} c="#6b4423" />
        <group key={k} position={[0, 0.8, 0.65]} scale={0.55}>
          <Prop id="pagne" />
        </group>
        {[-0.75, 0.75].map((x) => (
          <group key={x} position={[x, 0.8, 0.55]} scale={0.45} rotation={[0, x, 0]}>
            <Prop id="tissu" />
          </group>
        ))}
      </Bust3D>
      <div className="mt-1 font-display text-lg font-extrabold text-[#5c2c06]">{p.name}</div>
      {/* What she says */}
      <div className="mt-2 flex w-full max-w-[380px] items-start gap-2">
        <div key={said} className="animate-pop rounded-2xl bg-white px-3 py-2 text-sm font-bold text-[#212529] shadow">
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
