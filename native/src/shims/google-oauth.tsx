import type { ReactNode } from 'react'

// Google's web sign-in: the app signs in with the phone's own (lib/native.native.ts), so
// the web's button never shows (inApp() is true) and its provider just holds the game.
export const GoogleOAuthProvider = ({ children }: { children?: ReactNode; clientId?: string }) => <>{children}</>
export const GoogleLogin = (_: Record<string, unknown>) => null
export const useGoogleLogin = (_?: Record<string, unknown>) => () => {}
export const googleLogout = () => {}
