package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	_ "embed"
	"encoding/json"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

//go:embed schema.sql
var schemaSQL string

const defaultPort = 8080

var (
	headcountOptions = map[string]struct{}{
		"1-50":     {},
		"51-200":   {},
		"201-1000": {},
		"1000+":    {},
	}
	emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

	// Auth-service introspection configuration
	authIntrospectURL  = getenv("AUTH_SERVICE_INTROSPECT_URL", "http://auth-service:8080/session/introspect")
	authServiceToken   = getenv("AUTH_INTERNAL_SERVICE_TOKEN", "antcrowd-internal-dev-token")
	sessionCookieName  = getenv("AUTH_SESSION_COOKIE_NAME", "antcrowd_session")
)

type requestPayload struct {
	Email     string `json:"email"`
	Headcount string `json:"headcount"`
	Country   string `json:"country"`
	HearAbout string `json:"hearAbout"`
}

type trustCenterRequest struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	Headcount   string  `json:"headcount"`
	Country     string  `json:"country"`
	HearAbout   *string `json:"hearAbout,omitempty"`
	Status      string  `json:"status"`
	Notes       string  `json:"notes,omitempty"`
	ReviewedBy  string  `json:"reviewedBy,omitempty"`
	SubmittedAt string  `json:"submittedAt"`
	IP          string  `json:"ip"`
}

type errorResponse struct {
	Detail []string `json:"detail"`
}

type messageResponse struct {
	Message string `json:"message"`
}

type store struct {
	db *sql.DB
}

