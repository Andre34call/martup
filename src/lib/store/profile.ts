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

      // For FormData uploads, we need auth + CSRF but NOT Content-Type
      // (browser sets Content-Type automatically with boundary for multipart/form-data)
      const uploadHeaders = getAuthHeaders(true)
      delete uploadHeaders['Content-Type']
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
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
      if (process.env.NODE_ENV === 'development') console.error('uploadAvatar error:', error)
      throw error
    }
  },
  removeAvatar: async () => {
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'DELETE',
        headers: getAuthHeaders(true),
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
      if (process.env.NODE_ENV === 'development') console.error('removeAvatar error:', error)
      throw error
    }
  },
})
