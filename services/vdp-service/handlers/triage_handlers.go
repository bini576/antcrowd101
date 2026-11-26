package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type triageSnapshot struct {
	ReportID string `json:"report_id"`
	Quality  struct {
		Score   int      `json:"score"`
		Grade   string   `json:"grade"`
		Flags   []string `json:"flags"`
		Summary string   `json:"summary"`
	} `json:"quality"`
	Triage struct {
		AssessedAt          *time.Time `json:"assessed_at"`
		ModelVersion        string     `json:"model_version"`
		DuplicateOf         *string    `json:"duplicate_of"`
		DuplicateConfidence float64    `json:"duplicate_confidence"`
		LikelyDuplicate     bool       `json:"likely_duplicate"`
		SuggestedSeverity   string     `json:"suggested_severity"`
		SeverityConfidence  float64    `json:"severity_confidence"`
		SuggestedCWE        string     `json:"suggested_cwe"`
		CWEConfidence       float64    `json:"cwe_confidence"`
		Reasoning           string     `json:"reasoning"`
	} `json:"triage"`
}

func (h *Handler) GetReportTriageAssessmentOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	snap, err := h.loadTriageSnapshot(c.Request.Context(), orgID, reportID)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.JSON(http.StatusOK, snap)
}

func (h *Handler) RunReportTriageAssessmentOrg(c *gin.Context) {
	orgID, err := orgIDFromContext(c)
	if err != nil || !validateUUID(orgID) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	reportID := c.Param("id")
	if !validateUUID(reportID) {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `
		SELECT EXISTS(
			SELECT 1
			FROM vdp_reports r
			JOIN vdp_programs p ON r.program_id = p.id
			WHERE r.id=$1 AND p.org_id=$2
		)`, reportID, orgID).Scan(&exists); err != nil || !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	if err := h.runAutomatedTriage(c.Request.Context(), reportID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "triage assessment failed"})
		return
	}

	snap, err := h.loadTriageSnapshot(c.Request.Context(), orgID, reportID)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.JSON(http.StatusOK, snap)
}

func (h *Handler) loadTriageSnapshot(ctx context.Context, orgID, reportID string) (triageSnapshot, error) {
	var snap triageSnapshot
	var flagsRaw []byte
	var reasoning string
	err := h.DB.QueryRow(ctx, `
		SELECT
			r.id,
			COALESCE(r.evidence_quality_score,0),
			COALESCE(r.evidence_quality_grade,'unknown'),
			COALESCE(r.evidence_quality_flags, '[]'::jsonb),
			r.triage_assessed_at,
			COALESCE(r.triage_model_version,''),
			r.triage_duplicate_of::text,
			COALESCE(r.triage_duplicate_confidence,0),
			COALESCE(r.triage_suggested_severity,''),
			COALESCE(r.triage_severity_confidence,0),
			COALESCE(r.triage_suggested_cwe,''),
			COALESCE(r.triage_cwe_confidence,0),
			COALESCE((
				SELECT a.reasoning
				FROM vdp_report_triage_assessments a
				WHERE a.report_id = r.id
				ORDER BY a.created_at DESC
				LIMIT 1
			), '')
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE r.id=$1 AND p.org_id=$2`, reportID, orgID).Scan(
		&snap.ReportID,
		&snap.Quality.Score,
		&snap.Quality.Grade,
		&flagsRaw,
		&snap.Triage.AssessedAt,
		&snap.Triage.ModelVersion,
		&snap.Triage.DuplicateOf,
		&snap.Triage.DuplicateConfidence,
		&snap.Triage.SuggestedSeverity,
		&snap.Triage.SeverityConfidence,
		&snap.Triage.SuggestedCWE,
		&snap.Triage.CWEConfidence,
		&reasoning,
	)
	if err != nil {
		return triageSnapshot{}, err
	}

	if len(flagsRaw) > 0 {
		_ = json.Unmarshal(flagsRaw, &snap.Quality.Flags)
	}
	snap.Quality.Summary = "Evidence quality is " + snap.Quality.Grade + "."
	snap.Triage.LikelyDuplicate = validateUUID(stringValue(snap.Triage.DuplicateOf)) && snap.Triage.DuplicateConfidence >= 0.78
	snap.Triage.Reasoning = reasoning
	return snap, nil
}

func stringValue(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
