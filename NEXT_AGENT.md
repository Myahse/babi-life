# Babi Life: handoff for the next agent

Babi Life is a life-sim set in Abidjan. The repo is `myahse/babi-life` (GitHub now redirects it to `Myahse/babi-life`).

- `web/`: React 19, Vite, Tailwind v4, react-three-fiber.
- `backend/`: Go (chi, pgx). Migrations are embedded in `backend/internal/db/migrations/`, up to `039_couples.sql`.
- `mobile/`: a Flutter webview.
- `native/`: the Android app in React Native (Expo), drawing the game's own code (`web/src`) natively; it replaces `mobile/` once tried on phones. Branch only, never on main: `native/`, the `*.native.ts(x)` and `*.web.ts` twins in `web/src`, `web/src/lib/canvas.ts` (see `native/README.md`).

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

- **The Djai economy** (`docs/economie.md` is the reference; read it before touching any amount): per-account daily limits by source in `backend/internal/game/money.go` (`Caps`, `DailyTotal` 20 000, `NewAccountHold` 7 days), tallies in the `earnings` table (migration `059_earnings.sql`), read with the Sim in `mutateWith` and saved in the same batch (`sims/money.go`: `s.earn(src, amount)`; `takeFor`/`leftFor`/`payWinner` for credits to another player's Sim; `heldBack` for new or tested accounts). One paid shift a day per account; salaries, gigs, money surprises, family gifts, Tikitoko deals and politics pay scaled down; the landlord passes once after an absence spanning a Saturday (`hold` returns events now); odds floor at 1,00 and the combo boost only counts legs at 1,30+. The Sim JSON carries `today` (the day's tallies and limits), shown in the Boulot app. Tests: `game/money_test.go`, `sims/economy_test.go` (prints the casual week and the grinder's day). The packs' prices were not touched.
- **Real places where the map has them** (2026-10-25): 55 places and 17 town halls (`townHalls` in `world/world.go`) moved to their OpenStreetMap positions (Nominatim, OpenFreeMap tiles) and no longer `Approx`. The open world only snaps `approx` places to the map's points now (`OpenWorld.tsx`), `matchPoi` refuses a point of another kind or one missing the place's kind word (mairie, marché, CHU…), and the snap cache (`babi.snaps.v2.`) is keyed by the approximate places' data, so a stale find is dropped. To check a spot on the real map: `city.html?view=map&lat=…&lng=…&n=1&lm=<placeId>@lat,lng;…&cam=x,y,z` with an empty `VITE_MAPBOX_TOKEN` (OpenFreeMap tiles; in the container, fetch them in Playwright with `ctx.route` and curl, since the browser can't use the proxy). The environment allows `tiles.openfreemap.org` and `nominatim.openstreetmap.org` (Overpass still resets). No game place stands in water any more (checked with OpenFreeMap's water layer); a generated shop whose usual offset from its commune's centre falls in the lagoon is moved by `ashore` in `world.go`. Still approximate on purpose (19): the beaches, the Rue Princesse, Blockhauss, the Baie de Cocody, Île Boulay's landing, the zone industrielle, Anoumabo, the gare d'Adjamé, the mairie d'Anyama, the inland airports, Daloa's market.
- **Release video** (`?video=sortie`, `marketing/scripts/sortie-28-octobre.md`): Awa announces Wednesday 28 October and what's new (politics, matches with friends, Flashé, offline). Silent until the user sends `marketing/out/voix-sortie.mp3`; then retime `FILMS.sortie` on the voice and re-render (`FILM=sortie node /home/user/babi-life/marketing/video.mjs`). The mp4 and cover are on the branch only.


- **Court matches on phones** (`streetball/`): the « you » ring only on your own player; the upright football camera and stick turn round for team 1; the camera keeps your player above the controls (`Follow`, `lift`); a phone only runs the match once its socket is open (`MatchNet.host`). Tested with 2–3 phones (`/tmp/claude-0/tiles/court-probe.mjs`).
- **Emotes** (`avatar/emotes.ts`): wrappers add a knee dip, overshoot and settle, breathing and sway; the kiss and moonwalk no longer jump.
- **Talk to anyone** (`world3d/talk.ts`, `Talkable.tsx`, `TalkHuman`): adults inside maquis, clubs, hotels, the mall, the street's pasteur/fou/office workers and the night street open the chat. **Children are never talkable** (a chat friend is `Adult: true`, so romance could follow). Chatting while busy is an aside (`Activity.ChatWith`). Friends keep their look (`Friend.Look`, `Passerby.Look`); `MaxFriends` is 30.
- **Friends post**: Tikitoko (`sims/tikifriends.go`, generated, nothing stored; ids below `-friendPostBase`); Babigram (`sims/gramfriends.go`, `gram_people`, migration 038; met people have public accounts `npc:p-…`).
- **Outings** (`sims/outing.go`, `POST /sims/{id}/outing`, `screens/OutingPlanner.tsx`): up to 4 friends; NPC friends answer at once and come along (`Activity.With`, drawn by `Companions` in `Walker.tsx` and `Along` in `Interior.tsx`); player friends get an invite; the Sim pays for everyone. **Cinema** kind with four invented cinemas.
- **Romance** (`sims/cheating.go`, `couple.go`, migration 039): dates, two partners at once and getting caught, couples between players (asked and accepted, adults only, one at a time).

## Open or possible next steps

- **Economy:** several accounts can still each pass 20 000 Djai a day after 7 days (only a phone-number check would stop it); two Sims of one account played at the same instant can pass a limit by one action. Tune with real sales: `docs/economie.md`, « Ce qui reste ouvert ».

- **Social:** a player couple isn't drawn together in 3D yet; jealousy only exists with partners met in the game (not between players); Gbairai messages from friends met in the game; outing companions at outdoor places only stand beside the Sim.
- **Court matches:** players who close the app keep their place (ghost entries); on small phones the ball can leave the top of the screen.

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
