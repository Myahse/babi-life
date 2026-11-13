import type { Pose } from '../../../avatar/Human'
import { t } from '../../../lib/i18n'

// L'armée (update « armee », backend game/armee.go): the getting ready before each drill, the EMPT's day,
// the career's missions: the salute, the boots laced, the pack on the back (components/defi/Gestes.tsx).

export const RECIPES_ARMEE: Record<string, [string, Pose][]> = {
  'service-engager': [
    [t('Saluer le sergent recruteur'), 'salute'],
    [t('Signer l’engagement'), 'write'],
  ],
  'armee-engager': [
    [t('Saluer l’officier'), 'salute'],
    [t('Signer le contrat d’engagement'), 'write'],
  ],
  'caserne-couleurs': [
    [t('Se mettre au garde-à-vous'), 'salute'],
    [t('Saisir la drisse'), 'hand'],
  ],
  'caserne-parcours': [
    [t('Lacer les rangers'), 'busy'],
    [t('S’échauffer'), 'flex'],
  ],
  'caserne-garde': [
    [t('Prendre la relève à la guérite'), 'salute'],
    [t('Allumer la lampe'), 'hand'],
  ],
  'caserne-marche': [
    [t('Charger le sac à dos'), 'carry'],
    [t('Se mettre en rang'), 'salute'],
  ],
  'caserne-ordinaire': [
    [t('Se laver les mains'), 'wash'],
    [t('Prendre son plateau'), 'hand'],
  ],
  'caserne-dortoir': [
    [t('Plier le treillis'), 'shelve'],
    [t('Tendre le drap'), 'busy'],
  ],
  'empt-concours-ecrit': [
    [t('Montrer sa convocation'), 'hand'],
    [t('S’asseoir à sa table'), 'write'],
  ],
  'empt-concours-physique': [
    [t('Mettre sa tenue de sport'), 'busy'],
    [t('S’échauffer'), 'flex'],
  ],
  'empt-rassemblement': [
    [t('Se mettre en rang'), 'salute'],
    [t('Saisir la drisse'), 'hand'],
  ],
  'empt-cours': [
    [t('Saluer le professeur'), 'salute'],
    [t('Ouvrir son cahier'), 'write'],
  ],
  'empt-atelier': [
    [t('Mettre le bleu de travail'), 'busy'],
    [t('Sortir les outils'), 'shelve'],
  ],
  'empt-sport': [
    [t('Lacer ses baskets'), 'busy'],
    [t('S’échauffer'), 'flex'],
  ],
  'empt-refectoire': [
    [t('Se laver les mains'), 'wash'],
    [t('Prendre son plateau'), 'hand'],
  ],
  'empt-dortoir': [
    [t('Ranger son casier'), 'shelve'],
    [t('Tendre le drap'), 'busy'],
  ],
}
