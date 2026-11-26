package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type adminAccount struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Scope string `json:"scope"`
}

type adminCredential struct {
	Account  adminAccount
	Password string
}

type adminSession struct {
	Token     string       `json:"token"`
	Account   adminAccount `json:"admin"`
	CreatedAt string       `json:"createdAt"`
}

type adminLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type adminLoginResponse struct {
	Token  string       `json:"token"`
	Admin  adminAccount `json:"admin"`
	Audit  []adminAuditEvent `json:"audit,omitempty"`
}

type adminBootstrapResponse struct {
	Admin    adminAccount      `json:"admin"`
	Requests []submission      `json:"requests"`
	Users    []adminUser       `json:"users"`
	Records  []adminRecord     `json:"records"`
	Audit    []adminAuditEvent `json:"audit"`
}

type adminUser struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Scope  string `json:"scope"`
	Status string `json:"status"`
	MFA    string `json:"mfa"`
}

type adminUserPayload struct {
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Scope  string `json:"scope"`
	Status string `json:"status"`
	MFA    string `json:"mfa"`
}

type adminRecord struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Owner     string `json:"owner"`
	Category  string `json:"category"`
	Status    string `json:"status"`
	UpdatedAt string `json:"updatedAt"`
	Summary   string `json:"summary"`
}

type adminRecordPayload struct {
	Title    string `json:"title"`
	Owner    string `json:"owner"`
	Category string `json:"category"`
	Status   string `json:"status"`
	Summary  string `json:"summary"`
}

type adminRequestPayload struct {
	Status    string `json:"status"`
	Notes     string `json:"notes"`
	ReviewedBy string `json:"reviewedBy"`
}

type adminAuditEvent struct {
	ID      string `json:"id"`
	Actor   string `json:"actor"`
	Action  string `json:"action"`
	Target  string `json:"target"`
	Time    string `json:"time"`
	Details string `json:"details,omitempty"`
}

var (
	adminStateMu sync.RWMutex
	adminSessions = map[string]adminSession{}
	adminAccounts  = map[string]adminCredential{}
	adminUsers     []adminUser
	adminRecords   []adminRecord
	adminAudit     []adminAuditEvent

	idMu             sync.Mutex
	adminAuditSeq    int
	adminUserSeq     int
	adminRecordSeq   int
	adminSessionSeq  int
	submissionSeq    int
)

