# Babi Life: handoff for the next agent

Last updated 2026-11-04. This replaces the earlier handoffs (`HANDOFF.md` now only points here).

Babi Life is a life-sim set in the real Abidjan (and the rest of Côte d'Ivoire): you create a perso, are born into a family drawn by lot, and live in a 3D open world built from the real map, with a phone full of apps (Waye, Gbairai, Tikitoko, Babigram, Golvo…), jobs, défis (mini-games), casino, politics, sport. The repo is `myahse/babi-life`.

| Folder | What | Where it runs |
|---|---|---|
| `web/` | React 19, TypeScript, Vite, Tailwind 4, react-three-fiber, Mapbox GL | Vercel |
| `backend/` | Go (chi, pgx), migrations embedded in `backend/internal/db/migrations/` (last: `113_funnel.sql`) | Render (free plan), DB on Neon |
| `native/` | the Android app (Expo, React Native) drawing `web/src` natively | **branch only** |
| `mobile/` | the old Flutter webview | |
| `tools/` | data pipelines: `places/` (OSM places by commune), `buildings/` (real house footprints), `loadtest/` | run by hand |
| `marketing/` | flyers, videos, logos (`marketing/out/` branch only) | |

The `README.md` (French) has one bullet per feature with its files: **read the bullets for whatever you touch** before changing it. `docs/economie.md` is the reference for every Djai amount; `docs/emails-whatsapp.md` for e-mails and WhatsApp.

## Rules from the user (always apply)

- **Branch:** the last session worked on `claude/determined-maxwell-pva2b4`, based on main, and main was fast-forwarded from it (`git fetch -q origin main && git merge-base --is-ancestor origin/main HEAD && git push origin HEAD:main`). Use the branch your session is given. If main and your branch have diverged, put commits on main by cherry-pick in a worktree, building there first:
    ```
    git fetch -q origin main
    git worktree add -q /tmp/claude-0/main-wt origin/main
    cd /tmp/claude-0/main-wt && git cherry-pick -x <sha>
    ln -s /home/user/babi-life/web/node_modules web/node_modules
    (cd web && npx tsc -b && npx vite build) && (cd backend && go build ./...)
    git push -q origin HEAD:main
    cd /home/user/babi-life && git worktree remove --force /tmp/claude-0/main-wt && git worktree prune
    ```
  - **Pushing to main needs the user's fresh, explicit word** (« pousse », « pousse sur main »): the session's safety check refuses it otherwise. Ask, don't retry.
  - **Never on main:** `native/`, `*.native.ts(x)` and their `*.web.ts` twins, `web/src/lib/canvas.ts`, `.github/workflows/native*`, `marketing/out/`, voice mp3s, `.claude/`.
  - Check the staged files (`git status --short`) before every commit. No PRs unless asked.
- **Commit messages** in French, ending with
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <your session URL>
  ```
  No model IDs anywhere else (code, files, PRs). No secrets, keys, tester code or the user's e-mail in the repo.
- **README:** in French, one bullet per change, « - **Titre** (`chemin`) : … ».
- **Language:** code comments in English; game text in French through `t()` / `tr()` (web, with the English in `web/src/i18n/lang-en.json`, checked by `npm run -s i18n:check`) and the server's (`go run ./cmd/i18n -check`; add missing ones with `-todo file` then `-from file -merge file`, lines `index|English`). The admin page (`web/src/screens/Admin.tsx`) is French only, not translated.
- **Style:** single quotes, no semicolons, long lines, comments that say why. **Never run prettier on existing files** (they aren't prettier-clean; it rewrites them). On new files only: `npx prettier --no-semi --single-quote --print-width 300 --write <file>`. Go: `gofmt` (`internal/i18n/middleware.go` is already unformatted; leave it).
- **No more waitlist:** the site sends everyone straight to log in and play (`/liste*` redirects to `/`); accounts that were on the list are removed from it (migration `112`, trigger `users_leave_waitlist`).
- **New features ship closed** behind the admin's « Mises à jour »: an entry in `backend/internal/features/features.go` `List` (ID, French label and « about », the catalog interactions and phone keys it brings), `MAYBE_INTERACTIONS` / `MAYBE_KEYS` in `web/src/lib/features.ts`, entry points hidden with `activityOpen` / `keyOpen`, refused by the server (`features.Default.Blocks`, `BlocksKey`, `Open`). The labs (`city.html`) show everything.
- **Money:** don't touch GeniusPay (code, keys, webhook) or the packs' real prices. No real-money mechanic beyond the existing shop. Never make the game unplayable for free players. Free hosting plans only.
- **Brands:** invented names only in the game (Waye, Gbairai, Tikitoko, Babigram, Golvo, Poulman, Noum, Azalé, Rabisson…). Real data sources may be credited (Réglages has the map credits line).
- **Jobs need no diploma** (any adult can take any job).
- **Never fall back to the classic street view.**
- **Kids' street football** (`open/streetFoot.tsx`) stays as it is.
- **Romance** is fade-to-black only; explicit content and sex workers stay declined.
- **Play Store:** don't publish the app to Production until it's tested (testers track only).
- **Reports to the user in French**, short, plain. The user no longer wants reminders of things waiting on them in every report.
- Never `pkill` in compound commands; never kill processes with a loop over `/proc/*/cmdline` that matches your own command (it kills the shell). To kill the dev API after a rebuild, match `/proc/*/exe` against `/tmp/claude-0/api*`, or `fuser -k 8099/tcp`.

## Checks before pushing

```
cd web && npx tsc -b && npm run -s i18n:check && npx vite build
# (i18n:check currently FAILS: ~400 strings of recent features have no English yet. See « Open » below.)
cd backend && go build ./... && go vet ./... && go test ./... && go run ./cmd/i18n -check
```

## Local bench (cloud container; it reboots often, so Vite and the API die: restart them)

What the last session used (the scratchpad scripts are gone after a reboot; recreate them):
- **Postgres:** a cluster in `/tmp/claude-pg/data`, port 55432, run as `nobody`: `su nobody -s /bin/sh -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/claude-pg/data -l /tmp/claude-pg/log -o '-p 55432 -k /tmp' start"`. Game DB `babi_admin`; Go tests use `TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres?sslmode=disable`. If `/tmp/claude-pg` is gone, `pg_ctlcluster 16 main start` (port 5432) as in older sessions.
- **API:** `cd backend && go build -o /tmp/claude-pg/api4 ./cmd/api`, then in the background `JWT_SECRET=dev-secret-dev-secret-dev-secret ALLOWED_ORIGINS=http://127.0.0.1:5294 DATABASE_URL='postgres://postgres@127.0.0.1:55432/babi_admin?sslmode=disable' PORT=8099 DEV_LOGIN=1 GAME_OPEN=1 ADMIN_KEY=cle-test /tmp/claude-pg/api4`.
- **Vite:** `cd web && VITE_API_URL=http://127.0.0.1:8099/api/v1 npx vite --port 5294 --strictPort --host 127.0.0.1` (background, long timeout).
- **Open a feature locally:** `curl -X POST localhost:8099/api/v1/admin/features/<id> -H 'x-admin-key: cle-test' -d '{"open":true}'`.
- **Test players:** `POST /auth/dev {name}` returns a token. In the page's `localStorage`: `ivoire-life-session` = `{state:{token,user},version:0}`, `babi.tuto`/`babi.firstSteps`/`babi.tuto.adulte` = `done`, `babi.pushAsked`, `babi.featuresSeen`; then `/jeu`. Wait ~30 s for the street.
- **Browser:** Playwright from `/home/user/babi-life/marketing/node_modules/playwright-core/index.mjs`, `chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`, proxy `{ server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' }`. Slow: pick things by time.
- **Labs** (dev only): `web/city.html?view=…` (see `web/src/lab/city.tsx`; `view=landmark&id=…&cam=&look=`), `web/prologue.html?id=<film>[&bd=1][&shot=&t=]` (the stories' films), `web/gestes.html?g=…` (played actions; **`g=epreuve:<story>`** runs a story's épreuve).
- **Network:** OpenStreetMap, Overpass are blocked; `tiles.openfreemap.org`, Nominatim, `api.mapbox.com`, ElevenLabs work through the proxy. In node, `NODE_USE_ENV_PROXY=1`.
- **ElevenLabs** (voices of the films): the key is in the environment (`ELEVENLABS_API_KEY`); never print or commit it. Lea `KSyQzmsYhFbuOhqj1Xxv` narrates; the characters' voices are in each film's `cast`.

## Done in the last session (2026-11-03/04; all on main, up to `3445e7e7`)

Details and files for each are in the README's bullets.
- **Robberies, prison, Waye** (`game/braquage.go`, `sims/prison.go`, `components/defi/Fuite.tsx`, `components/Prison.tsx`, `game/money.go`): the getaway is its own mini-game; prison at the MACA has étapes before release; « déplafonnement » of Waye (paid, Google Play product `waye_deplafonne` still to create by the user). The update « braquages » ships closed.
- **PNJ players** (`sims/pnj.go`, `components/Players.tsx`): fake players with a violet name and « (PNJ) », greet with memory, invite; never counted online.
- **Online football sync** (`web/src/streetball/online.ts`): snapshot interpolation.
- **Invite from anywhere** (`sims` `inviteTrip`, `FriendsApp`): who pays the taxi.
- **Admin filters and funnel** (`admin/filter.go`, `admin/retention.go`, `auth/funnel.go`, migration `113`): players by day back / gone, e-mail audiences from a filter; the new players' funnel (tuto started/done, 1st activity, 2nd session, D1, D7) in /admin. **Ask the user what the funnel shows**: it says where players drop.
- **Stories: films for every chapter** (`components/prologue/`, `tools/prologues/chapitres.py`, `scenarios/chapitres/`, 95 films + 25 prologues): 3D film and comic, voices (ElevenLabs), varied gestures. Regenerate with `go run ./cmd/prologues -chapters > /tmp/chapters.json` then `python3 tools/prologues/chapitres.py /tmp/chapters.json`; voices `tools/voix/prologues.mjs`, panels `tools/prologues/panels.mjs`, check `tools/voix/verifier-prologues.mjs`.
- **Épreuves: a unique mini-game per story** (`game/epreuves.go`, `sims` `epreuveNow`, `components/defi/epreuves/`): 25 games, an extra step at the end of a chapter, offered only when the story is there, played as the défi « epreuve ». Shared kit (`kit.tsx`: canvas, effects, countdown, `drawPerson`), the player's real avatar in a corner reacting (`Avatar.tsx`, hidden on weak phones).
- **IUGB, Bingerville garden** (`world3d/open/iugb.tsx`, `jardinBingerville.tsx`): from the user's photos.
- **Needs decay while connected** (`game/needs.go`, `web/src/game/rules.ts`), **total players on the site** (`GET /players/count`), **flyer « histoires »** (`marketing/flyer-histoires.mjs`, street-sign style; the user rejected gradients).
- **Faster load** (`world3d/open/landmarks.tsx` lazy models, `lib/lazyIn.tsx`, `components/Defi.tsx`): the game screen's code went from 2.3 MB to 1.8 MB. **Graphics quality** Auto / Légère / Belle in Réglages (`lib/device.ts`).
- **Next goal always visible** (`components/NextGoal.tsx`): under the mini-map, one line and « Y aller ». **Short place menus** (`screens/Play.tsx` InteractionMenu): « Pour toi maintenant » then « Toutes les actions (N) » (not yet seen on screen: the test Sim was 2 km from a maquis).
- **First story right after the tuto** (`components/FirstStory.tsx`): pick one, its film plays.
- **Camera: over-the-shoulder by default** (`screens/Play.tsx` `babi.view2`, `world3d/Walker.tsx`): close behind the perso like a block game's third person, swinging behind as it walks. The user asked for exactly this (« comme Minecraft dans la rue, proche »).
- **The avatar lives** (`game/simTalk.ts`, `world3d/simVoice.ts`, `Walker.tsx`): idle gestures by needs and hour, a speech bubble (needs, hour, money, welcome back), a tap on it makes it turn and answer by mood.
- **Players online in the street** (`sims/players.go` `around`, `world3d/Players.tsx`): all connected players of the commune, no cap, « ici » counts exactly those; a blue light column over players more than 70 m from the camera (pink for one's partner). Tested on the bench with a WebSocket client.

## Open, or possible next

- **Next job asked by the user: the tutorial video** (episode 1 made, `marketing/out/babi-life-tuto-ep1-1080x1920.mp4`, sent to the user for approval of the style; episodes 2–6 and the full cut to do, plan in `marketing/scripts/tuto.md`). Made by `marketing/tuto-voix.mjs` (Awa's lines, Lea `KSyQzmsYhFbuOhqj1Xxv` on `eleven_v4`, add each episode's lines there) and `marketing/tuto.mjs` (one continuous take per episode on the local bench below, `EP=n`; add an `episodeN(page)` with its timed actions: taps (the finger comes to them), typing, real-time waits). No music yet (it uses `out/son-tuto.mp3` if there, ducked under her). A real tutorial from zero, filmed in the real game on a phone screen with a finger showing the taps, each step numbered and titled, Awa's voice by ElevenLabs. The user creates the cloud environment « babi-life » (it allows `api.elevenlabs.io`) and adds their ElevenLabs API key there as `ELEVENLABS_API_KEY` (never in chat or the repo); start the session on it. Ask them which ElevenLabs voice (Awa's earlier videos used one of theirs). Steps: 1 lifeinbabi.com, « Jouer », sign up; 2 create the perso; 3 the birth and the family drawn by lot; 4 daily life (needs, walking the commune, a maquis, sleep); 5 a job (no diploma), pay, the phone and Waye; 6 the games (foot, billard, kart, combat, cards), a few seconds each; 7 friends (who's online, greet, invite, join, Tikitoko live); 8 travel (car or plane to San-Pédro, Bassam's beach, the N'Zi safari in the 4x4); 9 the goal « devenir debout », lifeinbabi.com and a QR code. Deliver a full vertical cut (~2 min 30) and 6 episodes of 25–30 s; send episode 1 first for the user to approve the style. Tools to reuse: `marketing/vie.mjs`, `top20.mjs` (filming the game played against a local API), `compose.py`, `beat.py`; outputs in `marketing/out/` (branch only).

**What the user cares about most now: losing players.** They want the game to feel alive and real in the first minutes, more than more content. In order:
1. **Redo the dances' animations** (asked last): the coupé-décalé, zouglou, travaillement, `dance` and the emotes `zouglou`/`gweta`/`moonwalk`… look generic. They're procedural in `web/src/avatar/Human.tsx` (`usePoseRig`, `pose === 'dance'`, beat/bounce) and `web/src/avatar/emotes.ts` (arm/leg/body keyframes per emote). Make them read as the real Ivorian dances (coupé-décalé's shoulder and hip work, the travaillement's arm throws), timed to the music.
2. **Actions done for real on the spot (« point 4 »):** at the maquis the Sim sits at a table and eats with the plate, drinks with the bottle, queues at the boutique… instead of a generic pose where it stands. Start from `world3d/OutdoorAction.tsx`, `world3d/interior/doings.tsx`, `ActionProps.tsx`.
3. **More to do in the street itself (« point 5 »)**, without a menu: sit on a bench, buy straight from the alloco seller, play with the kids, greet passers-by.
4. **English for ~400 strings** (`npm run -s i18n:check` fails): `node scripts/i18n/extract.mjs --todo F` then `--merge EN --from F` (EN lines: `id<TAB>English`).
5. **Check on screen:** the short place menu, the tap-on-avatar answer, the first-story sheet, the camera at spawn (in front of the home's door it looks at the wall until the Sim walks).
6. **Lighter still:** the landmark modules stay in the main bundle because `OpenWorld.tsx` imports their `*_SOLID` collision lists: move those lists to small data files so the models split off. The street screen is still 1.8 MB of code; Mapbox 1.8 MB (already lazy).
7. **Growth ideas given to the user** (not started): « Défie un ami » share after an épreuve or film, TikTok clips of the épreuves, daily login reward and notifications, leaderboards per épreuve, Play Store listing with films and épreuves.

**User-side, pending:** open « braquages » in /admin; create the Google Play product `waye_deplafonne`; the IUGB's exact position; test football online, the films and the épreuves on real phones.

Older items, still open:


- **E-mails:** above; waiting on what the Brevo card says.
- **Tikitoko video posting bug:** the user reported it; still waiting for their exact error text.
- **Street fluidity:** measure the street (draws, JS per frame), cut the heaviest parts. The real-house fill adds buildings in some quarters (e.g. Abobo +15 %): watch frame times there.
- **Casino:** shared 3D roulette table at the Hôtel Ivoire; sounds and effects, self-limits; a leaderboard was advised against (it pushes gambling).
- **Metro:** waiting for the user's opening date; OSM has only `railway=construction` ways.
- **Hosting (for the user):** Render free plan sleeps; the in-memory hubs (live, kart, court, Tikitoko Live) need a single API instance.
- **Not tested on real phones:** the 3D map landmarks on the real Mapbox basemap, the real houses through the Mapbox tile path, the Plateau's full-Sim crowd, Tikitoko Live audio between two phones.
