-- Migration: create_accounts_table
-- Created: 2026-07-14T09:31:19.274Z

-- Add your migration SQL here


BEGIN;

CREATE TABLE accounts IF NOT EXISTS (
    id SERIAL PRIMARY KEY,              -- auto-incrementing integer
    username VARCHAR(50) NOT NULL,      -- string up to 50 chars
    email VARCHAR(255) UNIQUE NOT NULL, -- unique constraint
    password_hash TEXT NOT NULL,        -- long text for hashed password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- auto timestamp
);

COMMIT;
