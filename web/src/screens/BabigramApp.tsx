import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Bookmark, Camera, ChevronLeft, Ellipsis, Flag, Grid3x3, Heart, Home as HomeIcon, MapPin, MessageCircle, RectangleVertical, Search, Send, Square, SquarePlus, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { Chat, GramAccount, GramActivity, GramFound, GramPost, GramProfile, Photo as GalleryPhoto, Sim, TikiComment } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { Photo, ReportSheet } from '../components/Social'
import { placeHere, takePhoto } from '../world3d/snapshot'
import { whereabouts } from '../world3d/whereabouts'
import { usePhotoSrc } from './CameraView'
import { Stories } from './Stories'
import type { Act } from './phoneApps'
import { accountLook, bake, cssFilter, FILTERS, findFilter, keepPicture, NpcPhoto, ratioOf, VIGNETTE } from './BabigramArt'

/**
 * Babigram (backend sims/babigram.go) works like the well-known photo app:
 * a home feed of photos (the stories of Gbairai on top), each with its
 * author and place, double tap to like, comments, send to a friend in
 * Gbairai, save; Explorer (the popular photos, and a search for accounts);
 * « + » to post a photo of the game or of the gallery, cropped square or
 * 4:5, with a filter and a caption, at once; Activité; every account's
 * profile with its grid. The game's accounts post too (painted by the app,
 * BabigramArt.tsx), and the game's audience likes and follows.
 */

type Screen = { kind: 'home' } | { kind: 'explore' } | { kind: 'new' } | { kind: 'activity' } | { kind: 'profile'; id: string } | { kind: 'posts'; posts: GramPost[]; start: number; title: string; back: Screen }

const PINK = '#e0306a'
const nf = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : n >= 10_000 ? `${Math.round(n / 1000)} k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} k` : String(n))
const spaced = (n: number) => n.toLocaleString('fr-FR')
const ago = (at: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60000))
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : m < 10080 ? `${Math.round(m / 1440)} j` : `${Math.round(m / 10080)} sem.`
}
const fail = (e: unknown) => (e instanceof ApiError ? e.message : 'Pas de réseau')

export function BabigramApp({ sim, act, onClose, photo, stories }: { sim: Sim; act: Act; onClose: () => void; /** A photo of the gallery to post (it opens on « + »). */ photo?: { id: number; src: string }; /** Gbairai is installed: its stories show on top. */ stories: boolean }) {
  const [screen, setScreen] = useState<Screen>({ kind: photo ? 'new' : 'home' })
  const nav = (s: Screen) => setScreen(s)
  const tab = screen.kind === 'profile' ? (screen.id === sim.id ? 'me' : null) : screen.kind
  return (
    // Full screen, as the real app: the phone's frame is left behind.
    <div className="fixed inset-0 z-[70] flex justify-center bg-[#fafafa]">
      <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-white text-[#111]">
        <div key={screen.kind === 'profile' ? `p-${screen.id}` : screen.kind} className="motion-app relative min-h-0 flex-1">
          {screen.kind === 'home' && <Home sim={sim} stories={stories} nav={nav} onClose={onClose} />}
          {screen.kind === 'explore' && <Explore sim={sim} nav={nav} />}
          {screen.kind === 'new' && <Compose sim={sim} act={act} gallery={photo} onClose={() => nav({ kind: 'home' })} onPosted={() => nav({ kind: 'profile', id: sim.id })} />}
          {screen.kind === 'activity' && <ActivityScreen sim={sim} nav={nav} />}
          {screen.kind === 'profile' && <Profile sim={sim} id={screen.id} nav={nav} onBack={() => nav({ kind: 'home' })} />}
          {screen.kind === 'posts' && <PostsScreen sim={sim} screen={screen} nav={nav} />}
        </div>
        {screen.kind !== 'new' && (
          <nav className="flex h-12 shrink-0 items-center justify-around border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)]">
            <NavButton label="Accueil" on={tab === 'home'} onClick={() => nav({ kind: 'home' })}>
              <HomeIcon size={25} strokeWidth={tab === 'home' ? 2.6 : 1.9} />
            </NavButton>
            <NavButton label="Explorer" on={tab === 'explore'} onClick={() => nav({ kind: 'explore' })}>
              <Search size={25} strokeWidth={tab === 'explore' ? 2.8 : 1.9} />
            </NavButton>
            <NavButton label="Publier" on={false} onClick={() => nav({ kind: 'new' })}>
              <SquarePlus size={25} strokeWidth={1.9} />
            </NavButton>
            <NavButton label="Activité" on={tab === 'activity'} onClick={() => nav({ kind: 'activity' })}>
              <Heart size={25} strokeWidth={tab === 'activity' ? 2.6 : 1.9} className={tab === 'activity' ? 'fill-[#111]' : ''} />
            </NavButton>
            <NavButton label="Profil" on={tab === 'me'} onClick={() => nav({ kind: 'profile', id: sim.id })}>
              <span className={`block h-7 w-7 overflow-hidden rounded-full bg-[#eee] ${tab === 'me' ? 'ring-2 ring-[#111] ring-offset-1' : ''}`}>
                <Portrait look={sim.look} gender={sim.gender} framing="head" />
              </span>
            </NavButton>
          </nav>
        )}
      </div>
    </div>
  )
}

function NavButton({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} aria-current={on ? 'page' : undefined} className="grid h-11 w-14 place-items-center">
      {children}
    </button>
  )
}

/** The app's name, as its logo writes it. */
function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="font-display leading-none font-extrabold tracking-tight" style={{ fontSize: size, background: 'linear-gradient(90deg,#ff9f43,#e0306a 55%,#7b5cff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
      Babigram
    </span>
  )
}

