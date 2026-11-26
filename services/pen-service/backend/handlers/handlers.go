package handlers

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"pen-service-backend/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type App = models.App

func respond(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func respondErr(w http.ResponseWriter, code int, msg string) {
	respond(w, code, map[string]string{"error": msg})
}

func parseIDFromPath(path, prefix string) (int64, string, error) {
	s := strings.TrimPrefix(path, prefix)
	parts := strings.Split(strings.Trim(s, "/"), "/")
	if len(parts) != 2 {
		return 0, "", fmt.Errorf("invalid path")
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, "", err
	}
	return id, parts[1], nil
}

func roleCanAccessOrg(claims *models.AuthClaims, orgID int64) bool {
	if models.NormalizeRole(claims.Role) == "platform_admin" {
		return true
	}
	return claims.OrgID > 0 && claims.OrgID == orgID
}

func nullIfZero(v int64) any {
	if v == 0 {
		return nil
	}
	return v
}

func HandleHealth(_ *App, w http.ResponseWriter, _ *http.Request) {
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

func HandleLogin(a *App, w http.ResponseWriter, r *http.Request) {
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
	var hash string
	err := a.DB.QueryRow(`
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
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		respondErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	user.Role = models.NormalizeRole(user.Role)

	token, err := SignToken(a, user)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to sign token")
		return
	}
	respond(w, http.StatusOK, models.BuildLoginPayload(token, user))
}

func SignToken(a *App, u models.AuthUser) (string, error) {
	now := time.Now()
	claims := models.AuthClaims{
		UserID:       u.ID,
		Role:         models.NormalizeRole(u.Role),
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

func RequireAuth(a *App, w http.ResponseWriter, r *http.Request, allowedRoles ...string) (*models.AuthClaims, bool) {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		respondErr(w, http.StatusUnauthorized, "authorization header required")
		return nil, false
	}
	tokenStr := strings.TrimSpace(auth[7:])
	parsed, err := jwt.ParseWithClaims(tokenStr, &models.AuthClaims{}, func(token *jwt.Token) (any, error) {
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
	claims.Role = models.NormalizeRole(claims.Role)
	if len(allowedRoles) > 0 {
		if !models.RoleMatches(claims.Role, allowedRoles...) {
			respondErr(w, http.StatusForbidden, "insufficient role")
			return nil, false
		}
	}
	return claims, true
}

func HandleMe(a *App, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := RequireAuth(a, w, r)
	if !ok {
		return
	}
	var u models.AuthUser
	err := a.DB.QueryRow(`
SELECT id, email, full_name, role, COALESCE(organization_id,0), COALESCE(researcher_id,0)
FROM pen_users WHERE id=$1
`, claims.UserID).Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.OrgID, &u.ResearcherID)
	if err != nil {
		respondErr(w, http.StatusUnauthorized, "user not found")
		return
	}
	respond(w, http.StatusOK, models.BuildAuthUserPayload(u))
}

func HandleDashboard(a *App, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}

	var d models.Dashboard
	if claims.Role == "platform_admin" {
		err := a.DB.QueryRow(`
SELECT
  (SELECT COUNT(*) FROM pen_engagements WHERE status IN ('draft','active','in_retest')),
  (SELECT COUNT(*) FROM pen_findings WHERE severity IN ('high','critical')),
  (SELECT COUNT(*) FROM pen_findings WHERE status='retesting'),
  (SELECT COUNT(*) FROM pen_researchers WHERE is_internal=true AND status='active'),
  (SELECT COUNT(*) FROM pen_researchers WHERE is_internal=false AND status='active')
`).Scan(&d.OpenEngagements, &d.HighCriticalFindings, &d.ReadyForRetest, &d.InternalResearchersActive, &d.ExternalResearchersActive)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		err := a.DB.QueryRow(`
SELECT
  (SELECT COUNT(*) FROM pen_engagements WHERE organization_id=$1 AND status IN ('draft','active','in_retest')),
  (SELECT COUNT(*) FROM pen_findings f JOIN pen_engagements e ON e.id=f.engagement_id WHERE e.organization_id=$1 AND f.severity IN ('high','critical')),
  (SELECT COUNT(*) FROM pen_findings f JOIN pen_engagements e ON e.id=f.engagement_id WHERE e.organization_id=$1 AND f.status='retesting'),
  (SELECT COUNT(*) FROM pen_researchers WHERE is_internal=true AND status='active' AND organization_id=$1),
  (SELECT COUNT(*) FROM pen_researchers WHERE is_internal=false AND status='active')
`, claims.OrgID).Scan(&d.OpenEngagements, &d.HighCriticalFindings, &d.ReadyForRetest, &d.InternalResearchersActive, &d.ExternalResearchersActive)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	respond(w, http.StatusOK, d)
}

func HandleMetrics(a *App, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}

	where := ""
	args := []any{}
	if claims.Role != "platform_admin" {
		where = " WHERE e.organization_id = $1"
		args = append(args, claims.OrgID)
	}

	var m models.Metrics
	m.SeverityMix = map[string]int64{"low": 0, "medium": 0, "high": 0, "critical": 0}
	if err := a.DB.QueryRow(`
SELECT
  COUNT(f.id),
  COUNT(*) FILTER (WHERE (f.triaged_at IS NULL AND f.sla_due_at IS NOT NULL AND NOW() > f.sla_due_at) OR (f.triaged_at IS NOT NULL AND f.sla_due_at IS NOT NULL AND f.triaged_at > f.sla_due_at)),
  COUNT(DISTINCT e.id) FILTER (WHERE e.status IN ('draft','active','in_retest')),
  COUNT(DISTINCT e.id) FILTER (WHERE e.status='closed')
FROM pen_engagements e
LEFT JOIN pen_findings f ON f.engagement_id=e.id`+where, args...).Scan(&m.FindingsTotal, &m.SLABreached, &m.OpenPrograms, &m.ClosedProgram); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := a.DB.QueryRow(`
SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (triaged_at - f.created_at))/3600), 0)
FROM pen_findings f
JOIN pen_engagements e ON e.id=f.engagement_id`+where+` AND triaged_at IS NOT NULL`, args...).Scan(&m.MTTAHours); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := a.DB.QueryRow(`
SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - f.created_at))/3600), 0)
FROM pen_findings f
JOIN pen_engagements e ON e.id=f.engagement_id`+where+` AND resolved_at IS NOT NULL`, args...).Scan(&m.MTTRHours); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	rows, err := a.DB.Query(`
SELECT f.severity, COUNT(*)
FROM pen_findings f
JOIN pen_engagements e ON e.id=f.engagement_id`+where+`
GROUP BY f.severity
`, args...)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	for rows.Next() {
		var sev string
		var c int64
		if err := rows.Scan(&sev, &c); err == nil {
			m.SeverityMix[strings.ToLower(sev)] = c
		}
	}

	respond(w, http.StatusOK, m)
}

func HandleEngagements(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		rows, err := a.DB.Query(`
SELECT id, organization_id, title, target, engagement_type, engagement_mode, tester_pool, deadline, budget, scope, out_of_scope, status, triage_sla_hours, applicants
FROM pen_engagements WHERE organization_id=$1 ORDER BY id DESC
`, claims.OrgID)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()
		out := []models.Engagement{}
		for rows.Next() {
			var e models.Engagement
			var d time.Time
			if err := rows.Scan(&e.ID, &e.OrganizationID, &e.Title, &e.Target, &e.Type, &e.Mode, &e.TesterPool, &d, &e.Budget, &e.Scope, &e.OutOfScope, &e.Status, &e.TriageSLAHours, &e.Applicants); err != nil {
				respondErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			e.Deadline = d.Format("2006-01-02")
			out = append(out, e)
		}
		respond(w, http.StatusOK, out)
	case http.MethodPost:
		var in models.Engagement
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			respondErr(w, http.StatusBadRequest, "invalid json")
			return
		}
		if strings.TrimSpace(in.Title) == "" || strings.TrimSpace(in.Target) == "" || strings.TrimSpace(in.Scope) == "" || strings.TrimSpace(in.Deadline) == "" || in.Budget <= 0 {
			respondErr(w, http.StatusBadRequest, "missing required fields")
			return
		}
		if in.Type == "" {
			in.Type = "Web App"
		}
		if in.Mode == "" {
			in.Mode = "on_demand"
		}
		if in.TesterPool == "" {
			in.TesterPool = "external"
		}
		if in.Status == "" {
			in.Status = "draft"
		}
		if in.TriageSLAHours <= 0 {
			in.TriageSLAHours = 48
		}
		var id int64
		err := a.DB.QueryRow(`
