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
import { apiClient } from '@/lib/api-client'

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
 * DataFetcher — handles auth session recovery and the NextAuth → useAppStore bridge.
 *
 * Three auth recovery paths:
 *  1. NextAuth session (Google OAuth) — detected via useSession()
 *  2. HMAC bearer token in localStorage (email/password) — detected on mount
 *  3. Data sync via useDataSync hook after login() is called
 */
function DataFetcher({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { fetchProducts, fetchCategories, isAuthenticated, login, connectSocket, disconnectSocket } = useAppStore()
  const initialFetchDone = useRef(false)
  const tokenRecoveryDone = useRef(false)

  // Fetch global data (products, categories) on mount & setup storage
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true
      fetchProducts()
      fetchCategories()
      // Setup Supabase Storage bucket (idempotent - safe to call multiple times)
      apiClient.rawPost('/api/setup/storage', undefined)
        .then(res => res.json())
        .then(data => {
          if (data.success) {

          } else {

          }
        })
        .catch(() => {/* dev-only */})
    }
  }, [fetchProducts, fetchCategories])

  // ── Auth Recovery Path 1: HMAC bearer token from localStorage ─────
  // This handles the case where the user logged in via email/password,
  // then refreshed the page. Zustand doesn't persist auth state, but
  // the authToken is still in localStorage. We use it to restore the session.
  useEffect(() => {
    if (tokenRecoveryDone.current) return

    // Only attempt recovery if not already authenticated
    if (isAuthenticated) {
      tokenRecoveryDone.current = true
      return
    }

    // Check if there's an auth token in localStorage
    if (typeof window === 'undefined') return
    const authToken = localStorage.getItem('authToken')
    if (!authToken) {
      tokenRecoveryDone.current = true
      return
    }

    // Attempt to restore session by calling /api/auth/me
    // apiClient automatically adds the Authorization header from localStorage
    tokenRecoveryDone.current = true

    ;(async () => {
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
          })
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
        } else {
          // Token is invalid or expired — clear it
          localStorage.removeItem('authToken')
        }
      } catch (err) {
        logger.warn({ component: 'providers', err: err }, 'Failed to restore session from authToken')
        // Don't clear the token — it might be a temporary network error
        // The user can try again on next page load
      }
    })()
  }, [isAuthenticated, login, connectSocket])

  // ── Auth Recovery Path 2: NextAuth session (Google OAuth) ──────────
  // Only calls login() to set useAppStore auth state; data sync is handled by useDataSync
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !isAuthenticated) {
      ;(async () => {
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
            })
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
          }
        } catch (err) {
          logger.warn({ component: 'providers', err: err }, 'Failed to fetch user data via NextAuth')
        }
      })()
    }
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
