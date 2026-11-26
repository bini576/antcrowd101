package handlers

import (
	"encoding/json"
	"strings"
)

const minReportEvidenceScore = 40

type reportEvidence struct {
	Title            string
	Description      string
	StepsToReproduce string
	Impact           string
	POC              string
	Vulnerability    string
	AttackVector     string
	CWE              string
	ReferenceLinks   string
}

type qualityAssessment struct {
	Score   int      `json:"score"`
	Grade   string   `json:"grade"`
	Flags   []string `json:"flags"`
	Missing []string `json:"missing"`
	Summary string   `json:"summary"`
}

func (q qualityAssessment) passesGate() bool {
	if q.Score < minReportEvidenceScore {
		return false
	}
	critical := map[string]struct{}{
		"short_description":      {},
		"short_steps":            {},
		"short_impact":           {},
		"missing_repro_details":  {},
		"missing_impact_details": {},
	}
	for _, f := range q.Flags {
		if _, ok := critical[f]; ok {
			return false
		}
	}
	return true
}

func (q qualityAssessment) flagsJSON() []byte {
	raw, err := json.Marshal(q.Flags)
	if err != nil {
		return []byte("[]")
	}
	return raw
}

func qualityFromPublicPayload(p publicReportPayload) qualityAssessment {
	return evaluateEvidence(reportEvidence{
		Title:            p.Title,
		Description:      p.Description,
		StepsToReproduce: p.StepsToReproduce,
		Impact:           p.Impact,
		POC:              p.POC,
		Vulnerability:    p.VulnerabilityType,
		AttackVector:     p.AttackVector,
		CWE:              p.CWE,
		ReferenceLinks:   p.ReferenceLinks,
	})
}

func qualityFromAuthenticatedPayload(p reportPayload) qualityAssessment {
	return evaluateEvidence(reportEvidence{
		Title:            p.Title,
		Description:      p.Description,
		StepsToReproduce: p.StepsToReproduce,
		Impact:           p.Impact,
		POC:              p.POC,
		Vulnerability:    p.VulnerabilityType,
		AttackVector:     p.AttackVector,
		CWE:              p.CWE,
		ReferenceLinks:   p.ReferenceLinks,
	})
}

func evaluateEvidence(in reportEvidence) qualityAssessment {
	titleLen := len(strings.TrimSpace(in.Title))
	descLen := len(strings.TrimSpace(in.Description))
	stepsLen := len(strings.TrimSpace(in.StepsToReproduce))
	impactLen := len(strings.TrimSpace(in.Impact))
	pocLen := len(strings.TrimSpace(in.POC))
	refLen := len(strings.TrimSpace(in.ReferenceLinks))
	attackLen := len(strings.TrimSpace(in.AttackVector))
	cwe := normalizeCWE(in.CWE)
	vulnLen := len(strings.TrimSpace(in.Vulnerability))

	score := 0
	flags := make([]string, 0, 8)
	missing := make([]string, 0, 8)

	switch {
	case titleLen >= 18:
		score += 8
	case titleLen >= 10:
		score += 4
	default:
		flags = append(flags, "short_title")
	}

	switch {
	case descLen >= 160:
		score += 24
	case descLen >= 80:
		score += 18
	case descLen >= 40:
		score += 10
	default:
		flags = append(flags, "short_description")
		missing = append(missing, "clear technical description")
	}

	switch {
	case stepsLen >= 120:
		score += 22
	case stepsLen >= 60:
		score += 16
	case stepsLen >= 25:
		score += 8
	default:
		flags = append(flags, "short_steps", "missing_repro_details")
		missing = append(missing, "step-by-step reproduction")
	}

	switch {
	case impactLen >= 80:
		score += 16
	case impactLen >= 30:
		score += 11
	case impactLen >= 12:
		score += 6
	default:
		flags = append(flags, "short_impact", "missing_impact_details")
		missing = append(missing, "business/security impact details")
	}

	switch {
	case pocLen >= 60:
		score += 14
	case pocLen >= 20:
		score += 10
	case pocLen > 0:
		score += 5
	default:
		flags = append(flags, "missing_poc")
		missing = append(missing, "proof-of-concept evidence")
	}

	if refLen > 0 {
		score += 4
	} else {
		flags = append(flags, "missing_reference_links")
	}

	if cwe != "" {
		score += 4
	}
	if attackLen > 0 {
		score += 3
	}
	if vulnLen > 0 {
		score += 5
	}

	if score > 100 {
		score = 100
	}

	grade := "insufficient"
	switch {
	case score >= 85:
		grade = "excellent"
	case score >= 70:
		grade = "good"
	case score >= 55:
		grade = "fair"
	case score >= 40:
		grade = "poor"
	}

	summary := "Report evidence quality is " + grade + "."
	if len(missing) > 0 {
		summary += " Improve: " + strings.Join(missing, ", ") + "."
	}

	return qualityAssessment{
		Score:   score,
		Grade:   grade,
		Flags:   uniqueStrings(flags),
		Missing: uniqueStrings(missing),
		Summary: summary,
	}
}

func uniqueStrings(items []string) []string {
	if len(items) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))
	for _, it := range items {
		it = strings.TrimSpace(it)
		if it == "" {
			continue
		}
		if _, ok := seen[it]; ok {
			continue
		}
		seen[it] = struct{}{}
		out = append(out, it)
	}
	return out
}
