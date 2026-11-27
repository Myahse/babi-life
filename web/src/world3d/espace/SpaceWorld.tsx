import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Orbit } from 'lucide-react'
import type { City, Commune, Sim } from '../../lib/types'
import { Character } from '../Character'
import { t as tr } from '../../lib/i18n'
import { destinationOf } from '../../lib/espace'
import { BlockEarth, BlockRocket, Stars } from './placeholders'

// Up there (a city of World.espace, lib/espace.ts): what's drawn instead of the street. Workstream A's
// placeholder: the station's module (the Earth through its window), the capsule in cruise, the Moon's grey
// ground, Mars's red one; the places here as buttons (their sheet opens, as at a door in the street), the
// other modules a float away. D's world3d/espace/SpaceWorld.tsx (zero-g Station, Lune, Mars, Terre) replaces it.

export type SpaceWorldProps = {
  city: City
  commune: Commune
  sim: Sim
  moodColor?: string
  busy?: { icon: string; kind: string; id?: string } | null
  onArrive: (placeId: string) => void
  onFloat: (communeId: string, name: string) => void
}

function Floating({ sim, moodColor, gravity }: { sim: Sim; moodColor?: string; gravity: 'zero' | 'lune' | 'mars' }) {
  const me = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!me.current) return
    if (gravity === 'zero') {
      me.current.position.y = 1.2 + Math.sin(t * 0.8) * 0.25
      me.current.rotation.z = Math.sin(t * 0.4) * 0.15
      me.current.rotation.y = t * 0.15
    } else {
      // Big slow jumps (a sixth of the Earth's pull on the Moon, a third on Mars).
      const period = gravity === 'lune' ? 2.6 : 1.8
      const p = (t % period) / period
      me.current.position.y = Math.sin(p * Math.PI) * (gravity === 'lune' ? 2.4 : 1.2)
    }
  })
  return (
    <group ref={me}>
      <Character look={sim.look} gender={sim.gender} moodColor={moodColor} marker={false} />
    </group>
  )
}

function Room({ cruise }: { cruise: boolean }) {
  // The module seen from inside: padded white walls, hand-holds; its far end open on the Earth (or the stars).
  const w = cruise ? 6 : 10
  const d = cruise ? 8 : 16
  return (
    <group position={[0, 0, -d / 2 + 4]}>
      {[
        [0, -3, 0, -Math.PI / 2, 0],
        [0, 3, 0, Math.PI / 2, 0],
      ].map(([x, y, z, rx], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[rx, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshLambertMaterial color={i ? '#f8f9fa' : '#dde3ea'} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[(sx * w) / 2, 0, 0]} rotation={[0, (-sx * Math.PI) / 2, 0]}>
          <planeGeometry args={[d, 6]} />
          <meshLambertMaterial color="#eef1f4" />
        </mesh>
      ))}
      {[-4, -1, 2].map((z) => (
        <mesh key={z} position={[-w / 2 + 0.1, 1.5, z]}>
          <boxGeometry args={[0.15, 0.15, 1.2]} />
          <meshLambertMaterial color="#ffb703" />
        </mesh>
      ))}
      {/* The window's frame at the far end */}
      <mesh position={[0, 0, -d / 2]}>
        <torusGeometry args={[2.6, 0.25, 4, 8]} />
        <meshLambertMaterial color="#adb5bd" />
      </mesh>
    </group>
  )
}

