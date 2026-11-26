package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"pen-service-backend/handlers"
	"pen-service-backend/middleware"
	"pen-service-backend/models"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type app = models.App

type platformBootstrapOrganization struct {
	Name string `json:"name"`
}

type platformBootstrapUser struct {
	Email          string                         `json:"email"`
	AccountType    string                         `json:"accountType"`
	ResearcherType string                         `json:"researcherType"`
	FirstName      string                         `json:"firstName"`
	LastName       string                         `json:"lastName"`
	DisplayName    string                         `json:"displayName"`
	EmailVerified  bool                           `json:"emailVerified"`
	ApprovalStatus string                         `json:"approvalStatus"`
	Organization   *platformBootstrapOrganization `json:"organization"`
}

type platformBootstrapResponse struct {
	User platformBootstrapUser `json:"user"`
}

var _ = handlers.HandleHealth
var _ = handlers.HandleLeaderboard
var _ = handlers.HandleDashboard
var _ = handlers.HandleMetrics
var _ = handlers.HandleInvitations

func main() {
	dsn := env("DB_DSN", "postgres://antcrowd:antcrowd123@localhost:5432/antcrowd?sslmode=disable")
	port := env("PORT", "8086")
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

	a := &app{DB: db, JWTSecret: []byte(jwtSecret)}
	rl := middleware.NewRateLimiter(100, time.Minute)
	if err := migrate(a); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := seed(a); err != nil {
		log.Fatalf("seed: %v", err)
	}
	if err := syncOrganizationSequence(a); err != nil {
		log.Fatalf("sync organization sequence: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"service": "pen-service-backend",
			"status":  "ok",
			"health":  "/health",
			"ready":   "/ready",
		})
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { handlers.HandleHealth(a, w, r) })
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		if err := db.PingContext(r.Context()); err != nil {
			http.Error(w, "not ready", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) { handlers.HandleLogin(a, w, r) })
	mux.HandleFunc("/api/auth/bootstrap", func(w http.ResponseWriter, r *http.Request) { handlePlatformBootstrap(a, w, r) })
	mux.HandleFunc("/api/auth/me", func(w http.ResponseWriter, r *http.Request) { handlers.HandleMe(a, w, r) })
	mux.HandleFunc("/api/dashboard", func(w http.ResponseWriter, r *http.Request) { handlers.HandleDashboard(a, w, r) })
	mux.HandleFunc("/api/metrics", func(w http.ResponseWriter, r *http.Request) { handlers.HandleMetrics(a, w, r) })
	mux.HandleFunc("/api/engagements", func(w http.ResponseWriter, r *http.Request) { handlers.HandleEngagements(a, w, r) })
	mux.HandleFunc("/api/engagements/", func(w http.ResponseWriter, r *http.Request) { handlers.HandleEngagementActions(a, w, r) })
	mux.HandleFunc("/api/organizations", func(w http.ResponseWriter, r *http.Request) { handlers.HandleOrganizations(a, w, r) })
	mux.HandleFunc("/api/researchers", func(w http.ResponseWriter, r *http.Request) { handlers.HandleResearchers(a, w, r) })
	mux.HandleFunc("/api/researchers/", func(w http.ResponseWriter, r *http.Request) { handlers.HandleResearcherActions(a, w, r) })
	mux.HandleFunc("/api/applications", func(w http.ResponseWriter, r *http.Request) { handlers.HandleApplications(a, w, r) })
	mux.HandleFunc("/api/applications/", func(w http.ResponseWriter, r *http.Request) { handlers.HandleApplicationActions(a, w, r) })
	mux.HandleFunc("/api/admin/internal-requests", func(w http.ResponseWriter, r *http.Request) { handlers.HandleAdminInternalRequests(a, w, r) })
	mux.HandleFunc("/api/admin/internal-requests/", func(w http.ResponseWriter, r *http.Request) { handlers.HandleAdminInternalRequestActions(a, w, r) })
	mux.HandleFunc("/api/admin/payment-requests", func(w http.ResponseWriter, r *http.Request) { handlers.HandleAdminPaymentRequests(a, w, r) })
	mux.HandleFunc("/api/admin/payment-requests/", func(w http.ResponseWriter, r *http.Request) { handlers.HandleAdminAuthorizePayment(a, w, r) })
	mux.HandleFunc("/api/findings", func(w http.ResponseWriter, r *http.Request) { handlers.HandleFindings(a, w, r) })
	mux.HandleFunc("/api/findings/", func(w http.ResponseWriter, r *http.Request) { handlers.HandleFindingActions(a, w, r) })
	mux.HandleFunc("/api/notifications", func(w http.ResponseWriter, r *http.Request) { handlers.HandleNotifications(a, w, r) })
	mux.HandleFunc("/api/notifications/", func(w http.ResponseWriter, r *http.Request) { handlers.HandleNotificationActions(a, w, r) })

	mux.HandleFunc("/api/invitations", func(w http.ResponseWriter, r *http.Request) { handlers.HandleInvitations(a, w, r) })
	mux.HandleFunc("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) { handlers.HandleLeaderboard(a, w, r) })

	log.Printf("pen-service backend listening on :%s", port)
	if err := http.ListenAndServe(":"+port, middleware.RateLimitMiddleware(rl)(middleware.WithCORS(mux))); err != nil {
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

func migrate(a *app) error {
	q := `
CREATE TABLE IF NOT EXISTS pen_organizations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pen_researchers (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT REFERENCES pen_organizations(id),
  full_name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  skills TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pen_users (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT REFERENCES pen_organizations(id),
  researcher_id BIGINT REFERENCES pen_researchers(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pen_engagements (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES pen_organizations(id),
  title TEXT NOT NULL,
  target TEXT NOT NULL,
  engagement_type TEXT NOT NULL,
  engagement_mode TEXT NOT NULL DEFAULT 'on_demand',
  tester_pool TEXT NOT NULL DEFAULT 'external',
  deadline DATE NOT NULL,
  budget BIGINT NOT NULL,
  scope TEXT NOT NULL,
  out_of_scope TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  triage_sla_hours BIGINT NOT NULL DEFAULT 48,
  applicants BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pen_applications (
  id BIGSERIAL PRIMARY KEY,
  engagement_id BIGINT NOT NULL REFERENCES pen_engagements(id) ON DELETE CASCADE,
  researcher_id BIGINT NOT NULL REFERENCES pen_researchers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(engagement_id, researcher_id)
);

CREATE TABLE IF NOT EXISTS pen_internal_assignment_requests (
  id BIGSERIAL PRIMARY KEY,
  engagement_id BIGINT NOT NULL REFERENCES pen_engagements(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_researcher_id BIGINT REFERENCES pen_researchers(id),
  assigned_by TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  UNIQUE(engagement_id)
);

CREATE TABLE IF NOT EXISTS pen_findings (
  id BIGSERIAL PRIMARY KEY,
  engagement_id BIGINT NOT NULL REFERENCES pen_engagements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  poc TEXT NOT NULL,
  remediation TEXT NOT NULL,
  submitted_by TEXT NOT NULL DEFAULT 'Researcher-live',
  submitted_by_user_id BIGINT REFERENCES pen_users(id),
  submitted_by_researcher_id BIGINT REFERENCES pen_researchers(id),
  cvss_score NUMERIC(3,1) NOT NULL DEFAULT 0,
  evidence_url TEXT NOT NULL DEFAULT '',
  asset_path TEXT NOT NULL DEFAULT '',
  cwe TEXT NOT NULL DEFAULT '',
  duplicate_of BIGINT REFERENCES pen_findings(id),
  triaged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pen_audit_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT REFERENCES pen_organizations(id),
  actor_user_id BIGINT REFERENCES pen_users(id),
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pen_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES pen_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pen_engagements ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES pen_organizations(id);
ALTER TABLE pen_engagements ADD COLUMN IF NOT EXISTS engagement_mode TEXT NOT NULL DEFAULT 'on_demand';
ALTER TABLE pen_engagements ADD COLUMN IF NOT EXISTS tester_pool TEXT NOT NULL DEFAULT 'external';
ALTER TABLE pen_engagements ADD COLUMN IF NOT EXISTS triage_sla_hours BIGINT NOT NULL DEFAULT 48;
ALTER TABLE pen_engagements ALTER COLUMN tester_pool SET DEFAULT 'external';
ALTER TABLE pen_engagements ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE pen_researchers ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES pen_organizations(id);
ALTER TABLE pen_applications ADD COLUMN IF NOT EXISTS assigned_by TEXT NOT NULL DEFAULT 'system';
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS cvss_score NUMERIC(3,1) NOT NULL DEFAULT 0;
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS evidence_url TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS asset_path TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS cwe TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS duplicate_of BIGINT REFERENCES pen_findings(id);
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ;
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS submitted_by_user_id BIGINT REFERENCES pen_users(id);
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS submitted_by_researcher_id BIGINT REFERENCES pen_researchers(id);

-- New fields for HackerOne-like features
ALTER TABLE pen_engagements ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS bounty BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS review_comment TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_findings ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS pen_invitations (
  id BIGSERIAL PRIMARY KEY,
  engagement_id BIGINT NOT NULL REFERENCES pen_engagements(id) ON DELETE CASCADE,
  researcher_id BIGINT NOT NULL REFERENCES pen_researchers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(engagement_id, researcher_id)
);

CREATE TABLE IF NOT EXISTS pen_researcher_ratings (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES pen_organizations(id) ON DELETE CASCADE,
  researcher_id BIGINT NOT NULL REFERENCES pen_researchers(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, researcher_id)
);

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

INSERT INTO pen_organizations (id, name)
VALUES (1, 'AntCrowd Demo Org')
ON CONFLICT (id) DO NOTHING;

UPDATE pen_engagements SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE pen_engagements SET tester_pool='external' WHERE tester_pool NOT IN ('internal','external');
UPDATE pen_researchers SET organization_id=1 WHERE is_internal=true AND organization_id IS NULL;
UPDATE pen_researchers SET organization_id=NULL WHERE is_internal=false;
UPDATE pen_engagements
SET status = CASE
  WHEN LOWER(status) IN ('open', 'active') THEN 'active'
  WHEN LOWER(status) IN ('draft', 'in_retest', 'closed') THEN LOWER(status)
  ELSE 'draft'
END;
UPDATE pen_researcher_ratings SET updated_at = COALESCE(updated_at, NOW());
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS specialization TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS experience_level TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS social_links_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT NOT NULL DEFAULT '';
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE pen_researcher_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
`
	_, err := a.DB.Exec(q)
	return err
}

func seed(a *app) error {
	var count int
	if err := a.DB.QueryRow(`SELECT COUNT(*) FROM pen_researchers`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		_, err := a.DB.Exec(`
INSERT INTO pen_researchers (organization_id, full_name, handle, email, is_internal, skills, status) VALUES
(1, 'Internal Researcher One', 'int-researcher-1', 'internal1@antcrowd.local', true, 'Web, API, Auth', 'active'),
(1, 'Internal Researcher Two', 'int-researcher-2', 'internal2@antcrowd.local', true, 'Mobile, API', 'active'),
(NULL, 'External Researcher Alpha', 'ext-alpha', 'alpha@crowd.local', false, 'Cloud, Network', 'active'),
(NULL, 'External Researcher Beta', 'ext-beta', 'beta@crowd.local', false, 'Web, Logic flaws', 'active')
`)
		if err != nil {
			return err
		}
	}

	if err := a.DB.QueryRow(`SELECT COUNT(*) FROM pen_users`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		var int1, int2, ext1 int64
		_ = a.DB.QueryRow(`SELECT id FROM pen_researchers WHERE handle='int-researcher-1'`).Scan(&int1)
		_ = a.DB.QueryRow(`SELECT id FROM pen_researchers WHERE handle='int-researcher-2'`).Scan(&int2)
		_ = a.DB.QueryRow(`SELECT id FROM pen_researchers WHERE handle='ext-alpha'`).Scan(&ext1)

		if err := createSeedUser(a, "Platform Admin", "platform-admin@antcrowd.local", "Antcrowd123!", "platform_admin", 1, 0); err != nil {
			return err
		}
		if err := createSeedUser(a, "Organization Admin", "org-admin@antcrowd.local", "Antcrowd123!", "org_admin", 1, 0); err != nil {
			return err
		}
		if err := createSeedUser(a, "Internal Researcher One", "internal1@antcrowd.local", "Antcrowd123!", "researcher_internal", 1, int1); err != nil {
			return err
		}
		if err := createSeedUser(a, "Internal Researcher Two", "internal2@antcrowd.local", "Antcrowd123!", "researcher_internal", 1, int2); err != nil {
			return err
		}
		if err := createSeedUser(a, "External Researcher Alpha", "alpha@crowd.local", "Antcrowd123!", "researcher_external", 0, ext1); err != nil {
			return err
		}
	}

	if err := a.DB.QueryRow(`SELECT COUNT(*) FROM pen_engagements`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		var extID, intID int64
		_ = a.DB.QueryRow(`SELECT id FROM pen_researchers WHERE is_internal=false ORDER BY id LIMIT 1`).Scan(&extID)
		_ = a.DB.QueryRow(`SELECT id FROM pen_researchers WHERE is_internal=true ORDER BY id LIMIT 1`).Scan(&intID)

		var id1, id2 int64
		err := a.DB.QueryRow(`
INSERT INTO pen_engagements (organization_id, title, target, engagement_type, engagement_mode, tester_pool, deadline, budget, scope, out_of_scope, status, triage_sla_hours, applicants)
VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,0)
RETURNING id
`, "Quarterly API Pen Test", "api.antcrowd.et", "API", "on_demand", "external", "2026-03-28", 1400, "Auth endpoints, payment APIs, partner integrations.", "Production DoS, social engineering.", 48).Scan(&id1)
		if err != nil {
			return err
		}

		err = a.DB.QueryRow(`
INSERT INTO pen_engagements (organization_id, title, target, engagement_type, engagement_mode, tester_pool, deadline, budget, scope, out_of_scope, status, triage_sla_hours, applicants)
VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,0)
RETURNING id
`, "Internal Network Assurance", "Corp network segment A", "Network", "continuous", "internal", "2026-04-05", 2200, "Internal attack paths and lateral movement controls.", "Physical breach scenarios.", 24).Scan(&id2)
		if err != nil {
			return err
		}

		if extID > 0 {
			_, _ = a.DB.Exec(`
INSERT INTO pen_applications (engagement_id, researcher_id, status, assigned_by)
VALUES ($1,$2,'approved','org')
ON CONFLICT (engagement_id, researcher_id) DO UPDATE SET status='approved', assigned_by='org'
`, id1, extID)
		}

		if intID > 0 {
			_, _ = a.DB.Exec(`
INSERT INTO pen_internal_assignment_requests (engagement_id, status, assigned_researcher_id, assigned_by, assigned_at)
VALUES ($1,'assigned',$2,'admin',NOW())
ON CONFLICT (engagement_id) DO NOTHING
`, id2, intID)

			_, _ = a.DB.Exec(`
INSERT INTO pen_applications (engagement_id, researcher_id, status, assigned_by)
VALUES ($1,$2,'approved','admin')
ON CONFLICT (engagement_id, researcher_id) DO UPDATE SET status='approved', assigned_by='admin'
`, id2, intID)
		}

		_, _ = a.DB.Exec(`
INSERT INTO pen_findings (engagement_id, title, severity, status, poc, remediation, submitted_by, cvss_score, evidence_url, asset_path, cwe, sla_due_at)
VALUES
($1,'Broken object-level authorization in transfer history endpoint','high','accepted','Swap accountId in /v2/transfers/history and access another tenant.','Enforce ownership checks server-side and add tenant-aware tests.','External Researcher Alpha',8.1,'https://evidence.local/poc-1','/v2/transfers/history','CWE-639', NOW() + INTERVAL '48 hours'),
($2,'Weak segmentation allows lateral movement via legacy SMB host','critical','in_fix','Compromised workstation reaches sensitive subnet over misconfigured ACL.','Tighten east-west ACLs and isolate legacy hosts.','Internal Researcher One',9.3,'https://evidence.local/poc-2','segment-a/legacy-smb','CWE-284', NOW() + INTERVAL '24 hours')
`, id1, id2)
	}

	return refreshApplicantCounts(a)
}

func createSeedUser(a *app, name, email, password, role string, orgID, researcherID int64) error {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = a.DB.Exec(`
INSERT INTO pen_users (organization_id, researcher_id, full_name, email, password_hash, role, status)
VALUES (NULLIF($1,0), NULLIF($2,0), $3, $4, $5, $6, 'active')
ON CONFLICT (email) DO NOTHING
`, orgID, researcherID, name, email, string(h), role)
	return err
}

func refreshApplicantCounts(a *app) error {
	_, err := a.DB.Exec(`
UPDATE pen_engagements e
SET applicants = COALESCE(x.cnt, 0)
FROM (
  SELECT engagement_id, COUNT(*) AS cnt
  FROM pen_applications
  GROUP BY engagement_id
) x
WHERE x.engagement_id = e.id
`)
	if err != nil {
		return err
	}
	_, err = a.DB.Exec(`UPDATE pen_engagements SET applicants = 0 WHERE id NOT IN (SELECT DISTINCT engagement_id FROM pen_applications)`)
	return err
}

func syncOrganizationSequence(a *app) error {
	_, err := a.DB.Exec(`
SELECT setval(
  pg_get_serial_sequence('pen_organizations', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM pen_organizations), 0), 1),
  true
)
`)
	return err
}

func handleHealth(a *app, w http.ResponseWriter, _ *http.Request) {
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleLogin(a *app, w http.ResponseWriter, r *http.Request) {
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

	var user models.AuthUser
	var passwordHash string
	err := a.DB.QueryRow(`
SELECT id, email, full_name, role, COALESCE(organization_id,0), COALESCE(researcher_id,0), password_hash
FROM pen_users
WHERE email=$1 AND status='active'
`, in.Email).Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &user.OrgID, &user.ResearcherID, &passwordHash)
	if err == sql.ErrNoRows {
		respondErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(in.Password)) != nil {
		respondErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := signToken(a, user)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to sign token")
		return
	}

	respond(w, http.StatusOK, map[string]any{"token": token, "user": user})
}

func handlePlatformBootstrap(a *app, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	platformUser, err := introspectPlatformBootstrap(r)
	if err != nil {
		respondErr(w, http.StatusUnauthorized, err.Error())
		return
	}

	localUser, err := syncPlatformUser(a, platformUser)
	if err != nil {
		respondErr(w, http.StatusForbidden, err.Error())
		return
	}

	token, err := signToken(a, localUser)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to sign token")
		return
	}

	respond(w, http.StatusOK, models.BuildLoginPayload(token, localUser))
}

func syncPlatformUser(a *app, user *platformBootstrapUser) (models.AuthUser, error) {
	if user == nil {
		return models.AuthUser{}, errors.New("Sign in through AntCrowd to open this workspace")
	}

	switch strings.ToLower(strings.TrimSpace(user.AccountType)) {
	case "platform_admin":
		return syncPlatformAdmin(a, user)
	case "organization":
		return syncOrganizationAdmin(a, user)
	case "researcher":
		return syncResearcher(a, user)
	default:
		return models.AuthUser{}, errors.New("This pentest workspace supports platform admin and organization accounts only")
	}
}

func introspectPlatformBootstrap(r *http.Request) (*platformBootstrapUser, error) {
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
		return nil, errors.New("Unable to connect the pentest workspace to AntCrowd")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Service-Token", env("AUTH_INTERNAL_SERVICE_TOKEN", "antcrowd-internal-dev-token"))

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.New("Unable to confirm your AntCrowd session right now")
	}
	defer resp.Body.Close()

	var decoded platformBootstrapResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, errors.New("Unable to read your AntCrowd session")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("Your AntCrowd session is no longer valid")
	}

	return &decoded.User, nil
}

