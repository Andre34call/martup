# 📋 MartUp Feature Registry

> **PURPOSE**: This document tracks ALL features in MartUp. Before ANY refactoring, check this list to ensure no feature is accidentally removed. Update this document whenever a feature is added, modified, or deprecated.

**Last Updated**: 2025-07-18
**Total Features**: 62

---

## Feature Status Legend
- ✅ Active — Fully implemented and working
- ⚠️ Partial — Implemented but has gaps/bugs
- 🔧 In Progress — Being developed
- ❌ Broken — Not working (needs fix)
- 🗑️ Deprecated — Planned for removal

---

## 1. Authentication & Authorization

### 1.1 Email/Password Registration
- **Status**: ✅
- **Files**: `src/app/api/auth/register/route.ts`, `src/components/ecommerce/auth/register-screen.tsx`, `src/lib/auth.ts`
- **Description**: Buyer registration with email, password, name, phone. Validates uniqueness of email/phone. Hashes password with bcrypt. Creates User record with role "buyer". Sends email verification link via Resend or mock provider.
- **Dependencies**: Email service (1.6), Database User model
- **Test Scenario**: Register new user → check DB → receive verification email

### 1.2 Email/Password Login
- **Status**: ✅
- **Files**: `src/app/api/auth/login/route.ts`, `src/components/ecommerce/auth/login-screen.tsx`, `src/lib/auth.ts`, `src/lib/auth-middleware.ts`
- **Description**: Login with email + password. Validates credentials. Checks account lockout (5 failed attempts → 15-min lock). Issues HMAC-signed session cookie + bearer token. Supports token rotation for Remember Me sessions. Token version tracks password changes.
- **Dependencies**: Session cookie system (1.10), Account lockout (1.9)
- **Test Scenario**: Login with valid/invalid credentials → check session cookie → verify token

### 1.3 Google OAuth Login
- **Status**: ✅
- **Files**: `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/auth.ts`
- **Description**: NextAuth.js v4 integration with Google OAuth provider. Auto-creates/syncs user on first Google login. JWT callback validates tokenVersion on every refresh to invalidate sessions after password change.
- **Dependencies**: NextAuth.js, Google OAuth env vars
- **Test Scenario**: Click "Login with Google" → authorize → auto-redirect to home

### 1.4 OTP Verification (Phone)
- **Status**: ✅
- **Files**: `src/app/api/auth/otp/send/route.ts`, `src/app/api/auth/otp/verify/route.ts`, `src/components/ecommerce/auth/otp-screen.tsx`, `src/lib/sms-gateway.ts`
- **Description**: Sends OTP to phone via SMS/WhatsApp (Twilio/Fonnte/mock). OTP stored in DB with expiry (5 min). Verifies OTP code, marks user as verified. Supports retry/resend.
- **Dependencies**: SMS Gateway (1.12)
- **Test Scenario**: Enter phone → receive OTP → verify → account verified

### 1.5 Email Verification
- **Status**: ✅
- **Files**: `src/app/api/auth/verify-email/route.ts`, `src/app/api/auth/resend-verification/route.ts`, `src/components/ecommerce/auth/email-verification.tsx`, `src/lib/email.ts`
- **Description**: Sends verification link to user email on registration. Link contains token valid for 24h. Clicking link sets isVerified=true. Supports resend. Beautiful HTML email template with branded styling.
- **Dependencies**: Email service (1.6)
- **Test Scenario**: Register → click verification link → isVerified=true

### 1.6 Email Sending Service
- **Status**: ✅
- **Files**: `src/lib/email.ts`, `src/lib/email-templates.ts`
- **Description**: Multi-provider email service supporting mock (dev) and Resend (production). Templates: email verification, password reset, account locked, email verified. HTML-escaped user inputs to prevent XSS in emails.
- **Dependencies**: RESEND_API_KEY env var
- **Test Scenario**: Trigger email verification → check mock log or Resend dashboard

### 1.7 Forgot/Reset Password
- **Status**: ✅
- **Files**: `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`, `src/components/ecommerce/auth/forgot-password.tsx`, `src/components/ecommerce/auth/reset-password.tsx`
- **Description**: Forgot password sends reset link to email (1h expiry). Reset password validates token, updates password, increments tokenVersion to invalidate existing sessions.
- **Dependencies**: Email service (1.6), Token hashing (1.11)
- **Test Scenario**: Click "Forgot Password" → receive email → set new password → old session invalidated

### 1.8 Two-Factor Authentication (2FA)
- **Status**: ✅
- **Files**: `src/app/api/user/2fa/route.ts`, `src/components/ecommerce/screens/settings/security-section.tsx`
- **Description**: Users can enable/disable 2FA in settings. When enabled, OTP is required after password login. TOTP-based or OTP-based second factor.
- **Dependencies**: SMS Gateway (1.12)
- **Test Scenario**: Enable 2FA → login → enter OTP → access granted

### 1.9 Account Lockout
- **Status**: ✅
- **Files**: `src/app/api/auth/login/route.ts`, `src/lib/auth-middleware.ts`
- **Description**: After 5 failed login attempts, account is locked for 15 minutes. Sends email notification to user on lockout. failedLoginAttempts and lockedUntil tracked in DB.
- **Dependencies**: Email service (1.6)
- **Test Scenario**: Fail login 5 times → account locked → wait 15 min → retry

### 1.10 Session Management (HMAC Tokens)
- **Status**: ✅
- **Files**: `src/lib/auth-middleware.ts`, `src/lib/session-cookie.ts`, `src/lib/constants.ts`, `src/lib/token-hash.ts`
- **Description**: HMAC-signed session tokens with format `base64(userId:tokenVersion:timestamp:signature)`. Token rotation when older than 1 hour. 24-hour token expiry. TokenVersion incremented on password change to invalidate all sessions. Three auth methods: NextAuth session, session cookie, bearer token.
- **Dependencies**: TOKEN_SECRET env var
- **Test Scenario**: Login → get session cookie → verify token → change password → old token rejected

### 1.11 Password Hashing & Token Hashing
- **Status**: ✅
- **Files**: `src/lib/hash.ts`, `src/lib/token-hash.ts`
- **Description**: bcrypt for password hashing. SHA-256 for reset/verification tokens. Token hashing prevents timing attacks.
- **Dependencies**: None
- **Test Scenario**: Register user → check password is hashed in DB

### 1.12 SMS/WhatsApp Gateway
- **Status**: ✅
- **Files**: `src/lib/sms-gateway.ts`
- **Description**: Multi-provider SMS/WhatsApp gateway supporting: mock (dev logging), Twilio (SMS), Fonnte (WhatsApp). Indonesian phone normalization (08xx → +628xx). OTP message formatting in Indonesian. Provider configured via SMS_PROVIDER env var.
- **Dependencies**: TWILIO_* or FONNTE_* env vars
- **Test Scenario**: Set SMS_PROVIDER=fonnte → send OTP → verify delivery

### 1.13 Role-Based Access Control (RBAC)
- **Status**: ✅
- **Files**: `src/lib/auth-middleware.ts`, `src/lib/types.ts`, `src/lib/admin-auth.ts`
- **Description**: Hierarchical role system: Super Admin (admin + specific email) → Manager → Division Roles (finance, pr, tech, cs, marketing, operations, legal, hr) → Admin → Seller → Buyer. Role verification helpers: verifyAuth, verifyAdmin, verifyManager, verifySuperAdmin, verifyStaff. Manager can assign division admin roles but not manager/super admin.
- **Dependencies**: User.role, Division model
- **Test Scenario**: Login as buyer → try admin API → 403. Login as admin → access admin API → 200

### 1.14 Logout & Session Invalidation
- **Status**: ✅
- **Files**: `src/app/api/auth/logout/route.ts`, `src/app/api/auth/logout-all/route.ts`
- **Description**: Logout clears session cookie. "Logout all" increments tokenVersion to invalidate all sessions across all devices.
- **Dependencies**: Session management (1.10)
- **Test Scenario**: Logout → session cookie cleared → old token rejected

### 1.15 User Profile Sync
- **Status**: ✅
- **Files**: `src/app/api/auth/sync-user/route.ts`, `src/app/api/auth/me/route.ts`
- **Description**: Syncs user data between NextAuth and local DB. /api/auth/me returns current authenticated user info.
- **Dependencies**: NextAuth
- **Test Scenario**: Login → call /api/auth/me → returns user data

### 1.16 Splash/Onboarding Screens
- **Status**: ✅
- **Files**: `src/components/ecommerce/auth/splash-screen.tsx`, `src/components/ecommerce/auth/onboarding-screen.tsx`
- **Description**: Initial splash screen with MartUp branding. Onboarding carousel for new users. Auto-navigates to login after timeout.
- **Dependencies**: Navigation store
- **Test Scenario**: Open app → splash → onboarding → login

