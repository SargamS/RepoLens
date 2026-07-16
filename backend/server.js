require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const repoRoutes = require('./routes/repos');

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_REDIRECT_URI',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'GEMINI_API_KEY',
  'FRONTEND_URL',
];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

// Render/Railway (and most PaaS providers) sit behind a reverse proxy, so
// Express needs to trust the X-Forwarded-* headers it sets. Without this,
// express-rate-limit can't reliably identify clients by IP.
app.set('trust proxy', 1);

// Trim any trailing slash so a mistyped env var (e.g. "http://localhost:3000/")
// doesn't silently fail exact-match CORS/redirect comparisons.
const FRONTEND_URL = process.env.FRONTEND_URL.replace(/\/$/, '');

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Light rate limiting for all unauthenticated traffic; protected routes get
// their own auth check on top of this.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Uptime / keep-alive check for Render free tier.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/repos', repoRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler (in case anything throws outside a try/catch).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`RepoLens backend listening on port ${PORT}`);
});
