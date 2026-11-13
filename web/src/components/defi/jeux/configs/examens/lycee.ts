import type { Question } from '../../types'
import { t } from '../../../../../lib/i18n'

// The bac’s banks (terminale): those of every série, and each série’s own (the update « parcours-etudes », game/etudes.go ExamPlans): [question, four answers, the right one].
// Each sitting draws so many of each subject at random (engines/Quiz.tsx). Checked one by one: one answer
// only is right, at the level of the class.

export const BAC_PHILO: Question[] = [
  [t('« Je pense, donc je suis » est une formule de…'), ['Descartes', t('Platon'), 'Kant', 'Sartre'], 0],
  [t('« L’homme est par nature un animal politique » : c’est…'), ['Rousseau', t('Aristote'), 'Hegel', 'Spinoza'], 1],
  [t('L’allégorie de la caverne se trouve chez…'), [t('Aristote'), 'Descartes', t('Platon'), 'Nietzsche'], 2],
  [t('« L’enfer, c’est les autres » est une réplique de « Huis clos », de…'), ['Camus', 'Freud', 'Pascal', 'Sartre'], 3],
  [t('La maxime « Connais-toi toi-même », que Socrate a faite sienne, était inscrite au temple de…'), [t('Delphes'), t('Athènes'), 'Rome', t('Olympie')], 0],
  [t('« La religion est l’opium du peuple » est de…'), ['Nietzsche', 'Marx', 'Freud', 'Voltaire'], 1],
  [t('L’« impératif catégorique » est une notion de…'), ['Hume', 'Descartes', 'Kant', 'Locke'], 2],
  [t('« Dieu est mort » est une formule de…'), ['Nietzsche', 'Sartre', 'Marx', 'Hegel'], 0],
  [t('La psychanalyse et la théorie de l’inconscient sont dues à…'), ['Bergson', 'Freud', 'Durkheim', 'Comte'], 1],
  [t('« Du contrat social » (1762) est l’œuvre de…'), ['Montesquieu', 'Hobbes', 'Locke', 'Rousseau'], 3],
  [t('La partie de la philosophie qui réfléchit sur le bien et l’action juste est…'), [t('la logique'), t('l’esthétique'), t('l’éthique (la morale)'), t('l’épistémologie')], 2],
  [t('« La Philosophie bantoue » (1945), point de départ du débat sur la philosophie africaine, est de…'), ['Cheikh Anta Diop', 'Placide Tempels', 'Paulin Hountondji', 'Kwame Nkrumah'], 1],
]

export const BAC_PHILO_A: Question[] = [
  [t('« L’existence précède l’essence » résume l’existentialisme de…'), ['Sartre', t('Platon'), 'Descartes', 'Kant'], 0],
  [t('« L’homme est un loup pour l’homme » est popularisé par…'), ['Rousseau', 'Spinoza', 'Hobbes', 'Pascal'], 2],
  [t('La réflexion sur la connaissance scientifique et ses méthodes s’appelle…'), [t('l’ontologie'), t('l’épistémologie'), t('la théologie'), t('la rhétorique')], 1],
  [t('Dans « Sur la « philosophie africaine » » (1976), le Béninois Paulin Hountondji critique…'), [t('l’empirisme'), t('l’existentialisme'), t('le marxisme'), t('l’ethnophilosophie')], 3],
  [t('« Tous les hommes sont mortels ; or Socrate est un homme ; donc Socrate est mortel » est…'), [t('un sophisme'), t('un paradoxe'), t('un syllogisme'), t('une maxime')], 2],
]

