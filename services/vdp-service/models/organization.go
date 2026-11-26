package models

import "time"

type Organization struct {
	ID           string     `db:"id" json:"id"`
	Name         string     `db:"name" json:"name"`
	Slug         string     `db:"slug" json:"slug"`
	ContactEmail string     `db:"contact_email" json:"contact_email"`
	ContactName  string     `db:"contact_name" json:"contact_name"`
	Website      string     `db:"website" json:"website"`
	Description  string     `db:"description" json:"description"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}
