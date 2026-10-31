import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Airliner } from '../world3d/open/airport'

// ?view=plane: Air Lagune's airliner on the apron, to look round (&cam=x,y,z&look=x,y,z for a set view;
// &gear=0..1 the gear folded part way; &night the lights in the dark).

const q = new URLSearchParams(location.search)
const v = (k: string, d: string) => (q.get(k) ?? d).split(',').map(Number) as [number, number, number]

function Fixed() {
  const set = useRef(false)
  useFrame(({ camera }) => {
    if (set.current || !q.get('cam')) return
    camera.position.set(...v('cam', '30,10,30'))
    camera.lookAt(...v('look', '0,3,0'))
    set.current = true
  })
  return null
}

export function PlaneLab() {
  const night = q.has('night')
  const gear = q.has('gear') ? Number(q.get('gear')) : 1
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [28, 9, 30], fov: 40 }}>
        <color attach="background" args={[night ? '#0b1430' : '#8cc4ef']} />
        <hemisphereLight args={[night ? '#5a6aa8' : '#ffffff', night ? '#1a1f33' : '#c8b89a', night ? 0.5 : 1.2]} />
        <directionalLight position={[30, 40, 20]} intensity={night ? 0.3 : 1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshLambertMaterial color={new THREE.Color(night ? '#2a2d33' : '#9a978f')} />
        </mesh>
        <Airliner gear={gear} />
        {q.get('cam') ? <Fixed /> : <OrbitControls target={[0, 3, 0]} />}
      </Canvas>
    </div>
  )
}
