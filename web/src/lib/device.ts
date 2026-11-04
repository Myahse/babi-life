// A small phone (little memory or few cores, as many Android phones in Abidjan):
// the 3D draws lighter there from the start (lower resolution, a smaller
// shadow map), before the performance monitor even has to step in.
const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number })
const detected = !!nav && ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4)

/** The player's choice in the settings (Réglages): « auto » (the phone decides), « leger », « beau ». */
export type Quality = 'auto' | 'leger' | 'beau'
export const QUALITY_KEY = 'babi.quality'
export const quality: Quality = (() => {
  try {
    const q = localStorage.getItem(QUALITY_KEY)
    return q === 'leger' || q === 'beau' ? q : 'auto'
  } catch {
    return 'auto'
  }
})()
/** Choose the quality: kept, and the game starts again with it (the 3D's sizes are set once, at the start). */
export function setQuality(q: Quality) {
  try {
    if (q === 'auto') localStorage.removeItem(QUALITY_KEY)
    else localStorage.setItem(QUALITY_KEY, q)
  } catch {
    /* private mode: stays as it is */
  }
  location.reload()
}

export const weakDevice = quality === 'leger' || (quality === 'auto' && detected)

/** The Canvas resolution range for a scene: never above 1.75, 1.25 on a small phone. */
export const sceneDpr: [number, number] = [1, weakDevice ? 1.25 : 1.75]