INSERT INTO pen_engagements (organization_id, title, target, engagement_type, engagement_mode, tester_pool, deadline, budget, scope, out_of_scope, status, triage_sla_hours, applicants)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,LOWER($11),$12,0)
RETURNING id
`, claims.OrgID, in.Title, in.Target, in.Type, in.Mode, in.TesterPool, in.Deadline, in.Budget, in.Scope, in.OutOfScope, in.Status, in.TriageSLAHours).Scan(&id)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusCreated, map[string]any{"id": id})
	default:
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func HandleEngagementActions(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}
	engagementID, action, err := parseIDFromPath(r.URL.Path, "/api/engagements/")
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid engagement path")
		return
	}

	var orgID int64
	if err := a.DB.QueryRow(`SELECT organization_id FROM pen_engagements WHERE id=$1`, engagementID).Scan(&orgID); err != nil {
		respondErr(w, http.StatusNotFound, "engagement not found")
		return
	}
	if !roleCanAccessOrg(claims, orgID) {
		respondErr(w, http.StatusForbidden, "forbidden")
		return
	}

	switch action {
	case "status":
		if r.Method != http.MethodPatch {
			respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
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
		if in.Status != "draft" && in.Status != "active" && in.Status != "in_retest" && in.Status != "closed" {
			respondErr(w, http.StatusBadRequest, "invalid status")
			return
		}
		if _, err := a.DB.Exec(`UPDATE pen_engagements SET status=$1 WHERE id=$2`, in.Status, engagementID); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusOK, map[string]string{"message": "engagement updated"})
	case "assign-external":
		if r.Method != http.MethodPost {
			respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var in struct {
			ResearcherID int64 `json:"researcherId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.ResearcherID == 0 {
			respondErr(w, http.StatusBadRequest, "researcherId required")
			return
		}
		_, err := a.DB.Exec(`
INSERT INTO pen_applications (engagement_id, researcher_id, status, assigned_by)
VALUES ($1,$2,'approved','org')
ON CONFLICT (engagement_id, researcher_id) DO UPDATE SET status='approved', assigned_by='org'
`, engagementID, in.ResearcherID)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusOK, map[string]string{"message": "external researcher assigned"})
	case "request-internal":
		if r.Method != http.MethodPost {
			respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		_, err := a.DB.Exec(`
INSERT INTO pen_internal_assignment_requests (engagement_id, status)
VALUES ($1,'pending')
ON CONFLICT (engagement_id) DO UPDATE SET status='pending', assigned_researcher_id=NULL, assigned_by='', assigned_at=NULL
`, engagementID)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusOK, map[string]string{"message": "internal assignment requested"})
	case "report.csv":
		if r.Method != http.MethodGet {
			respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		rows, err := a.DB.Query(`
SELECT f.id, f.title, f.severity, f.status, COALESCE(f.cvss_score,0), COALESCE(f.cwe,''), COALESCE(f.asset_path,''), COALESCE(f.evidence_url,''), f.created_at
FROM pen_findings f
WHERE f.engagement_id=$1
ORDER BY f.id
`, engagementID)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()
		w.Header().Set("Content-Type", "text/csv")
		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"id", "title", "severity", "status", "cvss", "cwe", "asset_path", "evidence_url", "created_at"})
		for rows.Next() {
			var id int64
			var title, sev, status, cwe, asset, evidence string
			var cvss float64
			var created time.Time
			if err := rows.Scan(&id, &title, &sev, &status, &cvss, &cwe, &asset, &evidence, &created); err == nil {
				_ = writer.Write([]string{strconv.FormatInt(id, 10), title, sev, status, fmt.Sprintf("%.1f", cvss), cwe, asset, evidence, created.Format(time.RFC3339)})
			}
		}
		writer.Flush()
	default:
		respondErr(w, http.StatusNotFound, "not found")
	}
}

