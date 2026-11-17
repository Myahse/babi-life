import { useMemo } from 'react'
import * as THREE from 'three'
import { BOARD, BOARD_Z, COURT, PITCH, PRO, type Game } from './game'
import { AdBoards, B, Bag, Bottle, boardStickersMat, Chair, Cooler, cracksMat, Decal, Dressing, lineWearMat, M, Mast, Mural, SideKit, stainsMat, steelMat, TM, Towel, wornMat } from './decor'

// « Mini-jeux réalistes », phase 2: the street matches' sets (streetball/decor.tsx's props placed
// round each ground). Each <…Set> is drawn only while the update is open (decor.tsx Dressing); the
// ground itself (scene.tsx, rue.tsx, panier.tsx, stadium.tsx, palais.tsx) is unchanged under it.
// Nothing here is in the play: it stands outside the lines, or lies flat on the ground.

const LINE_Y = 0.042

/** Wear along a straight painted line (the paint flecked off). */
function WornLine({ a, b, ground, w = 0.12 }: { a: [number, number]; b: [number, number]; ground: string; w?: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  return <Decal p={[(a[0] + b[0]) / 2, LINE_Y, (a[1] + b[1]) / 2]} w={len} d={w} m={lineWearMat(ground)} rot={Math.atan2(b[1] - a[1], b[0] - a[0])} />
}

/** Le foot de rue (rue.tsx): murals on the walls, the earth scuffed in front of the goals, the bags and bottles dropped in the far corners. */
export function RueSet({ g }: { g: Game }) {
  const F = g.field
  const [hx, hz] = [F.x + 0.12, F.z + 0.75]
  const endLen = hz - F.mouth - 0.1
  return (
    <Dressing>
      {(tier) => (
        <>
          {/* Two murals on the far wall (the crowd leans over them), one on an end wall each side */}
          <Mural p={[-6.2, 0.6, -hz + 0.006]} w={5.4} h={1.1} seed={0} />
          <Mural p={[5.6, 0.6, -hz + 0.006]} w={4.6} h={1.1} seed={3} />
          <Mural p={[-hx + 0.006, 0.52, -(F.mouth + 0.1 + endLen / 2)]} rot={Math.PI / 2} w={endLen - 0.4} h={0.95} seed={5} />
          <Mural p={[hx - 0.006, 0.52, F.mouth + 0.1 + endLen / 2]} rot={-Math.PI / 2} w={endLen - 0.4} h={0.95} seed={7} />
          {/* The earth worn bare and darker in front of each goal, at the kick-off */}
          {[-1, 1].map((s) => (
            <Decal key={s} p={[s * (F.x - 1.4), 0.03, 0]} w={3.2} d={3.4} m={wornMat('#6e4528')} rot={Math.PI / 2} />
          ))}
          <Decal p={[0, 0.03, 0]} w={2.4} d={2.2} m={wornMat('#6e4528')} />
          {/* The players' things in the far corners: bags, bottles, a pair of sandals */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <Bag p={[s * (hx - 0.55), 0, -hz + 0.35]} rot={s * 0.3} c={s > 0 ? '#1864ab' : '#212529'} band={s > 0 ? '#ffd43b' : '#e03131'} />
              {tier !== 'simple' && (
                <>
                  <Bottle p={[s * (hx - 1.05), 0, -hz + 0.25]} k={s > 0 ? 0 : 2} />
                  <Bottle p={[s * (hx - 1.2), 0.035, -hz + 0.42]} k={1} down />
                  <B p={[s * (hx - 0.6), 0.015, -hz + 0.8]} s={[0.1, 0.03, 0.26]} m={M('#e8590c')} cast={false} />
                  <B p={[s * (hx - 0.46), 0.015, -hz + 0.84]} s={[0.1, 0.03, 0.26]} m={M('#e8590c')} r={[0, 0.3, 0]} cast={false} />
                </>
              )}
            </group>
          ))}
        </>
      )}
    </Dressing>
  )
}

