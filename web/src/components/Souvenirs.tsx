import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Drum, GraduationCap, Hammer, Home, Landmark, Smartphone, TreePalm, UserX, Volleyball, type LucideIcon } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ActionResult, Family, Friend, Sim } from '../lib/types'
import { FamilyScene } from '../avatar/Family'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { IconTile } from './ui'
import { amount } from '../game/rules'
import { languageLabel } from '../lib/languages'
import { haptic } from '../lib/native'
import { sfx } from '../lib/sfx'
import { screenSeen } from '../lib/premiersPas'
import { t as tr, tx } from '../lib/i18n'

// « Souvenirs d'enfance » (update « naitre-adulte », backend sims/naitre.go): right after the birth's card,
// four short questions take the place of a childhood played: where the Sim grew up, its school, its friend
// from childhood, what it was like as a child. The answers sent, the Sim is 18 (the family's money, the
// first home, the mentor), and the game goes on with the arrival and Koffi's adult tuto. Shown by
// screens/Play.tsx while the Sim's souvenirs are due (a reload comes back here).

type Grew = 'cour' | 'villa' | 'village'
type School = 'cm2' | 'bepc' | 'bac'
type Offer = Awaited<ReturnType<typeof api.souvenirsView>>

const STEPS = ['grandi', 'ecole', 'ami', 'petit'] as const
const COLORS: [string, string][] = [
  ['#ffb74d', '#ff7a1a'],
  ['#64b5ff', '#2a6cf0'],
  ['#69e2a0', '#00a862'],
  ['#ff7ad9', '#b02bd6'],
]

/** The toys of the baby's choices (backend sims/firsts.go Talents), as the child it made. */
const TALENTS: { id: string; icon: LucideIcon; label: string; trait: string }[] = [
  { id: 'ballon', icon: Volleyball, label: tr('Toujours derrière un ballon'), trait: tr('Sportif') },
  { id: 'tamtam', icon: Drum, label: tr('Tu tapais sur tout ce qui sonne'), trait: tr('Artiste') },
  { id: 'livre', icon: BookOpen, label: tr('Le nez dans les livres'), trait: tr('Travailleur') },
  { id: 'telephone', icon: Smartphone, label: tr('Le téléphone de papa à l’oreille'), trait: tr('Charmeur') },
]

