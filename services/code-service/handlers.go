package main

import (
  "database/sql"
  "encoding/json"
  "errors"
  "fmt"
  "log"
  "net/http"
  "net/smtp"
  "strings"
  "time"
)

type ContactRequest struct {
  FirstName string `json:"firstName"`
  LastName  string `json:"lastName"`
  Email     string `json:"email"`
  Company   string `json:"company"`
  JobTitle  string `json:"jobTitle"`
  Reason    string `json:"reason"`
  Phone     string `json:"phone"`
  Country   string `json:"country"`
  CreatedAt string `json:"createdAt"`
}

type ContactResponse struct {
  Status  string `json:"status"`
  Message string `json:"message"`
}

func validateContact(payload *ContactRequest) error {
  if strings.TrimSpace(payload.FirstName) == "" {
    return errors.New("firstName is required")
  }
  if strings.TrimSpace(payload.LastName) == "" {
    return errors.New("lastName is required")
  }
  if strings.TrimSpace(payload.Email) == "" {
    return errors.New("email is required")
  }
  if strings.TrimSpace(payload.Company) == "" {
    return errors.New("company is required")
  }
  if strings.TrimSpace(payload.JobTitle) == "" {
    return errors.New("jobTitle is required")
  }
  if strings.TrimSpace(payload.Reason) == "" {
    return errors.New("reason is required")
  }
  if strings.TrimSpace(payload.Country) == "" {
    return errors.New("country is required")
  }
  return nil
}

func handleContact(db *sql.DB, cfg Config) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
      http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
      return
    }

    var payload ContactRequest
    if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
      http.Error(w, "invalid json", http.StatusBadRequest)
      return
    }

    if err := validateContact(&payload); err != nil {
      http.Error(w, err.Error(), http.StatusBadRequest)
      return
    }

    payload.CreatedAt = time.Now().UTC().Format(time.RFC3339)

    _, err := db.Exec(
      `INSERT INTO contact_requests
        (first_name, last_name, email, company, job_title, reason, phone, country, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      payload.FirstName,
      payload.LastName,
      payload.Email,
      payload.Company,
      payload.JobTitle,
      payload.Reason,
      payload.Phone,
      payload.Country,
      payload.CreatedAt,
    )
    if err != nil {
      log.Printf("insert failed: %v", err)
      http.Error(w, "unable to store submission", http.StatusInternalServerError)
      return
    }

    if cfg.SMTPHost != "" && cfg.SMTPFrom != "" && cfg.SMTPTo != "" {
      if err := sendEmail(cfg, payload); err != nil {
        log.Printf("email send failed: %v", err)
      }
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(ContactResponse{
      Status:  "ok",
      Message: "Submission received",
    })
  }
}

func sendEmail(cfg Config, payload ContactRequest) error {
  address := fmt.Sprintf("%s:%s", cfg.SMTPHost, cfg.SMTPPort)
  auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)

  body := fmt.Sprintf(
    "New contact submission\n\nName: %s %s\nEmail: %s\nCompany: %s\nJob Title: %s\nReason: %s\nPhone: %s\nCountry: %s\nCreated: %s\n",
    payload.FirstName,
    payload.LastName,
    payload.Email,
    payload.Company,
    payload.JobTitle,
    payload.Reason,
    payload.Phone,
    payload.Country,
    payload.CreatedAt,
  )

  msg := strings.Join([]string{
    fmt.Sprintf("To: %s", cfg.SMTPTo),
    fmt.Sprintf("From: %s", cfg.SMTPFrom),
    "Subject: New contact request",
    "",
    body,
  }, "\r\n")

  return smtp.SendMail(address, auth, cfg.SMTPFrom, []string{cfg.SMTPTo}, []byte(msg))
}

func handleHealth(db *sql.DB) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    status := "ok"
    if err := db.Ping(); err != nil {
      status = "degraded"
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": status})
  }
}

func handleReady(db *sql.DB) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    if err := db.Ping(); err != nil {
      w.Header().Set("Content-Type", "application/json")
      w.WriteHeader(http.StatusServiceUnavailable)
      json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": err.Error()})
      return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
  }
}
