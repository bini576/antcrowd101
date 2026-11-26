package handlers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"html"
	"io"
	"log"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"vdp-service/config"
	"vdp-service/middleware"
	"vdp-service/notifications"
	"vdp-service/security"
	"vdp-service/storage"
)

type Handler struct {
	DB     *pgxpool.Pool
	Store  *storage.MinIO
	Config config.Config
	Mailer *notifications.Mailer
	AV     *security.ClamAV
}

type orgProfilePayload struct {
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	ContactEmail string `json:"contact_email"`
	ContactName  string `json:"contact_name"`
	Website      string `json:"website"`
	Description  string `json:"description"`
}

type procedurePayload struct {
	Overview              string `json:"overview"`
	Scope                 string `json:"scope"`
	OutOfScope            string `json:"out_of_scope"`
	ReportingRequirements string `json:"reporting_requirements"`
	SeverityRules         string `json:"severity_rules"`
	ResponseTimeline      string `json:"response_timeline"`
	LegalSafeHarbor       string `json:"legal_safe_harbor"`
	ProhibitedActions     string `json:"prohibited_actions"`
	Status                string `json:"status"`
}

type programPayload struct {
	ProcedureID  string `json:"procedure_id"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	ContactEmail string `json:"contact_email"`
	Visibility   string `json:"visibility"`
	Status       string `json:"status"`
}

type programCreationPayload struct {
	Title                 string
	Description           string
	Scope                 string
	OutOfScope            string
	ContactEmail          string
	Overview              string
	ReportingRequirements string
	SeverityRules         string
	ResponseTimeline      string
	LegalSafeHarbor       string
	ProhibitedActions     string
	Visibility            string
	Status                string
	Publish               bool
}

type orgSettingsPayload struct {
	TriageSLAHours            int    `json:"triage_sla_hours"`
	ResolutionSLALowDays      int    `json:"resolution_sla_low_days"`
	ResolutionSLAMediumDays   int    `json:"resolution_sla_medium_days"`
	ResolutionSLAHighDays     int    `json:"resolution_sla_high_days"`
	ResolutionSLACriticalDays int    `json:"resolution_sla_critical_days"`
	WebhookEnabled            bool   `json:"webhook_enabled"`
	WebhookURL                string `json:"webhook_url"`
	WebhookSecret             string `json:"webhook_secret"`
}

type reportPayload struct {
	ProgramID         string `json:"program_id"`
	Title             string `json:"title"`
	AffectedAsset     string `json:"affected_asset"`
	VulnerabilityType string `json:"vulnerability_type"`
	Description       string `json:"description"`
	StepsToReproduce  string `json:"steps_to_reproduce"`
	Impact            string `json:"impact"`
	Severity          string `json:"severity"`
	POC               string `json:"poc"`
	AttackVector      string `json:"attack_vector"`
	CWE               string `json:"cwe"`
	ReferenceLinks    string `json:"reference_links"`
}

type publicReportPayload struct {
	ProgramID         string `json:"program_id"`
	ReporterEmail     string `json:"reporter_email"`
	ReporterName      string `json:"reporter_name"`
	Title             string `json:"title"`
	AffectedAsset     string `json:"affected_asset"`
	VulnerabilityType string `json:"vulnerability_type"`
	Description       string `json:"description"`
	StepsToReproduce  string `json:"steps_to_reproduce"`
	Impact            string `json:"impact"`
	Severity          string `json:"severity"`
	POC               string `json:"poc"`
	AttackVector      string `json:"attack_vector"`
	CWE               string `json:"cwe"`
	ReferenceLinks    string `json:"reference_links"`
	AcceptedPolicy    bool   `json:"accepted_policy"`
}

const maxUploadBytes = 25 << 20

const legacyEndpointSunset = "Wed, 31 Dec 2026 23:59:59 GMT"

const defaultNeedsInfoDays = 14
const defaultIdempotencyTTL = 24 * time.Hour
const outboxBatchSize = 25
const maintenanceBatchSize = 500

var validReportStatuses = map[string]struct{}{
	"new":            {},
	"triaged":        {},
	"needs_info":     {},
	"accepted":       {},
	"retesting":      {},
	"resolved":       {},
	"duplicate":      {},
	"informative":    {},
	"not_applicable": {},
	"rejected":       {},
}

var reportStatusTransitions = map[string]map[string]struct{}{
	"new": {
		"triaged":        {},
		"needs_info":     {},
		"accepted":       {},
		"duplicate":      {},
		"informative":    {},
		"not_applicable": {},
		"rejected":       {},
		"resolved":       {},
	},
	"triaged": {
		"accepted":       {},
		"needs_info":     {},
		"duplicate":      {},
		"informative":    {},
		"not_applicable": {},
		"rejected":       {},
		"resolved":       {},
	},
	"needs_info": {
		"triaged":        {},
		"accepted":       {},
		"duplicate":      {},
		"informative":    {},
		"not_applicable": {},
		"rejected":       {},
		"resolved":       {},
	},
	"accepted": {
		"needs_info":     {},
		"retesting":      {},
		"resolved":       {},
		"informative":    {},
		"not_applicable": {},
	},
	"retesting": {
		"accepted":       {},
		"needs_info":     {},
		"resolved":       {},
		"informative":    {},
		"not_applicable": {},
	},
	"resolved": {
		"retesting":  {},
		"triaged":    {},
		"accepted":   {},
		"needs_info": {},
	},
	"duplicate": {
		"triaged": {},
	},
	"informative": {
		"triaged": {},
	},
	"not_applicable": {
		"triaged": {},
	},
	"rejected": {
		"triaged": {},
	},
}

func (h *Handler) ListOrganizations(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	query := `
		SELECT DISTINCT o.id, o.name, o.slug, COALESCE(o.description,''), COALESCE(o.website,''), o.created_at
		FROM organizations o
		JOIN vdp_programs p ON p.org_id = o.id AND p.visibility='public' AND p.status='active'
		JOIN disclosure_procedures d ON d.id = p.procedure_id AND d.status='active'
	`
	args := []any{}
	if q != "" {
		query += " WHERE o.name ILIKE '%' || $1 || '%' OR o.slug ILIKE '%' || $1 || '%'"
		args = append(args, q)
	}
	query += " ORDER BY o.name ASC"

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type org struct {
		ID          string    `json:"id"`
		Name        string    `json:"name"`
		Slug        string    `json:"slug"`
		Description string    `json:"description"`
		Website     string    `json:"website"`
		CreatedAt   time.Time `json:"created_at"`
	}
	res := []org{}
	for rows.Next() {
		var o org
		if err := rows.Scan(&o.ID, &o.Name, &o.Slug, &o.Description, &o.Website, &o.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, o)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) GetOrganizationPublic(c *gin.Context) {
	orgID := c.Param("id")
	if orgID == "" || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT o.id, o.name, o.slug, COALESCE(o.description,''), COALESCE(o.website,''), o.created_at
		FROM organizations o
		JOIN vdp_programs p ON p.org_id = o.id AND p.visibility='public' AND p.status='active'
		JOIN disclosure_procedures d ON d.id = p.procedure_id AND d.status='active'
		WHERE o.id=$1
		LIMIT 1`, orgID)
	var resp struct {
		ID          string    `json:"id"`
		Name        string    `json:"name"`
		Slug        string    `json:"slug"`
		Description string    `json:"description"`
		Website     string    `json:"website"`
		CreatedAt   time.Time `json:"created_at"`
	}
	if err := row.Scan(&resp.ID, &resp.Name, &resp.Slug, &resp.Description, &resp.Website, &resp.CreatedAt); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetOrgProfile(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT id, name, slug, contact_email, contact_name, website, description, updated_at
		FROM organizations WHERE id=$1`, orgID)
	var resp struct {
		ID           string    `json:"id"`
		Name         string    `json:"name"`
		Slug         string    `json:"slug"`
		ContactEmail string    `json:"contact_email"`
		ContactName  string    `json:"contact_name"`
		Website      string    `json:"website"`
		Description  string    `json:"description"`
		UpdatedAt    time.Time `json:"updated_at"`
	}
	if err := row.Scan(&resp.ID, &resp.Name, &resp.Slug, &resp.ContactEmail, &resp.ContactName, &resp.Website, &resp.Description, &resp.UpdatedAt); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) UpdateOrgProfile(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	var p orgProfilePayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	p.Name = sanitizeText(p.Name)
	p.Slug = normalizeSlug(p.Slug)
	p.ContactEmail = strings.TrimSpace(p.ContactEmail)
	p.ContactName = sanitizeText(p.ContactName)
	p.Website = strings.TrimSpace(p.Website)
	p.Description = sanitizeText(p.Description)
	if p.Name == "" || !validateSlug(p.Slug) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid name or slug"})
		return
	}
	if p.ContactEmail != "" && !validateEmail(p.ContactEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contact email"})
		return
	}

	_, err = h.DB.Exec(c.Request.Context(), `
		INSERT INTO organizations (id, name, slug, contact_email, contact_name, website, description, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
		ON CONFLICT (id) DO UPDATE SET
			name=EXCLUDED.name,
			slug=EXCLUDED.slug,
			contact_email=EXCLUDED.contact_email,
			contact_name=EXCLUDED.contact_name,
			website=EXCLUDED.website,
			description=EXCLUDED.description,
			updated_at=NOW()`, orgID, p.Name, p.Slug, p.ContactEmail, p.ContactName, p.Website, p.Description)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.Status(http.StatusNoContent)
}

func defaultOrgSettings() orgSettingsPayload {
	return orgSettingsPayload{
		TriageSLAHours:            72,
		ResolutionSLALowDays:      60,
		ResolutionSLAMediumDays:   30,
		ResolutionSLAHighDays:     14,
		ResolutionSLACriticalDays: 7,
		WebhookEnabled:            false,
		WebhookURL:                "",
		WebhookSecret:             "",
	}
}

func validateOrgSettingsPayload(p orgSettingsPayload) error {
	if p.TriageSLAHours < 1 || p.TriageSLAHours > 720 {
		return errors.New("triage_sla_hours must be between 1 and 720")
	}
	if p.ResolutionSLALowDays < 1 || p.ResolutionSLALowDays > 365 {
		return errors.New("resolution_sla_low_days must be between 1 and 365")
	}
	if p.ResolutionSLAMediumDays < 1 || p.ResolutionSLAMediumDays > 365 {
		return errors.New("resolution_sla_medium_days must be between 1 and 365")
	}
	if p.ResolutionSLAHighDays < 1 || p.ResolutionSLAHighDays > 365 {
		return errors.New("resolution_sla_high_days must be between 1 and 365")
	}
	if p.ResolutionSLACriticalDays < 1 || p.ResolutionSLACriticalDays > 365 {
		return errors.New("resolution_sla_critical_days must be between 1 and 365")
	}

	p.WebhookURL = strings.TrimSpace(p.WebhookURL)
	if p.WebhookEnabled {
		if p.WebhookURL == "" {
			return errors.New("webhook_url is required when webhook is enabled")
		}
		u, err := http.NewRequest(http.MethodPost, p.WebhookURL, nil)
		if err != nil || u.URL == nil || (u.URL.Scheme != "https" && u.URL.Scheme != "http") {
			return errors.New("invalid webhook_url")
		}
	}
	return nil
}

func (h *Handler) getOrgSettings(ctx context.Context, orgID string) (orgSettingsPayload, error) {
	settings := defaultOrgSettings()
	row := h.DB.QueryRow(ctx, `
		SELECT triage_sla_hours, resolution_sla_low_days, resolution_sla_medium_days, resolution_sla_high_days, resolution_sla_critical_days,
		       webhook_enabled, COALESCE(webhook_url,''), COALESCE(webhook_secret,'')
		FROM org_vdp_settings
		WHERE org_id=$1`, orgID)
	err := row.Scan(
		&settings.TriageSLAHours,
		&settings.ResolutionSLALowDays,
		&settings.ResolutionSLAMediumDays,
		&settings.ResolutionSLAHighDays,
		&settings.ResolutionSLACriticalDays,
		&settings.WebhookEnabled,
		&settings.WebhookURL,
		&settings.WebhookSecret,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return settings, nil
		}
		return settings, err
	}
	return settings, nil
}

func (h *Handler) GetOrgSettings(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	settings, err := h.getOrgSettings(c.Request.Context(), orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.JSON(http.StatusOK, settings)
}

func (h *Handler) UpdateOrgSettings(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload := defaultOrgSettings()
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	payload.WebhookURL = strings.TrimSpace(payload.WebhookURL)
	payload.WebhookSecret = strings.TrimSpace(payload.WebhookSecret)

	if err := validateOrgSettingsPayload(payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err = h.DB.Exec(c.Request.Context(), `
		INSERT INTO org_vdp_settings (
			org_id, triage_sla_hours, resolution_sla_low_days, resolution_sla_medium_days, resolution_sla_high_days, resolution_sla_critical_days,
			webhook_enabled, webhook_url, webhook_secret, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
		ON CONFLICT (org_id) DO UPDATE SET
			triage_sla_hours=EXCLUDED.triage_sla_hours,
			resolution_sla_low_days=EXCLUDED.resolution_sla_low_days,
			resolution_sla_medium_days=EXCLUDED.resolution_sla_medium_days,
			resolution_sla_high_days=EXCLUDED.resolution_sla_high_days,
			resolution_sla_critical_days=EXCLUDED.resolution_sla_critical_days,
			webhook_enabled=EXCLUDED.webhook_enabled,
			webhook_url=EXCLUDED.webhook_url,
			webhook_secret=EXCLUDED.webhook_secret,
			updated_at=NOW()`,
		orgID,
		payload.TriageSLAHours,
		payload.ResolutionSLALowDays,
		payload.ResolutionSLAMediumDays,
		payload.ResolutionSLAHighDays,
		payload.ResolutionSLACriticalDays,
		payload.WebhookEnabled,
		payload.WebhookURL,
		payload.WebhookSecret,
	)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) GetOrgVDP(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	var organization struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT id, name, slug FROM organizations WHERE id=$1`, orgID).Scan(&organization.ID, &organization.Name, &organization.Slug); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	var program struct {
		ID           string `json:"id"`
		ProcedureID  string `json:"procedure_id"`
		Title        string `json:"title"`
		Description  string `json:"description"`
		ContactEmail string `json:"contact_email"`
		Status       string `json:"status"`
		Visibility   string `json:"visibility"`
	}
	var hasProgram bool
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT id, procedure_id, COALESCE(title,''), COALESCE(description,''), COALESCE(contact_email,''), status, visibility
		FROM vdp_programs
		WHERE org_id=$1
		LIMIT 1`, orgID)
	if err := row.Scan(&program.ID, &program.ProcedureID, &program.Title, &program.Description, &program.ContactEmail, &program.Status, &program.Visibility); err == nil {
		hasProgram = true
	}

	var procedure struct {
		ID                    string `json:"id"`
		Overview              string `json:"overview"`
		Scope                 string `json:"scope"`
		OutOfScope            string `json:"out_of_scope"`
		ReportingRequirements string `json:"reporting_requirements"`
		SeverityRules         string `json:"severity_rules"`
		ResponseTimeline      string `json:"response_timeline"`
		LegalSafeHarbor       string `json:"legal_safe_harbor"`
		ProhibitedActions     string `json:"prohibited_actions"`
		Status                string `json:"status"`
	}
	var hasProcedure bool
	row = h.DB.QueryRow(c.Request.Context(), `
		SELECT id, overview, scope, out_of_scope, reporting_requirements, severity_rules, response_timeline, legal_safe_harbor, prohibited_actions, status
		FROM disclosure_procedures WHERE org_id=$1 ORDER BY created_at DESC LIMIT 1`, orgID)
	if err := row.Scan(&procedure.ID, &procedure.Overview, &procedure.Scope, &procedure.OutOfScope, &procedure.ReportingRequirements, &procedure.SeverityRules, &procedure.ResponseTimeline, &procedure.LegalSafeHarbor, &procedure.ProhibitedActions, &procedure.Status); err == nil {
		hasProcedure = true
	}

	hasDoc := false
	if hasProcedure {
		_ = h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM procedure_documents WHERE procedure_id=$1)`, procedure.ID).Scan(&hasDoc)
	}

	publicPath := ""
	if hasProgram && hasProcedure && hasDoc && strings.ToLower(program.Status) == "active" && strings.ToLower(program.Visibility) == "public" && organization.Slug != "" {
		publicPath = "/security/" + organization.Slug
	}

	c.JSON(http.StatusOK, gin.H{
		"organization":  organization,
		"has_program":   hasProgram,
		"program":       program,
		"has_procedure": hasProcedure,
		"procedure":     procedure,
		"has_document":  hasDoc,
		"public_path":   publicPath,
	})
}

func (h *Handler) GetProcedureTemplate(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"overview":               "We welcome security research that helps keep users safe.",
		"scope":                  "Public web applications, public APIs, mobile applications",
		"out_of_scope":           "Third-party services, social engineering, physical attacks, denial of service",
		"reporting_requirements": "Provide clear steps to reproduce, impact, and proof of concept when possible.",
		"severity_rules":         "Use CVSS or explain severity with business impact.",
		"response_timeline":      "We aim to acknowledge within 5 business days and resolve within 90 days.",
		"legal_safe_harbor":      "We will not initiate legal action for good-faith research that follows this policy.",
		"prohibited_actions":     "Do not access or modify data beyond what is necessary to prove the issue.",
		"status":                 "draft",
	})
}

