import type { StateCreator } from 'zustand'
import type { NavigationSlice, AppStore } from './types'

export const createNavigationSlice: StateCreator<AppStore, [], [], NavigationSlice> = (set) => ({
  currentScreen: 'splash',
  previousScreens: [],
  otpPhoneNumber: '',
  pendingVerificationEmail: '',
  resetPasswordToken: '',
  navigate: (screen) => set((state) => {
    // No-op when navigating to the same screen — redundant transitions
    // (same key change) can wedge AnimatePresence-based animations.
    if (state.currentScreen === screen) return state
    return {
      currentScreen: screen,
      previousScreens: [...state.previousScreens, state.currentScreen],
    }
  }),
  goBack: () => set((state) => {
    const prev = [...state.previousScreens]
    const lastScreen = prev.pop() || 'home'
    return { currentScreen: lastScreen, previousScreens: prev }
  }),
})
