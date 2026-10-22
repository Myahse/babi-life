// Where the game's server is (the web: VITE_API_URL at build time). The app
// (native/) has its own, env.native.ts, which React Native picks instead.
export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'
