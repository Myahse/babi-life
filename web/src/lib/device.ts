// A small phone (little memory or few cores, as many Android phones in Abidjan):
// the 3D draws lighter there from the start (lower resolution, a smaller
// shadow map), before the performance monitor even has to step in.
const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number })
export const weakDevice = !!nav && ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4)

/** The Canvas resolution range for a scene: never above 1.75, 1.25 on a small phone. */
export const sceneDpr: [number, number] = [1, weakDevice ? 1.25 : 1.75]
