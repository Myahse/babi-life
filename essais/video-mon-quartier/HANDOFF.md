# Vidéo « Mon quartier » : où on en est (handoff)

## v2 (18/11) : les nouveautés + l'appel aux testeurs Play Store — livrée

Sortie : `/tmp/claude-0/land/video-mon-quartier-2/` : `video-mon-quartier.mp4` (49,8 s, 1080×1920, 30 i/s, H.264 + AAC 192k, voix à −15 LUFS), `video-mon-quartier-whatsapp.mp4` (crf 26, ≤ 16 Mo), `-sans-voix.mp4`, `-sans-musique.mp4`, `-cover.jpg`, `-court.mp4` (26,4 s, TikTok/Reels), `script.md`, `images/` (images fixes). La v1 reste dans `/tmp/claude-0/land/video-mon-quartier/`.

Script et minutage : `script.md` (cette version). Tout le montage part d'une liste de plans : `scripts/mkedl2.py` écrit `edl2.json` / `edl2s.json` (longue / courte) et leurs plans de voix `edl2-voice.json` / `edl2s-voice.json` (sous-titres et voix placés par rapport au début de leur plan). Puis :

- son : `python3 scripts/mix2.py 49.8 edl2-voice.json musique-el2.mp3 v2-` (et `26.43 edl2s-voice.json … v2s-`) → `v2-mix-full.wav`, `v2-music-solo.wav`, `v2-voice.wav` ;
- image : `python3 scripts/compose.py edl2.json pic2.mp4 cover2.jpg 95` (et `edl2s.json pic2s.mp4`) ;
- mux : `ffmpeg -i pic2.mp4 -i v2-mix-full.wav -c:v copy -c:a aac -b:a 192k -shortest …` ;
- sous-titres, puces et carte des testeurs : `scripts/overlays2.mjs` (le lien WhatsApp est la constante `CONTACT`) ;
- vérification de la voix montée : `node scripts/stt-mix.mjs v2-voice-chk.mp3` (mp3 mono ; un wav de 9 Mo fait une erreur 500).

Voix v2 : `voix-v2/n1.mp3` … `n9.mp3` (Lea, réglages plus bas), musique `voix-v2/musique.mp3` (= `musique-el2.mp3`, 60 s).

Plans v2 (scripts dans `scripts/`, images supprimées après l'encodage) :

- `s1` survol (repris de la v1, rejoué) ; `s2a` choix du plan (joueur neuf `pl-cocody.json`) ;
- `s4v.js` construire le maquis dans la vue (lot 6) — avant : `DELETE FROM quartier_buildings WHERE kind='maquis'` pour Awa ;
- `s4r.js` le maquis qui sort de terre dans la rue (le jeu l'anime maintenant lui-même : `rise.py` n'a pas servi) ;
- `s4g.js` « Gérer » + « Encaisser » ; `s5m.js` le grand marché à 17 h ; `s5e.js` le maquis la nuit (`q.js` : `?hour=19.6`) ;
- `sR.js` l'arrêt de gbaka et la lagune/le Plateau ; `s6m.js` « Aménager » (tracés pas à pas, un anneau sous le doigt). La caméra de la vue n'est pas la même d'un chargement à l'autre : chercher les zones où l'on peut peindre (`am-try.js` compte les cases d'un trait), garder la même page pour le plan. Avant le plan, un canal d'eau validé (pour que la route y fasse des ponts) : terrain du banc `-6,-5,e;-5,-5,e;-1,-4,e;0,-3,e;-8,0,e;-7,0,e;-6,0,e;-5,0,e;-7,1,e;-6,1,e;-7,2,e` ;
- `s7k.js` visite de Koffi depuis « Quartiers de tes amis » : Koffi habite Yopougon, ce qui ouvrait le trajet en woro-woro ; pour la vidéo, `UPDATE quartiers SET commune='cocody'` pour Koffi (son quartier garde le style Yopougon), la visite est alors directe ;
- `s6a.js` « Aller à Babi » (depuis la vue de Koffi), `s6c.js` « Y aller à pied » jusqu'à la ville, `s7.js` survol de la ville (66 images, ~3 s l'image). « Rentrer au quartier » n'apparaît pas dans la barre de la ville (une invitation de PNJ revient sans cesse par-dessus) : c'est la capture fixe `babi-ville.png` de la v1 avec un anneau.

