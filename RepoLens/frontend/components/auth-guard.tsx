'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError, type User } from '@/lib/api'

export function useAuthenticatedUser() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.me().then(setUser).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) router.replace('/login')
    }).finally(() => setLoading(false))
  }, [router])

  return { user, loading }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthenticatedUser()
  if (loading || !user) return <main className="min-h-screen bg-background" />
  return <>{children}</>
}