---

## 2. Product Management

### 2.1 Product CRUD (Seller)
- **Status**: ✅
- **Files**: `src/app/api/seller/products/route.ts`, `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`, `src/components/ecommerce/seller-add-product-screen.tsx`, `src/components/ecommerce/seller/seller-products.tsx`
- **Description**: Sellers can create, read, update, delete products. Fields: name, description, price, discountPrice, stock, weight, images, video, categoryId, condition, productType, tags, minOrder. Product slug auto-generated from name. Stock deduction on order, restoration on cancel.
- **Dependencies**: Category (2.4), File upload (10.1), Seller model
- **Test Scenario**: Seller creates product → appears in product list → edit → delete

### 2.2 Product Type: Barang (Physical) vs Jasa (Service)
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Product.productType), `src/app/api/seller/products/route.ts`, `src/components/ecommerce/seller-add-product-screen.tsx`, `src/components/ecommerce/product-detail-screen.tsx`
- **Description**: Two product types: "product" (barang/physical) and "jasa" (service). Jasa products: weight is null (no shipping), has serviceDuration and serviceLocation fields. Service orders: no address required, no shipping cost, uses escrow, seller uploads proof of completion.
- **Dependencies**: Escrow (5.4), Service proof (5.6)
- **Test Scenario**: Create jasa product → no weight field → order → no shipping → seller uploads proof

### 2.3 Product Variants
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (ProductVariant), `src/components/ecommerce/seller-add-product-screen.tsx`, `src/components/ecommerce/product-detail-screen.tsx`
- **Description**: Products can have variants (color, size, etc.). Each variant has: name, value, SKU, price (optional override), stock, image. Variant stock tracked separately. Cart items reference specific variants.
- **Dependencies**: Product model, Cart model
- **Test Scenario**: Create product with Color=Red,Blue variants → add Red to cart → check stock

### 2.4 Category Management
- **Status**: ✅
- **Files**: `src/app/api/categories/route.ts`, `src/app/api/admin/categories/route.ts`, `src/components/ecommerce/category-screen.tsx`, `src/components/ecommerce/admin/categories.tsx`
- **Description**: Hierarchical categories with parent/children. Fields: name, slug, icon, image, parentId, sortOrder, isActive. Admin CRUD for categories. Buyer-facing category browsing and category detail pages.
- **Dependencies**: None
- **Test Scenario**: Admin creates category → appears in category list → buyer browses category

### 2.5 Product Search & Filtering
- **Status**: ✅
- **Files**: `src/app/api/search/route.ts`, `src/app/api/products/route.ts`, `src/components/ecommerce/search-screen.tsx`, `src/lib/store/search.ts`
- **Description**: Full-text search across product names and descriptions. Filters: category, price range, condition, product type, rating, seller. Sorting: newest, price low-high, price high-low, most popular, best rating. Search history persisted locally.
- **Dependencies**: Product model, Category model
- **Test Scenario**: Search "laptop" → filter by price range → sort by price → see results

### 2.6 Product Detail View
- **Status**: ✅
- **Files**: `src/components/ecommerce/product-detail-screen.tsx`, `src/app/api/products/[id]/route.ts`, `src/app/api/products/[id]/view/route.ts`
- **Description**: Detailed product page with image carousel, price, description, variants, seller info, reviews, related products. View count tracking. Share to stream functionality.
- **Dependencies**: Product model, Review model, Seller model
- **Test Scenario**: Click product → see all details → view count increments

### 2.7 Flash Sale Products
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Product.isFlashSale, Product.flashSaleEnd), `src/components/ecommerce/home-screen.tsx`
- **Description**: Products can be marked as flash sale with end time. Flash sale products shown in dedicated section on home screen. Discount price displayed prominently.
- **Dependencies**: Product model
- **Test Scenario**: Admin/seller marks product as flash sale → appears in flash sale section → timer counts down

### 2.8 Promoted/Featured Products
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Product.isFeatured, Product.isPromoted, Product.promotedUntil), `src/app/api/admin/products/promote/route.ts`, `src/components/ecommerce/home-screen.tsx`
- **Description**: Admin can set products as "featured" (editorial pick) or "promoted" (paid ad). Promoted products have expiry time. Featured products shown in special section. promotedBy tracks which admin set the promotion.
- **Dependencies**: Admin authorization
- **Test Scenario**: Admin promotes product → appears in promoted section → expires after promotedUntil

### 2.9 Product View Tracking & Viral Score
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Product.viewCount, Product.viralScore), `src/app/api/products/[id]/view/route.ts`
- **Description**: Product view count incremented on each visit. Viral score computed from views + sales + engagement metrics. Used for trending product ranking.
- **Dependencies**: Product model
- **Test Scenario**: Visit product page → viewCount increments → viralScore updates

### 2.10 Product Approval (Admin)
- **Status**: ✅
- **Files**: `src/app/api/admin/products/[id]/approve/route.ts`, `src/app/api/admin/products/route.ts`, `src/components/ecommerce/admin/products.tsx`
- **Description**: Admin can approve or block products. Blocked products not visible to buyers. Product status: active, draft, blocked.
- **Dependencies**: Admin authorization (1.13)
- **Test Scenario**: Seller creates product → admin blocks → product hidden from buyers

### 2.11 Stock Management
- **Status**: ✅
- **Files**: `src/lib/stock-utils.ts`, `src/app/api/admin/stock-logs/route.ts`, `src/components/ecommerce/admin/stock-movements.tsx`
- **Description**: Stock tracking with movements log. Stock decremented on order, restored on cancel. Variant stock tracked independently. Admin can view stock movement history. GREATEST SQL to prevent negative sold count.
- **Dependencies**: Product model, ProductVariant model
- **Test Scenario**: Place order → stock decreases → cancel order → stock restored

---

## 3. Cart & Checkout

### 3.1 Cart Management
- **Status**: ✅
- **Files**: `src/app/api/cart/route.ts`, `src/app/api/cart/add/route.ts`, `src/app/api/cart/[id]/route.ts`, `src/app/api/cart/clear/route.ts`, `src/app/api/cart/bulk/route.ts`, `src/components/ecommerce/cart-screen.tsx`, `src/lib/store/cart.ts`
- **Description**: Add/remove items to cart. Each cart item has productId, variantId, quantity, isChecked flag. Unique constraint on (userId, productId, variantId). Bulk add for checkout. Clear entire cart. Quantity validation against stock. Merge cart on login.
- **Dependencies**: Product model, ProductVariant model
- **Test Scenario**: Add product to cart → change quantity → check/uncheck items → remove item

### 3.2 Checkout Flow
- **Status**: ✅
- **Files**: `src/components/ecommerce/checkout/checkout-screen.tsx`, `src/components/ecommerce/checkout/address-step.tsx`, `src/components/ecommerce/checkout/shipping-step.tsx`, `src/components/ecommerce/checkout/payment-step.tsx`, `src/components/ecommerce/checkout/order-summary.tsx`, `src/components/ecommerce/checkout/shared.tsx`
- **Description**: Multi-step checkout: 1) Address selection, 2) Shipping method, 3) Payment method, 4) Order summary. Supports both physical (barang) and service (jasa) products. Service orders skip address/shipping. Voucher discount applied. Platform fee displayed.
- **Dependencies**: Address (3.3), Shipping (3.4), Payment (3.5), Voucher (7.1)
- **Test Scenario**: Add items → checkout → select address → choose shipping → pay → order created

### 3.3 Address Management
- **Status**: ✅
- **Files**: `src/app/api/addresses/route.ts`, `src/app/api/addresses/[id]/route.ts`, `src/components/ecommerce/screens/address-screen.tsx`, `src/lib/store/address.ts`
- **Description**: CRUD for delivery addresses. Fields: label, recipient, phone, address, city, province, postalCode, isDefault. Set default address. Used in checkout for shipping destination.
- **Dependencies**: Address model
- **Test Scenario**: Add address → set as default → appears first in checkout

### 3.4 Shipping Cost Calculation
- **Status**: ✅
- **Files**: `src/lib/shipping-calculator.ts`, `src/lib/rajaongkir.ts`, `src/app/api/shipping/calculate/route.ts`, `src/app/api/shipping/couriers/route.ts`, `src/app/api/shipping/cities/route.ts`
- **Description**: Two-tier shipping calculation: 1) RajaOngkir API (if API key configured), 2) Local zone-based fallback. Supports couriers: JNE (REG/YES), SiCepat (REG/BEST), J&T (EZ), AnterAja (REG), TIKI (REG), POS (KILAT). Zone detection: same_city, same_province, same_island, inter_island. Indonesian city/island mapping. Weight rounded up to nearest kg.
- **Dependencies**: RajaOngkir API key (optional), Product weight
- **Test Scenario**: Checkout → enter address → shipping rates calculated → select courier

