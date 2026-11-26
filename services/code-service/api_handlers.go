package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, status int, msg string) {
	jsonResponse(w, status, map[string]string{"detail": msg})
}

func handleWhoAmI(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := resolveSession(r, cfg)
		jsonResponse(w, 200, map[string]interface{}{
			"authenticated": user.Role != "user",
			"role":          user.Role,
			"email":         user.Email,
			"displayName":   user.DisplayName,
			"username":      user.Username,
			"loginUrl":      cfg.PlatformLoginURL,
			"logoutUrl":     cfg.PlatformLogoutURL,
			"service": map[string]string{
				"key":  "code",
				"name": "Code Security Service",
			},
		})
	}
}

func handleAuthBootstrap(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role == "user" {
			jsonError(w, 401, "Authentication required")
			return
		}
		token := getSessionToken(r, cfg.SessionCookieName)
		jsonResponse(w, 200, map[string]interface{}{
			"access_token": token,
			"token":        token,
			"user": map[string]string{
				"role":        user.Role,
				"email":       user.Email,
				"displayName": user.DisplayName,
				"username":    user.Username,
			},
		})
	}
}

func handleAdminSummary(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := resolveSession(r, cfg)
		if user.Role != "platform_admin" {
			jsonError(w, 403, "Platform admin access required")
			return
		}
		var pending, approved, inReview, completed, rejected, total, findings int
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='pending'").Scan(&pending)
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='approved'").Scan(&approved)
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='in_review'").Scan(&inReview)
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='completed'").Scan(&completed)
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='rejected'").Scan(&rejected)
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests").Scan(&total)
		db.QueryRow("SELECT COUNT(*) FROM code_review_findings").Scan(&findings)

		jsonResponse(w, 200, map[string]interface{}{
			"service":     "code",
			"serviceName": "Code Security Service",
			"pending":     pending,
			"approved":    approved,
			"inReview":    inReview,
			"completed":   completed,
			"rejected":    rejected,
			"total":       total,
			"findings":    findings,
		})
	}
}

type dashboardMetric struct {
	Label string `json:"label"`
	Value int    `json:"value"`
}

func handleDashboard(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := resolveSession(r, cfg)
		if user.Role == "user" {
			jsonError(w, 401, "Authentication required")
			return
		}

		var metrics []dashboardMetric
		var notifications []map[string]interface{}

		switch user.Role {
		case "platform_admin":
			var pending, approved, inReview, completed, findings int
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='pending'").Scan(&pending)
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='approved'").Scan(&approved)
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='in_review'").Scan(&inReview)
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='completed'").Scan(&completed)
			db.QueryRow("SELECT COUNT(*) FROM code_review_findings").Scan(&findings)
			metrics = []dashboardMetric{
				{"Pending Requests", pending},
				{"Approved Requests", approved},
				{"In Review", inReview},
				{"Completed Reviews", completed},
				{"Total Findings", findings},
			}
		case "org_admin":
			var total, pending, active int
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE organization_email=$1", user.Email).Scan(&total)
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE organization_email=$1 AND status='pending'", user.Email).Scan(&pending)
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE organization_email=$1 AND status IN ('approved','in_review')", user.Email).Scan(&active)
			metrics = []dashboardMetric{
				{"Total Requests", total},
				{"Pending Review", pending},
				{"Active Reviews", active},
			}
		case "reviewer":
			var assigned, findingsCount int
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE assigned_to=$1", user.Email).Scan(&assigned)
			db.QueryRow(`SELECT COUNT(*) FROM code_review_findings WHERE researcher_email=$1`, user.Email).Scan(&findingsCount)
			metrics = []dashboardMetric{
				{"Assigned Requests", assigned},
				{"Submitted Findings", findingsCount},
			}
		case "compliance_team":
			var pending, approved, inReview, completed, findings int
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='pending'").Scan(&pending)
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='approved'").Scan(&approved)
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='in_review'").Scan(&inReview)
			db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='completed'").Scan(&completed)
			db.QueryRow("SELECT COUNT(*) FROM code_review_findings").Scan(&findings)
			metrics = []dashboardMetric{
				{"Pending Requests", pending},
				{"Approved Requests", approved},
				{"In Review", inReview},
				{"Completed Reviews", completed},
				{"Total Findings", findings},
			}
		}

		notifications = loadNotifications(db, user.Email, 10)

		jsonResponse(w, 200, map[string]interface{}{
			"service": map[string]string{"key": "code", "name": "Code Security Service"},
			"role":    map[string]string{"username": user.Username, "name": user.Role, "label": user.DisplayName},
			"summary": map[string]interface{}{
				"metrics": metrics,
			},
			"metrics":       metrics,
			"notifications": notifications,
		})
	}
}

