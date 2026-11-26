package middleware

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPUsesForwardedForHeader(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.10, 10.0.0.1")
	req.RemoteAddr = "10.0.0.2:1234"

	if got := clientIP(req); got != "203.0.113.10" {
		t.Fatalf("expected forwarded IP, got %s", got)
	}
}

func TestLoadAllowedOriginsHonorsEnvOverride(t *testing.T) {
	t.Setenv("CORS_ALLOW_ORIGINS", "http://localhost:5276,http://localhost:5999")

	allowed := loadAllowedOrigins()
	if _, ok := allowed["http://localhost:5999"]; !ok {
		t.Fatal("expected custom origin to be included")
	}
	if !isAllowedOrigin("http://localhost:5276", allowed) {
		t.Fatal("expected known origin to be allowed")
	}
}
