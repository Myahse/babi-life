// In the app (native/; React Native picks this file over device.ts): every phone is drawn as a small
// one (the lighter street: a smaller shadow map, fewer cars and passers-by, fewer chunks kept). The
// phone's GPU is driven through expo-gl, from the same JavaScript thread as the game and its views.
export const weakDevice = true

/** The Canvas resolution range for a scene (the app never draws above 1.25: native/src/shims/fiber.tsx). */
export const sceneDpr: [number, number] = [1, 1.25]
