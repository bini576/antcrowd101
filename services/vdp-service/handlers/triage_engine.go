package handlers

import (
	"context"
	"errors"
	"math"
	"strconv"
	"strings"
)

const triageModelVersion = "vdp-heuristic-v1.0"

type triageSourceReport struct {
	ID                string
	OrgID             string
	Title             string
	AffectedAsset     string
	VulnerabilityType string
	Description       string
	StepsToReproduce  string
	Impact            string
	Severity          string
	AttackVector      string
	CWE               string
	ReferenceLinks    string
}

type triageCandidate struct {
	ID                string
	Title             string
	AffectedAsset     string
	VulnerabilityType string
	Description       string
	StepsToReproduce  string
	Impact            string
	Severity          string
	Status            string
}

type triageResult struct {
	ModelVersion        string
	DuplicateOf         string
	DuplicateConfidence float64
	SuggestedSeverity   string
	SeverityConfidence  float64
	SuggestedCWE        string
	CWEConfidence       float64
	Reasoning           []string
}

func (h *Handler) runAutomatedTriage(ctx context.Context, reportID string) error {
	reportID = strings.TrimSpace(reportID)
	if !validateUUID(reportID) {
		return errors.New("invalid report id")
	}

	source, err := h.fetchTriageSourceReport(ctx, reportID)
	if err != nil {
		return err
	}
	candidates, err := h.fetchTriageCandidates(ctx, source.OrgID, source.ID)
	if err != nil {
		return err
	}

	result := buildAutomatedTriage(source, candidates)
	reasoning := strings.TrimSpace(strings.Join(result.Reasoning, " "))
	if reasoning == "" {
		reasoning = "Automated triage completed with baseline heuristics."
	}

	var duplicateArg any
	if validateUUID(result.DuplicateOf) {
		duplicateArg = result.DuplicateOf
	}
	var cweArg any
	if strings.TrimSpace(result.SuggestedCWE) != "" {
		cweArg = strings.TrimSpace(result.SuggestedCWE)
	}

	_, err = h.DB.Exec(ctx, `
		INSERT INTO vdp_report_triage_assessments (
			report_id, org_id, model_version, duplicate_of, duplicate_confidence,
			suggested_severity, severity_confidence, suggested_cwe, cwe_confidence, reasoning
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		source.ID,
		source.OrgID,
		result.ModelVersion,
		duplicateArg,
		clamp01(result.DuplicateConfidence),
		result.SuggestedSeverity,
		clamp01(result.SeverityConfidence),
		cweArg,
		clamp01(result.CWEConfidence),
		reasoning,
	)
	if err != nil {
		return err
	}

	_, err = h.DB.Exec(ctx, `
		UPDATE vdp_reports
		SET triage_assessed_at=NOW(),
		    triage_model_version=$2,
		    triage_duplicate_of=$3,
		    triage_duplicate_confidence=$4,
		    triage_suggested_severity=$5,
		    triage_severity_confidence=$6,
		    triage_suggested_cwe=$7,
		    triage_cwe_confidence=$8,
		    updated_at=NOW()
		WHERE id=$1`,
		source.ID,
		result.ModelVersion,
		duplicateArg,
		clamp01(result.DuplicateConfidence),
		result.SuggestedSeverity,
		clamp01(result.SeverityConfidence),
		cweArg,
		clamp01(result.CWEConfidence),
	)
	if err != nil {
		return err
	}

	details := map[string]any{
		"model_version":        result.ModelVersion,
		"duplicate_of":         result.DuplicateOf,
		"duplicate_confidence": clamp01(result.DuplicateConfidence),
		"suggested_severity":   result.SuggestedSeverity,
		"severity_confidence":  clamp01(result.SeverityConfidence),
		"suggested_cwe":        strings.TrimSpace(result.SuggestedCWE),
		"cwe_confidence":       clamp01(result.CWEConfidence),
		"reasoning":            reasoning,
	}
	_, _ = h.DB.Exec(ctx, `
		INSERT INTO vdp_report_events (report_id, event_type, actor_type, actor_id, actor_email, details)
		VALUES ($1,'triage_assessed','automation',$2,'',$3)`,
		source.ID, result.ModelVersion, details)

	if validateUUID(result.DuplicateOf) && result.DuplicateConfidence >= 0.90 {
		_, _ = h.DB.Exec(ctx, `
			INSERT INTO vdp_notifications (org_id, report_id, title, message)
			VALUES ($1,$2,$3,$4)`,
			source.OrgID,
			source.ID,
			"Automated duplicate candidate",
			"Triage assistant detected a likely duplicate report ("+result.DuplicateOf+") with confidence "+formatPercent(result.DuplicateConfidence)+".",
		)
	}

	return nil
}

func (h *Handler) fetchTriageSourceReport(ctx context.Context, reportID string) (triageSourceReport, error) {
	var r triageSourceReport
	err := h.DB.QueryRow(ctx, `
		SELECT r.id, p.org_id, r.title, COALESCE(r.affected_asset,''), COALESCE(r.vulnerability_type,''),
		       r.description, COALESCE(r.steps_to_reproduce,''), COALESCE(r.impact,''),
		       r.severity, COALESCE(r.attack_vector,''), COALESCE(r.cwe,''), COALESCE(r.reference_links,'')
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE r.id=$1`, reportID).Scan(
		&r.ID,
		&r.OrgID,
		&r.Title,
		&r.AffectedAsset,
		&r.VulnerabilityType,
		&r.Description,
		&r.StepsToReproduce,
		&r.Impact,
		&r.Severity,
		&r.AttackVector,
		&r.CWE,
		&r.ReferenceLinks,
	)
	return r, err
}

func (h *Handler) fetchTriageCandidates(ctx context.Context, orgID, excludeReportID string) ([]triageCandidate, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT r.id, r.title, COALESCE(r.affected_asset,''), COALESCE(r.vulnerability_type,''),
		       r.description, COALESCE(r.steps_to_reproduce,''), COALESCE(r.impact,''), r.severity, r.status
		FROM vdp_reports r
		JOIN vdp_programs p ON r.program_id = p.id
		WHERE p.org_id=$1 AND r.id<>$2
		ORDER BY r.created_at DESC
		LIMIT 250`, orgID, excludeReportID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make([]triageCandidate, 0, 64)
	for rows.Next() {
		var it triageCandidate
		if err := rows.Scan(
			&it.ID, &it.Title, &it.AffectedAsset, &it.VulnerabilityType,
			&it.Description, &it.StepsToReproduce, &it.Impact, &it.Severity, &it.Status,
		); err != nil {
			return nil, err
		}
		res = append(res, it)
	}
	return res, nil
}

func buildAutomatedTriage(source triageSourceReport, candidates []triageCandidate) triageResult {
	result := triageResult{
		ModelVersion:      triageModelVersion,
		SuggestedSeverity: normalizeReportSeverity(source.Severity),
	}
	if result.SuggestedSeverity == "" {
		result.SuggestedSeverity = "medium"
	}

	duplicateID, duplicateConfidence, duplicateReason := recommendDuplicate(source, candidates)
	result.DuplicateOf = duplicateID
	result.DuplicateConfidence = clamp01(duplicateConfidence)
	if duplicateReason != "" {
		result.Reasoning = append(result.Reasoning, duplicateReason)
	}

	sev, sevConfidence, sevReason := recommendSeverity(source)
	result.SuggestedSeverity = sev
	result.SeverityConfidence = clamp01(sevConfidence)
	if sevReason != "" {
		result.Reasoning = append(result.Reasoning, sevReason)
	}

	cwe, cweConfidence, cweReason := recommendCWE(source)
	result.SuggestedCWE = cwe
	result.CWEConfidence = clamp01(cweConfidence)
	if cweReason != "" {
		result.Reasoning = append(result.Reasoning, cweReason)
	}

	if len(result.Reasoning) == 0 {
		result.Reasoning = []string{"Automated triage completed."}
	}
	return result
}

func recommendDuplicate(source triageSourceReport, candidates []triageCandidate) (string, float64, string) {
	bestID := ""
	bestScore := 0.0
	for _, c := range candidates {
		score := duplicateSimilarity(source, c)
		if score > bestScore {
			bestScore = score
			bestID = c.ID
		}
	}
	if !validateUUID(bestID) || bestScore < 0.78 {
		return "", bestScore, "Duplicate analysis: no high-confidence duplicate detected."
	}
	return bestID, bestScore, "Duplicate analysis: report is highly similar to report " + bestID + " (" + formatPercent(bestScore) + " confidence)."
}

func duplicateSimilarity(source triageSourceReport, candidate triageCandidate) float64 {
	sourceHeader := strings.Join([]string{source.Title, source.AffectedAsset, source.VulnerabilityType}, " ")
	candidateHeader := strings.Join([]string{candidate.Title, candidate.AffectedAsset, candidate.VulnerabilityType}, " ")
	sourceBody := strings.Join([]string{source.Description, source.StepsToReproduce, source.Impact}, " ")
	candidateBody := strings.Join([]string{candidate.Description, candidate.StepsToReproduce, candidate.Impact}, " ")

	headerScore := jaccardSimilarity(sourceHeader, candidateHeader)
	bodyScore := jaccardSimilarity(sourceBody, candidateBody)
	headerOverlap := overlapCoefficient(sourceHeader, candidateHeader)
	bodyOverlap := overlapCoefficient(sourceBody, candidateBody)

	score := (0.30 * headerScore) + (0.20 * bodyScore) + (0.30 * headerOverlap) + (0.20 * bodyOverlap)

	if sameNormalized(source.AffectedAsset, candidate.AffectedAsset) {
		score += 0.15
	}
	if sameNormalized(source.VulnerabilityType, candidate.VulnerabilityType) {
		score += 0.20
	}
	if titleTokenOverlap(source.Title, candidate.Title) >= 0.70 {
		score += 0.10
	}
	if normalizeReportSeverity(source.Severity) == normalizeReportSeverity(candidate.Severity) {
		score += 0.03
	}
	if score > 1 {
		score = 1
	}
	return score
}

func recommendSeverity(source triageSourceReport) (string, float64, string) {
	reported := normalizeReportSeverity(source.Severity)
	if reported == "" {
		reported = "medium"
	}
	full := strings.ToLower(strings.Join([]string{
		source.Title, source.Description, source.Impact, source.VulnerabilityType, source.AttackVector,
	}, " "))
	full = normalizeForMatch(full)

	scores := map[string]float64{
		"low":      0.2,
		"medium":   0.2,
		"high":     0.2,
		"critical": 0.2,
	}
	scores[reported] += 0.25

	signals := 0
	apply := func(level string, weight float64, patterns ...string) {
		for _, p := range patterns {
			if strings.Contains(full, normalizeForMatch(p)) {
				scores[level] += weight
				signals++
				return
			}
		}
	}

	apply("critical", 0.90, "remote code execution", "rce", "unauthenticated admin access", "full account takeover", "critical data breach")
	apply("high", 0.75, "sql injection", "sqli", "auth bypass", "privilege escalation", "ssrf", "command injection")
	apply("high", 0.55, "stored xss", "idor", "broken access control", "sensitive data exposure")
	apply("medium", 0.45, "reflected xss", "csrf", "open redirect", "information disclosure")
	apply("low", 0.35, "clickjacking", "security header missing", "verbose error", "rate limit missing")

	levels := []string{"low", "medium", "high", "critical"}
	best := levels[0]
	second := levels[0]
	for _, level := range levels {
		if scores[level] > scores[best] {
			second = best
			best = level
		} else if level != best && scores[level] > scores[second] {
			second = level
		}
	}

	delta := scores[best] - scores[second]
	confidence := 0.55 + math.Min(0.28, delta/2.0) + math.Min(0.12, float64(signals)*0.02)
	if best == reported {
		confidence += 0.05
	}
	confidence = clamp01(confidence)
	if confidence < 0.5 {
		confidence = 0.5
	}
	return best, confidence, "Severity analysis: suggested severity is " + best + " (" + formatPercent(confidence) + " confidence)."
}

func recommendCWE(source triageSourceReport) (string, float64, string) {
	if cwe := normalizeCWE(source.CWE); cwe != "" {
		return cwe, 0.97, "CWE analysis: reporter-supplied CWE accepted (" + cwe + ")."
	}

	full := strings.ToLower(strings.Join([]string{
		source.Title, source.Description, source.VulnerabilityType, source.AttackVector, source.Impact,
	}, " "))
	full = normalizeForMatch(full)

	type rule struct {
		cwe      string
		weight   float64
		patterns []string
	}
	rules := []rule{
		{cwe: "CWE-89", weight: 0.88, patterns: []string{"sql injection", "sqli"}},
		{cwe: "CWE-79", weight: 0.82, patterns: []string{"xss", "cross site scripting"}},
		{cwe: "CWE-639", weight: 0.80, patterns: []string{"idor", "insecure direct object reference"}},
		{cwe: "CWE-918", weight: 0.84, patterns: []string{"ssrf", "server side request forgery"}},
		{cwe: "CWE-78", weight: 0.86, patterns: []string{"command injection", "remote code execution", "rce"}},
		{cwe: "CWE-287", weight: 0.77, patterns: []string{"auth bypass", "authentication bypass"}},
		{cwe: "CWE-352", weight: 0.70, patterns: []string{"csrf", "cross site request forgery"}},
		{cwe: "CWE-22", weight: 0.78, patterns: []string{"path traversal", "directory traversal"}},
		{cwe: "CWE-611", weight: 0.76, patterns: []string{"xxe", "xml external entity"}},
		{cwe: "CWE-200", weight: 0.62, patterns: []string{"information disclosure", "sensitive data exposure"}},
	}

	bestCWE := ""
	bestScore := 0.0
	for _, r := range rules {
		for _, p := range r.patterns {
			if strings.Contains(full, normalizeForMatch(p)) && r.weight > bestScore {
				bestScore = r.weight
				bestCWE = r.cwe
			}
		}
	}
	if bestCWE == "" {
		return "", 0, "CWE analysis: no confident CWE mapping found."
	}
	return bestCWE, bestScore, "CWE analysis: suggested " + bestCWE + " (" + formatPercent(bestScore) + " confidence)."
}

func normalizeReportSeverity(v string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "low", "medium", "high", "critical":
		return strings.ToLower(strings.TrimSpace(v))
	default:
		return ""
	}
}

