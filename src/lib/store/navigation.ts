import type { StateCreator } from 'zustand'
import type { NavigationSlice, AppStore } from './types'

export const createNavigationSlice: StateCreator<AppStore, [], [], NavigationSlice> = (set) => ({
  currentScreen: 'splash',
  previousScreens: [],
  navigate: (screen) => set((state) => ({
    currentScreen: screen,
    previousScreens: [...state.previousScreens, state.currentScreen]
  })),
  goBack: () => set((state) => {
    const prev = [...state.previousScreens]
    const lastScreen = prev.pop() || 'home'
    return { currentScreen: lastScreen, previousScreens: prev }
  }),
})
