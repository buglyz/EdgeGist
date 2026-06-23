-- Migration: Add R2 cleanup queue
-- Purpose: Track failed R2 deletions for retry
-- Date: 2026-06-23

CREATE TABLE IF NOT EXISTS r2_cleanup_queue (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  gist_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TEXT,
  INDEX idx_r2_cleanup_created (created_at),
  INDEX idx_r2_cleanup_gist (gist_id)
);

-- Add comment for documentation
-- This table stores R2 keys that need to be deleted but the operation failed.
-- A cron worker should periodically retry deletions and remove successful entries.
