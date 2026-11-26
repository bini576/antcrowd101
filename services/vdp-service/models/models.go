package models

import "time"

type DisclosureProcedure struct {
	ID                    string    `db:"id" json:"id"`
	OrgID                 string    `db:"org_id" json:"org_id"`
	Overview              string    `db:"overview" json:"overview"`
	Scope                 string    `db:"scope" json:"scope"`
	OutOfScope            string    `db:"out_of_scope" json:"out_of_scope"`
	ReportingRequirements string    `db:"reporting_requirements" json:"reporting_requirements"`
	SeverityRules         string    `db:"severity_rules" json:"severity_rules"`
	ResponseTimeline      string    `db:"response_timeline" json:"response_timeline"`
	LegalSafeHarbor       string    `db:"legal_safe_harbor" json:"legal_safe_harbor"`
	ProhibitedActions     string    `db:"prohibited_actions" json:"prohibited_actions"`
	Status                string    `db:"status" json:"status"`
	CreatedAt             time.Time `db:"created_at" json:"created_at"`
}

type VDPProgram struct {
	ID          string    `db:"id" json:"id"`
	OrgID       string    `db:"org_id" json:"org_id"`
	ProcedureID string    `db:"procedure_id" json:"procedure_id"`
	Visibility  string    `db:"visibility" json:"visibility"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type VDPReport struct {
	ID                string     `db:"id" json:"id"`
	ProgramID         string     `db:"program_id" json:"program_id"`
	HackerID          *string    `db:"hacker_id" json:"hacker_id"`
	ReporterEmail     string     `db:"reporter_email" json:"reporter_email"`
	ReporterName      string     `db:"reporter_name" json:"reporter_name"`
	Title             string     `db:"title" json:"title"`
	AffectedAsset     string     `db:"affected_asset" json:"affected_asset"`
	VulnerabilityType string     `db:"vulnerability_type" json:"vulnerability_type"`
	Description       string     `db:"description" json:"description"`
	StepsToReproduce  string     `db:"steps_to_reproduce" json:"steps_to_reproduce"`
	Impact            string     `db:"impact" json:"impact"`
	Severity          string     `db:"severity" json:"severity"`
	POC               string     `db:"poc" json:"poc"`
	AttackVector      string     `db:"attack_vector" json:"attack_vector"`
	CWE               string     `db:"cwe" json:"cwe"`
	ReferenceLinks    string     `db:"reference_links" json:"reference_links"`
	Status            string     `db:"status" json:"status"`
	StatusReason      string     `db:"status_reason" json:"status_reason"`
	PublicNotes       string     `db:"public_notes" json:"public_notes"`
	InternalNotes     string     `db:"internal_notes" json:"internal_notes"`
	AcknowledgedAt    *time.Time `db:"acknowledged_at" json:"acknowledged_at"`
	ResolvedAt        *time.Time `db:"resolved_at" json:"resolved_at"`
	ClosedAt          *time.Time `db:"closed_at" json:"closed_at"`
	UpdatedAt         time.Time  `db:"updated_at" json:"updated_at"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
}

type PolicyAcceptance struct {
	UserID      string    `db:"user_id" json:"user_id"`
	ProcedureID string    `db:"procedure_id" json:"procedure_id"`
	AcceptedAt  time.Time `db:"accepted_at" json:"accepted_at"`
}

type PolicyAcceptancePublic struct {
	ID           string    `db:"id" json:"id"`
	ReporterEmail string   `db:"reporter_email" json:"reporter_email"`
	ProcedureID  string    `db:"procedure_id" json:"procedure_id"`
	AcceptedAt   time.Time `db:"accepted_at" json:"accepted_at"`
	AcceptedIP   string    `db:"accepted_ip" json:"accepted_ip"`
}
