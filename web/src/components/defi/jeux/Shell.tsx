import { useMemo, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import type { Look } from '../../../lib/types'
import { Box } from '../../../world3d/props'
import { Character } from '../../../world3d/Character'
import { randomLook } from '../../../avatar/options'
import { Table3d } from '../Table3d'
import type { Decor, Host } from './types'

// What every game of an action shares: the panel at the bottom of the screen (the perso seen above,
// the picture lifted: world3d/chatFraming.tsx), its card (the title, how it's played, where it's at),
// the 3D square where it's played, on its ground or its table, the buttons under it, what's said.

export function JeuShell({ title, how, status, children, controls, said, tall }: { title: string; how: string; /** Where it's at (« 2/3 », « 12 attrapés »). */ status?: ReactNode; /** The 3D (a Stage). */ children: ReactNode; /** Buttons under the square. */ controls?: ReactNode; /** A word for what just happened. */ said?: string | null; /** A taller square (the runs, the rhythm). */ tall?: boolean }) {
  return (
    // Portrait: the card, the square, the buttons, one under the other. Landscape (the phone turned):
    // the card and the buttons on the left, the square big on the right.
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 bg-[linear-gradient(rgba(15,18,48,0)_0%,rgba(15,18,48,0)_30%,rgba(15,18,48,0.86)_48%)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] short:flex-row short:items-center short:justify-center short:gap-5 short:bg-[rgba(15,18,48,0.7)] short:py-2">
      <div className="contents short:flex short:w-[40vw] short:max-w-[420px] short:flex-col short:items-center short:gap-2">
        <div className="card order-1 w-full max-w-[440px] px-4 py-2 text-center">
          <div className="font-display text-[17px] leading-tight font-extrabold">{title}</div>
          <div className="text-[12.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{how}</div>
          {status && <div className="mt-0.5 text-[12.5px] font-extrabold text-[var(--color-orange)]">{status}</div>}
        </div>
        {controls && <div className="order-3 flex w-full max-w-[440px] gap-2">{controls}</div>}
        <div className="order-4 h-6 text-[15px] font-extrabold text-[#ffd76a]">{said}</div>
      </div>
      <div className={`relative order-2 short:order-none ${tall ? 'aspect-[4/5] w-[min(92vw,44vh,420px)] short:w-[min(44vw,70vh)]' : 'aspect-square w-[min(92vw,44vh,420px)] short:w-[min(50vw,86vh)]'}`}>{children}</div>
    </div>
  )
}

/** The 3D square: its camera (from above and a little in front by default), the light, the decor under it. */
export function Stage({ decor, children, cam, look, fov }: { decor: Decor; children: ReactNode; cam?: [number, number, number]; look?: [number, number, number]; fov?: number }) {
  return (
    <Table3d className="!absolute inset-0" cam={cam} look={look} fov={fov}>
      <Ground decor={decor} />
      {children}
    </Table3d>
  )
}

/** The decor under the game, 8 wide (x and z from -4 to 4), its top at y = 0. */
export function Ground({ decor }: { decor: Decor }) {
  switch (decor) {
    case 'table':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#9a6a3c" />
          {[-3, -1, 1, 3].map((x) => (
            <Box key={x} p={[x, 0.005, 0]} s={[0.04, 0.01, 7]} c="#7a5230" />
          ))}
        </group>
      )
    case 'comptoir':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#e9ecef" />
          <Box p={[0, -0.6, 3.6]} s={[8, 0.9, 0.3]} c="#c92a2a" />
        </group>
      )
    case 'etal':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#8a5a32" />
          <Box p={[0, 0.005, 0]} s={[7.4, 0.01, 6.4]} c="#f08c00" />
          {[-2.4, 0, 2.4].map((x) => (
            <Box key={x} p={[x, 0.012, 0]} s={[0.5, 0.01, 6.4]} c="#2f9e44" />
          ))}
        </group>
      )
    case 'etagere':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#dee2e6" />
          {[-2.2, 0, 2.2].map((z) => (
            <Box key={z} p={[0, 0.02, z]} s={[8, 0.04, 0.08]} c="#868e96" />
          ))}
        </group>
      )
    case 'sable':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#e6cf9c" />
          {[...Array(30)].map((_, i) => (
            <Box key={i} p={[-3.8 + ((i * 37) % 76) / 10, 0.01, -3.2 + ((i * 53) % 64) / 10]} s={[0.08, 0.02, 0.08]} c="#c9ad73" />
          ))}
        </group>
      )
    case 'herbe':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#69a84f" />
          {[...Array(30)].map((_, i) => (
            <Box key={i} p={[-3.8 + ((i * 37) % 76) / 10, 0.04, -3.2 + ((i * 53) % 64) / 10]} s={[0.05, 0.08, 0.05]} c="#4f8a37" />
          ))}
        </group>
      )
    case 'carrelage':
      return (
        <group>
          {[...Array(8)].map((_, i) =>
            [...Array(7)].map((_, j) => <Box key={`${i}-${j}`} p={[-3.5 + i, -0.15, -3 + j]} s={[0.98, 0.3, 0.98]} c={(i + j) % 2 ? '#f1f3f5' : '#dee2e6'} />),
          )}
        </group>
      )
    case 'bitume':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#55595f" />
          {[-3, -1, 1, 3].map((x) => (
            <Box key={x} p={[x, 0.005, 0]} s={[1.2, 0.01, 0.12]} c="#f4f1ea" />
          ))}
        </group>
      )
    case 'eau':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#1c7ed6" />
          {[...Array(12)].map((_, i) => (
            <Box key={i} p={[-3.4 + ((i * 29) % 68) / 10, 0.01, -3 + ((i * 41) % 60) / 10]} s={[0.7, 0.02, 0.08]} c="#74c0fc" />
          ))}
        </group>
      )
    case 'scene':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#3b2a20" />
          {[-3, -2, -1, 0, 1, 2, 3].map((x) => (
            <Box key={x} p={[x, 0.005, 0]} s={[0.03, 0.01, 7]} c="#2a1d15" />
          ))}
          <Box p={[0, 0.02, -3.2]} s={[8, 0.04, 0.4]} c="#ffd43b" />
        </group>
      )
    case 'bureau':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#6b4426" />
          <Box p={[0, 0.005, 0.3]} s={[5, 0.01, 3.4]} c="#2f6b4a" />
        </group>
      )
    case 'parquet':
      return (
        <group>
          {[...Array(8)].map((_, i) => (
            <Box key={i} p={[-3.5 + i, -0.15, 0]} s={[0.98, 0.3, 7]} c={i % 2 ? '#c08a52' : '#b07a45'} />
          ))}
        </group>
      )
    case 'terre':
      return <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#b5703c" />
    case 'piste':
      return (
        <group>
          <Box p={[0, -0.15, 0]} s={[8, 0.3, 7]} c="#c2410c" />
          {[-2, 0, 2].map((z) => (
            <Box key={z} p={[0, 0.005, z]} s={[8, 0.01, 0.06]} c="#ffffff" />
          ))}
        </group>
      )
    case 'ciel':
      return null
  }
}

