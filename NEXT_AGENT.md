# Babi Life: handoff for the next agent

Last updated 2026-11-02. This replaces the earlier handoffs (`HANDOFF.md` now only points here).

Babi Life is a life-sim set in the real Abidjan (and the rest of Côte d'Ivoire): you create a perso, are born into a family drawn by lot, and live in a 3D open world built from the real map, with a phone full of apps (Waye, Gbairai, Tikitoko, Babigram, Golvo…), jobs, défis (mini-games), casino, politics, sport. The repo is `myahse/babi-life`.

| Folder | What | Where it runs |
|---|---|---|
| `web/` | React 19, TypeScript, Vite, Tailwind 4, react-three-fiber, Mapbox GL | Vercel |
| `backend/` | Go (chi, pgx), migrations embedded in `backend/internal/db/migrations/` (last: `104_sim_tally.sql`) | Render (free plan), DB on Neon |
| `native/` | the Android app (Expo, React Native) drawing `web/src` natively | **branch only** |
| `mobile/` | the old Flutter webview | |
| `tools/` | data pipelines: `places/` (OSM places by commune), `buildings/` (real house footprints), `loadtest/` | run by hand |
| `marketing/` | flyers, videos, logos (`marketing/out/` branch only) | |

The `README.md` (French) has one bullet per feature with its files: **read the bullets for whatever you touch** before changing it. `docs/economie.md` is the reference for every Djai amount; `docs/emails-whatsapp.md` for e-mails and WhatsApp.

## Rules from the user (always apply)

- **Branch:** work on `claude/modest-fermat-904lhi`; main and the branch have different histories (main lacks marketing assets and `native/`).
  - Commit, then `git fetch -q origin claude/modest-fermat-904lhi && git rebase -q origin/claude/modest-fermat-904lhi && git push -q origin HEAD:claude/modest-fermat-904lhi`.
  - Then put it on main by cherry-pick in a worktree, building there first:
    ```
    git fetch -q origin main
    git worktree add -q /tmp/claude-0/main-wt origin/main
    cd /tmp/claude-0/main-wt && git cherry-pick -x <sha>
    ln -s /home/user/babi-life/web/node_modules web/node_modules
    (cd web && npx tsc -b && npx vite build) && (cd backend && go build ./...)
    git push -q origin HEAD:main
    cd /home/user/babi-life && git worktree remove --force /tmp/claude-0/main-wt && git worktree prune
    ```
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
- **Style:** single quotes, no semicolons, long lines, comments that say why. **Never run prettier** on existing files. Go: `gofmt` (`internal/i18n/middleware.go` is already unformatted; leave it).
- **Still in waitlist mode:** never set `VITE_GAME_OPEN` in a deploy (only locally to test). The gate is `web/src/lib/launch.ts`.
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
cd backend && go build ./... && go vet ./... && go test ./... && go run ./cmd/i18n -check
```

## Local bench (cloud container; it reboots often, so Vite and the API die: restart them)

- **Postgres:** `pg_ctlcluster 16 main start`.
- **API:** `cd backend && go build -o /tmp/claude-0/api ./cmd/api`, then run `/tmp/claude-0/runapi.sh` in the background. It sets `DATABASE_URL=postgres://postgres:pg@localhost:5432/babi?sslmode=disable`, a dev `JWT_SECRET`, `ADMIN_KEY=adm`, `PORT=8099`, `DEV_LOGIN=true`, `ALLOWED_ORIGINS` for ports 5174/5175, and loads VAPID keys from `/tmp/claude-0/vapid/keys.txt`. If `/tmp/claude-0` is gone, recreate the script with those values.
- **Open a feature locally:** `curl -X POST localhost:8099/api/v1/admin/features/<id> -H 'x-admin-key: adm' -d '{"open":true}'`.
- **Test players:** `POST /auth/dev {name}` returns a token; `POST /me/tester {code:'adm'}`. In the page's `localStorage`: `ivoire-life-session` = `{state:{token,user},version:0}`, `babi-testeur`=`1`, `babi.firstSteps`=`done`, `babi.view`=`pres`, `babi.pushAsked`=`1`; then `/jeu`.
- **Vite:** `cd web && VITE_API_URL=http://localhost:8099/api/v1 VITE_GAME_OPEN=true nohup npx vite --port 5175 > /tmp/claude-0/vite.log 2>&1 &` (`web/.env.local` holds the Mapbox token; not committed).
- **Browser:** Playwright with the preinstalled Chromium, `chromium.launch({ args: ['--use-angle=swiftshader'] })`. It is slow (a few fps): wait 30 s or more for a 3D scene, and pick things by time, not frame counts.
- **Network:** OpenStreetMap, Overpass are blocked; `tiles.openfreemap.org`, Nominatim, `api.mapbox.com` (opened by the user) and Overture's S3 bucket work through the proxy. In Playwright, route OpenFreeMap tile requests through `execFileSync('curl', …)` and `route.fulfill` (see `/tmp/claude-0/quarters.mjs` if it survived). In node, `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
- **Labs** (`web/city.html?view=…`, dev only): `map&lat=&lng=&n=1&cam=x,y,z&look=x,y,z` (real streets from OpenFreeMap; `&plateau&m=600` the Plateau's crowd and traffic at a game minute; `&lm=id@lat,lng;…` landmarks), `landmark&id=…`, `glb&id=…&rot=…` (exports a landmark to GLB: `window.__glb()`), `mapblank&z=&lng=&lat=&pitch=` (the 3D landmarks on a blank Mapbox map; `window.__mapErrs`), `kart`, `plage`, `hotel`, `field`, `family&f=…`, and many more (see the `view === '…'` list in `web/src/lab/city.tsx`). Use `robots.txt` as a blank page for module-only tests (the lab page is heavy).

## Done in the last session (all on the branch and on main)

- **Billard** (`web/src/billard/pool.ts`, `components/defi/Billard.tsx`): 8-ball-pool feel: rolling/sliding physics, spin, cushions, drag-to-aim, fine aim, pull-back cue.
- **Driving** (`world3d/Walker.tsx`, `screens/Play.tsx`): grip and yaw physics, body tilt, wider camera per vehicle, HUD that doesn't overlap.
- **Grand-Bassam beach** (`backend/internal/game/bassam.go`, `world3d/interior/BassamBeach.tsx`, `BeachScene.tsx`): surf, jet ski, ski nautique, dive, swim, beach volley, party, maître-nageur career; real beach hotels and restaurants.
- **Baby crib** (`world3d/build/Crib.tsx`): the baby sleeps in its crib.
- **Airport road** (`world3d/open/places.ts` `ON_BUILDING`, `parcExpo.tsx`, `landmarks.tsx`): Parc des Expositions and Radisson turned on their OSM buildings; the dome rebuilt from the user's photos.
- **Tikitoko Live** (`backend/internal/live/tiki.go`, `web/src/lib/tikiLive.ts`, `screens/TikiLive.tsx`): live with the streamer's voice (WebCodecs Opus over the game's WebSocket, no media server), comments, hearts. The Android app needs a new AAB for the mic permission (`native/app.json`, branch only).
- **Admin, players** (`admin/players.go`, migration `104_sim_tally.sql`): each Sim's age, recent activity and full history.
- **Landmarks in 3D on the city map** (`web/src/components/map/landmarks3d.ts`, `MapboxMap.tsx`, `web/public/landmarks/*.glb`): 18 GLBs exported from the game's own models (lab `view=glb`: one colour per material, no textures or instancing, double-sided, Mapbox's model layer refuses the others). To add one: add it to `LANDMARKS_3D` with its `rot`, export with the lab, test with `view=mapblank`.
- **Real houses in the 3D streets** (`world3d/open/extraBuildings.ts`, `tiles.ts` `mergeExtras`, `web/public/bati/`, `tools/buildings/build.py`): 541 729 footprints from Overture Maps (Google Open Buildings, Microsoft) where OSM/Mapbox have none, by zoom-14 tile (format in the script's header), merged at runtime in both tile paths (Mapbox with a token, OpenFreeMap without), the map's buildings winning. Don't copy Mapbox's own building data into the game (their terms forbid it); Overture is open data.
- **E-mail tracking** (`admin/email.go` `mailCheck`, `GET /admin/email/check`, `MailCheck` in `Admin.tsx`): « Envoyé » only means Brevo accepted the e-mail. The user reported flyer e-mails marked sent but never received; this card asks Brevo what happened (events, sender, domain authentication, credits). **The cause isn't known yet**: the Brevo key is only on Render. If the user sends what the card shows, fix from there (most likely `MAIL_FROM` on a free mailbox domain, or `lifeinbabi.com` without DKIM/DMARC in Brevo).
- **Plateau office crowd** (`world3d/open/plateauLife.tsx`): the nearest 14 (6 on weak phones) within 30 m drawn as full Sims (`CrowdSim`, `lookOf`); the rest instanced, now with shoes, hands, eyes, mouth, shirt and tie.

## Open, or possible next

- **E-mails:** above; waiting on what the Brevo card says.
- **Tikitoko video posting bug:** the user reported it; still waiting for their exact error text.
- **Street fluidity:** measure the street (draws, JS per frame), cut the heaviest parts. The real-house fill adds buildings in some quarters (e.g. Abobo +15 %): watch frame times there.
- **Casino:** shared 3D roulette table at the Hôtel Ivoire; sounds and effects, self-limits; a leaderboard was advised against (it pushes gambling).
- **Metro:** waiting for the user's opening date; OSM has only `railway=construction` ways.
- **Hosting (for the user):** Render free plan sleeps; the in-memory hubs (live, kart, court, Tikitoko Live) need a single API instance.
- **Not tested on real phones:** the 3D map landmarks on the real Mapbox basemap, the real houses through the Mapbox tile path, the Plateau's full-Sim crowd, Tikitoko Live audio between two phones.
