# Babi Life: handoff for the next agent

Babi Life is a life-sim set in Abidjan. The repo is `myahse/babi-life` (GitHub now redirects it to `Myahse/babi-life`).

- `web/`: React 19, Vite, Tailwind v4, react-three-fiber.
- `backend/`: Go (chi, pgx). Migrations are embedded in `backend/internal/db/migrations/`, up to `037_babigram.sql`.
- `mobile/`: a Flutter webview.

Auth is Firebase (project `babilife-38e39`). The web app is on Vercel. The API runs on Render (`render.yaml`, **free plan**) and the database on Neon.

## Rules from the user (always apply)

- **Branch and pushes:** work on `claude/modest-fermat-904lhi`. Main and the branch have different histories (main has no marketing assets).
  - Push the branch with `git push origin HEAD:claude/modest-fermat-904lhi`.
  - Put code on main by cherry-picking in a worktree:
    ```
    git fetch origin main
    git worktree add /tmp/claude-0/main-wt origin/main
    cd /tmp/claude-0/main-wt && git cherry-pick <sha> && git push origin HEAD:main
    git worktree remove /tmp/claude-0/main-wt
    ```
  - Push in batches (Vercel rate limits).
  - Helper agents in worktrees start from main. Cherry-pick their commit onto the branch; a `git merge` refuses because the histories differ.
- **Marketing voices and videos are never pushed to main.** That means `marketing/out/*` and the voice mp3s. They go on the branch only.
- **Still in waitlist mode.** Never set `VITE_GAME_OPEN=true`. The gate is in `web/src/lib/launch.ts`.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <your session URL>
  ```
  No model IDs anywhere in commits, code or files. No PRs unless asked.
- **README** is in French: one bullet per feature, as « - **Titre** (`chemin`) : … ». Add one for each change.
- **Never commit** secrets (R2 keys, the VAPID private key, the FCM service account), the tester code, or the user's email.
- **Brands:** invented names only: Waye, Gbairai, Tikitoko, Babigram, Golvo, Hôtel Poulman, Noum, Azalé, Rabisson. Never name the real brands in the game.
- **Never fall back to the classic view.**
- **No prettier.** Match the surrounding style: single quotes, no semicolons, long lines, comments that say why.
- **Romance** is fade-to-black only. Explicit content and sex workers were declined; keep declining.
- **Language:** code comments in English, in-game text in French.
- **Kids' street football** (`open/streetFoot.tsx`, happenings `foot`/`basket`) must stay as it is. The user wants to be able to play with the kids.

## Checks before pushing

```
cd web && npx tsc -b && npm run build
cd backend && gofmt -l . && go vet ./... && go test ./...
```

Never use `pkill` in compound commands; use `fuser -k <port>/tcp`.

## Local test setup (in the cloud container; recreate if gone)

- **Postgres:** `pg_ctlcluster 16 main start`.
- **API:** build with `cd backend && go build -o /tmp/claude-0/api ./cmd/api`. Run `/tmp/claude-0/runapi.sh` in the background with a 2 h timeout. It loads the VAPID keys and sets `DATABASE_URL=postgres://postgres:pg@localhost:5432/babi?sslmode=disable`, `JWT_SECRET=dev-secret-dev-secret-dev-secret-0123`, `ADMIN_KEY=adm`, `PORT=8099` and `DEV_LOGIN=true`. To restart it, run `fuser -k 8099/tcp`, then start it again.
- **Dev server:** `cd web && VITE_API_URL=http://localhost:8099/api/v1 VITE_MAPBOX_TOKEN=pk.fake npx vite --port 5174`, in the background.
- **Browser driver:** `cd /tmp/claude-0/tiles && node driver.mjs`, in the background. Then send it JavaScript with `/tmp/claude-0/d "<js>"`. It provides `page`, `ctx`, `shot(name)` and `logs`, and screenshots go to `/tmp/claude-0/shots/`.
- **Background limit:** background processes are killed after 2 h. Restart them when that happens.
- **Fake map tiles:** `faketown.mjs` (`route(ctx)`). Call it on every new browser context, or the map never loads.
- **Logging a page in as a test player:** create the player with `POST /auth/dev {name}`, then `POST /me/tester {code:'adm'}`. In the page's `localStorage`, set:
  - `ivoire-life-session` to `{state:{token,user},version:0}`;
  - `babi-testeur` to `1`;
  - `babi.firstSteps` to `done`;
  - `babi.view` to `pres`;
  - `babi.pushAsked` to `1`.

  Then open `/jeu`. Ready-made scripts are in `/tmp/claude-0/tiles/`:
  - `court2.mjs` (two players at a court);
  - `tiki.mjs` (one player with every app);
  - `court-wait.js` and `tiki-open.js` (driver code);
  - `sweep.mjs` (every action at every place; must show no `500`).
