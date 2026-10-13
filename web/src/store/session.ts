import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../lib/types'

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
    { name: 'ivoire-life-session' },
  ),
)
