-- Migration: Add tags and metadata for academic writing
-- Purpose: Support categorization, tagging, and statistics for papers and code
-- Date: 2026-06-23

-- Tags table for categorization
CREATE TABLE IF NOT EXISTS gist_tags (
  id TEXT PRIMARY KEY,
  gist_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (gist_id) REFERENCES gists(id) ON DELETE CASCADE,
  UNIQUE(gist_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_gist_tags_gist_id ON gist_tags(gist_id);
CREATE INDEX IF NOT EXISTS idx_gist_tags_tag ON gist_tags(tag);

-- Metadata table for statistics and custom fields
CREATE TABLE IF NOT EXISTS gist_metadata (
  gist_id TEXT PRIMARY KEY,
  word_count INTEGER DEFAULT 0,
  line_count INTEGER DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  total_size INTEGER DEFAULT 0,
  primary_language TEXT,
  status TEXT DEFAULT 'draft', -- draft, review, completed
  category TEXT, -- paper, code, note, experiment
  last_stats_update TEXT,
  FOREIGN KEY (gist_id) REFERENCES gists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gist_metadata_category ON gist_metadata(category);
CREATE INDEX IF NOT EXISTS idx_gist_metadata_status ON gist_metadata(status);

-- Popular tags view for quick access
CREATE VIEW IF NOT EXISTS popular_tags AS
SELECT tag, COUNT(*) as usage_count
FROM gist_tags
GROUP BY tag
ORDER BY usage_count DESC;
