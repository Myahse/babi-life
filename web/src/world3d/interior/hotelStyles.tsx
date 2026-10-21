import { useMemo } from 'react'
import * as THREE from 'three'
import { rng } from '../themes'
import { Airliner } from '../open/airport'
import { mat } from './bigPlace'

// What makes each hotel's floors its own (HotelFloors.tsx), after the hotels
// they stand for, as their halls do (HotelInside, IvoireInside): the
// Plateau's lagoon-side hotel in wood panels; the black-and-gold tower with
// its gold light and the city below; the Hôtel Ivoire's kente-striped
// corridors, brass lamps and balconies over the bay; Marcory's open gallery
// over its garden, banco walls and woven headboards; the airport's blue
// lights and the runway under the window.

export type Style = 'boiserie' | 'noir' | 'grand' | 'banco' | 'aero' | 'simple'
export type View = 'lagune' | 'ville' | 'baie' | 'jardin' | 'piste'
export type Look = { wall: string; carpet: string; wood: string; fabric: string; accent: string; sky: string; style: Style; view: View }

export const LOOKS: Record<string, Look> = {
  'plateau-poulman': { wall: '#e9e6e1', carpet: '#2e4a52', wood: '#9a7652', fabric: '#1f6f78', accent: '#c9a227', sky: '#8fc3e8', style: 'boiserie', view: 'lagune' },
  'plateau-noum': { wall: '#2b2a2e', carpet: '#1d1b20', wood: '#3a2a1c', fabric: '#7a1f2b', accent: '#d4af37', sky: '#7fb0de', style: 'noir', view: 'ville' },
  'cocody-hotel-ivoire': { wall: '#f3eee4', carpet: '#8a4a1f', wood: '#6b4a2a', fabric: '#b5432c', accent: '#d9b25a', sky: '#9ccbea', style: 'grand', view: 'baie' },
  'marcory-azale': { wall: '#e8cfae', carpet: '#b5603a', wood: '#7a4a28', fabric: '#c2552e', accent: '#2f7a4a', sky: '#9ccbea', style: 'banco', view: 'jardin' },
  'pb-rabisson': { wall: '#f2f4f7', carpet: '#1c3a6b', wood: '#5b6b7d', fabric: '#1c4fa0', accent: '#3ab0ff', sky: '#a9d0f2', style: 'aero', view: 'piste' },
}
export const PLAIN: Look = { wall: '#efe9df', carpet: '#3a4a6b', wood: '#7a5233', fabric: '#2c4a6b', accent: '#c9a227', sky: '#9ccbea', style: 'simple', view: 'ville' }

/** A woven cloth (the headboards of Marcory's rooms): squares of the pagne's colours. */
function woven(colors: string[], seed: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = rng(seed)
  for (let y = 0; y < 64; y += 8)
    for (let x = 0; x < 64; x += 8) {
      g.fillStyle = colors[Math.floor(r() * colors.length)]
      g.fillRect(x, y, 8, 8)
    }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t })
}

/* ---------- The corridor ---------- */