/** Le basket de rue (panier.tsx): the slab cracked and stained, stickers on the board, murals on the side walls, the bags, bottles and chairs by the bench. */
export function PanierSet() {
  const WALL = { back: -8.45, side: 8.72, end: 6.2 }
  const sideLen = WALL.end - WALL.back
  return (
    <Dressing>
      {(tier) => (
        <>
          <Decal p={[-3.5, 0.024, 1.5]} w={5} d={5} m={cracksMat(0)} rot={0.4} />
          <Decal p={[4.2, 0.024, -2.5]} w={4.5} d={4.5} m={cracksMat(1)} rot={2.1} />
          <Decal p={[1.5, 0.024, 5.2]} w={4} d={3} m={cracksMat(2)} rot={1.1} />
          <Decal p={[-4.5, 0.025, -5.5]} w={3} d={3} m={stainsMat()} />
          <Decal p={[3, 0.025, 3]} w={3} d={3} m={stainsMat()} rot={1.3} />
          {/* The stickers on the board's front */}
          <mesh position={[0, BOARD.y + BOARD.h / 2, BOARD_Z - 0.008]} material={boardStickersMat(1)}>
            <planeGeometry args={[1.5, BOARD.h - 0.08]} />
          </mesh>
          <Mural p={[-WALL.side + 0.11, 0.52, (WALL.back + WALL.end) / 2 + 2.5]} rot={Math.PI / 2} w={sideLen * 0.4} h={0.95} seed={1} />
          <Mural p={[WALL.side - 0.11, 0.52, (WALL.back + WALL.end) / 2 - 2.5]} rot={-Math.PI / 2} w={sideLen * 0.4} h={0.95} seed={6} />
          {/* By the bench outside the right wall: the bags, the bottles, the cooler; two chairs by the sound system */}
          <Bag p={[WALL.side + 2.1, 0, -1.6]} rot={1.3} c="#212529" band="#ff8200" />
          <Bag p={[WALL.side + 2.15, 0, -0.4]} rot={1.8} c="#5f3dc4" band="#ffffff" open />
          <Chair p={[-WALL.side - 1.8, 0, 5.2]} rot={1.9} c="#2f9e44" />
          {tier !== 'simple' && (
            <>
              <Chair p={[-WALL.side - 1.6, 0, 3.9]} rot={1.4} c="#f1f3f5" />
              <Cooler p={[WALL.side + 1.4, 0, 0.8]} rot={0.4} />
              <Bottle p={[WALL.side + 1.5, 0.45, -1.4]} k={0} />
              <Bottle p={[WALL.side + 1.45, 0.45, -0.3]} k={2} />
              <Bottle p={[WALL.side + 1.9, 0, 0.2]} k={1} />
              <Towel p={[WALL.side + 1.5, 0.45, -0.9]} c="#ff8787" />
            </>
          )}
        </>
      )}
    </Dressing>
  )
}

/** The maracana (scene.tsx Pitch): masts at the corners, the benches and their bags on the far side, banners on the fence, the grass worn in the goalmouths, the lines scuffed. */
export function PitchSet({ night }: { night: boolean }) {
  const { x, z } = PITCH
  return (
    <Dressing>
      {(tier) => (
        <>
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Mast key={`${sx}${sz}`} p={[sx * (x + 3), 0, sz * (z + 2.4)]} face={Math.atan2(-sx, -sz)} h={10} cols={3} rows={2} lit={night} />))}
          <SideKit p={[-6, 0, -z - 0.6]} rot={Math.PI} len={3} seed="a" band="#ff8200" />
          <SideKit p={[6, 0, -z - 0.6]} rot={Math.PI} len={3} seed="b" bag="#00543a" band="#ffffff" />
          <AdBoards a={[-x + 1, -z - 1.0]} b={[-10, -z - 1.0]} h={0.8} seed={0} />
          <AdBoards a={[10, -z - 1.0]} b={[x - 1, -z - 1.0]} h={0.8} seed={3} />
          {[-1, 1].map((s) => (
            <Decal key={s} p={[s * (x - 1.6), 0.036, 0]} w={3.6} d={4.2} m={wornMat()} rot={Math.PI / 2} />
          ))}
          <Decal p={[0, 0.036, 0]} w={1.6} d={1.4} m={wornMat()} />
          {tier !== 'simple' && (
            <>
              {[-1, 1].map((s) => (
                <Decal key={s} p={[s * (x - 6), 0.036, 0]} w={1.2} d={1.2} m={wornMat()} />
              ))}
              <WornLine a={[-x, -z]} b={[x, -z]} ground="#4aa956" />
              <WornLine a={[-x, z]} b={[x, z]} ground="#4aa956" />
              <WornLine a={[0, -z]} b={[0, z]} ground="#4aa956" />
            </>
          )}
        </>
      )}
    </Dressing>
  )
}

