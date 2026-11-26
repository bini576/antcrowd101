package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	mu       sync.Mutex
	clients  map[string]*limiterEntry
	r        rate.Limit
	burst    int
	cleanup  time.Duration
}

func NewRateLimiter(rpm int) *RateLimiter {
	if rpm <= 0 {
		rpm = 30
	}
	return &RateLimiter{
		clients: make(map[string]*limiterEntry),
		r:       rate.Every(time.Minute / time.Duration(rpm)),
		burst:   5,
		cleanup: 10 * time.Minute,
	}
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := clientIP(c)
		lim := rl.getLimiter(ip)
		if !lim.Allow() {
			c.AbortWithStatus(http.StatusTooManyRequests)
			return
		}
		c.Next()
	}
}

func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if ent, ok := rl.clients[ip]; ok {
		ent.lastSeen = time.Now()
		return ent.limiter
	}

	lim := rate.NewLimiter(rl.r, rl.burst)
	rl.clients[ip] = &limiterEntry{limiter: lim, lastSeen: time.Now()}
	return lim
}

func (rl *RateLimiter) StartCleanup() {
	ticker := time.NewTicker(rl.cleanup)
	go func() {
		for range ticker.C {
			rl.mu.Lock()
			cutoff := time.Now().Add(-rl.cleanup)
			for ip, ent := range rl.clients {
				if ent.lastSeen.Before(cutoff) {
					delete(rl.clients, ip)
				}
			}
			rl.mu.Unlock()
		}
	}()
}

func clientIP(c *gin.Context) string {
	ip := c.ClientIP()
	if ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return host
}
