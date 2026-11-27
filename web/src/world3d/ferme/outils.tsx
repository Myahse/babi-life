import * as THREE from 'three'
import { sizedBox } from '../bevel'
import type { FermeTool } from '../../avatar/ferme'

// Les outils en main (the update « agriculture »): what the Sim working its plot holds in its right hand (Human's
// `hold`, at the fist: -y out of the fist, +z in front of the knuckles; inHand.tsx's frame): the machette, the
// daba (the short hoe), the watering can, the sprayer's lance, the herder's stick, the bucket, the rake. And what
// stands by the Sim in its own frame (facing +z) while it works: the sprayer on its back, the calabash of seed,
// the basket, the stool and the goat milked, the motoculteur Kabako pushed (OutdoorAction.tsx draws them).

const MATS = new Map<string, THREE.MeshLambertMaterial>()
function mat(c: string) {
  let m = MATS.get(c)
  if (!m) MATS.set(c, (m = new THREE.MeshLambertMaterial({ color: c, flatShading: true })))
  return m
}
type V3 = [number, number, number]
const B = ({ p, s, c, r = 0, rx = 0 }: { p: V3; s: V3; c: string; r?: number; rx?: number }) => <mesh {...sizedBox(s)} material={mat(c)} position={p} rotation={[rx, 0, r]} />
const WOOD = '#8a5a34'
const STEEL = '#ced4da'

export function FermeOutil({ what }: { what: FermeTool }) {
  switch (what) {
    case 'machette':
      // The wooden grip in the fist, the long blade out of it, a little curved at the end.
      return (
        <>
          <B p={[0, 0.02, 0.02]} s={[0.035, 0.12, 0.035]} c="#3a2616" />
          <B p={[0, -0.27, 0.03]} s={[0.012, 0.46, 0.07]} c={STEEL} />
          <B p={[0, -0.5, 0.05]} s={[0.012, 0.06, 0.09]} c={STEEL} />
        </>
      )
    case 'daba':
      // The short handle through the fist, the wide iron blade at its end, set across it.
      return (
        <>
          <B p={[0, -0.22, 0.02]} s={[0.04, 0.7, 0.04]} c={WOOD} />
          <B p={[0, -0.6, 0.12]} s={[0.22, 0.03, 0.2]} c="#868e96" rx={0.4} />
        </>
      )
    case 'rateau':
      return (
        <>
          <B p={[0, -0.3, 0.02]} s={[0.035, 0.9, 0.035]} c={WOOD} />
          <B p={[0, -0.76, 0.06]} s={[0.4, 0.04, 0.05]} c="#868e96" />
        </>
      )
    case 'arrosoir':
      // Held by its handle: the green can under the fist, its long spout out in front, the rose at its end.
      return (
        <>
          <B p={[0, -0.04, 0.02]} s={[0.03, 0.08, 0.14]} c="#2b8a3e" />
          <B p={[0, -0.2, 0.02]} s={[0.2, 0.22, 0.28]} c="#2f9e44" />
          <B p={[0, -0.18, 0.28]} s={[0.04, 0.04, 0.32]} c="#2f9e44" rx={-0.5} />
          <B p={[0, -0.1, 0.44]} s={[0.08, 0.08, 0.03]} c="#2b8a3e" />
        </>
      )
    case 'lance':
      // The sprayer's lance: its trigger in the fist, the long tube, the nozzle.
      return (
        <>
          <B p={[0, -0.02, 0.02]} s={[0.04, 0.1, 0.05]} c="#343a40" />
          <B p={[0, -0.32, 0.02]} s={[0.02, 0.55, 0.02]} c="#adb5bd" />
          <B p={[0, -0.62, 0.02]} s={[0.04, 0.06, 0.04]} c="#e8590c" />
        </>
      )
    case 'baton':
      return <B p={[0, -0.35, 0.02]} s={[0.03, 1.2, 0.03]} c="#6b4a2a" />
    case 'seau':
      return (
        <>
          <B p={[0, -0.06, 0.02]} s={[0.2, 0.02, 0.02]} c="#495057" />
          <B p={[0, -0.22, 0.02]} s={[0.22, 0.24, 0.22]} c="#1c7ed6" />
          <B p={[0, -0.11, 0.02]} s={[0.18, 0.01, 0.18]} c="#74c0fc" />
        </>
      )
    case 'bol':
    case 'calebasse':
      return <B p={[0, -0.06, 0.06]} s={[0.18, 0.09, 0.18]} c="#c08a4a" />
    case 'panier':
      return <B p={[0, -0.16, 0.02]} s={[0.28, 0.2, 0.22]} c="#c9a25a" />
  }
  return null
}

