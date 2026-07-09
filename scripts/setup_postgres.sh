#!/usr/bin/env bash
set -euo pipefail

# Edit these values or set them in environment before running
DB_USER="${DB_USER:-myapp_user}"
DB_PASS="${DB_PASS:-strong_password}"
DB_NAME="${DB_NAME:-myapp_db}"

# Create user and database
psql -v ON_ERROR_STOP=1 --username postgres <<-PSQL
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\connect ${DB_NAME}
-- Create photo table
CREATE TABLE IF NOT EXISTS photo (
  id TEXT PRIMARY KEY,
  title TEXT,
  caption TEXT,
  upload_date DATE,
  image_endpoint TEXT,
  placeholder_endpoint TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
PSQL

echo "Postgres user ${DB_USER} and database ${DB_NAME} created (or already exist)."
