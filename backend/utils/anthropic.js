const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';

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

/**
 * Summarizes a single PR diff via the Anthropic API. Returns the parsed JSON
 * object described by PR_SUMMARIZER_SYSTEM_PROMPT.
 */
async function summarizePullRequest({ title, author, stats, diff }) {
  const userContent = `PR Title: ${title}\nAuthor: ${author}\nFile change stats: ${stats}\n\nDiff:\n${diff}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: PR_SUMMARIZER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  try {
    return JSON.parse(text);
  } catch (err) {
    // Model occasionally wraps JSON in fences despite instructions; strip and retry once.
    const cleaned = text.replace(/^```json\s*|```$/g, '').trim();
    return JSON.parse(cleaned);
  }
}

/**
 * Sends a chat message + history to the Anthropic API using the repo chat
 * system prompt. Returns the raw assistant text (may start with "NEED_FILE:").
 */
async function chatWithRepo({ systemPrompt, history, userMessage }) {
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages,
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

module.exports = {
  PR_SUMMARIZER_SYSTEM_PROMPT,
  buildRepoChatSystemPrompt,
  summarizePullRequest,
  chatWithRepo,
};
