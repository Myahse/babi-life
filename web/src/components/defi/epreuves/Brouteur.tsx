import { useMemo, useRef, useState } from 'react'
import { Flash, Hud, beep, fx } from './kit'
import { Bust3D } from './bust'
import { setExpression } from '../../../avatar/expressions'
import { t } from '../../../lib/i18n'

// « Le neveu brouteur », chapter 4 (game/epreuves.go): Jojo wants a real job, and the offers on the wall
// (and in his phone) aren't all real. One by one: swipe right (or « Vrai ») a real offer, left (or
// « Arnaque ») the scam: the too-good-to-be-true pay, the money to send first, the codes asked for, the
// « transfert » with no work. Twelve cards; each mistake, Jojo frowns.

type Offer = { text: string; real: boolean; why: string }

const OFFERS = (): Offer[] => [
  { text: t('Livreur à moto, Cocody. 120 000 F/mois + essence. Permis A exigé. Se présenter au dépôt avec CV.'), real: true, why: t('Un salaire normal, un lieu, des conditions.') },
  { text: t('GAGNEZ 500 000 F PAR SEMAINE SANS TRAVAILLER !!! Envoie 10 000 F de frais d’inscription par Mobile Money.'), real: false, why: t('Payer pour être embauché : arnaque.') },
  { text: t('Caissière, supermarché de Yopougon. Contrat de 6 mois. Entretien lundi 9 h, avec pièce d’identité.'), real: true, why: t('Un employeur, un contrat, un entretien.') },
  { text: t('Urgent : agent pour recevoir des transferts d’argent de l’étranger. 30 % pour toi. Juste ton compte.'), real: false, why: t('Prêter son compte, c’est blanchir de l’argent.') },
  { text: t('Apprenti mécanicien, garage d’Adjamé. Petit salaire au début, on t’apprend le métier.'), real: true, why: t('Modeste, honnête : un vrai départ.') },
  { text: t('Félicitations ! Tu as été choisi pour un emploi au Canada. Envoie le code reçu par SMS pour confirmer.'), real: false, why: t('On ne donne jamais un code reçu par SMS.') },
  { text: t('Serveur au maquis « Chez Tantie », Marcory. Le soir, 5 jours sur 7, payé à la quinzaine.'), real: true, why: t('Des horaires, une paie claire.') },
  { text: t('Deviens « influenceur » : 2 000 000 F garantis le premier mois. Achète le pack de démarrage à 50 000 F.'), real: false, why: t('Garantir une fortune contre un achat : arnaque.') },
  { text: t('Agent de sécurité, banque du Plateau. Formation payée, casier judiciaire vierge demandé.'), real: true, why: t('Une formation, des exigences sérieuses.') },
  { text: t('Belle Américaine cherche homme sérieux pour l’aider à sortir son héritage. Récompense énorme.'), real: false, why: t('Le vieux coup de l’héritage : brouteur.') },
  { text: t('Aide-maçon, chantier de Bingerville. Payé à la journée, 4 000 F. Venir à 7 h avec des bottes.'), real: true, why: t('Le travail dur, la paie du jour.') },
  { text: t('Prêt immédiat de 5 000 000 F sans garantie ! Seulement 25 000 F de frais de dossier à envoyer avant.'), real: false, why: t('Des frais avant le prêt : arnaque.') },
]

