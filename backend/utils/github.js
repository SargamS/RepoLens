const GITHUB_API = 'https://api.github.com';

class GithubApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

function authHeaders(token, accept) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept || 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'RepoLens-App',
  };
}

async function githubFetch(path, token, { accept, raw } = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: authHeaders(token, accept),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GithubApiError(`GitHub API ${path} failed: ${res.status} ${body}`, res.status);
  }

  return raw ? res.text() : res.json();
}

/** Exchanges an OAuth code for an access token. */
async function exchangeCodeForToken(code) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new GithubApiError(data.error_description || data.error || 'OAuth code exchange failed', res.status);
  }
  return data.access_token;
}

async function getAuthenticatedUser(token) {
  return githubFetch('/user', token);
}

async function getUserRepos(token) {
  // paginate lightly: GitHub returns up to 100 per page, take first 2 pages
  const results = [];
  for (let page = 1; page <= 2; page += 1) {
    const batch = await githubFetch(`/user/repos?visibility=all&per_page=100&page=${page}&sort=updated`, token);
    results.push(...batch);
    if (batch.length < 100) break;
  }
  return results;
}

async function getRepoInfo(owner, repo, token) {
  return githubFetch(`/repos/${owner}/${repo}`, token);
}

async function getOpenPullRequests(owner, repo, token) {
  return githubFetch(`/repos/${owner}/${repo}/pulls?state=open&per_page=30`, token);
}

async function getPullRequestDiff(owner, repo, prNumber, token) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, token, {
    accept: 'application/vnd.github.v3.diff',
    raw: true,
  });
}

async function getReadme(owner, repo, token) {
  try {
    const data = await githubFetch(`/repos/${owner}/${repo}/readme`, token);
    if (data && data.content) {
      return Buffer.from(data.content, data.encoding || 'base64').toString('utf8');
    }
    return '';
  } catch (err) {
    if (err.status === 404) return '';
    throw err;
  }
}

async function getFileTree(owner, repo, branch, token) {
  try {
    const data = await githubFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token);
    return (data.tree || [])
      .filter((entry) => entry.type === 'blob')
      .map((entry) => entry.path);
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

async function getFileContent(owner, repo, path, token) {
  const data = await githubFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, token);
  if (Array.isArray(data)) {
    // path pointed at a directory, not a file
    return '';
  }
  if (data && data.content) {
    return Buffer.from(data.content, data.encoding || 'base64').toString('utf8');
  }
  return '';
}

/**
 * Parses either a full GitHub URL or an "owner/repo" shorthand into
 * { owner, repo }.
 */
function parseRepoIdentifier(input) {
  const trimmed = String(input || '').trim();

  const urlMatch = trimmed.match(/github\.com[/:]([^/]+)\/([^/#?.]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
  }

  const shorthandMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (shorthandMatch) {
    return { owner: shorthandMatch[1], repo: shorthandMatch[2] };
  }

  throw new Error('Could not parse repository identifier. Use "owner/repo" or a full GitHub URL.');
}

module.exports = {
  GithubApiError,
  exchangeCodeForToken,
  getAuthenticatedUser,
  getUserRepos,
  getRepoInfo,
  getOpenPullRequests,
  getPullRequestDiff,
  getReadme,
  getFileTree,
  getFileContent,
  parseRepoIdentifier,
};