export function Souvenirs({ sim, onResult }: { sim: Sim; onResult: (res: ActionResult) => void }) {
  const [offer, setOffer] = useState<Offer | null>(null)
  const [step, setStep] = useState(0)
  const [grew, setGrew] = useState<Grew | null>(null)
  const [language, setLanguage] = useState('')
  const [school, setSchool] = useState<School | null>(null)
  const [friend, setFriend] = useState<number | null>(null)
  const [talent, setTalent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.souvenirsView(sim.id).then(setOffer, (e) => setError(errorText(e, tr('Erreur'))))
    void api.funnel('souvenirs_start')
  }, [sim.id])
  // The admin's « Nouveaux joueurs » (lib/premiersPas.ts): which question the player is on.
  useEffect(() => screenSeen(`souvenirs:${STEPS[step]}`), [step])

  const family: Family | undefined = offer?.family
  const pick = <T,>(set: (v: T) => void, v: T) => {
    set(v)
    haptic('light')
    sfx.pop()
  }
  const ready = [!!grew && (grew !== 'village' || !!language), !!school, friend !== null, !!talent][step]
  const last = step === STEPS.length - 1

  async function finish() {
    if (!grew || !school || friend === null) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.souvenirs(sim.id, { grew, language: grew === 'village' ? language : undefined, school, friend, talent })
      sfx.win(true)
      haptic('success')
      onResult(res)
    } catch (e) {
      setError(errorText(e, tr('Erreur')))
      setBusy(false)
    }
  }

  const title = [tr('Tu as grandi où ?'), tr('Ton école'), tr('Ton ami d’enfance'), tr('Petit, tu étais…')][step]
  const hint = [tr('Ta famille, tu ne l’as pas choisie. Mais ton enfance, raconte-la.'), tr('Jusqu’où es-tu allé·e ? Le bac reste possible plus tard, en candidat libre.'), tr('Celui ou celle qui ne t’a jamais lâché·e depuis la cour de récré.'), tr('Ce qu’il te reste de tes jeux de petit : un trait de caractère.')][step]

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--color-night)]">
      {/* The family the Sim was born into, at home: the same scene as the birth's card */}
      <section className="relative min-h-[34%] flex-1 overflow-hidden bg-[radial-gradient(110%_90%_at_50%_15%,#ffe7c7_0%,#ffb27a_45%,#ff7a59_78%,#c94a6a_100%)]">
        {family && <FamilyScene familyId={family.id} look={sim.look} gender={sim.gender} className="!absolute inset-0" />}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/40 to-transparent px-4 pt-[max(1rem,var(--sat,env(safe-area-inset-top)))] pb-10 text-white">
          <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-90">{tx('Ton enfance · {0} sur {1}', { 0: step + 1, 1: STEPS.length })}</div>
          <div className="font-display text-[22px] leading-tight font-extrabold [text-shadow:0_2px_0_rgba(0,0,0,0.25)]">{tx('{name}, famille {family}', { name: sim.firstName, family: family?.label.toLowerCase() ?? '…' })}</div>
        </div>
      </section>

      <section className="sheet relative z-10 -mt-6 flex max-h-[66%] flex-col rounded-t-[28px]">
        <div className="px-4 pt-3">
          <div className="mb-3 flex gap-1.5">
            {STEPS.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-[var(--color-orange)]' : 'bg-[var(--color-canvas)]'}`} />
            ))}
          </div>
          <h2 className="font-display text-[24px] leading-tight font-extrabold">{title}</h2>
          <p className="pt-0.5 text-sm font-bold text-[var(--color-ink-soft)]">{hint}</p>
        </div>

        <div key={step} className="animate-up flex-1 space-y-2.5 overflow-y-auto px-4 pt-3 pb-4">
          {!offer && !error && <p className="py-6 text-center text-sm font-bold text-[var(--color-ink-soft)]">{tr('Les souvenirs reviennent…')}</p>}
          {offer && step === 0 && (
            <>
              <Choice icon={Home} colors={COLORS[0]} on={grew === 'cour'} onClick={() => pick(setGrew, 'cour')} title={tr('Dans une cour commune')} sub={family?.id === 'gnambro' ? tr('La solidarité de la cour : une chance sur trois que la famille monte d’un cran. Deux voisins de la cour restent tes amis.') : tr('Tout le quartier te connaît : deux voisins de la cour restent tes amis.')} />
              <Choice icon={Landmark} colors={COLORS[1]} on={grew === 'villa'} onClick={() => pick(setGrew, 'villa')} title={tr('Dans une villa')} sub={family?.id === 'debout' ? tr('Plus d’argent au départ.') : tr('Une chance sur trois que la famille monte d’un cran, sinon un peu plus d’argent au départ.')} />
              <Choice icon={TreePalm} colors={COLORS[2]} on={grew === 'village'} onClick={() => pick(setGrew, 'village')} title={tr('Au village, puis Abidjan')} sub={tx('Tu parles une langue de plus, et la débrouille t’a laissé {0} Djai.', { 0: amount(3000) })} />
              {grew === 'village' && (
                <div className="animate-pop rounded-2xl bg-[var(--color-canvas)] p-3">
                  <div className="label mb-2">{tr('Ta langue du village')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {offer.languages.map((l) => (
                      <button key={l} className={`rounded-full px-3 py-1.5 text-sm font-extrabold transition ${language === l ? 'bg-[var(--color-emerald)] text-white' : 'bg-white text-[var(--color-ink)]'}`} onClick={() => pick(setLanguage, l)}>
                        {languageLabel(l)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {offer && step === 1 && (
            <>
              <Choice icon={Hammer} colors={COLORS[0]} on={school === 'cm2'} onClick={() => pick(setSchool, 'cm2')} title={tr('Arrêté après le CM2')} sub={tx('Les petits boulots très tôt : {0} Djai d’économies à 18 ans.', { 0: amount(offer.savings.cm2) })} />
              <Choice icon={BookOpen} colors={COLORS[1]} on={school === 'bepc'} onClick={() => pick(setSchool, 'bepc')} title={tr('Le BEPC en poche')} sub={tx('Le diplôme dans tes papiers, et {0} Djai d’économies.', { 0: amount(offer.savings.bepc) })} />
              <Choice icon={GraduationCap} colors={COLORS[3]} on={school === 'bac'} onClick={() => pick(setSchool, 'bac')} title={tr('Le bac en poche')} sub={offer.savings.bac ? tx('Le BEPC et le bac dans tes papiers, l’université possible, et {0} Djai de la famille.', { 0: amount(offer.savings.bac) }) : tr('Le BEPC et le bac dans tes papiers, l’université possible.')} />
            </>
          )}
          {offer && step === 2 && (
            <div className="grid grid-cols-3 gap-2.5">
              {offer.friends.map((f, i) => (
                <FriendTile key={f.id} f={f} on={friend === i} onClick={() => pick(setFriend, i)} />
              ))}
              <button className="tile col-span-3 flex items-center justify-center gap-2 py-3 text-sm font-extrabold" aria-pressed={friend === -1} onClick={() => pick(setFriend, -1)}>
                <UserX size={18} strokeWidth={2.6} /> {tr('Pas d’ami d’enfance')}
              </button>
            </div>
          )}
          {offer && step === 3 && (
            <div className="grid grid-cols-2 gap-2.5">
              {TALENTS.map((x, i) => (
                <button key={x.id} className="tile flex flex-col items-center gap-2 px-2 py-3 text-center" aria-pressed={talent === x.id} onClick={() => pick(setTalent, x.id)}>
                  <IconTile icon={x.icon} colors={COLORS[i]} size={46} radius={14} className={talent === x.id ? 'animate-pop' : ''} />
                  <span className="text-[13px] leading-tight font-extrabold">{x.label}</span>
                  <span className="rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--color-ink-soft)]">{x.trait}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="motion-shake mx-3 mb-2 rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">{error}</p>}
        <footer className="flex gap-2 border-t border-[var(--color-line)] p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
          {step > 0 && (
            <button className="btn btn-soft shrink-0 px-4" onClick={() => setStep(step - 1)} aria-label={tr('Question précédente')} disabled={busy}>
              <ChevronLeft size={22} strokeWidth={2.6} />
            </button>
          )}
          {last ? (
            <button className="btn btn-emerald flex-1" disabled={busy || !ready} onClick={finish}>
              {busy ? tr('Tu grandis…') : tr('J’ai 18 ans !')}
            </button>
          ) : (
            <button className="btn flex-1" disabled={!ready} onClick={() => (setStep(step + 1), haptic('light'))}>
              {tr('Suivant')} <ChevronRight size={20} strokeWidth={2.8} />
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}

function Choice({ icon, colors, on, onClick, title, sub }: { icon: LucideIcon; colors: [string, string]; on: boolean; onClick: () => void; title: string; sub: ReactNode }) {
  return (
    <button className="tile flex w-full items-center gap-3 p-3 text-left" aria-pressed={on} onClick={onClick}>
      <IconTile icon={icon} colors={colors} size={46} radius={14} className={on ? 'animate-pop' : ''} />
      <span className="min-w-0 flex-1 pr-5">
        <span className="block font-display text-[16px] leading-tight font-extrabold">{title}</span>
        <span className="block pt-0.5 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{sub}</span>
      </span>
    </button>
  )
}

/** One of the three friends offered, their face as the school's scene draws it (game/childhood.ts). */
function FriendTile({ f, on, onClick }: { f: Friend; on: boolean; onClick: () => void }) {
  const look = useMemo(() => randomLook(f.gender, rng(`enfance:${f.id}`)), [f.id, f.gender])
  return (
    <button className="tile flex flex-col items-center overflow-hidden pb-2" aria-pressed={on} onClick={onClick}>
      <span className={`block aspect-square w-full ${on ? 'animate-pop' : ''}`}>
        <Portrait look={look} gender={f.gender} framing="bust" />
      </span>
      <span className="px-1 pt-1 text-center font-display text-[15px] leading-tight font-extrabold">{f.name}</span>
    </button>
  )
}