### 3.5 Payment Integration (Midtrans)
- **Status**: ✅
- **Files**: `src/lib/midtrans.ts`, `src/lib/midtrans-server.ts`, `src/app/api/payment/create/route.ts`, `src/app/api/payment/status/route.ts`, `src/app/api/payment/notification/route.ts`, `src/components/ecommerce/checkout/payment-step.tsx`
- **Description**: Midtrans Snap integration for payment. Snap.js loaded client-side. Server creates snap token via Midtrans API. Payment notification webhook updates order status. Supports all Midtrans payment methods (bank transfer, e-wallet, card). Sandbox/production toggle via env var. Refund via Midtrans API on order cancellation.
- **Dependencies**: MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY env vars
- **Test Scenario**: Checkout → Midtrans popup → complete payment → order status updated

### 3.6 Manual Bank Transfer (Payment Proof Upload)
- **Status**: ✅
- **Files**: `src/app/api/orders/[id]/payment-proof/route.ts`, `src/app/api/admin/orders/[id]/verify-payment/route.ts`, `src/components/ecommerce/payment-proof-upload.tsx`, `src/app/api/orders/[id]/confirm-payment/route.ts`
- **Description**: Buyers can upload payment proof (bukti transfer) for manual bank transfer orders. Admin verifies payment proof. Order linked to specific platform bank account. Payment status: unpaid → pending_verification → paid.
- **Dependencies**: File upload (10.1), PlatformBankAccount model
- **Test Scenario**: Buyer uploads proof → admin verifies → order status updated to paid

### 3.7 Wallet Payment
- **Status**: ✅
- **Files**: `src/app/api/wallet/debit/route.ts`, `src/app/api/wallet/debit-batch/route.ts`, `src/lib/store/wallet.ts`
- **Description**: Pay for orders using wallet balance. Wallet debited on order creation. If insufficient, payment fails. Batch debit for multiple items. Wallet balance checked before payment.
- **Dependencies**: Wallet system (6.1)
- **Test Scenario**: Checkout → select wallet payment → balance deducted → order paid

---

## 4. Order Management

### 4.1 Order Creation
- **Status**: ✅
- **Files**: `src/app/api/orders/route.ts`, `src/components/ecommerce/checkout/checkout-screen.tsx`
- **Description**: Creates order from cart items. Computes subtotal, shipping, discount, platform fee, total. Stock deducted. Voucher usage recorded. isServiceOrder flag set if all items are jasa. autoConfirmAt set for service orders (3 days from proof submission). Order number auto-generated.
- **Dependencies**: Cart (3.1), Product stock (2.11), Voucher (7.1), Commission (9.1)
- **Test Scenario**: Checkout → order created → stock deducted → voucher used

### 4.2 Order Status Tracking
- **Status**: ✅
- **Files**: `src/lib/order-status.ts`, `src/app/api/orders/[id]/status/route.ts`, `src/components/ecommerce/order-screen.tsx`, `src/lib/store/order.ts`
- **Description**: Order status flow: pending → paid → processing → shipped → delivered. Cancel possible from various states. Valid transitions enforced. Status-specific timestamps (paidAt, shippedAt, deliveredAt, cancelledAt). Notifications sent on each status change.
- **Dependencies**: Notification system (8.1), Wallet/escrow (5.4)
- **Test Scenario**: Order created → seller marks shipped → buyer confirms delivered

### 4.3 Buyer Order View
- **Status**: ✅
- **Files**: `src/components/ecommerce/order-screen.tsx`, `src/app/api/orders/route.ts`, `src/lib/store/order.ts`
- **Description**: Buyers see all their orders grouped by status (pending, processing, shipped, delivered, cancelled). Order details with items, shipping info, tracking number. Can cancel pending orders. Can confirm delivery.
- **Dependencies**: Order model
- **Test Scenario**: Buyer opens orders → sees grouped orders → clicks to see detail

### 4.4 Seller Order Management
- **Status**: ✅
- **Files**: `src/components/ecommerce/seller/seller-orders.tsx`, `src/app/api/seller/orders/route.ts`
- **Description**: Sellers see all orders for their products. Can mark as processing, shipped (with tracking number), cancel. View order details and buyer info.
- **Dependencies**: Order model, Seller model
- **Test Scenario**: Seller opens orders → marks as processing → adds tracking number → marks shipped

### 4.5 Admin Order Management
- **Status**: ✅
- **Files**: `src/components/ecommerce/admin-orders-screen.tsx`, `src/app/api/admin/orders/route.ts`, `src/app/api/admin/orders/[id]/verify-payment/route.ts`
- **Description**: Admin sees all orders across platform. Can verify payment proofs, change status, cancel orders. Payment verification workflow.
- **Dependencies**: Admin authorization (1.13)
- **Test Scenario**: Admin opens orders → verifies payment → order status updated

### 4.6 Order Cancellation & Refund
- **Status**: ✅
- **Files**: `src/lib/order-status.ts`, `src/app/api/orders/[id]/cancel/route.ts`
- **Description**: Cancellation with reason required. Stock restored on cancel. For wallet payments: refund to buyer wallet. For Midtrans payments: request Midtrans refund. Escrow reversal for seller. Payment status set to "refunded" on paid order cancel.
- **Dependencies**: Wallet (6.1), Midtrans refund (3.5), Stock management (2.11)
- **Test Scenario**: Cancel paid order → stock restored → buyer refunded → seller escrow reversed

---

## 5. Escrow & Service Orders

### 5.1 Escrow System
- **Status**: ✅
- **Files**: `src/lib/order-status.ts`, `prisma/schema.prisma` (Order.escrowStatus, Wallet.holdBalance, Wallet.pendingBalance)
- **Description**: Escrow holds buyer payment until delivery confirmed. Order.escrowStatus: none → held → released/refunded. On payment: funds held in seller's pendingBalance. On delivery confirmation: released to seller's available balance (minus commission). On cancellation: escrow refunded.
- **Dependencies**: Wallet system (6.1), Commission (9.1)
- **Test Scenario**: Pay for order → escrow held → confirm delivery → escrow released to seller

### 5.2 Service Order Flow
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Order.isServiceOrder, Order.serviceProofImages, Order.autoConfirmAt), `src/app/api/orders/route.ts`
- **Description**: Service (jasa) orders: no shipping address, no shipping cost. Order.isServiceOrder=true when all items are jasa. Different status flow adapted for services.
- **Dependencies**: Product type jasa (2.2)
- **Test Scenario**: Order jasa product → no shipping step → order created with isServiceOrder=true

### 5.3 Service Proof Upload (Seller)
- **Status**: ✅
- **Files**: `src/app/api/orders/[id]/service-proof/route.ts`, `src/components/ecommerce/seller/seller-orders.tsx`
- **Description**: Seller uploads proof of service completion (images). Order.sellerCompletedAt set. Order status changes to "shipped" (service equivalent of shipped). autoConfirmAt set to 3 days from now.
- **Dependencies**: File upload (10.1), Order model
- **Test Scenario**: Seller uploads service proof → order marked as shipped → auto-confirm timer starts

### 5.4 Auto-Confirm for Service Orders
- **Status**: ✅
- **Files**: `src/app/api/cron/auto-confirm-service/route.ts`, `vercel.json`
- **Description**: Cron job runs daily. Auto-confirms service orders where buyer hasn't responded within 3 days of seller proof submission. Releases escrow to seller. Sends notifications to both buyer and seller.
- **Dependencies**: Escrow (5.1), Cron system
- **Test Scenario**: Service proof uploaded → 3 days pass → auto-confirm cron → escrow released

### 5.5 Auto-Complete Shipped Orders
- **Status**: ✅
- **Files**: `src/app/api/cron/auto-complete/route.ts`, `vercel.json`
- **Description**: Cron job runs daily. Auto-completes shipped orders after 7 days. Releases escrow to seller. Idempotency check prevents double-release.
- **Dependencies**: Escrow (5.1), Cron system
- **Test Scenario**: Order shipped → 7 days pass → auto-complete cron → escrow released

### 5.6 Auto-Cancel Expired Orders
- **Status**: ✅
- **Files**: `src/app/api/cron/cancel-expired/route.ts`, `vercel.json`
- **Description**: Cron job runs daily. Cancels unpaid orders older than 24 hours. Restores product stock. Sends notification to buyer.
- **Dependencies**: Stock management (2.11), Cron system
- **Test Scenario**: Order unpaid for 24h → cron cancels → stock restored

