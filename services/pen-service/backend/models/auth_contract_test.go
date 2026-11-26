package models

import "testing"

func TestNormalizeRole(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"platform_admin":      "platform_admin",
		"admin":               "platform_admin",
		"org_admin":           "organization_admin",
		"organization":        "organization_admin",
		"organization_admin":  "organization_admin",
		"researcher_internal": "researcher_internal",
	}

	for input, expected := range tests {
		if actual := NormalizeRole(input); actual != expected {
			t.Fatalf("NormalizeRole(%q) = %q, want %q", input, actual, expected)
		}
	}
}

func TestRoleMatches(t *testing.T) {
	t.Parallel()

	if !RoleMatches("org_admin", "organization_admin") {
		t.Fatal("expected org_admin to match organization_admin")
	}
	if RoleMatches("researcher_external", "platform_admin") {
		t.Fatal("did not expect researcher_external to match platform_admin")
	}
}
