import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Flag, Images, MessageSquare, RefreshCcw, Send, Smile, Timer, Type, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { FlashContact, FlashSnap, Sim, World } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { ReportSheet } from '../components/Social'
import { AppLogo } from '../components/AppLogo'
import { Stories } from './Stories'
import { friendLook } from './OutingPlanner'
import { applyFilter, FILTERS, findFilter, loadImage, paintPost, type GramFilter } from './BabigramArt'
import { photoCam, setPhotoMode, usePhotoMode } from '../world3d/photoCam'
import { placeHere, setFrameTap, takePhoto } from '../world3d/snapshot'
import { whereabouts } from '../world3d/whereabouts'
import { clock } from '../game/rules'
import type { Act } from './phoneApps'
import { t as tr, tx } from '../lib/i18n'

/**
 * Flashé, the snap app (backend sims/flashe.go), built like the well-known
 * apps of photos that vanish: it opens on the camera, the game live behind
 * it (in the street the phone sees for itself, a photo or a selfie: the
 * Caméra's viewfinder, world3d/snapshot.tsx); the photo taken gets a lens
 * (Babigram's colours, or a banner: the place, the commune, the time, the
 * flag), stickers, a line of text and a timer, and goes to friends (seen
 * once, then gone) or to the story. Discussions: who sent what, opened or
 * not, the flames of the friends snapped every day. Stories: Gbairai's.
 */

type Tab = 'chat' | 'camera' | 'stories'
const PINK = '#e01e7e'
/** The snap's frame: a phone's screen, upright. */
const W = 576
const H = 1024

type Banner = 'lieu' | 'commune' | 'heure' | 'drapeau'
type Lens = { id: string; label: string; filter: GramFilter; banner?: Banner }
type Sticker = { id: number; emoji: string; x: number; y: number }
const STICKERS = ['🔥', '😂', '😍', '🥵', '😎', '👀', '💯', '🍻', '🍗', '⚽', '🎉', '💛', '🙏', '😤', '🥺', '✨', '🐘', '🌴', '🕺', '💃', '👑', '😋', '🤣', '❤️']
const TIMERS = [3, 5, 7, 10]

/** The place the Sim stands at, by its name and kind (for the banner, and what friends answer). */
function hereNow() {
  const id = placeHere()
  const p = whereabouts.places.find((x) => x.id === id)
  return { id, name: p?.name ?? '', kind: p?.kind ?? '' }
}

/** The banners, drawn on the snap (the preview and the one sent alike). */
function drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number, banner: Banner, info: { place: string; commune: string; time: string; night: boolean }) {
  const display = (px: number) => tr("800 {0}px 'Baloo 2', system-ui, sans-serif", { 0: Math.round(px) })
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (banner === 'commune' || (banner === 'lieu' && !info.place)) {
    // The commune's name, big, outlined in the flag's orange, Babi under it on a green tag.
    const name = info.commune.toUpperCase()
    let size = h * 0.1
    ctx.font = display(size)
    while (ctx.measureText(name).width > w * 0.86 && size > h * 0.04) ctx.font = display((size *= 0.92))
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.16
    ctx.strokeStyle = '#ff7a00'
    ctx.strokeText(name, w / 2, h * 0.8)
    ctx.fillStyle = '#fff'
    ctx.fillText(name, w / 2, h * 0.8)
    ctx.font = display(h * 0.032)
    const tag = tr('Babi · Côte d’Ivoire')
    const tw = ctx.measureText(tag).width + h * 0.04
    ctx.fillStyle = '#12a150'
    roundRect(ctx, w / 2 - tw / 2, h * 0.865, tw, h * 0.048, h * 0.024)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(tag, w / 2, h * 0.89)
  } else if (banner === 'lieu') {
    // Where: a white pin tag at the bottom.
    ctx.font = display(h * 0.038)
    const text = `📍 ${info.place}`
    let tw = ctx.measureText(text).width
    if (tw > w * 0.84) {
      ctx.font = display((h * 0.038 * (w * 0.84)) / tw)
      tw = w * 0.84
    }
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    roundRect(ctx, w / 2 - tw / 2 - h * 0.025, h * 0.82, tw + h * 0.05, h * 0.07, h * 0.035)
    ctx.fill()
    ctx.fillStyle = PINK
    ctx.fillText(text, w / 2, h * 0.856)
  } else if (banner === 'heure') {
    // The time, huge, and the city, as the phone's clock would show it.
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = h * 0.02
    ctx.fillStyle = '#fff'
    ctx.font = display(h * 0.15)
    ctx.fillText(info.time, w / 2, h * 0.2)
    ctx.font = display(h * 0.034)
    ctx.fillText(tr('{0} Abidjan · {commune}', { 0: info.night ? '🌙' : '☀️', commune: info.commune }), w / 2, h * 0.3)
  } else if (banner === 'drapeau') {
    // The flag's colours down the sides, « Babi ❤️ » at the bottom.
    const band = w * 0.055
    ctx.fillStyle = '#ff8200'
    ctx.fillRect(0, 0, band, h)
    ctx.fillStyle = '#009a44'
    ctx.fillRect(w - band, 0, band, h)
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = h * 0.015
    ctx.font = display(h * 0.07)
    ctx.fillText(tr('Babi ❤️'), w / 2, h * 0.86)
  }
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** The photo cut to the snap's upright frame, with its lens. */
function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, lens: Lens, info: Parameters<typeof drawBanner>[4]) {
  const k = Math.max(w / img.width, h / img.height)
  ctx.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k)
  applyFilter(ctx, w, h, lens.filter)
  if (lens.banner) drawBanner(ctx, w, h, lens.banner, info)
}

