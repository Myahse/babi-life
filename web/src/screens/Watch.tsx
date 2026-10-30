import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/ui'
import { API_BASE } from '../lib/env'

// /regarder/<id>: a video the team sent in an e-mail (admin « E-mails »:
// mail apps don't play videos, the e-mail shows its poster and links here).
// Open to everyone, before the game too: the video from the bucket
// (GET /media/{id}, backend admin/media.go) and a way into the game.

export function Watch({ id }: { id: string }) {
  const [video, setVideo] = useState<{ url: string; poster: string; title: string } | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(`${API_BASE}/media/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((v) => alive && setVideo(v), () => alive && setMissing(true))
    return () => {
      alive = false
    }
  }, [id])
  useEffect(() => {
    document.title = video?.title ? `${video.title} · Babi Life` : 'Babi Life'
  }, [video])
  return (
    <div className="min-h-full bg-[var(--color-night)] text-white">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Logo size={32} />
        <Link to="/jeu" className="text-sm font-extrabold text-white/80">
          Jouer
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {video ? (
          <>
            {video.title && <h1 className="font-display mb-3 text-2xl leading-tight font-extrabold">{video.title}</h1>}
            <video src={video.url} poster={video.poster || undefined} controls autoPlay playsInline className="aspect-video w-full rounded-2xl bg-black" />
          </>
        ) : missing ? (
          <p className="card p-5 text-sm font-semibold text-[var(--color-ink)]">Cette vidéo n’est plus là. Le jeu, lui, t’attend.</p>
        ) : (
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/10" />
        )}
        <Link to="/jeu" className="btn mt-5 w-full justify-center">
          Ouvrir Babi Life
        </Link>
      </main>
    </div>
  )
}
