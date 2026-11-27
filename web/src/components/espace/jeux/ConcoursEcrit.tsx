import { useMemo } from 'react'
import { Quiz } from '../../defi/jeux/engines/Quiz'
import type { Jeu, Question } from '../../defi/jeux/types'
import { t as tr } from '../../../lib/i18n'

// Le concours Astrélia, l'écrit (backend game/espaceCarriere.go: astrelia-concours-ecrit), on the EMPT's
// pattern (its written, a quiz): physics, maths, English, three questions drawn from each bank, twenty seconds
// each, the jury's examiner behind the desk; 50 to pass. The same desk for the training's « systèmes de la
// Pirogue » (module-systemes), five questions from its own bank.

const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v)

const BANKS = (): Record<'physique' | 'maths' | 'anglais' | 'systemes', Question[]> => ({
  physique: [
    [tr('Sur la Lune, ton poids est environ…'), [tr('6 fois plus petit'), tr('le même'), tr('2 fois plus grand')], 0],
    [tr('La vitesse se mesure en…'), [tr('m/s'), tr('kg'), tr('newtons')], 0],
    [tr('Ce qui fait monter une fusée, c’est…'), [tr('la réaction des gaz éjectés'), tr('l’air qui la porte'), tr('les ailes')], 0],
    [tr('Dans l’espace, le son…'), [tr('ne se propage pas'), tr('va plus vite'), tr('fait écho')], 0],
    [tr('La force qui retient la station autour de la Terre ?'), [tr('La gravité'), tr('Le magnétisme'), tr('Le vent solaire')], 0],
    [tr('L’eau bout à 100 °C au niveau de la mer. En altitude, elle bout…'), [tr('plus bas'), tr('plus haut'), tr('pareil')], 0],
    [tr('L’unité de la force ?'), [tr('Le newton'), tr('Le watt'), tr('Le joule')], 0],
    [tr('1 G, c’est…'), [tr('la pesanteur de la Terre'), tr('un gramme'), tr('la vitesse du son')], 0],
  ],
  maths: [
    [tr('Combien font 7 × 8 ?'), ['56', '54', '64'], 0],
    [tr('La racine carrée de 144 ?'), ['12', '14', '11'], 0],
    [tr('Une orbite de 92 minutes : combien de tours en 23 heures environ ?'), ['15', '10', '23'], 0],
    [tr('25 % de 400 ?'), ['100', '25', '75'], 0],
    [tr('Un cercle de rayon 2 : son périmètre (π ≈ 3,14) ?'), [tr('≈ 12,6'), tr('≈ 6,3'), tr('≈ 4')], 0],
    [tr('2 puissance 10 ?'), ['1024', '512', '100'], 0],
    [tr('Si 3x = 27, x vaut…'), ['9', '24', '81'], 0],
    [tr('Un angle droit mesure…'), [tr('90°'), tr('180°'), tr('45°')], 0],
  ],
  anglais: [
    ['« Liftoff » means…', ['le décollage', 'l’atterrissage', 'la panne'], 0],
    ['Complete: « Houston, we ___ a problem. »', ['have', 'has', 'are'], 0],
    ['« Spacesuit » means…', ['la combinaison spatiale', 'la valise', 'le vaisseau'], 0],
    ['The opposite of « up » is…', ['down', 'over', 'near'], 0],
    ['« Do you copy? » on the radio means…', ['tu me reçois ?', 'tu me copies ?', 'tu dors ?'], 0],
    ['« The crew » is…', ['l’équipage', 'la grue', 'la foule'], 0],
    ['Choose the right one: « We ___ ready for launch. »', ['are', 'is', 'am'], 0],
    ['« Weightless » means…', ['en apesanteur', 'sans poids sur la balance', 'très lourd'], 0],
  ],
  systemes: [
    [tr('Avant le retour, on vérifie d’abord…'), [tr('sa combinaison'), tr('la vaisselle'), tr('la radio du voisin')], 0],
    [tr('La capsule Pirogue se pose…'), [tr('en mer, sous ses parachutes'), tr('sur une piste'), tr('sur le toit du siège')], 0],
    [tr('À bord, l’air est rendu respirable par…'), [tr('les filtres et l’oxygène'), tr('les fenêtres ouvertes'), tr('les plantes seules')], 0],
    [tr('Une alarme incendie à bord : le premier geste ?'), [tr('le masque à oxygène'), tr('ouvrir l’écoutille'), tr('appeler la famille')], 0],
    [tr('La Calao a combien d’étages ?'), ['3', '1', '7'], 0],
    [tr('Pendant la rentrée, la capsule est protégée par…'), [tr('son bouclier thermique'), tr('sa peinture'), tr('ses hublots')], 0],
    [tr('L’arrimage à la station se fait…'), [tr('lentement, au centimètre près'), tr('à pleine vitesse'), tr('en marche arrière seulement')], 0],
    [tr('Qui donne le « go » du lancement ?'), [tr('le directeur de vol'), tr('le guide du centre'), tr('le premier passager')], 0],
  ],
})

export function ConcoursEcrit({ id, onEnd }: { id: string; onEnd: (score: number) => void }) {
  const systemes = id === 'module-systemes'
  const jeu = useMemo((): Extract<Jeu, { engine: 'quiz' }> => {
    const b = BANKS()
    const questions = systemes ? shuffle(b.systemes).slice(0, 5) : (['physique', 'maths', 'anglais'] as const).flatMap((s) => shuffle(b[s]).slice(0, 3))
    return systemes
      ? { engine: 'quiz', title: tr('Les systèmes de la Pirogue'), how: tr('L’instructrice interroge la promotion sur la capsule : réponds juste, et vite.'), decor: 'bureau', host: 'chef', timer: 20, questions }
      : { engine: 'quiz', title: tr('Concours Astrélia : l’écrit'), how: tr('Physique, maths, anglais : trois questions de chaque, vingt secondes chacune. Il faut la moitié pour réussir.'), decor: 'bureau', host: 'prof', timer: 20, questions }
  }, [systemes])
  return <Quiz jeu={jeu} onEnd={(s) => onEnd(s)} />
}
