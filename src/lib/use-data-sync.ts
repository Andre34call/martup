'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useAppStore, useCartStore, useWishlistStore } from '@/lib/store'
import { logger } from '@/lib/logger'

/**
 * useDataSync - Watches auth state from BOTH auth stores and syncs data from API
 * when a user is authenticated.
 *
 * Works with two auth mechanisms:
 * - useAuthStore (email/password users) — persists to localStorage via martup_* keys
 * - useAppStore   (Google OAuth / NextAuth users) — isAuthenticated set by DataFetcher
 *
 * On authentication: fetches user data, merges local cart to server, syncs wishlist.
 * Note: mergeLocalToServer internally calls syncFromServer, so we don't need a separate call.
 * On logout: resets the isDataLoaded flag so data will be re-fetched on next login.
 */
export function useDataSync() {
  // ── Auth state from both stores ──────────────────────────────────────
  const authStoreUserId = useAuthStore((s) => s.userId)
  const authStoreIsAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const appStoreIsAuthenticated = useAppStore((s) => s.isAuthenticated)
  const appStoreUserId = useAppStore((s) => s.currentUser?.id ?? null)
  const isDataLoaded = useAppStore((s) => s.isDataLoaded)

  // ── Sync actions ─────────────────────────────────────────────────────
  const fetchUserData = useAppStore((s) => s.fetchUserData)
  const fetchSettings = useAppStore((s) => s.fetchSettings)
  const cartMergeLocalToServer = useCartStore((s) => s.mergeLocalToServer)
  const wishlistSyncFromServer = useWishlistStore((s) => s.syncWishlistFromServer)

  // ── Guards ───────────────────────────────────────────────────────────
  const syncingRef = useRef(false)
  // Track the last userId we synced for, so we don't re-sync the same user
  const lastSyncedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Determine effective auth from whichever store is authenticated
    const effectiveUserId = appStoreUserId || authStoreUserId
    const effectiveIsAuthenticated = appStoreIsAuthenticated || authStoreIsAuthenticated

    // ── Sync on authentication ────────────────────────────────────────
    if (effectiveIsAuthenticated && effectiveUserId) {
      // Only sync if data hasn't been loaded yet AND we're not already syncing
      // AND we haven't already synced for this particular user
      if (
        !isDataLoaded &&
        !syncingRef.current &&
        lastSyncedUserIdRef.current !== effectiveUserId
      ) {
        syncingRef.current = true
        lastSyncedUserIdRef.current = effectiveUserId

        Promise.all([
          fetchUserData(effectiveUserId),
          fetchSettings(),
          cartMergeLocalToServer(effectiveUserId), // mergeLocalToServer internally calls syncFromServer
          wishlistSyncFromServer(effectiveUserId),
        ])
          .catch((err) => {
            logger.warn({ component: 'data-sync', err }, 'Failed to sync data from API')
            // On failure, allow retry by clearing the last-synced ref
            lastSyncedUserIdRef.current = null
          })
          .finally(() => {
            syncingRef.current = false
          })
      }
    }

    // ── Reset on full logout (both stores unauthenticated) ────────────
    if (!appStoreIsAuthenticated && !authStoreIsAuthenticated) {
      if (isDataLoaded || lastSyncedUserIdRef.current) {
        useAppStore.setState({ isDataLoaded: false })
        lastSyncedUserIdRef.current = null
      }
    }
  }, [
    appStoreIsAuthenticated,
    authStoreIsAuthenticated,
    appStoreUserId,
    authStoreUserId,
    isDataLoaded,
    fetchUserData,
    fetchSettings,
    cartMergeLocalToServer,
    wishlistSyncFromServer,
  ])
}
