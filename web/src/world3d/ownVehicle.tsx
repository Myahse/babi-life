import { Bicycle, Vehicle, type CarModel } from './vehicles'

// One's own vehicle as drawn everywhere (backend game/vehicles.go: its body and colour): under the Sim
// at the wheel (Walker), left at the kerb (open/parkedVehicle.tsx), and under another player who rides
// theirs, or left where they parked it (Players.tsx, sent live: lib/live.ts). One drawing for all, so a
// friend sees the very car one bought, not a car of their screen's choosing.

export type OwnKind = 'velo' | 'moto' | 'voiture'
/** What a Sim rides, as sent live (backend live/wheels.go Ride): its own vehicle, or a ride as a passenger (p). */
export type LiveRide = { k: OwnKind | 'taxi' | 'woro' | 'gbaka'; b?: string; c?: string; t?: string; p?: boolean }
/** One's own vehicle left in a street, as sent live (backend live/wheels.go Parked). */
export type LiveParked = { x: number; z: number; h: number; k: OwnKind; b?: string; c?: string }

/** A grown-up's bike at the Sim's size, and the rider on its saddle. */
export const BIKE_SCALE = 1.35
export const BIKE_SEAT = 0.82
/** Where the rider sits on a two-wheeler (its frame: +z its nose), and leans to the bars. */
export const saddle = (kind: 'velo' | 'moto'): { p: [number, number, number]; lean: number } => (kind === 'moto' ? { p: [0, 0.42, -0.25], lean: 0 } : { p: [0, BIKE_SEAT, -0.3], lean: 0.3 })

/** The cars whose glass can be seen through (vehicles.tsx Car4), and where the driver sits in them (its frame: +x its left, +z its nose). */
export const driverSeat = (body?: string): [number, number, number] | null => (body === 'saloon' ? [0.36, 0.32, 0.2] : body === 'suv' ? [0.4, 0.42, 0.05] : null)

/** A limousine's paint is its model's (white or black): the seed that gives the one chosen. */
const seedOf = (body: string | undefined, color: string) => (body === 'limo' ? (color === '#f4f4f2' ? 0 : 1) : 0)

/** The vehicle, its nose along +z (the way the Sim faces when on it). */
export function OwnVehicleBody({ kind, body, color, ridden, speed, crankAt, clear }: { kind: OwnKind; body?: string; color: string; /** One's own bike, ridden: its wheels turn with drive.ts. */ ridden?: boolean; /** Someone else's bike: how fast it goes (m/s). */ speed?: () => number; crankAt?: { current: number }; /** See-through glass where the model has it (driverSeat): the driver seen. */ clear?: boolean }) {
  return (
    <group rotation={[0, -Math.PI / 2, 0]} scale={kind === 'velo' ? BIKE_SCALE : 1}>
      {kind === 'voiture' ? (
        <Vehicle p={[0, 0, 0]} kind="car" model={(body || undefined) as CarModel | undefined} color={color} seed={seedOf(body, color)} crew={false} clear={clear} />
      ) : kind === 'moto' ? (
        <Vehicle p={[0, 0, 0]} kind="moto" color={color} crew={false} />
      ) : (
        <Bicycle color={color} ridden={ridden} speed={speed} crankAt={crankAt} />
      )}
    </group>
  )
}

/** What the Sim rides, for the others (lib/live.ts sends it): its own vehicle, or the ride it paid for; null on foot. */
export function liveRideOf(own: { kind: OwnKind; body: string; color: string } | null, ride: { kind: 'moto' | 'taxi' | 'woro' | 'gbaka'; color: string; trim?: string } | null): LiveRide | null {
  if (own) return { k: own.kind, b: own.kind === 'voiture' ? own.body : undefined, c: hex(own.color) }
  if (ride) return { k: ride.kind, c: hex(ride.color), t: ride.trim ? hex(ride.trim) : undefined, p: true }
  return null
}
// (The server takes #rrggbb only.)
const hex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : undefined)
