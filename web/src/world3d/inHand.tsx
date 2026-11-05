import * as THREE from 'three'

// What a Sim holds in its right hand (Human's `hold`, at the fist: its frame has -y running out of the
// fist, +z in front of the knuckles): the fork and the bottle at the maquis, the notes paid at the till,
// and in the street what's bought and handed over (world3d/open/rueGestes.tsx): the cornet of alloco,
// the garba, the brochettes, the sachet of water, the paper, a coin. A few blocks each, shared geometry.

const UNIT = new THREE.BoxGeometry(1, 1, 1)
const MATS = new Map<string, THREE.MeshLambertMaterial>()
function mat(c: string) {
  let m = MATS.get(c)
  if (!m) MATS.set(c, (m = new THREE.MeshLambertMaterial({ color: c, flatShading: true })))
  return m
}
type V3 = [number, number, number]
const B = ({ p, s, c, r = 0 }: { p: V3; s: V3; c: string; r?: number }) => <mesh geometry={UNIT} material={mat(c)} position={p} scale={s} rotation={[0, 0, r]} />

export type Hold = 'hand' | 'fork' | 'spoon' | 'burger' | 'bottle' | 'glass' | 'napkin' | 'notes' | 'ticket' | 'phone' | 'popcorn' | 'alloco' | 'garba' | 'brochette' | 'sachet' | 'journal' | 'coin' | 'gift'

export function InHand({ what }: { what: Hold }) {
  switch (what) {
    case 'hand':
      // A pinch of attiéké and a bit of fish, eaten with the fingers.
      return <B p={[0, -0.03, 0.03]} s={[0.05, 0.04, 0.05]} c="#f2e6c9" />
    case 'fork':
    case 'spoon':
      return (
        <>
          <B p={[0, -0.07, 0.02]} s={[0.015, 0.16, 0.012]} c="#c3c7cf" />
          <B p={[0, -0.16, 0.02]} s={[what === 'spoon' ? 0.04 : 0.03, 0.04, 0.02]} c={what === 'spoon' ? '#c3c7cf' : '#e8a33c'} />
        </>
      )
    case 'burger':
      return (
        <>
          <B p={[0, -0.04, 0.03]} s={[0.11, 0.035, 0.11]} c="#d9a35a" />
          <B p={[0, -0.07, 0.03]} s={[0.115, 0.025, 0.115]} c="#5c3317" />
          <B p={[0, -0.095, 0.03]} s={[0.11, 0.035, 0.11]} c="#d9a35a" />
        </>
      )
    case 'bottle':
      // The green bottle of beer (or of soda), its neck to the mouth.
      return (
        <>
          <B p={[0, 0.0, 0.02]} s={[0.07, 0.17, 0.07]} c="#2b7a3d" />
          <B p={[0, -0.12, 0.02]} s={[0.03, 0.08, 0.03]} c="#2b7a3d" />
          <B p={[0, 0.02, 0.056]} s={[0.05, 0.06, 0.004]} c="#f4f1ea" />
        </>
      )
    case 'glass':
      return (
        <>
          <B p={[0, -0.02, 0.03]} s={[0.08, 0.15, 0.08]} c="#f783ac" />
          <B p={[0.02, -0.13, 0.03]} s={[0.012, 0.1, 0.012]} c="#ffffff" />
        </>
      )
    case 'napkin':
      return <B p={[0, -0.05, 0.04]} s={[0.12, 0.1, 0.015]} c="#ffffff" />
    case 'notes':
      // The notes of 1 000 and 2 000 held out.
      return (
        <>
          <B p={[0, -0.06, 0.03]} s={[0.07, 0.13, 0.004]} c="#6a994e" />
          <B p={[0.015, -0.065, 0.035]} s={[0.07, 0.13, 0.004]} c="#e9a23b" />
        </>
      )
    case 'ticket':
      return <B p={[0, -0.05, 0.03]} s={[0.05, 0.08, 0.004]} c="#fff9db" />
    case 'phone':
      return <B p={[0, -0.05, 0.03]} s={[0.07, 0.13, 0.012]} c="#1c1c1e" />
    case 'alloco':
      // The cornet of newspaper, the fried plantain golden on top, a few bits of pepper.
      return (
        <>
          <B p={[0, -0.04, 0.04]} s={[0.075, 0.12, 0.075]} c="#e9e4d4" />
          <B p={[0, -0.115, 0.04]} s={[0.085, 0.04, 0.085]} c="#e8a33c" />
          <B p={[0.02, -0.14, 0.05]} s={[0.025, 0.02, 0.025]} c="#c97b1a" />
          <B p={[-0.02, -0.135, 0.03]} s={[0.012, 0.012, 0.012]} c="#d62828" />
        </>
      )
    case 'garba':
      // The attiéké and the fried thon in a black plastic bag held open, the onions and the chili on top.
      return (
        <>
          <B p={[0, -0.05, 0.05]} s={[0.13, 0.1, 0.11]} c="#212121" />
          <B p={[0, -0.105, 0.05]} s={[0.115, 0.025, 0.095]} c="#f4ecd2" />
          <B p={[0.025, -0.125, 0.05]} s={[0.05, 0.025, 0.04]} c="#8a5a32" />
          <B p={[-0.03, -0.12, 0.06]} s={[0.02, 0.012, 0.02]} c="#2f9e44" />
        </>
      )
    case 'brochette':
      // The stick, the pieces of meat along it, out of the fist.
      return (
        <>
          <B p={[0, -0.12, 0.03]} s={[0.012, 0.26, 0.012]} c="#d2b48c" />
          {[-0.08, -0.13, -0.18].map((y) => (
            <B key={y} p={[0, y, 0.03]} s={[0.04, 0.035, 0.04]} c="#7a3b1e" />
          ))}
        </>
      )
    case 'sachet':
      // The sachet of water (« pure water »), its corner bitten off.
      return <B p={[0, -0.06, 0.035]} s={[0.08, 0.12, 0.05]} c="#cfe9fb" />
    case 'journal':
      // The paper folded in two, the front page's red title.
      return (
        <>
          <B p={[0, -0.08, 0.03]} s={[0.15, 0.2, 0.012]} c="#efeae0" />
          <B p={[0, -0.15, 0.037]} s={[0.12, 0.03, 0.004]} c="#c92a2a" />
        </>
      )
    case 'coin':
      // A coin of 50 francs between the fingers.
      return <B p={[0, -0.03, 0.04]} s={[0.035, 0.035, 0.008]} c="#c9a227" />
    case 'gift':
      // A small parcel, its ribbon.
      return (
        <>
          <B p={[0, -0.07, 0.05]} s={[0.12, 0.12, 0.12]} c="#e64980" />
          <B p={[0, -0.07, 0.05]} s={[0.125, 0.025, 0.125]} c="#ffd43b" />
        </>
      )
    default:
      return null
  }
}
