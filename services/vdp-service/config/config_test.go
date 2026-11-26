package config

import "testing"

func validConfig() Config {
	return Config{
		AppEnv:         "development",
		DBDSN:          "postgres://vdp:vdp@db:5432/vdp?sslmode=disable",
		JWTSecret:      "this-is-a-development-secret-at-least-32-chars",
		Port:           "8082",
		RateLimitRPM:   30,
		MinIOEndpoint:  "minio:9000",
		MinIOAccessKey: "custom-access-key",
		MinIOSecretKey: "custom-secret-key",
		MinIOBucket:    "vdp",
		FromEmail:      "noreply@example.com",
	}
}

func TestValidateDevelopmentDefaults(t *testing.T) {
	t.Parallel()

	cfg := validConfig()
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected config to validate, got error: %v", err)
	}
}

func TestValidateProductionRequiresStrongJWT(t *testing.T) {
	t.Parallel()

	cfg := validConfig()
	cfg.AppEnv = "production"
	cfg.JWTSecret = "short"
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected error for short JWT secret in production")
	}
}

func TestValidateProductionRejectsDefaultMinIOCredentials(t *testing.T) {
	t.Parallel()

	cfg := validConfig()
	cfg.AppEnv = "production"
	cfg.MinIOAccessKey = "minio"
	cfg.MinIOSecretKey = "minio123"
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected error for default MinIO credentials in production")
	}
}

func TestValidateProductionRequiresFromEmail(t *testing.T) {
	t.Parallel()

	cfg := validConfig()
	cfg.AppEnv = "production"
	cfg.FromEmail = ""
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected error for missing FROM_EMAIL in production")
	}
}

func TestValidateSMTPRequiresFromEmail(t *testing.T) {
	t.Parallel()

	cfg := validConfig()
	cfg.SMTPHost = "mail.example.com"
	cfg.FromEmail = ""
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected error when SMTP_HOST is set without FROM_EMAIL")
	}
}

func TestValidateRejectsInvalidEnvironment(t *testing.T) {
	t.Parallel()

	cfg := validConfig()
	cfg.AppEnv = "preview"
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected invalid environment to fail validation")
	}
}

func TestValidateProductionRejectsPlaceholderDBDSN(t *testing.T) {
	t.Parallel()

	cfg := validConfig()
	cfg.AppEnv = "production"
	cfg.DBDSN = "postgres://postgres:yourpassword@db:5432/vdp?sslmode=disable"
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected placeholder DB_DSN to fail validation")
	}
}

func TestLoadUsesEnvironmentOverrides(t *testing.T) {
	t.Setenv("APP_ENV", "staging")
	t.Setenv("DB_DSN", "postgres://override:override@db:5432/vdp?sslmode=disable")
	t.Setenv("JWT_SECRET", "12345678901234567890123456789012")
	t.Setenv("RATE_LIMIT_RPM", "45")
	t.Setenv("MINIO_USE_SSL", "true")
	t.Setenv("MIGRATE_ON_START", "true")

	cfg := Load()
	if cfg.AppEnv != "staging" {
		t.Fatalf("expected APP_ENV override, got %s", cfg.AppEnv)
	}
	if cfg.DBDSN != "postgres://override:override@db:5432/vdp?sslmode=disable" {
		t.Fatalf("expected DB_DSN override, got %s", cfg.DBDSN)
	}
	if cfg.RateLimitRPM != 45 {
		t.Fatalf("expected RATE_LIMIT_RPM override, got %d", cfg.RateLimitRPM)
	}
	if !cfg.MinIOUseSSL {
		t.Fatal("expected MINIO_USE_SSL=true to be parsed as true")
	}
	if !cfg.MigrateOnStart {
		t.Fatal("expected MIGRATE_ON_START=true to be parsed as true")
	}
}
