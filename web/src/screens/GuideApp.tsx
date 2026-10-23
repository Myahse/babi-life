import { useMemo, useState } from 'react'
import { BookOpen, Briefcase, GraduationCap, ChevronDown, Heart, MapPin, MessageSquareQuote, Navigation, Plane, Search, Smartphone, Sparkles, Users, type LucideIcon } from 'lucide-react'
import type { Interaction, World } from '../lib/types'
import { IconTile } from '../components/ui'
import { iconFor, kindColors } from '../components/icons'
import { NEEDS, duration, fcfa, openingLabel } from '../game/rules'

// « Encyclo »: the whole game in one place, searchable. Most of it is read
// from the world the server sends (places and what's done there, jobs, apps,
// words, families, flights), so it never lags behind the game; the rules are
// written here, short, the way a friend would explain them.

type Tab = 'regles' | 'activites' | 'lieux' | 'metiers' | 'applis' | 'mots' | 'familles' | 'vols'
type Entry = { id: string; tab: Tab; title: string; sub: string; body: string[]; icon: LucideIcon; colors: [string, string]; /** An activity: the kind of place it's done at (« Y aller »). */ go?: string }

const TABS: { id: Tab; label: string; icon: LucideIcon; colors: [string, string] }[] = [
  { id: 'regles', label: 'Règles', icon: BookOpen, colors: ['#b39dff', '#6c47ff'] },
  { id: 'activites', label: 'Activités', icon: Sparkles, colors: ['#ffd36e', '#ff8a3d'] },
  { id: 'lieux', label: 'Lieux', icon: MapPin, colors: ['#ffa040', '#ff6a00'] },
  { id: 'metiers', label: 'Métiers', icon: Briefcase, colors: ['#64b5ff', '#2a6cf0'] },
  { id: 'applis', label: 'Applis', icon: Smartphone, colors: ['#69e2a0', '#00a862'] },
  { id: 'mots', label: 'Mots de Babi', icon: MessageSquareQuote, colors: ['#ff8a65', '#e8590c'] },
  { id: 'familles', label: 'Familles', icon: Users, colors: ['#ffa8c5', '#e83e8c'] },
  { id: 'vols', label: 'Vols', icon: Plane, colors: ['#4dd8e6', '#0097c4'] },
]
const tabOf = (t: Tab) => TABS.find((x) => x.id === t)!

