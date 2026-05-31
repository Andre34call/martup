import type { StateCreator } from 'zustand'
import type { SettingsSlice, AppStore } from './types'
import type { UserSettingsResponse } from '../api-types'
import { apiClient } from '@/lib/api-client'
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
      const json = await apiClient.get<UserSettingsResponse>('/api/user/settings')
      const rawData = json.data || json
      const data = rawData as Record<string, unknown>
      set({
        settings: {
          twoFactor: (data.twoFactor as boolean) ?? false,
          pushNotif: (data.pushNotif as boolean) ?? true,
          emailNotif: (data.emailNotif as boolean) ?? true,
          dataSharing: (data.dataSharing as boolean) ?? false,
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

    apiClient.put('/api/user/settings', merged).catch((error) => {
      logger.warn({ component: 'settings', err: error }, 'Failed to persist user settings to server')
      // Revert on failure by re-applying previous state
      set((state) => ({
        settings: { ...state.settings, ...currentState }
      }))
    })
  },
})
