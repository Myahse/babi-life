import { useEffect, useState } from 'react'
import { Camera, Eye, Flag, Heart, Sparkles, Trash2, UserPlus, UserCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { Sim, TikiMe, TikiPost } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { Photo, ReportSheet } from '../components/Social'
import { placeHere, takePhoto } from '../world3d/snapshot'
import type { Act } from './phoneApps'

/**
 * Tikitoko (backend sims/tikitoko.go): film what's happening in the game —
 * a dance, a garba tasting, the stands at the stadium — and post it for
 * every player to see. Fans come with the views, more when the theme fits
 * where you are; from 1 000 fans the brands pay for each video. Likes and
 * follows only, no comments; a post can be reported.
 */

type Tab = 'pour-toi' | 'abonnements' | 'moi'

const nf = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} k` : String(n))

export function TikitokoApp({ sim, act }: { sim: Sim; act: Act }) {
  const [tab, setTab] = useState<Tab>('pour-toi')
  const [feed, setFeed] = useState<TikiPost[] | null>(null)
  const [me, setMe] = useState<TikiMe | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filming, setFilming] = useState(false)
  const [reporting, setReporting] = useState<TikiPost | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = () => {
    api.tikiMe(sim.id).then(setMe).catch(() => undefined)
    if (tab !== 'moi')
      api
        .tikiFeed(sim.id, tab)
        .then((f) => (setFeed(f), setError(null)))
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
    else
      api
        .tikiFeed(sim.id, 'abonnements')
        .then((f) => setFeed(f.filter((p) => p.mine)))
        .catch(() => undefined)
  }
  useEffect(() => {
    setFeed(null)
    load()
    const t = setInterval(load, 45_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.id, tab])

  const like = (p: TikiPost) => {
    setFeed((f) => f?.map((x) => (x.id === p.id ? { ...x, liked: !p.liked, likes: x.likes + (p.liked ? -1 : 1) } : x)) ?? f)
    void api.tikiLike(sim.id, p.id, !p.liked).catch(() => undefined)
  }
  const follow = (p: TikiPost) => {
    setFeed((f) => f?.map((x) => (x.author.id === p.author.id ? { ...x, followed: !p.followed } : x)) ?? f)
    void api.tikiFollow(sim.id, p.author.id, !p.followed).catch(() => undefined)
  }

  if (filming && me) return <Film sim={sim} me={me} act={act} onClose={() => setFilming(false)} onPosted={() => (setFilming(false), setTab('moi'), load())} />
  return (
    <div className="-mx-3 -mt-1 min-h-full bg-[#0f0f14] px-3 pt-2 pb-4 text-white">
      <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
        {(
          [
            ['pour-toi', 'Pour toi'],
            ['abonnements', 'Abonnements'],
            ['moi', 'Moi'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-full py-1.5 text-xs font-extrabold ${tab === id ? 'bg-white text-[#0f0f14]' : 'text-white/70'}`}>
            {label}
          </button>
        ))}
      </div>

      {me && (
        <div className="mt-3 rounded-2xl bg-[linear-gradient(135deg,#ff7a0033,#ff7a0033)] p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold tracking-wider text-white/60 uppercase">{me.tier}</div>
              <div className="font-display text-2xl leading-none font-extrabold">{nf(me.fans)} fans</div>
            </div>
            <button className="btn !bg-[#ff7a00] !px-4 !py-2 !text-sm" disabled={!!sim.activity} onClick={() => setFilming(true)}>
              <Camera size={16} /> Filmer
            </button>
          </div>
          {me.next > 0 && (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                <i className="block h-full bg-[#12c48b]" style={{ width: `${Math.min(100, (me.fans / me.next) * 100)}%` }} />
              </div>
              <p className="mt-1 text-[11px] font-bold text-white/60">
                {me.fans < me.dealFrom ? `À ${nf(me.dealFrom)} fans, les marques te paient chaque vidéo.` : `Prochain niveau à ${nf(me.next)} fans.`} {me.posts} vidéo{me.posts > 1 ? 's' : ''} · {nf(me.views)} vues
              </p>
            </>
          )}
        </div>
      )}

      {note && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">{note}</p>}
      {reporting && (
        <div className="mt-3">
          <ReportSheet
            title={`Signaler la vidéo de ${reporting.author.firstName}`}
            onCancel={() => setReporting(null)}
            onPick={(reason) =>
              void api
                .tikiReport(sim.id, reporting.id, reason)
                .then((x) => (setReporting(null), setNote(x.text), load()))
                .catch((e) => setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.'))
            }
            note="Tu ne verras plus ses vidéos ; l'équipe regarde le signalement."
          />
        </div>
      )}
      {error && <p className="mt-3 text-sm font-bold text-[#ffa8a8]">{error}</p>}
      {feed === null && !error && <p className="mt-6 text-center text-sm font-bold text-white/60">Chargement…</p>}
      {feed?.length === 0 && (
        <p className="mt-6 text-center text-sm font-bold text-white/60">{tab === 'abonnements' ? 'Abonne-toi à des créateurs pour voir leurs vidéos ici.' : tab === 'moi' ? 'Pas encore de vidéo. Appuie sur « Filmer » !' : 'Rien pour le moment. Sois le premier à poster !'}</p>
      )}

      <ul className="mt-3 space-y-4">
        {feed?.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-2xl bg-white/5">
            <div className="flex items-center gap-2 p-2.5">
              <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white">
                <Portrait look={p.author.look} gender={p.author.gender} framing="head" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">@{p.author.firstName.toLowerCase()}</span>
                <span className="block text-[11px] font-bold text-white/60">
                  {p.tier} · {nf(p.fans)} fans
                </span>
              </span>
              {!p.mine && (
                <button onClick={() => follow(p)} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${p.followed ? 'bg-white/15' : 'bg-[#ff7a00]'}`}>
                  {p.followed ? <UserCheck size={13} /> : <UserPlus size={13} />} {p.followed ? 'Abonné·e' : 'Suivre'}
                </button>
              )}
            </div>
            <div className="relative aspect-[4/3] bg-black">
              <Photo path={api.tikiPhoto(sim.id, p.id)} alt={p.caption || 'Vidéo Tikitoko'} className="absolute inset-0 h-full w-full" />
              <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-extrabold">{THEME[p.theme] ?? p.theme}</span>
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-extrabold">
                <Eye size={12} /> {nf(p.views)}
              </span>
            </div>
            <div className="flex items-start gap-3 p-2.5">
              <p className="min-w-0 flex-1 text-[13px] leading-snug font-bold">
                {p.caption || <span className="text-white/50">Sans légende</span>}
                <span className="mt-0.5 block text-[11px] text-white/50">{p.place}</span>
              </p>
              <button onClick={() => !p.mine && like(p)} className="flex flex-col items-center text-[11px] font-extrabold" aria-label="J'aime">
                <Heart size={22} className={p.liked ? 'fill-[#ff7a00] text-[#ff7a00]' : ''} />
                {nf(p.likes)}
              </button>
              {p.mine ? (
                <button
                  aria-label="Supprimer"
                  className="text-white/60"
                  onClick={() =>
                    void api
                      .tikiDelete(sim.id, p.id)
                      .then(load)
                      .catch(() => undefined)
                  }
                >
                  <Trash2 size={18} />
                </button>
              ) : (
                <button aria-label="Signaler" className="text-white/60" onClick={() => setReporting(p)}>
                  <Flag size={18} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const THEME: Record<string, string> = { danse: '💃 Danse', garba: '🍽️ Dégustation', stade: '🏟️ Stade', vlog: '📍 Vlog', zoo: '🦁 Zoo', humour: '😂 Humour', mode: '👗 Look', sport: '💪 Sport' }

/** Filming: what it's about, the picture from the game, a caption; half an hour of the Sim's time. */
function Film({ sim, me, act, onClose, onPosted }: { sim: Sim; me: TikiMe; act: Act; onClose: () => void; onPosted: () => void }) {
  const [theme, setTheme] = useState(me.themes[0]?.id ?? 'vlog')
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setPhoto(takePhoto()), [])
  const post = async () => {
    if (!photo || busy) return
    setBusy(true)
    const ok = await act('Tourner une vidéo Tikitoko', 'camera', 'social', () => api.tikiPost(sim.id, photo, caption, theme, placeHere()))
    setBusy(false)
    if (ok) onPosted()
  }
  return (
    <div className="-mx-3 -mt-1 min-h-full bg-[#0f0f14] px-3 pt-2 pb-4 text-white">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
        {photo ? <img src={photo} alt="Ta vidéo" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm font-bold text-white/60">Rien à filmer ici</div>}
        <button className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-extrabold" onClick={() => setPhoto(takePhoto())}>
          <Camera size={13} /> Reprendre
        </button>
      </div>
      <p className="mt-3 text-[11px] font-extrabold tracking-wider text-white/60 uppercase">Ta vidéo, c'est…</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {me.themes.map((t) => (
          <button key={t.id} onClick={() => setTheme(t.id)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${theme === t.id ? 'bg-[#12c48b] text-[#0f0f14]' : 'bg-white/10'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] font-bold text-white/60">
        <Sparkles size={13} className="mt-px shrink-0 text-[#12c48b]" /> Filme au bon endroit : la danse en boîte, le garba au maquis, l'ambiance au stade… ça fait plus de vues.
      </p>
      <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 150))} placeholder="Ta légende… (facultatif)" className="field mt-3 !bg-white/10 !text-white placeholder:!text-white/50" />
      <div className="mt-3 flex gap-2">
        <button className="btn btn-soft flex-1 !py-2.5 !text-sm" onClick={onClose}>
          Annuler
        </button>
        <button className="btn flex-1 !bg-[#ff7a00] !py-2.5 !text-sm" disabled={!photo || busy || !!sim.activity} onClick={() => void post()}>
          {busy ? 'Envoi…' : 'Poster (30 min)'}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-white/50">Tous les joueurs pourront la voir. Pas de commentaires : des likes et des abonnés.</p>
    </div>
  )
}
