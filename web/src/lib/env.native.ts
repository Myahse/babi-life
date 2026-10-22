// The app's server (native/, React Native picks this file over env.ts):
// EXPO_PUBLIC_API_URL at build time, else the game's own.
export const API_BASE: string = process.env.EXPO_PUBLIC_API_URL ?? 'https://babi-life-jnvy.onrender.com/api/v1'
