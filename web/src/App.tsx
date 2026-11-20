import { lazy, Suspense, useEffect, useState } from 'react'
import { Splash } from './components/Splash'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from './store/session'
import { useWorld } from './store/world'
import { Title } from './screens/Title'
import { Legal } from './screens/Legal'
import { AccountDeletion } from './screens/AccountDeletion'
import { ResetPassword } from './screens/ResetPassword'
import { NotFound } from './screens/NotFound'
import { t } from './lib/i18n'
import { useFastStart } from './lib/features'
import { preloadGame, startGame } from './lib/fastStart'
import { Maintenance } from './components/Maintenance'

// Each screen is its own download: the title screen opens without the 3D
// game, and the game without the creator.
const CreateSim = lazy(() => import('./screens/CreateSim').then((m) => ({ default: m.CreateSim })))
const Play = lazy(() => import('./screens/Play').then((m) => ({ default: m.Play })))
const LookEditor = lazy(() => import('./screens/LookEditor').then((m) => ({ default: m.LookEditor })))
const PubPage = lazy(() => import('./screens/Pub').then((m) => ({ default: m.Pub })))
const PubFollow = lazy(() => import('./screens/Pub').then((m) => ({ default: m.PubFollow })))
const PubSend = lazy(() => import('./screens/Pub').then((m) => ({ default: m.PubSend })))
const Admin = lazy(() => import('./screens/Admin').then((m) => ({ default: m.Admin })))
const Tester = lazy(() => import('./screens/Tester'))
const Watch = lazy(() => import('./screens/Watch').then((m) => ({ default: m.Watch })))
const DonPage = lazy(() => import('./screens/Don').then((m) => ({ default: m.Don })))
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })))

const Loading = () => <Splash />

// The game's own addresses (the home, its sign-in, and the game's screens); any other path that isn't
// one of the public pages below is « Page introuvable ».
const GAME_PATHS = new Set(['/', '/jeu', '/creer', '/profil', '/look'])

export function App() {
  const token = useSession((s) => s.token)
  const { world, error, load } = useWorld()
  const { pathname, search } = useLocation()
  // « /jeu/ » is « /jeu ».
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname
  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [load])

  // The server not answering (its database stopped, a deploy gone wrong): a word after 15 s (the free
  // server wakes up in about a minute), the maintenance page after 75 s or a refusal, instead of a
  // loading that never ends.
  const [waitedS, setWaitedS] = useState(0)
  useEffect(() => {
    if (world) return
    const t0 = Date.now()
    const id = setInterval(() => setWaitedS(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [world])

  // The home and the game have the site's own title back (the public pages set theirs: it stayed on
  // « Supprimer son compte · Babi Life » after coming back home).
  useEffect(() => {
    if (GAME_PATHS.has(path)) document.title = t('Babi Life · Le jeu de la vie à Abidjan, gratuit et 100 % ivoirien')
  }, [path])

  // A lighter start (update « demarrage-rapide », lib/fastStart.ts): signed in, the game's code and the
  // Sim are asked now, beside the world, not after it; making one's perso, the game's code comes
  // meanwhile, once the creator is up (it's what follows).
  const fast = useFastStart()
  const playing = !!token && (path === '/jeu' || path === '/')
  useEffect(() => {
    if (!fast || !playing || world) return
    // No perso yet: straight to making one, without the game's code (the biggest download).
    startGame(true).then((sims) => !sims.length && navigate('/creer', { replace: true }), () => undefined)
  }, [fast, playing, world]) // eslint-disable-line react-hooks/exhaustive-deps
  const creating = fast && !!token && path === '/creer'
  useEffect(() => {
    if (!creating) return
    const t = setTimeout(preloadGame, 4000)
    return () => clearTimeout(t)
  }, [creating])

  // No more wish list: its old addresses (/liste, a link in an e-mail, a home-screen app installed
  // from it) lead to signing in, then the game.
  if (path === '/liste' || path.startsWith('/liste/')) return <Navigate to={{ pathname: '/', search }} replace />

  if (path === '/conditions' || path === '/confidentialite') return <Legal />
  // How to delete one's account, and asking for it without signing in (Google Play's public page), open to everyone.
  if (path === '/suppression-compte') return <AccountDeletion />
  if (path === '/mot-de-passe') return <ResetPassword />

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

  // Supporting Babi Life: a donation, open to everyone, signed in or not (screens/Don.tsx).
  if (path === '/don')
    return (
      <Suspense fallback={<Loading />}>
        <DonPage />
      </Suspense>
    )

  // A video sent in an e-mail (admin « E-mails »), open to everyone even before the game.
  if (path.startsWith('/regarder/'))
    return (
      <Suspense fallback={<Loading />}>
        <Watch id={decodeURIComponent(path.slice('/regarder/'.length))} />
      </Suspense>
    )

  // Anything else: no such page (still a 200, Vercel sends every path to index.html; « noindex » for the search engines).
  if (!GAME_PATHS.has(path)) return <NotFound />

  // Not signed in: the flat dancer, not three.js's download before the sign-in; the update
  // « demarrage-rapide » open, not even that: the sign-in at once, without waiting for the world.
  if (!world && (error || waitedS >= 75)) return <Maintenance />
  if (!world && !error && !(fast && !token)) return token ? (waitedS >= 15 ? <Splash label={t('Le serveur se réveille, encore quelques secondes…')} /> : <Loading />) : <Splash flat />

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
