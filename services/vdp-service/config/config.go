package config

import (
	"fmt"
	"os"
	"strings"
)

// Config is loaded from environment variables.
type Config struct {
	AppEnv                   string
	DBDSN                    string
	JWTSecret                string
	Port                     string
	TrustSvcURL              string
	RateLimitRPM             int
	MigrateOnStart           bool
	MinIOEndpoint            string
	MinIOAccessKey           string
	MinIOSecretKey           string
	MinIOBucket              string
	MinIOUseSSL              bool
	SMTPHost                 string
	SMTPPort                 string
	SMTPUser                 string
	SMTPPass                 string
	FromEmail                string
	ClamAVHost               string
	ClamAVPort               int
	AuthServiceIntrospectURL string
	AuthInternalServiceToken string
	AuthSessionCookieName    string
}

func Load() Config {
	cfg := Config{
		AppEnv:                   strings.ToLower(strings.TrimSpace(envOrDefault("APP_ENV", "development"))),
		DBDSN:                    envOrDefault("DB_DSN", "postgres://postgres:yourpassword@localhost:5432/vdp?sslmode=disable"),
		JWTSecret:                envOrDefault("JWT_SECRET", "your-secret-key"),
		Port:                     envOrDefault("PORT", "8082"),
		TrustSvcURL:              os.Getenv("TRUST_SERVICE_URL"),
		RateLimitRPM:             envIntOrDefault("RATE_LIMIT_RPM", 30),
		MinIOEndpoint:            envOrDefault("MINIO_ENDPOINT", "minio:9000"),
		MinIOAccessKey:           envOrDefault("MINIO_ACCESS_KEY", "minio"),
		MinIOSecretKey:           envOrDefault("MINIO_SECRET_KEY", "minio123"),
		MinIOBucket:              envOrDefault("MINIO_BUCKET", "vdp"),
		MinIOUseSSL:              envBool("MINIO_USE_SSL"),
		SMTPHost:                 os.Getenv("SMTP_HOST"),
		SMTPPort:                 envOrDefault("SMTP_PORT", "587"),
		SMTPUser:                 os.Getenv("SMTP_USER"),
		SMTPPass:                 os.Getenv("SMTP_PASS"),
		FromEmail:                os.Getenv("FROM_EMAIL"),
		ClamAVHost:               os.Getenv("CLAMAV_HOST"),
		ClamAVPort:               envIntOrDefault("CLAMAV_PORT", 3310),
		AuthServiceIntrospectURL: envOrDefault("AUTH_SERVICE_INTROSPECT_URL", "http://auth-service:8080/session/introspect"),
		AuthInternalServiceToken: envOrDefault("AUTH_INTERNAL_SERVICE_TOKEN", "antcrowd-internal-dev-token"),
		AuthSessionCookieName:    envOrDefault("AUTH_SESSION_COOKIE_NAME", "antcrowd_session"),
	}
	cfg.MigrateOnStart = envBool("MIGRATE_ON_START")
	return cfg
}

func (c Config) Validate() error {
	if strings.TrimSpace(c.DBDSN) == "" {
		return fmt.Errorf("DB_DSN is required")
	}
	if strings.TrimSpace(c.JWTSecret) == "" || c.JWTSecret == "your-secret-key" {
		return fmt.Errorf("JWT_SECRET must be set")
	}
	if strings.TrimSpace(c.Port) == "" {
		return fmt.Errorf("PORT is required")
	}
	if c.AppEnv != "development" && c.AppEnv != "staging" && c.AppEnv != "production" && c.AppEnv != "test" {
		return fmt.Errorf("APP_ENV must be one of development|staging|production|test")
	}
	if strings.TrimSpace(c.MinIOEndpoint) == "" || strings.TrimSpace(c.MinIOBucket) == "" {
		return fmt.Errorf("MINIO_ENDPOINT and MINIO_BUCKET are required")
	}
	if c.AppEnv == "staging" || c.AppEnv == "production" {
		if len(c.JWTSecret) < 32 {
			return fmt.Errorf("JWT_SECRET must be at least 32 chars in staging/production")
		}
		if c.MinIOAccessKey == "minio" || c.MinIOSecretKey == "minio123" {
			return fmt.Errorf("MINIO credentials must not use defaults in staging/production")
		}
		if strings.Contains(c.DBDSN, "yourpassword") {
			return fmt.Errorf("DB_DSN must not use placeholder credentials in staging/production")
		}
		if strings.TrimSpace(c.FromEmail) == "" {
			return fmt.Errorf("FROM_EMAIL is required in staging/production")
		}
	}
	if strings.TrimSpace(c.SMTPHost) != "" && strings.TrimSpace(c.FromEmail) == "" {
		return fmt.Errorf("FROM_EMAIL is required when SMTP_HOST is set")
	}
	return nil
}

func envOrDefault(k, def string) string {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	return v
}

func envIntOrDefault(k string, def int) int {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	var n int
	_, err := fmt.Sscanf(v, "%d", &n)
	if err != nil || n <= 0 {
		return def
	}
	return n
}

func envBool(k string) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(k)))
	return v == "1" || v == "true" || v == "yes"
}
