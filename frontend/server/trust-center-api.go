package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const defaultPort = 4001

var (
	headcountOptions = map[string]struct{}{
		"1-50":     {},
		"51-200":   {},
		"201-1000": {},
		"1000+":    {},
	}
	countryOptions = map[string]struct{}{
		"ethiopia":   {},
		"kenya":      {},
		"addisababa": {},
		"bahirdar":   {},
	}
	emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
)

type requestPayload struct {
	Email     string `json:"email"`
	Headcount string `json:"headcount"`
	Country   string `json:"country"`
	HearAbout string `json:"hearAbout"`
}

type submission struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	Headcount   string  `json:"headcount"`
	Country     string  `json:"country"`
	HearAbout   *string `json:"hearAbout,omitempty"`
	Status      string  `json:"status"`
	Notes       string  `json:"notes,omitempty"`
	ReviewedBy  string  `json:"reviewedBy,omitempty"`
	SubmittedAt string  `json:"submittedAt"`
	IP          string  `json:"ip"`
}

type errorResponse struct {
	Detail []string `json:"detail"`
}

type messageResponse struct {
	Message string `json:"message"`
}

var (
	submissions   []submission
	submissionsMu sync.RWMutex
)

func main() {
	port := defaultPort
	if env := os.Getenv("TRUST_CENTER_API_PORT"); env != "" {
		if parsed, err := strconv.Atoi(env); err == nil && parsed > 0 {
			port = parsed
		}
	}

	http.HandleFunc("/api/trust-center/request-demo", requestDemoHandler)
	http.HandleFunc("/api/trust-center/submissions", submissionsHandler)
	http.HandleFunc("/api/admin/", adminRouter)
	http.HandleFunc("/", notFoundHandler)

	log.Printf("[Trust Center API] Listening on port %d", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
}

func requestDemoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		setCORSHeaders(w, r)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
		return
	}

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&payload); err != nil {
		if !errors.Is(err, io.EOF) {
			respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Invalid JSON payload."}})
			return
		}
	}

	email := strings.TrimSpace(payload.Email)
	headcount := strings.TrimSpace(payload.Headcount)
	country := strings.ToLower(strings.TrimSpace(payload.Country))
	hearAbout := strings.TrimSpace(payload.HearAbout)

	var validationErrors []string

	if email == "" {
		validationErrors = append(validationErrors, "Email is required.")
	} else if !emailPattern.MatchString(email) {
		validationErrors = append(validationErrors, "Email is not a valid address.")
	}

	if headcount == "" {
		validationErrors = append(validationErrors, "Company headcount is required.")
	} else if _, ok := headcountOptions[headcount]; !ok {
		validationErrors = append(validationErrors, "Please choose a valid headcount range.")
	}

	if country == "" {
		validationErrors = append(validationErrors, "Country is required.")
	} else if _, ok := countryOptions[country]; !ok {
		validationErrors = append(validationErrors, "Country selection is not recognized.")
	}

	if len(hearAbout) > 200 {
		validationErrors = append(validationErrors, "Additional context must be under 200 characters.")
	}

	if len(validationErrors) > 0 {
		respondJSON(w, r, http.StatusUnprocessableEntity, errorResponse{Detail: validationErrors})
		return
	}

	var hearAboutPtr *string
	if hearAbout != "" {
		hearAboutPtr = &hearAbout
	}

	submission := submission{
		ID:          nextSubmissionID(),
		Email:       email,
		Headcount:   headcount,
		Country:     country,
		HearAbout:   hearAboutPtr,
		Status:      "New",
		SubmittedAt: time.Now().UTC().Format(time.RFC3339),
		IP:          requestIP(r),
	}

	submissionsMu.Lock()
	submissions = append(submissions, submission)
	submissionsMu.Unlock()

	log.Printf("[Trust Center API] Received demo request: %+v", submission)

	respondJSON(w, r, http.StatusCreated, messageResponse{Message: "Request submitted successfully."})
}

func submissionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		setCORSHeaders(w, r)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
		return
	}

	submissionsMu.RLock()
	copied := make([]submission, len(submissions))
	copy(copied, submissions)
	submissionsMu.RUnlock()

	respondJSON(w, r, http.StatusOK, map[string]any{"submissions": copied})
}

func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		setCORSHeaders(w, r)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"Not found."}})
}

func respondJSON(w http.ResponseWriter, r *http.Request, status int, payload interface{}) {
	setCORSHeaders(w, r)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if payload == nil {
		return
	}

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("[Trust Center API] failed to write response: %v", err)
	}
}

func setCORSHeaders(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}

	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "POST,GET,PUT,PATCH,DELETE,OPTIONS")
}

func requestIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if candidate := strings.TrimSpace(parts[0]); candidate != "" {
			return candidate
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}

	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}

	return "unknown"
}
