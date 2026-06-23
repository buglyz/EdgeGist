-- Migration: Add R2 storage support
-- This migration adds columns to support hybrid storage (D1 inline + R2 object storage)

-- Add R2 storage columns to gist_files table
ALTER TABLE gist_files ADD COLUMN storage_type TEXT DEFAULT 'inline' CHECK (storage_type IN ('inline', 'r2'));
ALTER TABLE gist_files ADD COLUMN r2_key TEXT;
ALTER TABLE gist_files ADD COLUMN r2_etag TEXT;

-- Add R2 storage columns to gist_version_files table
ALTER TABLE gist_version_files ADD COLUMN storage_type TEXT DEFAULT 'inline' CHECK (storage_type IN ('inline', 'r2'));
ALTER TABLE gist_version_files ADD COLUMN r2_key TEXT;
ALTER TABLE gist_version_files ADD COLUMN r2_etag TEXT;

-- Create indexes for R2 cleanup operations
CREATE INDEX IF NOT EXISTS idx_gist_files_r2_key ON gist_files(r2_key) WHERE r2_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gist_version_files_r2_key ON gist_version_files(r2_key) WHERE r2_key IS NOT NULL;
