import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { User } from '../lib/types'

// The session in the app (native/, React Native picks this file over session.ts): kept in the
// phone's storage instead of the browser's.

type SessionState = {
  token: string | null
  user: User | null
  signIn: (token: string, user: User) => void
  signOut: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      signIn: (token, user) => set({ token, user }),
      signOut: () => set({ token: null, user: null }),
    }),
    { name: 'ivoire-life-session', storage: createJSONStorage(() => AsyncStorage) },
  ),
)
