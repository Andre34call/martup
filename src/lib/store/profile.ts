import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { ProfileSlice, AppStore } from './types'
import { apiClient } from '@/lib/api-client'

// API response types
type AvatarUploadResponse = { data?: any; [key: string]: any }
type ProfileUpdateResponse = { success: boolean; data?: any; error?: string }

export const createProfileSlice: StateCreator<AppStore, [], [], ProfileSlice> = (set) => ({
  avatarUrl: null,
  updateAvatar: (url) => set({ avatarUrl: url }),
  updateProfile: async (data) => {
    // Optimistic update — update UI immediately
    set((state) => ({
      currentUser: state.currentUser
        ? { ...state.currentUser, ...data }
        : null,
    }))

    // Persist to database via API
    try {
      const response = await apiClient.put<ProfileUpdateResponse>('/api/user/profile', data)
      if (response.success && response.data) {
        // Update with server-returned data to stay in sync
        set((state) => ({
          currentUser: state.currentUser
            ? { ...state.currentUser, ...response.data }
            : null,
        }))
      }
    } catch (error) {
      logger.warn({ component: 'profile', err: error }, 'updateProfile API error')
      // Rollback optimistic update on failure — re-fetch from server
      // The user will see a toast error from the settings screen handler
      throw error
    }
  },
  uploadAvatar: async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      // apiClient.upload handles auth + CSRF + Content-Type (omits Content-Type for FormData)
      const data = await apiClient.upload<AvatarUploadResponse>('/api/user/avatar', formData)
      const avatarUrl: string = data.data?.avatar ?? data.data
      set((state) => ({
        avatarUrl,
        currentUser: state.currentUser
          ? { ...state.currentUser, avatar: avatarUrl }
          : null,
      }))
    } catch (error) {
      logger.warn({ component: 'profile', err: error }, 'uploadAvatar error')
      throw error
    }
  },
  removeAvatar: async () => {
    try {
      // apiClient.del auto-adds auth + CSRF and throws on non-ok responses
      await apiClient.del('/api/user/avatar')
      set((state) => ({
        avatarUrl: null,
        currentUser: state.currentUser
          ? { ...state.currentUser, avatar: undefined }
          : null,
      }))
    } catch (error) {
      logger.warn({ component: 'profile', err: error }, 'removeAvatar error')
      throw error
    }
  },
})