Mises à jour ouvertes dans la base du banc : celles de la v1 plus `minijeux-realistes`. `lib.mjs` pose aussi `babi.monde.choisi` (pas de carte « Où va Awa aujourd'hui ? »).

---

## v1 (17/11)

**État final (17/11, « Finish » du propriétaire) : vidéo livrée** dans `/tmp/claude-0/land/video-mon-quartier/` : `video-mon-quartier.mp4` (47,0 s, 1080×1920, 30 i/s, H.264 + AAC 192k, −15 LUFS), `video-mon-quartier-sans-voix.mp4`, `video-mon-quartier-sans-musique.mp4`, `video-mon-quartier-cover.jpg`, `script.md`. Montage : `scripts/edl.json` + `scripts/compose.py` (segments `still` = image fixe avec lente avancée), son : `scripts/mix.py 47`. Les images des plans ont été supprimées après l'encodage (disque), le banc arrêté et sa base supprimée : pour refaire un plan, refaire le banc (plus bas) et rejouer son script.

Ce qui est simplifié dans la version livrée : Yopougon et Port-Bouët sont des captures fixes de la vue « Choisis le plan » faites par un agent précédent (`/tmp/claude-0/land/mon-quartier-univers/yopougon-vue-plan.png`, `port-bouet-vue-plan.png`), avec une lente avancée ; « Rentrer au quartier » est la capture fixe `babi-ville.png` du même dossier (ancien rendu de l'avatar). La grande ville (`s7`) et tout le reste sont tournés en vrai sur le banc. Le maquis du joueur n'existe que comme épingle de la vue (les commerces du joueur ne sont pas dessinés dans la rue 3D du quartier).

Branche `video-mon-quartier` (partie de origin/main au commit `e9304bd4`). **Rien de cette branche ne va sur main** : elle contient de petits crochets de tournage dans le jeu (voir « Changements dans le jeu ») et ce dossier.

Livrables attendus dans `/tmp/claude-0/land/video-mon-quartier/` : `video-mon-quartier.mp4` (voix + musique), `video-mon-quartier-sans-voix.mp4`, `video-mon-quartier-sans-musique.mp4`, `script.md`, une couverture 1080×1920 jpg. Le script et le minutage : `script.md`.

## Fait

- **Voix** (Lea, voir « Voix ») : les 7 répliques générées et vérifiées par transcription (ElevenLabs speech-to-text), dans `voix/l1.mp3` … `l7.mp3`, les temps des mots dans `voix/words.json`. Le placement sur la ligne de temps (coupes aux pauses naturelles) : `scripts/voice-plan.json`.
- **Musique** : générée par l'API musique d'ElevenLabs (instrumentale, vérifiée sans paroles), `voix/musique.mp3` (50 s : intro calme ~16 s, groove 16–41 s, fin). Une version synthétisée localement existe aussi (`scripts/music.py`) mais moins bonne.
- **Mixage** : `scripts/mix.py 47` produit `voice.wav` (−15 LUFS), `music-solo.wav` (−15 LUFS, pour la version sans voix), `mix-full.wav` (musique −13 dB sous la voix, compressée par la voix). Testé.
- **Sous-titres et carte de fin** : `scripts/overlays.mjs` (cartes blanches du jeu, Baloo 2 extra-gras, orange #e8731f / vert #1c7a4a, logo `web/public/pin-512.png`), PNG transparents 1080×1920 + le masque arrondi de l'écran en médaillon.
- **Montage** : `scripts/compose.py edl.json out.mp4 [cover.jpg n]` (segments plein écran ou « inset » : l'écran du jeu réduit sur son propre flou, sous-titres qui apparaissent avec un léger rebond, fondus). L'`edl.json` reste à écrire quand tous les plans sont là.
- **Plans tournés** (images JPEG 1080×1920 dans `frames/`, voir « Où sont les fichiers ») :
  - `s1` (108 images, 3,6 s) : le survol d'accroche, Cocody, 17 h. **Bon.**
  - `s3` (270 images, 9 s) : Awa marche vers la caméra, la caméra monte au-dessus d'elle et s'éloigne en tournant jusqu'à la lagune et au Plateau. **Bon** (le mouvement s'accélère vers l'image 215 mais sans saut).
  - `s4` (252 images, 8,4 s) : **bon**, tout dans la vue du quartier (en médaillon au montage) : terrain libre (lot:1) → « Construire ici » → « Maquis » → « Placer : Maquis » → la carte « Maquis · à toi », le quartier passe niv. 3 (★ 280 → 320) → « Gérer » (revenus du jour, réputation 320/700, niveau 3). Les boutiques, grins et maquis du joueur **ne sont pas dessinés dans la rue 3D** du quartier (seulement les maisons à louer et immeubles : `useQuartier.ts` `built`) : ils n'existent que comme épingles de la vue. Pour rejouer le plan : `DELETE FROM quartier_buildings WHERE kind='maquis'` pour le Sim principal, `reputation=280, level=2`, `money=2700000`, recharger la page.
  - `s5` (210 images) : un woro-woro suivi depuis le rond-point (`__roamCars[10]`), arrêté au feu puis repartant, et la notification « Koffi visite ton quartier » à l'image 120 (évènement `babi:quartier-visit-in`). Interface cachée sauf `[data-overlay-host]`, barre du terrain et « À faire » cachées.
- **Voix v2** (demandée par le propriétaire : plus parlée) : les 7 nouvelles répliques, voir `script.md`. Les anciennes prises sont gardées dans le dossier de travail `voix-v1/`.
- **Rue du quartier peu peuplée** : même avec l'horloge du monde avancée à 16 h 30 (`S.shiftTo`, `vclock.on(shift)`), le marché et les maquis du monde du quartier restent vides de vendeurs et de clients ; la vie vient surtout de la circulation (taxis, woro-woros, gbakas, motos) et de quelques passants.

## Reste à faire

1. **s4** (construire) : placer le Sim au bord d'un terrain libre dont on connaît la position *et* le slot, caméra sans arbre devant (faire des images fixes autour avant, `scripts/c6.js` + `still.js`), toucher « Construire ici », « Maquis », « Placer », le maquis apparaît (vérifier qu'il est dessiné à l'endroit filmé), puis « Gérer » (le bouton n'est dans la barre que si le terrain le plus proche est le maquis ; sinon ouvrir « Gérer » autrement, p. ex. via la vue du quartier).
2. **s5** (vie) : rond-point du quartier (`univ.carrefour` = (30,5 ; −19,5)) avec taxis, gbaka, motos ; essais de caméra dans `scripts/c5.js`. Puis au maquis, la notification : `window.dispatchEvent(new CustomEvent('babi:quartier-visit-in', { detail: { from: 'x', name: 'Koffi' } }))`, en image propre avec seulement `[data-overlay-host]` gardé visible (`S.keep`).
3. **s2** (plans) : un joueur neuf de Cocody (`pl-cocody.json`, plan pas encore choisi) : la fiche « Choisis le plan » sur la vue, toucher Plan 2 puis Plan 3 (attendre `__vueReady` en temps réel entre les deux). Puis des vues d'en haut des joueurs Yopougon et Port-Bouët (`pl-yopougon.json`, `pl-port-bouet.json` : choisir un plan avec la plage pour Port-Bouët, voir `univ.edges`).
4. **s6** (Babi) : « Vue du quartier » → « Aller à Babi » → la fiche « Babi en ligne » → Cocody (ici) ; attendre la ville (temps réel, long), un survol propre, puis « Rentrer au quartier ».
5. **Fin** : survol lent du quartier (comme s1) sous la carte de fin `ov/end.png`.
6. Écrire `edl.json`, `compose.py` trois fois avec les trois pistes son (`mix-full.wav`, `music-solo.wav`, `voice.wav`), mux en AAC 192k : `ffmpeg -i pic.mp4 -i mix-full.wav -c:v copy -c:a aac -b:a 192k -shortest out.mp4`. Couverture : une image du survol avec le sous-titre d'accroche.
7. Regarder les images avant l'encodage final (`scripts/sheet.py` fait une planche et donne les plus grands sauts d'une image à l'autre), supprimer les images après, arrêter les serveurs, supprimer la base du banc.

## Le banc (local, ports à part)

- Postgres du conteneur : `127.0.0.1:55432` (cluster `/tmp/claude-pg/data`, voir NEXT_AGENT.md). Base du banc : `babi_video` (`createdb` puis l'API fait les migrations au démarrage).
- API : `cd backend && go build -o /tmp/claude-pg/api-video ./cmd/api`, puis en arrière-plan :
  `JWT_SECRET=dev-secret-dev-secret-dev-secret ALLOWED_ORIGINS=http://127.0.0.1:5981 DATABASE_URL='postgres://postgres@127.0.0.1:55432/babi_video?sslmode=disable' PORT=8981 DEV_LOGIN=true GAME_OPEN=true ADMIN_KEY=cle-test /tmp/claude-pg/api-video`
- Vite : `cd web && VITE_API_URL=http://127.0.0.1:8981/api/v1 npx vite --port 5981 --strictPort --host 127.0.0.1` (lien `web/node_modules` → `/home/user/babi-life/web/node_modules`).
- Mises à jour ouvertes **dans la base du banc seulement** :
  `for f in mon-quartier lumiere-realiste eau-realiste blocs-arrondis persos-realistes voitures-realistes facades-realistes ponts-realistes batiments-realistes; do curl -s -X POST localhost:8981/api/v1/admin/features/$f -H 'x-admin-key: cle-test' -d '{"open":true}'; done`
- Joueurs : `lib.mjs` `player(commune, name)` (connexion dev, Sim adulte, 3 000 000 Djai, testeur). Le Sim principal (Cocody, plan 1 choisi, boutique + maison + grin construits, réputation 280 niveau 2 : `setup-main.js`) est dans `ex-cocody-player.json` ; trois joueurs neufs dans `pl-*.json`.
- Arrêt : `fuser -k 8981/tcp 5981/tcp 9799/tcp` (jamais pkill), puis `dropdb`/`DROP DATABASE babi_video`.

## La prise de vue, pas à pas

La machine dessine WebGL en logiciel (SwiftShader) : 2 à 10 s par image. On ne filme donc pas en temps réel : **une horloge virtuelle** (dans `lib.mjs`, injectée avant le jeu) remplace `performance.now`, `Date.now`, `requestAnimationFrame`, `setTimeout`/`setInterval` et avance les animations CSS (`document.getAnimations()`) ; `vclock.on()` la fige, `vclock.step()` avance d'1/30 s et fait tourner une image, puis on prend la capture. `vclock.off()` rend le temps réel (pour les chargements).

1. `node scripts/repl.mjs` (un Chromium gardé ouvert, piloté en HTTP sur le port 9799) ; `scripts/r.sh fichier.js` y exécute un fichier (corps de fonction async avec `L` = lib, `S` = état partagé).
2. `r.sh cap.js`, `r.sh prev.js`, `r.sh keep.js` (définissent `S.capture`, `S.preview`, `S.keep`, `S.place`, `S.tapRing`…).
3. `r.sh load.js` : ouvre le jeu du Sim principal en 360×640 CSS × 3 (= 1080×1920), `?hour=17` (heure dorée), qualité « beau » (lumière « haute »), « téléphone léger » coupé, `__forceTraffic`, `__video = { dpr: 2, noArrow: true }`, puis « Y aller » jusqu'à la rue.
4. Un plan = un fichier (`s1.js`, `s3.js` + `s3run.js`, `s4.js`) : `S.capture(nom, n, { cam, clean, pre, go, before })`. `cam` est le corps d'une fonction `(t, i, sim)` exécutée dans la page qui rend `{ pos, look, fov }` (avec `S.ease` : `E` lissage, `L` interpolation). `clean: true` cache toute l'interface sauf le canvas de la rue ; `S.keep([sélecteurs])` garde certains éléments visibles (la barre du terrain, la notification).
5. Avant un plan long : `S.preview(nom, cam, [indices])` pour quelques images fixes, et `sheet.py` pour une planche.

Paramètres de dev utiles : `?hour=`, `?at=x,z&face=x,z` (Sim posé là), `?lumiere=haute`, `?persos=`, `globalThis.__walkTo(x, z)`, `__nav.nearest/walkable/roofAt`, `__quartier.getState()` (`univ.lots`, `univ.edges`, `univ.carrefour`, `built`), `__simGroup`.

## Changements dans le jeu (branche seulement, pour le tournage)

- `web/src/world3d/open/OpenWorld.tsx` : avec `globalThis.__video`, la résolution est fixée (`__video.dpr`) et le moniteur de performance ne baisse rien ; `VideoCam` pose la caméra depuis `globalThis.__videoCam` après celle du Walker (remonté sur l'évènement `videocam`, et reposée juste avant le rendu).
- `web/src/components/quartier/QuartierVue.tsx` : la vue du quartier prend aussi `__video.dpr`.
- `web/src/world3d/quartier/scene.tsx`, `web/src/world3d/Walker.tsx` : sans flèche ni points de chemin au sol quand `__video.noArrow`.
- `web/src/world3d/Players.tsx` : sans colonnes de lumière bleues au-dessus des joueurs lointains en tournage.

## Voix

- Voix : **« Lea - UGC creator »** (voix professionnelle de la bibliothèque du propriétaire), id `KSyQzmsYhFbuOhqj1Xxv`.
- Modèle `eleven_multilingual_v2`, `language_code: fr`, `stability 0.5`, `similarity_boost 0.75`, `style 0.1`, `use_speaker_boost true`, `speed 0.85` (un peu plus lent que normal ; à 0.92 c'était encore rapide). Sortie mp3 44,1 kHz 192 kb/s.
- La clé est lue dans la variable d'environnement `ELEVEN_LAB_KEY` et envoyée seulement dans l'en-tête `xi-api-key` (`scripts/tts.mjs`, `stt.mjs`, `emusic.mjs`, `voices.mjs`) ; elle n'est écrite nulle part.
- « gbakas » : à « les gbakas roulent » la voix disait « bacaroules » ; « les gbakas klaxonnent » passe.

## Où sont les fichiers (pas dans le dépôt : trop gros)

- Dossier de travail : `/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/` (les scripts y ont leurs chemins absolus).
  - `frames/s1/`, `frames/s3/`, `frames/s4/` : images JPEG des plans (≈ 350 Ko l'une).
  - `ov/` : sous-titres et carte de fin en PNG ; `prev/`, `st-*.jpg` : images d'essai.
  - `voix/` : voix ; `musique-el.mp3` ; `voice.wav`, `music-solo.wav`, `mix-full.wav` (mix de 47 s).
  - `ex-cocody-player.json`, `pl-*.json` : jetons des joueurs du banc (banc local seulement).
- Sortie finale : `/tmp/claude-0/land/video-mon-quartier/`.
