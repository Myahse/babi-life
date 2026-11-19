import type { ActionResult, Look } from '../lib/types'
import { t } from '../lib/i18n'

// La vie amoureuse (the update « vie-amoureuse », backend game/amour.go, sims/amour.go): the phone's half
// that the game's main code needs (the keys, a date's id, the mots doux's cards in Gbairai). The dates'
// moments and lines are in game/amourDates.ts, loaded with the date. The server scores the answers itself.

export const AMOUR_KEY = 'vie-amoureuse'
export const COEUR_KEY = 'app:coeur'
export const isRdv = (id: string) => id.startsWith('rdv-')

export type Choice = 'mot' | 'blague' | 'cadeau' | 'ecouter'
export type Reaction = 'match' | 'fine' | 'wrong'
export type DateKindId = 'rdv-maquis' | 'rdv-lagune' | 'rdv-glace'

/** The mots doux (backend game.MotsDoux): ids only travel. */
export const MOTS_DOUX: { id: string; text: () => string }[] = [
  { id: 'bonjour', text: () => t('Bonjour mon cœur ☀️') },
  { id: 'pense', text: () => t('Je pense à toi') },
  { id: 'manque', text: () => t('Tu me manques déjà') },
  { id: 'bebe', text: () => t('Mon bébé d’amour ❤️') },
  { id: 'sourire', text: () => t('Ton sourire, c’est mon soleil') },
  { id: 'ce-soir', text: () => t('On se voit ce soir ?') },
  { id: 'bonne-nuit', text: () => t('Bonne nuit, fais de beaux rêves') },
  { id: 'fier', text: () => t('Je suis fier·e de toi') },
  { id: 'chocolat', text: () => t('Mon chocolat 🍫') },
  { id: 'pour-toujours', text: () => t('Toi et moi, c’est pour longtemps') },
]

const AMOUR_CARD = /^\[amour:([a-z0-9-]+)\]$/
/** The mot doux a message is (a card), if it's one. */
export function motOf(body: string) {
  const m = AMOUR_CARD.exec(body.trim())
  return m ? MOTS_DOUX.find((x) => x.id === m[1]) : undefined
}

export type AmourPartner = { kind: 'joueur' | 'pnj'; id: string; name: string; gender: 'femme' | 'homme'; seed?: number; look?: Look; stage: string; stageLabel: string; love: number; since: number; days: number; foyer?: boolean; lang?: string; langLabel?: string }
export type DateMemo = { kind: DateKindId; place: string; with: string; title: string; score: number; love: number; seed: number; at: number }
export type PartnerMessage = { id: number; mine: boolean; body: string; at: string }
export type AmourView = { partner: AmourPartner | null; next?: { label: string; at: number; days: number }; dates: DateMemo[]; hello?: string; thread: PartnerMessage[]; mots: number; motsMax: number; calin: boolean; calinWhy?: string; requests: number }
export type DateScore = { points: number; score: number; love: number; reactions: Reaction[] }
export type AmourResult = ActionResult & { data: AmourView }
