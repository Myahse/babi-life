import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { music, type Track } from '../audio/music'

/** Plays the music of where the Sim is; renders nothing. */
export function Soundtrack({ track, seed }: { track: Track | null; seed: string }) {
  useEffect(() => music.play(track, seed), [track, seed])
  useEffect(() => () => music.play(null), [])
  return null
}

/** Sound on or off, remembered on this device. */
export function SoundToggle() {
  const [muted, setMuted] = useState(music.muted)
  return (
    <button
      className="hud flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95"
      onClick={() => (music.setMuted(!muted), setMuted(!muted))}
      aria-label={muted ? 'Remettre la musique' : 'Couper la musique'}
      title={muted ? 'Remettre la musique' : 'Couper la musique'}
    >
      {muted ? <VolumeX size={20} strokeWidth={2.4} /> : <Volume2 size={20} strokeWidth={2.4} className="text-[var(--color-orange)]" />}
    </button>
  )
}
