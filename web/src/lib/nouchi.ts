import { t as tr } from './i18n'
// How people talk in the street in Abidjan: the greetings a passer-by calls
// out, and the ones the player can choose. Picked from the seed (the same
// person greets you the same way) or at random (calling out).

/** What a passer-by calls out to the Sim, by who they're talking to and the time of day. */
export function callsFor(simGender: 'femme' | 'homme', hour: number): string[] {
  const toi = simGender === 'femme' ? [tr('Ma sœur'), tr('Ma go'), tr('Tantie'), tr('Ma chérie')] : [tr('Mon frère'), tr('Mon gars'), tr('Tonton'), tr('Le boss'), tr('Mon vié')]
  const t = toi[Math.floor(Math.random() * toi.length)]
  const time = hour < 12 ? [tr('Bonjour ! Tu as bien dormi ?'), tr('On a bien dormi ?'), tr('Bonne journée hein !')] : hour < 18 ? [tr('Bon après-midi !'), tr('Il fait chaud dèh !')] : [tr('Bonsoir !'), tr('Tu rentres déjà ?'), tr('On sort ce soir ou bien ?')]
  return [
    tr('Ça dit quoi ?'),
    tr("C'est comment ?"),
    tr("C'est comment famille ?"),
    tr('Eh fiscalité !'),
    tr('Y a fohi ?'),
    tr('Ça dit quoi ?'),
    tr('Ça va un peu ?'),
    tr('Bonne arrivée !'),
    tr('Tu es où depuis ? On te voit plus !'),
    tr('Y a quoi de neuf ?'),
    tr('Viens on cause !'),
    tr('Eh toi là ! Approche !'),
    tr('{t}, on dit quoi ?', { t }),
    tr("{t} ! C'est comment ?", { t }),
    tr('Eh {0} ! Tombe sur moi un peu !', { 0: t.toLowerCase() }),
    tr('Doucement, doucement !'),
    tr('Ça va aller hein !'),
    ...time,
  ]
}

/** What the passer-by says when you stop to talk (from their seed: always the same for them). */
export function helloFrom(seed: number, simGender: 'femme' | 'homme'): string {
  const all = [
    tr('On est là ou bien ?'),
    tr("C'est comment ?"),
    tr('Y a fohi ?'),
    tr('Ça va un peu ?'),
    tr('Bonne arrivée !'),
    tr('Ça dit quoi ?'),
    tr("C'est comment famille ?"),
    tr('Eh fiscalité !'),
    tr('Tu es dans le quartier aussi ?'),
    simGender === 'femme' ? tr('Ma sœur, on dit quoi ?') : tr('Mon frère, on dit quoi ?'),
    simGender === 'femme' ? tr('Ma go ! Ça fait longtemps !') : tr('Mon gars ! Ça fait longtemps !'),
  ]
  return all[seed % all.length]
}

/** The greetings the player can say back. */
export function greetingsFor(npcGender: 'femme' | 'homme'): string[] {
  return [tr("C'est comment ?"), tr('Ça dit quoi ?'), tr("C'est comment famille ?"), tr('Eh fiscalité !'), tr('Y a fohi ?'), npcGender === 'femme' ? tr('Bonjour tantie !') : tr('Bonjour tonton !'), tr('On dit quoi ?'), tr('Bonne arrivée !')]
}
