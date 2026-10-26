import { _roots, type RootState } from '@react-three/fiber'

// A full-screen game over the world (the street fight, the race): the world's
// 3D scenes underneath stop drawing while it runs (a phone has enough with
// one), and start again as they were when it's over.

/** Holds every scene but the one drawn on `keep`; returns what lets them go again. */
export function holdScenes(keep: HTMLCanvasElement): () => void {
  const held: [RootState['setFrameloop'], RootState['frameloop']][] = []
  for (const [canvas, root] of _roots) {
    if (canvas === keep) continue
    const s = root.store.getState()
    if (s.frameloop === 'never') continue
    held.push([s.setFrameloop, s.frameloop])
    s.setFrameloop('never')
  }
  return () => held.forEach(([set, was]) => set(was))
}