func init() {
	adminAccounts = map[string]adminCredential{
		"admin@antcrowd.com": {
			Account: adminAccount{
				ID:    "acct-platform",
				Name:  "Platform Admin",
				Email: "admin@antcrowd.com",
				Role:  "Platform Admin",
				Scope: "Global",
			},
			Password: "admin123",
		},
		"grc@antcrowd.com": {
			Account: adminAccount{
				ID:    "acct-grc",
				Name:  "GRC Lead",
				Email: "grc@antcrowd.com",
				Role:  "Compliance / GRC",
				Scope: "Trust Center",
			},
			Password: "admin123",
		},
		"eng@antcrowd.com": {
			Account: adminAccount{
				ID:    "acct-eng",
				Name:  "Engineering Lead",
				Email: "eng@antcrowd.com",
				Role:  "Developer / Engineering",
				Scope: "Product Engineering",
			},
			Password: "admin123",
		},
		"owner@acme.com": {
			Account: adminAccount{
				ID:    "acct-owner",
				Name:  "Acme Owner",
				Email: "owner@acme.com",
				Role:  "Client Owner",
				Scope: "Acme Health",
			},
			Password: "admin123",
		},
		"researcher@antcrowd.com": {
			Account: adminAccount{
				ID:    "acct-researcher",
				Name:  "Research Ops",
				Email: "researcher@antcrowd.com",
				Role:  "Researcher",
				Scope: "Research Ops",
			},
			Password: "admin123",
		},
	}

	adminUsers = []adminUser{
		{ID: nextAdminUserID(), Name: "Amina Tesfaye", Email: "amina@acme.co", Role: "Client Owner", Scope: "Acme Health", Status: "Active", MFA: "Enabled"},
		{ID: nextAdminUserID(), Name: "Lucas Grant", Email: "lucas@antcrowd.com", Role: "Platform Admin", Scope: "Global", Status: "Active", MFA: "Required"},
		{ID: nextAdminUserID(), Name: "Meklit T.", Email: "meklit.researcher@antcrowd.com", Role: "Internal Researcher", Scope: "Bug Bounty", Status: "Active", MFA: "Enabled"},
		{ID: nextAdminUserID(), Name: "Nadia Hussain", Email: "nadia@vendor.net", Role: "External Researcher", Scope: "VDP", Status: "Pending", MFA: "Enabled"},
		{ID: nextAdminUserID(), Name: "Sofia Mendez", Email: "sofia@antcrowd.com", Role: "Compliance / GRC", Scope: "Trust Center", Status: "Suspended", MFA: "Required"},
	}

	adminRecords = []adminRecord{
		{ID: nextAdminRecordID(), Title: "Security questionnaire export", Owner: "Compliance / GRC", Category: "Trust Center", Status: "Published", UpdatedAt: "2026-04-10", Summary: "Customer-facing evidence bundle."},
		{ID: nextAdminRecordID(), Title: "Org access review log", Owner: "Platform Admin", Category: "Identity", Status: "In review", UpdatedAt: "2026-04-12", Summary: "Quarterly access attestation."},
		{ID: nextAdminRecordID(), Title: "Researcher payout ledger", Owner: "Finance Ops", Category: "Payments", Status: "Draft", UpdatedAt: "2026-04-13", Summary: "Pending payout reconciliation."},
		{ID: nextAdminRecordID(), Title: "Incident response evidence", Owner: "Developer / Engineering", Category: "Operations", Status: "Archived", UpdatedAt: "2026-04-02", Summary: "Post-incident analysis reference."},
	}

	adminAudit = []adminAuditEvent{
		{ID: nextAdminAuditID(), Actor: "Lucas Grant", Action: "Revoked stale token", Target: "org/acme-health", Time: "2 minutes ago"},
		{ID: nextAdminAuditID(), Actor: "Sofia Mendez", Action: "Exported evidence pack", Target: "trust-center", Time: "18 minutes ago"},
		{ID: nextAdminAuditID(), Actor: "Nadia Hussain", Action: "Submitted vulnerability report", Target: "report #8421", Time: "1 hour ago"},
		{ID: nextAdminAuditID(), Actor: "Amina Tesfaye", Action: "Updated org owners", Target: "Acme Health", Time: "4 hours ago"},
	}

	submissions = []submission{
		{
			ID:          nextSubmissionID(),
			Email:       "ops@acme.co",
			Headcount:   "51-200",
			Country:     "ethiopia",
			Status:      "New",
			SubmittedAt: time.Now().UTC().Add(-2 * time.Hour).Format(time.RFC3339),
			IP:          "127.0.0.1",
		},
		{
			ID:          nextSubmissionID(),
			Email:       "security@northwind.io",
			Headcount:   "201-1000",
			Country:     "kenya",
			Status:      "Reviewed",
			ReviewedBy:  "Lucas Grant",
			Notes:       "Requested NDA follow-up.",
			SubmittedAt: time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339),
			IP:          "127.0.0.1",
		},
	}

	adminSessions = map[string]adminSession{}
}

func adminRouter(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		setCORSHeaders(w, r)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/admin/")
	if path == r.URL.Path {
		respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"Not found."}})
		return
	}

	switch {
	case path == "auth/login":
		adminLoginHandler(w, r)
		return
	case path == "bootstrap":
		handleAdminBootstrap(w, r)
		return
	case path == "me":
		handleAdminMe(w, r)
		return
	}

	account, ok := requireAdminAccount(w, r)
	if !ok {
		return
	}

	switch {
	case path == "requests":
		handleAdminRequests(w, r, account)
	case strings.HasPrefix(path, "requests/"):
		handleAdminRequestByID(w, r, account, strings.TrimPrefix(path, "requests/"))
	case path == "users":
		handleAdminUsers(w, r, account)
	case strings.HasPrefix(path, "users/"):
		handleAdminUserByID(w, r, account, strings.TrimPrefix(path, "users/"))
	case path == "records":
		handleAdminRecords(w, r, account)
	case strings.HasPrefix(path, "records/"):
		handleAdminRecordByID(w, r, account, strings.TrimPrefix(path, "records/"))
	case path == "audit":
		handleAdminAudit(w, r)
	default:
		respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"Not found."}})
	}
}

func adminLoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
		return
	}

	var payload adminLoginRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&payload); err != nil && !errors.Is(err, io.EOF) {
		respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Invalid JSON payload."}})
		return
	}

	email := strings.TrimSpace(strings.ToLower(payload.Email))
	password := strings.TrimSpace(payload.Password)
	role := strings.TrimSpace(payload.Role)

	adminStateMu.RLock()
	credential, ok := adminAccounts[email]
	adminStateMu.RUnlock()

	if !ok || credential.Password != password {
		respondJSON(w, r, http.StatusUnauthorized, errorResponse{Detail: []string{"Invalid admin credentials."}})
		return
	}

	if role != "" && credential.Account.Role != role {
		respondJSON(w, r, http.StatusForbidden, errorResponse{Detail: []string{"This account is not allowed to sign in with the selected role."}})
		return
	}

	token := newAdminToken()
	session := adminSession{
		Token:     token,
		Account:   credential.Account,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	adminStateMu.Lock()
	adminSessions[token] = session
	adminStateMu.Unlock()

	appendAdminAudit(session.Account.Name, "Signed in", session.Account.Role)
	respondJSON(w, r, http.StatusOK, adminLoginResponse{Token: token, Admin: session.Account})
}

func handleAdminBootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
		return
	}

	account, ok := requireAdminAccount(w, r)
	if !ok {
		return
	}

	respondJSON(w, r, http.StatusOK, adminBootstrapResponse{
		Admin:    account,
		Requests: copySubmissions(),
		Users:    copyAdminUsers(),
		Records:  copyAdminRecords(),
		Audit:    copyAdminAudit(),
	})
}

func handleAdminMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
		return
	}

	account, ok := requireAdminAccount(w, r)
	if !ok {
		return
	}

	respondJSON(w, r, http.StatusOK, map[string]any{"admin": account})
}

func handleAdminRequests(w http.ResponseWriter, r *http.Request, account adminAccount) {
	switch r.Method {
	case http.MethodGet:
		respondJSON(w, r, http.StatusOK, map[string]any{"requests": copySubmissions()})
	case http.MethodPost:
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Use the Trust Center form to create requests."}})
	default:
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
	}
}

func handleAdminRequestByID(w http.ResponseWriter, r *http.Request, account adminAccount, id string) {
	id = strings.Trim(id, "/")
	if id == "" {
		respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Request ID is required."}})
		return
	}

	switch r.Method {
	case http.MethodPut:
		var payload adminRequestPayload
		decoder := json.NewDecoder(r.Body)
		if err := decoder.Decode(&payload); err != nil && !errors.Is(err, io.EOF) {
			respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Invalid JSON payload."}})
			return
		}

		submissionsMu.Lock()
		defer submissionsMu.Unlock()

		index := findSubmissionIndexLocked(id)
		if index < 0 {
			respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"Request not found."}})
			return
		}

		if status := strings.TrimSpace(payload.Status); status != "" {
			submissions[index].Status = status
		}
		if notes := strings.TrimSpace(payload.Notes); notes != "" {
			submissions[index].Notes = notes
		}
		if reviewedBy := strings.TrimSpace(payload.ReviewedBy); reviewedBy != "" {
			submissions[index].ReviewedBy = reviewedBy
		}

		submissions[index].SubmittedAt = submissions[index].SubmittedAt
		appendAdminAudit(account.Name, "Updated request", submissions[index].Email)
		respondJSON(w, r, http.StatusOK, submissions[index])
	case http.MethodDelete:
		submissionsMu.Lock()
		defer submissionsMu.Unlock()

		index := findSubmissionIndexLocked(id)
		if index < 0 {
			respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"Request not found."}})
			return
		}

		target := submissions[index].Email
		submissions = append(submissions[:index], submissions[index+1:]...)
		appendAdminAudit(account.Name, "Deleted request", target)
		respondJSON(w, r, http.StatusOK, messageResponse{Message: "Request deleted."})
	default:
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
	}
}

func handleAdminUsers(w http.ResponseWriter, r *http.Request, account adminAccount) {
	switch r.Method {
	case http.MethodGet:
		respondJSON(w, r, http.StatusOK, map[string]any{"users": copyAdminUsers()})
	case http.MethodPost:
		var payload adminUserPayload
		decoder := json.NewDecoder(r.Body)
		if err := decoder.Decode(&payload); err != nil && !errors.Is(err, io.EOF) {
			respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Invalid JSON payload."}})
			return
		}

		user := adminUser{
			ID:     nextAdminUserID(),
			Name:   fallbackString(payload.Name, "New User"),
			Email:  fallbackString(payload.Email, "new.user@antcrowd.com"),
			Role:   fallbackString(payload.Role, "Client Owner"),
			Scope:  fallbackString(payload.Scope, "Global"),
			Status: fallbackString(payload.Status, "Pending"),
			MFA:    fallbackString(payload.MFA, "Off"),
		}

		adminStateMu.Lock()
		adminUsers = append(adminUsers, user)
		adminStateMu.Unlock()

		appendAdminAudit(account.Name, "Created user", user.Email)
		respondJSON(w, r, http.StatusCreated, user)
	default:
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
	}
}

