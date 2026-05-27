'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, Info, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { BottomNav, AdminBottomNav, SellerBottomNav } from '@/components/ecommerce/shared'
import { ErrorBoundary } from '@/components/error-boundary'

// Auth screens
import { SplashScreen, OnboardingScreen, LoginScreen, RegisterScreen, OTPScreen, ForgotPasswordScreen, EmailVerificationScreen } from '@/components/ecommerce/auth-screens'

// Buyer screens
import { HomeScreen } from '@/components/ecommerce/home-screen'
import { SearchScreen } from '@/components/ecommerce/search-screen'
import { CategoryScreen, CategoryDetailScreen } from '@/components/ecommerce/category-screen'
import { ProductDetailScreen } from '@/components/ecommerce/product-detail-screen'
import { CartScreen } from '@/components/ecommerce/cart-screen'
import { CheckoutScreen } from '@/components/ecommerce/checkout-screen'
import { OrderScreen } from '@/components/ecommerce/order-screen'
import { WalletScreen } from '@/components/ecommerce/wallet-screen'
import { ChatScreen, ChatRoomScreen } from '@/components/ecommerce/chat-screen'
import { NotificationScreen } from '@/components/ecommerce/notification-screen'
import { ProfileScreen } from '@/components/ecommerce/profile-screen'
import { WishlistScreen } from '@/components/ecommerce/wishlist-screen'

// Missing buyer screens
import { SettingsScreen, VoucherScreen, AddressScreen, ReviewScreen, RefundScreen, HelpScreen, FollowedStoresScreen, DepositScreen, WithdrawScreen } from '@/components/ecommerce/missing-screens'
import { SellerShopScreen } from '@/components/ecommerce/seller-shop-screen'
import { SellerAddProductScreen } from '@/components/ecommerce/seller-add-product-screen'

// Seller screens
import {
  SellerDashboard,
  SellerProducts,
  SellerOrders,
  SellerAnalytics,
  SellerWallet,
  SellerChat,
  SellerSettings,
  SellerCampaign,
} from '@/components/ecommerce/seller-screens'
import { SellerWithdrawScreen, SellerWithdrawHistoryScreen } from '@/components/ecommerce/seller-withdraw-screens'

// Admin screens
import {
  AdminDashboard,
  AdminUsers,
  AdminProducts,
  AdminWithdraw,
  AdminBanner,
  AdminAnalytics,
  AdminComplaints,
} from '@/components/ecommerce/admin-screens'
import { AdminOrdersScreen } from '@/components/ecommerce/admin-orders-screen'
import { AdminDivisions } from '@/components/ecommerce/admin-divisions-screen'
import { AdminCategories, AdminVouchers, AdminDeposits, AdminCampaigns, AdminSettings } from '@/components/ecommerce/admin-new-screens'

// Legal screens
import { PrivacyPolicyScreen, TermsOfServiceScreen, RefundPolicyScreen } from '@/components/ecommerce/legal/legal-screens'

const AUTH_SCREENS = ['splash', 'onboarding', 'login', 'register', 'otp', 'forgot-password']
const SELLER_SCREENS = ['seller-dashboard', 'seller-products', 'seller-add-product', 'seller-orders', 'seller-analytics', 'seller-wallet', 'seller-chat', 'seller-settings', 'seller-campaign', 'seller-withdraw', 'seller-withdraw-history']
const ADMIN_SCREENS = ['admin-dashboard', 'admin-users', 'admin-products', 'admin-orders', 'admin-withdraw', 'admin-banner', 'admin-analytics', 'admin-complaints', 'admin-divisions', 'admin-categories', 'admin-vouchers', 'admin-deposits', 'admin-campaigns', 'admin-settings']

