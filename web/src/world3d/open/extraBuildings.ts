import { tilePoint } from './geo'
import { tileFetch } from '../../lib/tileCache'

// The real houses the map doesn't draw. OpenStreetMap (and Mapbox, much the same there) has every
// street of Abidjan but leaves whole quarters without their houses; Google's and Microsoft's
// footprints, traced from satellite images (Overture Maps' buildings, open data), have them. The ones
// the map lacks are kept by zoom-14 tile in public/bati/ (tools/buildings/build.py) and laid in the
// street with the map's own (tiles.ts mergeExtras); where there are none, the game's houses as before
// (fill.ts). Format: 'BB1', uint32 count, then per building uint8 n, uint8 storeys (0: unknown), n ×
// (uint16 x, uint16 y) in 1/32768 of the tile plus 16384.

export const EXTRA_ZOOM = 14
const EXT = 32768
const PAD = 16384

/** One real house: its outline (lng, lat pairs, open) and its storeys (0: unknown). */
export type ExtraBuilding = { ll: Float64Array; storeys: number }

const cache = new Map<string, Promise<ExtraBuilding[]>>()
const BASE = (import.meta.env?.BASE_URL as string | undefined) ?? '/'

function decode(buf: ArrayBuffer, tx: number, ty: number): ExtraBuilding[] {
  const v = new DataView(buf)
  // (A missing tile can come back as the site's page: not one of ours, nothing there.)
  if (buf.byteLength < 7 || v.getUint8(0) !== 66 || v.getUint8(1) !== 66 || v.getUint8(2) !== 49) return []
  const count = v.getUint32(3, true)
  const out: ExtraBuilding[] = []
  let o = 7
  for (let i = 0; i < count && o + 2 <= buf.byteLength; i++) {
    const n = v.getUint8(o)
    const storeys = v.getUint8(o + 1)
    o += 2
    if (o + n * 4 > buf.byteLength) break
    const ll = new Float64Array(n * 2)
    for (let k = 0; k < n; k++) {
      const p = tilePoint(tx, ty, EXTRA_ZOOM, v.getUint16(o, true) - PAD, v.getUint16(o + 2, true) - PAD, EXT)
      ll[k * 2] = p.lng
      ll[k * 2 + 1] = p.lat
      o += 4
    }
    out.push({ ll, storeys })
  }
  return out
}

/** The real houses of a zoom-14 tile the map doesn't draw (none where there are none, or offline without them). */
export function extraTile(tx: number, ty: number, signal?: AbortSignal): Promise<ExtraBuilding[]> {
  const key = `${tx}/${ty}`
  let p = cache.get(key)
  if (!p) {
    p = tileFetch(`bati/v1/${key}`, `${BASE}bati/${key}.bin`, signal)
      .then(async (res) => (res.ok ? decode(await res.arrayBuffer(), tx, ty) : []))
      .catch(() => [])
    cache.set(key, p)
    if (cache.size > 40) cache.delete(cache.keys().next().value!)
  }
  return p
}
