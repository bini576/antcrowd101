package main

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type app struct {
	db        *sql.DB
	jwtSecret []byte
}

type authClaims struct {
	UserID       int64  `json:"userId"`
	Role         string `json:"role"`
	OrgID        int64  `json:"orgId"`
	ResearcherID int64  `json:"researcherId"`
	jwt.RegisteredClaims
}

type authUser struct {
	ID           int64  `json:"id"`
	Email        string `json:"email"`
	FullName     string `json:"fullName"`
	Role         string `json:"role"`
	OrgID        int64  `json:"orgId"`
	ResearcherID int64  `json:"researcherId"`
}

type researcher struct {
	ID         int64  `json:"id"`
	FullName   string `json:"fullName"`
	Handle     string `json:"handle"`
	Email      string `json:"email"`
	IsInternal bool   `json:"isInternal"`
	Skills     string `json:"skills"`
	Status     string `json:"status"`
}

type reputationStats struct {
	AverageRating    float64 `json:"averageRating"`
	RatingCount      int64   `json:"ratingCount"`
	AcceptedFindings int64   `json:"acceptedFindings"`
	ResolvedFindings int64   `json:"resolvedFindings"`
	PaidFindings     int64   `json:"paidFindings"`
	TotalBounty      int64   `json:"totalBounty"`
}

type researcherProfile struct {
	ID               int64             `json:"id"`
	FullName         string            `json:"fullName"`
	Handle           string            `json:"handle"`
	Email            string            `json:"email"`
	IsInternal       bool              `json:"isInternal"`
	Skills           string            `json:"skills"`
	Status           string            `json:"status"`
	Phone            string            `json:"phone"`
	Bio              string            `json:"bio"`
	Specialization   string            `json:"specialization"`
	ExperienceLevel  string            `json:"experienceLevel"`
	SocialLinks      map[string]string `json:"socialLinks"`
	PhotoDataURL     string            `json:"photoDataUrl"`
	ReputationStats  reputationStats   `json:"reputationStats"`
	SubmissionsCount int64             `json:"submissionsCount"`
}

type researcherProfileUpdateInput struct {
	Phone           string            `json:"phone"`
	Bio             string            `json:"bio"`
	Skills          string            `json:"skills"`
	Specialization  string            `json:"specialization"`
	ExperienceLevel string            `json:"experienceLevel"`
	SocialLinks     map[string]string `json:"socialLinks"`
}

type platformOrganization struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type platformSessionUser struct {
	Email          string               `json:"email"`
	AccountType    string               `json:"accountType"`
	ResearcherType string               `json:"researcherType"`
	FirstName      string               `json:"firstName"`
	LastName       string               `json:"lastName"`
	DisplayName    string               `json:"displayName"`
	EmailVerified  bool                 `json:"emailVerified"`
	ApprovalStatus string               `json:"approvalStatus"`
	Organization   platformOrganization `json:"organization"`
}

type platformIntrospectResponse struct {
	User platformSessionUser `json:"user"`
}

type engagement struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	Target     string `json:"target"`
	Type       string `json:"type"`
	Mode       string `json:"mode"`
	TesterPool string `json:"testerPool"`
	Deadline   string `json:"deadline"`
	Scope      string `json:"scope"`
	Status     string `json:"status"`
}

type application struct {
	ID             int64  `json:"id"`
	EngagementID   int64  `json:"engagementId"`
	EngagementName string `json:"engagementName"`
	Status         string `json:"status"`
	AssignedBy     string `json:"assignedBy"`
	CreatedAt      string `json:"createdAt"`
}

type invitation struct {
	ID             int64  `json:"id"`
	EngagementID   int64  `json:"engagementId"`
	EngagementName string `json:"engagementName"`
	Status         string `json:"status"`
	InvitedAt      string `json:"invitedAt"`
}

type finding struct {
	ID               int64   `json:"id"`
	JobID            int64   `json:"jobId"`
	JobTitle         string  `json:"jobTitle"`
	Title            string  `json:"title"`
	Severity         string  `json:"severity"`
	Status           string  `json:"status"`
	PoC              string  `json:"poc"`
	Remediation      string  `json:"remediation"`
	CVSS             float64 `json:"cvss"`
	EvidenceURL      string  `json:"evidenceUrl"`
	AssetPath        string  `json:"assetPath"`
	CWE              string  `json:"cwe"`
	Bounty           int64   `json:"bounty"`
	ReviewComment    string  `json:"reviewComment"`
	PaymentReference string  `json:"paymentReference"`
	CreatedAt        string  `json:"createdAt"`
}

type notification struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Read      bool   `json:"read"`
	CreatedAt string `json:"createdAt"`
}

type earningsSummary struct {
	TotalEarned     int64     `json:"totalEarned"`
	PendingPayouts  int64     `json:"pendingPayouts"`
	PaidHistory     []finding `json:"paidHistory"`
	PendingFindings []finding `json:"pendingFindings"`
}

func normalizeRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "platform_admin":
		return "platform_admin"
	case "org_admin", "organization", "organization_admin":
		return "organization_admin"
	case "researcher_internal":
		return "researcher_internal"
	case "researcher_external":
		return "researcher_external"
	default:
		return strings.ToLower(strings.TrimSpace(role))
	}
}

