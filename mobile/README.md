# Babi Life : l'appli mobile (Flutter)

L'appli Android et iOS de Babi Life. Le jeu lui-même est le jeu web (`web/`), affiché en plein écran dans une vue web : chaque mise à jour du jeu arrive dans l'appli sans passer par le Play Store ou l'App Store. L'appli ajoute ce qu'un téléphone fait mieux qu'une page web.

## Ce que fait l'appli

| | |
| --- | --- |
| **Écran d'accueil** | La nuit sur Abidjan, le logo, « Ta vie. Ton quartier. Ton Babi. », le temps que le jeu se charge (`lib/game_screen.dart`, `Splash`). |
| **Le jeu** | `https://www.lifeinbabi.com` en plein écran (`webview_flutter`, WebGL, son sans toucher l'écran ; les fenêtres « confirmer » du jeu deviennent celles du téléphone). |
| **Connexion Google** | Google refuse d'ouvrir sa connexion dans une vue web : dans l'appli, le bouton « Continuer avec Google » passe par la connexion Google du téléphone, qui rend un jeton ; le jeu l'envoie à l'API (`/auth/google`) comme sur le web (`lib/bridge.dart`, `web/src/lib/native.ts`). |
| **Partager** | Le partage (Profil) ouvre la feuille de partage du téléphone : WhatsApp d'abord. |
| **Position** | « Naître là où tu es » : le téléphone demande l'autorisation une fois (seule la commune est gardée). |
| **Bouton retour** | Revient en arrière dans le jeu ; au début, un second appui dans les 2 s quitte l'appli. |
| **Liens** | WhatsApp, les articles des infos, un numéro de téléphone : ouverts dans leur appli, pas dans le jeu. |
| **Hors connexion** | « Pas de connexion », avec « Réessayer » ; le jeu revient tout seul quand le réseau revient. |

Le jeu sait qu'il est dans l'appli : son agent utilisateur contient `BabiLifeApp/1.0` (`web/src/lib/native.ts`, `inApp()`). Il appelle l'appli par le canal `BabiApp` (`{ id, name: 'googleSignIn' | 'share', arg }`), et l'appli répond par `window.__babiAnswer(id, résultat, erreur)`. Les achats intégrés passeront par ce même pont.

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
--dart-define=TESTER=true                                # l'appli des testeurs (plus bas)
```

### Connexion Google (Firebase)

Le jeu se connecte avec **Firebase** (projet `babilife-38e39`), et l'API vérifie les jetons Firebase. Dans l'appli, le téléphone fait la connexion Google lui-même, pour le client web que Firebase a créé (`115685300024-jo2j….apps.googleusercontent.com`, public, déjà dans `lib/config.dart`) ; le jeu transforme ce jeton Google en connexion Firebase (`signInWithCredential`, `web/src/lib/google.ts`), puis l'envoie à l'API comme sur le site. Rien à faire dans Google Cloud Console. Il faut seulement, une fois :

1. **Firebase console** → *Paramètres du projet* → *Vos applications* → *Ajouter une application* → **Android** : nom de paquet `com.lifeinbabi.babi_life`, et l'empreinte **SHA-1** de la clé de l'appli (*Ajouter une empreinte*). Firebase crée alors le client Android tout seul. Pas besoin de `google-services.json`.
2. **GitHub** → *Settings → Secrets and variables → Actions* → *New repository secret* : `ANDROID_KEYSTORE` (la clé `.jks` en base64) et `ANDROID_KEY_PASSWORD`. Chaque build est alors signé avec la même clé, celle dont Firebase connaît le SHA-1. Sans ces secrets, GitHub signe avec une clé de débogage différente à chaque fois, et la connexion Google échoue dans l'appli.

Garde la clé `.jks` et son mot de passe en lieu sûr (hors de git) : elle servira aussi pour le Play Store.

L'icône vient du kit de lancement (`marketing/out/logos/babi-life-app-icon.png`) : `dart run flutter_launcher_icons` la refait.

## Sur GitHub

À chaque changement de `mobile/` sur `main` (ou à la main : *Actions → Mobile app → Run workflow*), GitHub vérifie l'appli (`flutter analyze`, `flutter test`) et construit les APK Android : on les télécharge dans l'onglet **Actions**, sur la dernière exécution, sous **babi-life-apk** (`app-arm64-v8a-release.apk` pour presque tous les téléphones récents). La clé de signature vient des secrets du dépôt (voir *Connexion Google*).

## L'appli des testeurs

Tant que le site affiche la liste d'attente, l'appli normale l'affiche aussi. L'**appli des testeurs** ouvre tout le jeu : construite avec `--dart-define=TESTER=true`, elle ajoute `BabiTest` à son agent utilisateur, et le jeu s'ouvre pour elle (`web/src/lib/launch.ts`). GitHub la construit à chaque fois, avec les autres : **`babi-life-testeur.apk`** dans **babi-life-apk** (téléphones arm64, presque tous). À ne donner qu'aux testeurs : ce n'est pas un secret fort, juste une porte discrète.

```sh
flutter build apk --release --target-platform android-arm64 --dart-define=TESTER=true
```

## Publier

- **Play Store** : la même clé (alias `babi-life`). En local, mettre `babi-life.jks` dans `android/` et un `android/key.properties` (jamais dans git) : `storeFile=babi-life.jks`, `storePassword=…`, `keyAlias=babi-life`, `keyPassword=…`, puis `flutter build appbundle`.
- **App Store** : ouvrir `ios/Runner.xcworkspace` dans Xcode sur un Mac, choisir l'équipe, puis *Product → Archive*.