func (h *Handler) GetProcedureByOrg(c *gin.Context) {
	markEndpointDeprecated(c, "/public/security/{organization}", "Procedure-by-org endpoint is deprecated; use public VDP page endpoint.")

	orgID := c.Param("id")
	if orgID == "" || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT id, org_id, overview, scope, out_of_scope, reporting_requirements, severity_rules, response_timeline, legal_safe_harbor, prohibited_actions, status, created_at
		FROM disclosure_procedures
		WHERE org_id=$1 AND status='active'
		ORDER BY created_at DESC
		LIMIT 1`, orgID)

	var created time.Time
	var id, org, overview, scope, outOfScope, reqs, rules, timeline, safeHarbor, prohibited, status string
	if err := row.Scan(&id, &org, &overview, &scope, &outOfScope, &reqs, &rules, &timeline, &safeHarbor, &prohibited, &status, &created); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	resp := map[string]any{
		"id":                     id,
		"org_id":                 org,
		"overview":               overview,
		"scope":                  scope,
		"out_of_scope":           outOfScope,
		"reporting_requirements": reqs,
		"severity_rules":         rules,
		"response_timeline":      timeline,
		"legal_safe_harbor":      safeHarbor,
		"prohibited_actions":     prohibited,
		"status":                 status,
		"created_at":             created,
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetPublicVDP(c *gin.Context) {
	slug := strings.ToLower(strings.TrimSpace(c.Param("organization")))
	if slug == "" || !validateSlug(slug) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT
			o.id, o.name, o.slug, COALESCE(o.description,''), COALESCE(o.website,''),
			p.id, COALESCE(p.title,''), COALESCE(p.description,''), COALESCE(p.contact_email,''), p.visibility, p.status, p.created_at,
			d.id, d.overview, d.scope, d.out_of_scope, d.reporting_requirements, d.severity_rules, d.response_timeline, d.legal_safe_harbor, d.prohibited_actions, d.status,
			COALESCE(pd.object_key,''), COALESCE(pd.filename,''), COALESCE(pd.content_type,''), COALESCE(pd.size_bytes,0), pd.uploaded_at
		FROM organizations o
		JOIN vdp_programs p ON p.org_id = o.id
		JOIN disclosure_procedures d ON d.id = p.procedure_id
		LEFT JOIN LATERAL (
			SELECT object_key, filename, content_type, size_bytes, uploaded_at
			FROM procedure_documents
			WHERE procedure_id = d.id
			ORDER BY uploaded_at DESC
			LIMIT 1
		) pd ON true
		WHERE o.slug=$1 AND p.visibility='public' AND p.status='active' AND d.status='active'
		ORDER BY p.created_at DESC
		LIMIT 1`, slug)

	var uploadedAt *time.Time
	var orgID, orgName, orgSlug, orgDesc, orgWebsite string
	var programID, programTitle, programDescription, programContactEmail, visibility, programStatus string
	var programCreatedAt time.Time
	var procedureID, overview, scope, outOfScope, reqs, rules, timeline, safeHarbor, prohibited, procedureStatus string
	var docKey, docFilename, docType string
	var docBytes int64
	if err := row.Scan(
		&orgID, &orgName, &orgSlug, &orgDesc, &orgWebsite,
		&programID, &programTitle, &programDescription, &programContactEmail, &visibility, &programStatus, &programCreatedAt,
		&procedureID, &overview, &scope, &outOfScope, &reqs, &rules, &timeline, &safeHarbor, &prohibited, &procedureStatus,
		&docKey, &docFilename, &docType, &docBytes, &uploadedAt,
	); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	resp := gin.H{
		"organization": gin.H{
			"id":          orgID,
			"name":        orgName,
			"slug":        orgSlug,
			"description": orgDesc,
			"website":     orgWebsite,
		},
		"program": gin.H{
			"id":            programID,
			"title":         programTitle,
			"description":   programDescription,
			"contact_email": programContactEmail,
			"visibility":    visibility,
			"status":        programStatus,
			"created_at":    programCreatedAt,
			"public_path":   "/security/" + orgSlug,
		},
		"procedure": gin.H{
			"id":                     procedureID,
			"overview":               overview,
			"scope":                  scope,
			"out_of_scope":           outOfScope,
			"reporting_requirements": reqs,
			"severity_rules":         rules,
			"response_timeline":      timeline,
			"legal_safe_harbor":      safeHarbor,
			"prohibited_actions":     prohibited,
			"status":                 procedureStatus,
		},
	}

	if docKey != "" {
		resp["policy_pdf"] = gin.H{
			"object_key":   docKey,
			"filename":     docFilename,
			"content_type": docType,
			"size_bytes":   docBytes,
			"uploaded_at":  uploadedAt,
			"download_url": "/api/vdp/procedures/" + procedureID + "/document",
		}
	} else {
		resp["policy_pdf"] = nil
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) ListPublicPrograms(c *gin.Context) {
	orgID := strings.TrimSpace(c.Query("org_id"))
	q := strings.TrimSpace(c.Query("q"))
	query := `
		SELECT p.id, p.org_id, p.procedure_id, COALESCE(p.title,''), COALESCE(p.description,''), COALESCE(p.contact_email,''), p.visibility, p.status, p.created_at
		FROM vdp_programs p
		JOIN disclosure_procedures d ON d.id = p.procedure_id
		JOIN organizations o ON o.id = p.org_id
		WHERE p.visibility='public' AND p.status='active' AND d.status='active'`
	args := []any{}
	if orgID != "" {
		if !validateUUID(orgID) {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		query += " AND p.org_id=$1"
		args = append(args, orgID)
	}
	if q != "" {
		query += " AND (o.name ILIKE '%' || $" + itoa(len(args)+1) + " || '%' OR o.slug ILIKE '%' || $" + itoa(len(args)+1) + " || '%' OR p.title ILIKE '%' || $" + itoa(len(args)+1) + " || '%')"
		args = append(args, q)
	}
	query += " ORDER BY created_at DESC"

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type program struct {
		ID           string    `json:"id"`
		OrgID        string    `json:"org_id"`
		ProcedureID  string    `json:"procedure_id"`
		Title        string    `json:"title"`
		Description  string    `json:"description"`
		ContactEmail string    `json:"contact_email"`
		Visibility   string    `json:"visibility"`
		Status       string    `json:"status"`
		CreatedAt    time.Time `json:"created_at"`
	}
	res := []program{}
	for rows.Next() {
		var p program
		if err := rows.Scan(&p.ID, &p.OrgID, &p.ProcedureID, &p.Title, &p.Description, &p.ContactEmail, &p.Visibility, &p.Status, &p.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, p)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) CreateProcedure(c *gin.Context) {
	markEndpointDeprecated(c, "/org-admin/programs", "Create procedure separately is deprecated; create or update program through org-admin program flow.")

	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	var p procedurePayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	p = sanitizeProcedure(p)
	if err := validateProcedure(p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id string
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO disclosure_procedures (org_id, overview, scope, out_of_scope, reporting_requirements, severity_rules, response_timeline, legal_safe_harbor, prohibited_actions, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id`,
		orgID, p.Overview, p.Scope, p.OutOfScope, p.ReportingRequirements, p.SeverityRules, p.ResponseTimeline, p.LegalSafeHarbor, p.ProhibitedActions, strings.ToLower(p.Status)).Scan(&id)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *Handler) UpdateProcedure(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	procID := c.Param("id")
	if procID == "" || !validateUUID(procID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var p procedurePayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	p = sanitizeProcedure(p)
	if err := validateProcedure(p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cmd, err := h.DB.Exec(c.Request.Context(), `
		UPDATE disclosure_procedures
		SET overview=$1, scope=$2, out_of_scope=$3, reporting_requirements=$4, severity_rules=$5, response_timeline=$6, legal_safe_harbor=$7, prohibited_actions=$8, status=$9
		WHERE id=$10 AND org_id=$11`,
		p.Overview, p.Scope, p.OutOfScope, p.ReportingRequirements, p.SeverityRules, p.ResponseTimeline, p.LegalSafeHarbor, p.ProhibitedActions, strings.ToLower(p.Status), procID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if cmd.RowsAffected() == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) UploadProcedureDocument(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	procID := c.Param("id")
	if procID == "" || !validateUUID(procID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM disclosure_procedures WHERE id=$1 AND org_id=$2)`, procID, orgID).Scan(&exists); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size <= 0 || header.Size > maxUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large"})
		return
	}
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".pdf") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only pdf allowed"})
		return
	}
	if !allowedContentType(header.Header.Get("Content-Type"), []string{"application/pdf"}) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content type"})
		return
	}

	objectKey := storage.ObjectKeyForProcedure(procID, header.Filename)
	data, err := readAllLimited(file, maxUploadBytes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return
	}
	if ok, sig, err := h.scanBytes(c, data); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	} else if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "malware detected", "signature": sig})
		return
	}

	if err := h.Store.PutObject(c.Request.Context(), objectKey, bytes.NewReader(data), int64(len(data)), header.Header.Get("Content-Type")); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	_, err = h.DB.Exec(c.Request.Context(), `
		INSERT INTO procedure_documents (procedure_id, object_key, filename, content_type, size_bytes)
		VALUES ($1,$2,$3,$4,$5)`, procID, objectKey, header.Filename, header.Header.Get("Content-Type"), len(data))
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.Status(http.StatusCreated)
}

func (h *Handler) GetProcedureDocument(c *gin.Context) {
	procID := c.Param("id")
	if procID == "" || !validateUUID(procID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT object_key, filename, content_type FROM procedure_documents
		WHERE procedure_id=$1
		ORDER BY uploaded_at DESC LIMIT 1`, procID)
	var key, name, ctype string
	if err := row.Scan(&key, &name, &ctype); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	obj, info, err := h.Store.GetObject(c.Request.Context(), key)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	defer obj.Close()

	c.Header("Content-Type", ctype)
	c.Header("Content-Length", itoa64(info.Size))
	c.Header("Content-Disposition", "attachment; filename=\""+name+"\"")
	_, _ = io.Copy(c.Writer, obj)
}

func (h *Handler) CreateVDPProgram(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	contentType := strings.ToLower(strings.TrimSpace(c.ContentType()))
	if !strings.HasPrefix(contentType, "multipart/form-data") {
		markEndpointDeprecated(c, "/org-admin/programs (multipart/form-data)", "JSON-only create flow is deprecated; submit program fields and PDF together.")
		h.CreateProgram(c)
		return
	}

	var already bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM vdp_programs WHERE org_id=$1)`, orgID).Scan(&already); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if already {
		c.JSON(http.StatusConflict, gin.H{"error": "organization already has a vdp program"})
		return
	}

	var payload programCreationPayload
	payload.Title = sanitizeText(c.PostForm("title"))
	payload.Description = sanitizeText(c.PostForm("description"))
	payload.Scope = sanitizeText(c.PostForm("scope"))
	payload.OutOfScope = sanitizeText(c.PostForm("out_of_scope"))
	payload.ContactEmail = strings.TrimSpace(c.PostForm("contact_email"))
	payload.Overview = sanitizeText(c.PostForm("overview"))
	payload.ReportingRequirements = sanitizeText(c.PostForm("reporting_requirements"))
	payload.SeverityRules = sanitizeText(c.PostForm("severity_rules"))
	payload.ResponseTimeline = sanitizeText(c.PostForm("response_timeline"))
	payload.LegalSafeHarbor = sanitizeText(c.PostForm("legal_safe_harbor"))
	payload.ProhibitedActions = sanitizeText(c.PostForm("prohibited_actions"))
	payload.Visibility = strings.ToLower(strings.TrimSpace(c.PostForm("visibility")))
	payload.Status = strings.ToLower(strings.TrimSpace(c.PostForm("status")))
	payload.Publish = parseBool(c.PostForm("publish"))

	if payload.Title == "" || payload.Description == "" || payload.Scope == "" || payload.OutOfScope == "" || payload.ContactEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title, description, scope, out_of_scope and contact_email are required"})
		return
	}
	if len(payload.Title) > maxTitleLen {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title too long"})
		return
	}
	if len(payload.Description) > maxDescriptionLen {
		c.JSON(http.StatusBadRequest, gin.H{"error": "description too long"})
		return
	}
	if !validateEmail(payload.ContactEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contact_email"})
		return
	}
	if payload.Visibility == "" {
		payload.Visibility = "private"
	}
	if payload.Status == "" {
		payload.Status = "draft"
	}
	if payload.Publish {
		payload.Visibility = "public"
		payload.Status = "active"
	}
	if !inAllowlist(payload.Visibility, "public", "private") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visibility"})
		return
	}
	if !inAllowlist(payload.Status, "active", "draft", "paused") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}

	if payload.Overview == "" {
		payload.Overview = payload.Description
	}
	if payload.ReportingRequirements == "" {
		payload.ReportingRequirements = "Provide clear steps to reproduce, impact, and proof of concept when possible."
	}
	if payload.SeverityRules == "" {
		payload.SeverityRules = "Use CVSS or explain severity with business impact."
	}
	if payload.ResponseTimeline == "" {
		payload.ResponseTimeline = "We aim to acknowledge within 5 business days and resolve within 90 days."
	}
	if payload.LegalSafeHarbor == "" {
		payload.LegalSafeHarbor = "We will not initiate legal action for good-faith research that follows this policy."
	}
	if payload.ProhibitedActions == "" {
		payload.ProhibitedActions = "Do not access or modify data beyond what is necessary to prove the issue."
	}

	file, header, err := c.Request.FormFile("policy_pdf")
	if err != nil {
		file, header, err = c.Request.FormFile("file")
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "security policy pdf is required"})
		return
	}
	defer file.Close()

	if header.Size <= 0 || header.Size > maxUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large"})
		return
	}
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".pdf") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only pdf allowed"})
		return
	}
	uploadContentType := strings.TrimSpace(header.Header.Get("Content-Type"))
	if uploadContentType != "" && !allowedContentType(uploadContentType, []string{"application/pdf"}) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content type"})
		return
	}
	if uploadContentType == "" {
		uploadContentType = "application/pdf"
	}
	data, err := readAllLimited(file, maxUploadBytes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return
	}
	if ok, sig, err := h.scanBytes(c, data); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	} else if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "malware detected", "signature": sig})
		return
	}

	tx, err := h.DB.Begin(c.Request.Context())
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(c.Request.Context())

	orgCmd, err := tx.Exec(c.Request.Context(), `
		UPDATE organizations
		SET contact_email=$2, updated_at=NOW()
		WHERE id=$1`, orgID, payload.ContactEmail)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if orgCmd.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		return
	}

	procedureStatus := "draft"
	if payload.Publish || payload.Status == "active" {
		procedureStatus = "active"
	}
	var procedureID string
	if err := tx.QueryRow(c.Request.Context(), `
		INSERT INTO disclosure_procedures (
			org_id, overview, scope, out_of_scope, reporting_requirements,
			severity_rules, response_timeline, legal_safe_harbor, prohibited_actions, status
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id`,
		orgID,
		payload.Overview,
		payload.Scope,
		payload.OutOfScope,
		payload.ReportingRequirements,
		payload.SeverityRules,
		payload.ResponseTimeline,
		payload.LegalSafeHarbor,
		payload.ProhibitedActions,
		procedureStatus,
	).Scan(&procedureID); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	var programID string
	if err := tx.QueryRow(c.Request.Context(), `
		INSERT INTO vdp_programs (org_id, procedure_id, title, description, contact_email, visibility, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id`,
		orgID, procedureID, payload.Title, payload.Description, payload.ContactEmail, payload.Visibility, payload.Status,
	).Scan(&programID); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "organization already has a vdp program"})
		return
	}

	objectKey := storage.ObjectKeyForProcedure(procedureID, header.Filename)
	if err := h.Store.PutObject(c.Request.Context(), objectKey, bytes.NewReader(data), int64(len(data)), uploadContentType); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if _, err := tx.Exec(c.Request.Context(), `
		INSERT INTO procedure_documents (procedure_id, object_key, filename, content_type, size_bytes)
		VALUES ($1,$2,$3,$4,$5)`,
		procedureID, objectKey, header.Filename, uploadContentType, len(data)); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	var slug string
	_ = h.DB.QueryRow(c.Request.Context(), `SELECT slug FROM organizations WHERE id=$1`, orgID).Scan(&slug)
	publicPath := ""
	if slug != "" && payload.Visibility == "public" && payload.Status == "active" {
		publicPath = "/security/" + slug
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":           programID,
		"procedure_id": procedureID,
		"status":       payload.Status,
		"visibility":   payload.Visibility,
		"public_path":  publicPath,
		"policy_pdf": gin.H{
			"object_key": objectKey,
			"filename":   header.Filename,
		},
	})
}