export function SpaceScene({ city, commune, sim, moodColor }: Pick<SpaceWorldProps, 'city' | 'commune' | 'sim' | 'moodColor'>) {
  const d = destinationOf(undefined, city.id)
  const cruise = !!d?.cruise && commune.id === d.cruise
  const where = cruise ? 'cruise' : d?.id ?? 'station'
  useFrame(({ camera }) => {
    if (where === 'station' || where === 'cruise') {
      camera.position.set(1.5, 1.8, where === 'cruise' ? 5 : 7)
      camera.lookAt(0, 0.6, -6)
    } else {
      camera.position.set(9, 5, 12)
      camera.lookAt(0, 1.5, 0)
    }
  })
  return (
    <>
      <color attach="background" args={[where === 'mars' ? '#d9a07a' : '#02030a']} />
      <hemisphereLight args={['#ffffff', where === 'mars' ? '#a0522d' : '#2b2f3a', 1.1]} />
      <directionalLight position={[20, 30, 10]} intensity={1.4} />
      {where !== 'mars' && <Stars />}
      {(where === 'station' || where === 'cruise') && (
        <>
          <Room cruise={where === 'cruise'} />
          {/* Through the window: the Earth below (the station), the stars (the cruise). */}
          {where === 'station' && (
            <group position={[0, -26, -70]}>
              <BlockEarth radius={14} />
            </group>
          )}
          <Floating sim={sim} moodColor={moodColor} gravity="zero" />
        </>
      )}
      {where === 'lune' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[400, 400]} />
            <meshLambertMaterial color="#9a9a9a" />
          </mesh>
          {[[-12, -8, 3], [15, -20, 5], [-25, 10, 4], [8, 18, 2.5]].map(([x, z, r], i) => (
            <mesh key={i} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[r * 0.6, r, 12]} />
              <meshLambertMaterial color="#7b7b7b" />
            </mesh>
          ))}
          {[-6, -3].map((x) => (
            <mesh key={x} position={[x, 1.2, -6]}>
              <boxGeometry args={[2.8, 2.4, 4]} />
              <meshLambertMaterial color="#f8f9fa" />
            </mesh>
          ))}
          {/* The agency's pennant (no national flag) */}
          <mesh position={[4, 1.5, -3]}>
            <boxGeometry args={[0.08, 3, 0.08]} />
            <meshLambertMaterial color="#cccccc" />
          </mesh>
          <mesh position={[4.6, 2.6, -3]}>
            <boxGeometry args={[1.2, 0.7, 0.04]} />
            <meshLambertMaterial color="#ff7a00" />
          </mesh>
          <group position={[30, 22, -80]}>
            <BlockEarth radius={6} />
          </group>
          <Floating sim={sim} moodColor={moodColor} gravity="lune" />
        </>
      )}
      {where === 'mars' && (
        <>
          <fog attach="fog" args={['#d9a07a', 60, 220]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[400, 400]} />
            <meshLambertMaterial color="#b5532c" />
          </mesh>
          {/* The dome over the colony */}
          <mesh position={[-5, 0, -8]}>
            <sphereGeometry args={[6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshLambertMaterial color="#cfe8ff" transparent opacity={0.45} />
          </mesh>
          <mesh position={[-5, 1, -8]}>
            <boxGeometry args={[3, 2, 3]} />
            <meshLambertMaterial color="#3c8d3a" />
          </mesh>
          <group position={[10, 0, -14]} rotation={[0, 0, 0.1]}>
            <BlockRocket scale={0.6} />
          </group>
          <Floating sim={sim} moodColor={moodColor} gravity="mars" />
        </>
      )}
    </>
  )
}

export function SpaceWorld({ city, commune, sim, moodColor, busy, onArrive, onFloat }: SpaceWorldProps) {
  const others = city.communes.filter((c) => c.id !== commune.id && c.id !== destinationOf(undefined, city.id)?.cruise)
  const cruising = !!sim.life?.espace?.voyage && !sim.life.espace.voyage.arrived
  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 55, near: 0.1, far: 1000, position: [2.5, 2, 6] }}>
        <SpaceScene city={city} commune={commune} sim={sim} moodColor={moodColor} />
      </Canvas>
      {/* The places here, and the other modules a float away (above the phone's bar). */}
      <div className="pointer-events-auto absolute right-3 bottom-[calc(var(--sab,env(safe-area-inset-bottom))+7.5rem)] left-3 flex flex-wrap justify-center gap-2">
        <span className="hud flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold">
          <Orbit size={14} className="text-[#ff7a00]" /> {city.name} · {commune.name}
        </span>
        {commune.places.map((p) => (
          <button key={p.id} className={`hud rounded-full px-3 py-1.5 text-xs font-extrabold ${busy?.id && busy.kind === p.kind ? 'ring-2 ring-[#ff7a00]' : ''}`} onClick={() => onArrive(p.id)}>
            {p.name}
          </button>
        ))}
        {!cruising &&
          others.map((c) => (
            <button key={c.id} className="hud rounded-full px-3 py-1.5 text-xs font-bold opacity-90" onClick={() => onFloat(c.id, c.name)}>
              {tr('Flotter vers {name}', { name: c.name })}
            </button>
          ))}
      </div>
    </div>
  )
}
