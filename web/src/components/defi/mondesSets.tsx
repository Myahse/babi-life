import { Feu, Lampe, MondeMesh, Surface, banana, forestTree, ground, hearth, mortar, plasticChair, tarp, wall, table, type Monde, type MondeTier } from '../../world3d/mondes'

// « Mini-jeux réalistes », phase 2: the family scenes' sets (the baptism's courtyard, the family's
// moments), drawn with the props of world3d/mondes.tsx (pixel textures, chamfers, one merged mesh).
// Only mounted while the update is open; the scenes keep their plain sets otherwise.

/** A family courtyard's house along the back: plastered breeze-block, painted metal doors, barred windows, the tôle roof. */
function courHouse(m: Monde, x: number, z: number, w: number, paint: string, doors: string) {
  const h = 2.9
  m.box([x, h / 2, z], [w, h, 2.6], paint, 'banco', undefined, 0.02)
  m.box([x, 0.3, z + 1.31], [w, 0.6, 0.04], '#8a6a4a', 'banco', undefined, 0.02)
  const n = Math.max(2, Math.round(w / 3))
  for (let i = 0; i < n; i++) {
    const dx = x - w / 2 + (i + 0.5) * (w / n)
    m.box([dx - 0.55, 1.05, z + 1.32], [0.9, 2.0, 0.05], doors, 'tole', undefined, 0.03)
    m.box([dx + 0.6, 1.55, z + 1.32], [0.85, 0.75, 0.04], '#2a3038', 'tole', undefined, 0)
    for (let k = 0; k < 4; k++) m.box([dx + 0.29 + k * 0.2, 1.55, z + 1.35], [0.03, 0.75, 0.03], '#c8ccd0', 'tole', undefined, 0)
  }
  // The roof: corrugated sheets sloping back, the gutter's edge.
  m.box([x, h + 0.25, z + 0.1], [w + 0.4, 0.06, 3.1], '#9aa1a8', 'tole', [-0.16, 0, 0], 0.04)
  m.box([x, h - 0.05, z + 1.5], [w + 0.4, 0.12, 0.1], '#7a8088', 'tole', undefined, 0)
}

/** The baptism's courtyard: the cemented slab under the striped tarp, the ring of plastic chairs, the houses round it, the mango tree, the women's cooking corner (fire, pot, mortar), the food table and the speakers. */
export function BaptemeCour({ tier }: { tier: MondeTier }) {
  return (
    <>
      <MondeMesh
        tier={tier}
        seed="bapteme-cour"
        make={(m) => {
          ground(m, 0, 0, 22, 22, '#c98a52', 'terre')
          ground(m, 0, 0, 12.6, 10.6, '#bdb2a0', 'banco', 0.03)
          tarp(m, 0, 0, 12, 10, 3.4, '#5b9be0')
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2
            plasticChair(m, Math.cos(a) * 3.4, Math.sin(a) * 2.8, -a - Math.PI / 2, i % 2 ? '#e8590c' : '#1971c2')
          }
          // The compound: its walls, the houses along the back and the left side, the gate's gap at the front.
          wall(m, -9, -9, 9, -9, 2.2)
          wall(m, -9, -9, -9, 9, 2.2)
          wall(m, 9, -9, 9, 9, 2.2)
          wall(m, -9, 9, -2, 9, 2.2)
          wall(m, 2, 9, 9, 9, 2.2)
          courHouse(m, -1, -7.6, 13, '#e8d2a6', '#2b5a8a')
          m.box([-7.6, 1.45, 0.5], [2.6, 2.9, 9], '#d8c0a0', 'banco', undefined, 0.02)
          for (const z of [-2, 1.5, 4.5]) m.box([-6.28, 1.05, z], [0.05, 2.0, 0.9], '#7a2a2a', 'tole', undefined, 0.03)
          m.box([-7.5, 3.12, 0.5], [3.1, 0.06, 9.4], '#9aa1a8', 'tole', [0, 0, 0.16], 0.04)
          // The mango tree's shade, the banana plants by the wall.
          forestTree(m, 6.4, -6.2, 7.5, { lianas: 0, w: 0.55, crown: 3.6 })
          banana(m, 7.6, -2.4, 3)
          banana(m, 7.9, -0.4, 2.6)
          // The women's corner: the fire under the pot, the mortar with its pestle, the basins.
          hearth(m, 6.0, 4.6)
          mortar(m, 4.9, 6.0, 0.3)
          for (const [x, z, c] of [[6.9, 6.2, '#e03131'], [7.4, 5.4, '#1c7ed6'], [5.6, 7.0, '#2f9e44']] as [number, number, string][]) {
            m.box([x, 0.12, z], [0.62, 0.24, 0.62], c, 'plastique', undefined, 0.03)
            m.box([x, 0.2, z], [0.5, 0.06, 0.5], '#f1e7c8', 'cendre', undefined, 0.02)
          }
          // The food table under its wax cloth: the attiéké, the braised chicken, the bottles; the cooler, the speakers.
          table(m, -5.4, 4.2, 1.8, 0.8, 0.75, '#d9480f')
          m.box([-5.9, 0.86, 4.2], [0.5, 0.16, 0.5], '#f4efe0', 'cendre', undefined, 0.02)
          m.box([-5.2, 0.85, 4.2], [0.5, 0.14, 0.4], '#9a5a2a', 'cendre', undefined, 0.04)
          for (let k = 0; k < 4; k++) m.box([-4.75 + (k % 2) * 0.12, 0.92, 4.0 + Math.floor(k / 2) * 0.22], [0.07, 0.28, 0.07], k % 2 ? '#2b8a3e' : '#b8860b', 'plastique', undefined, 0)
          m.box([-4.0, 0.25, 5.1], [0.7, 0.5, 0.45], '#e8f0f8', 'plastique', undefined, 0.02)
          m.box([-4.0, 0.52, 5.1], [0.72, 0.06, 0.47], '#1c7ed6', 'plastique', undefined, 0.02)
          for (const z of [-3.2, -1.2]) {
            m.box([-6.9, 0.55, z], [0.6, 1.1, 0.5], '#1e1e22', 'plastique', undefined, 0)
            m.box([-6.58, 0.75, z], [0.02, 0.36, 0.36], '#3a3a40', 'filet', undefined, 0)
            m.box([-6.58, 0.3, z], [0.02, 0.22, 0.22], '#3a3a40', 'filet', undefined, 0)
          }
        }}
      />
      <Feu p={[6.0, 0, 4.6]} s={0.9} />
    </>
  )
}