export const BAC_FRANCAIS: Question[] = [
  [t('« Les Soleils des indépendances » est un roman de…'), ['Ahmadou Kourouma', 'Bernard Dadié', 'Camara Laye', 'Mongo Beti'], 0],
  [t('« Une si longue lettre » est l’œuvre de…'), ['Aminata Sow Fall', 'Mariama Bâ', 'Calixthe Beyala', 'Véronique Tadjo'], 1],
  [t('« Cahier d’un retour au pays natal » est d’…'), ['Léopold Sédar Senghor', 'Léon-Gontran Damas', 'Aimé Césaire', 'Birago Diop'], 2],
  [t('Lequel de ces écrivains n’est pas l’un des trois fondateurs de la Négritude ?'), ['Léopold Sédar Senghor', 'Aimé Césaire', 'Léon-Gontran Damas', 'Ahmadou Kourouma'], 3],
  [t('Dans « Allah n’est pas obligé », le narrateur Birahima est…'), [t('un enfant-soldat'), t('un vieux griot'), t('un instituteur'), t('un chef de village')], 0],
  [t('« Les Bouts de bois de Dieu » est un roman de…'), ['Cheikh Hamidou Kane', 'Sembène Ousmane', 'Ferdinand Oyono', 'Seydou Badian'], 1],
  [t('« Je suis mort, je suis enterré » (Molière, « L’Avare ») : quelle figure ?'), [t('une litote'), t('un oxymore'), t('une gradation'), t('une métonymie')], 2],
  [t('« Cette obscure clarté qui tombe des étoiles » (Corneille) contient…'), [t('une comparaison'), t('une personnification'), t('une anaphore'), t('un oxymore')], 3],
  [t('« Va, je ne te hais point » (« Le Cid ») : dire moins pour suggérer plus, c’est…'), [t('une litote'), t('une hyperbole'), t('une antithèse'), t('une anaphore')], 0],
  [t('Un texte qui cherche à convaincre le lecteur est de type…'), [t('narratif'), t('argumentatif'), t('descriptif'), t('explicatif')], 1],
  [t('« Les Contes d’Amadou Koumba » sont de…'), ['Bernard Dadié', 'Amadou Hampâté Bâ', 'Birago Diop', 'Sembène Ousmane'], 2],
  [t('« Le Vieux Nègre et la Médaille » est un roman de…'), ['Ferdinand Oyono', 'Mongo Beti', 'Camara Laye', 'Henri Lopes'], 0],
]

export const BAC_FRANCAIS_A: Question[] = [
  [t('Le roman de Bernard Dadié qui raconte le séjour d’un Africain à Paris s’intitule…'), ['« Climbié »', '« Un Nègre à Paris »', '« Le Pagne noir »', '« Patron de New York »'], 1],
  [t('Le « didiga », art de l’impossible, a été créé par l’Ivoirien…'), ['Bernard Zadi Zaourou', 'Jean-Marie Adiaffi', 'Charles Nokan', 'Amadou Koné'], 0],
  [t('« La Carte d’identité » (1980) est un roman de l’Ivoirien…'), ['Ahmadou Kourouma', 'Bernard Dadié', 'Jean-Marie Adiaffi', 'Isaïe Biton Koulibaly'], 2],
  [t('Un narrateur qui sait tout des personnages, même leurs pensées, adopte la focalisation…'), [t('interne'), t('externe'), t('multiple'), t('zéro (narrateur omniscient)')], 3],
  [t('« Tribaliques » (1971) est un recueil de nouvelles du Congolais…'), ['Sony Labou Tansi', 'Henri Lopes', 'Tchicaya U Tam’si', 'Emmanuel Dongala'], 1],
]

export const BAC_ANGLAIS: Question[] = [
  ['If I ___ rich, I would build a school in my village.', ['am', 'were', 'will be', 'have been'], 1],
  ['The bridge ___ in 2014.', ['was built', 'built', 'has build', 'is building'], 0],
  ['She said, « I am tired. » In reported speech: She said that she ___ tired.', ['is', 'be', 'was', 'has'], 2],
  ['I wish I ___ more time to revise.', ['have', 'will have', 'having', 'had'], 3],
  ['He has been working here ___ ten years.', ['since', 'for', 'during', 'ago'], 1],
  ['By the time we arrived, the film ___.', ['had started', 'has started', 'starts', 'was start'], 0],
  ['The man ___ car was stolen called the police.', ['who', 'which', 'whose', 'whom'], 2],
  ['You ___ smoke here: it’s forbidden.', ['don’t have to', 'needn’t', 'might not', 'mustn’t'], 3],
  ['Which verb is closest in meaning to « to increase »?', ['to rise', 'to fall', 'to cut', 'to drop'], 0],
  ['Neither Kofi ___ Ama came to the party.', ['or', 'nor', 'and', 'but'], 1],
  ['She is used to ___ up early.', ['get', 'got', 'getting', 'gets'], 2],
  ['Unless you work hard, you ___ the exam.', ['will fail', 'would have failed', 'fails', 'failing'], 0],
]

