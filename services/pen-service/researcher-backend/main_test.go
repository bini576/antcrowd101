package main

import "testing"

func TestParseInvitationActionPath(t *testing.T) {
	t.Parallel()

	id, action, err := parseInvitationActionPath("/api/researcher/invitations/15/respond")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if id != 15 {
		t.Fatalf("expected id 15, got %d", id)
	}
	if action != "respond" {
		t.Fatalf("expected action respond, got %s", action)
	}
}

func TestParseInvitationActionPathInvalid(t *testing.T) {
	t.Parallel()

	if _, _, err := parseInvitationActionPath("/api/researcher/invitations/15"); err == nil {
		t.Fatal("expected error for missing action")
	}
	if _, _, err := parseInvitationActionPath("/api/researcher/invitations/abc/respond"); err == nil {
		t.Fatal("expected error for non-numeric invitation id")
	}
}

func TestValidateJWTSecretRejectsWeakProductionSecret(t *testing.T) {
	t.Parallel()

	if err := validateJWTSecret("production", "dev-secret"); err == nil {
		t.Fatal("expected weak production secret to fail validation")
	}
}

func TestLoadAllowedOriginsIncludesLocalResearcherPortals(t *testing.T) {
	allowed := loadAllowedOrigins()

	if !isAllowedOrigin("http://localhost:5277", allowed) {
		t.Fatal("expected internal researcher origin to be allowed")
	}
	if !isAllowedOrigin("http://localhost:5278", allowed) {
		t.Fatal("expected external researcher origin to be allowed")
	}
}
