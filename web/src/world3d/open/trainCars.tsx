import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Baked } from '../Baked'

// The Ébène Rail train's cars, in detail: the diesel locomotive (its cab with side windows, the sloping
// nose, the radiator grilles and the exhaust on its roof, the horn, the buffers and the headlights lit
// at night with their beam on the track), and the coaches (two doors each side that slide open at the
// stations, framed windows with people sitting behind them, the roof's vents, the gangway to the next
// coach, the line's name and the number). Each car is merged into a few draws when seen from afar
// (Baked); close by, its doors move.

export const CAR = 16.5
const W = 2.9

const M = (color: string) => new THREE.MeshLambertMaterial({ color })
const green = M('#1f5f3f')
const greenDark = M('#174a31')
const yellow = M('#f2c14b')
const cream = M('#efe6cf')
const glass = new THREE.MeshLambertMaterial({ color: '#4a6a82' })
const frame = M('#d9d4c6')
const grey = M('#9aa1a8')
const dark = M('#202328')
const steel = M('#5b5f66')
const seat = M('#c0392b')
const SKINS = ['#6e4024', '#8d5a36', '#4a2a16', '#a06a42'].map(M)
const SHIRTS = ['#ff7a00', '#2f6fd6', '#f4f4f4', '#5aa832', '#d63a2f', '#7b5cff'].map(M)
const lampOff = M('#d9d6c4')
const lampOn = new THREE.MeshBasicMaterial({ color: '#fff4c2' })
const tailOn = new THREE.MeshBasicMaterial({ color: '#ff3b30' })
const beamMat = new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14)
const BEAM = new THREE.ConeGeometry(2.2, 22, 16, 1, true)

type V3 = [number, number, number]
function B({ p, s, m, r }: { p: V3; s: V3; m: THREE.Material; r?: V3 }) {
  return <mesh geometry={BOX} material={m} position={p} scale={s} rotation={r} />
}

/** A bogie: its frame, its four wheels, its springs. */
function Bogie({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <B p={[0, 0.62, 0]} s={[2.3, 0.35, 2.9]} m={dark} />
      {[-0.75, 0.75].flatMap((wz) =>
        [-1, 1].map((sx) => <mesh key={`${wz}${sx}`} geometry={CYL} material={steel} position={[sx * 0.82, 0.46, wz]} rotation={[0, 0, Math.PI / 2]} scale={[0.92, 0.14, 0.92]} />),
      )}
      {[-1, 1].map((sx) => (
        <B key={sx} p={[sx * 1.05, 0.75, 0]} s={[0.12, 0.3, 1.2]} m={yellow} />
      ))}
    </group>
  )
}

/** Buffers and the coupling at one end (dir: +1 front, -1 back). */
function Ends({ dir }: { dir: number }) {
  return (
    <group position={[0, 0, dir * (CAR / 2 - 0.3)]}>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} geometry={CYL} material={steel} position={[x, 1.05, dir * 0.45]} rotation={[Math.PI / 2, 0, 0]} scale={[0.36, 0.6, 0.36]} />
      ))}
      <B p={[0, 1.0, dir * 0.4]} s={[0.3, 0.3, 0.6]} m={dark} />
    </group>
  )
}

/** People sitting at the windows, one side (a head and shoulders), here and there: drawn by the seed. */
function Riders({ seed, side, n }: { seed: number; side: number; n: number }) {
  const who = useMemo(() => {
    let x = seed * 9301 + side * 49297
    const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
    return [...Array(n)].map((_, i) => ({ i, on: r() < 0.65, skin: SKINS[Math.floor(r() * SKINS.length)], shirt: SHIRTS[Math.floor(r() * SHIRTS.length)] })).filter((w) => w.on)
  }, [seed, side, n])
  return (
    <>
      {who.map((w) => {
        const z = (w.i - (n - 1) / 2) * 2.25
        return (
          // (Seen through the glass: a head and shoulders laid just on it, the body being solid.)
          <group key={w.i} position={[side * (W / 2 + 0.022), 0, z + 0.25]}>
            <B p={[0, 2.3, 0]} s={[0.01, 0.3, 0.62]} m={w.shirt} />
            <B p={[0, 2.67, 0]} s={[0.01, 0.34, 0.3]} m={w.skin} />
          </group>
        )
      })}
    </>
  )
}

/**
 * A coach. `doors`: how open its doors are (0…1, read each frame), the same for all.
 * `seed`: who sits in it; `n`: its number on the side.
 */
