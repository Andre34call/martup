'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { BottomNav, AdminBottomNav, SellerBottomNav } from '@/components/ecommerce/shared'

// Auth screens
import { SplashScreen, OnboardingScreen, LoginScreen, RegisterScreen, OTPScreen, ForgotPasswordScreen } from '@/components/ecommerce/auth-screens'

// Buyer screens
import { HomeScreen } from '@/components/ecommerce/home-screen'
import { SearchScreen } from '@/components/ecommerce/search-screen'
import { CategoryScreen } from '@/components/ecommerce/category-screen'
import { ProductDetailScreen } from '@/components/ecommerce/product-detail-screen'
import { CartScreen } from '@/components/ecommerce/cart-screen'
import { CheckoutScreen } from '@/components/ecommerce/checkout-screen'
import { OrderScreen } from '@/components/ecommerce/order-screen'
import { WalletScreen } from '@/components/ecommerce/wallet-screen'
import { ChatScreen } from '@/components/ecommerce/chat-screen'
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

const AUTH_SCREENS = ['splash', 'onboarding', 'login', 'register', 'otp', 'forgot-password']
const SELLER_SCREENS = ['seller-dashboard', 'seller-products', 'seller-add-product', 'seller-orders', 'seller-analytics', 'seller-wallet', 'seller-chat', 'seller-settings', 'seller-campaign']
const ADMIN_SCREENS = ['admin-dashboard', 'admin-users', 'admin-products', 'admin-orders', 'admin-withdraw', 'admin-banner', 'admin-analytics', 'admin-complaints']

function ScreenRenderer() {
  const currentScreen = useAppStore((s) => s.currentScreen)

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

      // Buyer
      case 'home': return <HomeScreen />
      case 'search': return <SearchScreen />
      case 'category': return <CategoryScreen />
      case 'product-detail': return <ProductDetailScreen />
      case 'cart': return <CartScreen />
      case 'checkout': return <CheckoutScreen />
      case 'orders': return <OrderScreen />
      case 'order-tracking': return <OrderScreen />
      case 'wallet': return <WalletScreen />
      case 'deposit': return <DepositScreen />
      case 'withdraw': return <WithdrawScreen />
      case 'chat': return <ChatScreen />
      case 'chat-room': return <ChatScreen />
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

      // Admin
      case 'admin-dashboard': return <AdminDashboard />
      case 'admin-users': return <AdminUsers />
      case 'admin-products': return <AdminProducts />
      case 'admin-orders': return <AdminOrdersScreen />
      case 'admin-withdraw': return <AdminWithdraw />
      case 'admin-banner': return <AdminBanner />
      case 'admin-analytics': return <AdminAnalytics />
      case 'admin-complaints': return <AdminComplaints />

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

  const getBottomNav = () => {
    if (isAuthScreen) return null
    if (isAdminScreen) return <AdminBottomNav />
    if (isSellerScreen) return <SellerBottomNav />
    return <BottomNav />
  }

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="app-container flex flex-col min-h-screen w-full">
        <ScreenRenderer />
        {getBottomNav()}
      </div>
    </div>
  )
}
