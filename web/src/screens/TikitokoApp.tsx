import { useEffect, useRef, useState } from 'react'
import { Bookmark, Camera, ChevronLeft, Flag, Grid3x3, Heart, Home as HomeIcon, Inbox, MessageCircle, Music2, Play, Plus, Send, Share2, Sparkles, Trash2, User, Users, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { Chat, Sim, TikiComment, TikiMe, TikiPost, TikiProfile } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { Photo, ReportSheet } from '../components/Social'
import { placeHere, takePhoto } from '../world3d/snapshot'
import type { Act } from './phoneApps'
import { actionLength } from '../game/rules'

/** Filming and editing, in game minutes (sims.TikiMinutes); the button says it in real ones. */
const TIKI_MINUTES = 30

/**
 * Tikitoko (backend sims/tikitoko.go, tikisocial.go) works like TikTok: a
 * full-screen feed swiped one video at a time (« Pour toi », ranked by likes
 * and freshness, or « Abonnements »), double tap to like, the rail on the
 * right (the creator, likes, comments, favourites, shares), comments in a
 * sheet, every creator's profile with its grid, an inbox, and « + » to film.
 * The videos are pictures from the game, played as a slow pan. Fans come with
 * the views; from 1 000 fans the brands pay for each video.
 */

type Screen = { kind: 'home' } | { kind: 'friends' } | { kind: 'inbox' } | { kind: 'film' } | { kind: 'profile'; id: string } | { kind: 'player'; posts: TikiPost[]; start: number; back: Screen }

const nf = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : n >= 10_000 ? `${Math.round(n / 1000)} k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} k` : String(n))
const ago = (at: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60000))
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`
}
const THEME: Record<string, string> = { danse: 'danse', garba: 'garba', stade: 'stade', vlog: 'vlog', zoo: 'zoo', humour: 'humour', mode: 'look', sport: 'sport' }

export function TikitokoApp({ sim, act, onClose, photo }: { sim: Sim; act: Act; onClose: () => void; /** A photo of the gallery to post (it opens on « + »). */ photo?: { id: number; src: string } }) {
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
          {screen.kind === 'film' && me && <Film sim={sim} me={me} act={act} gallery={photo} onClose={() => nav({ kind: 'home' })} onPosted={() => (refreshMe(), nav({ kind: 'profile', id: sim.id }))} />}
        </div>
        {screen.kind !== 'film' && screen.kind !== 'player' && (
          <nav className="flex h-14 shrink-0 items-center justify-around border-t border-white/10 bg-black pb-[env(safe-area-inset-bottom)] text-[10px] font-bold">
            <NavItem icon={HomeIcon} label="Accueil" on={tab === 'home'} onClick={() => nav({ kind: 'home' })} />
            <NavItem icon={Users} label="Amis" on={tab === 'friends'} onClick={() => nav({ kind: 'friends' })} />
            <button aria-label="Filmer" disabled={!!sim.activity || !me} onClick={() => nav({ kind: 'film' })} className="relative h-8 w-12 disabled:opacity-40">
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

function Feed({ sim, source, title, empty, nav, onBack }: { sim: Sim; source: Source; title?: string; empty?: string; nav: (s: Screen) => void; onBack?: () => void }) {
  const given = 'posts' in source
  const [posts, setPosts] = useState<TikiPost[] | null>(given ? source.posts : null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(given ? source.start : 0)
  const [comments, setComments] = useState<TikiPost | null>(null)
  const [sharing, setSharing] = useState<TikiPost | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (given) return
    api
      .tikiFeed(sim.id, source.tab)
      .then((f) => (setPosts(f), setError(null)))
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
        className="h-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight))}
      >
        {posts?.map((p, i) => (
          <Video key={p.id} sim={sim} post={p} active={i === current} onLike={(on) => like(p, on)} onFollow={() => follow(p)} onSave={() => save(p)} onComments={() => setComments(p)} onShare={() => setSharing(p)} onProfile={() => nav({ kind: 'profile', id: p.author.id })} />
        ))}
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
          onGone={() => (setPosts((ps) => ps?.filter((x) => x.id !== sharing.id && (sharing.mine || x.author.id !== sharing.author.id)) ?? ps), setSharing(null))}
        />
      )}
    </div>
  )
}

/** One video: the picture played as a slow pan, tap to pause, double tap to like, the rail and the caption. */
function Video({ sim, post: p, active, onLike, onFollow, onSave, onComments, onShare, onProfile }: { sim: Sim; post: TikiPost; active: boolean; onLike: (on?: boolean) => void; onFollow: () => void; onSave: () => void; onComments: () => void; onShare: () => void; onProfile: () => void }) {
  const [paused, setPaused] = useState(false)
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const lastTap = useRef(0)
  const single = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => setPaused(false), [active])

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
    } else single.current = setTimeout(() => setPaused((v) => !v), 280)
    lastTap.current = now
  }
  const run = active && !paused ? 'running' : 'paused'
  return (
    // --run pauses everything that moves in this video (the pan, the disc, the sound's name, the bar)
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-black" style={{ ['--run' as string]: run }}>
      <div className="absolute inset-0" onClick={tap}>
        <Photo path={api.tikiPhoto(sim.id, p.id)} alt={p.caption || 'Vidéo Tikitoko'} className="tiki-pan absolute inset-0 h-full w-full" />
        {paused && (
          <span className="absolute top-1/2 left-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/30">
            <Play size={44} fill="white" className="opacity-80" />
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
          {!p.mine && !p.followed && (
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
        <span className="ml-2 text-[12px] font-bold text-white/70">· {ago(p.at)}</span>
        <p className="mt-1 text-[14px] leading-snug font-semibold">
          {p.caption} <span className="font-extrabold">#{THEME[p.theme] ?? p.theme} #babi</span>
        </p>
        {p.place && <p className="mt-1 inline-block rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-bold">📍 {p.place}</p>}
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden text-[13px] font-semibold">
          <Music2 size={14} className="shrink-0" />
          <span className="overflow-hidden whitespace-nowrap">
            <span className="tiki-marquee inline-block">
              son original - @{p.handle} · son original - @{p.handle} ·&nbsp;
            </span>
          </span>
        </div>
      </div>
      {/* How far the video has played */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/20">
        <i key={active ? 'on' : 'off'} className="tiki-progress block h-full bg-white/80" />
      </div>
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

function Comments({ sim, post, onClose, onCount }: { sim: Sim; post: TikiPost; onClose: () => void; onCount: (n: number) => void }) {
  const [list, setList] = useState<TikiComment[] | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState<TikiComment | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () =>
    api
      .tikiComments(sim.id, post.id)
      .then((l) => (setList(l), onCount(l.length)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  useEffect(() => void load(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.tikiComment(sim.id, post.id, text)
      setText('')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Pas de réseau')
    } finally {
      setBusy(false)
    }
  }
  const like = (c: TikiComment) => {
    setList((l) => l?.map((x) => (x.id === c.id ? { ...x, liked: !c.liked, likes: x.likes + (c.liked ? -1 : 1) } : x)) ?? l)
    // The audience's comments live in the game only: their hearts stay on this screen.
    if (c.author) void api.tikiCommentLike(sim.id, c.id, !c.liked).catch(() => undefined)
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
          {list?.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#eee]">
                {c.author ? <Portrait look={c.author.look} gender={c.author.gender} framing="head" /> : <span className="grid h-full place-items-center text-sm font-extrabold text-black/60" style={{ background: `hsl(${(c.handle.length * 47) % 360} 70% 85%)` }}>{c.name[0]}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-black/50">
                  {c.handle} {c.byCreator && <span className="ml-1 rounded bg-[#ff7a00] px-1 text-[10px] text-white">Créateur</span>}
                </p>
                <p className="text-[14px] leading-snug font-semibold text-black">{c.body}</p>
                <p className="mt-0.5 flex gap-3 text-[11px] font-bold text-black/40">
                  {ago(c.at)}
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
            </li>
          ))}
        </ul>
      </div>
      {error && <p className="px-4 pb-1 text-xs font-bold text-[#d81b3f]">{error}</p>}
      <div className="flex items-center gap-2 border-t border-black/10 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 150))}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder="Ajoute un commentaire…"
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
      .then(setP)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  }, [sim.id, id])
  useEffect(() => {
    setPosts(null)
    api
      .tikiFeed(sim.id, tab === 'favoris' ? 'favoris' : 'auteur', id)
      .then(setPosts)
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
              <button className="flex-1 rounded-md bg-white/15 py-2 text-sm font-extrabold" disabled={!!sim.activity || !me} onClick={() => nav({ kind: 'film' })}>
                <Camera size={15} className="mr-1 inline" /> Filmer
              </button>
            </div>
          ) : (
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
            <Photo path={api.tikiPhoto(sim.id, x.id)} alt={x.caption || 'Vidéo'} className="absolute inset-0 h-full w-full" />
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

/** What it's about, the picture from the game, a caption; half an hour of the Sim's time. */
function Film({ sim, me, act, gallery, onClose, onPosted }: { sim: Sim; me: TikiMe; act: Act; gallery?: { id: number; src: string }; onClose: () => void; onPosted: () => void }) {
  const [theme, setTheme] = useState(me.themes[0]?.id ?? 'vlog')
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setPhoto(gallery?.src ?? takePhoto()), [gallery])
  const post = async () => {
    if (!photo || busy) return
    setBusy(true)
    const ok = await act('Tourner une vidéo Tikitoko', 'camera', 'social', () => gallery && photo === gallery.src ? api.tikiPost(sim.id, '', caption, theme, placeHere(), gallery.id) : api.tikiPost(sim.id, photo, caption, theme, placeHere()))
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
          <button className="mt-2 w-full rounded-lg bg-[#ff7a00] py-3 text-sm font-extrabold disabled:opacity-40" disabled={!photo || busy || !!sim.activity} onClick={() => void post()}>
            {busy ? 'Publication…' : `Publier (${actionLength(TIKI_MINUTES)} min)`}
          </button>
        </div>
      </div>
    </div>
  )
}