/** The family's moments at home (a birthday, the newborn, a farewell): the courtyard behind the house, its wall, its mango tree; at evening a lamp. */
export function FamilleCour({ tier, evening }: { tier: MondeTier; evening: boolean }) {
  return (
    <>
      <MondeMesh
        tier={tier}
        seed="famille-cour"
        make={(m) => {
          ground(m, 0, 0, 18, 18, evening ? '#8a5a3c' : '#c98a52', 'terre')
          ground(m, 0, -0.5, 7, 5, evening ? '#8a7e6c' : '#c4b8a4', 'banco', 0.02)
          courHouse(m, 0, -4.6, 10, '#e9d8b8', '#2b5a8a')
          wall(m, -6, -6, -6, 7, 2)
          wall(m, 6, -6, 6, 7, 2)
          forestTree(m, -4.4, -2.7, 6.5, { lianas: 0, w: 0.45, crown: 3 })
          banana(m, 4.6, -2.4, 2.8)
          for (const [x, z, a, c] of [[-2.6, 1.6, 0.9, '#f1f3f5'], [2.7, 1.4, -0.9, '#f1f3f5'], [3.4, -1.2, -1.6, '#1971c2']] as [number, number, number, string][]) plasticChair(m, x, z, a, c)
          table(m, 3.6, 0.6, 1.0, 0.6, 0.72, '#c2255c')
          mortar(m, -4.6, 1.2, -0.3)
        }}
      />
      {evening && <Lampe p={[0, 2.5, -3.25]} color="#ffd08a" i={2.2} d={9} />}
    </>
  )
}

/**
 * The baby's room (BebeScene's Nursery): the tiled floor, the painted plaster walls, the louvred
 * window and its curtains, the woven mat under the play mat, the shelf of toys, the cot, the fan on
 * its stand, the basket and the bath basin.
 */
