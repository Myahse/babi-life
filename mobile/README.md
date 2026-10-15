# Babi Life : l'appli mobile (Flutter)

L'appli Android et iOS de Babi Life. Le jeu lui-même est le jeu web (`web/`), affiché en plein écran dans une vue web : chaque mise à jour du jeu arrive dans l'appli sans passer par le Play Store ou l'App Store. L'appli ajoute ce qu'un téléphone fait mieux qu'une page web.

## Ce que fait l'appli

| | |
| --- | --- |
| **Écran d'accueil** | La nuit sur Abidjan, le logo, « Ta vie. Ton quartier. Ton Babi. », le temps que le jeu se charge (`lib/game_screen.dart`, `Splash`). |
| **Le jeu** | `https://www.lifeinbabi.com` en plein écran (`InAppWebView`, WebGL, son sans toucher l'écran). |
| **Connexion Google** | Google refuse d'ouvrir sa connexion dans une vue web : dans l'appli, le bouton « Continuer avec Google » passe par la connexion Google du téléphone, qui rend un jeton ; le jeu l'envoie à l'API (`/auth/google`) comme sur le web (`lib/bridge.dart`, `web/src/lib/native.ts`). |
| **Partager** | Le partage (Profil) ouvre la feuille de partage du téléphone : WhatsApp d'abord. |
| **Position** | « Naître là où tu es » : le téléphone demande l'autorisation une fois (seule la commune est gardée). |
| **Bouton retour** | Revient en arrière dans le jeu ; au début, un second appui dans les 2 s quitte l'appli. |
| **Liens** | WhatsApp, les articles des infos, un numéro de téléphone : ouverts dans leur appli, pas dans le jeu. |
| **Hors connexion** | « Pas de connexion », avec « Réessayer » ; le jeu revient tout seul quand le réseau revient. |

Le jeu sait qu'il est dans l'appli : son agent utilisateur contient `BabiLifeApp/1.0` (`web/src/lib/native.ts`, `inApp()`), et il appelle l'appli par `window.flutter_inappwebview.callHandler('googleSignIn' | 'share')`. Les achats intégrés passeront par ce même pont.

## Construire

Flutter 3.47 (stable) et, pour Android, le SDK Android (plateforme 36).

```sh
cd mobile
flutter pub get
flutter test
flutter run                                   # sur un téléphone branché ou un émulateur
flutter build apk --release --split-per-abi   # build/app/outputs/flutter-apk/
flutter build appbundle --release             # pour le Play Store
```

Options au moment de construire :

```sh
--dart-define=GAME_URL=https://www.lifeinbabi.com        # où est le jeu (par défaut)
--dart-define=GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
```

`GOOGLE_WEB_CLIENT_ID` est l'identifiant **Web** de Google, le même que `GOOGLE_CLIENT_ID` sur l'API : le jeton de connexion est alors émis pour lui, et l'API l'accepte. Il faut aussi, dans Google Cloud Console :

- **Android** : un identifiant OAuth de type *Android*, avec le nom de paquet `com.lifeinbabi.babi_life` et l'empreinte SHA-1 de la clé de signature (`keytool -list -v -keystore …`) ;
- **iOS** : un identifiant OAuth de type *iOS* (bundle `com.lifeinbabi.babiLife`), à mettre dans `ios/Runner/Info.plist` (`GIDClientID`, et son schéma d'URL inversé dans `CFBundleURLTypes`).

L'icône vient du kit de lancement (`marketing/out/logos/babi-life-app-icon.png`) : `dart run flutter_launcher_icons` la refait.

## Publier

- **Play Store** : créer une clé de signature (`keytool -genkey -v -keystore babi-life.jks -keyalg RSA -keysize 2048 -validity 10000 -alias babi-life`), la déclarer dans `android/key.properties` (jamais dans git) et `android/app/build.gradle.kts`, puis `flutter build appbundle`. Pour l'instant, le build *release* est signé avec la clé de débogage : bon pour essayer, pas pour le Play Store.
- **App Store** : ouvrir `ios/Runner.xcworkspace` dans Xcode sur un Mac, choisir l'équipe, puis *Product → Archive*.
