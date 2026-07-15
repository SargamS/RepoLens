'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, MessageSquare, Lock, Globe, AlertTriangle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { ChatDrawer } from '@/components/chat-drawer'
import { api, type PullRequest, type Repository } from '@/lib/api'
import { AuthGuard } from '@/components/auth-guard'

function flagLabels(flags: PullRequest['risk_flags']) {
  if (!flags) return []
  return Object.entries(flags).filter(([, enabled]) => enabled).map(([flag]) => flag.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()))
}

function RepoDetail() {
  const { id } = useParams<{ id: string }>()
  const [chatOpen, setChatOpen] = useState(false)
  const [repo, setRepo] = useState<Repository | null>(null)
  const [prs, setPrs] = useState<PullRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([api.getRepo(id), api.getPullRequests(id)]).then(([storedRepo, storedPrs]) => { setRepo(storedRepo); setPrs(storedPrs) }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load repository')).finally(() => setLoading(false))
  }, [id])

  const riskColor = (risk: string | null) => risk === 'high' ? 'bg-red-900/20 text-red-400 border-red-800' : risk === 'medium' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-800' : 'bg-green-900/20 text-green-400 border-green-800'
  const riskIcon = (risk: string | null) => risk === 'high' ? <AlertTriangle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />

  return <div className="min-h-screen bg-background">
    <nav className="border-b border-border bg-background sticky top-0 z-40"><div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity"><ArrowLeft className="w-5 h-5 text-muted" /><div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center"><span className="text-primary-foreground font-bold text-lg">R</span></div><span className="text-foreground font-bold text-lg tracking-wider">REPOLENS</span></Link>
      {repo && <div className="flex items-center gap-4"><div className="flex items-center gap-3"><span className="text-foreground font-medium">{repo.full_name}</span><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${repo.private ? 'bg-red-900/20 text-red-400 border-red-800' : 'bg-green-900/20 text-green-400 border-green-800'}`}>{repo.private ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}{repo.private ? 'Private' : 'Public'}</span></div><button onClick={() => setChatOpen(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity flex items-center gap-2 text-sm"><MessageSquare className="w-4 h-4" />Ask AI about this repo</button></div>}
    </div></nav>
    <main className="max-w-6xl mx-auto px-6 py-8">{loading ? <p className="text-muted">Loading analysis…</p> : error ? <p className="text-red-400">{error}</p> : <div className="space-y-4">{prs.map((pr) => <article key={pr.id} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all hover:shadow-lg hover:-translate-y-0.5"><div className="flex items-start justify-between mb-3"><div className="flex-1"><h3 className="text-lg font-medium text-foreground mb-1">{pr.title}</h3><p className="text-sm text-muted">PR #{pr.pr_number} {pr.author && <>by <span className="text-foreground">@{pr.author}</span></>}</p></div><span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ml-4 ${riskColor(pr.risk_level)}`}>{riskIcon(pr.risk_level)}{(pr.risk_level ?? 'low').replace(/^\w/, (letter) => letter.toUpperCase())} Risk</span></div><p className="text-foreground text-sm leading-relaxed mb-4">{pr.summary ?? 'No analysis was returned for this pull request.'}</p>{pr.key_changes && <div className="mb-4"><ul className="space-y-1">{pr.key_changes.map((change) => <li key={change} className="text-sm text-muted flex items-start gap-2"><span className="text-primary mt-1">•</span><span>{change}</span></li>)}</ul></div>}<div className="flex flex-wrap gap-2">{flagLabels(pr.risk_flags).map((flag) => <span key={flag} className="px-2.5 py-1 bg-border text-muted text-xs rounded-full border border-border/50">{flag}</span>)}</div></article>)}{prs.length === 0 && <div className="text-center py-16 text-muted"><p className="text-lg">No open pull requests in this repo.</p></div>}</div>}</main>
    {repo && <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} repoId={id} repoName={repo.full_name} />}
  </div>
}

export default function RepoDetailPage() { return <AuthGuard><RepoDetail /></AuthGuard> }