func HandleResearchers(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		pool := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("pool")))
		q := `
SELECT
  r.id,
  COALESCE(r.organization_id,0),
  r.full_name,
  r.handle,
  r.email,
  r.is_internal,
  r.skills,
  r.status,
  COALESCE(AVG(rr.stars), 0)::float8 AS avg_rating,
  COUNT(rr.id) AS rating_count,
  COALESCE(MAX(CASE WHEN rr.organization_id = $1 THEN rr.stars ELSE 0 END), 0) AS my_rating,
  COALESCE((
    SELECT COUNT(*)
    FROM pen_applications pa
    JOIN pen_engagements e ON e.id = pa.engagement_id
    WHERE pa.researcher_id = r.id
      AND pa.status = 'approved'
      AND e.status = 'closed'
      AND e.organization_id = $1
  ), 0) AS completed_programs
FROM pen_researchers r
LEFT JOIN pen_researcher_ratings rr ON rr.researcher_id = r.id
WHERE r.status='active'
`
		args := []any{claims.OrgID}
		if pool == "internal" {
			q += " AND r.is_internal=true AND r.organization_id=$2"
			args = append(args, claims.OrgID)
		} else if pool == "external" {
			q += " AND r.is_internal=false"
		}
		q += " GROUP BY r.id ORDER BY r.id DESC"

		rows, err := a.DB.Query(q, args...)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()
		out := []models.Researcher{}
		for rows.Next() {
			var x models.Researcher
			if err := rows.Scan(
				&x.ID,
				&x.OrganizationID,
				&x.FullName,
				&x.Handle,
				&x.Email,
				&x.IsInternal,
				&x.Skills,
				&x.Status,
				&x.AvgRating,
				&x.RatingCount,
				&x.MyRating,
				&x.CompletedPrograms,
			); err != nil {
				respondErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			out = append(out, x)
		}
		respond(w, http.StatusOK, out)
	case http.MethodPost:
		var in struct {
			FullName       string `json:"fullName"`
			Handle         string `json:"handle"`
			Email          string `json:"email"`
			Skills         string `json:"skills"`
			Password       string `json:"password"`
			IsInternal     bool   `json:"isInternal"`
			Status         string `json:"status"`
			OrganizationID int64  `json:"organizationId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			respondErr(w, http.StatusBadRequest, "invalid json")
			return
		}
		if strings.TrimSpace(in.FullName) == "" || strings.TrimSpace(in.Handle) == "" || strings.TrimSpace(in.Email) == "" {
			respondErr(w, http.StatusBadRequest, "fullName, handle, and email are required")
			return
		}
		if strings.TrimSpace(in.Password) == "" {
			in.Password = "Researcher123!"
		}
		if strings.TrimSpace(in.Status) == "" {
			in.Status = "active"
		}
		if in.IsInternal && in.OrganizationID == 0 {
			in.OrganizationID = claims.OrgID
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, "failed to hash password")
			return
		}

		tx, err := a.DB.Begin()
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer tx.Rollback()

		var researcherID int64
		err = tx.QueryRow(`
INSERT INTO pen_researchers (organization_id, full_name, handle, email, is_internal, skills, status)
VALUES ($1,$2,$3,$4,$5,$6,$7)
RETURNING id
`, nullIfZero(in.OrganizationID), in.FullName, in.Handle, strings.ToLower(strings.TrimSpace(in.Email)), in.IsInternal, in.Skills, in.Status).Scan(&researcherID)
		if err != nil {
			respondErr(w, http.StatusBadRequest, err.Error())
			return
		}

		role := "researcher_external"
		if in.IsInternal {
			role = "researcher_internal"
		}
		_, err = tx.Exec(`
INSERT INTO pen_users (organization_id, researcher_id, full_name, email, password_hash, role, status)
VALUES ($1,$2,$3,$4,$5,$6,'active')
`, nullIfZero(in.OrganizationID), researcherID, in.FullName, strings.ToLower(strings.TrimSpace(in.Email)), string(hash), role)
		if err != nil {
			respondErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := tx.Commit(); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusCreated, map[string]any{"id": researcherID, "tempPassword": in.Password})
	default:
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func HandleOrganizations(a *App, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}

	q := `SELECT id, name FROM pen_organizations`
	args := []any{}
	if claims.Role == "organization_admin" {
		q += ` WHERE id=$1`
		args = append(args, claims.OrgID)
	}
	q += ` ORDER BY name ASC`

	rows, err := a.DB.Query(q, args...)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, map[string]any{
			"id":   id,
			"name": name,
		})
	}
	respond(w, http.StatusOK, out)
}

func HandleResearcherActions(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r, "org_admin", "platform_admin")
	if !ok {
		return
	}
	s := strings.TrimPrefix(r.URL.Path, "/api/researchers/")
	parts := strings.Split(strings.Trim(s, "/"), "/")
	if len(parts) != 2 || parts[1] != "rating" {
		respondErr(w, http.StatusNotFound, "not found")
		return
	}
	if r.Method != http.MethodPost {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	researcherID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid researcher id")
		return
	}
	var in struct {
		Stars   int64  `json:"stars"`
		Comment string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Stars < 1 || in.Stars > 5 {
		respondErr(w, http.StatusBadRequest, "stars must be between 1 and 5")
		return
	}
	var exists bool
	if err := a.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM pen_researchers WHERE id=$1)`, researcherID).Scan(&exists); err != nil || !exists {
		respondErr(w, http.StatusNotFound, "researcher not found")
		return
	}
	_, err = a.DB.Exec(`
INSERT INTO pen_researcher_ratings (organization_id, researcher_id, stars, comment, updated_at)
VALUES ($1,$2,$3,$4,NOW())
ON CONFLICT (organization_id, researcher_id)
DO UPDATE SET stars=EXCLUDED.stars, comment=EXCLUDED.comment, updated_at=NOW()
`, claims.OrgID, researcherID, in.Stars, strings.TrimSpace(in.Comment))
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "researcher rated"})
}