export const BAC_HISTGEO: Question[] = [
  [t('La guerre froide oppose surtout…'), [t('les États-Unis et l’URSS'), t('la France et l’Allemagne'), t('la Chine et le Japon'), t('le Royaume-Uni et l’Inde')], 0],
  [t('Le mur de Berlin tombe en…'), ['1961', '1989', '1991', '1975'], 1],
  [t('L’Organisation de l’unité africaine (OUA) est créée en 1963 à…'), ['Accra', 'Dakar', t('Addis-Abeba'), t('Le Caire')], 2],
  [t('L’Union africaine succède à l’OUA en…'), ['1993', '2010', '1999', '2002'], 3],
  [t('La conférence de Bandung (1955), où se réunissent des pays d’Afrique et d’Asie, se tient en…'), [t('Indonésie'), t('Inde'), t('Égypte'), t('Chine')], 0],
  [t('La CEDEAO est créée en 1975 à…'), ['Abuja', 'Lagos', 'Abidjan', 'Lomé'], 1],
  [t('Le plan Marshall (1947) est…'), [t('une alliance militaire soviétique'), t('un traité de paix avec le Japon'), t('une aide américaine à la reconstruction de l’Europe'), t('un plan de décolonisation')], 2],
  [t('La crise des missiles de Cuba a lieu en…'), ['1962', '1956', '1968', '1973'], 0],
  [t('Le siège de la Banque africaine de développement (BAD) est à…'), ['Dakar', 'Nairobi', 'Lagos', 'Abidjan'], 3],
  [t('La Côte d’Ivoire est le premier producteur mondial de…'), [t('café'), t('cacao'), t('coton'), t('pétrole')], 1],
  [t('Les grandes entreprises implantées dans de nombreux pays sont appelées…'), [t('des PME'), t('des coopératives'), t('des firmes multinationales'), t('des ONG')], 2],
  [t('Nelson Mandela devient président de l’Afrique du Sud en…'), ['1994', '1990', '1985', '2000'], 0],
  [t('Le siège de l’ONU se trouve à…'), [t('Genève'), 'Paris', 'Washington', 'New York'], 3],
  [t('Les accords d’Évian (1962) mettent fin à la guerre…'), [t('d’Indochine'), t('d’Algérie'), t('de Corée'), t('du Biafra')], 1],
  [t('L’UEMOA est créée en…'), ['1975', '1960', '1994', '2002'], 2],
]

export const BAC_MATHS_A: Question[] = [
  [t('15 % de 2 000 F, c’est…'), ['300 F', '150 F', '30 F', t('1 500 F')], 0],
  [t('Résous 3x − 6 = 0.'), ['x = −2', 'x = 2', 'x = 3', 'x = 6'], 1],
  [t('Une suite arithmétique a u₀ = 5 et une raison 3. Alors u₄ = …'), ['15', '20', '17', '14'], 2],
  [t('La médiane de la série 3, 7, 9, 12, 20 est…'), [t('10,2'), '7', '12', '9'], 3],
  [t('Un prix de 10 000 F augmente de 20 %, puis baisse de 20 %. Il vaut alors…'), [t('9 600 F'), t('10 000 F'), t('10 400 F'), t('8 000 F')], 0],
  ['ln(1) = …', ['1', '0', 'e', '−1'], 1],
  [t('La dérivée de f(x) = 3x² est…'), ['3x', 'x³', '6x', '6x²'], 2],
  [t('Une urne contient 3 boules rouges et 2 bleues. On en tire une au hasard. P(rouge) = …'), ['3/5', '2/5', '1/3', '3/2'], 0],
  [t('Les solutions de x² = 16 sont…'), [t('x = 4 seulement'), t('x = 8 ou x = −8'), t('x = 16 ou x = −16'), t('x = 4 ou x = −4')], 3],
  [t('Un prix passe de 50 F à 60 F. Il a augmenté de…'), [t('10 %'), t('20 %'), t('16,7 %'), t('60 %')], 1],
]