const HOST_OUTFIT: Record<Host, [gender: 'femme' | 'homme', outfit: string, color?: string]> = {
  ami: ['homme', 'casual'], amie: ['femme', 'robe'], client: ['homme', 'chemise'], cliente: ['femme', 'pagne'], vendeuse: ['femme', 'pagne'], patient: ['homme', 'casual'], electeur: ['homme', 'chemise-pagne'],
  enfant: ['homme', 'casual'], maman: ['femme', 'kaba'], papa: ['homme', 'chemise-pagne'], collegue: ['femme', 'chemise'], chef: ['homme', 'suit', '#2b2f45'], prof: ['homme', 'chemise', '#e9ecef'],
  juge: ['homme', 'soutane', '#141416'], agent: ['femme', 'uniforme'], guide: ['homme', 'jersey'], pretre: ['homme', 'soutane'], imam: ['homme', 'imam'], pasteur: ['homme', 'pasteur'],
  medecin: ['femme', 'blouse'], policier: ['homme', 'policier'], touriste: ['femme', 'casual'], vieux: ['homme', 'boubou'], serveur: ['homme', 'cuisinier'],
}

/** Someone of the place, dressed for it (the game's own Character): the one who asks, who answers. */
export function Who({ host, seed = 1, pose = 'talk', p = [0, 0, 0], r = 0 }: { host: Host; seed?: number; pose?: 'talk' | 'idle' | 'wave' | 'cheer' | 'rant' | 'point'; p?: [number, number, number]; r?: number }) {
  const [gender, outfit, color] = HOST_OUTFIT[host]
  const look = useMemo(() => {
    let x = seed * 9301 + host.length * 49297
    const l = randomLook(gender, () => ((x = (x * 9301 + 49297) % 233280), x / 233280))
    return { ...l, outfit, ...(color ? { outfitColor: color } : {}), ...(host === 'vieux' ? { hairColor: '#d9d9d9' } : {}) } as Look
  }, [host, seed, gender, outfit, color])
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Character look={look} gender={gender} stage={host === 'enfant' ? 'enfant' : 'adulte'} pose={pose} marker={false} seed={seed} />
    </group>
  )
}

/** Where a point of the screen square (0..1 across, 0 at the top) is in the scene, at z = 0, for a camera looking straight at it. */
export function useField(z = 0) {
  const { viewport, camera } = useThree()
  const v = viewport.getCurrentViewport(camera, [0, 0, z])
  return { w: v.width, h: v.height, X: (x: number) => (x - 0.5) * v.width, Y: (y: number) => (0.5 - y) * v.height }
}

/** A score from what was done right out of what could be: never below 10 for having played. */
export const scoreOf = (good: number, of: number, mistakes = 0) => Math.max(10, Math.min(100, Math.round((good / Math.max(1, of)) * 100 - mistakes * 8)))