func handleAdminUserByID(w http.ResponseWriter, r *http.Request, account adminAccount, id string) {
	id = strings.Trim(id, "/")
	if id == "" {
		respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"User ID is required."}})
		return
	}

	switch r.Method {
	case http.MethodPut:
		var payload adminUserPayload
		decoder := json.NewDecoder(r.Body)
		if err := decoder.Decode(&payload); err != nil && !errors.Is(err, io.EOF) {
			respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Invalid JSON payload."}})
			return
		}

		adminStateMu.Lock()

		index := findAdminUserIndexLocked(id)
		if index < 0 {
			adminStateMu.Unlock()
			respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"User not found."}})
			return
		}

		if value := strings.TrimSpace(payload.Name); value != "" {
			adminUsers[index].Name = value
		}
		if value := strings.TrimSpace(payload.Email); value != "" {
			adminUsers[index].Email = value
		}
		if value := strings.TrimSpace(payload.Role); value != "" {
			adminUsers[index].Role = value
		}
		if value := strings.TrimSpace(payload.Scope); value != "" {
			adminUsers[index].Scope = value
		}
		if value := strings.TrimSpace(payload.Status); value != "" {
			adminUsers[index].Status = value
		}
		if value := strings.TrimSpace(payload.MFA); value != "" {
			adminUsers[index].MFA = value
		}
		updatedUser := adminUsers[index]
		updatedEmail := adminUsers[index].Email
		adminStateMu.Unlock()

		appendAdminAudit(account.Name, "Updated user", updatedEmail)
		respondJSON(w, r, http.StatusOK, updatedUser)
	case http.MethodDelete:
		adminStateMu.Lock()

		index := findAdminUserIndexLocked(id)
		if index < 0 {
			adminStateMu.Unlock()
			respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"User not found."}})
			return
		}

		target := adminUsers[index].Email
		adminUsers = append(adminUsers[:index], adminUsers[index+1:]...)
		adminStateMu.Unlock()
		appendAdminAudit(account.Name, "Deleted user", target)
		respondJSON(w, r, http.StatusOK, messageResponse{Message: "User deleted."})
	default:
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
	}
}

func handleAdminRecords(w http.ResponseWriter, r *http.Request, account adminAccount) {
	switch r.Method {
	case http.MethodGet:
		respondJSON(w, r, http.StatusOK, map[string]any{"records": copyAdminRecords()})
	case http.MethodPost:
		var payload adminRecordPayload
		decoder := json.NewDecoder(r.Body)
		if err := decoder.Decode(&payload); err != nil && !errors.Is(err, io.EOF) {
			respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Invalid JSON payload."}})
			return
		}

		record := adminRecord{
			ID:        nextAdminRecordID(),
			Title:     fallbackString(payload.Title, "Untitled record"),
			Owner:     fallbackString(payload.Owner, account.Role),
			Category:  fallbackString(payload.Category, "General"),
			Status:    fallbackString(payload.Status, "Draft"),
			UpdatedAt: time.Now().UTC().Format("2006-01-02"),
			Summary:   strings.TrimSpace(payload.Summary),
		}

		adminStateMu.Lock()
		adminRecords = append(adminRecords, record)
		adminStateMu.Unlock()

		appendAdminAudit(account.Name, "Created record", record.Title)
		respondJSON(w, r, http.StatusCreated, record)
	default:
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
	}
}

func handleAdminRecordByID(w http.ResponseWriter, r *http.Request, account adminAccount, id string) {
	id = strings.Trim(id, "/")
	if id == "" {
		respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Record ID is required."}})
		return
	}

	switch r.Method {
	case http.MethodPut:
		var payload adminRecordPayload
		decoder := json.NewDecoder(r.Body)
		if err := decoder.Decode(&payload); err != nil && !errors.Is(err, io.EOF) {
			respondJSON(w, r, http.StatusBadRequest, errorResponse{Detail: []string{"Invalid JSON payload."}})
			return
		}

		adminStateMu.Lock()

		index := findAdminRecordIndexLocked(id)
		if index < 0 {
			adminStateMu.Unlock()
			respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"Record not found."}})
			return
		}

		if value := strings.TrimSpace(payload.Title); value != "" {
			adminRecords[index].Title = value
		}
		if value := strings.TrimSpace(payload.Owner); value != "" {
			adminRecords[index].Owner = value
		}
		if value := strings.TrimSpace(payload.Category); value != "" {
			adminRecords[index].Category = value
		}
		if value := strings.TrimSpace(payload.Status); value != "" {
			adminRecords[index].Status = value
		}
		if value := strings.TrimSpace(payload.Summary); value != "" {
			adminRecords[index].Summary = value
		}
		adminRecords[index].UpdatedAt = time.Now().UTC().Format("2006-01-02")
		updatedRecord := adminRecords[index]
		updatedTitle := adminRecords[index].Title
		adminStateMu.Unlock()

		appendAdminAudit(account.Name, "Updated record", updatedTitle)
		respondJSON(w, r, http.StatusOK, updatedRecord)
	case http.MethodDelete:
		adminStateMu.Lock()

		index := findAdminRecordIndexLocked(id)
		if index < 0 {
			adminStateMu.Unlock()
			respondJSON(w, r, http.StatusNotFound, errorResponse{Detail: []string{"Record not found."}})
			return
		}

		target := adminRecords[index].Title
		adminRecords = append(adminRecords[:index], adminRecords[index+1:]...)
		adminStateMu.Unlock()
		appendAdminAudit(account.Name, "Deleted record", target)
		respondJSON(w, r, http.StatusOK, messageResponse{Message: "Record deleted."})
	default:
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
	}
}