func HandleApplications(a *App, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}

	where := []string{}
	args := []any{}

	if claims.Role == "organization_admin" {
		where = append(where, fmt.Sprintf("e.organization_id=$%d", len(args)+1))
		args = append(args, claims.OrgID)
	}

	if rawEngagementID := strings.TrimSpace(r.URL.Query().Get("engagementId")); rawEngagementID != "" {
		engagementID, err := strconv.ParseInt(rawEngagementID, 10, 64)
		if err != nil || engagementID <= 0 {
			respondErr(w, http.StatusBadRequest, "invalid engagementId")
			return
		}
		where = append(where, fmt.Sprintf("a.engagement_id=$%d", len(args)+1))
		args = append(args, engagementID)
	}

	if rawStatus := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status"))); rawStatus != "" {
		if rawStatus != "pending" && rawStatus != "approved" && rawStatus != "rejected" {
			respondErr(w, http.StatusBadRequest, "invalid status")
			return
		}
		where = append(where, fmt.Sprintf("a.status=$%d", len(args)+1))
		args = append(args, rawStatus)
	}

	query := `
SELECT a.id, a.engagement_id, e.title, a.researcher_id, r.full_name,
CASE WHEN r.is_internal THEN 'internal' ELSE 'external' END,
a.status, a.assigned_by, a.created_at
FROM pen_applications a
JOIN pen_engagements e ON e.id=a.engagement_id
JOIN pen_researchers r ON r.id=a.researcher_id
`
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	query += " ORDER BY a.id DESC"

	rows, err := a.DB.Query(query, args...)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	out := []models.Application{}
	for rows.Next() {
		var x models.Application
		var created time.Time
		if err := rows.Scan(
			&x.ID,
			&x.EngagementID,
			&x.EngagementName,
			&x.ResearcherID,
			&x.ResearcherName,
			&x.ResearcherType,
			&x.Status,
			&x.AssignedBy,
			&created,
		); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		x.CreatedAt = created.Format(time.RFC3339)
		out = append(out, x)
	}
	respond(w, http.StatusOK, out)
}