- **Labs:**
  - `city.html?view=landmark&id=plateau-poulman|plateau-noum|marcory-azale|pb-rabisson&cam=x,y,z&look=x,y,z(&night)`;
  - `city.html?view=hotel&id=…`;
  - `city.html?view=hoops|foot5`;
  - `social.html?app=babigram`.

## Done in the last session (all pushed to the branch and to main)

- **Hotel exteriors from the user's photos:** Poulman (`open/poulman.tsx`), Noum (`noum.tsx`), Azalé (`azale.tsx`) and Rabisson (`rabisson.tsx`), registered in `landmarks.tsx` and `GROUNDS` in `OpenWorld.tsx`. Around them, `hotelBits.tsx` adds doormen, guards with their booths, guests walking to and fro, luggage trolleys, lamps, bollards, rooftop machines, and loungers by the pools. The hotel interiors are in `interior/HotelInside.tsx`, with a different layout per hotel.
- **Server ready for launch** (the user expects 77 players):
  - `live.go` sends only the states heard since the last tick;
  - `MaxRoom` is 150;
  - `db.go` allows 16 DB connections unless `pool_max_conns` is in the URL;
  - `/world` is cached for 10 minutes.
- **Fixed courts, playing together:**
  - Football and basketball are played only at `game.Courts` (`backend/internal/game/courts.go`). That sets the `Places` of `play-football`/`play-basket`. The courts are in `world.go`, and OSM sport places are scenery (`places.ts`).
  - `backend/internal/court` is the lobby: one match per court, `Cap` 10 for football and 6 for basketball, a 20 s wait, drop-in during play, and newcomers in the last minute go to the next match.
  - Starting to play takes a place, or fails with « terrain complet » (`sims/court.go`, `courtTake`).
  - Routes: `/sims/{id}/court/join`, `/court/{match}`, `/sims/{id}/court/{match}/leave`, `/court/at/{place}`. The place card shows « N/cap joueurs » (`CourtCount` in `Play.tsx`).
  - The match runs over live mode `match` (`web/src/streetball/online.ts`). The first player still connected runs `game.ts` for everyone and sends it as rows of numbers; the others send their stick and counted button presses. `step()` takes `others`, and stats are the local player's only.
  - Tested with two browsers.
- **Tikitoko rework** (`TikitokoApp.tsx`, `TikiScene.tsx`, `world3d/clip.ts`, `lib/tikiSounds.ts`, `sims/tikivideo.go`, `tikinpc.go`, migration 036):
  - real 5–15 s clips through MediaRecorder, with sounds made in WebAudio;
  - 16 in-game creators shown as live 3D scenes, so the feed is never empty;
  - TikTok-style playback;
  - instant posting, 20 a day; brands pay for the first 10.
  - Tested: record, publish, playback.
- **Babigram**, the photo app (`BabigramApp.tsx`, `BabigramArt.tsx`, `sims/babigram.go`, migration 037):
  - feed with stories, Explorer, profile, Activité, comments and reports;
  - nine filters baked into the JPEG;
  - 10 in-game accounts.
  - Tested in the browser.
- Earlier in the same session: the game-wide test and its fixes, street sellers kept off roads, the Gbairai « écrit… » indicator, private cars in traffic, UI animations (`motion.css`), and actions grouped by room at home (toilets, teeth).

## Open or possible next steps

- **Hosting, for the user to do** (they've been told): move Render off the free plan, and use a paid Neon compute size (or wake the DB just before launch). The in-memory hub, kart lobby and court lobby need a **single** API instance.
- **Court matches:**
  - Non-host phones only smooth the host's snapshots, with no local prediction, so their own player feels about 100–200 ms late.
  - The result screen hides nothing, but non-host stats stay 0.
  - A ghost entry (a player who closed the app without leaving) keeps its place until the match ends.
  - Names over the other humans' heads would help.
- **Tikitoko:** Firefox and older Chrome record WebM, which iOS can't play. Filming in the classic street scene shows « Rien à filmer ici ». If the DB write fails after the bucket upload, the clip file is left in the bucket.
- **Babigram:** photos are stored in the DB, not in the bucket. In-game posts can only be hidden for the session, not reported.
- **Not tested yet:** night-time places, kart, live stadium, Gnango and iDrive rides, push notifications, Google sign-in on the real map, and whether the Blockhauss maquis can be entered (coordinates 5.3212, -4.0029 in `world.go`).
- A duplicate `createRoot` warning shows in dev after switching lab pages. It is harmless so far.
