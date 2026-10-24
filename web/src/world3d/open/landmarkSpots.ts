import type { Pose } from '../../avatar/Human'

// Where an action is done in a landmark's grounds (landmarks.tsx), and the
// way some take through them. Without this, a thing picked at the zoo or on
// the Tour F's site was done where the Sim stood: the selfie « devant les
// lions » at the gate, the picnic at the ticket window, the day's labour on
// the pavement. All in the landmark's own frame (+z its front, the street's
// side; the Walker turns it into the street's metres with stadiumTrack's
// toWorld).

type XZ = [number, number]

/** A spot: the Sim walks there first (round the enclosures, through the gate), then does the thing turned `rot`. */
export type LandmarkSpot = { at: XZ; rot: number }
/**
 * A way: in by `entry` (a point inside the front, so the hoarding or the gate is passed straight),
 * then from point to point of `way`, at `speed` (m/s); at some points (their index in `way`) a stop,
 * turned a way, in a pose, for some seconds. At the end, round again from the first point (`loop`)
 * or back along the way.
 */
export type LandmarkRoute = { entry?: XZ; way: XZ[]; speed: number; stops: Record<number, { rot: number; pose: Pose; secs: number }>; loop?: boolean }

export const LANDMARK_SPOTS: Record<string, Record<string, LandmarkSpot>> = {
  'cocody-zoo': {
    // On the lawn by the family picnicking, under the big trees west of the gate's alley.
    'zoo-pique-nique': { at: [-44, 30], rot: 0.8 },
    // The selfie: back to the lions' cage (its wall at z -34), the phone held up toward the alley.
    'zoo-photos': { at: [0, -32.6], rot: 0 },
  },
}

export const LANDMARK_ROUTES: Record<string, Record<string, LandmarkRoute>> = {
  'cocody-zoo': {
    // Round the park's alleys, a stop at each enclosure to look (or film): the chimps, the elephants,
    // the hippos, the lions, the leopard, the hyenas, the crocodiles, the zebras; then from the gate again.
    'zoo-visite': {
      way: [[0, 36], [0, 3], [-24, 3], [-24, 8.5], [-8, 3], [-8.5, -12], [0, -14], [10.5, -16], [0, -22], [0, -32.5], [-30, -31], [-30, -34.5], [0, -31], [30, -31], [30, -33.5], [0, -31], [0, 3], [26, 4.5], [42, 3], [42, 22.5], [37, 23.5], [0, 22.5]],
      speed: 1.1,
      stops: {
        3: { rot: 0, pose: 'film', secs: 5 },
        5: { rot: -Math.PI / 2, pose: 'idle', secs: 5 },
        7: { rot: Math.PI / 2, pose: 'film', secs: 5 },
        9: { rot: Math.PI, pose: 'film', secs: 6 },
        11: { rot: Math.PI, pose: 'idle', secs: 4 },
        14: { rot: Math.PI, pose: 'idle', secs: 4 },
        17: { rot: 0, pose: 'film', secs: 5 },
        20: { rot: 0, pose: 'wave', secs: 5 },
      },
      loop: true,
    },
  },
  'plateau-tour-f': {
    // In by the hoarding's gate; the wheelbarrow filled at the sand (the pile at x -18, z 14), pushed to
    // the mixer truck (by the gate, x 9, z 16), tipped there, back to the sand; all day.
    'manoeuvre-tour-f': {
      entry: [0, 22],
      way: [[-14.2, 15.5], [6.4, 14]],
      speed: 1.25,
      stops: { 0: { rot: -Math.PI / 2, pose: 'busy', secs: 4.5 }, 1: { rot: Math.PI / 2, pose: 'busy', secs: 3 } },
      loop: true,
    },
  },
}

export const landmarkSpotFor = (place: string | null | undefined, act: string | undefined) => (place && act ? LANDMARK_SPOTS[place]?.[act] : undefined)
export const landmarkRouteFor = (place: string | null | undefined, act: string | undefined) => (place && act ? LANDMARK_ROUTES[place]?.[act] : undefined)
