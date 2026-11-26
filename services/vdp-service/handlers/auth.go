package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"vdp-service/middleware"
)

type authUserRecord struct {
	ID             string
	Email          string
	FullName       string
	Role           string
	OrganizationID string
}

type authLoginPayload struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authRegisterPayload struct {
	Email          string `json:"email"`
	Password       string `json:"password"`
	FullName       string `json:"full_name"`
	Role           string `json:"role"`
	OrganizationID string `json:"organization_id"`
}

type platformBootstrapOrganization struct {
	Name    string `json:"name"`
	Slug    string `json:"slug"`
	Website string `json:"website"`
}

type platformBootstrapUser struct {
	Email          string                         `json:"email"`
	AccountType    string                         `json:"accountType"`
	ResearcherType string                         `json:"researcherType"`
	FirstName      string                         `json:"firstName"`
	LastName       string                         `json:"lastName"`
	DisplayName    string                         `json:"displayName"`
	EmailVerified  bool                           `json:"emailVerified"`
	ApprovalStatus string                         `json:"approvalStatus"`
	Organization   *platformBootstrapOrganization `json:"organization"`
}

type platformBootstrapResponse struct {
	User         platformBootstrapUser `json:"user"`
	PlatformRole string                `json:"platformRole"`
}

func buildAuthUserPayload(user authUserRecord) gin.H {
	role := middleware.NormalizeRole(user.Role)
	var organizationID any
	if strings.TrimSpace(user.OrganizationID) != "" {
		organizationID = user.OrganizationID
	}
	return gin.H{
		"id":              user.ID,
		"email":           user.Email,
		"full_name":       user.FullName,
		"role":            role,
		"legacy_role":     user.Role,
		"organization_id": organizationID,
		"module_access":   []string{"vdp"},
	}
}

func (h *Handler) signAuthUserToken(user authUserRecord) (string, error) {
	now := time.Now()
	claims := middleware.Claims{
		UserID: user.ID,
		Role:   middleware.NormalizeRole(user.Role),
		OrgID:  strings.TrimSpace(user.OrganizationID),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.Config.JWTSecret))
}

func (h *Handler) parseOptionalAuthClaims(c *gin.Context) (*middleware.Claims, error) {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		return nil, nil
	}
	if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return nil, errors.New("authorization header must be bearer token")
	}
	tokenStr := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer"))
	if tokenStr == "" {
		return nil, errors.New("bearer token is empty")
	}

	claims := &middleware.Claims{}
	parsed, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.Config.JWTSecret), nil
	})
	if err != nil || parsed == nil || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	claims.Role = middleware.NormalizeRole(claims.Role)
	return claims, nil
}

func (h *Handler) LoginAuthUser(c *gin.Context) {
	var payload authLoginPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(payload.Email))
	password := strings.TrimSpace(payload.Password)
	if email == "" || password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	var user authUserRecord
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT id::text, email, full_name, role, COALESCE(org_id::text, '')
		FROM vdp_users
		WHERE email = $1
		  AND status = 'active'
		  AND password_hash = crypt($2, password_hash)
	`, email, password).Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &user.OrganizationID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := h.signAuthUserToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": token,
		"token_type":   "bearer",
		"token":        token,
		"user":         buildAuthUserPayload(user),
	})
}

func (h *Handler) BootstrapAuthUser(c *gin.Context) {
	platformUser, platformRole, err := h.introspectPlatformSession(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	localUser, err := h.syncPlatformUser(c, platformUser, platformRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	token, err := h.signAuthUserToken(localUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sign token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": token,
		"token_type":   "bearer",
		"token":        token,
		"user":         buildAuthUserPayload(localUser),
	})
}

func (h *Handler) RegisterAuthUser(c *gin.Context) {
	var payload authRegisterPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}

	role := middleware.NormalizeRole(payload.Role)
	if role != "platform_admin" && role != "organization_admin" && role != "hacker" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported role"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(payload.Email))
	password := strings.TrimSpace(payload.Password)
	fullName := strings.TrimSpace(payload.FullName)
	orgID := strings.TrimSpace(payload.OrganizationID)
	if email == "" || password == "" || fullName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email, password, and full_name are required"})
		return
	}
	if role == "organization_admin" && orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "organization_id is required for organization admin users"})
		return
	}

	if role != "hacker" {
		claims, err := h.parseOptionalAuthClaims(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}
		if claims == nil || claims.Role != "platform_admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "platform admin token required for this role"})
			return
		}
	}

	if role == "organization_admin" {
		var exists bool
		if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1::uuid)`, orgID).Scan(&exists); err != nil || !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
			return
		}
	}

	var user authUserRecord
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO vdp_users (email, full_name, password_hash, role, org_id, status)
		VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, NULLIF($5, '')::uuid, 'active')
		RETURNING id::text, email, full_name, role, COALESCE(org_id::text, '')
	`, email, fullName, password, role, orgID).Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &user.OrganizationID)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, buildAuthUserPayload(user))
}

func (h *Handler) GetCurrentAuthUser(c *gin.Context) {
	userID, ok := c.Get(middleware.ContextUserID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user"})
		return
	}

	var user authUserRecord
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT id::text, email, full_name, role, COALESCE(org_id::text, '')
		FROM vdp_users
		WHERE id = $1::uuid
		  AND status = 'active'
	`, userID).Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &user.OrganizationID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, buildAuthUserPayload(user))
}

