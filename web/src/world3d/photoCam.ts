import { useSyncExternalStore } from 'react'

// The phone's camera, shared between the screen (screens/CameraView.tsx:
// the viewfinder, the buttons) and the 3D street (snapshot.tsx draws what
// the phone sees). Selfie: the phone held out in front of the Sim, turned
// back on it; photo: from the Sim's eyes, the way it faces. Aim: a drag on
// the viewfinder turns it (yaw) and tips it (pitch); zoom 1 to 3. Film: a
// Tikitoko clip, the phone on a stand a few steps ahead, the whole Sim in view.

export type PhotoMode = 'selfie' | 'photo' | 'film'
export const photoCam = { mode: null as PhotoMode | null, yaw: 0, pitch: 0, zoom: 1 }

const listeners = new Set<() => void>()
export function setPhotoMode(mode: PhotoMode | null) {
  photoCam.mode = mode
  photoCam.yaw = 0
  photoCam.pitch = 0
  photoCam.zoom = 1
  listeners.forEach((f) => f())
}
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
/** The camera's mode, for a component that changes with it. */
export const usePhotoMode = () => useSyncExternalStore(subscribe, () => photoCam.mode)
