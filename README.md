# RepoLens

RepoLens combines a Next.js 16 frontend with an Express/PostgreSQL backend to analyze GitHub pull requests using Anthropic Claude.

## Run locally

1. Install dependencies with `npm install` from this directory.
2. Copy `backend/.env.example` to `backend/.env` and set every value.
3. Copy `frontend/.env.example` to `frontend/.env.local`.
4. Run `npm run dev` and visit `http://localhost:3000`.

The frontend URL must be included in `FRONTEND_URL`, and the GitHub OAuth callback must be `http://localhost:4000/api/auth/callback` for local development. Apply `backend/db/schema.sql` to your PostgreSQL database before signing in.

## Architecture

- `frontend/lib/api.ts` centralizes browser API calls and credentials.
- The Express server issues a secure, HTTP-only JWT cookie after GitHub OAuth.
- All repository and Claude chat endpoints require that cookie.
- GitHub tokens are encrypted at rest in PostgreSQL using AES-256-GCM.
