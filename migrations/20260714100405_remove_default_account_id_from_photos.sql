-- Migration: remove_default_account_id_from_photos
-- Created: 2026-07-14T10:04:05.512Z

-- Add your migration SQL here


BEGIN;

ALTER TABLE IF EXISTS photos
	ALTER COLUMN account_id DROP DEFAULT;
    
COMMIT;
