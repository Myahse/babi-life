import { useEffect, useState } from 'react'
import { lang } from './i18n'

// The stories' prologues read aloud (tools/voix/histoires.mjs: one MP3 a story
// in public/audio/histoires/, and index.json listing them). Read once; a story
// without its MP3 (not recorded yet), or a player in English, has no voice.

let known: Promise<Set<string>> | null = null

function recorded(): Promise<Set<string>> {
  known ??= fetch('/audio/histoires/index.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((ids: string[]) => new Set(ids))
    .catch(() => new Set<string>())
  return known
}

/** Whether the story's prologue can be heard. */
export function useNarrated(id: string): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let live = true
    if (lang() === 'fr') void recorded().then((s) => live && setOn(s.has(id)))
    return () => void (live = false)
  }, [id])
  return on
}

// One voice at a time: a new one stops the one before.
let playing: HTMLAudioElement | null = null

/** Plays the prologue, or stops it if it's the one playing; `onEnd` when it stops. */
export function narrate(id: string, onEnd: () => void): boolean {
  const src = `/audio/histoires/${id}.mp3`
  if (playing) {
    const was = playing.src.endsWith(src)
    playing.pause()
    playing.dispatchEvent(new Event('ended'))
    playing = null
    if (was) return false
  }
  const a = new Audio(src)
  a.addEventListener('ended', onEnd, { once: true })
  a.addEventListener('error', onEnd, { once: true })
  playing = a
  void a.play().catch(onEnd)
  return true
}
