import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { t as tr } from '../lib/i18n'

// The people watching a match with their phones up: after a dunk or a goal,
// some of them post the clip, and a little bubble rises over their head,
// « Posté sur Tikitoko ♥ 1,2 k ». A sprite each, the bubble's picture drawn
// once per number of likes and shared: cheap enough for a whole crowd.

/** How many likes a clip gets, one of these (each a picture of its own). */
export const LIKES = ['486', '913', tr('1,2 k'), tr('2,7 k'), tr('5,1 k'), tr('12 k')]
/** A stable like count for a fan (seed: any number). */
export const likesFor = (seed: number) => LIKES[Math.abs(Math.floor(seed * 7.3)) % LIKES.length]

const pictures = new Map<string, THREE.CanvasTexture>()
function picture(likes: string) {
  let t = pictures.get(likes)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = 320
  c.height = 96
  const g = c.getContext('2d')
  if (g) {
    // The bubble, dark, with its little tail.
    g.fillStyle = 'rgba(20,20,26,0.92)'
    g.beginPath()
    g.roundRect(4, 4, 312, 74, 22)
    g.fill()
    g.beginPath()
    g.moveTo(146, 76)
    g.lineTo(160, 94)
    g.lineTo(174, 76)
    g.fill()
    // The app's mark: a rounded square, pink and cyan.
    const grad = g.createLinearGradient(16, 14, 70, 68)
    grad.addColorStop(0, '#ff2d78')
    grad.addColorStop(1, '#29d8ff')
    g.fillStyle = grad
    g.beginPath()
    g.roundRect(16, 14, 54, 54, 14)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = 'bold 38px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('t', 43, 43)
    g.textAlign = 'left'
    g.font = 'bold 25px sans-serif'
    g.fillText(tr('Posté sur Tikitoko'), 84, 30)
    // The heart, drawn (no emoji font needed), and the likes.
    g.fillStyle = '#ff3d71'
    g.beginPath()
    const [hx, hy] = [96, 58]
    g.moveTo(hx, hy + 9)
    g.bezierCurveTo(hx - 16, hy - 2, hx - 8, hy - 14, hx, hy - 5)
    g.bezierCurveTo(hx + 8, hy - 14, hx + 16, hy - 2, hx, hy + 9)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = 'bold 26px sans-serif'
    g.fillText(likes, 116, 60)
  }
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  pictures.set(likes, t)
  return t
}

/** The bubble shows this long (s), rising a little, then fades. */
const SHOWN = 3.4

/**
 * The bubble over one fan's head. `since`: seconds since the clip was
 * posted, or null (nothing posted): read every frame, so the scene's own
 * clock drives it without React.
 */
export function PostedBubble({ since, likes, height = 2.3 }: { since: () => number | null; likes: string; height?: number }) {
  const sprite = useRef<THREE.Sprite>(null)
  const material = useMemo(() => new THREE.SpriteMaterial({ map: picture(likes), transparent: true, depthWrite: false, toneMapped: false }), [likes])
  const at = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const sp = sprite.current
    if (!sp) return
    const s = since()
    const on = s !== null && s >= 0 && s < SHOWN
    sp.visible = on
    if (!on || s === null) return
    sp.position.y = height + s * 0.12
    // Readable from across the ground: a little bigger the further off it is (up to a point).
    const far = Math.min(2.6, Math.max(1, sp.getWorldPosition(at).distanceTo(camera.position) / 9))
    const pop = (0.6 + 0.4 * Math.min(1, s / 0.18)) * far
    sp.scale.set(1.25 * pop, 0.375 * pop, 1)
    material.opacity = Math.min(1, (SHOWN - s) / 0.5)
  })
  return <sprite ref={sprite} material={material} visible={false} renderOrder={5} />
}
