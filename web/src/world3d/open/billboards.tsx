import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'
import { LANDMARK_GROUND, LANDMARKS } from './landmarks'
import { onFieldGround, type Field } from './places'
import { Solid } from '../Solid'
import { t as tr } from '../../lib/i18n'

// The ad boards of the streets, in the formats one sees in Abidjan:
// - the 4×3 (here 12 × 6 m) on its two legs along the big roads;
// - the giant (« unipole », 20 × 7 m, both faces) on one pole by the boulevards;
// - the sucettes (backlit panels on the sidewalks, both faces), many of them;
// - the banderoles stretched across a street between two poles;
// - the LED screens at the big crossroads.
// They show the ads of Babi Pub (backend/internal/ads, web/src/screens/Pub.tsx):
// the approved, paid ads of the day for the commune, a poster or a video, in
// turn, the same one at the same moment on every screen (the shared clock).
// With none, a bright « TA PUB ICI » in the board's own format: the boards are
// for sale, and they should be seen. Passing in front counts a view: by
// commune and day, nobody is tracked. During the campaign (backend
// politics.posters), the sucettes, the banderoles and some of the big boards
// carry the candidates' posters instead, in their party's colours.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

export type BoardFormat = '4x3' | 'geant' | 'sucette' | 'banderole' | 'led'
type Board = { id: string; at: XZ; rot: number; seed: number; format?: BoardFormat; /** A banderole: the street's width between its poles. */ span?: number; /** At a particular place: shown before the others. */ featured?: boolean }
type Ad = { id: string; advertiser: string; title: string; type: 'image' | 'video'; url: string }
/** A candidate's poster on the walls of the commune (backend politics.posters). */
type Poster = { name: string; acronym?: string; color: string; slogan?: string; kind: 'president' | 'maire'; points: number }
const POSTER = 'affiche:'

const NEAR = 450 // metres: boards drawn around the Sim
const MAX = 16
const TURN = 12 // seconds each ad stays up
const SEEN = 60 // metres: close enough to count a view
/** Each format's panel (metres): width, height, the panel's middle above the ground; both faces or one; how far it's seen from. */
const FORMATS: Record<BoardFormat, { w: number; h: number; y: number; both: boolean; far: number; label: string; size: string }> = {
  '4x3': { w: 12, h: 6, y: 9, both: false, far: NEAR, label: tr('Panneau'), size: '12 × 6 m' },
  geant: { w: 20, h: 7, y: 17, both: true, far: NEAR, label: tr('Géant'), size: '20 × 7 m' },
  sucette: { w: 1.4, h: 2, y: 1.6, both: true, far: 160, label: 'Sucette', size: '1,2 × 1,8 m' },
  banderole: { w: 10, h: 1.6, y: 6, both: true, far: 260, label: tr('Banderole'), size: 'en travers de la rue' },
  led: { w: 9, h: 5, y: 8.5, both: true, far: NEAR, label: tr('Écran LED'), size: '9 × 5 m' },
}

/** The places that get their own big board at the door: where crowds go. */
const FEATURED: Record<string, BoardFormat> = { stade: 'led', club: 'led', mall: 'led', transport: 'led', aeroport: 'led', karting: 'led', market: 'geant', station: 'geant', zoo: 'geant', hotel: 'geant', universite: 'geant', beach: 'geant', culture: 'led' }

