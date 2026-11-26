package middleware

import "strings"

func NormalizeRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "platform_admin":
		return "platform_admin"
	case "organization", "organization_admin":
		return "organization_admin"
	case "hacker":
		return "hacker"
	default:
		return strings.ToLower(strings.TrimSpace(role))
	}
}
