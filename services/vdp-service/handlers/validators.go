package handlers

import (
	"errors"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

const (
	maxTitleLen       = 200
	maxDescriptionLen = 10000
	maxPOCLen         = 10000
	maxEmailLen       = 254
	maxAssetLen       = 500
	maxVulnTypeLen    = 200
	maxStepsLen       = 10000
	maxImpactLen      = 8000
	maxReporterName   = 120
	maxAttackVector   = 200
	maxCWELen         = 50
	maxRefLinksLen    = 2000
)

var (
	emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	slugRe  = regexp.MustCompile(`^[a-z0-9-]+$`)
)

func validateUUID(id string) bool {
	_, err := uuid.Parse(strings.TrimSpace(id))
	return err == nil
}

func validateReportSizes(title, description, poc string) error {
	if len(title) > maxTitleLen {
		return errors.New("title too long")
	}
	if len(description) > maxDescriptionLen {
		return errors.New("description too long")
	}
	if len(poc) > maxPOCLen {
		return errors.New("poc too long")
	}
	return nil
}

func validateEmail(email string) bool {
	email = strings.TrimSpace(email)
	if email == "" || len(email) > maxEmailLen {
		return false
	}
	return emailRe.MatchString(email)
}

func normalizeSlug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "-")
	return s
}

func validateSlug(s string) bool {
	s = normalizeSlug(s)
	if s == "" {
		return false
	}
	return slugRe.MatchString(s)
}

func validateReportDetails(affectedAsset, vulnType, steps, impact, reporterName, attackVector, cwe, refs string) error {
	if len(affectedAsset) > maxAssetLen {
		return errors.New("affected asset too long")
	}
	if len(vulnType) > maxVulnTypeLen {
		return errors.New("vulnerability type too long")
	}
	if len(steps) > maxStepsLen {
		return errors.New("steps too long")
	}
	if len(impact) > maxImpactLen {
		return errors.New("impact too long")
	}
	if len(reporterName) > maxReporterName {
		return errors.New("reporter name too long")
	}
	if len(attackVector) > maxAttackVector {
		return errors.New("attack vector too long")
	}
	if len(cwe) > maxCWELen {
		return errors.New("cwe too long")
	}
	if len(refs) > maxRefLinksLen {
		return errors.New("reference links too long")
	}
	return nil
}
