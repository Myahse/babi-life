import { useMemo } from 'react'
import * as THREE from 'three'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { Solid } from '../Solid'
import type { Station } from './tiles'
import { BOX, PLANE, lettering, signMaterial } from './ruePrincesse'

// A fuel station where the map has one (tiles.ts lays it out by its street):
// the canopy over two pump islands, lit underneath at night, the shop
// behind with its glass front, the price board at the roadside, a car at
// the pump and the pompiste. Like the game's other brands, a company keeps
// its colours under a name of the game's. Prices are the game's.
// In the station's frame: x along the street, z away from it.

type Brand = { name: string; main: string; accent: string }
const BRANDS: [RegExp, Brand][] = [
  [/total/, { name: 'TOTALÉ', main: '#d0103a', accent: '#0057b8' }],
  [/shell/, { name: 'CHELL', main: '#ffd500', accent: '#dd1d21' }],
  [/petro ?ivoire/, { name: 'PÉTRO IVOIR', main: '#009a44', accent: '#f77f00' }],
  [/petroci/, { name: 'PÉTRO-CI', main: '#00843d', accent: '#f4f4f0' }],
  [/star ?oil/, { name: 'STAR HUILE', main: '#e30613', accent: '#1d1d1b' }],
  [/ola/, { name: 'OLA ÉNERGIE', main: '#0072ce', accent: '#ffd100' }],
  [/oryx/, { name: 'ORIX', main: '#ff6a13', accent: '#003a70' }],
]
const OTHER: Brand = { name: 'STATION', main: '#1971c2', accent: '#ffd43b' }

export function brandOf(name: string): Brand {
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return BRANDS.find(([re]) => re.test(n))?.[1] ?? OTHER
}

const concrete = new THREE.MeshLambertMaterial({ color: '#c9c6c0' })
const white = new THREE.MeshLambertMaterial({ color: '#f4f4f0' })
const glass = new THREE.MeshLambertMaterial({ color: '#2e4a66' })
const grey = new THREE.MeshLambertMaterial({ color: '#59606a' })
const lightOn = new THREE.MeshBasicMaterial({ color: '#fffbe8' })

