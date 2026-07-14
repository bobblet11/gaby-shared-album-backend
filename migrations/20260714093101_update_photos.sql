-- Migration: setup2
-- Created: 2026-07-14T09:44:53.126Z

-- Add your migration SQL here

BEGIN;

ALTER TABLE IF EXISTS photos
    ALTER COLUMN id TYPE VARCHAR(64),
    ALTER COLUMN title TYPE VARCHAR(100),
    ALTER COLUMN caption TYPE VARCHAR(500),
    ALTER COLUMN image_endpoint TYPE VARCHAR(255),
    ALTER COLUMN placeholder_endpoint TYPE VARCHAR(255);
    
COMMIT;
