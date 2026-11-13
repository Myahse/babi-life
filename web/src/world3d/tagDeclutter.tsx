import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { underHud } from './hudClear'

// The names floating over the street (the Sim's own, the other players', the people in office at the
// Présidence, the places' signs) are drawn over the 3D view, each on its own: two people side by side
// gave two tags piled into one unreadable smear, and a sign half out of the screen read as a cut-off button.
// One sweep, a few times a second (the view isn't redrawn while nothing moves), keeps the Sim's own tag,
// then the nearest ones, and fades out any tag that would sit on one already kept, that hangs off the
// screen's side or that lies under the HUD's buttons and cards. People come before places.

export type TagRank = 'own' | 'person' | 'place'
type Entry = { box: RefObject<HTMLElement | null>; at: RefObject<THREE.Object3D | null>; rank: TagRank; camera: () => THREE.Camera; hidden: boolean }

const entries = new Set<Entry>()
let timer = 0
const v = new THREE.Vector3()
// Places rank after every person, nearest first among themselves.
const PLACE_AFTER = 1e6
const kept: DOMRect[] = []
const list: { e: Entry; r: DOMRect; w: number }[] = []

const overlap = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > -2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > -1

function sweep() {
  if (document.visibilityState !== 'visible') return
  const width = window.innerWidth
  list.length = 0
  for (const e of entries) {
    const box = e.box.current
    const at = e.at.current
    if (!box || !at) continue
    const r = box.getBoundingClientRect()
    // (Nothing on screen: behind the camera, drei hides it.)
    if (r.width === 0 || r.height === 0) continue
    at.getWorldPosition(v)
    const d = v.distanceTo(e.camera().position)
    list.push({ e, r, w: e.rank === 'own' ? -1 : e.rank === 'person' ? d : d + PLACE_AFTER })
  }
  list.sort((a, b) => a.w - b.w)
  kept.length = 0
  for (const { e, r } of list) {
    // (The Sim's own tag is never hidden by another one, only by the HUD it would sit on, with the camera close.)
    const cut = Math.max(0, -r.left) + Math.max(0, r.right - width)
    const hide = underHud(r) || (e.rank !== 'own' && (cut > r.width * 0.15 || kept.some((q) => overlap(q, r))))
    if (!hide) kept.push(r)
    if (hide !== e.hidden) {
      e.hidden = hide
      const box = e.box.current!
      box.style.opacity = hide ? '0' : ''
      box.style.pointerEvents = hide ? 'none' : ''
    }
  }
  list.length = 0
}

/** drei's wrapper around a tag lets taps through (it caught those meant for the HUD or the street under it, even
 * with the tag faded out); the tag's own box takes them (`pointer-events-auto`), unless faded out. */
export const WRAP = { pointerEvents: 'none' } as const

/** Puts a floating tag (its box on screen, the 3D object it hangs from) in the sweep while mounted. */
export function useDeclutter(box: RefObject<HTMLElement | null>, at: RefObject<THREE.Object3D | null>, rank: TagRank) {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const e: Entry = { box, at, rank, camera: () => get().camera, hidden: false }
    entries.add(e)
    if (!timer) timer = window.setInterval(sweep, 200)
    return () => {
      entries.delete(e)
      if (!entries.size) {
        clearInterval(timer)
        timer = 0
      }
    }
  }, [box, at, rank, get])
}

/** A floating button that must stay usable (the street's offers: « Saluer · Awa »): slid back inside the screen
 * when the person it hangs over is near its side, instead of half cut off by the edge. */
export function useKeepOnScreen(box: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let dx = 0
    const t = setInterval(() => {
      const el = box.current
      if (!el || document.visibilityState !== 'visible') return
      const r = el.getBoundingClientRect()
      if (!r.width) return
      const left = r.left - dx
      const right = r.right - dx
      const w = window.innerWidth
      const want = left < 8 ? Math.min(8 - left, w - 8 - right) : right > w - 8 ? Math.max(w - 8 - right, 8 - left) : 0
      if (Math.abs(want - dx) < 1) return
      dx = want
      el.style.translate = dx ? `${Math.round(dx)}px 0` : ''
    }, 200)
    return () => clearInterval(t)
  }, [box])
}

/** A name over someone or something, in the sweep: drei's <Html>, centred, at `position` in its parent's frame. */
export function Tag({ position, rank, zIndexRange, children }: { position: [number, number, number]; rank: TagRank; zIndexRange?: [number, number]; children: ReactNode }) {
  const at = useRef<THREE.Group>(null)
  const box = useRef<HTMLDivElement>(null)
  useDeclutter(box, at, rank)
  return (
    <group ref={at} position={position}>
      <Html center zIndexRange={zIndexRange} style={WRAP}>
        {/* (The Sim's own name lets taps through to the street; the others can be tapped.) */}
        <div ref={box} className={`transition-opacity duration-200 ${rank === 'own' ? '' : 'pointer-events-auto'}`}>
          {children}
        </div>
      </Html>
    </group>
  )
}
