import type { HeirKind, HeirOption, Look, Sim } from '../lib/types'
import { kidLook } from './famille'
import { t as tr } from '../lib/i18n'

// L'héritage (the update « heritage », backend game/heritage.go and sims/heritage.go decide all of it): the
// keys, what the jalons, the heirs and the family tiers are called, and the heir's look (drawn from its seed
// with the parent's skin, the same on every phone: the server checks the look it's sent).

export const HERITAGE_KEY = 'heritage'
export const FAMILLE_APP_KEY = 'app:famille'

/** The heir's look, as « Ma famille » and the ceremony draw it (and the passation sends). */
export const heirLook = (h: Pick<HeirOption, 'seed' | 'gender'> & { parentLook?: Look }, parent: Look) => kidLook(h, h.parentLook ?? parent)

/** What a jalon is called (backend game.Jalons; the server's label is French, this is the catalogue's). */
export function jalonLabel(id: string): string {
  switch (id) {
    case 'proprietaire':
      return tr('Propriétaire')
    case 'patron':
      return tr('Patron')
    case 'fortune':
      return tr('Fortune')
    case 'respecte':
      return tr('Respecté·e')
  }
  return tr('Famille')
}

/** How a jalon is met (backend game.Jalons). */
export function jalonHint(id: string): string {
  switch (id) {
    case 'proprietaire':
      return tr('Un terrain, ou ta propre maison.')
    case 'patron':
      return tr('Un immeuble, un bâtiment de ton quartier au niveau 2, ou le niveau 4 dans ton métier.')
    case 'fortune':
      return tr('Un patrimoine d’au moins trois fois le départ de ta famille.')
    case 'respecte':
      return tr('Un mandat, ou 5 amis proches (amitié 60 et plus).')
  }
  return tr('Marié·e ou en couple à la maison, et 2 enfants.')
}

/** A feat of the generation (backend game.FeatLabel). */
export function featLabel(kind: string, detail: string): string {
  if (kind === 'mandat') return ({ maire: tr('Élu·e maire'), depute: tr('Député·e'), ministre: tr('Ministre'), president: tr('Président·e de la République') } as Record<string, string>)[detail] ?? tr('Un mandat')
  if (kind === 'diplome') return detail === 'sup' ? tr('Diplôme du supérieur') : tr('Bac en poche')
  if (kind === 'carriere') return tr('Promotion au travail')
  if (kind === 'mariage') return tr('Mariage')
  return kind
}

/** Who the heir is to the parent. */
export function heirKindLabel(kind: HeirKind, gender: 'femme' | 'homme'): string {
  if (kind === 'neveu') return gender === 'femme' ? tr('Nièce') : tr('Neveu')
  if (kind === 'adopte') return gender === 'femme' ? tr('Fille adoptive') : tr('Fils adoptif')
  if (kind === 'filleul') return gender === 'femme' ? tr('Filleule') : tr('Filleul')
  return gender === 'femme' ? tr('Fille') : tr('Fils')
}

/** A family tier's name (backend game.Families). */
export function tierLabel(id: string): string {
  const m: Record<string, string> = { debout: tr('Debout'), late: tr('Laté'), lagnon: tr('Lagnon'), poignon: tr('Poignon'), coule: tr('Coulé'), gnambro: tr('Gnambro') }
  return m[id] ?? id
}

/** « 1re génération », « 2e génération »… */
export const generationLabel = (n: number) => (n <= 1 ? tr('1re génération') : tr('{n}e génération', { n }))

/** The generation shown under the name (Profil): from the second one only, the first is everyone's. */
export const generationOf = (sim: Pick<Sim, 'life'>) => (sim.life?.famille?.generation ?? 0) + 1

/** Minutes played as hours and minutes (« 3 h 20 »). */
export function playedLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  if (!h) return tr('{n} min', { n: m })
  return m % 60 ? tr('{h} h {m}', { h, m: String(m % 60).padStart(2, '0') }) : tr('{h} h', { h })
}
