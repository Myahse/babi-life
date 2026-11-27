import { music } from '../../audio/music'

// A rocket's rumble, made in the browser (nothing recorded): brown noise through a low-pass that swells, holds
// and fades, with a crackle on top when close. Through the game's master (muted with the music). Heard from the
// street when the sound of a launch gets there (open/launchSky.tsx), and in the cabin at ignition (LaunchView).

/** Plays one rumble: gain 0..1 (how near), length in seconds. */
export function rumble(gain: number, seconds = 10) {
  const out = music.out()
  if (!out || music.muted || gain <= 0) return
  const { ctx, master } = out
  try {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      // Brown noise (each sample a step from the last), a crackle now and then.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 3.5 + (gain > 0.5 && Math.random() < 0.002 ? (Math.random() - 0.5) * 0.6 : 0)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 90 + 260 * gain
    const g = ctx.createGain()
    const t = ctx.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, 1.4 * gain), t + seconds * 0.25)
    g.gain.setValueAtTime(Math.max(0.001, 1.4 * gain), t + seconds * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
    src.connect(lp).connect(g).connect(master)
    src.start(t)
    src.stop(t + seconds + 0.1)
  } catch {
    // No sound: the sky still shows it.
  }
}
