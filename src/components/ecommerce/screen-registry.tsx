'use client'

import React, { Suspense, lazy, ComponentType } from 'react'
import { Loader2 } from 'lucide-react'
import type { ScreenName } from '@/lib/types'

// ==================== LAZY-LOADED SCREEN REGISTRY ====================
// All screens are dynamically imported to enable code splitting.
// Each screen is loaded only when needed, dramatically reducing the initial bundle size.

// --- Auth Screens ---
const SplashScreen = lazy(() => import('@/components/ecommerce/auth-screens').then(m => ({ default: m.SplashScreen })))
const OnboardingScreen = lazy(() => import('@/components/ecommerce/auth-screens').then(m => ({ default: m.OnboardingScreen })))
const LoginScreen = lazy(() => import('@/components/ecommerce/auth-screens').then(m => ({ default: m.LoginScreen })))
const RegisterScreen = lazy(() => import('@/components/ecommerce/auth-screens').then(m => ({ default: m.RegisterScreen })))
const OTPScreen = lazy(() => import('@/components/ecommerce/auth-screens').then(m => ({ default: m.OTPScreen })))
const ForgotPasswordScreen = lazy(() => import('@/components/ecommerce/auth-screens').then(m => ({ default: m.ForgotPasswordScreen })))
const ResetPasswordScreen = lazy(() => import('@/components/ecommerce/auth-screens').then(m => ({ default: m.ResetPasswordScreen })))
const EmailVerificationScreen = lazy(() => import('@/components/ecommerce/auth-screens').then(m => ({ default: m.EmailVerificationScreen })))

// --- Buyer Screens ---
const HomeScreen = lazy(() => import('@/components/ecommerce/home-screen').then(m => ({ default: m.HomeScreen })))
const SearchScreen = lazy(() => import('@/components/ecommerce/search-screen').then(m => ({ default: m.SearchScreen })))
const CategoryScreen = lazy(() => import('@/components/ecommerce/category-screen').then(m => ({ default: m.CategoryScreen })))
const CategoryDetailScreen = lazy(() => import('@/components/ecommerce/category-screen').then(m => ({ default: m.CategoryDetailScreen })))
const ProductDetailScreen = lazy(() => import('@/components/ecommerce/product-detail-screen').then(m => ({ default: m.ProductDetailScreen })))
const CartScreen = lazy(() => import('@/components/ecommerce/cart-screen').then(m => ({ default: m.CartScreen })))
const CheckoutScreen = lazy(() => import('@/components/ecommerce/checkout-screen').then(m => ({ default: m.CheckoutScreen })))
const OrderScreen = lazy(() => import('@/components/ecommerce/order-screen').then(m => ({ default: m.OrderScreen })))
const WalletScreen = lazy(() => import('@/components/ecommerce/wallet-screen').then(m => ({ default: m.WalletScreen })))
const ChatScreen = lazy(() => import('@/components/ecommerce/chat-screen').then(m => ({ default: m.ChatScreen })))
const ChatRoomScreen = lazy(() => import('@/components/ecommerce/chat-screen').then(m => ({ default: m.ChatRoomScreen })))
const NotificationScreen = lazy(() => import('@/components/ecommerce/notification-screen').then(m => ({ default: m.NotificationScreen })))
const ProfileScreen = lazy(() => import('@/components/ecommerce/profile-screen').then(m => ({ default: m.ProfileScreen })))
const WishlistScreen = lazy(() => import('@/components/ecommerce/wishlist-screen').then(m => ({ default: m.WishlistScreen })))
const SellerShopScreen = lazy(() => import('@/components/ecommerce/seller-shop-screen').then(m => ({ default: m.SellerShopScreen })))
const SellerAddProductScreen = lazy(() => import('@/components/ecommerce/seller-add-product-screen').then(m => ({ default: m.SellerAddProductScreen })))

// --- Missing Buyer Screens ---
const SettingsScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.SettingsScreen })))
const VoucherScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.VoucherScreen })))
const AddressScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.AddressScreen })))
const ReviewScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.ReviewScreen })))
const RefundScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.RefundScreen })))
const HelpScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.HelpScreen })))
const FollowedStoresScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.FollowedStoresScreen })))
const DepositScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.DepositScreen })))
const WithdrawScreen = lazy(() => import('@/components/ecommerce/missing-screens').then(m => ({ default: m.WithdrawScreen })))

