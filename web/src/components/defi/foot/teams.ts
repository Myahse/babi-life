// The sides of the console's football (components/defi/Foot.tsx): a club for
// each commune of Abidjan and for Yamoussoukro and Bouaké (the game's own
// names), and national sides under their country's name, in its colours.
// A side's stars (1 to 5) make it play a little stronger or weaker; its home
// shirt, and an away one for when the colours clash.

export type Team = {
  id: string
  name: string
  /** Three letters, for the bracket and the table. */
  short: string
  kind: 'club' | 'nation'
  stars: number
  home: string
  away: string
  /** A club's commune (a Sim's own club in the career). */
  commune?: string
}

export const CLUBS: Team[] = [
  { id: 'yop', name: 'Yop City', short: 'YOP', kind: 'club', stars: 4, home: '#1c7ed6', away: '#f8f9fa', commune: 'yopougon' },
  { id: 'cocody', name: 'Cocody Élite', short: 'COC', kind: 'club', stars: 5, home: '#7048e8', away: '#f8f9fa', commune: 'cocody' },
  { id: 'plateau', name: 'Plateau Stars', short: 'PLA', kind: 'club', stars: 4, home: '#212529', away: '#ffd43b', commune: 'plateau' },
  { id: 'abobo', name: "Les Lions d'Abobo", short: 'ABO', kind: 'club', stars: 3, home: '#f59f00', away: '#212529', commune: 'abobo' },
  { id: 'koumassi', name: 'Koumassi FC', short: 'KOU', kind: 'club', stars: 3, home: '#e03131', away: '#f8f9fa', commune: 'koumassi' },
  { id: 'treich', name: 'Treich United', short: 'TRE', kind: 'club', stars: 3, home: '#2b8a3e', away: '#f8f9fa', commune: 'treichville' },
  { id: 'adjame', name: 'Adjamé Sporting', short: 'ADJ', kind: 'club', stars: 3, home: '#c92a2a', away: '#ffd43b', commune: 'adjame' },
  { id: 'marcory', name: 'Marcory Racing', short: 'MAR', kind: 'club', stars: 3, home: '#0ca678', away: '#212529', commune: 'marcory' },
  { id: 'portbouet', name: 'Port-Bouët Marine', short: 'PBT', kind: 'club', stars: 2, home: '#1864ab', away: '#e7f5ff', commune: 'port-bouet' },
  { id: 'attecoube', name: 'Attécoubé AC', short: 'ATT', kind: 'club', stars: 2, home: '#d9480f', away: '#f8f9fa', commune: 'attecoube' },
  { id: 'anyama', name: 'Anyama FC', short: 'ANY', kind: 'club', stars: 2, home: '#862e9c', away: '#f8f9fa', commune: 'anyama' },
  { id: 'bingerville', name: 'Bingerville Olympique', short: 'BGV', kind: 'club', stars: 2, home: '#5c940d', away: '#f8f9fa', commune: 'bingerville' },
  { id: 'songon', name: 'Songon Espoir', short: 'SON', kind: 'club', stars: 1, home: '#66a80f', away: '#212529', commune: 'songon' },
  { id: 'yakro', name: 'Yamoussoukro AS', short: 'YAK', kind: 'club', stars: 3, home: '#f76707', away: '#1c7ed6', commune: 'yakro' },
  { id: 'bouake', name: 'Bouaké Étoile', short: 'BKE', kind: 'club', stars: 3, home: '#f03e3e', away: '#f8f9fa', commune: 'bouake' },
  { id: 'babi', name: 'Babi FC', short: 'BAB', kind: 'club', stars: 4, home: '#ff7a00', away: '#f8f9fa' },
]