export function NurserySet({ tier }: { tier: MondeTier }) {
  return (
    <>
      <Surface kind="carrelage" color="#efe6d8" tier={tier} p={[0, -0.05, 0]} s={[9, 0.1, 10]} />
      <Surface kind="enduit" color="#ffd8b0" tier={tier} p={[0, 1.6, -4.2]} s={[9, 3.3, 0.1]} face="front" />
      <Surface kind="enduit" color="#ffcfa0" tier={tier} p={[-4.4, 1.6, 0]} s={[0.1, 3.3, 10]} face="side" />
      <Surface kind="enduit" color="#ffcfa0" tier={tier} p={[4.4, 1.6, 0]} s={[0.1, 3.3, 10]} face="side" />
      <MondeMesh
        tier={tier}
        seed="bebe-chambre"
        make={(m) => {
          // The window: the frame, the naco louvres (glass slats), the curtains either side, the sill.
          m.box([1.4, 1.75, -4.13], [1.6, 1.2, 0.05], '#f4f4f0', 'plastique', undefined, 0)
          for (let k = 0; k < 6; k++) m.box([1.4, 1.27 + k * 0.19, -4.08], [1.4, 0.14, 0.02], '#a9d3f0', 'plastique', [0.5, 0, 0], 0)
          for (const x of [0.4, 2.4]) m.box([x, 1.8, -4.05], [0.5, 1.6, 0.04], '#f08cae', 'rayure', undefined, 0.02)
          m.box([1.4, 2.62, -4.06], [2.4, 0.04, 0.04], '#c8a070', 'bois', undefined, 0)
          m.box([1.4, 1.12, -4.05], [1.7, 0.06, 0.16], '#f4f4f0', 'plastique', undefined, 0)
          // The skirting board.
          m.box([0, 0.06, -4.13], [8.8, 0.12, 0.04], '#f8f9fa', 'plastique', undefined, 0)
          // The woven mat (a natte) under the play mat and its foam squares.
          m.box([0, 0.006, 0], [2.4, 0.012, 2.4], '#d8b878', 'tissage', undefined, 0.02)
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) m.box([-0.6 + i * 0.4, 0.02, -0.6 + j * 0.4], [0.39, 0.02, 0.39], ['#74c0fc', '#ffd43b', '#ff8787', '#69db7c'][(i + j) % 4], 'plastique', undefined, 0.02)
          // The shelf of toys.
          m.box([-2.2, 0.45, -3.95], [1.4, 0.9, 0.4], '#f8f9fa', 'bois', undefined, 0.02)
          m.box([-2.2, 0.45, -3.74], [1.3, 0.02, 0.02], '#d0d4d8', 'bois', undefined, 0)
          m.box([-2.6, 1.0, -3.95], [0.22, 0.22, 0.22], '#ff6b6b', 'plastique')
          m.box([-2.25, 0.98, -3.95], [0.18, 0.18, 0.18], '#ffd43b', 'plastique')
          m.box([-1.85, 1.02, -3.95], [0.26, 0.26, 0.26], '#69db7c', 'plastique')
          m.box([-2.0, 0.28, -3.8], [0.3, 0.3, 0.25], '#e64980', 'tissage')
          // The cot in the corner: its posts, bars, the mattress and a wax blanket.
          const cx = -3.4
          const cz = -2.6
          m.box([cx, 0.45, cz], [1.3, 0.12, 0.75], '#f4f0e8', 'tissage', undefined, 0.02)
          m.box([cx, 0.53, cz], [1.2, 0.06, 0.65], '#5f3dc4', 'rayure', undefined, 0.02)
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box([cx + sx * 0.64, 0.5, cz + sz * 0.36], [0.06, 1.0, 0.06], '#c8a070', 'bois', undefined, 0)
          for (const sz of [-1, 1]) {
            m.box([cx, 0.97, cz + sz * 0.36], [1.3, 0.05, 0.05], '#c8a070', 'bois', undefined, 0)
            for (let k = 0; k < 9; k++) m.box([cx - 0.52 + k * 0.13, 0.75, cz + sz * 0.36], [0.025, 0.42, 0.025], '#d8b888', 'bois', undefined, 0)
          }
          // The fan on its stand, the basket, the bath basin.
          m.box([3.4, 0.03, -3.2], [0.4, 0.06, 0.4], '#e9ecef', 'plastique', undefined, 0)
          m.box([3.4, 0.6, -3.2], [0.05, 1.1, 0.05], '#e9ecef', 'plastique', undefined, 0)
          m.box([3.4, 1.2, -3.15], [0.5, 0.5, 0.14], '#74c0fc', 'filet', undefined, 0)
          m.box([3.0, 0.2, -1.6], [0.5, 0.4, 0.5], '#b8925a', 'tissage')
          m.box([3.2, 0.12, 0.6], [0.8, 0.24, 0.6], '#ff922b', 'plastique', undefined, 0.02)
        }}
      />
    </>
  )
}
