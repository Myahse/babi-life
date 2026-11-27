import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MapPin, Orbit, X } from 'lucide-react'
import type { Sim, World } from '../lib/types'
import { t as tr } from '../lib/i18n'
import { keyOpen, useFeatures } from '../lib/features'
import { cityOf, destinationOf, launchRules } from '../lib/espace'
import { amount } from '../game/rules'
import { Terre } from '../world3d/espace/Terre'
import { Stars } from '../world3d/espace/placeholders'

// The solar system's map (the updates « espace-* », lib/espace.ts; workstream D): the Sun and the planets in
// blocks, each turning on its orbit's line, the Moon by the Earth (the Earth itself the voxel globe of Terre.tsx,
// lit as it is now). What's open shows its price and where to buy the ticket; Venus, Jupiter and Saturn say
// « bientôt ». A tap on a body picks it; the pin shows where the Sim is.

type Body = { id: string; name: () => string; colors: string[]; size: number; x: number; dest?: 'station' | 'lune' | 'mars'; ring?: boolean; soon?: boolean; blurb: () => string }

const BODIES: Body[] = [
  { id: 'soleil', name: () => tr('Le Soleil'), colors: ['#ffd43b', '#fab005', '#ffe066'], size: 5, x: -11, blurb: () => tr('Notre étoile. On la regarde de loin.') },
  { id: 'venus', name: () => tr('Vénus'), colors: ['#f2c48d', '#e8b06a', '#f7d9ad'], size: 1.1, x: -5, soon: true, blurb: () => tr('Trop chaude pour s’y poser : bientôt, un survol.') },
  { id: 'terre', name: () => tr('La Terre'), colors: [], size: 1.3, x: -2, dest: 'station', blurb: () => tr('La Station Akwaba tourne autour en 92 minutes.') },
  { id: 'lune', name: () => tr('La Lune'), colors: ['#ced4da', '#adb5bd', '#e9ecef'], size: 0.45, x: -0.2, dest: 'lune', blurb: () => tr('La Base Clair-de-Terre, au bord du cratère Shackleton.') },
  { id: 'mars', name: () => tr('Mars'), colors: ['#c0392b', '#a93226', '#d35400'], size: 0.9, x: 2.2, dest: 'mars', blurb: () => tr('La Colonie Harmattan, au cratère Jezero.') },
  { id: 'jupiter', name: () => tr('Jupiter'), colors: ['#d9a066', '#f1d1a5', '#b07b46'], size: 2.4, x: 6, soon: true, blurb: () => tr('La géante aux bandes : bientôt, ses lunes.') },
  { id: 'saturne', name: () => tr('Saturne'), colors: ['#e9d8a6', '#d6c08a', '#f5ead0'], size: 2, x: 11.2, ring: true, soon: true, blurb: () => tr('Ses anneaux en blocs : bientôt.') },
]

/** A planet of blocks: a cube of cubes in bands of its colours, the ones outside a sphere left out. */
function Planet({ b, picked, onPick }: { b: Body; picked: boolean; onPick: () => void }) {
  const me = useRef<THREE.Group>(null)
  const mesh = useMemo(() => {
    if (!b.colors.length) return null
    const n = 7
    const cells: [number, number, number][] = []
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) {
          const p: [number, number, number] = [i - (n - 1) / 2, j - (n - 1) / 2, k - (n - 1) / 2]
          if (Math.hypot(...p) <= n / 2) cells.push(p)
        }
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), b.id === 'soleil' ? new THREE.MeshBasicMaterial() : new THREE.MeshLambertMaterial(), cells.length)
    const o = new THREE.Object3D()
    const s = (b.size * 2) / n
    cells.forEach((p, idx) => {
      o.position.set(p[0] * s, p[1] * s, p[2] * s)
      o.scale.setScalar(s * 0.98)
      o.updateMatrix()
      m.setMatrixAt(idx, o.matrix)
      m.setColorAt(idx, new THREE.Color(b.colors[(Math.abs(p[1]) + (b.id === 'jupiter' ? 0 : Math.abs(p[0] * p[2]))) % b.colors.length]))
    })
    return m
  }, [b])
  useFrame(({ clock }) => {
    if (!me.current) return
    me.current.rotation.y = clock.elapsedTime * (b.id === 'soleil' ? 0.05 : 0.3)
    me.current.position.y = picked ? Math.sin(clock.elapsedTime * 2) * 0.15 + 0.3 : 0
  })
  return (
    <group position={[b.x, 0, 0]} onClick={(e) => (e.stopPropagation(), onPick())}>
      <group ref={me}>{mesh ? <primitive object={mesh} /> : <Terre radius={b.size} view="fixe" />}</group>
      {b.ring && (
        <group rotation={[0.45, 0, 0.2]}>
          {Array.from({ length: 28 }, (_, i) => {
            const a = (i / 28) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * b.size * 1.6, 0, Math.sin(a) * b.size * 1.6]} rotation={[0, -a, 0]}>
                <boxGeometry args={[0.25, 0.08, b.size * 0.4]} />
                <meshLambertMaterial color={i % 2 ? '#cdb98a' : '#e6d6ad'} />
              </mesh>
            )
          })}
        </group>
      )}
      {/* The hit area (the small ones are hard to tap) */}
      <mesh>
        <boxGeometry args={[Math.max(1.6, b.size * 2.2), Math.max(1.6, b.size * 2.2), 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {picked && (
        <mesh position={[0, -b.size - 0.6, 0]}>
          <boxGeometry args={[b.size * 1.6 + 0.4, 0.08, 0.08]} />
          <meshBasicMaterial color="#ff7a00" />
        </mesh>
      )}
    </group>
  )
}

