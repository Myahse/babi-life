import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Needs } from '../lib/types'

// A need running out shows on the perso itself (the player's Sim, in the
// street and at home): dirty, flies buzz round its head; hungry, it walks
// all wobbly; worn out, « Zzz » float up; lonely, a little rain cloud over
// it; bored, a sigh bubble; hungry, « J'ai faim » over it too. Under LOW, the worst two at once.

const LOW = 25
/** Head height by stage (the body scaled as game/life.go Stages). */
const TOP: Record<string, number> = { bebe: 0.95, enfant: 1.3, ado: 1.8, adulte: 1.95 }

type Low = 'hygiene' | 'hunger' | 'energy' | 'social' | 'fun'

export function lowNeeds(needs: Needs | undefined): Low[] {
  if (!needs) return []
  return (['hygiene', 'hunger', 'energy', 'social', 'fun'] as Low[])
    .filter((k) => needs[k] < LOW)
    .sort((a, b) => needs[a] - needs[b])
    .slice(0, 2)
}

export function NeedsAura({ needs, stage = 'adulte', walking, children }: { needs: Needs | undefined; stage?: string; walking?: boolean; children: ReactNode }) {
  const low = lowNeeds(needs)
  const top = TOP[stage] ?? 1.95
  const body = useRef<THREE.Group>(null)
  const hungry = low.includes('hunger')
  // Hungry: the walk goes wobbly, the body swaying side to side and dipping; standing, a slow sway.
  useFrame(({ clock }) => {
    const g = body.current
    if (!g) return
    const t = clock.elapsedTime
    if (hungry) {
      g.rotation.z = Math.sin(t * (walking ? 7 : 2.2)) * (walking ? 0.16 : 0.06)
      g.position.y = walking ? -Math.abs(Math.sin(t * 7)) * 0.05 : 0
    } else if (g.rotation.z !== 0) {
      g.rotation.z = 0
      g.position.y = 0
    }
  })
  return (
    <>
      <group ref={body}>{children}</group>
      {low.includes('hygiene') && <Flies top={top} />}
      {low.includes('social') && <RainCloud top={top} />}
      {low.includes('energy') ? <Word top={top} text="Zzz" color="#3ba7ff" rise /> : low.includes('fun') ? <Word top={top} text="Pff…" color="#161a2b" bubble /> : hungry ? <Word top={top} text="J'ai faim" color="#e05a00" bubble /> : null}
    </>
  )
}

/** A word over the head, drawn on a sprite (no page element in the 3D: nothing to come undone): « Zzz » rising and fading, or a bubble bobbing. */
function Word({ top, text, color, rise, bubble }: { top: number; text: string; color: string; rise?: boolean; bubble?: boolean }) {
  const map = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')!
    if (bubble) {
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.roundRect(28, 22, 200, 84, 40)
      g.fill()
    }
    g.font = '900 64px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 10
    g.strokeStyle = '#ffffff'
    if (!bubble) g.strokeText(text, 128, 66)
    g.fillStyle = color
    g.fillText(text, 128, 66)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [text, color, bubble])
  const sprite = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    const sp = sprite.current
    if (!sp) return
    const t = clock.elapsedTime
    if (rise) {
      const k = (t * 0.5) % 1
      sp.position.set(0.1 + k * 0.2, top + 0.25 + k * 0.35, 0)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.min(1, k * 4) * (1 - k)
    } else sp.position.set(0, top + 0.38 + Math.sin(t * 4) * 0.03, 0)
  })
  return (
    <sprite ref={sprite} scale={[0.5, 0.25, 1]}>
      <spriteMaterial map={map} transparent depthWrite={false} />
    </sprite>
  )
}

const FLY = new THREE.MeshBasicMaterial({ color: '#141416' })
const WING = new THREE.MeshBasicMaterial({ color: '#d7e3ea', transparent: true, opacity: 0.7 })

/** Dirty: four flies circling round the head, each its own way. */
function Flies({ top }: { top: number }) {
  const flies = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = flies.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((f, i) => {
      const a = t * (2.4 + i * 0.6) + i * 1.7
      const r = 0.32 + 0.08 * Math.sin(t * 3 + i)
      f.position.set(Math.cos(a) * r, top - 0.15 + Math.sin(t * 5 + i * 2) * 0.12, Math.sin(a) * r)
      f.rotation.y = -a
    })
  })
  return (
    <group ref={flies}>
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <mesh material={FLY}>
            <boxGeometry args={[0.035, 0.03, 0.05]} />
          </mesh>
          <mesh material={WING} position={[0, 0.02, 0]}>
            <boxGeometry args={[0.07, 0.006, 0.025]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const CLOUD = new THREE.MeshLambertMaterial({ color: '#8a929c' })
const DROP = new THREE.MeshBasicMaterial({ color: '#5aa9e6' })

/** Lonely: a small grey cloud over the head, a few drops falling. */
function RainCloud({ top }: { top: number }) {
  const drops = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = drops.current
    if (!g) return
    g.children.forEach((d, i) => {
      const k = (clock.elapsedTime * 0.9 + i * 0.33) % 1
      d.position.y = top + 0.5 - k * 0.45
      ;(d as THREE.Mesh).visible = k < 0.9
    })
  })
  return (
    <group>
      {[[-0.12, 0], [0.04, 0.03], [0.16, -0.01]].map(([x, z], i) => (
        <mesh key={i} material={CLOUD} position={[x, top + 0.62 + (i === 1 ? 0.06 : 0), z]}>
          <boxGeometry args={[0.2, 0.14, 0.18]} />
        </mesh>
      ))}
      <group ref={drops}>
        {[-0.12, 0, 0.12].map((x) => (
          <mesh key={x} material={DROP} position={[x, top + 0.5, 0]}>
            <boxGeometry args={[0.02, 0.06, 0.02]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
