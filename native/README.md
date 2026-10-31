# Babi Life : l'appli Android (React Native)

L'appli Android de Babi Life, qui remplace l'appli Flutter (`mobile/`, une vue web). Ici, plus de page web dans l'appli : c'est le code du jeu lui-même (`web/src`), dessiné par le téléphone avec React Native (Expo). `src/dom` transforme les éléments HTML du jeu en vues natives, `src/shims` remplace ses paquets web par ceux du téléphone (Three.js sur `expo-gl`, les cartes et la mini-carte avec Skia, la vidéo avec `expo-video`…). Rien du jeu n'est écrit deux fois : une mise à jour du jeu est une mise à jour de l'appli au prochain build. Quand un fichier du jeu a besoin d'une version pour le téléphone, elle est à côté de lui, en `.native.ts(x)` (React Native la prend à la place de l'autre).

## Ce que fait l'appli

| | |
| --- | --- |
| **Accueil** | À la première ouverture, l'accueil de l'appli (`src/Onboarding.tsx`) : deux écrans courts, « Passer » et « Suivant » / « Commencer » toujours visibles. Puis la connexion (`web/src/screens/Title.tsx`, sa version compacte : un seul écran sans défilement, Google en grand, l'e-mail et le mot de passe, « Se connecter » / « Créer un compte », « Mot de passe oublié ? ») et la création du Sim. Jamais la liste d'attente du site : l'appli ouvre tout le jeu. |
| **Le jeu** | Tout le jeu, **le site lui-même** (www.lifeinbabi.com/jeu) dans le moteur de Chrome du téléphone, en plein écran (`Shell.tsx`, `react-native-webview`) : le même rendu et les mêmes boutons que sur le site, la 3D dessinée par Chrome directement sur la carte graphique. Pas de barre d'adresse, pas de zoom, pas de texte sélectionné par un appui long, pas de rebond de page ; les liens vers d'autres sites (WhatsApp, les infos) s'ouvrent dans leur appli ; sans réseau, un écran « Pas de connexion » avec « Réessayer ». Le jeu sait qu'il est dans l'appli par son user agent (`BabiLifeApp`) et lui demande ce qu'une page ne sait pas faire par le canal `BabiApp` (`web/src/lib/native.ts`) : la connexion Google, les notifications, le partage, les vibrations, tourner l'écran (« Jouer en paysage »), le bouton retour. L'ancienne façon (le jeu redessiné par React Native : `App.tsx`, `src/dom`, `src/shims`) reste dans le dossier mais ne démarre plus : elle était trop lente (chaque commande de dessin passait par le JavaScript). |
| **Connexion Google** | Par la connexion Google du téléphone (`@react-native-google-signin`), pour le client web du projet Firebase ; le jeu envoie le jeton à l'API comme sur le site (`web/src/lib/native.native.ts`), qui l'accepte toujours (`backend/internal/auth/google.go`, `AppWebClientID`). Un échec s'affiche avec le code de Google (« Connexion Google impossible (code 10) … ») et s'écrit dans le journal du téléphone (`[google sign-in]`, `adb logcat`). Voir « Connexion Google » plus bas. |
| **Notifications** | Un message sur Gbairai, un pari dont les matchs sont finis : par Firebase Cloud Messaging (`expo-notifications`). Le jeu les demande une fois ; refusées pour de bon, les réglages de l'appli s'ouvrent. Une notification touchée ouvre le jeu sur sa page (« /jeu?app=gbairai » : le téléphone ouvert sur Gbairai). |
| **Partager** | La feuille de partage du téléphone. |
| **Toucher** | Comme sur le site, un toucher remonte aux éléments qui l'entourent (un message de Gbairai glissé vers la droite ou tenu : on y répond), et une scène 3D le passe aussi à sa boîte (« Régler la circulation », les mini-jeux des actions). Une notification qui arrive pendant le jeu s'affiche avec son image ; un lien d'invitation `babilife://?p=code` garde le code du parrain pour l'inscription. |
| **Position** | « Naître là où tu es » : le téléphone demande l'autorisation une fois (`expo-location`). |
| **Bouton retour** | Ferme d'abord ce qui est ouvert dans le jeu (un défi, une table, le téléphone, la carte, un lieu ; au volant, il gare) ; sinon il revient en arrière ; au début, il quitte l'appli. |
| **Vibrations** | Celles du jeu (`expo-haptics`). |
| **Liens** | WhatsApp, les articles des infos, un numéro : ouverts dans leur appli. |
| **Hors connexion** | Le bandeau « Hors connexion » du jeu, quand le réseau du téléphone tombe (`expo-network`). |
| **Fluidité de la 3D** | Celle du site dans Chrome. (L'ancienne façon gardait une cadence calée sur l'écran et des chiffres à trois doigts, `src/shims/fiber.tsx`.) Paiements Google Play : pas encore branchés dans cette version, la Boutique n'y vend rien (« paiement-google » est fermé de toute façon). |

## Construire

Node 22 et, pour Android, Java 17 et le SDK Android.

```sh
cd native
npm ci
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease     # app/build/outputs/apk/release/
```

Pour regarder l'appli dans un navigateur (les mêmes vues, dessinées par react-native-web) :

```sh
EXPO_PUBLIC_API_URL=http://localhost:8099/api/v1 npx expo export --platform web --output-dir /tmp/native-web
```

## Sur GitHub

À chaque changement de `native/` ou du jeu (`web/src`) sur la branche, GitHub construit l'appli (*Actions → Native app*). Dans la dernière exécution, sous **babi-life-native-apk** :

- `babi-life-native.apk`, à installer sur un téléphone ;
- `babi-life-native.aab`, pour le Play Store.

Le numéro de version (celui qu'Android et le Play Store comparent) est 100 + le numéro de l'exécution : toujours au-dessus de l'appli Flutter (2), donc la nouvelle appli s'installe par-dessus l'ancienne.

## À régler une fois

1. **La clé de signature** : *Settings → Secrets and variables → Actions → Secrets* : `ANDROID_KEYSTORE` (la clé `.jks` en base64, alias `babi-life`) et `ANDROID_KEY_PASSWORD`, la même clé que l'appli Flutter. Avec elle, l'appli remplace l'ancienne sans la désinstaller ; pour la connexion Google, son empreinte doit être dans Firebase (« Connexion Google » plus haut). Sans elle, l'appli est signée avec la clé de test d'Expo, toujours la même : pour essayer la connexion Google avec, ajoute son empreinte SHA-1 dans la console Firebase (*Paramètres du projet → Vos applications → l'appli Android `com.lifeinbabi.babi_life` → Ajouter une empreinte*) : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`. Une appli signée avec une autre clé que celle déjà installée ne s'installe pas par-dessus : désinstalle d'abord l'ancienne.
2. **Les notifications** : *Settings → Secrets and variables → Actions → Variables* : `FCM_APP_ID` et `FCM_API_KEY`, l'appli Android du projet Firebase (*Paramètres du projet → Vos applications*), des identifiants publics. Côté serveur, `FCM_SERVICE_ACCOUNT` sur Render (le JSON du compte de service). Sans eux, l'appli marche, mais rien n'arrive sur le téléphone (c'était déjà le cas de l'appli Flutter).

## Connexion Google

« Connexion Google impossible (code 10) » (`DEVELOPER_ERROR`) : Google ne connaît pas la clé qui a signé l'appli installée. Il connaît une appli Android par son nom de paquet **et** l'empreinte SHA-1 de sa clé de signature ; le `google-services.json` du projet n'avait qu'un client web (type 3) et aucun client Android (type 1) : aucune empreinte n'est enregistrée. Deux clés signent l'appli :

- **la clé d'importation** (celle du dépôt, `ANDROID_KEYSTORE`) : l'APK de GitHub, installé à la main. SHA-1 : `43:58:AA:D1:E4:5B:9C:C9:5E:6F:F8:CD:AE:FE:88:66:C9:5D:7C:3F` ;
- **la clé de signature de Google Play** : Google re-signe l'appli téléchargée depuis le Play Store, y compris les tests internes. Son SHA-1 est dans la Play Console → l'appli → *Test et publication* → *Configuration* → *Intégrité de l'appli* → onglet *Signature d'application* → « Certificat de la clé de signature d'application » (copier l'empreinte SHA-1 ; la « clé d'importation » affichée en dessous doit être celle ci-dessus).

À faire une fois :

1. **Firebase** : [console.firebase.google.com](https://console.firebase.google.com) → le projet `babilife-38e39` → ⚙️ *Paramètres du projet* → *Général* → *Vos applications* → l'appli Android `com.lifeinbabi.babi_life` → *Ajouter une empreinte* : coller le SHA-1 de la clé d'importation, puis encore *Ajouter une empreinte* : le SHA-1 de la clé de signature de Google Play. (Le SHA-1 de la clé de test d'Expo, `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, seulement pour essayer un build sans la clé du dépôt.)
2. **Vérifier dans Google Cloud** : [console.cloud.google.com](https://console.cloud.google.com) → le même projet → *API et services* → *Identifiants* → *ID clients OAuth 2.0* : il doit y avoir un client de type **Android** pour `com.lifeinbabi.babi_life` avec chaque SHA-1 (Firebase les crée à l'étape 1 ; sinon *Créer des identifiants* → *ID client OAuth* → *Android*, le nom de paquet et le SHA-1, un client par SHA-1). Le client **Web** `115685300024-jo2jvvpg0p1ue1gsv156lcmkjjb99s9t` doit rester là : c'est celui que l'appli donne à Google (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`).
3. **L'écran de consentement OAuth** : *API et services* → *Écran de consentement OAuth* (ou *Google Auth Platform* → *Audience*) : l'état de publication doit être **« En production »**. En « Test », seuls les testeurs de la liste peuvent se connecter ; *Publier l'application* (les champs e-mail, nom, logo et liens vers `/conditions` et `/confidentialite` remplis).
4. **Le nouveau `google-services.json`** : Firebase → la même appli Android → *Télécharger google-services.json*. Ouvrir le fichier : sous `oauth_client`, il doit maintenant y avoir des entrées `"client_type": 1` avec les `certificate_hash`. Copier **tout** son contenu dans GitHub → *Settings* → *Secrets and variables* → *Actions* → *New repository secret* (ou une variable) nommé `GOOGLE_SERVICES_JSON`. Le build de l'appli l'écrit tel quel (et dit dans son journal combien de clients Android il contient) ; sans lui, il fabrique un fichier sans client Android, pour les notifications seulement.
5. **Côté serveur** (Render → l'API → *Environment*) : rien d'obligatoire. Le serveur accepte toujours les jetons du client web de l'appli, en plus de `GOOGLE_CLIENT_ID` (un ou plusieurs identifiants, séparés par des virgules) et des jetons Firebase (`FIREBASE_PROJECT_ID`). Un refus s'écrit dans son journal (« google sign-in refused: … »).
6. **Essayer** : relancer *Actions → Native app*, installer l'APK (ou la version du test interne), toucher « Continuer avec Google ». Les changements de la console Google mettent parfois quelques minutes (jusqu'à une heure) à s'appliquer.

L'émulateur de GitHub n'a pas de compte Google : la connexion Google ne peut pas y être essayée jusqu'au bout ; la revue (*Actions → Native app review*, `review/drive.py`) vérifie que son erreur s'affiche, puis crée un compte par e-mail et s'y connecte.

## Paiements Google Play

Dans l'appli, la Boutique se paie par Google Play Billing (`expo-iap`, `web/src/lib/play.native.ts`), jamais par GeniusPay : c'est la règle de Google pour ce qui est numérique dans une appli du Play Store. Le site garde GeniusPay. Tant que la mise à jour « paiement-google » est fermée, la Boutique de l'appli ne vend rien. Le serveur vérifie chaque achat auprès de Google (`backend/internal/shop/play.go`) avant de le donner, une seule fois.

À faire une fois :

1. **Profil de paiement** : Play Console → *Monétisation* → *Profil de paiement* : créer le profil marchand (il faut un compte bancaire pour être payé).
2. **Les produits intégrés** : Play Console → l'appli → *Monétiser avec Play* → *Produits* → *Produits intégrés à l'application*, un produit par article, avec **exactement** ces identifiants (ceux de `backend/internal/shop/shop.go`, `PlayID`), puis *Activer* chacun. Les prix ci-dessous sont ceux du site, en F CFA ; Google les convertit dans les autres pays.

   | Identifiant | Article | Prix |
   | --- | --- | --- |
   | `djai_500` | La pièce · 40 000 Djai | 500 F CFA |
   | `djai_1000` | Le gombo · 90 000 Djai | 1 000 F CFA |
   | `djai_2500` | Le djossi · 240 000 Djai | 2 500 F CFA |
   | `djai_5000` | Le boss · 520 000 Djai | 5 000 F CFA |
   | `djai_10000` | Le grotto · 1 120 000 Djai | 10 000 F CFA |
   | `babi_pass_30j` | Babi Pass · 30 jours | 1 500 F CFA |
   | `plein_energie` | Plein d'énergie | 300 F CFA |
   | `pack_prestige` | Pack Prestige (la couronne, une fois) | 2 000 F CFA |
   | `veste_repos` | La veste du repos (une fois) | 1 500 F CFA |
   | `polo_mere_con` | Le polo de mère con (une fois) | 1 500 F CFA |
   | `grandir_enfant_1000` | Enfant tout de suite (bébé → enfant) | 1 000 F CFA |
   | `grandir_ado_2000` | Ado tout de suite (enfant → ado) | 2 000 F CFA |
   | `grandir_ado_3000` | Ado tout de suite (bébé → ado) | 3 000 F CFA |
   | `grandir_adulte_2000` | Adulte tout de suite (ado → adulte) | 2 000 F CFA |
   | `grandir_adulte_5000` | Adulte tout de suite (bébé → adulte) | 5 000 F CFA |

   Les produits ne peuvent être créés qu'une fois une version de l'appli (l'`.aab` de GitHub, avec `expo-iap`) envoyée sur un canal de test.
3. **Le compte de service** : Google Cloud Console (le projet lié à la Play Console) → *API et services* → activer **Google Play Android Developer API** ; *IAM* → *Comptes de service* → en créer un, puis *Clés* → *Ajouter une clé* → JSON. Dans la Play Console → *Utilisateurs et autorisations* → *Inviter un utilisateur* : l'adresse du compte de service, avec, pour l'appli, **« Afficher les données financières »** et **« Gérer les commandes et les abonnements »**.
4. **Sur le serveur** (Render → le service de l'API → *Environment*) : `GOOGLE_PLAY_SERVICE_ACCOUNT` = le contenu du fichier JSON (tel quel, ou en base64). Jamais dans le dépôt.
5. **Facultatif, les notifications en temps réel** (un paiement en espèces confirmé plus tôt, un remboursement repris tout de suite) : un sujet Pub/Sub dans Google Cloud, `google-play-developer-notifications@system.gserviceaccount.com` en éditeur, un abonnement *push* vers `https://<l'API>/api/v1/shop/play/rtdn?token=<un secret>`, le même secret dans `GOOGLE_PLAY_RTDN_TOKEN` sur Render, et le sujet dans Play Console → *Monétiser avec Play* → *Configuration de la monétisation*. Sans elles, le serveur redemande à Google toutes les 10 minutes.
6. **Ouvrir la mise à jour** « paiement-google » dans l'admin (*Mises à jour*).
7. **Essayer** avec un compte testeur : Play Console → *Test de licence* : ajouter son adresse Gmail (et l'appli installée depuis un canal de test). Ses achats ne sont pas débités ; le serveur les marque « test ».

## L'ancienne appli

`mobile/` (Flutter) reste là tant que la nouvelle appli n'a pas été essayée sur de vrais téléphones. Ensuite, `mobile/` et `.github/workflows/mobile.yml` peuvent partir.

L'iPhone n'est pas encore construit : il faut un Mac (GitHub en propose) et un compte Apple Developer.
