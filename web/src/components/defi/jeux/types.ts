// Every action, its own little game (the update « gestes-maison »: nothing waits on a clock, every
// action is played). A game is one of the engines (engines/), dressed for the action by its config
// (configs/): its objects (the game's own 3D blocks, props/), what's asked, what's said. The score
// (0..100) is the action's: played well, all of its good (backend sims/defi.go homeDone).

/** The 3D objects the games are made of (props/: the game's own voxel style, like world3d/props). */
export const PROP_IDS = [
  // Food, drink, the kitchen
  'assiette', 'garba', 'alloco', 'attieke', 'poisson', 'poulet', 'brochette', 'foutou', 'riz', 'pain', 'croissant', 'burger', 'pizza', 'glace', 'gateau', 'mangue', 'ananas', 'banane', 'noix-coco', 'bouteille', 'biere', 'soda', 'jus', 'sachet-eau', 'cafe', 'the', 'verre', 'cocktail', 'popcorn', 'bonbon', 'piment', 'tomate', 'oignon', 'marmite', 'poele', 'louche', 'couteau', 'fourchette', 'plateau-service', 'menu',
  // Money, papers, the office
  'billet', 'piece', 'carte-bancaire', 'dossier', 'stylo', 'tampon', 'cahier', 'livre', 'journal', 'telephone', 'ordinateur', 'cle', 'valise', 'ticket', 'passeport', 'urne', 'bulletin', 'drapeau', 'megaphone', 'micro', 'caisse-enregistreuse', 'scanner', 'carton', 'colis', 'balance', 'calculatrice', 'tableau-noir', 'craie',
  // Clothes, beauty
  'pagne', 'robe', 'chemise', 'boubou', 'chaussure', 'sac', 'casquette', 'lunettes', 'montre', 'collier', 'peigne', 'ciseaux', 'rasoir', 'seche-cheveux', 'vernis', 'miroir', 'parfum', 'creme', 'meche', 'bigoudi',
  // The house, cleaning
  'savon', 'eponge', 'serviette', 'balai', 'seau', 'fer-a-repasser', 'linge', 'tapis', 'coussin', 'lampe', 'bougie', 'fleur', 'plante', 'cadeau', 'ballon-fete', 'jouet', 'peluche', 'biberon',
  // Health
  'seringue', 'medicament', 'thermometre', 'stethoscope', 'pansement', 'tensiometre',
  // Work tools
  'marteau', 'brique', 'sac-ciment', 'brouette', 'pelle', 'casque-chantier', 'machine-a-coudre', 'bobine', 'tissu', 'chariot', 'volant-auto', 'essence', 'gilet', 'sifflet', 'menottes', 'badge',
  // Sport, games
  'ballon-foot', 'ballon-basket', 'but', 'panier-basket', 'haltere', 'raquette', 'filet', 'quille', 'boule-petanque', 'manette', 'carte-jeu', 'de', 'damier', 'jeton', 'kart', 'velo', 'pirogue', 'bouee', 'planche-surf', 'flechette', 'cible', 'corde', 'tapis-yoga', 'chrono', 'trophee', 'medaille',
  // Music, worship
  'djembe', 'tam-tam', 'guitare', 'balafon', 'enceinte', 'platine', 'chapelet', 'bible', 'coran', 'tapis-priere', 'croix', 'cierge', 'calebasse',
  // Nature, animals, the sky
  'coquillage', 'crabe', 'poisson-vivant', 'vague', 'palmier', 'cocotier', 'lion', 'girafe', 'elephant', 'singe', 'perroquet', 'crocodile', 'tortue', 'oiseau', 'papillon', 'avion', 'nuage', 'soleil', 'lune', 'etoile', 'caillou', 'feuille',
  // Culture
  'tableau', 'statue', 'masque', 'appareil-photo', 'affiche', 'camera', 'ecran', 'telecommande', 'clap', 'billet-cinema',
  // Bits to clean off, little effects
  'tache', 'poussiere', 'mousse', 'cheveu', 'coquille', 'goutte', 'flamme', 'bulle', 'coeur', 'note-musique',
  // The street's happenings (the update « evenements-joues »)
  'flaque', 'gbaka', 'parapluie', 'sachet-pluie', 'groupe-electrogene', 'voiture', 'ruban', 'caniveau',
] as const
export type PropId = (typeof PROP_IDS)[number]

