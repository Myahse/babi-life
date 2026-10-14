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

Une démo vidéo de 3 minutes (inscription, création du Sim, mariage dans la rue, téléphone, carte) : `docs/demo-babi-life.mp4`. Captures dans `docs/screens/` (`-m-` = mobile, `-d-` = ordinateur) : `cas-*` pour la création du Sim, `commune-*` pour chaque quartier, `e-*` pour une partie complète.

1. **Accueil** (`/`) : illustration d'Abidjan au coucher du soleil, logo, puis deux onglets **Se connecter** / **Créer un compte** : avec Google, ou avec prénom, nom, **pseudo**, e-mail et mot de passe (8 caractères minimum, stocké en bcrypt). Le pseudo (3 à 24 lettres, chiffres, _ ou .) est vérifié en direct pendant la frappe, avec trois propositions libres s'il est pris ; c'est lui qui s'affiche dans le jeu. On se connecte avec son e-mail ou son pseudo. Avec Google, il suffit de mettre `GOOGLE_CLIENT_ID` (API) et `VITE_GOOGLE_CLIENT_ID` (web) : le bouton s'active, le prénom et le nom viennent du compte Google, et le pseudo se choisit à la création du Sim. Un compte créé par e-mail est relié à Google si la personne se connecte ensuite avec Google sur la même adresse. En local, un « Mode test » permet de jouer sans compte.
2. **Créer un Sim** (`/creer`) : le prénom et le nom sont repris du compte (à corriger seulement si besoin). Sept étapes numérotées (Identité, Corps, Visage, Coiffure, Tenue, Caractère, Quartier) avec une barre de progression. Le Sim, en 3D, tourne sur un podium (on le fait pivoter du doigt) et la caméra zoome sur le visage pour la coiffure et le visage. Chaque option est une vignette du Sim qui la porte : teint, silhouette, taille (de 1,40 m à 2,50 m), couleur des yeux, barbe, accessoires (lunettes, boucles, chaîne, casquette à l'endroit ou à l'envers), des **bobos** (pansement en croix, griffures, genou bandé, ou tout ça), huit coiffures, neuf tenues dont la tenue de quartier (**débardeur blanc côtelé, short de sport** à cordon, claquettes), le **survêtement** à trois bandes et la **tenue de basket** numérotée, quatre motifs de pagne. Chaque partie a son **nuancier** : des couleurs toutes prêtes, plus un sélecteur libre (carré saturation/luminosité, barre de teinte, code hexadécimal) pour la peau, les cheveux, les yeux, le haut, le bas, les chaussures et l'accessoire. À la fin, une carte révèle le **départ** tiré au hasard (Enfant de riche ou Débrouillard·e).
3. **Le jeu** (`/jeu`) : un **quartier en 3D** (Three.js / react-three-fiber), à l'échelle réelle (environ 240 × 90 m), où ton Sim se déplace à pied sur les trottoirs. Chaque commune a son style : tours au Plateau, villas à Cocody, cours communes et maquis à Yopougon, marchés à Adjamé, vieilles maisons à arcades à Treichville et Grand-Bassam, cases rondes à Korhogo, montagnes à Man… Des passants marchent ou discutent, les taxis orange, woro-woro, gbakas et motos circulent. Clique sur un bâtiment (maquis, marché, maison, club, bureau, gare…) et ton Sim y va, puis le menu des activités s'ouvre. Pour voyager vers une autre commune ou une autre ville, ouvre **Carte**. Le **téléphone** du jeu contient Carte, Quartier, Boulot, Logement, **Infos** (les vraies actualités de Côte d'Ivoire), Messages (le journal), **Store**, **Waye** (argent mobile) et Profil. Captures : `docs/screens/3d-*.png`, et une partie complète avec l'économie dans `docs/screens/e-*.png`.
   La **Carte** est une seule carte de tout le pays, qu'on fait glisser et qu'on zoome librement (pincer, molette, double-tap), sans liste à parcourir : de loin, un badge par ville ; dans une ville, un badge par **mairie** (une par commune, en commençant par Abidjan) ; de près, les lieux. Touche un badge pour sa fiche et le bouton « Y aller » (taxi en ville, car entre deux villes, avec le prix et la durée) ; un lieu de ta commune s'atteint à pied. Pendant le trajet, la carte montre la **route**, la partie déjà faite en orange et le **taxi** qui avance en temps réel avec la tête de ton Sim, puis « Bien arrivé·e ». Les jauges des besoins sont des anneaux. Les activités s'ouvrent dans un menu circulaire façon Sims sur ordinateur et dans une liste en bas de l'écran sur mobile.
4. **Profil** (`/profil`) : la carte du Sim, à partager (WhatsApp, etc.), avec ses statistiques et son histoire.

### Principes de design

- **Mobile d'abord** : en Côte d'Ivoire, on joue surtout sur Android. Les boutons sont grands et à portée du pouce, le panneau du bas se réduit, et rien d'important n'est caché en haut de l'écran.
- **Codes des jeux mobiles** : boutons en relief, tuiles d'icônes colorées, pièces dorées, des retours à chaque action (barre de progression, notifications, imprévus).
- **Un seul jeu d'icônes** ([lucide](https://lucide.dev)), choisi par l'API (`icon: "drumstick"`), et une couleur par type de lieu (maquis = rouge corail, marché = or, plage = turquoise…).
- **Identité ivoirienne** : orange, blanc et vert du drapeau ; pagne wax, foulard, grand boubou, maillot des Éléphants ; textes en français avec des expressions d'ici.
- **Les Sims** : un style cartoon 3D aux proportions humaines (environ six têtes), ombrage « toon », visages expressifs. Tout est construit en code (`web/src/avatar/`), sans fichier 3D : la tête est une seule surface, les cheveux et les barbes suivent le crâne et s'arrêtent sur une vraie ligne de cheveux, le torse est d'un seul tenant avec la couture à la taille, les manches, ceintures et pagnes épousent le corps ; chaque combinaison fonctionne et reste légère pour Android. Les vignettes et portraits sont rendus par un seul canvas WebGL caché (`avatar/portrait.tsx`), car les téléphones limitent le nombre de canvas 3D.
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

### Application installable (PWA)

Le site s'installe comme une app, en plein écran, avec son icône :
- **Android / Chrome / Edge** : le bouton **Installer l'app** (écran d'accueil du jeu et page Profil) ouvre la fenêtre d'installation du navigateur.
- **iPhone / iPad** : Safari n'a pas de fenêtre d'installation ; le même bouton montre les trois étapes (Partager → « Sur l'écran d'accueil » → Ajouter).