func syncOrganizationAdmin(a *app, user *platformBootstrapUser) (models.AuthUser, error) {
	if user == nil || strings.ToLower(strings.TrimSpace(user.AccountType)) != "organization" {
		return models.AuthUser{}, errors.New("This pentest workspace is only available to organization accounts")
	}
	if !user.EmailVerified {
		return models.AuthUser{}, errors.New("Verify your AntCrowd email before opening service workspaces")
	}
	status := strings.ToLower(strings.TrimSpace(user.ApprovalStatus))
	if status != "approved" && status != "not_required" {
		return models.AuthUser{}, errors.New("Your organization account must be approved before using the pentest workspace")
	}

	fullName := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if fullName == "" {
		fullName = strings.TrimSpace(user.DisplayName)
	}
	if fullName == "" {
		fullName = strings.TrimSpace(user.Email)
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	if email == "" {
		return models.AuthUser{}, errors.New("Your AntCrowd account is missing an email address")
	}

	orgName := "AntCrowd Organization"
	if user.Organization != nil && strings.TrimSpace(user.Organization.Name) != "" {
		orgName = strings.TrimSpace(user.Organization.Name)
	}

	var orgID int64
	err := a.DB.QueryRow(`
SELECT id
FROM pen_organizations
WHERE LOWER(name) = LOWER($1)
LIMIT 1
`, orgName).Scan(&orgID)
	switch {
	case err == sql.ErrNoRows:
		if err := syncOrganizationSequence(a); err != nil {
			return models.AuthUser{}, err
		}
		err = a.DB.QueryRow(`INSERT INTO pen_organizations (name) VALUES ($1) RETURNING id`, orgName).Scan(&orgID)
		if err != nil {
			return models.AuthUser{}, err
		}
	case err != nil:
		return models.AuthUser{}, err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("platform-sso:"+email), bcrypt.DefaultCost)
	if err != nil {
		return models.AuthUser{}, err
	}

	var localUser models.AuthUser
	err = a.DB.QueryRow(`
	INSERT INTO pen_users (organization_id, researcher_id, full_name, email, password_hash, role, status)
	VALUES ($1, NULL, $2, $3, $4, 'organization_admin', 'active')
	ON CONFLICT (email) DO UPDATE
	SET organization_id = EXCLUDED.organization_id,
	    researcher_id = NULL,
	    full_name = EXCLUDED.full_name,
	    password_hash = EXCLUDED.password_hash,
	    role = 'organization_admin',
	    status = 'active'
	RETURNING id, email, full_name, role, COALESCE(organization_id, 0), COALESCE(researcher_id, 0)
	`, orgID, fullName, email, string(passwordHash)).Scan(
		&localUser.ID,
		&localUser.Email,
		&localUser.FullName,
		&localUser.Role,
		&localUser.OrgID,
		&localUser.ResearcherID,
	)
	if err != nil {
		return models.AuthUser{}, err
	}

	localUser.Role = models.NormalizeRole(localUser.Role)
	return localUser, nil
}

func syncPlatformAdmin(a *app, user *platformBootstrapUser) (models.AuthUser, error) {
	if user == nil || strings.ToLower(strings.TrimSpace(user.AccountType)) != "platform_admin" {
		return models.AuthUser{}, errors.New("Platform admin account is required")
	}
	if !user.EmailVerified {
		return models.AuthUser{}, errors.New("Verify your AntCrowd email before opening service workspaces")
	}

	fullName := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if fullName == "" {
		fullName = strings.TrimSpace(user.DisplayName)
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	if email == "" {
		return models.AuthUser{}, errors.New("Your AntCrowd account is missing an email address")
	}
	if fullName == "" {
		fullName = email
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("platform-sso:"+email), bcrypt.DefaultCost)
	if err != nil {
		return models.AuthUser{}, err
	}

	var localUser models.AuthUser
	err = a.DB.QueryRow(`
INSERT INTO pen_users (organization_id, researcher_id, full_name, email, password_hash, role, status)
VALUES (NULL, NULL, $1, $2, $3, 'platform_admin', 'active')
ON CONFLICT (email) DO UPDATE
SET organization_id = NULL,
    researcher_id = NULL,
    full_name = EXCLUDED.full_name,
    role = 'platform_admin',
    status = 'active'
RETURNING id, email, full_name, role, COALESCE(organization_id, 0), COALESCE(researcher_id, 0)
`, fullName, email, string(passwordHash)).Scan(
		&localUser.ID,
		&localUser.Email,
		&localUser.FullName,
		&localUser.Role,
		&localUser.OrgID,
		&localUser.ResearcherID,
	)
	if err != nil {
		return models.AuthUser{}, err
	}

	localUser.Role = models.NormalizeRole(localUser.Role)
	return localUser, nil
}

func signToken(a *app, u models.AuthUser) (string, error) {
	now := time.Now()
	claims := models.AuthClaims{
		UserID:       u.ID,
		Role:         u.Role,
		OrgID:        u.OrgID,
		ResearcherID: u.ResearcherID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(u.ID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(a.JWTSecret)
}

func requireAuth(a *app, w http.ResponseWriter, r *http.Request, allowedRoles ...string) (*models.AuthClaims, bool) {
	authz := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
		respondErr(w, http.StatusUnauthorized, "missing bearer token")
		return nil, false
	}
	tokenStr := strings.TrimSpace(authz[7:])
	parsed, err := jwt.ParseWithClaims(tokenStr, &models.AuthClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return a.JWTSecret, nil
	})
	if err != nil || !parsed.Valid {
		respondErr(w, http.StatusUnauthorized, "invalid token")
		return nil, false
	}
	claims, ok := parsed.Claims.(*models.AuthClaims)
	if !ok {
		respondErr(w, http.StatusUnauthorized, "invalid token claims")
		return nil, false
	}
	if len(allowedRoles) > 0 {
		allowed := false
		for _, role := range allowedRoles {
			if claims.Role == role {
				allowed = true
				break
			}
		}
		if !allowed {
			respondErr(w, http.StatusForbidden, "insufficient role")
			return nil, false
		}
	}
	return claims, true
}

func roleCanAccessOrg(c *models.AuthClaims, orgID int64) bool {
	if c.Role == "platform_admin" {
		return true
	}
	return c.OrgID > 0 && c.OrgID == orgID
}

func allowedEngagementStatus(status string) bool {
	s := strings.ToLower(strings.TrimSpace(status))
	return s == "draft" || s == "active" || s == "in_retest" || s == "closed"
}

func respond(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func respondErr(w http.ResponseWriter, code int, msg string) {
	respond(w, code, map[string]string{"error": msg})
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

func syncResearcher(a *app, user *platformBootstrapUser) (models.AuthUser, error) {
	if user == nil || strings.ToLower(strings.TrimSpace(user.AccountType)) != "researcher" {
		return models.AuthUser{}, errors.New("Researcher account is required")
	}
	if !user.EmailVerified {
		return models.AuthUser{}, errors.New("Verify your AntCrowd email before opening service workspaces")
	}

	fullName := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if fullName == "" {
		fullName = strings.TrimSpace(user.DisplayName)
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	if email == "" {
		return models.AuthUser{}, errors.New("Your AntCrowd account is missing an email address")
	}
	if fullName == "" {
		fullName = email
	}

	isInternal := strings.ToLower(strings.TrimSpace(user.ResearcherType)) == "internal"
	role := "researcher_external"
	var orgID sql.NullInt64
	if isInternal {
		role = "researcher_internal"
		orgID = sql.NullInt64{Int64: 1, Valid: true} // default org
	}

	// Ensure researcher record
	var researcherID int64
	var handle string
	err := a.DB.QueryRow(`
SELECT id, handle FROM pen_researchers WHERE LOWER(email) = LOWER($1) LIMIT 1
`, email).Scan(&researcherID, &handle)

	if err == sql.ErrNoRows {
		handle = strings.Split(email, "@")[0]
		err = a.DB.QueryRow(`
INSERT INTO pen_researchers (organization_id, full_name, handle, email, is_internal, status)
VALUES ($1, $2, $3, $4, $5, 'active')
RETURNING id
`, orgID, fullName, handle, email, isInternal).Scan(&researcherID)
		if err != nil {
			return models.AuthUser{}, err
		}
	} else if err != nil {
		return models.AuthUser{}, err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("platform-sso:"+email), bcrypt.DefaultCost)
	if err != nil {
		return models.AuthUser{}, err
	}

	var localUser models.AuthUser
	err = a.DB.QueryRow(`
INSERT INTO pen_users (organization_id, researcher_id, full_name, email, password_hash, role, status)
VALUES ($1, $2, $3, $4, $5, $6, 'active')
ON CONFLICT (email) DO UPDATE
SET organization_id = EXCLUDED.organization_id,
    researcher_id = EXCLUDED.researcher_id,
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = 'active'
RETURNING id, email, full_name, role, COALESCE(organization_id, 0), COALESCE(researcher_id, 0)
`, orgID, researcherID, fullName, email, string(passwordHash), role).Scan(
		&localUser.ID,
		&localUser.Email,
		&localUser.FullName,
		&localUser.Role,
		&localUser.OrgID,
		&localUser.ResearcherID,
	)
	if err != nil {
		return models.AuthUser{}, err
	}

	localUser.Role = models.NormalizeRole(localUser.Role)
	return localUser, nil
}