func HandleApplicationActions(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}
	applicationID, action, err := parseIDFromPath(r.URL.Path, "/api/applications/")
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid application path")
		return
	}

	if action != "status" {
		respondErr(w, http.StatusNotFound, "not found")
		return
	}
	if r.Method != http.MethodPatch {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
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
	if in.Status != "pending" && in.Status != "approved" && in.Status != "rejected" {
		respondErr(w, http.StatusBadRequest, "invalid status")
		return
	}

	var (
		orgID          int64
		researcherID   int64
		engagementID   int64
		engagementName string
		testerPool     string
		isInternal     bool
	)
	err = a.DB.QueryRow(`
SELECT e.organization_id, a.researcher_id, a.engagement_id, e.title, e.tester_pool, r.is_internal
FROM pen_applications a
JOIN pen_engagements e ON e.id=a.engagement_id
JOIN pen_researchers r ON r.id=a.researcher_id
WHERE a.id=$1
`, applicationID).Scan(&orgID, &researcherID, &engagementID, &engagementName, &testerPool, &isInternal)
	if err == sql.ErrNoRows {
		respondErr(w, http.StatusNotFound, "application not found")
		return
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !roleCanAccessOrg(claims, orgID) {
		respondErr(w, http.StatusForbidden, "forbidden")
		return
	}

	testerPool = strings.ToLower(strings.TrimSpace(testerPool))
	if in.Status == "approved" {
		if testerPool == "internal" && !isInternal {
			respondErr(w, http.StatusBadRequest, "cannot approve external researcher for internal-only engagement")
			return
		}
		if testerPool == "external" && isInternal {
			respondErr(w, http.StatusBadRequest, "cannot approve internal researcher for external-only engagement")
			return
		}
	}

	assignedBy := "org"
	if claims.Role == "platform_admin" {
		assignedBy = "admin"
	}

	tx, err := a.DB.Begin()
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE pen_applications SET status=$1, assigned_by=$2 WHERE id=$3`, in.Status, assignedBy, applicationID); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	details, _ := json.Marshal(map[string]any{
		"applicationId": applicationID,
		"engagementId":  engagementID,
		"researcherId":  researcherID,
		"status":        in.Status,
		"assignedBy":    assignedBy,
	})
	if _, err := tx.Exec(`
INSERT INTO pen_audit_events (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, details_json)
VALUES ($1,$2,$3,'application_status_updated','application',$4,$5)
`, orgID, claims.UserID, claims.Role, applicationID, string(details)); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	notificationTitle := "Application status updated"
	notificationMessage := fmt.Sprintf(
		"Your application for \"%s\" is now %s.",
		engagementName,
		in.Status,
	)
	if _, err := tx.Exec(`
INSERT INTO pen_notifications (user_id, title, message, is_read)
SELECT u.id, $1, $2, false
FROM pen_users u
WHERE u.researcher_id=$3 AND u.status='active'
`, notificationTitle, notificationMessage, researcherID); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := tx.Commit(); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "application status updated"})
}

func HandleAdminInternalRequests(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r, "platform_admin", "org_admin")
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	q := `
SELECT req.id, req.engagement_id, e.title, req.status, COALESCE(r.full_name,''), req.requested_at
FROM pen_internal_assignment_requests req
JOIN pen_engagements e ON e.id=req.engagement_id
LEFT JOIN pen_researchers r ON r.id=req.assigned_researcher_id`
	args := []any{}
	if claims.Role != "platform_admin" {
		q += " WHERE e.organization_id=$1"
		args = append(args, claims.OrgID)
	}
	q += " ORDER BY req.id DESC"

	rows, err := a.DB.Query(q, args...)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	out := []models.InternalRequest{}
	for rows.Next() {
		var x models.InternalRequest
		var requested time.Time
		if err := rows.Scan(&x.ID, &x.EngagementID, &x.EngagementName, &x.Status, &x.AssignedResearcher, &requested); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		x.RequestedAt = requested.Format(time.RFC3339)
		out = append(out, x)
	}
	respond(w, http.StatusOK, out)
}

func HandleAdminInternalRequestActions(a *App, w http.ResponseWriter, r *http.Request) {
	_, ok := RequireAuth(a, w, r, "platform_admin")
	if !ok {
		return
	}
	if r.Method != http.MethodPost {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	s := strings.TrimPrefix(r.URL.Path, "/api/admin/internal-requests/")
	parts := strings.Split(strings.Trim(s, "/"), "/")
	if len(parts) != 2 || parts[1] != "assign" {
		respondErr(w, http.StatusNotFound, "not found")
		return
	}
	reqID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid request id")
		return
	}
	var in struct {
		ResearcherID int64 `json:"researcherId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.ResearcherID == 0 {
		respondErr(w, http.StatusBadRequest, "researcherId required")
		return
	}
	var engagementID int64
	if err := a.DB.QueryRow(`SELECT engagement_id FROM pen_internal_assignment_requests WHERE id=$1`, reqID).Scan(&engagementID); err != nil {
		respondErr(w, http.StatusNotFound, "request not found")
		return
	}
	tx, err := a.DB.Begin()
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	_, err = tx.Exec(`
UPDATE pen_internal_assignment_requests
SET status='assigned', assigned_researcher_id=$1, assigned_by='admin', assigned_at=NOW()
WHERE id=$2
`, in.ResearcherID, reqID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	_, err = tx.Exec(`
INSERT INTO pen_applications (engagement_id, researcher_id, status, assigned_by)
VALUES ($1,$2,'approved','admin')
ON CONFLICT (engagement_id, researcher_id) DO UPDATE SET status='approved', assigned_by='admin'
`, engagementID, in.ResearcherID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := tx.Commit(); err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "internal researcher assigned"})
}