export const BAC_MATHS: Question[] = [
  [t('La dérivée de ln(x) sur ]0 ; +∞[ est…'), ['1/x', 'ln(x)/x', 'x', 'eˣ'], 0],
  [t('Une primitive de f(x) = 2x est…'), ['2', 'x²', '2x²', 'x²/2'], 1],
  [t('lim (eˣ / x) quand x → +∞ vaut…'), ['0', '1', '+∞', 'e'], 2],
  [t('lim (sin x / x) quand x → 0 vaut…'), ['0', '+∞', 'π', '1'], 3],
  ['ln(e²) = …', ['2', 'e', '1', 'e²'], 0],
  [t('La dérivée de f(x) = e²ˣ est…'), ['e²ˣ', '2e²ˣ', '2x·e²ˣ', 'e²ˣ/2'], 1],
  [t('L’intégrale de 0 à 1 de x dx vaut…'), ['1', '2', '1/2', '0'], 2],
  [t('Suite géométrique : u₀ = 3 et q = 2. Alors u₃ = …'), ['24', '9', '12', '48'], 0],
  [t('On lance deux dés équilibrés. La probabilité d’obtenir deux 6 est…'), ['1/6', '1/12', '2/6', '1/36'], 3],
  [t('Le module du nombre complexe 3 + 4i est…'), ['7', '5', '25', '1'], 1],
  [t('La solution de l’équation eˣ = 1 est…'), ['x = 1', 'x = e', 'x = 0', 'x = −1'], 2],
  [t('La dérivée de f(x) = x·ln(x) est…'), ['ln(x) + 1', '1/x', 'ln(x)', 'x + ln(x)'], 0],
]

export const BAC_MATHS_C: Question[] = [
  [t('Le PGCD de 84 et 36 est…'), ['6', '12', '18', '4'], 1],
  [t('La forme exponentielle du nombre complexe i est…'), ['e^(iπ)', 'e^(iπ/4)', 'e^(iπ/2)', 'e^(2iπ)'], 2],
  [t('17 est congru, modulo 5, à…'), ['2', '3', '1', '4'], 0],
  [t('L’application d’écriture complexe z′ = iz est…'), [t('la symétrie d’axe (Ox)'), t('l’homothétie de centre O et de rapport 2'), t('la translation de vecteur i'), t('la rotation de centre O et d’angle π/2')], 3],
  [t('Le nombre de façons de choisir 2 élèves parmi 5 est…'), ['20', '10', '25', '7'], 1],
  [t('lim (ln x / x) quand x → +∞ vaut…'), ['0', '1', '+∞', '−∞'], 0],
]

export const BAC_PHYSIQUE: Question[] = [
  [t('L’énergie cinétique d’un solide en translation, de masse m et de vitesse v, vaut…'), ['½mv²', 'mgh', 'mv', '½mv'], 0],
  [t('La deuxième loi de Newton (théorème du centre d’inertie) s’écrit…'), ['ΣF = m/a', 'ΣF = m·a', 'ΣF = m·v', t('ΣF = 0 toujours')], 1],
  [t('La période propre d’un pendule simple de longueur l est…'), ['2π√(g/l)', '2πlg', '2π√(l/g)', '√(l·g)'], 2],
  [t('La constante de temps d’un circuit RC est…'), ['R/C', '1/(RC)', 'C/R', 'τ = RC'], 3],
  [t('Le pH d’une solution d’acide chlorhydrique à 0,01 mol/L est…'), ['2', '1', t('0,01'), '12'], 0],
  [t('Un acide carboxylique réagit avec un alcool : il se forme de l’eau et…'), [t('un aldéhyde'), t('un ester'), t('une amine'), t('une cétone')], 1],
  [t('Au bout de deux demi-vies, il reste d’un échantillon radioactif…'), [t('la moitié'), t('rien'), t('le quart'), t('le tiers')], 2],
  [t('Une particule α est…'), [t('un noyau d’hélium'), t('un électron'), t('un photon'), t('un neutron')], 0],
  [t('La fréquence propre d’un circuit LC est…'), ['2π√(LC)', '1/(LC)', '√(L/C)', '1/(2π√(LC))'], 3],
  [t('L’unité de l’inductance d’une bobine est…'), [t('le farad'), t('le henry'), t('le tesla'), t('l’ohm')], 1],
  [t('En mouvement circulaire uniforme de rayon R et de vitesse v, l’accélération vaut…'), ['0', 'v·R', 'v²/R', 'v/R²'], 2],
  [t('La vitesse de la lumière dans le vide est d’environ…'), [t('3,0 × 10⁸ m/s'), t('3,0 × 10⁵ m/s'), '340 m/s', t('3,0 × 10⁶ km/s')], 0],
]