/** The quarter's court (scene.tsx Court): cracks and stains in the asphalt, the board's stickers, the bags and bottles on the benches along the sides, chairs. */
export function CourtSet() {
  const { x, z0, z1 } = COURT
  return (
    <Dressing>
      {(tier) => (
        <>
          <Decal p={[-3, 0.031, 2]} w={5} d={5} m={cracksMat(0)} rot={0.8} />
          <Decal p={[4, 0.031, -1]} w={4} d={4} m={cracksMat(2)} rot={2.3} />
          <Decal p={[0.5, 0.031, 5.5]} w={3} d={2.5} m={stainsMat()} />
          <WornLine a={[-x, z1]} b={[x, z1]} ground="#2c6aa0" />
          <WornLine a={[-x, z0]} b={[x, z0]} ground="#2c6aa0" />
          <mesh position={[0, BOARD.y + BOARD.h / 2, BOARD_Z + 0.004]} material={boardStickersMat(0)}>
            <planeGeometry args={[BOARD.w - 0.1, BOARD.h - 0.1]} />
          </mesh>
          <SideKit p={[-x - 0.75, 0, 1.5]} rot={-Math.PI / 2} len={2.4} seed="c" band="#ff7a00" />
          <SideKit p={[x + 0.75, 0, 1.5]} rot={Math.PI / 2} len={2.4} seed="d" bag="#1d4ed8" band="#ffffff" />
          {tier !== 'simple' && (
            <>
              <Chair p={[-x - 0.6, 0, -4.5]} rot={Math.PI / 2 + 0.3} c="#2f9e44" />
              <Chair p={[x + 0.6, 0, -4.8]} rot={-Math.PI / 2 - 0.2} c="#e03131" />
              <Bottle p={[-x - 0.4, 0, -3.8]} k={3} />
            </>
          )}
        </>
      )}
    </Dressing>
  )
}

/** The stadium (stadium.tsx): the masts with their banks of lamps, the dugouts, the boards of the brands, seats on the steps, the goalmouths worn. */
export function StadiumSet({ g, night }: { g: Game; night: boolean }) {
  const F = g.field
  return (
    <Dressing>
      {(tier) => (
        <>
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Mast key={`${sx}${sz}`} p={[sx * (F.x + 22), 0, sz * (F.z + 22)]} face={Math.atan2(-sx, -sz)} h={34} cols={5} rows={3} lit={night} scale={2.4} />))}
          {/* The boards round the pitch, brand by brand */}
          <AdBoards a={[-F.x - 4, -F.z - 4]} b={[F.x + 4, -F.z - 4]} h={1} len={6} />
          <AdBoards a={[-F.x - 5, F.z]} b={[-F.x - 5, -F.z]} h={1} len={6} seed={2} />
          <AdBoards a={[F.x + 5, -F.z]} b={[F.x + 5, F.z]} h={1} len={6} seed={5} />
          {/* The dugouts on the far side: the shelter, its seats, the bags and bottles */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 9, 0, -F.z - 2.4]}>
              <B p={[0, 1.1, -0.7]} s={[6, 2.2, 0.1]} m={steelMat('#1f2933')} />
              <B p={[0, 2.2, -0.15]} s={[6.2, 0.08, 1.4]} m={M('#adb5bd')} />
              {[-3, 3].map((x) => (
                <B key={x} p={[x, 1.1, -0.15]} s={[0.08, 2.2, 1.2]} m={steelMat('#1f2933')} />
              ))}
              <B p={[0, 0.25, -0.35]} s={[5.6, 0.5, 0.5]} m={M(s > 0 ? '#009e60' : '#ff8200')} />
              <B p={[0, 0.65, -0.58]} s={[5.6, 0.4, 0.06]} m={M(s > 0 ? '#00854f' : '#e06f00')} />
              <Bag p={[-1.6, 0, 0.3]} rot={0.2} c="#212529" band={s > 0 ? '#009e60' : '#ff8200'} />
              <Bag p={[1.2, 0, 0.35]} rot={-0.3} c="#212529" band={s > 0 ? '#009e60' : '#ff8200'} />
              {tier !== 'simple' && (
                <>
                  <Cooler p={[3.6, 0, 0.2]} c="#f08c00" />
                  {[0, 1, 2, 3, 4].map((k) => (
                    <Bottle key={k} p={[-2.6 + k * 0.12, 0, 0.6 + (k % 2) * 0.1]} k={k} />
                  ))}
                  <Towel p={[0.4, 0.51, -0.35]} />
                </>
              )}
            </group>
          ))}
          {/* The seats' backs in rows on every step of the stands */}
          <StandSeats g={g} />
          {/* The goalmouths worn to the earth, the penalty spots, the centre */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <Decal p={[s * (F.x - 2.8), 0.04, 0]} w={7} d={6} m={wornMat()} rot={Math.PI / 2} />
              {tier !== 'simple' && <Decal p={[s * (F.x - F.spot), 0.04, 0]} w={1.6} d={1.6} m={wornMat()} />}
            </group>
          ))}
          <Decal p={[0, 0.04, 0]} w={2.2} d={2} m={wornMat()} />
        </>
      )}
    </Dressing>
  )
}

