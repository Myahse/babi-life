# Babi Life : où on en est (passation)

Branche de travail : `claude/modest-fermat-904lhi` (dépôt `Myahse/babi-life`).

## Ce qui est en ligne (main)

- `23607f9` **Godé** : le jeu de dé du maquis (« mon grand / mon petit »), fermé derrière la mise à jour « Godé » dans l'admin. 18+, mise de 0 à 2 000 Djai, 120 manches par jour, le premier lanceur alterne.
- `99b4a36` **Choisir son terrain dans la ville** (mise à jour `lot-carte`, à ouvrir dans l'admin) :
  - dans la commune où l'on est, la caméra monte et un terrain fantôme se place au bord de la rue (`world3d/open/lotGhost.tsx`, `store/lotPlace.ts`, `components/LotPlaceHud.tsx`) ;
  - vert là où c'est libre ; rouge sur la route, dans l'eau, sur un terrain de sport, sur une vraie maison ou chez un voisin ;
  - pour une autre commune, on choisit sur la carte Mapbox (`LotMap.tsx`, CSS Mapbox corrigé).

## Sur la branche seulement (pas encore sur main)

1. `6a76847` **Rien ne traverse le terrain fantôme** : quand il est vert, les maisons et les arbres qui seront rasés disparaissent de sous lui.
   - Fichiers : `world3d/open/lotClip.ts` (shader), attribut `lotBc` par bâtiment (`builder.ts`, `meshes.ts`, `chunkJob.ts`, `OpenWorld.tsx`).
   - Vérifié dans le labo `city.html?view=lotplace`.
2. `f932801` **Pluie : tout le monde court s'abriter** :
   - Fichiers : `world3d/open/rainRun.tsx`, `nav.ts` (`shelters`, `clearLine`), branché dans `OpenWorld.tsx` (Passerby), `streetlife.tsx`, `streetPeople.tsx`, `streetFoot.tsx`, `field.tsx`, `bridgeLife.tsx`.
   - Comportement : passants, scènes de rue, enfants, écoliers, joueurs et supporters des terrains (sortie par le portail) ; sur les ponts, on court.
   - Vérifié dans le labo `city.html?view=rain`.
3. **En cours, NON vérifié** (commit « WIP ») : **les voitures respectent le code de la route**.
   - `world3d/open/trafficFlow.tsx` :
     - `junctionsOf` : les carrefours sans feu ;
     - `giveWay` : stop en sortant d'une petite rue sur une grande, priorité à droite entre routes de même largeur, on n'entre pas si une voiture est dedans ;
     - `queueOf` : ces attentes comptent comme des files.
   - `OpenWorld.tsx` `Car` :
     - vitesse `v` de 0 à 1, freinage plus rapide que l'accélération ;
     - ralentit dans les petites rues et les virages ;
     - s'arrête si le Sim est devant ;
     - voit plus loin pour freiner à temps (`blockedAhead(..., 3)`).
   - `RoadTraffic` est exporté pour le labo `city.html?view=traffic` (`window.__moving` en dev).
   - **Premier test du labo : pas bon.**
     - Sur 40 mesures, 37 paires de voitures à moins de 2,2 m l'une de l'autre, avec seulement 8 voitures.
     - Aucune attente « stop » ni « junction » vue : la priorité aux carrefours ne s'est pas déclenchée.
     - À faire : comprendre pourquoi. Les carrefours du quartier de test sont peut-être filtrés par `junctionsOf`, ou les voitures sont garées au même endroit en bout de tournée. Corriger, puis vérifier qu'aucune voiture ne se chevauche.

## Encore à faire

- **Lampadaires** : fait (pied en béton, mât effilé, col de cygne, tête « cobra » ; la nuit, la flaque de lumière au sol, le halo et le cône). Fichier : `world3d/open/streetlights.tsx`.
- Finir et vérifier le code de la route (ci-dessus), puis pousser sur main **en une seule fois** : les points 1, 2 et 3.
- En attente de l'utilisateur :
  - ouvrir dans l'admin « Choisir son terrain dans la ville », « Godé », « Parler librement aux gens » ;
  - mettre la date d'ouverture du métro (il la met lui-même) ;
  - donner son avis sur le choix du terrain dans un vrai quartier.
- Réglé, confirmé par l'utilisateur : le Pullman garde son nom ; le Noum et le Pullman sont bien orientés.

## Façon de travailler (à garder)

- **Pousser sur main** :
  - créer un worktree : `git worktree add /tmp/claude-0/main-wt origin/main` ;
  - y faire `git cherry-pick` des commits ;
  - créer le lien `web/node_modules` vers celui du dépôt principal ;
  - vérifier : `npx tsc -b`, `npx vite build --outDir /tmp/claude-0/mainbuild`, `go build ./...` ;
  - supprimer le lien `web/node_modules`, puis `git push origin HEAD:main` et `git worktree remove --force`.
- Vercel a une limite de déploiements par jour : regrouper les envois sur main.
- **Ne jamais envoyer** :
  - `native/`, `*.native.ts(x)`, `marketing/out/`, `.claude/` ;
  - un secret, le code testeur, l'e-mail de l'utilisateur ;
  - l'ID d'un modèle.
- **Fonctionnalités** : chaque nouvelle fonctionnalité est fermée derrière l'admin « Mises à jour ». Il faut :
  - l'ajouter à `features.go` ;
  - ajouter sa clé à `MAYBE_KEYS` ;
  - utiliser `keyOpen` côté client ;
  - la refuser côté serveur.
- **Langues et style** :
  - textes du jeu et du README en français, commentaires du code en anglais ;
  - TypeScript sans point-virgule, guillemets simples ;
  - comptes rendus à l'utilisateur en français, courts.
- **Erreurs** : jamais de code d'erreur serveur ni de variable d'environnement montrés au joueur (passer par `errorText` / `playerText`).
- **Règles du jeu** :
  - rien ne doit traverser rien ;
  - le foot de rue (`streetball`) doit rester inchangé : après toute modification de `streetball/game.ts`, refaire le test footsim ;
  - casino : les taux affichés seulement dans « Les règles » repliées, plafonds journaliers ;
  - pas de vrai argent hors de la boutique ;
  - jamais `VITE_GAME_OPEN`.
- **Labos** (`web/city.html?view=…`) : `lotplace`, `lotmap`, `rain`, `traffic`, `app&app=awale|ludo`, etc.
  - Lancer : `npx vite --port 5175` avec `VITE_MAPBOX_TOKEN` factice.
  - Capturer : Playwright avec `--use-angle=swiftshader`.
