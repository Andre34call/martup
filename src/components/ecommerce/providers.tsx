"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useAppStore } from "@/lib/store"
import { setSentryUser, clearSentryUser } from "@/lib/sentry"
import { logger } from '@/lib/logger'
import { useDataSync } from '@/lib/use-data-sync'

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
 * DataFetcher — handles the NextAuth (Google OAuth) → useAppStore login bridge.
 *
 * Data syncing (fetchUserData, mergeLocalToServer, syncWishlistFromServer) is
 * handled by the useDataSync hook, so this component only needs to:
 *  1. Bridge the NextAuth session into useAppStore via login()
 *  2. Connect the WebSocket after login
 *  3. Fetch global data (products, categories) on mount
 */
function DataFetcher({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { fetchProducts, fetchCategories, isAuthenticated, login, connectSocket, disconnectSocket } = useAppStore()
  const initialFetchDone = useRef(false)

  // Fetch global data (products, categories) on mount & setup storage
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true
      fetchProducts()
      fetchCategories()
      // Setup Supabase Storage bucket (idempotent - safe to call multiple times)
      fetch('/api/setup/storage', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {

          } else {

          }
        })
        .catch(() => {/* dev-only */})
    }
  }, [fetchProducts, fetchCategories])

  // Handle auth session - Google OAuth bridge
  // Only calls login() to set useAppStore auth state; data sync is handled by useDataSync
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !isAuthenticated) {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            login({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              phone: data.user.phone || undefined,
              avatar: data.user.avatar || undefined,
              role: data.user.role || 'buyer',
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
        })
        .catch(err => {
          logger.warn({ component: 'providers', err: err }, 'Failed to fetch user data')
        })
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
      <SessionProvider>
        <ZustandHydration>
          <DataFetcher>
            <DataSyncWrapper>{children}</DataSyncWrapper>
          </DataFetcher>
        </ZustandHydration>
      </SessionProvider>
    </QueryClientProvider>
  )
}
