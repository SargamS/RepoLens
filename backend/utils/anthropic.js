// NOTE: file kept as "anthropic.js" so repoController.js doesn't need any
// import-path changes, but this now calls Google's Gemini API (free tier)
// instead of the Anthropic API. Uses plain fetch (Node 18+ has it built in),
// so no new npm dependency is required.

// gemini-2.5-flash was retired for new users (404 "no longer available") ahead
// of its official Oct 16 2026 shutdown date. gemini-3.1-flash-lite is Google's
// recommended replacement path for the Flash-Lite line, remains free-tier
// eligible, and has a much higher free RPM ceiling than 2.5 Flash did — which
// also helps with the 429 quota errors we were seeing. Overridable via env var
// in case Google moves the goalposts again.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PR_SUMMARIZER_SYSTEM_PROMPT = `You are a senior software engineer reviewing a GitHub pull request. You will be given the PR title, author, file change stats, and the raw diff. Your job is to produce a concise, structured analysis.

Respond ONLY in valid JSON, no markdown formatting, no preamble, in this exact shape:

{
  "summary": "2-3 sentence plain-English summary of what this PR does and why, based on the diff",
  "risk_flags": {
    "large_diff": boolean,
    "no_tests": boolean,
    "many_files": boolean,
    "touches_config": boolean,
    "touches_auth": boolean
  },
  "risk_level": "low" | "medium" | "high",
  "key_changes": ["short bullet", "short bullet", "short bullet"]
}

Rules:
- Base risk_level on a combination of the flags above, not just diff size alone.
- key_changes should have 2-5 items max, each under 15 words.
- If the diff is truncated or unclear, say so in the summary rather than guessing.
- Do not include any text outside the JSON object.`;

function buildRepoChatSystemPrompt({ owner, name, readmeContent, fileTree, prSummariesJoined }) {
  return `You are an AI assistant helping a developer understand a specific GitHub repository. You have access to the repo's README, file structure, and summaries of recent pull requests. Use this context to answer questions accurately.

Guidelines:
- Answer based only on the context provided below. Do not invent file contents, function names, or behavior you cannot see.
- If the user's question requires content from a specific file that isn't included in your context, respond with exactly this format so the system can fetch it:
  NEED_FILE: {relative/path/to/file}
- If you already have enough context to answer, answer directly and conversationally — no need for JSON or special formatting.
- Keep answers focused and under 150 words unless the user explicitly asks for a detailed explanation.
- If asked something unrelated to this repo, politely redirect the user to ask about this repo specifically.

Repo context:
Name: ${owner}/${name}
README:
${readmeContent}

File structure:
${fileTree}

Recent PR summaries:
${prSummariesJoined}`;
}

class GeminiApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
  }
}

/**
 * Low-level call to Gemini's generateContent endpoint.
 * `contents` follows Gemini's { role: 'user' | 'model', parts: [{text}] } shape.
 */
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini's 429 error message embeds a suggested delay, e.g. "Please retry in 21.4s".
function parseRetryDelayMs(message) {
  const match = /retry in ([\d.]+)s/i.exec(message || '');
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : null;
}

async function rawCallGemini({ systemPrompt, contents }, attempt = 0) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError('GEMINI_API_KEY is not set', 500);
  }

  const body = {
    contents,
    ...(systemPrompt
      ? { system_instruction: { parts: [{ text: systemPrompt }] } }
      : {}),
    generationConfig: { maxOutputTokens: 1000 },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = (data.error && data.error.message) || `Gemini API request failed: ${res.status}`;

    // Back off and retry on rate limiting / transient server errors.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const suggested = parseRetryDelayMs(message);
      const delay = suggested !== null ? suggested : 500 * 2 ** attempt;
      await sleep(delay);
      return rawCallGemini({ systemPrompt, contents }, attempt + 1);
    }

    throw new GeminiApiError(message, res.status);
  }

  const candidate = data.candidates && data.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  return parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

// Free-tier Gemini Flash allows ~10 requests/minute PROJECT-WIDE — shared by
// PR-summary calls and chat calls alike. Without pacing, a batch of PR
// summaries burns the whole minute's quota in seconds and any chat request
// that lands afterward gets an immediate 429 with nothing left to retry into.
// This serializes every call (summaries + chat) through one queue with a
// minimum spacing between dispatches, so chat always gets its turn instead
// of being starved by a PR-analysis burst.
const MIN_CALL_INTERVAL_MS = 6500; // ~9/min, a safety margin under the 10 RPM cap
let geminiQueue = Promise.resolve();
let lastDispatchTime = 0;

function callGemini(args) {
  const runNext = geminiQueue.then(async () => {
    const waitMs = Math.max(0, lastDispatchTime + MIN_CALL_INTERVAL_MS - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    lastDispatchTime = Date.now();
    return rawCallGemini(args);
  });
  // Keep the queue chain alive even if this call throws, so later calls
  // still get their turn instead of the whole queue dying.
  geminiQueue = runNext.catch(() => {});
  return runNext;
}

/**
 * Summarizes a single PR diff via Gemini. Returns the parsed JSON object
 * described by PR_SUMMARIZER_SYSTEM_PROMPT.
 */
async function summarizePullRequest({ title, author, stats, diff }) {
  const userContent = `PR Title: ${title}\nAuthor: ${author}\nFile change stats: ${stats}\n\nDiff:\n${diff}`;

  const text = await callGemini({
    systemPrompt: PR_SUMMARIZER_SYSTEM_PROMPT,
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
  });

  try {
    return JSON.parse(text);
  } catch (err) {
    // Model occasionally wraps JSON in fences despite instructions; strip and retry once.
    const cleaned = text.replace(/^```json\s*|```$/g, '').trim();
    return JSON.parse(cleaned);
  }
}

/**
 * Sends a chat message + history to Gemini using the repo chat system
 * prompt. Returns the raw assistant text (may start with "NEED_FILE:").
 */
async function chatWithRepo({ systemPrompt, history, userMessage }) {
  // Gemini uses 'model' instead of 'assistant' for the AI turn.
  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  return callGemini({ systemPrompt, contents });
}

module.exports = {
  PR_SUMMARIZER_SYSTEM_PROMPT,
  buildRepoChatSystemPrompt,
  summarizePullRequest,
  chatWithRepo,
};