func buildAuthUserPayload(u authUser) map[string]any {
	role := normalizeRole(u.Role)
	var organizationID any
	var researcherID any
	if u.OrgID > 0 {
		organizationID = u.OrgID
	}
	if u.ResearcherID > 0 {
		researcherID = u.ResearcherID
	}
	return map[string]any{
		"id":              u.ID,
		"email":           u.Email,
		"full_name":       u.FullName,
		"fullName":        u.FullName,
		"role":            role,
		"legacy_role":     u.Role,
		"organization_id": organizationID,
		"orgId":           u.OrgID,
		"researcher_id":   researcherID,
		"researcherId":    u.ResearcherID,
		"module_access":   []string{"pen"},
	}
}

func buildLoginPayload(token string, u authUser) map[string]any {
	return map[string]any{
		"access_token": token,
		"token_type":   "bearer",
		"token":        token,
		"user":         buildAuthUserPayload(u),
	}
}

func main() {
	dsn := env("DB_DSN", "postgres://antcrowd:antcrowd123@localhost:5432/antcrowd?sslmode=disable")
	port := env("PORT", "8087")
	jwtSecret := env("JWT_SECRET", "dev-secret")
	appEnv := strings.ToLower(strings.TrimSpace(env("APP_ENV", "development")))
	if err := validateJWTSecret(appEnv, jwtSecret); err != nil {
		log.Fatal(err)
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := waitForDB(db, 30, 2*time.Second); err != nil {
		log.Fatalf("wait db: %v", err)
	}

	a := &app{db: db, jwtSecret: []byte(jwtSecret)}
	if err := a.migrateProfile(); err != nil {
		log.Fatalf("migrate profile: %v", err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		respond(w, http.StatusOK, map[string]any{
			"service": "pen-researcher-backend",
			"status":  "ok",
			"health":  "/health",
			"ready":   "/ready",
		})
	})
	mux.HandleFunc("/health", a.handleHealth)
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		if err := db.PingContext(r.Context()); err != nil {
			respondErr(w, http.StatusServiceUnavailable, "not ready")
			return
		}
		respond(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/api/auth/login", a.handleLogin)
	mux.HandleFunc("/api/auth/bootstrap", a.handlePlatformBootstrap)
	mux.HandleFunc("/api/auth/me", a.handleMe)
	mux.HandleFunc("/api/researcher/profile", a.handleProfile)
	mux.HandleFunc("/api/researcher/profile/photo", a.handleProfilePhoto)
	mux.HandleFunc("/api/researcher/engagements", a.handleEngagements)
	mux.HandleFunc("/api/researcher/applications", a.handleApplications)
	mux.HandleFunc("/api/researcher/invitations", a.handleInvitations)
	mux.HandleFunc("/api/researcher/invitations/", a.handleInvitationActions)
	mux.HandleFunc("/api/researcher/findings", a.handleFindings)
	mux.HandleFunc("/api/researcher/notifications", a.handleNotifications)
	mux.HandleFunc("/api/researcher/notifications/", a.handleNotificationActions)
	mux.HandleFunc("/api/researcher/earnings", a.handleEarnings)

	log.Printf("pen-researcher-backend listening on :%s", port)
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func waitForDB(db *sql.DB, retries int, interval time.Duration) error {
	for i := 0; i < retries; i++ {
		if err := db.Ping(); err == nil {
			return nil
		}
		time.Sleep(interval)
	}
	return db.Ping()
}

func (a *app) migrateProfile() error {
	_, err := a.db.Exec(`
CREATE TABLE IF NOT EXISTS pen_researcher_profiles (
  researcher_id BIGINT PRIMARY KEY REFERENCES pen_researchers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  specialization TEXT NOT NULL DEFAULT '',
  experience_level TEXT NOT NULL DEFAULT '',
  social_links_json TEXT NOT NULL DEFAULT '{}',
  profile_photo_path TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS specialization TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS experience_level TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS social_links_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
`)
	return err
}

func withCORS(next http.Handler) http.Handler {
	allowedOrigins := loadAllowedOrigins()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin != "" && isAllowedOrigin(origin, allowedOrigins) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *app) signToken(u authUser) (string, error) {
	now := time.Now()
	claims := authClaims{
		UserID:       u.ID,
		Role:         normalizeRole(u.Role),
		OrgID:        u.OrgID,
		ResearcherID: u.ResearcherID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(u.ID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(a.jwtSecret)
}

func (a *app) requireResearcher(w http.ResponseWriter, r *http.Request) (*authClaims, bool) {
	authz := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
		respondErr(w, http.StatusUnauthorized, "missing bearer token")
		return nil, false
	}
	tokenStr := strings.TrimSpace(authz[7:])
	parsed, err := jwt.ParseWithClaims(tokenStr, &authClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return a.jwtSecret, nil
	})
	if err != nil || !parsed.Valid {
		respondErr(w, http.StatusUnauthorized, "invalid token")
		return nil, false
	}
	claims, ok := parsed.Claims.(*authClaims)
	if !ok {
		respondErr(w, http.StatusUnauthorized, "invalid token claims")
		return nil, false
	}
	claims.Role = normalizeRole(claims.Role)
	if claims.Role != "researcher_internal" && claims.Role != "researcher_external" {
		respondErr(w, http.StatusForbidden, "researcher role required")
		return nil, false
	}
	if claims.ResearcherID == 0 {
		respondErr(w, http.StatusForbidden, "researcher account is not linked")
		return nil, false
	}
	return claims, true
}

func (a *app) handleHealth(w http.ResponseWriter, _ *http.Request) {
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *app) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if in.Email == "" || in.Password == "" {
		respondErr(w, http.StatusBadRequest, "email and password required")
		return
	}

	var user authUser
	var hash string
	err := a.db.QueryRow(`
SELECT id, email, full_name, role, COALESCE(organization_id,0), COALESCE(researcher_id,0), password_hash
FROM pen_users WHERE email=$1 AND status='active'
`, in.Email).Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &user.OrgID, &user.ResearcherID, &hash)
	if err == sql.ErrNoRows {
		respondErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user.Role != "researcher_internal" && user.Role != "researcher_external" {
		respondErr(w, http.StatusForbidden, "researcher login required")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		respondErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	user.Role = normalizeRole(user.Role)
	token, err := a.signToken(user)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to sign token")
		return
	}
	respond(w, http.StatusOK, buildLoginPayload(token, user))
}

func (a *app) handlePlatformBootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	platformUser, err := a.introspectPlatformSession(r)
	if err != nil {
		respondErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	user, err := a.syncPlatformResearcher(platformUser)
	if err != nil {
		respondErr(w, http.StatusForbidden, err.Error())
		return
	}

	token, err := a.signToken(user)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to sign token")
		return
	}

	respond(w, http.StatusOK, buildLoginPayload(token, user))
}

func (a *app) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	var u authUser
	err := a.db.QueryRow(`
SELECT id, email, full_name, role, COALESCE(organization_id,0), COALESCE(researcher_id,0)
FROM pen_users WHERE id=$1
`, claims.UserID).Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.OrgID, &u.ResearcherID)
	if err != nil {
		respondErr(w, http.StatusUnauthorized, "user not found")
		return
	}
	respond(w, http.StatusOK, buildAuthUserPayload(u))
}