func (h *Handler) CreateProgram(c *gin.Context) {
	markEndpointDeprecated(c, "/org-admin/programs", "CreateProgram is deprecated; use org-admin program creation with policy PDF upload.")

	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	var p programPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	p.ProcedureID = strings.TrimSpace(p.ProcedureID)
	p.Title = sanitizeText(p.Title)
	p.Description = sanitizeText(p.Description)
	p.ContactEmail = strings.TrimSpace(p.ContactEmail)
	p.Visibility = strings.ToLower(strings.TrimSpace(p.Visibility))
	p.Status = strings.ToLower(strings.TrimSpace(p.Status))
	if p.ProcedureID == "" || p.Visibility == "" || p.Status == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if !validateUUID(p.ProcedureID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if !inAllowlist(p.Visibility, "public", "private") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visibility"})
		return
	}
	if !inAllowlist(p.Status, "active", "draft", "paused") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	if p.ContactEmail != "" && !validateEmail(p.ContactEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contact email"})
		return
	}

	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM disclosure_procedures WHERE id=$1 AND org_id=$2)`, p.ProcedureID, orgID).Scan(&exists); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "procedure not found"})
		return
	}

	var hasDoc bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM procedure_documents WHERE procedure_id=$1)`, p.ProcedureID).Scan(&hasDoc); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if !hasDoc {
		c.JSON(http.StatusBadRequest, gin.H{"error": "svdsp document required"})
		return
	}

	var already bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM vdp_programs WHERE org_id=$1)`, orgID).Scan(&already); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if already {
		c.JSON(http.StatusConflict, gin.H{"error": "program already exists for organization"})
		return
	}

	if p.Title == "" {
		p.Title = "Vulnerability Disclosure Program"
	}
	if p.Description == "" {
		var procedureOverview string
		_ = h.DB.QueryRow(c.Request.Context(), `SELECT COALESCE(overview,'') FROM disclosure_procedures WHERE id=$1`, p.ProcedureID).Scan(&procedureOverview)
		p.Description = strings.TrimSpace(procedureOverview)
		if p.Description == "" {
			p.Description = "Security researchers may submit vulnerability findings through this program."
		}
	}
	if p.ContactEmail == "" {
		_ = h.DB.QueryRow(c.Request.Context(), `SELECT COALESCE(contact_email,'') FROM organizations WHERE id=$1`, orgID).Scan(&p.ContactEmail)
	}

	var id string
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO vdp_programs (org_id, procedure_id, title, description, contact_email, visibility, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id`,
		orgID, p.ProcedureID, p.Title, p.Description, p.ContactEmail, p.Visibility, p.Status).Scan(&id)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "program already exists for organization"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *Handler) PublishVDPProgram(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	programID := c.Param("id")
	if programID == "" || !validateUUID(programID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var procedureID string
	if err := h.DB.QueryRow(c.Request.Context(), `
		SELECT procedure_id
		FROM vdp_programs
		WHERE id=$1 AND org_id=$2`, programID, orgID).Scan(&procedureID); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	var procedureStatus string
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT status FROM disclosure_procedures WHERE id=$1 AND org_id=$2`, procedureID, orgID).Scan(&procedureStatus); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "procedure not found"})
		return
	}
	if strings.ToLower(strings.TrimSpace(procedureStatus)) != "active" {
		if _, err := h.DB.Exec(c.Request.Context(), `
			UPDATE disclosure_procedures
			SET status='active'
			WHERE id=$1 AND org_id=$2`, procedureID, orgID); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		procedureStatus = "active"
	}
	if procedureStatus != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to activate procedure"})
		return
	}

	var hasDoc bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM procedure_documents WHERE procedure_id=$1)`, procedureID).Scan(&hasDoc); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if !hasDoc {
		c.JSON(http.StatusBadRequest, gin.H{"error": "policy pdf is required before publishing"})
		return
	}

	if _, err := h.DB.Exec(c.Request.Context(), `
		UPDATE vdp_programs
		SET visibility='public', status='active'
		WHERE id=$1 AND org_id=$2`, programID, orgID); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	var slug string
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT slug FROM organizations WHERE id=$1`, orgID).Scan(&slug); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":             programID,
		"status":         "active",
		"visibility":     "public",
		"public_path":    "/security/" + slug,
		"policy_pdf_set": true,
	})
}

func (h *Handler) UpdateProgram(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	programID := c.Param("id")
	if programID == "" || !validateUUID(programID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var p programPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	p.Title = sanitizeText(p.Title)
	p.Description = sanitizeText(p.Description)
	p.ContactEmail = strings.TrimSpace(p.ContactEmail)
	p.Visibility = strings.ToLower(strings.TrimSpace(p.Visibility))
	p.Status = strings.ToLower(strings.TrimSpace(p.Status))
	if p.Visibility != "" && !inAllowlist(p.Visibility, "public", "private") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visibility"})
		return
	}
	if p.Status != "" && !inAllowlist(p.Status, "active", "draft", "paused") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	if p.ContactEmail != "" && !validateEmail(p.ContactEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contact email"})
		return
	}
	if p.Visibility == "" && p.Status == "" && p.Title == "" && p.Description == "" && p.ContactEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	shouldValidatePublish := p.Visibility == "public" || p.Status == "active"
	if shouldValidatePublish {
		var procedureID, procedureStatus string
		if err := h.DB.QueryRow(c.Request.Context(), `SELECT procedure_id FROM vdp_programs WHERE id=$1 AND org_id=$2`, programID, orgID).Scan(&procedureID); err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		if err := h.DB.QueryRow(c.Request.Context(), `SELECT status FROM disclosure_procedures WHERE id=$1 AND org_id=$2`, procedureID, orgID).Scan(&procedureStatus); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "procedure not found"})
			return
		}
		if strings.ToLower(strings.TrimSpace(procedureStatus)) != "active" {
			if _, err := h.DB.Exec(c.Request.Context(), `
				UPDATE disclosure_procedures
				SET status='active'
				WHERE id=$1 AND org_id=$2`, procedureID, orgID); err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
		}
		var hasDoc bool
		if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM procedure_documents WHERE procedure_id=$1)`, procedureID).Scan(&hasDoc); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if !hasDoc {
			c.JSON(http.StatusBadRequest, gin.H{"error": "policy pdf is required before publishing"})
			return
		}
	}

	currentVisibility := ""
	currentStatus := ""
	if err := h.DB.QueryRow(c.Request.Context(), `
		SELECT visibility, status
		FROM vdp_programs
		WHERE id=$1 AND org_id=$2`, programID, orgID).Scan(&currentVisibility, &currentStatus); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if p.Visibility == "" {
		p.Visibility = currentVisibility
	}
	if p.Status == "" {
		p.Status = currentStatus
	}

	cmd, err := h.DB.Exec(c.Request.Context(), `
		UPDATE vdp_programs
		SET
			visibility=$1,
			status=$2,
			title=COALESCE(NULLIF($3,''), title),
			description=COALESCE(NULLIF($4,''), description),
			contact_email=COALESCE(NULLIF($5,''), contact_email)
		WHERE id=$6 AND org_id=$7`,
		p.Visibility, p.Status, p.Title, p.Description, p.ContactEmail, programID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if cmd.RowsAffected() == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) ListOrgReports(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	severity := strings.ToLower(strings.TrimSpace(c.Query("severity")))
	search := strings.TrimSpace(c.Query("q"))
	assigneeEmail := strings.TrimSpace(c.Query("assignee_email"))
	overdueRaw := strings.ToLower(strings.TrimSpace(c.Query("overdue")))
	overdueOnly := overdueRaw == "1" || overdueRaw == "true" || overdueRaw == "yes"
	notOverdueOnly := overdueRaw == "0" || overdueRaw == "false" || overdueRaw == "no"
	fromStr := strings.TrimSpace(c.Query("from"))
	toStr := strings.TrimSpace(c.Query("to"))
	if status != "" && !isValidReportStatus(status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	if assigneeEmail != "" && !validateEmail(assigneeEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignee_email"})
		return
	}

	fromTime, _, err := parseDateQuery(fromStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from date"})
		return
	}
	toTime, toDateOnly, err := parseDateQuery(toStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to date"})
		return
	}

	query := `
		SELECT r.id, r.program_id, COALESCE(r.hacker_id::text,''), 
		       (CASE WHEN r.reporter_email IS NOT NULL AND r.reporter_email <> '' THEN true ELSE false END) AS has_email,
		       r.title, COALESCE(r.affected_asset,''), COALESCE(r.vulnerability_type,''), r.description, r.severity, r.poc, r.status,
		       COALESCE(r.assignee_name,''), COALESCE(r.assignee_email,''), r.triage_due_at, r.resolution_due_at, r.needs_info_due_at,
		       r.duplicate_of::text, r.created_at, r.updated_at,
		       CASE
		         WHEN r.status IN ('resolved','duplicate','informative','not_applicable','rejected') THEN FALSE
		         WHEN r.status='needs_info' AND r.needs_info_due_at IS NOT NULL AND NOW() > r.needs_info_due_at THEN TRUE
		         WHEN r.status IN ('new','triaged') AND r.triage_due_at IS NOT NULL AND NOW() > r.triage_due_at THEN TRUE
		         WHEN r.status IN ('accepted','retesting') AND r.resolution_due_at IS NOT NULL AND NOW() > r.resolution_due_at THEN TRUE
		         ELSE FALSE
		       END AS overdue,
		       COALESCE(r.evidence_quality_score, 0),
		       COALESCE(r.evidence_quality_grade, 'unknown'),
		       COALESCE(r.triage_suggested_severity,''),
		       COALESCE(r.triage_severity_confidence,0),
		       COALESCE(r.triage_suggested_cwe,''),
		       COALESCE(r.triage_cwe_confidence,0),
		       r.triage_duplicate_of::text,
		       COALESCE(r.triage_duplicate_confidence,0)
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE p.org_id=$1`
	args := []any{orgID}
	idx := 2
	if status != "" {
		query += " AND r.status=$" + itoa(idx)
		args = append(args, status)
		idx++
	}
	if severity != "" {
		query += " AND r.severity=$" + itoa(idx)
		args = append(args, severity)
		idx++
	}
	if search != "" {
		query += " AND (r.title ILIKE '%' || $" + itoa(idx) + " || '%' OR r.description ILIKE '%' || $" + itoa(idx) + " || '%' OR r.affected_asset ILIKE '%' || $" + itoa(idx) + " || '%')"
		args = append(args, search)
		idx++
	}
	if assigneeEmail != "" {
		query += " AND r.assignee_email=$" + itoa(idx)
		args = append(args, assigneeEmail)
		idx++
	}
	if fromTime != nil {
		query += " AND r.created_at >= $" + itoa(idx)
		args = append(args, *fromTime)
		idx++
	}
	if toTime != nil {
		if toDateOnly {
			end := toTime.Add(24 * time.Hour)
			query += " AND r.created_at < $" + itoa(idx)
			args = append(args, end)
		} else {
			query += " AND r.created_at <= $" + itoa(idx)
			args = append(args, *toTime)
		}
		idx++
	}
	if overdueOnly {
		query += `
			AND (
				(r.status='needs_info' AND r.needs_info_due_at IS NOT NULL AND NOW() > r.needs_info_due_at)
				OR (r.status IN ('new','triaged') AND r.triage_due_at IS NOT NULL AND NOW() > r.triage_due_at)
				OR (r.status IN ('accepted','retesting') AND r.resolution_due_at IS NOT NULL AND NOW() > r.resolution_due_at)
			)`
	} else if notOverdueOnly {
		query += `
			AND NOT (
				(r.status='needs_info' AND r.needs_info_due_at IS NOT NULL AND NOW() > r.needs_info_due_at)
				OR (r.status IN ('new','triaged') AND r.triage_due_at IS NOT NULL AND NOW() > r.triage_due_at)
				OR (r.status IN ('accepted','retesting') AND r.resolution_due_at IS NOT NULL AND NOW() > r.resolution_due_at)
			)`
	}
	query += " ORDER BY r.created_at DESC"

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type report struct {
		ID                string     `json:"id"`
		ProgramID         string     `json:"program_id"`
		HackerID          string     `json:"hacker_id"`
		HasReporterEmail  bool       `json:"has_reporter_email"`
		Title             string     `json:"title"`
		AffectedAsset     string     `json:"affected_asset"`
		VulnerabilityType string     `json:"vulnerability_type"`
		Description       string     `json:"description"`
		Severity          string     `json:"severity"`
		POC               string     `json:"poc"`
		Status            string     `json:"status"`
		AssigneeName      string     `json:"assignee_name"`
		AssigneeEmail     string     `json:"assignee_email"`
		TriageDueAt       *time.Time `json:"triage_due_at"`
		ResolutionDueAt   *time.Time `json:"resolution_due_at"`
		NeedsInfoDueAt    *time.Time `json:"needs_info_due_at"`
		DuplicateOf       *string    `json:"duplicate_of"`
		CreatedAt         time.Time  `json:"created_at"`
		UpdatedAt         time.Time  `json:"updated_at"`
		Overdue           bool       `json:"overdue"`
		EvidenceScore     int        `json:"evidence_quality_score"`
		EvidenceGrade     string     `json:"evidence_quality_grade"`
		TriageSeverity    string     `json:"triage_suggested_severity"`
		TriageSeverityCF  float64    `json:"triage_severity_confidence"`
		TriageCWE         string     `json:"triage_suggested_cwe"`
		TriageCWECF       float64    `json:"triage_cwe_confidence"`
		TriageDuplicateOf *string    `json:"triage_duplicate_of"`
		TriageDuplicateCF float64    `json:"triage_duplicate_confidence"`
	}
	res := []report{}
	for rows.Next() {
		var r report
		if err := rows.Scan(
			&r.ID, &r.ProgramID, &r.HackerID, &r.HasReporterEmail,
			&r.Title, &r.AffectedAsset, &r.VulnerabilityType, &r.Description, &r.Severity, &r.POC, &r.Status,
			&r.AssigneeName, &r.AssigneeEmail, &r.TriageDueAt, &r.ResolutionDueAt, &r.NeedsInfoDueAt,
			&r.DuplicateOf, &r.CreatedAt, &r.UpdatedAt, &r.Overdue,
			&r.EvidenceScore, &r.EvidenceGrade,
			&r.TriageSeverity, &r.TriageSeverityCF, &r.TriageCWE, &r.TriageCWECF,
			&r.TriageDuplicateOf, &r.TriageDuplicateCF,
		); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, r)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) ExportOrgReportsCSV(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	severity := strings.ToLower(strings.TrimSpace(c.Query("severity")))
	search := strings.TrimSpace(c.Query("q"))
	fromStr := strings.TrimSpace(c.Query("from"))
	toStr := strings.TrimSpace(c.Query("to"))

	fromTime, _, err := parseDateQuery(fromStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from date"})
		return
	}
	toTime, toDateOnly, err := parseDateQuery(toStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to date"})
		return
	}

	query := `
		SELECT r.id, r.title, COALESCE(r.affected_asset,''), COALESCE(r.vulnerability_type,''), r.severity, r.status,
		       COALESCE(r.status_reason,''), COALESCE(r.public_notes,''), COALESCE(r.assignee_email,''), COALESCE(r.duplicate_of::text,''),
		       r.triage_due_at, r.resolution_due_at, r.needs_info_due_at,
		       COALESCE(r.evidence_quality_score,0), COALESCE(r.evidence_quality_grade,'unknown'),
		       COALESCE(r.triage_suggested_severity,''), COALESCE(r.triage_severity_confidence,0),
		       COALESCE(r.triage_suggested_cwe,''), COALESCE(r.triage_cwe_confidence,0),
		       COALESCE(r.triage_duplicate_of::text,''), COALESCE(r.triage_duplicate_confidence,0),
		       r.created_at, r.updated_at
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE p.org_id=$1`
	args := []any{orgID}
	idx := 2
	if status != "" {
		query += " AND r.status=$" + itoa(idx)
		args = append(args, status)
		idx++
	}
	if severity != "" {
		query += " AND r.severity=$" + itoa(idx)
		args = append(args, severity)
		idx++
	}
	if search != "" {
		query += " AND (r.title ILIKE '%' || $" + itoa(idx) + " || '%' OR r.description ILIKE '%' || $" + itoa(idx) + " || '%')"
		args = append(args, search)
		idx++
	}
	if fromTime != nil {
		query += " AND r.created_at >= $" + itoa(idx)
		args = append(args, *fromTime)
		idx++
	}
	if toTime != nil {
		if toDateOnly {
			end := toTime.Add(24 * time.Hour)
			query += " AND r.created_at < $" + itoa(idx)
			args = append(args, end)
		} else {
			query += " AND r.created_at <= $" + itoa(idx)
			args = append(args, *toTime)
		}
		idx++
	}
	query += " ORDER BY r.created_at DESC"

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{
		"report_id",
		"title",
		"affected_asset",
		"vulnerability_type",
		"severity",
		"status",
		"status_reason",
		"public_notes",
		"assignee_email",
		"duplicate_of",
		"triage_due_at",
		"resolution_due_at",
		"needs_info_due_at",
		"evidence_quality_score",
		"evidence_quality_grade",
		"triage_suggested_severity",
		"triage_severity_confidence",
		"triage_suggested_cwe",
		"triage_cwe_confidence",
		"triage_duplicate_of",
		"triage_duplicate_confidence",
		"created_at",
		"updated_at",
	})

	for rows.Next() {
		var id, title, asset, vulnType, sev, stat, reason, notes, assigneeEmail, duplicateOf string
		var evidenceGrade, triageSeverity, triageCWE, triageDuplicateOf string
		var evidenceScore int
		var triageSeverityConf, triageCWEConf, triageDuplicateConf float64
		var triageDueAt, resolutionDueAt, needsInfoDueAt *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&id, &title, &asset, &vulnType, &sev, &stat, &reason, &notes, &assigneeEmail, &duplicateOf,
			&triageDueAt, &resolutionDueAt, &needsInfoDueAt,
			&evidenceScore, &evidenceGrade,
			&triageSeverity, &triageSeverityConf, &triageCWE, &triageCWEConf,
			&triageDuplicateOf, &triageDuplicateConf,
			&createdAt, &updatedAt,
		); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		triageDue := ""
		if triageDueAt != nil {
			triageDue = triageDueAt.Format(time.RFC3339)
		}
		resolutionDue := ""
		if resolutionDueAt != nil {
			resolutionDue = resolutionDueAt.Format(time.RFC3339)
		}
		needsInfoDue := ""
		if needsInfoDueAt != nil {
			needsInfoDue = needsInfoDueAt.Format(time.RFC3339)
		}
		_ = w.Write([]string{
			id,
			title,
			asset,
			vulnType,
			sev,
			stat,
			reason,
			notes,
			assigneeEmail,
			duplicateOf,
			triageDue,
			resolutionDue,
			needsInfoDue,
			itoa(evidenceScore),
			evidenceGrade,
			triageSeverity,
			strconv.FormatFloat(triageSeverityConf, 'f', 4, 64),
			triageCWE,
			strconv.FormatFloat(triageCWEConf, 'f', 4, 64),
			triageDuplicateOf,
			strconv.FormatFloat(triageDuplicateConf, 'f', 4, 64),
			createdAt.Format(time.RFC3339),
			updatedAt.Format(time.RFC3339),
		})
	}
	w.Flush()
	if err := w.Error(); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="vdp-reports.csv"`)
	c.Data(http.StatusOK, "text/csv", buf.Bytes())
}

func (h *Handler) GetOrgMetrics(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	settings, err := h.getOrgSettings(c.Request.Context(), orgID)
	if err != nil {
		log.Printf("GetOrgMetrics settings error, using defaults: %v", err)
		settings = defaultOrgSettings()
	}

	warnings := []string{}

	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE r.status='new') AS new_count,
			COUNT(*) FILTER (WHERE r.status='triaged') AS triaged,
			COUNT(*) FILTER (WHERE r.status='needs_info') AS needs_info,
			COUNT(*) FILTER (WHERE r.status='accepted') AS accepted,
			COUNT(*) FILTER (WHERE r.status='retesting') AS retesting,
			COUNT(*) FILTER (WHERE r.status='duplicate') AS duplicate_count,
			COUNT(*) FILTER (WHERE r.status='informative') AS informative_count,
			COUNT(*) FILTER (WHERE r.status='not_applicable') AS not_applicable_count,
			COUNT(*) FILTER (WHERE r.status='rejected') AS rejected,
			COUNT(*) FILTER (WHERE r.status='resolved') AS resolved,
			COUNT(*) FILTER (
				WHERE r.status IN ('new','triaged')
				  AND r.triage_due_at IS NOT NULL
				  AND NOW() > r.triage_due_at
			) AS overdue_triage,
			COUNT(*) FILTER (
				WHERE r.status='needs_info'
				  AND r.needs_info_due_at IS NOT NULL
				  AND NOW() > r.needs_info_due_at
			) AS overdue_needs_info,
			COUNT(*) FILTER (
				WHERE r.status IN ('accepted','retesting')
				  AND r.resolution_due_at IS NOT NULL
				  AND NOW() > r.resolution_due_at
			) AS overdue_resolution,
			COUNT(*) AS total
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id=p.id
		WHERE p.org_id=$1`, orgID)
	var newCount, triaged, needsInfo, accepted, retesting, duplicateCount, informativeCount, notApplicableCount int64
	var rejected, resolved, overdueTriage, overdueNeedsInfo, overdueResolution, total int64
	if err := row.Scan(
		&newCount,
		&triaged,
		&needsInfo,
		&accepted,
		&retesting,
		&duplicateCount,
		&informativeCount,
		&notApplicableCount,
		&rejected,
		&resolved,
		&overdueTriage,
		&overdueNeedsInfo,
		&overdueResolution,
		&total,
	); err != nil {
		log.Printf("GetOrgMetrics counts scan error: %v", err)
		warnings = append(warnings, "counts_unavailable")
	}

	row = h.DB.QueryRow(c.Request.Context(), `
		SELECT
			COALESCE(AVG(EXTRACT(EPOCH FROM (r.acknowledged_at - r.created_at))), 0)::double precision AS mtta_seconds,
			COALESCE(AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.created_at))), 0)::double precision AS mttr_seconds
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id=p.id
		WHERE p.org_id=$1`, orgID)
	var mtta, mttr float64
	if err := row.Scan(&mtta, &mttr); err != nil {
		log.Printf("GetOrgMetrics avg scan error: %v", err)
		warnings = append(warnings, "timing_unavailable")
		mtta, mttr = 0, 0
	}

	row = h.DB.QueryRow(c.Request.Context(), `
		SELECT
			COALESCE(AVG(r.evidence_quality_score), 0)::double precision AS avg_quality_score,
			COUNT(*) FILTER (WHERE r.evidence_quality_score < 50 AND r.status NOT IN ('resolved','duplicate','informative','not_applicable','rejected')) AS low_quality_open,
			COUNT(*) FILTER (WHERE r.triage_assessed_at IS NOT NULL) AS triage_assessed_count,
			COUNT(*) FILTER (WHERE r.closed_at IS NOT NULL OR r.status IN ('resolved','duplicate','informative','not_applicable','rejected')) AS closed_total,
			COUNT(*) FILTER (WHERE r.status IN ('duplicate','informative','not_applicable','rejected')) AS false_positive_total,
			COUNT(*) FILTER (WHERE r.status IN ('accepted','retesting','resolved')) AS actionable_total,
			COUNT(*) FILTER (WHERE r.acknowledged_at IS NOT NULL AND r.triage_due_at IS NOT NULL) AS triage_completed_total,
			COUNT(*) FILTER (WHERE r.acknowledged_at IS NOT NULL AND r.triage_due_at IS NOT NULL AND r.acknowledged_at <= r.triage_due_at) AS triage_on_time,
			COUNT(*) FILTER (WHERE r.resolved_at IS NOT NULL AND r.resolution_due_at IS NOT NULL) AS resolution_completed_total,
			COUNT(*) FILTER (WHERE r.resolved_at IS NOT NULL AND r.resolution_due_at IS NOT NULL AND r.resolved_at <= r.resolution_due_at) AS resolution_on_time
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id=p.id
		WHERE p.org_id=$1`, orgID)

	var avgQualityScore float64
	var lowQualityOpen, triageAssessedCount, closedTotal, falsePositiveTotal, actionableTotal int64
	var triageCompletedTotal, triageOnTime, resolutionCompletedTotal, resolutionOnTime int64
	if err := row.Scan(
		&avgQualityScore,
		&lowQualityOpen,
		&triageAssessedCount,
		&closedTotal,
		&falsePositiveTotal,
		&actionableTotal,
		&triageCompletedTotal,
		&triageOnTime,
		&resolutionCompletedTotal,
		&resolutionOnTime,
	); err != nil {
		log.Printf("GetOrgMetrics quality/sla scan error: %v", err)
		warnings = append(warnings, "quality_or_sla_unavailable")
	}

	ratio := func(numerator, denominator int64) float64 {
		if denominator <= 0 {
			return 0
		}
		return (float64(numerator) / float64(denominator)) * 100
	}
	falsePositiveRate := ratio(falsePositiveTotal, closedTotal)
	actionableRate := ratio(actionableTotal, total)
	triageOnTimeRate := ratio(triageOnTime, triageCompletedTotal)
	resolutionOnTimeRate := ratio(resolutionOnTime, resolutionCompletedTotal)

	response := gin.H{
		"counts": gin.H{
			"new":                newCount,
			"triaged":            triaged,
			"needs_info":         needsInfo,
			"accepted":           accepted,
			"retesting":          retesting,
			"duplicate":          duplicateCount,
			"informative":        informativeCount,
			"not_applicable":     notApplicableCount,
			"rejected":           rejected,
			"resolved":           resolved,
			"overdue_triage":     overdueTriage,
			"overdue_needs_info": overdueNeedsInfo,
			"overdue_resolution": overdueResolution,
			"total":              total,
		},
		"sla": gin.H{
			"triage_sla_hours":             settings.TriageSLAHours,
			"resolution_sla_critical_days": settings.ResolutionSLACriticalDays,
			"resolution_sla_high_days":     settings.ResolutionSLAHighDays,
			"resolution_sla_medium_days":   settings.ResolutionSLAMediumDays,
			"resolution_sla_low_days":      settings.ResolutionSLALowDays,
		},
		"mtta_seconds": mtta,
		"mttr_seconds": mttr,
		"quality": gin.H{
			"average_score":         avgQualityScore,
			"low_quality_open":      lowQualityOpen,
			"triage_assessed_count": triageAssessedCount,
		},
		"outcomes": gin.H{
			"closed_total":         closedTotal,
			"false_positive_total": falsePositiveTotal,
			"false_positive_rate":  falsePositiveRate,
			"actionable_total":     actionableTotal,
			"actionable_rate":      actionableRate,
		},
		"sla_compliance": gin.H{
			"triage_completed_total":     triageCompletedTotal,
			"triage_on_time_total":       triageOnTime,
			"triage_on_time_rate":        triageOnTimeRate,
			"resolution_completed_total": resolutionCompletedTotal,
			"resolution_on_time_total":   resolutionOnTime,
			"resolution_on_time_rate":    resolutionOnTimeRate,
		},
	}
	if len(warnings) > 0 {
		response["warnings"] = warnings
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) ListOrgNotifications(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	unread := strings.TrimSpace(c.Query("unread"))

	query := `
		SELECT id, report_id, title, message, created_at, read_at
		FROM vdp_notifications WHERE org_id=$1`
	args := []any{orgID}
	if unread == "1" {
		query += " AND read_at IS NULL"
	}
	query += " ORDER BY created_at DESC"

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type n struct {
		ID        string     `json:"id"`
		ReportID  *string    `json:"report_id"`
		Title     string     `json:"title"`
		Message   string     `json:"message"`
		CreatedAt time.Time  `json:"created_at"`
		ReadAt    *time.Time `json:"read_at"`
	}
	res := []n{}
	for rows.Next() {
		var item n
		if err := rows.Scan(&item.ID, &item.ReportID, &item.Title, &item.Message, &item.CreatedAt, &item.ReadAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, item)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) MarkNotificationRead(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	notifyID := c.Param("id")
	if notifyID == "" || !validateUUID(notifyID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	cmd, err := h.DB.Exec(c.Request.Context(), `
		UPDATE vdp_notifications SET read_at=NOW() WHERE id=$1 AND org_id=$2`, notifyID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if cmd.RowsAffected() == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) GetOrgReport(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT r.id, r.program_id, COALESCE(r.hacker_id::text,''), 
		       (CASE WHEN r.reporter_email IS NOT NULL AND r.reporter_email <> '' THEN true ELSE false END) AS has_email,
		       COALESCE(r.reporter_name,''), r.title, COALESCE(r.affected_asset,''), COALESCE(r.vulnerability_type,''), r.description,
		       COALESCE(r.steps_to_reproduce,''), COALESCE(r.impact,''), r.severity, r.poc, COALESCE(r.attack_vector,''), COALESCE(r.cwe,''), COALESCE(r.reference_links,''),
		       r.status, COALESCE(r.status_reason,''), COALESCE(r.public_notes,''), COALESCE(r.internal_notes,''),
		       COALESCE(r.assignee_name,''), COALESCE(r.assignee_email,''), r.duplicate_of::text,
		       r.triage_due_at, r.resolution_due_at, r.needs_info_due_at,
		       COALESCE(r.evidence_quality_score,0), COALESCE(r.evidence_quality_grade,'unknown'), COALESCE(r.evidence_quality_flags, '[]'::jsonb),
		       r.triage_assessed_at, COALESCE(r.triage_model_version,''), r.triage_duplicate_of::text, COALESCE(r.triage_duplicate_confidence,0),
		       COALESCE(r.triage_suggested_severity,''), COALESCE(r.triage_severity_confidence,0),
		       COALESCE(r.triage_suggested_cwe,''), COALESCE(r.triage_cwe_confidence,0),
		       r.created_at, r.updated_at
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE r.id=$1 AND p.org_id=$2`, reportID, orgID)
	var r struct {
		ID                string     `json:"id"`
		ProgramID         string     `json:"program_id"`
		HackerID          string     `json:"hacker_id"`
		HasReporterEmail  bool       `json:"has_reporter_email"`
		ReporterName      string     `json:"reporter_name"`
		Title             string     `json:"title"`
		AffectedAsset     string     `json:"affected_asset"`
		VulnerabilityType string     `json:"vulnerability_type"`
		Description       string     `json:"description"`
		StepsToReproduce  string     `json:"steps_to_reproduce"`
		Impact            string     `json:"impact"`
		Severity          string     `json:"severity"`
		POC               string     `json:"poc"`
		AttackVector      string     `json:"attack_vector"`
		CWE               string     `json:"cwe"`
		ReferenceLinks    string     `json:"reference_links"`
		Status            string     `json:"status"`
		StatusReason      string     `json:"status_reason"`
		PublicNotes       string     `json:"public_notes"`
		InternalNotes     string     `json:"internal_notes"`
		AssigneeName      string     `json:"assignee_name"`
		AssigneeEmail     string     `json:"assignee_email"`
		DuplicateOf       *string    `json:"duplicate_of"`
		TriageDueAt       *time.Time `json:"triage_due_at"`
		ResolutionDueAt   *time.Time `json:"resolution_due_at"`
		NeedsInfoDueAt    *time.Time `json:"needs_info_due_at"`
		EvidenceScore     int        `json:"evidence_quality_score"`
		EvidenceGrade     string     `json:"evidence_quality_grade"`
		EvidenceFlags     []string   `json:"evidence_quality_flags"`
		TriageAssessedAt  *time.Time `json:"triage_assessed_at"`
		TriageModel       string     `json:"triage_model_version"`
		TriageDuplicateOf *string    `json:"triage_duplicate_of"`
		TriageDuplicateCF float64    `json:"triage_duplicate_confidence"`
		TriageSeverity    string     `json:"triage_suggested_severity"`
		TriageSeverityCF  float64    `json:"triage_severity_confidence"`
		TriageCWE         string     `json:"triage_suggested_cwe"`
		TriageCWECF       float64    `json:"triage_cwe_confidence"`
		CreatedAt         time.Time  `json:"created_at"`
		UpdatedAt         time.Time  `json:"updated_at"`
	}
	var qualityFlagsRaw []byte
	if err := row.Scan(
		&r.ID, &r.ProgramID, &r.HackerID, &r.HasReporterEmail,
		&r.ReporterName, &r.Title, &r.AffectedAsset, &r.VulnerabilityType, &r.Description,
		&r.StepsToReproduce, &r.Impact, &r.Severity, &r.POC, &r.AttackVector, &r.CWE, &r.ReferenceLinks,
		&r.Status, &r.StatusReason, &r.PublicNotes, &r.InternalNotes,
		&r.AssigneeName, &r.AssigneeEmail, &r.DuplicateOf,
		&r.TriageDueAt, &r.ResolutionDueAt, &r.NeedsInfoDueAt,
		&r.EvidenceScore, &r.EvidenceGrade, &qualityFlagsRaw,
		&r.TriageAssessedAt, &r.TriageModel, &r.TriageDuplicateOf, &r.TriageDuplicateCF,
		&r.TriageSeverity, &r.TriageSeverityCF, &r.TriageCWE, &r.TriageCWECF,
		&r.CreatedAt, &r.UpdatedAt,
	); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if len(qualityFlagsRaw) > 0 {
		_ = json.Unmarshal(qualityFlagsRaw, &r.EvidenceFlags)
	}
	c.JSON(http.StatusOK, r)
}

func (h *Handler) UpdateReportStatus(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var payload struct {
		Status        string `json:"status"`
		StatusReason  string `json:"status_reason"`
		PublicNotes   string `json:"public_notes"`
		InternalNotes string `json:"internal_notes"`
		DuplicateOf   string `json:"duplicate_of"`
		NeedsInfoDays int    `json:"needs_info_days"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	newStatus := normalizeReportStatus(payload.Status)
	if !isValidReportStatus(newStatus) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	payload.StatusReason = sanitizeText(payload.StatusReason)
	payload.PublicNotes = sanitizeText(payload.PublicNotes)
	payload.InternalNotes = sanitizeText(payload.InternalNotes)
	payload.DuplicateOf = strings.TrimSpace(payload.DuplicateOf)
	if statusRequiresReason(newStatus) && payload.StatusReason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status_reason is required for this status"})
		return
	}

	var currentStatus, severity string
	err = h.DB.QueryRow(c.Request.Context(), `
		SELECT r.status, r.severity
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE r.id=$1 AND p.org_id=$2`, reportID, orgID).Scan(&currentStatus, &severity)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	currentStatus = normalizeReportStatus(currentStatus)
	if currentStatus != newStatus && !isValidReportTransition(currentStatus, newStatus) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "invalid status transition",
			"current_status": currentStatus,
			"target_status":  newStatus,
		})
		return
	}

	var duplicateOf any
	if newStatus == "duplicate" {
		if !validateUUID(payload.DuplicateOf) || payload.DuplicateOf == reportID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "duplicate_of must be a valid report id"})
			return
		}
		var sameOrg bool
		if err := h.DB.QueryRow(c.Request.Context(), `
			SELECT EXISTS(
				SELECT 1
				FROM vdp_reports r
				JOIN vdp_programs p ON r.program_id = p.id
				WHERE r.id=$1 AND p.org_id=$2
			)`, payload.DuplicateOf, orgID).Scan(&sameOrg); err != nil || !sameOrg {
			c.JSON(http.StatusBadRequest, gin.H{"error": "duplicate_of report not found in this organization"})
			return
		}
		duplicateOf = payload.DuplicateOf
	}

	var needsInfoDueAt any
	if newStatus == "needs_info" {
		days := payload.NeedsInfoDays
		if days <= 0 {
			days = defaultNeedsInfoDays
		}
		if days > 90 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "needs_info_days must be <= 90"})
			return
		}
		t := time.Now().UTC().Add(time.Duration(days) * 24 * time.Hour)
		needsInfoDueAt = t
	}
	isClosed := isClosedReportStatus(newStatus)

	cmd, err := h.DB.Exec(c.Request.Context(), `
		UPDATE vdp_reports r
		SET status=$1,
		    status_reason=$2,
		    public_notes=$3,
		    internal_notes=$4,
		    duplicate_of=$5,
		    needs_info_due_at=$6,
		    acknowledged_at = CASE WHEN $1 <> 'new' THEN COALESCE(acknowledged_at, NOW()) ELSE acknowledged_at END,
		    resolved_at = CASE
		        WHEN $1='resolved' THEN COALESCE(resolved_at, NOW())
		        WHEN $1 IN ('new','triaged','needs_info','accepted','retesting') THEN NULL
		        ELSE resolved_at
		    END,
		    closed_at = CASE
		        WHEN $7 THEN COALESCE(closed_at, NOW())
		        WHEN NOT $7 THEN NULL
		        ELSE closed_at
		    END,
		    updated_at=NOW()
		FROM vdp_programs p
		WHERE r.id=$8 AND r.program_id=p.id AND p.org_id=$9`,
		newStatus, payload.StatusReason, payload.PublicNotes, payload.InternalNotes,
		duplicateOf, needsInfoDueAt, isClosed, reportID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if cmd.RowsAffected() == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	_ = h.insertEvent(c, reportID, "status_change", "organization", orgID, "", map[string]any{
		"from":         currentStatus,
		"to":           newStatus,
		"duplicate_of": payload.DuplicateOf,
		"severity":     severity,
	})
	log.Printf("audit report_status_change report_id=%s org_id=%s status=%s", reportID, orgID, newStatus)
	_ = h.notifyReporterStatus(c, reportID, newStatus, payload.PublicNotes, payload.StatusReason)
	_ = h.sendOrgWebhook(c.Request.Context(), orgID, "report.status_changed", map[string]any{
		"report_id":       reportID,
		"previous_status": currentStatus,
		"status":          newStatus,
		"status_reason":   payload.StatusReason,
		"public_notes":    payload.PublicNotes,
		"internal_notes":  payload.InternalNotes,
		"duplicate_of":    payload.DuplicateOf,
	})
	c.Status(http.StatusNoContent)
}

