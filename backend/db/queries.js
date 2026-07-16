const { query } = require('./connection');

// ---------- users ----------

async function upsertUser({ github_id, username, avatar_url, encrypted_token }) {
  const result = await query(
    `INSERT INTO users (github_id, username, avatar_url, access_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_id)
     DO UPDATE SET username = EXCLUDED.username,
                   avatar_url = EXCLUDED.avatar_url,
                   access_token = EXCLUDED.access_token
     RETURNING id, github_id, username, avatar_url`,
    [github_id, username, avatar_url, encrypted_token]
  );
  return result.rows[0];
}

async function getUserById(userId) {
  const result = await query(
    `SELECT id, github_id, username, avatar_url, access_token
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

// ---------- repos ----------

async function upsertRepo({ user_id, github_repo_id, name, full_name, owner, description, private: isPrivate, default_branch }) {
  const result = await query(
    `INSERT INTO repos (user_id, github_repo_id, name, full_name, owner, description, private, default_branch)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, github_repo_id)
     DO UPDATE SET name = EXCLUDED.name,
                   full_name = EXCLUDED.full_name,
                   owner = EXCLUDED.owner,
                   description = EXCLUDED.description,
                   private = EXCLUDED.private,
                   default_branch = EXCLUDED.default_branch
     RETURNING *`,
    [user_id, github_repo_id, name, full_name, owner, description, isPrivate, default_branch]
  );
  return result.rows[0];
}

async function getRepoByIdForUser(repoId, userId) {
  const result = await query(
    `SELECT * FROM repos WHERE id = $1 AND user_id = $2`,
    [repoId, userId]
  );
  return result.rows[0] || null;
}

// ---------- pull_requests ----------

async function upsertPullRequest({ repo_id, pr_number, title, author, state, summary, risk_flags, risk_level, key_changes, url }) {
  const result = await query(
    `INSERT INTO pull_requests (repo_id, pr_number, title, author, state, summary, risk_flags, risk_level, key_changes, url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (repo_id, pr_number)
     DO UPDATE SET title = EXCLUDED.title,
                   author = EXCLUDED.author,
                   state = EXCLUDED.state,
                   summary = EXCLUDED.summary,
                   risk_flags = EXCLUDED.risk_flags,
                   risk_level = EXCLUDED.risk_level,
                   key_changes = EXCLUDED.key_changes,
                   url = EXCLUDED.url
     RETURNING *`,
    [repo_id, pr_number, title, author, state, summary, JSON.stringify(risk_flags), risk_level, JSON.stringify(key_changes), url]
  );
  return result.rows[0];
}

async function getPullRequestsForRepo(repoId) {
  const result = await query(
    `SELECT * FROM pull_requests WHERE repo_id = $1 ORDER BY pr_number DESC`,
    [repoId]
  );
  return result.rows;
}

// ---------- chat_messages ----------

async function insertChatMessage({ repo_id, role, content }) {
  const result = await query(
    `INSERT INTO chat_messages (repo_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [repo_id, role, content]
  );
  return result.rows[0];
}

async function getRecentChatMessages(repoId, limit = 6) {
  const result = await query(
    `SELECT * FROM (
       SELECT * FROM chat_messages WHERE repo_id = $1 ORDER BY created_at DESC LIMIT $2
     ) sub ORDER BY created_at ASC`,
    [repoId, limit]
  );
  return result.rows;
}

async function getAllChatMessages(repoId) {
  const result = await query(
    `SELECT * FROM chat_messages WHERE repo_id = $1 ORDER BY created_at ASC`,
    [repoId]
  );
  return result.rows;
}

module.exports = {
  upsertUser,
  getUserById,
  upsertRepo,
  getRepoByIdForUser,
  upsertPullRequest,
  getPullRequestsForRepo,
  insertChatMessage,
  getRecentChatMessages,
  getAllChatMessages,
};