export function FuelStation({ s, night }: { s: Station; night: boolean }) {
  const brand = useMemo(() => brandOf(s.name), [s.name])
  const mats = useMemo(() => {
    const sign = lettering(brand.name, brand.main, brand.main === '#ffd500' ? '#dd1d21' : '#ffffff', brand.accent)
    const price = lettering('SUPER 875 · GASOIL 715', '#141416', '#ffd43b')
    return {
      main: new THREE.MeshLambertMaterial({ color: brand.main }),
      accent: new THREE.MeshLambertMaterial({ color: brand.accent }),
      sign: signMaterial(sign.t),
      signAspect: sign.aspect,
      price: signMaterial(price.t),
      priceAspect: price.aspect,
    }
  }, [brand])
  mats.sign.emissiveIntensity = night ? 0.9 : 0
  mats.price.emissiveIntensity = night ? 0.9 : 0
  const crew = useMemo(() => {
    const r = rng(`station${s.name}${s.at.join()}`)
    return {
      look: { ...randomLook('homme', r), outfit: 'bleu', outfitColor: brand.main === '#ffd500' ? '#dd1d21' : brand.main, accessory: 'cap', accessoryColor: brand.accent },
      seed: r() * 100,
      car: ['#212529', '#e9ecef', '#c92a2a', '#1971c2'][Math.floor(r() * 4)],
    }
  }, [s, brand])
  const z = (v: number) => v * s.side
  return (
    <group position={[s.at[0], 0, s.at[1]]} rotation={[0, -s.angle, 0]}>
      {/* The forecourt */}
      <mesh geometry={BOX} material={concrete} position={[0, 0.03, z(s.shop ? 3.5 : 0)]} scale={[15, 0.04, s.shop ? 18 : 11]} receiveShadow />
      {/* The canopy: four pillars, the roof with its band in the brand's colours, lit underneath */}
      {[-5, 5].map((x) =>
        [-2.8, 2.8].map((v) => (
          <Solid key={`${x}${v}`}>
            <mesh geometry={BOX} material={white} position={[x, 2.6, z(v)]} scale={[0.4, 5.2, 0.4]} castShadow />
          </Solid>
        )),
      )}
      <mesh geometry={BOX} material={white} position={[0, 5.45, 0]} scale={[14, 0.5, 9]} castShadow />
      <mesh geometry={BOX} material={mats.main} position={[0, 5.4, 0]} scale={[14.3, 0.8, 9.3]} />
      <mesh geometry={BOX} material={mats.accent} position={[0, 5.05, 0]} scale={[14.32, 0.12, 9.32]} />
      <mesh geometry={PLANE} material={night ? lightOn : white} position={[0, 4.99, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[13.4, 8.4, 1]} />
      <mesh geometry={PLANE} material={mats.sign} position={[0, 5.4, z(-4.67)]} rotation={[0, s.side > 0 ? Math.PI : 0, 0]} scale={[Math.min(10, 0.75 * mats.signAspect), 0.75, 1]} />
      {/* Two pump islands along the street, two pumps on each */}
      {[-1.6, 1.6].map((v) => (
        <group key={v} position={[0, 0, z(v)]}>
          <Solid>
            <mesh geometry={BOX} material={concrete} position={[0, 0.15, 0]} scale={[6, 0.3, 1.2]} castShadow />
          </Solid>
          {[-1.6, 1.6].map((x) => (
            <group key={x} position={[x, 0.3, 0]}>
              <mesh geometry={BOX} material={mats.main} position={[0, 0.85, 0]} scale={[0.7, 1.7, 0.5]} castShadow />
              <mesh geometry={BOX} material={white} position={[0, 1.8, 0]} scale={[0.75, 0.2, 0.55]} />
              <mesh geometry={BOX} material={glass} position={[0, 1.25, 0.26]} scale={[0.45, 0.3, 0.02]} />
              <mesh geometry={BOX} material={glass} position={[0, 1.25, -0.26]} scale={[0.45, 0.3, 0.02]} />
            </group>
          ))}
        </group>
      ))}
      {/* A car filling up, the pompiste at its tank */}
      <Solid>
        <Vehicle p={[0.6, 0, z(-3.4)]} kind="car" color={crew.car} seed={3} />
      </Solid>
      <group position={[-1.2, 0, z(-2.4)]} rotation={[0, s.side > 0 ? Math.PI : 0, 0]}>
        <TalkHuman id={`station:104:${Math.round((crew.seed) * 1000)}`} look={crew.look} gender="homme" pose="busy" seed={crew.seed} />
      </group>
      {/* The shop behind, its glass front to the pumps (unless a map building is there) */}
      {s.shop && (
        <group position={[0, 0, z(10)]}>
          <Solid>
            <mesh geometry={BOX} material={white} position={[0, 1.9, 0]} scale={[10, 3.8, 6]} castShadow receiveShadow />
          </Solid>
          <mesh geometry={BOX} material={mats.main} position={[0, 3.6, 0]} scale={[10.1, 0.5, 6.1]} />
          <mesh geometry={BOX} material={glass} position={[0, 1.4, z(-3.01)]} scale={[7, 2.2, 0.04]} />
          <mesh geometry={PLANE} material={mats.sign} position={[0, 3.6, z(-3.07)]} rotation={[0, s.side > 0 ? Math.PI : 0, 0]} scale={[Math.min(8, 0.5 * mats.signAspect), 0.5, 1]} />
        </group>
      )}
      {/* The price board at the roadside */}
      <group position={[6.6, 0, z(-4.8)]}>
        <mesh geometry={BOX} material={grey} position={[0, 3, 0]} scale={[0.25, 6, 0.25]} castShadow />
        <mesh geometry={BOX} material={mats.main} position={[0, 6.4, 0]} scale={[1.8, 1.4, 0.3]} castShadow />
        {[1, -1].map((f) => (
          <mesh key={f} geometry={PLANE} material={mats.price} position={[0, 5.4, f * 0.16]} rotation={[0, f > 0 ? 0 : Math.PI, 0]} scale={[Math.min(3.2, 0.45 * mats.priceAspect), 0.45, 1]} />
        ))}
        {[1, -1].map((f) => (
          <mesh key={f} geometry={PLANE} material={mats.sign} position={[0, 6.4, f * 0.16]} rotation={[0, f > 0 ? 0 : Math.PI, 0]} scale={[Math.min(1.7, 0.45 * mats.signAspect), 0.45, 1]} />
        ))}
      </group>
    </group>
  )
}
