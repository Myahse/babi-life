import { t } from './i18n'

// Les Amériques (backend world/ameriques.go, the update « pays-ameriques »): Latin America's and the
// Caribbean's countries, their flags, their land (a road joins only the cities of one: Canada to Panama;
// South America, the Darién Gap between; Haïti and the Dominican Republic on Hispaniola; the other islands
// by plane only, City.island).
export type AmeriquesId = 'mx' | 'gt' | 'sv' | 'hn' | 'ni' | 'cr' | 'pa' | 'cu' | 'ht' | 'do' | 'jm' | 'pr' | 'tt' | 'gp' | 'mq' | 'co' | 've' | 'gy' | 'sr' | 'gf' | 'ec' | 'pe' | 'bo' | 'br' | 'py' | 'uy' | 'ar' | 'cl'
export const COUNTRIES_AMERIQUES: Record<AmeriquesId, { name: () => string; flag: string; land: string }> = {
  mx: { name: () => t('Mexique'), flag: '🇲🇽', land: 'amerique' },
  gt: { name: () => t('Guatemala'), flag: '🇬🇹', land: 'amerique' },
  sv: { name: () => t('Salvador'), flag: '🇸🇻', land: 'amerique' },
  hn: { name: () => t('Honduras'), flag: '🇭🇳', land: 'amerique' },
  ni: { name: () => t('Nicaragua'), flag: '🇳🇮', land: 'amerique' },
  cr: { name: () => t('Costa Rica'), flag: '🇨🇷', land: 'amerique' },
  pa: { name: () => t('Panama'), flag: '🇵🇦', land: 'amerique' },
  cu: { name: () => t('Cuba'), flag: '🇨🇺', land: 'amerique' },
  ht: { name: () => t('Haïti'), flag: '🇭🇹', land: 'amerique-hispaniola' },
  do: { name: () => t('République dominicaine'), flag: '🇩🇴', land: 'amerique-hispaniola' },
  jm: { name: () => t('Jamaïque'), flag: '🇯🇲', land: 'amerique' },
  pr: { name: () => t('Porto Rico'), flag: '🇵🇷', land: 'amerique' },
  tt: { name: () => t('Trinité-et-Tobago'), flag: '🇹🇹', land: 'amerique' },
  gp: { name: () => t('Guadeloupe'), flag: '🇬🇵', land: 'amerique' },
  mq: { name: () => t('Martinique'), flag: '🇲🇶', land: 'amerique' },
  co: { name: () => t('Colombie'), flag: '🇨🇴', land: 'amerique-sud' },
  ve: { name: () => t('Venezuela'), flag: '🇻🇪', land: 'amerique-sud' },
  gy: { name: () => t('Guyana'), flag: '🇬🇾', land: 'amerique-sud' },
  sr: { name: () => t('Suriname'), flag: '🇸🇷', land: 'amerique-sud' },
  gf: { name: () => t('Guyane'), flag: '🇬🇫', land: 'amerique-sud' },
  ec: { name: () => t('Équateur'), flag: '🇪🇨', land: 'amerique-sud' },
  pe: { name: () => t('Pérou'), flag: '🇵🇪', land: 'amerique-sud' },
  bo: { name: () => t('Bolivie'), flag: '🇧🇴', land: 'amerique-sud' },
  br: { name: () => t('Brésil'), flag: '🇧🇷', land: 'amerique-sud' },
  py: { name: () => t('Paraguay'), flag: '🇵🇾', land: 'amerique-sud' },
  uy: { name: () => t('Uruguay'), flag: '🇺🇾', land: 'amerique-sud' },
  ar: { name: () => t('Argentine'), flag: '🇦🇷', land: 'amerique-sud' },
  cl: { name: () => t('Chili'), flag: '🇨🇱', land: 'amerique-sud' },
}

/** Their activities and Canada's beyond Montréal (backend game/ameriques.go), held back while the server's answer hasn't come (features.ts). */
export const AMERIQUES_ACTS = ['toronto-tour-cn', 'ottawa-parlement', 'calgary-tour', 'winnipeg-musee', 'halifax-canon', 'halifax-quai21', 'ottawa-patin-canal', 'quebec-plaines', 'vancouver-stanley', 'edmonton-muttart', 'toronto-kensington', 'quebec-glissade', 'quebec-petit-champlain', 'vancouver-horloge', 'winnipeg-forks', 'toronto-peameal', 'ottawa-marche-by', 'vancouver-granville', 'calgary-stampede', 'halifax-homard', 'quebec-tourtiere', 'saopaulo-pastel', 'rio-agua-coco', 'rio-feijoada', 'salvador-acaraje', 'salvador-moqueca', 'cdmx-tacos', 'cdmx-churros', 'pap-griot', 'habana-ropa-vieja', 'habana-helado', 'bogota-ajiaco', 'baires-asado', 'baires-mate', 'lima-ceviche', 'caracas-arepa', 'la-paz-saltena', 'guayaquil-encebollado', 'kingston-jerk', 'port-of-spain-doubles', 'san-juan-mofongo', 'saint-domingue-bandera', 'antilles-bokit', 'antilles-colombo', 'georgetown-pepperpot', 'paramaribo-roti', 'centramerica-pupusas', 'centramerica-baleada', 'centramerica-gallo-pinto', 'guatemala-pepian', 'panama-sancocho', 'santiago-pastel-choclo', 'saopaulo-roda-samba', 'salvador-tambours', 'cdmx-danzon', 'pap-konpa', 'habana-son', 'habana-salsa', 'cartagena-champeta', 'baires-tango', 'montevideo-candombe', 'port-of-spain-steelpan', 'saint-domingue-merengue', 'antilles-gwoka', 'kingston-dancehall', 'rio-cristo', 'rio-selaron', 'saopaulo-masp', 'salvador-por-do-sol', 'cdmx-frida', 'cdmx-bellas-artes', 'cdmx-templo-mayor', 'cdmx-antropologia', 'cancun-museo-maya', 'pap-mupanah', 'pap-marron', 'pap-galerie', 'caphaitien-citadelle', 'caphaitien-sans-souci', 'habana-capitolio', 'bogota-museo-oro', 'cartagena-san-felipe', 'baires-colon', 'panama-miraflores', 'kingston-bob-marley', 'pointe-a-pitre-memorial', 'san-juan-morro', 'rio-bondinho', 'saopaulo-ibirapuera', 'bogota-monserrate', 'cartagena-murallas', 'rio-futevolei', 'cancun-letras', 'saopaulo-paulista-dimanche', 'cdmx-bandera', 'cancun-marquesita', 'habana-malecon', 'habana-vieille-voiture', 'bogota-fresques', 'baires-caminito', 'saopaulo-mortadela', 'pap-marche-fer', 'la-paz-brujas', 'salvador-fitas', 'salvador-sao-francisco', 'salvador-capoeira', 'salvador-lacerda', 'rio-maracana', 'baires-bombonera', 'bogota-tejo', 'cartagena-frutas']
