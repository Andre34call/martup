"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useAppStore } from "@/lib/store"
import type { UserRole } from "@/lib/types"
import { setSentryUser, clearSentryUser } from "@/lib/sentry"
import { logger } from '@/lib/logger'
import { useDataSync } from '@/lib/use-data-sync'
import { ApiProvider } from '@/hooks/api/provider'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { hasAuthFlagCookie, deleteAuthFlagCookie, setAuthFlagCookie } from '@/lib/session-cookie'

interface AuthMeResponse {
  success: boolean
  user: {
    id: string
    email: string
    name: string
    phone?: string
    avatar?: string
    role?: string
    isVerified?: boolean
    loyaltyPoints?: number
    coins?: number
    referralCode?: string
  }
  isSuperAdmin?: boolean
}

function ZustandHydration({ children }: { children: React.ReactNode }) {
  const hydrated = useRef(false)

  useEffect(() => {
    // Rehydrate all persisted stores on the client
    useAppStore.persist.rehydrate()
    hydrated.current = true
  }, [])

  return <>{children}</>
}

/**
 * Fetches user data from /api/auth/me and updates the Zustand store.
 * Returns true if successful, false otherwise.
 */
async function fetchAndLoginUser(
  login: (user: any) => void,
  connectSocket: () => void,
): Promise<boolean> {
  try {
    const data = await apiClient.get<AuthMeResponse>('/api/auth/me')
    if (data.success && data.user) {
      login({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        phone: data.user.phone || undefined,
        avatar: data.user.avatar || undefined,
        role: (data.user.role || 'buyer') as UserRole,
        isVerified: data.user.isVerified || false,
        loyaltyPoints: data.user.loyaltyPoints || 0,
        coins: data.user.coins || 0,
        referralCode: data.user.referralCode || undefined,
        isSuperAdmin: data.isSuperAdmin || false,
      })
      // Set auth flag cookie for session detection on refresh
      setAuthFlagCookie()
      // Set Sentry user context for error tracking
      setSentryUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        phone: data.user.phone || undefined,
        role: data.user.role || 'buyer',
      })
      // Connect WebSocket (data sync is handled by useDataSync)
      connectSocket()
      return true
    }
  } catch (err) {
    if (err instanceof ApiClientError) {
      logger.warn({ component: 'providers', status: err.status, message: err.message }, 'Auth/me API error')
      // 401 = not authenticated, 403 = blocked — don't retry
      if (err.status === 401 || err.status === 403) {
        deleteAuthFlagCookie()
        return false
      }
    } else {
      logger.warn({ component: 'providers', err }, 'Failed to fetch user from /api/auth/me')
    }
  }
  return false
}

/**
 * DataFetcher — handles auth session recovery and the NextAuth → useAppStore bridge.
 *
 * Three auth recovery paths:
 *  1. Session cookie (martup_auth flag) — detected on mount, calls /api/auth/me
 *  2. NextAuth session (Google OAuth) — detected via useSession(), calls /api/auth/me
 *  3. Data sync via useDataSync hook after login() is called
 *
 * Both paths 1 and 2 ultimately call /api/auth/me, which:
 *  - Sets martup_session + martup_auth cookies for NextAuth users (first call only)
 *  - Returns user data from DB
 *  - Creates user if missing (NextAuth fallback)
 */
function DataFetcher({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { fetchProducts, fetchCategories, isAuthenticated, login, connectSocket, disconnectSocket } = useAppStore()
  const initialFetchDone = useRef(false)
  const sessionRecoveryDone = useRef(false)
  const nextAuthRecoveryDone = useRef(false)

  // Fetch global data (products, categories) on mount
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true
      fetchProducts()
      fetchCategories()
    }
  }, [fetchProducts, fetchCategories])

  // ── Auth Recovery Path 1: Session cookie (sticky login) ──────────
  // This handles the case where the user logged in (email/password or OTP),
  // then refreshed the page or opened a new tab.
  // The httpOnly session cookie (martup_session) is sent automatically by the browser.
  // The auth flag cookie (martup_auth) is checked first as a quick gate.
  // Session cookies persist across refreshes and tab closes, but are CLEARED
  // when the browser is closed — providing the "sticky login" behavior.
  useEffect(() => {
    if (sessionRecoveryDone.current) return

    // Only attempt recovery if not already authenticated
    if (isAuthenticated) {
      sessionRecoveryDone.current = true
      return
    }

    if (typeof window === 'undefined') return

    // Check the auth flag cookie first — if it doesn't exist, no session cookie either
    // (both are session cookies, cleared together when browser closes)
    if (!hasAuthFlagCookie()) {
      // Also clean up any stale localStorage tokens from older sessions
      localStorage.removeItem('authToken')
      localStorage.removeItem('martup_token')
      sessionRecoveryDone.current = true
      return
    }

    // Auth flag exists → try to restore session via /api/auth/me
    // The httpOnly session cookie will be sent automatically by the browser
    sessionRecoveryDone.current = true

    ;(async () => {
      const success = await fetchAndLoginUser(login, connectSocket)
      if (!success) {
        // Session cookie is invalid or expired — clear flag and stale localStorage
        deleteAuthFlagCookie()
        localStorage.removeItem('authToken')
        localStorage.removeItem('martup_token')
      }
    })()
  }, [isAuthenticated, login, connectSocket])

  // ── Auth Recovery Path 2: NextAuth session (Google OAuth) ──────────
  // When a user logs in with Google, NextAuth sets the next-auth.session-token cookie
  // and useSession() reports status === 'authenticated'. We then call /api/auth/me
  // which creates the user in our DB (if needed) and sets martup_session + martup_auth
  // cookies for consistent session detection on subsequent page loads.
  useEffect(() => {
    if (nextAuthRecoveryDone.current) return

    // Only act when NextAuth reports authenticated AND we haven't authenticated yet
    if (status !== 'authenticated' || !session?.user || isAuthenticated) {
      // Mark as done if already authenticated (via Path 1 or login())
      if (isAuthenticated) {
        nextAuthRecoveryDone.current = true
      }
      return
    }

    nextAuthRecoveryDone.current = true

    ;(async () => {
      const success = await fetchAndLoginUser(login, connectSocket)
      if (success) {
        logger.info({ component: 'providers', email: session.user?.email }, 'NextAuth session recovered successfully')
      } else {
        logger.warn({ component: 'providers', email: session.user?.email }, 'NextAuth session detected but /api/auth/me failed')
      }
    })()
  }, [status, session, isAuthenticated, login, connectSocket])

  // Disconnect socket and clear Sentry user when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket()
      clearSentryUser()
    }
  }, [isAuthenticated, disconnectSocket])

  return <>{children}</>
}

/**
 * DataSyncWrapper — activates the useDataSync hook inside the provider tree.
 * Must be rendered inside SessionProvider so it can coordinate with DataFetcher.
 */
function DataSyncWrapper({ children }: { children: React.ReactNode }) {
  useDataSync()
  return <>{children}</>
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <SessionProvider>
          <ZustandHydration>
            <DataFetcher>
              <DataSyncWrapper>{children}</DataSyncWrapper>
            </DataFetcher>
          </ZustandHydration>
        </SessionProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
}
