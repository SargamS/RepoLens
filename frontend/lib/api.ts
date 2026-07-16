/**
 * Typed client for the RepoLens Express backend.
 *
 * All requests use `credentials: 'include'` so the httpOnly session cookie
 * set by the backend (after GitHub OAuth) is sent automatically. This
 * requires NEXT_PUBLIC_API_URL to point at the backend origin and the
 * backend's FRONTEND_URL env var to match this app's origin (for CORS).
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
  } catch (err) {
    throw new ApiError(
      'Could not reach the RepoLens server. Check that the backend is running and NEXT_PUBLIC_API_URL is set correctly.',
      0
    )
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // response wasn't JSON — keep the default message
    }
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

// ---------- types ----------

export interface User {
  id: number
  username: string
  avatar_url: string
}

export interface GithubRepoSummary {
  name: string
  owner: string | null
  full_name: string
  private: boolean
  description: string | null
}

export interface RepoInfo {
  id: number
  user_id: number
  github_repo_id: number
  name: string
  full_name: string
  owner: string
  description: string | null
  private: boolean
  default_branch: string
}

export interface RiskFlags {
  large_diff: boolean
  no_tests: boolean
  many_files: boolean
  touches_config: boolean
  touches_auth: boolean
}

export interface PullRequest {
  id: number
  repo_id: number
  pr_number: number
  title: string
  author: string | null
  state: string
  summary: string
  risk_flags: RiskFlags
  risk_level: 'low' | 'medium' | 'high'
  key_changes: string[]
  url: string
}

export interface AnalyzeRepoResponse {
  repo_id: number
  repo_info: RepoInfo
  pull_requests: PullRequest[]
}

export interface ChatMessage {
  id: number
  repo_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ---------- API ----------

export const api = {
  /** Full-page redirect target for "Continue with GitHub". Not a fetch call. */
  loginUrl: () => `${API_BASE_URL}/api/auth/login`,

  getMe: () => apiFetch<User>('/api/auth/me'),

  logout: () => apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  getRepos: () => apiFetch<GithubRepoSummary[]>('/api/repos'),

  analyzeRepo: (github_url: string) =>
    apiFetch<AnalyzeRepoResponse>('/api/repos/analyze', {
      method: 'POST',
      body: JSON.stringify({ github_url }),
    }),

  getStoredPRs: (repoId: number | string) =>
    apiFetch<PullRequest[]>(`/api/repos/${repoId}/prs`),

  chat: (repoId: number | string, message: string) =>
    apiFetch<{ response: string }>(`/api/repos/${repoId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  getChatHistory: (repoId: number | string) =>
    apiFetch<ChatMessage[]>(`/api/repos/${repoId}/chat`),
}