export default function Brouteur({ onEnd }: { onEnd: (score: number) => void }) {
  const cards = useMemo(() => OFFERS().sort(() => Math.random() - 0.5), [])
  const [k, setK] = useState(0)
  const [good, setGood] = useState(0)
  const [dx, setDx] = useState(0)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [why, setWhy] = useState<{ ok: boolean; text: string } | null>(null)
  const drag = useRef<number | null>(null)

  const answer = (real: boolean) => {
    if (why || k >= cards.length) return
    const c = cards[k]
    const ok = c.real === real
    if (ok) setGood((g) => g + 1)
    const mid = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 }
    if (ok) fx.good(mid.x, mid.y, real ? t('Vrai') : t('Arnaque !'))
    else fx.bad(mid.x, mid.y, '✗')
    if (k + 1 >= cards.length && good + (ok ? 1 : 0) >= cards.length - 1) fx.win()
    beep(ok ? 760 : 170, ok ? 0.12 : 0.25, 0.12, { type: ok ? 'sine' : 'square' })
    setFlash({ text: ok ? t('Bien vu !') : t('Jojo fronce les sourcils'), at: Date.now() })
    // Jojo's face (bust.tsx): glad, or frowning.
    setExpression('jojo', ok ? 'grin' : 'annoyed', 1300)
    setWhy({ ok, text: c.why })
    setDx(real ? 400 : -400)
    setTimeout(() => {
      setWhy(null)
      setDx(0)
      if (k + 1 >= cards.length) onEnd(Math.round(((good + (ok ? 1 : 0)) / cards.length) * 100))
      else setK(k + 1)
    }, 1300)
  }

  const c = cards[Math.min(k, cards.length - 1)]
  return (
    <div className="absolute inset-0 flex flex-col items-center bg-[linear-gradient(#e9ecef,#adb5bd)] select-none">
      <Hud title={t('Le vrai du faux')} done={`${Math.min(k + 1, cards.length)}/${cards.length}`} />
      {/* Jojo beside you, in 3D, his face on each answer */}
      {/* (On the right: your own Sim's bubble is in the top left corner.) */}
      <div className="mt-14 mr-3 flex flex-row-reverse items-center gap-2 self-end">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#fff,#ced4da)] shadow">
          <Bust3D seed={515} gender="homme" faceId="jojo" over={{ hair: 'degrade', outfit: 'chemise', accessory: 'none' }} className="h-full w-full" cam={[0, 1.5, 1.5]} look={[0, 1.42, 0]} />
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#495057]">{t('Jojo : « Celle-là, c’est du vrai ? »')}</div>
      </div>
      <div className="relative flex w-full flex-1 items-center justify-center px-6">
        <div
          className="w-full max-w-[340px] touch-none rounded-[24px] bg-[#fffdf5] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-transform duration-200"
          style={{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }}
          onPointerDown={(e) => ((drag.current = e.clientX), (e.target as HTMLElement).setPointerCapture?.(e.pointerId))}
          onPointerMove={(e) => drag.current !== null && !why && setDx(e.clientX - drag.current)}
          onPointerUp={() => {
            const d = dx
            drag.current = null
            if (Math.abs(d) > 80) answer(d > 0)
            else setDx(0)
          }}
        >
          {/* A pinned ad: the pin, the paper */}
          <div className="mx-auto -mt-8 mb-3 h-5 w-5 rounded-full bg-[#e03131] shadow" />
          <p className="text-[15px] leading-snug font-bold text-[#212529]">{c.text}</p>
          {why && <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-extrabold ${c.real ? 'bg-[#d3f9d8] text-[#1b4332]' : 'bg-[#ffe3e3] text-[#7a1c1c]'}`}>{(c.real ? t('Vrai : ') : t('Arnaque : ')) + why.text}</p>}
        </div>
      </div>
      <div className="mb-[max(20px,env(safe-area-inset-bottom))] flex w-full max-w-[380px] gap-3 px-4">
        <button className="h-16 flex-1 rounded-[22px] bg-[#e03131] font-display text-lg font-extrabold text-white shadow-[0_5px_0_#8f1d1d] active:translate-y-1" onClick={() => answer(false)}>
          ← {t('Arnaque')}
        </button>
        <button className="h-16 flex-1 rounded-[22px] bg-[#2f9e44] font-display text-lg font-extrabold text-white shadow-[0_5px_0_#1b5e2b] active:translate-y-1" onClick={() => answer(true)}>
          {t('Vrai')} →
        </button>
      </div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}