function Avatar({ account, size = 32, ring = false }: { account: GramAccount; size?: number; ring?: boolean }) {
  const inner = account.id ? (
    <Portrait {...accountLook(account)} framing="head" />
  ) : (
    // One of the audience: a letter on a colour of its own.
    <span className="grid h-full place-items-center font-extrabold text-black/60" style={{ background: `hsl(${(account.handle.length * 47) % 360} 70% 85%)`, fontSize: size * 0.42 }}>
      {account.name[0]?.toUpperCase()}
    </span>
  )
  return (
    <span className={`block shrink-0 rounded-full ${ring ? 'bg-[conic-gradient(#ff9f43,#e0306a,#7b5cff,#ff9f43)] p-[2px]' : ''}`} style={{ width: size, height: size }}>
      <span className={`block h-full w-full overflow-hidden rounded-full bg-[#efefef] ${ring ? 'border-2 border-white' : ''}`}>{inner}</span>
    </span>
  )
}

/** A post's picture: a player's photo from the API, or one of the game's painted on the phone. */
function PostPicture({ post, className = '' }: { post: GramPost; className?: string }) {
  if (post.photo) return <Photo path={post.photo} alt={post.caption || `Photo de @${post.account.handle}`} className={`motion-gram-in ${className}`} />
  return <NpcPhoto post={post} className={className} />
}

/* ---------- Accueil ---------- */

function Home({ sim, stories, nav, onClose }: { sim: Sim; stories: boolean; nav: (s: Screen) => void; onClose: () => void }) {
  return (
    <Feed
      sim={sim}
      source={{ tab: 'accueil' }}
      nav={nav}
      empty="Rien pour le moment. Publie ta première photo avec « + » !"
      top={
        <>
          <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-black/5 bg-white/95 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur">
            <button className="grid h-9 w-9 place-items-center" onClick={onClose} aria-label="Quitter Babigram">
              <ChevronLeft size={26} />
            </button>
            <Wordmark />
            <span className="flex-1" />
            <button className="grid h-10 w-10 place-items-center" onClick={() => nav({ kind: 'new' })} aria-label="Publier une photo">
              <SquarePlus size={25} />
            </button>
            <button className="grid h-10 w-10 place-items-center" onClick={() => nav({ kind: 'activity' })} aria-label="Activité">
              <Heart size={25} />
            </button>
          </div>
          {stories && (
            <div className="border-b border-black/5 px-3 py-2.5">
              <Stories sim={sim} realPhotos={false} />
            </div>
          )}
        </>
      }
    />
  )
}

/* ---------- A feed: photos one under the other ---------- */

type Source = { tab: 'accueil' | 'enregistres' } | { posts: GramPost[]; start: number }

