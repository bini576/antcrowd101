package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// SessionUser holds the resolved identity from the platform auth service.
type SessionUser struct {
	Username       string `json:"username"`
	Role           string `json:"role"`
	Email          string `json:"email"`
	DisplayName    string `json:"displayName"`
	AccountType    string `json:"accountType"`
	ResearcherType string `json:"researcherType"`
	UserID         string `json:"userId"`
}

// AnonymousUser represents an unauthenticated visitor.
var AnonymousUser = SessionUser{
	Username:    "__anonymous__",
	Role:        "user",
	Email:       "",
	DisplayName: "Public Visitor",
}

// mapRole maps auth-service identity to internal role names.
//
// - platform_admin           → platform_admin
// - organization             → org_admin
// - researcher + internal    → reviewer  (internal researchers conduct code reviews)
// - researcher + external    → user      (external researchers cannot access code service)
// - anything else            → user
func mapRole(accountType, researcherType string) string {
	switch accountType {
	case "platform_admin":
		return "platform_admin"
	case "compliance_team":
		return "compliance_team"
	case "developer":
		return "developer"
	case "organization":
		return "org_admin"
	case "researcher":
		if researcherType == "internal" {
			return "reviewer"
		}
		return "user"
	default:
		return "user"
	}
}

type introspectRequest struct {
	SessionToken string `json:"sessionToken"`
}

type introspectIdentity struct {
	AccountType    string `json:"accountType"`
	ResearcherType string `json:"researcherType"`
	Email          string `json:"email"`
	UserID         string `json:"userId"`
}

type introspectUserData struct {
	AccountType    string `json:"accountType"`
	ResearcherType string `json:"researcherType"`
	Email          string `json:"email"`
	FirstName      string `json:"firstName"`
	LastName       string `json:"lastName"`
	DisplayName    string `json:"displayName"`
	ID             string `json:"id"`
}

type introspectResponse struct {
	User         introspectUserData `json:"user"`
	Identity     introspectIdentity `json:"identity"`
	PlatformRole string             `json:"platformRole"` // top-level platform-level role
}

// introspectSession calls the auth service introspection endpoint.
func introspectSession(cfg Config, sessionToken string) (*introspectResponse, error) {
	if sessionToken == "" {
		return nil, fmt.Errorf("empty session token")
	}

	body, _ := json.Marshal(introspectRequest{SessionToken: sessionToken})
	req, err := http.NewRequest("POST", cfg.AuthIntrospectURL, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-internal-service-token", cfg.AuthServiceToken)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("introspect returned %d", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result introspectResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// resolveSession reads the platform session cookie (or Authorization: Bearer header),
// calls the auth service, and returns a SessionUser. Returns AnonymousUser on failure.
func resolveSession(r *http.Request, cfg Config) SessionUser {
	// Priority 1: Authorization: Bearer header (used by bootstrapped tabs)
	sessionToken := ""
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		sessionToken = strings.TrimPrefix(auth, "Bearer ")
	}

	// Priority 2: Session cookie (used by platform admin / direct navigation)
	if sessionToken == "" {
		cookie, err := r.Cookie(cfg.SessionCookieName)
		if err != nil || cookie.Value == "" {
			return AnonymousUser
		}
		sessionToken = cookie.Value
	}

	data, err := introspectSession(cfg, sessionToken)
	if err != nil {
		return AnonymousUser
	}

	accountType := data.Identity.AccountType
	if accountType == "" {
		accountType = data.User.AccountType
	}
	researcherType := data.Identity.ResearcherType
	if researcherType == "" {
		researcherType = data.User.ResearcherType
	}
	email := data.Identity.Email
	if email == "" {
		email = data.User.Email
	}
	userID := data.Identity.UserID
	if userID == "" {
		userID = data.User.ID
	}

	// Platform-level role assignments (e.g. compliance_team, developer) take precedence over accountType.
	if data.PlatformRole == "compliance_team" || data.PlatformRole == "developer" {
		accountType = data.PlatformRole
	}

	role := mapRole(accountType, researcherType)
	if role == "user" {
		return AnonymousUser
	}

	displayName := data.User.DisplayName
	if displayName == "" && data.User.FirstName != "" && data.User.LastName != "" {
		displayName = data.User.FirstName + " " + data.User.LastName
	}
	if displayName == "" {
		displayName = email
	}

	return SessionUser{
		Username:       email,
		Role:           role,
		Email:          email,
		DisplayName:    displayName,
		AccountType:    accountType,
		ResearcherType: researcherType,
		UserID:         userID,
	}
}

// getSessionToken extracts the raw session token from the cookie.
func getSessionToken(r *http.Request, cookieName string) string {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}