func normalizeCWE(v string) string {
	v = strings.ToUpper(strings.TrimSpace(v))
	if strings.HasPrefix(v, "CWE-") && len(v) > 4 {
		return v
	}
	return ""
}

func jaccardSimilarity(a, b string) float64 {
	left := tokenizeForMatch(a)
	right := tokenizeForMatch(b)
	if len(left) == 0 || len(right) == 0 {
		return 0
	}
	intersection := 0
	union := len(left)
	for tok := range right {
		if _, ok := left[tok]; ok {
			intersection++
		} else {
			union++
		}
	}
	if union == 0 {
		return 0
	}
	return float64(intersection) / float64(union)
}

func overlapCoefficient(a, b string) float64 {
	left := tokenizeForMatch(a)
	right := tokenizeForMatch(b)
	if len(left) == 0 || len(right) == 0 {
		return 0
	}
	intersection := 0
	for tok := range right {
		if _, ok := left[tok]; ok {
			intersection++
		}
	}
	minSet := len(left)
	if len(right) < minSet {
		minSet = len(right)
	}
	if minSet == 0 {
		return 0
	}
	return float64(intersection) / float64(minSet)
}

func titleTokenOverlap(a, b string) float64 {
	return overlapCoefficient(a, b)
}

func sameNormalized(a, b string) bool {
	left := normalizeForMatch(a)
	right := normalizeForMatch(b)
	return left != "" && left == right
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

func formatPercent(v float64) string {
	return strconv.FormatFloat(clamp01(v)*100, 'f', 1, 64) + "%"
}
