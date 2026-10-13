import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Installable app: the service worker caches the shell and updates itself;
// these hooks offer installation and tell when the network is gone.

registerSW({ immediate: true })

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // we show our own button
  deferred = e as InstallEvent
  listeners.forEach((f) => f())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach((f) => f())
})

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
/** iPhone and iPad Safari never fire beforeinstallprompt: they install from the Share menu. */
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function useInstall() {
  const [, render] = useState(0)
  useEffect(() => {
    const f = () => render((n) => n + 1)
    listeners.add(f)
    return () => void listeners.delete(f)
  }, [])
  const installed = standalone()
  return {
    /** 'prompt' = we can show the browser's install dialog; 'ios' = show the Share-menu steps. */
    mode: installed ? null : deferred ? ('prompt' as const) : ios() ? ('ios' as const) : null,
    async install() {
      if (!deferred) return false
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      listeners.forEach((f) => f())
      return outcome === 'accepted'
    },
  }
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
