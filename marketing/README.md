# Babi Life: logos, flyer and video

Everything for the launch of the wish list (**lifeinbabi.com/liste**), made from the game itself: the persos and the house are the game's real blocky persos, rendered by `web/src/lab/poster.tsx`.

## The files (`out/`)

| File | For |
| --- | --- |
| `logos/babi-life-mark.svg/.png` | The mark (map pin over the Abidjan sun), rounded square |
| `logos/babi-life-app-icon.svg/.png` | The app icon, full bleed (stores, home screen) |
| `logos/babi-life-mark-pixel.svg/.png` | The mark in pixels, in the blocky style of the game |
| `logos/babi-life-logo-on-dark.*`, `-on-light.*` | Mark + « Babi Life », on one line |
| `logos/babi-life-logo-stacked-on-dark.*`, `-on-light.*` | Mark above the name |
| `logos/babi-life-logo-white.*`, `-black.*` | One colour (on a photo, a T-shirt, a stamp) |
| `logos/babi-life-logos-sheet.png` | All of them on one page |
| `babi-life-flyer-A5.pdf` | The flyer to print, A5 (148 × 210 mm, no bleed: ask the printer for a white margin or trim) |
| `babi-life-flyer-A5-300dpi.png` | The same, as an image |
| `babi-life-flyer-post-1080x1350.png` | Instagram / Facebook post |
| `babi-life-flyer-status-1080x1920.png` | WhatsApp status, story |
| `babi-life-video-1080x1920.mp4` | The video, 25 s, vertical, no sound (add music in CapCut/InShot) |
| `babi-life-video-cover.png` | The video's last frame (QR code), as a cover |
| `babi-life-video-bouger-1080x1920.mp4` | The second video, 31 s: « À Babi, on bouge comment ? » — the gbaka and its apprenti calling « Adjamé ! Yop ! », a Gnango ride booked on the phone, a night at the Rue Princesse |
| `babi-life-video-bouger-cover.png` | Its last frame, as a cover |
| `babi-life-video-bande-annonce-1080x1920.mp4` | **The trailer**, 30 s: « Tu nais gnambro ou laté ? » — a gnambro family (torn clothes, flies) then a laté one (villa, gold), building the house, the travaillement at the maquis, basket at the Palais des Sports |
| `babi-life-video-bande-annonce-cover.png` | Its last frame, as a cover |
| `babi-life-video-decouverte-1080x1920.mp4` | **Everything you can do**, 71 s, eleven numbered shots: create your perso, change your look, be born into a family, build your house, the gbaka, Gnango, talk with people (« C'est comment famille ? »), party, sport, the real places, the phone and its apps |
| `babi-life-video-decouverte-cover.png` | Its last frame, as a cover |
| `babi-life-video-live-1080x1920.mp4` | **Le live d'Awa**, 96 s, **avec la voix** (`voix-live.mp3`, ElevenLabs) : Awa se filme en direct avec son téléphone (« Allô allô ! Vous me voyez ? ») puis montre le jeu, dans un cadre de live (EN DIRECT, les vues qui montent, les commentaires, les cœurs, son visage dans une bulle, ses mots en sous-titres) : son perso, Yopougon, le garbadrome et Waye, le pain brochette, le gbaka et Gnango, les fonctionnaires du Plateau (la descente), la maison, le match et le concert au stade, Gbairai entre amis, les couloirs la nuit, puis le QR code |
| `babi-life-video-live-cover.png` | Its last frame, as a cover |
| `babi-life-video-merci-1080x1920.mp4` | **« Merci la famille »**, 36 s, **avec la voix** (`voix-merci.mp3`, ElevenLabs) : Awa, chez elle dans son salon et avec un nouveau look (tresses, haut et jupe en kente vert, ses bijoux), remercie la communauté pour les **1 500 abonnés sur TikTok** (le compteur qui monte, les confettis, « MERCI LA FAMILLE ! »), demande comment s'est passé le week-end (le maquis, le stade, le concert, les commentaires qui répondent), souhaite une bonne semaine (le gbaka du lundi matin) et annonce que de bonnes nouvelles arrivent (le cadeau qui bouge, « Bientôt… »). Script, texte pour la voix et légende du post : `scripts/merci-1500.md` |
| `babi-life-video-merci-cover.png` | Its last frame, as a cover |
| `babi-life-video-arnaque-1080x1920.mp4` | **« On m'a arnaquée sur Waye »**, 55 s, prévention : Awa raconte, dans sa chambre la nuit, le message de « Fanta » sur Gbairai avec un lien de faux « bonus Waye », la fausse page où elle donne son numéro et son code secret, son solde qui fond jusqu'à 0 F (« ARNAQUÉE »), l'appel à Fanta (piratée), puis le lendemain à la cabine Waye l'agent qui secoue la tête ; les trois conseils (jamais son code ; un lien qui promet de l'argent = arnaque, même d'un ami ; appeler vite pour bloquer son compte) ; et dans Babi Life, sur Gbairai, le lien masqué. Voix `voix-arnaque.mp3` quand elle est là. Script, texte pour la voix et légende : `scripts/arnaque-waye.md` |
| `babi-life-video-arnaque-cover.png` | Its last frame, as a cover |
| `babi-life-video-keke-1080x1920.mp4` | **Le micro-trottoir de Keke**, 58 s : Keke, l'ami d'Awa (casquette orange à l'envers, maillot des Éléphants), demande aux gens de Babi « Qu'est-ce que tu veux dans Babi Life ? » : Mariam à Yopougon (le mariage), Moussa l'apprenti à Adjamé devant son gbaka (conduire le gbaka), Tantie Adjoua à son maquis de Treichville, Junior à Cocody devant le mur aux couleurs des Éléphants (la CAN), Vieux Koffi sous le manguier à Abobo (le village), Prisca devant son salon à Marcory ; leurs envies s'ajoutent à l'écran, puis Keke demande la vôtre en commentaire. Voix `voix-keke.mp3` (une voix par personne, mises bout à bout). Script, textes des voix et légende : `scripts/keke-micro-trottoir.md` |
| `babi-life-video-keke-cover.png` | Its last frame, as a cover |
| `babi-life-video-sortie-1080x1920.mp4` | **« Babi Life sort mercredi 28 octobre »**, 40 s : la suite de « Merci la famille ». Awa, chez elle avec son look en kente, ouvre le cadeau qu'elle avait annoncé : une page de calendrier en sort, **MERCREDI 28 OCTOBRE**, « Babi Life sort ! », les confettis, les commentaires qui réagissent. Puis les nouveautés de ces derniers jours, chacune avec « NOUVEAU » : la politique (le bulletin de l'élection du maire, « A voté ! »), les matchs entre amis, Flashé, le jeu sans réseau ; la date épinglée en haut, l'appel à s'inscrire sur la liste, et la fin avec la date et le QR code (`?src=video-sortie`). Muette tant que `voix-sortie.mp3` n'est pas là (ElevenLabs, voix « Lea - UGC creator »). Script, textes pour la voix et légende : `scripts/sortie-28-octobre.md` |
| `babi-life-video-sortie-cover.png` | Its last frame, as a cover |
| `babi-life-video-gameplay-1080x1920.mp4` | **How you play**, 39 s, **with its beat** (`son-gameplay.mp3`, made by `beat.py`): « TU NAIS… GNAMBRO », « TON BUT : DEBOUT », then six numbered steps, fast cuts with a flash and a zoom, the goal, the money and the six families' ladder always on top: 1 work (the salary, +150 000 F), 2 take care of yourself (the shower fills the hygiene gauge), 3 go about Babi (the zoo's elephants, the game's three views: from above, close, over the shoulder), 4 try your luck (the loto kiosk, a bet won on Bet225, +45 000 F), 5 party with your friends (the maquis, −20 000 F), 6 build your house (−120 000 F); « petit à petit » the perso climbs to debout, then « Et toi, tu finis gnambro ou debout ? » and the QR code (`?src=video-gameplay`) |
| `babi-life-video-gameplay-cover.png` | Its last frame, as a cover |
| `babi-life-video-top20-1080x1920.mp4` | **« 20 trucs à faire dans Babi Life »**, about a minute at 30 images a second, a countdown **filmed in the game while it's played** (the real screens and places: the score, the stick, the buttons, the cards, the chat), **with Awa's voice** (`voix-top20.mp3`, made here by `voice.py`) over its beat (`son-top20.mp3`, ducked under her words), each number lasting as long as her line on it: the hook (four flashes: the ski, the joker, the basket, the goal, « TU T'ENNUIES ? 20 TRUCS À FAIRE DANS BABI LIFE »), then N°20 water-skiing off Île Boulay, N°19 talking nouchi, N°18 selfies with the zoo's lions, N°17 the tea at the grin, N°16 the market, N°15 taking photos, N°14 the mass, N°13 the Friday prayer, N°12 window-shopping at the mall, N°11 the cinema, N°10 brunch facing the lagoon, N°9 the club in the rue Princesse, N°8 the zouglou, N°7 the plane to Yamoussoukro, N°6 the Tour F, N°5 a rafle at dames, N°4 a joker at 8 américain, N°3 the kart race, N°2 a basket, N°1 a goal; each one swiping up over the one before as on TikTok, the number and its name top left, a bar of twenty segments along the top, Awa's words in white boxes; the end card (« ET TOI, TU COMMENCES PAR LEQUEL ? », « + de 160 activités dans le jeu », the QR code, `?src=video-top20`). Script, voice and the post's caption: `scripts/top20.md` |
| `babi-life-video-top20-cover.jpg` | Its end card, as a cover |
| `babi-life-flyer-famille-*` | The trailer's flyer: « Tu nais gnambro ou laté ? », the two families side by side (A5 PDF and 300 dpi PNG, post 1080 × 1350, status 1080 × 1920) |
| `babi-life-flyer-commentaire-*` | For the comments: « Tu es tombé·e dans quelle famille ? », the six families with their odds (debout 4 %, laté 8 %, lagnon 15 %, poignon 33 %, coulé 25 %, gnambro 15 %), « Écris ta famille en commentaire » and two example comments (A5 PDF and 300 dpi PNG, post 1080 × 1350, status 1080 × 1920) |
| `babi-life-flyer-decouverte-*` | « Tout ce que tu peux faire à Babi »: nine pictures from the game (same sizes) |

The SVGs have the name in outlines: they open anywhere without the font. The QR codes lead to `lifeinbabi.com/liste?src=flyer` (flyer), `?src=video` (the launch video), `?src=video-bouger` (the second one), `?src=video-bande-annonce`, `?src=video-decouverte`, `?src=video-gameplay`, `?src=flyer-famille`, `?src=flyer-decouverte` and `?src=flyer-commentaire`, so the export of the list says where each sign-up came from.

## Making them again

```sh
cd web && npm ci && cd ../marketing && npm ci
npm run logos   # out/logos/
npm run flyer   # the flyer (needs out/logos/ first)
npm run video          # the launch video (a few minutes: drawn frame by frame; needs ffmpeg)
npm run video:bouger   # the second video (gbaka, Gnango, Rue Princesse)
npm run video:bande-annonce   # the trailer
npm run video:decouverte      # everything you can do (about an hour to draw)
npm run video:live            # Awa's live, with out/voix-live.mp3 as its sound (about 40 min)
npm run video:merci           # « Merci la famille », 1 500 followers (out/voix-merci.mp3 as its sound when there)
npm run video:arnaque         # « On m'a arnaquée sur Waye », prevention (out/voix-arnaque.mp3 as its sound when there)
npm run video:keke            # Keke's street interview « what do you want in Babi Life? » (out/voix-keke.mp3)
npm run video:sortie          # Awa: the game comes out on Wednesday 28 October (out/voix-sortie.mp3 when there)
npm run video:gameplay        # how you play, with its beat (beat.py writes out/son-gameplay.mp3)
npm run video:top20           # the top 20, filmed in the game being played (top20.mjs, after voice.py: needs a local API with DEV_LOGIN, the game's dev server against it, its database; see the file's top)
node flyer-jeu.mjs            # the « famille » and « découverte » flyers
node flyer-tout.mjs           # « Tout ce que tu peux faire à Babi » (pictures in out/art/tout/)
node flyer-commentaire.mjs    # « Tu es tombé·e dans quelle famille ? », for the comments
```

The gameplay video's sound is made by `beat.py` (Python and numpy, no sample): a coupé-décalé-style beat at 124 BPM, a whoosh and a hit on every cut, a cash register on every money change, on the film's own times. `FILM=top20 TIMES=out/video-frames/top20/plan.json python3 beat.py` makes the top 20's (`out/son-top20.mp3`) on the times measured on Awa's voice, with the crowd roaring at the goal; her voice goes over it, the beat ducked while she speaks.

Awa's voice for the top 20 is made here (`voice.py`): an open model (Chatterbox multilingual, MIT licence, its takes watermarked) says each line three times, in French, lively, and Whisper keeps the take it understands best; the film is then timed on her lines (a number lasts as long as its line). Her usual ElevenLabs voice can replace it: one wav per line in `out/voix-top20/`, then `python3 voice.py --measure`.

The top 20 is filmed in the game itself (`top20.mjs`): too slow here to play it live, the page's clock is stopped (`clock.mjs`: the time, the frames, the timers) and moved on by hand one frame at a time, each frame taken as it comes; the matches and the kart play by themselves (the game's own AI drives the player's), the game's places are zoomed into and turned round as a player does it (the wheel, a drag), the tables are dealt by hand in the database, and `compose.py` puts the takes together (the swipes, the overlay drawn by `web/src/lab/poster.tsx` with `?video=top20&overlay&times=…`).

Another address: `WAITLIST_URL=https://… npm run all`. Chromium is found where Playwright puts it, or set `CHROMIUM=/path/to/chrome`.

## The wish list

The page is `/liste` in the web app (`web/src/screens/Waitlist.tsx`); sign-ups go to the API (`POST /api/v1/waitlist`, table `waitlist`). To download the list as a spreadsheet:

```sh
curl -H "X-Admin-Key: $WAITLIST_ADMIN_KEY" https://<the API>/api/v1/waitlist/export -o liste.csv
```

`WAITLIST_ADMIN_KEY` is generated by Render (Environment tab of the API). The web app must allow the site's address: add `https://lifeinbabi.com` to the API's `ALLOWED_ORIGINS`.
