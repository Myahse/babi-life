import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Glasses, Scissors, Shirt, X, type LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import type { Look, Sim } from '../lib/types'
import { ACCESSORIES, ACCESSORY_COLORS, BEARDS, BOTTOM_COLORS, FEMME_OUTFITS, HAIR_COLORS, HAIRS, OUTFIT_COLORS, OUTFIT_DEFAULT_COLOR, OUTFITS, PATTERNS, SHOE_COLORS, WAX_OUTFITS, defaultColors, fullLook } from '../avatar/options'
import { ColorPicker } from '../components/ColorPicker'
import { Options, Section } from '../components/LookOptions'
import { Stage, type Focus } from '../avatar/Stage'
import { waxSwatch } from '../avatar/BlockHuman'
import { Chip } from '../components/ui'
import { amount } from '../game/rules'

// « Changer de look »: the wardrobe (clothes, pagne, colours, accessories)
// is free; a new cut, hair colour or beard is a visit to the barber or the
// salon. The body stays the Sim's own: no new skin, build or height.

/** What the server charges for a new hairdo (sims.HairPrice). */
const HAIR_PRICE = 2000

type Tab = { id: 'tenue' | 'accessoire' | 'coiffure'; label: string; icon: LucideIcon; focus: Focus }
const TABS: Tab[] = [
  { id: 'tenue', label: 'Tenue', icon: Shirt, focus: 'outfit' },
  { id: 'accessoire', label: 'Accessoire', icon: Glasses, focus: 'face' },
  { id: 'coiffure', label: 'Coiffure', icon: Scissors, focus: 'face' },
]

