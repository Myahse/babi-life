import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Camera, ChevronLeft, Flag, Grid3x3, Heart, Home as HomeIcon, Inbox, MessageCircle, Music2, Play, Plus, RotateCcw, Send, Share2, Sparkles, Timer, Trash2, User, Users, VolumeX, X } from 'lucide-react'
import { api, ApiError, photoURL } from '../lib/api'
import type { Chat, Sim, TikiComment, TikiMe, TikiNPC, TikiPost, TikiProfile } from '../lib/types'
import type { Pose } from '../avatar/Human'
import { Portrait } from '../avatar/portrait'
import { Photo, ReportSheet } from '../components/Social'
import { placeHere, takePhoto } from '../world3d/snapshot'
import { setPhotoMode } from '../world3d/photoCam'
import { playEmote, stopEmote } from '../world3d/emoteNow'
import { canRecord, CLIP_MAX_MS, ClipCam, type Clip } from '../world3d/clip'
import { playSound, soundOf, SOUNDS, tikiAudio, wakeAudio } from '../lib/tikiSounds'
import { npcLook, SceneCard, TikiScene } from './TikiScene'
import type { Act } from './phoneApps'
import { AD_EVERY, TikiAd, withAds } from '../components/AdSlots'
import { useAds } from '../lib/ads'
import { keyOpen, useFeatures } from '../lib/features'

/**
 * Tikitoko (backend sims/tikitoko.go, tikisocial.go) works like TikTok: a
 * full-screen feed swiped one video at a time (« Pour toi », ranked by likes
 * and freshness, or « Abonnements »), double tap to like, the rail on the
 * right (the creator, likes, comments, favourites, shares), comments in a
 * sheet, every creator's profile with its grid, an inbox, and « + » to film.
 * The videos are short clips recorded from the game with a sound (world3d/
 * clip.ts, lib/tikiSounds.ts), posted at once; the old ones, pictures played
 * as a slow pan. The game's own creators fill the feed between the players'
 * posts, their videos played live as small 3D scenes (TikiScene.tsx). Fans
 * come with the views; from 1 000 fans the brands pay for each video.
 */

type Screen = { kind: 'home' } | { kind: 'friends' } | { kind: 'inbox' } | { kind: 'film' } | { kind: 'profile'; id: string } | { kind: 'player'; posts: TikiPost[]; start: number; back: Screen }

const nf = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : n >= 10_000 ? `${Math.round(n / 1000)} k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} k` : String(n))
const ago = (at: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60000))
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`
}
const THEME: Record<string, string> = { danse: 'danse', garba: 'garba', stade: 'stade', vlog: 'vlog', zoo: 'zoo', humour: 'humour', mode: 'look', sport: 'sport' }

export function TikitokoApp({ sim, act, onClose, photo, street = true }: { sim: Sim; act: Act; onClose: () => void; /** A photo of the gallery to post (it opens on « + »). */ photo?: { id: number; src: string }; /** Out in the street (else in a room): what « + » films. */ street?: boolean }) {
  const [screen, setScreen] = useState<Screen>({ kind: photo ? 'film' : 'home' })
  const [me, setMe] = useState<TikiMe | null>(null)
  const refreshMe = () => void api.tikiMe(sim.id).then(setMe).catch(() => undefined)
  useEffect(refreshMe, [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const nav = (s: Screen) => setScreen(s)
  const tab = screen.kind === 'player' ? null : screen.kind === 'profile' ? (screen.id === sim.id ? 'me' : null) : screen.kind
  return (
    // Full screen, as the real app: the phone's frame is left behind.
    <div className="fixed inset-0 z-[70] flex justify-center bg-black">
      <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden text-white">
        <div className="relative min-h-0 flex-1">
          {screen.kind === 'home' && <ForYou sim={sim} onClose={onClose} nav={nav} />}
          {screen.kind === 'friends' && <Feed sim={sim} source={{ tab: 'abonnements' }} title="Amis" empty="Abonne-toi à des créateurs : leurs vidéos arrivent ici." nav={nav} onBack={() => nav({ kind: 'home' })} />}
          {screen.kind === 'player' && <Feed sim={sim} source={{ posts: screen.posts, start: screen.start }} nav={nav} onBack={() => nav(screen.back)} />}
          {screen.kind === 'profile' && <Profile sim={sim} id={screen.id} me={me} nav={nav} onBack={() => nav({ kind: 'home' })} />}
          {screen.kind === 'inbox' && <InboxScreen sim={sim} me={me} nav={nav} />}
          {screen.kind === 'film' && me && <Film sim={sim} me={me} act={act} street={street} gallery={photo} onClose={() => nav({ kind: 'home' })} onPosted={() => (refreshMe(), nav({ kind: 'profile', id: sim.id }))} />}
        </div>
        {screen.kind !== 'film' && screen.kind !== 'player' && (
          <nav className="flex h-14 shrink-0 items-center justify-around border-t border-white/10 bg-black pb-[env(safe-area-inset-bottom)] text-[10px] font-bold">
            <NavItem icon={HomeIcon} label="Accueil" on={tab === 'home'} onClick={() => nav({ kind: 'home' })} />
            <NavItem icon={Users} label="Amis" on={tab === 'friends'} onClick={() => nav({ kind: 'friends' })} />
            <button aria-label="Filmer" disabled={!me} onClick={() => nav({ kind: 'film' })} className="relative h-8 w-12 disabled:opacity-40">
              <span className="absolute inset-y-0 left-0 w-10 rounded-lg bg-[#12c48b]" />
              <span className="absolute inset-y-0 right-0 w-10 rounded-lg bg-[#ff7a00]" />
              <span className="absolute inset-y-0 left-1 grid w-10 place-items-center rounded-lg bg-white text-black">
                <Plus size={20} strokeWidth={3} />
              </span>
            </button>
            <NavItem icon={Inbox} label="Boîte de réception" on={tab === 'inbox'} onClick={() => nav({ kind: 'inbox' })} />
            <NavItem icon={User} label="Profil" on={tab === 'me'} onClick={() => nav({ kind: 'profile', id: sim.id })} />
          </nav>
        )}
      </div>
    </div>
  )
}

function NavItem({ icon: Icon, label, on, onClick }: { icon: typeof HomeIcon; label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-16 flex-col items-center gap-0.5 ${on ? 'text-white' : 'text-white/60'}`}>
      <Icon size={22} strokeWidth={on ? 2.6 : 2} />
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
}

/* ---------- Accueil: « Abonnements | Pour toi » over the feed ---------- */

