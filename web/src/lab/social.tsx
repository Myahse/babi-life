import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import '../index.css'
import { api } from '../lib/api'
import { useSession } from '../store/session'
import type { Sim, World } from '../lib/types'
import { GbairaiApp } from '../screens/GbairaiApp'
import { TikitokoApp } from '../screens/TikitokoApp'
import { StreetStall } from '../world3d/open/stalls'
import { Snapper } from '../world3d/snapshot'

// The phone's social apps on their own (?app=gbairai|tikitoko&token=…&sim=…),
// against a running API (VITE_API_URL), with a street stall in 3D behind for
// the photos. A lab for the screenshots, not part of the game.

const q = new URLSearchParams(location.search)
const token = q.get('token')
if (token) useSession.setState({ token })

function Lab() {
  const [sim, setSim] = useState<Sim | null>(null)
  useEffect(() => {
    void api.sim(q.get('sim')!).then((r) => setSim('sim' in r ? (r as { sim: Sim }).sim : (r as unknown as Sim)))
  }, [])
  const world = { config: { realPhotos: q.has('real') }, cities: [] } as unknown as World
  const app = q.get('app') ?? 'gbairai'
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 3, 7], fov: 50 }}>
          <color attach="background" args={['#a9d3f0']} />
          <hemisphereLight args={['#ffffff', '#b8a27c', 1.3]} />
          <Snapper />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[40, 40]} />
            <meshLambertMaterial color="#b98b5c" />
          </mesh>
          <StreetStall stall={{ id: 'garba:lab:1', kind: 'garba', at: [0, -1], rot: 0, seed: 0.4 }} hour={12} crowd />
        </Canvas>
      </div>
      <div className="relative m-4 flex w-[380px] flex-col overflow-hidden rounded-[36px] bg-white">
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-6">{sim ? app === 'tikitoko' ? <TikitokoApp sim={sim} act={async (_l, _i, _k, call) => (await call(), true)} /> : <GbairaiApp world={world} sim={sim} /> : 'Chargement…'}</div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Lab />)