// --- Seller Screens ---
const SellerDashboard = lazy(() => import('@/components/ecommerce/seller-screens').then(m => ({ default: m.SellerDashboard })))
const SellerProducts = lazy(() => import('@/components/ecommerce/seller-screens').then(m => ({ default: m.SellerProducts })))
const SellerOrders = lazy(() => import('@/components/ecommerce/seller-screens').then(m => ({ default: m.SellerOrders })))
const SellerAnalytics = lazy(() => import('@/components/ecommerce/seller-screens').then(m => ({ default: m.SellerAnalytics })))
const SellerWallet = lazy(() => import('@/components/ecommerce/seller-screens').then(m => ({ default: m.SellerWallet })))
const SellerChat = lazy(() => import('@/components/ecommerce/seller-screens').then(m => ({ default: m.SellerChat })))
const SellerSettings = lazy(() => import('@/components/ecommerce/seller-screens').then(m => ({ default: m.SellerSettings })))
const SellerCampaign = lazy(() => import('@/components/ecommerce/seller-screens').then(m => ({ default: m.SellerCampaign })))
const SellerWithdrawScreen = lazy(() => import('@/components/ecommerce/seller-withdraw-screens').then(m => ({ default: m.SellerWithdrawScreen })))
const SellerWithdrawHistoryScreen = lazy(() => import('@/components/ecommerce/seller-withdraw-screens').then(m => ({ default: m.SellerWithdrawHistoryScreen })))

// --- Admin Screens ---
const AdminDashboard = lazy(() => import('@/components/ecommerce/admin-screens').then(m => ({ default: m.AdminDashboard })))
const AdminUsers = lazy(() => import('@/components/ecommerce/admin-screens').then(m => ({ default: m.AdminUsers })))
const AdminProducts = lazy(() => import('@/components/ecommerce/admin-screens').then(m => ({ default: m.AdminProducts })))
const AdminWithdraw = lazy(() => import('@/components/ecommerce/admin-screens').then(m => ({ default: m.AdminWithdraw })))
const AdminBanner = lazy(() => import('@/components/ecommerce/admin-screens').then(m => ({ default: m.AdminBanner })))
const AdminAnalytics = lazy(() => import('@/components/ecommerce/admin-screens').then(m => ({ default: m.AdminAnalytics })))
const AdminComplaints = lazy(() => import('@/components/ecommerce/admin-screens').then(m => ({ default: m.AdminComplaints })))
const AdminReviews = lazy(() => import('@/components/ecommerce/admin-screens').then(m => ({ default: m.AdminReviews })))
const AdminOrdersScreen = lazy(() => import('@/components/ecommerce/admin-orders-screen').then(m => ({ default: m.AdminOrdersScreen })))
const AdminDivisions = lazy(() => import('@/components/ecommerce/admin-divisions-screen').then(m => ({ default: m.AdminDivisions })))
const AdminWorkflow = lazy(() => import('@/components/ecommerce/admin-workflow-screen').then(m => ({ default: m.AdminWorkflow })))
const AdminCategories = lazy(() => import('@/components/ecommerce/admin-new-screens').then(m => ({ default: m.AdminCategories })))
const AdminVouchers = lazy(() => import('@/components/ecommerce/admin-new-screens').then(m => ({ default: m.AdminVouchers })))
const AdminDeposits = lazy(() => import('@/components/ecommerce/admin-new-screens').then(m => ({ default: m.AdminDeposits })))
const AdminCampaigns = lazy(() => import('@/components/ecommerce/admin-new-screens').then(m => ({ default: m.AdminCampaigns })))
const AdminSettings = lazy(() => import('@/components/ecommerce/admin-new-screens').then(m => ({ default: m.AdminSettings })))

// --- Stream Screens ---
const StreamFeedScreen = lazy(() => import('@/components/ecommerce/stream').then(m => ({ default: m.StreamFeedScreen })))
const StreamCreateScreen = lazy(() => import('@/components/ecommerce/stream').then(m => ({ default: m.StreamCreateScreen })))

// --- Legal Screens ---
const PrivacyPolicyScreen = lazy(() => import('@/components/ecommerce/legal/legal-screens').then(m => ({ default: m.PrivacyPolicyScreen })))
const TermsOfServiceScreen = lazy(() => import('@/components/ecommerce/legal/legal-screens').then(m => ({ default: m.TermsOfServiceScreen })))
const RefundPolicyScreen = lazy(() => import('@/components/ecommerce/legal/legal-screens').then(m => ({ default: m.RefundPolicyScreen })))

// ==================== SCREEN MAP ====================
// Maps screen names to lazy-loaded components for O(1) lookup instead of switch statement

type ScreenProps = Record<string, unknown>

interface ScreenEntry {
  component: ComponentType<any>
  props?: ScreenProps
}

