import type { City } from './types'
import { t } from './i18n'

// L'Afrique (backend world/afrique.go, the update « pays-afrique »): the continent's countries, their flags, and
// which of them a road joins (a border open between them, or a great corridor both ends stand on: the coast
// from Abidjan to Lagos, the road of Bamako and Dakar, the road of Ouaga and Niamey). The same as the server's.
export type AfriqueId =
  | 'sn' | 'ml' | 'gh' | 'gn' | 'tg' | 'bj' | 'ng' | 'ne' | 'lr' | 'sl' | 'gm' | 'gw' | 'cv' | 'mr'
  | 'cm' | 'ga' | 'cg' | 'cd' | 'td' | 'cf' | 'gq'
  | 'ma' | 'dz' | 'tn' | 'eg' | 'ly'
  | 'et' | 'ke' | 'tz' | 'ug' | 'rw' | 'sd' | 'so' | 'dj' | 'mg'
  | 'za' | 'ao' | 'mz' | 'zm' | 'zw' | 'na' | 'bw'

type Land = { name: () => string; flag: string; land: 'afrique' }
export const AFRIQUE_COUNTRIES: Record<AfriqueId, Land> = {
  sn: { name: () => t('Sénégal'), flag: '🇸🇳', land: 'afrique' },
  ml: { name: () => t('Mali'), flag: '🇲🇱', land: 'afrique' },
  gh: { name: () => t('Ghana'), flag: '🇬🇭', land: 'afrique' },
  gn: { name: () => t('Guinée'), flag: '🇬🇳', land: 'afrique' },
  tg: { name: () => t('Togo'), flag: '🇹🇬', land: 'afrique' },
  bj: { name: () => t('Bénin'), flag: '🇧🇯', land: 'afrique' },
  ng: { name: () => t('Nigeria'), flag: '🇳🇬', land: 'afrique' },
  ne: { name: () => t('Niger'), flag: '🇳🇪', land: 'afrique' },
  lr: { name: () => t('Liberia'), flag: '🇱🇷', land: 'afrique' },
  sl: { name: () => t('Sierra Leone'), flag: '🇸🇱', land: 'afrique' },
  gm: { name: () => t('Gambie'), flag: '🇬🇲', land: 'afrique' },
  gw: { name: () => t('Guinée-Bissau'), flag: '🇬🇼', land: 'afrique' },
  cv: { name: () => t('Cap-Vert'), flag: '🇨🇻', land: 'afrique' },
  mr: { name: () => t('Mauritanie'), flag: '🇲🇷', land: 'afrique' },
  cm: { name: () => t('Cameroun'), flag: '🇨🇲', land: 'afrique' },
  ga: { name: () => t('Gabon'), flag: '🇬🇦', land: 'afrique' },
  cg: { name: () => t('Congo'), flag: '🇨🇬', land: 'afrique' },
  cd: { name: () => t('RD Congo'), flag: '🇨🇩', land: 'afrique' },
  td: { name: () => t('Tchad'), flag: '🇹🇩', land: 'afrique' },
  cf: { name: () => t('Centrafrique'), flag: '🇨🇫', land: 'afrique' },
  gq: { name: () => t('Guinée équatoriale'), flag: '🇬🇶', land: 'afrique' },
  ma: { name: () => t('Maroc'), flag: '🇲🇦', land: 'afrique' },
  dz: { name: () => t('Algérie'), flag: '🇩🇿', land: 'afrique' },
  tn: { name: () => t('Tunisie'), flag: '🇹🇳', land: 'afrique' },
  eg: { name: () => t('Égypte'), flag: '🇪🇬', land: 'afrique' },
  ly: { name: () => t('Libye'), flag: '🇱🇾', land: 'afrique' },
  et: { name: () => t('Éthiopie'), flag: '🇪🇹', land: 'afrique' },
  ke: { name: () => t('Kenya'), flag: '🇰🇪', land: 'afrique' },
  tz: { name: () => t('Tanzanie'), flag: '🇹🇿', land: 'afrique' },
  ug: { name: () => t('Ouganda'), flag: '🇺🇬', land: 'afrique' },
  rw: { name: () => t('Rwanda'), flag: '🇷🇼', land: 'afrique' },
  sd: { name: () => t('Soudan'), flag: '🇸🇩', land: 'afrique' },
  so: { name: () => t('Somalie'), flag: '🇸🇴', land: 'afrique' },
  dj: { name: () => t('Djibouti'), flag: '🇩🇯', land: 'afrique' },
  mg: { name: () => t('Madagascar'), flag: '🇲🇬', land: 'afrique' },
  za: { name: () => t('Afrique du Sud'), flag: '🇿🇦', land: 'afrique' },
  ao: { name: () => t('Angola'), flag: '🇦🇴', land: 'afrique' },
  mz: { name: () => t('Mozambique'), flag: '🇲🇿', land: 'afrique' },
  zm: { name: () => t('Zambie'), flag: '🇿🇲', land: 'afrique' },
  zw: { name: () => t('Zimbabwe'), flag: '🇿🇼', land: 'afrique' },
  na: { name: () => t('Namibie'), flag: '🇳🇦', land: 'afrique' },
  bw: { name: () => t('Botswana'), flag: '🇧🇼', land: 'afrique' },
}
export const AFRIQUE_IDS = Object.keys(AFRIQUE_COUNTRIES) as AfriqueId[]