export function Coach({ doors, seed }: { doors: React.RefObject<number>; seed: number }) {
  const leaves = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const k = doors.current ?? 0
    leaves.current.forEach((m, i) => {
      if (!m) return
      // Each door's two leaves slide apart along the side (the first leaf one way, the second the other).
      const dir = i % 2 ? 1 : -1
      m.position.z = Number(m.userData.z) + dir * 0.55 * k
    })
  })
  const DOORS = [-CAR / 2 + 2.2, CAR / 2 - 2.2]
  return (
    <Baked within={45}>
      <group>
        <Bogie z={-CAR / 2 + 3} />
        <Bogie z={CAR / 2 - 3} />
        <Ends dir={1} />
        <Ends dir={-1} />
        {/* The underframe, the body, the roof */}
        <B p={[0, 0.95, 0]} s={[W - 0.2, 0.35, CAR - 1]} m={dark} />
        <B p={[0, 1.45, 0]} s={[W, 0.7, CAR - 0.8]} m={green} />
        <B p={[0, 1.9, 0]} s={[W + 0.02, 0.22, CAR - 0.78]} m={yellow} />
        <B p={[0, 2.55, 0]} s={[W, 1.1, CAR - 0.8]} m={cream} />
        <B p={[0, 3.25, 0]} s={[W, 0.3, CAR - 0.8]} m={green} />
        <B p={[0, 3.5, 0]} s={[W - 0.3, 0.25, CAR - 1]} m={grey} />
        {[-4, 0, 4].map((z) => (
          <B key={z} p={[0, 3.7, z]} s={[0.9, 0.18, 0.9]} m={steel} />
        ))}
        {/* The windows each side, framed; the doors */}
        {[-1, 1].map((side, si) => (
          <group key={side}>
            {[...Array(6)].map((_, i) => {
              const z = (i - 2.5) * 2.25
              return (
                <group key={i}>
                  <B p={[side * (W / 2 + 0.005), 2.6, z]} s={[0.02, 0.9, 1.75]} m={frame} />
                  <B p={[side * (W / 2 + 0.012), 2.6, z]} s={[0.02, 0.76, 1.6]} m={glass} />
                </group>
              )
            })}
            {DOORS.map((z, di) => (
              <group key={z}>
                <B p={[side * (W / 2 + 0.006), 2.05, z]} s={[0.02, 2.3, 1.35]} m={dark} />
                {[-1, 1].map((l, li) => (
                  <mesh
                    key={l}
                    ref={(m) => {
                      if (m) m.userData.z = z + l * 0.32
                      leaves.current[(si * 2 + di) * 2 + li] = m
                    }}
                    geometry={BOX}
                    material={yellow}
                    position={[side * (W / 2 + 0.02), 2.05, z + l * 0.32]}
                    scale={[0.03, 2.2, 0.62]}
                  />
                ))}
              </group>
            ))}
            <Riders seed={seed} side={side} n={6} />
            {/* The seats under the windows */}
            <B p={[side * 0.85, 1.8, 0]} s={[0.55, 0.12, CAR - 6]} m={seat} />
          </group>
        ))}
        {/* The gangway to the next coach */}
        <B p={[0, 2.2, CAR / 2 - 0.1]} s={[1.5, 2.4, 0.5]} m={dark} />
      </group>
    </Baked>
  )
}

/** The locomotive: its nose ahead (+z), headlights lit at night with their beam, a red tail lamp. */
export function Locomotive({ night }: { night: boolean }) {
  const NOSE = CAR / 2
  return (
    <group>
      <Baked within={45} key={night ? 'n' : 'd'}>
        <group>
          <Bogie z={-CAR / 2 + 3.2} />
          <Bogie z={CAR / 2 - 3.2} />
          <Ends dir={1} />
          <Ends dir={-1} />
          <B p={[0, 0.95, 0]} s={[W - 0.2, 0.4, CAR - 0.6]} m={dark} />
          {/* The long hood, its grilles; the cab at the front; the short nose before it */}
          <B p={[0, 2.1, -1.6]} s={[2.3, 2.2, CAR - 6.5]} m={green} />
          <B p={[0, 1.6, -1.6]} s={[2.32, 0.25, CAR - 6.4]} m={yellow} />
          {[-1, 1].map((side) =>
            [-5.5, -3, -0.5].map((z) => <B key={`${side}${z}`} p={[side * 1.16, 2.35, z]} s={[0.02, 1.0, 1.8]} m={greenDark} />),
          )}
          <B p={[0, 3.3, -6]} s={[1.6, 0.25, 2.6]} m={dark} />
          <mesh geometry={CYL} material={dark} position={[0, 3.55, -2.5]} scale={[0.35, 0.55, 0.35]} />
          <B p={[0, 2.5, NOSE - 3.2]} s={[W, 3.2, 3.2]} m={green} />
          <B p={[0, 1.6, NOSE - 3.2]} s={[W + 0.02, 0.28, 3.22]} m={yellow} />
          <B p={[0, 4.15, NOSE - 3.2]} s={[W - 0.2, 0.15, 3.0]} m={grey} />
          {/* The horn on the cab's roof */}
          {[-0.25, 0.25].map((x) => (
            <mesh key={x} geometry={CYL} material={steel} position={[x, 4.4, NOSE - 3.4]} rotation={[Math.PI / 2, 0, 0]} scale={[0.16, 0.5, 0.16]} />
          ))}
          {/* The cab's windows: the windscreen, each side */}
          <B p={[0, 3.25, NOSE - 1.58]} s={[2.5, 0.95, 0.04]} m={glass} />
          {[-1, 1].map((side) => (
            <B key={side} p={[side * (W / 2 + 0.01), 3.2, NOSE - 3.2]} s={[0.03, 0.85, 1.6]} m={glass} />
          ))}
          <B p={[0, 1.9, NOSE - 0.8]} s={[2.5, 1.4, 1.6]} m={green} r={[-0.18, 0, 0]} />
          <B p={[0, 1.25, NOSE - 0.3]} s={[2.6, 0.3, 0.3]} m={yellow} />
          {/* The headlights and the number */}
          {[-0.85, 0.85].map((x) => (
            <B key={x} p={[x, 1.95, NOSE - 0.02]} s={[0.4, 0.3, 0.05]} m={night ? lampOn : lampOff} />
          ))}
          <B p={[0, 3.9, NOSE - 1.6]} s={[0.5, 0.25, 0.05]} m={night ? lampOn : lampOff} />
          {[-0.9, 0.9].map((x) => (
            <B key={x} p={[x, 1.6, -NOSE + 0.02]} s={[0.25, 0.25, 0.05]} m={night ? tailOn : dark} />
          ))}
        </group>
      </Baked>
      {/* At night, the light on the track ahead */}
      {night && <mesh geometry={BEAM} material={beamMat} position={[0, 1.4, NOSE + 11]} rotation={[-Math.PI / 2, 0, 0]} />}
    </group>
  )
}
