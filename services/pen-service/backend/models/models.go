package models

import (
	"database/sql"

	"github.com/golang-jwt/jwt/v5"
)

type App struct {
	DB        *sql.DB
	JWTSecret []byte
}

type AuthClaims struct {
	UserID       int64  `json:"userId"`
	Role         string `json:"role"`
	OrgID        int64  `json:"orgId"`
	ResearcherID int64  `json:"researcherId"`
	jwt.RegisteredClaims
}

type AuthUser struct {
	ID           int64  `json:"id"`
	Email        string `json:"email"`
	FullName     string `json:"fullName"`
	Role         string `json:"role"`
	OrgID        int64  `json:"orgId"`
	ResearcherID int64  `json:"researcherId"`
}

type Dashboard struct {
	OpenEngagements           int64 `json:"openEngagements"`
	HighCriticalFindings      int64 `json:"highCriticalFindings"`
	ReadyForRetest            int64 `json:"readyForRetest"`
	InternalResearchersActive int64 `json:"internalResearchersActive"`
	ExternalResearchersActive int64 `json:"externalResearchersActive"`
}

type Metrics struct {
	FindingsTotal int64            `json:"findingsTotal"`
	SLABreached   int64            `json:"slaBreached"`
	OpenPrograms  int64            `json:"openPrograms"`
	ClosedProgram int64            `json:"closedPrograms"`
	MTTAHours     float64          `json:"mttaHours"`
	MTTRHours     float64          `json:"mttrHours"`
	SeverityMix   map[string]int64 `json:"severityMix"`
}

type Engagement struct {
	ID             int64  `json:"id"`
	OrganizationID int64  `json:"organizationId"`
	Title          string `json:"title"`
	Target         string `json:"target"`
	Type           string `json:"type"`
	Mode           string `json:"mode"`
	TesterPool     string `json:"testerPool"`
	Deadline       string `json:"deadline"`
	Budget         int64  `json:"budget"`
	Scope          string `json:"scope"`
	OutOfScope     string `json:"outOfScope"`
	Status         string `json:"status"`
	TriageSLAHours int64  `json:"triageSlaHours"`
	Applicants     int64  `json:"applicants"`
	Approved       int64  `json:"approved"`
	Visibility     string `json:"visibility"` // "private" or "public"
}

type Researcher struct {
	ID                int64   `json:"id"`
	OrganizationID    int64   `json:"organizationId"`
	FullName          string  `json:"fullName"`
	Handle            string  `json:"handle"`
	Email             string  `json:"email"`
	IsInternal        bool    `json:"isInternal"`
	Skills            string  `json:"skills"`
	Status            string  `json:"status"`
	AvgRating         float64 `json:"avgRating"`
	RatingCount       int64   `json:"ratingCount"`
	MyRating          int64   `json:"myRating"`
	CompletedPrograms int64   `json:"completedPrograms"`
}

type Application struct {
	ID             int64  `json:"id"`
	EngagementID   int64  `json:"engagementId"`
	EngagementName string `json:"engagementName"`
	ResearcherID   int64  `json:"researcherId"`
	ResearcherName string `json:"researcherName"`
	ResearcherType string `json:"researcherType"`
	Status         string `json:"status"`
	AssignedBy     string `json:"assignedBy"`
	CreatedAt      string `json:"createdAt"`
}

type InternalRequest struct {
	ID                 int64  `json:"id"`
	EngagementID       int64  `json:"engagementId"`
	EngagementName     string `json:"engagementName"`
	Status             string `json:"status"`
	AssignedResearcher string `json:"assignedResearcher"`
	RequestedAt        string `json:"requestedAt"`
}

type Finding struct {
	ID             int64   `json:"id"`
	JobID          int64   `json:"jobId"`
	JobTitle       string  `json:"jobTitle"`
	Title          string  `json:"title"`
	Severity       string  `json:"severity"`
	Status         string  `json:"status"`
	PoC            string  `json:"poc"`
	Remediation    string  `json:"remediation"`
	SubmittedBy    string  `json:"submittedBy"`
	CVSS           float64 `json:"cvss"`
	EvidenceURL    string  `json:"evidenceUrl"`
	AssetPath      string  `json:"assetPath"`
	CWE            string  `json:"cwe"`
	DuplicateOf    int64   `json:"duplicateOf"`
	SlaDueAt       string  `json:"slaDueAt"`
	SlaBreached    bool    `json:"slaBreached"`
	DuplicateHints int64   `json:"duplicateHints"`
	Bounty         int64   `json:"bounty"`
	ReviewComment  string  `json:"reviewComment"`
	PaymentReference string `json:"paymentReference"`
	CreatedAt      string  `json:"createdAt"`
}

type Notification struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Read      bool   `json:"read"`
	CreatedAt string `json:"createdAt"`
}

type Invitation struct {
	ID           int64  `json:"id"`
	EngagementID int64  `json:"engagementId"`
	ResearcherID int64  `json:"researcherId"`
	Status       string `json:"status"` // "pending", "accepted", "declined"
	InvitedAt    string `json:"invitedAt"`
}

type LeaderboardEntry struct {
	ResearcherID   int64  `json:"researcherId"`
	ResearcherName string `json:"researcherName"`
	Points         int64  `json:"points"` // Based on bounties or findings
}