function Feed({ sim, source, nav, empty, top }: { sim: Sim; source: Source; nav: (s: Screen) => void; empty?: string; top?: React.ReactNode }) {
  const given = 'posts' in source
  const [posts, setPosts] = useState<GramPost[] | null>(given ? source.posts : null)
  const [error, setError] = useState<string | null>(null)
  const [comments, setComments] = useState<GramPost | null>(null)
  const [sharing, setSharing] = useState<GramPost | null>(null)
  const [menu, setMenu] = useState<GramPost | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (given) return
    api
      .gramFeed(sim.id, source.tab)
      .then((f) => (setPosts(f), setError(null)))
      .catch((e) => setError(fail(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.id])
  // Opened on a photo of a grid: start there.
  useEffect(() => {
    if (given && source.start > 0) box.current?.querySelector(`[data-post="${source.posts[source.start]?.id}"]`)?.scrollIntoView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = (id: number, f: (p: GramPost) => Partial<GramPost>) => setPosts((ps) => ps?.map((p) => (p.id === id ? { ...p, ...f(p) } : p)) ?? ps)
  const like = (p: GramPost, on = !p.liked) => {
    if (p.mine || on === p.liked) return
    patch(p.id, (x) => ({ liked: on, likes: x.likes + (on ? 1 : -1) }))
    void api.gramLike(sim.id, p.id, on).catch(() => undefined)
  }
  const save = (p: GramPost) => {
    patch(p.id, (x) => ({ saved: !x.saved }))
    void api.gramSave(sim.id, p.id, !p.saved).catch(() => undefined)
  }
  const follow = (p: GramPost, on: boolean) => {
    setPosts((ps) => ps?.map((x) => (x.account.id === p.account.id ? { ...x, followed: on } : x)) ?? ps)
    void api.gramFollow(sim.id, p.account.id, on).catch(() => undefined)
  }
  const drop = (f: (p: GramPost) => boolean) => setPosts((ps) => ps?.filter((x) => !f(x)) ?? ps)

  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full overflow-y-auto overscroll-contain">
        {top}
        {posts?.map((p) => (
          <Card key={p.id} post={p} onLike={(on) => like(p, on)} onSave={() => save(p)} onFollow={() => follow(p, true)} onComments={() => setComments(p)} onShare={() => setSharing(p)} onMenu={() => setMenu(p)} onProfile={() => nav({ kind: 'profile', id: p.account.id })} />
        ))}
        {posts?.length === 0 && <p className="px-10 py-16 text-center text-sm font-bold text-black/45">{empty}</p>}
        {posts === null && !error && <CardSkeleton />}
        {error && <p className="px-10 py-16 text-center text-sm font-bold text-[#d81b3f]">{error}</p>}
        {!!posts?.length && !given && <p className="py-8 text-center text-xs font-bold text-black/35">Tu as tout vu pour le moment ✨</p>}
      </div>
      {comments && <Comments sim={sim} post={comments} onClose={() => setComments(null)} onCount={(n) => patch(comments.id, () => ({ comments: n }))} />}
      {sharing && <ShareSheet sim={sim} post={sharing} onClose={() => setSharing(null)} onShared={() => patch(sharing.id, (x) => ({ shares: x.shares + 1 }))} />}
      {menu && (
        <MenuSheet
          sim={sim}
          post={menu}
          onClose={() => setMenu(null)}
          onProfile={() => (setMenu(null), nav({ kind: 'profile', id: menu.account.id }))}
          onUnfollow={() => (follow(menu, false), setMenu(null))}
          onGone={(all) => (drop((x) => x.id === menu.id || (all && x.account.id === menu.account.id)), setMenu(null))}
        />
      )}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="h-8 w-8 rounded-full bg-[#eee]" />
        <span className="h-3 w-28 rounded bg-[#eee]" />
      </div>
      <div className="aspect-square bg-[#f0f0f2]" />
    </div>
  )
}

/** One photo: the author, the picture (double tap to like), the actions, the caption. */
function Card({ post: p, onLike, onSave, onFollow, onComments, onShare, onMenu, onProfile }: { post: GramPost; onLike: (on?: boolean) => void; onSave: () => void; onFollow: () => void; onComments: () => void; onShare: () => void; onMenu: () => void; onProfile: () => void }) {
  const [heart, setHeart] = useState(0)
  const [more, setMore] = useState(false)
  const lastTap = useRef(0)
  const tap = () => {
    const now = Date.now()
    if (now - lastTap.current < 320) {
      // Double tap: the big heart, and a like (never an unlike).
      setHeart(now)
      onLike(true)
      lastTap.current = 0
    } else lastTap.current = now
  }
  const long = p.caption.length > 90
  return (
    <article data-post={p.id} className="pb-3">
      <header className="flex items-center gap-2.5 px-3 py-2">
        <button onClick={onProfile} aria-label={`Profil de @${p.account.handle}`}>
          <Avatar account={p.account} size={34} ring={!p.mine} />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex items-center gap-1 text-[13.5px] font-extrabold">
            <button onClick={onProfile} className="truncate">
              {p.account.handle}
            </button>
            {p.account.npc && <BadgeCheck size={14} className="shrink-0 fill-[#3b82f6] text-white" aria-label="Compte du jeu" />}
            {!p.mine && !p.followed && (
              <>
                <span className="text-black/40">•</span>
                <button onClick={onFollow} className="text-[#3b82f6]">
                  Suivre
                </button>
              </>
            )}
          </p>
          {p.place && <p className="truncate text-[12px] font-semibold text-black/60">{p.place}</p>}
        </div>
        <button onClick={onMenu} className="grid h-8 w-8 place-items-center" aria-label="Options">
          <Ellipsis size={20} />
        </button>
      </header>
      <div className="relative w-full overflow-hidden bg-[#f0f0f2] select-none" style={{ aspectRatio: String(ratioOf(p.ratio)) }} onClick={tap}>
        <PostPicture post={p} className="absolute inset-0 h-full w-full" />
        {heart > 0 && (
          <span key={heart} className="pointer-events-none absolute inset-0 grid place-items-center">
            <Heart size={110} className="motion-gram-heart fill-white text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 px-1.5 pt-1">
        <IconButton label="J'aime" onClick={() => onLike()} disabled={p.mine}>
          <Heart key={String(p.liked)} size={26} className={p.liked ? 'motion-gram-like fill-[#ff3040] text-[#ff3040]' : ''} />
        </IconButton>
        <IconButton label="Commenter" onClick={onComments}>
          <MessageCircle size={25} className="-scale-x-100" />
        </IconButton>
        <IconButton label="Envoyer à un ami" onClick={onShare}>
          <Send size={24} />
        </IconButton>
        <span className="flex-1" />
        <IconButton label={p.saved ? 'Retirer des enregistrements' : 'Enregistrer'} onClick={onSave}>
          <Bookmark key={String(p.saved)} size={25} className={p.saved ? 'motion-gram-like fill-[#111]' : ''} />
        </IconButton>
      </div>
      <div className="space-y-1 px-3 text-[13.5px] leading-snug">
        {p.likes > 0 && (
          <p className="font-extrabold">
            {p.likedBy && p.likes > 1 ? (
              <>
                <span className="font-semibold">Aimé par </span>
                {p.liked ? 'toi' : p.likedBy}
                <span className="font-semibold"> et </span>
                {spaced(p.likes - 1)} autres
              </>
            ) : (
              `${spaced(p.likes)} j'aime`
            )}
          </p>
        )}
        {p.caption && (
          <p>
            <button onClick={onProfile} className="mr-1 font-extrabold">
              {p.account.handle}
            </button>
            {long && !more ? (
              <>
                {p.caption.slice(0, 80)}…{' '}
                <button className="text-black/50" onClick={() => setMore(true)}>
                  plus
                </button>
              </>
            ) : (
              p.caption
            )}
          </p>
        )}
        {p.comments > 0 && (
          <button className="block text-black/50" onClick={onComments}>
            {p.comments === 1 ? 'Voir le commentaire' : `Voir les ${spaced(p.comments)} commentaires`}
          </button>
        )}
        <p className="text-[11px] font-semibold text-black/45">
          Il y a {ago(p.at)}
          {p.filter && ` · Filtre ${p.filter}`}
        </p>
      </div>
    </article>
  )
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className="grid h-10 w-10 place-items-center disabled:opacity-35">
      {children}
    </button>
  )
}

/* ---------- Sheets: comments, sending, options ---------- */

function Sheet({ title, onClose, tall, children }: { title: string; onClose: () => void; tall?: boolean; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/35" onClick={onClose}>
      <div className={`animate-up flex flex-col rounded-t-2xl bg-white ${tall ? 'max-h-[78%] min-h-[55%]' : 'max-h-[70%]'}`} onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15" />
        <div className="relative border-b border-black/5 py-2.5 text-center text-[14px] font-extrabold">
          {title}
          <button onClick={onClose} className="absolute top-1.5 right-2 grid h-8 w-8 place-items-center text-black/60" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Comments({ sim, post, onClose, onCount }: { sim: Sim; post: GramPost; onClose: () => void; onCount: (n: number) => void }) {
  const [list, setList] = useState<TikiComment[] | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState<TikiComment | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () =>
    api
      .gramComments(sim.id, post.id)
      .then((l) => (setList(l), onCount(l.length)))
      .catch((e) => setError(fail(e)))
  useEffect(() => void load(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.gramComment(sim.id, post.id, text)
      setText('')
      await load()
    } catch (e) {
      setError(fail(e))
    } finally {
      setBusy(false)
    }
  }
  const like = (c: TikiComment) => {
    setList((l) => l?.map((x) => (x.id === c.id ? { ...x, liked: !c.liked, likes: x.likes + (c.liked ? -1 : 1) } : x)) ?? l)
    // The audience's comments live in the game only: their hearts stay on this screen.
    if (c.author) void api.gramCommentLike(sim.id, c.id, !c.liked).catch(() => undefined)
  }
  return (
    <Sheet onClose={onClose} title="Commentaires" tall>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {post.caption && (
          <div className="flex gap-3 border-b border-black/5 py-3">
            <Avatar account={post.account} size={34} />
            <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
              <span className="mr-1 font-extrabold">{post.account.handle}</span>
              {post.caption}
              <span className="mt-0.5 block text-[11px] font-bold text-black/40">{ago(post.at)}</span>
            </p>
          </div>
        )}
        {list === null && !error && <p className="py-8 text-center text-sm font-bold text-black/45">Chargement…</p>}
        {list?.length === 0 && <p className="py-8 text-center text-sm font-bold text-black/45">Pas encore de commentaire. Lance la discussion !</p>}
        {reporting && (
          <div className="my-2">
            <ReportSheet
              title={`Signaler le commentaire de @${reporting.handle}`}
              note="Tu ne verras plus ce joueur ; l'équipe regarde le signalement."
              onCancel={() => setReporting(null)}
              onPick={(reason) =>
                void api
                  .gramCommentReport(sim.id, reporting.id, reason)
                  .then((x) => (setReporting(null), setError(x.text), load()))
                  .catch((e) => setError(fail(e)))
              }
            />
          </div>
        )}
        <ul className="motion-stagger space-y-4 py-3">
          {list?.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar account={c.author ? { id: c.author.id, author: c.author, name: c.name, gender: c.author.gender, handle: c.handle } : { id: '', name: c.name, gender: 'femme', handle: c.handle }} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-snug">
                  <span className="mr-1 font-extrabold">{c.handle}</span>
                  {c.byCreator && <span className="mr-1 rounded bg-[#efefef] px-1 text-[10px] font-extrabold text-black/60">Auteur</span>}
                  {c.body}
                </p>
                <p className="mt-0.5 flex gap-3 text-[11px] font-bold text-black/40">
                  {ago(c.at)}
                  {c.likes > 0 && <span>{nf(c.likes)} j'aime</span>}
                  {c.canDelete && c.author && (
                    <button onClick={() => void api.gramUncomment(sim.id, c.id).then(load).catch(() => undefined)} className="flex items-center gap-0.5">
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
              <button onClick={() => like(c)} className="grid h-8 w-8 place-items-center text-black/40" aria-label="J'aime le commentaire">
                <Heart key={String(c.liked)} size={14} className={c.liked ? 'motion-gram-like fill-[#ff3040] text-[#ff3040]' : ''} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {error && <p className="px-4 pb-1 text-xs font-bold text-[#d81b3f]">{error}</p>}
      <div className="flex items-center gap-2 border-t border-black/10 p-3">
        <Avatar account={{ id: sim.id, author: { id: sim.id, firstName: sim.firstName, gender: sim.gender, look: sim.look }, name: sim.firstName, gender: sim.gender, handle: '' }} size={32} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 150))}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder={`Ajoute un commentaire pour ${post.account.handle}…`}
          className="min-w-0 flex-1 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold outline-none"
        />
        <button onClick={() => void send()} disabled={!text.trim() || busy} className="px-1 text-sm font-extrabold disabled:opacity-40" style={{ color: PINK }}>
          Publier
        </button>
      </div>
      <p className="px-4 pb-3 text-center text-[10px] font-bold text-black/40">Liens et numéros masqués. Sois respectueux·se : tout se signale.</p>
    </Sheet>
  )
}

function ShareSheet({ sim, post, onClose, onShared }: { sim: Sim; post: GramPost; onClose: () => void; onShared: () => void }) {
  const [chats, setChats] = useState<Chat[] | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  useEffect(
    () =>
      void api
        .chats(sim.id)
        .then(setChats)
        .catch((e) => (setChats([]), setNote(fail(e)))),
    [sim.id],
  )
  const send = async (c: Chat) => {
    try {
      await api.write(sim.id, c.friend.id, `📸 Regarde la photo Babigram de @${post.account.handle}${post.caption ? ` : « ${post.caption} »` : ''}`)
      await api.gramShare(sim.id, post.id)
      setSent((s) => [...s, c.friend.id])
      onShared()
    } catch (e) {
      setNote(fail(e))
    }
  }
  const friends = (chats ?? []).filter((c) => !c.blocked)
  return (
    <Sheet onClose={onClose} title="Envoyer à (Gbairai)">
      <div className="px-4 pt-3 pb-6">
        {chats === null && <p className="text-sm font-bold text-black/45">Chargement…</p>}
        {chats && friends.length === 0 && !note && <p className="text-sm font-bold text-black/45">Ajoute des amis joueurs (appli Amis) pour leur envoyer des photos.</p>}
        <div className="grid grid-cols-4 gap-3">
          {friends.map((c) => (
            <button key={c.friend.id} onClick={() => void send(c)} disabled={sent.includes(c.friend.id)} className="flex flex-col items-center gap-1 text-[11px] font-bold">
              <span className="block h-14 w-14 overflow-hidden rounded-full bg-[#eee]">
                <Portrait look={c.friend.look} gender={c.friend.gender} framing="head" />
              </span>
              <span className="max-w-full truncate">{sent.includes(c.friend.id) ? 'Envoyé ✓' : c.friend.firstName}</span>
            </button>
          ))}
        </div>
        {note && <p className="mt-2 text-xs font-bold text-[#d81b3f]">{note}</p>}
      </div>
    </Sheet>
  )
}

/** « … » on a photo: the profile, unfollow, and report (a player's), hide (the game's) or delete (one's own). */
function MenuSheet({ sim, post, onClose, onProfile, onUnfollow, onGone }: { sim: Sim; post: GramPost; onClose: () => void; onProfile: () => void; onUnfollow: () => void; onGone: (allOfAuthor: boolean) => void }) {
  const [reporting, setReporting] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const row = 'block w-full border-b border-black/5 py-3.5 text-center text-[14px] font-bold'
  return (
    <Sheet onClose={onClose} title={`@${post.account.handle}`}>
      <div className="pb-4">
        {reporting ? (
          <div className="p-3">
            <ReportSheet
              title="Signaler cette photo"
              note="Tu ne verras plus ses photos ; l'équipe regarde le signalement."
              onCancel={() => setReporting(false)}
              onPick={(reason) =>
                void api
                  .gramReport(sim.id, post.id, reason)
                  .then(() => onGone(true))
                  .catch((e) => setNote(fail(e)))
              }
            />
          </div>
        ) : (
          <>
            {post.mine ? (
              <button className={`${row} text-[#d81b3f]`} onClick={() => void api.gramDelete(sim.id, post.id).then(() => onGone(false)).catch((e) => setNote(fail(e)))}>
                Supprimer la publication
              </button>
            ) : post.account.npc ? (
              <button className={row} onClick={() => onGone(false)}>
                Masquer cette photo
              </button>
            ) : (
              <button className={`${row} text-[#d81b3f]`} onClick={() => setReporting(true)}>
                Signaler
              </button>
            )}
            {post.followed && !post.mine && (
              <button className={row} onClick={onUnfollow}>
                Ne plus suivre
              </button>
            )}
            <button className={row} onClick={onProfile}>
              Voir le profil
            </button>
            <button className={`${row} border-0 text-black/55`} onClick={onClose}>
              Annuler
            </button>
          </>
        )}
        {note && <p className="px-4 pt-2 text-center text-xs font-bold text-[#d81b3f]">{note}</p>}
      </div>
    </Sheet>
  )
}

/* ---------- Explorer ---------- */

function Explore({ sim, nav }: { sim: Sim; nav: (s: Screen) => void }) {
  const [posts, setPosts] = useState<GramPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<GramFound[] | null>(null)
  useEffect(() => void api.gramFeed(sim.id, 'explorer').then(setPosts).catch((e) => setError(fail(e))), [sim.id])
  // The accounts, as one types (a quarter of a second after the last key).
  useEffect(() => {
    if (!searching) return
    const t = setTimeout(() => void api.gramSearch(sim.id, q).then(setFound).catch(() => setFound([])), 250)
    return () => clearTimeout(t)
  }, [q, searching, sim.id])
  const follow = (f: GramFound) => {
    setFound((l) => l?.map((x) => (x.account.id === f.account.id ? { ...x, followed: !f.followed, fans: x.fans + (f.followed ? -1 : 1) } : x)) ?? l)
    void api.gramFollow(sim.id, f.account.id, !f.followed).catch(() => undefined)
  }
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-white px-3 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#efefef] px-3 py-2">
          <Search size={16} className="shrink-0 text-black/45" />
          <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 30))} onFocus={() => setSearching(true)} placeholder="Rechercher un compte" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
        </label>
        {searching && (
          <button className="text-sm font-extrabold" onClick={() => (setSearching(false), setQ(''), setFound(null))}>
            Annuler
          </button>
        )}
      </div>
      {searching ? (
        <ul className="motion-stagger space-y-1 px-3 pb-6">
          {found === null && <p className="py-6 text-center text-sm font-bold text-black/45">Recherche…</p>}
          {found?.length === 0 && <p className="py-6 text-center text-sm font-bold text-black/45">Aucun compte trouvé.</p>}
          {found?.map((f) => (
            <li key={f.account.id} className="flex items-center gap-3 py-1.5">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => nav({ kind: 'profile', id: f.account.id })}>
                <Avatar account={f.account} size={46} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[14px] font-extrabold">
                    <span className="truncate">{f.account.handle}</span>
                    {f.account.npc && <BadgeCheck size={14} className="shrink-0 fill-[#3b82f6] text-white" />}
                  </span>
                  <span className="block truncate text-[12px] font-semibold text-black/55">
                    {f.account.name} · {nf(f.fans)} abonnés
                  </span>
                </span>
              </button>
              <FollowButton on={f.followed} onClick={() => follow(f)} small />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {error && <p className="px-10 py-16 text-center text-sm font-bold text-[#d81b3f]">{error}</p>}
          {posts === null && !error && <div className="grid animate-pulse grid-cols-3 gap-[2px]">{Array.from({ length: 12 }, (_, i) => <span key={i} className="aspect-square bg-[#f0f0f2]" />)}</div>}
          {posts?.length === 0 && <p className="px-10 py-16 text-center text-sm font-bold text-black/45">Rien à explorer pour le moment.</p>}
          {/* Every tenth tile is a big one, as Explorer lays them out. */}
          <div className="grid grid-flow-dense grid-cols-3 gap-[2px] pb-4">
            {posts?.map((p, i) => (
              <button key={p.id} className={`relative overflow-hidden bg-[#f0f0f2] ${i % 10 === 2 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'}`} onClick={() => nav({ kind: 'posts', posts, start: i, title: 'Explorer', back: { kind: 'explore' } })}>
                <PostPicture post={p} className="absolute inset-0 h-full w-full" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FollowButton({ on, onClick, small }: { on: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-lg font-extrabold ${small ? 'px-4 py-1.5 text-[13px]' : 'flex-1 py-2 text-[14px]'} ${on ? 'bg-[#efefef] text-[#111]' : 'text-white'}`} style={on ? undefined : { background: '#3b82f6' }}>
      {on ? 'Abonné·e' : 'Suivre'}
    </button>
  )
}

/* ---------- A list of posts opened from a grid ---------- */

function PostsScreen({ sim, screen, nav }: { sim: Sim; screen: Extract<Screen, { kind: 'posts' }>; nav: (s: Screen) => void }) {
  return (
    <Feed
      sim={sim}
      source={{ posts: screen.posts, start: screen.start }}
      nav={nav}
      top={
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/5 bg-white px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <button className="grid h-9 w-9 place-items-center" onClick={() => nav(screen.back)} aria-label="Retour">
            <ChevronLeft size={26} />
          </button>
          <span className="text-[16px] font-extrabold">{screen.title}</span>
        </div>
      }
    />
  )
}

/* ---------- Profiles ---------- */

function Profile({ sim, id, nav, onBack }: { sim: Sim; id: string; nav: (s: Screen) => void; onBack: () => void }) {
  const [p, setP] = useState<GramProfile | null>(null)
  const [tab, setTab] = useState<'grille' | 'enregistres'>('grille')
  const [posts, setPosts] = useState<GramPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  useEffect(() => void api.gramProfile(sim.id, id).then(setP).catch((e) => setError(fail(e))), [sim.id, id])
  useEffect(() => {
    setPosts(null)
    api
      .gramFeed(sim.id, tab === 'enregistres' ? 'enregistres' : 'auteur', id)
      .then(setPosts)
      .catch(() => setPosts([]))
  }, [sim.id, id, tab])
  const follow = () => {
    if (!p) return
    setP({ ...p, followed: !p.followed, fans: p.fans + (p.followed ? -1 : 1) })
    void api.gramFollow(sim.id, p.account.id, !p.followed).catch(() => undefined)
  }
  const saveBio = async () => {
    if (editing === null || !p) return
    try {
      const r = await api.gramBio(sim.id, editing)
      setP({ ...p, bio: r.bio })
      setEditing(null)
    } catch (e) {
      setError(fail(e))
    }
  }
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-white px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button className="grid h-9 w-9 place-items-center" onClick={onBack} aria-label="Retour">
          <ChevronLeft size={26} />
        </button>
        <span className="flex min-w-0 items-center gap-1 text-[17px] font-extrabold">
          <span className="truncate">{p?.account.handle ?? ''}</span>
          {p?.account.npc && <BadgeCheck size={16} className="shrink-0 fill-[#3b82f6] text-white" />}
        </span>
      </div>
      {error && <p className="px-6 py-3 text-center text-sm font-bold text-[#d81b3f]">{error}</p>}
      {p && (
        <div className="motion-rise px-4">
          <div className="flex items-center gap-5">
            <Avatar account={p.account} size={82} ring={!p.mine} />
            <div className="grid flex-1 grid-cols-3 text-center">
              {(
                [
                  [p.posts, 'publications'],
                  [p.fans, 'abonnés'],
                  [p.following, 'abonnements'],
                ] as const
              ).map(([n, label]) => (
                <div key={label}>
                  <div className="text-[17px] font-extrabold">{nf(n)}</div>
                  <div className="text-[12px] font-semibold text-black/60">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[14px] font-extrabold">{p.account.name}</p>
          {editing === null ? (
            p.bio ? <p className="text-[13.5px] leading-snug whitespace-pre-line">{p.bio}</p> : p.mine && <p className="text-[13px] font-semibold text-black/45">Ajoute une bio : qui tu es, ton quartier, ce que tu aimes.</p>
          ) : (
            <div className="mt-1 flex gap-2">
              <input value={editing} onChange={(e) => setEditing(e.target.value.slice(0, 150))} placeholder="Ta bio…" className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm font-semibold outline-none" />
              <button className="rounded-lg bg-[#111] px-3 text-sm font-extrabold text-white" onClick={() => void saveBio()}>
                OK
              </button>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {p.mine ? (
              <>
                <button className="flex-1 rounded-lg bg-[#efefef] py-2 text-[14px] font-extrabold" onClick={() => setEditing(editing === null ? p.bio : null)}>
                  {editing === null ? 'Modifier la bio' : 'Annuler'}
                </button>
                <button className="flex-1 rounded-lg bg-[#efefef] py-2 text-[14px] font-extrabold" onClick={() => nav({ kind: 'new' })}>
                  Publier
                </button>
              </>
            ) : (
              <FollowButton on={p.followed} onClick={follow} />
            )}
          </div>
          {p.mine && p.left !== undefined && (
            <p className="mt-2 text-center text-[11px] font-bold text-black/45">{p.left > 0 ? `Encore ${p.left} photo${p.left > 1 ? 's' : ''} à publier aujourd'hui.` : 'Plus de photo aujourd’hui : reviens demain.'}</p>
          )}
        </div>
      )}
      <div className="sticky top-[calc(max(0.5rem,env(safe-area-inset-top))+2.75rem)] z-10 mt-3 flex border-b border-black/10 bg-white">
        <button onClick={() => setTab('grille')} className={`flex flex-1 justify-center py-2.5 ${tab === 'grille' ? 'border-b-2 border-[#111]' : 'text-black/40'}`} aria-label="Publications">
          <Grid3x3 size={22} />
        </button>
        {p?.mine && (
          <button onClick={() => setTab('enregistres')} className={`flex flex-1 justify-center py-2.5 ${tab === 'enregistres' ? 'border-b-2 border-[#111]' : 'text-black/40'}`} aria-label="Enregistrements">
            <Bookmark size={22} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts?.map((x, i) => (
          <button key={x.id} className="relative aspect-square overflow-hidden bg-[#f0f0f2]" onClick={() => nav({ kind: 'posts', posts, start: i, title: tab === 'enregistres' ? 'Enregistrements' : 'Publications', back: { kind: 'profile', id } })}>
            <PostPicture post={x} className="absolute inset-0 h-full w-full" />
          </button>
        ))}
      </div>
      {posts === null && <p className="py-10 text-center text-sm font-bold text-black/40">Chargement…</p>}
      {posts?.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-[#111]">
            <Camera size={30} />
          </span>
          <p className="text-sm font-bold text-black/50">{tab === 'enregistres' ? 'Les photos que tu enregistres arrivent ici.' : p?.mine ? 'Partage ta première photo : appuie sur « + ».' : 'Pas encore de publication.'}</p>
        </div>
      )}
    </div>
  )
}

/* ---------- Activité ---------- */

function ActivityScreen({ sim, nav }: { sim: Sim; nav: (s: Screen) => void }) {
  const [list, setList] = useState<GramActivity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => void api.gramActivity(sim.id).then(setList).catch((e) => setError(fail(e))), [sim.id])
  // A tap on a photo opens it among one's own.
  const open = async (postId: number) => {
    const mine = await api.gramFeed(sim.id, 'auteur', sim.id).catch(() => [] as GramPost[])
    const i = mine.findIndex((p) => p.id === postId)
    if (i >= 0) nav({ kind: 'posts', posts: mine, start: i, title: 'Publications', back: { kind: 'activity' } })
  }
  const line = (a: GramActivity) => {
    const who = a.who?.handle ?? ''
    switch (a.kind) {
      case 'like':
        return [who, ' a aimé ta photo.']
      case 'comment':
        return [who, ` a commenté : « ${a.text} »`]
      case 'follow':
        return [who, " s'est abonné·e à toi."]
      case 'audience':
        return [who, a.others ? ` et ${spaced(a.others)} autres personnes ont aimé ta photo.` : ' a aimé ta photo.']
      case 'audience-comments':
        return ['', `${spaced(a.others ?? 0)} personnes de Babi ont commenté ta photo.`]
      default:
        return ['', `${spaced(a.others ?? 0)} personnes de Babi te suivent grâce à tes photos.`]
    }
  }
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain px-4">
      <h2 className="sticky top-0 z-10 bg-white pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-[20px] font-extrabold">Activité</h2>
      {error && <p className="py-10 text-center text-sm font-bold text-[#d81b3f]">{error}</p>}
      {list === null && !error && <p className="py-10 text-center text-sm font-bold text-black/40">Chargement…</p>}
      {list?.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-[#111]">
            <Heart size={30} />
          </span>
          <p className="text-sm font-bold text-black/50">Publie une photo : les j'aime, les commentaires et les nouveaux abonnés arrivent ici.</p>
        </div>
      )}
      <ul className="motion-stagger space-y-3.5 pb-6">
        {list?.map((a, i) => {
          const [bold, rest] = line(a)
          return (
            <li key={`${a.kind}-${a.post ?? 0}-${a.at}-${i}`} className="flex items-center gap-3">
              {a.who ? (
                <button onClick={() => a.who?.id && nav({ kind: 'profile', id: a.who.id })} className="shrink-0">
                  <Avatar account={a.who} size={44} />
                </button>
              ) : (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: 'linear-gradient(135deg,#ff9f43,#e0306a,#7b5cff)' }}>
                  {a.kind === 'fans' ? <BadgeCheck size={20} /> : <MessageCircle size={20} />}
                </span>
              )}
              <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
                {bold && <span className="font-extrabold">{bold}</span>}
                {rest} <span className="font-semibold text-black/40">{ago(a.at)}</span>
              </p>
              {a.photo && a.post && (
                <button onClick={() => void open(a.post!)} className="relative block h-11 w-11 shrink-0 overflow-hidden rounded bg-[#f0f0f2]">
                  <Photo path={a.photo} alt="" className="absolute inset-0 h-full w-full" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------- « + »: a new photo ---------- */

/** Where the Sim stands, by its name (the place within 60 m, from the 3D street). */
function placeName(id: string) {
  if (!id) return ''
  return whereabouts.places.find((p) => p.id === id)?.name ?? ''
}

function Compose({ sim, act, gallery, onClose, onPosted }: { sim: Sim; act: Act; gallery?: { id: number; src: string }; onClose: () => void; onPosted: () => void }) {
  const [step, setStep] = useState<'pick' | 'edit'>(gallery ? 'edit' : 'pick')
  const [pic, setPic] = useState<{ src: string; galleryId?: number } | null>(gallery ? { src: gallery.src, galleryId: gallery.id } : null)
  const [ratio, setRatio] = useState<'carre' | 'portrait'>('carre')
  const [filter, setFilter] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const [placeId] = useState(placeHere)
  useEffect(() => {
    if (!gallery) {
      const shot = takePhoto()
      if (shot) setPic({ src: shot })
    }
    void api.photos(sim.id).then((r) => setPhotos(r.photos)).catch(() => setPhotos([]))
    void api.gramProfile(sim.id, sim.id).then((p) => setLeft(p.left ?? null)).catch(() => undefined)
  }, [sim.id, gallery])
  const f = findFilter(filter)
  const shoot = () => {
    const shot = takePhoto()
    if (shot) (setPic({ src: shot }), setNote(null))
    else setNote('Pas d’image du jeu à prendre ici.')
  }
  const share = async () => {
    if (!pic || busy) return
    setBusy(true)
    setNote(null)
    const baked = await bake(pic.src, ratio, f)
    if (!baked && !pic.galleryId) {
      setBusy(false)
      return setNote('Cette photo ne se lit pas. Prends-en une autre.')
    }
    const where = placeId
    const ok = await act('Publier sur Babigram', 'camera', 'social', () =>
      baked ? api.gramPost(sim.id, { photo: baked, caption, placeId: where, filter: f.id ? f.label : '', ratio }) : api.gramPost(sim.id, { photo: '', photoId: pic.galleryId, caption, placeId: where, filter: '', ratio }),
    )
    setBusy(false)
    if (ok) onPosted()
  }
  const place = placeName(placeId)
  const frame = (
    <div className="relative w-full overflow-hidden bg-[#111]" style={{ aspectRatio: String(ratioOf(ratio)) }}>
      {pic ? <img src={pic.src} alt="Ta photo" className="h-full w-full object-cover" style={{ filter: step === 'edit' ? cssFilter(f) : undefined }} /> : <div className="grid h-full place-items-center px-8 text-center text-sm font-bold text-white/60">Choisis une photo de ta galerie, ou prends le jeu en photo.</div>}
      {step === 'edit' && f.vignette && <span className="pointer-events-none absolute inset-0" style={{ background: VIGNETTE }} />}
    </div>
  )
  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      <div className="flex items-center gap-1 border-b border-black/5 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button className="grid h-9 w-9 place-items-center" onClick={step === 'edit' && !gallery ? () => setStep('pick') : onClose} aria-label={step === 'edit' && !gallery ? 'Retour' : 'Fermer'}>
          {step === 'edit' && !gallery ? <ChevronLeft size={26} /> : <X size={24} />}
        </button>
        <span className="flex-1 text-[16px] font-extrabold">{step === 'pick' ? 'Nouvelle publication' : 'Filtre et légende'}</span>
        {step === 'pick' ? (
          <button className="px-2 text-[15px] font-extrabold disabled:opacity-40" style={{ color: '#3b82f6' }} disabled={!pic} onClick={() => setStep('edit')}>
            Suivant
          </button>
        ) : (
          <button className="px-2 text-[15px] font-extrabold disabled:opacity-40" style={{ color: '#3b82f6' }} disabled={!pic || busy || left === 0} onClick={() => void share()}>
            {busy ? '…' : 'Partager'}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {frame}
        {step === 'pick' ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2">
              <button className="flex items-center gap-1.5 rounded-full bg-[#efefef] px-3 py-1.5 text-[12px] font-extrabold" onClick={() => setRatio(ratio === 'carre' ? 'portrait' : 'carre')} aria-label="Changer le format">
                {ratio === 'carre' ? <Square size={14} /> : <RectangleVertical size={14} />} {ratio === 'carre' ? 'Carré' : 'Portrait 4:5'}
              </button>
              <span className="flex-1" />
              <button className="flex items-center gap-1.5 rounded-full bg-[#111] px-3 py-1.5 text-[12px] font-extrabold text-white" onClick={shoot}>
                <Camera size={14} /> Photo du jeu
              </button>
            </div>
            {note && <p className="px-3 text-xs font-bold text-[#d81b3f]">{note}</p>}
            <p className="px-3 pt-1 pb-1.5 text-[13px] font-extrabold">Galerie</p>
            {photos?.length === 0 && <p className="px-3 pb-6 text-sm font-bold text-black/45">Pas encore de photo dans ta galerie : utilise la Caméra du téléphone, ou « Photo du jeu ».</p>}
            <div className="grid grid-cols-4 gap-[2px] pb-6">
              {photos?.map((g) => (
                <GalleryThumb key={g.id} photo={g} on={pic?.galleryId === g.id} onPick={(src) => void keepPicture(src).then((kept) => (setPic({ src: kept, galleryId: g.id }), setNote(null)))} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none]">
              {FILTERS.map((x) => (
                <button key={x.id || 'normal'} onClick={() => setFilter(x.id)} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
                  <span className={`relative block h-[72px] w-[72px] overflow-hidden rounded-md ${filter === x.id ? 'ring-2 ring-[#111] ring-offset-2' : ''}`}>
                    {pic && <img src={pic.src} alt="" className="h-full w-full object-cover" style={{ filter: cssFilter(x) }} />}
                    {x.vignette && <span className="absolute inset-0" style={{ background: VIGNETTE }} />}
                  </span>
                  <span className={`text-[11px] ${filter === x.id ? 'font-extrabold' : 'font-semibold text-black/60'}`}>{x.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 border-t border-black/5 px-3 py-3">
              <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded bg-[#111]">{pic && <img src={pic.src} alt="" className="h-full w-full object-cover" style={{ filter: cssFilter(f) }} />}</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 150))} placeholder="Écris une légende…" rows={3} className="min-w-0 flex-1 resize-none text-[14px] font-semibold outline-none" />
            </div>
            <p className="flex items-center gap-2 border-t border-black/5 px-3 py-3 text-[14px] font-semibold">
              <MapPin size={18} className="shrink-0" /> {place || 'Lieu : dans la rue'}
            </p>
            {note && <p className="px-3 pb-2 text-xs font-bold text-[#d81b3f]">{note}</p>}
            <p className="px-3 pb-6 text-[11px] font-bold text-black/45">
              Tout le monde sur Babigram verra ta photo. Une photo prise dans un beau coin (la plage, le zoo, le stade, un bon maquis) avec un filtre et une légende plaît davantage.
              {left !== null && ` ${left > 0 ? `Encore ${left} photo${left > 1 ? 's' : ''} aujourd'hui.` : 'Plus de photo pour aujourd’hui.'}`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function GalleryThumb({ photo, on, onPick }: { photo: GalleryPhoto; on: boolean; onPick: (src: string) => void }) {
  const src = usePhotoSrc(photo)
  return (
    <button className="relative aspect-square overflow-hidden bg-[#f0f0f2] disabled:opacity-50" disabled={!src} onClick={() => src && onPick(src)}>
      {src && <img src={src} alt={photo.place} loading="lazy" className="h-full w-full object-cover" />}
      {on && <span className="absolute inset-0 bg-white/40 ring-4 ring-[#3b82f6] ring-inset" />}
    </button>
  )
}
