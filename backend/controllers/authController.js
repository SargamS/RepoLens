const jwt = require('jsonwebtoken');
const { encrypt } = require('../utils/encryption');
const { exchangeCodeForToken, getAuthenticatedUser } = require('../utils/github');
const { upsertUser, getUserById } = require('../db/queries');

// `secure: true` + `sameSite: 'none'` cookies are dropped by browsers over
// plain HTTP, which breaks local dev (frontend/backend both on localhost).
// In production the frontend and backend live on different HTTPS origins,
// so the cookie has to be cross-site (`none` + `secure`) for GitHub's
// redirect-back-to-backend flow to work.
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, mirrors JWT expiry
};

function login(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: 'repo read:user',
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

async function callback(req, res) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Missing OAuth code' });
    }

    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await getAuthenticatedUser(accessToken);

    const encryptedToken = encrypt(accessToken);

    const user = await upsertUser({
      github_id: githubUser.id,
      username: githubUser.login,
      avatar_url: githubUser.avatar_url,
      encrypted_token: encryptedToken,
    });

    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.cookie('token', jwtToken, COOKIE_OPTIONS);
    return res.redirect(process.env.FRONTEND_URL);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.status(500).json({ error: 'GitHub authentication failed' });
  }
}

async function me(req, res) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const user = await getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    return res.json({ id: user.id, username: user.username, avatar_url: user.avatar_url });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ error: 'Failed to load session' });
  }
}

function logout(req, res) {
  res.clearCookie('token', COOKIE_OPTIONS);
  return res.json({ success: true });
}

module.exports = { login, callback, me, logout };
