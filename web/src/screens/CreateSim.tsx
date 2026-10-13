import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dices, IdCard, MapPin, Palette, Scissors, Shirt, Sparkles, type LucideIcon } from 'lucide-react'
import { api, type NewSim } from '../lib/api'
import type { Origin } from '../lib/types'
import { useWorld } from '../store/world'
import { HAIR_COLORS, HAIRS, OUTFIT_COLORS, OUTFITS, SKIN_TONES, SimAvatar } from '../components/SimAvatar'
import { iconFor } from '../components/icons'
import { Chip, Coin, IconTile, Plumbob } from '../components/ui'
import { amount } from '../game/rules'

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'identity', label: 'Identité', icon: IdCard },
  { id: 'skin', label: 'Teint', icon: Palette },
  { id: 'hair', label: 'Coiffure', icon: Scissors },
  { id: 'outfit', label: 'Tenue', icon: Shirt },
  { id: 'traits', label: 'Caractère', icon: Sparkles },
  { id: 'home', label: 'Quartier', icon: MapPin },
]

const TRAIT_COLORS: [string, string][] = [['#ff8a65', '#ff3d57'], ['#64b5ff', '#2a6cf0'], ['#ffd54f', '#ffa000'], ['#b39dff', '#6c47ff'], ['#69e2a0', '#00a862'], ['#ff7ad9', '#b02bd6']]

const FIRST = { femme: ['Awa', 'Aya', 'Mariam', 'Adjoua', 'Fatou', 'Akissi', 'Ruth'], homme: ['Kouadio', 'Yao', 'Moussa', 'Koffi', 'Serge', 'Ibrahim', 'Didier'] }
const LAST = ['Koné', 'Kouassi', 'Traoré', 'Yao', 'Ouattara', 'Bamba', "N'Guessan", 'Diabaté', 'Coulibaly', 'Touré']
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

