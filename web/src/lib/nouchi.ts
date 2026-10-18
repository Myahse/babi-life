// How people talk in the street in Abidjan: the greetings a passer-by calls
// out, and the ones the player can choose. Picked from the seed (the same
// person greets you the same way) or at random (calling out).

/** What a passer-by calls out to the Sim, by who they're talking to and the time of day. */
export function callsFor(simGender: 'femme' | 'homme', hour: number): string[] {
  const toi = simGender === 'femme' ? ['Ma sœur', 'Ma go', 'Tantie', 'Ma chérie'] : ['Mon frère', 'Mon gars', 'Tonton', 'Le boss', 'Mon vié']
  const t = toi[Math.floor(Math.random() * toi.length)]
  const time = hour < 12 ? ['Bonjour ! Tu as bien dormi ?', 'On a bien dormi ?', 'Bonne journée hein !'] : hour < 18 ? ['Bon après-midi !', 'Il fait chaud dèh !'] : ['Bonsoir !', 'Tu rentres déjà ?', 'On sort ce soir ou bien ?']
  return [
    'Ça dit quoi ?',
    "C'est comment ?",
    "C'est comment famille ?",
    'Eh fiscalité !',
    'Y a fohi ?',
    'Ça dit quoi ?',
    'Ça va un peu ?',
    'Bonne arrivée !',
    'Tu es où depuis ? On te voit plus !',
    'Y a quoi de neuf ?',
    'Viens on cause !',
    'Eh toi là ! Approche !',
    `${t}, on dit quoi ?`,
    `${t} ! C'est comment ?`,
    `Eh ${t.toLowerCase()} ! Tombe sur moi un peu !`,
    'Doucement, doucement !',
    'Ça va aller hein !',
    ...time,
  ]
}

/** What the passer-by says when you stop to talk (from their seed: always the same for them). */
export function helloFrom(seed: number, simGender: 'femme' | 'homme'): string {
  const all = [
    'On est là ou bien ?',
    "C'est comment ?",
    'Y a fohi ?',
    'Ça va un peu ?',
    'Bonne arrivée !',
    'Ça dit quoi ?',
    "C'est comment famille ?",
    'Eh fiscalité !',
    'Tu es dans le quartier aussi ?',
    simGender === 'femme' ? 'Ma sœur, on dit quoi ?' : 'Mon frère, on dit quoi ?',
    simGender === 'femme' ? 'Ma go ! Ça fait longtemps !' : 'Mon gars ! Ça fait longtemps !',
  ]
  return all[seed % all.length]
}

/** The greetings the player can say back. */
export function greetingsFor(npcGender: 'femme' | 'homme'): string[] {
  return ["C'est comment ?", 'Ça dit quoi ?', "C'est comment famille ?", 'Eh fiscalité !', 'Y a fohi ?', npcGender === 'femme' ? 'Bonjour tantie !' : 'Bonjour tonton !', 'Ça dit quoi ?', 'Bonne arrivée !']
}
