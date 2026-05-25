"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useAppStore, useCartStore, useWishlistStore } from "@/lib/store"

function ZustandHydration({ children }: { children: React.ReactNode }) {
  const hydrated = useRef(false)

  useEffect(() => {
    // Rehydrate all persisted stores on the client
    useAppStore.persist.rehydrate()
    useCartStore.persist.rehydrate()
    useWishlistStore.persist.rehydrate()
    hydrated.current = true
  }, [])

  return <>{children}</>
}

function DataFetcher({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { fetchUserData, fetchProducts, fetchCategories, isAuthenticated, login } = useAppStore()
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
            console.log('[Storage] Bucket ready:', data.message)
          } else {
            console.warn('[Storage] Setup failed:', data.error)
          }
        })
        .catch(err => console.warn('[Storage] Setup error:', err))
    }
  }, [fetchProducts, fetchCategories])

  // Handle auth session - Google OAuth
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !isAuthenticated) {
      // Fetch user data from our DB using the NextAuth session
      // Note: sync-user is called server-side by NextAuth callback,
      // we just need to fetch the user data here
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
            // Now fetch all user-specific data
            fetchUserData(data.user.id)
          }
        })
        .catch(err => {
          console.error('Failed to fetch user data:', err)
        })
    }
  }, [status, session, fetchUserData, isAuthenticated, login])

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
          <DataFetcher>{children}</DataFetcher>
        </ZustandHydration>
      </SessionProvider>
    </QueryClientProvider>
  )
}
