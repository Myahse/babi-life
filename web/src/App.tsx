import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './store/session'
import { useWorld } from './store/world'
import { Title } from './screens/Title'
import { Legal } from './screens/Legal'
import { MoodPin } from './components/ui'
import { gameOpen } from './lib/launch'

// Each screen is its own download: the title screen opens without the 3D
// game, and the game without the creator.
const CreateSim = lazy(() => import('./screens/CreateSim').then((m) => ({ default: m.CreateSim })))
const Play = lazy(() => import('./screens/Play').then((m) => ({ default: m.Play })))
const Waitlist = lazy(() => import('./screens/Waitlist').then((m) => ({ default: m.Waitlist })))
const LookEditor = lazy(() => import('./screens/LookEditor').then((m) => ({ default: m.LookEditor })))
const PubPage = lazy(() => import('./screens/Pub').then((m) => ({ default: m.Pub })))
const PubFollow = lazy(() => import('./screens/Pub').then((m) => ({ default: m.PubFollow })))
const PubSend = lazy(() => import('./screens/Pub').then((m) => ({ default: m.PubSend })))
const Admin = lazy(() => import('./screens/Admin').then((m) => ({ default: m.Admin })))
const Tester = lazy(() => import('./screens/Tester'))
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })))

const Loading = () => (
  <div className="grid h-full place-items-center bg-[var(--color-night)]">
    <MoodPin size={24} />
  </div>
)

export function App() {
  const token = useSession((s) => s.token)
  const { world, error, load } = useWorld()
  const { pathname: path, search } = useLocation()

  useEffect(() => {
    load()
  }, [load])

  // The wish list is open to everyone, signed in or not, even if the API is down.
  if (path === '/liste' || path === '/liste/inscription')
    return (
      <Suspense fallback={<Loading />}>
        <Waitlist form={path === '/liste/inscription'} />
      </Suspense>
    )

  if (path === '/conditions' || path === '/confidentialite') return <Legal />

  // The team's admin (pub, reports, wish list), open even before the game; the old /pub/admin leads there.
  if (path === '/pub/admin') return <Navigate to="/admin?tab=pub" replace />
  // Testers open the whole game on their browser with the admin key (lib/launch.ts).
  if (path === '/testeur')
    return (
      <Suspense fallback={<Loading />}>
        <Tester />
      </Suspense>
    )
  if (path === '/admin')
    return (
      <Suspense fallback={<Loading />}>
        <Admin />
      </Suspense>
    )

  // Babi Pub: advertisers send their ads for the game's billboards, open to everyone even before the game.
  if (path === '/pub' || path.startsWith('/pub/'))
    return (
      <Suspense fallback={<Loading />}>
        {path.startsWith('/pub/envoi/') ? <PubSend code={decodeURIComponent(path.slice('/pub/envoi/'.length))} /> : path.startsWith('/pub/suivi/') ? <PubFollow token={decodeURIComponent(path.slice('/pub/suivi/'.length))} /> : <PubPage />}
      </Suspense>
    )

  // Making one's Sim from the wish list, before the game opens (it needs the world's data).
  if (path === '/liste/creer') {
    if (!world && !error) return <Loading />
    return <Suspense fallback={<Loading />}>{world ? <CreateSim waitlist /> : <Waitlist />}</Suspense>
  }

  // The streets are shut for everyone: the home page, a saved /jeu, an old install.
  if (!gameOpen) return <Navigate to={{ pathname: '/liste', search }} replace />

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
