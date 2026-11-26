package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)
		rid, _ := c.Get(ContextRequestID)
		log.Printf("request_id=%v method=%s path=%s status=%d latency_ms=%d", rid, c.Request.Method, c.Request.URL.Path, c.Writer.Status(), latency.Milliseconds())
	}
}
