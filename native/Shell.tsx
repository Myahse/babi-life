import { useCallback, useEffect, useRef, useState, type ComponentType, type RefAttributes } from 'react'
import { BackHandler, Linking, Pressable, Share, StyleSheet, Text, Vibration, View } from 'react-native'
import { WebView as AnyWebView, type WebViewMessageEvent } from 'react-native-webview'
import type { AndroidWebViewProps, ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Haptics from 'expo-haptics'
import * as Notifications from 'expo-notifications'
import * as ScreenOrientation from 'expo-screen-orientation'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'

// Babi Life on the phone: the website's game itself, in the phone's own Chrome (a web view, full
// screen), so it looks and runs as it does on lifeinbabi.com: the same views, the same buttons, the 3D
// drawn by Chrome's WebGL straight on the GPU. The app lends it what a web page can't do on a phone,
// through the channel web/src/lib/native.ts calls (« BabiApp »: {id, name, arg}, answered by
// window.__babiAnswer(id, result, error)): Google's sign-in (Google refuses it inside a web view),
// the notifications (Firebase), the share sheet, the haptics, turning the screen, and the back button
// (window.__babiBack closes what's open in the game first). The game knows it's in the app by its
// user agent (« BabiLifeApp »): no wish list, no GeniusPay, the app's sign-in.

void SplashScreen.preventAutoHideAsync()

/** The game's address (the website's, or another build's: EXPO_PUBLIC_GAME_URL). */
const GAME = process.env.EXPO_PUBLIC_GAME_URL ?? 'https://www.lifeinbabi.com/jeu'
const ORIGIN = GAME.replace(/^(https?:\/\/[^/]+).*$/, '$1')
/** The pages that stay in the app (the game's, and its server's); anything else opens in its own app (WhatsApp, the news, a phone number). */
const HOME = [ORIGIN, 'https://lifeinbabi.com', 'https://www.lifeinbabi.com']

// A notification while the game is open: shown as when it's closed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

// The channel, before the game's code runs; and what makes a page feel like an app: no tap flash, no
// text picked by a long press (but in the fields), no page bouncing past its ends, no zoom.
const BEFORE = `
(function () {
  window.BabiApp = { postMessage: function (m) { window.ReactNativeWebView.postMessage(m) } };
  var css = '*{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}' +
    'body{-webkit-user-select:none;user-select:none;overscroll-behavior:none}' +
    'input,textarea,[contenteditable]{-webkit-user-select:text;user-select:text}';
  function add() { var s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s) }
  if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  document.addEventListener('DOMContentLoaded', function () {
    var m = document.querySelector('meta[name=viewport]') || document.createElement('meta');
    m.name = 'viewport';
    m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    if (!m.parentNode) document.head.appendChild(m);
  });
})();
true;
`

let configured = false
/** Google sign-in by the phone: the ID token for /auth/google (the web client's), '' if cancelled. */
async function googleSignIn(): Promise<string> {
  if (!configured) {
    configured = true
    GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID })
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const r = await GoogleSignin.signIn()
    if (r.type !== 'success') return ''
    if (!r.data.idToken) throw new Error('no ID token')
    return r.data.idToken
  } catch (e) {
    const code = String((e as { code?: unknown }).code ?? '')
    console.warn(`[google sign-in] failed: code ${code}: ${(e as Error)?.message}`)
    if (code === statusCodes.SIGN_IN_CANCELLED || code === '12501') return ''
    // (The game says it to the player with this code: 10 is a signing key Google doesn't know, native/README.md.)
    throw new Error(`code ${code || '?'}`)
  }
}

/** The notifications: 'status' (granted, denied, default), or 'enable': asked, then this phone's Firebase token ('' none, 'denied' refused for good). */
async function notifications(what: string): Promise<string> {
  const p = await Notifications.getPermissionsAsync()
  if (what === 'status') return p.granted ? 'granted' : p.canAskAgain ? 'default' : 'denied'
  if (!p.granted && !p.canAskAgain) {
    await Linking.openSettings()
    return 'denied'
  }
  await Notifications.setNotificationChannelAsync('default', { name: 'Babi Life', importance: Notifications.AndroidImportance.HIGH, lightColor: '#FF7A00' })
  const r = p.granted ? p : await Notifications.requestPermissionsAsync()
  if (!r.granted) return r.canAskAgain ? '' : 'denied'
  try {
    return String((await Notifications.getDevicePushTokenAsync()).data)
  } catch {
    return ''
  }
}

/** The web view as Android has it (its typings join every platform's props, which this TypeScript makes « never »). */
type WebViewHandle = { injectJavaScript: (js: string) => void; goBack: () => void }
const WebView = AnyWebView as unknown as ComponentType<AndroidWebViewProps & RefAttributes<WebViewHandle>>

const IMPACT = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy } as const
function haptic(kind: string) {
  if (kind === 'success') return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => Vibration.vibrate([14, 50, 14]))
  if (kind === 'error') return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => Vibration.vibrate([30, 40, 30]))
  void Haptics.impactAsync(IMPACT[kind as keyof typeof IMPACT] ?? IMPACT.light).catch(() => Vibration.vibrate(12))
}