export function CreateSim() {
  const world = useWorld((s) => s.world)
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [sim, setSim] = useState<NewSim>({
    firstName: 'Awa',
    lastName: 'Koné',
    gender: 'femme',
    look: { skin: SKIN_TONES[3], hair: 'headwrap', hairColor: HAIR_COLORS[0], outfit: 'pagne', outfitColor: OUTFIT_COLORS[0] },
    traits: ['ambianceur', 'gourmand'],
    aspiration: 'ambiance',
    homeCity: 'abidjan',
    homeCommune: 'yopougon',
  })

  if (!world) return null
  const set = (patch: Partial<NewSim>) => setSim((s) => ({ ...s, ...patch }))
  const setLook = (patch: Partial<NewSim['look']>) => setSim((s) => ({ ...s, look: { ...s.look, ...patch } }))
  const city = world.cities.find((c) => c.id === sim.homeCity)!
  const commune = city.communes.find((c) => c.id === sim.homeCommune)!
  const aspiration = world.aspirations.find((a) => a.id === sim.aspiration)!
  const valid = sim.firstName.trim() && sim.lastName.trim() && sim.traits.length > 0
  const last = tab === TABS.length - 1

  function randomize() {
    const gender = pick(['femme', 'homme'] as const)
    const c = pick(world!.cities)
    set({
      gender,
      firstName: pick(FIRST[gender]),
      lastName: pick(LAST),
      look: { skin: pick(SKIN_TONES), hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS), outfit: pick(OUTFITS).id, outfitColor: pick(OUTFIT_COLORS) },
      traits: [...world!.traits].sort(() => Math.random() - 0.5).slice(0, 3).map((t) => t.id),
      aspiration: pick(world!.aspirations).id,
      homeCity: c.id,
      homeCommune: pick(c.communes).id,
    })
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const created = await api.createSim(sim)
      const drawn = world!.origins.find((o) => o.id === created.origin)
      if (drawn) setOrigin(drawn)
      else navigate('/jeu')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-night)] lg:flex-row">
      {/* Stage */}
      <section className="relative flex min-h-[44%] flex-1 flex-col overflow-hidden bg-[radial-gradient(120%_90%_at_50%_10%,#ffe7c7_0%,#ffb27a_45%,#ff7a59_75%,#c94a6a_100%)]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.07)_0_2px,transparent_2px_64px)]" />
        <header className="relative z-10 flex items-center justify-between p-3 lg:p-5">
          <div className="rounded-full bg-white/25 px-3 py-1.5 font-display text-sm font-extrabold text-white backdrop-blur">Crée ton Sim</div>
          <button className="icon-btn bg-white text-[var(--color-orange)] shadow-lg" onClick={randomize} aria-label="Sim au hasard" title="Au hasard">
            <Dices size={24} strokeWidth={2.4} />
          </button>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-end pb-4 lg:pb-16">
          <Plumbob size={18} color="#00b86b" />
          <div key={sim.gender + sim.look.outfit + sim.look.hair} className="animate-pop relative z-10 -mb-5 h-[clamp(150px,30vh,330px)] lg:h-[clamp(260px,56vh,560px)] [&>svg]:h-full [&>svg]:w-auto">
            <SimAvatar look={sim.look} gender={sim.gender} size={220} />
          </div>
          <div className="h-10 w-[min(70%,300px)] rounded-[50%] bg-gradient-to-b from-white/70 to-white/20 shadow-[0_12px_30px_-8px_rgba(120,30,40,0.5)]" />
          <div className="mt-3 text-center text-white">
            <div className="font-display text-[26px] leading-none font-extrabold [text-shadow:0_2px_0_rgba(0,0,0,0.12)] lg:text-4xl">
              {sim.firstName || '…'} {sim.lastName}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <Chip tone="dark">
                <MapPin size={12} /> {commune.name}
              </Chip>
              <Chip tone="dark">{aspiration.label}</Chip>
            </div>
          </div>
        </div>
      </section>

      {/* Editor */}
      <section className="sheet relative z-10 -mt-6 flex max-h-[58%] flex-col rounded-t-[28px] lg:mt-0 lg:max-h-none lg:w-[520px] lg:rounded-none">
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pt-3 pb-2">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTab(i)}
              className={`flex min-w-[68px] flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-extrabold transition ${i === tab ? 'bg-[#fff1e3] text-[var(--color-orange)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'}`}
            >
              <t.icon size={22} strokeWidth={2.4} />
              {t.label}
            </button>
          ))}
        </nav>

        <div key={tab} className="animate-up flex-1 overflow-y-auto px-4 pt-2 pb-4">
          {TABS[tab].id === 'identity' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {(['femme', 'homme'] as const).map((g) => (
                  <button key={g} className="tile flex flex-col items-center pt-2 pb-3" aria-pressed={sim.gender === g} onClick={() => set({ gender: g })}>
                    <SimAvatar look={{ ...sim.look, hair: g === 'homme' && sim.look.hair === 'headwrap' ? 'short' : sim.look.hair }} gender={g} size={78} crop="head" animated={false} />
                    <span className="mt-1 font-display text-base font-extrabold">{g === 'femme' ? 'Femme' : 'Homme'}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="label">Prénom</span>
                  <input className="input mt-1.5" value={sim.firstName} maxLength={40} onChange={(e) => set({ firstName: e.target.value })} />
                </label>
                <label>
                  <span className="label">Nom</span>
                  <input className="input mt-1.5" value={sim.lastName} maxLength={40} onChange={(e) => set({ lastName: e.target.value })} />
                </label>
              </div>
            </div>
          )}

          {TABS[tab].id === 'skin' && (
            <div className="grid grid-cols-3 gap-3">
              {SKIN_TONES.map((c) => (
                <button key={c} className="tile flex flex-col items-center py-2" aria-pressed={sim.look.skin === c} onClick={() => setLook({ skin: c })} aria-label={`Teint ${c}`}>
                  <SimAvatar look={{ ...sim.look, skin: c }} gender={sim.gender} size={72} crop="head" animated={false} />
                </button>
              ))}
            </div>
          )}

          {TABS[tab].id === 'hair' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {HAIRS.map((h) => (
                  <button key={h.id} className="tile flex flex-col items-center pt-1 pb-2" aria-pressed={sim.look.hair === h.id} onClick={() => setLook({ hair: h.id })}>
                    <SimAvatar look={{ ...sim.look, hair: h.id }} gender={sim.gender} size={72} crop="head" animated={false} />
                    <span className="text-xs font-extrabold">{h.label}</span>
                  </button>
                ))}
              </div>
              <Swatches label="Couleur" colors={HAIR_COLORS} value={sim.look.hairColor} onChange={(hairColor) => setLook({ hairColor })} />
            </div>
          )}

          {TABS[tab].id === 'outfit' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {OUTFITS.map((o) => (
                  <button key={o.id} className="tile flex flex-col items-center pt-1 pb-2" aria-pressed={sim.look.outfit === o.id} onClick={() => setLook({ outfit: o.id })}>
                    <SimAvatar look={{ ...sim.look, outfit: o.id }} gender={sim.gender} size={72} crop="bust" animated={false} />
                    <span className="text-xs font-extrabold">{o.label}</span>
                  </button>
                ))}
              </div>
              {sim.look.outfit !== 'jersey' && <Swatches label="Tissu" colors={OUTFIT_COLORS} value={sim.look.outfitColor} onChange={(outfitColor) => setLook({ outfitColor })} />}
            </div>
          )}

          {TABS[tab].id === 'traits' && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label">Traits</span>
                  <Chip tone={sim.traits.length === 3 ? 'good' : 'neutral'}>{sim.traits.length} / 3</Chip>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {world.traits.map((t, i) => {
                    const on = sim.traits.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        className="tile flex flex-col items-center gap-1.5 px-1 pt-3 pb-2.5"
                        aria-pressed={on}
                        disabled={!on && sim.traits.length >= 3}
                        title={t.hint}
                        onClick={() => set({ traits: on ? sim.traits.filter((x) => x !== t.id) : [...sim.traits, t.id] })}
                      >
                        <IconTile icon={iconFor(t.icon)} colors={TRAIT_COLORS[i % TRAIT_COLORS.length]} size={40} />
                        <span className="text-xs leading-tight font-extrabold">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <span className="label">Rêve de vie</span>
                <div className="mt-2 grid gap-2">
                  {world.aspirations.map((a, i) => (
                    <button key={a.id} className="tile flex items-center gap-3 p-2.5 text-left" aria-pressed={sim.aspiration === a.id} onClick={() => set({ aspiration: a.id })}>
                      <IconTile icon={iconFor(a.icon)} colors={TRAIT_COLORS[(i + 2) % TRAIT_COLORS.length]} size={40} />
                      <span>
                        <span className="block font-display text-base leading-tight font-extrabold">{a.label}</span>
                        <span className="text-xs text-[var(--color-ink-soft)]">{a.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {TABS[tab].id === 'home' && (
            <div className="space-y-4">
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {world.cities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => set({ homeCity: c.id, homeCommune: c.communes[0].id })}
                    className={`shrink-0 rounded-full px-4 py-2 font-display text-sm font-extrabold transition ${sim.homeCity === c.id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {city.communes.map((cm) => (
                  <button key={cm.id} className="tile p-3 text-left" aria-pressed={sim.homeCommune === cm.id} onClick={() => set({ homeCommune: cm.id })}>
                    <span className="block font-display text-base leading-tight font-extrabold">{cm.name}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-[var(--color-ink-soft)]">{cm.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-[var(--color-line)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && <p className="mb-2 rounded-2xl bg-[#ffe8ec] px-3 py-2 text-sm font-bold text-[#d81b3f]">{error}</p>}
          {last ? (
            <button className="btn btn-emerald w-full" disabled={busy || !valid} onClick={submit}>
              Emménager à {commune.name}
            </button>
          ) : (
            <button className="btn w-full" onClick={() => setTab(tab + 1)}>
              Suivant · {TABS[tab + 1].label}
            </button>
          )}
        </footer>
      </section>
      {origin && <OriginReveal origin={origin} name={sim.firstName} housing={world.housings.find((h) => h.id === origin.housing)?.label ?? ''} onGo={() => navigate('/jeu')} />}
    </div>
  )
}

/** Nobody chooses where they start: the server draws it, we reveal it like a card. */
function OriginReveal({ origin, name, housing, onGo }: { origin: Origin; name: string; housing: string; onGo: () => void }) {
  const rich = origin.loan === 0
  const colors: [string, string] = rich ? ['#ffd54f', '#ffa000'] : ['#69e2a0', '#00a862']
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f1230]/70 p-4 backdrop-blur-[4px]">
      <div className="card animate-pop w-full max-w-sm overflow-hidden text-center">
        <div className="relative px-5 pt-6 pb-5 text-white" style={{ background: `radial-gradient(120% 100% at 50% 0%, ${colors[0]}, ${colors[1]})` }}>
          <div className="label !text-white/85">Le destin a parlé</div>
          <div className="mt-3 flex justify-center">
            <IconTile icon={iconFor(origin.icon)} colors={['#ffffff55', '#ffffff22']} size={84} radius={28} />
          </div>
          <div className="mt-3 font-display text-[30px] leading-none font-extrabold [text-shadow:0_2px_0_rgba(0,0,0,0.15)]">{origin.label}</div>
          <p className="mt-2 text-sm leading-snug font-bold text-white/95">{origin.hint}</p>
        </div>
        <ul className="space-y-2 p-4 text-left">
          <li className="flex items-center justify-between rounded-[18px] bg-[var(--color-canvas)] px-3 py-2.5">
            <span className="text-sm font-extrabold text-[var(--color-ink-soft)]">Porte-monnaie</span>
            <span className="flex items-center gap-1 font-display text-lg font-extrabold"><Coin size={20} /> {amount(origin.money)}</span>
          </li>
          <li className="flex items-center justify-between rounded-[18px] bg-[var(--color-canvas)] px-3 py-2.5">
            <span className="text-sm font-extrabold text-[var(--color-ink-soft)]">Logement</span>
            <span className="font-display text-base font-extrabold">{housing}</span>
          </li>
          {origin.loan > 0 && (
            <li className="flex items-center justify-between rounded-[18px] bg-[#ffe8ec] px-3 py-2.5">
              <span className="text-sm font-extrabold text-[#d81b3f]">Microcrédit à rembourser</span>
              <span className="font-display text-base font-extrabold text-[#d81b3f]">{amount(origin.loan)} F</span>
            </li>
          )}
        </ul>
        <div className="px-4 pb-4">
          <button className="btn w-full" onClick={onGo}>
            C'est parti, {name} !
          </button>
        </div>
      </div>
    </div>
  )
}

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={`h-11 w-11 rounded-full transition ${value === c ? 'scale-110 ring-4 ring-[var(--color-orange)] ring-offset-2' : 'ring-1 ring-black/10'}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}