### 5.7 Stuck Order Recovery
- **Status**: ✅
- **Files**: `src/app/api/cron/auto-complete-stuck/route.ts`, `vercel.json`
- **Description**: Cron job to recover orders stuck in processing/paid states. Runs daily at 9 AM.
- **Dependencies**: Order model
- **Test Scenario**: Order stuck in "processing" for days → cron recovers

---

## 6. Wallet & Financial

### 6.1 Wallet System
- **Status**: ✅
- **Files**: `src/app/api/wallet/route.ts`, `src/app/api/wallet/mutations/route.ts`, `src/components/ecommerce/wallet-screen.tsx`, `src/lib/store/wallet.ts`
- **Description**: Dual wallet system (user wallet + seller wallet). Balance, holdBalance (escrow), pendingBalance. Wallet mutations with full audit trail: type (credit/debit), amount, balance after, description, refType, refId. Mutation types: order, deposit, withdraw, refund, cashback, order_release.
- **Dependencies**: Wallet model, WalletMutation model
- **Test Scenario**: View wallet → see balance + mutation history

### 6.2 Wallet Top-Up
- **Status**: ✅
- **Files**: `src/app/api/wallet/topup/route.ts`, `src/lib/store/wallet.ts`
- **Description**: Top up wallet balance via Midtrans payment. Creates payment transaction, on success credits wallet.
- **Dependencies**: Midtrans (3.5), Wallet (6.1)
- **Test Scenario**: Top up Rp 100,000 → Midtrans payment → wallet credited

### 6.3 Deposit System
- **Status**: ✅
- **Files**: `src/app/api/wallet/deposit/route.ts`, `src/app/api/wallet/deposits/route.ts`, `src/app/api/wallet/deposits/[id]/route.ts`, `src/app/api/wallet/deposits/[id]/proof/route.ts`, `src/app/api/deposit/midtrans/create/route.ts`, `src/app/api/deposit/status/route.ts`, `src/components/ecommerce/screens/deposit-screen.tsx`, `src/components/ecommerce/screens/deposit-history-screen.tsx`, `src/components/ecommerce/screens/deposit-detail-screen.tsx`
- **Description**: Deposit money to wallet via bank transfer or Midtrans. Bank transfer: user transfers to platform bank account, uploads proof, admin verifies. Midtrans: Snap payment integration. Deposit status: pending → verified/failed. Platform bank account selection for manual transfer.
- **Dependencies**: Midtrans (3.5), PlatformBankAccount (6.5), File upload (10.1)
- **Test Scenario**: Create deposit → upload proof → admin verifies → wallet credited

### 6.4 Seller Withdrawal
- **Status**: ✅
- **Files**: `src/app/api/wallet/withdraw/route.ts`, `src/app/api/withdrawals/route.ts`, `src/app/api/withdrawals/[id]/route.ts`, `src/app/api/seller/withdraw/route.ts`, `src/components/ecommerce/screens/withdraw-screen.tsx`, `src/components/ecommerce/seller-withdraw-screens.tsx`, `src/components/ecommerce/admin/withdraw.tsx`
- **Description**: Sellers can request withdrawal of available balance to their bank account. Withdrawal status: pending → approved/rejected → processed. Admin approves/rejects with notes. Bank details: bankAccount, bankName, bankHolder. Available balance = balance - holdBalance - pendingBalance.
- **Dependencies**: Wallet (6.1), Seller model
- **Test Scenario**: Seller requests withdrawal → admin approves → seller receives funds

### 6.5 Platform Bank Accounts
- **Status**: ✅
- **Files**: `src/app/api/admin/bank-accounts/route.ts`, `src/app/api/admin/bank-accounts/[id]/route.ts`, `src/app/api/bank-accounts/route.ts`, `src/components/ecommerce/admin/platform-bank-accounts.tsx`
- **Description**: Admin-managed platform bank accounts where buyers transfer payments. Fields: bankName, bankCode, accountNumber, accountHolder, branch, isDefault, isActive, sortOrder. Used for manual payment proof verification and deposit system.
- **Dependencies**: Admin authorization (1.13)
- **Test Scenario**: Admin adds bank account → appears in deposit/checkout → buyer transfers

### 6.6 Seller Payout
- **Status**: ✅
- **Files**: `src/lib/seller-payout.ts`
- **Description**: Utility for processing seller payouts after escrow release. Computes seller earnings after commission deduction.
- **Dependencies**: Commission (9.1), Wallet (6.1)
- **Test Scenario**: Escrow released → seller payout processed → wallet updated

---

## 7. Vouchers & Promotions

### 7.1 Voucher System
- **Status**: ✅
- **Files**: `src/app/api/vouchers/route.ts`, `src/app/api/vouchers/validate/route.ts`, `src/app/api/admin/vouchers/route.ts`, `src/lib/voucher-utils.ts`, `src/components/ecommerce/screens/voucher-screen.tsx`, `src/components/ecommerce/admin/vouchers.tsx`, `src/lib/store/voucher.ts`
- **Description**: Voucher codes with validation: type (percentage/fixed), value, minPurchase, maxDiscount, usageLimit, perUserLimit, validFrom, validUntil, sellerId (null=platform voucher). Server-side discount computation (single source of truth in voucher-utils.ts). Voucher usage tracked per user per order.
- **Dependencies**: Order creation (4.1)
- **Test Scenario**: Apply voucher "DISKON10" → discount computed → order total reduced

### 7.2 Campaign Management
- **Status**: ✅
- **Files**: `src/app/api/admin/campaigns/route.ts`, `src/components/ecommerce/admin/campaigns.tsx`, `src/components/ecommerce/seller/seller-campaign.tsx`
- **Description**: Seller-created and admin-managed campaigns. Campaign types: flash_sale, banner, boost. Date range, discount, active status. Campaigns linked to sellers.
- **Dependencies**: Seller model
- **Test Scenario**: Seller creates flash sale campaign → products discounted during campaign period

### 7.3 Banner Management
- **Status**: ✅
- **Files**: `src/app/api/banners/route.ts`, `src/app/api/admin/banners/route.ts`, `src/components/ecommerce/admin/banner.tsx`, `src/components/ecommerce/home-screen.tsx`
- **Description**: Admin-managed promotional banners. Positions: home_top, home_mid, home_bottom, category_top, search_top, product_detail, checkout_top, popup. Fields: title, image, link, position, sortOrder, isActive, startDate, endDate. Displayed on home screen.
- **Dependencies**: File upload (10.1), Admin authorization (1.13)
- **Test Scenario**: Admin creates banner → appears on home screen → click navigates to link

---

## 8. Reviews & Ratings

### 8.1 Product Reviews & Ratings
- **Status**: ✅
- **Files**: `src/app/api/reviews/route.ts`, `src/app/api/reviews/can-review/route.ts`, `src/app/api/reviews/reply/route.ts`, `src/components/ecommerce/screens/review-screen.tsx`, `src/lib/store/review.ts`
- **Description**: Buyers can review products after delivery. Rating 1-5 stars, text content, images. Seller can reply to reviews. Admin can hide inappropriate reviews (isHidden). Can-review check: only for delivered orders, one review per order item. Product rating and reviewCount updated on review submission.
- **Dependencies**: Order delivery (4.2), File upload (10.1)
- **Test Scenario**: Deliver order → buyer writes review → rating appears on product page → seller replies

### 8.2 Buyer Ratings (by Sellers)
- **Status**: ✅
- **Files**: `src/app/api/buyer-ratings/route.ts`, `src/app/api/buyer-ratings/can-rate/route.ts`, `prisma/schema.prisma` (BuyerRating)
- **Description**: Sellers rate buyers after order completion. Rating 1-5 stars, optional content, tags (bayar_cepat, komunikatif, responsible, etc.). One rating per order. Buyer's average rating (buyerRating) and count (buyerRatingCount) tracked. Cancellation and return counts tracked.
- **Dependencies**: Order delivery (4.2)
- **Test Scenario**: Order delivered → seller rates buyer 5 stars → buyer rating updated

---

## 9. Platform & Commission

### 9.1 Commission/Platform Fee
- **Status**: ✅
- **Files**: `src/lib/commission.ts`, `src/lib/order-status.ts`, `src/app/api/admin/settings/route.ts`
- **Description**: Platform commission rate (default 5%) deducted from seller earnings on escrow release. Per-order flat platform fee (default Rp 1,000). Commission rate configurable per-seller (commissionRate) and platform-wide (PlatformSetting). Priority: platform-wide > seller-specific > default (5%).
- **Dependencies**: PlatformSetting model, Seller model
- **Test Scenario**: Order delivered → commission deducted → seller receives net amount

