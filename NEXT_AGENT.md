# Babi Life — handoff for the next agent

Babi Life is a life-sim set in Abidjan. The repo is `myahse/babi-life`:

- `web/`: React 19, Vite, Tailwind v4, react-three-fiber.
- `backend/`: Go (chi, pgx), migrations embedded in `backend/internal/db/migrations/`.
- `mobile/`: a Flutter webview.

Auth is Firebase (project `babilife-38e39`).

## Rules from the user (always apply)

- **Branch and pushes:** work on `claude/modest-fermat-904lhi`. Main and the branch have diverged: main has commit `a1bddf7`, which removes the marketing assets, and the branch doesn't. So:
  - push the branch with `git push origin HEAD:claude/modest-fermat-904lhi`;
  - put code on main by cherry-picking in a worktree:
    ```
    git worktree add /tmp/claude-0/main-wt origin/main
    cd /tmp/claude-0/main-wt && git cherry-pick <sha> && git push origin HEAD:main
    git worktree remove /tmp/claude-0/main-wt
    ```
  - Push in batches (Vercel rate limits).
- **Marketing voices and videos are never pushed to main.** That means `marketing/out/*` and the voice mp3s. They go on the branch only.
- **Still in waitlist mode.** Never set `VITE_GAME_OPEN=true`. The gate is in `web/src/lib/launch.ts`.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Aj6sZN74DR7rpghFbB6ppR
  ```
  No model IDs anywhere in commits, code or files. No PRs unless asked.
- **README** is in French: one paragraph per feature, as « **Titre** (`chemin`) : … ». Add one for each change.
- **Never commit** secrets (R2 keys, the VAPID private key, the FCM service account), the tester code, or the user's email.
- **Brands:** invented brand names only (Waye, Gbairai, Tikitoko, Pingus, Golvo…).
- **Never fall back to the classic view.** The user was very firm about this.
- **No prettier:** the repo has no prettier config, so never run prettier on existing files. Match the surrounding style: single quotes, long lines, comments that say why.
- **Romance:** adult romance is fade-to-black only. Explicit content and sex workers were declined; keep declining.
- **Comments and copy:** code comments are in English; in-game text is in French.

## Checks before pushing

```
cd web && npx tsc -b && npm run build
cd backend && go vet ./... && go test ./...
```

Never use `pkill` in compound commands; use `fuser -k <port>/tcp` or `kill <pid>`.

## Local test setup (in the cloud container; recreate if gone)

- **Postgres:** `pg_ctlcluster 16 main start`. It stops between turns; restart it if the login screen shows « Serveur injoignable ».
- **API:**
  - build: `cd backend && go build -o /tmp/claude-0/api ./cmd/api`;
  - run with `DATABASE_URL=postgres://postgres:pg@localhost:5432/babi?sslmode=disable`, `JWT_SECRET=dev-secret-dev-secret-dev-secret-0123`, `ADMIN_KEY=adm` and `PORT=8099`, after loading the VAPID keys with `set -a; . /tmp/claude-0/vapid/keys.txt`.
- **Production preview:**
  ```
  VITE_API_URL=http://localhost:8099/api/v1 VITE_MAPBOX_TOKEN=pk.fake npx vite build --outDir /tmp/claude-0/dist-cache
  npx vite preview --outDir /tmp/claude-0/dist-cache --port 5173
  ```
- **Dev server** (for `lab.html` and `city.html`, and the DEV-only forcing hooks): `npx vite --port 5174` with the same environment variables.
- **Test account:** token in `/tmp/claude-0/tokA`, Sim id in `/tmp/claude-0/sidA` (Awa, in Cocody).
- **Fake map tiles:** `/tmp/claude-0/faketown.cjs`. The scripts route `api.mapbox.com` to it.
- **Browser scripts:** `/tmp/claude-0/fz.mjs` (load the game and take a screenshot) and `/tmp/claude-0/watch.mjs` (walk to a pitch and watch a match). They import `/home/user/babi-life/marketing/shared.mjs`. Dismiss the notification card with `getByText('Plus tard', { exact: true }).click({ force: true })` or it blocks clicks.
- **Labs:**
  - `city.html?view=field&sport=basket` (fields)
  - `?view=inside&id=villa-grande&act=sleep&partner&night`
  - `?view=plan&id=…`
  - `?view=landmark&id=cocody-zoo&solid`
  - `?view=stalls`
  - `lab.html?pose=talk|idle|walk` (avatar poses; in dev, `globalThis.fidget.talk = 'shrug'`, `.kind = 'chin'`)
  - `poster.html?video=<film>&t=`