/** The corridor's own: z from -cw (the far wall) to cw (the near, cut low); x from 0 (the lifts) to len. */
export function CorridorDecor({ look, len, cw, night }: { look: Look; len: number; cw: number; night: boolean }) {
  const n = Math.floor(len / 2.2)
  switch (look.style) {
    case 'boiserie':
      // Wood panels up to the waist, framed prints between the doors, a border round the carpet.
      return (
        <group>
          <mesh position={[len / 2, 0.55, -cw + 0.02]} material={mat(look.wood)}>
            <boxGeometry args={[len, 1.1, 0.04]} />
          </mesh>
          <mesh position={[len / 2, 1.12, -cw + 0.04]} material={mat(look.accent)}>
            <boxGeometry args={[len, 0.05, 0.04]} />
          </mesh>
          {[...Array(Math.floor(len / 4.4))].map((_, i) => (
            <mesh key={i} position={[2.8 + i * 4.4, 1.75, -cw + 0.04]} material={mat(['#1f6f78', '#c9a227', '#7a3a22'][i % 3])}>
              <boxGeometry args={[0.9, 0.6, 0.03]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[len / 2, 0.012, s * (cw - 0.2)]}>
              <planeGeometry args={[len, 0.12]} />
              <meshLambertMaterial color={look.accent} />
            </mesh>
          ))}
        </group>
      )
    case 'noir':
      // A black floor of big tiles, gold light running along the floor and the ceiling line.
      return (
        <group>
          {[...Array(n)].map((_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[1.1 + i * 2.2, 0.011, 0]}>
              <planeGeometry args={[2.1, cw * 2 - 0.1]} />
              <meshLambertMaterial color={i % 2 ? '#141217' : '#232027'} />
            </mesh>
          ))}
          {[0.06, 2.85].map((y) => (
            <mesh key={y} position={[len / 2, y, -cw + 0.04]} material={mat('#d4af37', night ? '#d4af37' : '#7a5a10')}>
              <boxGeometry args={[len, 0.05, 0.03]} />
            </mesh>
          ))}
          <mesh position={[len / 2, 0.06, cw - 0.04]} material={mat('#d4af37', night ? '#d4af37' : '#7a5a10')}>
            <boxGeometry args={[len, 0.05, 0.03]} />
          </mesh>
        </group>
      )
    case 'grand':
      // The carpet striped across like a kente cloth; brass globes on the walls.
      return (
        <group>
          {[...Array(Math.floor(len / 1.1))].map((_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0.55 + i * 1.1, 0.012, 0]}>
              <planeGeometry args={[0.32, cw * 2 - 0.3]} />
              <meshLambertMaterial color={['#e0a12a', '#2f7a4a', '#b5432c', '#1b1b1f'][i % 4]} />
            </mesh>
          ))}
          {[...Array(Math.floor(len / 4.4))].map((_, i) => (
            <group key={i} position={[2.8 + i * 4.4, 1.9, -cw + 0.12]}>
              <mesh material={mat('#b8862b')}>
                <boxGeometry args={[0.08, 0.3, 0.08]} />
              </mesh>
              <mesh position={[0, 0.25, 0.05]} material={mat('#fff3d0', '#ffe2a0')}>
                <sphereGeometry args={[0.16, 12, 8]} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'banco':
      // An open gallery: the far side's wall is a low parapet between pillars, the garden below with its palms.
      return (
        <group>
          <mesh position={[len / 2, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[len, cw * 2]} />
            <meshLambertMaterial color="#c9774a" />
          </mesh>
          {[...Array(n)].map((_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[1.1 + i * 2.2, 0.012, 0]}>
              <planeGeometry args={[1, cw * 2 - 0.2]} />
              <meshLambertMaterial color={i % 2 ? '#b5603a' : '#c9774a'} />
            </mesh>
          ))}
          {[...Array(Math.floor(len / 3) + 1)].map((_, i) => (
            <mesh key={i} position={[i * 3, 1.5, -cw - 0.4]} material={mat('#e8cfae')}>
              <boxGeometry args={[0.35, 3, 0.35]} />
            </mesh>
          ))}
          <mesh position={[len / 2, 0.5, -cw - 0.4]} material={mat('#d9b98e')}>
            <boxGeometry args={[len, 1, 0.25]} />
          </mesh>
          {/* The garden down there */}
          <mesh position={[len / 2, -10, -cw - 14]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[len + 40, 26]} />
            <meshLambertMaterial color="#5f9a46" />
          </mesh>
          {[...Array(6)].map((_, i) => (
            <group key={i} position={[i * (len / 5), -10, -cw - 8 - (i % 3) * 5]}>
              <mesh position={[0, 3, 0]} material={mat('#7a5a3a')}>
                <cylinderGeometry args={[0.18, 0.25, 6, 6]} />
              </mesh>
              <mesh position={[0, 6.2, 0]} material={mat('#2f7a3a')}>
                <coneGeometry args={[2.2, 1.4, 7]} />
              </mesh>
            </group>
          ))}
          {/* The banco wall on the rooms' side, its painted bands */}
          <mesh position={[len / 2, 0.4, cw - 0.02]} material={mat('#7a3a22')}>
            <boxGeometry args={[len, 0.12, 0.02]} />
          </mesh>
        </group>
      )
    case 'aero':
      // Blue light along the walls, the carpet marked like a runway.
      return (
        <group>
          {[-cw + 0.04, cw - 0.04].map((z) => (
            <mesh key={z} position={[len / 2, 0.08, z]} material={mat('#3ab0ff', '#3ab0ff')}>
              <boxGeometry args={[len, 0.04, 0.02]} />
            </mesh>
          ))}
          {[...Array(Math.floor(len / 2))].map((_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[1 + i * 2, 0.012, 0]}>
              <planeGeometry args={[0.9, 0.12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      )
  }
  return null
}

/* ---------- The view from a room ---------- */

/** What's beyond the window: high up (the room is on a floor), the city, the lagoon, the garden, the runway. */
function Beyond({ view, night, hd }: { view: View; night: boolean; hd: number }) {
  const towers = useMemo(() => {
    const r = rng(`vue${view}`)
    return [...Array(view === 'ville' ? 26 : 10)].map(() => ({ x: (r() - 0.5) * 140, z: -hd - 40 - r() * 90, h: 20 + r() * 60, w: 6 + r() * 10 }))
  }, [view, hd])
  const lit = night ? '#ffd27a' : undefined
  const down = -24
  return (
    <group>
      {(view === 'lagune' || view === 'baie') && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, down, -hd - 90]}>
            <planeGeometry args={[400, 160]} />
            <meshLambertMaterial color={night ? '#16304f' : '#3f86b8'} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, down + 0.1, -hd - 172]}>
            <planeGeometry args={[400, 20]} />
            <meshLambertMaterial color="#4f8a46" />
          </mesh>
          {/* Across the water: the Plateau's towers (from the Ivoire), Cocody's shore (from the Plateau) */}
          {towers.map((t, i) => (
            <mesh key={i} position={[t.x, down + t.h / 2, -hd - 175 - (i % 3) * 6]} material={mat(i % 2 ? '#c9ced6' : '#9aa3ad', lit)}>
              <boxGeometry args={[t.w, view === 'baie' ? t.h * 1.4 : t.h * 0.5, t.w]} />
            </mesh>
          ))}
        </>
      )}
      {view === 'ville' &&
        // The towers of the Plateau all round, far below the 20th floor; lit at night.
        towers.map((t, i) => (
          <mesh key={i} position={[t.x, down * 2 + t.h / 2, t.z]} material={mat(['#3a3f4a', '#59606d', '#7d8794'][i % 3], night && i % 2 ? '#ffd27a' : undefined)}>
            <boxGeometry args={[t.w, t.h, t.w]} />
          </mesh>
        ))}
      {view === 'jardin' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, -hd - 30]}>
            <planeGeometry args={[160, 60]} />
            <meshLambertMaterial color="#5f9a46" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3, -7.95, -hd - 22]}>
            <planeGeometry args={[14, 6]} />
            <meshLambertMaterial color="#38bdf8" />
          </mesh>
          {[...Array(7)].map((_, i) => (
            <group key={i} position={[-24 + i * 8, -8, -hd - 14 - (i % 3) * 9]}>
              <mesh position={[0, 3.5, 0]} material={mat('#7a5a3a')}>
                <cylinderGeometry args={[0.2, 0.3, 7, 6]} />
              </mesh>
              <mesh position={[0, 7.4, 0]} material={mat('#2f7a3a')}>
                <coneGeometry args={[2.6, 1.6, 7]} />
              </mesh>
            </group>
          ))}
        </>
      )}
      {view === 'piste' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, down, -hd - 60]}>
            <planeGeometry args={[400, 120]} />
            <meshLambertMaterial color="#9a9a86" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, down + 0.05, -hd - 60]}>
            <planeGeometry args={[400, 18]} />
            <meshLambertMaterial color="#3a3d42" />
          </mesh>
          {[...Array(16)].map((_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-150 + i * 20, down + 0.1, -hd - 60]}>
              <planeGeometry args={[8, 0.8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
          <group position={[10, down + 2, -hd - 60]} rotation={[0, Math.PI / 2, 0]} scale={0.6}>
            <Airliner />
          </group>
        </>
      )}
    </group>
  )
}

