'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, Info, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useEffect } from 'react'
import { BottomNav, AdminBottomNav, SellerBottomNav } from '@/components/ecommerce/shared'
import { ErrorBoundary } from '@/components/error-boundary'
import { ELEVATED_ROLES, type UserRole } from '@/lib/types'
import { LazyScreenRenderer, AUTH_SCREENS, SELLER_SCREENS, ADMIN_SCREENS, SUB_SCREENS } from '@/components/ecommerce/screen-registry'

// ==================== GLOBAL TOAST ====================
function GlobalToast() {
  const toast = useAppStore((s) => s.toast)
  const hideToast = useAppStore((s) => s.hideToast)

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[400px] w-[90%]"
        >
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' :
            toast.type === 'error' ? 'bg-red-600 text-white border-red-500' :
            toast.type === 'warning' ? 'bg-amber-500 text-white border-amber-400' :
            'bg-card text-foreground border-border'
          }`}>
            {toast.type === 'success' && <Check className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <X className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button onClick={hideToast} className="ml-2 opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ScreenRenderer() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const currentUser = useAppStore((s) => s.currentUser)
  const originalRole = useAppStore((s) => s.originalRole)
  const navigate = useAppStore((s) => s.navigate)

  // Security: If currentScreen is an admin screen but user is not actually an admin/manager, redirect to home
  // Use originalRole (DB role) instead of currentUser.role which may be overwritten by switchRole
  const isAdminScreen = (ADMIN_SCREENS as readonly string[]).includes(currentScreen)
  const isActualAdmin = ELEVATED_ROLES.includes((originalRole || currentUser?.role || '') as UserRole)

  // Redirect non-admin users away from admin screens
  // SECURITY: Use useEffect to avoid calling navigate during render
  useEffect(() => {
    if (isAdminScreen && !isActualAdmin) {
      navigate('home')
    }
  }, [isAdminScreen, isActualAdmin, navigate])

  // If user is on an admin screen but isn't admin, show nothing while redirecting
  if (isAdminScreen && !isActualAdmin) {
    return null
  }

  const screenVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentScreen}
        variants={screenVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex-1 overflow-y-auto no-scrollbar"
      >
        <LazyScreenRenderer screen={currentScreen} navigate={navigate} />
      </motion.div>
    </AnimatePresence>
  )
}

export default function Home() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const navigate = useAppStore((s) => s.navigate)
  const isOverlayOpen = useAppStore((s) => s.isOverlayOpen)
  const isAuthScreen = (AUTH_SCREENS as readonly string[]).includes(currentScreen)
  const isSellerScreen = (SELLER_SCREENS as readonly string[]).includes(currentScreen)
  const isAdminScreen = (ADMIN_SCREENS as readonly string[]).includes(currentScreen)
  const isSubScreen = (SUB_SCREENS as readonly string[]).includes(currentScreen)

  // Detect password reset token in URL on mount
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  useEffect(() => {
    if (typeof window === 'undefined') return
    // SECURITY: Read reset token from hash fragment (#) instead of query parameter (?)
    // Hash fragments are NOT sent to the server, preventing token leakage in logs/referrers
    let resetToken: string | null = null
    const hash = window.location.hash
    if (hash && hash.startsWith('#reset-token=')) {
      resetToken = hash.substring('#reset-token='.length)
    }
    // Fallback: also check query param for backward compatibility with old email links
    if (!resetToken) {
      const params = new URLSearchParams(window.location.search)
      resetToken = params.get('reset-token')
    }
    if (resetToken) {
      // Clean URL immediately to prevent token from being bookmarked/shared
      window.history.replaceState({}, '', window.location.pathname)

      // Check if user is already authenticated — check Zustand state and session cookie
      const hasAuthToken = typeof document !== 'undefined' && document.cookie.split(';').some(c => c.trim().startsWith('martup_auth='))
      if (isAuthenticated || hasAuthToken) {
        return
      }

      // Store the token in both Zustand (for current session) and sessionStorage (survives refresh)
      useAppStore.setState({ resetPasswordToken: resetToken })
      try { sessionStorage.setItem('martup_reset_token', resetToken) } catch { /* ignore */ }
      navigate('reset-password')
    }
  }, [navigate, isAuthenticated])

  const getBottomNav = () => {
    if (isAuthScreen || isSubScreen || isOverlayOpen) return null
    if (isAdminScreen) return <AdminBottomNav />
    if (isSellerScreen) return <SellerBottomNav />
    return <BottomNav />
  }

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="app-container flex flex-col min-h-screen w-full">
        <GlobalToast />
        <ErrorBoundary>
          <ScreenRenderer />
        </ErrorBoundary>
        {getBottomNav()}
      </div>
    </div>
  )
}