func main() {
	port := getenv("PORT", fmt.Sprint(defaultPort))
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := openDB(dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := applySchema(db, schemaSQL); err != nil {
		log.Fatal(err)
	}

	s := &store{db: db}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/ready", s.handleReady)
	mux.HandleFunc("/api/trust-center/request-demo", s.handleRequestDemo)
	mux.HandleFunc("/api/trust-center/submissions", s.handleSubmissions)

	addr := ":" + port
	log.Printf("trust center service listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

func (s *store) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := s.db.PingContext(r.Context()); err != nil {
		respondJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded"})
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *store) handleReady(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := s.db.PingContext(r.Context()); err != nil {
		respondJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not ready"})
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *store) handleRequestDemo(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		respondJSON(w, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
		return
	}

	var payload requestPayload
	if err := decodeJSON(r, &payload); err != nil && !errors.Is(err, io.EOF) {
		respondJSON(w, http.StatusBadRequest, errorResponse{Detail: []string{"Invalid JSON payload."}})
		return
	}

	email := strings.TrimSpace(payload.Email)
	headcount := strings.TrimSpace(payload.Headcount)
	country := strings.ToLower(strings.TrimSpace(payload.Country))
	hearAbout := strings.TrimSpace(payload.HearAbout)

	var validationErrors []string
	if email == "" {
		validationErrors = append(validationErrors, "Email is required.")
	} else if !emailPattern.MatchString(email) {
		validationErrors = append(validationErrors, "Email is not a valid address.")
	}
	if headcount == "" {
		validationErrors = append(validationErrors, "Company headcount is required.")
	} else if _, ok := headcountOptions[headcount]; !ok {
		validationErrors = append(validationErrors, "Please choose a valid headcount range.")
	}
	if country == "" {
		validationErrors = append(validationErrors, "Country is required.")
	}
	if len(hearAbout) > 200 {
		validationErrors = append(validationErrors, "Additional context must be under 200 characters.")
	}
	if len(validationErrors) > 0 {
		respondJSON(w, http.StatusUnprocessableEntity, errorResponse{Detail: validationErrors})
		return
	}

	var hearAboutPtr *string
	if hearAbout != "" {
		hearAboutPtr = &hearAbout
	}

	request := trustCenterRequest{
		ID:          newID("req"),
		Email:       email,
		Headcount:   headcount,
		Country:     country,
		HearAbout:   hearAboutPtr,
		Status:      "New",
		SubmittedAt: time.Now().UTC().Format(time.RFC3339),
		IP:          requestIP(r),
	}

	if _, err := s.db.ExecContext(r.Context(), `
		INSERT INTO trust_center_requests (
			id, email, headcount, country, hear_about, status, submitted_at, updated_at, ip_address
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
	`, request.ID, request.Email, request.Headcount, request.Country, request.HearAbout, request.Status, request.SubmittedAt, request.IP); err != nil {
		handleDBError(w, err)
		return
	}

	log.Printf("received trust center request: %+v", request)
	respondJSON(w, http.StatusCreated, messageResponse{Message: "Request submitted successfully."})
}

func (s *store) handleSubmissions(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		respondJSON(w, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
		return
	}

	// Platform admin only — introspect the session cookie
	if !requirePlatformAdmin(w, r) {
		return
	}

	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, email, headcount, country, hear_about, status, notes, reviewed_by_name, submitted_at, ip_address
		FROM trust_center_requests
		ORDER BY submitted_at DESC
	`)
	if err != nil {
		handleDBError(w, err)
		return
	}
	defer rows.Close()

	var submissions []trustCenterRequest
	for rows.Next() {
		var item trustCenterRequest
		var hearAbout, notes, reviewedBy sql.NullString
		var submittedAt time.Time
		if err := rows.Scan(&item.ID, &item.Email, &item.Headcount, &item.Country, &hearAbout, &item.Status, &notes, &reviewedBy, &submittedAt, &item.IP); err != nil {
			handleDBError(w, err)
			return
		}
		item.SubmittedAt = submittedAt.UTC().Format(time.RFC3339)
		if hearAbout.Valid {
			value := hearAbout.String
			item.HearAbout = &value
		}
		if notes.Valid {
			item.Notes = notes.String
		}
		if reviewedBy.Valid {
			item.ReviewedBy = reviewedBy.String
		}
		submissions = append(submissions, item)
	}
	if err := rows.Err(); err != nil {
		handleDBError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{"submissions": submissions})
}

func openDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}

	for i := 0; i < 20; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err = db.PingContext(ctx)
		cancel()
		if err == nil {
			return db, nil
		}
		time.Sleep(2 * time.Second)
	}

	_ = db.Close()
	return nil, err
}

func applySchema(db *sql.DB, schema string) error {
	_, err := db.Exec(schema)
	return err
}

func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(payload)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,Cookie")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// introspectSession calls the auth-service introspection endpoint to verify a session token.
// Returns the account type on success, or an empty string if the session is invalid.
func introspectSession(sessionToken string) string {
	if sessionToken == "" {
		return ""
	}

	body, _ := json.Marshal(map[string]string{"sessionToken": sessionToken})
	req, err := http.NewRequest(http.MethodPost, authIntrospectURL, bytes.NewReader(body))
	if err != nil {
		return ""
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-internal-service-token", authServiceToken)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return ""
	}
	defer resp.Body.Close()

	var result struct {
		User     map[string]interface{} `json:"user"`
		Identity map[string]interface{} `json:"identity"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return ""
	}

	// Try identity.accountType first, then user.accountType
	if at, ok := result.Identity["accountType"].(string); ok && at != "" {
		return at
	}
	if at, ok := result.User["accountType"].(string); ok && at != "" {
		return at
	}
	return ""
}

// requirePlatformAdmin checks the session cookie and returns true if the user is a platform admin.
// If not, it writes a 403 response and returns false.
func requirePlatformAdmin(w http.ResponseWriter, r *http.Request) bool {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil || cookie.Value == "" {
		respondJSON(w, http.StatusForbidden, errorResponse{Detail: []string{"Platform admin access required."}})
		return false
	}

	accountType := introspectSession(cookie.Value)
	if accountType != "platform_admin" {
		respondJSON(w, http.StatusForbidden, errorResponse{Detail: []string{"Platform admin access required."}})
		return false
	}
	return true
}

func decodeJSON(r *http.Request, dst any) error {
	return json.NewDecoder(r.Body).Decode(dst)
}

func handleDBError(w http.ResponseWriter, err error) {
	log.Printf("database error: %v", err)
	respondJSON(w, http.StatusInternalServerError, errorResponse{Detail: []string{"Unable to complete request."}})
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func newID(prefix string) string {
	var raw [12]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return fmt.Sprintf("%s-%d", prefix, time.Now().UTC().UnixNano())
	}
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(raw[:])[:8])
}

func requestIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if candidate := strings.TrimSpace(parts[0]); candidate != "" {
			return candidate
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "unknown"
}