function ForYou({ sim, onClose, nav }: { sim: Sim; onClose: () => void; nav: (s: Screen) => void }) {
  const [tab, setTab] = useState<'pour-toi' | 'abonnements'>('pour-toi')
  return (
    <>
      <Feed key={tab} sim={sim} source={{ tab }} empty={tab === 'abonnements' ? 'Abonne-toi à des créateurs pour voir leurs vidéos ici.' : 'Rien pour le moment. Sois le premier à poster !'} nav={nav} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
        <button className="pointer-events-auto grid h-9 w-9 place-items-center" onClick={onClose} aria-label="Quitter Tikitoko">
          <ChevronLeft size={26} />
        </button>
        <div className="pointer-events-auto flex gap-5 text-[16px] font-extrabold">
          {(
            [
              ['abonnements', 'Abonnements'],
              ['pour-toi', 'Pour toi'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`relative pb-1.5 ${tab === id ? 'text-white' : 'text-white/60'}`}>
              {label}
              {tab === id && <i className="absolute inset-x-1/4 bottom-0 h-[3px] rounded-full bg-white" />}
            </button>
          ))}
        </div>
        <span className="w-9" />
      </div>
    </>
  )
}

/* ---------- The feed: one video a screen, swiped up and down ---------- */

type Source = { tab: 'pour-toi' | 'abonnements' } | { posts: TikiPost[]; start: number }

/** A game creator's post or page: its look, from its seed (the server sends none). */
// A friend's video comes with the face they had when met; a creator's is drawn from its seed.
const withLook = <T extends { author: TikiPost['author']; npc?: TikiNPC }>(p: T): T => (p.npc && !p.author.look?.skin ? { ...p, author: { ...p.author, look: npcLook(p.author.gender, p.npc.look) } } : p)

/**
 * The clips' sources, the next ones fetched ahead (prefetch): the bucket's
 * public address, else the file fetched with the token as an object URL (a
 * few kept, the oldest let go).
 */
const clips = new Map<number, Promise<string>>()
function clipSrc(simId: string, p: TikiPost): Promise<string> {
  if (p.video) return Promise.resolve(p.video)
  let pr = clips.get(p.id)
  if (!pr) {
    pr = photoURL(api.tikiVideo(simId, p.id))
    clips.set(p.id, pr)
    pr.catch(() => clips.delete(p.id))
    if (clips.size > 6) {
      const [old, gone] = clips.entries().next().value!
      clips.delete(old)
      void gone.then((u) => URL.revokeObjectURL(u)).catch(() => undefined)
    }
  }
  return pr
}
function useClipSrc(simId: string, p: TikiPost, load: boolean) {
  const [src, setSrc] = useState<string | null>(p.video ?? null)
  useEffect(() => {
    if (!load || !p.hasVideo) return
    let live = true
    clipSrc(simId, p)
      .then((u) => live && setSrc(u))
      .catch(() => undefined)
    return () => void (live = false)
  }, [simId, p.id, load]) // eslint-disable-line react-hooks/exhaustive-deps
  return load ? src : null
}

