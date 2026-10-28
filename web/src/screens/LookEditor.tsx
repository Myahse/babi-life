import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Glasses, Scissors, ShoppingBag, Shirt, X, type LucideIcon } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ClothingPiece, Look, Sim } from '../lib/types'
import { forGender, wearPiece, wearing } from '../lib/clothes'
import { useWorld } from '../store/world'
import { ACCESSORIES, ACCESSORY_COLORS, BEARDS, BOTTOM_COLORS, FEMME_OUTFITS, HAIR_COLORS, HAIRS, OUTFIT_COLORS, OUTFIT_DEFAULT_COLOR, OUTFITS, PATTERNS, PIECE_PATTERNS, PRESTIGE_ACCESSORIES, SHOE_COLORS, WAX_OUTFITS, accessoriesFor, beardsFor, defaultColors, fullLook, hairsFor, outfitsFor } from '../avatar/options'
import { ColorPicker } from '../components/ColorPicker'
import { AccessoryOptions, Options, Section } from '../components/LookOptions'
import { Stage, type Focus } from '../avatar/Stage'
import { waxSwatch } from '../avatar/BlockHuman'
import { Chip } from '../components/ui'
import { Portrait } from '../avatar/portrait'
import { amount, lifeOf } from '../game/rules'
import { keyOpen, useFeatures } from '../lib/features'

// « Changer de look »: the wardrobe (clothes, pagne, colours, accessories)
// is free; a new cut, hair colour or beard is a visit to the barber or the
// salon. The body stays the Sim's own: no new skin, build or height. The
// wardrobe also keeps the pieces bought in the boutiques (game/clothes.go),
// put on with a tap; their own prints come with them.

/** What the server charges for a new hairdo (sims.HairPrice). */
const HAIR_PRICE = 2000