func (h *Handler) AssignReportOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var payload struct {
		AssigneeName  string `json:"assignee_name"`
		AssigneeEmail string `json:"assignee_email"`
		Clear         bool   `json:"clear"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	payload.AssigneeName = sanitizeText(payload.AssigneeName)
	payload.AssigneeEmail = strings.TrimSpace(payload.AssigneeEmail)

	if !payload.Clear && payload.AssigneeName == "" && payload.AssigneeEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "assignee_name or assignee_email is required"})
		return
	}
	if payload.AssigneeEmail != "" && !validateEmail(payload.AssigneeEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignee_email"})
		return
	}

	var name any
	var email any
	if !payload.Clear {
		if payload.AssigneeName != "" {
			name = payload.AssigneeName
		}
		if payload.AssigneeEmail != "" {
			email = payload.AssigneeEmail
		}
	}

	cmd, err := h.DB.Exec(c.Request.Context(), `
		UPDATE vdp_reports r
		SET assignee_name=$1,
		    assignee_email=$2,
		    updated_at=NOW()
		FROM vdp_programs p
		WHERE r.id=$3 AND r.program_id=p.id AND p.org_id=$4`,
		name, email, reportID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if cmd.RowsAffected() == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	_ = h.insertEvent(c, reportID, "assignment", "organization", orgID, "", map[string]any{
		"assignee_name":  payload.AssigneeName,
		"assignee_email": payload.AssigneeEmail,
		"cleared":        payload.Clear,
	})
	_ = h.sendOrgWebhook(c.Request.Context(), orgID, "report.assigned", map[string]any{
		"report_id":      reportID,
		"assignee_name":  payload.AssigneeName,
		"assignee_email": payload.AssigneeEmail,
		"cleared":        payload.Clear,
	})
	c.Status(http.StatusNoContent)
}

func (h *Handler) AcceptProcedure(c *gin.Context) {
	userID, err := userIDFromContext(c)
	if err != nil || !validateUUID(userID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	procID := c.Param("id")
	if procID == "" || !validateUUID(procID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM disclosure_procedures WHERE id=$1 AND status='active')`, procID).Scan(&exists); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	_, err = h.DB.Exec(c.Request.Context(), `
		INSERT INTO policy_acceptances (user_id, procedure_id, accepted_at)
		VALUES ($1,$2,NOW())
		ON CONFLICT (user_id, procedure_id) DO UPDATE SET accepted_at=EXCLUDED.accepted_at`,
		userID, procID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	log.Printf("audit policy_acceptance user_id=%s procedure_id=%s", userID, procID)
	c.Status(http.StatusNoContent)
}

