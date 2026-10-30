import { useMemo, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Check, Hammer, Move, PartyPopper, Pickaxe, RotateCcw, RotateCw, X } from 'lucide-react'
import type { Piece, SoireeRoom } from '../lib/types'
import { keyOpen, useFeatures } from '../lib/features'
import { FurnitureSet } from '../world3d/build/Furniture'
import { ROOM, Shell } from '../world3d/interior/Shell'
import { useRoomStyle } from '../world3d/interior/Decor'
import { ClubDecor } from '../world3d/clubDecor'
import { room as roomOf } from '../world3d/Interior'
import { misfit } from '../game/soirees'
import { FurnitureTile } from './BuildMode'
import { t } from '../lib/i18n'

// Arranging a soirée's room (« soiree-deco », backend game/soiree.go), as
// one furnishes one's house (BuildMode): the club room the guests come into,
// its stage and its dance floor kept clear, and on the rest of its floor the
// host puts the bar counter, the sound, the DJ's decks, the lights, the
// tables, chairs and sofas, the plants and the rugs; « Tourner » turns a
// piece a quarter, « Déplacer » picks one up to put it elsewhere, « Enlever »
// takes it away. The pieces are hired with the soirée: nothing to pay, only
// so many. Done, the room is sent whole (checked again by the server).

type Cell = [number, number]

