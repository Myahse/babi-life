import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Check, Compass, Hammer, Home, Lock, LogOut, MapPin, Navigation, Star, Users, X } from 'lucide-react'
import type { QuartierTodo, QuartierView } from '../../lib/types'
import { t as tr, tx } from '../../lib/i18n'
import { iconFor } from '../icons'
import type { XZ } from '../../world3d/open/geo'
import type { QLot } from '../../world3d/quartier/store'
import { vueData } from '../../world3d/quartier/vueData'
import type { VueArrays, VueData } from '../../world3d/quartier/vueBuild'
import { SIDES, UNIV_EXT, type Built, type UniversInfo, type UniversSpec } from '../../world3d/quartier/univers/gen'
import type { EdgeKind } from '../../world3d/quartier/univers/presets'
import { Backdrop } from '../../world3d/quartier/univers/backdrop'
import { CARD, useCard, useCardUp } from '../../lib/overlays'

// « Vue du quartier » (update « mon-quartier »): the quartier's own world (world3d/quartier/univers/) seen from high
// up, like The Sims' neighbourhood: a plain town of blocks (world3d/quartier/vueBuild.ts, two meshes, no lights) with
// what lies past its edges (the lagoon, the hills, the city: univers/backdrop.tsx), every lot marked (one's own
// buildings and free lots, the world's places, the neighbours: the commune's other players). A tap on a lot opens
// its card: what it is, whose, open or not, and what one can do there (Y aller, Gérer, Construire ici, Visiter).
// Pinch or wheel to zoom, drag to move, two fingers turning (or right-drag, Q and E) to turn it, the compass back
// to the north. The names keep out of each other's way, the most important first (one's own, « À faire
// maintenant », the friends, the places, the rest). At the first visit the player picks its layout among its
// commune's style's. The lot's card takes its turn in the game's one queue of cards (lib/overlays); « À faire
// maintenant » steps aside while another card is up.

/** The camera: how high above the horizon it looks down, and turned from the north (radians) at first. */
const PITCH = 0.95
const YAW = -0.42
const FOV = 45
const ZOOM_MIN = 90
const BG = '#e6dcc6'
const GROUND = '#d3bf98'

/** A lot's colours by what stands on it (its pin, its pad on the ground). */
const TONE: Record<QLot['kind'], [string, string]> = {
  home: ['#ffb066', '#e8731f'],
  mine: ['#ffb066', '#e8731f'],
  free: ['#ffffff', '#b9a68a'],
  place: ['#7cc7a0', '#1c7a4a'],
  player: ['#8fb8ea', '#2c6fb7'],
  'player-home': ['#c3b5ef', '#6b55c9'],
}

type Cam = { x: number; z: number; d: number; yaw: number; gx: number; gz: number; gd: number; gyaw: number }

/** A pin over its lot, its name under it (shown when it has room), its place in the order of who gets room first. */
type PinRef = { at: THREE.Vector3; el: HTMLElement | null; label: HTMLElement | null; w: number; rank: number; named: boolean }

/** Who gets room for its name first: one's own, « À faire maintenant », the friends, the places, the rest. */
function rankOf(l: QLot, todo: string | null): number {
  if (l.id === todo) return 1
  if (l.kind === 'home' || l.kind === 'mine') return 0
  if (l.friend) return 2
  if (l.kind === 'place') return 3
  return 4
}

function geometryOf(a: VueArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(a.position, 3))
  g.setAttribute('color', new THREE.BufferAttribute(a.color, 3, true))
  g.setIndex(new THREE.BufferAttribute(a.index, 1))
  g.computeBoundingSphere()
  return g
}

