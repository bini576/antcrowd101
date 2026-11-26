package handlers

import (
	"testing"
	"time"
)

func TestReportStatusTransitions(t *testing.T) {
	tests := []struct {
		name    string
		from    string
		to      string
		allowed bool
	}{
		{name: "new to triaged", from: "new", to: "triaged", allowed: true},
		{name: "triaged to accepted", from: "triaged", to: "accepted", allowed: true},
		{name: "accepted to resolved", from: "accepted", to: "resolved", allowed: true},
		{name: "resolved to retesting", from: "resolved", to: "retesting", allowed: true},
		{name: "resolved to duplicate", from: "resolved", to: "duplicate", allowed: false},
		{name: "duplicate to accepted", from: "duplicate", to: "accepted", allowed: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isValidReportTransition(tc.from, tc.to)
			if got != tc.allowed {
				t.Fatalf("expected allowed=%v got=%v for %s -> %s", tc.allowed, got, tc.from, tc.to)
			}
		})
	}
}

func TestComputeOutboxBackoffCapsAtOneHour(t *testing.T) {
	cases := []struct {
		attempt int
		want    time.Duration
	}{
		{attempt: 1, want: 1 * time.Minute},
		{attempt: 2, want: 2 * time.Minute},
		{attempt: 3, want: 4 * time.Minute},
		{attempt: 4, want: 8 * time.Minute},
		{attempt: 5, want: 16 * time.Minute},
		{attempt: 6, want: 32 * time.Minute},
		{attempt: 7, want: 32 * time.Minute},
	}

	for _, tc := range cases {
		if got := computeOutboxBackoff(tc.attempt); got != tc.want {
			t.Fatalf("attempt=%d expected=%s got=%s", tc.attempt, tc.want, got)
		}
	}
}

func TestHashPublicReportPayloadStable(t *testing.T) {
	payload := publicReportPayload{
		ProgramID:         "11111111-1111-1111-1111-111111111111",
		ReporterEmail:     "alice@example.com",
		ReporterName:      "Alice",
		Title:             "SQL Injection",
		AffectedAsset:     "api.example.com",
		VulnerabilityType: "SQLi",
		Description:       "desc",
		StepsToReproduce:  "steps",
		Impact:            "impact",
		Severity:          "high",
		POC:               "poc",
		AttackVector:      "network",
		CWE:               "CWE-89",
		ReferenceLinks:    "https://example.com",
		AcceptedPolicy:    true,
	}

	h1 := hashPublicReportPayload(payload)
	h2 := hashPublicReportPayload(payload)
	if h1 == "" || h2 == "" {
		t.Fatal("hash should not be empty")
	}
	if h1 != h2 {
		t.Fatalf("expected deterministic hash, got %s and %s", h1, h2)
	}
}

func TestBuildReportSLADates(t *testing.T) {
	createdAt := time.Date(2026, 4, 6, 10, 0, 0, 0, time.UTC)
	settings := orgSettingsPayload{
		TriageSLAHours:            24,
		ResolutionSLALowDays:      40,
		ResolutionSLAMediumDays:   20,
		ResolutionSLAHighDays:     10,
		ResolutionSLACriticalDays: 5,
	}

	triageDue, resolutionDue := buildReportSLADates(createdAt, "critical", settings)
	if triageDue.Sub(createdAt) != 24*time.Hour {
		t.Fatalf("unexpected triage due delta: %s", triageDue.Sub(createdAt))
	}
	if resolutionDue.Sub(createdAt) != 5*24*time.Hour {
		t.Fatalf("unexpected resolution due delta: %s", resolutionDue.Sub(createdAt))
	}
}