func (h *Handler) AddReportCommentOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var payload struct {
		Body string `json:"body"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	body := sanitizeText(payload.Body)
	if body == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	cmd, err := h.DB.Exec(c.Request.Context(), `
		INSERT INTO vdp_report_comments (report_id, author_type, author_id, body)
		SELECT r.id, 'organization', $1, $2
		FROM vdp_reports r JOIN vdp_programs p ON r.program_id=p.id
		WHERE r.id=$3 AND p.org_id=$4`, orgID, body, reportID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if cmd.RowsAffected() == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	_ = h.insertEvent(c, reportID, "comment", "organization", orgID, "", map[string]any{})
	_ = h.notifyReporterComment(c, reportID, body)
	c.Status(http.StatusCreated)
}

func (h *Handler) SendReportMessageOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var payload struct {
		Subject string `json:"subject"`
		Body    string `json:"body"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	subject := sanitizeEmailSubject(payload.Subject)
	body := strings.TrimSpace(payload.Body)
	if body == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message body required"})
		return
	}
	if len(body) > 8000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message too long"})
		return
	}
	if subject == "" {
		subject = "VDP Message"
	}

	var email string
	err = h.DB.QueryRow(c.Request.Context(), `
		SELECT r.reporter_email
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE r.id=$1 AND p.org_id=$2`, reportID, orgID).Scan(&email)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if strings.TrimSpace(email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reporter email not provided"})
		return
	}
	if h.Mailer == nil || !h.Mailer.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email not configured"})
		return
	}
	if err := h.enqueueEmail(c.Request.Context(), orgID, reportID, email, subject, body); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	_ = h.insertEvent(c, reportID, "org_message", "organization", orgID, "", map[string]any{})
	log.Printf("audit report_message_sent report_id=%s org_id=%s", reportID, orgID)
	c.Status(http.StatusNoContent)
}

func (h *Handler) AddReportCommentPublic(c *gin.Context) {
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var payload struct {
		Email string `json:"email"`
		Body  string `json:"body"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	payload.Email = strings.TrimSpace(payload.Email)
	if !validateEmail(payload.Email) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	body := sanitizeText(payload.Body)
	if body == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	idemKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	idemScope := "public-comment:" + reportID + ":" + strings.ToLower(payload.Email)
	idemHash := hashPayloadMap(map[string]any{
		"report_id":           reportID,
		"email":               strings.ToLower(payload.Email),
		"body":                body,
		"idempotency_version": "v1",
	})
	idemStarted := false
	idemCompleted := false
	if idemKey != "" {
		cached, code, respBody, err := h.idempotencyStart(c.Request.Context(), idemKey, "add_comment_public", idemScope, idemHash)
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if cached {
			c.JSON(code, respBody)
			return
		}
		idemStarted = true
		defer func() {
			if !idemCompleted {
				_ = h.idempotencyAbort(c.Request.Context(), idemKey, "add_comment_public", idemScope, idemHash)
			}
		}()
	}

	cmd, err := h.DB.Exec(c.Request.Context(), `
		INSERT INTO vdp_report_comments (report_id, author_type, author_email, body)
		SELECT id, 'public', $1, $2 FROM vdp_reports WHERE id=$3 AND reporter_email=$1`,
		payload.Email, body, reportID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if cmd.RowsAffected() == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	_ = h.insertEvent(c, reportID, "comment", "public", "", payload.Email, map[string]any{})
	resp := map[string]any{"ok": true}
	if idemStarted {
		if err := h.idempotencyComplete(c.Request.Context(), idemKey, "add_comment_public", idemScope, idemHash, http.StatusCreated, resp); err == nil {
			idemCompleted = true
		}
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) ListReportCommentsPublic(c *gin.Context) {
	reportID := c.Param("id")
	email := strings.TrimSpace(c.Query("email"))
	if reportID == "" || !validateUUID(reportID) || !validateEmail(email) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM vdp_reports WHERE id=$1 AND reporter_email=$2)`, reportID, email).Scan(&exists); err != nil || !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id, author_type, COALESCE(author_email,''), body, created_at
		FROM vdp_report_comments WHERE report_id=$1 ORDER BY created_at ASC`, reportID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID          string    `json:"id"`
		AuthorType  string    `json:"author_type"`
		AuthorEmail string    `json:"author_email"`
		Body        string    `json:"body"`
		CreatedAt   time.Time `json:"created_at"`
	}
	res := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.AuthorType, &it.AuthorEmail, &it.Body, &it.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, it)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) ListReportCommentsOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT c.id, c.author_type, COALESCE(c.author_email,''), c.body, c.created_at
		FROM vdp_report_comments c
		JOIN vdp_reports r ON c.report_id = r.id
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE c.report_id=$1 AND p.org_id=$2
		ORDER BY c.created_at ASC`, reportID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID          string    `json:"id"`
		AuthorType  string    `json:"author_type"`
		AuthorEmail string    `json:"author_email"`
		Body        string    `json:"body"`
		CreatedAt   time.Time `json:"created_at"`
	}
	res := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.AuthorType, &it.AuthorEmail, &it.Body, &it.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, it)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) ListReportEventsOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT e.id, e.event_type, e.actor_type, COALESCE(e.actor_email,''), e.details, e.created_at
		FROM vdp_report_events e
		JOIN vdp_reports r ON e.report_id = r.id
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE e.report_id=$1 AND p.org_id=$2
		ORDER BY e.created_at ASC`, reportID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID         string          `json:"id"`
		EventType  string          `json:"event_type"`
		ActorType  string          `json:"actor_type"`
		ActorEmail string          `json:"actor_email"`
		Details    json.RawMessage `json:"details"`
		CreatedAt  time.Time       `json:"created_at"`
	}
	res := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.EventType, &it.ActorType, &it.ActorEmail, &it.Details, &it.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, it)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) UploadReportAttachmentPublic(c *gin.Context) {
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	reporterEmail := strings.TrimSpace(c.PostForm("reporter_email"))
	if !validateEmail(reporterEmail) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM vdp_reports WHERE id=$1 AND reporter_email=$2)`, reportID, reporterEmail).Scan(&exists); err != nil || !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size <= 0 || header.Size > maxUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large"})
		return
	}
	if !allowedAttachment(header.Filename, header.Header.Get("Content-Type")) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file type"})
		return
	}

	data, err := readAllLimited(file, maxUploadBytes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return
	}
	checksum := hashBytesSHA256(data)
	idemKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	idemScope := "public-attachment:" + reportID + ":" + strings.ToLower(reporterEmail)
	idemHash := hashPayloadMap(map[string]any{
		"report_id":           reportID,
		"reporter_email":      strings.ToLower(reporterEmail),
		"filename":            header.Filename,
		"content_type":        header.Header.Get("Content-Type"),
		"size_bytes":          len(data),
		"checksum_sha256":     checksum,
		"idempotency_version": "v1",
	})
	idemStarted := false
	idemCompleted := false
	if idemKey != "" {
		cached, code, respBody, err := h.idempotencyStart(c.Request.Context(), idemKey, "upload_attachment_public", idemScope, idemHash)
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if cached {
			c.JSON(code, respBody)
			return
		}
		idemStarted = true
		defer func() {
			if !idemCompleted {
				_ = h.idempotencyAbort(c.Request.Context(), idemKey, "upload_attachment_public", idemScope, idemHash)
			}
		}()
	}
	var existingAttachmentID string
	err = h.DB.QueryRow(c.Request.Context(), `
		SELECT id
		FROM vdp_report_attachments
		WHERE report_id=$1 AND uploaded_by_email=$2 AND checksum_sha256=$3
		ORDER BY created_at DESC
		LIMIT 1`, reportID, reporterEmail, checksum).Scan(&existingAttachmentID)
	if err == nil {
		resp := map[string]any{"id": existingAttachmentID, "duplicate": true}
		if idemStarted {
			if err := h.idempotencyComplete(c.Request.Context(), idemKey, "upload_attachment_public", idemScope, idemHash, http.StatusCreated, resp); err == nil {
				idemCompleted = true
			}
		}
		c.JSON(http.StatusCreated, resp)
		return
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if ok, sig, err := h.scanBytes(c, data); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	} else if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "malware detected", "signature": sig})
		return
	}
	objectKey := objectKeyForAttachment(reportID, header.Filename, checksum)

	if err := h.Store.PutObject(c.Request.Context(), objectKey, bytes.NewReader(data), int64(len(data)), header.Header.Get("Content-Type")); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	var attachmentID string
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO vdp_report_attachments (report_id, object_key, filename, content_type, size_bytes, uploaded_by_email, checksum_sha256)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id`, reportID, objectKey, header.Filename, header.Header.Get("Content-Type"), len(data), reporterEmail, checksum).Scan(&attachmentID)
	if err != nil {
		errText := strings.ToLower(err.Error())
		if strings.Contains(errText, "ux_vdp_report_attachments_report_email_checksum") || strings.Contains(errText, "duplicate key") {
			_ = h.DB.QueryRow(c.Request.Context(), `
				SELECT id
				FROM vdp_report_attachments
				WHERE report_id=$1 AND uploaded_by_email=$2 AND checksum_sha256=$3
				ORDER BY created_at DESC
				LIMIT 1`, reportID, reporterEmail, checksum).Scan(&attachmentID)
		} else {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
	}
	if attachmentID == "" {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	resp := map[string]any{"id": attachmentID}
	if idemStarted {
		if err := h.idempotencyComplete(c.Request.Context(), idemKey, "upload_attachment_public", idemScope, idemHash, http.StatusCreated, resp); err == nil {
			idemCompleted = true
		}
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) ListReportAttachmentsPublic(c *gin.Context) {
	reportID := c.Param("id")
	email := strings.TrimSpace(c.Query("email"))
	if reportID == "" || !validateUUID(reportID) || !validateEmail(email) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM vdp_reports WHERE id=$1 AND reporter_email=$2)`, reportID, email).Scan(&exists); err != nil || !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id, filename, content_type, size_bytes, created_at
		FROM vdp_report_attachments WHERE report_id=$1 ORDER BY created_at DESC`, reportID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID        string    `json:"id"`
		Filename  string    `json:"filename"`
		Type      string    `json:"content_type"`
		SizeBytes int64     `json:"size_bytes"`
		CreatedAt time.Time `json:"created_at"`
	}
	res := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.Filename, &it.Type, &it.SizeBytes, &it.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, it)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) ListReportAttachmentsOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if reportID == "" || !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT a.id, a.filename, a.content_type, a.size_bytes, a.created_at
		FROM vdp_report_attachments a
		JOIN vdp_reports r ON a.report_id = r.id
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE a.report_id=$1 AND p.org_id=$2
		ORDER BY a.created_at DESC`, reportID, orgID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		ID        string    `json:"id"`
		Filename  string    `json:"filename"`
		Type      string    `json:"content_type"`
		SizeBytes int64     `json:"size_bytes"`
		CreatedAt time.Time `json:"created_at"`
	}
	res := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.Filename, &it.Type, &it.SizeBytes, &it.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, it)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) GetReportAttachment(c *gin.Context) {
	reportID := c.Param("id")
	attID := c.Param("attId")
	email := strings.TrimSpace(c.Query("email"))
	if reportID == "" || attID == "" || !validateUUID(reportID) || !validateUUID(attID) || !validateEmail(email) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT a.object_key, a.filename, a.content_type
		FROM vdp_report_attachments a
		JOIN vdp_reports r ON a.report_id = r.id
		WHERE a.id=$1 AND a.report_id=$2 AND r.reporter_email=$3`, attID, reportID, email)
	var key, name, ctype string
	if err := row.Scan(&key, &name, &ctype); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	obj, info, err := h.Store.GetObject(c.Request.Context(), key)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	defer obj.Close()

	c.Header("Content-Type", ctype)
	c.Header("Content-Length", itoa64(info.Size))
	c.Header("Content-Disposition", "attachment; filename=\""+name+"\"")
	_, _ = io.Copy(c.Writer, obj)
}

func (h *Handler) GetReportAttachmentOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	attID := c.Param("attId")
	if reportID == "" || attID == "" || !validateUUID(reportID) || !validateUUID(attID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT a.object_key, a.filename, a.content_type
		FROM vdp_report_attachments a
		JOIN vdp_reports r ON a.report_id = r.id
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE a.id=$1 AND a.report_id=$2 AND p.org_id=$3`, attID, reportID, orgID)
	var key, name, ctype string
	if err := row.Scan(&key, &name, &ctype); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	obj, info, err := h.Store.GetObject(c.Request.Context(), key)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	defer obj.Close()

	c.Header("Content-Type", ctype)
	c.Header("Content-Length", itoa64(info.Size))
	c.Header("Content-Disposition", "attachment; filename=\""+name+"\"")
	_, _ = io.Copy(c.Writer, obj)
}

func (h *Handler) SubmitVulnerabilityReport(c *gin.Context) {
	markEndpointDeprecated(c, "/public/reports", "SubmitVulnerabilityReport alias is deprecated; use /public/reports.")
	h.SubmitReportPublic(c)
}

