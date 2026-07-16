'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, LogOut, Loader2, AlertCircle } from 'lucide-react'
import { api, ApiError, type GithubRepoSummary, type User } from '@/lib/api'

/** Parses a GitHub URL or "owner/repo" shorthand into "owner/repo", or null if invalid. */
function parseOwnerRepo(input: string): string | null {
  const trimmed = input.trim()

  const urlMatch = trimmed.match(/github\.com[/:]([^/]+)\/([^/#?.]+)/i)
  if (urlMatch) {
    return `${urlMatch[1]}/${urlMatch[2].replace(/\.git$/, '')}`
  }

  const shorthandMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
  if (shorthandMatch) {
    return `${shorthandMatch[1]}/${shorthandMatch[2]}`
  }

  return null
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [input, setInput] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [repoMode, setRepoMode] = useState<'public' | 'mine'>('public')

  const [myRepos, setMyRepos] = useState<GithubRepoSummary[]>([])
  const [myReposLoading, setMyReposLoading] = useState(false)
  const [myReposError, setMyReposError] = useState<string | null>(null)

  const suggestedRepos = [
    {
      name: 'facebook/react',
      description: 'a large open-source repo',
      url: 'https://github.com/facebook/react',
    },
    {
      name: 'vercel/next.js',
      description: 'a fast-moving framework repo',
      url: 'https://github.com/vercel/next.js',
    },
  ]

  // Require a valid session to use the dashboard.
  useEffect(() => {
    let cancelled = false
    api
      .getMe()
      .then((u) => {
        if (!cancelled) {
          setUser(u)
          setAuthChecked(true)
        }
      })
      .catch(() => {
        if (!cancelled) router.replace('/login')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  // Lazily load the user's own GitHub repos when they switch to "My Repos".
  useEffect(() => {
    if (repoMode !== 'mine' || myRepos.length > 0 || myReposLoading) return
    setMyReposLoading(true)
    setMyReposError(null)
    api
      .getRepos()
      .then(setMyRepos)
      .catch((err) => {
        setMyReposError(err instanceof ApiError ? err.message : 'Failed to load your repositories')
      })
      .finally(() => setMyReposLoading(false))
  }, [repoMode, myRepos.length, myReposLoading])

  const handleAnalyze = async () => {
    if (!input.trim() || isNavigating) return
    setError(null)

    const ownerRepo = parseOwnerRepo(input)
    if (!ownerRepo) {
      setError('Enter a valid GitHub URL or "owner/repo".')
      return
    }

    setIsNavigating(true)
    router.push(`/repos/${encodeURIComponent(ownerRepo)}`)
  }

  const handleSuggestionClick = (url: string) => {
    setInput(url)
    setError(null)
  }

  const handleUserRepoClick = (fullName: string) => {
    setInput(fullName)
    setShowDropdown(false)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isNavigating) {
      handleAnalyze()
    }
  }

  const handleSignOut = async () => {
    try {
      await api.logout()
    } catch {
      // even if the request fails, drop the user back to login
    } finally {
      router.push('/login')
    }
  }

  const filteredMyRepos = input
    ? myRepos.filter((r) => r.full_name.toLowerCase().includes(input.toLowerCase()))
    : myRepos

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* TOP NAVIGATION */}
      <nav className="border-b border-border bg-background sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">R</span>
            </div>
            <span className="text-foreground font-bold text-lg tracking-wider">REPOLENS</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt={user.username} className="w-4 h-4 rounded-full" />
              ) : (
                <GitBranch className="w-4 h-4 text-muted" />
              )}
              <span className="text-foreground text-sm">{user?.username}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-full border border-border text-foreground hover:bg-card transition-colors text-sm flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* HERO SECTION */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-foreground mb-4 tracking-tight">
            Understand Any Repo, Instantly
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">
            Paste a GitHub repo URL and watch AI analyze pull requests, flag risks, and answer any question about the codebase.
          </p>
        </div>

        {/* INPUT SECTION */}
        <div className="mb-12">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6 bg-card border border-border rounded-lg p-1 w-fit">
            <button
              onClick={() => setRepoMode('public')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                repoMode === 'public'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Public Repo
            </button>
            <button
              onClick={() => setRepoMode('mine')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                repoMode === 'mine' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              My Repos
            </button>
          </div>

          {/* Input with Analyze Button */}
          <div className="flex gap-3 mb-4 relative">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setError(null)
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => repoMode === 'mine' && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder={
                  repoMode === 'public'
                    ? 'Paste a GitHub repo URL (e.g. github.com/owner/repo)'
                    : 'Search your repositories...'
                }
                className="w-full px-4 py-3 rounded-full bg-card border border-border text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />

              {/* Dropdown for My Repos */}
              {repoMode === 'mine' && showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
                  {myReposLoading && (
                    <div className="px-4 py-3 text-muted text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading your repositories...
                    </div>
                  )}
                  {myReposError && (
                    <div className="px-4 py-3 text-red-400 text-sm">{myReposError}</div>
                  )}
                  {!myReposLoading && !myReposError && filteredMyRepos.length === 0 && (
                    <div className="px-4 py-3 text-muted text-sm">No repositories found.</div>
                  )}
                  {filteredMyRepos.map((repo) => (
                    <button
                      key={repo.full_name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleUserRepoClick(repo.full_name)}
                      className="w-full text-left px-4 py-3 hover:bg-secondary border-b border-border last:border-0 flex items-center justify-between group transition-colors"
                    >
                      <span className="text-foreground text-sm">{repo.full_name}</span>
                      {repo.private && <span className="text-muted text-xs">🔒</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!input.trim() || isNavigating}
              className="px-8 py-3 rounded-full bg-accent text-accent-foreground font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 group"
            >
              {isNavigating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>Analyze</>
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* SUGGESTIONS SECTION */}
        {input === '' && (
          <div className="text-center">
            <p className="text-muted text-xs uppercase tracking-widest mb-6">Try Analyzing:</p>
            <div className="flex flex-col gap-3 items-center">
              {suggestedRepos.map((repo, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(repo.url)}
                  className="px-6 py-3 rounded-full border border-border text-foreground hover:bg-card transition-colors text-sm"
                >
                  <span className="font-medium">{repo.name}</span>
                  <span className="text-muted ml-2">— {repo.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {input === '' && (
          <div className="mt-20 text-center text-muted">
            <p className="text-lg">No repos analyzed yet.</p>
            <p className="text-sm">Paste a URL above to get started.</p>
          </div>
        )}
      </main>
    </div>
  )
}
