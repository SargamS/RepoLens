const jwt = require('jsonwebtoken');
const { decrypt } = require('../utils/encryption');
const { getUserById } = require('../db/queries');

/**
 * Verifies the JWT stored in the httpOnly cookie, loads the user, decrypts
 * their stored GitHub access token, and attaches { userId, githubToken } to
 * req for downstream handlers.
 */
async function requireAuth(req, res, next) {
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

    let githubToken;
    try {
      githubToken = decrypt(user.access_token);
    } catch (err) {
      return res.status(401).json({ error: 'Could not decrypt stored credentials' });
    }

    req.userId = user.id;
    req.githubToken = githubToken;
    req.user = { id: user.id, username: user.username, avatar_url: user.avatar_url };

    return next();
  } catch (err) {
    console.error('requireAuth error:', err);
    return res.status(500).json({ error: 'Authentication check failed' });
  }
}

module.exports = { requireAuth };