export const BAC_PHYSIQUE_C: Question[] = [
  [t('Pour un couple acide/base, quand pH = pKa…'), [t('il n’y a que l’acide'), t('[acide] = [base]'), t('il n’y a que la base'), t('la solution est neutre')], 1],
  [t('L’unité du champ magnétique est…'), [t('le weber'), t('le henry'), t('le tesla'), t('le coulomb')], 2],
]

export const BAC_SVT: Question[] = [
  [t('Une méiose donne, à partir d’une cellule diploïde…'), [t('4 cellules haploïdes'), t('2 cellules diploïdes'), t('2 cellules haploïdes'), t('4 cellules diploïdes')], 0],
  [t('La réplication de l’ADN est dite…'), ['conservative', 'semi-conservative', 'dispersive', t('aléatoire')], 1],
  [t('Chez les eucaryotes, la transcription de l’ADN en ARN messager a lieu dans…'), [t('le ribosome'), t('la mitochondrie'), t('le noyau'), t('la membrane')], 2],
  [t('La traduction de l’ARN messager en protéine se fait au niveau…'), [t('du noyau'), t('des chromosomes'), t('de l’appareil de Golgi seulement'), t('des ribosomes')], 3],
  [t('Un codon est formé de…'), [t('3 nucléotides'), t('2 nucléotides'), t('4 acides aminés'), t('1 gène')], 0],
  [t('Les anticorps sont produits par…'), [t('les globules rouges'), t('les plasmocytes (lymphocytes B différenciés)'), t('les plaquettes'), t('les neurones')], 1],
  [t('Les cellules infectées par un virus sont détruites par…'), [t('les anticorps seuls'), t('les hématies'), t('les lymphocytes T cytotoxiques (T8)'), t('les cellules de Leydig')], 2],
  [t('La testostérone est sécrétée par…'), [t('les cellules interstitielles (de Leydig)'), t('l’hypophyse'), t('les spermatozoïdes'), t('la prostate')], 0],
  [t('Le potentiel de repos d’un neurone est d’environ…'), ['+70 mV', '0 mV', '+30 mV', '−70 mV'], 3],
  [t('À la jonction neuromusculaire, le neurotransmetteur libéré est…'), [t('l’adrénaline'), t('l’acétylcholine'), t('l’insuline'), t('la testostérone')], 1],
]

export const BAC_SVT_D: Question[] = [
  [t('L’ovulation est déclenchée par un pic de…'), [t('progestérone'), t('FSH seulement'), 'LH', t('testostérone')], 2],
  [t('Le brassage interchromosomique se produit à…'), [t('l’anaphase I de la méiose'), t('la prophase de la mitose'), t('la fécondation seulement'), t('l’interphase')], 0],
  [t('Les crossing-over (brassage intrachromosomique) ont lieu en…'), [t('métaphase II'), 'anaphase II', t('télophase I'), 'prophase I'], 3],
  [t('L’énergie directement utilisée par le muscle pour se contracter provient…'), [t('du glucose sanguin directement'), t('de l’ATP'), t('de l’oxygène seul'), t('du calcium')], 1],
]
