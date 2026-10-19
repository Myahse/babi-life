import { useEffect, useRef, useState } from 'react'
import { Images, RefreshCcw, X } from 'lucide-react'
import { api, photoURL } from '../lib/api'
import type { Photo, Sim } from '../lib/types'
import { photoCam, setPhotoMode, usePhotoMode } from '../world3d/photoCam'
import { placeHere, takePhoto } from '../world3d/snapshot'

// The phone's camera, full screen over the game. In the street the phone
// sees for itself (world3d/snapshot.tsx): a photo from the Sim's eyes, or a
// selfie with the phone held out; a drag aims it, 1× to 3× zooms. Inside a
// place, it takes the room as it's seen. Each shot goes to the gallery.

export function CameraView({ sim, street, onClose, onGallery }: { sim: Sim; /** Out in the street (else inside a place: the view as it is). */ street: boolean; onClose: () => void; onGallery: () => void }) {
  const mode = usePhotoMode()
  useEffect(() => {
    if (street) setPhotoMode('photo')
    return () => setPhotoMode(null)
  }, [street])
  const [zoom, setZoom] = useState(1)
  const [flash, setFlash] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)

  const shoot = async () => {
    if (busy) return
    const shot = takePhoto()
    if (!shot) return setError('Rien à photographier ici')
    setFlash(true)
    setTimeout(() => setFlash(false), 160)
    setLast(shot)
    setBusy(true)
    setError(null)
    try {
      await api.takePhoto(sim.id, shot, mode === 'selfie' ? 'selfie' : 'photo', placeHere())
    } catch (e) {
      setError(e instanceof Error ? e.message : "La photo n'est pas partie")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="absolute inset-0 z-[60] touch-none text-white select-none"
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
      {/* The viewfinder: the bars of the phone's screen, the corners, the thirds */}
      <div className="absolute inset-x-0 top-0 flex h-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] items-end justify-between bg-black/85 px-4 pb-2">
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Fermer">
          <X size={22} />
        </button>
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-extrabold tracking-wider uppercase">{mode === 'selfie' ? 'Selfie' : 'Photo'}</span>
        <span className="w-10" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] bottom-[11rem]">
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
          {[...Array(9)].map((_, i) => (
            <span key={i} className="border-[0.5px] border-white" />
          ))}
        </div>
        {(['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2', 'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'] as const).map((c) => (
          <span key={c} className={`absolute h-6 w-6 border-white ${c}`} />
        ))}
        {street && <p className="absolute inset-x-0 bottom-3 text-center text-[11px] font-bold text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">Fais glisser pour viser</p>}
        {error && <p className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-black/70 px-3 py-1 text-xs font-bold">{error}</p>}
      </div>
      {flash && <div className="pointer-events-none absolute inset-0 bg-white" />}

      <div className="absolute inset-x-0 bottom-0 flex h-[11rem] flex-col items-center justify-end gap-3 bg-black/85 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onPointerDown={(e) => e.stopPropagation()}>
        {street && (
          <div className="flex gap-2">
            {[1, 2, 3].map((z) => (
              <button key={z} onClick={() => ((photoCam.zoom = z), setZoom(z))} className={`h-8 w-8 rounded-full text-xs font-extrabold ${zoom === z ? 'bg-white/25 text-[#ffd54f]' : 'bg-white/10'}`}>
                {z}×
              </button>
            ))}
          </div>
        )}
        <div className="flex w-full max-w-sm items-center justify-between">
          <button className="h-12 w-12 overflow-hidden rounded-xl border-2 border-white/70 bg-white/10" onClick={onGallery} aria-label="Galerie">
            {last ? <img src={last} alt="" className="h-full w-full object-cover" /> : <Images size={22} className="mx-auto" />}
          </button>
          <button className="grid h-[74px] w-[74px] place-items-center rounded-full border-4 border-white active:scale-95 disabled:opacity-50" disabled={busy} onClick={() => void shoot()} aria-label="Prendre la photo">
            <span className="h-[58px] w-[58px] rounded-full bg-white" />
          </button>
          <button
            className="grid h-12 w-12 place-items-center rounded-full bg-white/10 disabled:opacity-30"
            disabled={!street}
            onClick={() => (setPhotoMode(mode === 'selfie' ? 'photo' : 'selfie'), setZoom(1))}
            aria-label="Retourner la caméra"
          >
            <RefreshCcw size={22} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** A gallery photo as an <img> source: from the bucket, or fetched with the token. */
export function usePhotoSrc(p: Photo | null) {
  const [src, setSrc] = useState<string | null>(p?.url ?? null)
  useEffect(() => {
    if (!p?.path || p.url) {
      setSrc(p?.url ?? null)
      return
    }
    let gone = false
    let made: string | null = null
    void photoURL(p.path).then((u) => {
      made = u
      if (gone) URL.revokeObjectURL(u)
      else setSrc(u)
    }).catch(() => undefined)
    return () => {
      gone = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [p])
  return src
}