func (h *Handler) introspectPlatformSession(c *gin.Context) (*platformBootstrapUser, string, error) {
	sessionToken := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(sessionToken), "bearer ") {
		sessionToken = strings.TrimSpace(sessionToken[7:])
	}
	if sessionToken == "" {
		cookie, err := c.Request.Cookie(strings.TrimSpace(h.Config.AuthSessionCookieName))
		if err == nil && cookie != nil {
			sessionToken = strings.TrimSpace(cookie.Value)
		}
	}
	if sessionToken == "" {
		return nil, "", errors.New("Sign in through AntCrowd first")
	}

	body, _ := json.Marshal(gin.H{"sessionToken": sessionToken})
	req, err := http.NewRequestWithContext(
		c.Request.Context(),
		http.MethodPost,
		h.Config.AuthServiceIntrospectURL,
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, "", errors.New("Unable to connect VDP to the AntCrowd session broker")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Service-Token", h.Config.AuthInternalServiceToken)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", errors.New("Unable to confirm your AntCrowd session right now")
	}
	defer resp.Body.Close()

	var decoded platformBootstrapResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, "", errors.New("Unable to read your AntCrowd session")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", errors.New("Your AntCrowd session is no longer valid")
	}

	return &decoded.User, decoded.PlatformRole, nil
}

func (h *Handler) syncPlatformUser(c *gin.Context, user *platformBootstrapUser, platformRole ...string) (authUserRecord, error) {
	if user == nil {
		return authUserRecord{}, errors.New("Missing AntCrowd user context")
	}

	accountType := strings.ToLower(strings.TrimSpace(user.AccountType))
	approvalStatus := strings.ToLower(strings.TrimSpace(user.ApprovalStatus))
	email := strings.ToLower(strings.TrimSpace(user.Email))
	fullName := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if fullName == "" {
		fullName = strings.TrimSpace(user.DisplayName)
	}
	if fullName == "" {
		fullName = email
	}

	// If the auth-service assigned a platform-level role, honour it regardless of accountType.
	effectivePlatformRole := ""
	if len(platformRole) > 0 {
		effectivePlatformRole = strings.ToLower(strings.TrimSpace(platformRole[0]))
	}
	isPlatformAdmin := accountType == "platform_admin" || accountType == "platform-admin" || accountType == "admin" ||
		effectivePlatformRole == "platform_admin" || effectivePlatformRole == "platform-admin"
	isComplianceTeam := effectivePlatformRole == "compliance_team"
	isDeveloper := effectivePlatformRole == "developer"

	// Only enforce email verification for non-platform-admin accounts; seeded
	// platform admin accounts may not have email_verified_at set in the auth DB.
	if !isPlatformAdmin && !isComplianceTeam && !isDeveloper && !user.EmailVerified {
		return authUserRecord{}, errors.New("Verify your AntCrowd email before using VDP")
	}

	role := ""
	orgID := ""
	switch {
	case isPlatformAdmin:
		role = "platform_admin"
	case accountType == "organization":
		if approvalStatus != "approved" && approvalStatus != "not_required" {
			return authUserRecord{}, errors.New("Your organization must be approved before using VDP")
		}
		role = "organization_admin"
		var err error
		orgID, err = h.ensurePlatformOrganization(c, user, fullName)
		if err != nil {
			return authUserRecord{}, err
		}
	case accountType == "researcher" || accountType == "hacker":
		role = "hacker"
	case isComplianceTeam:
		role = "compliance_team"
	case isDeveloper:
		role = "developer"
	default:
		return authUserRecord{}, errors.New("This VDP workspace is not available for your role")
	}

	var localUser authUserRecord
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO vdp_users (email, full_name, password_hash, role, org_id, status)
		VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, NULLIF($5, '')::uuid, 'active')
		ON CONFLICT (email) DO UPDATE
		SET full_name = EXCLUDED.full_name,
		    role = EXCLUDED.role,
		    org_id = EXCLUDED.org_id,
		    status = 'active'
		RETURNING id::text, email, full_name, role, COALESCE(org_id::text, '')
	`, email, fullName, "platform-sso:"+email, role, orgID).Scan(
		&localUser.ID,
		&localUser.Email,
		&localUser.FullName,
		&localUser.Role,
		&localUser.OrganizationID,
	)
	if err != nil {
		return authUserRecord{}, err
	}

	return localUser, nil
}

func (h *Handler) ensurePlatformOrganization(c *gin.Context, user *platformBootstrapUser, fullName string) (string, error) {
	orgName := "AntCrowd Organization"
	orgSlug := "antcrowd-organization"
	website := ""
	if user.Organization != nil {
		if strings.TrimSpace(user.Organization.Name) != "" {
			orgName = strings.TrimSpace(user.Organization.Name)
		}
		if strings.TrimSpace(user.Organization.Slug) != "" {
			orgSlug = strings.TrimSpace(user.Organization.Slug)
		}
		website = strings.TrimSpace(user.Organization.Website)
	}

	var orgID string
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO organizations (id, name, slug, contact_email, contact_name, website, description)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, NULLIF($5, ''), $6)
		ON CONFLICT (slug) DO UPDATE
		SET name = EXCLUDED.name,
		    contact_email = EXCLUDED.contact_email,
		    contact_name = EXCLUDED.contact_name,
		    website = COALESCE(NULLIF(EXCLUDED.website, ''), organizations.website),
		    description = COALESCE(NULLIF(EXCLUDED.description, ''), organizations.description),
		    updated_at = NOW()
		RETURNING id::text
	`, orgName, orgSlug, strings.ToLower(strings.TrimSpace(user.Email)), fullName, website, "Managed from the AntCrowd organization workspace").Scan(&orgID)
	if err != nil {
		return "", err
	}
	return orgID, nil
}
