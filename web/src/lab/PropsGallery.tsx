import { Canvas } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Prop } from '../components/defi/jeux/props'
import { PROP_IDS, type PropId } from '../components/defi/jeux/types'
import { MiniScene } from '../world3d/minijeux'

// The games' 3D objects side by side (the lab page, ?g=props or ?g=props:<first>-<last> by index), each with its name.
export function PropsGallery({ from = 0, to = PROP_IDS.length }: { from?: number; to?: number }) {
  // ?ids=a,b,c: those props only, closer (to look at a few).
  const only = new URLSearchParams(location.search).get('ids')
  const ids = (only ? only.split(',') : PROP_IDS.slice(from, to)) as readonly PropId[]
  const cols = only ? Math.min(4, ids.length) : 6
  const rows = Math.ceil(ids.length / cols)
  return (
    <Canvas camera={{ position: [0, rows * 1.4 + (only ? 1.6 : 0), rows * 1.9 + 3], fov: only ? 46 : 40 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)} style={{ position: 'fixed', inset: 0, background: '#e9ecef' }}>
      <hemisphereLight args={['#ffffff', '#8a7a6a', 1]} />
      <directionalLight position={[3, 8, 5]} intensity={1.2} />
      <MiniScene kind="table" tpm={14} near={14} far={34} post={false} />
      {ids.map((id, i) => {
        const x = ((i % cols) - (cols - 1) / 2) * 1.8
        const z = (Math.floor(i / cols) - (rows - 1) / 2) * 1.8
        return (
          <group key={id} position={[x, 0, z]}>
            <Prop id={id} />
            <Html position={[0, -0.15, 0.7]} center style={{ font: '700 10px system-ui', color: '#212529', whiteSpace: 'nowrap' }}>
              {id}
            </Html>
          </group>
        )
      })}
    </Canvas>
  )
}
