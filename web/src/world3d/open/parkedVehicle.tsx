import { useEffect } from 'react'
import { Bicycle, Vehicle, type CarModel } from '../vehicles'
import { moveObstacle } from '../obstacles'
import { report } from './trafficFlow'
import type { Parked } from '../drive'
import { HANDLING } from '../drive'

// The Sim's own vehicle left parked in the street (drive.ts parked): drawn
// where it was left, against the kerb, its nose the way it faced; nobody
// walks through it, and the street's traffic goes round it (or waits).

export function ParkedVehicle({ p, y = 0 }: { p: Parked; y?: number }) {
  const { v } = p
  useEffect(() => {
    const hd = HANDLING[v.kind]
    moveObstacle('parked', { x: p.x, z: p.z, hw: hd.half, hd: hd.width, rot: p.h - Math.PI / 2 })
    report('parked', { x: p.x, z: p.z, h: p.h, half: hd.half })
    return () => {
      moveObstacle('parked', null)
      report('parked', null)
    }
  }, [p, v.kind])
  return (
    <group position={[p.x, y, p.z]} rotation={[0, p.h, 0]}>
      <group rotation={[0, -Math.PI / 2, 0]}>
        {v.kind === 'voiture' ? (
          <Vehicle p={[0, 0, 0]} kind="car" model={v.body as CarModel} color={v.color} seed={v.body === 'limo' ? (v.color === '#f4f4f2' ? 0 : 1) : v.id} crew={false} />
        ) : v.kind === 'moto' ? (
          <Vehicle p={[0, 0, 0]} kind="moto" color={v.color} crew={false} />
        ) : (
          <Bicycle color={v.color} />
        )}
      </group>
    </group>
  )
}
