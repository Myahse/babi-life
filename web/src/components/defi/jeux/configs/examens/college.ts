import type { Question } from '../../types'
import { t } from '../../../../../lib/i18n'

// The BEPC’s banks, a subject each (3e) (the update « parcours-etudes », game/etudes.go ExamPlans): [question, four answers, the right one].
// Each sitting draws so many of each subject at random (engines/Quiz.tsx). Checked one by one: one answer
// only is right, at the level of the class.

export const BEPC_MATHS: Question[] = [
  ['Factorise x² − 9.', ['(x − 3)(x + 3)', '(x − 3)²', '(x − 9)(x + 1)', 'x(x − 9)'], 0],
  [t('Résous l’équation 2x + 5 = 17.'), ['x = 11', 'x = 6', t('x = 8,5'), 'x = 5'], 1],
  [t('Un triangle rectangle a des côtés de l’angle droit de 6 cm et 8 cm. Son hypoténuse mesure…'), ['14 cm', '12 cm', '10 cm', '48 cm'], 2],
  [t('√50 s’écrit aussi…'), ['5√2', '25√2', '2√5', '10√5'], 0],
  [t('Dans un triangle ABC rectangle en A, cos(ABC) est égal à…'), ['AC / BC', 'AB / AC', 'AC / AB', 'AB / BC'], 3],
  [t('Développe (a + b)².'), ['a² + b²', 'a² + 2ab + b²', 'a² + ab + b²', '2a + 2b'], 1],
  [t('Le coefficient directeur de la droite passant par A(1 ; 2) et B(3 ; 8) est…'), ['2', '6', '3', '1/3'], 2],
  [t('Résous le système : x + y = 10 et x − y = 4.'), [t('x = 7 et y = 3'), t('x = 6 et y = 4'), t('x = 3 et y = 7'), t('x = 8 et y = 2')], 0],
  [t('Le volume d’un cylindre de rayon 3 cm et de hauteur 10 cm est…'), ['30π cm³', '60π cm³', '9π cm³', '90π cm³'], 3],
  [t('Les solutions de l’inéquation −2x > 6 sont…'), ['x > −3', 'x < −3', 'x < 3', 'x > 3'], 1],
  [t('La moyenne des notes 8, 12, 10 et 14 est…'), ['10', '12', '11', '44'], 2],
  [t('(MN) est parallèle à (BC), M sur [AB], N sur [AC], AM/AB = 2/5 et BC = 10 cm. Alors MN = …'), ['4 cm', '5 cm', '25 cm', '2 cm'], 0],
  [t('2⁻³ est égal à…'), ['−8', '1/8', '−6', '1/6'], 1],
]

export const BEPC_FRANCAIS: Question[] = [
  [t('Dans « Il court rapidement », « rapidement » est…'), [t('un adjectif'), t('un nom'), t('un adverbe'), t('un verbe')], 2],
  [t('Complète : « Les mangues que j’ai … sont mûres. »'), ['acheté', 'achetés', 'achetée', 'achetées'], 3],
  [t('« Cet homme est un lion » est…'), [t('une métaphore'), t('une comparaison'), t('une litote'), t('une antithèse')], 0],
  [t('Le verbe « finir » au passé simple, 3e personne du pluriel :'), ['ils finissèrent', 'ils finirent', 'ils finissaient', 'ils finiront'], 1],
  [t('Complète : « Il faut que tu … demain. » (venir)'), ['viens', 'viendras', 'viennes', 'venais'], 2],
  [t('Un synonyme de « célèbre » :'), ['renommé', 'discret', 'ancien', 'modeste'], 0],
  [t('Le contraire de « généreux » :'), ['gentil', 'riche', 'pauvre', 'avare'], 3],
  [t('La phrase « Ferme la porte ! » est de type…'), [t('interrogatif'), t('injonctif'), t('déclaratif'), t('exclamatif seulement')], 1],
  [t('« L’Enfant noir » a été écrit par…'), ['Camara Laye', 'Bernard Dadié', 'Mongo Beti', 'Ahmadou Kourouma'], 0],
  [t('L’auteur ivoirien de « Climbié » et du « Pagne noir » est…'), ['Ahmadou Kourouma', 'Amadou Hampâté Bâ', 'Bernard Dadié', 'Birago Diop'], 2],
  [t('Au discours indirect, « Il dit : « Je viens. » » devient…'), ['Il dit qu’il vient.', 'Il dit que je viens.', 'Il dit qu’il venait.', 'Il dit : je viens.'], 0],
  [t('Dans « Il écrit à son ami », « à son ami » est…'), [t('un COD'), t('un complément de lieu'), t('un attribut du sujet'), t('un COI')], 3],
  [t('Le pluriel de « un chou » :'), ['des chous', 'des choux', 'des choues', 'des chou'], 1],
]

