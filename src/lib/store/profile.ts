import type { StateCreator } from 'zustand'
import type { ProfileSlice, AppStore } from './types'

export const createProfileSlice: StateCreator<AppStore, [], [], ProfileSlice> = (set) => ({
  avatarUrl: null,
  updateAvatar: (url) => set({ avatarUrl: url }),
  updateProfile: (data) => set((state) => ({
    currentUser: state.currentUser
      ? { ...state.currentUser, ...data }
      : null
  })),
})
