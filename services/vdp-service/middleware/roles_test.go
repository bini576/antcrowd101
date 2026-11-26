package middleware

import "testing"

func TestNormalizeRole(t *testing.T) {
	t.Parallel()

	tests := map[string]string{
		"admin":              "platform_admin",
		"platform_admin":     "platform_admin",
		"organization":       "organization_admin",
		"organization_admin": "organization_admin",
		"hacker":             "hacker",
	}

	for input, expected := range tests {
		if actual := NormalizeRole(input); actual != expected {
			t.Fatalf("NormalizeRole(%q) = %q, want %q", input, actual, expected)
		}
	}
}
