"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, useRef } from "react"
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
      <ZustandHydration>{children}</ZustandHydration>
    </QueryClientProvider>
  )
}