export const BEPC_HISTGEO: Question[] = [
  [t('Le premier président de la Côte d’Ivoire est…'), ['Félix Houphouët-Boigny', 'Henri Konan Bédié', 'Robert Guéï', 'Laurent Gbagbo'], 0],
  [t('La Côte d’Ivoire est devenue indépendante le…'), [t('4 avril 1960'), t('7 août 1960'), t('1er août 1960'), t('7 décembre 1960')], 1],
  [t('La capitale politique de la Côte d’Ivoire, depuis 1983, est…'), ['Abidjan', 'Bouaké', 'Yamoussoukro', 'Grand-Bassam'], 2],
  [t('Le barrage de Kossou est construit sur…'), [t('le Bandama'), t('la Comoé'), t('le Sassandra'), t('le Cavally')], 0],
  [t('La Côte d’Ivoire devient une colonie française en…'), ['1960', '1946', '1904', '1893'], 3],
  [t('Le RDA (Rassemblement démocratique africain) est créé en 1946 à…'), ['Dakar', 'Bamako', 'Abidjan', 'Conakry'], 1],
  [t('Lequel de ces pays n’a pas de frontière avec la Côte d’Ivoire ?'), [t('Le Mali'), t('Le Ghana'), t('Le Sénégal'), t('Le Libéria')], 2],
  [t('L’Organisation des Nations unies (ONU) est créée en…'), ['1945', '1919', '1939', '1960'], 0],
  [t('Le climat du sud de la Côte d’Ivoire est…'), [t('soudanais (tropical sec)'), t('désertique'), t('méditerranéen'), t('équatorial (attiéen)')], 3],
  [t('Le deuxième port de Côte d’Ivoire, après Abidjan, est celui de…'), ['Grand-Bassam', 'San-Pédro', 'Sassandra', 'Assinie'], 1],
  [t('La conférence de Brazzaville, qui annonce des réformes dans les colonies françaises, a lieu en…'), ['1944', '1956', '1958', '1960'], 0],
  [t('Kwame Nkrumah a conduit à l’indépendance…'), [t('le Togo'), t('le Nigeria'), t('le Ghana'), t('la Guinée')], 2],
]