/** The snap as sent: the photo, its lens, the stickers, the line of text; a JPEG small enough. */
async function bakeSnap(src: string, lens: Lens, stickers: Sticker[], caption: string, captionY: number, info: Parameters<typeof drawBanner>[4]) {
  const img = await loadImage(src)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  drawPhoto(ctx, img, W, H, lens, info)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = tr('{0}px serif', { 0: Math.round(W * 0.13) })
  for (const s of stickers) ctx.fillText(s.emoji, s.x * W, s.y * H)
  if (caption) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, captionY * H - H * 0.03, W, H * 0.06)
    ctx.fillStyle = '#fff'
    ctx.font = tr("700 {0}px 'Nunito', system-ui, sans-serif", { 0: Math.round(H * 0.027) })
    ctx.fillText(caption, W / 2, captionY * H, W * 0.94)
  }
  for (const q of [0.85, 0.75, 0.62, 0.5]) {
    const url = c.toDataURL('image/jpeg', q)
    if (url.length * 0.75 < 290_000) return url
  }
  return null
}

const since = (at: string) => {
  const m = Math.round((Date.now() - new Date(at).getTime()) / 60_000)
  return m < 1 ? tr("à l'instant") : m < 60 ? `${m} min` : m < 60 * 24 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`
}

function Face({ c, size = 44 }: { c: FlashContact; size?: number }) {
  const look = c.look ?? (c.friend ? friendLook(c.friend) : undefined)
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-full bg-[#ffe3f1]" style={{ width: size, height: size }}>
      {look && <Portrait look={look} gender={c.gender} framing="head" />}
      {c.online && <span className="absolute right-0.5 bottom-0.5 h-2.5 w-2.5 rounded-full bg-[#2fb344] ring-2 ring-white" />}
    </span>
  )
}

export function FlasheApp({ world, sim, street, act, onClose }: { world: World; sim: Sim; /** Out in the street: the phone sees for itself (else the room, as it's seen). */ street: boolean; act: Act; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('camera')
  const [inbox, setInbox] = useState<{ contacts: FlashContact[]; left: number } | null>(null)
  const [shot, setShot] = useState<string | null>(null)
  // Who the next snap goes to first (a reply from the discussions).
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [viewing, setViewing] = useState<FlashContact | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const load = () => api.flashe(sim.id).then(setInbox).catch((e) => setNote(e instanceof ApiError ? e.message : tr('Pas de réseau.')))
  useEffect(() => {
    void load()
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // On a computer, Échap goes back a step, then puts the app away.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (viewing) setViewing(null)
      else if (shot) setShot(null)
      else onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [viewing, shot, onClose])
  const fresh = inbox?.contacts.reduce((n, c) => n + c.new, 0) ?? 0
  const commune = world.cities.find((c) => c.id === sim.city)?.communes.find((c) => c.id === sim.commune)?.name ?? ''

  return (
    <div className="absolute inset-0 z-[60] flex justify-center bg-black text-white select-none">
      <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-black">
        {shot ? (
          <Edit
            sim={sim}
            src={shot}
            commune={commune}
            contacts={inbox?.contacts ?? []}
            left={inbox?.left ?? null}
            first={replyTo}
            act={act}
            onBack={() => setShot(null)}
            onSent={() => (setShot(null), setReplyTo(null), setTab('chat'), void load())}
          />
        ) : tab === 'camera' ? (
          <CameraTab street={street} fresh={fresh} replyTo={inbox?.contacts.find((c) => c.id === replyTo)?.name ?? null} onShot={setShot} onClose={onClose} onTab={setTab} />
        ) : (
          <>
            <div className="flex items-center gap-2 bg-white px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-[#16161c]">
              <button className="grid h-9 w-9 place-items-center rounded-full bg-[#f2f2f5]" onClick={onClose} aria-label={tr('Fermer')}>
                <X size={20} />
              </button>
              <AppLogo id="flashe" size={30} radius={9} />
              <h3 className="flex-1 font-display text-xl font-extrabold">{tab === 'chat' ? tr('Discussions') : tr('Stories')}</h3>
              {tab === 'chat' && inbox && <span className="text-[11px] font-extrabold text-black/45">{inbox.left} {tr("snaps aujourd'hui")}</span>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white text-[#16161c]">
              {note && <p className="mx-3 mt-2 rounded-xl bg-[#fff0f6] px-3 py-2 text-xs font-bold text-[#a3114f]">{note}</p>}
              {tab === 'chat' ? (
                <Discussions inbox={inbox} onOpen={setViewing} onSnap={(c) => (setReplyTo(c.id), setTab('camera'))} />
              ) : (
                <div className="p-3">
                  <Stories sim={sim} realPhotos={false} />
                  <p className="mt-3 text-xs font-bold text-black/50">{tr('Ta story et celles de tes amis joueurs, 24 heures. Pour y mettre un snap, prends une photo et choisis « Ma story ».')}</p>
                </div>
              )}
            </div>
            <Tabs tab={tab} fresh={fresh} onTab={setTab} />
          </>
        )}
        {viewing && <Viewer sim={sim} contact={viewing} onClose={() => (setViewing(null), void load())} onReply={() => (setViewing(null), setReplyTo(viewing.id), setTab('camera'), void load())} />}
      </div>
    </div>
  )
}

function Tabs({ tab, fresh, onTab, dark }: { tab: Tab; fresh: number; onTab: (t: Tab) => void; dark?: boolean }) {
  const item = (t: Tab, label: string, icon: React.ReactNode) => (
    <button onClick={() => onTab(t)} className={`relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-extrabold ${tab === t ? (dark ? 'text-white' : 'text-[#e01e7e]') : dark ? 'text-white/60' : 'text-black/45'}`}>
      {icon}
      {label}
      {t === 'chat' && fresh > 0 && <span className="absolute top-0 left-1/2 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#e01e7e] px-1 text-[10px] text-white">{fresh}</span>}
    </button>
  )
  return (
    <div className={`flex px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] ${dark ? 'bg-black/80' : 'border-t border-black/5 bg-white'}`}>
      {item('chat', tr('Discussions'), <MessageSquare size={21} />)}
      {item('camera', tr('Caméra'), <span className="block h-[21px] w-[21px] rounded-full border-[2.5px] border-current" />)}
      {item('stories', tr('Stories'), <Images size={21} />)}
    </div>
  )
}

/* ---------- The camera: the game live behind ---------- */

function CameraTab({ street, fresh, replyTo, onShot, onClose, onTab }: { street: boolean; fresh: number; replyTo: string | null; onShot: (src: string) => void; onClose: () => void; onTab: (t: Tab) => void }) {
  const mode = usePhotoMode()
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  // A snap is a selfie first, as on the real app.
  useEffect(() => {
    if (street) setPhotoMode('selfie')
    return () => setPhotoMode(null)
  }, [street])
  // The viewfinder: each frame the 3D draws, copied here (the game's buttons and names stay under it).
  const finder = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    setFrameTap({
      street,
      frame: (c) => {
        const f = finder.current
        if (!f) return
        const k = Math.min(1.5, window.devicePixelRatio || 1)
        const [w, h] = [Math.round(f.clientWidth * k), Math.round(f.clientHeight * k)]
        if (f.width !== w || f.height !== h) (f.width = w), (f.height = h)
        const s = Math.max(w / c.width, h / c.height)
        f.getContext('2d')?.drawImage(c, (w - c.width * s) / 2, (h - c.height * s) / 2, c.width * s, c.height * s)
      },
    })
    return () => setFrameTap(null)
  }, [street])
  const shoot = () => {
    const src = takePhoto()
    if (!src) return setError(tr('Rien à photographier ici'))
    setFlash(true)
    setTimeout(() => (setFlash(false), onShot(src)), 140)
  }
  return (
    <div
      className="absolute inset-0 flex touch-none flex-col"
      onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY })}
      onPointerMove={(e) => {
        if (!drag.current || !street) return
        photoCam.yaw -= (e.clientX - drag.current.x) * 0.006
        photoCam.pitch = Math.max(-0.9, Math.min(0.9, photoCam.pitch + (e.clientY - drag.current.y) * (mode === 'selfie' ? -0.004 : 0.004)))
        drag.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <canvas ref={finder} className="absolute inset-0 h-full w-full bg-black" />
      <div className="relative flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6" onPointerDown={(e) => e.stopPropagation()}>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-black/35" onClick={onClose} aria-label={tr('Fermer')}>
          <X size={22} />
        </button>
        <span className="flex items-center gap-1.5 rounded-full bg-black/35 py-1 pr-3 pl-1 text-sm font-extrabold">
          <AppLogo id="flashe" size={26} radius={8} /> {replyTo ? tr('Pour {replyTo}', { replyTo }) : tr('Flashé')}
        </span>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-black/35 disabled:opacity-30" disabled={!street} onClick={() => setPhotoMode(mode === 'selfie' ? 'photo' : 'selfie')} aria-label={tr('Retourner la caméra')}>
          <RefreshCcw size={20} />
        </button>
      </div>
      <div className="pointer-events-none relative flex-1">
        {street && <p className="absolute inset-x-0 bottom-3 text-center text-[11px] font-bold text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">{tr('Fais glisser pour viser')}{mode === 'selfie' ? tr(' · selfie') : ''}</p>}
        {error && <p className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-black/70 px-3 py-1 text-xs font-bold">{error}</p>}
      </div>
      {flash && <div className="pointer-events-none absolute inset-0 bg-white" />}
      <div className="relative bg-gradient-to-t from-black/75 to-transparent pt-6" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex justify-center pb-3">
          <button className="grid h-[78px] w-[78px] place-items-center rounded-full border-[5px] border-white active:scale-95" onClick={shoot} aria-label={tr('Prendre le snap')}>
            <span className="h-[56px] w-[56px] rounded-full bg-white/25" />
          </button>
        </div>
        <Tabs tab="camera" fresh={fresh} onTab={onTab} dark />
      </div>
    </div>
  )
}

/* ---------- The snap taken: lens, stickers, text, timer, then to whom ---------- */

function Edit({ sim, src, commune, contacts, left, first, act, onBack, onSent }: { sim: Sim; src: string; commune: string; contacts: FlashContact[]; left: number | null; first: string | null; act: Act; onBack: () => void; onSent: () => void }) {
  const [here] = useState(hereNow)
  const lenses = useMemo<Lens[]>(
    () => [
      { id: '', label: tr('Normal'), filter: FILTERS[0] },
      ...(here.name ? [{ id: 'lieu', label: tr('Le coin'), filter: FILTERS[0], banner: 'lieu' as const }] : []),
      { id: 'commune', label: commune || tr('Babi'), filter: findFilter('bassam'), banner: 'commune' },
      { id: 'heure', label: tr("L'heure"), filter: FILTERS[0], banner: 'heure' },
      { id: 'drapeau', label: tr('Drapeau'), filter: findFilter('lagune'), banner: 'drapeau' },
      ...FILTERS.slice(1).map((f) => ({ id: f.id, label: f.label, filter: f })),
    ],
    [here.name, commune],
  )
  const [lensAt, setLensAt] = useState(0)
  const lens = lenses[lensAt]
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [picking, setPicking] = useState(false)
  const [caption, setCaption] = useState('')
  const [typing, setTyping] = useState(false)
  const [captionY, setCaptionY] = useState(0.62)
  const [seconds, setSeconds] = useState(5)
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement | null>(null)
  const now = clock(sim.gameMinutes)
  const info = { place: here.name, commune, time: now.time, night: now.isNight }
  // The preview: drawn like the snap sent, at half its size.
  useEffect(() => {
    let live = true
    const draw = (i: HTMLImageElement) => {
      const c = canvas.current
      if (!c || !live) return
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.clearRect(0, 0, c.width, c.height)
      drawPhoto(ctx, i, c.width, c.height, lens, info)
    }
    if (img.current) draw(img.current)
    else void loadImage(src).then((i) => ((img.current = i), draw(i)))
    return () => void (live = false)
  }, [src, lens]) // eslint-disable-line react-hooks/exhaustive-deps
  // Dragged: a sticker, or the line of text (up and down).
  const dragging = useRef<{ kind: 'sticker'; id: number } | { kind: 'caption' } | null>(null)
  const move = (e: React.PointerEvent) => {
    const d = dragging.current
    const box = frame.current?.getBoundingClientRect()
    if (!d || !box) return
    const x = Math.min(0.95, Math.max(0.05, (e.clientX - box.left) / box.width))
    const y = Math.min(0.95, Math.max(0.05, (e.clientY - box.top) / box.height))
    if (d.kind === 'caption') setCaptionY(y)
    else setStickers((ss) => ss.map((s) => (s.id === d.id ? { ...s, x, y } : s)))
  }
  // A swipe across the photo changes the lens.
  const swipe = useRef<number | null>(null)
  const bake = () => bakeSnap(src, lens, stickers, caption.trim(), captionY, info)
  const save = async () => {
    setBusy(true)
    const baked = await bake()
    if (!baked) return (setBusy(false), setNote(tr('Ce snap ne se lit pas.')))
    await api
      .takePhoto(sim.id, baked, 'photo', here.id)
      .then(() => setNote(tr('Enregistré dans ta galerie.')))
      .catch((e) => setNote(e instanceof ApiError ? e.message : tr('Pas de réseau.')))
    setBusy(false)
  }
  const send = async (to: string[], story: boolean) => {
    setBusy(true)
    setNote(null)
    const baked = await bake()
    if (!baked) return (setBusy(false), setNote(tr('Ce snap ne se lit pas.')))
    const ok = await act(tr('Snap Flashé'), 'camera', 'social', () => api.flashSend(sim.id, { photo: baked, caption: caption.trim(), seconds, to, story, placeId: here.id }))
    setBusy(false)
    if (ok) onSent()
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div
        ref={frame}
        className="relative mx-auto mt-[max(0.5rem,env(safe-area-inset-top))] w-full flex-1 touch-none overflow-hidden rounded-2xl"
        style={{ maxWidth: 'calc((100dvh - 7rem) * 0.5625)' }}
        onPointerMove={move}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <canvas
          ref={canvas}
          width={W / 2}
          height={H / 2}
          className="absolute inset-0 h-full w-full object-cover"
          onPointerDown={(e) => (swipe.current = e.clientX)}
          onPointerUp={(e) => {
            const from = swipe.current
            swipe.current = null
            if (from === null || dragging.current) return
            const dx = e.clientX - from
            if (Math.abs(dx) > 40) setLensAt((i) => (i + (dx < 0 ? 1 : lenses.length - 1)) % lenses.length)
          }}
        />
        {/* The lens's name, a moment after it changes */}
        <span key={lens.id} className="pointer-events-none absolute inset-x-0 top-14 mx-auto w-fit animate-[fade-out_1.6s_ease-out_forwards] rounded-full bg-black/45 px-3 py-1 text-xs font-extrabold">
          {lens.label}
        </span>
        {stickers.map((s) => (
          <span
            key={s.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab text-[clamp(40px,13vw,64px)] leading-none"
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
            onPointerDown={(e) => (e.stopPropagation(), (dragging.current = { kind: 'sticker', id: s.id }))}
            onDoubleClick={() => setStickers((ss) => ss.filter((x) => x.id !== s.id))}
          >
            {s.emoji}
          </span>
        ))}
        {(caption || typing) && (
          <div className="absolute inset-x-0 -translate-y-1/2 bg-black/55 py-1.5" style={{ top: `${captionY * 100}%` }} onPointerDown={(e) => !typing && (e.stopPropagation(), (dragging.current = { kind: 'caption' }))}>
            {typing ? (
              <input
                autoFocus
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 80))}
                onBlur={() => setTyping(false)}
                onKeyDown={(e) => e.key === 'Enter' && setTyping(false)}
                placeholder={tr('Écris quelque chose…')}
                className="w-full bg-transparent text-center text-[15px] font-bold text-white outline-none placeholder:text-white/60"
              />
            ) : (
              <p className="px-2 text-center text-[15px] font-bold">{caption}</p>
            )}
          </div>
        )}
        {/* The tools down the right side, the way back at the top left */}
        <button className="absolute top-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-black/35" onClick={onBack} aria-label={tr('Reprendre')}>
          <X size={22} />
        </button>
        <div className="absolute top-3 right-3 flex flex-col gap-2.5">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black/35" onClick={() => setTyping(true)} aria-label={tr('Texte')}>
            <Type size={20} />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black/35" onClick={() => setPicking((p) => !p)} aria-label={tr('Stickers')}>
            <Smile size={20} />
          </button>
          <button className="relative grid h-10 w-10 place-items-center rounded-full bg-black/35" onClick={() => setSeconds((s) => TIMERS[(TIMERS.indexOf(s) + 1) % TIMERS.length])} aria-label={tr('Minuteur')}>
            <Timer size={20} />
            <span className="absolute -right-1 -bottom-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e01e7e] px-1 text-[10px] font-extrabold">{seconds}</span>
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-black/35 disabled:opacity-40" disabled={busy} onClick={() => void save()} aria-label={tr('Enregistrer dans la galerie')}>
            <Download size={20} />
          </button>
        </div>
        <button className="absolute top-1/2 left-1 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/25" onClick={() => setLensAt((i) => (i + lenses.length - 1) % lenses.length)} aria-label={tr('Filtre précédent')}>
          <ChevronLeft size={20} />
        </button>
        <button className="absolute top-1/2 right-1 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/25" onClick={() => setLensAt((i) => (i + 1) % lenses.length)} aria-label={tr('Filtre suivant')}>
          <ChevronRight size={20} />
        </button>
        {picking && (
          <div className="absolute inset-x-3 bottom-3 grid grid-cols-8 gap-1 rounded-2xl bg-black/75 p-2">
            {STICKERS.map((e) => (
              <button key={e} className="text-[26px] active:scale-90" onClick={() => (setStickers((ss) => [...ss, { id: Date.now() + ss.length, emoji: e, x: 0.5, y: 0.42 }]), setPicking(false))}>
                {e}
              </button>
            ))}
            <p className="col-span-8 pt-1 text-center text-[10px] font-bold text-white/60">{tr("Glisse un sticker pour le placer, touche-le deux fois pour l'enlever.")}</p>
          </div>
        )}
        {note && <p className="absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[90%] rounded-full bg-black/70 px-3 py-1 text-center text-xs font-bold">{note}</p>}
      </div>
      <div className="flex items-center gap-2 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-white/60">
          {tx('⏱ {seconds} s{0}', { seconds, 0: left !== null ? tr(" · {left} snaps aujourd'hui", { left }) : '' })}
        </span>
        <button className="flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-extrabold disabled:opacity-50" style={{ background: PINK }} disabled={busy || left === 0} onClick={() => setSending(true)}>
          {tr('Envoyer à')} <Send size={17} />
        </button>
      </div>
      {sending && <SendTo contacts={contacts} first={first} busy={busy} note={note} onCancel={() => setSending(false)} onSend={(to, story) => void send(to, story)} />}
    </div>
  )
}

function SendTo({ contacts, first, busy, note, onCancel, onSend }: { contacts: FlashContact[]; first: string | null; busy: boolean; note: string | null; onCancel: () => void; onSend: (to: string[], story: boolean) => void }) {
  const [to, setTo] = useState<string[]>(first ? [first] : [])
  const [story, setStory] = useState(false)
  // The best friends (the flames) first, then those snapped lately, then the others.
  const best = contacts.filter((c) => c.streak > 0).sort((a, b) => b.streak - a.streak)
  const rest = contacts.filter((c) => c.streak === 0)
  const flip = (id: string) => setTo((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= 10 ? t : [...t, id]))
  const row = (c: FlashContact) => (
    <button key={c.id} className="flex w-full items-center gap-3 px-3 py-2 text-left" onClick={() => flip(c.id)}>
      <Face c={c} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold">{c.name}</span>
        <span className="block text-[11px] font-bold text-black/45">{c.friend ? tr('Rencontré·e dans le jeu') : c.online ? tr('En ligne') : 'Joueur·se'}</span>
      </span>
      {c.streak > 0 && <span className="text-sm font-extrabold">🔥 {c.streak}</span>}
      <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${to.includes(c.id) ? 'border-[#e01e7e] bg-[#e01e7e] text-white' : 'border-black/20'}`}>{to.includes(c.id) && '✓'}</span>
    </button>
  )
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white text-[#16161c]">
      <div className="flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button className="grid h-9 w-9 place-items-center rounded-full bg-[#f2f2f5]" onClick={onCancel} aria-label={tr('Retour')}>
          <ChevronLeft size={22} />
        </button>
        <h3 className="flex-1 font-display text-xl font-extrabold">{tr('Envoyer à…')}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => setStory((s) => !s)}>
          <span className="grid h-10 w-10 place-items-center rounded-full text-lg" style={{ background: '#ffe3f1' }}>
            ✨
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-extrabold">{tr('Ma story')}</span>
            <span className="block text-[11px] font-bold text-black/45">{tr('Tes amis joueurs la voient 24 heures')}</span>
          </span>
          <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${story ? 'border-[#e01e7e] bg-[#e01e7e] text-white' : 'border-black/20'}`}>{story && '✓'}</span>
        </button>
        {best.length > 0 && <p className="label px-3 pt-3 pb-1">{tr('Meilleurs amis')}</p>}
        {best.map(row)}
        {rest.length > 0 && <p className="label px-3 pt-3 pb-1">{tr('Amis')}</p>}
        {rest.map(row)}
        {contacts.length === 0 && <p className="px-3 py-4 text-sm font-bold text-black/50">{tr("Pas encore d'ami à qui envoyer : fais-toi des amis dans le jeu (au maquis, au grin, dans la rue), ou ajoute des joueurs.")}</p>}
      </div>
      {note && <p className="px-3 pb-1 text-xs font-bold text-[#a3114f]">{note}</p>}
      <div className="flex items-center gap-2 border-t border-black/5 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-black/50">{[story ? tr('Ma story') : '', ...to.map((id) => contacts.find((c) => c.id === id)?.name ?? '')].filter(Boolean).join(', ') || tr('Choisis qui le reçoit')}</span>
        <button className="flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-extrabold text-white disabled:opacity-40" style={{ background: PINK }} disabled={busy || (!story && to.length === 0)} onClick={() => onSend(to, story)}>
          {busy ? '…' : tr('Envoyer')} <Send size={17} />
        </button>
      </div>
    </div>
  )
}

/* ---------- Discussions: who sent what, the flames ---------- */

function Discussions({ inbox, onOpen, onSnap }: { inbox: { contacts: FlashContact[] } | null; onOpen: (c: FlashContact) => void; onSnap: (c: FlashContact) => void }) {
  if (!inbox) return <p className="p-4 text-sm font-bold text-black/45">{tr('Chargement…')}</p>
  if (inbox.contacts.length === 0)
    return <p className="p-4 text-sm font-bold text-black/50">{tr("Pas encore d'ami ici. Les gens rencontrés dans le jeu et tes amis joueurs apparaissent dans Flashé : envoie-leur un snap.")}</p>
  return (
    <ul className="divide-y divide-black/5">
      {inbox.contacts.map((c) => {
        const status = c.new > 0
          ? { icon: <span className="inline-block h-3 w-3 rounded-[3px]" style={{ background: PINK }} />, text: c.new > 1 ? tr('{new} nouveaux snaps', { new: c.new }) : tr('Nouveau snap'), bold: true }
          : c.last?.mine
            ? { icon: <Send size={12} className={c.last.opened ? 'text-[#e01e7e]' : ''} fill={c.last.opened ? 'none' : PINK} color={PINK} />, text: c.last.opened ? tr('Ouvert') : tr('Envoyé'), bold: false }
            : c.last
              ? { icon: <span className="inline-block h-3 w-3 rounded-[3px] border-2" style={{ borderColor: PINK }} />, text: tr('Reçu'), bold: false }
              : { icon: null, text: tr('Envoie-lui un premier snap'), bold: false }
        return (
          <li key={c.id}>
            <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-black/5" onClick={() => (c.new > 0 ? onOpen(c) : onSnap(c))}>
              <Face c={c} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-extrabold">{c.name}</span>
                <span className={`flex items-center gap-1.5 text-[12px] ${status.bold ? 'font-extrabold text-[#e01e7e]' : 'font-bold text-black/50'}`}>
                  {status.icon} {status.text}
                  {c.last && <span className="font-bold text-black/35">· {since(c.last.at)}</span>}
                </span>
              </span>
              {c.streak > 0 && <span className="text-sm font-extrabold whitespace-nowrap">🔥 {c.streak}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- A friend's snaps, one after the other, each seen once ---------- */

function Viewer({ sim, contact, onClose, onReply }: { sim: Sim; contact: FlashContact; onClose: () => void; onReply: () => void }) {
  const [ids, setIds] = useState<number[] | null>(null)
  const [at, setAt] = useState(0)
  const [snap, setSnap] = useState<{ s: FlashSnap; src: string } | null>(null)
  const [left, setLeft] = useState(0)
  const [reporting, setReporting] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    void api
      .flashFrom(sim.id, contact.id)
      .then((r) => setIds(r.ids))
      .catch(() => setIds([]))
  }, [sim.id, contact.id])
  // Each one opened in turn (once: it's gone after), a friend met in the game's painted.
  useEffect(() => {
    if (!ids) return
    if (at >= ids.length) return void onClose()
    let live = true
    setSnap(null)
    void api
      .flashOpen(sim.id, ids[at])
      .then(async (s) => {
        // Opened (it's gone after): shown whatever happens, painted if it can be, else its words alone.
        const src =
          s.photo ??
          (contact.friend
            ? await paintPost({
                id: s.id,
                account: { id: contact.id, name: contact.name, gender: contact.gender, handle: `${contact.name}.${contact.friend.seed}`, npc: true, author: { id: contact.id, firstName: contact.name, gender: contact.gender, look: friendLook(contact.friend) } },
                followed: false,
                mine: false,
                scene: s.scene,
                seed: s.seed,
                ratio: 'portrait',
                caption: '',
                place: '',
                likes: 0,
                liked: false,
                comments: 0,
                saved: false,
                shares: 0,
                at: s.at,
              }).catch(() => '')
            : '')
        if (live) (setSnap({ s, src }), setLeft(s.seconds))
      })
      .catch(() => live && setAt((a) => a + 1))
    return () => void (live = false)
  }, [ids, at]) // eslint-disable-line react-hooks/exhaustive-deps
  // The seconds it's seen, unless a report is being written.
  useEffect(() => {
    if (!snap || reporting) return
    if (left <= 0) return setAt((a) => a + 1)
    const t = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(t)
  }, [snap, left, reporting])
  const s = snap?.s
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black">
      <div className="flex items-center gap-2 px-3 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2">
        <Face c={contact} size={34} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-extrabold">{contact.name}</span>
          <span className="block truncate text-[11px] font-bold text-white/60">{s ? `${since(s.at)}${s.place ? ` · ${s.place}` : ''}` : '…'}</span>
        </span>
        {s && (
          <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold" style={{ background: `conic-gradient(${PINK} ${(left / Math.max(1, s.seconds)) * 360}deg, rgba(255,255,255,0.15) 0)` }}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-black">{left}</span>
          </span>
        )}
        {s && !contact.friend && (
          <button className="grid h-9 w-9 place-items-center rounded-full bg-white/10" onClick={() => setReporting(true)} aria-label={tr('Signaler')}>
            <Flag size={17} />
          </button>
        )}
        <button className="grid h-9 w-9 place-items-center rounded-full bg-white/10" onClick={onClose} aria-label={tr('Fermer')}>
          <X size={20} />
        </button>
      </div>
      <button className="relative mx-auto w-full flex-1 overflow-hidden rounded-2xl" style={{ maxWidth: 'calc((100dvh - 6rem) * 0.5625)' }} onClick={() => setAt((a) => a + 1)} aria-label={tr('Snap suivant')}>
        {snap?.src ? (
          <img src={snap.src} alt={s?.caption || tr('Snap de {name}', { name: contact.name })} className="absolute inset-0 h-full w-full object-cover" />
        ) : snap ? (
          <span className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#ff5fb0,#8a0f55)' }} />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-sm font-bold text-white/60">{tr('Ouverture…')}</span>
        )}
        {/* A friend met in the game's line, as a player's is baked in its photo */}
        {s && !s.photo && s.caption && <p className="absolute inset-x-0 top-[62%] bg-black/55 py-1.5 text-center text-[15px] font-bold">{s.caption}</p>}
      </button>
      <div className="px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        {reporting && s ? (
          <ReportSheet
            title={tr('Signaler ce snap')}
            onCancel={() => setReporting(false)}
            onPick={(reason) =>
              void api
                .flashReport(sim.id, s.id, reason)
                .then((x) => (setReporting(false), setNote(x.text)))
                .catch((e) => setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.'))
            }
            note={tr("La personne est bloquée tout de suite ; l'équipe regarde la photo.")}
          />
        ) : (
          <button className="w-full rounded-full py-3 text-[15px] font-extrabold" style={{ background: PINK }} onClick={onReply}>
            {tr('Répondre par un snap')}
          </button>
        )}
        {note && <p className="pt-2 text-center text-xs font-bold text-[#ffd8e8]">{note}</p>}
      </div>
    </div>
  )
}
