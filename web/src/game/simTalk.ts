import type { Pose } from '../avatar/Human'
import type { Needs } from '../lib/types'
import { t } from '../lib/i18n'

// The player's Sim alive (world3d/Walker.tsx): what it does standing there doing nothing (looks round, its
// phone, a stretch, sits on the ground when it's worn out…), what it says (its needs, the hour, the money,
// in the street's words), and how it answers a tap on it (its mood).

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const mood = (n: Needs) => (n.hunger + n.energy + n.hygiene + n.social + n.fun) / 5

/** What it does, idle a while: its gesture and how long (seconds). */
export function idleMove(n: Needs, hour: number): { pose: Pose; seconds: number } {
  if (n.energy < 30) return { pose: 'sitground', seconds: 9 }
  if (n.hunger < 30) return { pose: 'despair', seconds: 3 }
  if (n.fun > 70 && n.social > 60 && Math.random() < 0.35)
    return pick([
      { pose: 'zouglou' as Pose, seconds: 4 },
      { pose: 'gweta' as Pose, seconds: 4 },
    ])
  if (hour >= 22 || hour < 6)
    return pick([
      { pose: 'lookup' as Pose, seconds: 4 },
      { pose: 'phone' as Pose, seconds: 6 },
    ])
  return pick([
    { pose: 'phone' as Pose, seconds: 6 },
    { pose: 'lookup' as Pose, seconds: 3.5 },
    { pose: 'shrug' as Pose, seconds: 2.5 },
    { pose: 'meditate' as Pose, seconds: 5 },
    { pose: 'flex' as Pose, seconds: 2.5 },
  ])
}

/** What it says by itself now and then: the lowest need first, else the hour, the money, its mood. */
export function idleLine(n: Needs, hour: number, money: number): string {
  const low = (['hunger', 'energy', 'hygiene', 'social', 'fun'] as const).filter((k) => n[k] < 35).sort((a, b) => n[a] - n[b])[0]
  switch (low) {
    case 'hunger':
      return pick([t('Mon ventre crie là… on va au maquis ?'), t('Un bon garba, ça me ferait du bien.'), t('J’ai faim, mon frère, faut qu’on mange.')])
    case 'energy':
      return pick([t('Je suis fatigué·e, hein… un petit somme ?'), t('Mes yeux se ferment tout seuls.'), t('On rentre dormir un peu ?')])
    case 'hygiene':
      return pick([t('Hum… je sens un peu, non ?'), t('Une bonne douche, vite !'), t('Faut que je me lave, là.')])
    case 'social':
      return pick([t('Ça fait longtemps que j’ai vu les gars…'), t('On va causer un peu au maquis ?'), t('Je m’ennuie de mes amis.')])
    case 'fun':
      return pick([t('On s’ennuie trop ici, on bouge ?'), t('Allons danser un peu !'), t('Je veux m’amuser, moi.')])
  }
  if (money < 1000) return pick([t('Les poches sont vides… faut aller se chercher.'), t('Je dois trouver un petit boulot.')])
  if (hour >= 6 && hour < 10) return pick([t('Bonjour Babi ! On fait quoi aujourd’hui ?'), t('Un café d’abord, après on verra.')])
  if (hour >= 12 && hour < 14) return pick([t('C’est l’heure de manger, non ?'), t('Le soleil tape fort aujourd’hui.')])
  if (hour >= 19 && hour < 23) return pick([t('Ce soir on sort ou bien ?'), t('Les maquis commencent à chauffer.')])
  if (hour >= 23 || hour < 5) return pick([t('Il se fait tard…'), t('La nuit est calme ce soir.')])
  return mood(n) > 70 ? pick([t('Ça va bien aujourd’hui !'), t('Babi est doux, hein.'), t('On est bien, on est bien.')]) : pick([t('On fait quoi maintenant ?'), t('Je me cherche un peu.')])
}

/** A tap on it: it turns to you and answers, by its mood. */
export function tapAnswer(n: Needs, name: string): { pose: Pose; line: string } {
  const m = mood(n)
  if (n.hunger < 30) return { pose: 'despair', line: t('Laisse-moi, j’ai trop faim ! 😩') }
  if (n.energy < 30) return { pose: 'shrug', line: t('Je suis K.O., là…') }
  if (m > 70)
    return pick([
      { pose: 'coucou' as Pose, line: t('Eh ! C’est moi, {name} !', { name }) },
      { pose: 'laugh' as Pose, line: t('Arrête, ça chatouille ! 😂') },
      { pose: 'dab' as Pose, line: t('On est ensemble !') },
      { pose: 'thumbsup' as Pose, line: t('Tout va bien, chef !') },
    ])
  if (m > 45)
    return pick([
      { pose: 'coucou' as Pose, line: t('Oui ? On va où ?') },
      { pose: 'shrug' as Pose, line: t('Je t’écoute.') },
    ])
  return pick([
    { pose: 'facepalm' as Pose, line: t('Ça ne va pas trop aujourd’hui…') },
    { pose: 'cry' as Pose, line: t('Occupe-toi un peu de moi…') },
  ])
}

/** Coming back to the game: hello. */
export const welcomeBack = (name: string) => pick([t('Te voilà ! Tu m’as manqué.'), t('Ah, tu es revenu·e ! On fait quoi ?'), t('{name} est prêt·e !', { name })])
