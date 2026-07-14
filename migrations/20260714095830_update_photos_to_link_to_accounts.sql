-- Migration: update_photos_to_link_to_accounts
-- Created: 2026-07-14T09:58:30.344Z

-- Add your migration SQL here


BEGIN;

INSERT INTO accounts (id, username, email, password_hash)
VALUES (1, 'gabybrown8', 'gabybrown8@gmail.com', '-')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE IF EXISTS photos
    ADD COLUMN account_id INT NOT NULL DEFAULT 1,
    ADD CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts ;
    
COMMIT;
