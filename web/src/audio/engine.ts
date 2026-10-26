import { useEffect, useRef } from 'react'
import { music } from './music'

// The hum of an engine (the kart, the street race's cars), made in the browser.

/** The engine's hum, its pitch following the speed (silent when the game's sound is off). */
export function useEngine() {
  const nodes = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null)
  useEffect(() => {
    if (music.muted) return
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 700
      const gain = ctx.createGain()
      gain.gain.value = 0.035
      osc.connect(filter).connect(gain).connect(ctx.destination)
      osc.start()
      nodes.current = { ctx, osc, gain }
    } catch {
      nodes.current = null
    }
    return () => {
      void nodes.current?.ctx.close()
      nodes.current = null
    }
  }, [])
  return (speed: number, boost: boolean) => {
    const n = nodes.current
    if (!n) return
    if (n.ctx.state === 'suspended') void n.ctx.resume()
    n.osc.frequency.setTargetAtTime(55 + Math.abs(speed) * 5.5 + (boost ? 40 : 0), n.ctx.currentTime, 0.05)
  }
}
