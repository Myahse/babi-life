import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Bandage, Check, ChevronLeft, ChevronRight, Dices, Baby, Glasses, Heart, IdCard, PersonStanding, Scissors, Shirt, Smile, type LucideIcon } from 'lucide-react'
import { api, type NewSim } from '../lib/api'
import type { Family, Look } from '../lib/types'
import { useWorld } from '../store/world'
import { useSession } from '../store/session'
import { UsernameField } from '../components/UsernameField'
import { USERNAME, suggestFrom } from '../lib/username'
import { ACCESSORIES, ACCESSORY_COLORS, MARKS, BEARDS, BODIES, BOTTOM_COLORS, DEFAULT_LOOK, EYE_COLORS, HAIR_COLORS, HAIRS, HEIGHT_RANGE, OUTFIT_COLORS, OUTFIT_DEFAULT_COLOR, OUTFITS, PATTERNS, SHOE_COLORS, SKIN_TONES, WAX_OUTFITS, defaultColors, metres, randomLook, scaleFor, type Choice } from '../avatar/options'
import { ColorPicker } from '../components/ColorPicker'
import { Stage, type Focus } from '../avatar/Stage'
import { Portrait, type Framing } from '../avatar/portrait'
import { waxSwatch } from '../avatar/BlockHuman'
import { iconFor } from '../components/icons'
import { Chip, IconTile } from '../components/ui'
import { amount } from '../game/rules'

// The Sim creator, in seven clear steps. The Sim stands on a turntable that
// zooms to the face for hair and face choices; every option is shown as a
// picture of *this* Sim wearing it.

type Step = { id: string; label: string; icon: LucideIcon; focus: Focus; hint: string }

const STEPS: Step[] = [
  { id: 'identity', label: 'Identité', icon: IdCard, focus: 'body', hint: 'Qui es-tu ?' },
  { id: 'body', label: 'Corps', icon: PersonStanding, focus: 'body', hint: 'Teint, silhouette et taille.' },
  { id: 'face', label: 'Visage', icon: Smile, focus: 'face', hint: 'Yeux, barbe et accessoires.' },
  { id: 'hair', label: 'Coiffure', icon: Scissors, focus: 'face', hint: 'Une coupe qui te ressemble.' },
  { id: 'outfit', label: 'Tenue', icon: Shirt, focus: 'outfit', hint: 'Choisis ton style, ton pagne, ta couleur.' },
  { id: 'traits', label: 'Caractère', icon: Heart, focus: 'body', hint: 'Trois traits et un rêve de vie.' },
  { id: 'home', label: 'Naissance', icon: Baby, focus: 'body', hint: 'Ta famille, tu ne la choisis pas.' },
]

const TRAIT_COLORS: [string, string][] = [['#ff8a65', '#ff3d57'], ['#64b5ff', '#2a6cf0'], ['#ffd54f', '#ffa000'], ['#b39dff', '#6c47ff'], ['#69e2a0', '#00a862'], ['#ff7ad9', '#b02bd6']]
const FIRST = { femme: ['Awa', 'Aya', 'Mariam', 'Adjoua', 'Fatou', 'Akissi', 'Ruth', 'Affoué'], homme: ['Kouadio', 'Yao', 'Moussa', 'Koffi', 'Serge', 'Ibrahim', 'Didier', 'Konan'] }
const LAST = ['Koné', 'Kouassi', 'Traoré', 'Yao', 'Ouattara', 'Bamba', "N'Guessan", 'Diabaté', 'Coulibaly', 'Touré', 'Kouamé']
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
const showMetres = (m: number) => `${m.toFixed(2).replace('.', ',')} m`

