package models

import "strings"

func NormalizeRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "platform_admin":
		return "platform_admin"
	case "org_admin", "organization", "organization_admin":
		return "organization_admin"
	case "researcher_internal":
		return "researcher_internal"
	case "researcher_external":
		return "researcher_external"
	default:
		return strings.ToLower(strings.TrimSpace(role))
	}
}

func RoleMatches(actual string, allowedRoles ...string) bool {
	normalizedActual := NormalizeRole(actual)
	for _, allowed := range allowedRoles {
		if normalizedActual == NormalizeRole(allowed) {
			return true
		}
	}
	return false
}

func BuildAuthUserPayload(u AuthUser) map[string]any {
	role := NormalizeRole(u.Role)
	var organizationID any
	var researcherID any
	if u.OrgID > 0 {
		organizationID = u.OrgID
	}
	if u.ResearcherID > 0 {
		researcherID = u.ResearcherID
	}

	return map[string]any{
		"id":              u.ID,
		"email":           u.Email,
		"full_name":       u.FullName,
		"fullName":        u.FullName,
		"role":            role,
		"legacy_role":     u.Role,
		"organization_id": organizationID,
		"orgId":           u.OrgID,
		"researcher_id":   researcherID,
		"researcherId":    u.ResearcherID,
		"module_access":   []string{"pen"},
	}
}

func BuildLoginPayload(token string, u AuthUser) map[string]any {
	return map[string]any{
		"access_token": token,
		"token_type":   "bearer",
		"token":        token,
		"user":         BuildAuthUserPayload(u),
	}
}