func HandleFindings(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r)
	if !ok {
		return
	}

	switch r.Method {
	case http.MethodGet:
		where := ""
		args := []any{}
		if claims.Role != "platform_admin" {
			where = " WHERE e.organization_id=$1"
			args = append(args, claims.OrgID)
		}
		rows, err := a.DB.Query(`
SELECT f.id, f.engagement_id, e.title, f.title, f.severity, f.status, f.poc, f.remediation, COALESCE(f.submitted_by,''), COALESCE(f.cvss_score,0), COALESCE(f.evidence_url,''), COALESCE(f.asset_path,''), COALESCE(f.cwe,''), COALESCE(f.duplicate_of,0), f.sla_due_at,
COALESCE(f.bounty,0), COALESCE(f.review_comment,''), COALESCE(f.payment_reference,''), f.created_at,
((f.triaged_at IS NULL AND f.sla_due_at IS NOT NULL AND NOW() > f.sla_due_at) OR (f.triaged_at IS NOT NULL AND f.sla_due_at IS NOT NULL AND f.triaged_at > f.sla_due_at))
FROM pen_findings f
JOIN pen_engagements e ON e.id=f.engagement_id`+where+`
ORDER BY f.id DESC
`, args...)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()
		out := []models.Finding{}
		for rows.Next() {
			var x models.Finding
			var due sql.NullTime
			var created time.Time
			if err := rows.Scan(&x.ID, &x.JobID, &x.JobTitle, &x.Title, &x.Severity, &x.Status, &x.PoC, &x.Remediation, &x.SubmittedBy, &x.CVSS, &x.EvidenceURL, &x.AssetPath, &x.CWE, &x.DuplicateOf, &due, &x.Bounty, &x.ReviewComment, &x.PaymentReference, &created, &x.SlaBreached); err != nil {
				respondErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			if due.Valid {
				x.SlaDueAt = due.Time.Format(time.RFC3339)
			}
			x.CreatedAt = created.Format(time.RFC3339)
			out = append(out, x)
		}
		respond(w, http.StatusOK, out)
	case http.MethodPost:
		var in models.Finding
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			respondErr(w, http.StatusBadRequest, "invalid json")
			return
		}
		if in.JobID == 0 || strings.TrimSpace(in.Title) == "" || strings.TrimSpace(in.PoC) == "" || strings.TrimSpace(in.Remediation) == "" {
			respondErr(w, http.StatusBadRequest, "missing required fields")
			return
		}
		if in.Severity == "" {
			in.Severity = "medium"
		}
		var duplicateHints int64
		_ = a.DB.QueryRow(`SELECT COUNT(*) FROM pen_findings WHERE engagement_id=$1 AND LOWER(title) LIKE LOWER($2)`, in.JobID, "%"+in.Title+"%").Scan(&duplicateHints)
		in.DuplicateHints = duplicateHints
		_, err := a.DB.Exec(`
INSERT INTO pen_findings (engagement_id, title, severity, status, poc, remediation, submitted_by, submitted_by_user_id, submitted_by_researcher_id, cvss_score, evidence_url, asset_path, cwe, sla_due_at)
VALUES ($1,$2,$3,'new',$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW() + INTERVAL '48 hour')
`, in.JobID, in.Title, in.Severity, in.PoC, in.Remediation, "Researcher-live", claims.UserID, claims.ResearcherID, in.CVSS, in.EvidenceURL, in.AssetPath, in.CWE)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusCreated, map[string]any{"message": "finding created", "duplicateHints": in.DuplicateHints})
	default:
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func HandleFindingActions(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r)
	if !ok {
		return
	}
	s := strings.TrimPrefix(r.URL.Path, "/api/findings/")
	parts := strings.Split(strings.Trim(s, "/"), "/")
	if len(parts) == 1 && parts[0] == "duplicate-hints" {
		if r.Method != http.MethodGet {
			respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		engagementID, _ := strconv.ParseInt(r.URL.Query().Get("engagementId"), 10, 64)
		title := strings.TrimSpace(r.URL.Query().Get("title"))
		rows, err := a.DB.Query(`
SELECT id, title, severity FROM pen_findings
WHERE engagement_id=$1 AND LOWER(title) LIKE LOWER($2)
ORDER BY id DESC LIMIT 5
`, engagementID, "%"+title+"%")
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()
		type hint struct {
			ID       int64  `json:"id"`
			Title    string `json:"title"`
			Severity string `json:"severity"`
		}
		out := []hint{}
		for rows.Next() {
			var h hint
			if err := rows.Scan(&h.ID, &h.Title, &h.Severity); err == nil {
				out = append(out, h)
			}
		}
		respond(w, http.StatusOK, out)
		return
	}

	if len(parts) != 2 || parts[1] != "status" {
		respondErr(w, http.StatusNotFound, "not found")
		return
	}
	if r.Method != http.MethodPatch {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid finding id")
		return
	}
	var in struct {
		Status           string `json:"status"`
		DuplicateOf      int64  `json:"duplicateOf"`
		Bounty           int64  `json:"bounty"`
		ReviewComment    string `json:"reviewComment"`
		PaymentReference string `json:"paymentReference"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if claims.Role == "researcher_external" || claims.Role == "researcher_internal" {
		respondErr(w, http.StatusForbidden, "researchers cannot change finding status")
		return
	}
	_, err = a.DB.Exec(`
UPDATE pen_findings
SET status=LOWER($1), duplicate_of=CASE WHEN LOWER($1)='duplicate' THEN NULLIF($2,0) ELSE duplicate_of END,
    bounty=CASE WHEN $4 >= 0 THEN $4 ELSE bounty END,
    review_comment=COALESCE(NULLIF($5,''), review_comment),
    payment_reference=CASE WHEN LOWER($1)='paid' THEN COALESCE(NULLIF($6,''), payment_reference) ELSE payment_reference END,
    triaged_at=CASE WHEN LOWER($1) IN ('triaged','accepted','in_fix','retesting','resolved','duplicate','informative') THEN NOW() ELSE triaged_at END,
    resolved_at=CASE WHEN LOWER($1)='resolved' THEN NOW() ELSE resolved_at END,
    updated_at=NOW()
WHERE id=$3
`, in.Status, in.DuplicateOf, id, in.Bounty, strings.TrimSpace(in.ReviewComment), strings.TrimSpace(in.PaymentReference))
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "finding updated"})
}

func HandleNotifications(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	rows, err := a.DB.Query(`
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
	out := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		var created time.Time
		if err := rows.Scan(&n.ID, &n.Title, &n.Message, &n.Read, &created); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		n.CreatedAt = created.Format(time.RFC3339)
		out = append(out, n)
	}
	respond(w, http.StatusOK, out)
}

