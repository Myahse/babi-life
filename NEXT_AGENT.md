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
- **Four new enterable buildings** (2026-10-25): the Palais de la Culture (`treich-palais-culture`), the Musée des Civilisations (`plateau-musee`, new), the Assemblée nationale (`plateau-assemblee`, new kind `assemblee`) and the Grand Marché de Treichville (`treich-marche`): exteriors in `world3d/open/` (registered in `landmarks.tsx` LANDMARKS/LANDMARK_FRONT and `OpenWorld.tsx` GROUNDS), interiors in `world3d/interior/` (routed by place id in `Play.tsx`), lab views `city.html?view=palaisculture|musee|assemblee|grandmarche&act=…&m=<game minutes>`. Their actions are place-specific (`Places` in `game/catalog.go`) and cost Djai only. `open/flag.tsx` (`WavingFlag`) is the shared rippling Ivorian flag. Children in scenes use `Human`, never `TalkHuman`.
- **Soirées thrown by players** (2026-10-25; `sims/party.go`, `game/soiree.go`, migration `060_soirees.sql`, `world3d/open/soiree.tsx`, `game/soirees.ts`): an adult at home in its own commune throws one (`POST /sims/{id}/soiree {theme}`, 5 000 Djai, 3 h; themes from a fixed list, never free text); `POST /sims/{id}/soiree/fin` ends it. Its place is virtual, `soiree:<uuid>`: `loadParty` reads it onto the Sim (`s.party`) before `interactAt`, in `interact` and in `join` (the host's « recevoir » becomes « danser » for whoever joins); `arrive` counts a guest once (`soiree_guests`), tells the host and adds friendship. `around` returns `parties` for the commune. Web: the soirée is a spot placed on the main thread (not by the chunks' worker: `isSoiree` in `OpenWorld.tsx`), at the host's resolved home or lot, else on the street nearest `homeSpot(host)`; drawn by `PartyFront` (beams, sign, speakers, bulbs, dancers); a banner in the street, `SoireeSheet`/`ThrowSoireeSheet` in `Play.tsx`; inside it's `Interior` kind `club` with `party` (the host's name on the LED wall, the floor full at any hour). Names: the SQL table is `soirees` and the web type `Soiree`, because `parties` and `Party` are the political parties. Checked end to end with two players on the real map (`/tmp/claude-0/geo/soiree-e2e.mjs`, `soiree-host.mjs`).
- **DJ pose and the Ambiance career at the decks** (`avatar/Human.tsx` pose `dj`; `Interior.tsx` spot `decks` with `via`, the steps at the end of the stage; `clubDecor.tsx` `mixing` sends the resident DJ to the bar). NPC DJs in clubs, at the Rue Princesse/Blockhauss nights and at street concerts use it.
- **New places** (2026-10-25): the Marché de Cocody (`cocody-marche`, `meches-cocody`), eight more Babi Burger outlets at OpenStreetMap's Burger King nodes (`babiBurger()` in `world.go`; `BurgerFront` in `dressing.tsx` for any restaurant named « Babi Burger… », the drive at Saint-Jean), the Tour Ivoire (`koumassi-tour-ivoire`, landmark `tourIvoire.tsx`, `vue-tour-ivoire`). The user asked for sex workers in bars and clubs again: declined, per the rule above.
- **Club extras** (2026-10-25): `atalaku`, `podium`, `slow` at clubs and `-soiree` twins at soirées (plus `bouteille-soiree`). The atalaku NPC stands on the stage left of the decks (`Atalaku` in `clubDecor.tsx`; its Html bubble stays mounted and is hidden between calls, since mounting and unmounting it threw React's removeChild error); paid, it shouts the Sim's first name and the floor cheers (`ClubCrowd cheer`). The podium spot is podium 0 (its dancer steps down). A slow (`game.IsSlow`) always ends with someone (`slowWith` in `sims/social.go`): a new adult friend or one seen again, and the partner may hear of it (`caughtFlirt`); in 3D a `SlowPartner` faces the Sim in the hug pose. Romance stays fade-to-black.
- **Actions on things don't hold the Sim** (2026-10-25, the user's ask): `buildPlan` no longer builds at once; it sets `plots.build_from/build_until` (migration `061_chantier.sql`, `game.ChantierMinutes`: 15–60 real minutes by block count) and the Sim stays free. During the site `build` and `moveIn` refuse (`chantierErr`); the open world draws `open/chantier.tsx` (rows rising with the clock, scaffold, masons, sign) instead of the house, and `BuildMode` shows a « Les maçons construisent » sheet; lab: `city.html?view=chantier&k=0.5`. `throwParty` no longer starts « recevoir » on the host. A level/XP/skills system was built then removed at the user's request (« remove the xp thing for now »); it is kept whole in branch commit 103cd39 (« Levels, XP and skills… ») if they want it back.
- **Slot machines** (2026-10-25; `game/slots.go`, `sims/machine.go`, `components/Machine.tsx`, `world3d/slotMachine.tsx`): interactions `machine-maquis` (every maquis, stakes 100/200/500) and `machine-casino` (Hôtel Ivoire only, 500/1 000/2 000), adults only. While that activity runs, `POST /sims/{id}/machine {stake}` spins once (server RNG seeded from `rand.Uint64`), needs `users.adult_at` (the « J'ai 18 ans ou plus » button), counts in `game.Slots` (`Caps` Times only, 200 a day; not in the earned total, like bets). The session lives in `Activity.Machine`; `finish`/`stop` write « · N tours, X gagnés/perdus » and the session's net as the event money. Return ≈ 0.89, hit rate ≈ 0.30 (`TestSlotsReturn`): keep it under 0.92 if retuned. The sheet opens when the activity starts (`machineAt` effect in Play.tsx) and freezes money/session while the reels roll.
- **Babi Bingo** (2026-10-25; `game/bingo.go`, `sims/bingo.go`, migration `062_bingo.sql`, `screens/BingoApp.tsx`, store app `bingo`): four rooms (`bingo75`, `loto90`, `bingo80`, `eclair30`), draws back to back on a fixed schedule (draw n starts at n × Period s, a ball every Every ms, Drawn balls), balls `BingoBalls` keyed by `BetSecret` like the loto. Cards (1–4 a draw, stakes 100–1 000) are always for the next draw; each prize counts only its first `Within` balls; a card is paid its best prize, settled with the bets in `settle` (`dueSQL` has a third flag) or via `POST /sims/{id}/bingo/paye`. `GET /sims/{id}/bingo` gives the rooms (balls out so far only), the Sim's cards of the last 20 min (status computed if the draw is over), the last draws' winners (first names). Needs `users.adult_at`; `game.Bingo` counts cards (Times, 120 a day). Returns 0.85–0.86 (`TestBingoReturn` keeps them in 0.80–0.90): retune `Within`/`Times` with `BingoReturn` if prizes change. The user asked to make people play « au maximum »: the limits (adults, game money, house edge, daily cap) were kept on purpose.
- **Babi Casino** (2026-10-25; `game/casino.go`, `sims/casino.go`, migration `063_casino.sql`, `screens/CasinoApp.tsx`, store app `casino`): roulette (`POST /sims/{id}/casino/roulette {bets}`), le 21 (`GET|POST /sims/{id}/casino/21 {move: distribuer|tirer|rester|doubler, stake}`, the hand with its shoe in `blackjack_hands`, one per Sim, the dealer's hole card only in `View()` once done; no split, no insurance), tickets à gratter (`POST /sims/{id}/casino/grattage {ticket}`, paid at purchase, the app reveals it). Results ride in the new `Outcome.Data`. All need `users.adult_at`, count in `game.Casino` (300 rounds a day, Times only). Returns: roulette 36/37, le 21 ≈ 0.98 (`TestBlackjack`), tickets 0.62–0.66 (`TestScratch` keeps 0.55–0.72). The user asked for games to « force indirectly people to buy coins »; declined the forcing part (rigged odds, buy prompts after losses, lifting the caps): fair rules and the same limits as the other games of money. Offered cosmetic things to sell instead (felts, card backs, machine skins).
- **Airport side** (2026-10-26, user: « we don't have the airport… I don't see the dome, the Radisson Blu, the Air Côte d'Ivoire building »): Port-Bouët's commune centre was on the airfield (arrivals and homes between the runways): now OSM's town centre 5.2569, -3.9586 (services and homes move with it). `pb-babi-burger` resolved onto the building at the terminal's door (doors 9 m apart): removed, now the airport's `babi-burger-aeroport` interaction (`game.AirportID`). `pb-aeroport`, `pb-rabisson`, `portbouet-parc-expo` added to `SKYLINE` (drawn from the other communes; `FAR_FACING` from the lab's `window.marks`, `city.html?view=map&lm=…`). `pb-air-lagune` (Air Côte d'Ivoire's head office, OSM node 11217949138) added as an office with `comptoir-air-lagune`. Pullman/Noom checked again on OSM: the Noom node sits in a 21-level building ~200 m from the Pullman (booking sites: 0.24 km) — left as is; two big unnamed new buildings stand ~70 m SW of the Pullman (ways 1231068963/64) if the user means another « new hotel ». Dev servers: `ALLOWED_ORIGINS` must include the vite port (5174) in runapi.sh.
- **Tour Ivoire remodelled from the user's photos** (`tourIvoire.tsx`): one slab whose length goes back from the street, its street end a half-round of blue mirror glass with four ringed floors of curved balconies (from the user's aerial photo; an earlier version had a separate round tower beside, then in front of, the slab: both wrong); the long left side light grey with the dark panel, the right one anthracite with the gold IVOIRE emblem (light grey end, dark middle panel), louvred podium with shops, the red-framed store next door (invented names: BABI MODE, PHARMA+, BABI FER). Its clearing is 46 m now, for the store.
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
