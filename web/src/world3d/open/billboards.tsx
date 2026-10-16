import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// The billboards along the big roads (« les panneaux 4×3 »): two steel legs,
// the frame, the lamps on top for the night. They show the ads of Babi Pub
// (backend/internal/ads, web/src/screens/Pub.tsx): the approved, paid ads of
// the day for the commune, a poster or a video, in turn, the same one at the
// same moment on every screen (the shared clock). With none, « TA PUB ICI ».
// Passing in front counts a view: by commune and day, nobody is tracked.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

type Board = { id: string; at: XZ; rot: number; seed: number }
type Ad = { id: string; advertiser: string; title: string; type: 'image' | 'video'; url: string }

const NEAR = 380 // metres: boards drawn around the Sim
const MAX = 5
const TURN = 12 // seconds each ad stays up
const SEEN = 45 // metres: close enough to count a view
const W = 7 // the panel, metres
const H = 3.5
const TOP = 7.6

export function Billboards({ nav, seed, night }: { nav: Nav; seed: string; night: boolean }) {
  // Always at the same spots: along the wide, long roads, set back from the edge, facing the traffic.
  const all = useMemo(() => {
    const out: Board[] = []
    for (const e of nav.edges) {
      if (e.width < 10 || e.len < 70 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      if (hash(Math.round(m[0]), Math.round(m[1]), 4242) > 0.12) continue
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      const side = hash(Math.round(m[1]), 17) < 0.5 ? 1 : -1
      const off = e.width / 2 + 4
      const at: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
      if (!nav.walkable(at[0], at[1])) continue
      out.push({ id: `pub:${Math.round(at[0])}:${Math.round(at[1])}`, at, rot: Math.atan2(uz * side, -ux * side), seed: hash(at[0], at[1], 9) })
    }
    return out
  }, [nav])

  // The day's ads for the commune, again every five minutes.
  const [ads, setAds] = useState<Ad[]>([])
  useEffect(() => {
    let stop = false
    const load = () =>
      fetch(`${BASE}/ads/live?commune=${encodeURIComponent(seed)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list: Ad[]) => !stop && setAds(Array.isArray(list) ? list : []))
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
      .filter((x) => x.d < NEAR)
      .sort((p, q) => p.d - q.d)
      .slice(0, MAX)
      .map((x) => x.b)
    if (near.map((b) => b.id).join() !== shown.map((b) => b.id).join()) setShown(near)
  })

  return (
    <>
      {shown.map((b) => (
        <Billboard key={b.id} board={b} ads={ads} night={night} onSeen={(id) => (views.current[id] = (views.current[id] ?? 0) + 1)} />
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
    if (ad.type === 'video') {
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

/** « TA PUB ICI », painted like the wish list's signs: what an empty board says. */
let house: THREE.Texture | null = null
function houseAd() {
  if (house) return house
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#dda233'
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = '#1f8f88'
  g.fillRect(0, 196, 512, 60)
  g.fillStyle = '#2b1d14'
  g.font = 'bold 92px Anton, Impact, sans-serif'
  g.textAlign = 'center'
  g.fillText('TA PUB', 256, 104)
  g.fillStyle = '#b5432c'
  g.fillText('ICI', 256, 184)
  g.fillStyle = '#fbf5e6'
  g.font = 'bold 34px sans-serif'
  g.fillText('lifeinbabi.com/pub', 256, 238)
  house = new THREE.CanvasTexture(c)
  house.colorSpace = THREE.SRGBColorSpace
  return house
}

export function Billboard({ board, ads, night, onSeen }: { board: Board; ads: Ad[]; night: boolean; onSeen: (id: string) => void }) {
  const panel = useRef<THREE.MeshLambertMaterial>(null)
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
      if (v && d < 120 && v.paused) void v.play().catch(() => undefined)
      if (v && d > 160 && !v.paused) v.pause()
    }
    // A view: passing in front while it's up, once per ad and per half-minute.
    if (current && d < SEEN) {
      const last = counted.current.get(current.id) ?? -Infinity
      if (now - last > 30) {
        counted.current.set(current.id, now)
        onSeen(current.id)
      }
    }
  })
  const tex = ad ? textureOf(ad).tex : houseAd()
  useEffect(() => {
    if (panel.current) {
      panel.current.map = tex
      panel.current.emissiveMap = tex
      panel.current.needsUpdate = true
    }
  }, [tex])
  return (
    <group position={[board.at[0], 0, board.at[1]]} rotation={[0, board.rot, 0]}>
      {/* Two steel legs, the frame, the panel facing the road (+z), the lamps on top */}
      {[-W / 3, W / 3].map((x) => (
        <mesh key={x} geometry={BOX} material={steel} position={[x, TOP / 2 - H / 2, -0.2]} scale={[0.35, TOP - H / 2, 0.35]} />
      ))}
      <mesh geometry={BOX} material={frame} position={[0, TOP - H / 2, -0.12]} scale={[W + 0.4, H + 0.4, 0.2]} />
      <mesh position={[0, TOP - H / 2, 0.0]}>
        <planeGeometry args={[W, H]} />
        <meshLambertMaterial ref={panel} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={night ? 0.55 : 0.12} />
      </mesh>
      {[-W / 3, 0, W / 3].map((x) => (
        <group key={x} position={[x, TOP + 0.35, 0.35]}>
          <mesh geometry={BOX} material={frame} scale={[0.08, 0.08, 0.7]} position={[0, 0, -0.3]} />
          <mesh geometry={BOX} position={[0, 0, 0]} scale={[0.5, 0.12, 0.2]}>
            <meshLambertMaterial color={night ? '#fff2c2' : '#b0b4ba'} emissive={night ? '#fff2c2' : '#000000'} emissiveIntensity={night ? 1 : 0} />
          </mesh>
        </group>
      ))}
      {/* The small « PUB » plate under the panel: an ad is an ad */}
      <mesh position={[W / 2 - 0.45, TOP - H - 0.32, 0.02]}>
        <planeGeometry args={[0.7, 0.32]} />
        <meshBasicMaterial color="#2b1d14" />
      </mesh>
    </group>
  )
}
