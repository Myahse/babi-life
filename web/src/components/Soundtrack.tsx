import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { music, type Track } from '../audio/music'
import { ambience } from '../audio/ambience'

/** Plays the music of where the Sim is; renders nothing. */
export function Soundtrack({ track, seed, level = 1 }: { track: Track | null; seed: string; /** How near (0–1): a party heard from the street. */ level?: number }) {
  useEffect(() => {
    music.play(track, seed)
  }, [track, seed])
  useEffect(() => {
    music.setLevel(level)
  }, [level])
  useEffect(() => () => music.play(null), [])
  return null
}

/** The sound of where the Sim is (audio/ambience.ts): the rain and its thunder, the street, birds or crickets; renders nothing. */
export function Ambience({ rain, night, inside, music: playing }: { rain: boolean; night: boolean; inside: boolean; music: boolean }) {
  useEffect(() => {
    ambience.set({ rain, night, inside, music: playing })
  }, [rain, night, inside, playing])
  useEffect(() => () => ambience.set(null), [])
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
