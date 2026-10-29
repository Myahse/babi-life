import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { music, type Track } from '../audio/music'
import { ambience } from '../audio/ambience'
import { baby } from '../audio/baby'

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

/** The baby's voice (update « sons-bebe », audio/baby.ts): crying while it cries, the little push of the caca,
 * « bleh », babbling as it plays, a whimper now and then when a need runs low; quiet asleep. Renders nothing. */
export function BabyVoice({ act, low }: { act: string | null; low: boolean }) {
  useEffect(() => {
    if (act === 'sleep' || act === 'nap') return
    const play = () => {
      if (act === 'pleurer') baby.cry()
      else if (act === 'caca') baby.push()
      else if (act === 'pipi') baby.babble()
      else if (act === 'vomir') (baby.bleh(), setTimeout(() => baby.whimper(), 1500))
      else if (act && /^(hochet|coucou|cubes|premiers-pas|jouets|premier-mot|calin|bain-bebe|biberon|bouillie)$/.test(act)) Math.random() < 0.5 ? baby.babble() : baby.giggle()
      else if (low) baby.whimper()
      else if (Math.random() < 0.4) baby.babble()
    }
    // Crying goes on and on; the rest now and then.
    const every = act === 'pleurer' ? 4500 : act === 'caca' || act === 'vomir' ? 7000 : act ? 6500 : low ? 18000 : 30000
    const first = setTimeout(play, act ? 400 : 3000)
    const loop = setInterval(play, every)
    return () => (clearTimeout(first), clearInterval(loop))
  }, [act, low])
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
