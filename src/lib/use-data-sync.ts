'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useAppStore, useCartStore, useWishlistStore } from '@/lib/store'

/**
 * useDataSync - Watches auth state and syncs data from API when user logs in.
 * Call this hook once in a top-level client component (e.g. the app layout or provider).
 *
 * When the user becomes authenticated (isAuthenticated + userId), it calls
 * fetchUserData on the app store and mergeLocalToServer/syncFromServer on cart/wishlist.
 * When the user logs out, it resets the isDataLoaded flag so data will be
 * re-fetched on next login.
 */
export function useDataSync() {
  const userId = useAuthStore((s) => s.userId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isDataLoaded = useAppStore((s) => s.isDataLoaded)

  // Use refs to hold stable references to store actions
  const fetchUserData = useAppStore((s) => s.fetchUserData)
  const cartMergeLocalToServer = useCartStore((s) => s.mergeLocalToServer)
  const cartSyncFromServer = useCartStore((s) => s.syncFromServer)

  const prevAuthRef = useRef(false)
  const syncingRef = useRef(false)

  useEffect(() => {
    const wasAuthenticated = prevAuthRef.current
    prevAuthRef.current = !!isAuthenticated

    // User just logged in or is already authenticated but data not yet loaded
    if (isAuthenticated && userId) {
      if ((!wasAuthenticated || !isDataLoaded) && !syncingRef.current) {
        syncingRef.current = true
        Promise.all([
          fetchUserData(userId),
          cartMergeLocalToServer(userId),
          cartSyncFromServer(userId),
        ]).catch((err) => {
          console.error('Failed to sync data from API:', err)
        }).finally(() => {
          syncingRef.current = false
        })
      }
    }

    // User logged out - reset data loaded flag so next login re-fetches
    if (wasAuthenticated && !isAuthenticated) {
      useAppStore.setState({ isDataLoaded: false })
    }
  }, [isAuthenticated, userId, isDataLoaded, fetchUserData, cartMergeLocalToServer, cartSyncFromServer])
}