export function LookEditor() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [sim, setSim] = useState<Sim | null>(null)
  const [look, setLookState] = useState<Required<Look> | null>(null)
  const [tab, setTab] = useState<Tab['id']>(() => TABS.find((t) => t.id === params.get('tab'))?.id ?? 'tenue')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.sims().then((sims) => {
      if (!sims.length) return navigate('/creer')
      setSim(sims[0])
      setLookState(fullLook(sims[0].look))
    })
  }, [navigate])

  if (!sim || !look) return <div className="h-full bg-[var(--color-night)]" />

  // Back where the player came from (the game or the profile); the profile when opened directly.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/profil', { replace: true }))
  const setLook = (patch: Partial<Look>) => setLookState((l) => ({ ...l!, ...patch }))
  const femme = sim.gender === 'femme'
  const before = fullLook(sim.look)
  const haircut = look.hair !== before.hair || look.hairColor !== before.hairColor || look.beard !== before.beard
  const cost = haircut ? HAIR_PRICE : 0
  const changed = (Object.keys(look) as (keyof Look)[]).some((k) => look[k] !== before[k])
  const defaults = defaultColors(look, femme)
  const current = TABS.find((t) => t.id === tab)!

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.changeLook(sim!.id, look!)
      back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-night)] lg:flex-row">
      <section className="relative flex min-h-[42%] flex-1 flex-col overflow-hidden bg-[radial-gradient(110%_90%_at_50%_15%,#ffe7c7_0%,#ffb27a_45%,#ff7a59_78%,#c94a6a_100%)]">
        <Stage look={look} gender={sim.gender} focus={current.focus} className="!absolute inset-0" />
        <header className="pointer-events-none relative z-10 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-5">
          <div className="rounded-2xl bg-white/25 px-3 py-2 text-white backdrop-blur">
            <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-90">
              {sim.firstName} {sim.lastName}
            </div>
            <div className="font-display text-xl leading-tight font-extrabold">Changer de look</div>
          </div>
          <button className="icon-btn pointer-events-auto bg-white shadow-lg" onClick={back} aria-label="Fermer">
            <X size={24} strokeWidth={2.6} />
          </button>
        </header>
        <div className="pointer-events-none relative z-10 mt-auto p-3 text-center text-xs font-bold text-white opacity-90 lg:pb-8">Fais glisser pour tourner ton perso</div>
      </section>

      <section className="sheet relative z-10 -mt-6 flex max-h-[60%] flex-col rounded-t-[28px] lg:mt-0 lg:max-h-none lg:w-[540px] lg:rounded-none">
        <nav className="flex gap-1 px-3 pt-3 pb-2" role="tablist">
          {TABS.map((t) => {
            const here = t.id === tab
            return (
              <button key={t.id} role="tab" aria-selected={here} onClick={() => setTab(t.id)} className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition ${here ? 'bg-[#fff1e3]' : 'hover:bg-[var(--color-canvas)]'}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-full transition ${here ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}>
                  <t.icon size={16} strokeWidth={2.6} />
                </span>
                <span className={`text-[11px] leading-none font-extrabold ${here ? 'text-[var(--color-orange)]' : 'text-[var(--color-ink-soft)]'}`}>{t.label}</span>
              </button>
            )
          })}
        </nav>
        <p className="px-4 pb-1 text-sm font-bold text-[var(--color-ink-soft)]">
          {tab === 'coiffure' ? `Chez le coiffeur : ${amount(HAIR_PRICE)} F la nouvelle coiffure. Ton corps, lui, ne change pas.` : 'Dans ton armoire : gratuit.'}
        </p>

        <div key={tab} className="animate-up flex-1 overflow-y-auto px-4 pt-2 pb-4">
          {tab === 'tenue' && (
            <div className="space-y-5">
              <Section title="Style">
                <Options choices={OUTFITS.filter((o) => femme || !FEMME_OUTFITS.has(o.id))} value={look.outfit} onPick={(outfit) => setLook({ outfit, ...(OUTFIT_DEFAULT_COLOR[outfit] && { outfitColor: OUTFIT_DEFAULT_COLOR[outfit] }) })} look={look} gender={sim.gender} field="outfit" framing="full" />
              </Section>
              {(WAX_OUTFITS.has(look.outfit) || look.hair === 'headwrap') && (
                <Section title="Motif du pagne">
                  <div className="grid grid-cols-4 gap-2.5">
                    {PATTERNS.map((p) => (
                      <button key={p.id} className="tile flex flex-col items-center gap-1 p-1.5 pb-2" aria-pressed={look.pattern === p.id} onClick={() => setLook({ pattern: p.id })}>
                        <span className="block aspect-square w-full rounded-xl bg-cover" style={{ backgroundImage: `url(${waxSwatch(look.outfitColor, p.id)})`, backgroundSize: '100%', imageRendering: 'pixelated' }} />
                        <span className="text-[11px] font-extrabold">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}
              <Section title={WAX_OUTFITS.has(look.outfit) ? 'Couleur du pagne' : 'Couleur du haut'}>
                <ColorPicker label="Haut" presets={OUTFIT_COLORS} value={look.outfitColor} onChange={(outfitColor) => setLook({ outfitColor })} />
              </Section>
              {look.outfit !== 'robe' && (
                <Section title={look.outfit === 'pagne' && femme ? 'Couleur de la jupe' : 'Couleur du bas'}>
                  <ColorPicker label="Bas" presets={BOTTOM_COLORS} auto={defaults.bottom} value={look.bottomColor} onChange={(bottomColor) => setLook({ bottomColor })} />
                </Section>
              )}
              <Section title="Couleur des chaussures">
                <ColorPicker label="Chaussures" presets={SHOE_COLORS} auto={defaults.shoe} value={look.shoeColor} onChange={(shoeColor) => setLook({ shoeColor })} />
              </Section>
            </div>
          )}

          {tab === 'accessoire' && (
            <div className="space-y-5">
              <Section title="Accessoire" icon={Glasses}>
                <Options choices={ACCESSORIES} value={look.accessory} onPick={(accessory) => setLook({ accessory })} look={look} gender={sim.gender} field="accessory" framing="bust" />
              </Section>
              {look.accessory !== 'none' && (
                <Section title="Couleur de l'accessoire">
                  <ColorPicker label="Accessoire" presets={ACCESSORY_COLORS} auto={defaults.accessory} value={look.accessoryColor} onChange={(accessoryColor) => setLook({ accessoryColor })} />
                </Section>
              )}
            </div>
          )}

          {tab === 'coiffure' && (
            <div className="space-y-5">
              <Section title="Coupe" right={<Chip tone="gold">{amount(HAIR_PRICE)} F</Chip>}>
                <Options choices={HAIRS} value={look.hair} onPick={(hair) => setLook({ hair })} look={look} gender={sim.gender} field="hair" framing="head" />
              </Section>
              <Section title="Couleur">
                <ColorPicker label="Cheveux" presets={HAIR_COLORS} value={look.hairColor} onChange={(hairColor) => setLook({ hairColor })} />
              </Section>
              {!femme && (
                <Section title="Barbe">
                  <Options choices={BEARDS} value={look.beard} onPick={(beard) => setLook({ beard })} look={look} gender={sim.gender} field="beard" framing="head" />
                </Section>
              )}
            </div>
          )}
        </div>

        {sim.money < cost && <p className="mx-3 mb-2 text-xs font-extrabold text-[#d81b3f]">Pas assez d'argent pour le coiffeur ({amount(sim.money)} F).</p>}
        {error && <p className="motion-shake mx-3 mb-2 rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">{error}</p>}
        <footer className="flex gap-2 border-t border-[var(--color-line)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button className="btn btn-soft shrink-0 px-4" onClick={back}>
            Annuler
          </button>
          <button className="btn btn-emerald flex-1" disabled={busy || !changed || sim.money < cost} onClick={save}>
            {cost ? `Valider · ${amount(cost)} F` : 'Valider'}
          </button>
        </footer>
      </section>
    </div>
  )
}
