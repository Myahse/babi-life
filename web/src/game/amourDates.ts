import { t } from '../lib/i18n'
import type { Choice, DateKindId, Reaction } from './amour'

// La vie amoureuse's dates (game/amour.ts; backend game/amour.go DateKinds, the same order): their moments,
// what the partner says at each (the server only keeps which answer each calls for), what the player
// answers, how the partner takes it. Loaded with the date's scene and « Mon cœur » only, out of the game's
// main code.

/** One moment: the partner's line (two to draw from), the answer it calls for, the one that falls flat. */
type Beat = { lines: () => string[]; best: Choice; bad: Choice }
export type DateKind = { id: DateKindId; place: 'maquis' | 'lagune' | 'mall'; set: 'maquis' | 'lagune' | 'terrasse'; mood: string; title: () => string; label: () => string; beats: Beat[] }

export const DATE_KINDS: Record<DateKindId, DateKind> = {
  'rdv-maquis': {
    id: 'rdv-maquis',
    place: 'maquis',
    set: 'maquis',
    mood: '',
    title: () => t('Notre soirée au maquis'),
    label: () => t('Dîner au maquis'),
    beats: [
      { lines: () => [t('Le garba ici là, c’est le meilleur de Yop dèh ! Goûte seulement.'), t('Regarde le poulet braisé qui arrive… Je vais tout manger, hein !')], best: 'blague', bad: 'ecouter' },
      { lines: () => [t('Aujourd’hui au travail, mon chef m’a encore fatigué·e… Je peux te raconter ?'), t('Ma maman m’a appelé·e ce matin, elle demande de tes nouvelles…')], best: 'ecouter', bad: 'blague' },
      { lines: () => [t('Tu sais, avec toi je me sens bien. C’est rare, ça.'), t('Tu as vu comment les gens nous regardent ? On est beaux ensemble, non ?')], best: 'mot', bad: 'ecouter' },
      { lines: () => [t('Écoute, c’est notre chanson qui passe ! Tu te rappelles ?'), t('Le DJ a mis du zouglou… On reste encore un peu ?')], best: 'mot', bad: 'blague' },
    ],
  },
  'rdv-lagune': {
    id: 'rdv-lagune',
    place: 'lagune',
    set: 'lagune',
    mood: 'dore',
    title: () => t('Notre coucher de soleil sur la lagune'),
    label: () => t('Balade au coucher du soleil'),
    beats: [
      { lines: () => [t('Regarde le soleil sur l’eau… On dirait de l’or.'), t('Le Plateau qui brille de l’autre côté… C’est beau, Babi, hein ?')], best: 'mot', bad: 'blague' },
      { lines: () => [t('Je peux te dire un secret ? J’ai peur de l’avenir, des fois…'), t('Quand j’étais petit·e, je venais ici avec mon papa…')], best: 'ecouter', bad: 'blague' },
      { lines: () => [t('Regarde la pirogue là-bas ! Le pêcheur a failli tomber, hihi.'), t('Un moustique m’a piqué·e… Ils m’aiment trop, eux aussi !')], best: 'blague', bad: 'ecouter' },
      { lines: () => [t('Reste comme ça un moment… Juste toi et moi.'), t('Le soleil est parti. Mais toi tu es encore là.')], best: 'mot', bad: 'blague' },
    ],
  },
  'rdv-glace': {
    id: 'rdv-glace',
    place: 'mall',
    set: 'terrasse',
    mood: '',
    title: () => t('Notre glace au centre commercial'),
    label: () => t('Une glace au centre commercial'),
    beats: [
      { lines: () => [t('Coco ou chocolat ? Non, les deux ! On partage ?'), t('Moi je prends vanille-bissap. Ne te moque pas !')], best: 'blague', bad: 'ecouter' },
      { lines: () => [t('Oh non, la glace a coulé sur mon menton…'), t('Aïe, c’est froid ! Mes dents !')], best: 'blague', bad: 'mot' },
      { lines: () => [t('Tu vois la robe dans la vitrine ? Un jour je vais me l’acheter…'), t('Mon rêve c’est d’ouvrir ma boutique, ici même.')], best: 'ecouter', bad: 'blague' },
      { lines: () => [t('La dernière cuillère… elle est pour toi.'), t('Merci pour aujourd’hui. C’était doux.')], best: 'mot', bad: 'blague' },
    ],
  },
}

/** What the player says, each answer (a few to draw from). */
export const CHOICE_LINES: Record<Choice, () => string[]> = {
  mot: () => [t('Tu es magnifique ce soir, tu sais ?'), t('Avec toi, tout est doux.'), t('Mon cœur bat fort quand tu es là.')],
  blague: () => [t('Attention, je vais te voler ta part, hein !'), t('Toi tu es pire qu’un gbaka : toujours en retard !'), t('On dirait un film de Nollywood, nous deux.')],
  cadeau: () => [t('Ferme les yeux… j’ai un petit quelque chose pour toi.')],
  ecouter: () => [t('Raconte-moi tout, je t’écoute.'), t('Prends ton temps, je suis là.'), t('Hmm… et après ?')],
}

/** The partner's answer to how it went (touched: by what touched them). */
export function reactLines(r: Reaction, c: Choice): string[] {
  if (r === 'match')
    return {
      mot: [t('Awww… toi là ! ❤'), t('Tu sais trouver les mots, hein…'), t('C’est pour ça que je t’aime.')],
      blague: [t('Hahaha ! Toi tu es trop fort·e ❤'), t('Arrête, je vais m’étouffer de rire !')],
      ecouter: [t('Merci de m’écouter… ça fait du bien ❤'), t('Avec toi, je peux tout dire.')],
      cadeau: [t('Pour moi ? Oh mon cœur… ❤')],
    }[c]
  if (r === 'fine') return [t('Hihi, toi alors !'), t('Mm, c’est gentil.'), t('Tu es drôle, toi.')]
  return [t('Hmm… ce n’est pas le moment, hein.'), t('Tu ne m’écoutes pas, toi…'), t('Pfff…')]
}

/** The answer a love language loves at any moment (backend game/amour.go langChoice). */
const LANG_CHOICE: Record<string, Choice | undefined> = { mots: 'mot', cadeaux: 'cadeau', temps: 'ecouter', rire: 'blague' }

/** How the partner takes an answer (the server's rule: game.React). */
export function react(beat: Beat, choice: Choice, lang?: string): Reaction {
  if (choice === beat.best) return 'match'
  if (choice === beat.bad) return 'wrong'
  if (lang && LANG_CHOICE[lang] === choice) return 'match'
  return 'fine'
}

/** Picks one of a few lines, the same for the same seed. */
export const pickLine = (lines: string[], seed: number) => lines[Math.abs(Math.floor(seed)) % lines.length]