/** What the game asks of the app: the answer, or a failure's words. */
async function answer(name: string, arg: string | undefined): Promise<unknown> {
  switch (name) {
    case 'googleSignIn':
      return googleSignIn()
    case 'share':
      await Share.share({ message: arg ?? '' })
      return true
    case 'notifications':
      return notifications(arg ?? 'status')
    case 'haptic':
      return haptic(arg ?? 'light')
    case 'orientation':
      await ScreenOrientation.lockAsync(arg === 'landscape' ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP)
      return true
    case 'open':
      await Linking.openURL(arg ?? '')
      return true
  }
  throw new Error(`unknown: ${name}`)
}

/** The page a tapped notification leads to (« /jeu?app=gbairai »), or ''. */
const urlOf = (r: Notifications.NotificationResponse | null) => {
  const data = (r?.notification.request.content.data ?? {}) as { url?: string }
  const sent = (r?.notification.request.trigger as { remoteMessage?: { data?: { url?: string } } } | null)?.remoteMessage?.data
  return data.url || sent?.url || ''
}
const inGame = (url: string) => (url.startsWith('http') ? url : ORIGIN + (url.startsWith('/') ? url : '/' + url))

export default function Shell() {
  const web = useRef<WebViewHandle>(null)
  const back = useRef(false)
  const [failed, setFailed] = useState(false)
  // The first page: the game, or the one a notification tapped while the app was closed leads to.
  const [start] = useState(() => {
    const first = urlOf(Notifications.getLastNotificationResponse())
    return first ? inGame(first) : GAME
  })
  const [round, setRound] = useState(0)

  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`)

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    let m: { id?: number; name?: string; arg?: string }
    try {
      m = JSON.parse(e.nativeEvent.data)
    } catch {
      return
    }
    if (!m.name || m.name === 'closed') return
    if (m.name === 'back') {
      // The game had nothing open: back a page, or out of the app at its start.
      if (back.current) web.current?.goBack()
      else BackHandler.exitApp()
      return
    }
    try {
      const result = await answer(m.name, m.arg)
      if (m.id) run(`window.__babiAnswer(${m.id}, ${JSON.stringify(result ?? null)}, null)`)
    } catch (err) {
      if (m.id) run(`window.__babiAnswer(${m.id}, null, ${JSON.stringify((err as Error)?.message || 'error')})`)
    }
  }, [])

  // The phone's back button: the game closes what's open; else back a page; at its start, out of the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      run(`window.ReactNativeWebView.postMessage(JSON.stringify({name: window.__babiBack && window.__babiBack() ? 'closed' : 'back'}))`)
      return true
    })
    return () => sub.remove()
  }, [])

  // A notification tapped while the app runs: the game on its page.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = urlOf(r)
      if (url) run(`location.href = ${JSON.stringify(inGame(url))}`)
    })
    return () => sub.remove()
  }, [])

  // Pages of other sites (WhatsApp, the news, a payment's): in their own app, never in the game's view.
  const stay = (req: ShouldStartLoadRequest) => {
    const url = req.url
    if (req.isTopFrame === false || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true
    if (HOME.some((h) => url === h || url.startsWith(h + '/') || url.startsWith(h + '?'))) return true
    void Linking.openURL(url).catch(() => undefined)
    return false
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {failed ? (
        <View style={styles.offline}>
          <Text style={styles.title}>Pas de connexion</Text>
          <Text style={styles.text}>Babi Life a besoin d’internet. Vérifie ton réseau, puis réessaie.</Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              setFailed(false)
              setRound((r) => r + 1)
            }}
          >
            <Text style={styles.buttonText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={round}
          ref={web}
          source={{ uri: start }}
          style={styles.root}
          containerStyle={styles.root}
          applicationNameForUserAgent="BabiLifeApp/3"
          injectedJavaScriptBeforeContentLoaded={BEFORE}
          onMessage={onMessage}
          onNavigationStateChange={(n) => void (back.current = n.canGoBack)}
          onShouldStartLoadWithRequest={stay}
          onLoadEnd={() => void SplashScreen.hideAsync()}
          onError={() => {
            setFailed(true)
            void SplashScreen.hideAsync()
          }}
          // (The renderer killed by Android, short of memory: the game loaded again rather than a blank screen.)
          onRenderProcessGone={() => setRound((r) => r + 1)}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          geolocationEnabled
          mediaPlaybackRequiresUserAction={false}
          allowFileAccess={false}
          setSupportMultipleWindows={false}
          overScrollMode="never"
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          textZoom={100}
          androidLayerType="hardware"
          webviewDebuggingEnabled={__DEV__}
          thirdPartyCookiesEnabled
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#15161c' },
  offline: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#15161c' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  text: { color: '#c9cbd6', fontSize: 15, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#FF7A00', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
