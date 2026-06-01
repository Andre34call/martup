import type { StateCreator } from 'zustand'
import type { NavigationSlice, AppStore } from './types'

export const createNavigationSlice: StateCreator<AppStore, [], [], NavigationSlice> = (set) => ({
  currentScreen: 'splash',
  previousScreens: [],
  otpPhoneNumber: '',
  pendingVerificationEmail: '',
  resetPasswordToken: '',
  navigate: (screen) => set((state) => ({
    currentScreen: screen,
    previousScreens: [...state.previousScreens, state.currentScreen],
    // Reset overlay state on navigation — prevents bottom nav from being
    // permanently hidden if the previous screen set isOverlayOpen=true
    // and didn't clean up (e.g., stream comment sheet, report dialog)
    isOverlayOpen: false,
  })),
  goBack: () => set((state) => {
    const prev = [...state.previousScreens]
    const lastScreen = prev.pop() || 'home'
    return { currentScreen: lastScreen, previousScreens: prev, isOverlayOpen: false }
  }),
})