const screenMap: Record<ScreenName, ScreenEntry> = {
  // Auth
  splash: { component: SplashScreen },
  onboarding: { component: OnboardingScreen },
  login: { component: LoginScreen },
  register: { component: RegisterScreen },
  otp: { component: OTPScreen },
  'forgot-password': { component: ForgotPasswordScreen },
  'reset-password': { component: ResetPasswordScreen },
  'email-verification': { component: EmailVerificationScreen },

  // Buyer
  home: { component: HomeScreen },
  search: { component: SearchScreen },
  category: { component: CategoryScreen },
  'category-detail': { component: CategoryDetailScreen },
  'product-detail': { component: ProductDetailScreen },
  cart: { component: CartScreen },
  checkout: { component: CheckoutScreen },
  orders: { component: OrderScreen },
  'order-tracking': { component: OrderScreen },
  wallet: { component: WalletScreen },
  deposit: { component: DepositScreen },
  withdraw: { component: WithdrawScreen },
  chat: { component: ChatScreen },
  'chat-room': { component: ChatRoomScreen },
  notification: { component: NotificationScreen },
  profile: { component: ProfileScreen },
  settings: { component: SettingsScreen },
  voucher: { component: VoucherScreen },
  review: { component: ReviewScreen },
  refund: { component: RefundScreen },
  help: { component: HelpScreen },
  address: { component: AddressScreen },
  'followed-stores': { component: FollowedStoresScreen },
  'seller-shop': { component: SellerShopScreen },
  wishlist: { component: WishlistScreen },

  // Stream
  stream: { component: StreamFeedScreen },
  'stream-create': { component: StreamCreateScreen },

  // Legal (props will be injected at render time)
  'privacy-policy': { component: PrivacyPolicyScreen },
  'terms-of-service': { component: TermsOfServiceScreen },
  'refund-policy': { component: RefundPolicyScreen },

  // Seller
  'seller-dashboard': { component: SellerDashboard },
  'seller-products': { component: SellerProducts },
  'seller-add-product': { component: SellerAddProductScreen },
  'seller-orders': { component: SellerOrders },
  'seller-analytics': { component: SellerAnalytics },
  'seller-wallet': { component: SellerWallet },
  'seller-chat': { component: SellerChat },
  'seller-settings': { component: SellerSettings },
  'seller-campaign': { component: SellerCampaign },
  'seller-withdraw': { component: SellerWithdrawScreen },
  'seller-withdraw-history': { component: SellerWithdrawHistoryScreen },

  // Admin
  'admin-dashboard': { component: AdminDashboard },
  'admin-users': { component: AdminUsers },
  'admin-products': { component: AdminProducts },
  'admin-orders': { component: AdminOrdersScreen },
  'admin-withdraw': { component: AdminWithdraw },
  'admin-banner': { component: AdminBanner },
  'admin-analytics': { component: AdminAnalytics },
  'admin-complaints': { component: AdminComplaints },
  'admin-divisions': { component: AdminDivisions },
  'admin-workflow': { component: AdminWorkflow },
  'admin-categories': { component: AdminCategories },
  'admin-vouchers': { component: AdminVouchers },
  'admin-deposits': { component: AdminDeposits },
  'admin-campaigns': { component: AdminCampaigns },
  'admin-reviews': { component: AdminReviews },
  'admin-settings': { component: AdminSettings },

  // payment is a ScreenName but not a standalone screen
  payment: { component: HomeScreen },
}

// ==================== SCREEN CATEGORIES ====================
// Centralized screen classification for nav visibility and auth guards

export const AUTH_SCREENS: readonly ScreenName[] = [
  'splash', 'onboarding', 'login', 'register', 'otp',
  'forgot-password', 'reset-password', 'email-verification',
] as const

export const SELLER_SCREENS: readonly ScreenName[] = [
  'seller-dashboard', 'seller-products', 'seller-add-product', 'seller-orders',
  'seller-analytics', 'seller-wallet', 'seller-chat', 'seller-settings',
  'seller-campaign', 'seller-withdraw', 'seller-withdraw-history',
] as const

export const ADMIN_SCREENS: readonly ScreenName[] = [
  'admin-dashboard', 'admin-users', 'admin-products', 'admin-orders',
  'admin-withdraw', 'admin-banner', 'admin-analytics', 'admin-complaints',
  'admin-divisions', 'admin-workflow', 'admin-categories', 'admin-vouchers',
  'admin-deposits', 'admin-campaigns', 'admin-reviews', 'admin-settings',
] as const

// Sub-screens that should hide the bottom nav (they have their own back navigation headers)
export const SUB_SCREENS: readonly ScreenName[] = [
  'product-detail', 'seller-shop', 'checkout', 'review', 'refund',
  'address', 'help', 'followed-stores', 'deposit', 'withdraw',
  'settings', 'voucher', 'order-tracking', 'seller-add-product',
  'chat-room', 'category-detail', 'seller-withdraw', 'seller-withdraw-history',
  'privacy-policy', 'terms-of-service', 'refund-policy', 'stream-create',
] as const

// ==================== LOADING FALLBACK ====================

function ScreenLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Memuat...</span>
      </div>
    </div>
  )
}

// ==================== SCREEN RENDERER ====================

interface ScreenRendererProps {
  screen: ScreenName
  navigate: (screen: ScreenName) => void
}

export function LazyScreenRenderer({ screen, navigate }: ScreenRendererProps) {
  const entry = screenMap[screen] || screenMap['home']
  const Component = entry.component

  // Inject navigation props for legal screens
  const isLegalScreen = screen === 'privacy-policy' || screen === 'terms-of-service' || screen === 'refund-policy'
  const props = isLegalScreen ? { onBack: () => navigate('settings') } : undefined

  return (
    <Suspense fallback={<ScreenLoader />}>
      <Component {...props} />
    </Suspense>
  )
}
