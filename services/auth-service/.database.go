package main

import (
	"context"
	"os"

	"github.com/jack/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

func ConnectDB() error {
	dsn := "postgres://" +
		os.Getenv("DB_USER") + ":" +
		os.Getenv("DB_PASSWORD") + "@" +
		os.Getenv("DB_HOST") + ":" +
		os.Getenv("DB_PORT") + "/" +
		os.Getenv("DB_NAME")

	var err error
	DB, err = pgxpool.New(context.Background(), dsn)
	if err != nil {
		return err
	}

	return DB.Ping(context.Background())
}
