#!/bin/sh
set -eu

export PGPASSWORD="${POSTGRES_PASSWORD:-antcrowd123}"

DB_HOST="${POSTGRES_HOST:-postgres}"
DB_NAME="${POSTGRES_DB:-antcrowd}"
DB_USER="${POSTGRES_USER:-antcrowd}"

until psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null 2>&1; do
  echo "Waiting for postgres to accept connections..."
  sleep 2
done

psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'CREATE DATABASE vdp OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vdp')\gexec

SELECT 'CREATE DATABASE training_service OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'training_service')\gexec

SELECT 'CREATE DATABASE challenge_db OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'challenge_db')\gexec

SELECT 'CREATE DATABASE ai_redteam_db OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ai_redteam_db')\gexec

SELECT 'CREATE DATABASE bug_bounty_db OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bug_bounty_db')\gexec

SELECT 'CREATE DATABASE trust_db OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'trust_db')\gexec

SELECT 'CREATE DATABASE grc_db OWNER antcrowd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'grc_db')\gexec
SQL