Le *service worker* (`vite-plugin-pwa`) garde en cache le code, les polices et les icônes : l'app s'ouvre instantanément, même hors connexion, et se met à jour toute seule à la visite suivante. Les données du jeu viennent toujours en direct de l'API ; sans réseau, un bandeau « Hors connexion » s'affiche. Les icônes sont dans `web/public/` (`pwa-192.png`, `pwa-512.png`, `maskable-512.png`, `apple-touch-icon.png`, `icon.svg`).

## Comment le jeu fonctionne

- **Le temps** : le jeu suit l'heure et la date réelles d'Abidjan (UTC+0). Les activités durent pour de vrai : une nuit de 7 h, une journée de travail de 8 h, un garba de 20 min. Ton Sim reste occupé·e sur place (barre de progression, heure de fin) et tu peux fermer l'appli ; on peut aussi « Arrêter » avant la fin et garder la part déjà faite (effets et salaire au prorata). Les trajets prennent du temps aussi, mais raccourcis pour le jeu : quelques minutes à travers Abidjan (Yopougon → Marcory : 16 km, 14 min), moins d'une heure en car jusqu'à Bouaké. Quand tu n'es pas là, les besoins baissent mais ne descendent pas sous 8.
- **Les besoins** (Faim, Énergie, Hygiène, Social, Loisirs) baissent à chaque heure. Leur moyenne donne la couleur du losange.
- **Les interactions** coûtent du temps et de l'argent (ou en rapportent : le travail, le petit commerce). Certaines ne sont possibles qu'à certaines heures, par exemple le maquis le soir et la boîte de nuit après 21 h.
- **Les vraies infos du pays** : l'API lit des flux RSS toutes les 30 minutes (par défaut Google Actualités « Côte d'Ivoire » et Abidjan.net, réglables avec `NEWS_FEEDS`) et garde les 40 derniers titres, classés par thème (sport, politique, économie, société, culture, météo). L'appli Infos les affiche avec la source et un lien vers l'article chez l'éditeur ; un « Flash info » apparaît à l'arrivée en jeu. Code : `backend/internal/news`.
- **Ce qui se passe dans le quartier** : toutes les 2 heures, il y a environ 60 % de chances qu'il se passe quelque chose dans la rue, que tout le monde voit en 3D au même moment : mariage avec cortège, match des Éléphants sur écran géant, concert de coupé-décalé, grosse pluie, délestage, embouteillage, contrôle de police, match de foot des petits. Une annonce apparaît, un bandeau « En ce moment » y emmène le Sim, et on peut s'y joindre (danser, regarder le match…), avec ses propres imprévus. Le serveur calcule l'évènement à partir de la commune et de l'heure (`backend/internal/game/happenings.go`), sans rien stocker.
- **Les évènements aléatoires** : après une action, il y a 35 % de chances qu'il se passe quelque chose (coupure de courant, un grand-frère qui paie la tournée, un gnambro qui te fait payer 100F de plus…).
- **Le départ** : à la création, le serveur tire au hasard. *Enfant de riche* : 200 000F et un appartement. *Débrouillard·e* : un entrer-coucher, 65 000F en poche dont un microcrédit de 50 000F (60 000F à rembourser).
- **Le logement** : Entrer-coucher (7 000F/sem), Studio (15 000F), Appartement (30 000F), Villa avec piscine (75 000F). Plus le logement est beau, plus dormir, se doucher ou regarder la télé fait du bien (confort de 70 % à 130 %). On déménage depuis l'appli Logement, dans la commune où l'on se trouve, en payant 2 semaines de caution.
- **Le samedi** : à 00 h chaque samedi (le vrai samedi), le loyer tombe, puis l'agent de la microfinance prend 10 000F. Si tu ne peux pas payer, ça s'accumule ; à 2 semaines de retard, le propriétaire t'expulse vers le logement d'en dessous.
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