export function Billboards({ nav, seed, night, places = [] }: { nav: Nav; seed: string; night: boolean; /** The places of the quarter: the big ones get a board of their own. */ places?: { id: string; kind: string; x: number; z: number; door: XZ; field?: Field }[] }) {
  // Always at the same spots: along the roads by their size (the more road, the more boards), set back from the edge, facing the traffic.
  const all = useMemo(() => {
    const out: Board[] = []
    const add = (format: BoardFormat, at: XZ, rot: number, span?: number, featured?: boolean) => {
      // Room for it: no building of any kind, no pitch (nav.free), round its feet and its panel's width.
      if (!nav.free(at[0], at[1], format === 'banderole' ? 0.5 : FORMATS[format].w / 2)) return
      // Never standing on a roadway (a crossing street, a boulevard beside): only the banderole spans one, high above it.
      // (Its feet: the pole of a sucette, a giant or a screen; the two legs of a 4×3.)
      const across = format === '4x3' ? FORMATS[format].w * 0.35 : 0
      const feet: XZ[] = across ? [at, [at[0] + Math.cos(rot) * across, at[1] - Math.sin(rot) * across], [at[0] - Math.cos(rot) * across, at[1] + Math.sin(rot) * across]] : [at]
      if (format !== 'banderole' && feet.some((q) => nav.onRoadway(q, 0.8))) return
      // Never on a pitch or a court (its fence and a few metres round it).
      if (places.some((p) => p.field && onFieldGround(p.field, at, FORMATS[format].w / 2 + 3))) return
      // Not on a landmark's own ground (in its frame: +z through its door).
      for (const p of places) {
        const g = LANDMARK_GROUND[p.id]
        if (!g) continue
        const rot = Math.atan2(p.door[0] - p.x, p.door[1] - p.z)
        const [dx, dz] = [at[0] - p.x, at[1] - p.z]
        const [lx, lz] = [dx * Math.cos(rot) - dz * Math.sin(rot), dx * Math.sin(rot) + dz * Math.cos(rot)]
        if (lx > g[0] - 2 && lx < g[1] + 2 && lz > g[2] - 2 && lz < g[3] + 2) return
      }
      // Not two boards on top of each other.
      if (out.some((o) => Math.hypot(o.at[0] - at[0], o.at[1] - at[1]) < (format === 'sucette' ? 12 : 30))) return
      out.push({ id: `pub:${format}:${Math.round(at[0])}:${Math.round(at[1])}`, at, rot, seed: hash(at[0], at[1], 9), format, span, featured })
    }
    // First the particular places: the landmarks (a giant and an LED screen), the stadiums, markets, malls, gares, clubs… (one at the door).
    for (const p of places) {
      const big = LANDMARKS[p.id]
      const format = big ? 'led' : FEATURED[p.kind]
      if (!format) continue
      // Outwards from the place, through its door; the board beside the door, turned to the street.
      const [ox, oz] = [p.door[0] - p.x, p.door[1] - p.z]
      const ol = Math.hypot(ox, oz) || 1
      const [ux, uz] = [ox / ol, oz / ol]
      const turn = Math.atan2(ux, uz)
      for (const [side, f] of (big ? [[1, 'led'], [-1, 'geant']] : [[hash(p.x, p.z, 5) < 0.5 ? 1 : -1, format]]) as [number, BoardFormat][]) {
        // (Past the ends of a landmark's own ground, when it has one.)
        const ground = LANDMARK_GROUND[p.id]
        const aside = ground ? Math.max(-ground[0], ground[1]) + 6 : big ? Math.min(big, 40) * 0.6 : 9
        for (const back of [2, -4, 6]) {
          const at: XZ = [p.door[0] + uz * aside * side - ux * back, p.door[1] - ux * aside * side - uz * back]
          const n = out.length
          add(f, at, turn, undefined, true)
          if (out.length > n) break
        }
      }
    }
    for (const e of nav.edges) {
      if (e.len < 12 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      const side = hash(Math.round(m[1]), 17) < 0.5 ? 1 : -1
      const roll = hash(Math.round(m[0]), Math.round(m[1]), 4242)
      // A chance by the metre: a long stretch gets more.
      const per = (k: number) => roll < Math.min(0.9, (k * e.len) / 100)
      const beside = (off: number, s = side): XZ => [m[0] - uz * off * s, m[1] + ux * off * s]
      const facing = (s = side) => Math.atan2(uz * s, -ux * s)
      if (e.width >= 12 && per(0.1)) add('geant', beside(e.width / 2 + 7), facing())
      else if (e.width >= 9 && per(0.35)) add('4x3', beside(e.width / 2 + 5), facing())
      else if (e.width >= 6 && e.width < 12 && per(0.05)) add('banderole', m, facing() + Math.PI / 2, e.width + 3)
      else if (e.width >= 6 && per(0.45)) add('sucette', beside(e.width / 2 + 1.6, -side), facing(-side) + Math.PI / 2)
    }
    // The LED screens: on a corner of a crossroads of wide roads.
    nav.adj.forEach((links, i) => {
      if (links.length < 3 || nav.ys[i] || Math.max(...links.map((l) => l.width)) < 10) return
      const [x, z] = nav.nodes[i]
      if (hash(Math.round(x), Math.round(z), 777) > 0.25) return
      const w = Math.max(...links.map((l) => l.width))
      const a = hash(Math.round(z), Math.round(x), 31) * Math.PI * 2
      add('led', [x + Math.cos(a) * (w / 2 + 8), z + Math.sin(a) * (w / 2 + 8)], Math.atan2(-Math.cos(a), -Math.sin(a)))
    })
    return out
  }, [nav, places])

  // The day's ads for the commune, again every five minutes.
  const [ads, setAds] = useState<Ad[]>([])
  useEffect(() => {
    let stop = false
    const load = () =>
      fetch(`${BASE}/ads/live?commune=${encodeURIComponent(seed)}`)
        .then((r) => (r.ok ? r.json() : []))
        // (Only those for the billboards: some go to the apps only, lib/ads.ts.)
        .then((list: (Ad & { places?: string[] })[]) => !stop && setAds(Array.isArray(list) ? list.filter((a) => !a.places?.length || a.places.includes('panneaux')) : []))
        .catch(() => undefined)
    void load()
    const t = setInterval(load, 5 * 60_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [seed])

  // The campaign's posters in the commune, while it's on (as ads: drawn on a canvas, never counted as views).
  const [campaign, setCampaign] = useState<Ad[]>([])
  useEffect(() => {
    let stop = false
    const load = () =>
      fetch(`${BASE}/politics/affiches?commune=${encodeURIComponent(seed)}`)
        .then((r) => (r.ok ? r.json() : { posters: [] }))
        .then((r: { posters?: Poster[] }) => !stop && setCampaign((r.posters ?? []).map((p) => ({ id: POSTER + p.kind + p.name, advertiser: p.name, title: p.acronym ?? '', type: 'image', url: POSTER + JSON.stringify(p) }))))
        .catch(() => undefined)
    void load()
    const t = setInterval(load, 5 * 60_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [seed])

  // The views, sent once a minute (and when leaving).
  const views = useRef<Record<string, number>>({})
  useEffect(() => {
    const flush = () => {
      const v = views.current
      if (!Object.keys(v).length) return
      views.current = {}
      void fetch(`${BASE}/ads/views`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commune: seed, views: v }), keepalive: true }).catch(() => undefined)
    }
    const t = setInterval(flush, 60_000)
    return () => {
      clearInterval(t)
      flush()
    }
  }, [seed])

  const [shown, setShown] = useState<Board[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = all
      .map((b) => ({ b, d: Math.hypot(b.at[0] - sx, b.at[1] - sz) }))
      .filter((x) => x.d < FORMATS[x.b.format ?? '4x3'].far)
      .sort((p, q) => p.d - (p.b.featured ? 200 : 0) - (q.d - (q.b.featured ? 200 : 0)))
      .slice(0, MAX)
      .map((x) => x.b)
    if (near.map((b) => b.id).join() !== shown.map((b) => b.id).join()) setShown(near)
  })

  return (
    <>
      {shown.map((b) => (
        <Billboard key={b.id} board={b} ads={campaign.length && (b.format === 'sucette' || b.format === 'banderole' || b.seed < 0.3) ? campaign : ads} night={night} onSeen={(id) => !id.startsWith(POSTER) && (views.current[id] = (views.current[id] ?? 0) + 1)} />
      ))}
    </>
  )
}

const steel = new THREE.MeshLambertMaterial({ color: '#5b6068' })
const frame = new THREE.MeshLambertMaterial({ color: '#2b2f3a' })
const BOX = new THREE.BoxGeometry(1, 1, 1)

/** Textures by URL, shared by every board (a video plays once for all). */
const textures = new Map<string, { tex: THREE.Texture; video?: HTMLVideoElement }>()
function textureOf(ad: Ad) {
  let t = textures.get(ad.url)
  if (!t) {
    if (ad.url.startsWith(POSTER)) {
      t = { tex: posterTexture(JSON.parse(ad.url.slice(POSTER.length)) as Poster) }
    } else if (ad.type === 'video') {
      const v = document.createElement('video')
      v.crossOrigin = 'anonymous'
      v.src = ad.url
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.preload = 'none'
      const tex = new THREE.VideoTexture(v)
      tex.colorSpace = THREE.SRGBColorSpace
      t = { tex, video: v }
    } else {
      const tex = new THREE.TextureLoader().setCrossOrigin('anonymous').load(ad.url)
      tex.colorSpace = THREE.SRGBColorSpace
      t = { tex }
    }
    textures.set(ad.url, t)
  }
  return t
}

/** A campaign poster: the party's colour, « VOTEZ », the name, the party, the election, the slogan. */
function posterTexture(p: Poster) {
  const c = document.createElement('canvas')
  c.width = 768
  c.height = 1024
  const g = c.getContext('2d')!
  const [W, H] = [c.width, c.height]
  g.fillStyle = p.color || '#ff7a00'
  g.fillRect(0, 0, W, H)
  // A white band across, the name on it; the party's sigle in a disc above.
  g.fillStyle = '#ffffff'
  g.fillRect(0, H * 0.5, W, H * 0.2)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const fit = (text: string, size: number, max: number) => {
    g.font = tr('900 {size}px Anton, Impact, sans-serif', { size })
    const w = g.measureText(text).width
    if (w > max) g.font = tr('900 {0}px Anton, Impact, sans-serif', { 0: (size * max) / w })
  }
  g.fillStyle = '#ffffff'
  fit('VOTEZ', H * 0.14, W * 0.9)
  g.fillText('VOTEZ', W / 2, H * 0.12)
  if (p.acronym) {
    g.beginPath()
    g.arc(W / 2, H * 0.33, H * 0.12, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = p.color || '#ff7a00'
    fit(p.acronym, H * 0.09, H * 0.2)
    g.fillText(p.acronym, W / 2, H * 0.335)
  }
  g.fillStyle = '#1b1b2f'
  fit(p.name.toUpperCase(), H * 0.1, W * 0.9)
  g.fillText(p.name.toUpperCase(), W / 2, H * 0.6)
  g.fillStyle = '#ffffff'
  fit(p.kind === 'president' ? tr('PRÉSIDENTIELLE') : 'MUNICIPALES', H * 0.06, W * 0.9)
  g.fillText(p.kind === 'president' ? tr('PRÉSIDENTIELLE') : 'MUNICIPALES', W / 2, H * 0.78)
  if (p.slogan) {
    g.font = tr('italic 700 {0}px sans-serif', { 0: H * 0.045 })
    const k = Math.min(1, (W * 0.9) / g.measureText(`« ${p.slogan} »`).width)
    g.font = tr('italic 700 {0}px sans-serif', { 0: H * 0.045 * k })
    g.fillText(`« ${p.slogan} »`, W / 2, H * 0.89)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** What an empty board says, in its own format: « TA PUB ICI », bright, the format and the address. */
const placeholders = new Map<BoardFormat, THREE.Texture>()
function houseAd(format: BoardFormat) {
  const had = placeholders.get(format)
  if (had) return had
  const f = FORMATS[format]
  const c = document.createElement('canvas')
  const k = 1024 / Math.max(f.w, f.h)
  c.width = Math.round(f.w * k)
  c.height = Math.round(f.h * k)
  const g = c.getContext('2d')!
  const [W, H] = [c.width, c.height]
  const tall = H > W
  // The colours of the game: orange, white, green, a dark ink.
  g.fillStyle = '#ff8200'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#009a44'
  g.fillRect(0, H * (tall ? 0.82 : 0.78), W, H)
  g.fillStyle = '#ffffff'
  g.fillRect(0, H * (tall ? 0.8 : 0.75), W, H * 0.03)
  // A dashed white frame: the space to fill.
  g.setLineDash([W * 0.03, W * 0.02])
  g.lineWidth = Math.max(4, Math.min(W, H) * 0.025)
  g.strokeStyle = '#ffffff'
  g.strokeRect(g.lineWidth * 2, g.lineWidth * 2, W - g.lineWidth * 4, H * (tall ? 0.8 : 0.75) - g.lineWidth * 3)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const fit = (text: string, size: number, max: number) => {
    g.font = tr('900 {size}px Anton, Impact, sans-serif', { size })
    const w = g.measureText(text).width
    if (w > max) g.font = tr('900 {0}px Anton, Impact, sans-serif', { 0: (size * max) / w })
  }
  g.fillStyle = '#1b1b2f'
  if (format === 'banderole') {
    fit(tr('TA PUB ICI · lifeinbabi.com/pub'), H * 0.55, W * 0.92)
    g.fillText(tr('TA PUB ICI · lifeinbabi.com/pub'), W / 2, H * 0.4)
  } else {
    fit(tr('TA PUB'), H * (tall ? 0.16 : 0.3), W * 0.86)
    g.fillText(tr('TA PUB'), W / 2, H * (tall ? 0.22 : 0.24))
    g.fillStyle = '#ffffff'
    fit('ICI', H * (tall ? 0.2 : 0.3), W * 0.86)
    g.fillText('ICI', W / 2, H * (tall ? 0.42 : 0.52))
    g.fillStyle = '#1b1b2f'
    fit(`${f.label} · ${f.size}`, H * (tall ? 0.06 : 0.08), W * 0.86)
    g.fillText(`${f.label} · ${f.size}`, W / 2, H * (tall ? 0.62 : 0.68))
    g.fillStyle = '#ffffff'
    fit('lifeinbabi.com/pub', H * (tall ? 0.065 : 0.1), W * 0.9)
    g.fillText('lifeinbabi.com/pub', W / 2, H * (tall ? 0.91 : 0.885))
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  placeholders.set(format, tex)
  return tex
}

/** An ad's picture fitted to a panel (cropped to fill it, as a printed poster would be), shared by the boards of one shape. */
const fitted = new Map<string, THREE.Texture>()
function fittedTexture(ad: Ad, aspect: number) {
  const key = `${ad.url}|${aspect.toFixed(2)}`
  let t = fitted.get(key)
  if (!t) {
    const base = textureOf(ad).tex
    const tex = base.clone()
    tex.source = base.source
    const fit = () => {
      const img = tex.image as { width?: number; height?: number; videoWidth?: number; videoHeight?: number } | undefined
      const [iw, ih] = [img?.videoWidth || img?.width || 0, img?.videoHeight || img?.height || 0]
      if (!iw || !ih) return false
      const a = iw / ih
      if (a > aspect) {
        tex.repeat.set(aspect / a, 1)
        tex.offset.set((1 - aspect / a) / 2, 0)
      } else {
        tex.repeat.set(1, a / aspect)
        tex.offset.set(0, (1 - a / aspect) / 2)
      }
      tex.needsUpdate = true
      return true
    }
    if (!fit()) {
      const timer = setInterval(() => fit() && clearInterval(timer), 500)
      setTimeout(() => clearInterval(timer), 30_000)
    }
    fitted.set(key, tex)
    t = tex
  }
  return t
}

export function Billboard({ board, ads, night, onSeen }: { board: Board; ads: Ad[]; night: boolean; onSeen: (id: string) => void }) {
  const format = board.format ?? '4x3'
  const f = format === 'banderole' && board.span ? { ...FORMATS.banderole, w: board.span } : FORMATS[format]
  const panel = useRef<THREE.MeshLambertMaterial>(null)
  const back = useRef<THREE.MeshLambertMaterial>(null)
  const cloth = useRef<THREE.Group>(null)
  const [ad, setAd] = useState<Ad | null>(null)
  const counted = useRef(new Map<string, number>())
  useFrame(() => {
    // Which ad is up: the same on every screen at the same moment, each board a little apart.
    const now = worldTime()
    const current = ads.length ? ads[Math.floor(now / TURN + board.seed * 7) % ads.length] : null
    if (current?.id !== ad?.id) setAd(current)
    const d = Math.hypot(board.at[0] - whereabouts.sim[0], board.at[1] - whereabouts.sim[1])
    // A video plays only while someone is near enough to see it.
    if (current?.type === 'video') {
      const v = textureOf(current).video
      if (v && d < 140 && v.paused) void v.play().catch(() => undefined)
      if (v && d > 180 && !v.paused) v.pause()
    }
    // A view: passing in front while it's up, once per ad and per half-minute.
    if (current && d < SEEN) {
      const last = counted.current.get(current.id) ?? -Infinity
      if (now - last > 30) {
        counted.current.set(current.id, now)
        onSeen(current.id)
      }
    }
    // The banderole moves in the wind; the LED screen flickers a little.
    if (cloth.current) cloth.current.rotation.x = Math.sin(now * 1.7 + board.seed * 9) * 0.08
    if (format === 'led' && panel.current) panel.current.emissiveIntensity = (night ? 1.1 : 0.75) + Math.sin(now * 40) * 0.03
  })
  const tex = ad ? fittedTexture(ad, f.w / f.h) : houseAd(format)
  useEffect(() => {
    for (const m of [panel.current, back.current]) {
      if (!m) continue
      m.map = tex
      m.emissiveMap = tex
      m.needsUpdate = true
    }
  }, [tex])
  // Lit from inside (the sucette, the LED screen) or by lamps at night (the others).
  const glow = format === 'led' ? (night ? 1.1 : 0.75) : format === 'sucette' ? (night ? 0.9 : 0.35) : night ? 0.55 : 0.18
  const face = (ref: React.RefObject<THREE.MeshLambertMaterial | null>, z: number, turn: number) => (
    <mesh position={[0, 0, z]} rotation={[0, turn, 0]}>
      <planeGeometry args={[f.w, f.h]} />
      <meshLambertMaterial ref={ref} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={glow} side={format === 'banderole' ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  )
  return (
    <group position={[board.at[0], 0, board.at[1]]} rotation={[0, board.rot, 0]}>
      {/* Its legs, its pole, a sucette's box: not walked through */}
      <Solid parts>
        {format === '4x3' && (
          <>
            {/* Two steel legs, a walkway, the frame, the panel facing the road (+z), the lamps on top */}
            {[-f.w / 3, f.w / 3].map((x) => (
              <mesh key={x} geometry={BOX} material={steel} position={[x, (f.y - f.h / 2) / 2, -0.3]} scale={[0.5, f.y - f.h / 2, 0.5]} />
            ))}
            <mesh geometry={BOX} material={frame} position={[0, f.y - f.h / 2 - 0.4, 0.4]} scale={[f.w, 0.12, 1]} />
            <mesh geometry={BOX} material={frame} position={[0, f.y, -0.15]} scale={[f.w + 0.5, f.h + 0.5, 0.25]} />
            <group position={[0, f.y, 0.01]}>{face(panel, 0, 0)}</group>
            {[-f.w / 3, 0, f.w / 3].map((x) => (
              <Lamp key={x} at={[x, f.y + f.h / 2 + 0.4, 0.5]} night={night} />
            ))}
          </>
        )}
        {format === 'geant' && (
          <>
            {/* One thick pole, the double panel high above the boulevard */}
            <mesh geometry={BOX} material={steel} position={[0, (f.y - f.h / 2) / 2, 0]} scale={[1.2, f.y - f.h / 2, 1.2]} />
            <mesh geometry={BOX} material={frame} position={[0, f.y, 0]} scale={[f.w + 0.6, f.h + 0.6, 0.6]} />
            <group position={[0, f.y, 0]}>
              {face(panel, 0.31, 0)}
              {face(back, -0.31, Math.PI)}
            </group>
            {[-f.w / 3, 0, f.w / 3].map((x) => (
              <Lamp key={x} at={[x, f.y + f.h / 2 + 0.5, 0.9]} night={night} />
            ))}
          </>
        )}
        {format === 'sucette' && (
          <>
            {/* The backlit box on its foot, a poster each side */}
            <mesh geometry={BOX} material={frame} position={[0, 0.3, 0]} scale={[0.5, 0.6, 0.3]} />
            <mesh geometry={BOX} material={frame} position={[0, f.y, 0]} scale={[f.w + 0.2, f.h + 0.2, 0.3]} />
            <group position={[0, f.y, 0]}>
              {face(panel, 0.16, 0)}
              {face(back, -0.16, Math.PI)}
            </group>
          </>
        )}
        {format === 'banderole' && (
          <>
            {/* Two poles either side of the street, the cloth stretched between, moving in the wind */}
            {[-f.w / 2, f.w / 2].map((x) => (
              <mesh key={x} geometry={BOX} material={steel} position={[x, (f.y + 1) / 2, 0]} scale={[0.18, f.y + 1, 0.18]} />
            ))}
            <mesh geometry={BOX} material={steel} position={[0, f.y + f.h / 2 + 0.05, 0]} scale={[f.w, 0.04, 0.04]} />
            <group ref={cloth} position={[0, f.y + f.h / 2, 0]}>
              <group position={[0, -f.h / 2, 0]}>{face(panel, 0, 0)}</group>
            </group>
          </>
        )}
        {format === 'led' && (
          <>
            {/* The screen at the crossroads: a pylon, a black frame, the picture lit bright */}
            <mesh geometry={BOX} material={steel} position={[0, (f.y - f.h / 2) / 2, 0]} scale={[0.9, f.y - f.h / 2, 0.9]} />
            <mesh geometry={BOX} material={black} position={[0, f.y, 0]} scale={[f.w + 0.5, f.h + 0.5, 0.7]} />
            <group position={[0, f.y, 0]}>
              {face(panel, 0.36, 0)}
              {face(back, -0.36, Math.PI)}
            </group>
          </>
        )}
        {/* The small « PUB » plate under the panel: an ad is an ad */}
        {(format === '4x3' || format === 'geant') && (
          <mesh position={[f.w / 2 - 0.6, f.y - f.h / 2 - 0.5, format === 'geant' ? 0.32 : 0.02]}>
            <planeGeometry args={[1, 0.45]} />
            <meshBasicMaterial color="#2b1d14" />
          </mesh>
        )}
      </Solid>
    </group>
  )
}

const black = new THREE.MeshLambertMaterial({ color: '#111216' })

function Lamp({ at, night }: { at: [number, number, number]; night: boolean }) {
  return (
    <group position={at}>
      <mesh geometry={BOX} material={frame} scale={[0.1, 0.1, 0.9]} position={[0, 0, -0.4]} />
      <mesh geometry={BOX} scale={[0.7, 0.16, 0.26]}>
        <meshLambertMaterial color={night ? '#fff2c2' : '#b0b4ba'} emissive={night ? '#fff2c2' : '#000000'} emissiveIntensity={night ? 1 : 0} />
      </mesh>
    </group>
  )
}
