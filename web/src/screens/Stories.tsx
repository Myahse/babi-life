import { useEffect, useRef, useState } from 'react'
import { Camera, Flag, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { Sim, StoryRing } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { Photo, ReportSheet } from '../components/Social'
import { readPhoto, takePhoto } from '../world3d/snapshot'
import { deNom } from '../lib/french'

/**
 * The stories, at the top of Gbairai (backend sims/stories.go): a photo of
 * what's happening in the game, a few words, seen by your friends for 24
 * hours. A photo from the phone's gallery only when the server allows it.
 */
export function Stories({ sim, realPhotos }: { sim: Sim; realPhotos: boolean }) {
  const [rings, setRings] = useState<StoryRing[]>([])
  const [viewing, setViewing] = useState<number | null>(null)
  const [making, setMaking] = useState(false)
  const load = () => api.stories(sim.id).then(setRings).catch(() => undefined)
  useEffect(() => {
    void load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.id])
  const mine = rings.find((r) => r.mine)

  return (
    <>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        <button className="flex w-16 shrink-0 flex-col items-center gap-1" onClick={() => (mine ? setViewing(rings.indexOf(mine)) : setMaking(true))}>
          <span className={`relative block h-16 w-16 rounded-full p-[3px] ${mine ? 'bg-[conic-gradient(#ff9f43,#f0590c,#e0306a,#ff9f43)]' : 'bg-[var(--color-canvas)]'}`}>
            <span className="block h-full w-full overflow-hidden rounded-full bg-white">
              <Portrait look={sim.look} gender={sim.gender} framing="head" />
            </span>
            <span
              className="absolute -right-0.5 -bottom-0.5 grid h-6 w-6 place-items-center rounded-full bg-[#f0590c] text-white ring-2 ring-white"
              onClick={(e) => (e.stopPropagation(), setMaking(true))}
              role="button"
              aria-label="Ajouter une story"
            >
              <Plus size={14} strokeWidth={3} />
            </span>
          </span>
          <span className="w-full truncate text-center text-[11px] font-extrabold">Ma story</span>
        </button>
        {rings
          .filter((r) => !r.mine)
          .map((r) => {
            const unseen = r.stories.some((s) => !s.seen)
            return (
              <button key={r.sim.id} className="flex w-16 shrink-0 flex-col items-center gap-1" onClick={() => setViewing(rings.indexOf(r))}>
                <span className={`block h-16 w-16 rounded-full p-[3px] ${unseen ? 'bg-[conic-gradient(#ff9f43,#f0590c,#e0306a,#ff9f43)]' : 'bg-[#d5d7de]'}`}>
                  <span className="block h-full w-full overflow-hidden rounded-full bg-white">
                    <Portrait look={r.sim.look} gender={r.sim.gender} framing="head" />
                  </span>
                </span>
                <span className="w-full truncate text-center text-[11px] font-extrabold">{r.sim.firstName}</span>
              </button>
            )
          })}
      </div>
      {making && <NewStory sim={sim} realPhotos={realPhotos} onClose={() => setMaking(false)} onPosted={() => (setMaking(false), void load())} />}
      {viewing !== null && rings[viewing] && (
        <Viewer
          sim={sim}
          rings={rings}
          start={viewing}
          onClose={() => {
            setViewing(null)
            void load()
          }}
        />
      )}
    </>
  )
}

function NewStory({ sim, realPhotos, onClose, onPosted }: { sim: Sim; realPhotos: boolean; onClose: () => void; onPosted: () => void }) {
  const [photo, setPhoto] = useState<{ url: string; source: 'jeu' | 'reel' } | null>(null)
  const [caption, setCaption] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const shoot = () => {
    const url = takePhoto()
    if (url) setPhoto({ url, source: 'jeu' })
    else setNote('Pas d’image du jeu à prendre ici.')
  }
  // Straight away: a photo of what's behind the phone.
  useEffect(shoot, [])
  const post = async () => {
    if (!photo || busy) return
    setBusy(true)
    try {
      await api.postStory(sim.id, photo.url, caption, photo.source)
      onPosted()
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.')
      setBusy(false)
    }
  }
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0f0f14] p-3 text-white">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-extrabold">Nouvelle story</span>
        <button className="icon-btn bg-white/10" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      <div className="mt-3 flex-1 overflow-hidden rounded-2xl bg-black">{photo ? <img src={photo.url} alt="Ta photo" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm font-bold text-white/60">Pas de photo</div>}</div>
      <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 150))} placeholder="Écris quelque chose… (facultatif)" className="field mt-3 !bg-white/10 !text-white placeholder:!text-white/50" />
      {note && <p className="mt-2 text-xs font-bold text-[#ffd8a8]">{note}</p>}
      <div className="mt-3 flex gap-2">
        <button className="btn btn-soft flex-1 !py-2.5 !text-sm" onClick={shoot}>
          <Camera size={16} /> Reprendre
        </button>
        {realPhotos && (
          <>
            <button className="btn btn-soft !py-2.5 !text-sm" onClick={() => file.current?.click()} aria-label="Photo de la galerie">
              <ImagePlus size={16} />
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void readPhoto(f).then((url) => setPhoto({ url, source: 'reel' }))
              }}
            />
          </>
        )}
        <button className="btn flex-1 !bg-[#f0590c] !py-2.5 !text-sm" disabled={!photo || busy} onClick={() => void post()}>
          {busy ? 'Envoi…' : 'Publier 24 h'}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-white/50">Seuls tes amis du jeu la verront, pendant 24 heures.</p>
    </div>
  )
}

