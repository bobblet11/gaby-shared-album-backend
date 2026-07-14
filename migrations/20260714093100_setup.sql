-- Migration: setup
-- Created: 2026-07-14T09:31:01.860Z

-- Add your migration SQL here

BEGIN;

CREATE TABLE IF NOT EXISTS photos  (
    id TEXT NOT NULL,
    title TEXT,
    caption TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    image_endpoint TEXT NOT NULL,
    placeholder_endpoint TEXT NOT NULL,
    PRIMARY KEY (id)
);

COMMIT;
