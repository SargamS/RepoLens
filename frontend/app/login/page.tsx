'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, ArrowRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)

  // If the user already has a valid session (e.g. they hit "back" after
  // logging in), skip the login screen entirely.
  useEffect(() => {
    let cancelled = false
    api
      .getMe()
      .then(() => {
        if (!cancelled) router.replace('/dashboard')
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const handleGithubLogin = () => {
    // Full-page navigation — this hits the backend, which redirects to
    // GitHub's OAuth consent screen and eventually back to /api/auth/callback.
    window.location.href = api.loginUrl()
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* LEFT PANEL - IMAGE/GRADIENT */}
      <div className="hidden md:flex md:w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-black relative overflow-hidden">
        {/* Decorative code-like pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="font-mono text-xs text-green-500 p-8 space-y-1">
            <div>{'<'} code repository{' />'}</div>
            <div>{'<'} analyze pull_requests{' />'}</div>
            <div>{'<'} ai insights{' />'}</div>
            <div>{'</>'}</div>
          </div>
        </div>

        {/* Logo */}
        <div className="p-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">R</span>
            </div>
            <span className="text-primary font-bold text-lg tracking-wider">REPOLENS</span>
          </div>
        </div>

        {/* Bottom text with gradient overlay */}
        <div className="p-8 relative z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
          <div className="relative z-20">
            <p className="text-muted text-xs uppercase tracking-widest mb-4">Repository Access</p>
            <h1 className="text-4xl font-light text-foreground leading-tight">
              Understand any codebase. Instantly.
            </h1>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - LOGIN FORM */}
      <div className="w-full md:w-1/2 bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-12">
            <p className="text-muted text-xs uppercase tracking-widest mb-4">Login · GitHub OAuth</p>
            <h2 className="text-4xl font-light text-foreground mb-3">Welcome back.</h2>
            <p className="text-muted">Sign in with your GitHub account to continue.</p>
          </div>

          {/* OAuth Button */}
          <button
            onClick={handleGithubLogin}
            disabled={checkingSession}
            className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg font-medium flex items-center justify-between hover:scale-105 transition-transform duration-200 group mb-4 disabled:opacity-60 disabled:hover:scale-100"
          >
            {checkingSession ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              <>
                <GitBranch className="w-5 h-5" />
                <span>Continue with GitHub</span>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </>
            )}
          </button>

          {/* Info text */}
          <p className="text-muted text-xs text-center mb-8">
            We request repo and read:user access so RepoLens can analyze your pull requests on your behalf.
          </p>

          {/* Info card */}
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted text-xs uppercase tracking-widest mb-2">Public &amp; private repos</p>
            <p className="text-foreground text-sm leading-relaxed">
              Once signed in, you can analyze any public GitHub repo or one of your own — RepoLens uses your
              GitHub token to fetch PRs and analyzes them with Claude.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