- **Unit-checking placement logic:** there's no test runner in `web/`. Bundle a small script with `npx esbuild x.ts --bundle --platform=node --format=esm` and run it with node. Scratchpad examples: `lagoon.ts`, `cross.ts`, `fields.ts`.
- **Videos:** `cd marketing && FILM=<film> node /home/user/babi-life/marketing/video.mjs`. Use the absolute path, run it in the background (20–30 min); the voice is `out/voix-<film>.mp3`. The films are `FILMS` in `web/src/lab/poster.tsx` and include `arnaque` and `keke`.

## Done in the last sessions (all pushed)

- **Zoo:** free roaming during « Visiter le zoo », with the orange « Que faire ? » button in the ActivityBar (`Play.tsx`, `GROUNDS`). A perimeter wall goes all round, matching boxes in `ZOO_SOLID`, and the cleared ground is 86 m (`landmarks.tsx`).
- **Nothing on roads or under buildings** (`places.ts`):
  - game-made lots try candidates along the street and across it (`squareClear`), and keep away from fields and from each other;
  - `inTheWay` also removes buildings by ring;
  - street pitches and courts in `streetlife.tsx` check their full footprint against roads, buildings, water and `taken` ground.
- **Waterside landmarks** (Blockhauss maquis) go on the dry side of their street (`inWater`). This is not verified on real tiles, so ask the user if they can enter the maquis now.
- **Face to face:** the NPC being talked to walks up to about 1.1 m, and the Sim turns to face them (`whereabouts.faceTo`, `Passerby` in `OpenWorld.tsx`, `Walker.tsx`).
- **Animations** (`avatar/Human.tsx`):
  - `mannerOf(seed)` gives each person their own gait and stance;
  - `talkAt` gives speaking and listening turns (explain, point, count, shrug, chop, laugh / listen, nod);
  - six more fidgets;
  - phone or a glance aside while walking.
- **Match grounds:**
  - placement: sports places are resolved first, each map pitch belongs to one place only, map pitches are checked against roads, laid-out pitches keep apart, trees and palms are cleared from fields, game lots and landmarks (`worker.ts`), and billboards stay off fields;
  - `field.tsx`: benches with a seated crowd that stands for goals, and a chalk scoreboard behind one goal (`Match.score()` in `match.ts`);
  - watching: the Sim sits at `simSeat` on the street-side bench and cheers goals (`Walker.tsx`).
- **Earlier work:**
  - inside-house screen (`HomeInside.tsx`);
  - romance flags (`adult`/`partner`/`home`, migration 035, `POST /me/adult`, « Passer la nuit ensemble »);
  - stairs piece `escalier`;
  - the CORS `Idempotency-Key` fix for « Pas de réseau »;
  - « Mon terrain » location;
  - « Traîner ensemble » buddy;
  - browser chunk cache (`chunkCache.ts`, IndexedDB);
  - StaticMerge, NearPlane, field fences (`fieldFence.tsx`, `setZone`/`inZone`);
  - arnaque and keke videos.

## Open or possible next steps

- **Confirm with the user** that the Blockhauss maquis can be entered on the real map. If not, check its coordinates in `backend/internal/world/world.go` (5.3212, -4.0029) against the shoreline.
- **Rendering engine** (from the user's list): more StaticMerge coverage, shadows cost, streaming order to reduce pop-in.
- **Zoo free roam:** check it in the browser with a running visit (it was only typechecked).
- **Far-away people** (`LowHuman.tsx`) don't use the new gestures. They could get the per-person gait if it's cheap.
- **Playing:** when the Sim plays a match, it jumps straight from the gate to its slot (`Walker.tsx`, `inMatch`). It could walk on from the gate instead.
- **A second sports place** that loses its map pitch becomes a building if `layOut` finds no room. That could be improved by searching further along its street.
