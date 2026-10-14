// Where things are in the 3D street, shared with the screen around it: the
// Sim, which way the camera looks, the places and the streets. The 3D scene
// writes it as it runs; the mini-map and the « Où aller ? » list read it.

type XZ = [number, number]

export const whereabouts = {
  sim: [0, 0] as XZ,
  /** Camera heading: the angle (radians) of the way the camera looks, on the ground. */
  heading: 0,
  places: [] as { id: string; kind: string; name: string; door: XZ }[],
  /** Street segments: from, to, width. */
  roads: [] as [XZ, XZ, number][],
  water: [] as XZ[][],
}

export const distanceTo = (p: XZ) => Math.hypot(p[0] - whereabouts.sim[0], p[1] - whereabouts.sim[1])

/** Direction of p seen from the Sim, relative to where the camera looks (0 = straight ahead, clockwise). */
export function bearingTo(p: XZ) {
  const a = Math.atan2(p[0] - whereabouts.sim[0], -(p[1] - whereabouts.sim[1]))
  return a - whereabouts.heading
}
