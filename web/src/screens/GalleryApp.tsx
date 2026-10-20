import { useEffect, useState } from 'react'
import { Camera, ChevronLeft, CircleDashed, Download, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Photo, Sim } from '../lib/types'
import { usePhotoSrc } from './CameraView'

// The phone's gallery: the photos and selfies taken with its camera, newest
// first. One opens big; from there it goes on Tikitoko, to the player's own
// device, or away.

export function GalleryApp({ sim, onCamera, onTiki, story }: { sim: Sim; onCamera: () => void; /** Post it on Tikitoko (null: the app isn't installed). */ onTiki: ((p: Photo, src: string) => void) | null; /** Stories (Gbairai) can be posted to. */ story: boolean }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [open, setOpen] = useState<Photo | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void api.photos(sim.id).then((r) => setPhotos(r.photos)).catch((e) => setError(e instanceof Error ? e.message : 'La galerie ne répond pas'))
  }, [sim.id])

  if (open) return <Viewer photo={open} onBack={() => setOpen(null)} onTiki={onTiki} onStory={story ? (caption) => api.storyFromGallery(sim.id, open.id, caption).then(() => undefined) : null} onDelete={async () => {
    await api.deletePhoto(sim.id, open.id).catch(() => undefined)
    setPhotos((l) => l?.filter((p) => p.id !== open.id) ?? null)
    setOpen(null)
  }} />
  if (error) return <p className="py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">{error}</p>
  if (!photos) return <p className="py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">Chargement…</p>
  if (!photos.length)
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">Pas encore de photos. Prends un selfie, la rue, tes amis…</p>
        <button className="btn" onClick={onCamera}>
          <Camera size={18} /> Ouvrir la caméra
        </button>
      </div>
    )
  return (
    <div className="grid grid-cols-3 gap-1">
      {photos.map((p) => (
        <Thumb key={p.id} photo={p} onClick={() => setOpen(p)} />
      ))}
    </div>
  )
}

function Thumb({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  const src = usePhotoSrc(photo)
  return (
    <button className="aspect-square overflow-hidden rounded-md bg-[var(--color-canvas)]" onClick={onClick}>
      {src && <img src={src} alt={photo.place} loading="lazy" className="h-full w-full object-cover" />}
    </button>
  )
}

function Viewer({ photo, onBack, onTiki, onStory, onDelete }: { photo: Photo; onBack: () => void; onTiki: ((p: Photo, src: string) => void) | null; onStory: ((caption: string) => Promise<void>) | null; onDelete: () => void }) {
  const src = usePhotoSrc(photo)
  // In one's story (24 hours, seen by one's friends): a caption, then « Partager ».
  const [caption, setCaption] = useState('')
  const [story, setStory] = useState<'idle' | 'busy' | 'done' | string>('idle')
  const share = async () => {
    if (!onStory || story === 'busy') return
    setStory('busy')
    try {
      await onStory(caption)
      setStory('done')
    } catch (e) {
      setStory(e instanceof Error ? e.message : "La story n'est pas partie")
    }
  }
  const when = new Date(photo.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="flex flex-col gap-3">
      <button className="flex items-center gap-1 self-start text-sm font-extrabold text-[var(--color-ink-soft)]" onClick={onBack}>
        <ChevronLeft size={18} /> Galerie
      </button>
      <div className="overflow-hidden rounded-2xl bg-black">{src && <img src={src} alt={photo.place} className="w-full" />}</div>
      <p className="text-xs font-bold text-[var(--color-ink-soft)]">
        {photo.kind === 'selfie' ? 'Selfie' : 'Photo'} · {photo.place} · {when}
      </p>
      {onStory && (
        <div className="flex gap-2">
          <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 120))} placeholder="Un mot pour ta story…" className="min-w-0 flex-1 rounded-xl bg-[var(--color-canvas)] px-3 py-2 text-sm font-semibold outline-none" disabled={story === 'done'} />
          <button className="btn !px-3 !text-sm disabled:opacity-50" disabled={story === 'busy' || story === 'done'} onClick={() => void share()}>
            <CircleDashed size={16} /> {story === 'done' ? 'Dans ta story' : story === 'busy' ? '…' : 'Story'}
          </button>
        </div>
      )}
      {story !== 'idle' && story !== 'busy' && story !== 'done' && <p className="text-xs font-bold text-[var(--color-rose)]">{story}</p>}
      <div className="grid grid-cols-3 gap-2">
        <button className="btn !px-2 !text-sm disabled:opacity-40" disabled={!onTiki || !src} onClick={() => src && onTiki?.(photo, src)} title={onTiki ? '' : 'Installe Tikitoko depuis le Store'}>
          Tikitoko
        </button>
        <a className={`btn btn-soft !px-2 !text-sm ${src ? '' : 'pointer-events-none opacity-40'}`} href={src ?? undefined} download={`babi-${photo.id}.jpg`} target="_blank" rel="noreferrer">
          <Download size={16} />
        </a>
        <button className="btn btn-soft !px-2 !text-sm text-[var(--color-rose)]" onClick={onDelete} aria-label="Supprimer">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
