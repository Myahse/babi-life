import { t } from './i18n'
import type { City, World } from './types'
import { EUROPE_BORDERS } from './europeData'
import { MO_BORDERS } from './moyenOrientData'

// Le Moyen-Orient (backend world/moyenOrient.go, the update « pays-moyen-orient »): its countries, their flags, and
// the roads: through the land borders open to travellers (MO_BORDERS), joined to Turkey's and through it to Europe's
// (lib/pays.ts sameLand: two lands join where both countries list their borders), by Iran to Asia's.
export type MoyenOrientId = 'ae' | 'sa' | 'qa' | 'lb' | 'il' | 'jo' | 'ir' | 'kw' | 'bh' | 'om' | 'iq' | 'sy' | 'ye' | 'ps'
export const MO_COUNTRIES: Record<MoyenOrientId, { name: () => string; flag: string; land: 'moyen-orient' }> = {
  ae: { name: () => t('Émirats arabes unis'), flag: '🇦🇪', land: 'moyen-orient' },
  sa: { name: () => t('Arabie saoudite'), flag: '🇸🇦', land: 'moyen-orient' },
  qa: { name: () => t('Qatar'), flag: '🇶🇦', land: 'moyen-orient' },
  lb: { name: () => t('Liban'), flag: '🇱🇧', land: 'moyen-orient' },
  il: { name: () => t('Israël'), flag: '🇮🇱', land: 'moyen-orient' },
  jo: { name: () => t('Jordanie'), flag: '🇯🇴', land: 'moyen-orient' },
  ir: { name: () => t('Iran'), flag: '🇮🇷', land: 'moyen-orient' },
  kw: { name: () => t('Koweït'), flag: '🇰🇼', land: 'moyen-orient' },
  bh: { name: () => t('Bahreïn'), flag: '🇧🇭', land: 'moyen-orient' },
  om: { name: () => t('Oman'), flag: '🇴🇲', land: 'moyen-orient' },
  iq: { name: () => t('Irak'), flag: '🇮🇶', land: 'moyen-orient' },
  sy: { name: () => t('Syrie'), flag: '🇸🇾', land: 'moyen-orient' },
  ye: { name: () => t('Yémen'), flag: '🇾🇪', land: 'moyen-orient' },
  ps: { name: () => t('Palestine'), flag: '🇵🇸', land: 'moyen-orient' },
}

// The region's borders, added to the network (EUROPE_BORDERS, read by lib/paysEurope.ts roadLinked), without doubles.
for (const [k, l] of Object.entries(MO_BORDERS)) {
  const have = (EUROPE_BORDERS[k] ??= [])
  for (const n of l) if (!have.includes(n)) have.push(n)
}

/** The city a town without an airport is reached from (La Mecque from Djeddah, Jérusalem from Tel-Aviv, Pétra from Amman…):
 *  the nearest city of its country that has an airport, a road joining them (TravelCTA: the plane there, then the road). */
export function gatewayOf(world: World, to: City): City | null {
  let best: City | null = null
  let d = Infinity
  for (const c of world.cities) {
    if (c.id === to.id || (c.country ?? '') !== (to.country ?? '') || !world.airports?.some((a) => a.city === c.id)) continue
    const e = (c.lat - to.lat) ** 2 + (c.lng - to.lng) ** 2
    if (e < d) (d = e), (best = c)
  }
  return best
}