- **Jours fériés et calendrier** (jours de la semaine, Pâques calculée, fêtes déclarées chaque année) : `backend/internal/game/calendar.go`
- **Incidents de trajet** (bouchon sur les ponts, contrôle routier…, selon l'itinéraire) : `backend/internal/game/trips.go`
- **Expressions** (nouchi et français ivoirien, avec sens, exemple et source) : `backend/internal/game/expressions.go`

### Données du monde : réel ou inventé, et sources

Le monde couvre les **13 communes du District autonome d'Abidjan** (dont Anyama, Bingerville et Songon) et **Yamoussoukro, Bouaké, Grand-Bassam, San-Pédro, Man, Korhogo et Daloa**. Chaque commune a son rattachement administratif (district, département, région), sa **mairie** (un lieu jouable) et, à Abidjan, sa rive de la lagune (nord/sud), qui décide des bouchons sur les ponts.

Chaque lieu dit s'il est **réel** (`real`) ou **inventé pour le jeu**, d'où vient l'information (`source` : statut `verified`, `partial`, `unverified` ou `fictional`, liens, date de vérification), si sa position est **approximative** (`approx`), son quartier, son **propriétaire** et son **gestionnaire** (gardés séparés, laissés vides quand on ne sait pas), et s'il a **fermé** dans la réalité (la Rue Princesse, rasée en 2011). Les évènements, jours fériés, incidents et expressions portent la même provenance. Les horaires et les prix des activités sont des **règles du jeu**, pas des horaires ou tarifs réels.

Lieux réels ajoutés à la demande, placés d'après leur adresse publiée (aucune coordonnée GPS trouvée, donc marqués `approx` dans « À corriger ») : le centre commercial **Sococé** (Deux-Plateaux, Cocody), **PlaYce Palmeraie** (Riviera Palmeraie, Cocody, géré par CFAO) et **PlaYce Marcory** avec le premier **Burger King** d'Abidjan (ouvert en 2015, franchise Servair ; à confirmer s'il est toujours ouvert).

**Routes et ponts** (`world/roads.go`) : Abidjan a un réseau routier simplifié (communes, carrefours, autoroute du Nord, boulevard de la Corniche, boulevard VGE) et ses **cinq ponts** : Félix-Houphouët-Boigny et Charles-de-Gaulle (Plateau ↔ Treichville, coordonnées publiées), HKB (Riviera ↔ Marcory, coordonnées publiées), Alassane-Ouattara (baie de Cocody) et le 4e pont (baie du Banco) placés d'après leur tracé. Un trajet prend le plus court chemin : passer d'une rive de la lagune à l'autre, c'est forcément un pont, et le bouchon tombe sur le pont réellement emprunté. La carte dessine la route et le taxi la suit. La lagune de la carte hors ligne est redessinée pour coller aux ponts : chaque pont y passe sur l'eau, chaque route sur la terre.

**Taxis et VTC** : à Abidjan, on va **au bord de la route** ou on commande une appli. Au bord de la route, les véhicules passent au hasard (moins la nuit) : le **woro-woro** a la couleur de ta commune (bleu à Yopougon, jaune à Cocody, vert à Marcory, Koumassi, Adjamé et Attécoubé, beige à bandes marron à Abobo, jaune à bas de caisse bleu à Port-Bouët ; blanc par défaut là où la couleur n'a pas été trouvée, listé dans « À corriger »), a **quatre places** souvent déjà prises (surtout aux heures de pointe) : plein, il ne s'arrête pas ; sinon tu dis où tu vas et le chauffeur répond s'il y va. Le **taxi compteur** orange ne s'arrête que s'il est **libre**, puis prend ton groupe (amis compris, quatre au plus) pour une seule course ; au woro-woro chacun paie sa place. Le Plateau n'a pas de woro-woro. Les applis du jeu sont **Gnango** (prix fixe, inspirée de Yango) et **iDrive** (tu proposes ton prix, inspirée d'inDrive) : recherche d'un chauffeur, il **t'appelle**, puis arrive ; il peut **annuler** en route, et tu peux annuler aussi, sans payer. Dans les rues en 3D, les **feux** des carrefours règlent la circulation : on s'arrête au rouge, on fait la queue sans se chevaucher. Les prix sont des règles du jeu, pas les tarifs réels.

**Le téléphone et son Store** (`world/apps.go`) : le Store installe et désinstalle les applis (gardées sur le Sim). **Waye** (inspirée de Wave, préinstallée) : solde masquable, envoi d'argent à Maman, au petit frère ou à un ami pour 1 % de frais plafonnés à 5 000 F (ça remonte le Social), paiements du microcrédit et du loyer sans frais, historique. **Golvo** (inspirée de Glovo) : les maquis, restos et boîtes d'Abidjan avec leur menu et leurs horaires ; livraison 500 F (le tarif de Glovo à son lancement à Abidjan) plus 100 F par km au-delà de 3 km sur les routes ; le livreur à moto prépare, roule, se perd parfois et appelle, puis arrive : tu paies et tu manges où tu es. **Gnango** et **iDrive** s'installent aussi depuis le Store ; sans eux, la carte ne propose que le bord de la route.

**La rue la nuit** : aux feux rouges, des mendiants quittent le terre-plein pour tendre la main à la vitre des voitures arrêtées, puis y retournent au vert ; le fou du quartier erre entre le trottoir et le terre-plein en parlant tout seul ; tard le soir (21 h–4 h), des couples s'enlacent dans l'ombre des ruelles.

Les activités peuvent avoir des **jours d'ouverture** (`days`) et des **conditions** (`requires` : habitants de la commune seulement, argent minimum, métier, trait). Les évènements de quartier peuvent être limités à des **villes ou communes**, des **mois** (festivals), des **jours** ou un **jour férié** ; le même évènement ne revient jamais deux créneaux de suite.

**« À corriger » (Look to fix)** : `world.Audit()` liste tout ce qui manque ou cloche — champs obligatoires, données réelles non vérifiées, positions approximatives, lieux hors de leur commune ou du pays, doublons, mairie manquante ou en double, références cassées (types, métiers, communes, jours fériés), évènements incomplets, fêtes lunaires dont la date de l'année n'est pas encore saisie, lieux fermés encore actifs. Les **erreurs** font échouer les tests ; les **avertissements** sont le travail restant.

```bash
cd backend
go run ./cmd/worldcheck           # toute la liste
go run ./cmd/worldcheck -errors   # seulement les erreurs (code de sortie 1 s'il y en a)
curl localhost:8080/api/v1/world/issues   # la même liste en JSON
```

Pour compléter une donnée : corriger l'entrée dans le code (garder son identifiant, les Sims existants s'y réfèrent), mettre sa `source` à jour avec les liens consultés et la date, relancer `go test ./...`.
