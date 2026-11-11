import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorScreen'
import { OfflineBanner } from './components/InstallButton'
import './lib/pwa'
// Played offline: sent before anything else once online (and answered on the phone till then).
import './lib/offlinePlay'
// Come by a friend's link (?p=code): its code kept for the sign-up.
import './lib/parrain'
import { startClockSync } from './lib/worldClock'
import './index.css'
import './motion.css'

startClockSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* (Google's own sign-in script comes only with its button, screens/Title.tsx: not on every screen of the game.) */}
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <OfflineBanner />
    </BrowserRouter>
  </StrictMode>,
)
