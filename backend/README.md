# RepoLens Backend

Express + PostgreSQL (Supabase) backend for RepoLens — GitHub OAuth login, PR analysis via Claude, and repo chat.

## Setup

```bash
npm install
cp .env.example .env   # fill in real values
npm start               # or: npm run dev
```

## ⚠️ Database schema

Your original spec said to paste the schema from "Section 2 above," but that
SQL wasn't included in the message I received, so `db/schema.sql` is my
best-guess schema inferred from the columns `db/queries.js` actually uses
(`users`, `repos`, `pull_requests`, `chat_messages`). **Check it against your
real Supabase schema before running this** — if column names/types differ,
edit `db/queries.js` to match your actual tables rather than changing your
DB to match this guess.

## Folder structure

- `server.js` — app entry, middleware wiring, env var validation
- `routes/` — `auth.js`, `repos.js`
- `controllers/` — `authController.js`, `repoController.js`
- `middleware/auth.js` — `requireAuth`, verifies JWT cookie + decrypts GitHub token
- `utils/` — `encryption.js` (AES-256-GCM), `github.js` (GitHub REST calls), `anthropic.js` (Claude calls + exact system prompts)
- `db/` — `connection.js` (pg Pool), `queries.js` (all SQL), `schema.sql` (assumed schema)

## Notes on implementation choices

- **Encryption**: AES-256-GCM (not plain CBC) so tampering is detectable via the auth tag. Stored as `iv:authTag:ciphertext` hex string in one column.
- **PR analysis concurrency**: capped at 3 concurrent Anthropic calls via a small worker-pool helper in `repoController.js`, rather than a raw `Promise.all` over all 15 PRs at once.
- **Chat NEED_FILE retry**: hard-capped at exactly one extra call — if the model asks for a file twice, the second response is returned as-is rather than fetching again.
- **Render free tier**: `/api/health` is unauthenticated and rate-limited only by the global limiter, safe for uptime pingers.
- **`.env` validation**: server exits at boot with a clear message if required vars are missing, instead of failing confusingly later on first request.

## Deploying to Render

1. Push this repo to GitHub.
2. New Web Service → connect repo → Build command `npm install`, Start command `npm start`.
3. Add all vars from `.env.example` in Render's Environment tab.
4. Set `GITHUB_REDIRECT_URI` to `https://<your-render-service>.onrender.com/api/auth/callback` and register that same callback URL in your GitHub OAuth App settings.
5. Set `FRONTEND_URL` to your deployed frontend's origin (no trailing slash) — CORS and the OAuth redirect both depend on it.