type Tab = { id: 'garde-robe' | 'tenue' | 'accessoire' | 'coiffure'; label: string; icon: LucideIcon; focus: Focus }
const WARDROBE: Tab = { id: 'garde-robe', label: 'Garde-robe', icon: ShoppingBag, focus: 'outfit' }
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
  const world = useWorld((s) => s.world)
  const [owned, setOwned] = useState<string[]>([])
  const feats = useFeatures()

  useEffect(() => {
    api.sims().then((sims) => {
      if (!sims.length) return navigate('/creer')
      setSim(sims[0])
      setLookState(fullLook(sims[0].look))
      api.clothes(sims[0].id).then((r) => setOwned(r.owned)).catch(() => {})
    })
  }, [navigate])

  if (!sim || !look) return <div className="h-full bg-[var(--color-night)]" />

  // Back where the player came from (the game or the profile); the profile when opened directly.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/profil', { replace: true }))
  const setLook = (patch: Partial<Look>) => setLookState((l) => ({ ...l!, ...patch }))
  const femme = sim.gender === 'femme'
  const before = fullLook(sim.look)
  // The looks of each age (« looks-age »): a baby, a child, a teen picks among its own; maman does a child's hair, for free.
  const stage = keyOpen(feats, 'looks-age') && world ? lifeOf(world, sim).stage?.id : undefined
  const young = !!stage && stage !== 'adulte'
  const baby = stage === 'bebe'
  const outfits = stage ? outfitsFor(stage, femme) : OUTFITS.filter((o) => femme || !FEMME_OUTFITS.has(o.id))
  const hairs = stage ? hairsFor(stage) : HAIRS
  const accessories = stage ? accessoriesFor(stage) : ACCESSORIES
  const beards = stage ? beardsFor(stage) : BEARDS
  const haircut = look.hair !== before.hair || look.hairColor !== before.hairColor || look.beard !== before.beard
  const cost = haircut && !young ? HAIR_PRICE : 0
  const changed = (Object.keys(look) as (keyof Look)[]).some((k) => look[k] !== before[k])
  const defaults = defaultColors(look, femme)
  const mine: ClothingPiece[] = forGender(world?.clothes ?? [], sim.gender).filter((p) => owned.includes(p.id))
  const tabs = mine.length ? [WARDROBE, ...TABS] : TABS
  const current = tabs.find((t) => t.id === tab) ?? TABS[0]
  const patterns = [...PATTERNS, ...PIECE_PATTERNS.filter((p) => mine.some((m) => m.pattern === p.id))]

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.changeLook(sim!.id, look!)
      back()
    } catch (e) {
      setError(errorText(e, 'Erreur'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-night)] lg:flex-row">
      <section className="relative flex min-h-[42%] flex-1 flex-col overflow-hidden bg-[radial-gradient(110%_90%_at_50%_15%,#ffe7c7_0%,#ffb27a_45%,#ff7a59_78%,#c94a6a_100%)]">
        <Stage look={look} gender={sim.gender} focus={current.focus} stage={stage} className="!absolute inset-0" />
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
          {tabs.map((t) => {
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
          {current.id === 'garde-robe' ? 'Les pièces achetées en boutique : touche pour la mettre.' : current.id === 'coiffure' ? (young ? 'Maman te coiffe : gratuit. Ton corps, lui, ne change pas.' : `Chez le coiffeur : ${amount(HAIR_PRICE)} Djai la nouvelle coiffure. Ton corps, lui, ne change pas.`) : 'Dans ton armoire : gratuit.'}
        </p>

        <div key={tab} className="animate-up flex-1 overflow-y-auto px-4 pt-2 pb-4">
          {current.id === 'garde-robe' && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {mine.map((p) => (
                <button key={p.id} className="tile flex flex-col items-center overflow-hidden pb-1.5" aria-pressed={wearing(look, p)} onClick={() => setLookState(wearPiece(look, p))}>
                  <span className={`block w-full ${p.kind === 'accessoire' ? 'aspect-square' : 'aspect-[3/4]'}`}>
                    <Portrait look={wearPiece(look, p)} gender={sim.gender} framing={p.kind === 'accessoire' ? 'bust' : 'full'} />
                  </span>
                  <span className="px-1 text-center text-[11px] leading-tight font-extrabold">{p.label}</span>
                  <span className="text-[10px] font-bold text-[var(--color-ink-soft)]">{p.brand}</span>
                </button>
              ))}
            </div>
          )}

          {current.id === 'tenue' && (
            <div className="space-y-5">
              <Section title="Style">
                <Options choices={outfits} value={look.outfit} onPick={(outfit) => setLook({ outfit, ...(OUTFIT_DEFAULT_COLOR[outfit] && { outfitColor: OUTFIT_DEFAULT_COLOR[outfit] }) })} look={look} gender={sim.gender} field="outfit" framing="full" stage={stage} />
              </Section>
              {(WAX_OUTFITS.has(look.outfit) || look.hair === 'headwrap') && (
                <Section title="Motif du pagne">
                  <div className="grid grid-cols-4 gap-2.5">
                    {patterns.map((p) => (
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
              {look.outfit !== 'robe' && !baby && (
                <Section title={look.outfit === 'pagne' && femme ? 'Couleur de la jupe' : 'Couleur du bas'}>
                  <ColorPicker label="Bas" presets={BOTTOM_COLORS} auto={defaults.bottom} value={look.bottomColor} onChange={(bottomColor) => setLook({ bottomColor })} />
                </Section>
              )}
              {!baby && (
                <Section title="Couleur des chaussures">
                  <ColorPicker label="Chaussures" presets={SHOE_COLORS} auto={defaults.shoe} value={look.shoeColor} onChange={(shoeColor) => setLook({ shoeColor })} />
                </Section>
              )}
            </div>
          )}

          {current.id === 'accessoire' && (
            <div className="space-y-5">
              <Section title="Accessoire" icon={Glasses}>
                <AccessoryOptions choices={accessories} value={look.accessory} onPick={(accessory) => setLook({ accessory })} look={look} gender={sim.gender} locked={sim.prestige ? undefined : PRESTIGE_ACCESSORIES} stage={stage} />
              </Section>
              {look.accessory !== 'none' && (
                <Section title="Couleur de l'accessoire">
                  <ColorPicker label="Accessoire" presets={ACCESSORY_COLORS} auto={defaults.accessory} value={look.accessoryColor} onChange={(accessoryColor) => setLook({ accessoryColor })} />
                </Section>
              )}
            </div>
          )}

          {current.id === 'coiffure' && (
            <div className="space-y-5">
              <Section title="Coupe" right={young ? <Chip tone="good">Gratuit</Chip> : <Chip tone="gold">{amount(HAIR_PRICE)} Djai</Chip>}>
                <Options choices={hairs} value={look.hair} onPick={(hair) => setLook({ hair })} look={look} gender={sim.gender} field="hair" framing="head" stage={stage} />
              </Section>
              <Section title="Couleur">
                <ColorPicker label="Cheveux" presets={HAIR_COLORS} value={look.hairColor} onChange={(hairColor) => setLook({ hairColor })} />
              </Section>
              {!femme && beards.length > 0 && (
                <Section title="Barbe">
                  <Options choices={beards} value={look.beard} onPick={(beard) => setLook({ beard })} look={look} gender={sim.gender} field="beard" framing="head" stage={stage} />
                </Section>
              )}
            </div>
          )}
        </div>

        {sim.money < cost && <p className="mx-3 mb-2 text-xs font-extrabold text-[#d81b3f]">Pas assez d'argent pour le coiffeur ({amount(sim.money)} Djai).</p>}
        {error && <p className="motion-shake mx-3 mb-2 rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">{error}</p>}
        <footer className="flex gap-2 border-t border-[var(--color-line)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button className="btn btn-soft shrink-0 px-4" onClick={back}>
            Annuler
          </button>
          <button className="btn btn-emerald flex-1" disabled={busy || !changed || sim.money < cost} onClick={save}>
            {cost ? `Valider · ${amount(cost)} Djai` : 'Valider'}
          </button>
        </footer>
      </section>
    </div>
  )
}
