import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { ProfileSlice, AppStore } from './types'
import type { AvatarUploadResponse } from '../api-types'
import { apiClient } from '@/lib/api-client'

export const createProfileSlice: StateCreator<AppStore, [], [], ProfileSlice> = (set) => ({
  avatarUrl: null,
  updateAvatar: (url) => set({ avatarUrl: url }),
  updateProfile: (data) => set((state) => ({
    currentUser: state.currentUser
      ? { ...state.currentUser, ...data }
      : null
  })),
  uploadAvatar: async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      // apiClient.upload handles auth + CSRF + Content-Type (omits Content-Type for FormData)
      const data = await apiClient.upload<AvatarUploadResponse>('/api/user/avatar', formData)
      const avatarData = data.data
      const avatarUrl: string = typeof avatarData === 'string' ? avatarData : (avatarData?.avatar ?? '')
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
