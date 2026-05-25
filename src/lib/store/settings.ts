import type { StateCreator } from 'zustand'
import type { SettingsSlice, AppStore } from './types'

export const createSettingsSlice: StateCreator<AppStore, [], [], SettingsSlice> = (set) => ({
  settings: {
    twoFactor: false,
    pushNotif: true,
    emailNotif: true,
    dataSharing: false,
  },
  updateSettings: (settings) => set((state) => ({
    settings: { ...state.settings, ...settings }
  })),
})
