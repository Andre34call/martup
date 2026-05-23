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
  const { fetchUserData, fetchProducts, fetchCategories, isDataLoaded, isAuthenticated, login } = useAppStore()
  const initialFetchDone = useRef(false)

  // Fetch global data (products, categories) on mount
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true
      fetchProducts()
      fetchCategories()
    }
  }, [fetchProducts, fetchCategories])

  // Handle auth session
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userId = (session.user as any).id
      if (userId && !isDataLoaded) {
        // Sync user with our DB and fetch user data
        fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session.user.email,
            name: session.user.name,
            avatar: session.user.image,
            provider: 'google',
          }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.user) {
              login({
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
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
            console.error('Failed to sync user:', err)
          })
      }
    }
  }, [status, session, fetchUserData, isDataLoaded, login])

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
