import { t } from './i18n'
import { EUROPE_BORDERS } from './europeData'
import { OC_BORDERS } from './oceanieData'

// L'Océanie (backend world/oceanie.go, the update « pays-oceanie »): its countries, their flags. No land border
// between them (OC_BORDERS lists none): a road joins only the cities of one country (Australia's, New Zealand's),
// the islands by plane.
export type OceanieId = 'au' | 'nz' | 'fj' | 'pg' | 'nc' | 'pf' | 'ws' | 'to' | 'vu'
export const OC_COUNTRIES: Record<OceanieId, { name: () => string; flag: string; land: 'oceanie' }> = {
  au: { name: () => t('Australie'), flag: '🇦🇺', land: 'oceanie' },
  nz: { name: () => t('Nouvelle-Zélande'), flag: '🇳🇿', land: 'oceanie' },
  fj: { name: () => t('Fidji'), flag: '🇫🇯', land: 'oceanie' },
  pg: { name: () => t('Papouasie-Nouvelle-Guinée'), flag: '🇵🇬', land: 'oceanie' },
  nc: { name: () => t('Nouvelle-Calédonie'), flag: '🇳🇨', land: 'oceanie' },
  pf: { name: () => t('Polynésie française'), flag: '🇵🇫', land: 'oceanie' },
  ws: { name: () => t('Samoa'), flag: '🇼🇸', land: 'oceanie' },
  to: { name: () => t('Tonga'), flag: '🇹🇴', land: 'oceanie' },
  vu: { name: () => t('Vanuatu'), flag: '🇻🇺', land: 'oceanie' },
}

for (const k of Object.keys(OC_BORDERS)) EUROPE_BORDERS[k] ??= []