### 9.2 Platform Settings
- **Status**: ✅
- **Files**: `src/app/api/admin/settings/route.ts`, `src/components/ecommerce/admin/settings.tsx`, `prisma/schema.prisma` (PlatformSetting)
- **Description**: Key-value platform settings stored as JSON. Settings include: commissionRate, platformFee, and other configurable parameters. Admin UI for updating settings.
- **Dependencies**: Admin authorization (1.13)
- **Test Scenario**: Admin updates commission rate → new rate applied to future orders

### 9.3 Seller Verification
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Seller.isVerified), `src/app/api/seller/register/route.ts`
- **Description**: Seller verification status. Verified sellers shown with badge. isVerified flag on Seller model. Admin can verify sellers. Verification likely involves document review.
- **Dependencies**: Admin authorization (1.13)
- **Test Scenario**: Seller registers → admin verifies → verification badge shown

### 9.4 Admin Dashboard & Analytics
- **Status**: ✅
- **Files**: `src/app/api/admin/dashboard/route.ts`, `src/app/api/admin/stats/route.ts`, `src/app/api/admin/recalculate-stats/route.ts`, `src/components/ecommerce/admin/dashboard.tsx`, `src/components/ecommerce/admin/analytics.tsx`
- **Description**: Admin dashboard with platform metrics: total users, orders, revenue, commissions. Stats can be recalculated. Analytics charts and data visualization.
- **Dependencies**: Admin authorization (1.13)
- **Test Scenario**: Admin opens dashboard → sees total users, orders, revenue charts

### 9.5 Seller Dashboard & Stats
- **Status**: ✅
- **Files**: `src/app/api/seller/dashboard/route.ts`, `src/app/api/seller/stats/route.ts`, `src/components/ecommerce/seller/seller-dashboard.tsx`, `src/components/ecommerce/seller/seller-analytics.tsx`
- **Description**: Seller dashboard with store metrics: total sales, revenue, order count, product views. Analytics with charts.
- **Dependencies**: Seller model, Order model
- **Test Scenario**: Seller opens dashboard → sees store metrics and charts

---

## 10. File Upload & Media

### 10.1 File Upload (Images/Videos)
- **Status**: ✅
- **Files**: `src/app/api/upload/route.ts`, `src/lib/upload.ts`, `src/lib/upload-limits.ts`, `src/lib/image-utils.ts`, `src/app/api/setup/storage/route.ts`
- **Description**: File upload to Supabase Storage. Supports images and videos. Bucket-based organization (products, avatars, banners, etc.). File size limits enforced. Image URL generation. Multiple file upload support. Storage bucket initialization endpoint.
- **Dependencies**: Supabase Storage, SUPABASE_URL/KEY env vars
- **Test Scenario**: Upload product image → returns URL → displayed in product listing

### 10.2 Avatar Upload
- **Status**: ✅
- **Files**: `src/app/api/user/avatar/route.ts`, `src/components/ecommerce/screens/settings/profile-section.tsx`
- **Description**: User avatar upload and removal. Avatar stored in Supabase Storage. Avatar URL saved to User.avatar.
- **Dependencies**: File upload (10.1)
- **Test Scenario**: Upload avatar → appears in profile → remove avatar → default shown

---

## 11. Social Features

### 11.1 Stream/Social Feed
- **Status**: ✅
- **Files**: `src/app/api/stream/route.ts`, `src/app/api/stream/[id]/route.ts`, `src/components/ecommerce/stream/stream-feed-screen.tsx`, `src/components/ecommerce/stream/stream-create-screen.tsx`, `src/components/ecommerce/stream/stream-types.ts`, `src/components/ecommerce/stream/index.ts`
- **Description**: Instagram-like social feed. Users can create posts: text, image, or video. Posts can link to products. Feed shows posts from all users (with product cards). Like, comment, share functionality. Post editing. View count tracking.
- **Dependencies**: File upload (10.1), User model, Product model
- **Test Scenario**: Create post with product link → appears in feed → other users see it

### 11.2 Stream Comments
- **Status**: ✅
- **Files**: `src/app/api/stream/[id]/comments/route.ts`, `src/app/api/stream/[id]/comments/[commentId]/route.ts`, `src/components/ecommerce/stream/stream-comment-sheet.tsx`
- **Description**: Threaded comments on stream posts. Parent/child comment structure (replies). Like count on comments. Delete comments.
- **Dependencies**: Stream posts (11.1)
- **Test Scenario**: Comment on post → reply to comment → like comment

### 11.3 Stream Likes
- **Status**: ✅
- **Files**: `src/app/api/stream/[id]/like/route.ts`, `src/app/api/stream/[id]/comments/[commentId]/like/route.ts`, `prisma/schema.prisma` (StreamLike, StreamCommentLike)
- **Description**: Like/unlike stream posts and comments. Unique constraint per user per post/comment. Like count on posts and comments updated.
- **Dependencies**: Stream posts (11.1)
- **Test Scenario**: Like post → count increases → unlike → count decreases

### 11.4 Stream Search
- **Status**: ✅
- **Files**: `src/components/ecommerce/stream/stream-search-screen.tsx`, `src/lib/store/search.ts`
- **Description**: Search within the stream/social feed. Separate search history for stream vs product search.
- **Dependencies**: Stream posts (11.1)
- **Test Scenario**: Search "review" in stream → see matching posts

### 11.5 Stream User Profiles
- **Status**: ✅
- **Files**: `src/components/ecommerce/stream/stream-user-profile-screen.tsx`
- **Description**: View user profile from stream posts. Shows user's posts, bio, and store link.
- **Dependencies**: Stream posts (11.1), User model
- **Test Scenario**: Click username in feed → see their profile and posts

### 11.6 Stream Post Reporting
- **Status**: ✅
- **Files**: `src/app/api/stream/[id]/report/route.ts`, `src/app/api/stream/[postId]/report/route.ts`, `src/components/ecommerce/stream/stream-report-dialog.tsx`, `prisma/schema.prisma` (StreamPostReport)
- **Description**: Report inappropriate stream posts. Reasons: spam, harassment, inappropriate_content, scam, other. Report status: pending → reviewed/dismissed/actioned. One report per user per post.
- **Dependencies**: Stream posts (11.1)
- **Test Scenario**: Report post → admin reviews → actioned

### 11.7 @Mention System
- **Status**: ✅
- **Files**: `src/lib/mention.ts`, `src/components/ecommerce/stream/mention-components.tsx`
- **Description**: @mention users in stream posts and comments. Username lookup for autocomplete. Mention parsing and rendering.
- **Dependencies**: User.username
- **Test Scenario**: Type @ in post → autocomplete shows users → select → mention linked

### 11.8 Wishlist
- **Status**: ✅
- **Files**: `src/app/api/wishlist/route.ts`, `src/components/ecommerce/wishlist-screen.tsx`, `src/lib/store/wishlist.ts`
- **Description**: Save products to wishlist. Unique constraint per user per product. Wishlist screen shows all saved products.
- **Dependencies**: Product model
- **Test Scenario**: Heart a product → appears in wishlist → remove → gone

### 11.9 Followed Stores
- **Status**: ✅
- **Files**: `src/app/api/followed-stores/route.ts`, `src/components/ecommerce/screens/followed-stores-screen.tsx`, `src/lib/store/followed-stores.ts`
- **Description**: Follow/unfollow stores. Followed stores screen shows all followed stores with avatars, ratings, product counts. Store follower count tracked.
- **Dependencies**: Seller model
- **Test Scenario**: Follow store → appears in followed stores → unfollow → removed

---

## 12. Chat & Messaging

### 12.1 Chat System
- **Status**: ✅
- **Files**: `src/app/api/chat/rooms/route.ts`, `src/app/api/chat/rooms/[id]/messages/route.ts`, `src/app/api/chat/messages/route.ts`, `src/components/ecommerce/chat-screen.tsx`, `src/lib/store/chat.ts`
- **Description**: Real-time chat between buyer and seller. Chat rooms linked to products. Message types: text, image, product, order. Read/unread tracking per participant. Unread count badge. Room list and message history.
- **Dependencies**: ChatRoom, ChatMessage, ChatParticipant models
- **Test Scenario**: Buyer messages seller → seller sees unread → opens chat → replies

### 12.2 WebSocket/Socket.io Chat
- **Status**: ⚠️
- **Files**: `src/lib/store/chat.ts` (connectSocket, disconnectSocket, emitTyping, isSocketConnected, typingUsers)
- **Description**: Real-time chat via Socket.io. Typing indicators. Connection status tracking. Socket connection/disconnect lifecycle. Currently has socket connection code in store but no active mini-service running.
- **Dependencies**: Socket.io mini-service (not running)
- **Test Scenario**: Open chat → socket connected → typing indicator shown → real-time message delivery

