import { t } from '../../lib/i18n'

// The things of the shopping list (Courses.tsx): each one's little picture as a grid of letters, each a colour of
// its palette ('.' or a letter not in it: nothing there); Courses.tsx builds it in the game's cubes.

/** The things on the shopping list: their name, their price, their picture (10 × 10). */
export const PRODUCTS: Record<string, { name: string; price: number; rows: string[]; palette: Record<string, string> }> = {
  riz: { name: t('Riz'), price: 1500, rows: ['..wwwwww..', '.wwwwwwww.', '..wkwwkw..', '.wwwwwwww.', 'wwrrrrrrww', 'wwrwrrwrww', 'wwrrrrrrww', 'wwwwwwwwww', 'wwwwwwwwww', '.wwwwwwww.'], palette: { w: '#f1ebdc', k: '#c9bfa6', r: '#e03131' } },
  huile: { name: t('Huile'), price: 1200, rows: ['....rr....', '....rr....', '...yyyy...', '..yyyyyy..', '..yywwyy..', '..yywwyy..', '..yyyyyy..', '..yyyyyy..', '..yyyyyy..', '..yyyyyy..'], palette: { r: '#e03131', y: '#f5b70a', w: '#fff3c4' } },
  sucre: { name: t('Sucre'), price: 700, rows: ['..........', '.bbbbbbbb.', '.bwwwwwwb.', '.bwwwwwwb.', '.bwbbbbwb.', '.bwbbbbwb.', '.bwwwwwwb.', '.bwwwwwwb.', '.bbbbbbbb.', '..........'], palette: { b: '#3b7ddd', w: '#ffffff' } },
  lait: { name: t('Lait'), price: 600, rows: ['..........', '..gggggg..', '.wwwwwwww.', '.wbbbbbbw.', '.wbwwwwbw.', '.wbwwwwbw.', '.wbbbbbbw.', '.wwwwwwww.', '..gggggg..', '..........'], palette: { g: '#9aa3b5', w: '#f4f6fb', b: '#1c7ed6' } },
  tomate: { name: t('Tomate'), price: 300, rows: ['..........', '..gggggg..', '.rrrrrrrr.', '.rrwrrrrr.', '.rrrrrrrr.', '.rryyyyrr.', '.rrrrrrrr.', '.rrrrrrrr.', '..gggggg..', '..........'], palette: { g: '#9aa3b5', r: '#d6262f', w: '#ff8a8a', y: '#f5b70a' } },
  oignon: { name: t('Oignons'), price: 500, rows: ['....g.....', '....gg....', '...vvv....', '..vvvvv...', '.vvwvvvv..', '.vvvvvvvv.', '.vvvvvvvv.', '..vvvvvv..', '...vvvv...', '..........'], palette: { g: '#3f9142', v: '#9c3d8f', w: '#e7b3dd' } },
  piment: { name: t('Piment'), price: 200, rows: ['......g...', '.....gg...', '....rrr...', '...rrrr...', '..rrrw....', '.rrrr.....', '.rrr......', 'rrr.......', 'rr........', '..........'], palette: { g: '#2f9e44', r: '#e03131', w: '#ff9b9b' } },
  pain: { name: t('Pain'), price: 150, rows: ['..........', '........bb', '......bbbb', '....bbdbbb', '...bbbbdb.', '..bdbbbb..', '.bbbdbb...', 'bbbbb.....', 'bbb.......', '..........'], palette: { b: '#d9a05b', d: '#a8692c' } },
  oeufs: { name: 'Œufs', price: 900, rows: ['..........', '..........', '.ee.ee.ee.', 'eeeeeeeeee', 'eweeweewee', 'eeeeeeeeee', 'kkkkkkkkkk', 'kkkkkkkkkk', '.kkkkkkkk.', '..........'], palette: { e: '#f3e3c3', w: '#fffaf0', k: '#b8a07a' } },
  savon: { name: t('Savon'), price: 350, rows: ['..........', '..........', '..gggggg..', '.gggggggg.', '.gwwgggwg.', '.gggggggg.', '.gggggggg.', '..gggggg..', '..........', '..........'], palette: { g: '#37b24d', w: '#b2f2bb' } },
  poisson: { name: t('Poisson'), price: 1800, rows: ['..........', '..........', 'b....bbbb.', 'bb.bbbbbbb', 'bbbbbbbbwb', 'bbbbbbbbbb', 'bb.bbbbbbb', 'b....bbbb.', '..........', '..........'], palette: { b: '#5c7c99', w: '#ffffff' } },
  plantain: { name: t('Banane plantain'), price: 400, rows: ['.........g', '........yg', '.......yy.', '......yyy.', '....yyyy..', '..yyyyyy..', 'yyyyyyy...', 'yyyyyk....', '.yyy......', '..........'], palette: { g: '#2f9e44', y: '#e8c42a', k: '#6b4f1d' } },
  attieke: { name: t('Attiéké'), price: 300, rows: ['..........', '....tt....', '..wwwwww..', '.wwkwwwww.', '.wwwwwkww.', '.wkwwwwww.', '.wwwwkwww.', '.wwwwwwww.', '..wwwwww..', '..........'], palette: { t: '#e8590c', w: '#f8f3e2', k: '#d8ceb4' } },
  eau: { name: t('Eau'), price: 300, rows: ['....bb....', '....ww....', '...wccw...', '..wccccw..', '..wcbbcw..', '..wcbbcw..', '..wccccw..', '..wccccw..', '..wccccw..', '...wwww...'], palette: { b: '#1c7ed6', w: '#d0ebff', c: '#74c0fc' } },
}