/** The room's back wall with its window (an opening, the view beyond); Ivoire's rooms have a balcony. */
export function WindowWall({ look, night, hw, hd }: { look: Look; night: boolean; hw: number; hd: number }) {
  const ww = hw * 1.5
  const [lo, hi] = [0.6, 2.6]
  const wall = mat(look.wall)
  return (
    <group>
      <mesh position={[-(hw + ww / 2) / 2, 1.5, -hd]} material={wall}>
        <boxGeometry args={[hw - ww / 2, 3, 0.15]} />
      </mesh>
      <mesh position={[(hw + ww / 2) / 2, 1.5, -hd]} material={wall}>
        <boxGeometry args={[hw - ww / 2, 3, 0.15]} />
      </mesh>
      <mesh position={[0, lo / 2, -hd]} material={wall}>
        <boxGeometry args={[ww, lo, 0.15]} />
      </mesh>
      <mesh position={[0, (3 + hi) / 2, -hd]} material={wall}>
        <boxGeometry args={[ww, 3 - hi, 0.15]} />
      </mesh>
      {/* The glass, the frame's middle bar */}
      <mesh position={[0, (lo + hi) / 2, -hd]}>
        <planeGeometry args={[ww, hi - lo]} />
        <meshLambertMaterial color="#cfe8f2" transparent opacity={0.15} />
      </mesh>
      <mesh position={[0, (lo + hi) / 2, -hd]} material={mat(look.style === 'noir' ? '#d4af37' : '#d9dde2')}>
        <boxGeometry args={[0.06, hi - lo, 0.17]} />
      </mesh>
      {look.view === 'baie' && (
        // The balcony out over the bay, its railing
        <group position={[0, 0, -hd - 1]}>
          <mesh position={[0, -0.05, 0]} material={mat('#e7e0d2')}>
            <boxGeometry args={[ww + 0.6, 0.1, 2]} />
          </mesh>
          <mesh position={[0, 0.55, -0.95]} material={mat('#b8862b')}>
            <boxGeometry args={[ww + 0.6, 0.06, 0.06]} />
          </mesh>
          {[...Array(9)].map((_, i) => (
            <mesh key={i} position={[-ww / 2 + (i * ww) / 8, 0.28, -0.95]} material={mat('#b8862b')}>
              <boxGeometry args={[0.04, 0.55, 0.04]} />
            </mesh>
          ))}
        </group>
      )}
      <Beyond view={look.view} night={night} hd={hd} />
    </group>
  )
}