export const NATIONS: Team[] = [
  { id: 'civ', name: "Côte d'Ivoire", short: 'CIV', kind: 'nation', stars: 5, home: '#ff7a00', away: '#f8f9fa' },
  { id: 'sen', name: 'Sénégal', short: 'SEN', kind: 'nation', stars: 5, home: '#f8f9fa', away: '#00853f' },
  { id: 'mar', name: 'Maroc', short: 'MAR', kind: 'nation', stars: 5, home: '#c1272d', away: '#006233' },
  { id: 'nga', name: 'Nigeria', short: 'NGA', kind: 'nation', stars: 4, home: '#008751', away: '#f8f9fa' },
  { id: 'cmr', name: 'Cameroun', short: 'CMR', kind: 'nation', stars: 4, home: '#007a5e', away: '#ce1126' },
  { id: 'gha', name: 'Ghana', short: 'GHA', kind: 'nation', stars: 4, home: '#f8f9fa', away: '#fcd116' },
  { id: 'egy', name: 'Égypte', short: 'EGY', kind: 'nation', stars: 4, home: '#ce1126', away: '#f8f9fa' },
  { id: 'alg', name: 'Algérie', short: 'ALG', kind: 'nation', stars: 4, home: '#f8f9fa', away: '#006233' },
  { id: 'mli', name: 'Mali', short: 'MLI', kind: 'nation', stars: 3, home: '#fcd116', away: '#14b53a' },
  { id: 'bfa', name: 'Burkina Faso', short: 'BFA', kind: 'nation', stars: 3, home: '#ef2b2d', away: '#009e49' },
  { id: 'gui', name: 'Guinée', short: 'GUI', kind: 'nation', stars: 3, home: '#ce1126', away: '#fcd116' },
  { id: 'tun', name: 'Tunisie', short: 'TUN', kind: 'nation', stars: 3, home: '#e70013', away: '#f8f9fa' },
  { id: 'rsa', name: 'Afrique du Sud', short: 'RSA', kind: 'nation', stars: 3, home: '#ffb81c', away: '#007749' },
  { id: 'cod', name: 'RD Congo', short: 'COD', kind: 'nation', stars: 3, home: '#007fff', away: '#f8f9fa' },
  { id: 'fra', name: 'France', short: 'FRA', kind: 'nation', stars: 5, home: '#1d3a8a', away: '#f8f9fa' },
  { id: 'bra', name: 'Brésil', short: 'BRA', kind: 'nation', stars: 5, home: '#ffdf00', away: '#1c4fa1' },
  { id: 'arg', name: 'Argentine', short: 'ARG', kind: 'nation', stars: 5, home: '#74acdf', away: '#212529' },
  { id: 'por', name: 'Portugal', short: 'POR', kind: 'nation', stars: 5, home: '#a51c30', away: '#f8f9fa' },
  { id: 'esp', name: 'Espagne', short: 'ESP', kind: 'nation', stars: 5, home: '#c60b1e', away: '#ffc400' },
  { id: 'eng', name: 'Angleterre', short: 'ENG', kind: 'nation', stars: 5, home: '#f8f9fa', away: '#1d3a8a' },
  { id: 'ger', name: 'Allemagne', short: 'GER', kind: 'nation', stars: 4, home: '#f8f9fa', away: '#212529' },
  { id: 'ita', name: 'Italie', short: 'ITA', kind: 'nation', stars: 4, home: '#1f63b8', away: '#f8f9fa' },
  { id: 'ned', name: 'Pays-Bas', short: 'NED', kind: 'nation', stars: 4, home: '#f76707', away: '#1d3a8a' },
]

export const TEAMS = [...CLUBS, ...NATIONS]
export const teamOf = (id: string) => TEAMS.find((t) => t.id === id) ?? CLUBS[CLUBS.length - 1]
/** A Sim's own club: its commune's, or Babi FC. */
export const clubOf = (commune?: string) => CLUBS.find((t) => t.commune && commune?.startsWith(t.commune)) ?? teamOf('babi')

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
/** How far two colours are (0 the same, about 440 black and white). */
function apart(a: string, b: string) {
  const [p, q] = [rgb(a), rgb(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/** The two shirts on the pitch: mine at home, theirs at home unless it looks like mine, then away (or white, or black). */
export function kitsFor(me: Team, them: Team): [string, string] {
  const mine = me.home
  for (const c of [them.home, them.away, '#f8f9fa', '#212529']) if (apart(mine, c) > 130) return [mine, c]
  return [mine, them.away]
}

/** How hard a side plays (the engine's Rules.foe): the difficulty chosen, a little more or less by the stars between the two sides. */
export function foeFor(level: number, me: Team, them: Team) {
  return Math.max(0.6, Math.min(1.5, level * (1 + 0.05 * (them.stars - me.stars))))
}

/** The difficulty levels. */
export const LEVELS = [
  { id: 'amateur', label: 'Amateur', foe: 0.8 },
  { id: 'semi', label: 'Semi-pro', foe: 1 },
  { id: 'pro', label: 'Pro', foe: 1.15 },
  { id: 'legende', label: 'Légende', foe: 1.3 },
] as const
