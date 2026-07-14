-- Migration: undo_remove_default_account_id_from_photos
-- Created: 2026-07-14T10:08:10.008Z

-- Add your migration SQL here

BEGIN;

ALTER TABLE IF EXISTS photos
    ALTER COLUMN account_id SET DEFAULT 1;

COMMIT;
