import { useSyncExternalStore } from 'react'
import type { Friend, Mood, Relation, Sim } from '../lib/types'
import { skillLevelOf, skillXP } from './rules'
import { t as tr } from '../lib/i18n'

// Le mode vie's next pillars on the phone (the update « mode-vie », backend game/vie.go, sims/vie.go): the
// moods, the skills and the relationships the server keeps, as the HUD shows them (components/LifePanels.tsx),
// and what the wheel may offer someone (socialsFor, the server's own rules mirrored: it refuses the rest).

/** The skills (backend game/vie.go Skills), in the panel's order. */
export const SKILLS: { id: string; label: string; icon: string; hint: string; colors: [string, string] }[] = [
  { id: 'cuisine', label: tr('Cuisine'), icon: 'cooking-pot', hint: tr('À la gazinière : attiéké, kédjénou…'), colors: ['#ffb347', '#ff7a00'] },
  { id: 'charisme', label: tr('Charisme'), icon: 'sparkles', hint: tr('Devant le miroir, et en causant avec les gens'), colors: ['#ff8fb1', '#e0245e'] },
  { id: 'forme', label: tr('Forme'), icon: 'dumbbell', hint: tr('La salle de sport, le footing, les pompes, le foot'), colors: ['#7ee0a1', '#1f9d55'] },
  { id: 'bricolage', label: tr('Bricolage'), icon: 'hammer', hint: tr('Réparer, ranger, faire le ménage'), colors: ['#c3a27a', '#7a5233'] },
  { id: 'musique', label: tr('Musique'), icon: 'music', hint: tr('Le balafon à la maison'), colors: ['#b39dff', '#6d4aff'] },
  { id: 'logique', label: tr('Logique'), icon: 'brain', hint: tr('Les dames, les devoirs, les cours'), colors: ['#8fd3ff', '#2b7bd6'] },
  { id: 'danse', label: tr('Danse'), icon: 'disc-3', hint: tr('Le coupé-décalé au maquis, en soirée, dans la rue'), colors: ['#ffd54f', '#ffa000'] },
]
export const skillById = (id: string) => SKILLS.find((s) => s.id === id)

/** The home's actions that train a skill (backend game/vie.go SkillOf): free will does them when all is well. */
export const SKILL_ACTS = new Set(['cook-attieke', 'cuisiner-kedjenou', 'miroir-discours', 'pompes', 'footing', 'entrainement-intense', 'bricoler', 'faire-menage', 'jouer-balafon', 'concert-salon', 'jouer-dames', 'devoirs'])

/** A skill's level and how far to the next (0..1). */
export function skillProgress(xp: number) {
  const level = skillLevelOf(xp)
  if (level >= 10) return { level, share: 1 }
  const [a, b] = [skillXP(level), skillXP(level + 1)]
  return { level, share: (xp - a) / Math.max(1, b - a) }
}

/** The career's skill a promotion asks for (backend game/vie.go CareerSkill, PromotionSkill). */
export const CAREER_SKILL: Record<string, string> = {
  bureau: 'logique', droit: 'logique', mairie: 'charisme', enseignement: 'logique', sante: 'logique', pharmacie: 'logique',
  maquis: 'cuisine', hotellerie: 'cuisine', commerce: 'charisme', vente: 'charisme', caisse: 'charisme', coiffure: 'charisme',
  ambiance: 'danse', transport: 'bricolage', police: 'forme', 'maitre-nageur': 'forme', aerien: 'charisme',
}
export const promotionSkill = (to: number) => (to <= 1 ? 0 : 2 * (to - 1))

/** The mood's colour (the pin over the head, the HUD button): green to red, as the needs' colours go. */
export const MOOD_COLORS: Record<Mood['level'], string> = { ravi: '#00b86b', heureux: '#5cc93b', bien: '#f2c200', contrarie: '#ff8a1f', mal: '#ff3d57' }
export const moodColor = (m?: Mood | null) => (m ? MOOD_COLORS[m.level] : null)

/** The relationship statuses, as the panel names them. */
export const STATUS: Record<Relation['status'], { label: string; color: string }> = {
  partenaire: { label: tr('Partenaire'), color: '#e0245e' },
  'meilleur-ami': { label: tr('Meilleur·e ami·e'), color: '#1f9d55' },
  ami: { label: tr('Ami·e'), color: '#2b7bd6' },
  connaissance: { label: tr('Connaissance'), color: '#7a8099' },
  ennemi: { label: tr('Ennemi·e'), color: '#1d1f2b' },
}
export function statusOf(friendship: number, enemy?: boolean, partner?: boolean): Relation['status'] {
  if (partner) return 'partenaire'
  if (enemy) return 'ennemi'
  if (friendship >= 80) return 'meilleur-ami'
  if (friendship >= 40) return 'ami'
  return 'connaissance'
}

