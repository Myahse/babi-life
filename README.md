# Babi Life 🇨🇮

Un jeu de simulation de vie à la *Sims*, sur la vraie carte de la Côte d'Ivoire.
Crée ton Sim, installe-toi à Yopougon, Cocody ou Bouaké, gère ta faim, ton
énergie et ton porte-monnaie en FCFA, prends le woro-woro, mange un garba au
maquis… et laisse les évènements aléatoires pimenter ta vie.

| Partie | Stack | Hébergement |
|---|---|---|
| `backend/` | Go 1.25 · chi · pgx | Render (Docker) |
| `web/` | React 19 · TypeScript · Vite · Tailwind 4 · Three.js (react-three-fiber) · Mapbox GL | Vercel |
| Base de données | PostgreSQL | Neon |
| Connexion | Google Sign-In (ID token vérifié par l'API) | |

## Les écrans

Captures dans `docs/screens/` (`m-` = mobile, `d-` = ordinateur).

1. **Accueil** (`/`) : illustration d'Abidjan au coucher du soleil, logo, et un seul bouton « Continuer avec Google ». En local, on peut aussi « Jouer » sans Google.
2. **Créer un Sim** (`/creer`) : un studio comme dans les jeux mobiles. L'avatar est sur une scène et, en dessous, des onglets (Identité, Teint, Coiffure, Tenue, Caractère, Quartier). Chaque choix montre une vignette de l'avatar plutôt qu'un simple texte.
3. **Le jeu** (`/jeu`) : un **quartier en 3D** (Three.js / react-three-fiber) où ton Sim se déplace à pied. Clique sur un bâtiment (maquis, marché, maison, club, bureau, gare…) et ton Sim y va, puis le menu des activités s'ouvre. Pour voyager vers une autre commune ou une autre ville, ouvre **Carte**. Le **téléphone** du jeu contient Carte, Quartier, Boulot, Messages (le journal), Mobile Money et Profil. Captures : `docs/screens/3d-*.png`.
   La **Carte** (voyages) est en plein écran avec le HUD (portrait avec l'humeur, pièces en FCFA, horloge). Les jauges des besoins sont des anneaux. Sur mobile, le panneau Explorer est en bas de l'écran ; sur ordinateur, il flotte à gauche. Les activités s'ouvrent dans un menu circulaire façon Sims sur ordinateur et dans une liste en bas de l'écran sur mobile.
4. **Profil** (`/profil`) : la carte du Sim, à partager (WhatsApp, etc.), avec ses statistiques et son histoire.

### Principes de design

- **Mobile d'abord** : en Côte d'Ivoire, on joue surtout sur Android. Les boutons sont grands et à portée du pouce, le panneau du bas se réduit, et rien d'important n'est caché en haut de l'écran.
- **Codes des jeux mobiles** : boutons en relief, tuiles d'icônes colorées, pièces dorées, des retours à chaque action (barre de progression, notifications, imprévus).
- **Un seul jeu d'icônes** ([lucide](https://lucide.dev)), choisi par l'API (`icon: "drumstick"`), et une couleur par type de lieu (maquis = rouge corail, marché = or, plage = turquoise…).
- **Identité ivoirienne** : orange, blanc et vert du drapeau ; pagne wax, foulard, maillot des Éléphants ; textes en français avec des expressions d'ici.
- **La carte hors-ligne est un vrai plateau de jeu** : frontières, fleuves, lacs et routes de Natural Earth, savane au nord et forêt au sud, lagune Ébrié dessinée à la main. Les étiquettes s'écartent automatiquement pour ne pas se chevaucher. Avec un token, Mapbox prend le relais (relief 3D dans les villes, mode nuit qui suit l'horloge du jeu).

## Lancer en local

```bash
# 1. Base de données (ou mets directement ton URL Neon dans backend/.env)
docker compose up -d

# 2. API (http://localhost:8080)
cd backend
cp .env.example .env
go run ./cmd/api          # les migrations s'appliquent au démarrage

# 3. Front (http://localhost:5173)
cd ../web
cp .env.example .env      # ajoute VITE_MAPBOX_TOKEN et VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
```

Sans `VITE_MAPBOX_TOKEN`, le jeu utilise une carte stylisée hors-ligne : mêmes
repères, mêmes mouvements de caméra. Sans `GOOGLE_CLIENT_ID`, mets
`DEV_LOGIN=true` côté API pour te connecter en mode dev.

Tests : `cd backend && go test ./...`

## Déploiement

1. **Neon** : crée un projet et copie la chaîne de connexion (`sslmode=require`).
2. **Google** : dans Google Cloud Console → *Credentials*, crée un *OAuth client ID* de type **Web**. Ajoute `http://localhost:5173` et l'URL Vercel dans *Authorized JavaScript origins*. Le même client ID va dans `GOOGLE_CLIENT_ID` (API) et `VITE_GOOGLE_CLIENT_ID` (web).
3. **Render** : *New → Blueprint* avec `render.yaml` (ou un *Web Service* Docker avec `backend/` comme dossier racine). Renseigne `DATABASE_URL`, `GOOGLE_CLIENT_ID` et `ALLOWED_ORIGINS` (URL Vercel). Ne mets **pas** `DEV_LOGIN`.
4. **Vercel** : importe le repo avec `web/` comme *Root Directory* (preset Vite). Variables : `VITE_API_URL=https://<ton-api>.onrender.com/api/v1`, `VITE_MAPBOX_TOKEN`, `VITE_GOOGLE_CLIENT_ID`. `vercel.json` renvoie toutes les routes vers l'app.

## Comment le jeu fonctionne

- **Le temps** : 1 seconde réelle = 1 minute de jeu, donc une journée dure 24 minutes. Quand tu n'es pas là, le temps avance au maximum de 3 heures de jeu.
- **Les besoins** (Faim, Énergie, Hygiène, Social, Loisirs) baissent à chaque heure de jeu. Leur moyenne donne la couleur du losange.
- **Les interactions** coûtent du temps et de l'argent (ou en rapportent : le travail, le petit commerce). Certaines ne sont possibles qu'à certaines heures, par exemple le maquis le soir et la boîte de nuit après 21 h.
- **Les évènements aléatoires** : après une action, il y a 35 % de chances qu'il se passe quelque chose (coupure de courant, un grand-frère qui paie la tournée, un gnambro qui te fait payer 100F de plus…).
- Le serveur décide de tout, et le front ne fait que prédire l'horloge et les jauges entre deux actions.

## Ajouter du contenu

- **Villes, communes et lieux** : `backend/internal/world/world.go`
- **Types de lieux, interactions et évènements** : `backend/internal/game/catalog.go`
- **Traits et aspirations** : `backend/internal/game/traits.go`
- **Règles** (vitesse du temps, baisse des besoins, chance d'évènement) : `backend/internal/game/needs.go` et `sim.go`. `web/src/game/rules.ts` reprend les mêmes constantes pour le HUD.

Un test vérifie que chaque lieu utilise un type qui existe et que tous les identifiants sont uniques.