function Viewer({ sim, rings, start, onClose }: { sim: Sim; rings: StoryRing[]; start: number; onClose: () => void }) {
  const [ring, setRing] = useState(start)
  const [i, setI] = useState(0)
  const [reporting, setReporting] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const r = rings[ring]
  const s = r?.stories[i]
  const next = () => {
    if (!r) return onClose()
    if (i + 1 < r.stories.length) setI(i + 1)
    else if (ring + 1 < rings.length) (setRing(ring + 1), setI(0))
    else onClose()
  }
  const prev = () => (i > 0 ? setI(i - 1) : ring > 0 ? (setRing(ring - 1), setI(0)) : undefined)
  // Each story stays 6 s, unless a report is being written.
  useEffect(() => {
    if (reporting) return
    const t = setTimeout(next, 6000)
    return () => clearTimeout(t)
  })
  if (!r || !s) return null
  const mins = Math.round((Date.now() - new Date(s.at).getTime()) / 60_000)
  const ago = mins < 1 ? "à l'instant" : mins < 60 ? `il y a ${mins} min` : `il y a ${Math.round(mins / 60)} h`
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black text-white">
      <div className="flex gap-1 px-3 pt-3">
        {r.stories.map((x, k) => (
          <span key={x.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <i key={`${ring}-${i}`} className={`block h-full bg-white ${k < i ? 'w-full' : k === i && !reporting ? 'animate-[grow_6s_linear_forwards]' : 'w-0'}`} />
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="block h-8 w-8 overflow-hidden rounded-full bg-white">
          <Portrait look={r.sim.look} gender={r.sim.gender} framing="head" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
          {r.mine ? 'Ma story' : r.sim.firstName} <span className="font-bold text-white/60">· {ago}</span>
        </span>
        {r.mine ? (
          <button
            className="icon-btn bg-white/10"
            aria-label="Supprimer"
            onClick={() =>
              void api
                .deleteStory(sim.id, s.id)
                .then(onClose)
                .catch(() => setNote('Pas de réseau, réessaie.'))
            }
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <button className="icon-btn bg-white/10" aria-label="Signaler" onClick={() => setReporting(true)}>
            <Flag size={18} />
          </button>
        )}
        <button className="icon-btn bg-white/10" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex-1">
        <Photo key={s.id} path={api.storyPhoto(sim.id, s.id)} alt={s.caption || `Story ${deNom(r.sim.firstName)}`} className="absolute inset-0 h-full w-full" />
        <button className="absolute inset-y-0 left-0 w-1/3" onClick={prev} aria-label="Précédente" />
        <button className="absolute inset-y-0 right-0 w-2/3" onClick={next} aria-label="Suivante" />
        {s.caption && <p className="pointer-events-none absolute inset-x-3 bottom-4 rounded-xl bg-black/55 px-3 py-2 text-center text-sm font-extrabold">{s.caption}</p>}
      </div>
      {r.mine && <p className="px-3 py-2 text-center text-xs font-bold text-white/70">Vue par {s.views ?? 0} ami{(s.views ?? 0) > 1 ? 's' : ''}</p>}
      {note && <p className="px-3 py-2 text-center text-xs font-bold text-[#ffd8a8]">{note}</p>}
      {reporting && (
        <div className="p-3">
          <ReportSheet
            title="Signaler cette story"
            onCancel={() => setReporting(false)}
            onPick={(reason) =>
              void api
                .reportStory(sim.id, s.id, reason)
                .then((x) => (setReporting(false), setNote(x.text)))
                .catch((e) => setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.'))
            }
            note="La personne est bloquée tout de suite ; l'équipe regarde la photo."
          />
        </div>
      )}
    </div>
  )
}