func (a *app) handleProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}

	switch r.Method {
	case http.MethodGet:
		profile, err := a.loadResearcherProfile(claims.ResearcherID)
		if err == sql.ErrNoRows {
			respondErr(w, http.StatusNotFound, "researcher not found")
			return
		}
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusOK, profile)
	case http.MethodPatch, http.MethodPut:
		var in researcherProfileUpdateInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			respondErr(w, http.StatusBadRequest, "invalid json")
			return
		}
		sanitized, err := validateProfileInput(in)
		if err != nil {
			respondErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := a.ensureProfileRow(claims.ResearcherID); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}

		socialLinksJSON, _ := json.Marshal(sanitized.SocialLinks)
		if _, err := a.db.Exec(`
UPDATE pen_researchers
SET skills = $1
WHERE id = $2
`, sanitized.Skills, claims.ResearcherID); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if _, err := a.db.Exec(`
UPDATE pen_researcher_profiles
SET phone = $1,
    bio = $2,
    specialization = $3,
    experience_level = $4,
    social_links_json = $5,
    updated_at = NOW()
WHERE researcher_id = $6
`, sanitized.Phone, sanitized.Bio, sanitized.Specialization, sanitized.ExperienceLevel, string(socialLinksJSON), claims.ResearcherID); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}

		profile, err := a.loadResearcherProfile(claims.ResearcherID)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusOK, profile)
	default:
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *app) handleProfilePhoto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}

	var in struct {
		PhotoDataURL string `json:"photoDataUrl"`
		DataURL      string `json:"dataUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	dataURL := strings.TrimSpace(in.PhotoDataURL)
	if dataURL == "" {
		dataURL = strings.TrimSpace(in.DataURL)
	}
	if dataURL == "" {
		respondErr(w, http.StatusBadRequest, "photoDataUrl is required")
		return
	}
	if err := a.ensureProfileRow(claims.ResearcherID); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	storedPath, err := saveProfilePhoto(claims.ResearcherID, dataURL)
	if err != nil {
		respondErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if _, err := a.db.Exec(`
UPDATE pen_researcher_profiles
SET profile_photo_path = $1,
    updated_at = NOW()
WHERE researcher_id = $2
`, storedPath, claims.ResearcherID); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	profile, err := a.loadResearcherProfile(claims.ResearcherID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, profile)
}

func (a *app) ensureProfileRow(researcherID int64) error {
	_, err := a.db.Exec(`
INSERT INTO pen_researcher_profiles (researcher_id)
VALUES ($1)
ON CONFLICT (researcher_id) DO NOTHING
`, researcherID)
	return err
}

func (a *app) loadResearcherProfile(researcherID int64) (researcherProfile, error) {
	if err := a.ensureProfileRow(researcherID); err != nil {
		return researcherProfile{}, err
	}

	var (
		profile         researcherProfile
		socialLinksJSON string
		photoPath       string
	)
	err := a.db.QueryRow(`
SELECT r.id,
       r.full_name,
       r.handle,
       r.email,
       r.is_internal,
       r.skills,
       r.status,
       COALESCE(p.phone, ''),
       COALESCE(p.bio, ''),
       COALESCE(p.specialization, ''),
       COALESCE(p.experience_level, ''),
       COALESCE(p.social_links_json, '{}'),
       COALESCE(p.profile_photo_path, '')
FROM pen_researchers r
LEFT JOIN pen_researcher_profiles p ON p.researcher_id = r.id
WHERE r.id = $1
`, researcherID).Scan(
		&profile.ID,
		&profile.FullName,
		&profile.Handle,
		&profile.Email,
		&profile.IsInternal,
		&profile.Skills,
		&profile.Status,
		&profile.Phone,
		&profile.Bio,
		&profile.Specialization,
		&profile.ExperienceLevel,
		&socialLinksJSON,
		&photoPath,
	)
	if err != nil {
		return researcherProfile{}, err
	}

	profile.SocialLinks = map[string]string{}
	if strings.TrimSpace(socialLinksJSON) != "" {
		_ = json.Unmarshal([]byte(socialLinksJSON), &profile.SocialLinks)
	}
	profile.SocialLinks = normalizeSocialLinks(profile.SocialLinks)
	profile.PhotoDataURL = photoDataURLFromPath(photoPath)

	if err := a.db.QueryRow(`
SELECT COALESCE(AVG(stars)::float, 0), COUNT(*)
FROM pen_researcher_ratings
WHERE researcher_id = $1
`, researcherID).Scan(&profile.ReputationStats.AverageRating, &profile.ReputationStats.RatingCount); err != nil {
		return researcherProfile{}, err
	}

	if err := a.db.QueryRow(`
SELECT COUNT(*),
       COUNT(*) FILTER (WHERE status IN ('accepted', 'resolved', 'paid')),
       COUNT(*) FILTER (WHERE status IN ('resolved', 'paid')),
       COUNT(*) FILTER (WHERE status = 'paid'),
       COALESCE(SUM(CASE WHEN status = 'paid' THEN bounty ELSE 0 END), 0)::bigint
FROM pen_findings
WHERE submitted_by_researcher_id = $1
`, researcherID).Scan(
		&profile.SubmissionsCount,
		&profile.ReputationStats.AcceptedFindings,
		&profile.ReputationStats.ResolvedFindings,
		&profile.ReputationStats.PaidFindings,
		&profile.ReputationStats.TotalBounty,
	); err != nil {
		return researcherProfile{}, err
	}

	return profile, nil
}

func normalizeSocialLinks(raw map[string]string) map[string]string {
	out := map[string]string{}
	for key, value := range raw {
		normalizedKey := strings.ToLower(strings.TrimSpace(key))
		normalizedValue := strings.TrimSpace(value)
		if normalizedKey == "" || normalizedValue == "" {
			continue
		}

		switch normalizedKey {
		case "twitter":
			normalizedKey = "x"
		case "linkedin", "github", "x", "website", "portfolio", "blog":
		default:
			if len(normalizedKey) > 24 {
				continue
			}
		}

		if strings.HasPrefix(normalizedValue, "@") && normalizedKey == "x" {
			normalizedValue = "https://x.com/" + strings.TrimPrefix(normalizedValue, "@")
		}
		if !strings.Contains(normalizedValue, "://") {
			normalizedValue = "https://" + normalizedValue
		}

		parsed, err := url.ParseRequestURI(normalizedValue)
		if err != nil || parsed.Host == "" {
			continue
		}
		if parsed.Scheme != "http" && parsed.Scheme != "https" {
			continue
		}
		out[normalizedKey] = parsed.String()
		if len(out) >= 8 {
			break
		}
	}
	return out
}

func validateProfileInput(in researcherProfileUpdateInput) (researcherProfileUpdateInput, error) {
	out := researcherProfileUpdateInput{
		Phone:           strings.TrimSpace(in.Phone),
		Bio:             strings.TrimSpace(in.Bio),
		Skills:          strings.TrimSpace(in.Skills),
		Specialization:  strings.TrimSpace(in.Specialization),
		ExperienceLevel: strings.TrimSpace(strings.ToLower(in.ExperienceLevel)),
		SocialLinks:     normalizeSocialLinks(in.SocialLinks),
	}

	if len(out.Phone) > 40 {
		return out, errors.New("phone must be 40 characters or fewer")
	}
	if len(out.Bio) > 1200 {
		return out, errors.New("bio must be 1200 characters or fewer")
	}
	if len(out.Skills) > 400 {
		return out, errors.New("skills must be 400 characters or fewer")
	}
	if len(out.Specialization) > 120 {
		return out, errors.New("specialization must be 120 characters or fewer")
	}
	if len(out.ExperienceLevel) > 40 {
		return out, errors.New("experience level must be 40 characters or fewer")
	}

	switch out.ExperienceLevel {
	case "", "entry", "mid", "senior", "lead", "principal", "expert":
	default:
		return out, errors.New("experience level must be entry, mid, senior, lead, or expert")
	}

	return out, nil
}

func profilePhotoDir() string {
	base := strings.TrimSpace(os.Getenv("PROFILE_UPLOAD_DIR"))
	if base == "" {
		base = filepath.Join("uploads", "researcher-profiles")
	}
	if filepath.IsAbs(base) {
		return base
	}
	wd, err := os.Getwd()
	if err != nil {
		return base
	}
	return filepath.Join(wd, base)
}

func photoDataURLFromPath(path string) string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return ""
	}

	absolutePath := trimmed
	if !filepath.IsAbs(absolutePath) {
		wd, err := os.Getwd()
		if err == nil {
			absolutePath = filepath.Join(wd, filepath.FromSlash(trimmed))
		}
	}

	data, err := os.ReadFile(absolutePath)
	if err != nil || len(data) == 0 {
		return ""
	}

	contentType := strings.ToLower(filepath.Ext(absolutePath))
	switch contentType {
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".webp":
		contentType = "image/webp"
	default:
		contentType = "image/png"
	}

	return "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(data)
}

func saveProfilePhoto(researcherID int64, dataURL string) (string, error) {
	parts := strings.SplitN(strings.TrimSpace(dataURL), ",", 2)
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "data:") || !strings.Contains(parts[0], ";base64") {
		return "", errors.New("photo must be provided as a base64 data URL")
	}

	mediaType := strings.TrimPrefix(parts[0], "data:")
	mediaType = strings.TrimSuffix(mediaType, ";base64")
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))

	extension := ".png"
	switch mediaType {
	case "image/png":
		extension = ".png"
	case "image/jpeg", "image/jpg":
		extension = ".jpg"
	case "image/webp":
		extension = ".webp"
	default:
		return "", errors.New("profile photo must be a PNG, JPEG, or WebP image")
	}

	decoded, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("profile photo could not be decoded")
	}
	if len(decoded) == 0 {
		return "", errors.New("profile photo is empty")
	}
	if len(decoded) > 5*1024*1024 {
		return "", errors.New("profile photo must be 5MB or smaller")
	}

	dir := profilePhotoDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", errors.New("unable to prepare profile photo storage")
	}

	pattern := filepath.Join(dir, "researcher-"+strconv.FormatInt(researcherID, 10)+"-*")
	if matches, err := filepath.Glob(pattern); err == nil {
		for _, match := range matches {
			_ = os.Remove(match)
		}
	}

	filename := "researcher-" + strconv.FormatInt(researcherID, 10) + "-" + strconv.FormatInt(time.Now().Unix(), 10) + extension
	absolutePath := filepath.Join(dir, filename)
	if err := os.WriteFile(absolutePath, decoded, 0o644); err != nil {
		return "", errors.New("unable to save profile photo")
	}

	relativeBase := strings.TrimSpace(os.Getenv("PROFILE_UPLOAD_DIR"))
	if relativeBase == "" {
		relativeBase = filepath.Join("uploads", "researcher-profiles")
	}
	if filepath.IsAbs(relativeBase) {
		return absolutePath, nil
	}
	return filepath.ToSlash(filepath.Join(relativeBase, filename)), nil
}

func (a *app) handleEngagements(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	rows, err := a.db.Query(`
SELECT e.id, e.title, e.target, e.engagement_type, e.engagement_mode, e.tester_pool, e.deadline, e.scope, e.status
FROM pen_engagements e
JOIN pen_applications a ON a.engagement_id = e.id
WHERE a.researcher_id = $1 AND a.status = 'approved' AND e.status IN ('active','in_retest')
ORDER BY e.id DESC
`, claims.ResearcherID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []engagement{}
	for rows.Next() {
		var e engagement
		var d time.Time
		if err := rows.Scan(&e.ID, &e.Title, &e.Target, &e.Type, &e.Mode, &e.TesterPool, &d, &e.Scope, &e.Status); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		e.Deadline = d.Format("2006-01-02")
		out = append(out, e)
	}
	respond(w, http.StatusOK, out)
}

func (a *app) handleApplications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	rows, err := a.db.Query(`
SELECT a.id, a.engagement_id, e.title, a.status, a.assigned_by, a.created_at
FROM pen_applications a
JOIN pen_engagements e ON e.id = a.engagement_id
WHERE a.researcher_id = $1
ORDER BY a.id DESC
`, claims.ResearcherID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []application{}
	for rows.Next() {
		var x application
		var created time.Time
		if err := rows.Scan(&x.ID, &x.EngagementID, &x.EngagementName, &x.Status, &x.AssignedBy, &created); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		x.CreatedAt = created.Format(time.RFC3339)
		out = append(out, x)
	}
	respond(w, http.StatusOK, out)
}

func (a *app) handleInvitations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	rows, err := a.db.Query(`
SELECT i.id, i.engagement_id, e.title, i.status, i.invited_at
FROM pen_invitations i
JOIN pen_engagements e ON e.id=i.engagement_id
WHERE i.researcher_id=$1
ORDER BY i.id DESC
`, claims.ResearcherID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []invitation{}
	for rows.Next() {
		var x invitation
		var invited time.Time
		if err := rows.Scan(&x.ID, &x.EngagementID, &x.EngagementName, &x.Status, &invited); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		x.InvitedAt = invited.Format(time.RFC3339)
		out = append(out, x)
	}
	respond(w, http.StatusOK, out)
}

func (a *app) handleInvitationActions(w http.ResponseWriter, r *http.Request) {
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodPost {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	invitationID, action, err := parseInvitationActionPath(r.URL.Path)
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid invitation path")
		return
	}
	if action != "respond" {
		respondErr(w, http.StatusNotFound, "not found")
		return
	}

	var in struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	in.Status = strings.ToLower(strings.TrimSpace(in.Status))
	if in.Status != "accepted" && in.Status != "declined" {
		respondErr(w, http.StatusBadRequest, "status must be accepted or declined")
		return
	}

	var (
		engagementID    int64
		orgID           int64
		engagementName  string
		orgName         string
		currentStatus   string
		testerPool      string
		researcherName  string
		researcherEmail string
	)
	err = a.db.QueryRow(`
SELECT i.engagement_id, e.organization_id, e.title, COALESCE(o.name,''), i.status, e.tester_pool, r.full_name, r.email
FROM pen_invitations i
JOIN pen_engagements e ON e.id=i.engagement_id
LEFT JOIN pen_organizations o ON o.id=e.organization_id
JOIN pen_researchers r ON r.id=i.researcher_id
WHERE i.id=$1 AND i.researcher_id=$2
`, invitationID, claims.ResearcherID).Scan(
		&engagementID,
		&orgID,
		&engagementName,
		&orgName,
		&currentStatus,
		&testerPool,
		&researcherName,
		&researcherEmail,
	)
	if err == sql.ErrNoRows {
		respondErr(w, http.StatusNotFound, "invitation not found")
		return
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	if currentStatus == in.Status {
		respond(w, http.StatusOK, map[string]string{"message": "invitation already in requested status"})
		return
	}
	if currentStatus != "pending" {
		respondErr(w, http.StatusConflict, "invitation is already finalized")
		return
	}

	testerPool = strings.ToLower(strings.TrimSpace(testerPool))
	if in.Status == "accepted" {
		if testerPool == "internal" && claims.Role != "researcher_internal" {
			respondErr(w, http.StatusBadRequest, "engagement is internal-only")
			return
		}
		if testerPool == "external" && claims.Role != "researcher_external" {
			respondErr(w, http.StatusBadRequest, "engagement is external-only")
			return
		}
	}

	tx, err := a.db.Begin()
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE pen_invitations SET status=$1 WHERE id=$2`, in.Status, invitationID); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	if in.Status == "accepted" {
		if _, err := tx.Exec(`
INSERT INTO pen_applications (engagement_id, researcher_id, status, assigned_by)
VALUES ($1,$2,'approved','invite')
ON CONFLICT (engagement_id, researcher_id) DO UPDATE SET status='approved', assigned_by='invite'
`, engagementID, claims.ResearcherID); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	details, _ := json.Marshal(map[string]any{
		"invitationId":    invitationID,
		"engagementId":    engagementID,
		"engagementName":  engagementName,
		"researcherId":    claims.ResearcherID,
		"researcherName":  researcherName,
		"researcherEmail": researcherEmail,
		"status":          in.Status,
		"source":          "researcher_portal",
	})
	if _, err := tx.Exec(`
INSERT INTO pen_audit_events (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, details_json)
VALUES ($1,$2,$3,'invitation_responded','invitation',$4,$5)
`, orgID, claims.UserID, claims.Role, invitationID, string(details)); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	notifyMsg := researcherName + " (" + researcherEmail + ") " + in.Status + " invitation for \"" + engagementName + "\"."
	if orgName != "" {
		notifyMsg += " Organization: " + orgName + "."
	}
	if _, err := tx.Exec(`
INSERT INTO pen_notifications (user_id, title, message, is_read)
SELECT u.id, 'Invitation response', $1, false
FROM pen_users u
WHERE u.organization_id=$2 AND u.role='organization_admin' AND u.status='active'
`, notifyMsg, orgID); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := tx.Commit(); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "invitation updated"})
}