const RULES: { title: string; sub: string; body: string[]; icon?: LucideIcon }[] = [
  {
    title: 'Le temps',
    sub: 'Le jeu vit en temps réel',
    body: [
      "Une heure du jeu, c'est une heure de ta vraie vie : il fait nuit dans le jeu quand il fait nuit à Abidjan.",
      "Les activités, elles, vont plus vite : une douche ou une journée de travail ne te prennent que quelques vraies minutes.",
      "Quand tu fermes le jeu (ou qu'il passe derrière une autre appli), la vie de ton perso se met en pause : ce qu'il faisait attend ton retour, ses besoins, son argent et son âge ne bougent plus. L'heure, elle, continue pour tout le monde.",
    ],
  },
  {
    title: 'Les besoins',
    sub: NEEDS.map((n) => n.label).join(', '),
    body: [
      `Ton perso a cinq besoins : ${NEEDS.map((n) => n.label.toLowerCase()).join(', ')}. Ils baissent avec le temps.`,
      "Manger remplit la faim, dormir l'énergie, la douche l'hygiène, parler aux gens le social, sortir et jouer les loisirs.",
      "Des besoins bas, et l'humeur tombe : ton perso travaille moins bien et refuse certaines choses.",
    ],
  },
  {
    title: "L'argent",
    sub: 'Le Djai, la monnaie du jeu',
    body: [
      "On gagne des Djai en travaillant (l'appli Boulot), en vendant, en pariant (avec prudence), ou par ta famille quand tu es jeune.",
      "Le loyer et les remboursements de prêt tombent chaque samedi à minuit. Sans assez d'argent, les dettes s'accumulent.",
      "Envoie de l'argent à tes amis avec Waye.",
    ],
  },
  {
    title: 'Grandir',
    sub: 'Bébé, enfant, ado, adulte',
    body: [
      "Ton perso naît bébé et grandit vite au début : l'enfance passe en quelques heures de jeu.",
      "Chaque âge ouvre de nouvelles choses : l'école, le boulot, le logement à soi, l'amour.",
      "À chaque anniversaire, ta famille te donne un peu d'argent de poche.",
    ],
  },
  {
    title: 'Se déplacer',
    sub: 'À pied, moto-taxi, taxi, car, avion',
    body: [
      "À pied, c'est gratuit. Pour un long chemin, un moto-taxi te propose de t'emmener : c'est plus rapide, mais ça se paie selon la distance.",
      "Entre les communes : woro-woro, taxi compteur ou les applis de VTC. Entre les villes : le car, ou l'avion depuis l'aéroport.",
    ],
  },
  {
    title: 'Les gens',
    sub: 'Parler, devenir ami·es',
    body: [
      "Tu peux parler à tout le monde : les passant·es, les vendeur·ses, les gens au maquis, même pendant qu'ils font autre chose.",
      "Bien parler, c'est se faire des ami·es. Tes ami·es publient sur Tikitoko et Babigram, et tu peux les inviter à sortir (ciné, maquis, plage…).",
      "Avec les autres joueur·ses, demande-les en ami·e depuis l'appli Amis, invite-les à une activité, écris-leur sur Gbairai.",
    ],
    icon: Users,
  },
  {
    title: "L'amour",
    sub: 'Entre adultes seulement',
    body: [
      "Adulte, tu peux flirter et te mettre en couple avec quelqu'un du jeu, ou avec un·e autre joueur·se (dans l'appli Amis, si vous êtes ami·es et adultes tous les deux).",
      "Tromper son ou sa partenaire, c'est possible… mais le quartier parle : si ça se sait, l'amitié en prend un coup, et ça peut finir en rupture.",
    ],
    icon: Heart,
  },
  {
    title: 'Les terrains',
    sub: 'Basket et foot entre joueur·ses',
    body: [
      "Aux terrains, rejoins un match avec les autres joueur·ses présent·es. Le joystick te déplace, les boutons servent à passer et tirer.",
      "Dans la rue, le terrain et le playground du quartier : approche-toi et touche « Jouer avec les gars ». Ils te prennent dans leur partie, gratuitement, de 6 h à 23 h.",
    ],
  },
]

const priceOf = (it: Interaction) => (it.cost ? fcfa(it.cost) : 'gratuit')
/** An activity's hours, who can do it, what it fills. */
function activityLines(it: Interaction): string[] {
  const gives = NEEDS.filter((n) => (it.effect?.[n.key] ?? 0) !== 0).map((n) => `${n.label} ${it.effect![n.key]! > 0 ? '+' : ''}${Math.round(it.effect![n.key]!)}`)
  return [
    `${priceOf(it) === 'gratuit' ? 'Gratuit' : `Prix : ${priceOf(it)}`} · durée : ${duration(it.minutes)}${it.minHour || it.maxHour || it.days?.length ? ` · ${openingLabel(it)}` : ''}.`,
    gives.length ? `Ça donne : ${gives.join(', ')}.` : '',
    it.ages?.length ? `Pour : ${it.ages.join(', ')}.` : '',
  ]
}

