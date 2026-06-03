import type { StateCreator } from 'zustand'
import type { UISlice, AppStore } from './types'

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  isLoading: false,
  showSplash: true,
  overlayOpen: false,
  setShowSplash: (v) => set({ showSplash: v }),
  setOverlayOpen: (open) => set({ overlayOpen: open }),
  toast: null,
  showToast: (message, type = 'success') => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: { message, type } })
    toastTimer = setTimeout(() => set({ toast: null }), 2500)
  },
  hideToast: () => set({ toast: null }),
})