func loadNotifications(db *sql.DB, email string, limit int) []map[string]interface{} {
	rows, err := db.Query(
		"SELECT id, title, message, kind, read, reference_id, created_at FROM code_notifications WHERE user_email=$1 ORDER BY created_at DESC LIMIT $2",
		email, limit,
	)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	var result []map[string]interface{}
	for rows.Next() {
		var id, refID int
		var title, message, kind string
		var read bool
		var createdAt time.Time
		var refIDNull sql.NullInt64
		if err := rows.Scan(&id, &title, &message, &kind, &read, &refIDNull, &createdAt); err != nil {
			continue
		}
		if refIDNull.Valid {
			refID = int(refIDNull.Int64)
		}
		result = append(result, map[string]interface{}{
			"id":          id,
			"title":       title,
			"message":     message,
			"kind":        kind,
			"read":        read,
			"referenceId": refID,
			"created_at":  createdAt.Format(time.RFC3339),
		})
	}
	if result == nil {
		result = []map[string]interface{}{}
	}
	return result
}

func handleNotifications(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := resolveSession(r, cfg)
		if user.Role == "user" {
			jsonError(w, 401, "Authentication required")
			return
		}
		jsonResponse(w, 200, loadNotifications(db, user.Email, 50))
	}
}

func handleNotificationRead(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch && r.Method != http.MethodPost {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role == "user" {
			jsonError(w, 401, "Authentication required")
			return
		}
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/notifications/"), "/")
		if len(parts) < 1 {
			jsonError(w, 400, "Missing notification ID")
			return
		}
		idStr := parts[0]
		id, err := strconv.Atoi(idStr)
		if err != nil {
			jsonError(w, 400, "Invalid notification ID")
			return
		}
		db.Exec("UPDATE code_notifications SET read=TRUE WHERE id=$1 AND user_email=$2", id, user.Email)
		jsonResponse(w, 200, map[string]string{"status": "ok"})
	}
}

type createRequestPayload struct {
	RepositoryName string `json:"repository_name"`
	RepositoryURL  string `json:"repository_url"`
	ReviewType     string `json:"review_type"`
	PrimaryLang    string `json:"primary_language"`
	Description    string `json:"description"`
	Priority       string `json:"priority"`
	StartDate      string `json:"start_date"`
	EndDate        string `json:"end_date"`
}

