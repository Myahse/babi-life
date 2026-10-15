import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './store/session'
import { useWorld } from './store/world'
import { Title } from './screens/Title'
import { Plumbob } from './components/ui'

// Each screen is its own download: the title screen opens without the 3D
// game, and the game without the creator.
const CreateSim = lazy(() => import('./screens/CreateSim').then((m) => ({ default: m.CreateSim })))
const Play = lazy(() => import('./screens/Play').then((m) => ({ default: m.Play })))
const Waitlist = lazy(() => import('./screens/Waitlist').then((m) => ({ default: m.Waitlist })))
const LookEditor = lazy(() => import('./screens/LookEditor').then((m) => ({ default: m.LookEditor })))
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })))

const Loading = () => (
  <div className="grid h-full place-items-center bg-[var(--color-night)]">
    <Plumbob size={24} />
  </div>
)

export function App() {
  const token = useSession((s) => s.token)
  const { world, error, load } = useWorld()
  const path = useLocation().pathname

  useEffect(() => {
    load()
  }, [load])

  // The wish list is open to everyone, signed in or not, even if the API is down.
  if (path === '/liste')
    return (
      <Suspense fallback={<Loading />}>
        <Waitlist />
      </Suspense>
    )

  if (!world && !error) return <Loading />

  if (!token || !world) {
    return (
      <Routes>
        <Route path="*" element={<Title />} />
      </Routes>
    )
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/creer" element={<CreateSim />} />
        <Route path="/jeu" element={<Play />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/look" element={<LookEditor />} />
        <Route path="*" element={<Navigate to="/jeu" replace />} />
      </Routes>
    </Suspense>
  )
}
