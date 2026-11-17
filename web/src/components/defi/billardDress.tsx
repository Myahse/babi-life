import * as THREE from 'three'
import { Dressing, TM } from '../../streetball/decor'

// « Mini-jeux réalistes », phase 2: the maquis' pool table's small things (streetball/decor.tsx),
// drawn only while the update is open: the blue chalk cubes left on the rails (the top worn hollow),
// the coins of the next game stacked on a corner, a beer bottle and its glass on the far rail. On
// the wood only: nothing over the cloth (it takes the aiming touches).

const chalkMat = () =>
  TM('chalk', 8, 8, (g, r) => {
    g.fillStyle = '#2f6fd6'
    g.fillRect(0, 0, 8, 8)
    for (let i = 0; i < 10; i++) {
      g.fillStyle = r() < 0.5 ? '#5c92ea' : '#1f56b3'
      g.fillRect(Math.floor(r() * 8), Math.floor(r() * 8), 1, 1)
    }
  })
const hollowMat = new THREE.MeshLambertMaterial({ color: '#174a9c' })
const coinMat = new THREE.MeshLambertMaterial({ color: '#c9a64a' })
const beerMat = new THREE.MeshLambertMaterial({ color: '#5a2e0c' })
const labelMat = new THREE.MeshLambertMaterial({ color: '#f1e3b0' })
const glassMat = new THREE.MeshLambertMaterial({ color: '#e8a83a', transparent: true, opacity: 0.75 })

export function BillardSet({ W, L, CUSH, RAIL }: { W: number; L: number; CUSH: number; RAIL: number }) {
  const rx = W / 2 + CUSH + 0.06
  const rz = L / 2 + CUSH + 0.06
  return (
    <Dressing>
      {(tier) => (
        <>
          {[
            [rx, rz * 0.55, 0.3],
            [-rx, -rz * 0.2, -0.5],
          ].map(([x, z, a], i) => (
            <group key={i} position={[x, RAIL + 0.011, z]} rotation={[0, a, 0]}>
              <mesh material={chalkMat()} castShadow>
                <boxGeometry args={[0.022, 0.022, 0.022]} />
              </mesh>
              <mesh material={hollowMat} position={[0, 0.0112, 0]}>
                <boxGeometry args={[0.012, 0.001, 0.012]} />
              </mesh>
            </group>
          ))}
          {tier !== 'simple' && (
            <>
              {[0, 1, 2, 3].map((k) => (
                <mesh key={k} material={coinMat} position={[-rx + (k % 2) * 0.004, RAIL + 0.002 + k * 0.0035, rz - 0.02]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.003, 10]} />
                </mesh>
              ))}
              <group position={[rx * 0.55, RAIL, -rz]}>
                <mesh material={beerMat} position={[0, 0.07, 0]} castShadow>
                  <cylinderGeometry args={[0.03, 0.03, 0.14, 10]} />
                </mesh>
                <mesh material={beerMat} position={[0, 0.17, 0]}>
                  <cylinderGeometry args={[0.012, 0.03, 0.06, 10]} />
                </mesh>
                <mesh material={labelMat} position={[0, 0.07, 0]}>
                  <cylinderGeometry args={[0.0305, 0.0305, 0.05, 10]} />
                </mesh>
                <mesh material={glassMat} position={[0.07, 0.045, 0.01]}>
                  <cylinderGeometry args={[0.027, 0.022, 0.09, 10]} />
                </mesh>
              </group>
            </>
          )}
        </>
      )}
    </Dressing>
  )
}
