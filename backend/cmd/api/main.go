package main

import (
	"cmp"
	"context"
	"errors"
	"github.com/myahse/babi-life/backend/internal/npcchat"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/myahse/babi-life/backend/internal/admin"

	"github.com/myahse/babi-life/backend/internal/adminkey"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/myahse/babi-life/backend/internal/ads"
	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/config"
	"github.com/myahse/babi-life/backend/internal/court"
	"github.com/myahse/babi-life/backend/internal/db"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/i18n"
	"github.com/myahse/babi-life/backend/internal/ideas"
	"github.com/myahse/babi-life/backend/internal/kart"
	"github.com/myahse/babi-life/backend/internal/live"
	"github.com/myahse/babi-life/backend/internal/mail"
	"github.com/myahse/babi-life/backend/internal/news"
	"github.com/myahse/babi-life/backend/internal/odds"
	"github.com/myahse/babi-life/backend/internal/politics"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/shop"
	"github.com/myahse/babi-life/backend/internal/sims"
	"github.com/myahse/babi-life/backend/internal/waitlist"
	"github.com/myahse/babi-life/backend/internal/world"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}

	// One session per sign-in (a device): listed in the profile, signed out from there.
	sessions := auth.NewSessions(pool)
	tokens := auth.NewTokens(cfg.JWTSecret).WithSessions(sessions)
	authH := &auth.Handler{DB: pool, Tokens: tokens, DevLogin: cfg.DevLogin, Sessions: sessions, SiteURL: config.Site[0]}
	if site := os.Getenv("SITE_URL"); site != "" {
		authH.SiteURL = site
	}
	// « Mot de passe oublié »: e-mails through Brevo's API or SMTP (package mail), when it's set up.
	if m := mail.FromEnv(); m != nil {
		authH.Mail = m
	} else if cfg.DevLogin {
		authH.Mail = mail.Log{}
	} else {
		log.Printf("⚠️  e-mail not set (MAIL_FROM with BREVO_API_KEY or SMTP_HOST): « mot de passe oublié » is off")
	}
	if cfg.GoogleClientID != "" {
		authH.Verifier = auth.NewGoogleVerifier(cfg.GoogleClientID)
	}
	if cfg.FirebaseProjectID != "" {
		authH.Firebase = auth.NewFirebaseVerifier(cfg.FirebaseProjectID)
	}
	// The virtual football's results are keyed by a secret nobody else has.
	if v := os.Getenv("BET_SECRET"); v != "" {
		game.BetSecret = v
	} else {
		game.BetSecret = cfg.JWTSecret
	}
	// ADMIN_KEY opens every admin part at once (the /admin page).
	adminkey.Master = os.Getenv("ADMIN_KEY")
	// TESTER_TOOLS=off once the game is out: the testers' code and toolbox shut.
	adminkey.TestersOff = os.Getenv("TESTER_TOOLS") == "off"
	if adminkey.TestersOff {
		log.Println("Testers' toolbox off (TESTER_TOOLS=off)")
	}
	karts := kart.NewLobby()
	courts := court.NewLobby()
	// Notifications to the phones (internal/push): the site's Web Push keys, the app's Firebase account.
	fcm, err := push.NewFCM(os.Getenv("FCM_SERVICE_ACCOUNT"))
	if err != nil {
		log.Printf("push: %v (the Android app gets no notifications)", err)
	}
	pushes := &push.Service{DB: pool, VAPIDPublic: os.Getenv("VAPID_PUBLIC_KEY"), VAPIDPrivate: os.Getenv("VAPID_PRIVATE_KEY"), Subject: os.Getenv("VAPID_SUBJECT"), FCM: fcm}
	if pushes.Subject == "" {
		pushes.Subject = "https://www.lifeinbabi.com"
	}
	// The phone's photos: in the same bucket as Babi Pub's files (under photos/).
	bucket := &ads.Bucket{
		Endpoint: os.Getenv("ADS_S3_ENDPOINT"), Region: os.Getenv("ADS_S3_REGION"), Name: os.Getenv("ADS_S3_BUCKET"),
		AccessKey: os.Getenv("ADS_S3_ACCESS_KEY"), SecretKey: os.Getenv("ADS_S3_SECRET_KEY"), PublicURL: os.Getenv("ADS_PUBLIC_URL"),
	}
	// The updates the team opens one by one from the admin (features: closed until then).
	features.Default = &features.Store{DB: pool}
	features.GameOpenEnv = cfg.GameOpen
	// The casino's « taux de retour » as the team sets them (odds: each game untouched until then).
	odds.Default = &odds.Store{DB: pool}
	simsH := &sims.Handler{DB: pool, RealPhotos: os.Getenv("STORIES_REAL_PHOTOS") == "true", Karts: karts, Courts: courts, Push: pushes, Bucket: bucket, Talk: npcchat.FromEnv()}
	go simsH.WatchBets(ctx)
	go simsH.PruneJournal(ctx)
	headlines := news.New(cfg.NewsFeeds)
	go headlines.Run(ctx)
	// The players of a commune, live (positions and poses, over a WebSocket).
	players := live.NewHub(pool, tokens, cfg.AllowedOrigins)
	sessions.OnRevoke = players.Kick
	simsH.Online = players.Online
	simsH.Connected = players.Connected
	simsH.Ring = players.Message
	simsH.Notify = players.Notify
	simsH.Duels = &sims.Duels{}
	players.Duels = simsH.Duels
	simsH.Pvp = &sims.Pvp{}
	players.Pvp = simsH.Pvp
	simsH.RefundPvp(ctx)
	players.Karts = karts
	players.Courts = courts
	go players.Run(ctx)
	// La boutique: Djai bought through GeniusPay (its keys only in the environment).
	shopH := &shop.Handler{DB: pool, Pay: shop.FromEnv(), Site: authH.SiteURL, API: strings.TrimRight(cmp.Or(os.Getenv("API_URL"), os.Getenv("RENDER_EXTERNAL_URL")), "/"), Changed: func(id string) { players.Changed(id) }}
	if shopH.Pay == nil {
		log.Printf("⚠️  GeniusPay not set (GENIUSPAY_API_KEY, GENIUSPAY_API_SECRET): the shop is shut")
	} else if shopH.Pay.WebhookSecret == "" {
		log.Printf("⚠️  GENIUSPAY_WEBHOOK_SECRET not set: webhooks aren't checked by signature (payments are still confirmed with GeniusPay)")
	}
	go shopH.Watch(ctx, 10*time.Minute)

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: cfg.AllowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type", "X-Admin-Key", "Idempotency-Key", "X-Lang"},
		MaxAge:         600,
	}))
	// The player's language (X-Lang): the server's words in English for who plays in English (internal/i18n).
	r.Use(i18n.Middleware)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		// Which version runs (Render sets RENDER_GIT_COMMIT), and which sites may call it.
		commit := os.Getenv("RENDER_GIT_COMMIT")
		if len(commit) > 7 {
			commit = commit[:7]
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"status": "ok", "version": commit, "sites": cfg.AllowedOrigins})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/push/key", pushes.Key)
		// What the phone hides (the updates not opened yet) and what just came.
		r.Get("/features", features.Default.Public)
		// Each money game's « taux de retour » now, for its « Règles ».
		r.Get("/casino/taux", odds.Default.Public)
		r.With(middleware.Compress(5, "application/json")).Get("/world", func(w http.ResponseWriter, r *http.Request) {
			// The same for everyone until the next deploy: let browsers keep it a while.
			w.Header().Set("Cache-Control", "public, max-age=600")
			httpx.JSON(w, http.StatusOK, map[string]any{
				"cities":        world.Cities,
				"kinds":         game.Kinds,
				"traits":        game.Traits,
				"aspirations":   game.Aspirations,
				"origins":       game.Origins,
				"housings":      game.Housings,
				"careers":       game.Careers,
				"expressions":   game.Expressions,
				"rideApps":      world.RideApps,
				"compteur":      world.Compteur,
				"roads":         world.Roads,
				"phoneApps":     world.PhoneApps,
				"contacts":      world.Contacts,
				"menus":         world.Menus,
				"families":      game.Families,
				"stages":        game.Stages,
				"yearMinutes":   game.YearMinutes,
				"growUp":        game.GrowUp,
				"friendActions": game.FriendActions,
				"flights":       world.FlightRoutes(),
				"holidays":      game.Holidays,
				"materials":     game.Materials,
				"plot":          map[string]int{"w": game.PlotW, "d": game.PlotD, "h": game.PlotH},
				"furniture":     game.Furnitures,
				"soiree":        map[string]any{"furniture": game.PartyCatalog(), "w": game.PartyW, "d": game.PartyD, "max": game.PartyMaxPieces, "kept": game.PartyKept, "entry": map[string]int{"min": game.EntryMin, "max": game.EntryMax, "step": game.EntryStep}, "start": game.PartyStart},
				"groceries":     game.Groceries,
				"mentors":       game.Mentors,
				"emotes":        game.Emotes,
				"clothes":       game.Clothes,
				"clothingPacks": game.ClothingPacks,
				"metro":         world.Metro,
				"slots":         map[string]any{"symbols": game.SlotSymbols, "stakes": game.SlotStakes, "perDay": game.SlotsPerDay},
				"bingo":         map[string]any{"games": game.BingoGames, "stakes": game.BingoStakes, "perDraw": game.BingoCardsPerDraw, "perDay": game.BingoPerDay},
				"casino":        map[string]any{"chips": game.RouletteChips, "maxTotal": game.RouletteMaxTotal, "maxBets": game.RouletteMaxBets, "stakes": game.BlackjackStakes, "tickets": game.ScratchTickets, "perDay": game.CasinoPerDay, "envol": map[string]any{"stakes": game.EnvolStakes, "period": game.EnvolPeriod, "wait": game.EnvolWait, "maxFlight": game.EnvolMaxFlight, "max": game.EnvolMax}, "trade": map[string]any{"assets": game.TradeAssets, "stakes": game.TradeStakes, "secs": game.TradeSecs, "pays": game.TradePays, "open": game.TradeOpen}},
				"measures":      game.Measures,
				"vehicles":      game.VehicleModels,
				"parkings":      game.ParkingKinds,
				"street":        sims.StreetActivities(),
				"lotSizes":      game.LotSizes,
				"homePlans":     game.HomePlans,
				"lotPlans":      game.LotPlans,
				"homeFor":       map[string]any{"housing": game.HousingPlan, "family": game.FamilyPlan},
				"config":        map[string]any{"realPhotos": simsH.RealPhotos, "devLogin": cfg.DevLogin, "googleLogin": authH.Verifier != nil || authH.Firebase != nil},
			})
		})
		// A commune's places from the map (world/osm.go): those near a point
		// (?lat=&lng=&r=km, nearest first), those matching ?q= (search), or one (?id=).
		r.With(middleware.Compress(5, "application/json")).Get("/places", func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			commune := q.Get("commune")
			num := func(k string, def float64) float64 {
				if v, err := strconv.ParseFloat(q.Get(k), 64); err == nil {
					return v
				}
				return def
			}
			var places []world.MapPlace
			if id := q.Get("id"); id != "" {
				if p, ok := world.MapPlaceByID(id); ok {
					places = []world.MapPlace{p}
				}
			} else if s := strings.TrimSpace(q.Get("q")); s != "" {
				places = world.SearchMapPlaces(commune, s, 40)
			} else if q.Get("all") != "" {
				places = world.MapPlacesOf(commune, 1000)
			} else {
				places = world.MapPlacesNear(commune, num("lat", 0), num("lng", 0), math.Min(num("r", 1.2), 3), 1500)
			}
			if places == nil {
				places = []world.MapPlace{}
			}
			httpx.JSON(w, http.StatusOK, map[string]any{"places": places, "total": world.MapPlaceCount(commune), "source": world.OSMSource})
		})
		// The "Look to fix" list of the world data (see world.Audit).
		r.Get("/world/issues", func(w http.ResponseWriter, r *http.Request) {
			issues := world.Audit()
			httpx.JSON(w, http.StatusOK, map[string]any{"summary": world.Summary(issues), "issues": issues})
		})
		// What is going on in a commune at a game minute (null when it's quiet).
		r.Get("/happening", func(w http.ResponseWriter, r *http.Request) {
			t, err := strconv.ParseInt(r.URL.Query().Get("t"), 10, 64)
			if err != nil {
				httpx.Error(w, http.StatusBadRequest, "t is required")
				return
			}
			h, start, ok := game.HappeningAt(r.URL.Query().Get("city"), r.URL.Query().Get("commune"), t)
			if !ok {
				httpx.JSON(w, http.StatusOK, map[string]any{"happening": nil, "start": start, "end": start + game.HappeningMinutes})
				return
			}
			// Played (the update « evenements-joues »): its choices instead of its single join.
			h = h.Played(sims.EventsOpen(r.Context()))
			// The jam's own join behind its update (« circulation »): closed, nothing to do there, as before.
			if h.Join != nil && features.Default.Blocks(r.Context(), h.Join.ID) != "" {
				h.Join = nil
			}
			h.Choices = slices.DeleteFunc(h.Choices, func(c game.EventChoice) bool { return features.Default.Blocks(r.Context(), c.ID) != "" })
			out := map[string]any{"happening": h, "start": start, "end": start + game.HappeningMinutes}
			// Regulated by a player at the junction (sims jam.go): the jam is over, the cars drive off.
			if at, cleared, err := sims.JamCleared(r.Context(), pool, r.URL.Query().Get("city"), r.URL.Query().Get("commune"), t); err == nil && cleared {
				h.Join, h.Choices = nil, nil
				out["happening"], out["cleared"] = h, at
			}
			httpx.JSON(w, http.StatusOK, out)
		})
		// A stadium's agenda: what's on now (from the doors opening) and the next seven days.
		r.Get("/stadium", func(w http.ResponseWriter, r *http.Request) {
			place := r.URL.Query().Get("place")
			if _, _, p, ok := world.FindPlace(place); !ok || p.Kind != game.StadiumKind {
				httpx.Error(w, http.StatusNotFound, "stade inconnu")
				return
			}
			now := game.MinuteOf(time.Now())
			var on *game.StadiumEvent
			if e, ok := game.StadiumEventAt(place, now); ok {
				on = &e
			}
			w.Header().Set("Cache-Control", "public, max-age=60")
			httpx.JSON(w, http.StatusOK, map[string]any{"now": now, "on": on, "agenda": game.StadiumAgenda(place, now, now, now+7*24*60)})
		})
		// The server's clock: every player's world runs on it (web/src/lib/worldClock.ts).
		r.Get("/time", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			httpx.JSON(w, http.StatusOK, map[string]int64{"now": time.Now().UnixMilli()})
		})
		r.Get("/live", players.ServeHTTP)
		// The wish list: sign up before the game opens (export with WAITLIST_ADMIN_KEY).
		wish := &waitlist.Handler{DB: pool, AdminKey: os.Getenv("WAITLIST_ADMIN_KEY"), Verify: func(ctx context.Context, token string) (string, string, error) {
			id, err := authH.Identify(ctx, token)
			if err != nil {
				return "", "", err
			}
			name := id.FirstName
			if name == "" {
				name = id.Name
			}
			return id.Email, name, nil
		}}
		r.Post("/waitlist", wish.Join)
		r.Get("/waitlist/count", wish.Count)
		r.Get("/waitlist/export", wish.Export)
		// Babi Pub: the billboards' ads (files in an S3-compatible bucket; admin with ADS_ADMIN_KEY).
		pub := &ads.Handler{DB: pool, AdminKey: os.Getenv("ADS_ADMIN_KEY"), Head: ads.HeadHTTP, Bucket: bucket}
		r.Get("/ads/invite/{code}", pub.Invite)
		r.Get("/ads/admin/invites", pub.AdminInvites)
		r.Post("/ads/admin/invites", pub.AdminInvite)
		r.Post("/ads/admin/invites/{code}/revoke", pub.AdminRevoke)
		r.Post("/ads/upload", pub.Upload)
		r.Post("/ads/campaigns", pub.Create)
		r.Get("/ads/campaigns/{token}", pub.Follow)
		r.Get("/ads/live", pub.Live)
		r.Post("/ads/views", pub.Viewed)
		r.Get("/ads/admin", pub.AdminList)
		r.Post("/ads/admin/{id}", pub.AdminUpdate)
		r.Get("/news", headlines.Handler)
		// The /admin page's API (ADMIN_KEY): players, log, announcements, WhatsApp.
		// The players' ideas from the phone (ideas): sent signed in, read and answered on /admin.
		ideasH := &ideas.Handler{DB: pool}
		// The city's political life (politics): elections settled, offices paid, the sects' dues, on the clock.
		politicsH := &politics.Handler{DB: pool, Changed: func(id string) { players.Changed(id) }, Push: pushes}
		go politicsH.Watch(ctx, time.Minute)
		// The campaign's posters on the boards, as public as the ads (politics/presidency.go).
		r.Get("/politics/affiches", politicsH.Posters)
		// E-mails of news from /admin (Brevo, like « mot de passe oublié »), with their « ne plus recevoir » link here.
		emails := &admin.Emails{Mail: authH.Mail, Site: authH.SiteURL, API: shopH.API, Secret: []byte(cfg.JWTSecret)}
		if _, dev := authH.Mail.(mail.Log); dev && emails.API == "" {
			emails.API = "http://localhost:" + cfg.Port
		}
		adminH := &admin.Handler{DB: pool, WA: &admin.WhatsApp{Token: os.Getenv("WHATSAPP_TOKEN"), PhoneID: os.Getenv("WHATSAPP_PHONE_ID"), API: os.Getenv("WHATSAPP_API")}, Ideas: ideasH, Mail: emails, Push: pushes, Bucket: bucket}
		if authH.Mail != nil {
			adminH.Accounts = authH
		}
		adminH.Routes(r)
		// WhatsApp campaigns set for later (the opening) start by themselves.
		go adminH.WatchWhatsApp(ctx, 30*time.Second)
		r.Get("/mail/stop", adminH.MailStop)
		// A campaign's video, for its page on the site (/regarder/<id>): e-mails link there.
		r.Get("/media/{id}", adminH.Media)
		// Moderation of Gbairai's reports (MODERATION_KEY).
		mod := &sims.Moderation{H: simsH, Key: os.Getenv("MODERATION_KEY")}
		r.Get("/moderation/reports", mod.Reports)
		r.Post("/moderation/reports/{report}", mod.Resolve)
		r.Get("/moderation/photo", mod.Photo)
		r.Post("/auth/google", authH.Google)
		r.Post("/auth/register", authH.Register)
		r.Post("/shop/geniuspay", shopH.Webhook)
		shopH.PubRoutes(r)
		r.Post("/auth/login", authH.Login)
		r.Post("/auth/forgot", authH.Forgot)
		r.Post("/auth/reset", authH.Reset)
		r.Get("/auth/username", authH.UsernameAvailable)
		if cfg.DevLogin {
			log.Println("⚠️  DEV_LOGIN is on: anyone can sign in without Google")
			r.Post("/auth/dev", authH.Dev)
		}

		r.Group(func(r chi.Router) {
			r.Use(tokens.Require)
			// The same write sent twice is done once (Idempotency-Key).
			r.Use(auth.Idempotent(pool))
			// A change to a Sim (any write that went through): its other devices hear it (live.Changed).
			r.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					ww := middleware.NewWrapResponseWriter(w, req.ProtoMajor)
					next.ServeHTTP(ww, req)
					if req.Method == http.MethodGet || ww.Status() >= 400 {
						return
					}
					if rc := chi.RouteContext(req.Context()); rc != nil {
						players.Changed(rc.URLParam("id"), rc.URLParam("other"))
					}
				})
			})
			r.Get("/me", authH.Me)
			r.Get("/me/sessions", sessions.List)
			r.Delete("/me/sessions/{session}", sessions.Revoke)
			r.Post("/me/sessions/others", sessions.RevokeOthers)
			r.Delete("/me/session", sessions.End)
			r.Put("/me/username", authH.SetUsername)
			r.Post("/me/tester", authH.BecomeTester)
			r.Post("/me/adult", authH.ConfirmAdult)
			r.Put("/me/lang", authH.SetLang)
			r.Post("/me/push", pushes.Subscribe)
			r.Delete("/me/push", pushes.Unsubscribe)
			ideasH.Routes(r)
			// The game itself: shut on the server until launch (auth.GameGate).
			r.Group(func(r chi.Router) {
				r.Use(auth.GameGate(pool, func(ctx context.Context) bool {
					return cfg.GameOpen || features.Default.BlocksKey(ctx, "jeu") == ""
				}))
				simsH.Routes(r)
				shopH.Routes(r)
				politicsH.Routes(r)
			})
		})
	})

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Printf("Babi Life API listening on :%s", cfg.Port)
		if !cfg.GameOpen {
			log.Println("Game shut until launch (GAME_OPEN not true, « L'ouverture de Babi Life » not open): the wish list and the team's accounts only")
		}
		log.Printf("Sites allowed to call the API: %s", strings.Join(cfg.AllowedOrigins, ", "))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdown)
}