func handleCreateRequest(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role != "org_admin" {
			jsonError(w, 403, "Organization admin access required")
			return
		}
		var p createRequestPayload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			jsonError(w, 400, "Invalid JSON")
			return
		}
		if strings.TrimSpace(p.RepositoryName) == "" || strings.TrimSpace(p.ReviewType) == "" ||
			strings.TrimSpace(p.PrimaryLang) == "" || strings.TrimSpace(p.Description) == "" {
			jsonError(w, 400, "repository_name, review_type, primary_language, and description are required")
			return
		}
		if strings.TrimSpace(p.RepositoryURL) == "" {
			jsonError(w, 400, "Repository URL is required")
			return
		}
		if p.Priority == "" {
			p.Priority = "medium"
		}

		var id int
		err := db.QueryRow(
			`INSERT INTO code_review_requests (organization_email, submitted_by, repository_name, repository_url, review_type, primary_language, description, priority, status, start_date, end_date, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,NOW(),NOW()) RETURNING id`,
			user.Email, user.Email, p.RepositoryName, p.RepositoryURL, p.ReviewType, p.PrimaryLang, p.Description, p.Priority,
			nullableDate(p.StartDate), nullableDate(p.EndDate),
		).Scan(&id)
		if err != nil {
			log.Printf("insert request failed: %v", err)
			jsonError(w, 500, "Failed to create request")
			return
		}
		jsonResponse(w, 201, map[string]interface{}{"status": "ok", "id": id, "message": "Code review request submitted"})
	}
}

func nullableDate(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func handleListRequests(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		var query string
		var args []interface{}

		switch user.Role {
		case "platform_admin":
			query = "SELECT id, organization_email, submitted_by, repository_name, repository_url, review_type, primary_language, description, priority, status, assigned_to, COALESCE(start_date::text,''), COALESCE(end_date::text,''), created_at, updated_at FROM code_review_requests ORDER BY created_at DESC"
		case "org_admin":
			query = "SELECT id, organization_email, submitted_by, repository_name, repository_url, review_type, primary_language, description, priority, status, assigned_to, COALESCE(start_date::text,''), COALESCE(end_date::text,''), created_at, updated_at FROM code_review_requests WHERE organization_email=$1 ORDER BY created_at DESC"
			args = append(args, user.Email)
		case "reviewer":
			query = "SELECT id, organization_email, submitted_by, repository_name, repository_url, review_type, primary_language, description, priority, status, assigned_to, COALESCE(start_date::text,''), COALESCE(end_date::text,''), created_at, updated_at FROM code_review_requests WHERE assigned_to=$1 ORDER BY created_at DESC"
			args = append(args, user.Email)
		default:
			jsonError(w, 401, "Authentication required")
			return
		}

		rows, err := db.Query(query, args...)
		if err != nil {
			jsonError(w, 500, "Database error")
			return
		}
		defer rows.Close()

		var requests []map[string]interface{}
		for rows.Next() {
			var id int
			var orgEmail, submittedBy, repoName, repoURL, reviewType, lang, desc, priority, status, assignedTo string
			var startDate, endDate string
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&id, &orgEmail, &submittedBy, &repoName, &repoURL, &reviewType, &lang, &desc, &priority, &status, &assignedTo, &startDate, &endDate, &createdAt, &updatedAt); err != nil {
				continue
			}
			requests = append(requests, map[string]interface{}{
				"id": id, "organization_email": orgEmail, "submitted_by": submittedBy,
				"repository_name": repoName, "repository_url": repoURL, "review_type": reviewType,
				"primary_language": lang, "description": desc, "priority": priority,
				"status": status, "assigned_to": assignedTo,
				"start_date": startDate, "end_date": endDate,
				"created_at": createdAt.Format(time.RFC3339), "updated_at": updatedAt.Format(time.RFC3339),
			})
		}
		if requests == nil {
			requests = []map[string]interface{}{}
		}
		jsonResponse(w, 200, requests)
	}
}

type decisionPayload struct {
	Action  string `json:"action"`
	Comment string `json:"comment"`
}

