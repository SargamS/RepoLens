'use client'

import { GitBranch, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const login = () => { window.location.assign(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/auth/login`) }
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
          <button onClick={login} className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg font-medium flex items-center justify-between hover:scale-105 transition-transform duration-200 group mb-4">
            <GitBranch className="w-5 h-5" />
            <span>Continue with GitHub</span>
            <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Info text */}
          <p className="text-muted text-xs text-center mb-8">
            We only request read access to your repositories.
          </p>

        </div>
      </div>
    </div>
  )
}