export function SolarMap({ world, sim, onClose }: { world: World; sim: Sim; onClose: () => void }) {
  const feats = useFeatures()
  const rules = launchRules(world)
  const here = cityOf(world, sim.city)
  const at = destinationOf(world, sim.city)?.id ?? 'station'
  const hereBody = destinationOf(world, sim.city) ? (at === 'station' ? 'terre' : at) : 'terre'
  const [picked, setPicked] = useState(hereBody)
  const body = BODIES.find((b) => b.id === picked)!
  const dest = body.dest ? rules.destinations.find((d) => d.id === body.dest) : undefined
  const open = dest ? keyOpen(feats, dest.key) : false
  return (
    <div className="animate-up absolute inset-0 z-50 flex flex-col bg-[#02030a] text-white">
      <div className="flex items-center gap-2 p-4 pt-[max(1rem,var(--sat,env(safe-area-inset-top)))]">
        <Orbit size={20} className="text-[#ff7a00]" />
        <h2 className="flex-1 text-lg font-extrabold">{tr('Le système solaire')}</h2>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10" onClick={onClose} aria-label={tr('Fermer')}>
          <X size={18} />
        </button>
      </div>
      <p className="-mt-2 flex items-center gap-1 px-4 text-xs font-bold opacity-70">
        <MapPin size={12} /> {tr('Tu es ici : {name}', { name: here?.name ?? sim.city })}
      </p>
      <div className="relative min-h-[16rem] flex-1">
        <Canvas dpr={[1, 1.5]} camera={{ fov: 40, position: [0, 9, 26] }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
          <color attach="background" args={['#02030a']} />
          <Stars count={400} radius={200} />
          <ambientLight intensity={0.35} />
          <pointLight position={[-11, 0, 0]} intensity={400} distance={60} decay={1.2} />
          <directionalLight position={[-10, 6, 8]} intensity={0.8} />
          {/* The orbits' line */}
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[24, 0.03, 0.03]} />
            <meshBasicMaterial color="#343a40" />
          </mesh>
          {BODIES.map((b) => (
            <Planet key={b.id} b={b} picked={picked === b.id} onPick={() => setPicked(b.id)} />
          ))}
        </Canvas>
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold opacity-80">{tr('Touche une planète')}</span>
        </div>
      </div>
      <div className="max-h-[45%] overflow-y-auto p-4 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))]">
        <div className="rounded-2xl bg-white/10 p-3">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            {body.name()}
            {hereBody === body.id && <span className="rounded-full bg-[#ff7a00] px-2 py-0.5 text-[10px]">{tr('Tu es ici')}</span>}
          </div>
          <p className="mt-0.5 text-xs font-bold opacity-80">{body.blurb()}</p>
          {dest && (
            <p className="mt-1 text-xs font-bold text-[#ffb37a]">
              {dest.name} · {open ? tr('Ouvert · billet {price} F au pas de tir d’un spatioport', { price: amount(dest.price) }) : tr('Bientôt')}
            </p>
          )}
          {body.soon && <p className="mt-1 text-xs font-extrabold text-[#ffb37a]">{tr('Bientôt')}</p>}
        </div>
        <ul className="mt-2 grid gap-2">
          {rules.destinations.map((d) => (
            <li key={d.id} className="rounded-2xl bg-white/5 p-3">
              <div className="text-sm font-extrabold">{d.name}</div>
              <div className="text-xs font-bold opacity-75">{keyOpen(feats, d.key) ? tr('Ouvert · billet {price} F au pas de tir d’un spatioport', { price: amount(d.price) }) : tr('Bientôt')}</div>
            </li>
          ))}
          {[tr('Vénus'), tr('Jupiter'), tr('Saturne')].map((n) => (
            <li key={n} className="rounded-2xl bg-white/5 p-3 text-sm font-bold opacity-60">
              {n} · {tr('Bientôt')}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
