// The soirées players throw at home (backend sims/party.go, game/soiree.go):
// what one costs the host, how long it lasts, and its themes with their
// colours (the beams over the house, the bulbs, the sign).

export const SOIREE_COST = 5000
export const SOIREE_HOURS = 3

export const SOIREE_THEMES: { id: string; label: string; colours: string[] }[] = [
  { id: 'coupe-decale', label: 'Soirée coupé-décalé', colours: ['#ff2d95', '#ffe600', '#2ee6ff'] },
  { id: 'zouglou', label: 'Soirée zouglou', colours: ['#f07a12', '#ffffff', '#0b9a52'] },
  { id: 'anniversaire', label: 'Anniversaire', colours: ['#ff8fab', '#ffd166', '#06d6a0'] },
  { id: 'blanche', label: 'Soirée blanche', colours: ['#ffffff', '#cfe8ff', '#ffd6f5'] },
  { id: 'pagne', label: 'Soirée pagne', colours: ['#f4a261', '#e76f51', '#2a9d8f'] },
  { id: 'cremaillere', label: 'Crémaillère', colours: ['#ffd166', '#ef476f', '#118ab2'] },
  { id: 'afro', label: 'Soirée afrobeats', colours: ['#a35bff', '#ff2d95', '#ffe600'] },
  { id: 'retro', label: 'Soirée rétro', colours: ['#ff6b6b', '#4ecdc4', '#ffe66d'] },
]

export const soireeColours = (theme: string) => (SOIREE_THEMES.find((t) => t.id === theme) ?? SOIREE_THEMES[0]).colours
