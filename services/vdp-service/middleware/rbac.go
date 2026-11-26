package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[NormalizeRole(r)] = struct{}{}
	}

	return func(c *gin.Context) {
		role, ok := c.Get(ContextRole)
		if !ok {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		roleStr, ok := role.(string)
		if !ok {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		if _, exists := allowed[NormalizeRole(roleStr)]; !exists {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		c.Next()
	}
}
