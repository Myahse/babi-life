import { lazy, Suspense } from 'react'
import type { Sim } from '../../lib/types'
import { OfflineMap } from './OfflineMap'
import type { Bounds, Padding, PinData } from './pins'

const MapboxMap = lazy(() => import('./MapboxMap').then((m) => ({ default: m.MapboxMap })))
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

type Props = { pins: PinData[]; bounds: Bounds; night: boolean; sim: Sim | null; padding: Padding }

export function GameMap(props: Props) {
  if (!TOKEN) return <OfflineMap {...props} />
  return (
    <Suspense fallback={<div className="absolute inset-0 bg-[var(--color-night)]" />}>
      <MapboxMap token={TOKEN} {...props} />
    </Suspense>
  )
}
