package main

import "testing"

func TestValidateJWTSecretAllowsDevelopmentDefaults(t *testing.T) {
	t.Parallel()

	if err := validateJWTSecret("development", "dev-secret"); err != nil {
		t.Fatalf("expected development secret to be allowed, got %v", err)
	}
}

func TestValidateJWTSecretRejectsShortProductionSecret(t *testing.T) {
	t.Parallel()

	if err := validateJWTSecret("production", "short-secret"); err == nil {
		t.Fatal("expected production secret validation to fail")
	}
}

func TestValidateJWTSecretRejectsDefaultProductionSecret(t *testing.T) {
	t.Parallel()

	if err := validateJWTSecret("production", "dev-secret"); err == nil {
		t.Fatal("expected default production secret to fail validation")
	}
}
