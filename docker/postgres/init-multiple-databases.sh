#!/bin/sh
set -eu

databases="
auth_db
vdp
vdp_db
pen_db
bug_bounty_db
ai_redteam_db
challenge_db
training_service
training_db
code_db
security_trust_db
trust_center_db
grc_db
"

for db in $databases; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
SELECT 'CREATE DATABASE ${db}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\gexec
EOSQL
done
