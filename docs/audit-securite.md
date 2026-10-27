# Audit de sécurité de Babi Life : ce qu'on fournit

Ce document prépare le test de sécurité confié à un expert extérieur. Il dit ce que le propriétaire du jeu prépare et donne, ce qu'il ne donne jamais, et où regarder en priorité. Il ne contient aucun secret.

## 1. L'accord avant de commencer

Un court accord écrit (un message signé suffit), qui fixe :

- **Le périmètre** :
  - le site (Vercel) ;
  - l'API Go et son WebSocket `/live` ;
  - les pages d'admin et de modération ;
  - l'appli mobile (la webview Flutter de `mobile/`).
- **Hors périmètre** : les services tiers eux-mêmes (GeniusPay, Firebase, Vercel, Render, Neon, le stockage R2, WhatsApp). On teste notre usage de ces services, pas les services.
- **Les dates du test**.
- **Ce qui est interdit** :
  - le déni de service ou la saturation ;
  - les vrais paiements ;
  - le spam, les mails ou les notifications à de vrais joueurs ;
  - garder ou diffuser des données.
- **Le rapport** : remis en privé au propriétaire, chaque faille avec sa gravité et comment la reproduire. Rien de public avant correction.

## 2. L'environnement de test à préparer (pas la production)

Le test se fait sur une **copie** du jeu, jamais sur la production où jouent de vrais joueurs.

| À préparer | Comment |
| --- | --- |
| Une API de test | Un deuxième service Render (offre gratuite), même code, branche au choix |
| Une base de test | Une base Neon séparée (offre gratuite), données de test seulement |
| Un site de test | Une préversion Vercel qui pointe vers l'API de test |
| Les paiements | GeniusPay en **mode test (sandbox)**, clés de test, avec `GENIUSPAY_WEBHOOK_SECRET` réglé (sinon les webhooks ne sont pas vérifiés par signature) |
| Les variables | De nouvelles valeurs, propres au test : `JWT_SECRET`, `ADMIN_KEY`, `MODERATION_KEY`, `ADS_ADMIN_KEY`, `WAITLIST_ADMIN_KEY`, clés VAPID et R2 de test (un autre bucket) |
| `DEV_LOGIN` | **Désactivé**, comme en production : sinon n'importe qui se connecte sans compte, et le test ne voit pas le vrai fonctionnement |
| `ALLOWED_ORIGINS` | L'adresse du site de test |
| Les comptes | 3 ou 4 comptes joueurs de test, dont un adulte avec un perso avancé et de l'argent, un récent, un mineur ; et l'accès à l'admin de test (sa clé, celle du test seulement) |
| Le code testeur | Celui du test, s'il en faut un pour ouvrir le jeu avant la sortie |

## 3. Ce qu'on lui donne

- **Un accès en lecture au dépôt GitHub** (`myahse/babi-life`, collaborateur en lecture seule) : l'audit « boîte blanche » trouve beaucoup plus que le test à l'aveugle.
- **Ce document**, plus `README.md` (ce que fait le jeu) et `docs/economie.md` (d'où vient l'argent du jeu, où il part, les plafonds du jour).
- **Les adresses** du site et de l'API de test, et les identifiants des comptes de test (par un canal privé, jamais dans le dépôt).

## 4. Ce qu'on ne lui donne jamais

- Les clés de production : GeniusPay (clé et secret du webhook), R2, la clé privée VAPID, le compte de service Firebase / FCM, `JWT_SECRET`, les clés d'admin, WhatsApp.
- Un accès à la base de production, à Render, Vercel ou Neon (les comptes du propriétaire).
- Les données de vrais joueurs (comptes, messages, photos, e-mails).

S'il a besoin de quelque chose de plus, il le demande, et on le crée pour le test.

## 5. Comment le jeu est fait (la surface à tester)

- **Le site** : React (Vite), servi par Vercel. Le jeu tourne dans le navigateur : tout ce qu'il envoie peut être falsifié.
- **L'API** : Go (`backend/`), sous `/api/v1`, environ 260 routes. Le point d'entrée est `backend/cmd/api/main.go` ; les routes des persos sont dans `backend/internal/sims/sims.go` (`Routes`).
- **La connexion** (`backend/internal/auth/`) : Google via Firebase, ou e-mail et mot de passe (inscription, connexion, mot de passe oublié). Un jeton signé est ensuite envoyé à chaque requête ; les écritures portent une clé d'idempotence (`auth/idempotency.go`).
- **Les rôles** : le joueur (ses persos), le testeur (avant la sortie), l'admin et ses parties, chacune avec sa propre clé : admin général, modération, publicités, liste d'attente.
- **Le temps réel** : le WebSocket `/api/v1/live` (positions des joueurs, courses de kart, matchs de quartier où le téléphone du premier joueur fait tourner le match et l'envoie aux autres).
- **Les fichiers** : photos, stories, publicités, dans un stockage compatible S3 (R2).
- **Les paiements** : les packs de Djai par GeniusPay (`backend/internal/shop/`). Le webhook est `POST /api/v1/shop/geniuspay`, sa signature est vérifiée en HMAC-SHA256, et le paiement est reconfirmé auprès de GeniusPay.

## 6. Où regarder en priorité

1. **L'argent** (les Djai s'achètent avec de l'argent réel) :
   - obtenir des Djai sans payer : rejouer ou forger un webhook, un paiement annulé, deux requêtes en même temps ;
   - dépasser les plafonds de gains du jour (`game/money.go`) ;
   - les jeux d'argent : casino, machines, bingo, L'Envol, Trade, paris, loto ;
   - les transferts entre joueurs (Pingus) ;
   - les scores des défis, envoyés par le téléphone.
2. **Les comptes** :
   - agir sur le perso ou le compte d'un autre (changer l'identifiant dans l'adresse) ;
   - réutiliser ou forger un jeton ;
   - la réinitialisation du mot de passe ;
   - la connexion Google.
3. **L'admin et la modération** : y accéder sans la clé, ou avec la clé d'une autre partie ; les actions de l'admin.
4. **Ce que les joueurs s'envoient** :
   - les messages (Gbairai, le grin), les photos éphémères (Flashé), les stories, Tikitoko, Babigram ;
   - l'injection de code ;
   - voir les photos privées des autres ;
   - contourner un blocage ou un signalement.
5. **Les mineurs** : la romance est réservée aux adultes, et les enfants ne doivent jamais pouvoir être abordés. Vérifier qu'on ne peut pas contourner l'âge.
6. **Le WebSocket** : se faire passer pour un autre joueur, piloter un match ou une course qui n'est pas le sien, envoyer des messages énormes ou en rafale.
7. **Le reste** : les envois de fichiers (taille, type), les requêtes en rafale, les en-têtes de sécurité du site, CORS, les dépendances (`go.mod`, `web/package.json`).

## 7. Après le test

- Le propriétaire trie les failles par gravité.
- On les corrige dans le code, en commençant par l'argent et les comptes.
- L'expert vérifie les corrections sur l'environnement de test.
- On supprime l'environnement de test et on révoque ses clés et son accès au dépôt.