func handleRequestDecision(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role != "platform_admin" {
			jsonError(w, 403, "Platform admin access required")
			return
		}
		idStr := strings.TrimPrefix(r.URL.Path, "/api/requests/")
		idStr = strings.TrimSuffix(idStr, "/decision")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			jsonError(w, 400, "Invalid request ID")
			return
		}
		var p decisionPayload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			jsonError(w, 400, "Invalid JSON")
			return
		}
		newStatus := ""
		switch p.Action {
		case "approve":
			newStatus = "approved"
		case "reject":
			newStatus = "rejected"
		default:
			jsonError(w, 400, "Action must be 'approve' or 'reject'")
			return
		}
		res, err := db.Exec("UPDATE code_review_requests SET status=$1, updated_at=NOW() WHERE id=$2", newStatus, id)
		if err != nil {
			jsonError(w, 500, "Database error")
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			jsonError(w, 404, "Request not found")
			return
		}
		// Notify the org admin
		var orgEmail string
		db.QueryRow("SELECT organization_email FROM code_review_requests WHERE id=$1", id).Scan(&orgEmail)
		if orgEmail != "" {
			db.Exec("INSERT INTO code_notifications (user_email, title, message, kind, reference_id) VALUES ($1,$2,$3,$4,$5)",
				orgEmail, fmt.Sprintf("Request %s", newStatus), fmt.Sprintf("Your code review request #%d has been %s.", id, newStatus), "decision", id)
		}
		jsonResponse(w, 200, map[string]string{"status": "ok", "message": fmt.Sprintf("Request %s", newStatus)})
	}
}

type assignPayload struct {
	ResearcherEmail string `json:"researcher_email"`
}

func handleRequestAssign(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role != "platform_admin" {
			jsonError(w, 403, "Platform admin access required")
			return
		}
		idStr := strings.TrimPrefix(r.URL.Path, "/api/requests/")
		idStr = strings.TrimSuffix(idStr, "/assign")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			jsonError(w, 400, "Invalid request ID")
			return
		}
		var p assignPayload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil || strings.TrimSpace(p.ResearcherEmail) == "" {
			jsonError(w, 400, "researcher_email is required")
			return
		}
		res, err := db.Exec("UPDATE code_review_requests SET assigned_to=$1, status='in_review', updated_at=NOW() WHERE id=$2 AND status IN ('approved','in_review')", p.ResearcherEmail, id)
		if err != nil {
			jsonError(w, 500, "Database error")
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			jsonError(w, 404, "Request not found or not in approved state")
			return
		}
		// Create notification for the assigned researcher
		var repoName string
		db.QueryRow("SELECT repository_name FROM code_review_requests WHERE id=$1", id).Scan(&repoName)
		db.Exec("INSERT INTO code_notifications (user_email, title, message, kind, reference_id) VALUES ($1,$2,$3,$4,$5)",
			p.ResearcherEmail,
			"New Code Review Assignment",
			fmt.Sprintf("You have been assigned to review repository '%s' (request #%d).", repoName, id),
			"assignment",
			id,
		)
		jsonResponse(w, 200, map[string]string{"status": "ok", "message": "Researcher assigned"})
	}
}

type findingPayload struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	FilePath    string `json:"file_path"`
	LineNumber  int    `json:"line_number"`
	Severity    string `json:"severity"`
	Category    string `json:"category"`
}

func handleSubmitFinding(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role != "reviewer" {
			jsonError(w, 403, "Internal researcher access required")
			return
		}
		path := strings.TrimPrefix(r.URL.Path, "/api/requests/")
		parts := strings.Split(path, "/")
		if len(parts) < 1 {
			jsonError(w, 400, "Invalid path")
			return
		}
		requestID, err := strconv.Atoi(parts[0])
		if err != nil {
			jsonError(w, 400, "Invalid request ID")
			return
		}
		// Verify the request is assigned to this researcher
		var assignedTo string
		err = db.QueryRow("SELECT assigned_to FROM code_review_requests WHERE id=$1", requestID).Scan(&assignedTo)
		if err != nil || assignedTo != user.Email {
			jsonError(w, 403, "This request is not assigned to you")
			return
		}
		var p findingPayload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			jsonError(w, 400, "Invalid JSON")
			return
		}
		if strings.TrimSpace(p.Title) == "" || strings.TrimSpace(p.Description) == "" {
			jsonError(w, 400, "title and description are required")
			return
		}
		if p.Severity == "" {
			p.Severity = "medium"
		}
		if p.Category == "" {
			p.Category = "Other"
		}
		var fid int
		err = db.QueryRow(
			`INSERT INTO code_review_findings (request_id, researcher_email, title, description, file_path, line_number, severity, category, status, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',NOW(),NOW()) RETURNING id`,
			requestID, user.Email, p.Title, p.Description, p.FilePath, p.LineNumber, p.Severity, p.Category,
		).Scan(&fid)
		if err != nil {
			log.Printf("insert finding failed: %v", err)
			jsonError(w, 500, "Failed to submit finding")
			return
		}
		jsonResponse(w, 201, map[string]interface{}{"status": "ok", "id": fid, "message": "Finding submitted"})
	}
}