export const BEPC_SVT: Question[] = [
  [t('L’organe qui sécrète l’insuline est…'), [t('le foie'), t('le pancréas'), t('l’estomac'), t('le rein')], 1],
  [t('Dans les globules rouges, la molécule qui fixe le dioxygène est…'), [t('l’hémoglobine'), t('l’insuline'), t('l’amylase'), t('le glucose')], 0],
  [t('Le paludisme est transmis par la piqûre…'), [t('de la mouche tsé-tsé'), t('du moustique tigre'), t('de l’anophèle femelle'), t('de la puce')], 2],
  [t('Le VIH détruit surtout…'), [t('les globules rouges'), t('les plaquettes'), t('les neurones'), t('les lymphocytes T4')], 3],
  [t('Chez la femme, la fécondation a lieu dans…'), [t('la trompe (oviducte)'), t('l’utérus'), t('l’ovaire'), t('le vagin')], 0],
  [t('Une cellule humaine (non sexuelle) contient…'), ['23 chromosomes', '46 chromosomes', '44 chromosomes', '92 chromosomes'], 1],
  [t('Au terme de la digestion, l’amidon est transformé en…'), [t('acides aminés'), t('acides gras'), 'glucose', t('glycérol')], 2],
  [t('Les échanges gazeux de la respiration se font au niveau…'), [t('des bronches'), t('de la trachée'), t('du larynx'), t('des alvéoles pulmonaires')], 3],
  [t('Un vaccin protège parce qu’il…'), [t('prépare le système immunitaire à reconnaître le microbe'), t('tue tous les microbes du corps'), t('remplace les globules blancs'), t('soigne une maladie déjà déclarée')], 0],
  [t('L’humus du sol provient…'), [t('de la roche mère'), t('de la décomposition des débris végétaux et animaux'), t('de l’eau de pluie'), t('des engrais chimiques seulement')], 1],
]

export const BEPC_PHYSIQUE: Question[] = [
  [t('La loi d’Ohm s’écrit…'), ['U = R / I', 'U = R + I', 'U = R × I', 'U = I / R'], 2],
  [t('L’unité de la puissance est…'), [t('le watt'), t('le joule'), t('le volt'), t('l’ampère')], 0],
  [t('La masse volumique de l’eau pure est d’environ…'), ['10 g/cm³', t('0,1 g/cm³'), '100 g/cm³', '1 g/cm³'], 3],
  [t('La formule du dioxyde de carbone est…'), ['CO', 'CO₂', 'C₂O', 'O₂'], 1],
  [t('Une solution de pH 3 est…'), [t('basique'), t('neutre'), t('acide'), t('salée')], 2],
  [t('Le poids d’un objet de 2 kg (g = 10 N/kg) vaut…'), ['20 N', '2 N', '5 N', '12 N'], 0],
  [t('La combustion complète du carbone dans le dioxygène produit…'), [t('de l’eau'), t('du dioxyde de carbone'), t('du monoxyde de carbone'), t('de l’hydrogène')], 1],
  [t('Une lampe de 60 W allumée pendant 2 h consomme…'), ['30 Wh', '62 Wh', '60 Wh', '120 Wh'], 3],
  [t('L’ion sodium Na⁺ provient d’un atome de sodium qui a…'), [t('perdu un électron'), t('gagné un électron'), t('perdu un proton'), t('gagné un neutron')], 0],
  [t('L’acide chlorhydrique réagit avec la soude : il se forme de l’eau et…'), [t('du dioxygène'), t('du sucre'), t('du chlorure de sodium'), t('du fer')], 2],
]

export const BEPC_ANGLAIS: Question[] = [
  ['She ___ to school every day.', ['go', 'goes', 'going', 'gone'], 1],
  ['I have lived in Abidjan ___ 2015.', ['since', 'for', 'during', 'ago'], 0],
  ['The past tense of « buy » is…', ['buyed', 'bought', 'brought', 'buys'], 1],
  ['If it rains tomorrow, we ___ at home.', ['stayed', 'would stayed', 'stays', 'will stay'], 3],
  ['There aren’t ___ mangoes left.', ['some', 'no', 'any', 'a'], 2],
  ['This road is ___ than that one.', ['longer', 'more long', 'longest', 'most long'], 0],
  ['They ___ football when it started to rain.', ['are playing', 'were playing', 'play', 'have played'], 1],
  ['Whose bag is this? It’s ___.', ['my', 'me', 'I', 'mine'], 3],
  ['How ___ does this pagne cost?', ['many', 'long', 'much', 'often'], 2],
  ['The opposite of « cheap » is…', ['expensive', 'poor', 'small', 'easy'], 0],
]
