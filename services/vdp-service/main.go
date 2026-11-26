package main

import (
	"context"
	"log"
	"time"

	"github.com/gin-gonic/gin"

	"vdp-service/config"
	"vdp-service/db"
	"vdp-service/handlers"
	"vdp-service/middleware"
	"vdp-service/notifications"
	"vdp-service/routes"
	"vdp-service/security"
	"vdp-service/storage"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatal("config error: ", err)
	}

	pool, err := db.Connect(cfg.DBDSN)
	if err != nil {
		log.Fatal("db connection failed: ", err)
	}
	defer pool.Close()

	if cfg.MigrateOnStart {
		if err := db.RunMigrations(context.Background(), pool, "./migrations"); err != nil {
			log.Fatal("migration failed: ", err)
		}
	}

	var store *storage.MinIO
	var lastErr error
	for i := 0; i < 10; i++ {
		store, lastErr = storage.NewMinIO(cfg.MinIOEndpoint, cfg.MinIOAccessKey, cfg.MinIOSecretKey, cfg.MinIOBucket, cfg.MinIOUseSSL)
		if lastErr == nil {
			break
		}
		time.Sleep(2 * time.Second)
	}
	if lastErr != nil {
		log.Fatal("minio init failed: ", lastErr)
	}

	mailer := notifications.NewMailer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPass, cfg.FromEmail)
	av := security.NewClamAV(cfg.ClamAVHost, cfg.ClamAVPort, 5*time.Second)

	if cfg.AppEnv == "development" || cfg.AppEnv == "test" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.MaxMultipartMemory = 32 << 20
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.RequestLogger())

	rl := middleware.NewRateLimiter(cfg.RateLimitRPM)
	rl.StartCleanup()

	h := &handlers.Handler{DB: pool, Store: store, Config: cfg, Mailer: mailer, AV: av}
	routes.Register(r, h, rl)
	automationCtx, cancelAutomation := context.WithCancel(context.Background())
	defer cancelAutomation()
	go h.StartOutboxLoop(automationCtx, 3*time.Second)
	go h.StartSLAEscalationLoop(automationCtx, 5*time.Minute)
	go h.StartMaintenanceLoop(automationCtx, 30*time.Minute)

	r.GET("/health", func(c *gin.Context) { c.String(200, "OK") })
	r.GET("/ready", func(c *gin.Context) {
		if err := pool.Ping(c.Request.Context()); err != nil {
			c.Status(503)
			return
		}
		c.String(200, "OK")
	})

	log.Println("vdp-service running on :" + cfg.Port + " env=" + cfg.AppEnv)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