/** The city's two meshes, the ground, the lots' pads; the camera moved smoothly towards where it's asked to be; the pins kept over their lots. */
function Scene({ data, univ, r, cam, pads, pins, order, compass, onFrame }: { data: VueData | null; univ: UniversInfo; r: number; cam: React.MutableRefObject<Cam>; pads: { at: XZ; color: string; big: boolean }[]; pins: React.MutableRefObject<PinRef[]>; order: React.MutableRefObject<number[]>; compass: React.MutableRefObject<HTMLElement | null>; onFrame?: () => void }) {
  const { camera, invalidate, size, scene } = useThree()
  const solid = useMemo(() => (data ? geometryOf(data.solid) : null), [data])
  const flat = useMemo(() => (data ? geometryOf(data.flat) : null), [data])
  useEffect(() => () => (solid?.dispose(), flat?.dispose()), [solid, flat])
  const mats = useMemo(() => ({ water: new THREE.MeshBasicMaterial({ color: '#4f9cc4' }), solid: new THREE.MeshBasicMaterial({ vertexColors: true }), flat: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), ground: new THREE.MeshBasicMaterial({ color: GROUND }), pad: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }) }), [])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  // The lots' pads: one instanced square each, in the lot's colour.
  const padMesh = useRef<THREE.InstancedMesh>(null)
  const padGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  useEffect(() => {
    const m = padMesh.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    pads.forEach((p, i) => {
      o.position.set(p.at[0], 0.2, p.at[1])
      o.scale.setScalar(p.big ? 26 : 18)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(p.color))
    })
    m.count = pads.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
    invalidate()
  }, [pads, invalidate])
  useEffect(() => {
    scene.fog = new THREE.Fog(BG, 400, 1600)
    scene.background = new THREE.Color(BG)
    invalidate()
  }, [scene, invalidate])
  useEffect(() => invalidate(), [data, size.width, size.height, invalidate])
  const v = useMemo(() => new THREE.Vector3(), [])
  const scratch = useRef<number[]>([])
  useFrame((_, dt) => {
    const c = cam.current
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 9)
    c.x += (c.gx - c.x) * k
    c.z += (c.gz - c.z) * k
    c.d += (c.gd - c.d) * k
    c.yaw += (c.gyaw - c.yaw) * k
    const moving = Math.abs(c.gx - c.x) > 0.05 || Math.abs(c.gz - c.z) > 0.05 || Math.abs(c.gd - c.d) > 0.05 || Math.abs(c.gyaw - c.yaw) > 0.001
    const h = Math.sin(PITCH) * c.d
    const back = Math.cos(PITCH) * c.d
    camera.position.set(c.x + Math.sin(c.yaw) * back, h, c.z + Math.cos(c.yaw) * back)
    camera.lookAt(c.x, 0, c.z)
    ;(camera as THREE.PerspectiveCamera).far = c.d * 3 + r * 2
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const f = scene.fog as THREE.Fog | null
    if (f) ((f.near = c.d + r * 0.8), (f.far = c.d + r * 4))
    // The pins over their lots (transform only: no layout), then their names, the most important first, each where
    // no name already stands (else hidden: its pin stays, a tap shows it).
    const w = size.width / 2
    const hh = size.height / 2
    const taken: number[] = []
    const seen = scratch.current
    seen.length = 0
    for (const i of order.current) {
      const p = pins.current[i]
      if (!p?.el) continue
      v.copy(p.at).project(camera)
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) {
        p.el.style.visibility = 'hidden'
        continue
      }
      const sx = v.x * w + w
      const sy = -v.y * hh + hh
      p.el.style.visibility = ''
      p.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`
      seen.push(i, sx, sy)
      // (The important pins' own round take room too: no lesser name under them.)
      if (p.rank <= 3) taken.push(sx - 15, sy - 38, sx + 15, sy - 6, p.rank)
    }
    for (let k = 0; k < seen.length; k += 3) {
      const p = pins.current[seen[k]]
      const sx = seen[k + 1]
      const sy = seen[k + 2]
      if (!p.label) continue
      if (!p.named) {
        p.label.style.visibility = 'hidden'
        continue
      }
      if (!p.w) p.w = p.label.offsetWidth || 80
      // (The name's box under the pin: centred on it, 16 px high.)
      const x0 = sx - p.w / 2 - 2
      const x1 = sx + p.w / 2 + 2
      const y0 = sy - 5
      const y1 = sy + 13
      let free = true
      for (let j = 0; j < taken.length; j += 5) {
        // (Not its own pin's round, nor a lesser pin's: a name of one's own goes over the places' rounds.)
        if (taken[j + 4] > p.rank || (taken[j] === sx - 15 && taken[j + 1] === sy - 38)) continue
        if (x0 < taken[j + 2] && x1 > taken[j] && y0 < taken[j + 3] && y1 > taken[j + 1]) {
          free = false
          break
        }
      }
      p.label.style.visibility = free ? '' : 'hidden'
      if (free) taken.push(x0, y0, x1, y1, -9)
    }
    // The compass turns with the view.
    if (compass.current) compass.current.style.transform = `rotate(${(c.yaw * 180) / Math.PI}deg)`
    onFrame?.()
    if (moving) invalidate()
  })
  return (
    <>
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.5]} />
      <mesh material={mats.ground} rotation-x={-Math.PI / 2} position={[0, -0.06, 0]}>
        <planeGeometry args={[UNIV_EXT * 2, UNIV_EXT * 2]} />
      </mesh>
      <Backdrop u={univ} water={mats.water} />
      {flat && <mesh geometry={flat} material={mats.flat} />}
      {solid && <mesh geometry={solid} material={mats.solid} />}
      <instancedMesh ref={padMesh} args={[padGeo, mats.pad, Math.max(1, pads.length)]} frustumCulled={false} />
    </>
  )
}

export type VueProps = {
  view: QuartierView
  visiting: boolean
  /** The world shown: its plan, what it's drawn from, what the player built that it draws. */
  univ: UniversInfo
  spec: UniversSpec
  built: Built[]
  /** The layout tried before it's picked (one's own, at the first visit), and the pick. */
  trying: number | null
  onTry: (variant: number | null) => void
  onPick: (variant: number) => void
  lots: QLot[]
  light: boolean
  /** The lot to show (« À faire maintenant », asked from the street). */
  focus: string | null
  todo?: QuartierTodo | null
  onEnter: (lot: QLot) => void
  onBuild: (lot: QLot) => void
  onManage: () => void
  onVisit: (owner: string) => void
  onBabi: () => void
  /** Visiting: back to one's own quartier. */
  onHome: () => void
  onFocused: () => void
  /** One's friends' quartiers, wherever they live (« Quartiers de tes amis »: a tap visits). */
  friends?: { owner: string; ownerName: string; name: string; level: number; commune: string }[]
}

/** The lot's card: what it is, whose, open or not, and what one can do there. */
export function LotCard({ lot, visiting, onEnter, onBuild, onManage, onVisit, onClose }: { lot: QLot; visiting: boolean; onEnter: () => void; onBuild: () => void; onManage: () => void; onVisit: () => void; onClose: () => void }) {
  const Icon = iconFor(lot.icon)
  const tone = TONE[lot.kind]
  const mine = lot.kind === 'mine' || (lot.kind === 'home' && !visiting)
  return (
    <div className="hud pointer-events-auto w-full rounded-3xl p-3 text-left shadow-lg" data-lot-card={lot.id}>
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: `linear-gradient(160deg, ${tone[0]}, ${tone[1]})` }}>
          <Icon size={24} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-1">
            {mine && <span className="rounded-full bg-[#e8731f] px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">{tr('à toi')}</span>}
            {lot.open !== undefined && <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${lot.open ? 'bg-[#e9f9ef] text-[#1c7a4a]' : 'bg-[#f3e7e4] text-[#a2412f]'}`}>{lot.open ? tr('Ouvert') : tr('Fermé')}</span>}
            {!!lot.level && lot.kind !== 'place' && <span className="rounded-full bg-[#fff1df] px-2 py-0.5 text-[10px] font-extrabold text-[#b5560f]">{tx('Niveau {0}', { 0: lot.level })}</span>}
          </div>
          <div className="mt-0.5 truncate font-display text-[18px] font-extrabold">{lot.name}</div>
          <div className="truncate text-xs font-bold text-[var(--color-ink-soft)]">{lot.what}</div>
        </div>
        <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
          <X size={18} strokeWidth={2.6} />
        </button>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {lot.kind === 'free' ? (
          <>
            <button className="btn flex-1 !bg-[#e8731f] !py-2 !text-sm" onClick={onBuild}>
              <Hammer size={15} className="mr-1 inline" /> {tr('Construire ici')}
            </button>
            <button className="btn btn-soft !px-3 !py-2 !text-sm" onClick={onEnter}>
              {tr('Voir le terrain')}
            </button>
          </>
        ) : lot.locked ? (
          <button className="btn btn-soft flex-1 !py-2 !text-sm" disabled>
            <Lock size={14} className="mr-1 inline" /> {tr('Ouvert aux amis seulement')}
          </button>
        ) : (lot.kind === 'player' || lot.kind === 'player-home') && lot.owner && !(visiting && lot.id.startsWith('lot:')) ? (
          <button className="btn flex-1 !bg-[#2c6fb7] !py-2 !text-sm" onClick={onVisit}>
            <Users size={15} className="mr-1 inline" /> {tr('Visiter son quartier')}
          </button>
        ) : (
          <>
            <button className="btn flex-1 !bg-[#1c7a4a] !py-2 !text-sm" onClick={onEnter}>
              <MapPin size={15} className="mr-1 inline" /> {tr('Y aller')}
            </button>
            {mine && !visiting && (
              <button className="btn btn-soft flex-1 !py-2 !text-sm" onClick={onManage}>
                {tr('Gérer')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** A lot's pin: its icon in its colour, its name under it when there's room. */
function Pin({ lot, picked, focus, onPick, refEl, refLabel }: { lot: QLot; picked: boolean; focus: boolean; onPick: () => void; refEl: (el: HTMLButtonElement | null) => void; refLabel: (el: HTMLSpanElement | null) => void }) {
  const Icon = iconFor(lot.icon)
  const tone = TONE[lot.kind]
  const big = lot.kind === 'home' || lot.kind === 'mine' || picked || focus
  const s = big ? 34 : lot.kind === 'free' ? 26 : 28
  return (
    <button ref={refEl} className="pointer-events-auto absolute top-0 left-0 flex flex-col items-center" style={{ width: s, marginLeft: -s / 2, marginTop: -s - 6, zIndex: picked || focus ? 3 : big ? 2 : 1 }} onClick={onPick} data-lot={lot.id} aria-label={lot.name}>
      <span className={`grid place-items-center rounded-full border-2 border-white shadow-md transition-transform ${picked ? 'scale-125' : ''} ${focus && !picked ? 'animate-bounce' : ''}`} style={{ width: s, height: s, background: lot.kind === 'free' ? 'rgba(255,255,255,0.9)' : `linear-gradient(160deg, ${tone[0]}, ${tone[1]})`, color: lot.kind === 'free' ? tone[1] : 'white', borderStyle: lot.kind === 'free' ? 'dashed' : 'solid', borderColor: lot.kind === 'free' ? tone[1] : 'white', opacity: lot.kind === 'place' && lot.open === false ? 0.7 : 1 }}>
        <Icon size={s * 0.5} strokeWidth={2.6} />
      </span>
      {/* (Centred under the pin's point, whatever its width: the pin's own place doesn't move.) */}
      <span ref={refLabel} className="absolute top-full left-1/2 mt-0.5 max-w-[110px] -translate-x-1/2 truncate rounded-full bg-white/90 px-1.5 text-[10px] leading-[15px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-sm" style={{ visibility: 'hidden' }}>
        {lot.kind === 'mine' ? tr('{0} · à toi', { 0: lot.name }) : lot.name}
      </span>
    </button>
  )
}

/** What closes a side, as said in a few words. */
const edgeName = (e: EdgeKind) => ({ lagune: tr('la lagune'), mer: tr('la mer'), foret: tr('la forêt'), colline: tr('les collines'), autoroute: tr("l'autoroute"), rail: tr('le chemin de fer'), ville: tr('le boulevard') })[e]

export function QuartierVue({ view, visiting, univ, spec, built, trying, onTry, onPick, lots, light, focus, todo, onEnter, onBuild, onManage, onVisit, onBabi, onHome, onFocused, friends = [] }: VueProps) {
  const [data, setData] = useState<VueData | null>(null)
  const [failed, setFailed] = useState(false)
  const t0 = useRef(performance.now())
  const builtKey = built.map((b) => `${b.lot}${b.kind}`).join('.')
  useEffect(() => {
    let gone = false
    setData(null)
    t0.current = performance.now()
    vueData(spec, built, light).then(
      (d) => {
        if (gone) return
        setData(d)
        const ms = Math.round(performance.now() - t0.current)
        if (import.meta.env.DEV) console.info(`[quartier] vue ready in ${ms} ms (${d.buildings} buildings, ${d.solid.index.length / 3 + d.flat.index.length / 3} triangles, built in ${d.ms} ms)`)
        Object.assign(globalThis, { __vueReady: { ms, buildings: d.buildings, triangles: d.solid.index.length / 3 + d.flat.index.length / 3 } })
      },
      () => !gone && setFailed(true),
    )
    return () => {
      gone = true
    }
  }, [spec.seed, spec.preset, spec.variant, builtKey, light]) // eslint-disable-line react-hooks/exhaustive-deps
  const radius = UNIV_EXT
  const at = useMemo(() => new Map(lots.map((l) => [l.id, l.at])), [lots])
  // (Far enough out to take in the whole world, a phone held upright as well as on its side.)
  const aspect = typeof innerWidth === 'number' ? Math.max(0.45, Math.min(1.2, innerWidth / Math.max(1, innerHeight))) : 1
  const zoomMax = (radius * 2.6) / aspect
  const home = univ.home.at
  const cam = useRef<Cam>({ x: home[0], z: home[1], d: zoomMax, yaw: YAW, gx: (home[0] + univ.carrefour[0]) / 2, gz: (home[1] + univ.carrefour[1]) / 2, gd: (radius * 1.25) / aspect, gyaw: YAW })
  const [picked, setPicked] = useState<string | null>(null)
  const pick = lots.find((l) => l.id === picked) ?? null
  // (Its turn in the queue of cards: one card on screen at a time.)
  const cardMine = useCard('quartier-lot', CARD.lot, !!pick, false)
  const cardUp = useCardUp()
  const [zoomedIn, setZoomedIn] = useState(false)
  const invalidate = useRef<() => void>(() => {})
  const fly = (id: string) => {
    const p = at.get(id)
    if (!p) return
    const c = cam.current
    c.gd = Math.min(c.gd, 380)
    // (A little towards the camera from it: the card at the bottom leaves it in view.)
    c.gx = p[0] + Math.sin(c.gyaw) * c.gd * 0.12
    c.gz = p[1] + Math.cos(c.gyaw) * c.gd * 0.12
    invalidate.current()
  }
  // Asked to show a lot (« À faire maintenant », from the street).
  useEffect(() => {
    if (!focus || !at.has(focus)) return
    setPicked(focus)
    fly(focus)
    onFocused()
  }, [focus, at]) // eslint-disable-line react-hooks/exhaustive-deps

  const todoLot = todo?.lot === undefined ? null : todo.lot < 0 ? 'home' : `lot:${todo.lot}`
  // The pins over their lots, kept in place by the scene each frame it draws; their names in the order of who gets room first.
  const pins = useRef<PinRef[]>([])
  const order = useRef<number[]>([])
  const compass = useRef<HTMLElement | null>(null)
  const named = (l: QLot) => l.kind !== 'free' || l.id === picked || l.id === todoLot || zoomedIn
  pins.current = lots.map((l, i) => {
    const was = pins.current[i]
    const same = was && was.at.x === l.at[0] && was.at.z === l.at[1]
    return { at: same ? was.at : new THREE.Vector3(l.at[0], l.kind === 'mine' || l.kind === 'player' ? 9 : 4, l.at[1]), el: was?.el ?? null, label: was?.label ?? null, w: same ? was.w : 0, rank: l.id === picked ? -1 : rankOf(l, todoLot), named: named(l) }
  })
  order.current = pins.current.map((_, i) => i).sort((a, b) => pins.current[a].rank - pins.current[b].rank)
  useEffect(() => invalidate.current(), [picked, zoomedIn, lots])
  const pads = useMemo(() => lots.filter((l) => l.kind === 'mine' || l.kind === 'free' || l.kind === 'home' || l.kind === 'player').map((l) => ({ at: l.at, color: TONE[l.kind][1], big: l.kind !== 'free' })), [lots])
  // The layout to pick (one's own, the first visit), with what closes each of the three.
  const choosing = !visiting && !!view.univers && !view.univers.chosen
  const shownVariant = trying ?? spec.variant
  const sidesOf = (v: number) => {
    const sides = univ.preset.layouts[v]
    return [...new Set(SIDES.map((_, i) => sides[i]))].map(edgeName).join(' · ')
  }

  // Drag to move, pinch or wheel to zoom; a tap on the ground closes the card.
  const touch = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: number; pinch: number; d0: number; twist: number; turn: boolean } | null>(null)
  const turnBy = (a: number) => {
    const c = cam.current
    c.gyaw += a
    c.yaw += a
    invalidate.current()
  }
  const box = useRef<HTMLDivElement>(null)
  const metresPerPx = () => (2 * cam.current.d * Math.tan((FOV * Math.PI) / 360)) / (box.current?.clientHeight || 800)
  const clamp = () => {
    const c = cam.current
    c.gd = Math.max(ZOOM_MIN, Math.min(zoomMax, c.gd))
    const l = Math.hypot(c.gx, c.gz)
    if (l > radius) ((c.gx *= radius / l), (c.gz *= radius / l))
    setZoomedIn(c.gd < 600)
    invalidate.current()
  }
  const panBy = (dx: number, dy: number) => {
    const m = metresPerPx()
    const c = cam.current
    // Screen right and down, on the ground, turned with the camera.
    const rx = Math.cos(c.yaw)
    const rz = -Math.sin(c.yaw)
    const fx = Math.sin(c.yaw) / Math.sin(PITCH)
    const fz = Math.cos(c.yaw) / Math.sin(PITCH)
    c.gx -= (dx * rx + dy * fx) * m
    c.gz -= (dx * rz + dy * fz) * m
    c.x = c.gx
    c.z = c.gz
    clamp()
  }
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    touch.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...touch.current.values()]
    gesture.current = { moved: gesture.current?.moved ?? 0, pinch: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0, d0: cam.current.gd, twist: pts.length === 2 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0, turn: e.button === 2 }
  }
  const onMove = (e: React.PointerEvent) => {
    const was = touch.current.get(e.pointerId)
    if (!was || !gesture.current) return
    const now = { x: e.clientX, y: e.clientY }
    touch.current.set(e.pointerId, now)
    const pts = [...touch.current.values()]
    if (pts.length >= 2 && gesture.current.pinch > 0) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      cam.current.gd = gesture.current.d0 * (gesture.current.pinch / Math.max(20, d))
      // Two fingers turning turn the view with them.
      const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x)
      const da = Math.atan2(Math.sin(a - gesture.current.twist), Math.cos(a - gesture.current.twist))
      gesture.current.twist = a
      if (Math.abs(da) > 0.002) turnBy(-da)
      gesture.current.moved += 10
      // (The middle of the two fingers moves the view too.)
      panBy((now.x - was.x) / 2, (now.y - was.y) / 2)
      return
    }
    gesture.current.moved += Math.abs(now.x - was.x) + Math.abs(now.y - was.y)
    // (The mouse's right button turns it.)
    if (gesture.current.turn) return turnBy(-(now.x - was.x) * 0.006)
    panBy(now.x - was.x, now.y - was.y)
  }
  const onUp = (e: React.PointerEvent) => {
    touch.current.delete(e.pointerId)
    if (touch.current.size === 0) {
      if (gesture.current && gesture.current.moved < 8) setPicked(null)
      gesture.current = null
    } else if (gesture.current) {
      const pts = [...touch.current.values()]
      gesture.current = { ...gesture.current, pinch: 0, d0: cam.current.gd }
      if (pts.length === 2) ((gesture.current.pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)), (gesture.current.twist = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x)))
    }
  }
  const onWheel = (e: React.WheelEvent) => {
    cam.current.gd *= Math.exp(e.deltaY * 0.0012)
    clamp()
  }
  useEffect(() => clamp(), []) // eslint-disable-line react-hooks/exhaustive-deps
  // Q and E turn it on a keyboard.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return
      if (e.key === 'q' || e.key === 'Q') turnBy(-0.25)
      if (e.key === 'e' || e.key === 'E') turnBy(0.25)
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const north = () => {
    const c = cam.current
    // (The nearest way round back to the start.)
    c.gyaw = YAW + Math.round((c.gyaw - YAW) / (Math.PI * 2)) * Math.PI * 2
    invalidate.current()
  }

  const goTodo = () => {
    if (!todoLot) return
    setPicked(todoLot)
    fly(todoLot)
  }
  const dpr = light ? 1 : Math.min(1.75, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)
  return (
    <div className="fixed inset-0 z-[25] overflow-hidden select-none" style={{ background: BG, touchAction: 'none' }} data-quartier-vue>
      <div ref={box} className="absolute inset-0" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()}>
        <Canvas flat frameloop="demand" dpr={dpr} gl={{ antialias: !light, powerPreference: light ? 'low-power' : 'high-performance', alpha: false }} camera={{ fov: FOV, near: 2, far: 6000, position: [0, 600, 600] }} onCreated={({ invalidate: inv }) => ((invalidate.current = inv), inv())}>
          <Scene data={data} univ={univ} r={radius} cam={cam} pads={pads} pins={pins} order={order} compass={compass} />
        </Canvas>
        <div className="pointer-events-none absolute inset-0 z-0">
          {lots.map((l, i) => (
            <Pin key={l.id} lot={l} picked={l.id === picked} focus={l.id === todoLot} onPick={() => (setPicked(l.id), fly(l.id))} refEl={(el) => pins.current[i] && (pins.current[i].el = el)} refLabel={(el) => pins.current[i] && ((pins.current[i].label = el), (pins.current[i].w = 0))} />
          ))}
        </div>
      </div>

      {/* Top: the quartier, its level and reputation; « À faire maintenant » pointing to its lot. (Under the game's money and
          hour pill, which sits above at the top left: they were drawn one over the other.) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-1.5 p-3 pt-[calc(max(0.75rem,var(--sat,env(safe-area-inset-top)))+3.25rem)] sm:pt-[calc(max(0.75rem,var(--sat,env(safe-area-inset-top)))+3.5rem)]">
        <div className="hud pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-extrabold">
          <Home size={14} className="shrink-0 text-[#1c7a4a]" />
          <span className="truncate">{visiting ? tx('{0} · chez {1}', { 0: view.name, 1: view.ownerName }) : view.name}</span>
          <span className="shrink-0 text-[var(--color-ink-soft)]">{tx('niv. {0}', { 0: view.level })}</span>
          <Star size={12} className="shrink-0 text-[#e8a01f]" fill="#e8a01f" />
          <span className="tnum shrink-0">{view.reputation}</span>
        </div>
        <div className="hud pointer-events-auto rounded-full px-3 py-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">{tr('Vue du quartier · touche un terrain')}</div>
        {choosing && (
          <div className="hud pointer-events-auto w-[min(100%,320px)] rounded-2xl p-2.5" data-plans>
            <div className="text-[10px] font-extrabold tracking-wide text-[#1c7a4a] uppercase">{tr('Choisis le plan de ton quartier')}</div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {Array.from({ length: view.univers!.variants }, (_, v) => (
                <button key={v} className={`rounded-xl px-1.5 py-1.5 text-[12px] font-extrabold ${v === shownVariant ? 'bg-[#1c7a4a] text-white' : 'bg-[var(--color-canvas)]'}`} onClick={() => onTry(v)} data-plan={v}>
                  {tx('Plan {0}', { 0: v + 1 })}
                </button>
              ))}
            </div>
            <div className="mt-1 text-[11px] leading-tight font-bold text-[var(--color-ink-soft)]">{tx('Bordé par {0}', { 0: sidesOf(shownVariant) })}</div>
            <button className="btn mt-1.5 w-full !bg-[#e8731f] !py-1.5 !text-sm" onClick={() => onPick(shownVariant)} data-plan-pick>
              <Check size={15} className="mr-1 inline" /> {tr('Je choisis ce plan')}
            </button>
          </div>
        )}
        {!visiting && todo && !cardUp && !choosing && (
          <button className="hud pointer-events-auto w-[min(100%,300px)] rounded-2xl p-2.5 text-left active:scale-[0.99]" onClick={goTodo} data-todo>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold tracking-wide text-[#e8731f] uppercase">{tr('À faire maintenant')}</span>
              <Navigation size={13} className="text-[#e8731f]" />
            </div>
            <div className="mt-0.5 font-display text-[14px] leading-tight font-extrabold">{todo.text}</div>
            {todoLot && <div className="mt-1 text-[11px] font-extrabold text-[#e8731f]">{tr('Voir le terrain')}</div>}
          </button>
        )}
        {!data && !failed && <div className="hud rounded-full px-3 py-1 text-[11px] font-extrabold">{tr('Le quartier se dessine…')}</div>}
      </div>
      {/* The compass: turns with the view, a tap back to the north. */}
      <button className="hud pointer-events-auto absolute top-[max(0.75rem,var(--sat,env(safe-area-inset-top)))] right-3 z-10 grid size-11 place-items-center rounded-full active:scale-95" onClick={north} aria-label={tr('Remettre le nord en haut')} data-compass>
        <span ref={compass} className="grid place-items-center">
          <Compass size={22} strokeWidth={2.4} className="text-[#a2412f]" />
        </span>
      </button>

      {/* Bottom: the lot's card, else the ways out (Gérer, Aller à Babi; visiting: home). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-stretch gap-2 p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))] lg:items-center">
        {pick && cardMine ? (
          <div className="w-full max-w-[440px] self-center">
            <LotCard lot={pick} visiting={visiting} onClose={() => setPicked(null)} onEnter={() => onEnter(pick)} onBuild={() => onBuild(pick)} onManage={onManage} onVisit={() => pick.owner && onVisit(pick.owner)} />
          </div>
        ) : (
          <>
          {/* One's friends' quartiers, in whatever commune they live: a tap visits (the taxi there when it's another commune). */}
          {!visiting && friends.length > 0 && (
            <div className="pointer-events-auto w-full max-w-[440px] self-center" data-friends>
              <div className="mb-1 px-1 text-[10px] font-extrabold tracking-wide text-[#2c6fb7] uppercase">{tr('Quartiers de tes amis')}</div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {friends.map((f) => (
                  <button key={f.owner} className="hud flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-left active:scale-95" onClick={() => onVisit(f.owner)} data-friend={f.owner}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#2c6fb7] text-white">
                      <Users size={14} strokeWidth={2.6} />
                    </span>
                    <span className="leading-tight">
                      <span className="block max-w-[120px] truncate text-[12px] font-extrabold">{f.ownerName}</span>
                      <span className="block max-w-[120px] truncate text-[10px] font-bold text-[var(--color-ink-soft)]">{f.commune ? tx('{0} · niv. {1}', { 0: f.commune, 1: f.level }) : tx('niv. {0}', { 0: f.level })}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="pointer-events-auto grid w-full max-w-[440px] grid-cols-2 gap-2 self-center">
            {visiting ? (
              <button className="btn btn-soft !py-2.5 !text-sm" onClick={onHome}>
                <LogOut size={15} className="mr-1 inline" /> {tr('Rentrer')}
              </button>
            ) : (
              <button className="btn btn-soft !py-2.5 !text-sm" onClick={onManage}>
                {tr('Gérer')}
              </button>
            )}
            <button className="btn !bg-[#1c7a4a] !py-2.5 !text-sm" onClick={onBabi}>
              {tr('Aller à Babi')}
            </button>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
