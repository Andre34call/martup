'use client'

import { useEffect, useRef } from 'react'
import { useAppStore, useCartStore, useWishlistStore } from '@/lib/store'
import { logger } from '@/lib/logger'

/**
 * useDataSync - Watches auth state from useAppStore and localStorage and syncs
 * data from API when a user is authenticated.
 *
 * Auth detection:
 * - useAppStore.isAuthenticated (set by login() or DataFetcher for NextAuth/OAuth)
 * - localStorage auth tokens (for page refresh recovery before Zustand hydrates)
 *
 * On authentication: fetches user data, merges local cart to server, syncs wishlist.
 * Note: mergeLocalToServer internally calls syncFromServer, so we don't need a separate call.
 * On logout: resets the isDataLoaded flag so data will be re-fetched on next login.
 */
export function useDataSync() {
  // ── Auth state from main store ──────────────────────────────────────
  const appStoreIsAuthenticated = useAppStore((s) => s.isAuthenticated)
  const appStoreUserId = useAppStore((s) => s.currentUser?.id ?? null)
  const isDataLoaded = useAppStore((s) => s.isDataLoaded)

  // ── Sync actions ─────────────────────────────────────────────────────
  const fetchUserData = useAppStore((s) => s.fetchUserData)
  const fetchSettings = useAppStore((s) => s.fetchSettings)
  const cartMergeLocalToServer = useCartStore((s) => s.mergeLocalToServer)
  const wishlistSyncFromServer = useWishlistStore.getState().syncWishlistFromServer

  // ── Guards ───────────────────────────────────────────────────────────
  const syncingRef = useRef(false)
  // Track the last userId we synced for, so we don't re-sync the same user
  const lastSyncedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Determine effective auth from useAppStore + localStorage fallback
    // This handles the case where Zustand hasn't hydrated yet but the user
    // has a valid auth token in localStorage (from a previous session)
    const hasLocalAuthToken = !!localStorage.getItem('authToken')
    const effectiveUserId = appStoreUserId
    const effectiveIsAuthenticated = appStoreIsAuthenticated || (hasLocalAuthToken && !!appStoreUserId)

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
          useWishlistStore.getState().syncWishlistFromServer(effectiveUserId),
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

    // ── Reset on full logout ────────────────────────────────────────
    if (!appStoreIsAuthenticated && !hasLocalAuthToken) {
      if (isDataLoaded || lastSyncedUserIdRef.current) {
        useAppStore.setState({ isDataLoaded: false })
        lastSyncedUserIdRef.current = null
      }
    }
  }, [
    appStoreIsAuthenticated,
    appStoreUserId,
    isDataLoaded,
    fetchUserData,
    fetchSettings,
    cartMergeLocalToServer,
  ])
}
