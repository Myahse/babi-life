// A stadium's running track (landmarks.tsx Stadium): the lane round the
// pitch that the joggers run, and the tunnel in from its front, under the
// stands. In the stadium's own frame: +z is its front, the street's side
// where its door is.

type XZ = [number, number]
/** The lane's half-axes, and the tunnel: across the front (x), its mouth outside the wall, its mouth on the track. */
export type Track = { rx: number; rz: number; tunnel: number; out: number; in: number }

export const STADIUM_TRACKS: Record<string, Track> = {
  // Stade Félix-Houphouët-Boigny: 2 m inside the stands' wall (65 by 52 m); the tunnel off the
  // middle, between two of the roof's masts.
  'plateau-stade': { rx: 63, rz: 50, tunnel: 6, out: 82, in: 51 },
}

/** The lane at angle th (0: the front, +z; going round towards +x), in the stadium's frame. */
export const lanePoint = (t: Track, th: number): XZ => [t.rx * Math.sin(th), t.rz * Math.cos(th)]
/** How far along the lane one radian goes there (metres). */
export const laneStretch = (t: Track, th: number) => Math.hypot(t.rx * Math.cos(th), t.rz * Math.sin(th))
/** Where the lane meets the tunnel. */
export const laneStart = (t: Track) => Math.asin(t.tunnel / t.rx)
/** From the stadium's frame to the street's: its middle at `at`, turned `rot` (as its group is). */
export const toWorld = (at: XZ, rot: number, [x, z]: XZ): XZ => [at[0] + x * Math.cos(rot) + z * Math.sin(rot), at[1] - x * Math.sin(rot) + z * Math.cos(rot)]
