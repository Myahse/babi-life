import type { ReactNode } from 'react'

// The screen effects (ambient occlusion, night bloom): left out on the phone, where
// expo-gl presents each frame as it's drawn and the extra passes cost more than they show.
export const EffectComposer = (_: { children?: ReactNode; [k: string]: unknown }) => null
export const Bloom = (_: Record<string, unknown>) => null
export const N8AO = (_: Record<string, unknown>) => null