/* ---------- The room's own things ---------- */

/** What each hotel puts in its rooms besides the bed, the desk and the bathroom (HotelFloors' GuestRoom). */
export function RoomDecor({ look, hw, hd, night }: { look: Look; hw: number; hd: number; night: boolean }) {
  const pagne = useMemo(() => (look.style === 'banco' ? woven(['#c2552e', '#f2c94c', '#1f6f78', '#2b1d14', '#e8d6a8'], 'azale') : null), [look.style])
  const bedX = hw - 1.6
  const bedZ = -hd + 1.4
  switch (look.style) {
    case 'boiserie':
      // Wood slats on the wall behind the bed, an armchair by the window.
      return (
        <group>
          {[...Array(9)].map((_, i) => (
            <mesh key={i} position={[hw - 0.12, 1.4, bedZ - 1.6 + i * 0.4]} material={mat(i % 2 ? look.wood : '#7a5a3c')}>
              <boxGeometry args={[0.06, 2.8, 0.3]} />
            </mesh>
          ))}
          <mesh position={[-hw + 3.4, 0.3, -hd + 0.9]} material={mat(look.fabric)}>
            <boxGeometry args={[0.8, 0.6, 0.8]} />
          </mesh>
        </group>
      )
    case 'noir':
      // Black marble underfoot, the bed's gold frame, a velvet bench at its foot, a tall mirror.
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <planeGeometry args={[hw * 2 - 0.2, hd * 2 - 0.2]} />
            <meshLambertMaterial color="#1d1b20" />
          </mesh>
          <mesh position={[bedX, 0.66, bedZ]} material={mat('#d4af37')}>
            <boxGeometry args={[2.5, 0.04, 2.3]} />
          </mesh>
          <mesh position={[bedX - 1.6, 0.25, bedZ]} material={mat('#7a1f2b')}>
            <boxGeometry args={[0.5, 0.5, 1.8]} />
          </mesh>
          <mesh position={[-hw + 0.1, 1.3, 0]} material={mat('#c9d6e0', night ? undefined : '#2a3440')}>
            <boxGeometry args={[0.04, 2, 0.9]} />
          </mesh>
        </group>
      )
    case 'grand':
      // The bedspread striped, two round lamps, the writing desk's brass lamp.
      return (
        <group>
          {[...Array(5)].map((_, i) => (
            <mesh key={i} position={[bedX - 0.9 + i * 0.45, 0.69, bedZ]} material={mat(['#e0a12a', '#2f7a4a', '#b5432c', '#1b1b1f', '#e0a12a'][i])}>
              <boxGeometry args={[0.2, 0.04, 2.24]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[hw - 0.6, 1, bedZ + s * 1.6]} material={mat('#fff3d0', '#ffe2a0')}>
              <sphereGeometry args={[0.2, 12, 8]} />
            </mesh>
          ))}
          <mesh position={[-hw + 2.2, 1, -hd + 0.5]} material={mat('#b8862b')}>
            <cylinderGeometry args={[0.05, 0.08, 0.5, 8]} />
          </mesh>
        </group>
      )
    case 'banco':
      // The headboard woven like a pagne, clay jars, a potted palm.
      return (
        <group>
          {pagne && (
            <mesh position={[hw - 0.42, 2.4, bedZ]} rotation={[0, -Math.PI / 2, 0]} material={pagne}>
              <planeGeometry args={[2.6, 0.9]} />
            </mesh>
          )}
          {[0, 1].map((i) => (
            <mesh key={i} position={[-hw + 0.5 + i * 0.6, 0.3, -hd + 2.6]} material={mat('#a0522d')}>
              <sphereGeometry args={[0.28, 10, 8]} />
            </mesh>
          ))}
          <group position={[hw - 0.6, 0, hd - 0.7]}>
            <mesh position={[0, 0.25, 0]} material={mat('#8a4a24')}>
              <cylinderGeometry args={[0.3, 0.25, 0.5, 8]} />
            </mesh>
            <mesh position={[0, 1.1, 0]} material={mat('#2f7a3a')}>
              <coneGeometry args={[0.6, 1.4, 6]} />
            </mesh>
          </group>
        </group>
      )
    case 'aero':
      // Blue light under the bed, the luggage rack and its suitcase.
      return (
        <group>
          <mesh position={[bedX, 0.03, bedZ]} material={mat('#3ab0ff', '#3ab0ff')}>
            <boxGeometry args={[2.5, 0.03, 2.3]} />
          </mesh>
          <mesh position={[-hw + 2.8, 0.25, hd - 0.6]} material={mat('#5b6b7d')}>
            <boxGeometry args={[1, 0.5, 0.5]} />
          </mesh>
          <mesh position={[-hw + 2.8, 0.75, hd - 0.6]} material={mat('#c62828')}>
            <boxGeometry args={[0.8, 0.5, 0.3]} />
          </mesh>
        </group>
      )
  }
  return null
}
