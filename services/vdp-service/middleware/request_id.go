package middleware

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/gin-gonic/gin"
)

const ContextRequestID = "request_id"

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		buf := make([]byte, 16)
		_, _ = rand.Read(buf)
		id := hex.EncodeToString(buf)
		c.Set(ContextRequestID, id)
		c.Writer.Header().Set("X-Request-ID", id)
		c.Next()
	}
}