func handleListFindings(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := resolveSession(r, cfg)
		path := strings.TrimPrefix(r.URL.Path, "/api/requests/")
		parts := strings.Split(path, "/")
		requestID := 0
		if len(parts) >= 1 {
			requestID, _ = strconv.Atoi(parts[0])
		}

		var query string
		var args []interface{}
		if requestID > 0 {
			switch user.Role {
			case "platform_admin", "compliance_team", "developer":
				query = "SELECT id, request_id, researcher_email, title, description, file_path, line_number, severity, category, status, created_at, developer_tag FROM code_review_findings WHERE request_id=$1 ORDER BY created_at DESC"
				args = []interface{}{requestID}
			case "org_admin":
				query = `SELECT f.id, f.request_id, f.researcher_email, f.title, f.description, f.file_path, f.line_number, f.severity, f.category, f.status, f.created_at, f.developer_tag
						 FROM code_review_findings f JOIN code_review_requests r ON f.request_id=r.id WHERE f.request_id=$1 AND r.organization_email=$2 ORDER BY f.created_at DESC`
				args = []interface{}{requestID, user.Email}
			case "reviewer":
				query = "SELECT id, request_id, researcher_email, title, description, file_path, line_number, severity, category, status, created_at, developer_tag FROM code_review_findings WHERE request_id=$1 AND researcher_email=$2 ORDER BY created_at DESC"
				args = []interface{}{requestID, user.Email}
			default:
				jsonError(w, 401, "Authentication required")
				return
			}
		} else {
			if user.Role != "platform_admin" && user.Role != "developer" && user.Role != "compliance_team" {
				jsonError(w, 403, "Only platform admin can list all findings")
				return
			}
			query = "SELECT id, request_id, researcher_email, title, description, file_path, line_number, severity, category, status, created_at, developer_tag FROM code_review_findings ORDER BY created_at DESC"
		}

		rows, err := db.Query(query, args...)
		if err != nil {
			jsonError(w, 500, "Database error")
			return
		}
		defer rows.Close()

		var findings []map[string]interface{}
		for rows.Next() {
			var fid, reqID, lineNum int
			var email, title, desc, filePath, severity, category, status string
			var createdAt time.Time
			var developerTag *string
			if err := rows.Scan(&fid, &reqID, &email, &title, &desc, &filePath, &lineNum, &severity, &category, &status, &createdAt, &developerTag); err != nil {
				continue
			}
			findings = append(findings, map[string]interface{}{
				"id": fid, "request_id": reqID, "researcher_email": email,
				"title": title, "description": desc, "file_path": filePath,
				"line_number": lineNum, "severity": severity, "category": category,
				"status": status, "created_at": createdAt.Format(time.RFC3339),
				"developer_tag": developerTag,
			})
		}
		if findings == nil {
			findings = []map[string]interface{}{}
		}
		jsonResponse(w, 200, findings)
	}
}

