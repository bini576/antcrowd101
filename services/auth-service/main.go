package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	
)

var DB *pgxpool.Pool

func main() {
	var err error
	DB, err = ConnectDB()
	if err != nil {
		log.Fatal("DB connection failed:", err)
	}
	defer DB.Close()

	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("OK"))
	})

	http.HandleFunc("/register", Register)
	http.HandleFunc("/login", Login)

	log.Println("Auth service running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func ConnectDB() (*pgxpool.Pool, error) {
	dsn := "postgres://postgres:yourpassword@localhost:5432/yourdb?sslmode=disable"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}
