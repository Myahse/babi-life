import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { OwnVehicleBody } from '../ownVehicle'
import { moveObstacle } from '../obstacles'
import { report } from './trafficFlow'
import type { Parked } from '../drive'
import { ALIGHT, alighting, HANDLING } from '../drive'

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
  // Just parked (drive.ts alighting): it pulls in to the kerb from where it stopped, then rocks on its springs
  // as the driver gets out, and again as the door is shut.
  const g = useRef<THREE.Group>(null)
  const rock = useRef<THREE.Group>(null)
  useFrame(() => {
    const a = alighting.v
    const o = g.current
    if (!o || !rock.current) return
    if (!a || a.kind !== v.kind) {
      if (o.position.x !== p.x || o.position.z !== p.z || rock.current.rotation.z) {
        o.position.set(p.x, y, p.z)
        rock.current.rotation.z = 0
      }
      return
    }
    const { glide, out } = ALIGHT[v.kind]
    const t = (performance.now() - a.t0) / 1000
    const u = Math.min(1, t / glide)
    const e = u * u * (3 - 2 * u)
    o.position.set(a.fx + (p.x - a.fx) * e, y, a.fz + (p.z - a.fz) * e)
    // (A car only: the springs. The driver's side lifts as the weight goes off it; the door's slam shakes it.)
    const off = t - glide
    const shut = t - glide - out
    rock.current.rotation.z = v.kind !== 'voiture' ? 0 : (off > 0 ? 0.022 * Math.exp(-off * 3) * Math.sin(off * 9) : 0) + (shut > 0 ? 0.016 * Math.exp(-shut * 6) * Math.sin(shut * 22) : 0)
  })
  return (
    <group ref={g} position={[p.x, y, p.z]} rotation={[0, p.h, 0]}>
      <group ref={rock}>
      {/* (As it was driven, and as the other players see it: ownVehicle.tsx.) */}
      <OwnVehicleBody kind={v.kind} body={v.body} color={v.color} />
      </group>
    </group>
  )
}
