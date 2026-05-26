'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useAppStore, useCartStore, useWishlistStore } from '@/lib/store'
import { logger } from '@/lib/logger'

/**
 * useDataSync - Watches auth state and syncs data from API when user logs in.
 *
 * On login: fetches user data, merges local cart to server, syncs wishlist from server.
 * Note: mergeLocalToServer internally calls syncFromServer, so we don't need a separate call.
 * On logout: resets the isDataLoaded flag so data will be re-fetched on next login.
 */
export function useDataSync() {
  const userId = useAuthStore((s) => s.userId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isDataLoaded = useAppStore((s) => s.isDataLoaded)

  const fetchUserData = useAppStore((s) => s.fetchUserData)
  const cartMergeLocalToServer = useCartStore((s) => s.mergeLocalToServer)
  const wishlistSyncFromServer = useWishlistStore((s) => s.syncWishlistFromServer)

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
          cartMergeLocalToServer(userId), // mergeLocalToServer internally calls syncFromServer
          wishlistSyncFromServer(userId),  // Sync wishlist from server
        ]).catch((err) => {
          logger.warn({ component: 'data-sync', err }, 'Failed to sync data from API')
        }).finally(() => {
          syncingRef.current = false
        })
      }
    }

    // User logged out - reset data loaded flag so next login re-fetches
    if (wasAuthenticated && !isAuthenticated) {
      useAppStore.setState({ isDataLoaded: false })
    }
  }, [isAuthenticated, userId, isDataLoaded, fetchUserData, cartMergeLocalToServer, wishlistSyncFromServer])
}