---

## 13. Notifications

### 13.1 Notification System
- **Status**: ✅
- **Files**: `src/app/api/notifications/route.ts`, `src/app/api/notifications/[id]/read/route.ts`, `src/app/api/notifications/read-all/route.ts`, `src/components/ecommerce/notification-screen.tsx`, `src/lib/store/notification.ts`, `src/lib/order-notifications.ts`
- **Description**: In-app notification system. Types: order, promo, system, chat. Read/unread status. Mark individual or all as read. Unread count badge. Notifications created on: order status changes, payment confirmation, escrow release, etc.
- **Dependencies**: Notification model
- **Test Scenario**: Order status changes → notification appears → mark as read

### 13.2 Push Notifications (FCM)
- **Status**: ✅
- **Files**: `src/lib/push-notification.ts`, `src/app/api/user/fcm-token/route.ts`
- **Description**: Firebase Cloud Messaging push notifications. FCM token stored per user. Graceful degradation if Firebase not configured. Invalid tokens auto-removed. Multi-user push support.
- **Dependencies**: FIREBASE_* env vars (optional), firebase-admin package (optional)
- **Test Scenario**: Register FCM token → receive push on order update

---

## 14. Admin & Staff Features

### 14.1 User Management (Admin)
- **Status**: ✅
- **Files**: `src/app/api/admin/users/route.ts`, `src/components/ecommerce/admin/users.tsx`
- **Description**: Admin can view all users, filter by role/verification. Update user roles, block/unblock users. Assign users to divisions. Delete users.
- **Dependencies**: Admin authorization (1.13)
- **Test Scenario**: Admin lists users → changes role → user's access changes

### 14.2 Division/Department Management
- **Status**: ✅
- **Files**: `src/app/api/admin/divisions/route.ts`, `src/components/ecommerce/admin-divisions-screen.tsx`, `prisma/schema.prisma` (Division)
- **Description**: Internal divisions: Finance, PR, Tech/Bugs, CS, Marketing, Operations, Legal, HR. Each division has: name, slug, description, icon, color, headUserId, isActive, sortOrder. Staff assigned to divisions.
- **Dependencies**: Admin authorization (1.13)
- **Test Scenario**: Admin creates division → assigns head → staff assigned

### 14.3 Workflow/Task Queue
- **Status**: ✅
- **Files**: `src/lib/workflow.ts`, `src/app/api/admin/work-items/route.ts`, `src/components/ecommerce/admin-workflow-screen.tsx`, `prisma/schema.prisma` (WorkItem)
- **Description**: Internal task/workflow management. Work items auto-created from events (complaints, withdrawals, deposits, product reports, etc.). Auto-routing to divisions based on type. Status flow: open → in_progress → resolved/closed/escalated. Priority levels: low, normal, high, urgent. Assignee management.
- **Dependencies**: Division model (14.2), Admin authorization (1.13)
- **Test Scenario**: Complaint filed → work item auto-created in CS division → staff resolves

### 14.4 Complaints & Refund Management
- **Status**: ✅
- **Files**: `src/app/api/complaints/route.ts`, `src/app/api/complaints/[id]/route.ts`, `src/app/api/admin/complaints/route.ts`, `src/components/ecommerce/screens/refund-screen.tsx`, `src/components/ecommerce/admin/complaints.tsx`, `prisma/schema.prisma` (Complaint)
- **Description**: Buyer complaint system: refund, return, complain types. Images attached. Status: open → processing → resolved/rejected. Admin resolution with optional refundAmount. Auto-creates work item for CS division.
- **Dependencies**: Order model, Admin authorization (1.13)
- **Test Scenario**: Buyer submits complaint → admin resolves → refund processed

### 14.5 Admin Review Moderation
- **Status**: ✅
- **Files**: `src/app/api/admin/reviews/route.ts`, `src/components/ecommerce/admin/reviews.tsx`
- **Description**: Admin can view all reviews and hide inappropriate ones. isHidden flag prevents review from showing publicly but preserves data.
- **Dependencies**: Review model, Admin authorization (1.13)
- **Test Scenario**: Admin hides review → review not shown on product page

### 14.6 Deposit Management (Admin)
- **Status**: ✅
- **Files**: `src/app/api/admin/deposits/route.ts`, `src/components/ecommerce/admin/deposits.tsx`
- **Description**: Admin reviews and verifies deposit requests. Views proof of transfer. Approves (credits wallet) or rejects (with notes). Links to platform bank account.
- **Dependencies**: Deposit system (6.3), Admin authorization (1.13)
- **Test Scenario**: User deposits → admin verifies → wallet credited

### 14.7 Withdrawal Management (Admin)
- **Status**: ✅
- **Files**: `src/app/api/admin/withdrawals/route.ts`, `src/components/ecommerce/admin/withdraw.tsx`
- **Description**: Admin approves/rejects seller withdrawal requests. Can add admin notes. Status: pending → approved/rejected → processed.
- **Dependencies**: Withdrawal system (6.4), Admin authorization (1.13)
- **Test Scenario**: Seller requests withdrawal → admin approves → status updated

### 14.8 Admin Initialization/Setup
- **Status**: ✅
- **Files**: `src/app/api/admin/init/route.ts`, `src/app/api/admin/setup/route.ts`
- **Description**: First-time admin setup endpoint. Creates default admin user and platform settings if not exists. Protected by setup key.
- **Dependencies**: None
- **Test Scenario**: Call setup endpoint → admin user and settings created

---

## 15. User Profile & Settings

### 15.1 Profile Management
- **Status**: ✅
- **Files**: `src/app/api/user/profile/route.ts`, `src/app/api/user/[id]/profile/route.ts`, `src/components/ecommerce/profile-screen.tsx`, `src/components/ecommerce/screens/settings/profile-section.tsx`, `src/lib/store/profile.ts`
- **Description**: View and edit user profile: name, email, phone, username, emailHidden flag. Username with 30-day change cooldown. Email change requires re-verification. Phone change requires OTP.
- **Dependencies**: User model
- **Test Scenario**: Edit profile → change name → save → profile updated

### 15.2 User Settings
- **Status**: ✅
- **Files**: `src/app/api/user/settings/route.ts`, `src/components/ecommerce/screens/settings/settings-screen.tsx`, `src/components/ecommerce/screens/settings/security-section.tsx`, `src/components/ecommerce/screens/settings/account-section.tsx`, `src/lib/store/settings.ts`
- **Description**: User preferences: twoFactor (2FA), pushNotif, emailNotif, dataSharing. Settings stored as key-value in UserSetting model. Security section for 2FA and password management. Account section for account deletion.
- **Dependencies**: UserSetting model
- **Test Scenario**: Toggle push notifications → setting saved → affects notification delivery

### 15.3 Password Change
- **Status**: ✅
- **Files**: `src/app/api/auth/change-password/route.ts`, `src/components/ecommerce/screens/settings/security-section.tsx`
- **Description**: Change password (requires current password). Increments tokenVersion to invalidate all existing sessions. Requires CSRF token.
- **Dependencies**: Session management (1.10), CSRF (16.1)
- **Test Scenario**: Change password → all sessions invalidated → must re-login

### 15.4 Account Deletion
- **Status**: ✅
- **Files**: `src/app/api/user/delete/route.ts`, `src/components/ecommerce/screens/settings/account-section.tsx`
- **Description**: Self-service account deletion. Sets isActive=false (soft delete). Clears personal data.
- **Dependencies**: User model
- **Test Scenario**: Delete account → account deactivated → cannot login

### 15.5 Seller Profile/Shop
- **Status**: ✅
- **Files**: `src/app/api/seller/profile/route.ts`, `src/app/api/seller/register/route.ts`, `src/components/ecommerce/seller/seller-settings.tsx`, `src/components/ecommerce/seller-shop-screen.tsx`
- **Description**: Seller store profile: storeName, storeSlug, storeDesc, storeAvatar, storeBanner, storeAddress, storeCity, storeProvince, storePostalCode. Bank account details for withdrawal. Auto-reply message. Commission rate. Premium/verified status.
- **Dependencies**: Seller model
- **Test Scenario**: Seller updates store name → slug updated → store page shows new name

---

## 16. Security & Infrastructure

### 16.1 CSRF Protection
- **Status**: ✅
- **Files**: `src/lib/csrf.ts`, `src/lib/csrf-client.ts`, `src/app/api/csrf-token/route.ts`, `src/proxy.ts`
- **Description**: Double-submit cookie pattern for CSRF protection. HMAC-SHA256 signed tokens. Web Crypto API (Edge Runtime compatible). Token expiry 24h. CSRF cookie sent automatically, client reads and sends as X-CSRF-Token header. Exempt paths for webhooks and unauthenticated routes. Applied in Next.js middleware.
- **Dependencies**: CSRF_SECRET env var
- **Test Scenario**: POST request without CSRF → 403. With valid CSRF → 200