export default function SoireeDeco({ room, layout: from, host, onSave, onClose }: { room: SoireeRoom; layout: Piece[]; /** The host's name, on the LED wall. */ host: string; /** The room as arranged (a soirée going on: saved; before it starts: kept for it). False: it stays open. */ onSave: (layout: Piece[]) => Promise<boolean> | boolean; onClose: () => void }) {
  const feats = useFeatures()
  const shop = room.furniture.filter((f) => !f.key || keyOpen(feats, f.key))
  const [pieces, setPieces] = useState<Piece[]>(from)
  const [mode, setMode] = useState<'place' | 'remove' | 'move'>('place')
  const [pick, setPick] = useState(shop[0]?.id ?? 'comptoir')
  const [rot, setRot] = useState(0)
  const [carry, setCarry] = useState<Piece | null>(null)
  const [hover, setHover] = useState<Cell | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const plain = useMemo(() => roomOf('club', 'appart'), [])
  const style = useRoomStyle('club', 'appart')
  const piece = room.furniture.find((f) => f.id === (carry ? carry[4] : pick))
  const cellAt = (e: ThreeEvent<PointerEvent | MouseEvent>): Cell => [Math.floor(e.point.x + room.w / 2), Math.floor(e.point.z + room.d / 2)]

  const put = (c: Cell) => {
    if (!piece) return
    const p: Piece = [c[0], 0, c[1], rot, piece.id]
    const why = misfit(room, pieces, p)
    if (why) return setError(why)
    if (!carry && pieces.length >= room.max) return setError(t("Pas plus de {max} meubles dans la salle : enlèves-en un d'abord.", { max: room.max }))
    setPieces([...pieces, p])
    setCarry(null)
    setError(null)
  }
  const onFloor = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || mode === 'remove' || (mode === 'move' && !carry)) return
    e.stopPropagation()
    put(cellAt(e))
  }
  const onPiece = (p: Piece, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    e.stopPropagation()
    if (mode === 'remove') return (setPieces(pieces.filter((x) => x !== p)), setError(null))
    if (mode === 'move' && !carry) return (setCarry(p), setRot(p[3]), setPieces(pieces.filter((x) => x !== p)), setError(null))
  }
  // A piece picked up and not put down: back where it was.
  const putBack = () => {
    if (!carry) return
    setPieces((ps) => [...ps, carry])
    setCarry(null)
  }
  const placing = mode === 'place' || (mode === 'move' && !!carry)
  const ghost: Piece | null = hover && placing && piece ? [hover[0], 0, hover[1], rot, piece.id] : null
  const ghostBad = ghost ? !!misfit(room, pieces, ghost) : false

  const save = async () => {
    putBack()
    setBusy(true)
    try {
      if (await onSave(carry ? [...pieces, carry] : pieces)) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-40 bg-[#0b0d1f]">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [4.5, 16, 14.5], fov: 42 }} onPointerMissed={() => setHover(null)}>
        <hemisphereLight args={['#9a8ad0', '#3a2a1a', 0.9]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 10, 6]} intensity={1.1} />
        <pointLight position={[0, 2.9, 0]} intensity={14} distance={14} color="#b18cff" />
        <Shell floor={plain.floor} floorType={style.floorType} wall={plain.wall} lower={style.lower} openings={style.openings} night dark lamps={style.lamps} fan={style.fan} />
        <ClubDecor placeId={`soiree-deco-${host}`} fill={0} name={`CHEZ ${host.toUpperCase()}`} bare empty />
        {/* The dance floor, and what stays clear: tinted */}
        <mesh position={[1.5, 0.02, 0.5]} scale={[5, 0.04, 4]}>
          <boxGeometry />
          <meshLambertMaterial color="#3d2b6b" />
        </mesh>
        {room.kept.map((k) => (
          <mesh key={`${k.x0},${k.z0}`} rotation={[-Math.PI / 2, 0, 0]} position={[(k.x0 + k.x1) / 2 - room.w / 2, 0.05, (k.z0 + k.z1) / 2 - room.d / 2]} raycast={() => null}>
            <planeGeometry args={[k.x1 - k.x0, k.z1 - k.z0]} />
            <meshBasicMaterial color="#ff2d95" transparent opacity={0.16} depthWrite={false} />
          </mesh>
        ))}
        {/* The floor to tap, a grid of one-metre cells */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} onClick={onFloor} onPointerMove={(e) => (e.stopPropagation(), setHover(placing ? cellAt(e) : null))}>
          <planeGeometry args={[ROOM.W, ROOM.D]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <gridHelper args={[ROOM.W, ROOM.W, '#6f5fb0', '#4a3f80']} position={[0, 0.055, 0]} scale={[1, 1, room.d / room.w]} />
        <group position={[-room.w / 2, 0, -room.d / 2]}>
          <FurnitureSet pieces={pieces} catalog={room.furniture} onPiece={onPiece} />
          {ghost && <FurnitureSet pieces={[ghost]} catalog={room.furniture} ghost />}
          {ghost && ghostBad && (
            <mesh position={[ghost[0] + 0.5, 0.08, ghost[2] + 0.5]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color="#ff4d6d" transparent opacity={0.55} depthWrite={false} />
            </mesh>
          )}
        </group>
        <OrbitControls makeDefault target={[0, 0, 0.3]} enablePan={false} minDistance={7} maxDistance={28} minPolarAngle={0.2} maxPolarAngle={1.2} />
      </Canvas>

      {/* Top: the room, how many pieces, done */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex flex-col items-start gap-2">
          <div className="hud pointer-events-auto flex h-11 items-center gap-2 rounded-full px-4">
            <PartyPopper size={18} strokeWidth={2.6} className="text-[#c2187a]" />
            <span className="font-display text-lg font-extrabold whitespace-nowrap">{t('La salle')}</span>
            <span className="text-xs font-extrabold whitespace-nowrap text-[var(--color-ink-soft)]">
              {pieces.length + (carry ? 1 : 0)} / {room.max} meubles
            </span>
          </div>
          <span className="hud max-w-[min(300px,62vw)] rounded-2xl px-3 py-1.5 text-[11px] leading-snug font-bold">{t("La scène, la piste (en rose) et l'entrée restent libres. Les meubles sont loués avec la soirée : rien à payer.")}</span>
          <button className="hud pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold" onClick={() => (setPieces(room.start), setCarry(null), setError(null))}>
            <RotateCcw size={15} /> {t('Comme au début')}
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button className="btn !px-4 !py-2.5 !text-sm" disabled={busy} onClick={() => void save()}>
            <Check size={17} /> {t('Valider')}
          </button>
          <button className="icon-btn hud" onClick={onClose} aria-label={t('Fermer sans garder')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* Bottom: put, take away, move, turn; the pieces */}
      <div className="absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && (
          <p className="sheet mx-auto mb-2 w-fit max-w-full rounded-2xl px-4 py-2 text-sm font-bold text-[#d81b3f]" role="status">
            {error}
          </p>
        )}
        <div className="sheet mx-auto max-w-[720px] rounded-[24px] p-2">
          <div className="flex items-stretch gap-2">
            <div className="flex shrink-0 flex-col gap-1">
              {(
                [
                  ['place', Hammer, t('Poser')],
                  ['remove', Pickaxe, t('Enlever')],
                  ['move', Move, t('Déplacer')],
                ] as const
              ).map(([id, Icon, label]) => (
                <button key={id} onClick={() => (putBack(), setMode(id), setHover(null))} aria-pressed={mode === id} className={`flex h-11 w-[84px] items-center justify-center gap-1.5 rounded-2xl text-sm font-extrabold transition ${mode === id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)]'}`}>
                  <Icon size={16} strokeWidth={2.6} /> {label}
                </button>
              ))}
              <button onClick={() => setRot((r) => (r + 1) % 4)} className="flex h-11 w-[84px] items-center justify-center gap-1.5 rounded-2xl bg-[var(--color-canvas)] text-sm font-extrabold">
                <RotateCw size={16} strokeWidth={2.6} /> {t('Tourner')}
              </button>
            </div>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {mode === 'place' ? (
                shop.map((f) => <FurnitureTile key={f.id} f={f} hired picked={pick === f.id} onPick={() => setPick(f.id)} />)
              ) : (
                <p className="self-center px-2 text-sm font-bold text-[var(--color-ink-soft)]">
                  {mode === 'remove' ? t('Touche un meuble pour l’enlever de la salle.') : carry ? t('{0} : touche où le poser (« Tourner » pour le tourner).', { 0: piece?.label ?? t('Le meuble') }) : t('Touche un meuble pour le prendre, puis touche où le poser.')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
