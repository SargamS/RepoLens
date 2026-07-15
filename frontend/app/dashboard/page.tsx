'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, Loader2 } from 'lucide-react'
import { api, ApiError, type Repository } from '@/lib/api'
import { AuthGuard, useAuthenticatedUser } from '@/components/auth-guard'

const suggestedRepos = [
  { name: 'facebook/react', description: 'a large open-source repo', url: 'https://github.com/facebook/react' },
  { name: 'vercel/next.js', description: 'a fast-moving framework repo', url: 'https://github.com/vercel/next.js' },
]

function Dashboard() {
  const router = useRouter()
  const { user } = useAuthenticatedUser()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [repoMode, setRepoMode] = useState<'public' | 'mine'>('public')
  const [userRepos, setUserRepos] = useState<Array<Pick<Repository, 'full_name' | 'private'>>>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (repoMode !== 'mine' || userRepos.length) return
    setReposLoading(true)
    api.listRepos().then((repos) => setUserRepos(repos)).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load repositories')
    }).finally(() => setReposLoading(false))
  }, [repoMode, userRepos.length])

  const handleAnalyze = async () => {
    if (!input.trim()) return
    setIsLoading(true); setError('')
    try {
      const result = await api.analyzeRepo(input.trim())
      router.push(`/repos/${result.repo_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze this repository')
    } finally { setIsLoading(false) }
  }

  const logout = async () => { await api.logout().catch(() => undefined); router.replace('/login') }
  const filteredRepos = userRepos.filter((repo) => repo.full_name.toLowerCase().includes(input.toLowerCase()))

  return <div className="min-h-screen bg-background">
    <nav className="border-b border-border bg-background sticky top-0 z-40"><div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3"><div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center"><span className="text-primary-foreground font-bold text-lg">R</span></div><span className="text-foreground font-bold text-lg tracking-wider">REPOLENS</span></div>
      <div className="flex items-center gap-4"><div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border"><GitBranch className="w-4 h-4 text-muted" /><span className="text-foreground text-sm">{user?.username}</span></div><button onClick={logout} className="px-4 py-2 rounded-full border border-border text-foreground hover:bg-card transition-colors text-sm">Sign Out</button></div>
    </div></nav>
    <main className="max-w-4xl mx-auto px-6 py-16"><div className="text-center mb-16"><h1 className="text-5xl font-light text-foreground mb-4 tracking-tight">Understand Any Repo, Instantly</h1><p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">Paste a GitHub repo URL and watch AI analyze pull requests, flag risks, and answer any question about the codebase.</p></div>
      <div className="mb-12"><div className="flex gap-2 mb-6 bg-card border border-border rounded-lg p-1 w-fit"><button onClick={() => setRepoMode('public')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${repoMode === 'public' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'}`}>Public Repo</button><button onClick={() => setRepoMode('mine')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${repoMode === 'mine' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'}`}>My Repos</button></div>
        <div className="flex gap-3 mb-4 relative"><div className="flex-1 relative"><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalyze()} onFocus={() => repoMode === 'mine' && setShowDropdown(true)} placeholder={repoMode === 'public' ? 'Paste a GitHub repo URL (e.g. github.com/owner/repo)' : 'Search your repositories...'} className="w-full px-4 py-3 rounded-full bg-card border border-border text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
          {repoMode === 'mine' && showDropdown && <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">{reposLoading ? <p className="px-4 py-3 text-sm text-muted">Loading repositories…</p> : filteredRepos.map((repo) => <button key={repo.full_name} onClick={() => { setInput(repo.full_name); setShowDropdown(false) }} className="w-full text-left px-4 py-3 hover:bg-secondary border-b border-border last:border-0 flex items-center justify-between"><span className="text-foreground text-sm">{repo.full_name}</span>{repo.private && <span className="text-muted text-xs">🔒</span>}</button>)}</div>}
        </div><button onClick={handleAnalyze} disabled={!input.trim() || isLoading} className="px-8 py-3 rounded-full bg-accent text-accent-foreground font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">{isLoading && <Loader2 className="w-4 h-4 animate-spin" />}{isLoading ? 'Analyzing...' : 'Analyze'}</button></div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      {input === '' && repoMode === 'public' && <div className="text-center"><p className="text-muted text-xs uppercase tracking-widest mb-6">Try Analyzing:</p><div className="flex flex-col gap-3 items-center">{suggestedRepos.map((repo) => <button key={repo.name} onClick={() => setInput(repo.url)} className="px-6 py-3 rounded-full border border-border text-foreground hover:bg-card transition-colors text-sm"><span className="font-medium">{repo.name}</span><span className="text-muted ml-2">— {repo.description}</span></button>)}</div></div>}
    </main>
  </div>
}

export default function DashboardPage() { return <AuthGuard><Dashboard /></AuthGuard> }