// Sub-screens that should hide the bottom nav (they have their own back navigation headers)
const SUB_SCREENS = [
  'product-detail', 'seller-shop', 'checkout', 'review', 'refund',
  'address', 'help', 'followed-stores', 'deposit', 'withdraw',
  'settings', 'voucher', 'order-tracking', 'seller-add-product',
  'chat-room', 'category-detail', 'seller-withdraw', 'seller-withdraw-history',
  'privacy-policy', 'terms-of-service', 'refund-policy',
]

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
  const navigate = useAppStore((s) => s.navigate)

  // Security: If currentScreen is an admin screen but user is not actually an admin, redirect to home
  // Use useEffect to avoid calling navigate during render
  const isAdminScreen = ADMIN_SCREENS.includes(currentScreen)
  const isActualAdmin = currentUser?.role === 'admin'

  // Redirect non-admin users away from admin screens
  if (isAdminScreen && !isActualAdmin) {
    // Use a key change to trigger re-render with home screen
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="home-redirect"
          variants={{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto no-scrollbar"
        >
          <HomeScreen />
        </motion.div>
      </AnimatePresence>
    )
  }

  const screenVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  }

  const renderScreen = () => {
    switch (currentScreen) {
      // Auth
      case 'splash': return <SplashScreen />
      case 'onboarding': return <OnboardingScreen />
      case 'login': return <LoginScreen />
      case 'register': return <RegisterScreen />
      case 'otp': return <OTPScreen />
      case 'forgot-password': return <ForgotPasswordScreen />
      case 'email-verification': return <EmailVerificationScreen />

      // Buyer
      case 'home': return <HomeScreen />
      case 'search': return <SearchScreen />
      case 'category': return <CategoryScreen />
      case 'category-detail': return <CategoryDetailScreen />
      case 'product-detail': return <ProductDetailScreen />
      case 'cart': return <CartScreen />
      case 'checkout': return <CheckoutScreen />
      case 'orders': return <OrderScreen />
      case 'order-tracking': return <OrderScreen />
      case 'wallet': return <WalletScreen />
      case 'deposit': return <DepositScreen />
      case 'withdraw': return <WithdrawScreen />
      case 'chat': return <ChatScreen />
      case 'chat-room': return <ChatRoomScreen />
      case 'notification': return <NotificationScreen />
      case 'profile': return <ProfileScreen />
      case 'settings': return <SettingsScreen />
      case 'voucher': return <VoucherScreen />
      case 'review': return <ReviewScreen />
      case 'refund': return <RefundScreen />
      case 'help': return <HelpScreen />
      case 'address': return <AddressScreen />
      case 'followed-stores': return <FollowedStoresScreen />
      case 'seller-shop': return <SellerShopScreen />
      case 'wishlist': return <WishlistScreen />

      // Legal
      case 'privacy-policy': return <PrivacyPolicyScreen onBack={() => navigate('settings')} />
      case 'terms-of-service': return <TermsOfServiceScreen onBack={() => navigate('settings')} />
      case 'refund-policy': return <RefundPolicyScreen onBack={() => navigate('settings')} />

      // Seller
      case 'seller-dashboard': return <SellerDashboard />
      case 'seller-products': return <SellerProducts />
      case 'seller-add-product': return <SellerAddProductScreen />
      case 'seller-orders': return <SellerOrders />
      case 'seller-analytics': return <SellerAnalytics />
      case 'seller-wallet': return <SellerWallet />
      case 'seller-chat': return <SellerChat />
      case 'seller-settings': return <SellerSettings />
      case 'seller-campaign': return <SellerCampaign />
      case 'seller-withdraw': return <SellerWithdrawScreen />
      case 'seller-withdraw-history': return <SellerWithdrawHistoryScreen />

      // Admin
      case 'admin-dashboard': return <AdminDashboard />
      case 'admin-users': return <AdminUsers />
      case 'admin-products': return <AdminProducts />
      case 'admin-orders': return <AdminOrdersScreen />
      case 'admin-withdraw': return <AdminWithdraw />
      case 'admin-banner': return <AdminBanner />
      case 'admin-analytics': return <AdminAnalytics />
      case 'admin-complaints': return <AdminComplaints />
      case 'admin-divisions': return <AdminDivisions />
      case 'admin-categories': return <AdminCategories />
      case 'admin-vouchers': return <AdminVouchers />
      case 'admin-deposits': return <AdminDeposits />
      case 'admin-campaigns': return <AdminCampaigns />
      case 'admin-settings': return <AdminSettings />

      default: return <HomeScreen />
    }
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
        {renderScreen()}
      </motion.div>
    </AnimatePresence>
  )
}

export default function Home() {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const isAuthScreen = AUTH_SCREENS.includes(currentScreen)
  const isSellerScreen = SELLER_SCREENS.includes(currentScreen)
  const isAdminScreen = ADMIN_SCREENS.includes(currentScreen)
  const isSubScreen = SUB_SCREENS.includes(currentScreen)

  const getBottomNav = () => {
    if (isAuthScreen || isSubScreen) return null
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
