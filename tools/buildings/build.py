"""The real houses the map lacks, for the game's 3D streets.

OpenStreetMap (OpenFreeMap's tiles, the game's streets) draws every street of Abidjan but not every
house: whole quarters are empty there. Overture Maps' buildings add the footprints Google (Open
Buildings, CC BY 4.0 / ODbL) and Microsoft (ML Building Footprints, ODbL) traced from satellite
images. This keeps those that OpenStreetMap doesn't have (none overlapping one of its buildings) and
writes them by zoom-14 tile, as the game reads them (web/src/world3d/open/extraBuildings.ts):

  'BB1' (3 bytes), uint32 count, then per building: uint8 n, uint8 storeys (0: unknown),
  n x (uint16 x, uint16 y): the outline (open), in 1/32768 of the tile, plus 16384 (it may spill over).

Usage (Python 3, pip install pyarrow shapely mapbox-vector-tile):
  python3 tools/buildings/build.py civ.parquet web/public/bati
where civ.parquet is Overture's buildings over the boxes below (columns id, geometry (WKB), sources,
num_floors), read from s3://overturemaps-us-west-2/release/<release>/theme=buildings/type=building/.
"""
import sys, os, math, struct, json, subprocess, collections
import pyarrow.parquet as pq
import shapely
from shapely import wkb
from shapely.strtree import STRtree
import mapbox_vector_tile

Z = 14
EXT = 32768
# Abidjan (with Bingerville, Anyama, Grand-Bassam's beach) and Yamoussoukro.
BOXES = [(-4.20, 5.18, -3.70, 5.55), (-5.35, 6.75, -5.20, 6.88)]


def tile_xy(lng, lat):
    n = 2 ** Z
    x = (lng + 180) / 360 * n
    r = math.radians(lat)
    y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
    return x, y


def tile_ll(tx, ty, px, py, ext):
    n = 2 ** Z
    X = (tx + px / ext) / n
    Y = (ty + py / ext) / n
    return X * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * Y))))


OFM = None


def ofm_buildings(tx, ty):
    """OpenStreetMap's buildings in one tile, as the game gets them (OpenFreeMap)."""
    global OFM
    if OFM is None:
        OFM = json.loads(subprocess.check_output(['curl', '-sS', '-m', '60', 'https://tiles.openfreemap.org/planet']))['tiles'][0]
    url = OFM.replace('{z}', str(Z)).replace('{x}', str(tx)).replace('{y}', str(ty))
    for _ in range(4):
        try:
            buf = subprocess.check_output(['curl', '-sS', '-f', '-m', '60', '--compressed', url])
            break
        except subprocess.CalledProcessError:
            continue
    else:
        raise SystemExit(f'OpenFreeMap tile {tx}/{ty} failed')
    if not buf:
        return []
    t = mapbox_vector_tile.decode(buf, default_options={'y_coord_down': True})
    out = []
    L = t.get('building')
    if not L:
        return out
    ext = L.get('extent', 4096)
    for f in L['features']:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']] if g['type'] == 'Polygon' else []
        for p in polys:
            ring = [tile_ll(tx, ty, x, y, ext) for x, y in p[0]]
            if len(ring) >= 4:
                try:
                    out.append(shapely.Polygon(ring).buffer(0))
                except Exception:
                    pass
    return out


def main(src, dst):
    t = pq.read_table(src, columns=['geometry', 'sources', 'num_floors'])
    geoms = t['geometry'].to_pylist()
    srcs = t['sources'].to_pylist()
    floors = t['num_floors'].to_pylist()
    by_tile = collections.defaultdict(list)
    for g, s, fl in zip(geoms, srcs, floors):
        if not s or s[0]['dataset'] == 'OpenStreetMap':
            continue
        p = wkb.loads(g)
        if p.geom_type == 'MultiPolygon':
            p = max(p.geoms, key=lambda q: q.area)
        if p.geom_type != 'Polygon':
            continue
        c = p.centroid
        if not any(b[0] <= c.x <= b[2] and b[1] <= c.y <= b[3] for b in BOXES):
            continue
        x, y = tile_xy(c.x, c.y)
        by_tile[(int(x), int(y))].append((p, fl or 0))
    os.makedirs(dst, exist_ok=True)
    kept = total = 0
    sizes = 0
    for i, ((tx, ty), items) in enumerate(sorted(by_tile.items())):
        osm = ofm_buildings(tx, ty)
        tree = STRtree(osm) if osm else None
        out = bytearray()
        n = 0
        for p, fl in items:
            total += 1
            # A metre-scale check: lat/lng degrees to metres here (the cos of the latitude).
            k = math.cos(math.radians(p.centroid.y))
            area = p.area * (111320 ** 2) * k
            if area < 12:
                continue
            if tree is not None:
                clash = False
                for j in tree.query(p):
                    o = osm[j]
                    try:
                        inter = p.intersection(o).area
                    except Exception:
                        continue
                    if inter > 0.2 * min(p.area, o.area):
                        clash = True
                        break
                if clash:
                    continue
            q = p.simplify(0.3 / 111320, preserve_topology=True)
            ring = list(q.exterior.coords)[:-1]
            if len(ring) < 3 or len(ring) > 255:
                continue
            pts = []
            ok = True
            for lng, lat in ring:
                x, y = tile_xy(lng, lat)
                px = round((x - tx) * EXT) + 16384
                py = round((y - ty) * EXT) + 16384
                if not (0 <= px < 65536 and 0 <= py < 65536):
                    ok = False
                    break
                pts.append((px, py))
            if not ok:
                continue
            out += struct.pack('<BB', len(pts), min(int(fl), 255))
            for px, py in pts:
                out += struct.pack('<HH', px, py)
            n += 1
        if n:
            os.makedirs(f'{dst}/{tx}', exist_ok=True)
            with open(f'{dst}/{tx}/{ty}.bin', 'wb') as fh:
                fh.write(b'BB1' + struct.pack('<I', n) + out)
            sizes += len(out) + 7
        kept += n
        print(f'{i + 1}/{len(by_tile)} {tx}/{ty} {n}/{len(items)}', flush=True)
    print('kept', kept, 'of', total, 'bytes', sizes)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
