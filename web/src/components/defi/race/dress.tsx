import { useMemo } from 'react'
import * as THREE from 'three'
import { pointAt } from '../../../kart/track'
import { AdBoards, Dressing } from '../../../streetball/decor'
import { alongside, clear } from './Scene'
import type { Race } from './engine'

// « Mini-jeux réalistes », phase 2: the street race's trackside (streetball/decor.tsx's props),
// drawn only while the update is open: stacks of old tyres strapped together on the outside of the
// bends, the brands' boards behind the walls along the straights, facing the road. Outside the
// walls: the cars never reach them.

const tyreMat = new THREE.MeshLambertMaterial({ color: '#1d1d21' })
const strapMat = new THREE.MeshLambertMaterial({ color: '#f8f9fa' })
const TYRE = new THREE.TorusGeometry(0.3, 0.13, 6, 12)

export function RaceSet({ R }: { R: React.RefObject<Race> }) {
  const race = R.current!
  const { stacks, boards } = useMemo(() => {
    const tr = race.track
    const stacks = alongside(race, 9, 2.1)
      .filter((p) => p.bend > 0.5 && clear(race, p.x, p.z, tr.half + 1.2))
      .slice(0, 40)
    const boards = alongside(race, 45, 2.4)
      .filter((p) => p.bend < 0.2 && clear(race, p.x, p.z, tr.half + 1.6))
      .slice(0, 24)
      .map((p) => {
        // The run 6 m along the road; its ends swapped as need be so the boards face the road.
        let a = pointAt(tr, Math.max(0, p.s - 3), p.side * (tr.half + 2.4)) as [number, number]
        let b = pointAt(tr, Math.min(tr.n - 1, p.s + 3), p.side * (tr.half + 2.4)) as [number, number]
        const [cx, cz] = pointAt(tr, p.s, 0)
        const dx = b[0] - a[0]
        const dz = b[1] - a[1]
        // AdBoards face (-dz, dx) of their direction: towards the road's middle, or swapped.
        if (-dz * (cx - p.x) + dx * (cz - p.z) < 0) [a, b] = [b, a]
        return { a, b }
      })
    return { stacks, boards }
  }, [race])
  return (
    <Dressing>
      {(tier) => (
        <>
          {stacks.map((p, i) => (
            <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]}>
              {(tier === 'simple' ? [0, 1] : [0, 1, 2]).map((k) => (
                <group key={k}>
                  <mesh geometry={TYRE} material={tyreMat} position={[0, 0.13 + k * 0.26, -0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow />
                  <mesh geometry={TYRE} material={tyreMat} position={[0, 0.13 + k * 0.26, 0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow />
                </group>
              ))}
              <mesh material={strapMat} position={[0, 0.5, 0]}>
                <boxGeometry args={[0.9, 0.06, 1.7]} />
              </mesh>
            </group>
          ))}
          {boards.map((u, i) => (
            <AdBoards key={i} a={u.a} b={u.b} h={1.1} len={3} seed={i} />
          ))}
        </>
      )}
    </Dressing>
  )
}
