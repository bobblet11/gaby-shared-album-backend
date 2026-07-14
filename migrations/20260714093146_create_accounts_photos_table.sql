-- Migration: create_accounts_photos_table
-- Created: 2026-07-14T09:31:46.309Z

-- Add your migration SQL here

BEGIN;

CREATE TABLE IF NOT EXISTS accounts_to_photos  (
    id SERIAL PRIMARY KEY,              -- auto-incrementing integer
    account_id INT NOT NULL,
    photo_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- auto timestamp
    CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts (id)
    CONSTRAINT fk_photo FOREIGN KEY (photo_id) REFERENCES photos (id)
);

COMMIT;