export function CreateSim() {
  const world = useWorld((s) => s.world)
  const { user, signIn, token } = useSession()
  const navigate = useNavigate()
  // Google sign-ups have no username yet: they choose it here.
  const needsUsername = !user?.username
  const [username, setUsername] = useState(() => suggestFrom(user?.firstName ?? '', user?.lastName ?? ''))
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [born, setBorn] = useState<{ family: Family; commune: string; located: boolean } | null>(null)
  const [sim, setSim] = useState<NewSim & { look: Required<Look> }>({
    // Taken from the account; the player only corrects them if needed.
    firstName: user?.firstName || user?.name.split(' ')[0] || 'Awa',
    lastName: user?.lastName || user?.name.split(' ').slice(1).join(' ') || 'Koné',
    gender: 'femme',
    look: DEFAULT_LOOK as Required<Look>,
    traits: ['ambianceur', 'gourmand'],
    aspiration: 'ambiance',
    homeCity: 'abidjan',
    homeCommune: 'yopougon',
  })

  if (!world) return null
  type Draft = NewSim & { look: Required<Look> }
  const set = (patch: Partial<Draft>) => setSim((s) => ({ ...s, ...patch }))
  const setLook = (patch: Partial<Look>) => setSim((s) => ({ ...s, look: { ...s.look, ...patch } }))
  const femme = sim.gender === 'femme'
  const valid = sim.firstName.trim() && sim.lastName.trim() && sim.traits.length > 0 && (!needsUsername || USERNAME.test(username))
  const current = STEPS[step]
  const height = metres(sim.look.height, sim.gender)
  const defaults = defaultColors(sim.look, femme)
  const last = step === STEPS.length - 1

  function randomize() {
    const gender = pick(['femme', 'homme'] as const)
    const c = pick(world!.cities)
    set({
      gender,
      firstName: pick(FIRST[gender]),
      lastName: pick(LAST),
      look: randomLook(gender),
      traits: [...world!.traits].sort(() => Math.random() - 0.5).slice(0, 3).map((t) => t.id),
      aspiration: pick(world!.aspirations).id,
      homeCity: c.id,
      homeCommune: pick(c.communes).id,
    })
  }

  function setGender(gender: NewSim['gender']) {
    // Swap the obviously gendered defaults; everything else is free to mix.
    const look = randomLookFor(gender, sim.look)
    const other = FIRST[gender === 'femme' ? 'homme' : 'femme']
    set({ gender, look, firstName: other.includes(sim.firstName) ? pick(FIRST[gender]) : sim.firstName })
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      if (needsUsername) {
        const u = await api.setUsername(username)
        signIn(token!, u)
      }
      // Born where the player really is: only the nearest commune is kept.
      const pos = await whereAmI()
      const created = await api.createSim({ ...sim, ...pos })
      const drawn = world!.families?.find((f) => f.id === created.family)
      const city = world!.cities.find((c) => c.id === created.homeCity)
      const cm = city?.communes.find((c) => c.id === created.homeCommune)
      const place = cm && city && cm.name !== city.name ? `${cm.name}, ${city.name}` : (cm?.name ?? '')
      if (drawn) setBorn({ family: drawn, commune: place, located: !!pos })
      else navigate('/jeu', { viewTransition: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-night)] lg:flex-row">
      {/* ---------- Stage ---------- */}
      <section className="relative flex min-h-[42%] flex-1 flex-col overflow-hidden bg-[radial-gradient(110%_90%_at_50%_15%,#ffe7c7_0%,#ffb27a_45%,#ff7a59_78%,#c94a6a_100%)]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.07)_0_2px,transparent_2px_64px)]" />
        <Stage look={sim.look} gender={sim.gender} focus={current.focus} pose={step === STEPS.length - 1 ? 'wave' : 'idle'} baby={current.id === 'home' || !!born} className="!absolute inset-0" />

        <header className="pointer-events-none relative z-10 flex items-start justify-between gap-2 p-3 lg:p-5">
          <div className="pointer-events-auto rounded-2xl bg-white/25 px-3 py-2 text-white backdrop-blur">
            <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-90">
              Étape {step + 1} sur {STEPS.length}
            </div>
            <div className="font-display text-xl leading-tight font-extrabold">{current.label}</div>
          </div>
          <button className="icon-btn pointer-events-auto bg-white text-[var(--color-orange)] shadow-lg" onClick={randomize} aria-label="Sim au hasard" title="Au hasard">
            <Dices size={24} strokeWidth={2.4} />
          </button>
        </header>

        <div className="pointer-events-none relative z-10 mt-auto p-3 text-center text-white lg:pb-8">
          <div className="font-display text-[26px] leading-none font-extrabold [text-shadow:0_2px_0_rgba(0,0,0,0.15)] lg:text-4xl">
            {sim.firstName || '…'} {sim.lastName}
          </div>
          <div className="mt-1 text-xs font-bold opacity-90">Fais glisser pour tourner ton Sim</div>
        </div>
      </section>

      {/* ---------- Editor ---------- */}
      <section className="sheet relative z-10 -mt-6 flex max-h-[60%] flex-col rounded-t-[28px] lg:mt-0 lg:max-h-none lg:w-[540px] lg:rounded-none">
        <Stepper step={step} onStep={setStep} />
        <p className="px-4 pb-1 text-sm font-bold text-[var(--color-ink-soft)]">{current.hint}</p>

        <div key={step} className="animate-up flex-1 overflow-y-auto px-4 pt-2 pb-4">
          {current.id === 'identity' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {(['femme', 'homme'] as const).map((g) => (
                  <button key={g} className="tile flex flex-col items-center overflow-hidden pb-3" aria-pressed={sim.gender === g} onClick={() => setGender(g)}>
                    <span className="block aspect-square w-full max-w-[150px]">
                      <Portrait look={sim.gender === g ? sim.look : randomLookFor(g, sim.look)} gender={g} framing="bust" />
                    </span>
                    <span className="font-display text-base font-extrabold">{g === 'femme' ? 'Femme' : 'Homme'}</span>
                  </button>
                ))}
              </div>
              {needsUsername && (
                <div>
                  <span className="label">Ton pseudo</span>
                  <div className="mt-1.5">
                    <UsernameField value={username} onChange={setUsername} first={sim.firstName} last={sim.lastName} />
                  </div>
                </div>
              )}
              {user?.firstName && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink-soft)]">
                  <BadgeCheck size={14} className="text-[var(--color-emerald)]" /> Prénom et nom repris de ton compte. Corrige-les seulement si besoin.
                </p>
              )}
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

          {current.id === 'body' && (
            <div className="space-y-5">
              <Section title="Teint">
                <ColorPicker label="Teint" presets={SKIN_TONES} value={sim.look.skin} onChange={(skin) => setLook({ skin })} big />
              </Section>
              <Section title="Silhouette">
                <Options choices={BODIES} value={sim.look.body} onPick={(body) => setLook({ body })} look={sim.look} gender={sim.gender} field="body" framing="full" />
              </Section>
              <Section title="Taille" right={<Chip tone="gold">{showMetres(height)}</Chip>}>
                <input
                  type="range"
                  min={HEIGHT_RANGE.min}
                  max={HEIGHT_RANGE.max}
                  step={0.01}
                  value={height}
                  onChange={(e) => setLook({ height: Math.round(scaleFor(Number(e.target.value), sim.gender) * 1000) / 1000 })}
                  className="w-full accent-[var(--color-orange)]"
                  aria-label="Taille"
                />
                <div className="flex justify-between text-xs font-extrabold text-[var(--color-ink-soft)]">
                  <span>{showMetres(HEIGHT_RANGE.min)}</span>
                  <span>{showMetres(HEIGHT_RANGE.max)}</span>
                </div>
              </Section>
            </div>
          )}

          {current.id === 'face' && (
            <div className="space-y-5">
              <Section title="Couleur des yeux">
                <ColorPicker label="Yeux" presets={EYE_COLORS} value={sim.look.eyes} onChange={(eyes) => setLook({ eyes })} />
              </Section>
              {!femme && (
                <Section title="Barbe">
                  <Options choices={BEARDS} value={sim.look.beard} onPick={(beard) => setLook({ beard })} look={sim.look} gender={sim.gender} field="beard" framing="head" />
                </Section>
              )}
              <Section title="Bobos" icon={Bandage}>
                <Options choices={MARKS} value={sim.look.marks} onPick={(marks) => setLook({ marks })} look={sim.look} gender={sim.gender} field="marks" framing="head" />
              </Section>
              <Section title="Accessoire" icon={Glasses}>
                <Options choices={ACCESSORIES} value={sim.look.accessory} onPick={(accessory) => setLook({ accessory })} look={sim.look} gender={sim.gender} field="accessory" framing="head" />
              </Section>
              {sim.look.accessory !== 'none' && (
                <Section title="Couleur de l'accessoire">
                  <ColorPicker label="Accessoire" presets={ACCESSORY_COLORS} auto={defaults.accessory} value={sim.look.accessoryColor} onChange={(accessoryColor) => setLook({ accessoryColor })} />
                </Section>
              )}
            </div>
          )}

          {current.id === 'hair' && (
            <div className="space-y-5">
              <Section title="Coupe">
                <Options choices={HAIRS} value={sim.look.hair} onPick={(hair) => setLook({ hair })} look={sim.look} gender={sim.gender} field="hair" framing="head" />
              </Section>
              <Section title="Couleur">
                <ColorPicker label="Cheveux" presets={HAIR_COLORS} value={sim.look.hairColor} onChange={(hairColor) => setLook({ hairColor })} />
              </Section>
            </div>
          )}

          {current.id === 'outfit' && (
            <div className="space-y-5">
              <Section title="Style">
                <Options choices={OUTFITS.filter((o) => femme || o.id !== 'robe')} value={sim.look.outfit} onPick={(outfit) => setLook({ outfit, ...(OUTFIT_DEFAULT_COLOR[outfit] && { outfitColor: OUTFIT_DEFAULT_COLOR[outfit] }) })} look={sim.look} gender={sim.gender} field="outfit" framing="full" />
              </Section>
              {(WAX_OUTFITS.has(sim.look.outfit) || sim.look.hair === 'headwrap') && (
                <Section title="Motif du pagne">
                  <div className="grid grid-cols-4 gap-2.5">
                    {PATTERNS.map((p) => (
                      <button key={p.id} className="tile flex flex-col items-center gap-1 p-1.5 pb-2" aria-pressed={sim.look.pattern === p.id} onClick={() => setLook({ pattern: p.id })}>
                        <span className="block aspect-square w-full rounded-xl bg-cover" style={{ backgroundImage: `url(${waxSwatch(sim.look.outfitColor, p.id)})`, backgroundSize: '100%', imageRendering: 'pixelated' }} />
                        <span className="text-[11px] font-extrabold">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}
              <Section title={WAX_OUTFITS.has(sim.look.outfit) ? 'Couleur du pagne' : 'Couleur du haut'}>
                <ColorPicker label="Haut" presets={OUTFIT_COLORS} value={sim.look.outfitColor} onChange={(outfitColor) => setLook({ outfitColor })} />
              </Section>
              {sim.look.outfit !== 'robe' && (
                <Section title={sim.look.outfit === 'pagne' && femme ? 'Couleur de la jupe' : 'Couleur du bas'}>
                  <ColorPicker label="Bas" presets={BOTTOM_COLORS} auto={defaults.bottom} value={sim.look.bottomColor} onChange={(bottomColor) => setLook({ bottomColor })} />
                </Section>
              )}
              <Section title="Couleur des chaussures">
                <ColorPicker label="Chaussures" presets={SHOE_COLORS} auto={defaults.shoe} value={sim.look.shoeColor} onChange={(shoeColor) => setLook({ shoeColor })} />
              </Section>
            </div>
          )}

          {current.id === 'traits' && (
            <div className="space-y-5">
              <Section title="Traits" right={<Chip tone={sim.traits.length === 3 ? 'good' : 'neutral'}>{sim.traits.length} / 3</Chip>}>
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
              </Section>
              <Section title="Rêve de vie">
                <div className="grid gap-2">
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
              </Section>
            </div>
          )}

          {current.id === 'home' && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[var(--color-ink-soft)]">
                {sim.firstName || 'Ton Sim'} naît bébé <b>là où tu es</b> : à la naissance, le jeu demande ta position et choisit la commune la plus proche (seule la commune est gardée, jamais ta position). Sans position, ou loin des villes du jeu, c'est quelque part à Abidjan. Puis {sim.firstName || 'ton Sim'} grandit : enfant à 3 ans, ado à 12, adulte à 18 (une année de jeu dure 8 heures). La famille est tirée au sort, comme dans la vraie vie, et chaque commune a ses quartiers riches et pauvres.
              </p>
              {(world.families ?? []).map((f) => (
                <div key={f.id} className="tile flex items-center gap-3 p-3">
                  <IconTile icon={iconFor(f.icon)} colors={FAMILY_COLORS[f.id] ?? ['#ffa040', '#ff6a00']} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-base leading-tight font-extrabold">{f.label}</span>
                      <span className="text-xs font-extrabold text-[var(--color-ink-soft)]">{Math.round(f.weight * 100)} % des naissances</span>
                    </div>
                    <span className="text-xs leading-snug text-[var(--color-ink-soft)]">{f.hint}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="motion-shake mx-3 mb-2 rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">{error}</p>}
        <footer className="flex gap-2 border-t border-[var(--color-line)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {step > 0 && (
            <button className="btn btn-soft shrink-0 px-4" onClick={() => setStep(step - 1)} aria-label="Étape précédente">
              <ChevronLeft size={22} strokeWidth={2.6} />
            </button>
          )}
          {last ? (
            <button className="btn btn-emerald flex-1" disabled={busy || !valid} onClick={submit}>
              Naître
            </button>
          ) : (
            <button className="btn flex-1" onClick={() => setStep(step + 1)}>
              Suivant · {STEPS[step + 1].label} <ChevronRight size={20} strokeWidth={2.8} />
            </button>
          )}
        </footer>
      </section>
      {born && <FamilyReveal family={born.family} commune={born.commune} located={born.located} name={sim.firstName} housing={world.housings.find((h) => h.id === born.family.housing)?.label ?? ''} onGo={() => navigate('/jeu', { viewTransition: true })} />}
    </div>
  )
}

/* ---------- Pieces ---------- */

/** The numbered steps across the top of the editor. */
function Stepper({ step, onStep }: { step: number; onStep: (i: number) => void }) {
  return (
    <nav className="px-3 pt-3 pb-2">
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
        <div className="h-full rounded-full bg-[var(--color-orange)] transition-[width] duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <ol className="no-scrollbar flex gap-1 overflow-x-auto">
        {STEPS.map((s, i) => {
          const done = i < step
          const here = i === step
          return (
            <li key={s.id} className="min-w-[64px] flex-1">
              <button onClick={() => onStep(i)} className={`flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition ${here ? 'bg-[#fff1e3]' : 'hover:bg-[var(--color-canvas)]'}`}>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full font-display text-sm font-extrabold transition ${here ? 'bg-[var(--color-orange)] text-white' : done ? 'bg-[var(--color-emerald)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}
                >
                  {done ? <Check size={16} strokeWidth={3.2} /> : i + 1}
                </span>
                <span className={`text-[11px] leading-none font-extrabold ${here ? 'text-[var(--color-orange)]' : 'text-[var(--color-ink-soft)]'}`}>{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Section({ title, right, icon: Icon, children }: { title: string; right?: React.ReactNode; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <span className="label flex items-center gap-1.5">
          {Icon && <Icon size={13} />}
          {title}
        </span>
        {right}
      </div>
      {children}
    </section>
  )
}

/** A grid of options, each shown as a picture of the Sim wearing it. */
function Options({ choices, value, onPick, look, gender, field, framing }: { choices: Choice[]; value: string; onPick: (id: string) => void; look: Required<Look>; gender: NewSim['gender']; field: keyof Look; framing: Framing }) {
  return (
    <div className={`grid gap-2.5 ${framing === 'full' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-4'}`}>
      {choices.map((c) => (
        <button key={c.id} className="tile flex flex-col items-center overflow-hidden pb-1.5" aria-pressed={value === c.id} onClick={() => onPick(c.id)}>
          <span className={`block w-full ${framing === 'full' ? 'aspect-[3/4]' : 'aspect-square'}`}>
            <Portrait look={{ ...look, [field]: c.id }} gender={gender} framing={framing} />
          </span>
          <span className="px-1 text-center text-[11px] leading-tight font-extrabold">{c.label}</span>
        </button>
      ))}
    </div>
  )
}

/** The other gender's picture keeps your colours. */
function randomLookFor(gender: NewSim['gender'], look: Required<Look>): Required<Look> {
  return gender === 'homme'
    ? { ...look, hair: ['headwrap', 'weave', 'bun'].includes(look.hair) ? 'short' : look.hair, outfit: look.outfit === 'robe' ? 'casual' : look.outfit, accessory: look.accessory === 'earrings' ? 'none' : look.accessory }
    : { ...look, beard: 'none' }
}

/** Nobody chooses where they start: the server draws it, we reveal it like a card. */
const FAMILY_COLORS: Record<string, [string, string]> = { debout: ['#c9a227', '#6d28d9'], late: ['#ffd54f', '#ffa000'], lagnon: ['#7ee0c3', '#0f9d8a'], poignon: ['#64b5ff', '#2a6cf0'], coule: ['#69e2a0', '#00a862'], gnambro: ['#b0a8a0', '#6b625a'] }

/** The player's position, if they share it (null otherwise, or after 10 s). */
function whereAmI(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 10000, maximumAge: 10 * 60000 },
    )
  })
}

function FamilyReveal({ family, commune, located, name, housing, onGo }: { family: Family; commune: string; located: boolean; name: string; housing: string; onGo: () => void }) {
  const colors = FAMILY_COLORS[family.id] ?? ['#ffa040', '#ff6a00']
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f1230]/70 p-4 backdrop-blur-[4px]">
      <div className="card animate-pop w-full max-w-sm overflow-hidden text-center">
        <div className="relative px-5 pt-6 pb-5 text-white" style={{ background: `radial-gradient(120% 100% at 50% 0%, ${colors[0]}, ${colors[1]})` }}>
          <div className="label !text-white/85">C'est un bébé !</div>
          <div className="mt-3 flex justify-center">
            <IconTile icon={iconFor(family.icon)} colors={['#ffffff55', '#ffffff22']} size={84} radius={28} />
          </div>
          <div className="mt-3 font-display text-[30px] leading-none font-extrabold">Famille {family.label.toLowerCase()}</div>
          <p className="mt-2 text-sm leading-snug font-bold text-white/95">{family.hint}</p>
        </div>
        <ul className="space-y-2 p-4 text-left">
          <Fact label="Né·e à" value={commune} />
          {!located && <li className="px-1 text-xs font-bold text-[var(--color-ink-soft)]">Position non partagée : naissance quelque part à Abidjan.</li>}
          <Fact label="Le quartier" value={family.sector.charAt(0).toUpperCase() + family.sector.slice(1)} />
          <Fact label="La maison familiale" value={housing} />
          <Fact label="Argent de poche" value={family.pocket ? `${amount(family.pocket)} F le samedi` : 'Rien'} />
          <Fact label="À 18 ans" value={`${amount(family.start)} F pour démarrer`} />
        </ul>
        <div className="px-4 pb-4">
          <button className="btn w-full" onClick={onGo}>
            Bienvenue au monde, {name} !
          </button>
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5">
      <span className="text-sm font-extrabold text-[var(--color-ink-soft)]">{label}</span>
      <span className="text-right font-display text-base font-extrabold">{value}</span>
    </li>
  )
}
