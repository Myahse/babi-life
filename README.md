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

Captures dans `docs/screens/` (`-m-` = mobile, `-d-` = ordinateur) : `cas-*` pour la création du Sim, `commune-*` pour chaque quartier, `e-*` pour une partie complète.

1. **Accueil** (`/`) : illustration d'Abidjan au coucher du soleil, logo, puis deux onglets **Se connecter** / **Créer un compte** : avec Google, ou avec un e-mail et un mot de passe (8 caractères minimum, stocké en bcrypt). Un compte créé par e-mail est relié à Google si la personne se connecte ensuite avec Google sur la même adresse. En local, un « Mode test » permet de jouer sans compte.
2. **Créer un Sim** (`/creer`) : sept étapes numérotées (Identité, Corps, Visage, Coiffure, Tenue, Caractère, Quartier) avec une barre de progression. Le Sim, en 3D, tourne sur un podium (on le fait pivoter du doigt) et la caméra zoome sur le visage pour la coiffure et le visage. Chaque option est une vignette du Sim qui la porte : teint, silhouette, taille, couleur des yeux, barbe, accessoires (lunettes, boucles, chaîne, casquette), huit coiffures, six tenues, quatre motifs de pagne, couleurs. À la fin, une carte révèle le **départ** tiré au hasard (Enfant de riche ou Débrouillard·e).
3. **Le jeu** (`/jeu`) : un **quartier en 3D** (Three.js / react-three-fiber), à l'échelle réelle (environ 240 × 90 m), où ton Sim se déplace à pied sur les trottoirs. Chaque commune a son style : tours au Plateau, villas à Cocody, cours communes et maquis à Yopougon, marchés à Adjamé, vieilles maisons à arcades à Treichville et Grand-Bassam, cases rondes à Korhogo, montagnes à Man… Des passants marchent ou discutent, les taxis orange, woro-woro, gbakas et motos circulent. Clique sur un bâtiment (maquis, marché, maison, club, bureau, gare…) et ton Sim y va, puis le menu des activités s'ouvre. Pour voyager vers une autre commune ou une autre ville, ouvre **Carte**. Le **téléphone** du jeu contient Carte, Quartier, Boulot, Logement, **Infos** (les vraies actualités de Côte d'Ivoire), Messages (le journal), Mobile Money et Profil. Captures : `docs/screens/3d-*.png`, et une partie complète avec l'économie dans `docs/screens/e-*.png`.
   La **Carte** (voyages) est en plein écran avec le HUD (portrait avec l'humeur, pièces en FCFA, horloge). Les jauges des besoins sont des anneaux. Sur mobile, le panneau Explorer est en bas de l'écran ; sur ordinateur, il flotte à gauche. Les activités s'ouvrent dans un menu circulaire façon Sims sur ordinateur et dans une liste en bas de l'écran sur mobile.
4. **Profil** (`/profil`) : la carte du Sim, à partager (WhatsApp, etc.), avec ses statistiques et son histoire.

### Principes de design

- **Mobile d'abord** : en Côte d'Ivoire, on joue surtout sur Android. Les boutons sont grands et à portée du pouce, le panneau du bas se réduit, et rien d'important n'est caché en haut de l'écran.
- **Codes des jeux mobiles** : boutons en relief, tuiles d'icônes colorées, pièces dorées, des retours à chaque action (barre de progression, notifications, imprévus).
- **Un seul jeu d'icônes** ([lucide](https://lucide.dev)), choisi par l'API (`icon: "drumstick"`), et une couleur par type de lieu (maquis = rouge corail, marché = or, plage = turquoise…).
- **Identité ivoirienne** : orange, blanc et vert du drapeau ; pagne wax, foulard, grand boubou, maillot des Éléphants ; textes en français avec des expressions d'ici.
- **Les Sims** : un style cartoon 3D aux proportions humaines (environ six têtes), ombrage « toon », visages expressifs. Tout est construit en code (`web/src/avatar/`), sans fichier 3D : chaque combinaison fonctionne et reste légère pour Android. Les vignettes et portraits sont rendus par un seul canvas WebGL caché (`avatar/portrait.tsx`), car les téléphones limitent le nombre de canvas 3D.
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
3. **Render** : *New → Blueprint* avec `render.yaml` (ou un *Web Service* Docker avec `backend/` comme dossier racine). Renseigne `DATABASE_URL`, `GOOGLE_CLIENT_ID` (facultatif : l'inscription par e-mail marche sans), `ALLOWED_ORIGINS` (URL Vercel) et, si tu veux d'autres sources d'actualités, `NEWS_FEEDS`. Ne mets **pas** `DEV_LOGIN`.
4. **Vercel** : importe le repo avec `web/` comme *Root Directory* (preset Vite). Variables : `VITE_API_URL=https://<ton-api>.onrender.com/api/v1`, `VITE_MAPBOX_TOKEN`, `VITE_GOOGLE_CLIENT_ID`. `vercel.json` renvoie toutes les routes vers l'app.

## Comment le jeu fonctionne

- **Le temps** : 1 seconde réelle = 1 minute de jeu, donc une journée dure 24 minutes. Quand tu n'es pas là, le temps avance au maximum de 3 heures de jeu.
- **Les besoins** (Faim, Énergie, Hygiène, Social, Loisirs) baissent à chaque heure de jeu. Leur moyenne donne la couleur du losange.
- **Les interactions** coûtent du temps et de l'argent (ou en rapportent : le travail, le petit commerce). Certaines ne sont possibles qu'à certaines heures, par exemple le maquis le soir et la boîte de nuit après 21 h.
- **Les vraies infos du pays** : l'API lit des flux RSS toutes les 30 minutes (par défaut Google Actualités « Côte d'Ivoire » et Abidjan.net, réglables avec `NEWS_FEEDS`) et garde les 40 derniers titres, classés par thème (sport, politique, économie, société, culture, météo). L'appli Infos les affiche avec la source et un lien vers l'article chez l'éditeur ; un « Flash info » apparaît à l'arrivée en jeu. Code : `backend/internal/news`.
- **Ce qui se passe dans le quartier** : toutes les 2 heures de jeu, il y a environ 60 % de chances qu'il se passe quelque chose dans la rue, que tout le monde voit en 3D au même moment : mariage avec cortège, match des Éléphants sur écran géant, concert de coupé-décalé, grosse pluie, délestage, embouteillage, contrôle de police, match de foot des petits. Une annonce apparaît, un bandeau « En ce moment » y emmène le Sim, et on peut s'y joindre (danser, regarder le match…), avec ses propres imprévus. Le serveur calcule l'évènement à partir de la commune et de l'heure (`backend/internal/game/happenings.go`), sans rien stocker.
- **Les évènements aléatoires** : après une action, il y a 35 % de chances qu'il se passe quelque chose (coupure de courant, un grand-frère qui paie la tournée, un gnambro qui te fait payer 100F de plus…).
- **Le départ** : à la création, le serveur tire au hasard. *Enfant de riche* : 200 000F et un appartement. *Débrouillard·e* : un entrer-coucher, 65 000F en poche dont un microcrédit de 50 000F (60 000F à rembourser).
- **Le logement** : Entrer-coucher (7 000F/sem), Studio (15 000F), Appartement (30 000F), Villa avec piscine (75 000F). Plus le logement est beau, plus dormir, se doucher ou regarder la télé fait du bien (confort de 70 % à 130 %). On déménage depuis l'appli Logement, dans la commune où l'on se trouve, en payant 2 semaines de caution.
- **Le samedi** : à 00 h chaque samedi, le loyer tombe, puis l'agent de la microfinance prend 10 000F. Si tu ne peux pas payer, ça s'accumule ; à 2 semaines de retard, le propriétaire t'expulse vers le logement d'en dessous.
- **Les carrières** : Bureau, Restauration, Commerce, Transport et Ambiance, chacune avec 5 échelons (de Stagiaire à PDG, d'Apprenti gbaka à Propriétaire de flotte…). On postule dans l'appli Boulot, puis on va travailler sur le lieu (marché, maquis, gare…) pendant les heures de service. Chaque service rapporte des points selon l'humeur du Sim (+1 pour les *Travailleurs*) ; 10 points × échelon et c'est la promotion.
- Le serveur décide de tout, et le front ne fait que prédire l'horloge et les jauges entre deux actions.

## Ajouter du contenu

- **Villes, communes et lieux** : `backend/internal/world/world.go`
- **Types de lieux, interactions et évènements** : `backend/internal/game/catalog.go`
- **Traits et aspirations** : `backend/internal/game/traits.go`
- **Les évènements de quartier** : `backend/internal/game/happenings.go` (textes, heures, ce qu'on peut faire) et leur mise en scène 3D dans `web/src/world3d/Happenings.tsx`.
- **Le style de chaque commune** (bâtiments, arbres, passants, circulation, couleur des woro-woro, lagune ou mer, décor au loin) : `web/src/world3d/themes.ts`. Les types de bâtiments sont dans `world3d/Fillers.tsx`.
- **Les options du Sim** (coiffures, tenues, motifs, couleurs) : `web/src/avatar/options.ts`, et leur forme 3D dans `avatar/Human.tsx`.
- **Départs, logements, carrières, loyer et microcrédit** : `backend/internal/game/economy.go`
- **Règles** (vitesse du temps, baisse des besoins, chance d'évènement) : `backend/internal/game/needs.go` et `sim.go`. `web/src/game/rules.ts` reprend les mêmes constantes pour le HUD.

Un test vérifie que chaque lieu utilise un type qui existe et que tous les identifiants sont uniques.