function Feed({ sim, source, title, empty, nav, onBack }: { sim: Sim; source: Source; title?: string; empty?: string; nav: (s: Screen) => void; onBack?: () => void }) {
  const given = 'posts' in source
  const [posts, setPosts] = useState<TikiPost[] | null>(given ? source.posts.map(withLook) : null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(given ? source.start : 0)
  const [comments, setComments] = useState<TikiPost | null>(null)
  const [sharing, setSharing] = useState<TikiPost | null>(null)
  // As on TikTok: the feed starts muted (browsers only autoplay that way), the first tap brings the sound.
  const [soundOn, setSoundOn] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  // Babi Pub: an ad between the videos of the feed, every few (features « pubs-applis »).
  const feats = useFeatures()
  const ads = useAds(!given && keyOpen(feats, 'pubs-applis') ? sim.commune : undefined, 'tikitoko')
  const items = useMemo(() => posts && withAds(posts, ads, AD_EVERY.tikitoko), [posts, ads])

  useEffect(() => {
    if (given) return
    api
      .tikiFeed(sim.id, source.tab)
      .then((f) => (setPosts(f.map(withLook)), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.id])
  // Opened on a video from a profile: start there.
  useEffect(() => {
    if (given && box.current) box.current.scrollTop = source.start * box.current.clientHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = (id: number, f: (p: TikiPost) => Partial<TikiPost>) => setPosts((ps) => ps?.map((p) => (p.id === id ? { ...p, ...f(p) } : p)) ?? ps)
  const like = (p: TikiPost, on = !p.liked) => {
    if (p.mine || on === p.liked) return
    patch(p.id, (x) => ({ liked: on, likes: x.likes + (on ? 1 : -1) }))
    void api.tikiLike(sim.id, p.id, on).catch(() => undefined)
  }
  const follow = (p: TikiPost) => {
    setPosts((ps) => ps?.map((x) => (x.author.id === p.author.id ? { ...x, followed: true } : x)) ?? ps)
    void api.tikiFollow(sim.id, p.author.id, true).catch(() => undefined)
  }
  const save = (p: TikiPost) => {
    patch(p.id, (x) => ({ saved: !x.saved, saves: x.saves + (x.saved ? -1 : 1) }))
    void api.tikiSave(sim.id, p.id, !p.saved).catch(() => undefined)
  }

  return (
    <div className="absolute inset-0">
      <div
        ref={box}
        // overscroll-contain: a swipe past the first or last video doesn't drag the page (or reload it on mobile).
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight))}
      >
        {items?.map((it, i) => {
          if ('ad' in it) return <TikiAd key={it.key} ad={it.ad} commune={sim.commune} active={i === current} />
          const p = it.post
          return (
          <Video
            key={p.id}
            sim={sim}
            post={p}
            active={i === current}
            near={Math.abs(i - current) <= 1}
            soundOn={soundOn}
            onUnmute={() => (wakeAudio(), setSoundOn(true))}
            onLike={(on) => like(p, on)}
            onFollow={() => follow(p)}
            onSave={() => save(p)}
            onComments={() => setComments(p)}
            onShare={() => setSharing(p)}
            onProfile={() => nav({ kind: 'profile', id: p.author.id })}
          />
          )
        })}
        {posts?.length === 0 && <p className="grid h-full place-items-center px-10 text-center text-sm font-bold text-white/60">{empty}</p>}
        {posts === null && !error && <p className="grid h-full place-items-center text-sm font-bold text-white/60">Chargement…</p>}
        {error && <p className="grid h-full place-items-center px-10 text-center text-sm font-bold text-[#ffa8a8]">{error}</p>}
      </div>
      {onBack && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/50 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
          <button className="pointer-events-auto grid h-9 w-9 place-items-center" onClick={onBack} aria-label="Retour">
            <ChevronLeft size={26} />
          </button>
          {title && <span className="text-[16px] font-extrabold">{title}</span>}
        </div>
      )}
      {comments && <Comments sim={sim} post={comments} onClose={() => setComments(null)} onCount={(n) => patch(comments.id, () => ({ comments: n }))} />}
      {sharing && (
        <ShareSheet
          sim={sim}
          post={sharing}
          onClose={() => setSharing(null)}
          onShared={() => patch(sharing.id, (x) => ({ shares: x.shares + 1 }))}
          onGone={() => (setPosts((ps) => ps?.filter((x) => x.id !== sharing.id && (sharing.mine || !!sharing.npc || x.author.id !== sharing.author.id)) ?? ps), setSharing(null))}
        />
      )}
    </div>
  )
}

/** The sound's line under the caption: a game sound, or the clip's own. */
const soundLine = (p: TikiPost) => {
  const s = soundOf(p.sound ?? '')
  return s.id ? `${s.name} - ${s.artist}` : `son original - @${p.handle}`
}

type VideoProps = {
  sim: Sim
  post: TikiPost
  /** On screen: it plays. */
  active: boolean
  /** On screen or next to it: its clip is fetched (the next one ahead). */
  near: boolean
  soundOn: boolean
  onUnmute: () => void
  onLike: (on?: boolean) => void
  onFollow: () => void
  onSave: () => void
  onComments: () => void
  onShare: () => void
  onProfile: () => void
}

/**
 * One video: a recorded clip, a game creator's live scene, or (old posts)
 * the picture played as a slow pan. Only the one on screen plays, from the
 * start, in a loop; tap to pause (the first tap brings the sound), double tap
 * to like; the rail and the caption over it.
 */
function Video({ sim, post: p, active, near, soundOn, onUnmute, onLike, onFollow, onSave, onComments, onShare, onProfile }: VideoProps) {
  const [paused, setPaused] = useState(false)
  // The browser refused this clip's sound (iOS wants a tap for each video): muted until tapped.
  const [mutedHere, setMutedHere] = useState(false)
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const lastTap = useRef(0)
  const single = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vid = useRef<HTMLVideoElement>(null)
  const bar = useRef<HTMLElement>(null)
  const src = useClipSrc(sim.id, p, near)
  const moving = !!p.hasVideo || !!p.npc
  const playing = active && !paused
  const playingNow = useRef(playing)
  playingNow.current = playing
  useEffect(() => setPaused(false), [active])

  // The clip plays when on screen and not paused; off screen it's back to the start.
  useEffect(() => {
    const v = vid.current
    if (!v) return
    v.muted = !soundOn
    if (playing)
      void v.play().catch(() => {
        // Sound refused (no tap yet on this device): muted then, as TikTok does.
        if (!v.muted) {
          v.muted = true
          setMutedHere(true)
          void v.play().catch(() => undefined)
        }
      })
    else {
      v.pause()
      if (!active) v.currentTime = 0
    }
  }, [playing, active, soundOn, src])

  // A game creator's video: its sound is played here (a recorded clip carries its own).
  useEffect(() => {
    if (!p.npc || !p.sound || !playing || !soundOn) return
    const ctx = tikiAudio()
    return ctx ? playSound(ctx, p.sound, [ctx.destination]) : undefined
  }, [p.npc, p.sound, playing, soundOn])

  // The bar under the video follows the real time (the clip's own, or the scene's loop).
  useEffect(() => {
    if (!active || !moving) return
    const len = p.durationMs || 10000
    let raf = 0
    let acc = 0
    let last = performance.now()
    const tick = (now: number) => {
      if (playingNow.current) acc += now - last
      last = now
      const v = vid.current
      // A recorded WebM may not know its duration (Infinity): the post's own length is used.
      const ms = v && p.hasVideo ? v.currentTime * 1000 : acc
      if (bar.current) bar.current.style.width = `${((ms % len) / len) * 100}%`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, moving, p.durationMs, p.hasVideo])

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const now = Date.now()
    if (now - lastTap.current < 300) {
      // Double tap: a heart where the finger is, and a like (never an unlike).
      if (single.current) clearTimeout(single.current)
      const h = { id: now, x: e.clientX - r.left, y: e.clientY - r.top }
      setHearts((hs) => [...hs, h])
      setTimeout(() => setHearts((hs) => hs.filter((x) => x.id !== h.id)), 900)
      onLike(true)
    } else if (!soundOn || mutedHere) {
      // The first tap: the sound, right now (in the tap itself, or the browser refuses it).
      const v = vid.current
      if (v) {
        v.muted = false
        void v.play().catch(() => undefined)
      }
      setMutedHere(false)
      onUnmute()
    } else single.current = setTimeout(() => setPaused((v) => !v), 280)
    lastTap.current = now
  }
  const run = playing ? 'running' : 'paused'
  return (
    // --run pauses everything that moves in this video (the pan, the disc, the sound's name, the bar).
    // No callout or selection on a long press: it's a video, not a page.
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-black select-none [-webkit-touch-callout:none]" style={{ ['--run' as string]: run }} onContextMenu={(e) => e.preventDefault()}>
      <div className="absolute inset-0" onClick={tap}>
        {p.npc ? (
          active ? (
            <TikiScene theme={p.theme} scene={p.npc.scene} look={p.author.look} gender={p.author.gender} playing={playing} />
          ) : (
            <SceneCard theme={p.theme} className="absolute inset-0 h-full w-full" />
          )
        ) : p.hasVideo ? (
          <>
            <Photo path={api.tikiPhoto(sim.id, p.id)} alt={p.caption || 'Vidéo Tikitoko'} className="absolute inset-0 h-full w-full" />
            {src && <video ref={vid} src={src} loop playsInline muted preload="auto" disablePictureInPicture className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
          </>
        ) : (
          <Photo path={api.tikiPhoto(sim.id, p.id)} alt={p.caption || 'Vidéo Tikitoko'} className="tiki-pan absolute inset-0 h-full w-full" />
        )}
        {paused && (
          <span className="absolute top-1/2 left-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/30">
            <Play size={44} fill="white" className="opacity-80" />
          </span>
        )}
        {active && (!soundOn || mutedHere) && moving && (
          <span className="pointer-events-none absolute top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-extrabold">
            <VolumeX size={15} /> Appuie pour le son
          </span>
        )}
        {hearts.map((h) => (
          <Heart key={h.id} size={96} className="tiki-heart pointer-events-none absolute fill-[#ff3b5c] text-[#ff3b5c]" style={{ left: h.x - 48, top: h.y - 48 }} />
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      {/* The rail */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 text-[12px] font-extrabold [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        <div className="relative mb-2">
          <button onClick={onProfile} className="block h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-white" aria-label={`Profil de @${p.handle}`}>
            <Portrait look={p.author.look} gender={p.author.gender} framing="head" />
          </button>
          {/* The game's creators aren't players: nobody to follow among the Sims. */}
          {!p.mine && !p.followed && !p.npc && (
            <button onClick={onFollow} aria-label="Suivre" className="absolute -bottom-2.5 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-[#ff7a00]">
              <Plus size={14} strokeWidth={3} />
            </button>
          )}
        </div>
        <RailButton label={nf(p.likes)} onClick={() => onLike()} aria="J'aime">
          <Heart size={32} className={p.liked ? 'tiki-pop fill-[#ff3b5c] text-[#ff3b5c]' : 'fill-white/90 text-white'} />
        </RailButton>
        <RailButton label={nf(p.comments)} onClick={onComments} aria="Commentaires">
          <MessageCircle size={30} className="fill-white/90 text-white" />
        </RailButton>
        <RailButton label={nf(p.saves)} onClick={onSave} aria="Favoris">
          <Bookmark size={30} className={p.saved ? 'tiki-pop fill-[#ffc400] text-[#ffc400]' : 'fill-white/90 text-white'} />
        </RailButton>
        <RailButton label={nf(p.shares)} onClick={onShare} aria="Partager">
          <Share2 size={28} className="text-white" />
        </RailButton>
        {/* The sound's disc, turning with the video */}
        <span className="tiki-disc mt-1 grid h-11 w-11 place-items-center rounded-full bg-[conic-gradient(#333,#111,#333,#111,#333)]">
          <span className="block h-6 w-6 overflow-hidden rounded-full bg-white">
            <Portrait look={p.author.look} gender={p.author.gender} framing="head" />
          </span>
        </span>
      </div>

      {/* The caption */}
      <div className="pointer-events-none absolute right-20 bottom-4 left-3 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        <button className="pointer-events-auto text-[16px] font-extrabold" onClick={onProfile}>
          @{p.handle}
        </button>
        {p.friend && <span className="ml-2 rounded-full bg-[#ff7a00] px-2 py-0.5 text-[11px] font-extrabold">Ton ami·e</span>}
        <span className="ml-2 text-[12px] font-bold text-white/70">· {ago(p.at)}</span>
        <p className="mt-1 text-[14px] leading-snug font-semibold">
          {p.caption} <span className="font-extrabold">#{THEME[p.theme] ?? p.theme} #babi</span>
        </p>
        {p.place && <p className="mt-1 inline-block rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-bold">📍 {p.place}</p>}
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden text-[13px] font-semibold">
          <Music2 size={14} className="shrink-0" />
          <span className="overflow-hidden whitespace-nowrap">
            <span className="tiki-marquee inline-block">
              {soundLine(p)} · {soundLine(p)} ·&nbsp;
            </span>
          </span>
        </div>
      </div>
      {/* How far the video has played */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/20">{moving ? <i ref={bar} className="block h-full w-0 bg-white/80" /> : <i key={active ? 'on' : 'off'} className="tiki-progress block h-full bg-white/80" />}</div>
    </section>
  )
}

function RailButton({ label, onClick, aria, children }: { label: string; onClick: () => void; aria: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={aria} className="flex flex-col items-center gap-0.5 active:scale-90">
      {children}
      {label}
    </button>
  )
}

/* ---------- Comments, in a sheet ---------- */

// The replies under the comment they answer (update « repondre-message »), one level deep like TikTok:
// a reply to a reply goes under the same first comment. More than this, they wait for « Voir N réponses ».
const REPLIES_SHOWN = 2

/** The comments as TikTok lays them: the first ones, each with its replies (oldest first). */
function threads(list: TikiComment[]) {
  const byId = new Map(list.map((c) => [c.id, c]))
  const rootOf = (c: TikiComment) => {
    let r = c
    for (let i = 0; i < 20 && r.replyTo && byId.has(r.replyTo); i++) r = byId.get(r.replyTo)!
    return r
  }
  const replies = new Map<string, TikiComment[]>()
  const tops: TikiComment[] = []
  for (const c of list) {
    const root = rootOf(c)
    if (root === c) tops.push(c)
    else replies.set(root.id, [...(replies.get(root.id) ?? []), c])
  }
  for (const r of replies.values()) r.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return { tops, replies, byId, rootOf }
}

function Comments({ sim, post, onClose, onCount }: { sim: Sim; post: TikiPost; onClose: () => void; onCount: (n: number) => void }) {
  const [list, setList] = useState<TikiComment[] | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState<TikiComment | null>(null)
  const [busy, setBusy] = useState(false)
  const [replying, setReplying] = useState<TikiComment | null>(null)
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set())
  const input = useRef<HTMLInputElement>(null)
  const feats = useFeatures()
  const canReply = keyOpen(feats, 'repondre-message')
  const load = () =>
    api
      .tikiComments(sim.id, post.id)
      .then((l) => (setList(l), onCount(l.length)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  useEffect(() => void load(), []) // eslint-disable-line react-hooks/exhaustive-deps
  const tree = useMemo(() => list && threads(list), [list])

  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.tikiComment(sim.id, post.id, text, replying?.id)
      setText('')
      // The thread answered stays open, the reply in sight.
      if (replying && tree) setUnfolded((u) => new Set(u).add(tree.rootOf(replying).id))
      setReplying(null)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Pas de réseau')
    } finally {
      setBusy(false)
    }
  }
  const like = (c: TikiComment) => {
    setList((l) => l?.map((x) => (x.id === c.id ? { ...x, liked: !c.liked, likes: x.likes + (c.liked ? -1 : 1) } : x)) ?? l)
    // The audience's comments live in the game only, and the players' under a game creator's video have no
    // hearts on the server: their hearts stay on this screen.
    if (c.author && !c.id.startsWith('n')) void api.tikiCommentLike(sim.id, c.id, !c.liked).catch(() => undefined)
  }
  const answer = (c: TikiComment) => {
    setReplying(c)
    input.current?.focus()
  }
  // A comment, or a reply under one (smaller); a reply to a reply says to whom, one whose comment is gone says so.
  const row = (c: TikiComment, reply: boolean) => {
    const parent = c.replyTo ? tree?.byId.get(c.replyTo) : undefined
    const to = reply && parent && parent.replyTo ? parent.handle : !parent && c.quote && !c.quote.deleted ? c.quote.name : null
    return (
      <div className="flex gap-3">
        <span className={`block shrink-0 overflow-hidden rounded-full bg-[#eee] ${reply ? 'h-7 w-7' : 'h-9 w-9'}`}>
          {c.author ? <Portrait look={c.author.look} gender={c.author.gender} framing="head" /> : <span className="grid h-full place-items-center text-sm font-extrabold text-black/60" style={{ background: `hsl(${(c.handle.length * 47) % 360} 70% 85%)` }}>{c.name[0]}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-black/50">
            {c.handle} {c.byCreator && <span className="ml-1 rounded bg-[#ff7a00] px-1 text-[10px] text-white">Créateur</span>}
          </p>
          {!parent && c.quote?.deleted && <p className="text-[11px] font-semibold text-black/40 italic">En réponse à un commentaire supprimé</p>}
          <p className="text-[14px] leading-snug font-semibold text-black">
            {to && <span className="mr-1 text-black/45">▸ @{to}</span>}
            {c.body}
          </p>
          <p className="mt-0.5 flex gap-3 text-[11px] font-bold text-black/40">
            {ago(c.at)}
            {canReply && c.author && (
              <button onClick={() => answer(c)} className="flex items-center gap-0.5">
                Répondre
              </button>
            )}
            {c.canDelete && c.author && (
              <button onClick={() => void api.tikiUncomment(sim.id, c.id).then(load).catch(() => undefined)} className="flex items-center gap-0.5">
                <Trash2 size={11} /> Supprimer
              </button>
            )}
            {c.author && !c.mine && (
              <button onClick={() => setReporting(c)} className="flex items-center gap-0.5">
                <Flag size={11} /> Signaler
              </button>
            )}
          </p>
        </div>
        <button onClick={() => like(c)} className="flex flex-col items-center text-[11px] font-bold text-black/40" aria-label="J'aime le commentaire">
          <Heart size={16} className={c.liked ? 'fill-[#ff3b5c] text-[#ff3b5c]' : ''} />
          {c.likes > 0 && nf(c.likes)}
        </button>
      </div>
    )
  }
  return (
    <Sheet onClose={onClose} title={`${nf(list?.length ?? post.comments)} commentaires`}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {list === null && !error && <p className="py-8 text-center text-sm font-bold text-black/50">Chargement…</p>}
        {list?.length === 0 && <p className="py-8 text-center text-sm font-bold text-black/50">Pas encore de commentaire. Lance la discussion !</p>}
        {reporting && (
          <div className="my-2">
            <ReportSheet
              title={`Signaler le commentaire de @${reporting.handle}`}
              note="Tu ne verras plus ce joueur ; l'équipe regarde le signalement."
              onCancel={() => setReporting(null)}
              onPick={(reason) =>
                void api
                  .tikiCommentReport(sim.id, reporting.id, reason)
                  .then((x) => (setReporting(null), setError(x.text), load()))
                  .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
              }
            />
          </div>
        )}
        <ul className="space-y-4 py-2">
          {tree?.tops.map((c) => {
            const replies = tree.replies.get(c.id) ?? []
            const open = replies.length <= REPLIES_SHOWN || unfolded.has(c.id)
            return (
              <li key={c.id}>
                {row(c, false)}
                {replies.length > 0 && (
                  <div className="mt-3 ml-12 space-y-3">
                    {open && replies.map((r) => <div key={r.id}>{row(r, true)}</div>)}
                    {replies.length > REPLIES_SHOWN && (
                      <button onClick={() => setUnfolded((u) => (u.has(c.id) ? new Set([...u].filter((x) => x !== c.id)) : new Set(u).add(c.id)))} className="flex items-center gap-2 text-[12px] font-bold text-black/45">
                        <span className="h-px w-6 bg-black/20" />
                        {open ? 'Masquer' : `Voir ${replies.length} réponses`}
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {error && <p className="px-4 pb-1 text-xs font-bold text-[#d81b3f]">{error}</p>}
      {replying && (
        <div className="flex items-center gap-2 border-t border-black/10 bg-[#f8f8f8] px-4 py-2 text-[12px] font-bold text-black/55">
          <span className="min-w-0 flex-1 truncate">Réponse à @{replying.handle}</span>
          <button onClick={() => setReplying(null)} aria-label="Ne plus répondre" className="grid h-6 w-6 place-items-center rounded-full text-black/50 active:bg-black/5">
            <X size={15} />
          </button>
        </div>
      )}
      <div className={`flex items-center gap-2 p-3 ${replying ? '' : 'border-t border-black/10'}`}>
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 150))}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder={replying ? `Réponds à @${replying.handle}…` : 'Ajoute un commentaire…'}
          className="min-w-0 flex-1 rounded-full bg-[#f1f1f2] px-4 py-2.5 text-sm font-semibold text-black outline-none"
        />
        <button onClick={() => void send()} disabled={!text.trim() || busy} aria-label="Envoyer" className="grid h-10 w-10 place-items-center rounded-full bg-[#ff7a00] text-white disabled:opacity-40">
          <Send size={18} />
        </button>
      </div>
      <p className="px-4 pb-3 text-center text-[10px] font-bold text-black/40">Liens et numéros masqués. Sois respectueux·se : tout se signale.</p>
    </Sheet>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div className="animate-up flex max-h-[72%] min-h-[50%] flex-col rounded-t-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="relative py-3 text-center text-[13px] font-extrabold text-black">
          {title}
          <button onClick={onClose} className="absolute top-2 right-3 grid h-8 w-8 place-items-center text-black/60" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Share: send to a friend in Gbairai; report; delete one's own ---------- */

function ShareSheet({ sim, post, onClose, onShared, onGone }: { sim: Sim; post: TikiPost; onClose: () => void; onShared: () => void; onGone: () => void }) {
  const [chats, setChats] = useState<Chat[] | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const [reporting, setReporting] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => void api.chats(sim.id).then(setChats).catch(() => setChats([])), [sim.id])
  const send = async (c: Chat) => {
    try {
      await api.write(sim.id, c.friend.id, `🎬 Regarde la vidéo Tikitoko de @${post.handle}${post.caption ? ` : « ${post.caption} »` : ''}`)
      await api.tikiShare(sim.id, post.id)
      setSent((s) => [...s, c.friend.id])
      onShared()
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau')
    }
  }
  const friends = (chats ?? []).filter((c) => !c.blocked)
  return (
    <Sheet onClose={onClose} title="Partager">
      <div className="px-4 pb-5">
        <p className="mb-2 text-[12px] font-extrabold text-black/50">Envoyer à (Gbairai)</p>
        {chats === null && <p className="text-sm font-bold text-black/50">Chargement…</p>}
        {chats && friends.length === 0 && <p className="text-sm font-bold text-black/50">Ajoute des amis joueurs (appli Amis) pour leur envoyer des vidéos.</p>}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {friends.map((c) => (
            <button key={c.friend.id} onClick={() => void send(c)} disabled={sent.includes(c.friend.id)} className="flex w-16 shrink-0 flex-col items-center gap-1 text-[11px] font-bold text-black">
              <span className="block h-14 w-14 overflow-hidden rounded-full bg-[#eee]">
                <Portrait look={c.friend.look} gender={c.friend.gender} framing="head" />
              </span>
              <span className="max-w-full truncate">{sent.includes(c.friend.id) ? 'Envoyé ✓' : c.friend.firstName}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-4 border-t border-black/10 pt-3">
          {post.mine ? (
            <button onClick={() => void api.tikiDelete(sim.id, post.id).then(onGone).catch(() => undefined)} className="flex w-16 flex-col items-center gap-1 text-[11px] font-bold text-black">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f1f1f2]">
                <Trash2 size={20} />
              </span>
              Supprimer
            </button>
          ) : (
            <button onClick={() => setReporting(true)} className="flex w-16 flex-col items-center gap-1 text-[11px] font-bold text-black">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f1f1f2]">
                <Flag size={20} />
              </span>
              Signaler
            </button>
          )}
        </div>
        {reporting && (
          <div className="mt-3">
            <ReportSheet
              title={`Signaler la vidéo de @${post.handle}`}
              note="Tu ne verras plus ses vidéos ; l'équipe regarde le signalement."
              onCancel={() => setReporting(false)}
              onPick={(reason) =>
                void api
                  .tikiReport(sim.id, post.id, reason)
                  .then(onGone)
                  .catch((e) => setNote(e instanceof ApiError ? e.message : 'Pas de réseau'))
              }
            />
          </div>
        )}
        {note && <p className="mt-2 text-xs font-bold text-[#d81b3f]">{note}</p>}
      </div>
    </Sheet>
  )
}

/* ---------- Profiles ---------- */

function Profile({ sim, id, me, nav, onBack }: { sim: Sim; id: string; me: TikiMe | null; nav: (s: Screen) => void; onBack: () => void }) {
  const [p, setP] = useState<TikiProfile | null>(null)
  const [tab, setTab] = useState<'videos' | 'favoris'>('videos')
  const [posts, setPosts] = useState<TikiPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api
      .tikiProfile(sim.id, id)
      .then((x) => setP(withLook(x)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  }, [sim.id, id])
  useEffect(() => {
    setPosts(null)
    api
      .tikiFeed(sim.id, tab === 'favoris' ? 'favoris' : 'auteur', id)
      .then((ps) => setPosts(ps.map(withLook)))
      .catch(() => setPosts([]))
  }, [sim.id, id, tab])
  const follow = () => {
    if (!p) return
    setP({ ...p, followed: !p.followed, fans: p.fans + (p.followed ? -1 : 1) })
    void api.tikiFollow(sim.id, p.author.id, !p.followed).catch(() => undefined)
  }
  return (
    <div className="absolute inset-0 overflow-y-auto bg-black">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-black px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button className="grid h-9 w-9 place-items-center" onClick={onBack} aria-label="Retour">
          <ChevronLeft size={26} />
        </button>
        <span className="text-[16px] font-extrabold">{p ? p.author.firstName : ''}</span>
        <span className="w-9" />
      </div>
      {error && <p className="px-6 py-10 text-center text-sm font-bold text-[#ffa8a8]">{error}</p>}
      {p && (
        <div className="flex flex-col items-center px-4">
          <span className="block h-24 w-24 overflow-hidden rounded-full bg-white">
            <Portrait look={p.author.look} gender={p.author.gender} framing="head" />
          </span>
          <p className="mt-2 text-[16px] font-extrabold">@{p.handle}</p>
          <div className="mt-3 flex gap-6 text-center">
            {(
              [
                [p.following, 'Abonnements'],
                [p.fans, 'Abonnés'],
                [p.likes, "J'aime"],
              ] as const
            ).map(([n, label]) => (
              <div key={label}>
                <div className="text-[17px] font-extrabold">{nf(n)}</div>
                <div className="text-[12px] font-semibold text-white/60">{label}</div>
              </div>
            ))}
          </div>
          {p.mine ? (
            <div className="mt-4 flex w-full max-w-xs gap-2">
              <button className="flex-1 rounded-md bg-white/15 py-2 text-sm font-extrabold" disabled={!me} onClick={() => nav({ kind: 'film' })}>
                <Camera size={15} className="mr-1 inline" /> Filmer
              </button>
            </div>
          ) : p.npc ? null : (
            <button onClick={follow} className={`mt-4 w-40 rounded-md py-2 text-sm font-extrabold ${p.followed ? 'bg-white/15' : 'bg-[#ff7a00]'}`}>
              {p.followed ? 'Abonné·e' : 'Suivre'}
            </button>
          )}
          <p className="mt-3 text-center text-[13px] font-semibold text-white/80">
            {p.tier} · {p.posts} vidéo{p.posts > 1 ? 's' : ''}
          </p>
          {p.mine && me && me.next > 0 && (
            <div className="mt-2 w-full max-w-xs">
              <div className="h-1 overflow-hidden rounded-full bg-white/15">
                <i className="block h-full bg-[#12c48b]" style={{ width: `${Math.min(100, (me.fans / me.next) * 100)}%` }} />
              </div>
              <p className="mt-1 text-center text-[11px] font-bold text-white/50">{me.fans < me.dealFrom ? `À ${nf(me.dealFrom)} abonnés, les marques te paient chaque vidéo.` : `Prochain niveau à ${nf(me.next)} abonnés.`}</p>
            </div>
          )}
        </div>
      )}
      <div className="sticky top-[calc(max(0.75rem,env(safe-area-inset-top))+2.75rem)] z-10 mt-4 flex border-b border-white/10 bg-black">
        <button onClick={() => setTab('videos')} className={`flex flex-1 justify-center py-2.5 ${tab === 'videos' ? 'border-b-2 border-white' : 'text-white/50'}`} aria-label="Vidéos">
          <Grid3x3 size={20} />
        </button>
        {p?.mine && (
          <button onClick={() => setTab('favoris')} className={`flex flex-1 justify-center py-2.5 ${tab === 'favoris' ? 'border-b-2 border-white' : 'text-white/50'}`} aria-label="Favoris">
            <Bookmark size={20} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts?.map((x, i) => (
          <button key={x.id} className="relative aspect-[9/16] overflow-hidden bg-[#111]" onClick={() => nav({ kind: 'player', posts, start: i, back: { kind: 'profile', id } })}>
            {x.npc ? <SceneCard theme={x.theme} className="absolute inset-0 h-full w-full" /> : <Photo path={api.tikiPhoto(sim.id, x.id)} alt={x.caption || 'Vidéo'} className="absolute inset-0 h-full w-full" />}
            <span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[11px] font-extrabold [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              <Play size={11} fill="white" /> {nf(x.views)}
            </span>
          </button>
        ))}
      </div>
      {posts?.length === 0 && <p className="px-6 py-10 text-center text-sm font-bold text-white/50">{tab === 'favoris' ? 'Les vidéos que tu ajoutes à tes favoris arrivent ici.' : p?.mine ? 'Pas encore de vidéo. Appuie sur « + » pour filmer.' : 'Pas encore de vidéo.'}</p>}
    </div>
  )
}

/* ---------- Boîte de réception: what happens to one's videos ---------- */

function InboxScreen({ sim, me, nav }: { sim: Sim; me: TikiMe | null; nav: (s: Screen) => void }) {
  const [posts, setPosts] = useState<TikiPost[] | null>(null)
  useEffect(() => void api.tikiFeed(sim.id, 'auteur', sim.id).then(setPosts).catch(() => setPosts([])), [sim.id])
  return (
    <div className="absolute inset-0 overflow-y-auto bg-black px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <h2 className="text-center text-[16px] font-extrabold">Boîte de réception</h2>
      {me && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#12c48b]">
            <Users size={20} />
          </span>
          <div className="text-sm">
            <p className="font-extrabold">Nouveaux abonnés</p>
            <p className="text-white/60">
              {nf(me.fans)} abonnés · {me.tier}
            </p>
          </div>
        </div>
      )}
      <p className="mt-5 mb-2 text-[12px] font-extrabold text-white/50">Activité</p>
      {posts?.length === 0 && <p className="py-6 text-center text-sm font-bold text-white/50">Poste ta première vidéo : les likes et les commentaires arrivent ici.</p>}
      <ul className="space-y-3 pb-6">
        {posts?.map((p, i) => (
          <li key={p.id}>
            <button className="flex w-full items-center gap-3 text-left" onClick={() => nav({ kind: 'player', posts, start: i, back: { kind: 'inbox' } })}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ff3b5c]">
                <Heart size={20} fill="white" />
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-extrabold">
                  {nf(p.likes)} j'aime · {nf(p.comments)} commentaires
                </span>
                <span className="block truncate text-white/60">
                  {p.caption || 'Ta vidéo'} · {nf(p.views)} vues · {ago(p.at)}
                </span>
              </span>
              <span className="relative block h-14 w-10 shrink-0 overflow-hidden rounded bg-[#111]">
                <Photo path={api.tikiPhoto(sim.id, p.id)} alt="" className="absolute inset-0 h-full w-full" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- « + »: filming ---------- */

/** The moves the Sim can do while filmed (poses of avatar/Human.tsx, emotes among them). */
const MOVES: [Pose, string][] = [
  ['dance', 'Danse'],
  ['zouglou', 'Zouglou'],
  ['gweta', 'Gweta'],
  ['robot', 'Robot'],
  ['moonwalk', 'Moonwalk'],
  ['dab', 'Dab'],
  ['cheer', 'Ambiance'],
  ['laugh', 'Fou rire'],
  ['wave', 'Coucou'],
  ['flex', 'Muscles'],
  ['talk', 'Blabla'],
]
const LENGTHS = [5, 10, 15]
/** Under this, a press is a tap (records the chosen length); longer, a hold (records until let go). */
const HOLD_MS = 450

type FilmProps = { sim: Sim; me: TikiMe; act: Act; street: boolean; gallery?: { id: number; src: string }; onClose: () => void; onPosted: () => void }

/** A clip recorded from the game when the browser can; a photo of the gallery, or where it can't, as before. */
function Film(props: FilmProps) {
  return props.gallery || !canRecord() ? <PhotoFilm {...props} /> : <ClipFilm {...props} />
}

/**
 * Filming like TikTok: the game seen upright round the Sim, a sound and a
 * move to pick, a length (5, 10, 15 s); tap the button to record that long,
 * or hold it and let go. The Sim does the move while it's filmed; the clip
 * is played back, then posted at once with its theme and caption.
 */
function ClipFilm({ sim, me, act, street, onClose, onPosted }: FilmProps) {
  const view = useRef<HTMLDivElement>(null)
  const cam = useRef<ClipCam | null>(null)
  const [length, setLength] = useState(10)
  const [sound, setSound] = useState('decale')
  const [move, setMove] = useState<Pose>('dance')
  const [picking, setPicking] = useState<'son' | 'move' | null>(null)
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<(Clip & { url: string }) | null>(null)
  const [theme, setTheme] = useState(me.themes[0]?.id ?? 'danse')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const rec = useRef<{ stop: () => Promise<Clip>; began: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const held = useRef(false)
  const ring = useRef<SVGCircleElement>(null)
  const preview = useRef<(() => void) | null>(null)

  const stopPreview = () => {
    preview.current?.()
    preview.current = null
  }
  useEffect(() => {
    const c = new ClipCam(street)
    cam.current = c
    c.canvas.className = 'h-full w-full object-cover'
    view.current?.appendChild(c.canvas)
    // In the street the phone stands a few steps ahead, the whole Sim in view; in a room, the room as it's seen.
    if (street) setPhotoMode('film')
    const check = setTimeout(() => !c.ready && setNote('Rien à filmer ici : sors dans la rue ou entre quelque part.'), 2000)
    return () => {
      clearTimeout(check)
      if (rec.current) clearTimeout(rec.current.timer)
      void rec.current?.stop()
      c.close()
      c.canvas.remove()
      if (street) setPhotoMode(null)
      stopEmote()
      stopPreview()
    }
  }, [street])
  useEffect(() => () => void (clip && URL.revokeObjectURL(clip.url)), [clip])

  // The ring round the button: how much of the clip is recorded.
  useEffect(() => {
    if (!recording) return
    let raf = 0
    const tick = () => {
      const r = rec.current
      if (r && ring.current) {
        const k = Math.min(1, (performance.now() - r.began) / (held.current ? CLIP_MAX_MS : length * 1000))
        ring.current.style.strokeDashoffset = String(276 * (1 - k))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [recording, length])

  const finish = async () => {
    const r = rec.current
    if (!r) return
    rec.current = null
    clearTimeout(r.timer)
    const c = await r.stop()
    stopEmote()
    setRecording(false)
    if (c.durationMs < 1000 || !c.blob.size) return setNote('Trop court : tape le bouton, ou garde le doigt dessus plus longtemps.')
    if (c.blob.size > 4 * 1024 * 1024) return setNote('Vidéo trop lourde : essaie plus court.')
    setNote(null)
    setClip({ ...c, url: URL.createObjectURL(c.blob) })
  }
  const begin = () => {
    if (rec.current || !cam.current?.ready) return
    wakeAudio()
    stopPreview()
    setPicking(null)
    const r = cam.current.record(sound)
    playEmote(move, CLIP_MAX_MS / 1000 + 1)
    // A tap records the chosen length; while the finger stays down, it goes on (up to 15 s).
    const timer = setTimeout(() => {
      if (!rec.current) return
      if (held.current) rec.current.timer = setTimeout(() => void finish(), Math.max(0, CLIP_MAX_MS - (performance.now() - rec.current.began)))
      else void finish()
    }, length * 1000)
    rec.current = { stop: r.stop, began: performance.now(), timer }
    setRecording(true)
    setNote(null)
  }
  const down = () => {
    if (rec.current) return void finish() // a tap while recording stops it
    held.current = true
    begin()
  }
  const up = () => {
    const was = held.current
    held.current = false
    const r = rec.current
    if (was && r && performance.now() - r.began > HOLD_MS) void finish()
  }
  const pickSound = (id: string) => {
    setSound(id)
    stopPreview()
    wakeAudio()
    const ctx = tikiAudio()
    // A few seconds of it, to hear what it is.
    if (id && ctx) {
      const stop = playSound(ctx, id, [ctx.destination])
      const t = setTimeout(stopPreview, 4000)
      preview.current = () => (clearTimeout(t), stop())
    }
  }
  const post = async () => {
    if (!clip || busy) return
    setBusy(true)
    const ok = await act('Publier sur Tikitoko', 'camera', 'social', () => api.tikiPostVideo(sim.id, { video: clip.blob, poster: clip.poster, durationMs: clip.durationMs, sound }, caption, theme, placeHere()))
    setBusy(false)
    if (ok) onPosted()
  }
  const s = soundOf(sound)

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={view} className={`absolute inset-0 ${clip ? 'invisible' : ''}`} />
        {clip && <video src={clip.url} autoPlay loop playsInline className="absolute inset-0 h-full w-full object-cover" />}
        <button className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/40" onClick={onClose} aria-label="Fermer">
          <X size={22} />
        </button>
        {!clip && (
          <>
            <button disabled={recording} onClick={() => setPicking(picking === 'son' ? null : 'son')} className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 flex max-w-[60%] -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-extrabold">
              <Music2 size={14} className="shrink-0" /> <span className="truncate">{s.id ? s.name : 'Ajouter un son'}</span>
            </button>
            <div className="absolute top-[calc(max(0.75rem,env(safe-area-inset-top))+3rem)] right-3 flex flex-col items-center gap-3 text-[10px] font-extrabold [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
              <button disabled={recording} onClick={() => setPicking(picking === 'move' ? null : 'move')} className="flex flex-col items-center gap-0.5">
                <Sparkles size={22} /> {MOVES.find(([m]) => m === move)?.[1]}
              </button>
              <div className="flex flex-col items-center gap-1">
                <Timer size={22} />
                {LENGTHS.map((n) => (
                  <button key={n} disabled={recording} onClick={() => setLength(n)} className={`rounded-full px-2 py-0.5 ${length === n ? 'bg-white text-black' : 'bg-black/40'}`}>
                    {n} s
                  </button>
                ))}
              </div>
            </div>
            {picking && (
              <div className="absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3rem)] right-16 z-10 flex flex-wrap gap-1.5 rounded-2xl bg-black/70 p-2.5">
                {picking === 'son'
                  ? SOUNDS.map((x) => (
                      <button key={x.id} onClick={() => pickSound(x.id)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${sound === x.id ? 'bg-white text-black' : 'bg-white/15'}`}>
                        {x.id ? `${x.name} · ${x.artist}` : 'Sans musique'}
                      </button>
                    ))
                  : MOVES.map(([m, label]) => (
                      <button key={m} onClick={() => (setMove(m), setPicking(null))} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${move === m ? 'bg-white text-black' : 'bg-white/15'}`}>
                        {label}
                      </button>
                    ))}
              </div>
            )}
            {note && <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-xl bg-black/70 px-3 py-2 text-center text-xs font-bold">{note}</p>}
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <p className="text-[11px] font-bold text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">{recording ? 'Ça tourne…' : `Tape pour ${length} s, ou garde le doigt appuyé`}</p>
              <button
                aria-label={recording ? 'Arrêter' : 'Filmer'}
                className="relative grid h-[84px] w-[84px] touch-none place-items-center"
                onPointerDown={(e) => (e.preventDefault(), down())}
                onPointerUp={up}
                onPointerCancel={up}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg viewBox="0 0 96 96" className="absolute inset-0 -rotate-90">
                  <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="6" />
                  {recording && <circle ref={ring} cx="48" cy="48" r="44" fill="none" stroke="#ff3b5c" strokeWidth="6" strokeDasharray="276" strokeDashoffset="276" strokeLinecap="round" />}
                </svg>
                <span className={`block bg-[#ff3b5c] transition-all ${recording ? 'h-8 w-8 rounded-md' : 'h-[64px] w-[64px] rounded-full'}`} />
              </button>
            </div>
          </>
        )}
        {clip && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-3 pt-10 pb-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {me.themes.map((t) => (
                <button key={t.id} onClick={() => setTheme(t.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${theme === t.id ? 'bg-white text-black' : 'bg-white/15'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-bold text-white/70">
              <Sparkles size={13} className="mt-px shrink-0 text-[#12c48b]" /> Filme au bon endroit : la danse en boîte, le garba au maquis, l'ambiance au stade… ça fait plus de vues.
            </p>
            <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 150))} placeholder="Décris ta vidéo… #babi" className="mt-2 w-full rounded-lg bg-white/15 px-3 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-white/50" />
            <div className="mt-2 flex gap-2">
              <button className="flex items-center gap-1 rounded-lg bg-white/15 px-4 py-3 text-sm font-extrabold" disabled={busy} onClick={() => setClip(null)}>
                <RotateCcw size={15} /> Refaire
              </button>
              <button className="flex-1 rounded-lg bg-[#ff7a00] py-3 text-sm font-extrabold disabled:opacity-40" disabled={busy} onClick={() => void post()}>
                {busy ? 'Publication…' : `Publier (${Math.round(clip.durationMs / 1000)} s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** A photo of the gallery (or the game's, where the browser can't record): posted as a still, played as a slow pan. */
function PhotoFilm({ sim, me, act, gallery, onClose, onPosted }: FilmProps) {
  const [theme, setTheme] = useState(me.themes[0]?.id ?? 'vlog')
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setPhoto(gallery?.src ?? takePhoto()), [gallery])
  const post = async () => {
    if (!photo || busy) return
    setBusy(true)
    const ok = await act('Publier sur Tikitoko', 'camera', 'social', () => gallery && photo === gallery.src ? api.tikiPost(sim.id, '', caption, theme, placeHere(), gallery.id) : api.tikiPost(sim.id, photo, caption, theme, placeHere()))
    setBusy(false)
    if (ok) onPosted()
  }
  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {photo ? <img src={photo} alt="Ta vidéo" className="tiki-pan h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm font-bold text-white/60">Rien à filmer ici</div>}
        <button className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 grid h-9 w-9 place-items-center rounded-full bg-black/40" onClick={onClose} aria-label="Fermer">
          <X size={22} />
        </button>
        <button className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-xs font-extrabold" onClick={() => setPhoto(takePhoto())}>
          <Camera size={14} /> Reprendre
        </button>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-3 pt-10 pb-3">
          {!gallery && <p className="mb-1.5 text-[11px] font-bold text-white/60">Ce navigateur ne sait pas filmer : ta vidéo sera une photo du jeu.</p>}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {me.themes.map((t) => (
              <button key={t.id} onClick={() => setTheme(t.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${theme === t.id ? 'bg-white text-black' : 'bg-white/15'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-bold text-white/70">
            <Sparkles size={13} className="mt-px shrink-0 text-[#12c48b]" /> Filme au bon endroit : la danse en boîte, le garba au maquis, l'ambiance au stade… ça fait plus de vues.
          </p>
          <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 150))} placeholder="Décris ta vidéo… #babi" className="mt-2 w-full rounded-lg bg-white/15 px-3 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-white/50" />
          <button className="mt-2 w-full rounded-lg bg-[#ff7a00] py-3 text-sm font-extrabold disabled:opacity-40" disabled={!photo || busy} onClick={() => void post()}>
            {busy ? 'Publication…' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  )
}
