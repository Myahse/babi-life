import { lazy, Suspense } from 'react'
import type { Sim } from '../../lib/types'
import { OfflineMap } from './OfflineMap'
import type { Bounds, Padding, PinData, Route } from './pins'

const MapboxMap = lazy(() => import('./MapboxMap').then((m) => ({ default: m.MapboxMap })))
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

/** Where the camera should fly; a new key flies again even to the same bounds. */
export type Camera = { bounds: Bounds; key: number }

type Props = { pins: PinData[]; camera: Camera; night: boolean; sim: Sim | null; padding: Padding; route?: Route | null; onZoom?: (pxPerDeg: number) => void }

/** One map of the whole country: Mapbox when a token is set, else the offline board. */
export function GameMap(props: Props) {
  if (!TOKEN) return <OfflineMap {...props} />
  return (
    <Suspense fallback={<div className="absolute inset-0 bg-[var(--color-night)]" />}>
      <MapboxMap token={TOKEN} {...props} />
    </Suspense>
  )
}