/** Lowercase, no accents: « Écoles » is found by « ecole ». */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function entries(world: World): Entry[] {
  const out: Entry[] = []
  RULES.forEach((r, i) => out.push({ id: `r${i}`, tab: 'regles', title: r.title, sub: r.sub, body: r.body, icon: r.icon ?? tabOf('regles').icon, colors: tabOf('regles').colors }))
  const count: Record<string, number> = {}
  world.cities.forEach((c) => c.communes.forEach((cm) => cm.places.forEach((p) => (count[p.kind] = (count[p.kind] ?? 0) + 1))))
  Object.values(world.kinds).forEach((k) => {
    if (!k.interactions.length) return
    const n = count[k.id] ?? 0
    out.push({
      id: `k-${k.id}`,
      tab: 'lieux',
      title: k.label,
      sub: `${k.interactions.length} activité${k.interactions.length > 1 ? 's' : ''}${n ? ` · ${n} lieu${n > 1 ? 'x' : ''} dans le jeu` : ''}`,
      body: k.interactions.map((it) => `${it.label} — ${it.cost ? fcfa(it.cost) : 'gratuit'} · ${duration(it.minutes)}${it.minHour || it.maxHour || it.days?.length ? ` · ${openingLabel(it)}` : ''}`),
      icon: iconFor(k.icon),
      colors: kindColors(k.id),
    })
  })
  // Every activity of the game, one by one: where it's done, its price, its time, its hours, what it gives.
  Object.values(world.kinds).forEach((k) =>
    k.interactions.forEach((it) => {
      const n = count[k.id] ?? 0
      out.push({ id: `x-${k.id}-${it.id}`, tab: 'activites', title: it.label, sub: `${k.label} · ${priceOf(it)} · ${duration(it.minutes)}`, body: [`Où : ${k.label}${n ? ` (${n} sur la carte)` : ''}.`, ...activityLines(it)], icon: iconFor(it.icon), colors: kindColors(k.id), go: k.id })
    }),
  )
  ;(world.street ?? []).forEach(({ interaction: it, place }) =>
    out.push({ id: `x-rue-${it.id}`, tab: 'activites', title: it.label, sub: `Dans la rue · ${priceOf(it)} · ${duration(it.minutes)}`, body: [`Où : dans la rue (${place}). Approche-toi : une bulle te propose de le faire.`, ...activityLines(it)], icon: iconFor(it.icon), colors: ['#ffd36e', '#ff8a3d'] }),
  )
  world.careers.forEach((c) => {
    const where = [c.kind, ...(c.also ?? [])].map((k) => world.kinds[k]?.label ?? k).join(', ')
    out.push({
      id: `c-${c.id}`,
      tab: 'metiers',
      title: c.label,
      sub: `${where} · ${c.minHour} h – ${c.maxHour} h`,
      body: [`Se fait à : ${where}.`, `Horaires : de ${c.minHour} h à ${c.maxHour} h.`, ...c.levels.map((l, i) => `Échelon ${i + 1} · ${l.title} : ${fcfa(l.pay)} par service`)],
      icon: iconFor(c.icon),
      colors: tabOf('metiers').colors,
    })
  })
  ;(world.phoneApps ?? []).forEach((a) => out.push({ id: `a-${a.id}`, tab: 'applis', title: a.name, sub: a.tagline, body: [a.about, `${a.category} · ${a.sizeMB} Mo${a.preinstalled ? ' · déjà sur le téléphone' : ' · dans le Store'}`], icon: Smartphone, colors: tabOf('applis').colors }))
  ;(world.rideApps ?? []).forEach((a) => out.push({ id: `v-${a.id}`, tab: 'applis', title: a.name, sub: a.model === 'fixed' ? 'VTC · prix fixé par l’appli' : 'VTC · tu proposes ton prix', body: [`Dans : ${a.cities.map((id) => world.cities.find((c) => c.id === id)?.name ?? id).join(', ')}.`, ...(a.classes ?? []).map((c) => `${c.name} : ${c.cars}. ${c.perks}`)], icon: iconFor('car'), colors: tabOf('applis').colors }))
  ;(world.expressions ?? []).forEach((e) => out.push({ id: `m-${e.id}`, tab: 'mots', title: `« ${e.text} »`, sub: `${e.lang} · ${e.meaning}`, body: [e.meaning, e.example, ...(e.context ? [e.context] : [])], icon: MessageSquareQuote, colors: tabOf('mots').colors }))
  ;(world.families ?? []).forEach((f) => out.push({ id: `f-${f.id}`, tab: 'familles', title: f.label, sub: f.hint, body: [f.hint, `Argent de poche : ${fcfa(f.pocket)} · au départ : ${fcfa(f.start)}`], icon: iconFor(f.icon), colors: tabOf('familles').colors }))
  ;(world.flights ?? []).forEach((f, i) => {
    const from = world.cities.find((c) => c.communes.some((cm) => cm.places.some((p) => p.id === f.place)))?.name ?? f.from
    out.push({ id: `fl-${i}`, tab: 'vols', title: `${from} → ${f.toName}`, sub: `Avion ${f.airline} · ${fcfa(f.fare)} · ${duration(f.minutes)}`, body: [`${Math.round(f.km)} km à vol d'oiseau, ${duration(f.minutes)} de porte à porte depuis l'aéroport.`, `Le billet : ${fcfa(f.fare)}. Tu arrives reposé·e, là où la route fatigue.`], icon: Plane, colors: tabOf('vols').colors })
  })
  return out
}