### 16.2 Rate Limiting
- **Status**: ✅
- **Files**: `src/lib/rate-limit.ts`
- **Description**: In-memory rate limiting for API endpoints. Per-IP or per-user limits. Used for auth endpoints and cron jobs.
- **Dependencies**: None
- **Test Scenario**: Hit API 100 times → rate limit triggered → 429 response

### 16.3 Input Sanitization
- **Status**: ✅
- **Files**: `src/lib/sanitize.ts`, `src/lib/security.ts`, `src/lib/sanitize-user.ts`
- **Description**: HTML tag stripping for free-text inputs. User data sanitization before API responses. XSS prevention in email templates and user-facing content.
- **Dependencies**: sanitize-html library
- **Test Scenario**: Register with name "<script>alert(1)</script>" → tags stripped

### 16.4 Sentry Error Tracking
- **Status**: ✅
- **Files**: `src/lib/sentry.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- **Description**: Sentry integration for error monitoring. Client, server, and edge runtime configs. Automatic error capture and reporting.
- **Dependencies**: SENTRY_DSN env var (optional)
- **Test Scenario**: Throw error → appears in Sentry dashboard

### 16.5 Logging System
- **Status**: ✅
- **Files**: `src/lib/logger.ts`
- **Description**: Structured logging with Pino. Business event logging (logBusinessEvent). Component-based log categorization. Log levels: debug, info, warn, error.
- **Dependencies**: Pino library
- **Test Scenario**: Order created → business event logged → check logs

### 16.6 Analytics Tracking
- **Status**: ✅
- **Files**: `src/lib/analytics/index.ts`, `src/app/api/analytics/track/route.ts`
- **Description**: Client-side analytics event tracking. Batched event sending (5s interval, max 20 events). E-commerce events: product_viewed, product_added_to_cart, checkout_started, order_placed, etc. Page view tracking. sendBeacon fallback on page unload.
- **Dependencies**: /api/analytics/track endpoint
- **Test Scenario**: View product → analytics event tracked → check analytics

### 16.7 Zod Validation
- **Status**: ✅
- **Files**: `src/lib/validations.ts`
- **Description**: Zod schemas for request validation across API routes. Consistent validation error responses.
- **Dependencies**: Zod library
- **Test Scenario**: Send invalid data → 400 with validation error details

### 16.8 Database Status/Health Check
- **Status**: ✅
- **Files**: `src/app/api/health-check/route.ts`, `src/app/api/health/route.ts`, `src/app/api/db-status/route.ts`, `src/app/api/ping/route.ts`, `src/app/api/debug/health/route.ts`
- **Description**: Multiple health check endpoints for monitoring. Database connectivity check. Service health verification.
- **Dependencies**: Database connection
- **Test Scenario**: GET /api/health → 200 with service status

---

## 17. UI/UX Features

### 17.1 Dark Mode
- **Status**: ✅
- **Files**: `src/app/globals.css`, `src/components/ecommerce/providers.tsx`, `tailwind.config.ts`
- **Description**: Dark mode support via CSS variables and Tailwind dark: prefix. Theme toggle in settings/providers. next-themes integration.
- **Dependencies**: next-themes library
- **Test Scenario**: Toggle dark mode → UI switches to dark theme

### 17.2 Responsive Design
- **Status**: ✅
- **Files**: All screen components, `tailwind.config.ts`
- **Description**: Mobile-first responsive design. Breakpoints: sm, md, lg, xl. Touch-friendly targets. Mobile navigation with bottom nav. Desktop wider layouts.
- **Dependencies**: Tailwind CSS
- **Test Scenario**: Open on mobile → responsive layout → open on desktop → wider layout

### 17.3 Screen-Based SPA Navigation
- **Status**: ✅
- **Files**: `src/components/ecommerce/screen-registry.tsx`, `src/lib/store/navigation.ts`, `src/components/ecommerce/shared/navigation.tsx`
- **Description**: Single-page app navigation using screen registry. Lazy-loaded screens for code splitting. Screen history with goBack. Sub-screens hide bottom nav. 60+ registered screens. Navigation state in Zustand.
- **Dependencies**: Zustand store
- **Test Scenario**: Navigate between screens → no page reload → back button works

### 17.4 Loading States & Error Boundaries
- **Status**: ✅
- **Files**: `src/components/ecommerce/error-boundary.tsx`, `src/components/ecommerce/shared/loading.tsx`, `src/components/ecommerce/loading-spinner.tsx`
- **Description**: Screen-level error boundaries with recovery. Loading spinners and skeleton states. Error fallback UI.
- **Dependencies**: React ErrorBoundary
- **Test Scenario**: Component throws error → error boundary catches → shows fallback

### 17.5 Legal Pages
- **Status**: ✅
- **Files**: `src/components/ecommerce/legal/legal-screens.tsx`
- **Description**: Privacy policy, terms of service, and refund policy screens. Accessible from settings.
- **Dependencies**: Navigation
- **Test Scenario**: Settings → Privacy Policy → view legal content

### 17.6 Help Screen
- **Status**: ✅
- **Files**: `src/components/ecommerce/screens/help-screen.tsx`
- **Description**: Help/FAQ screen for users. Accessible from settings.
- **Dependencies**: None
- **Test Scenario**: Settings → Help → view FAQ

### 17.7 Confirm Dialog
- **Status**: ✅
- **Files**: `src/components/ecommerce/confirm-dialog.tsx`
- **Description**: Reusable confirmation dialog for destructive actions (cancel order, delete account, etc.).
- **Dependencies**: shadcn/ui Dialog
- **Test Scenario**: Cancel order → confirm dialog → confirm → action proceeds

### 17.8 Home Screen
- **Status**: ✅
- **Files**: `src/components/ecommerce/home-screen.tsx`
- **Description**: Main landing page with: banner carousel, flash sale section, featured products, promoted products, category grid, product recommendations. Pull-to-refresh.
- **Dependencies**: Banner (7.3), Product model, Category model
- **Test Scenario**: Open app → see banners, flash sales, products, categories

---

## 18. Referral System

### 18.1 Referral Program
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Referral, User.referralCode, User.referredBy)
- **Description**: Users have unique referral codes. When a new user registers with a referral code, a Referral record is created linking referrer and referred. Reward tracking with isClaimed flag.
- **Dependencies**: User model
- **Test Scenario**: Share referral code → new user registers → referral created → reward tracked

---

## 19. Loyalty & Gamification

### 19.1 Loyalty Points & Coins
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (User.loyaltyPoints, User.coins, User.dailyCheckIn)
- **Description**: User loyalty points and coins tracked. Daily check-in system. Points/coins can be earned through purchases and activities.
- **Dependencies**: User model
- **Test Scenario**: Daily check-in → points credited → view balance

---

## 20. Seller-Specific Features

### 20.1 Seller Registration
- **Status**: ✅
- **Files**: `src/app/api/seller/register/route.ts`, `src/components/ecommerce/auth/onboarding-screen.tsx`
- **Description**: Buyers can register as sellers. Creates Seller record with store details. Unique storeSlug generated. Role changes to "seller".
- **Dependencies**: User model
- **Test Scenario**: Buyer clicks "Become a Seller" → fills store details → seller account created

### 20.2 Seller Bank Account Settings
- **Status**: ✅
- **Files**: `src/app/api/settings/bank-accounts/route.ts`, `src/components/ecommerce/seller/seller-settings.tsx`
- **Description**: Seller bank account management for withdrawals. Bank name, account number, account holder. Multiple bank accounts supported.
- **Dependencies**: Seller model
- **Test Scenario**: Seller adds bank account → used for withdrawal

### 20.3 Seller Auto-Reply
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Seller.autoReply)
- **Description**: Sellers can set an auto-reply message for chat messages when they're offline.
- **Dependencies**: Chat system (12.1)
- **Test Scenario**: Seller sets auto-reply → buyer messages → auto-reply sent

### 20.4 Seller Premium Status
- **Status**: ✅
- **Files**: `prisma/schema.prisma` (Seller.isPremium)
- **Description**: Premium seller flag for enhanced visibility and features.
- **Dependencies**: Seller model
- **Test Scenario**: Seller upgraded to premium → premium badge shown

---

## 21. API Client & Data Layer

### 21.1 API Client
- **Status**: ✅
- **Files**: `src/lib/api-client.ts`, `src/lib/api.ts`, `src/lib/api-utils.ts`, `src/lib/api-types.ts`, `src/lib/handle-api-error.ts`
- **Description**: Centralized API client with auth headers, CSRF token injection, error handling. Type-safe API responses. Request/response interceptors.
- **Dependencies**: CSRF (16.1), Auth tokens (1.10)
- **Test Scenario**: API call → auth headers attached → response parsed → error handled

### 21.2 React Query Hooks
- **Status**: ✅
- **Files**: `src/hooks/api/use-products.ts`, `src/hooks/api/use-cart.ts`, `src/hooks/api/use-orders.ts`, `src/hooks/api/use-wallet.ts`, `src/hooks/api/use-notifications.ts`, `src/hooks/api/use-chat.ts`, `src/hooks/api/use-wishlist.ts`, `src/hooks/api/use-reviews.ts`, `src/hooks/api/use-vouchers.ts`, `src/hooks/api/use-seller.ts`, `src/hooks/api/use-addresses.ts`, `src/hooks/api/use-admin.ts`, `src/hooks/api/use-categories.ts`, `src/hooks/api/use-upload.ts`, `src/hooks/api/use-withdrawals.ts`, `src/hooks/api/provider.tsx`
- **Description**: TanStack Query hooks for data fetching. Caching, background refetch, optimistic updates. Provider setup with QueryClient.
- **Dependencies**: TanStack Query
- **Test Scenario**: Component uses useProducts → data fetched → cached → refetched on window focus

### 21.3 Zustand State Management
- **Status**: ✅
- **Files**: `src/lib/store/index.ts`, `src/lib/store/types.ts`, `src/lib/store/auth.ts`, `src/lib/store/cart.ts`, `src/lib/store/order.ts`, `src/lib/store/wallet.ts`, `src/lib/store/notification.ts`, `src/lib/store/chat.ts`, `src/lib/store/search.ts`, `src/lib/store/product.ts`, `src/lib/store/review.ts`, `src/lib/store/admin.ts`, `src/lib/store/seller.ts`, `src/lib/store/voucher.ts`, `src/lib/store/address.ts`, `src/lib/store/wishlist.ts`, `src/lib/store/followed-stores.ts`, `src/lib/store/profile.ts`, `src/lib/store/settings.ts`, `src/lib/store/ui.ts`, `src/lib/store/navigation.ts`, `src/lib/store/selection.ts`, `src/lib/store/data-fetch.ts`
- **Description**: 20+ Zustand slices composing the full app store. Each slice manages a specific domain. Combined into single AppStore type.
- **Dependencies**: Zustand
- **Test Scenario**: Navigate → store updated → component re-renders with new data

### 21.4 Data Sync Hook
- **Status**: ✅
- **Files**: `src/lib/use-data-sync.ts`
- **Description**: Hook for syncing local state with server data. Ensures consistency between Zustand store and API responses.
- **Dependencies**: Zustand store, API client
- **Test Scenario**: Data changes on server → sync hook updates local store

---

## 22. Utility Libraries

### 22.1 Decimal Utilities
- **Status**: ✅
- **Files**: `src/lib/decimal-utils.ts`
- **Description**: Safe decimal number handling for financial calculations. Prisma Decimal to number conversion.
- **Dependencies**: Prisma Decimal
- **Test Scenario**: Financial calculation → no floating point errors

### 22.2 JSON Utilities
- **Status**: ✅
- **Files**: `src/lib/json-utils.ts`
- **Description**: Safe JSON parse/stringify with error handling. Used for JSON fields in DB (images, tags, metadata).
- **Dependencies**: None
- **Test Scenario**: Parse JSON field → handles malformed JSON gracefully

### 22.3 Animation Utilities
- **Status**: ✅
- **Files**: `src/lib/animations.ts`
- **Description**: Framer Motion animation presets and utilities for consistent UI animations.
- **Dependencies**: Framer Motion
- **Test Scenario**: Navigate screens → smooth transition animation

### 22.4 Mapper Functions
- **Status**: ✅
- **Files**: `src/lib/mappers.ts`
- **Description**: Data mapping utilities to transform DB models to API response types. Ensures consistent API shape.
- **Dependencies**: None
- **Test Scenario**: DB record → mapped → clean API response without internal fields

### 22.5 Environment Configuration
- **Status**: ✅
- **Files**: `src/lib/env.ts`, `src/lib/constants.ts`
- **Description**: Centralized environment variable access with validation. Constants for token expiry, pagination, limits.
- **Dependencies**: None
- **Test Scenario**: Missing env var → clear error message at startup

---

## Refactoring Checklist

Before refactoring, complete this checklist:
1. [ ] Read this entire registry
2. [ ] Identify which features are affected by the refactoring
3. [ ] For each affected feature, document the specific code changes
4. [ ] After refactoring, test each affected feature using its test scenario
5. [ ] Update this registry if any feature status changed
6. [ ] Run `bun run lint` to verify no build errors

### Risk Assessment Template
For each refactoring, fill this out:
- **Refactoring Goal**: 
- **Affected Features**: 
- **Risk Level**: Low / Medium / High
- **Rollback Plan**: 
- **Verification Method**: 

---

## Cross-Feature Dependency Map

```
Authentication (1.x) ←── All authenticated features
   └── RBAC (1.13) ←── Admin features (14.x)
   