/** What can be said or done with someone (backend game/vie.go Socials), with what it asks of the relationship. */
type Social = { topic: string; label: string; icon: string; minF?: number; minR?: number; known?: boolean; adult?: boolean; bad?: boolean }
const SOCIALS: Social[] = [
  { topic: 'salut', label: tr('Saluer'), icon: 'hand' },
  { topic: 'blague', label: tr('Lancer une blague'), icon: 'laugh' },
  { topic: 'compliment', label: tr('Faire un compliment'), icon: 'sparkles' },
  { topic: 'gbairai', label: tr('Faire le gbairai'), icon: 'messages-square', known: true, minF: 15 },
  { topic: 'chambrer', label: tr('Chambrer'), icon: 'smile', known: true, minF: 25 },
  { topic: 'confier', label: tr('Se confier'), icon: 'messages-square', known: true, minF: 40 },
  { topic: 'calin', label: tr('Faire un câlin'), icon: 'heart', known: true, minF: 40 },
  { topic: 'drague', label: tr('Flirter'), icon: 'heart', known: true, adult: true, minF: 25 },
  { topic: 'embrasser', label: tr('Embrasser'), icon: 'heart', known: true, adult: true, minR: 60 },
  { topic: 'sortir', label: tr('Lui demander de sortir ensemble'), icon: 'heart', known: true, adult: true, minR: 40 },
  { topic: 'excuser', label: tr("S'excuser"), icon: 'hand-heart', known: true },
  { topic: 'disputer', label: tr('Se disputer'), icon: 'frown', known: true, bad: true },
]

/** A topic's label and icon (the wheel with another player: backend sims/playersocial.go decides what's offered). */
export const socialOf = (topic: string) => SOCIALS.find((x) => x.topic === topic)

/** A friend's gauges (a partner from before the gauges: their romance high already), as the server reads them. */
export const relOf = (f?: Friend) => ({ friendship: f?.friendship ?? 0, romance: f?.romance || (f?.partner ? 60 : 0), enemy: !!f?.enemy })

/** Why this can't be said now ('' if it can), as the server decides (game.SocialWhy). */
function why(x: Social, f: Friend | undefined, adults: boolean) {
  const r = relOf(f)
  if (x.adult && !adults) return tr('Entre adultes seulement')
  if (x.known && !f) return tr('Vous ne vous connaissez pas encore : discute d\'abord')
  if (r.enemy && !['excuser', 'disputer', 'salut'].includes(x.topic)) return tr('Vous êtes fâché·e·s : excuse-toi d\'abord')
  if (r.friendship < (x.minF ?? 0)) return (x.minF ?? 0) >= 40 ? tr('Il faut être ami·e·s') : tr('Vous ne vous connaissez pas assez')
  if (r.romance < (x.minR ?? 0)) return tr("Pas encore assez d'attirance")
  return ''
}

/** The wheel's social choices for someone met (a friend, or a stranger): those that can be said now, the closest first. */
export function socialsFor(f: Friend | undefined, adults: boolean, partnered: boolean) {
  const out: { topic: string; label: string; icon: string; bad?: boolean }[] = []
  for (const x of SOCIALS) {
    if (why(x, f, adults)) continue
    if (x.topic === 'sortir' && f?.partner) continue
    if (x.topic === 'excuser' && !(f?.enemy || (f && f.friendship < 40))) continue
    // (Flirting while together with someone is possible, the server says what comes of it.)
    if (x.topic === 'drague' && partnered && f?.partner) continue
    out.push(x)
  }
  // The deep ones first (to the wheel's top).
  const rank = (t: string) => {
    const i = ['excuser', 'embrasser', 'sortir', 'confier', 'calin', 'drague'].indexOf(t)
    return i < 0 ? 99 : i
  }
  return out.sort((a, b) => rank(a.topic) - rank(b.topic)).slice(0, 7)
}

/** The skill pops (« +cuisine ») and the HUD's open panel: a store, as the 3D canvas and the HUD both read it. */
type State = { pops: { key: number; skill: string; level?: number }[]; panel: 'mood' | 'skills' | 'relations' | 'envies' | null }
let state: State = { pops: [], panel: null }
const subs = new Set<() => void>()
const set = (s: Partial<State>) => {
  state = { ...state, ...s }
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))
export const useVie = () => useSyncExternalStore(subscribe, () => state)
export const openPanel = (panel: State['panel']) => set({ panel: state.panel === panel ? null : panel })
let popKey = 1

/** A new Sim from the server: the skills that rose since the last one pop over the HUD (a level reached, bigger). */
export function skillsRose(before: Sim | null | undefined, after: Sim) {
  const a = before?.life?.skills ?? {}
  const b = after.life?.skills ?? {}
  if (!before || before.id !== after.id) return
  const pops = [...state.pops]
  for (const [k, v] of Object.entries(b)) {
    const was = a[k] ?? 0
    if (v <= was) continue
    const [l0, l1] = [skillLevelOf(was), skillLevelOf(v)]
    pops.push({ key: popKey++, skill: k, level: l1 > l0 ? l1 : undefined })
  }
  if (pops.length !== state.pops.length) {
    set({ pops: pops.slice(-3) })
    const keys = pops.map((p) => p.key)
    setTimeout(() => set({ pops: state.pops.filter((p) => !keys.includes(p.key)) }), 2600)
  }
}
