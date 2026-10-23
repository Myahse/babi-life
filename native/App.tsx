// The browser's world (window, document, localStorage, fetch's page address…) before any game code reads it.
import './src/dom/globals'
import { useEffect, useState, useSyncExternalStore, type ComponentType } from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Font from 'expo-font'
import { loadStorage } from './src/dom/globals'
import { history } from './src/dom/history'
import { LayerHost } from './src/dom/portal'
import { Document } from './src/dom/elements'
import { gameBack } from '@web/lib/native'
import { paintFonts } from './src/fonts'

// Babi Life on the phone: the website's game itself (web/src), drawn by React
// Native (src/dom turns its HTML into views, src/shims its web packages into
// the phone's). Nothing of the game is written twice.

void SplashScreen.preventAutoHideAsync()

// The fonts by the names theme.ts gives them, for the views; and for the canvas (Skia), by family and weight.
// (Each file by itself: a family's package holds every weight, and the app takes only these.)
const Nunito_400Regular = require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf')
const Nunito_600SemiBold = require('@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf')
const Nunito_700Bold = require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf')
const Nunito_800ExtraBold = require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf')
const Nunito_900Black = require('@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf')
const Baloo2_600SemiBold = require('@expo-google-fonts/baloo-2/600SemiBold/Baloo2_600SemiBold.ttf')
const Baloo2_700Bold = require('@expo-google-fonts/baloo-2/700Bold/Baloo2_700Bold.ttf')
const Baloo2_800ExtraBold = require('@expo-google-fonts/baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf')
const Anton_400Regular = require('@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf')
const AlfaSlabOne_400Regular = require('@expo-google-fonts/alfa-slab-one/400Regular/AlfaSlabOne_400Regular.ttf')
const Caveat_700Bold = require('@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf')
const FONTS = { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold, Anton_400Regular, AlfaSlabOne_400Regular, Caveat_700Bold }
const PAINT: [string, number, number][] = [
  ['Nunito', 400, Nunito_400Regular],
  ['Nunito', 600, Nunito_600SemiBold],
  ['Nunito', 700, Nunito_700Bold],
  ['Nunito', 800, Nunito_800ExtraBold],
  ['Nunito', 900, Nunito_900Black],
  ['Baloo 2', 600, Baloo2_600SemiBold],
  ['Baloo 2', 700, Baloo2_700Bold],
  ['Baloo 2', 800, Baloo2_800ExtraBold],
  ['Anton', 400, Anton_400Regular],
  ['Alfa Slab One', 400, AlfaSlabOne_400Regular],
  ['Caveat', 700, Caveat_700Bold],
]

type Game = { App: ComponentType; OfflineBanner: ComponentType; Onboarding: typeof import('./src/Onboarding').Onboarding; onboarded: () => boolean; PortraitHost?: ComponentType }

export default function Root() {
  const [game, setGame] = useState<Game | null>(null)
  // location.reload() (globals.ts): the game drawn anew from its start.
  const [round, setRound] = useState(0)

  useEffect(() => {
    let live = true
    ;(async () => {
      // The saved session and settings first: the game's stores read them as they're made.
      await Promise.all([loadStorage(), Font.loadAsync(FONTS), paintFonts(PAINT).catch(() => undefined)])
      // (After the storage: the game's modules read what's saved as they load.)
      const [{ App }, { OfflineBanner }, { startClockSync }, { Onboarding, onboarded }, portrait] = await Promise.all([import('@web/App'), import('@web/components/InstallButton'), import('@web/lib/worldClock'), import('./src/Onboarding'), import('@web/avatar/portrait')])
      startClockSync()
      // (The Sims' pictures are drawn in a GL view of the app's own: portrait.native.tsx. A browser's look at the app has the web's.)
      const PortraitHost = (portrait as { PortraitHost?: ComponentType }).PortraitHost
      if (live) setGame({ App, OfflineBanner, Onboarding, onboarded, PortraitHost })
      void SplashScreen.hideAsync()
    })()
    const reload = () => setRound((r) => r + 1)
    window.addEventListener('__reload', reload)
    return () => {
      live = false
      window.removeEventListener('__reload', reload)
    }
  }, [])

  // The phone's back button: the game closes what's open; else its history goes back; at its start the app leaves.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (gameBack()) return true
      if (history.index > 0) {
        history.back()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [])

  const where = useSyncExternalStore(history.listen, () => history.location)
  const [, seen] = useState(0)

  if (!game) return <View style={styles.root} />
  const { App, OfflineBanner, Onboarding, onboarded, PortraitHost } = game
  // The app's welcome (Onboarding.tsx) on its first opening; and never the website's wish list page.
  const welcome = where.pathname === '/liste' || (!onboarded() && history.index === 0)
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {PortraitHost && <PortraitHost />}
      <View key={round} style={StyleSheet.absoluteFill}>
        {welcome ? (
          <Onboarding done={() => seen((n) => n + 1)} />
        ) : (
          <Document>
            <App />
            <OfflineBanner />
          </Document>
        )}
      </View>
      <LayerHost />
    </View>
  )
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#15161c' } })
