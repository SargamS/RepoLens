'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  GitBranch,
  ArrowLeft,
  MessageSquare,
  Lock,
  Globe,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { ChatDrawer } from '@/components/chat-drawer'
import { api, ApiError, type PullRequest, type RepoInfo } from '@/lib/api'

function riskFlagLabels(pr: PullRequest): string[] {
  const labels: Record<keyof PullRequest['risk_flags'], string> = {
    large_diff: 'Large diff',
    no_tests: 'No tests',
    many_files: 'Many files',
    touches_config: 'Touches config',
    touches_auth: 'Touches auth',
  }
  const flags = Object.entries(pr.risk_flags || {})
    .filter(([, value]) => value)
    .map(([key]) => labels[key as keyof PullRequest['risk_flags']])
  return flags.length > 0 ? flags : ['No flags raised']
}

export default function RepoDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const decodedId = decodeURIComponent(params.id)
  const [owner, repo] = decodedId.split('/')

  const [chatOpen, setChatOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const data = await api.analyzeRepo(decodedId)
        if (cancelled) return
        setRepoInfo(data.repo_info)
        setPullRequests(data.pull_requests)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Failed to analyze this repository.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [decodedId, router])

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-red-900/20 text-red-400 border-red-800'
      case 'medium':
        return 'bg-yellow-900/20 text-yellow-400 border-yellow-800'
      case 'low':
        return 'bg-green-900/20 text-green-400 border-green-800'
      default:
        return 'bg-card text-foreground border-border'
    }
  }

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'high':
        return <AlertTriangle className="w-4 h-4" />
      case 'medium':
      case 'low':
        return <AlertCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  const isPrivate = repoInfo?.private ?? false

  return (
    <div className="min-h-screen bg-background">
      {/* TOP NAVIGATION */}
      <nav className="border-b border-border bg-background sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-muted" />
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">R</span>
            </div>
            <span className="text-foreground font-bold text-lg tracking-wider">REPOLENS</span>
          </Link>

          {/* Repo Header Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-foreground font-medium">
                {owner}/{repo}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  isPrivate
                    ? 'bg-red-900/20 text-red-400 border-red-800'
                    : 'bg-green-900/20 text-green-400 border-green-800'
                }`}
              >
                {isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                {isPrivate ? 'Private' : 'Public'}
              </span>
            </div>
            <button
              onClick={() => setChatOpen(true)}
              disabled={!repoInfo}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2 text-sm"
            >
              <MessageSquare className="w-4 h-4" />
              Ask AI about this repo
            </button>
          </div>
        </div>
      </nav>

      {/* PR LIST */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-muted gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Fetching pull requests and running AI analysis — this can take a moment...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-foreground">{error}</p>
            <Link href="/dashboard" className="text-primary text-sm hover:underline">
              Back to dashboard
            </Link>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {pullRequests.map((pr) => (
              <div
                key={pr.id}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                {/* Top row: Title and Risk Badge */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-lg font-medium text-foreground mb-1 hover:text-primary transition-colors"
                    >
                      {pr.title}
                    </a>
                    <p className="text-sm text-muted">
                      PR #{pr.pr_number} by <span className="text-foreground">@{pr.author}</span>
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ml-4 ${getRiskColor(
                      pr.risk_level
                    )}`}
                  >
                    {getRiskIcon(pr.risk_level)}
                    {pr.risk_level.charAt(0).toUpperCase() + pr.risk_level.slice(1)} Risk
                  </span>
                </div>

                {/* Summary */}
                <p className="text-foreground text-sm leading-relaxed mb-4">{pr.summary}</p>

                {/* Changes */}
                <div className="mb-4">
                  <ul className="space-y-1">
                    {pr.key_changes.map((change, idx) => (
                      <li key={idx} className="text-sm text-muted flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Flags */}
                <div className="flex flex-wrap gap-2">
                  {riskFlagLabels(pr).map((flag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-border text-muted text-xs rounded-full border border-border/50"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {/* Empty state */}
            {pullRequests.length === 0 && (
              <div className="text-center py-16 text-muted">
                <p className="text-lg">No open pull requests in this repo.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* CHAT DRAWER */}
      {repoInfo && (
        <ChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          repoId={repoInfo.id}
          repoName={`${owner}/${repo}`}
        />
      )}
    </div>
  )
}