// handleRequestComplete allows a platform admin to mark an in_review request as completed.
func handleRequestComplete(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role != "platform_admin" {
			jsonError(w, 403, "Platform admin access required")
			return
		}
		idStr := strings.TrimPrefix(r.URL.Path, "/api/requests/")
		idStr = strings.TrimSuffix(idStr, "/complete")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			jsonError(w, 400, "Invalid request ID")
			return
		}
		// Only allow transition from in_review to completed
		res, err := db.Exec("UPDATE code_review_requests SET status='completed', updated_at=NOW() WHERE id=$1 AND status='in_review'", id)
		if err != nil {
			jsonError(w, 500, "Database error")
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			jsonError(w, 404, "Request not found or not in 'in_review' status")
			return
		}
		// Notify the org admin and the assigned researcher
		var orgEmail, assignedTo, repoName string
		db.QueryRow("SELECT organization_email, assigned_to, repository_name FROM code_review_requests WHERE id=$1", id).Scan(&orgEmail, &assignedTo, &repoName)
		if orgEmail != "" {
			db.Exec("INSERT INTO code_notifications (user_email, title, message, kind, reference_id) VALUES ($1,$2,$3,$4,$5)",
				orgEmail, "Review Completed", fmt.Sprintf("The code review for '%s' (request #%d) has been completed.", repoName, id), "decision", id)
		}
		if assignedTo != "" && assignedTo != orgEmail {
			db.Exec("INSERT INTO code_notifications (user_email, title, message, kind, reference_id) VALUES ($1,$2,$3,$4,$5)",
				assignedTo, "Review Completed", fmt.Sprintf("The code review for '%s' (request #%d) has been marked as completed.", repoName, id), "decision", id)
		}
		jsonResponse(w, 200, map[string]string{"status": "ok", "message": "Request marked as completed"})
	}
}

// handleListReviewers returns all internal platform researchers from the auth-service.
// It falls back to previously-assigned emails stored in the local DB if the auth-service
// is unreachable, ensuring the dropdown is never empty just because no one has been
// assigned yet.
func handleListReviewers(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role != "platform_admin" {
			jsonError(w, 403, "Platform admin access required")
			return
		}

		type authResearcher struct {
			ID             string `json:"id"`
			Email          string `json:"email"`
			DisplayName    string `json:"displayName"`
			ResearcherType string `json:"researcherType"`
			ApprovalStatus string `json:"approvalStatus"`
		}
		type authResponse struct {
			Researchers []authResearcher `json:"researchers"`
		}

		// --- primary source: auth-service ---
		var reviewers []map[string]string
		authURL := strings.TrimRight(cfg.AuthServiceBaseURL, "/") + "/platform/researchers"
		req, err := http.NewRequest(http.MethodGet, authURL, nil)
		if err == nil {
			req.Header.Set("x-internal-service-token", cfg.AuthServiceToken)
			resp, err := (&http.Client{Timeout: 5 * 1e9}).Do(req) // 5s
			if err == nil && resp.StatusCode == 200 {
				defer resp.Body.Close()
				var ar authResponse
				if json.NewDecoder(resp.Body).Decode(&ar) == nil {
					for _, ru := range ar.Researchers {
						name := ru.DisplayName
						if name == "" {
							name = ru.Email
						}
						reviewers = append(reviewers, map[string]string{
							"email":       ru.Email,
							"displayName": name,
						})
					}
				}
			}
		}
		if err != nil {
			log.Printf("handleListReviewers: auth-service call failed (%v), falling back to DB", err)
		}

		// --- fallback: previously-assigned emails already in the DB ---
		seen := make(map[string]bool)
		for _, rv := range reviewers {
			seen[rv["email"]] = true
		}
		rows, dbErr := db.Query("SELECT DISTINCT assigned_to FROM code_review_requests WHERE assigned_to != '' ORDER BY assigned_to")
		if dbErr == nil {
			defer rows.Close()
			for rows.Next() {
				var email string
				if rows.Scan(&email) == nil && email != "" && !seen[email] {
					reviewers = append(reviewers, map[string]string{"email": email, "displayName": email})
					seen[email] = true
				}
			}
		}

		if reviewers == nil {
			reviewers = []map[string]string{}
		}
		jsonResponse(w, 200, reviewers)
	}
}