func (h *Handler) SubmitReportPublic(c *gin.Context) {
	var p publicReportPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	p.ProgramID = strings.TrimSpace(p.ProgramID)
	p.ReporterEmail = strings.TrimSpace(p.ReporterEmail)
	p.ReporterName = sanitizeText(p.ReporterName)
	p.Title = sanitizeText(p.Title)
	p.AffectedAsset = sanitizeText(p.AffectedAsset)
	p.VulnerabilityType = sanitizeText(p.VulnerabilityType)
	p.Description = sanitizeText(p.Description)
	p.StepsToReproduce = sanitizeText(p.StepsToReproduce)
	p.Impact = sanitizeText(p.Impact)
	p.Severity = strings.ToLower(strings.TrimSpace(p.Severity))
	p.POC = sanitizeText(p.POC)
	p.AttackVector = sanitizeText(p.AttackVector)
	p.CWE = sanitizeText(p.CWE)
	p.ReferenceLinks = sanitizeText(p.ReferenceLinks)

	if p.ProgramID == "" || p.Title == "" || p.AffectedAsset == "" || p.VulnerabilityType == "" || p.Description == "" || p.StepsToReproduce == "" || p.Impact == "" || p.Severity == "" || p.ReporterEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing required fields"})
		return
	}
	if !validateUUID(p.ProgramID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if !validateEmail(p.ReporterEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email"})
		return
	}
	if err := validateReportSizes(p.Title, p.Description, p.POC); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateReportDetails(p.AffectedAsset, p.VulnerabilityType, p.StepsToReproduce, p.Impact, p.ReporterName, p.AttackVector, p.CWE, p.ReferenceLinks); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !inAllowlist(p.Severity, "low", "medium", "high", "critical") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid severity"})
		return
	}
	if !p.AcceptedPolicy {
		c.JSON(http.StatusForbidden, gin.H{"error": "policy must be accepted"})
		return
	}

	var orgID, procID, scope, outOfScope, programStatus, visibility, procStatus, reportingReqs string
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT p.org_id, p.procedure_id, d.scope, d.out_of_scope, p.status, p.visibility, d.status, d.reporting_requirements
		FROM vdp_programs p
		JOIN disclosure_procedures d ON p.procedure_id = d.id
		WHERE p.id=$1`, p.ProgramID)
	if err := row.Scan(&orgID, &procID, &scope, &outOfScope, &programStatus, &visibility, &procStatus, &reportingReqs); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if strings.ToLower(programStatus) != "active" || strings.ToLower(visibility) != "public" || strings.ToLower(procStatus) != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "program not accepting reports"})
		return
	}
	if requiresPOC(reportingReqs) && p.POC == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "poc required by policy"})
		return
	}

	if violatesScope(scope, outOfScope, p.Title, p.Description, p.AffectedAsset, p.VulnerabilityType, p.StepsToReproduce, p.Impact, p.AttackVector, p.CWE, p.ReferenceLinks) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "report out of scope"})
		return
	}
	quality := qualityFromPublicPayload(p)
	if !quality.passesGate() {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error":   "insufficient report evidence quality",
			"quality": quality,
		})
		return
	}
	qualityFlagsJSON := quality.flagsJSON()
	settings, err := h.getOrgSettings(c.Request.Context(), orgID)
	if err != nil {
		settings = defaultOrgSettings()
	}
	triageDueAt, resolutionDueAt := buildReportSLADates(time.Now().UTC(), p.Severity, settings)
	idemKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	idemScope := "public:" + strings.ToLower(p.ReporterEmail)
	idemHash := hashPublicReportPayload(p)
	idemStarted := false
	idemCompleted := false
	if idemKey != "" {
		cached, code, body, err := h.idempotencyStart(c.Request.Context(), idemKey, "submit_report_public", idemScope, idemHash)
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if cached {
			c.JSON(code, body)
			return
		}
		idemStarted = true
		defer func() {
			if !idemCompleted {
				_ = h.idempotencyAbort(c.Request.Context(), idemKey, "submit_report_public", idemScope, idemHash)
			}
		}()
	}

	acceptedIP := clientIP(c)
	_, err = h.DB.Exec(c.Request.Context(), `
		INSERT INTO policy_acceptances_public (reporter_email, procedure_id, accepted_at, accepted_ip)
		VALUES ($1,$2,NOW(),$3)`, p.ReporterEmail, procID, acceptedIP)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	log.Printf("audit policy_acceptance_public email=%s procedure_id=%s", p.ReporterEmail, procID)

	var id string
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO vdp_reports (
			program_id, hacker_id, reporter_email, reporter_name,
			title, affected_asset, vulnerability_type, description,
			steps_to_reproduce, impact, severity, poc, attack_vector, cwe, reference_links, status,
			triage_due_at, resolution_due_at,
			evidence_quality_score, evidence_quality_grade, evidence_quality_flags
		)
		VALUES ($1,NULL, $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'new',$15,$16,$17,$18,$19::jsonb)
		RETURNING id`,
		p.ProgramID, p.ReporterEmail, p.ReporterName, p.Title, p.AffectedAsset, p.VulnerabilityType, p.Description,
		p.StepsToReproduce, p.Impact, p.Severity, p.POC, p.AttackVector, p.CWE, p.ReferenceLinks,
		triageDueAt, resolutionDueAt, quality.Score, quality.Grade, string(qualityFlagsJSON)).Scan(&id)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if triageErr := h.runAutomatedTriage(c.Request.Context(), id); triageErr != nil {
		log.Printf("automated triage failed report_id=%s err=%v", id, triageErr)
	}

	_ = h.insertEvent(c, id, "report_created", "public", "", p.ReporterEmail, map[string]any{})
	log.Printf("audit report_created_public report_id=%s email=%s program_id=%s", id, p.ReporterEmail, p.ProgramID)
	msg := "Report: " + p.Title
	if p.ReporterEmail != "" {
		msg += " | Reporter contact provided"
	}
	_ = h.createNotification(c, orgID, id, "New report submitted", msg)
	_ = h.notifyOrgNewReport(c, orgID, id, p.Title, p.ReporterEmail != "")
	_ = h.notifyReporterCreated(p.ReporterEmail, id)
	_ = h.sendOrgWebhook(c.Request.Context(), orgID, "report.created", map[string]any{
		"report_id":      id,
		"program_id":     p.ProgramID,
		"title":          p.Title,
		"severity":       p.Severity,
		"reporter_email": p.ReporterEmail,
		"submitted_via":  "public",
	})
	resp := map[string]any{
		"id":            id,
		"quality_score": quality.Score,
		"quality_grade": quality.Grade,
	}
	if idemStarted {
		if err := h.idempotencyComplete(c.Request.Context(), idemKey, "submit_report_public", idemScope, idemHash, http.StatusCreated, resp); err != nil {
			log.Printf("idempotency complete failed key=%s endpoint=submit_report_public err=%v", idemKey, err)
		} else {
			idemCompleted = true
		}
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) GetPublicReportStatus(c *gin.Context) {
	reportID := c.Param("id")
	email := strings.TrimSpace(c.Query("email"))
	if reportID == "" || !validateUUID(reportID) || !validateEmail(email) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT id, status, COALESCE(status_reason,''), COALESCE(public_notes,''), created_at
		FROM vdp_reports WHERE id=$1 AND reporter_email=$2`, reportID, email)
	var id, status, reason, notes string
	var created time.Time
	if err := row.Scan(&id, &status, &reason, &notes, &created); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":            id,
		"status":        status,
		"status_reason": reason,
		"public_notes":  notes,
		"created_at":    created,
	})
}

func (h *Handler) SubmitReport(c *gin.Context) {
	userID, err := userIDFromContext(c)
	if err != nil || !validateUUID(userID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	var p reportPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	p.ProgramID = strings.TrimSpace(p.ProgramID)
	p.Title = sanitizeText(p.Title)
	p.AffectedAsset = sanitizeText(p.AffectedAsset)
	p.VulnerabilityType = sanitizeText(p.VulnerabilityType)
	p.Description = sanitizeText(p.Description)
	p.StepsToReproduce = sanitizeText(p.StepsToReproduce)
	p.Impact = sanitizeText(p.Impact)
	p.Severity = strings.ToLower(strings.TrimSpace(p.Severity))
	p.POC = sanitizeText(p.POC)
	p.AttackVector = sanitizeText(p.AttackVector)
	p.CWE = sanitizeText(p.CWE)
	p.ReferenceLinks = sanitizeText(p.ReferenceLinks)

	if p.ProgramID == "" || p.Title == "" || p.AffectedAsset == "" || p.VulnerabilityType == "" || p.Description == "" || p.StepsToReproduce == "" || p.Impact == "" || p.Severity == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing required fields"})
		return
	}
	if !validateUUID(p.ProgramID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if err := validateReportSizes(p.Title, p.Description, p.POC); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateReportDetails(p.AffectedAsset, p.VulnerabilityType, p.StepsToReproduce, p.Impact, "", p.AttackVector, p.CWE, p.ReferenceLinks); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !inAllowlist(p.Severity, "low", "medium", "high", "critical") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid severity"})
		return
	}

	var orgID, procID, scope, outOfScope, programStatus, visibility, procStatus, reportingReqs string
	row := h.DB.QueryRow(c.Request.Context(), `
		SELECT p.org_id, p.procedure_id, d.scope, d.out_of_scope, p.status, p.visibility, d.status, d.reporting_requirements
		FROM vdp_programs p
		JOIN disclosure_procedures d ON p.procedure_id = d.id
		WHERE p.id=$1`, p.ProgramID)
	if err := row.Scan(&orgID, &procID, &scope, &outOfScope, &programStatus, &visibility, &procStatus, &reportingReqs); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if strings.ToLower(programStatus) != "active" || strings.ToLower(visibility) != "public" || strings.ToLower(procStatus) != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "program not accepting reports"})
		return
	}
	if requiresPOC(reportingReqs) && p.POC == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "poc required by policy"})
		return
	}

	var accepted bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM policy_acceptances WHERE user_id=$1 AND procedure_id=$2)`, userID, procID).Scan(&accepted); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if !accepted {
		c.JSON(http.StatusForbidden, gin.H{"error": "policy not accepted"})
		return
	}

	if violatesScope(scope, outOfScope, p.Title, p.Description, p.AffectedAsset, p.VulnerabilityType, p.StepsToReproduce, p.Impact, p.AttackVector, p.CWE, p.ReferenceLinks) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "report out of scope"})
		return
	}
	quality := qualityFromAuthenticatedPayload(p)
	if !quality.passesGate() {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error":   "insufficient report evidence quality",
			"quality": quality,
		})
		return
	}
	qualityFlagsJSON := quality.flagsJSON()
	settings, err := h.getOrgSettings(c.Request.Context(), orgID)
	if err != nil {
		settings = defaultOrgSettings()
	}
	triageDueAt, resolutionDueAt := buildReportSLADates(time.Now().UTC(), p.Severity, settings)
	idemKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	idemScope := "user:" + userID
	idemHash := hashAuthenticatedReportPayload(userID, p)
	idemStarted := false
	idemCompleted := false
	if idemKey != "" {
		cached, code, body, err := h.idempotencyStart(c.Request.Context(), idemKey, "submit_report_authenticated", idemScope, idemHash)
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if cached {
			c.JSON(code, body)
			return
		}
		idemStarted = true
		defer func() {
			if !idemCompleted {
				_ = h.idempotencyAbort(c.Request.Context(), idemKey, "submit_report_authenticated", idemScope, idemHash)
			}
		}()
	}

	var id string
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO vdp_reports (
			program_id, hacker_id, reporter_email, reporter_name,
			title, affected_asset, vulnerability_type, description,
			steps_to_reproduce, impact, severity, poc, attack_vector, cwe, reference_links, status,
			triage_due_at, resolution_due_at,
			evidence_quality_score, evidence_quality_grade, evidence_quality_flags
		)
		VALUES ($1,$2,'','', $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'new',$14,$15,$16,$17,$18::jsonb)
		RETURNING id`,
		p.ProgramID, userID, p.Title, p.AffectedAsset, p.VulnerabilityType, p.Description,
		p.StepsToReproduce, p.Impact, p.Severity, p.POC, p.AttackVector, p.CWE, p.ReferenceLinks,
		triageDueAt, resolutionDueAt, quality.Score, quality.Grade, string(qualityFlagsJSON)).Scan(&id)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if triageErr := h.runAutomatedTriage(c.Request.Context(), id); triageErr != nil {
		log.Printf("automated triage failed report_id=%s err=%v", id, triageErr)
	}

	_ = h.insertEvent(c, id, "report_created", "hacker", userID, "", map[string]any{})
	log.Printf("audit report_created report_id=%s user_id=%s program_id=%s", id, userID, p.ProgramID)
	msg := "Report: " + p.Title
	_ = h.createNotification(c, orgID, id, "New report submitted", msg)
	_ = h.sendOrgWebhook(c.Request.Context(), orgID, "report.created", map[string]any{
		"report_id":     id,
		"program_id":    p.ProgramID,
		"title":         p.Title,
		"severity":      p.Severity,
		"submitted_via": "authenticated_researcher",
		"hacker_id":     userID,
	})
	resp := map[string]any{
		"id":            id,
		"quality_score": quality.Score,
		"quality_grade": quality.Grade,
	}
	if idemStarted {
		if err := h.idempotencyComplete(c.Request.Context(), idemKey, "submit_report_authenticated", idemScope, idemHash, http.StatusCreated, resp); err != nil {
			log.Printf("idempotency complete failed key=%s endpoint=submit_report_authenticated err=%v", idemKey, err)
		} else {
			idemCompleted = true
		}
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) ListMyReports(c *gin.Context) {
	userID, err := userIDFromContext(c)
	if err != nil || !validateUUID(userID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id, program_id, hacker_id, reporter_email, title, description, severity, poc, status, created_at
		FROM vdp_reports
		WHERE hacker_id=$1
		ORDER BY created_at DESC`, userID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type report struct {
		ID            string    `json:"id"`
		ProgramID     string    `json:"program_id"`
		HackerID      string    `json:"hacker_id"`
		ReporterEmail string    `json:"reporter_email"`
		Title         string    `json:"title"`
		Description   string    `json:"description"`
		Severity      string    `json:"severity"`
		POC           string    `json:"poc"`
		Status        string    `json:"status"`
		CreatedAt     time.Time `json:"created_at"`
	}
	res := []report{}
	for rows.Next() {
		var r report
		if err := rows.Scan(&r.ID, &r.ProgramID, &r.HackerID, &r.ReporterEmail, &r.Title, &r.Description, &r.Severity, &r.POC, &r.Status, &r.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, r)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) ListAdminOrganizations(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	query := `
		SELECT id, name, slug, COALESCE(contact_email,''), COALESCE(website,''), COALESCE(description,''), created_at, updated_at
		FROM organizations`
	args := []any{}
	if q != "" {
		query += " WHERE name ILIKE '%' || $1 || '%' OR slug ILIKE '%' || $1 || '%'"
		args = append(args, q)
	}
	query += " ORDER BY created_at DESC"

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type org struct {
		ID           string    `json:"id"`
		Name         string    `json:"name"`
		Slug         string    `json:"slug"`
		ContactEmail string    `json:"contact_email"`
		Website      string    `json:"website"`
		Description  string    `json:"description"`
		CreatedAt    time.Time `json:"created_at"`
		UpdatedAt    time.Time `json:"updated_at"`
	}
	res := []org{}
	for rows.Next() {
		var o org
		if err := rows.Scan(&o.ID, &o.Name, &o.Slug, &o.ContactEmail, &o.Website, &o.Description, &o.CreatedAt, &o.UpdatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, o)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) ListAdminPrograms(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT p.id, p.org_id, o.name, p.procedure_id, COALESCE(p.title,''), COALESCE(p.description,''), COALESCE(p.contact_email,''), p.visibility, p.status, p.created_at
		FROM vdp_programs p
		JOIN organizations o ON o.id = p.org_id
		ORDER BY p.created_at DESC`)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type program struct {
		ID           string    `json:"id"`
		OrgID        string    `json:"org_id"`
		OrgName      string    `json:"org_name"`
		ProcedureID  string    `json:"procedure_id"`
		Title        string    `json:"title"`
		Description  string    `json:"description"`
		ContactEmail string    `json:"contact_email"`
		Visibility   string    `json:"visibility"`
		Status       string    `json:"status"`
		CreatedAt    time.Time `json:"created_at"`
	}
	res := []program{}
	for rows.Next() {
		var p program
		if err := rows.Scan(&p.ID, &p.OrgID, &p.OrgName, &p.ProcedureID, &p.Title, &p.Description, &p.ContactEmail, &p.Visibility, &p.Status, &p.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, p)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) UpdateAdminProgram(c *gin.Context) {
	programID := c.Param("id")
	if programID == "" || !validateUUID(programID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	var p programPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	p.Title = sanitizeText(p.Title)
	p.Description = sanitizeText(p.Description)
	p.ContactEmail = strings.TrimSpace(p.ContactEmail)
	p.Visibility = strings.ToLower(strings.TrimSpace(p.Visibility))
	p.Status = strings.ToLower(strings.TrimSpace(p.Status))
	if p.Visibility != "" && !inAllowlist(p.Visibility, "public", "private") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid visibility"})
		return
	}
	if p.Status != "" && !inAllowlist(p.Status, "active", "draft", "paused") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	if p.ContactEmail != "" && !validateEmail(p.ContactEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contact email"})
		return
	}
	if p.Visibility == "" && p.Status == "" && p.Title == "" && p.Description == "" && p.ContactEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	curVisibility := ""
	curStatus := ""
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT visibility, status FROM vdp_programs WHERE id=$1`, programID).Scan(&curVisibility, &curStatus); err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if p.Visibility == "" {
		p.Visibility = curVisibility
	}
	if p.Status == "" {
		p.Status = curStatus
	}

	cmd, err := h.DB.Exec(c.Request.Context(), `
		UPDATE vdp_programs
		SET
			visibility=$1,
			status=$2,
			title=COALESCE(NULLIF($3,''), title),
			description=COALESCE(NULLIF($4,''), description),
			contact_email=COALESCE(NULLIF($5,''), contact_email)
		WHERE id=$6`,
		p.Visibility, p.Status, p.Title, p.Description, p.ContactEmail, programID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	if cmd.RowsAffected() == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) ListAdminReports(c *gin.Context) {
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	severity := strings.ToLower(strings.TrimSpace(c.Query("severity")))
	search := strings.TrimSpace(c.Query("q"))
	orgID := strings.TrimSpace(c.Query("org_id"))

	query := `
		SELECT r.id, r.program_id, p.org_id, o.name, r.title, r.severity, r.status,
		       (CASE WHEN r.reporter_email IS NOT NULL AND r.reporter_email <> '' THEN true ELSE false END) AS has_email,
		       r.created_at
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		JOIN organizations o ON o.id = p.org_id
		WHERE 1=1`
	args := []any{}
	idx := 1
	if orgID != "" {
		if !validateUUID(orgID) {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		query += " AND p.org_id=$" + itoa(idx)
		args = append(args, orgID)
		idx++
	}
	if status != "" {
		query += " AND r.status=$" + itoa(idx)
		args = append(args, status)
		idx++
	}
	if severity != "" {
		query += " AND r.severity=$" + itoa(idx)
		args = append(args, severity)
		idx++
	}
	if search != "" {
		query += " AND (r.title ILIKE '%' || $" + itoa(idx) + " || '%' OR r.description ILIKE '%' || $" + itoa(idx) + " || '%')"
		args = append(args, search)
		idx++
	}
	query += " ORDER BY r.created_at DESC LIMIT 200"

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type report struct {
		ID               string    `json:"id"`
		ProgramID        string    `json:"program_id"`
		OrgID            string    `json:"org_id"`
		OrgName          string    `json:"org_name"`
		Title            string    `json:"title"`
		Severity         string    `json:"severity"`
		Status           string    `json:"status"`
		HasReporterEmail bool      `json:"has_reporter_email"`
		CreatedAt        time.Time `json:"created_at"`
	}
	res := []report{}
	for rows.Next() {
		var r report
		if err := rows.Scan(&r.ID, &r.ProgramID, &r.OrgID, &r.OrgName, &r.Title, &r.Severity, &r.Status, &r.HasReporterEmail, &r.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, r)
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) ListAdminEvents(c *gin.Context) {
	reportID := strings.TrimSpace(c.Query("report_id"))
	query := `
		SELECT id, report_id, event_type, actor_type, COALESCE(actor_id,''), COALESCE(actor_email,''), details, created_at
		FROM vdp_report_events`
	args := []any{}
	if reportID != "" {
		if !validateUUID(reportID) {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		query += " WHERE report_id=$1"
		args = append(args, reportID)
	}
	query += " ORDER BY created_at DESC LIMIT 200"

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type evt struct {
		ID         string          `json:"id"`
		ReportID   string          `json:"report_id"`
		EventType  string          `json:"event_type"`
		ActorType  string          `json:"actor_type"`
		ActorID    string          `json:"actor_id"`
		ActorEmail string          `json:"actor_email"`
		Details    json.RawMessage `json:"details"`
		CreatedAt  time.Time       `json:"created_at"`
	}
	res := []evt{}
	for rows.Next() {
		var e evt
		if err := rows.Scan(&e.ID, &e.ReportID, &e.EventType, &e.ActorType, &e.ActorID, &e.ActorEmail, &e.Details, &e.CreatedAt); err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		res = append(res, e)
	}
	c.JSON(http.StatusOK, res)
}

func markEndpointDeprecated(c *gin.Context, successor, message string) {
	c.Header("Deprecation", "true")
	c.Header("Sunset", legacyEndpointSunset)
	if successor != "" {
		c.Header("Link", "<"+successor+">; rel=\"successor-version\"")
	}
	if message != "" {
		c.Header("Warning", `299 - "`+message+`"`)
	}
}

func userIDFromContext(c *gin.Context) (string, error) {
	v, ok := c.Get(middleware.ContextUserID)
	if !ok {
		return "", errors.New("missing user")
	}
	id, ok := v.(string)
	if !ok || id == "" {
		return "", errors.New("invalid user")
	}
	return id, nil
}

func orgIDFromContext(c *gin.Context) (string, error) {
	v, ok := c.Get(middleware.ContextOrgID)
	if !ok {
		return "", errors.New("missing org")
	}
	id, ok := v.(string)
	if !ok || id == "" {
		return "", errors.New("invalid org")
	}
	return id, nil
}

func sanitizeText(s string) string {
	return html.EscapeString(strings.TrimSpace(s))
}

func sanitizeEmailSubject(s string) string {
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\r", " ")
	return strings.TrimSpace(s)
}

func parseDateQuery(val string) (*time.Time, bool, error) {
	if strings.TrimSpace(val) == "" {
		return nil, false, nil
	}
	if t, err := time.Parse("2006-01-02", val); err == nil {
		return &t, true, nil
	}
	if t, err := time.Parse(time.RFC3339, val); err == nil {
		return &t, false, nil
	}
	return nil, false, errors.New("invalid date")
}

func sanitizeProcedure(p procedurePayload) procedurePayload {
	p.Overview = sanitizeText(p.Overview)
	p.Scope = sanitizeText(p.Scope)
	p.OutOfScope = sanitizeText(p.OutOfScope)
	p.ReportingRequirements = sanitizeText(p.ReportingRequirements)
	p.SeverityRules = sanitizeText(p.SeverityRules)
	p.ResponseTimeline = sanitizeText(p.ResponseTimeline)
	p.LegalSafeHarbor = sanitizeText(p.LegalSafeHarbor)
	p.ProhibitedActions = sanitizeText(p.ProhibitedActions)
	p.Status = strings.ToLower(strings.TrimSpace(p.Status))
	return p
}

func validateProcedure(p procedurePayload) error {
	if p.Overview == "" || p.Scope == "" || p.OutOfScope == "" || p.ReportingRequirements == "" || p.SeverityRules == "" || p.ResponseTimeline == "" || p.LegalSafeHarbor == "" || p.ProhibitedActions == "" || p.Status == "" {
		return errors.New("missing required fields")
	}
	if !inAllowlist(p.Status, "draft", "active", "retired") {
		return errors.New("invalid status")
	}
	return nil
}

func inAllowlist(val string, items ...string) bool {
	for _, it := range items {
		if val == it {
			return true
		}
	}
	return false
}

func normalizeReportStatus(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

func isValidReportStatus(status string) bool {
	_, ok := validReportStatuses[normalizeReportStatus(status)]
	return ok
}

func isClosedReportStatus(status string) bool {
	switch normalizeReportStatus(status) {
	case "resolved", "duplicate", "informative", "not_applicable", "rejected":
		return true
	default:
		return false
	}
}

func statusRequiresReason(status string) bool {
	switch normalizeReportStatus(status) {
	case "duplicate", "informative", "not_applicable", "rejected", "needs_info":
		return true
	default:
		return false
	}
}

func isValidReportTransition(current, next string) bool {
	current = normalizeReportStatus(current)
	next = normalizeReportStatus(next)
	if current == next {
		return true
	}
	if !isValidReportStatus(current) || !isValidReportStatus(next) {
		return false
	}
	allowed, ok := reportStatusTransitions[current]
	if !ok {
		return false
	}
	_, ok = allowed[next]
	return ok
}

func buildReportSLADates(createdAt time.Time, severity string, settings orgSettingsPayload) (time.Time, time.Time) {
	if createdAt.IsZero() {
		createdAt = time.Now().UTC()
	}
	triageDue := createdAt.Add(time.Duration(settings.TriageSLAHours) * time.Hour)

	var resolutionDays int
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "critical":
		resolutionDays = settings.ResolutionSLACriticalDays
	case "high":
		resolutionDays = settings.ResolutionSLAHighDays
	case "medium":
		resolutionDays = settings.ResolutionSLAMediumDays
	default:
		resolutionDays = settings.ResolutionSLALowDays
	}
	if resolutionDays <= 0 {
		resolutionDays = 30
	}
	resolutionDue := createdAt.Add(time.Duration(resolutionDays) * 24 * time.Hour)
	return triageDue, resolutionDue
}

func hashPublicReportPayload(p publicReportPayload) string {
	return hashPayloadMap(map[string]any{
		"program_id":          p.ProgramID,
		"reporter_email":      strings.ToLower(strings.TrimSpace(p.ReporterEmail)),
		"reporter_name":       p.ReporterName,
		"title":               p.Title,
		"affected_asset":      p.AffectedAsset,
		"vulnerability_type":  p.VulnerabilityType,
		"description":         p.Description,
		"steps_to_reproduce":  p.StepsToReproduce,
		"impact":              p.Impact,
		"severity":            p.Severity,
		"poc":                 p.POC,
		"attack_vector":       p.AttackVector,
		"cwe":                 p.CWE,
		"reference_links":     p.ReferenceLinks,
		"accepted_policy":     p.AcceptedPolicy,
		"idempotency_version": "v1",
	})
}

func hashAuthenticatedReportPayload(userID string, p reportPayload) string {
	return hashPayloadMap(map[string]any{
		"user_id":             userID,
		"program_id":          p.ProgramID,
		"title":               p.Title,
		"affected_asset":      p.AffectedAsset,
		"vulnerability_type":  p.VulnerabilityType,
		"description":         p.Description,
		"steps_to_reproduce":  p.StepsToReproduce,
		"impact":              p.Impact,
		"severity":            p.Severity,
		"poc":                 p.POC,
		"attack_vector":       p.AttackVector,
		"cwe":                 p.CWE,
		"reference_links":     p.ReferenceLinks,
		"idempotency_version": "v1",
	})
}

func hashPayloadMap(payload map[string]any) string {
	raw, err := json.Marshal(payload)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func hashBytesSHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func objectKeyForAttachment(reportID, filename, checksum string) string {
	reportID = strings.TrimSpace(reportID)
	filename = sanitizeAttachmentObjectName(filename)
	checksum = strings.ToLower(strings.TrimSpace(checksum))
	if checksum == "" {
		checksum = "nochecksum"
	}
	if len(checksum) > 16 {
		checksum = checksum[:16]
	}
	return storage.SafeObjectKey("reports", reportID, "attachments", checksum+"-"+filename)
}

func sanitizeAttachmentObjectName(filename string) string {
	name := filepath.Base(strings.TrimSpace(filename))
	name = strings.ReplaceAll(name, "..", "")
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	name = strings.ReplaceAll(name, " ", "-")
	if name == "" || name == "." {
		return "attachment.bin"
	}
	return name
}

func (h *Handler) idempotencyStart(ctx context.Context, key, endpoint, scope, requestHash string) (bool, int, map[string]any, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return false, 0, nil, nil
	}
	if len(key) > 180 {
		return true, http.StatusBadRequest, map[string]any{"error": "idempotency key too long"}, nil
	}
	if requestHash == "" {
		return true, http.StatusBadRequest, map[string]any{"error": "invalid idempotency fingerprint"}, nil
	}
	_, _ = h.DB.Exec(ctx, `DELETE FROM vdp_idempotency_keys WHERE expires_at < NOW()`)

	cmd, err := h.DB.Exec(ctx, `
		INSERT INTO vdp_idempotency_keys (
			idempotency_key, endpoint, scope, request_hash, status, created_at, updated_at, expires_at
		)
		VALUES ($1,$2,$3,$4,'pending',NOW(),NOW(),NOW() + $5::interval)
		ON CONFLICT DO NOTHING`,
		key, endpoint, scope, requestHash, intervalAsSQL(defaultIdempotencyTTL))
	if err != nil {
		return false, 0, nil, err
	}
	if cmd.RowsAffected() == 1 {
		return false, 0, nil, nil
	}

	var existingHash, status string
	var responseCode *int
	var responseBody []byte
	if err := h.DB.QueryRow(ctx, `
		SELECT request_hash, status, response_code, COALESCE(response_body, '{}'::jsonb)
		FROM vdp_idempotency_keys
		WHERE idempotency_key=$1 AND endpoint=$2 AND scope=$3`, key, endpoint, scope).
		Scan(&existingHash, &status, &responseCode, &responseBody); err != nil {
		return false, 0, nil, err
	}
	if existingHash != requestHash {
		return true, http.StatusConflict, map[string]any{"error": "idempotency key already used with different request"}, nil
	}

	if status == "completed" && responseCode != nil {
		var body map[string]any
		if err := json.Unmarshal(responseBody, &body); err != nil || body == nil {
			body = map[string]any{}
		}
		return true, *responseCode, body, nil
	}

	return true, http.StatusConflict, map[string]any{"error": "request with same idempotency key is in progress"}, nil
}

func (h *Handler) idempotencyComplete(ctx context.Context, key, endpoint, scope, requestHash string, responseCode int, responseBody map[string]any) error {
	rawBody, err := json.Marshal(responseBody)
	if err != nil {
		return err
	}
	_, err = h.DB.Exec(ctx, `
		UPDATE vdp_idempotency_keys
		SET status='completed',
		    response_code=$5,
		    response_body=$6,
		    updated_at=NOW()
		WHERE idempotency_key=$1
		  AND endpoint=$2
		  AND scope=$3
		  AND request_hash=$4`, key, endpoint, scope, requestHash, responseCode, rawBody)
	return err
}

func (h *Handler) idempotencyAbort(ctx context.Context, key, endpoint, scope, requestHash string) error {
	_, err := h.DB.Exec(ctx, `
		DELETE FROM vdp_idempotency_keys
		WHERE idempotency_key=$1
		  AND endpoint=$2
		  AND scope=$3
		  AND request_hash=$4
		  AND status='pending'`, key, endpoint, scope, requestHash)
	return err
}

func intervalAsSQL(d time.Duration) string {
	seconds := int(d.Seconds())
	if seconds < 1 {
		seconds = 1
	}
	return strconv.Itoa(seconds) + " seconds"
}

func parseBool(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func allowAllScope(scope string) bool {
	s := strings.ToLower(scope)
	keywords := []string{
		"all", "any", "entire", "everything",
		"all assets", "all systems", "all domains", "all subdomains",
		"any asset", "any system",
	}
	for _, k := range keywords {
		if strings.Contains(s, k) {
			return true
		}
	}
	return false
}

func violatesScope(scope, outOfScope string, parts ...string) bool {
	safeText := normalizeForMatch(strings.Join(parts, " "))
	if safeText == "" {
		return false
	}
	safeTokens := tokenizeForMatch(safeText)
	scopeTokens := splitTokens(scope)
	outTokens := splitTokens(outOfScope)

	for _, tok := range outTokens {
		if phraseMatchesText(tok, safeText, safeTokens) {
			return true
		}
	}

	if allowAllScope(scope) {
		return false
	}
	if len(scopeTokens) == 0 {
		return false
	}
	for _, tok := range scopeTokens {
		if phraseMatchesText(tok, safeText, safeTokens) {
			return false
		}
	}
	for _, phrase := range scopeTokens {
		for _, kw := range extractKeywordsFromPhrase(phrase) {
			if _, ok := safeTokens[kw]; ok {
				return false
			}
		}
	}
	return true
}

func splitTokens(s string) []string {
	parts := strings.FieldsFunc(strings.ToLower(s), func(r rune) bool {
		return r == ',' || r == '\n' || r == ';'
	})
	res := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			res = append(res, p)
		}
	}
	return res
}

func normalizeForMatch(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteByte(' ')
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func tokenizeForMatch(s string) map[string]struct{} {
	out := map[string]struct{}{}
	for _, tok := range strings.Fields(normalizeForMatch(s)) {
		if len(tok) < 3 || isNoiseToken(tok) {
			continue
		}
		out[tok] = struct{}{}
	}
	return out
}

func isNoiseToken(tok string) bool {
	switch tok {
	case "the", "and", "for", "with", "that", "this", "from", "into", "your", "you", "are", "not", "can", "was", "were", "have", "has":
		return true
	default:
		return false
	}
}

func extractKeywordsFromPhrase(phrase string) []string {
	set := tokenizeForMatch(phrase)
	out := make([]string, 0, len(set))
	for kw := range set {
		out = append(out, kw)
	}
	return out
}

func phraseMatchesText(phrase, text string, textTokens map[string]struct{}) bool {
	p := normalizeForMatch(phrase)
	if p == "" {
		return false
	}
	if strings.Contains(text, p) {
		return true
	}
	keywords := extractKeywordsFromPhrase(p)
	if len(keywords) == 0 {
		return false
	}
	matched := 0
	for _, kw := range keywords {
		if _, ok := textTokens[kw]; ok {
			matched++
		}
	}
	switch len(keywords) {
	case 1:
		return matched == 1
	case 2:
		return matched == 2
	default:
		return matched >= 2
	}
}

func clientIP(c *gin.Context) string {
	ip := c.ClientIP()
	if ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return host
}

func (h *Handler) StartSLAEscalationLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	h.runSLAEscalationPass(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.runSLAEscalationPass(ctx)
		}
	}
}

func (h *Handler) runSLAEscalationPass(ctx context.Context) {
	rows, err := h.DB.Query(ctx, `
		SELECT r.id, p.org_id, r.status, r.title
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE (
			(r.status IN ('new','triaged') AND r.triage_due_at IS NOT NULL AND NOW() > r.triage_due_at)
			OR (r.status='needs_info' AND r.needs_info_due_at IS NOT NULL AND NOW() > r.needs_info_due_at)
			OR (r.status IN ('accepted','retesting') AND r.resolution_due_at IS NOT NULL AND NOW() > r.resolution_due_at)
		)
		AND (r.last_escalated_at IS NULL OR r.last_escalated_at < NOW() - INTERVAL '24 hours')
		ORDER BY r.created_at ASC
		LIMIT 100`)
	if err != nil {
		log.Printf("sla escalation query error: %v", err)
		return
	}
	defer rows.Close()

	type overdueReport struct {
		ID     string
		OrgID  string
		Status string
		Title  string
	}
	overdue := make([]overdueReport, 0, 32)
	for rows.Next() {
		var r overdueReport
		if err := rows.Scan(&r.ID, &r.OrgID, &r.Status, &r.Title); err != nil {
			log.Printf("sla escalation scan error: %v", err)
			return
		}
		overdue = append(overdue, r)
	}
	for _, r := range overdue {
		msg := "Report is overdue for " + normalizeReportStatus(r.Status) + " SLA."
		if strings.TrimSpace(r.Title) != "" {
			msg += " Title: " + r.Title
		}

		if _, err := h.DB.Exec(ctx, `UPDATE vdp_reports SET last_escalated_at=NOW() WHERE id=$1`, r.ID); err != nil {
			log.Printf("sla escalation update error report_id=%s err=%v", r.ID, err)
			continue
		}

		if _, err := h.DB.Exec(ctx, `
			INSERT INTO vdp_notifications (org_id, report_id, title, message)
			VALUES ($1,$2,$3,$4)`, r.OrgID, r.ID, "SLA breach detected", msg); err != nil {
			log.Printf("sla escalation notify error report_id=%s err=%v", r.ID, err)
		}

		_ = h.sendOrgWebhook(ctx, r.OrgID, "report.sla_overdue", map[string]any{
			"report_id": r.ID,
			"status":    r.Status,
			"message":   msg,
		})
	}
}

func (h *Handler) insertEvent(c *gin.Context, reportID, eventType, actorType, actorID, actorEmail string, details map[string]any) error {
	_, err := h.DB.Exec(c.Request.Context(), `
		INSERT INTO vdp_report_events (report_id, event_type, actor_type, actor_id, actor_email, details)
		VALUES ($1,$2,$3,$4,$5,$6)`, reportID, eventType, actorType, actorID, actorEmail, details)
	return err
}

func (h *Handler) sendOrgWebhook(ctx context.Context, orgID, eventType string, payload map[string]any) error {
	settings, err := h.getOrgSettings(ctx, orgID)
	if err != nil {
		return err
	}
	if !settings.WebhookEnabled || strings.TrimSpace(settings.WebhookURL) == "" {
		return nil
	}
	return h.enqueueWebhook(ctx, orgID, extractReportIDFromPayload(payload), eventType, payload, settings.WebhookURL, settings.WebhookSecret)
}

func (h *Handler) StartOutboxLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 3 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.runOutboxPass(ctx, outboxBatchSize)
		}
	}
}

