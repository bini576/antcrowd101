package handlers

import (
	"testing"

	"pen-service-backend/models"
)

func TestParseIDFromPath(t *testing.T) {
	t.Parallel()

	id, action, err := parseIDFromPath("/api/applications/42/status", "/api/applications/")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if id != 42 {
		t.Fatalf("expected id 42, got %d", id)
	}
	if action != "status" {
		t.Fatalf("expected action status, got %s", action)
	}
}

func TestParseIDFromPathInvalid(t *testing.T) {
	t.Parallel()

	if _, _, err := parseIDFromPath("/api/applications/42", "/api/applications/"); err == nil {
		t.Fatal("expected error for missing action")
	}
	if _, _, err := parseIDFromPath("/api/applications/x/status", "/api/applications/"); err == nil {
		t.Fatal("expected error for non-numeric id")
	}
}

func TestRoleCanAccessOrg(t *testing.T) {
	t.Parallel()

	admin := &models.AuthClaims{Role: "platform_admin", OrgID: 0}
	if !roleCanAccessOrg(admin, 999) {
		t.Fatal("platform admin should access any org")
	}

	orgAdmin := &models.AuthClaims{Role: "org_admin", OrgID: 12}
	if !roleCanAccessOrg(orgAdmin, 12) {
		t.Fatal("org admin should access own org")
	}
	if roleCanAccessOrg(orgAdmin, 13) {
		t.Fatal("org admin should not access other org")
	}
}