func (a *app) handleFindings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		a.listFindings(w, r)
	case http.MethodPost:
		a.createFinding(w, r)
	default:
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *app) listFindings(w http.ResponseWriter, r *http.Request) {
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	rows, err := a.db.Query(`
SELECT f.id, f.engagement_id, e.title, f.title, f.severity, f.status, f.poc, f.remediation, f.cvss_score, f.evidence_url, f.asset_path, f.cwe, COALESCE(f.bounty,0), COALESCE(f.review_comment,''), COALESCE(f.payment_reference,''), f.created_at
FROM pen_findings f
JOIN pen_engagements e ON e.id = f.engagement_id
WHERE f.submitted_by_user_id = $1
ORDER BY f.id DESC
`, claims.UserID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []finding{}
	for rows.Next() {
		var x finding
		var created time.Time
		if err := rows.Scan(&x.ID, &x.JobID, &x.JobTitle, &x.Title, &x.Severity, &x.Status, &x.PoC, &x.Remediation, &x.CVSS, &x.EvidenceURL, &x.AssetPath, &x.CWE, &x.Bounty, &x.ReviewComment, &x.PaymentReference, &created); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		x.CreatedAt = created.Format(time.RFC3339)
		out = append(out, x)
	}
	respond(w, http.StatusOK, out)
}

func (a *app) createFinding(w http.ResponseWriter, r *http.Request) {
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	var in struct {
		EngagementID int64   `json:"engagementId"`
		Title        string  `json:"title"`
		Severity     string  `json:"severity"`
		CVSS         float64 `json:"cvss"`
		PoC          string  `json:"poc"`
		Remediation  string  `json:"remediation"`
		EvidenceURL  string  `json:"evidenceUrl"`
		AssetPath    string  `json:"assetPath"`
		CWE          string  `json:"cwe"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.EngagementID <= 0 || strings.TrimSpace(in.Title) == "" || strings.TrimSpace(in.PoC) == "" || strings.TrimSpace(in.Remediation) == "" {
		respondErr(w, http.StatusBadRequest, "engagementId, title, poc, remediation required")
		return
	}
	if in.Severity == "" {
		in.Severity = "medium"
	}
	if in.CVSS < 0 {
		in.CVSS = 0
	}

	var assigned bool
	var lifecycle string
	var triageHours int64
	if err := a.db.QueryRow(`
SELECT EXISTS(
  SELECT 1 FROM pen_applications a
  WHERE a.engagement_id=$1 AND a.researcher_id=$2 AND a.status='approved'
),
(SELECT status FROM pen_engagements WHERE id=$1),
(SELECT triage_sla_hours FROM pen_engagements WHERE id=$1)
`, in.EngagementID, claims.ResearcherID).Scan(&assigned, &lifecycle, &triageHours); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !assigned {
		respondErr(w, http.StatusForbidden, "researcher is not assigned to this engagement")
		return
	}
	if strings.ToLower(lifecycle) != "active" && strings.ToLower(lifecycle) != "in_retest" {
		respondErr(w, http.StatusBadRequest, "engagement lifecycle does not allow finding intake")
		return
	}

	var researcherName string
	if err := a.db.QueryRow(`SELECT full_name FROM pen_researchers WHERE id=$1`, claims.ResearcherID).Scan(&researcherName); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid researcher")
		return
	}
	var id int64
	err := a.db.QueryRow(`
INSERT INTO pen_findings (engagement_id, title, severity, status, poc, remediation, submitted_by, submitted_by_user_id, submitted_by_researcher_id, cvss_score, evidence_url, asset_path, cwe, sla_due_at)
VALUES ($1,$2,$3,'new',$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW() + make_interval(hours => $13))
RETURNING id
`, in.EngagementID, in.Title, strings.ToLower(in.Severity), in.PoC, in.Remediation, researcherName, claims.UserID, claims.ResearcherID, in.CVSS, in.EvidenceURL, in.AssetPath, in.CWE, triageHours).Scan(&id)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusCreated, map[string]any{"id": id})
}

func respond(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func respondErr(w http.ResponseWriter, code int, msg string) {
	respond(w, code, map[string]string{"error": msg})
}

func (a *app) handleNotifications(w http.ResponseWriter, r *http.Request) {
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	rows, err := a.db.Query(`
SELECT id, title, message, is_read, created_at
FROM pen_notifications
WHERE user_id=$1
ORDER BY id DESC
LIMIT 100
`, claims.UserID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []notification{}
	for rows.Next() {
		var item notification
		var created time.Time
		if err := rows.Scan(&item.ID, &item.Title, &item.Message, &item.Read, &created); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		item.CreatedAt = created.Format(time.RFC3339)
		out = append(out, item)
	}
	respond(w, http.StatusOK, out)
}

func (a *app) handleNotificationActions(w http.ResponseWriter, r *http.Request) {
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodPatch {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	s := strings.TrimPrefix(r.URL.Path, "/api/researcher/notifications/")
	parts := strings.Split(strings.Trim(s, "/"), "/")
	if len(parts) != 2 || parts[1] != "read" {
		respondErr(w, http.StatusNotFound, "not found")
		return
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid notification id")
		return
	}
	if _, err := a.db.Exec(`UPDATE pen_notifications SET is_read=true WHERE id=$1 AND user_id=$2`, id, claims.UserID); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "notification marked read"})
}

func (a *app) handleEarnings(w http.ResponseWriter, r *http.Request) {
	claims, ok := a.requireResearcher(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	rows, err := a.db.Query(`
SELECT f.id, f.engagement_id, e.title, f.title, f.severity, f.status, f.poc, f.remediation, f.cvss_score, f.evidence_url, f.asset_path, f.cwe, COALESCE(f.bounty,0), COALESCE(f.review_comment,''), COALESCE(f.payment_reference,''), f.created_at
FROM pen_findings f
JOIN pen_engagements e ON e.id=f.engagement_id
WHERE f.submitted_by_user_id=$1 AND f.status IN ('accepted','resolved','paid')
ORDER BY f.id DESC
`, claims.UserID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	summary := earningsSummary{}
	for rows.Next() {
		var item finding
		var created time.Time
		if err := rows.Scan(&item.ID, &item.JobID, &item.JobTitle, &item.Title, &item.Severity, &item.Status, &item.PoC, &item.Remediation, &item.CVSS, &item.EvidenceURL, &item.AssetPath, &item.CWE, &item.Bounty, &item.ReviewComment, &item.PaymentReference, &created); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		item.CreatedAt = created.Format(time.RFC3339)
		if item.Status == "paid" {
			summary.TotalEarned += item.Bounty
			summary.PaidHistory = append(summary.PaidHistory, item)
		} else {
			summary.PendingPayouts += item.Bounty
			summary.PendingFindings = append(summary.PendingFindings, item)
		}
	}
	respond(w, http.StatusOK, summary)
}

func parseInvitationActionPath(path string) (int64, string, error) {
	trimmed := strings.Trim(strings.TrimPrefix(path, "/api/researcher/invitations/"), "/")
	parts := strings.Split(trimmed, "/")
	if len(parts) != 2 {
		return 0, "", errors.New("invalid path")
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, "", err
	}
	return id, parts[1], nil
}

func (a *app) introspectPlatformSession(r *http.Request) (*platformSessionUser, error) {
	cookieName := env("AUTH_SESSION_COOKIE_NAME", "antcrowd_session")
	cookie, err := r.Cookie(cookieName)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		return nil, errors.New("Sign in through AntCrowd to open this workspace")
	}

	payload, _ := json.Marshal(map[string]string{
		"sessionToken": strings.TrimSpace(cookie.Value),
	})

	req, err := http.NewRequestWithContext(
		r.Context(),
		http.MethodPost,
		env("AUTH_SERVICE_INTROSPECT_URL", "http://auth-service:8080/session/introspect"),
		bytes.NewReader(payload),
	)
	if err != nil {
		return nil, errors.New("Unable to connect this workspace to AntCrowd")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Service-Token", env("AUTH_INTERNAL_SERVICE_TOKEN", "antcrowd-internal-dev-token"))

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.New("Unable to confirm your AntCrowd session right now")
	}
	defer resp.Body.Close()

	var decoded platformIntrospectResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, errors.New("Unable to read your AntCrowd session")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("Your AntCrowd session is no longer valid")
	}

	return &decoded.User, nil
}

func (a *app) syncPlatformResearcher(user *platformSessionUser) (authUser, error) {
	if user == nil || strings.ToLower(strings.TrimSpace(user.AccountType)) != "researcher" {
		return authUser{}, errors.New("This workspace is only available to researchers")
	}
	if !user.EmailVerified {
		return authUser{}, errors.New("Verify your AntCrowd email before opening service workspaces")
	}
	if strings.ToLower(strings.TrimSpace(user.ApprovalStatus)) != "approved" {
		return authUser{}, errors.New("Your researcher account must be approved before using the pentest workspace")
	}

	role := "researcher_external"
	isInternal := false
	orgID := int64(0)
	if strings.ToLower(strings.TrimSpace(user.ResearcherType)) == "internal" {
		role = "researcher_internal"
		isInternal = true
		orgID = 1
	}

	fullName := platformFullName(user)
	if fullName == "" {
		fullName = strings.TrimSpace(user.Email)
	}

	var researcherID int64
	var handle string
	err := a.db.QueryRow(`
SELECT id, handle
FROM pen_researchers
WHERE LOWER(email) = LOWER($1)
ORDER BY id
LIMIT 1
`, strings.ToLower(strings.TrimSpace(user.Email))).Scan(&researcherID, &handle)

	switch {
	case err == sql.ErrNoRows:
		handle, err = a.nextResearcherHandle(platformResearcherHandleBase(user))
		if err != nil {
			return authUser{}, err
		}
		err = a.db.QueryRow(`
INSERT INTO pen_researchers (organization_id, full_name, handle, email, is_internal, skills, status)
VALUES (NULLIF($1, 0), $2, $3, $4, $5, $6, 'active')
RETURNING id
`, orgID, fullName, handle, strings.ToLower(strings.TrimSpace(user.Email)), isInternal, platformResearcherSkills(user)).Scan(&researcherID)
		if err != nil {
			return authUser{}, err
		}
	case err != nil:
		return authUser{}, err
	default:
		if strings.TrimSpace(handle) == "" {
			handle, err = a.nextResearcherHandle(platformResearcherHandleBase(user))
			if err != nil {
				return authUser{}, err
			}
		}
		_, err = a.db.Exec(`
UPDATE pen_researchers
SET organization_id = NULLIF($1, 0),
    full_name = $2,
    handle = $3,
    is_internal = $4,
    status = 'active'
WHERE id = $5
`, orgID, fullName, handle, isInternal, researcherID)
		if err != nil {
			return authUser{}, err
		}
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("platform-sso:"+strings.ToLower(strings.TrimSpace(user.Email))), bcrypt.DefaultCost)
	if err != nil {
		return authUser{}, err
	}

	var localUser authUser
	err = a.db.QueryRow(`
INSERT INTO pen_users (organization_id, researcher_id, full_name, email, password_hash, role, status)
VALUES (NULLIF($1, 0), $2, $3, $4, $5, $6, 'active')
ON CONFLICT (email) DO UPDATE
SET organization_id = EXCLUDED.organization_id,
    researcher_id = EXCLUDED.researcher_id,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    status = 'active'
RETURNING id, email, full_name, role, COALESCE(organization_id, 0), COALESCE(researcher_id, 0)
`, orgID, researcherID, fullName, strings.ToLower(strings.TrimSpace(user.Email)), string(passwordHash), role).Scan(
		&localUser.ID,
		&localUser.Email,
		&localUser.FullName,
		&localUser.Role,
		&localUser.OrgID,
		&localUser.ResearcherID,
	)
	if err != nil {
		return authUser{}, err
	}

	localUser.Role = normalizeRole(localUser.Role)
	return localUser, nil
}

func platformFullName(user *platformSessionUser) string {
	fullName := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if fullName != "" {
		return fullName
	}
	if strings.TrimSpace(user.DisplayName) != "" {
		return strings.TrimSpace(user.DisplayName)
	}
	return ""
}

func platformResearcherSkills(user *platformSessionUser) string {
	if strings.ToLower(strings.TrimSpace(user.ResearcherType)) == "internal" {
		return "Application Security, Internal Validation, Adversary Simulation"
	}
	return "Web Security, API Assessment, Responsible Disclosure"
}

func platformResearcherHandleBase(user *platformSessionUser) string {
	candidate := strings.ToLower(strings.TrimSpace(user.DisplayName))
	if candidate == "" {
		fullName := platformFullName(user)
		candidate = strings.ToLower(strings.ReplaceAll(fullName, " ", "-"))
	}
	if candidate == "" {
		emailParts := strings.Split(strings.ToLower(strings.TrimSpace(user.Email)), "@")
		candidate = emailParts[0]
	}
	candidate = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		if r == '-' || r == '_' || r == '.' {
			return '-'
		}
		return -1
	}, candidate)
	candidate = strings.Trim(candidate, "-")
	if candidate == "" {
		return "researcher"
	}
	return candidate
}

func (a *app) nextResearcherHandle(base string) (string, error) {
	candidate := base
	for i := 1; i <= 200; i++ {
		var exists bool
		if err := a.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM pen_researchers WHERE handle = $1)`, candidate).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
		candidate = base + "-" + strconv.Itoa(i+1)
	}
	return "", errors.New("Unable to allocate a pentest researcher handle")
}

func env(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func validateJWTSecret(appEnv, secret string) error {
	if strings.TrimSpace(secret) == "" {
		return errors.New("JWT_SECRET is required")
	}
	if appEnv == "production" || appEnv == "staging" {
		if secret == "dev-secret" {
			return errors.New("JWT_SECRET cannot use default value in production/staging")
		}
		if len(secret) < 32 {
			return errors.New("JWT_SECRET must be at least 32 characters in production/staging")
		}
	}
	return nil
}

func loadAllowedOrigins() map[string]struct{} {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS"))
	if raw == "" {
		raw = strings.Join([]string{
			"http://localhost:5276",
			"http://localhost:5277",
			"http://localhost:5278",
			"http://localhost:5279",
			"http://localhost:5280",
			"http://localhost:5282",
		}, ",")
	}

	out := make(map[string]struct{})
	for _, item := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(item)
		if origin == "" {
			continue
		}
		out[origin] = struct{}{}
	}
	return out
}

func isAllowedOrigin(origin string, allowed map[string]struct{}) bool {
	_, ok := allowed[origin]
	return ok
}
