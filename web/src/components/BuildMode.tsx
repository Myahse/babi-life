import { building, doneAt } from '../game/chantier'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { BedDouble, Check, Crown, Hammer, Home as HomeIcon, Lock, Move, Pickaxe, RotateCw, Search, Star, Toilet, Undo2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { kindOf, type ActionResult, type Block, type Furniture, type HousePlan, type Material, type Piece, type Plot, type Sim, type World } from '../lib/types'
import { keyOpen, useFeatures } from '../lib/features'
import { iconFor } from './icons'
import { amount } from '../game/rules'
import { Character } from '../world3d/Character'
import { House, materialTexture } from '../world3d/build/House'
import { CutHouse } from '../world3d/build/CutHouse'
import { FurnitureSet, downstairs } from '../world3d/build/Furniture'
import { Zones } from '../world3d/build/Zones'
import { LotFence, ownerColor } from '../world3d/build/Fence'
import { Aim, BuildCamera, Dust, ThumbStudio, dust, useThumb } from '../world3d/build/BuildKit'
import { holdScenes } from '../world3d/hold'
import { buildSfx } from '../lib/buildSfx'
import { LotOffers } from './Lots'
import { Coin } from './ui'
import { t, tx } from '../lib/i18n'

// Building one's own house, Minecraft-style, on the lot the Sim bought (its
// size in m² is the space to build on): tap the ground or the face of a block
// to put a block there, or switch to « Casser » to take one down (half its
// price back). Basic materials are there from the start; better ones unlock
// as the house grows. « Meubles » puts the furniture in: the piece aimed at
// shows green where it goes and red where it doesn't (and why); a finger
// drags it, turns it and puts it down. « Annuler » takes back the last
// changes (at what they cost, for two minutes: game/house.go). With a bed
// under a roof and toilets, « Emménager » moves the Sim in: no more rent.
// Edits are saved in small batches, paid from the Sim's money, and everyone
// in the commune sees the house on its lot.

/** The editor's shelves: the rooms, and the very best pieces all together. */
const SHELVES = [
  ['tout', t('Tout')],
  ['chambre', t('Chambre')],
  ['salon', t('Salon')],
  ['cuisine', t('Cuisine')],
  ['bain', t('Salle de bain')],
  ['deco', t('Déco')],
  ['prestige', t('Prestige')],
] as const
type Shelf = (typeof SHELVES)[number][0]

type Cell = [number, number, number]
const key = ([x, y, z]: Cell | Block | Piece) => `${x},${y},${z}`
const same = (a: Cell | null, b: Cell | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
/** A floor's height in blocks (three of wall and the slab over them: game/plans.go Storey). */
const STOREY = 4
/** How long a change can be taken back at what it cost (as the server: sims/plot.go regretFor). */
const UNDO_FOR = 110_000
/** Letters without their accents, for the search. */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** One change made, to take it back. */
type Change = { k: 'place' | 'remove'; b: Block } | { k: 'furnish' | 'unfurnish'; p: Piece } | { k: 'move'; from: Piece; to: Piece }
type Act = Change & { at: number }

export default function BuildMode({ world, sim, lot: wanted = 0, onResult, onClose }: { world: World; sim: Sim; /** Which of the Sim's lots (0: the one lived in, else the first). */ lot?: number; onResult: (res: ActionResult) => void; onClose: () => void }) {
  const H = world.plot?.h ?? 8
  const materials = world.materials ?? []
  const catalog = world.furniture ?? []
  const [plot, setPlot] = useState<Plot | null>(null)
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [built, setBuilt] = useState(0)
  const [tab, setTab] = useState<'plans' | 'materiaux' | 'meubles'>('materiaux')
  // « Plans »: a whole house in one go on the empty lot (game/plans.go); the one looked at is shown on the lot.
  const [preview, setPreview] = useState<HousePlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState(materials[0]?.id ?? 'banco')
  const [pickF, setPickF] = useState(catalog[0]?.id ?? 'lit')
  const [rot, setRot] = useState(0)
  const [mode, setMode] = useState<'place' | 'remove' | 'move'>('place')
  // The updates (lib/features.ts): the finer pieces, and moving a piece, once the team has opened them.
  const feats = useFeatures()
  const canMove = keyOpen(feats, 'deplacer-meubles')
  const shop = catalog.filter((f) => !f.key || keyOpen(feats, f.key))
  const [shelf, setShelf] = useState<Shelf>('tout')
  const [query, setQuery] = useState<string | null>(null)
  const shelved = query ? shop.filter((f) => plain(f.label).includes(plain(query))) : shop.filter((f) => (shelf === 'tout' ? true : shelf === 'prestige' ? f.tier === 'prestige' : f.room === shelf))
  // « Déplacer »: the piece picked up (off the floor until it's put down again).
  const [carry, setCarry] = useState<Piece | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The cell aimed at: under the mouse, or where a finger put the piece (and drags it).
  const [aim, setAim] = useState<Cell | null>(null)
  // The floor looked at (0 the ground floor), its roof and the floors above it off; null: the whole house.
  const [level, setLevel] = useState<number | null>(null)
  // The piece just put down (it lands with a bounce).
  const [fresh, setFresh] = useState('')
  // The lot being built on: the one asked for, then the one loaded (a lot just bought gets its id).
  const lotId = plot?.id || wanted
  const W = plot?.lot?.w ?? 0
  const D = plot?.lot?.d ?? 0
  const planOpened = useRef(false)
  const zones = plot?.zones ?? []
  const empty = !!blocks && !blocks.length && !pieces.length && !zones.length
  const plans = (world.lotPlans ?? []).filter((p) => p.w <= W && p.d <= D)
  /** A plan sits on the lot at the street side, in the middle (game/plans.go BuildPlan). */
  const planAt = (p: HousePlan): [number, number] => [Math.floor((W - p.w) / 2), D - p.d]
  const buildPlan = async (p: HousePlan) => {
    setBusy(true)
    setError(null)
    try {
      onResult(await api.buildPlan(sim.id, p.id, lotId))
      // The masons build it on the lot over time: back to the street, free meanwhile.
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Pas de réseau'))
    } finally {
      setBusy(false)
    }
  }
  const clearLot = async () => {
    setBusy(true)
    setError(null)
    try {
      onResult(await api.clearPlot(sim.id, lotId))
      history.current = []
      setUndoable(0)
      await reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Pas de réseau'))
    } finally {
      setBusy(false)
    }
  }

  const reload = () =>
    api
      .plot(sim.id, lotId)
      .then((p) => {
        setPlot(p)
        setBlocks(p.blocks)
        setPieces(p.furniture ?? [])
        setBuilt(p.built)
        // An empty lot opens on the plans: a house in one go, or the first block by hand.
        if (!p.blocks.length && !(p.furniture ?? []).length && p.lot && !planOpened.current) {
          planOpened.current = true
          setTab('plans')
        }
      })
      .catch(() => setError(t('Le terrain ne charge pas. Réessaie.')))
  useEffect(() => void reload(), [sim.id, wanted]) // eslint-disable-line react-hooks/exhaustive-deps

  // Edits waiting to be saved: sent together a moment after the last tap.
  type Queue = { place: Map<string, Block>; remove: Map<string, Block>; furnish: Map<string, Piece>; unfurnish: Map<string, Piece>; move: [Piece, Piece][] }
  const fresh0 = (): Queue => ({ place: new Map(), remove: new Map(), furnish: new Map(), unfurnish: new Map(), move: [] })
  const queue = useRef<Queue>(fresh0())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // What the changes not yet answered by the server cost (the money shown takes it off).
  const [pendingCost, setPendingCostState] = useState(0)
  const pending = useRef(0)
  const setPendingCost = (f: (p: number) => number) => {
    pending.current = f(pending.current)
    setPendingCostState(pending.current)
  }
  // The changes made, newest last, to take back.
  const history = useRef<Act[]>([])
  const [undoable, setUndoable] = useState(0)
  const record = (a: Change) => {
    history.current.push({ ...a, at: Date.now() } as Act)
    if (history.current.length > 80) history.current.shift()
    setUndoable(history.current.length)
  }
  const priceOf = (id: string) => materials.find((m) => m.id === id)?.price ?? 0
  const piecePrice = (id: string) => catalog.find((f) => f.id === id)?.price ?? 0
  const flush = () => {
    timer.current = null
    const q = queue.current
    if (!q.place.size && !q.remove.size && !q.furnish.size && !q.unfurnish.size && !q.move.length) return
    queue.current = fresh0()
    const sent = pending.current
    api
      .build(
        sim.id,
        [...q.place.values()],
        [...q.remove.values()].map((b) => [b[0], b[1], b[2]] as Cell),
        [...q.furnish.values()],
        [...q.unfurnish.values()].map((p) => [p[0], p[1], p[2]] as Cell),
        lotId,
        q.move,
      )
      .then((res) => {
        setPendingCost((p) => p - sent)
        onResult(res)
        void reload() // the new state, and whether one can move in now
      })
      .catch((e) => {
        setPendingCost((p) => p - sent)
        setError(e instanceof ApiError ? e.message : t('Pas de réseau : rien n’a été enregistré.'))
        // What's on screen is the server's again: nothing left to take back.
        history.current = []
        setUndoable(0)
        void reload()
      })
  }
  const later = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 900)
  }
  // Leaving saves what's left.
  useEffect(() => () => void (timer.current && (clearTimeout(timer.current), flush())), []) // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => new Map((blocks ?? []).map((b) => [key(b), b])), [blocks])
  const byId = useMemo(() => new Map(catalog.map((f) => [f.id, f])), [catalog])
  /** A piece's footprint, turned: w, h, d in cells. */
  const sizeOf = (id: string, r: number): Cell => {
    const f = byId.get(id)
    if (!f) return [1, 1, 1]
    return r % 2 ? [f.d, Math.max(1, f.h), f.w] : [f.w, Math.max(1, f.h), f.d]
  }
  // The cells the furniture fills.
  const footprint = (p: Piece) => {
    if (!byId.has(p[4])) return [] as Cell[]
    const [w, h, d] = sizeOf(p[4], p[3])
    const out: Cell[] = []
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) out.push([p[0] + x, p[1] + y, p[2] + z])
    return out
  }
  const furnished = useMemo(() => new Set(pieces.flatMap((p) => footprint(p).map(key))), [pieces]) // eslint-disable-line react-hooks/exhaustive-deps
  const inside = ([x, y, z]: Cell) => x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H
  const material = materials.find((m) => m.id === pick)
  const piece = byId.get(carry ? carry[4] : pickF)
  const money = sim.money - pendingCost
  const placedSoFar = built + queue.current.place.size
  const touches = ([x, y, z]: Cell) => y === 0 || [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => grid.has(key([x + a, y + b, z + c])))

  /** Why a block can't go there ('' when it can). */
  const blockMisfit = (c: Cell) => {
    if (!material) return '…'
    if (!inside(c)) return t('Ça dépasse de ton terrain.')
    if (grid.has(key(c)) || furnished.has(key(c))) return t('Pas la place : il y a déjà quelque chose ici.')
    if (material.unlock > placedSoFar) return t('{label} : construis encore {0} blocs pour le débloquer.', { label: material.label, 0: material.unlock - placedSoFar })
    if (!touches(c)) return t('Un bloc se pose sur le sol ou contre un autre bloc.')
    if (money < material.price) return t("Pas assez d'argent pour ce bloc.")
    return ''
  }
  /** Why a piece can't stand there ('' when it can). */
  const misfit = (p: Piece) => {
    const cells = footprint(p)
    if (cells.some((x) => !inside(x))) return t('Ça dépasse de ton terrain : tourne-le ou pose-le ailleurs.')
    if (cells.some((x) => grid.has(key(x)) || furnished.has(key(x)))) return t('Pas la place : il y a déjà quelque chose ici.')
    if (p[1] > 0 && cells.filter((x) => x[1] === p[1]).some((x) => !grid.has(key([x[0], x[1] - 1, x[2]])))) return t('Un meuble se pose sur le sol ou sur un plancher.')
    return ''
  }
  /** Why a block can't be knocked down ('' when it can). */
  const breakMisfit = (c: Cell) => (!grid.has(key(c)) ? '…' : furnished.has(key([c[0], c[1] + 1, c[2]])) ? t("Enlève d'abord le meuble posé dessus.") : '')

  // The changes themselves, with their price; `back`: taking a change back (paid what it was paid).
  const addBlock = (b: Block, back = false) => {
    const k = key(b)
    const was = queue.current.remove.get(k)
    const price = priceOf(b[3])
    if (was && was[3] === b[3]) {
      queue.current.remove.delete(k)
      setPendingCost((p) => p + Math.floor(price / 2))
    } else {
      queue.current.place.set(k, b)
      setPendingCost((p) => p + (back ? Math.floor(price / 2) : price))
    }
    setBlocks((bs) => [...(bs ?? []), b])
    later()
  }
  const dropBlock = (b: Block, back = false) => {
    const k = key(b)
    const price = priceOf(b[3])
    if (queue.current.place.get(k)?.[3] === b[3]) {
      queue.current.place.delete(k)
      setPendingCost((p) => p - price)
    } else {
      queue.current.remove.set(k, b)
      setPendingCost((p) => p - (back ? price : Math.floor(price / 2)))
    }
    setBlocks((bs) => (bs ?? []).filter((x) => key(x) !== k))
    later()
  }
  const addPiece = (p: Piece, back = false) => {
    const k = key(p)
    const was = queue.current.unfurnish.get(k)
    const price = piecePrice(p[4])
    if (was && was[4] === p[4] && was[3] === p[3]) {
      queue.current.unfurnish.delete(k)
      setPendingCost((x) => x + Math.floor(price / 2))
    } else {
      queue.current.furnish.set(k, p)
      setPendingCost((x) => x + (back ? Math.floor(price / 2) : price))
    }
    setPieces((ps) => [...ps, p])
    later()
  }
  const dropPiece = (p: Piece, back = false) => {
    const k = key(p)
    const price = piecePrice(p[4])
    if (queue.current.furnish.get(k)?.[4] === p[4]) {
      queue.current.furnish.delete(k)
      setPendingCost((x) => x - price)
    } else {
      queue.current.unfurnish.set(k, p)
      setPendingCost((x) => x - (back ? price : Math.floor(price / 2)))
    }
    setPieces((ps) => ps.filter((x) => key(x) !== k))
    later()
  }
  /** A piece from one spot to another, for nothing. */
  const shift = (from: Piece, to: Piece) => {
    const fk = key(from)
    const last = queue.current.move.at(-1)
    // Bought in this same batch: it's just bought there instead.
    const bought = queue.current.furnish.get(fk)
    if (bought && bought[4] === from[4]) {
      queue.current.furnish.delete(fk)
      queue.current.furnish.set(key(to), to)
    } else if (last && key(last[1]) === fk && last[1][4] === from[4] && key(last[0]) === key(to) && last[0][3] === to[3]) queue.current.move.pop() // put back where it was: no move
    else queue.current.move.push([from, to])
    setPieces((ps) => [...ps.filter((x) => key(x) !== fk), to])
    later()
  }

  const place = (c: Cell) => {
    if (!blocks || !material) return
    const why = blockMisfit(c)
    if (why) return (buildSfx.nope(), setError(why))
    const b: Block = [c[0], c[1], c[2], material.id]
    addBlock(b)
    record({ k: 'place', b })
    buildSfx.block(material.id, placedSoFar)
    dust({ at: [c[0] + 0.5, c[1], c[2] + 0.5], color: material.color, n: 6, up: 2 })
    setError(null)
  }
  // The piece carried, put down here: for nothing (only where it stands changes).
  const putDown = (c: Cell) => {
    if (!carry) return
    const p: Piece = [c[0], c[1], c[2], rot, carry[4]]
    const why = misfit(p)
    if (why) return (buildSfx.nope(), setError(why))
    shift(carry, p)
    record({ k: 'move', from: carry, to: p })
    landed(p)
    setCarry(null)
    setAim(null)
    setError(null)
  }
  const pickUp = (p: Piece) => {
    if (p[4] === 'escalier') return setError(t("L'escalier ne se déplace pas : enlève-le et repose-le."))
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setCarry(p)
    setRot(p[3])
    // Lifted where it stood: a finger drags it from there.
    setAim([p[0], p[1], p[2]])
    setPieces(pieces.filter((x) => x !== p))
    setError(null)
    buildSfx.tick()
  }
  // Put back where it was (the move given up).
  const putBack = () => {
    if (!carry) return
    setPieces((ps) => [...ps, carry])
    setCarry(null)
    setAim(null)
    later()
  }
  const landed = (p: Piece) => {
    const [w, , d] = sizeOf(p[4], p[3])
    setFresh(`${p[0]},${p[1]},${p[2]},${p[4]}`)
    buildSfx.piece()
    dust({ at: [p[0] + w / 2, p[1], p[2] + d / 2], color: '#d9c8a8', n: 10, up: 1.4 })
  }
  const furnish = (c: Cell) => {
    if (mode === 'move') return putDown(c)
    if (!piece) return
    const p: Piece = [c[0], c[1], c[2], rot, piece.id]
    const why = misfit(p) || (money < piece.price ? t("Pas assez d'argent pour ce meuble.") : '')
    if (why) return (buildSfx.nope(), setError(why))
    addPiece(p)
    record({ k: 'furnish', p })
    landed(p)
    setAim(null)
    setError(null)
  }
  const remove = (c: Cell) => {
    const b = grid.get(key(c))
    if (!blocks || !b) return
    const why = breakMisfit(c)
    if (why) return (buildSfx.nope(), setError(why))
    dropBlock(b)
    record({ k: 'remove', b })
    buildSfx.crumble()
    dust({ at: [c[0] + 0.5, c[1] + 0.3, c[2] + 0.5], color: materials.find((m) => m.id === b[3])?.color ?? '#999', n: 14, up: 3 })
    setError(null)
  }
  const unfurnish = (p: Piece) => {
    dropPiece(p)
    record({ k: 'unfurnish', p })
    const [w, , d] = sizeOf(p[4], p[3])
    buildSfx.crumble()
    dust({ at: [p[0] + w / 2, p[1] + 0.2, p[2] + d / 2], color: byId.get(p[4])?.color ?? '#999', n: 10, up: 2 })
    setError(null)
  }
  /** The last change taken back (within two minutes: after that it's for good). */
  const undo = () => {
    putBack()
    const h = history.current
    while (h.length && Date.now() - h[0].at > UNDO_FOR) h.shift()
    const a = h.pop()
    setUndoable(h.length)
    if (!a) return
    // Something has taken its place since: it stays as it is.
    if ((a.k === 'remove' && (grid.has(key(a.b)) || furnished.has(key(a.b)))) || (a.k === 'unfurnish' && misfit(a.p))) return (buildSfx.nope(), setError(t('Quelque chose a pris sa place : enlève-le d’abord.')))
    if (a.k === 'place') dropBlock(a.b, true)
    else if (a.k === 'remove') addBlock(a.b, true)
    else if (a.k === 'furnish') dropPiece(a.p, true)
    else if (a.k === 'unfurnish') addPiece(a.p, true)
    else if (a.k === 'move') shift(a.to, a.from)
    buildSfx.undo()
    setError(null)
  }
  // Changes older than two minutes can't be taken back any more: the button says so by itself.
  useEffect(() => {
    if (!undoable) return
    const id = setInterval(() => {
      const h = history.current
      while (h.length && Date.now() - h[0].at > UNDO_FOR) h.shift()
      setUndoable(h.length)
    }, 5000)
    return () => clearInterval(id)
  }, [undoable])

  // Turned a quarter: about its middle, so it doesn't jump away from where it was aimed.
  const turn = () => {
    const next = (rot + 1) % 4
    const id = carry ? carry[4] : pickF
    if (aim && tab === 'meubles') {
      const [w0, , d0] = sizeOf(id, rot)
      const [w1, , d1] = sizeOf(id, next)
      setAim([Math.round(aim[0] + (w0 - w1) / 2), aim[1], Math.round(aim[2] + (d0 - d1) / 2)])
    }
    setRot(next)
    buildSfx.tick()
  }

  // Pointers: a mouse aims by hovering and puts down with a click; a finger aims with a tap, drags the
  // piece aimed at (the view stays still meanwhile) and puts it down with ✓ or a second tap on it.
  // Blocks and knocking down go at once, with a finger too (« Annuler » is there).
  const pointer = useRef<string>('mouse')
  const grabbing = useRef(false)
  const orbit = useRef<ComponentRef<typeof OrbitControls>>(null)
  const furnishing = tab === 'meubles' && (mode === 'place' || (mode === 'move' && !!carry))
  const fingerAims = () => pointer.current !== 'mouse' && furnishing
  const floorY = level === null ? 0 : level * STOREY
  /** Where a tap on a block's face lands: the cell beside it; for a piece, on the floor of the storey it's on. */
  const faceCell = (c: Cell, n: Cell): Cell => (furnishing && n[1] !== 1 ? [c[0] + n[0], Math.floor((c[1]) / STOREY) * STOREY, c[2] + n[2]] : [c[0] + n[0], c[1] + n[1], c[2] + n[2]])
  const doAt = (c: Cell) => (mode === 'remove' ? remove(c) : tab === 'meubles' ? furnish(c) : place(c))
  const tapAt = (c: Cell) => {
    if (fingerAims()) {
      // A second tap where it's aimed puts it down.
      if (same(aim, c)) return doAt(c)
      setAim(c)
      setError(null)
      return buildSfx.tick()
    }
    // A mouse keeps aiming where it is; a finger's tap leaves nothing behind.
    setAim(pointer.current === 'mouse' ? c : null)
    doAt(c)
  }
  const hoverAt = (c: Cell | null) => {
    // A finger sliding without the piece in hand is turning the view: the aim stays.
    if (pointer.current !== 'mouse' && !grabbing.current) return
    if (c && !same(c, aim)) setAim(c)
  }
  const onBlock = (c: Cell, n: Cell, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return // that was a drag to turn the view
    if ((mode === 'move' && !carry) || (mode === 'remove' && tab === 'meubles')) return
    tapAt(mode === 'remove' ? c : faceCell(c, n))
  }
  const groundCell = (e: ThreeEvent<PointerEvent | MouseEvent>): Cell => [Math.floor(e.point.x + W / 2), 0, Math.floor(e.point.z + D / 2)]
  const onGround = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || mode === 'remove' || (mode === 'move' && !carry)) return
    e.stopPropagation()
    tapAt(groundCell(e))
  }
  const onPiece = (p: Piece, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    if (mode === 'move' && !carry) return (e.stopPropagation(), pickUp(p))
    if (mode !== 'remove') return
    e.stopPropagation()
    unfurnish(p)
  }
  // The piece aimed at, grabbed by a finger: the view holds still till it's let go.
  const grab = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    grabbing.current = true
    if (orbit.current) orbit.current.enabled = false
  }
  useEffect(() => {
    const up = () => {
      if (!grabbing.current) return
      grabbing.current = false
      if (orbit.current) orbit.current.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => (window.removeEventListener('pointerup', up), window.removeEventListener('pointercancel', up))
  }, [])

  // The keys, on a computer: R turns, Ctrl+Z (or Z) takes back, Enter puts down, Échap lets go.
  const keys = useRef({ turn, undo, aim, doAt, putBack })
  keys.current = { turn, undo, aim, doAt, putBack }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const k = keys.current
      if (e.key === 'r' || e.key === 'R') k.turn()
      else if (e.key === 'z' || e.key === 'Z') (e.preventDefault(), k.undo())
      else if (e.key === 'Enter' && k.aim) k.doAt(k.aim)
      else if (e.key === 'Escape') (k.putBack(), setAim(null))
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  // What's aimed at, and whether it goes there.
  const aimPiece: Piece | null = aim && furnishing && piece ? [aim[0], aim[1], aim[2], rot, piece.id] : null
  const aimWhy = !aim ? '' : aimPiece ? misfit(aimPiece) || (mode === 'place' && money < (piece?.price ?? 0) ? t("Pas assez d'argent pour ce meuble.") : '') : mode === 'remove' ? breakMisfit(aim) : tab === 'materiaux' ? blockMisfit(aim) : ''
  const showAim = !!aim && (aimPiece ? true : tab === 'materiaux' && (mode === 'place' ? inside(aim) : grid.has(key(aim))))

  const moveIn = async () => {
    try {
      onResult(await api.moveIn(sim.id, lotId))
      void reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('Pas de réseau'))
    }
  }
  const kindAt = (p: Piece) => kindOf(byId.get(p[4]) ?? { id: p[4] })
  const hasBed = pieces.some((p) => kindAt(p) === 'lit' || kindAt(p) === 'natte')
  const hasWc = pieces.some((p) => kindAt(p) === 'wc')

  // The floors the house has (a storey is four blocks), to look at one at a time.
  const shownBlocks = preview && empty ? preview.blocks : (blocks ?? [])
  const storeys = shownBlocks.length ? Math.floor(Math.max(...shownBlocks.map((b) => b[1])) / STOREY) + 1 : 0
  useEffect(() => {
    if (level !== null && level >= storeys) setLevel(storeys ? storeys - 1 : null)
  }, [level, storeys])
  // Furnishing: the walls on the camera's side come down (as in the Sims), the floors above are off.
  const cutAway = tab === 'meubles' && level !== null
  const blockTop = level === null ? Infinity : tab === 'meubles' ? level * STOREY + STOREY - 1 : (level + 1) * STOREY
  const upTo = (bs: Block[]) => (blockTop === Infinity ? bs : bs.filter((b) => b[1] < blockTop))
  const piecesUpTo = (ps: Piece[]) => (level === null ? ps : downstairs(ps, level * STOREY + 1))

  // The panels over the view: the camera frames the lot in what they leave free.
  const topRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [insets, setInsets] = useState({ top: 90, bottom: 250 })
  useLayoutEffect(() => {
    const measure = () => setInsets({ top: Math.round(topRef.current?.getBoundingClientRect().bottom ?? 90), bottom: Math.round(window.innerHeight - (sheetRef.current?.getBoundingClientRect().top ?? window.innerHeight - 250)) })
    measure()
    const ro = new ResizeObserver(measure)
    if (topRef.current) ro.observe(topRef.current)
    if (sheetRef.current) ro.observe(sheetRef.current)
    window.addEventListener('resize', measure)
    return () => (ro.disconnect(), window.removeEventListener('resize', measure))
  }, [plot?.lot])
  // The catalogue's pictures: drawn once the furniture is looked at.
  const [studio, setStudio] = useState(false)
  useEffect(() => {
    if (tab === 'meubles') setStudio(true)
  }, [tab])
  // The street's scene underneath holds still while the house is edited (a phone has enough with one).
  const release = useRef<(() => void) | null>(null)
  useEffect(() => () => release.current?.(), [])

  // No lot yet: buy one first, here where the Sim is.
  if (plot && !plot.lot)
    return (
      <div className="absolute inset-0 z-40 overflow-y-auto bg-[var(--color-canvas)] p-4 pt-[max(1rem,var(--sat,env(safe-area-inset-top)))]">
        <div className="mx-auto max-w-md">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl font-extrabold">{t('Ton terrain')}</h2>
            <button className="icon-btn bg-white" onClick={onClose} aria-label={t('Fermer')}>
              <X size={22} strokeWidth={2.6} />
            </button>
          </div>
          <p className="mb-3 text-sm font-bold text-[var(--color-ink-soft)]">{t("Pour bâtir ta maison, il te faut d'abord un terrain à toi. Sa taille, c'est la place que tu as pour construire.")}</p>
          <LotOffers
            sim={sim}
            buy={async (size, _label, where, upgrade, spot) => {
              try {
                onResult(await api.buyLot(sim.id, size, where, upgrade, spot))
                await reload()
                return true
              } catch (e) {
                setError(e instanceof ApiError ? e.message : t('Pas de réseau'))
                return false
              }
            }}
          />
          {error && <p className="mt-3 text-sm font-bold text-[#d81b3f]">{error}</p>}
        </div>
      </div>
    )

  // The masons still at it (game/chantier.ts): nothing to change till it's done; the Sim is free meanwhile.
  if (plot && building(plot))
    return (
      <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
        <div className="sheet animate-up w-full rounded-t-[28px] p-5 pb-[max(1.25rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[420px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
          <div className="label">{t('Chantier en cours')}</div>
          <div className="mt-1 font-display text-[22px] leading-tight font-extrabold">{t('Les maçons construisent ta maison')}</div>
          <p className="mt-2 text-sm leading-snug font-bold text-[var(--color-ink-soft)]">{tx("Ce sera fini à {0}. Ce n'est pas toi qui construis : va où tu veux en attendant, tu pourras meubler et emménager ensuite.", { 0: doneAt(plot) })}</p>
          <button className="btn mt-4 w-full" onClick={onClose}>
            {t("D'accord")}
          </button>
        </div>
      </div>
    )
  const span = Math.max(W, D, 12)
  const aimSize: Cell = aimPiece ? sizeOf(aimPiece[4], aimPiece[3]) : [1, 1, 1]
  const levels = storeys > 0 ? [null, ...Array.from({ length: storeys }, (_, i) => storeys - 1 - i)] : []
  return (
    <div className="absolute inset-0 z-40 bg-[#9fd8f5]" onPointerDownCapture={(e) => (pointer.current = e.pointerType)}>
      {plot?.lot && (
        <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.9, span * 0.9, span * 1.25], fov: 40 }} onPointerMissed={() => !carry && pointer.current === 'mouse' && setAim(null)} onCreated={({ gl }) => (release.current = holdScenes(gl.domElement))}>
          <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
          <directionalLight position={[8, 14, 6]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
          <ambientLight intensity={0.35} />
          {/* The lot: grass, a grid of one-metre squares, the street's earth round it */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={onGround} onPointerMove={(e) => (e.stopPropagation(), mode === 'remove' || (mode === 'move' && !carry) ? undefined : hoverAt(groundCell(e)))}>
            <planeGeometry args={[W, D]} />
            <meshLambertMaterial map={grass(W, D)} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[W + 30, D + 30]} />
            <meshLambertMaterial color="#cbb38c" />
          </mesh>
          <group position={[-W / 2, 0, -D / 2]}>
            <LotFence w={W} d={D} color={ownerColor(sim.id)} name={t('Chez {firstName}', { firstName: sim.firstName })} />
            {zones.length > 0 && blocks && <Zones zones={zones} blocks={blocks} furniture={pieces} w={W} d={D} cut={level !== null} />}
            {/* A plan looked at, on the empty lot where it would stand */}
            {preview && empty && world.furniture && (
              <group position={[planAt(preview)[0], 0, planAt(preview)[1]]}>
                <House blocks={upTo(preview.blocks)} materials={materials} />
                <FurnitureSet pieces={piecesUpTo(preview.furniture)} catalog={catalog} />
                <Zones zones={preview.zones} blocks={preview.blocks} furniture={preview.furniture} w={preview.w} d={preview.d} cut={level !== null} />
              </group>
            )}
            {blocks &&
              (cutAway ? (
                <CutHouse blocks={blocks} materials={materials} top={blockTop} base={floorY} onBlock={onBlock} onHover={(c, n) => c && n && hoverAt(mode === 'remove' ? c : faceCell(c, n))} />
              ) : (
                <House blocks={upTo(blocks)} materials={materials} onBlock={onBlock} onHover={(c, n) => c && n && (mode === 'place' || mode === 'remove' || carry) && hoverAt(mode === 'remove' ? c : faceCell(c, n))} />
              ))}
            <FurnitureSet pieces={piecesUpTo(pieces)} catalog={catalog} onPiece={onPiece} fresh={fresh} />
            {/* What's aimed at: the piece itself where it would stand, in a green or red box */}
            {showAim && aim && aimPiece && <FurnitureSet pieces={[aimPiece]} catalog={catalog} />}
            {showAim && aim && <Aim at={aim} size={aimSize} ok={!aimWhy} solid={!aimPiece} onGrab={aimPiece ? grab : undefined} />}
            <Dust />
          </group>
          {/* The Sim, beside the lot, for scale */}
          <group position={[W / 2 + 1.4, 0, 1]} rotation={[0, -Math.PI / 2, 0]}>
            <Character look={sim.look} gender={sim.gender} pose="idle" />
          </group>
          <OrbitControls ref={orbit} makeDefault target={[0, 1, 0]} minPolarAngle={0.3} maxPolarAngle={1.42} enablePan screenSpacePanning={false} enableDamping dampingFactor={0.12} rotateSpeed={0.7} />
          <BuildCamera w={W} d={D} top={insets.top} bottom={insets.bottom} floor={floorY} />
          {studio && <ThumbStudio catalog={shop} />}
        </Canvas>
      )}

      {/* Top: the lot, the money, moving in, the floors; and done */}
      <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,var(--sat,env(safe-area-inset-top)))]">
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <div className="hud pointer-events-auto flex h-10 max-w-full items-center gap-2 rounded-full px-3.5 whitespace-nowrap">
            <Hammer size={17} strokeWidth={2.6} className="shrink-0 text-[var(--color-orange)]" />
            <span className="font-display text-base font-extrabold">{t('Mon terrain')}</span>
            {plot?.lot && <span className="truncate text-xs font-extrabold text-[var(--color-ink-soft)]">{tx('{area} m²', { area: plot.lot.area })}</span>}
          </div>
          {plot?.lot && !plot.home && (
            // Moving in: what's still missing, in one line.
            <div className="hud pointer-events-auto flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-xs font-extrabold">
              <span className="flex items-center gap-0.5" title={t('Un lit (ou une natte) sous un toit')}>
                <BedDouble size={15} /> {hasBed ? <Check size={13} className="text-[var(--color-emerald)]" /> : <X size={13} className="text-[#d81b3f]" />}
              </span>
              <span className="flex items-center gap-0.5" title={t('Des toilettes')}>
                <Toilet size={15} /> {hasWc ? <Check size={13} className="text-[var(--color-emerald)]" /> : <X size={13} className="text-[#d81b3f]" />}
              </span>
              <button className="btn !px-3 !py-1.5 !text-xs" disabled={!plot.livable} onClick={() => void moveIn()}>
                <HomeIcon size={14} /> {t('Emménager')}
              </button>
            </div>
          )}
          {plot?.home && <span className="hud rounded-full px-3 py-1.5 text-xs font-extrabold">{t('Tu habites ici · pas de loyer')}</span>}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <div className="hud flex h-10 items-center gap-1.5 rounded-full pr-3.5 pl-1">
            <Coin size={28} />
            <span className="tnum font-display text-base font-extrabold">{amount(money)}</span>
          </div>
          <button className="icon-btn hud" onClick={onClose} aria-label={t('Terminer')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
      </div>
      {/* The floors: the whole house (roof on), or one floor at a time, the ones above off */}
      {levels.length > 0 && (
        <div className="absolute right-3 flex flex-col gap-1" style={{ top: insets.top + 8 }}>
          {levels.map((l) => (
            <button key={String(l)} onClick={() => (setLevel(l), buildSfx.tick())} aria-pressed={level === l} className={`hud rounded-full px-3 py-1.5 text-xs font-extrabold ${level === l ? '!bg-[var(--color-ink)] text-white' : ''}`}>
              {l === null ? t('Toit') : l === 0 ? t('RDC') : t('Étage {0}', { 0: l })}
            </button>
          ))}
        </div>
      )}

      {/* Bottom: what's aimed at, then place or break, materials or furniture */}
      <div className="absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
        {error && !(furnishing && aim) && (
          <p className="sheet mx-auto mb-2 w-fit max-w-full rounded-2xl px-4 py-2 text-sm font-bold text-[#d81b3f]" role="status">
            {error}
          </p>
        )}
        {/* The piece aimed at: turn it, put it down (green) or why not (red), or let go */}
        {furnishing && aim && piece && (
          <div className="mx-auto mb-2 flex max-w-[420px] items-center gap-2">
            <button className="icon-btn hud shrink-0" onClick={turn} aria-label={t('Tourner')}>
              <RotateCw size={20} strokeWidth={2.6} />
            </button>
            <button className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-extrabold text-white shadow-lg transition active:scale-95 ${aimWhy ? 'bg-[#d81b3f]' : 'bg-[var(--color-emerald)]'}`} onClick={() => (aimWhy ? (buildSfx.nope(), setError(aimWhy)) : doAt(aim))} role="status">
              {aimWhy ? (
                <span className="truncate">{aimWhy}</span>
              ) : (
                <>
                  <Check size={17} strokeWidth={3} className="shrink-0" />
                  <span className="truncate">{mode === 'move' ? t('Poser ici · gratuit') : t('Poser · {0} Djai', { 0: amount(piece.price) })}</span>
                </>
              )}
            </button>
            <button className="icon-btn hud shrink-0" onClick={() => (carry ? putBack() : setAim(null))} aria-label={t('Annuler')}>
              <X size={20} strokeWidth={2.6} />
            </button>
          </div>
        )}
        {/* (Only the panel counts for the camera's framing: the bar above comes and goes without moving the view.) */}
        <div ref={sheetRef} className="sheet mx-auto max-w-[720px] rounded-[24px] p-2">
          <div className="mb-1.5 flex gap-1">
            {(
              [
                ['plans', t('Plans')],
                ['materiaux', t('Matériaux')],
                ['meubles', t('Meubles')],
              ] as const
            ).map(([id, label]) => (
              <button key={id} onClick={() => (putBack(), setAim(null), setTab(id), setMode('place'), id === 'meubles' && level === null && storeys > 0 && setLevel(0), id !== 'plans' && setPreview(null))} className={`flex-1 rounded-xl py-1.5 text-sm font-extrabold ${tab === id ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--color-canvas)]'}`}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'plans' ? (
            <div>
              <p className="mb-2 px-1 text-xs font-bold text-[var(--color-ink-soft)]">
                {empty
                  ? t('Choisis un plan : les maçons bâtissent tout, meubles compris, et tu peux encore tout changer bloc par bloc. Ou pars de zéro avec « Matériaux ».')
                  : t('Un plan se bâtit sur un terrain vide.')}
              </p>
              {!empty && !plot?.home && (
                <button className="btn mb-2 !bg-[var(--color-canvas)] !px-3 !py-2 !text-sm !text-[var(--color-ink)]" disabled={busy} onClick={() => void clearLot()}>
                  <Pickaxe size={15} /> {t('Tout démolir (la moitié revendue)')}
                </button>
              )}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {plans.map((p) => (
                  <div key={p.id} className={`flex w-[230px] shrink-0 flex-col rounded-2xl p-2.5 ${preview?.id === p.id ? 'bg-[#fff4e8] ring-2 ring-[var(--color-orange)]' : 'bg-[var(--color-canvas)]'}`}>
                    <button className="text-left" onClick={() => setPreview(preview?.id === p.id ? null : p)}>
                      <span className="block font-display text-[15px] leading-tight font-extrabold">{p.label}</span>
                      <span className="mt-0.5 block text-[11px] font-bold text-[var(--color-ink-soft)]">
                        {tx('{w} × {d} m · {rooms} chambre{0} {1}', { w: p.w, d: p.d, rooms: p.rooms, 0: p.rooms > 1 ? 's' : '', 1: p.pool ? t(' · piscine') : '' })}
                      </span>
                      <span className="mt-1 line-clamp-3 block text-[11px] leading-snug font-semibold">{p.hint}</span>
                    </button>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-xs font-extrabold">{amount(p.cost)} {t('Djai')}</span>
                      <button className="btn !px-3 !py-1.5 !text-xs" disabled={busy || !empty || sim.money < p.cost} onClick={() => void buildPlan(p)}>
                        {sim.money < p.cost ? t('Trop cher') : t('Bâtir')}
                      </button>
                    </div>
                  </div>
                ))}
                {!plans.length && <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">{t('Aucun plan ne tient sur ce terrain.')}</p>}
              </div>
            </div>
          ) : (
            <>
              {/* The tools, in one row: put, break or take away, move, take back */}
              <div className="mb-1.5 flex gap-1">
                {(
                  [
                    ['place', Hammer, t('Poser')],
                    ['remove', Pickaxe, tab === 'meubles' ? t('Enlever') : t('Casser')],
                    ...(tab === 'meubles' && canMove ? ([['move', Move, t('Déplacer')]] as const) : []),
                  ] as const
                ).map(([id, Icon, label]) => (
                  <button key={id} onClick={() => (putBack(), setMode(id), setAim(null))} aria-pressed={mode === id} className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold transition ${mode === id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)]'}`}>
                    <Icon size={15} strokeWidth={2.6} className="shrink-0" /> <span className="truncate">{label}</span>
                  </button>
                ))}
                <button onClick={undo} disabled={!undoable} aria-label={t('Annuler')} className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--color-canvas)] text-[13px] font-extrabold transition disabled:opacity-40">
                  <Undo2 size={15} strokeWidth={2.6} className="shrink-0" /> <span className="truncate">{t('Annuler')}</span>
                </button>
              </div>
              {tab === 'meubles' && mode !== 'move' && (
                <div className="mb-1.5 flex gap-1 overflow-x-auto pb-0.5">
                  {/* The search: a word of the piece's name */}
                  {query === null ? (
                    <button onClick={() => setQuery('')} aria-label={t('Chercher')} className="flex shrink-0 items-center rounded-full bg-[var(--color-canvas)] px-2.5 py-1">
                      <Search size={14} strokeWidth={2.8} />
                    </button>
                  ) : (
                    <label className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-ink)] py-0.5 pr-1 pl-2.5 text-white">
                      <Search size={13} strokeWidth={2.8} />
                      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Chercher')} className="w-24 bg-transparent text-xs font-extrabold outline-none placeholder:text-white/60" />
                      <button onClick={() => setQuery(null)} aria-label={t('Fermer')} className="grid h-5 w-5 place-items-center rounded-full bg-white/20">
                        <X size={12} strokeWidth={3} />
                      </button>
                    </label>
                  )}
                  {SHELVES.filter(([id]) => id === 'tout' || shop.some((f) => (id === 'prestige' ? f.tier === 'prestige' : f.room === id))).map(([id, label]) => (
                    <button key={id} onClick={() => (setShelf(id), setQuery(null))} aria-pressed={shelf === id && query === null} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${shelf === id && query === null ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)]'}`}>
                      {id === 'prestige' && <Crown size={12} strokeWidth={2.8} className={shelf === id && query === null ? 'text-[#ffd166]' : 'text-[#c99a00]'} />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
                {tab === 'materiaux' ? (
                  materials.map((m) => <MaterialTile key={m.id} m={m} picked={pick === m.id && mode === 'place'} locked={m.unlock > placedSoFar} toGo={m.unlock - placedSoFar} onPick={() => (setPick(m.id), setMode('place'))} />)
                ) : mode === 'move' ? (
                  <p className="min-h-[88px] self-center px-2 text-sm font-bold text-[var(--color-ink-soft)]">{carry ? t('{0} : fais-le glisser du doigt où le poser, puis ✓. Gratuit.', { 0: piece?.label ?? t('Le meuble') }) : t('Touche un meuble pour le prendre, puis touche où le poser.')}</p>
                ) : mode === 'remove' ? (
                  <p className="min-h-[88px] self-center px-2 text-sm font-bold text-[var(--color-ink-soft)]">{t('Touche un meuble pour l’enlever (la moitié revendue).')}</p>
                ) : (
                  <>
                    {shelved.map((f) => (
                      <FurnitureTile key={f.id} f={f} picked={pickF === f.id && mode === 'place'} onPick={() => (setPickF(f.id), setMode('place'), setAim(null), buildSfx.tick())} />
                    ))}
                    {!shelved.length && <p className="min-h-[88px] self-center px-2 text-sm font-bold text-[var(--color-ink-soft)]">{t('Rien de ce nom.')}</p>}
                  </>
                )}
              </div>
              {tab === 'meubles' && mode === 'place' && !aim && <p className="px-1 text-[11px] leading-tight font-bold text-[var(--color-ink-soft)]">{t('Touche le sol pour essayer le meuble à cet endroit : vert, il y va ; rouge, non.')}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function FurnitureTile({ f, picked, onPick, hired }: { f: Furniture; picked: boolean; onPick: () => void; /** A soirée's room (SoireeDeco): hired with the soirée, nothing to pay, nothing it does at home. */ hired?: boolean }) {
  const Icon = iconFor(f.icon)
  const kind = kindOf(f)
  const does = hired ? t('Pour la soirée') : f.unlocks?.includes('sleep') ? t('Dormir') : f.unlocks?.includes('cook-attieke') ? t('Cuisiner') : f.unlocks?.includes('watch-tv') ? t('La télé') : f.unlocks?.includes('shower') ? t('Se doucher') : f.unlocks?.includes('maison-foot') ? t('Jouer') : kind === 'wc' ? t('Pour emménager') : f.unlocks?.includes('dents') ? t('Les dents') : f.stock ? t('{stock} choses au frais', { stock: f.stock }) : t('Confort +{0}', { 0: Math.round(f.comfort * 100) })
  // Light swatches get a dark icon.
  const pic = useThumb(f.id)
  const light = parseInt(f.color.slice(1, 3), 16) + parseInt(f.color.slice(3, 5), 16) + parseInt(f.color.slice(5, 7), 16) > 560
  return (
    <button onClick={onPick} className={`relative flex w-[84px] shrink-0 flex-col items-center gap-0.5 rounded-2xl p-1.5 transition active:scale-95 ${picked ? 'bg-[#fff4e8] ring-2 ring-[var(--color-orange)]' : f.tier === 'prestige' ? 'bg-[#fff8e1]' : 'bg-[var(--color-canvas)]'}`}>
      {f.tier && (
        <span className={`absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full ${f.tier === 'prestige' ? 'bg-[#1f1a17] text-[#ffd166]' : 'bg-white text-[#e0a100]'}`} title={f.tier === 'prestige' ? t('Prestige') : t('Confort')}>
          {f.tier === 'prestige' ? <Crown size={10} strokeWidth={3} /> : <Star size={10} strokeWidth={3} />}
        </span>
      )}
      {pic ? (
        // Its picture, drawn from the piece's own 3D model (world3d/build/BuildKit.tsx ThumbStudio).
        <img src={pic} alt="" draggable={false} className="h-12 w-12 object-contain" />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-lg" style={{ background: f.color, color: light ? '#333' : '#fff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}>
          <Icon size={20} strokeWidth={2.4} />
        </span>
      )}
      <span className="w-full truncate text-center text-[11px] leading-tight font-extrabold">{f.label}</span>
      <span className="text-[10px] leading-none font-bold text-[var(--color-ink-soft)]">
        {hired ? `${f.w} × ${f.d} m` : `${amount(f.price)} · ${f.w * f.d} m²`}
      </span>
      <span className="w-full truncate text-center text-[9px] leading-none font-bold text-[var(--color-emerald)]">{does}</span>
    </button>
  )
}

function MaterialTile({ m, picked, locked, toGo, onPick }: { m: Material; picked: boolean; locked: boolean; toGo: number; onPick: () => void }) {
  const swatch = useMemo(() => (materialTexture(m).image as HTMLCanvasElement).toDataURL(), [m])
  return (
    <button onClick={onPick} disabled={locked} className={`flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 transition ${picked ? 'bg-[#fff4e8] ring-2 ring-[var(--color-orange)]' : 'bg-[var(--color-canvas)]'} ${locked ? 'opacity-55 grayscale-[0.6]' : 'active:scale-95'}`}>
      <span className="relative block h-10 w-10 rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ backgroundImage: `url(${swatch})`, backgroundSize: 'cover', imageRendering: 'pixelated' }}>
        {locked && <Lock size={16} strokeWidth={2.8} className="absolute inset-0 m-auto text-white drop-shadow" />}
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight font-extrabold">{m.label}</span>
      <span className="text-[10px] leading-none font-bold text-[var(--color-ink-soft)]">{locked ? t('à {toGo} blocs', { toGo }) : t('{0} Djai', { 0: amount(m.price) })}</span>
    </button>
  )
}

/** Grass with a faint grid of one-metre squares, pixel style. */
let grassTex: THREE.CanvasTexture | null = null
function grass(w: number, d: number) {
  if (!grassTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')!
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
        const k = n - Math.floor(n)
        g.fillStyle = x === 0 || y === 0 ? '#5d9a3e' : k > 0.8 ? '#7cc255' : k < 0.2 ? '#62a443' : '#6fb24b'
        g.fillRect(x, y, 1, 1)
      }
    grassTex = new THREE.CanvasTexture(c)
    grassTex.magFilter = grassTex.minFilter = THREE.NearestFilter
    grassTex.generateMipmaps = false
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
    grassTex.colorSpace = THREE.SRGBColorSpace
  }
  grassTex.repeat.set(w, d)
  return grassTex
}
