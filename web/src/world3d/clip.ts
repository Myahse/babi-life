import { setFrameTap } from './snapshot'
import { playSound, tikiAudio } from '../lib/tikiSounds'

// A Tikitoko clip: the 3D scene round the Sim, cropped upright (9:16) into a
// small canvas of its own, which is both the viewfinder on screen and what
// MediaRecorder records (captureStream), with the chosen sound mixed in by
// WebAudio. MP4 where the browser records it (Safari, recent Chrome), else
// WebM; a low bitrate keeps 15 s around 2 MB (the server takes 4 MB at most).

const W = 404 // even sides: some encoders refuse odd ones
const H = 720
export const CLIP_MAX_MS = 15000

/** Recording works here: MediaRecorder and canvas.captureStream (Safari 14.1+, Chrome, Firefox). */
export function canRecord() {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
}

function pickMime() {
  const all = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return all.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''
}

export type Clip = { blob: Blob; poster: string; durationMs: number }

export class ClipCam {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private drawn = false

  constructor(street: boolean) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = W
    this.canvas.height = H
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, W, H)
    setFrameTap({ street, frame: (c) => this.draw(c) })
  }

  /** The middle of the game's frame, cut upright. */
  private draw(src: HTMLCanvasElement) {
    if (!src.width || !src.height) return
    const k = Math.min(src.width / W, src.height / H)
    const sw = W * k
    const sh = H * k
    this.ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, W, H)
    this.drawn = true
  }

  /** Something of the game has been drawn yet (else there's nothing to film here). */
  get ready() {
    return this.drawn
  }

  close() {
    setFrameTap(null)
  }

  /**
   * Starts recording with a sound ("" for none); stop() ends it (and it
   * ends by itself at CLIP_MAX_MS), resolving with the clip.
   */
  record(sound: string): { stop: () => Promise<Clip> } {
    const stream = this.canvas.captureStream(30)
    const audio = tikiAudio()
    let stopMusic = () => undefined as void
    if (sound && audio) {
      const dest = audio.createMediaStreamDestination()
      // The player hears it while filming, and it goes into the clip.
      stopMusic = playSound(audio, sound, [dest, audio.destination])
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
    }
    const mimeType = pickMime()
    const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 96_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const poster = this.canvas.toDataURL('image/jpeg', 0.8)
    const began = performance.now()
    let done: Promise<Clip> | null = null
    const stop = () =>
      (done ??= new Promise<Clip>((ok) => {
        clearTimeout(cap)
        const ms = Math.min(CLIP_MAX_MS, Math.round(performance.now() - began))
        const finish = () => {
          stopMusic()
          stream.getTracks().forEach((t) => t.stop())
          const type = (rec.mimeType || mimeType || 'video/webm').split(';')[0]
          ok({ blob: new Blob(chunks, { type }), poster, durationMs: ms })
        }
        if (rec.state !== 'inactive') {
          rec.onstop = finish
          rec.stop()
        } else finish()
      }))
    const cap = setTimeout(() => void stop(), CLIP_MAX_MS)
    rec.start(250)
    return { stop }
  }
}