/** The ground or the table the game is played on (Shell.tsx Decor). */
export type Decor = 'table' | 'comptoir' | 'etal' | 'etagere' | 'sable' | 'herbe' | 'carrelage' | 'bitume' | 'eau' | 'scene' | 'bureau' | 'parquet' | 'terre' | 'piste' | 'ciel'

/** A thing to pick, catch, put together: its name (said, in French) and its 3D object. */
export type Item = { name: string; prop: PropId }

type Base = {
  /** The game's title, short (« Choisis le bon pagne »). */
  title: string
  /** One line to say how it's played (« La cliente demande un pagne : touche le bon avant la voisine. »). */
  how: string
  /** The ground or the table. */
  decor: Decor
}

export type Jeu =
  /** Pick the one asked (the garba's fish): items lie on the decor, someone calls one, tap it before another hand. */
  | (Base & { engine: 'choisir'; caller: string; items: Item[]; rounds?: number })
  /** Catch what falls (the alloco): move the container under it; the bad ones are to let fall. */
  | (Base & { engine: 'attraper'; from: PropId; good: Item[]; bad?: Item[]; into: PropId; count?: number })
  /** Clean it off (the egg's shell): the object covered with bits, tap each one off. */
  | (Base & { engine: 'nettoyer'; object: PropId; bit: PropId; count?: number; verb: string })
  /** In rhythm: notes come down three lanes, each lane an object (the djembé, the mic…); tap on the line. */
  | (Base & { engine: 'rythme'; lanes: [PropId, PropId, PropId]; notes?: number; tempo?: number })
  /** Hold and let go in the green (« pommer »): the object fills, heats, lifts as it's held. */
  | (Base & { engine: 'tenir'; object: PropId; verb: string; times?: number; fill: 'liquide' | 'force' | 'chaleur' | 'tissu' })
  /** Aim and throw: an aim swings, a power gauge; the thing thrown at the target. */
  | (Base & { engine: 'viser'; projectile: PropId; target: PropId; shots?: number })
  /** On the move: the perso (the game's own Character) goes along, up or down, gathering the good, dodging the bad. */
  | (Base & { engine: 'course'; mode: 'pied' | 'nage' | 'pirogue' | 'kart' | 'velo'; good: PropId; bad: PropId; target?: number; /** Under the rain: drops falling over the run, the sky grey. */ rain?: boolean; /** Now and then one coming fast down a lane (the gbaka through the puddles): met, a big splash. */ rush?: PropId })
  /** Questions: someone of the place (a Character) asks, three answers. [question, answers, index of the right one]. */
  | (Base & { engine: 'quiz'; host: Host; questions: [string, string[], number][] })
  /** The photo, the look: subjects go by; tap when one is in the frame. */
  | (Base & { engine: 'photo'; subjects: Item[]; shots?: number })
  /** Put it together: an order asked (the parts in a given order), tap the parts in that order onto the base. */
  | (Base & { engine: 'assembler'; base: PropId; parts: Item[]; orders?: number; steps?: number })
  /** Carry it steady: the thing carried leans, tap left and right to keep it up, to the end. */
  | (Base & { engine: 'equilibre'; carry: PropId; verb: string; distance?: number })
  /** Talk: someone (a Character) says something, three replies; pick the one that fits. [line, replies, index of the right one]. */
  | (Base & { engine: 'repondre'; npc: Host; lines: [string, string[], number][] })

export type Engine = Jeu['engine']
/** Who's there to ask, to answer (a Character dressed for it). */
export type Host = 'ami' | 'amie' | 'client' | 'cliente' | 'vendeuse' | 'patient' | 'electeur' | 'enfant' | 'maman' | 'papa' | 'collegue' | 'chef' | 'prof' | 'juge' | 'agent' | 'guide' | 'pretre' | 'imam' | 'pasteur' | 'medecin' | 'policier' | 'touriste' | 'vieux' | 'serveur'

/** What every engine is given: its config, and where to send the score. */
export type EngineProps<E extends Engine> = { jeu: Extract<Jeu, { engine: E }>; onEnd: (score: number) => void }