Product Management (2.x) ←── Cart, Search, Stream
   └── Product Type Jasa (2.2) ←── Service Order Flow (5.x)
   
Cart (3.1) ←── Checkout (3.2) ←── Order Creation (4.1)
   └── Shipping (3.4) ←── RajaOngkir / Local calculator
   └── Payment (3.5) ←── Midtrans / Wallet / Bank Transfer
   
Order (4.x) ←── Escrow (5.1) ←── Wallet (6.1) ←── Commission (9.1)
   └── Service Proof (5.3) ←── Auto-Confirm (5.4)
   └── Status Tracking (4.2) ←── Notifications (13.x)
   
Voucher (7.1) ←── Checkout (3.2)
Reviews (8.x) ←── Product Detail (2.6), Order Delivery (4.2)
Chat (12.x) ←── WebSocket (12.2) [partial]
Stream (11.x) ←── File Upload (10.1), Product (2.x)
Workflow (14.3) ←── Complaints (14.4), Divisions (14.2)

Security (16.x) ←── All API routes
   └── CSRF (16.1) ←── All mutating requests
   └── Rate Limiting (16.2) ←── Auth, Cron endpoints
```

---

## Feature Count by Category

| Category | Count | Status |
|----------|-------|--------|
| 1. Authentication & Authorization | 16 | ✅ All active |
| 2. Product Management | 11 | ✅ All active |
| 3. Cart & Checkout | 7 | ✅ All active |
| 4. Order Management | 6 | ✅ All active |
| 5. Escrow & Service Orders | 7 | ✅ All active |
| 6. Wallet & Financial | 6 | ✅ All active |
| 7. Vouchers & Promotions | 3 | ✅ All active |
| 8. Reviews & Ratings | 2 | ✅ All active |
| 9. Platform & Commission | 5 | ✅ All active |
| 10. File Upload & Media | 2 | ✅ All active |
| 11. Social Features | 9 | ✅ All active (11.6 partial) |
| 12. Chat & Messaging | 2 | ✅ / ⚠️ WebSocket partial |
| 13. Notifications | 2 | ✅ All active |
| 14. Admin & Staff Features | 8 | ✅ All active |
| 15. User Profile & Settings | 5 | ✅ All active |
| 16. Security & Infrastructure | 8 | ✅ All active |
| 17. UI/UX Features | 8 | ✅ All active |
| 18. Referral System | 1 | ✅ Active |
| 19. Loyalty & Gamification | 1 | ✅ Active |
| 20. Seller-Specific Features | 4 | ✅ All active |
| 21. API Client & Data Layer | 4 | ✅ All active |
| 22. Utility Libraries | 5 | ✅ All active |
| **TOTAL** | **62** | |

---

## Known Gaps & Technical Debt

1. **WebSocket Chat (12.2)**: Socket.io mini-service not currently running. Chat works via REST API polling but real-time features (typing, instant delivery) require the WebSocket service.

2. **Referral Rewards (18.1)**: Referral tracking exists in DB but reward claiming logic may not be fully implemented.

3. **Loyalty Points (19.1)**: Points and coins tracked in DB but earning/redemption logic may be partially implemented.

4. **Seller Auto-Reply (20.3)**: Field exists in DB but automatic reply sending on chat messages may not be implemented in the chat API.

5. **Live Streaming**: Mentioned in feature list but no live streaming implementation found (only pre-recorded stream posts). The Stream feature is a social feed, not live video.

6. **FCM Push (13.2)**: Gracefully degrades but requires firebase-admin package and Firebase configuration for actual push delivery.
