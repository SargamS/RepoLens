-- NOTE: Your prompt referenced "the full SQL from Section 2 above" but that
-- SQL wasn't actually included in the message I received. The queries in
-- db/queries.js assume the schema below. If your real Supabase schema
-- differs (column names, types, etc.), update db/queries.js to match it
-- rather than the other way around.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  github_id BIGINT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  access_token TEXT NOT NULL, -- AES-256-GCM encrypted, format iv:authTag:ciphertext
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_repo_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  description TEXT,
  private BOOLEAN DEFAULT false,
  default_branch TEXT DEFAULT 'main',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, github_repo_id)
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  pr_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  state TEXT,
  summary TEXT,
  risk_flags JSONB,
  risk_level TEXT,
  key_changes JSONB,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (repo_id, pr_number)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repos_user_id ON repos(user_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_id ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_repo_id ON chat_messages(repo_id);