// The borders open to the road (Morocco–Algeria closed since 1994), and the corridors (backend afriqueBorders, afriqueCorridors).
const BORDERS = 'ci-lr ci-gn ci-ml ci-bf ci-gh bf-ml bf-ne bf-bj bf-tg bf-gh sn-mr sn-ml sn-gn sn-gw sn-gm ml-mr ml-dz ml-ne ml-gn gh-tg tg-bj bj-ne bj-ng gn-gw gn-lr gn-sl lr-sl ng-ne ng-td ng-cm ne-dz ne-ly ne-td mr-dz cm-td cm-cf cm-cg cm-ga cm-gq ga-gq ga-cg cg-cf cg-cd cg-ao cd-cf cd-ug cd-rw cd-zm cd-ao td-ly td-sd td-cf cf-sd dz-tn dz-ly tn-ly eg-ly eg-sd ly-sd et-so et-dj et-ke et-sd so-ke so-dj ke-tz ke-ug tz-ug tz-rw tz-zm tz-mz ug-rw za-na za-bw za-zw za-mz ao-na ao-zm mz-zm mz-zw zm-zw zm-bw zm-na zw-bw na-bw'
const OPEN = new Set(BORDERS.split(' ').flatMap((p) => [p, p.split('-').reverse().join('-')]))
const CORRIDORS = [
  ['abidjan', 'accra', 'lome', 'cotonou', 'lagos'],
  ['abidjan', 'bamako', 'dakar'],
  ['abidjan', 'ouagadougou', 'niamey'],
]
const african = (k: string) => k === 'ci' || k === 'bf' || k in AFRIQUE_COUNTRIES

/** Whether a road joins two cities of one land (pays.ts sameLand): the same country, a border open, a corridor; outside Africa, the land decides. */
export function roadAcross(a: Pick<City, 'country' | 'id'>, b: Pick<City, 'country' | 'id'>) {
  const x = a.country ?? 'ci'
  const y = b.country ?? 'ci'
  if (x === y || !african(x) || !african(y)) return true
  return OPEN.has(`${x}-${y}`) || CORRIDORS.some((c) => c.includes(a.id) && c.includes(b.id))
}

/** The update's activities (backend game/afrique.go AfriqueActs): held back while the server's answer hasn't come (lib/features.ts). */
export const AFRIQUE_ACTS: string[] = ['sn-thieboudiene', 'sn-dibiterie', 'sn-yassa', 'ml-to-feuilles', 'ml-capitaine', 'gn-riz-feuille', 'ne-kilichi', 'gh-fufu', 'gh-waakye', 'gh-kelewele', 'ng-jollof', 'ng-suya', 'ng-amala', 'lr-cookshop', 'cv-cachupa', 'cm-ndole', 'cm-poisson-braise', 'cd-liboke', 'td-boule', 'ma-tajine', 'ma-couscous-vendredi', 'eg-koshari', 'ly-bazin', 'et-injera', 'ke-nyama-choma', 'tz-chipsi-mayai', 'ug-rolex', 'rw-brochettes', 'mg-romazava', 'za-braai', 'za-kota', 'za-bobotie', 'zm-nshima', 'ao-muamba', 'tg-fufu', 'tg-akoume', 'bj-wagashi', 'tg-tchoukoutou', 'sn-sandaga', 'sn-soumbedioune', 'gh-kente', 'gh-makola', 'tg-nana-benz', 'bj-dantokpa', 'ng-balogun', 'ng-computer-village', 'ml-grand-marche', 'ma-souks', 'et-merkato', 'cm-mokolo', 'sn-renaissance', 'sn-goree-memoire', 'bj-non-retour', 'gh-nkrumah', 'gh-manhyia', 'ng-freedom-park', 'ng-nike-art', 'ml-musee', 'lr-providence', 'cm-reunification', 'ma-hassan', 'ma-oudayas', 'ma-bahia', 'eg-pyramides', 'eg-sphinx', 'eg-son-lumiere', 'eg-musee', 'eg-bibliotheque', 'et-lucy', 'rw-memorial', 'za-soweto', 'za-apartheid', 'za-robben', 'mg-rova', 'tz-stone-town', 'ke-fort-jesus', 'sn-divinite-visite', 'ma-hassan2-visite', 'ng-mosquee-nationale', 'ci-basilique-visite', 'lekki-canopee', 'ng-aso-rock', 'gm-crocodiles', 'ke-safari-ville', 'za-table-mountain', 'zw-chutes', 'ma-majorelle', 'eg-chameau', 'eg-felouque', 'sd-confluent', 'tz-epices', 'ke-boutre', 'mg-anosy', 'sn-surf', 'gh-labadi', 'cv-plage', 'ma-jemaa-soir', 'gh-black-star', 'gh-oxford-street', 'sn-pont-faidherbe', 'za-bokaap', 'tz-forodhani', 'et-meskel', 'ng-shrine', 'sn-mbalax', 'gh-highlife', 'cv-morna', 'cd-rumba', 'za-amapiano', 'ml-djembe', 'sn-ataya', 'et-buna', 'ma-cafe-maure', 'sn-lutte', 'gn-syli', 'ne-croix-agadez', 'sn-grand-boubou', 'ma-hammam']
