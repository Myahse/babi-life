import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box } from '../../../world3d/props'

// What the training's games share (components/espace/jeux): the Astrélia suit in blocks (white, the orange band,
// the dark visor; the hood under the helmet fits every look), the button held down, the game's clock.

/** The trainee in the Astrélia suit, standing at y = 0, ~1.7 tall (scale it). `pose`: arms out for floating. */
export function Suited({ pose = 'stand', visor = '#243b55' }: { pose?: 'stand' | 'float' | 'sit'; visor?: string }) {
  const arm = pose === 'float' ? 0.9 : 0
  return (
    <group>
      {/* Boots, legs */}
      {pose === 'sit' ? (
        <>
          <Box p={[-0.14, 0.42, 0.22]} s={[0.2, 0.18, 0.5]} c="#e9ecef" />
          <Box p={[0.14, 0.42, 0.22]} s={[0.2, 0.18, 0.5]} c="#e9ecef" />
        </>
      ) : (
        <>
          <Box p={[-0.14, 0.4, 0]} s={[0.2, 0.7, 0.24]} c="#e9ecef" />
          <Box p={[0.14, 0.4, 0]} s={[0.2, 0.7, 0.24]} c="#e9ecef" />
          <Box p={[-0.14, 0.05, 0.03]} s={[0.22, 0.12, 0.3]} c="#495057" />
          <Box p={[0.14, 0.05, 0.03]} s={[0.22, 0.12, 0.3]} c="#495057" />
        </>
      )}
      {/* The body, its orange band, the agency's patch */}
      <Box p={[0, 1.02, 0]} s={[0.56, 0.62, 0.34]} c="#f8f9fa" />
      <Box p={[0, 0.86, 0.001]} s={[0.58, 0.08, 0.36]} c="#ff7a00" />
      <Box p={[-0.14, 1.16, 0.18]} s={[0.12, 0.12, 0.02]} c="#1c3d6e" />
      {/* The pack */}
      <Box p={[0, 1.04, -0.25]} s={[0.46, 0.5, 0.18]} c="#dee2e6" />
      {/* Arms */}
      <group position={[-0.36, 1.26, 0]} rotation={[0, 0, -arm]}>
        <Box p={[0, -0.26, 0]} s={[0.16, 0.56, 0.18]} c="#f1f3f5" />
        <Box p={[0, -0.58, 0]} s={[0.17, 0.12, 0.19]} c="#495057" />
      </group>
      <group position={[0.36, 1.26, 0]} rotation={[0, 0, arm]}>
        <Box p={[0, -0.26, 0]} s={[0.16, 0.56, 0.18]} c="#f1f3f5" />
        <Box p={[0, -0.58, 0]} s={[0.17, 0.12, 0.19]} c="#495057" />
      </group>
      {/* The helmet: the hood under it, the visor */}
      <Box p={[0, 1.55, 0]} s={[0.46, 0.44, 0.44]} c="#ffffff" />
      <Box p={[0, 1.55, 0.2]} s={[0.34, 0.26, 0.06]} c={visor} glow={0.15} />
      <Box p={[0, 1.79, 0]} s={[0.2, 0.05, 0.2]} c="#ff7a00" />
    </group>
  )
}

/** A big button held down (touch, mouse): `onHold(true)` pressed, `onHold(false)` let go. */
export function HoldButton({ onHold, children, tone }: { onHold: (on: boolean) => void; children: ReactNode; tone?: string }) {
  const up = () => onHold(false)
  return (
    <button
      className="btn flex-1 touch-none !py-4 text-[16px] select-none"
      onPointerDown={(e) => (e.preventDefault(), onHold(true))}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      style={tone ? { background: tone } : undefined}
    >
      {children}
    </button>
  )
}

/** Seconds since the game began (for the status line), ticking every 200 ms; null once over. */
export function useSeconds(running: boolean) {
  const [s, setS] = useState(0)
  const t0 = useRef(performance.now())
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setS((performance.now() - t0.current) / 1000), 200)
    return () => clearInterval(id)
  }, [running])
  return s
}

/** The ids each game plays (backend game/espaceCarriere.go), and how hard. */
export type Level = 'touriste' | 'selection' | 'module'
export const levelOf = (id: string): Level => (id.startsWith('touriste-') ? 'touriste' : id.startsWith('selection-') ? 'selection' : 'module')
