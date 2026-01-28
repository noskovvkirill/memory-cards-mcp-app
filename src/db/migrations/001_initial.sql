-- Memory Cards Database Schema
-- Migration 001: Initial setup

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  card_count INTEGER NOT NULL DEFAULT 0
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  quote TEXT NOT NULL,
  context TEXT,
  type TEXT NOT NULL CHECK (type IN ('insight', 'decision', 'funny', 'idea', 'milestone')),
  style TEXT NOT NULL DEFAULT 'postcard',
  conversation_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);
