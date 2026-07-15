const github = require('../utils/github');
const anthropic = require('../utils/anthropic');
const queries = require('../db/queries');

const MAX_PRS_TO_ANALYZE = 15;
const DIFF_TRUNCATE_CHARS = 8000;
const FILE_TRUNCATE_CHARS = 4000;
const CHAT_HISTORY_LIMIT = 6;
const CONCURRENCY_LIMIT = 3;

/** Runs async tasks with a max concurrency to avoid hammering rate limits. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await fn(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function listRepos(req, res) {
  try {
    const repos = await github.getUserRepos(req.githubToken);
    const simplified = repos.map((r) => ({
      name: r.name,
      owner: r.owner && r.owner.login,
      full_name: r.full_name,
      private: r.private,
      description: r.description,
    }));
    return res.json(simplified);
  } catch (err) {
    console.error('listRepos error:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: 'Failed to fetch repositories from GitHub' });
  }
}

async function analyzeRepo(req, res) {
  try {
    const { github_url } = req.body;
    if (!github_url) {
      return res.status(400).json({ error: 'github_url is required' });
    }

    let owner;
    let repo;
    try {
      ({ owner, repo } = github.parseRepoIdentifier(github_url));
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const repoInfo = await github.getRepoInfo(owner, repo, req.githubToken);
    const openPrs = await github.getOpenPullRequests(owner, repo, req.githubToken);
    const prsToAnalyze = openPrs.slice(0, MAX_PRS_TO_ANALYZE);

    const dbRepo = await queries.upsertRepo({
      user_id: req.userId,
      github_repo_id: repoInfo.id,
      name: repoInfo.name,
      full_name: repoInfo.full_name,
      owner: repoInfo.owner.login,
      description: repoInfo.description,
      private: repoInfo.private,
      default_branch: repoInfo.default_branch,
    });

    const analyzed = await mapWithConcurrency(prsToAnalyze, CONCURRENCY_LIMIT, async (pr) => {
      try {
        const diff = await github.getPullRequestDiff(owner, repo, pr.number, req.githubToken);
        const truncatedDiff = diff.slice(0, DIFF_TRUNCATE_CHARS);
        const stats = `+${pr.additions || 0} / -${pr.deletions || 0}, ${pr.changed_files || 'unknown'} files changed`;

        const analysis = await anthropic.summarizePullRequest({
          title: pr.title,
          author: pr.user && pr.user.login,
          stats,
          diff: truncatedDiff,
        });

        return queries.upsertPullRequest({
          repo_id: dbRepo.id,
          pr_number: pr.number,
          title: pr.title,
          author: pr.user && pr.user.login,
          state: pr.state,
          summary: analysis.summary,
          risk_flags: analysis.risk_flags,
          risk_level: analysis.risk_level,
          key_changes: analysis.key_changes,
          url: pr.html_url,
        });
      } catch (err) {
        console.error(`Failed to analyze PR #${pr.number}:`, err);
        return null;
      }
    });

    return res.json({
      repo_id: dbRepo.id,
      repo_info: dbRepo,
      pull_requests: analyzed.filter(Boolean),
    });
  } catch (err) {
    console.error('analyzeRepo error:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: 'Failed to analyze repository' });
  }
}

async function getStoredPullRequests(req, res) {
  try {
    const { repo_id } = req.params;
    const repo = await queries.getRepoByIdForUser(repo_id, req.userId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const prs = await queries.getPullRequestsForRepo(repo_id);
    return res.json(prs);
  } catch (err) {
    console.error('getStoredPullRequests error:', err);
    return res.status(500).json({ error: 'Failed to load pull requests' });
  }
}

async function getStoredRepo(req, res) {
  try {
    const repo = await queries.getRepoByIdForUser(req.params.repo_id, req.userId);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    return res.json(repo);
  } catch (err) {
    console.error('getStoredRepo error:', err);
    return res.status(500).json({ error: 'Failed to load repository' });
  }
}

async function chatWithRepo(req, res) {
  try {
    const { repo_id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const repo = await queries.getRepoByIdForUser(repo_id, req.userId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const [readmeContent, fileTreePaths, storedPrs, historyRows] = await Promise.all([
      github.getReadme(repo.owner, repo.name, req.githubToken),
      github.getFileTree(repo.owner, repo.name, repo.default_branch, req.githubToken),
      queries.getPullRequestsForRepo(repo_id),
      queries.getRecentChatMessages(repo_id, CHAT_HISTORY_LIMIT),
    ]);

    const fileTree = fileTreePaths.join('\n');
    const prSummariesJoined = storedPrs
      .map((pr) => `#${pr.pr_number} ${pr.title} (${pr.risk_level} risk): ${pr.summary}`)
      .join('\n');

    const systemPrompt = anthropic.buildRepoChatSystemPrompt({
      owner: repo.owner,
      name: repo.name,
      readmeContent,
      fileTree,
      prSummariesJoined,
    });

    const history = historyRows.map((row) => ({ role: row.role, content: row.content }));

    let assistantText = await anthropic.chatWithRepo({
      systemPrompt,
      history,
      userMessage: message,
    });

    if (assistantText.trim().startsWith('NEED_FILE:')) {
      const filePath = assistantText.trim().replace('NEED_FILE:', '').trim();

      let fileContent = '';
      try {
        fileContent = await github.getFileContent(repo.owner, repo.name, filePath, req.githubToken);
        fileContent = fileContent.slice(0, FILE_TRUNCATE_CHARS);
      } catch (err) {
        fileContent = `(Could not fetch ${filePath}: ${err.message})`;
      }

      const augmentedSystemPrompt = `${systemPrompt}\n\nAdditional file content requested (${filePath}):\n${fileContent}`;

      // Hard cap at exactly one retry — no looping even if the model asks for another file.
      assistantText = await anthropic.chatWithRepo({
        systemPrompt: augmentedSystemPrompt,
        history,
        userMessage: message,
      });
    }

    await queries.insertChatMessage({ repo_id, role: 'user', content: message });
    await queries.insertChatMessage({ repo_id, role: 'assistant', content: assistantText });

    return res.json({ response: assistantText });
  } catch (err) {
    console.error('chatWithRepo error:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: 'Failed to process chat message' });
  }
}

async function getChatHistory(req, res) {
  try {
    const { repo_id } = req.params;
    const repo = await queries.getRepoByIdForUser(repo_id, req.userId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const messages = await queries.getAllChatMessages(repo_id);
    return res.json(messages);
  } catch (err) {
    console.error('getChatHistory error:', err);
    return res.status(500).json({ error: 'Failed to load chat history' });
  }
}

module.exports = {
  listRepos,
  analyzeRepo,
  getStoredRepo,
  getStoredPullRequests,
  chatWithRepo,
  getChatHistory,
};