// handleComplianceSummary — GET /api/compliance/summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// Read-only endpoint for compliance_team and platform_admin roles.
func handleComplianceSummary(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role != "compliance_team" && user.Role != "platform_admin" {
			jsonError(w, 403, "Compliance access required")
			return
		}

		startDate := r.URL.Query().Get("start_date")
		endDate := r.URL.Query().Get("end_date")

		dateFilter := func(col string) string {
			clause := ""
			if startDate != "" {
				clause += " AND " + col + " >= '" + startDate + "'"
			}
			if endDate != "" {
				clause += " AND " + col + " <= '" + endDate + " 23:59:59'"
			}
			return clause
		}

		var total, pending, completed, findings int
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE 1=1" + dateFilter("created_at")).Scan(&total)
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='pending'" + dateFilter("created_at")).Scan(&pending)
		db.QueryRow("SELECT COUNT(*) FROM code_review_requests WHERE status='completed'" + dateFilter("created_at")).Scan(&completed)
		db.QueryRow("SELECT COUNT(*) FROM code_review_findings WHERE 1=1" + dateFilter("created_at")).Scan(&findings)

		jsonResponse(w, 200, map[string]any{
			"approvedPrograms": completed,
			"pendingPrograms":  pending,
			"totalSubmissions": total,
			"totalParticipants": findings,
		})
	}
}


// handleFindingDeveloperTag — PATCH /api/findings/{id}/developer-tag
// Lets developers tag a code finding as accepted/declined/retest_required.
func handleFindingDeveloperTag(db *sql.DB, cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			jsonError(w, 405, "Method not allowed")
			return
		}
		user := resolveSession(r, cfg)
		if user.Role != "developer" && user.Role != "platform_admin" {
			jsonError(w, 403, "Developer access required")
			return
		}
		// Path: /api/findings/{id}/developer-tag
		path := strings.TrimPrefix(r.URL.Path, "/api/findings/")
		parts := strings.Split(path, "/")
		findingID, err := strconv.Atoi(parts[0])
		if err != nil || findingID == 0 {
			jsonError(w, 400, "Invalid finding ID")
			return
		}
		var payload struct {
			DeveloperTag string `json:"developer_tag"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			jsonError(w, 400, "Invalid JSON")
			return
		}
		valid := map[string]bool{"accepted": true, "declined": true, "retest_required": true}
		if !valid[payload.DeveloperTag] {
			jsonError(w, 400, "Invalid tag; must be accepted, declined, or retest_required")
			return
		}
		_, err = db.Exec("UPDATE code_review_findings SET developer_tag=$1 WHERE id=$2", payload.DeveloperTag, findingID)
		if err != nil {
			jsonError(w, 500, "Database error")
			return
		}
		// Notify the researcher about the developer tag
		var researcherEmail, findingTitle string
		db.QueryRow("SELECT researcher_email, title FROM code_review_findings WHERE id=$1", findingID).Scan(&researcherEmail, &findingTitle)
		if researcherEmail != "" {
			tagLabels := map[string]string{"accepted": "accepted", "declined": "declined", "retest_required": "marked for retest"}
			tagKinds := map[string]string{"accepted": "success", "declined": "warning", "retest_required": "info"}
			tagLabel := tagLabels[payload.DeveloperTag]
			tagKind := tagKinds[payload.DeveloperTag]
			db.Exec(
				"INSERT INTO code_notifications (user_email, title, message, kind) VALUES ($1,$2,$3,$4)",
				researcherEmail,
				fmt.Sprintf("Code finding '%s' has been %s", findingTitle, tagLabel),
				fmt.Sprintf("Your finding '%s' was %s by the engineering team.", findingTitle, tagLabel),
				tagKind,
			)
		}
		jsonResponse(w, 200, map[string]any{"id": findingID, "developer_tag": payload.DeveloperTag})
	}
}
