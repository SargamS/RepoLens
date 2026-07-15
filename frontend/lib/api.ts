export interface User {
  id: number
  username: string
  avatar_url: string | null
}

export interface Repository {
  id: number
  name: string
  full_name: string
  owner: string
  description: string | null
  private: boolean
  default_branch: string
}

export interface PullRequest {
  id: number
  pr_number: number
  title: string
  author: string | null
  state: string | null
  summary: string | null
  risk_flags: Record<string, boolean> | null
  risk_level: 'low' | 'medium' | 'high' | null
  key_changes: string[] | null
  url: string | null
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(body.error ?? 'Request failed', response.status)
  return body as T
}

export const api = {
  loginUrl: `${API_URL}/auth/login`,
  me: () => request<User>('/auth/me'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  listRepos: () => request<Array<Pick<Repository, 'name' | 'owner' | 'full_name' | 'private' | 'description'>>>('/repos'),
  analyzeRepo: (github_url: string) => request<{ repo_id: number; repo_info: Repository; pull_requests: PullRequest[] }>('/repos/analyze', {
    method: 'POST', body: JSON.stringify({ github_url }),
  }),
  getRepo: (repoId: string) => request<Repository>(`/repos/${repoId}`),
  getPullRequests: (repoId: string) => request<PullRequest[]>(`/repos/${repoId}/prs`),
  getChatHistory: (repoId: string) => request<ChatMessage[]>(`/repos/${repoId}/chat`),
  sendChatMessage: (repoId: string, message: string) => request<{ response: string }>(`/repos/${repoId}/chat`, {
    method: 'POST', body: JSON.stringify({ message }),
  }),
}
