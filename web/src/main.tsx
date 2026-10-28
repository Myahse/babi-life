import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorScreen'
import { OfflineBanner } from './components/InstallButton'
import './lib/pwa'
// Played offline: sent before anything else once online (and answered on the phone till then).
import './lib/offlinePlay'
import { startClockSync } from './lib/worldClock'
import './index.css'
import './motion.css'

startClockSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <OfflineBanner />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
