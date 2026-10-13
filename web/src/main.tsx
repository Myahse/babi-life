import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { App } from './App'
import { OfflineBanner } from './components/InstallButton'
import './lib/pwa'
import './index.css'
import './motion.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
      <BrowserRouter>
        <App />
        <OfflineBanner />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