func (h *Handler) StartMaintenanceLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Minute
	}
	h.runMaintenancePass(ctx, maintenanceBatchSize)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.runMaintenancePass(ctx, maintenanceBatchSize)
		}
	}
}

func (h *Handler) runMaintenancePass(ctx context.Context, batchSize int) {
	if batchSize <= 0 {
		batchSize = maintenanceBatchSize
	}
	outboxDeleted, err := h.cleanupOutboxRows(ctx, batchSize)
	if err != nil {
		log.Printf("maintenance outbox cleanup error: %v", err)
	} else if outboxDeleted > 0 {
		log.Printf("maintenance outbox cleanup removed=%d", outboxDeleted)
	}
	idemDeleted, err := h.cleanupIdempotencyRows(ctx, batchSize)
	if err != nil {
		log.Printf("maintenance idempotency cleanup error: %v", err)
	} else if idemDeleted > 0 {
		log.Printf("maintenance idempotency cleanup removed=%d", idemDeleted)
	}
}

func (h *Handler) cleanupOutboxRows(ctx context.Context, batchSize int) (int64, error) {
	cmd, err := h.DB.Exec(ctx, `
		WITH doomed AS (
			SELECT ctid
			FROM vdp_outbox
			WHERE (
				status='sent' AND sent_at IS NOT NULL AND sent_at < NOW() - INTERVAL '14 days'
			)
			OR (
				status='failed' AND attempt_count >= max_attempts AND updated_at < NOW() - INTERVAL '30 days'
			)
			ORDER BY updated_at ASC
			LIMIT $1
		)
		DELETE FROM vdp_outbox o
		USING doomed
		WHERE o.ctid = doomed.ctid`, batchSize)
	if err != nil {
		return 0, err
	}
	return cmd.RowsAffected(), nil
}

