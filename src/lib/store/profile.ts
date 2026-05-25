import type { StateCreator } from 'zustand'
import type { ProfileSlice, AppStore } from './types'
import { getAuthHeaders } from './getAuthHeaders'

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

      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser sets it automatically with boundary
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to upload avatar')
      }
      const data = await res.json()
      const avatarUrl: string = data.data?.avatar ?? data.data
      set((state) => ({
        avatarUrl,
        currentUser: state.currentUser
          ? { ...state.currentUser, avatar: avatarUrl }
          : null,
      }))
    } catch (error) {
      console.error('uploadAvatar error:', error)
      throw error
    }
  },
  removeAvatar: async () => {
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to remove avatar')
      }
      set((state) => ({
        avatarUrl: null,
        currentUser: state.currentUser
          ? { ...state.currentUser, avatar: undefined }
          : null,
      }))
    } catch (error) {
      console.error('removeAvatar error:', error)
      throw error
    }
  },
})
