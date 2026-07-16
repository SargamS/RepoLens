# RepoLens — Integration Guide

Your frontend (`repo-lens`, Next.js) was 100% mock data — no fetches, simulated
timers, hardcoded PRs. Your backend (`repolens-backend`, Express) was fully
built but had no caller. I wired the two together for real. Nothing in your
backend logic changed except two small robustness fixes (below); the frontend
UI/styling is untouched, only its data layer is now real.

## What was connected

| Frontend page/component | Now calls |
|---|---|
| `login/page.tsx` | `GET /api/auth/login` (full-page redirect into GitHub OAuth) |
| `dashboard/page.tsx` | `GET /api/auth/me` (session check), `GET /api/repos` ("My Repos" list), `POST /api/auth/logout` |
| `repos/[id]/page.tsx` | `POST /api/repos/analyze` on mount — fetches PRs from GitHub, runs Claude analysis, upserts into Postgres, returns everything in one call |
| `components/chat-drawer.tsx` | `GET /api/repos/:id/chat` (load history), `POST /api/repos/:id/chat` (send message) |

Route design: the repo detail page is keyed by `owner/repo` in the URL (as
your original frontend already did), and calls `analyze` on mount rather than
requiring the dashboard to call it first. This matches your backend's design —
`analyze` is idempotent (upserts), so re-visiting a repo just re-analyzes it.
The numeric `repo_info.id` returned from that call is what's passed to the
chat drawer, since chat/history endpoints are keyed by DB id, not by name.

New file: `frontend/lib/api.ts` — a single typed client wrapping every
backend route with `credentials: 'include'` so the httpOnly session cookie
flows automatically, plus a normalized `ApiError` for consistent error
handling/401 redirects across pages.

## Two backend fixes (bugs, not redesigns)

1. **Cookie couldn't survive local dev.** `secure: true` + `sameSite: 'none'`
   cookies are silently dropped by browsers over plain HTTP. That meant the
   OAuth redirect would "succeed" but the session would never actually stick
   when frontend/backend both run on `localhost`. Fixed to use
   `secure/sameSite: 'lax'` in development and the original cross-site
   `secure/none` settings in production (`NODE_ENV=production`), where
   frontend and backend live on different HTTPS origins.
2. **`FRONTEND_URL` trailing slash.** `cors()` does exact string matching
   against the `Origin` header, which never has a trailing slash. A
   `FRONTEND_URL` set with one (easy mistake) would silently block every
   request. Now trimmed in `server.js`.

## Running it locally

**Backend** (`repolens-backend/`):
```bash
npm install
cp .env.example .env   # fill in real values, see below
npm run dev             # http://localhost:4000
```

**Frontend** (`repo-lens/`):
```bash
npm install
cp .env.example .env.local
npm run dev             # http://localhost:3000
```

### Env values that must match each other

- Backend `.env`: `FRONTEND_URL=http://localhost:3000`
- Frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000`
- Backend `.env`: `GITHUB_REDIRECT_URI=http://localhost:4000/api/auth/callback`
- Your GitHub OAuth App's **Authorization callback URL** must be set to that
  same `GITHUB_REDIRECT_URI` value in https://github.com/settings/developers.
- `DATABASE_URL` needs to point at a real Postgres instance with
  `db/schema.sql` applied (Supabase's SQL editor works fine — just paste it
  in and run once).
- `ANTHROPIC_API_KEY` needs to be a real key for PR analysis + chat to work.

Once both are running and the OAuth app is registered, the flow is:
sign in with GitHub → paste a repo URL → Claude analyzes open PRs → chat with
the repo in the drawer.

## Deploying

Your backend README already documents Render deployment — that's unchanged.
For the frontend, set `NEXT_PUBLIC_API_URL` to your deployed backend's origin
at build time, and update the backend's `FRONTEND_URL` / GitHub OAuth
callback to match your deployed frontend/backend origins (same pattern as
local, just with real URLs instead of `localhost`).