func (h *Handler) cleanupIdempotencyRows(ctx context.Context, batchSize int) (int64, error) {
	cmd, err := h.DB.Exec(ctx, `
		WITH doomed AS (
			SELECT ctid
			FROM vdp_idempotency_keys
			WHERE expires_at < NOW()
			   OR (status='completed' AND updated_at < NOW() - INTERVAL '7 days')
			ORDER BY updated_at ASC
			LIMIT $1
		)
		DELETE FROM vdp_idempotency_keys k
		USING doomed
		WHERE k.ctid = doomed.ctid`, batchSize)
	if err != nil {
		return 0, err
	}
	return cmd.RowsAffected(), nil
}

func (h *Handler) runOutboxPass(ctx context.Context, batchSize int) {
	if batchSize <= 0 {
		batchSize = outboxBatchSize
	}
	rows, err := h.DB.Query(ctx, `
		WITH picked AS (
			SELECT id
			FROM vdp_outbox
			WHERE (
				(status IN ('pending','failed') AND next_attempt_at <= NOW())
				OR (status='processing' AND locked_at IS NOT NULL AND locked_at < NOW() - INTERVAL '10 minutes')
			)
			AND attempt_count < max_attempts
			ORDER BY created_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE vdp_outbox o
		SET status='processing',
		    locked_at=NOW(),
		    updated_at=NOW()
		FROM picked
		WHERE o.id = picked.id
		RETURNING o.id, o.channel, o.payload, o.attempt_count, o.max_attempts`, batchSize)
	if err != nil {
		log.Printf("outbox fetch error: %v", err)
		return
	}
	defer rows.Close()

	type item struct {
		ID           string
		Channel      string
		Payload      []byte
		AttemptCount int
		MaxAttempts  int
	}
	items := make([]item, 0, batchSize)
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.Channel, &it.Payload, &it.AttemptCount, &it.MaxAttempts); err != nil {
			log.Printf("outbox scan error: %v", err)
			return
		}
		items = append(items, it)
	}

	for _, it := range items {
		err := h.deliverOutboxItem(ctx, it.Channel, it.Payload)
		nextAttemptCount := it.AttemptCount + 1
		if err == nil {
			if _, uErr := h.DB.Exec(ctx, `
				UPDATE vdp_outbox
				SET status='sent',
				    attempt_count=$2,
				    sent_at=NOW(),
				    locked_at=NULL,
				    last_error=NULL,
				    updated_at=NOW()
				WHERE id=$1`, it.ID, nextAttemptCount); uErr != nil {
				log.Printf("outbox success update error id=%s err=%v", it.ID, uErr)
			}
			continue
		}

		lastError := err.Error()
		if len(lastError) > 2000 {
			lastError = lastError[:2000]
		}
		nextAttemptAt := time.Now().UTC().Add(computeOutboxBackoff(nextAttemptCount))
		if _, uErr := h.DB.Exec(ctx, `
			UPDATE vdp_outbox
			SET status='failed',
			    attempt_count=$2,
			    next_attempt_at=$3,
			    locked_at=NULL,
			    last_error=$4,
			    updated_at=NOW()
			WHERE id=$1`, it.ID, nextAttemptCount, nextAttemptAt, lastError); uErr != nil {
			log.Printf("outbox failure update error id=%s err=%v", it.ID, uErr)
		}
	}
}

func (h *Handler) deliverOutboxItem(ctx context.Context, channel string, payload []byte) error {
	switch channel {
	case "email":
		return h.deliverOutboxEmail(ctx, payload)
	case "webhook":
		return h.deliverOutboxWebhook(ctx, payload)
	default:
		return errors.New("unsupported outbox channel")
	}
}

func (h *Handler) deliverOutboxEmail(_ context.Context, payload []byte) error {
	if h.Mailer == nil || !h.Mailer.Enabled() {
		return errors.New("mailer not configured")
	}
	var msg struct {
		To      string `json:"to"`
		Subject string `json:"subject"`
		Body    string `json:"body"`
	}
	if err := json.Unmarshal(payload, &msg); err != nil {
		return err
	}
	msg.To = strings.TrimSpace(msg.To)
	msg.Subject = sanitizeEmailSubject(msg.Subject)
	if !validateEmail(msg.To) {
		return errors.New("invalid email recipient")
	}
	if msg.Subject == "" {
		msg.Subject = "VDP Notification"
	}
	if strings.TrimSpace(msg.Body) == "" {
		return errors.New("empty email body")
	}
	return h.Mailer.Send(msg.To, msg.Subject, msg.Body)
}

func (h *Handler) deliverOutboxWebhook(ctx context.Context, payload []byte) error {
	var msg struct {
		URL     string          `json:"url"`
		Secret  string          `json:"secret"`
		Event   string          `json:"event"`
		OrgID   string          `json:"org_id"`
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(payload, &msg); err != nil {
		return err
	}
	msg.URL = strings.TrimSpace(msg.URL)
	msg.Event = strings.TrimSpace(msg.Event)
	if msg.URL == "" || msg.Event == "" {
		return errors.New("invalid webhook payload")
	}

	var payloadObj any
	if len(msg.Payload) > 0 {
		if err := json.Unmarshal(msg.Payload, &payloadObj); err != nil {
			return err
		}
	}

	body := map[string]any{
		"event":     msg.Event,
		"org_id":    msg.OrgID,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"payload":   payloadObj,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, msg.URL, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-VDP-Event", msg.Event)
	if strings.TrimSpace(msg.Secret) != "" {
		mac := hmac.New(sha256.New, []byte(msg.Secret))
		mac.Write(raw)
		req.Header.Set("X-VDP-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return errors.New("webhook delivery failed")
	}
	return nil
}

func (h *Handler) enqueueEmail(ctx context.Context, orgID, reportID, to, subject, body string) error {
	to = strings.TrimSpace(to)
	subject = sanitizeEmailSubject(subject)
	body = strings.TrimSpace(body)
	if to == "" || body == "" {
		return errors.New("email payload missing required fields")
	}
	payload, err := json.Marshal(map[string]any{
		"to":      to,
		"subject": subject,
		"body":    body,
	})
	if err != nil {
		return err
	}
	var orgArg any
	if validateUUID(orgID) {
		orgArg = orgID
	}
	var reportArg any
	if validateUUID(reportID) {
		reportArg = reportID
	}
	_, err = h.DB.Exec(ctx, `
		INSERT INTO vdp_outbox (org_id, report_id, channel, payload, status, next_attempt_at, max_attempts)
		VALUES ($1,$2,'email',$3,'pending',NOW(),8)`, orgArg, reportArg, payload)
	return err
}

func (h *Handler) enqueueWebhook(ctx context.Context, orgID, reportID, eventType string, payload map[string]any, url, secret string) error {
	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	outboxPayload, err := json.Marshal(map[string]any{
		"url":     strings.TrimSpace(url),
		"secret":  strings.TrimSpace(secret),
		"event":   strings.TrimSpace(eventType),
		"org_id":  orgID,
		"payload": json.RawMessage(rawPayload),
	})
	if err != nil {
		return err
	}
	var orgArg any
	if validateUUID(orgID) {
		orgArg = orgID
	}
	var reportArg any
	if validateUUID(reportID) {
		reportArg = reportID
	}
	_, err = h.DB.Exec(ctx, `
		INSERT INTO vdp_outbox (org_id, report_id, channel, payload, status, next_attempt_at, max_attempts)
		VALUES ($1,$2,'webhook',$3,'pending',NOW(),8)`, orgArg, reportArg, outboxPayload)
	return err
}

func computeOutboxBackoff(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	if attempt > 6 {
		attempt = 6
	}
	base := time.Duration(1<<uint(attempt-1)) * time.Minute
	if base > 60*time.Minute {
		return 60 * time.Minute
	}
	return base
}

func extractReportIDFromPayload(payload map[string]any) string {
	if payload == nil {
		return ""
	}
	v, ok := payload["report_id"]
	if !ok {
		return ""
	}
	reportID, ok := v.(string)
	if !ok {
		return ""
	}
	reportID = strings.TrimSpace(reportID)
	if !validateUUID(reportID) {
		return ""
	}
	return reportID
}

func itoa(i int) string {
	return strconv.Itoa(i)
}

func itoa64(i int64) string {
	return strconv.FormatInt(i, 10)
}

func readAllLimited(r io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, errors.New("file too large")
	}
	return data, nil
}

func allowedContentType(ct string, allowed []string) bool {
	ct = strings.ToLower(strings.TrimSpace(ct))
	for _, a := range allowed {
		if ct == a {
			return true
		}
	}
	return false
}

func allowedAttachment(name, contentType string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".txt", ".pdf", ".zip":
	default:
		return false
	}
	allowed := []string{
		"image/png",
		"image/jpeg",
		"text/plain",
		"application/pdf",
		"application/zip",
		"application/x-zip-compressed",
	}
	return allowedContentType(contentType, allowed)
}

func (h *Handler) scanBytes(c *gin.Context, data []byte) (bool, string, error) {
	if h.AV == nil {
		return true, "", nil
	}
	return h.AV.Scan(c.Request.Context(), data)
}

func (h *Handler) notifyReporterCreated(email, reportID string) error {
	if h.Mailer == nil || !h.Mailer.Enabled() {
		return nil
	}
	if strings.TrimSpace(email) == "" {
		return nil
	}
	subject := "VDP Report Received"
	body := "Thank you for your report. Your report ID is: " + reportID + "\n\n" +
		"You can track status using your report ID and this email."
	return h.enqueueEmail(context.Background(), "", reportID, email, subject, body)
}

func (h *Handler) notifyReporterStatus(c *gin.Context, reportID, status, notes, reason string) error {
	if h.Mailer == nil || !h.Mailer.Enabled() {
		return nil
	}
	var email string
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT reporter_email FROM vdp_reports WHERE id=$1`, reportID).Scan(&email); err != nil {
		return nil
	}
	if email == "" {
		return nil
	}
	subject := "VDP Report Status Updated"
	body := "Your report status is now: " + status + "\n"
	if reason != "" {
		body += "Reason: " + reason + "\n"
	}
	if notes != "" {
		body += "Notes: " + notes + "\n"
	}
	body += "\nTrack your report using your report ID and this email."
	return h.enqueueEmail(c.Request.Context(), "", reportID, email, subject, body)
}

func (h *Handler) notifyReporterComment(c *gin.Context, reportID, comment string) error {
	if h.Mailer == nil || !h.Mailer.Enabled() {
		return nil
	}
	var email string
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT reporter_email FROM vdp_reports WHERE id=$1`, reportID).Scan(&email); err != nil {
		return nil
	}
	if email == "" {
		return nil
	}
	subject := "VDP Report Comment"
	body := "The organization left a comment on your report:\n\n" + comment + "\n\n" +
		"Track your report using your report ID and this email."
	return h.enqueueEmail(c.Request.Context(), "", reportID, email, subject, body)
}

func requiresPOC(requirements string) bool {
	req := strings.ToLower(requirements)
	return strings.Contains(req, "poc") || strings.Contains(req, "proof of concept")
}

func (h *Handler) createNotification(c *gin.Context, orgID, reportID, title, message string) error {
	_, err := h.DB.Exec(c.Request.Context(), `
		INSERT INTO vdp_notifications (org_id, report_id, title, message)
		VALUES ($1,$2,$3,$4)`, orgID, reportID, title, message)
	return err
}

func (h *Handler) notifyOrgNewReport(c *gin.Context, orgID, reportID, title string, hasContact bool) error {
	if h.Mailer == nil || !h.Mailer.Enabled() {
		return nil
	}
	var contactEmail string
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT contact_email FROM organizations WHERE id=$1`, orgID).Scan(&contactEmail); err != nil {
		return nil
	}
	if contactEmail == "" {
		return nil
	}
	subject := "New VDP Report Submitted"
	body := "A new report has been submitted.\n\nReport ID: " + reportID + "\nTitle: " + title + "\n"
	if hasContact {
		body += "Reporter contact: Provided via platform messaging\n"
	}
	body += "\nLog in to review and respond."
	return h.enqueueEmail(c.Request.Context(), orgID, reportID, contactEmail, subject, body)
}

// GetComplianceSummary — GET /api/vdp/compliance/summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// Read-only aggregate metrics for compliance_team and platform_admin roles.
// Does NOT require an org context — returns platform-wide counts.
// Auth is handled via platform session cookie (no VDP JWT required).
func (h *Handler) GetComplianceSummary(c *gin.Context) {
	// Try JWT role first (for VDP-native sessions)
	role := c.GetString(middleware.ContextRole)
	// If no JWT role set, fall back to platform session introspection
	if role == "" {
		platformUser, platformRole, err := h.introspectPlatformSession(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		// Determine effective role from platform role or account type
		role = platformRole
		if role == "" && platformUser != nil {
			if strings.ToLower(platformUser.AccountType) == "platform_admin" ||
				strings.ToLower(platformUser.AccountType) == "platform-admin" {
				role = "platform_admin"
			}
		}
	}
	if role != "compliance_team" && role != "platform_admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Compliance access required"})
		return
	}

	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	dateClause := ""
	if startDate != "" {
		dateClause += " AND created_at >= '" + startDate + "'"
	}
	if endDate != "" {
		dateClause += " AND created_at <= '" + endDate + " 23:59:59'"
	}

	var totalReports, resolvedReports, activePrograms int
	h.DB.QueryRow(c.Request.Context(),
		"SELECT COUNT(*) FROM vdp_reports WHERE 1=1"+dateClause).Scan(&totalReports)
	h.DB.QueryRow(c.Request.Context(),
		"SELECT COUNT(*) FROM vdp_reports WHERE status='resolved'"+dateClause).Scan(&resolvedReports)
	h.DB.QueryRow(c.Request.Context(),
		"SELECT COUNT(*) FROM vdp_programs WHERE status='active'").Scan(&activePrograms)

	c.JSON(http.StatusOK, gin.H{
		"programs": activePrograms,
		"findings": totalReports,
		"resolved": resolvedReports,
	})
}

// GetDeveloperReports — GET /api/vdp/developer/reports
// Read-only all-reports view for developer and platform_admin platform roles.
// Auth is handled via platform session cookie (no VDP JWT required).
func (h *Handler) GetDeveloperReports(c *gin.Context) {
	_, platformRole, err := h.introspectPlatformSession(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if platformRole != "developer" && platformRole != "platform_admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Developer access required"})
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT r.id::text, r.title, r.severity, r.status,
		       COALESCE(r.description, ''), COALESCE(r.steps_to_reproduce, ''), COALESCE(r.poc, ''),
		       r.reporter_email, COALESCE(r.reporter_name, ''),
		       r.created_at
		FROM vdp_reports r
		ORDER BY r.created_at DESC
		LIMIT 200
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	type reportRow struct {
		ID               string `json:"id"`
		Title            string `json:"title"`
		Severity         string `json:"severity"`
		Status           string `json:"status"`
		Description      string `json:"description"`
		StepsToReproduce string `json:"steps_to_reproduce"`
		POC              string `json:"poc"`
		ReporterEmail    string `json:"reporter_email"`
		ReporterName     string `json:"reporter_name"`
		CreatedAt        string `json:"created_at"`
	}

	reports := []reportRow{}
	for rows.Next() {
		var r reportRow
		var createdAt time.Time
		if err := rows.Scan(&r.ID, &r.Title, &r.Severity, &r.Status,
			&r.Description, &r.StepsToReproduce, &r.POC,
			&r.ReporterEmail, &r.ReporterName,
			&createdAt); err != nil {
			continue
		}
		r.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		reports = append(reports, r)
	}
	c.JSON(http.StatusOK, reports)
}