func HandleNotificationActions(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r)
	if !ok {
		return
	}
	s := strings.TrimPrefix(r.URL.Path, "/api/notifications/")
	parts := strings.Split(strings.Trim(s, "/"), "/")
	if len(parts) != 2 || parts[1] != "read" {
		respondErr(w, http.StatusNotFound, "not found")
		return
	}
	if r.Method != http.MethodPatch {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid notification id")
		return
	}
	_, err = a.DB.Exec(`UPDATE pen_notifications SET is_read=true WHERE id=$1 AND user_id=$2`, id, claims.UserID)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "notification marked read"})
}

func HandleInvitations(a *App, w http.ResponseWriter, r *http.Request) {
	claims, ok := RequireAuth(a, w, r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		var rows *sql.Rows
		var err error
		if claims.Role == "researcher_internal" || claims.Role == "researcher_external" {
			rows, err = a.DB.Query(`SELECT id, engagement_id, researcher_id, status, invited_at FROM pen_invitations WHERE researcher_id=$1`, claims.ResearcherID)
		} else {
			rows, err = a.DB.Query(`SELECT i.id, i.engagement_id, i.researcher_id, i.status, i.invited_at FROM pen_invitations i JOIN pen_engagements e ON i.engagement_id=e.id WHERE e.organization_id=$1`, claims.OrgID)
		}
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()
		invitations := []models.Invitation{}
		for rows.Next() {
			var inv models.Invitation
			if err := rows.Scan(&inv.ID, &inv.EngagementID, &inv.ResearcherID, &inv.Status, &inv.InvitedAt); err == nil {
				invitations = append(invitations, inv)
			}
		}
		respond(w, http.StatusOK, invitations)
		return
	}
	if r.Method == http.MethodPost {
		if claims.Role != "organization_admin" && claims.Role != "platform_admin" {
			respondErr(w, http.StatusForbidden, "only org admins can send invitations")
			return
		}
		var in struct {
			EngagementID int64 `json:"engagementId"`
			ResearcherID int64 `json:"researcherId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			respondErr(w, http.StatusBadRequest, "invalid json")
			return
		}
		_, err := a.DB.Exec(`
INSERT INTO pen_invitations (engagement_id, researcher_id)
VALUES ($1, $2)
ON CONFLICT (engagement_id, researcher_id) DO UPDATE SET status='pending', invited_at=NOW()
`, in.EngagementID, in.ResearcherID)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		respond(w, http.StatusCreated, map[string]string{"status": "invited"})
		return
	}
	respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
}

func HandleLeaderboard(a *App, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	rows, err := a.DB.Query(`
SELECT r.id, r.full_name, COALESCE(SUM(f.bounty), 0) as points
FROM pen_researchers r
LEFT JOIN pen_findings f ON f.submitted_by_researcher_id = r.id AND f.status IN ('accepted', 'resolved')
WHERE r.status = 'active'
GROUP BY r.id, r.full_name
ORDER BY points DESC
LIMIT 10
`)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	leaderboard := []models.LeaderboardEntry{}
	for rows.Next() {
		var x models.LeaderboardEntry
		if err := rows.Scan(&x.ResearcherID, &x.ResearcherName, &x.Points); err == nil {
			leaderboard = append(leaderboard, x)
		}
	}
	respond(w, http.StatusOK, leaderboard)
}

// HandleAdminPaymentRequests — GET /api/admin/payment-requests
// Returns ALL pen-test findings so the platform admin has full visibility.
// This includes newly submitted reports (status='new') through to paid findings.
func HandleAdminPaymentRequests(a *App, w http.ResponseWriter, r *http.Request) {
	_, ok := RequireAuth(a, w, r, "platform_admin")
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	type PaymentRequest struct {
		ID               int64  `json:"id"`
		EngagementTitle  string `json:"engagementTitle"`
		Title            string `json:"title"`
		SubmittedBy      string `json:"submittedBy"`
		Bounty           int64  `json:"bounty"`
		Status           string `json:"status"`
		Severity         string `json:"severity"`
		PaymentReference string `json:"paymentReference"`
		CreatedAt        string `json:"createdAt"`
	}

	rows, err := a.DB.Query(`
SELECT f.id,
       COALESCE(e.title, ''),
       f.title,
       COALESCE(f.submitted_by, ''),
       COALESCE(f.bounty, 0),
       f.status,
       f.severity,
       COALESCE(f.payment_reference, ''),
       f.created_at
FROM   pen_findings f
LEFT JOIN pen_engagements e ON e.id = f.engagement_id
WHERE  f.status NOT IN ('duplicate', 'informative')
ORDER BY f.created_at DESC
`)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	out := []PaymentRequest{}
	for rows.Next() {
		var p PaymentRequest
		var created time.Time
		if err := rows.Scan(&p.ID, &p.EngagementTitle, &p.Title, &p.SubmittedBy, &p.Bounty, &p.Status, &p.Severity, &p.PaymentReference, &created); err != nil {
			respondErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		p.CreatedAt = created.Format(time.RFC3339)
		out = append(out, p)
	}
	respond(w, http.StatusOK, map[string]any{"items": out})
}

// HandleAdminAuthorizePayment — POST /api/admin/payment-requests/:id/authorize
// Marks a pen-test finding as paid. Accepts an optional bounty amount (to set/override)
// and optional payment reference. Works on findings in any reviewable status.
func HandleAdminAuthorizePayment(a *App, w http.ResponseWriter, r *http.Request) {
	_, ok := RequireAuth(a, w, r, "platform_admin")
	if !ok {
		return
	}
	if r.Method != http.MethodPost {
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	s := strings.TrimPrefix(r.URL.Path, "/api/admin/payment-requests/")
	parts := strings.Split(strings.Trim(s, "/"), "/")
	if len(parts) != 2 || parts[1] != "authorize" {
		respondErr(w, http.StatusNotFound, "not found")
		return
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondErr(w, http.StatusBadRequest, "invalid finding id")
		return
	}

	var body struct {
		PaymentReference string `json:"paymentReference"`
		Bounty           *int64 `json:"bounty"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	// If a bounty is explicitly provided by the admin, update it too.
	// This allows the admin to set the prize amount and authorize payment in one step.
	var execErr error
	if body.Bounty != nil && *body.Bounty >= 0 {
		_, execErr = a.DB.Exec(`
UPDATE pen_findings
SET    status            = 'paid',
       bounty            = $2,
       payment_reference = COALESCE(NULLIF($3, ''), payment_reference),
       updated_at        = NOW()
WHERE  id = $1
  AND  status NOT IN ('paid', 'duplicate', 'informative')
`, id, *body.Bounty, strings.TrimSpace(body.PaymentReference))
	} else {
		_, execErr = a.DB.Exec(`
UPDATE pen_findings
SET    status            = 'paid',
       payment_reference = COALESCE(NULLIF($2, ''), payment_reference),
       updated_at        = NOW()
WHERE  id = $1
  AND  status NOT IN ('paid', 'duplicate', 'informative')
`, id, strings.TrimSpace(body.PaymentReference))
	}
	if execErr != nil {
		respondErr(w, http.StatusInternalServerError, execErr.Error())
		return
	}

	// Notify the researcher that payment was authorized (best-effort, non-fatal).
	_, _ = a.DB.Exec(`
INSERT INTO pen_notifications (user_id, title, message, is_read)
SELECT u.id,
       'Payment Authorized',
       'The platform admin has authorized payment for your finding: ' || f.title ||
       '. Prize: ' || COALESCE(f.bounty, 0)::text || ' ETB.',
       false
FROM pen_findings f
JOIN pen_users u ON u.id = f.submitted_by_user_id
WHERE f.id = $1
`, id)

	respond(w, http.StatusOK, map[string]string{"message": "payment authorized"})
}