/** What stands by the Sim while it works (its own frame, facing +z, the feet on y = 0), by the farm action's id. */
export function FermeAupres({ id, hire }: { id: string; hire?: boolean }) {
  switch (id) {
    case 'ferme-traiter':
      // The sprayer's tank on the back, its straps.
      return (
        <>
          <B p={[0, 1.15, -0.24]} s={[0.32, 0.45, 0.16]} c="#ffd43b" />
          <B p={[0, 1.4, -0.24]} s={[0.12, 0.05, 0.12]} c="#e8590c" />
        </>
      )
    case 'ferme-semer':
      // The calabash of seed under the arm.
      return <B p={[-0.2, 0.62, 0.36]} s={[0.2, 0.12, 0.2]} c="#c08a4a" />
    case 'ferme-recolter':
    case 'ferme-oeufs':
      // The basket set down by the feet, filling.
      return (
        <>
          <B p={[0.45, 0.14, 0.2]} s={[0.42, 0.28, 0.36]} c="#c9a25a" />
          <B p={[0.45, 0.29, 0.2]} s={[0.36, 0.04, 0.3]} c={id === 'ferme-oeufs' ? '#f8f1e4' : '#e8b81a'} />
        </>
      )
    case 'ferme-nourrir':
      return <B p={[-0.25, 0.95, 0.3]} s={[0.24, 0.1, 0.24]} c="#c08a4a" />
    case 'ferme-traire':
      // The stool, the bowl under the goat, the goat standing still for it.
      return (
        <>
          <B p={[0, 0.2, 0]} s={[0.3, 0.06, 0.3]} c={WOOD} />
          <B p={[0, 0.09, 0]} s={[0.06, 0.18, 0.06]} c={WOOD} />
          <B p={[0, 0.05, 0.45]} s={[0.18, 0.1, 0.18]} c="#f8f9fa" />
          <B p={[0, 0.58, 0.6]} s={[0.62, 0.28, 0.28]} c="#f1e3c6" />
          <B p={[0.42, 0.75, 0.6]} s={[0.22, 0.2, 0.18]} c="#f1e3c6" />
          {[-0.22, 0.22].flatMap((x) => [-0.08, 0.08].map((z) => <B key={`${x}${z}`} p={[x, 0.22, 0.6 + z]} s={[0.06, 0.44, 0.06]} c="#e9ddc8" />))}
        </>
      )
    case 'ferme-labourer':
      if (!hire) return null
      // The motoculteur Kabako pushed by its handlebars, ahead of the Sim (the engine, the wheels, the tiller).
      return (
        <group position={[0, 0, 1.25]} rotation={[0, Math.PI, 0]}>
          <B p={[0, 0.55, 0]} s={[0.6, 0.45, 0.7]} c="#e8590c" />
          <B p={[0, 0.82, 0]} s={[0.45, 0.12, 0.5]} c="#343a40" />
          <B p={[-0.42, 0.35, 0]} s={[0.16, 0.7, 0.7]} c="#212529" />
          <B p={[0.42, 0.35, 0]} s={[0.16, 0.7, 0.7]} c="#212529" />
          <B p={[0, 0.9, -0.55]} s={[0.06, 0.06, 0.9]} c="#495057" rx={-0.3} />
          <B p={[0, 1.05, -0.95]} s={[0.66, 0.06, 0.06]} c="#495057" />
          <B p={[0, 0.25, 0.55]} s={[0.7, 0.3, 0.25]} c="#868e96" />
        </group>
      )
  }
  return null
}