export function GuideApp({ world, onTutorial, onGo }: { world: World; /** Koffi's tuto again (components/Tutorial.tsx). */ onTutorial?: () => void; /** To the nearest place of this kind (the activities' « Y aller »). */ onGo?: (kind: string) => void }) {
  const all = useMemo(() => entries(world), [world])
  const [tab, setTab] = useState<Tab>('regles')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const query = plain(q.trim())
  // A search looks everywhere; without one, the tab.
  const shown = query ? all.filter((e) => plain([e.title, e.sub, ...e.body].join(' ')).includes(query)) : all.filter((e) => e.tab === tab)
  const present = TABS.filter((t) => all.some((e) => e.tab === t.id))
  return (
    <div className="space-y-3">
      {onTutorial && (
        <button className="flex w-full items-center gap-3 rounded-[20px] bg-gradient-to-r from-[#ffd36e] to-[#ff8a3d] p-3 text-left text-[var(--color-ink)]" onClick={onTutorial}>
          <GraduationCap size={26} strokeWidth={2.4} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-extrabold">Revoir le tuto avec Koffi</span>
            <span className="block text-[12px] font-bold">Les besoins, marcher, les lieux, le téléphone, la carte…</span>
          </span>
        </button>
      )}
      <label className="flex items-center gap-2 rounded-2xl bg-[var(--color-canvas)] px-3 py-2.5">
        <Search size={16} className="shrink-0 text-[var(--color-ink-soft)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher : maquis, loyer, avion…" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" />
      </label>
      {!query && (
        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
          {present.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${tab === t.id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {query && <p className="text-xs font-bold text-[var(--color-ink-soft)]">{shown.length ? `${shown.length} résultat${shown.length > 1 ? 's' : ''}` : 'Rien trouvé. Essaie un autre mot.'}</p>}
      {!query && tab === 'activites' && (
        <p className="text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">
          <span className="font-display text-[22px] font-extrabold text-[var(--color-ink)]">{shown.length}</span> activités dans le jeu : chaque lieu a les siennes (on les voit en y entrant), et la rue aussi. Touche-en une pour savoir où, quand et combien.
        </p>
      )}
      <ul className="space-y-2">
        {shown.map((e) => (
          <li key={e.id} className="rounded-[20px] bg-[var(--color-canvas)]">
            <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-center gap-3 p-2.5 text-left active:scale-[0.99]" aria-expanded={open === e.id}>
              <IconTile icon={e.icon} colors={e.colors} size={42} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug font-extrabold">{e.title}</span>
                <span className="block truncate text-[11px] font-bold text-[var(--color-ink-soft)]">
                  {query && `${tabOf(e.tab).label} · `}
                  {e.sub}
                </span>
              </span>
              <ChevronDown size={16} className={`shrink-0 text-[var(--color-ink-soft)] transition ${open === e.id ? 'rotate-180' : ''}`} />
            </button>
            {open === e.id && (
              <ul className="space-y-1.5 px-3 pb-3 text-[13px] leading-snug font-semibold text-[var(--color-ink)]">
                {e.body.filter(Boolean).map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-ink-soft)]" />
                    <span>{b}</span>
                  </li>
                ))}
                {e.go && onGo && (
                  <li>
                    <button className="btn mt-1 !min-h-0 w-full !py-2.5 !text-sm" onClick={() => onGo(e.go!)}>
                      <Navigation size={16} strokeWidth={2.6} /> Y aller
                    </button>
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
