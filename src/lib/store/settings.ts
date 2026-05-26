import type { StateCreator } from 'zustand'
import type { SettingsSlice, AppStore } from './types'
import { getAuthHeaders } from './getAuthHeaders'
import { logger } from '@/lib/logger'

export const createSettingsSlice: StateCreator<AppStore, [], [], SettingsSlice> = (set, get) => ({
  settings: {
    twoFactor: false,
    pushNotif: true,
    emailNotif: true,
    dataSharing: false,
  },
  isSettingsLoaded: false,

  fetchSettings: async () => {
    try {
      const res = await fetch('/api/user/settings', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch user settings')
      const json = await res.json()
      const data = json.data || json
      set({
        settings: {
          twoFactor: data.twoFactor ?? false,
          pushNotif: data.pushNotif ?? true,
          emailNotif: data.emailNotif ?? true,
          dataSharing: data.dataSharing ?? false,
        },
        isSettingsLoaded: true,
      })
    } catch (error) {
      logger.warn({ component: 'settings', err: error }, 'Failed to fetch user settings from server')
    }
  },

  updateSettings: (settings) => {
    // Optimistic local update
    set((state) => ({
      settings: { ...state.settings, ...settings }
    }))

    // Async server persist
    const currentState = get().settings
    const merged = { ...currentState, ...settings }

    fetch('/api/user/settings', {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify(merged),
    }).catch((error) => {
      logger.warn({ component: 'settings', err: error }, 'Failed to persist user settings to server')
      // Revert on failure by re-applying previous state
      set((state) => ({
        settings: { ...state.settings, ...currentState }
      }))
    })
  },
})