func handleAdminAudit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondJSON(w, r, http.StatusMethodNotAllowed, errorResponse{Detail: []string{"Method not allowed."}})
		return
	}

	respondJSON(w, r, http.StatusOK, map[string]any{"audit": copyAdminAudit()})
}

func requireAdminAccount(w http.ResponseWriter, r *http.Request) (adminAccount, bool) {
	token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if token == "" {
		respondJSON(w, r, http.StatusUnauthorized, errorResponse{Detail: []string{"Missing admin token."}})
		return adminAccount{}, false
	}

	adminStateMu.RLock()
	session, ok := adminSessions[token]
	adminStateMu.RUnlock()
	if !ok {
		respondJSON(w, r, http.StatusUnauthorized, errorResponse{Detail: []string{"Invalid admin token."}})
		return adminAccount{}, false
	}

	return session.Account, true
}

func copySubmissions() []submission {
	submissionsMu.RLock()
	defer submissionsMu.RUnlock()

	copied := make([]submission, len(submissions))
	copy(copied, submissions)
	return copied
}

func copyAdminUsers() []adminUser {
	adminStateMu.RLock()
	defer adminStateMu.RUnlock()

	copied := make([]adminUser, len(adminUsers))
	copy(copied, adminUsers)
	return copied
}

func copyAdminRecords() []adminRecord {
	adminStateMu.RLock()
	defer adminStateMu.RUnlock()

	copied := make([]adminRecord, len(adminRecords))
	copy(copied, adminRecords)
	return copied
}

func copyAdminAudit() []adminAuditEvent {
	adminStateMu.RLock()
	defer adminStateMu.RUnlock()

	copied := make([]adminAuditEvent, len(adminAudit))
	copy(copied, adminAudit)
	return copied
}

func appendAdminAudit(actor, action, target string) {
	adminStateMu.Lock()
	defer adminStateMu.Unlock()

	adminAudit = append(adminAudit, adminAuditEvent{
		ID:     nextAdminAuditID(),
		Actor:  actor,
		Action: action,
		Target: target,
		Time:   time.Now().UTC().Format(time.RFC3339),
	})
}

func newAdminToken() string {
	var raw [24]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return fmt.Sprintf("token-%d", time.Now().UTC().UnixNano())
	}
	return hex.EncodeToString(raw[:])
}

func nextAdminAuditID() string {
	idMu.Lock()
	defer idMu.Unlock()
	adminAuditSeq++
	return fmt.Sprintf("audit-%03d", adminAuditSeq)
}

func nextAdminUserID() string {
	idMu.Lock()
	defer idMu.Unlock()
	adminUserSeq++
	return fmt.Sprintf("user-%03d", adminUserSeq)
}

func nextAdminRecordID() string {
	idMu.Lock()
	defer idMu.Unlock()
	adminRecordSeq++
	return fmt.Sprintf("record-%03d", adminRecordSeq)
}

func nextSubmissionID() string {
	idMu.Lock()
	defer idMu.Unlock()
	submissionSeq++
	return fmt.Sprintf("req-%03d", submissionSeq)
}

func findSubmissionIndexLocked(id string) int {
	for i := range submissions {
		if submissions[i].ID == id {
			return i
		}
	}
	return -1
}

func findAdminUserIndexLocked(id string) int {
	for i := range adminUsers {
		if adminUsers[i].ID == id {
			return i
		}
	}
	return -1
}

func findAdminRecordIndexLocked(id string) int {
	for i := range adminRecords {
		if adminRecords[i].ID == id {
			return i
		}
	}
	return -1
}

func fallbackString(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}
