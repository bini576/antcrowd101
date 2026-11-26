package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type Config struct {
	Addr               string
	CorsOrigin         string
	DatabaseURL        string
	SMTPHost           string
	SMTPPort           string
	SMTPUser           string
	SMTPPass           string
	SMTPFrom           string
	SMTPTo             string
	AuthIntrospectURL  string
	AuthServiceBaseURL string
	AuthServiceToken   string
	SessionCookieName  string
	PlatformLoginURL   string
	PlatformLogoutURL  string
}

func loadConfig() Config {
	return Config{
		Addr:              getenv("ADDR", ":8080"),
		CorsOrigin:        getenv("CORS_ORIGIN", "http://localhost:5173"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		SMTPHost:          os.Getenv("SMTP_HOST"),
		SMTPPort:          getenv("SMTP_PORT", "587"),
		SMTPUser:          os.Getenv("SMTP_USER"),
		SMTPPass:          os.Getenv("SMTP_PASS"),
		SMTPFrom:          os.Getenv("SMTP_FROM"),
		SMTPTo:            os.Getenv("SMTP_TO"),
		AuthIntrospectURL:  getenv("AUTH_SERVICE_INTROSPECT_URL", "http://auth-service:8080/session/introspect"),
		AuthServiceBaseURL: getenv("AUTH_SERVICE_BASE_URL", "http://auth-service:8080"),
		AuthServiceToken:   getenv("AUTH_INTERNAL_SERVICE_TOKEN", "antcrowd-internal-dev-token"),
		SessionCookieName: getenv("AUTH_SESSION_COOKIE_NAME", "antcrowd_session"),
		PlatformLoginURL:  getenv("PLATFORM_LOGIN_URL", "/login"),
		PlatformLogoutURL: getenv("PLATFORM_LOGOUT_URL", "/api/auth/logout"),
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func withCORS(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func openDB(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}

	var pingErr error
	for attempts := 1; attempts <= 20; attempts++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		pingErr = db.PingContext(ctx)
		cancel()
		if pingErr == nil {
			return db, nil
		}
		log.Printf("Waiting for Postgres... attempt %d/20: %v", attempts, pingErr)
		time.Sleep(2 * time.Second)
	}

	db.Close()
	return nil, pingErr
}

func applyMigration(db *sql.DB, path string) error {
	contents, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	_, err = db.Exec(string(contents))
	return err
}

// routePrefix is a simple path-based router helper.
func routePrefix(mux *http.ServeMux, prefix string, handler http.HandlerFunc) {
	mux.HandleFunc(prefix, func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, prefix) {
			handler(w, r)
			return
		}
		http.NotFound(w, r)
	})
}

func main() {
	cfg := loadConfig()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := openDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := applyMigration(db, "migration.sql"); err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()

	// Existing endpoints — do not touch
	mux.HandleFunc("/contact/code", handleContact(db, cfg))
	mux.HandleFunc("/health", handleHealth(db))
	mux.HandleFunc("/ready", handleReady(db))

	// New API endpoints
	mux.HandleFunc("/api/whoami", handleWhoAmI(db, cfg))
	mux.HandleFunc("/api/auth/bootstrap", handleAuthBootstrap(db, cfg))
	mux.HandleFunc("/api/admin/summary", handleAdminSummary(db, cfg))
	mux.HandleFunc("/api/dashboard", handleDashboard(db, cfg))
	mux.HandleFunc("/api/compliance/summary", handleComplianceSummary(db, cfg))
	mux.HandleFunc("/api/notifications", handleNotifications(db, cfg))
	requestsHandler := func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/requests" || r.URL.Path == "/api/requests/" {
			switch r.Method {
			case http.MethodGet:
				handleListRequests(db, cfg)(w, r)
			case http.MethodPost:
				handleCreateRequest(db, cfg)(w, r)
			default:
				jsonError(w, 405, "Method not allowed")
			}
			return
		}
		// Sub-routes: /api/requests/{id}/decision, /api/requests/{id}/assign, /api/requests/{id}/findings, /api/requests/{id}/complete
		path := strings.TrimPrefix(r.URL.Path, "/api/requests/")
		if strings.HasSuffix(path, "/decision") {
			handleRequestDecision(db, cfg)(w, r)
		} else if strings.HasSuffix(path, "/assign") {
			handleRequestAssign(db, cfg)(w, r)
		} else if strings.HasSuffix(path, "/complete") {
			handleRequestComplete(db, cfg)(w, r)
		} else if strings.HasSuffix(path, "/findings") {
			switch r.Method {
			case http.MethodGet:
				handleListFindings(db, cfg)(w, r)
			case http.MethodPost:
				handleSubmitFinding(db, cfg)(w, r)
			default:
				jsonError(w, 405, "Method not allowed")
			}
		} else {
			http.NotFound(w, r)
		}
	}
	mux.HandleFunc("/api/requests", requestsHandler)
	mux.HandleFunc("/api/requests/", requestsHandler)
	mux.HandleFunc("/api/notifications/", handleNotificationRead(db, cfg))
	mux.HandleFunc("/api/findings", handleListFindings(db, cfg))
	mux.HandleFunc("/api/findings/", handleFindingDeveloperTag(db, cfg))
	mux.HandleFunc("/api/reviewers", handleListReviewers(db, cfg))

	log.Printf("code-service listening on %s", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, withCORS(cfg.CorsOrigin, mux)); err != nil {
		log.Fatal(err)
	}
}