/** The Palais des Sports (palais.tsx): the benches' towels and bottles, the bags under them, chairs and screens at the scorers' table, boards along the ends. */
export function PalaisSet() {
  const bz = -(PRO.z + 1.9)
  return (
    <Dressing>
      {(tier) => (
        <>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 7.5, 0, bz]}>
              {[-2.2, -0.6, 1.2].map((x, k) => (
                <Bag key={x} p={[x, 0, -0.55]} rot={0.1 * k} c="#141416" band={s > 0 ? '#f77f00' : '#15803d'} />
              ))}
              {tier !== 'simple' &&
                [-2.6, -1.4, -0.2, 1.0, 2.2].map((x, k) => (
                  <group key={x}>
                    <Towel p={[x, 0.5, 0]} c={k % 2 ? '#f8f9fa' : s > 0 ? '#f77f00' : '#15803d'} />
                    <Bottle p={[x + 0.35, 0, 0.42]} k={k} />
                  </group>
                ))}
              {tier !== 'simple' && <Cooler p={[3.4, 0, 0.1]} c={s > 0 ? '#f77f00' : '#15803d'} />}
            </group>
          ))}
          {/* At the scorers' table: chairs, the screens, the buzzer */}
          {[-2, -0.7, 0.7, 2].map((x) => (
            <Chair key={x} p={[x, 0, -(PRO.z + 2.3)]} c="#212529" />
          ))}
          {tier !== 'simple' &&
            [-1.6, 0, 1.6].map((x) => (
              <group key={x} position={[x, 0.9, -(PRO.z + 1.75)]}>
                <B p={[0, 0.16, 0]} s={[0.5, 0.32, 0.03]} m={M('#212529')} r={[-0.15, 0, 0]} />
                <B p={[0, 0.16, 0.017]} s={[0.44, 0.26, 0.005]} m={M('#3b5bdb')} r={[-0.15, 0, 0]} cast={false} />
              </group>
            ))}
          {/* Boards along the ends, behind the stanchions */}
          {[-1, 1].map((s) => (
            <AdBoards key={s} a={[s * (PRO.x + 2.9), -s * 6]} b={[s * (PRO.x + 2.9), s * 6]} h={0.9} len={3} seed={s > 0 ? 1 : 4} />
          ))}
          <WornLine a={[0, -PRO.z]} b={[0, PRO.z]} ground="#c9a06a" w={0.11} />
        </>
      )}
    </Dressing>
  )
}

/** A row of seat backs, in one colour, seen from the pitch: transparent between the seats. */
function seatsMat(c: string) {
  const m = TM(
    `seats${c}`,
    32,
    32,
    (g) => {
      g.clearRect(0, 0, 32, 32)
      g.fillStyle = c
      g.fillRect(2, 4, 28, 22)
      g.fillStyle = 'rgba(255,255,255,0.25)'
      g.fillRect(2, 4, 28, 3)
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.fillRect(2, 22, 28, 4)
      g.fillStyle = 'rgba(0,0,0,0.45)'
      g.fillRect(4, 26, 24, 6)
    },
    { alphaTest: 0.4 },
  )
  m.map!.wrapS = THREE.RepeatWrapping
  return m
}
const SEAT_COLORS = ['#ff9a2e', '#ffffff', '#12b874']

/** The seats on the stadium's steps (the same steps as stadium.tsx Stands): a strip of backs at the front of each step. */
function StandSeats({ g }: { g: Game }) {
  const F = g.field
  const strips = useMemo(() => {
    const out: { p: [number, number, number]; rot: number; len: number; c: string }[] = []
    const sides: { len: number; off: number; along: 'x' | 'z'; sign: number; tiers: number }[] = [
      { len: F.x * 2 + 26, off: F.z + 12, along: 'x', sign: -1, tiers: 3 },
      { len: F.z * 2 + 18, off: F.x + 13, along: 'z', sign: -1, tiers: 3 },
      { len: F.z * 2 + 18, off: F.x + 13, along: 'z', sign: 1, tiers: 3 },
      { len: F.x * 2 + 26, off: F.z + 12, along: 'x', sign: 1, tiers: 1 },
    ]
    for (const s of sides)
      for (let t = 0; t < s.tiers; t++)
        for (let row = 0; row < 3; row++) {
          const d = s.off + t * 7 + row * 2.1 + 0.45
          const y = 2.2 + t * 3.2 + row * 0.9 + 0.25
          const c = SEAT_COLORS[t % 3]
          // Facing the pitch: the far side looks +z, the near -z, the ends ±x.
          if (s.along === 'x') out.push({ p: [0, y, s.sign * d], rot: s.sign < 0 ? 0 : Math.PI, len: s.len, c })
          else out.push({ p: [s.sign * d, y, 0], rot: s.sign < 0 ? Math.PI / 2 : -Math.PI / 2, len: s.len, c })
        }
    return out.map((u) => {
      const geo = new THREE.PlaneGeometry(u.len, 0.5)
      const uv = geo.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (u.len / 0.5))
      return { ...u, geo }
    })
  }, [F])
  return (
    <>
      {strips.map((u, i) => (
        <mesh key={i} geometry={u.geo} position={u.p} rotation={[0, u.rot, 0]} material={seatsMat(u.c)} />
      ))}
    </>
  )
}
