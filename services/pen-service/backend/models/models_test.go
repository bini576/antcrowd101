package models

import "testing"

func TestApp(t *testing.T) {
	// Basic test
	app := &App{}
	if app.DB != nil {
		t.Error("Expected DB to be nil")
	}
}
