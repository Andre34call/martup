"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, ArrowLeft, Smartphone, Mail, Apple, CheckCircle, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { useAppStore, useCartStore, useWishlistStore } from "@/lib/store"
import { PageHeader } from "@/components/ecommerce/shared"
import { signIn } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import type { User, UserRole } from "@/lib/types"
import { logger } from '@/lib/logger'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { loginSchema } from '@/lib/validations'
import { setAuthFlagCookie } from '@/lib/session-cookie'

// ==================== TYPE ALIASES ====================
type LoginResponse = { success: boolean; requiresVerification?: boolean; requires2FA?: boolean; email?: string; phone?: string; userId?: string; message?: string; token?: string; isSuperAdmin?: boolean; user?: { id: string; email: string; phone?: string; name: string; avatar?: string; role?: string; isVerified?: boolean; loyaltyPoints?: number; coins?: number; twoFactorEnabled?: boolean }; devOtp?: string; error?: string }
type RegisterResponse = { success: boolean; requiresVerification?: boolean; message?: string; token?: string; isSuperAdmin?: boolean; user?: { id: string; email: string; phone?: string; name: string; avatar?: string; role?: string; isVerified?: boolean; loyaltyPoints?: number; coins?: number; twoFactorEnabled?: boolean }; devVerifyUrl?: string; error?: string }
type ResendVerificationResponse = { success: boolean; alreadyVerified?: boolean; message?: string; devVerifyUrl?: string; error?: string }
type OtpSendResponse = { success: boolean; message?: string; devOtp?: string; error?: string }
type OtpVerifyResponse = { success: boolean; token?: string; user?: { id: string; email?: string; phone?: string; name: string; avatar?: string; role?: string; loyaltyPoints?: number; coins?: number; twoFactorEnabled?: boolean }; error?: string }
type ForgotPasswordResponse = { success: boolean; message?: string; error?: string }
type ResetPasswordResponse = { success: boolean; message?: string; error?: string }

// ==================== VALIDATION HELPERS ====================
function isValidEmail(email: string): boolean {
  return loginSchema.shape.email.safeParse(email).success
}
function isValidPhone(phone: string): boolean {
  return /^(0|\+62|62)\d{9,12}$/.test(phone.replace(/[\s-]/g, ''))
}
function isValidPassword(password: string): boolean {
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
}
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++

  if (score <= 2) return { score, label: 'Lemah', color: 'bg-red-500' }
  if (score <= 3) return { score, label: 'Sedang', color: 'bg-yellow-500' }
  if (score <= 4) return { score, label: 'Kuat', color: 'bg-emerald-400' }
  return { score, label: 'Sangat Kuat', color: 'bg-emerald-600' }
}
function getPasswordRules(password: string) {
  return [
    { label: 'Minimal 8 karakter', met: password.length >= 8 },
    { label: 'Huruf kecil (a-z)', met: /[a-z]/.test(password) },
    { label: 'Huruf besar (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Angka (0-9)', met: /\d/.test(password) },
    { label: 'Karakter khusus (!@#$% dll)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ]
}
function isValidEmailOrPhone(value: string): boolean {
  return isValidEmail(value) || isValidPhone(value)
}

// ==================== PAGE ANIMATION VARIANTS ====================
const pageVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
}

const pageTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
}

// ==================== LOGO COMPONENT ====================
function MartUpLogo({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-5xl",
  }

  return (
    <span
      className={`${sizeMap[size]} font-extrabold bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 bg-clip-text text-transparent`}
    >
      MartUp
    </span>
  )
}

// ==================== SPLASH SCREEN ====================
export function SplashScreen() {
  const { navigate, isAuthenticated } = useAppStore()
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((prev) => (prev + 1) % 4)
    }, 500)

    const navTimer = setTimeout(() => {
      if (isAuthenticated) {
        navigate("home")
      } else {
        navigate("onboarding")
      }
    }, 2000)

    return () => {
      clearInterval(dotTimer)
      clearTimeout(navTimer)
    }
  }, [navigate, isAuthenticated])

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-emerald-50 dark:from-background dark:to-emerald-950/20"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <MartUpLogo size="lg" />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-sm text-muted-foreground font-medium"
        >
          Shop Smart, Live Better
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="mt-12 flex items-center gap-1.5"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: i < dots ? [1, 1.3, 1] : 1,
              backgroundColor: i < dots ? "#10b981" : "#d1d5db",
            }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
            className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600"
          />
        ))}
      </motion.div>
    </motion.div>
  )
}

// ==================== ONBOARDING SCREEN ====================
const onboardingSlides = [
  {
    emoji: "🛍️",
    title: "Temukan Produk Terbaik",
    description: "Jutaan produk berkualitas dari seller terpercaya",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    emoji: "💰",
    title: "Harga Terbaik & Promo",
    description: "Flash sale, voucher, dan cashback setiap hari",
    gradient: "from-orange-400 to-amber-500",
  },
  {
    emoji: "🚀",
    title: "Pengiriman Cepat",
    description: "Tracking real-time dan pengiriman ke seluruh Indonesia",
    gradient: "from-cyan-400 to-blue-500",
  },
]

export function OnboardingScreen() {
  const { navigate } = useAppStore()
  const [currentSlide, setCurrentSlide] = useState(0)

  const goToNext = useCallback(() => {
    if (currentSlide < onboardingSlides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      navigate("login")
    }
  }, [currentSlide, navigate])

  const handleSkip = useCallback(() => {
    navigate("login")
  }, [navigate])

  const slide = onboardingSlides[currentSlide]

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background"
    >
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            {/* Illustration */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
              className={`w-40 h-40 rounded-full bg-gradient-to-br ${slide.gradient} flex items-center justify-center mb-8 shadow-lg`}
            >
              <span className="text-7xl">{slide.emoji}</span>
            </motion.div>

            <h2 className="text-2xl font-bold text-foreground mb-3">
              {slide.title}
            </h2>
            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section: dots + button */}
      <div className="px-6 pb-10 space-y-8">
        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2">
          {onboardingSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className="focus:outline-none"
            >
              <motion.div
                animate={{
                  width: idx === currentSlide ? 24 : 8,
                  backgroundColor: idx === currentSlide ? "#10b981" : "#d1d5db",
                }}
                transition={{ duration: 0.3 }}
                className="h-2 rounded-full"
              />
            </button>
          ))}
        </div>

        {/* Next / Start button */}
        <Button
          onClick={goToNext}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base"
        >
          {currentSlide === onboardingSlides.length - 1 ? "Mulai Belanja" : "Next"}
        </Button>
      </div>
    </motion.div>
  )
}

// ==================== LOGIN SCREEN ====================
export function LoginScreen() {
  const { navigate, login, showToast } = useAppStore()
  const searchParams = useSearchParams()
  const [emailOrPhone, setEmailOrPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [touchedEmailOrPhone, setTouchedEmailOrPhone] = useState(false)
  const [touchedPassword, setTouchedPassword] = useState(false)

  // Show OAuth error from URL params
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      const errorMessages: Record<string, string> = {
        Configuration: 'Login Google belum dikonfigurasi. Hubungi admin.',
        AccessDenied: 'Akses ditolak oleh Google.',
        Verification: 'Verifikasi gagal. Coba lagi.',
        OAuthSignin: 'Gagal terhubung ke Google. Coba lagi.',
        OAuthCallback: 'Gagal memproses login Google. Coba lagi.',
        OAuthCreateAccount: 'Gagal membuat akun dari Google.',
        EmailCreateAccount: 'Gagal membuat akun dengan email ini.',
        Callback: 'Terjadi kesalahan saat login. Coba lagi.',
        Default: 'Login gagal. Coba lagi nanti.',
      }
      showToast(errorMessages[error] || `Login gagal: ${error}`, 'error')
      // Clean URL without reload
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams, showToast])

  const emailOrPhoneError = touchedEmailOrPhone && emailOrPhone
    ? (!isValidEmailOrPhone(emailOrPhone) ? "Masukkan email atau nomor HP yang valid" : "")
    : touchedEmailOrPhone && !emailOrPhone
    ? "Email / No. HP wajib diisi"
    : ""

  const passwordError = touchedPassword && !password
    ? "Password wajib diisi"
    : ""

  const isFormValid = emailOrPhone && password && !emailOrPhoneError && !passwordError

  const handleLogin = async () => {
    // Mark fields as touched to show validation errors
    setTouchedEmailOrPhone(true)
    setTouchedPassword(true)

    // Trim whitespace from email to avoid hidden-char login failures
    // Also lowercase emails (but not phone numbers) to match server normalization
    const trimmedInput = isValidPhone(emailOrPhone.trim())
      ? emailOrPhone.trim()
      : emailOrPhone.trim().toLowerCase()

    // Re-validate after trimming (fix stale state race condition)
    const hasInput = trimmedInput && password
    const inputIsValid = isValidEmailOrPhone(trimmedInput)
    const passwordValid = password.length > 0
    if (!hasInput || !inputIsValid || !passwordValid) return

    setIsLoading(true)

    try {
      // If input is a phone number, redirect to OTP flow with the phone number
      if (isValidPhone(trimmedInput)) {
        // Navigate to OTP screen - the phone number will be passed via store
        useAppStore.setState({ otpPhoneNumber: trimmedInput })
        navigate('otp')
        setIsLoading(false)
        return
      }

      // Email + password login
      // Use rawPost to read response body even on 403 (requiresVerification)
      const res = await apiClient.rawPost('/api/auth/login', { email: trimmedInput, password, rememberMe })
      const data: LoginResponse = await res.json()

      // Email verification check — if email not verified, redirect to verification screen
      if (!data.success && data.requiresVerification) {
        useAppStore.setState({ pendingVerificationEmail: data.email || trimmedInput })
        navigate('email-verification')
        showToast(data.error || 'Email belum diverifikasi', 'error')
        setIsLoading(false)
        return
      }

      // 2FA check — if user has 2FA enabled, redirect to OTP verification
      if (data.success && data.requires2FA) {
        useAppStore.setState({ otpPhoneNumber: data.phone || '' })
        navigate('otp')
        showToast(data.message || 'Verifikasi 2FA diperlukan', 'info')
        setIsLoading(false)
        return
      }

      if (data.success && data.user) {
        // Auth token is now stored in httpOnly session cookie by the server.
        // Set a non-httpOnly flag cookie so client can detect auth state quickly.
        setAuthFlagCookie()
        const user: User & { isSuperAdmin?: boolean } = {
          id: data.user.id,
          email: data.user.email,
          phone: data.user.phone || undefined,
          name: data.user.name,
          avatar: data.user.avatar || undefined,
          role: (data.user.role || 'buyer') as UserRole,
          isVerified: data.user.isVerified || false,
          loyaltyPoints: data.user.loyaltyPoints || 0,
          coins: data.user.coins || 0,
          twoFactorEnabled: data.user.twoFactorEnabled || false,
          isSuperAdmin: data.isSuperAdmin || false,
        }
        login(user)
        // Fire-and-forget: these are non-critical data sync operations.
        // Don't await them — they should not block the login flow or keep the loading spinner.
        // If they fail, the data will be loaded on-demand when the user navigates.
        const { fetchUserData, connectSocket } = useAppStore.getState()
        fetchUserData(data.user.id).catch(() => {})
        useCartStore.getState().mergeLocalToServer(data.user.id).catch(() => {})
        useWishlistStore.getState().syncWishlistFromServer(data.user.id).catch(() => {})
        connectSocket()
      } else {
        // Show the server error message (e.g., "Email atau password salah")
        showToast(data.error || 'Login gagal. Periksa email dan password Anda.', 'error')
      }
    } catch (error) {
      // Handle timeout (AbortError from fetchWithTimeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        showToast('Koneksi timeout. Periksa koneksi internet Anda dan coba lagi.', 'error')
      } else if (error instanceof ApiClientError) {
        showToast(error.message, 'error')
      } else {
        logger.warn({ component: 'auth', err: error }, 'Login failed')
        showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      // Use redirect: false so we can handle errors ourselves
      const result = await signIn('google', { callbackUrl: '/', redirect: false })
      if (result?.error) {
        const errorMessages: Record<string, string> = {
          Configuration: 'Login Google belum dikonfigurasi. Hubungi admin.',
          AccessDenied: 'Akses ditolak oleh Google.',
          Verification: 'Verifikasi gagal. Coba lagi.',
          OAuthSignin: 'Gagal terhubung ke Google. Coba lagi.',
          OAuthCallback: 'Gagal memproses login Google. Coba lagi.',
          OAuthCreateAccount: 'Gagal membuat akun dari Google.',
          Default: 'Login gagal. Coba lagi nanti.',
        }
        showToast(errorMessages[result.error] || `Login gagal: ${result.error}`, 'error')
      } else if (result?.ok) {
        // Google login successful — NextAuth session is now active
        // Set auth flag cookie so DataFetcher can detect the session
        setAuthFlagCookie()
        showToast('Login Google berhasil!', 'success')
        // DataFetcher will detect the NextAuth session and call /api/auth/me
        // to populate the user data in the store
      }
    } catch (err) {
      showToast('Gagal terhubung ke Google. Coba lagi.', 'error')
    } finally {
      // Always reset loading state regardless of outcome
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background"
    >
      {/* Header */}
      <PageHeader title="Login" onBack={() => navigate("onboarding")} />

      {/* Logo + Form */}
      <div className="flex-1 flex flex-col px-6 pb-8">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <MartUpLogo size="md" />
      </div>

      {/* Welcome text */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Selamat Datang! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Masuk ke akunmu untuk mulai belanja
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleLogin() }}
        className="space-y-4 flex-1"
      >
        {/* Email/Phone input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Email / No. HP
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              onBlur={() => setTouchedEmailOrPhone(true)}
              placeholder="contoh@email.com atau 08123456789"
              className={`pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${emailOrPhoneError ? "border-red-500 focus:border-red-500" : ""}`}
            />
          </div>
          {emailOrPhoneError && (
            <p className="text-xs text-red-500">{emailOrPhoneError}</p>
          )}
        </div>

        {/* Password input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouchedPassword(true)}
              placeholder="Masukkan password"
              className={`pl-4 pr-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${passwordError ? "border-red-500 focus:border-red-500" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {passwordError && (
            <p className="text-xs text-red-500">{passwordError}</p>
          )}
        </div>

        {/* Remember Me + Forgot password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
            <label htmlFor="remember-me" className="text-xs text-muted-foreground cursor-pointer select-none">
              Ingat saya
            </label>
          </div>
          <button
            type="button"
            onClick={() => navigate("forgot-password")}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            Lupa Password?
          </button>
        </div>

        {/* Login button */}
        <Button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base disabled:opacity-50"
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            "Masuk"
          )}
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3 py-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground font-medium">atau</span>
          <Separator className="flex-1" />
        </div>

        {/* Social login */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-xl font-medium text-sm border-border/50"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Masuk dengan Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-xl font-medium text-sm border-border/50 relative overflow-hidden opacity-70"
            onClick={() => showToast("Apple Sign-In segera hadir!", "info")}
            disabled={true}
          >
            <Apple className="w-5 h-5 mr-2" />
            Masuk dengan Apple
            <span className="absolute top-1.5 right-3 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
              Segera Hadir
            </span>
          </Button>
        </div>

        {/* OTP login */}
        <button
          type="button"
          onClick={() => navigate("otp")}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
        >
          <Smartphone className="w-4 h-4" />
          Masuk dengan OTP
        </button>
      </form>

      {/* Register link */}
      <div className="flex items-center justify-center gap-1 pt-4">
        <span className="text-sm text-muted-foreground">Belum punya akun?</span>
        <button
          onClick={() => navigate("register")}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
        >
          Daftar
        </button>
      </div>
      </div>
    </motion.div>
  )
}

// ==================== REGISTER SCREEN ====================
export function RegisterScreen() {
  const { navigate, login, showToast } = useAppStore()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [touchedFields, setTouchedFields] = useState({ name: false, email: false, phone: false, password: false, confirmPassword: false })

  const nameError = touchedFields.name && name
    ? (name.length < 2 ? "Nama minimal 2 karakter" : /^\d+$/.test(name) ? "Nama tidak boleh hanya angka" : "")
    : touchedFields.name && !name
    ? "Nama wajib diisi"
    : ""

  const emailError = touchedFields.email && email
    ? (!isValidEmail(email) ? "Format email tidak valid" : "")
    : touchedFields.email && !email
    ? "Email wajib diisi"
    : ""

  const phoneError = touchedFields.phone && phone
    ? (!isValidPhone(phone) ? "Nomor HP harus dimulai dengan 0 atau +62, minimal 10 digit" : "")
    : touchedFields.phone && !phone
    ? "No. HP wajib diisi"
    : ""

  const passwordError = touchedFields.password && password
    ? (!isValidPassword(password)
      ? (password.length < 8 ? "Password minimal 8 karakter"
        : !/[a-z]/.test(password) ? "Password harus mengandung huruf kecil"
        : !/[A-Z]/.test(password) ? "Password harus mengandung huruf besar"
        : !/\d/.test(password) ? "Password harus mengandung angka"
        : !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? "Password harus mengandung karakter khusus"
        : "")
      : "")
    : touchedFields.password && !password
    ? "Password wajib diisi"
    : ""

  const passwordsMatch = !confirmPassword || password === confirmPassword

  const isFormValid = name && email && phone && password && confirmPassword && agreeTerms
    && !nameError && !emailError && !phoneError && !passwordError && passwordsMatch

  const handleRegister = async () => {
    setTouchedFields({ name: true, email: true, phone: true, password: true, confirmPassword: true })
    if (!isFormValid) return

    setIsLoading(true)

    try {
      const data = await apiClient.post<RegisterResponse>('/api/auth/register', { name, email, phone, password })

      if (data.requiresVerification) {
        // Email verification required — redirect to verification screen
        useAppStore.setState({ pendingVerificationEmail: email })
        navigate('email-verification')
        showToast(data.message || 'Cek email Anda untuk verifikasi!', "success")

        // In dev mode, show the verification link
        if (data.devVerifyUrl && process.env.NODE_ENV === 'development') {
          console.log('[DEV] Verification URL:', data.devVerifyUrl)
        }
      } else if (data.user) {
        // Auto-login: token is in httpOnly session cookie set by server
        setAuthFlagCookie()
        const user: User & { isSuperAdmin?: boolean } = {
          id: data.user.id,
          email: data.user.email,
          phone: data.user.phone || undefined,
          name: data.user.name,
          avatar: data.user.avatar || undefined,
          role: (data.user.role || 'buyer') as UserRole,
          isVerified: data.user.isVerified || false,
          loyaltyPoints: data.user.loyaltyPoints || 0,
          coins: data.user.coins || 0,
          twoFactorEnabled: data.user.twoFactorEnabled || false,
          isSuperAdmin: data.isSuperAdmin || false,
        }
        login(user)
        // Fire-and-forget: non-critical data sync operations
        const { fetchUserData, connectSocket } = useAppStore.getState()
        fetchUserData(data.user.id).catch(() => {})
        useCartStore.getState().mergeLocalToServer(data.user.id).catch(() => {})
        useWishlistStore.getState().syncWishlistFromServer(data.user.id).catch(() => {})
        connectSocket()
        showToast("Registrasi berhasil! 🎉", "success")
      } else {
        showToast('Registrasi gagal. Coba lagi.', "error")
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, "error")
      } else {
        logger.warn({ component: 'auth', err: error }, 'Register failed')
        showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', "error")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background"
    >
      {/* Header */}
      <PageHeader title="Buat Akun" onBack={() => navigate("login")} />

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleRegister() }}
        className="space-y-4 flex-1 overflow-y-auto px-6 pb-8"
      >
        {/* Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Nama Lengkap</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouchedFields((t) => ({ ...t, name: true }))}
            placeholder="Masukkan nama lengkap"
            className={`h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${nameError ? "border-red-500 focus:border-red-500" : ""}`}
          />
          {nameError && (
            <p className="text-xs text-red-500">{nameError}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouchedFields((t) => ({ ...t, email: true }))}
              placeholder="contoh@email.com"
              className={`pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${emailError ? "border-red-500 focus:border-red-500" : ""}`}
            />
          </div>
          {emailError && (
            <p className="text-xs text-red-500">{emailError}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">No. HP</label>
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setTouchedFields((t) => ({ ...t, phone: true }))}
              placeholder="08123456789"
              className={`pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${phoneError ? "border-red-500 focus:border-red-500" : ""}`}
            />
          </div>
          {phoneError && (
            <p className="text-xs text-red-500">{phoneError}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouchedFields((t) => ({ ...t, password: true }))}
              placeholder="Minimal 8 karakter"
              className={`pr-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${passwordError ? "border-red-500 focus:border-red-500" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {touchedFields.password && password && (
            <div className="space-y-1 mt-1">
              <p className={`text-xs ${password.length >= 8 ? "text-emerald-500" : "text-muted-foreground"}`}>
                {password.length >= 8 ? "✓" : "○"} Minimal 8 karakter
              </p>
              <p className={`text-xs ${/[a-z]/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                {/[a-z]/.test(password) ? "✓" : "○"} Huruf kecil (a-z)
              </p>
              <p className={`text-xs ${/[A-Z]/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                {/[A-Z]/.test(password) ? "✓" : "○"} Huruf besar (A-Z)
              </p>
              <p className={`text-xs ${/\d/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                {/\d/.test(password) ? "✓" : "○"} Mengandung angka
              </p>
              <p className={`text-xs ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? "✓" : "○"} Karakter khusus (!@#$% dll)
              </p>
            </div>
          )}
          {passwordError && (
            <p className="text-xs text-red-500">{passwordError}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Konfirmasi Password</label>
          <Input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setTouchedFields((t) => ({ ...t, confirmPassword: true }))}
            placeholder="Ulangi password"
            className={`h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${
              !passwordsMatch ? "border-red-500 focus:border-red-500" : ""
            }`}
          />
          {!passwordsMatch && (
            <p className="text-xs text-red-500">Password tidak cocok</p>
          )}
        </div>

        {/* Terms & Conditions */}
        <div className="flex items-start gap-3 py-2">
          <Checkbox
            id="terms"
            checked={agreeTerms}
            onCheckedChange={(checked) => setAgreeTerms(checked === true)}
            className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
          />
          <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
            Saya setuju dengan{" "}
            <span className="text-emerald-600 font-medium">Syarat & Ketentuan</span>{" "}
            dan{" "}
            <span className="text-emerald-600 font-medium">Kebijakan Privasi</span>{" "}
            MartUp
          </label>
        </div>

        {/* Register button */}
        <Button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base disabled:opacity-50"
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            "Daftar"
          )}
        </Button>
      </form>

      {/* Login link */}
      <div className="flex items-center justify-center gap-1 pt-4">
        <span className="text-sm text-muted-foreground">Sudah punya akun?</span>
        <button
          onClick={() => navigate("login")}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
        >
          Masuk
        </button>
      </div>
    </motion.div>
  )
}

// ==================== EMAIL VERIFICATION SCREEN ====================
export function EmailVerificationScreen() {
  const { navigate, goBack, showToast } = useAppStore()
  const pendingEmail = useAppStore((s) => s.pendingVerificationEmail) || ""
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [manualVerified, setManualVerified] = useState(false)

  // Check URL params for verification result — initialize state from URL
  const [verificationResult] = useState(() => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get('verification') || ''
  })
  const verified = verificationResult === 'success' || manualVerified

  // Handle URL verification result (cleanup URL + show toast)
  useEffect(() => {
    if (verificationResult === 'success') {
      showToast('Email berhasil diverifikasi! Silakan login.', 'success')
      window.history.replaceState({}, '', '/')
    } else if (verificationResult === 'expired') {
      showToast('Link verifikasi sudah kedaluwarsa. Silakan kirim ulang.', 'error')
      window.history.replaceState({}, '', '/')
    } else if (verificationResult === 'error') {
      showToast('Verifikasi gagal. Coba lagi.', 'error')
      window.history.replaceState({}, '', '/')
    }
  }, [verificationResult, showToast])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleResend = async () => {
    if (countdown > 0 || !pendingEmail) return
    setIsResending(true)

    try {
      const data = await apiClient.post<ResendVerificationResponse>('/api/auth/resend-verification', { email: pendingEmail })

      if (data.alreadyVerified) {
        setManualVerified(true)
        showToast('Email sudah terverifikasi! Silakan login.', 'success')
      } else {
        setCountdown(60)
        showToast('Link verifikasi telah dikirim ulang!', 'success')
        // In dev mode, log the URL
        if (data.devVerifyUrl && process.env.NODE_ENV === 'development') {
          console.log('[DEV] Verification URL:', data.devVerifyUrl)
        }
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, 'error')
      } else {
        showToast('Terjadi kesalahan koneksi. Coba lagi.', 'error')
      }
    }

    setIsResending(false)
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background"
    >
      {/* Header */}
      <PageHeader title="Verifikasi Email" onBack={() => navigate('login')} />

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, type: "spring" }}
          className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-6 ${
            verified
              ? "bg-emerald-50 dark:bg-emerald-950/30"
              : "bg-amber-50 dark:bg-amber-950/30"
          }`}
        >
          {verified ? (
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          ) : (
            <Mail className="w-12 h-12 text-amber-500" />
          )}
        </motion.div>

        {verified ? (
          <>
            <h1 className="text-2xl font-bold text-foreground text-center mb-2">
              Email Terverifikasi! ✅
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8 max-w-[280px]">
              Email Anda telah berhasil diverifikasi. Sekarang Anda bisa login.
            </p>
            <Button
              onClick={() => navigate('login')}
              className="w-full max-w-[320px] h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base"
            >
              Masuk Sekarang
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground text-center mb-2">
              Verifikasi Email Anda
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-2 max-w-[280px]">
              Kami telah mengirim link verifikasi ke:
            </p>
            <p className="text-sm font-semibold text-foreground text-center mb-8">
              {pendingEmail || 'email Anda'}
            </p>

            {/* Instructions */}
            <div className="w-full max-w-[320px] space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-emerald-600">1</span>
                </div>
                <p className="text-sm text-muted-foreground">Buka email Anda (cek folder Spam juga)</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-emerald-600">2</span>
                </div>
                <p className="text-sm text-muted-foreground">Klik tombol &quot;Verifikasi Email Saya&quot;</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-emerald-600">3</span>
                </div>
                <p className="text-sm text-muted-foreground">Login dan mulai belanja!</p>
              </div>
            </div>

            {/* Resend button */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Kirim ulang dalam{" "}
                  <span className="font-semibold text-emerald-600">{countdown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={isResending}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold transition-colors disabled:opacity-50"
                >
                  {isResending ? 'Mengirim...' : 'Kirim ulang link verifikasi'}
                </button>
              )}
            </div>

            {/* Change email */}
            <button
              onClick={() => navigate('register')}
              className="text-sm text-muted-foreground hover:text-foreground mt-4 transition-colors"
            >
              Salah email? <span className="text-emerald-600 font-medium">Daftar ulang</span>
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ==================== OTP SCREEN ====================
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return phone
  const visibleStart = digits.slice(0, 4)
  const visibleEnd = digits.slice(-3)
  const maskedMiddle = '*'.repeat(Math.min(digits.length - 7, 4))
  // Format: +62 812****789
  if (digits.startsWith('62')) {
    return `+62 ${digits.slice(2, 4)}${maskedMiddle}${visibleEnd}`
  }
  if (digits.startsWith('0')) {
    return `0${digits.slice(1, 3)}${maskedMiddle}${visibleEnd}`
  }
  return `${visibleStart}${maskedMiddle}${visibleEnd}`
}

export function OTPScreen() {
  const { navigate, login, goBack, showToast } = useAppStore()
  const passedPhone = useAppStore((s) => s.otpPhoneNumber) || ""
  const [phone, setPhone] = useState(passedPhone)
  const [step, setStep] = useState<'phone' | 'otp'>(passedPhone && isValidPhone(passedPhone) ? 'otp' : 'phone')
  const [otp, setOtp] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [touchedPhone, setTouchedPhone] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)

  const phoneError = touchedPhone && !phone
    ? "Nomor HP wajib diisi"
    : touchedPhone && phone && !isValidPhone(phone)
    ? "Nomor HP harus dimulai dengan 0 atau +62, minimal 10 digit"
    : ""

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleResend = async () => {
    if (countdown > 0 || !phone || !isValidPhone(phone)) return
    await handlePhoneSubmit()
  }

  const handlePhoneSubmit = async () => {
    setTouchedPhone(true)
    if (!phone || !isValidPhone(phone)) return
    setIsSending(true)

    try {
      const formattedPhone = phone.startsWith('+') ? phone : phone.startsWith('0') ? '+62' + phone.substring(1) : '+62' + phone

      const data = await apiClient.post<OtpSendResponse>('/api/auth/otp/send', { phone: formattedPhone })

      setStep('otp')
      setCountdown(60)
      // In dev mode, show the OTP for testing
      if (data.devOtp) {
        setDevOtp(data.devOtp)
        setOtp(data.devOtp) // Auto-fill in dev mode
      }
      showToast(data.message || 'Kode OTP telah dikirim', 'success')
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, 'error')
      } else {
        logger.warn({ component: 'auth', err: error }, 'OTP send failed')
        showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
      }
    }

    setIsSending(false)
  }

  const handleVerify = async () => {
    if (otp.length !== 6) return
    if (!phone) {
      showToast('Masukkan nomor HP terlebih dahulu', 'error')
      return
    }
    setIsVerifying(true)

    try {
      const formattedPhone = phone.startsWith('+') ? phone : phone.startsWith('0') ? '+62' + phone.substring(1) : '+62' + phone

      const data = await apiClient.post<OtpVerifyResponse>('/api/auth/otp/verify', { phone: formattedPhone, otpCode: otp })
      if (data.user) {
        // Token is in httpOnly session cookie set by server
        setAuthFlagCookie()
        const user: User & { isSuperAdmin?: boolean } = {
          id: data.user.id,
          email: data.user.email || '',
          phone: data.user.phone || formattedPhone,
          name: data.user.name,
          avatar: data.user.avatar || undefined,
          role: (data.user.role || 'buyer') as UserRole,
          isVerified: true,
          loyaltyPoints: data.user.loyaltyPoints || 0,
          coins: data.user.coins || 0,
          twoFactorEnabled: data.user.twoFactorEnabled || false,
          isSuperAdmin: false, // OTP login users are never Super Admin
        }
        login(user)
        // Fire-and-forget: non-critical data sync operations
        const { fetchUserData, connectSocket } = useAppStore.getState()
        fetchUserData(data.user.id).catch(() => {})
        useCartStore.getState().mergeLocalToServer(data.user.id).catch(() => {})
        useWishlistStore.getState().syncWishlistFromServer(data.user.id).catch(() => {})
        connectSocket()
        showToast('Login berhasil! 🎉', 'success')
      } else {
        showToast('Verifikasi OTP gagal. Coba lagi.', 'error')
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, 'error')
      } else {
        logger.warn({ component: 'auth', err: error }, 'OTP verification failed')
        showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
      }
    }

    setIsVerifying(false)
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background"
    >
      {/* Header */}
      <PageHeader title="Login OTP" onBack={step === 'otp' ? () => setStep('phone') : goBack} />

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pb-8">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, type: "spring" }}
          className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-6 self-center"
        >
          <Smartphone className="w-10 h-10 text-emerald-500" />
        </motion.div>

        {step === 'phone' ? (
          <>
            <h1 className="text-2xl font-bold text-foreground text-center mb-2">
              Masukkan Nomor HP
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Kami akan mengirimkan kode OTP ke nomor HP Anda
            </p>

            {/* Phone input */}
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium text-foreground">No. HP</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setTouchedPhone(true)}
                  placeholder="08123456789"
                  className={`pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${phoneError ? "border-red-500 focus:border-red-500" : ""}`}
                />
              </div>
              {phoneError && (
                <p className="text-xs text-red-500">{phoneError}</p>
              )}
            </div>

            {/* Submit phone button */}
            <Button
              onClick={handlePhoneSubmit}
              disabled={isSending || !phone || !isValidPhone(phone)}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base disabled:opacity-50"
            >
              {isSending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                "Kirim Kode OTP"
              )}
            </Button>
            {/* Dev mode OTP hint */}
            {devOtp && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-2">
                🔧 Dev mode — OTP: <span className="font-mono font-bold">{devOtp}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground text-center mb-2">
              Masukkan kode OTP
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Kode telah dikirim ke <span className="font-medium text-foreground">{maskPhone(phone)}</span>
            </p>

            {/* OTP Input */}
            <div className="flex justify-center mb-8">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-12 h-14 text-lg font-bold rounded-xl border-2 data-[active=true]:border-emerald-500 data-[active=true]:ring-emerald-500/20" />
                  <InputOTPSlot index={1} className="w-12 h-14 text-lg font-bold rounded-xl border-2 data-[active=true]:border-emerald-500 data-[active=true]:ring-emerald-500/20" />
                  <InputOTPSlot index={2} className="w-12 h-14 text-lg font-bold rounded-xl border-2 data-[active=true]:border-emerald-500 data-[active=true]:ring-emerald-500/20" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="w-12 h-14 text-lg font-bold rounded-xl border-2 data-[active=true]:border-emerald-500 data-[active=true]:ring-emerald-500/20" />
                  <InputOTPSlot index={4} className="w-12 h-14 text-lg font-bold rounded-xl border-2 data-[active=true]:border-emerald-500 data-[active=true]:ring-emerald-500/20" />
                  <InputOTPSlot index={5} className="w-12 h-14 text-lg font-bold rounded-xl border-2 data-[active=true]:border-emerald-500 data-[active=true]:ring-emerald-500/20" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {/* Resend */}
            <div className="text-center mb-8">
              {countdown > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Kirim ulang dalam{" "}
                  <span className="font-semibold text-emerald-600">{countdown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                >
                  Kirim Ulang Kode
                </button>
              )}
            </div>

            {/* Verify button */}
            <Button
              onClick={handleVerify}
              disabled={isVerifying || otp.length !== 6}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base disabled:opacity-50"
            >
              {isVerifying ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                "Verifikasi"
              )}
            </Button>
          </>
        )}
      </div>

      {/* Back to login */}
      <div className="flex items-center justify-center gap-1 pt-4">
        <button
          onClick={() => navigate("login")}
          className="text-sm text-muted-foreground hover:text-emerald-600 transition-colors"
        >
          Kembali ke halaman login
        </button>
      </div>
    </motion.div>
  )
}

// ==================== FORGOT PASSWORD SCREEN ====================
export function ForgotPasswordScreen() {
  const { navigate, showToast } = useAppStore()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [touchedEmail, setTouchedEmail] = useState(false)

  const emailError = touchedEmail && !email
    ? "Email wajib diisi"
    : touchedEmail && email && !isValidEmail(email)
    ? "Format email tidak valid"
    : ""

  const isFormValid = email && !emailError

  const handleReset = async () => {
    setTouchedEmail(true)
    if (!isFormValid) return
    setIsLoading(true)

    try {
      const data = await apiClient.post<ForgotPasswordResponse>('/api/auth/forgot-password', { email })

      setIsSent(true)
      showToast(data.message || 'Link reset password telah dikirim ke email Anda', 'success')
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, 'error')
      } else {
        showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background"
    >
      {/* Header */}
      <PageHeader title="Lupa Password" onBack={() => navigate("login")} />

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pb-8">
        {!isSent ? (
          <>
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-6 self-center"
            >
              <Mail className="w-10 h-10 text-emerald-500" />
            </motion.div>

            <h2 className="text-lg font-bold text-foreground text-center mb-2">
              Reset Password
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Masukkan email yang terdaftar. Kami akan mengirimkan link untuk reset password.
            </p>

            {/* Email input */}
            <form onSubmit={(e) => { e.preventDefault(); handleReset() }} className="space-y-2 mb-6">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouchedEmail(true)}
                  placeholder="contoh@email.com"
                  className={`pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${emailError ? "border-red-500 focus:border-red-500" : ""}`}
                />
              </div>
              {emailError && (
                <p className="text-xs text-red-500">{emailError}</p>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base disabled:opacity-50"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  "Kirim Reset Link"
                )}
              </Button>
            </form>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-6"
            >
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </motion.div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              Email Terkirim!
            </h2>
            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
              Kami telah mengirimkan link reset password ke{" "}
              <span className="font-medium text-foreground">{email}</span>. Silakan cek inbox dan folder spam Anda.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Link berlaku selama 1 jam.
            </p>
            <Button
              onClick={() => navigate("login")}
              className="mt-8 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-12 px-8 font-semibold"
            >
              Kembali ke Login
            </Button>
          </motion.div>
        )}
      </div>

      {/* Back to login */}
      {!isSent && (
        <div className="flex items-center justify-center gap-1 pt-4">
          <span className="text-sm text-muted-foreground">Ingat password?</span>
          <button
            onClick={() => navigate("login")}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
          >
            Masuk
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ==================== RESET PASSWORD SCREEN ====================
export function ResetPasswordScreen() {
  const { navigate, showToast } = useAppStore()
  const zustandResetToken = useAppStore((s) => s.resetPasswordToken) || ""
  // Also check sessionStorage in case the user refreshed the page
  // (Zustand state is not persisted, but sessionStorage survives refresh)
  const [sessionResetToken] = useState(() => {
    if (typeof window === 'undefined') return ''
    try { return sessionStorage.getItem('martup_reset_token') || '' } catch { return '' }
  })
  const resetToken = zustandResetToken || sessionResetToken
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [touchedPassword, setTouchedPassword] = useState(false)
  const [touchedConfirm, setTouchedConfirm] = useState(false)

  // If no token, show invalid link message
  const hasToken = !!resetToken

  const passwordError = touchedPassword && !password
    ? "Password baru wajib diisi"
    : touchedPassword && password.length < 8
    ? "Password minimal 8 karakter"
    : touchedPassword && password && !/[a-z]/.test(password)
    ? "Password harus mengandung huruf kecil"
    : touchedPassword && password && !/[A-Z]/.test(password)
    ? "Password harus mengandung huruf besar"
    : touchedPassword && password && !/\d/.test(password)
    ? "Password harus mengandung angka"
    : touchedPassword && password && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ? "Password harus mengandung karakter khusus"
    : ""

  const passwordsMatch = !confirmPassword || password === confirmPassword
  const confirmError = touchedConfirm && !confirmPassword
    ? "Konfirmasi password wajib diisi"
    : touchedConfirm && confirmPassword && !passwordsMatch
    ? "Password tidak cocok"
    : ""

  const isFormValid = password && confirmPassword && !passwordError && !confirmError && passwordsMatch

  const handleResetPassword = async () => {
    setTouchedPassword(true)
    setTouchedConfirm(true)
    if (!isFormValid || !hasToken) return

    setIsLoading(true)
    try {
      const data = await apiClient.post<ResetPasswordResponse>('/api/auth/reset-password', { token: resetToken, password })

      setIsSuccess(true)
      showToast(data.message || 'Password berhasil direset!', 'success')
      // Clear the token from store AND sessionStorage
      useAppStore.setState({ resetPasswordToken: '' })
      try { sessionStorage.removeItem('martup_reset_token') } catch { /* ignore */ }
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, 'error')
      } else {
        showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Invalid/expired token view
  if (!hasToken) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="min-h-screen flex flex-col bg-background"
      >
        <PageHeader title="Reset Password" onBack={() => navigate("login")} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-foreground text-center mb-2">
            Link Tidak Valid
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-[280px]">
            Link reset password sudah kedaluwarsa atau tidak valid. Silakan minta link reset baru.
          </p>
          <Button
            onClick={() => navigate("forgot-password")}
            className="mt-8 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-12 px-8 font-semibold"
          >
            Minta Link Baru
          </Button>
        </div>
      </motion.div>
    )
  }

  // Success view
  if (isSuccess) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="min-h-screen flex flex-col bg-background"
      >
        <PageHeader title="Reset Password" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-6"
          >
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </motion.div>
          <h2 className="text-lg font-bold text-foreground text-center mb-2">
            Password Berhasil Direset! 🎉
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-[280px]">
            Password Anda telah berhasil diubah. Silakan login dengan password baru Anda.
          </p>
          <Button
            onClick={() => navigate("login")}
            className="mt-8 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-12 px-8 font-semibold"
          >
            Login Sekarang
          </Button>
        </div>
      </motion.div>
    )
  }

  // Reset password form
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background"
    >
      <PageHeader title="Reset Password" />

      <div className="flex-1 flex flex-col px-6 pb-8">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, type: "spring" }}
          className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-6 self-center"
        >
          <Shield className="w-10 h-10 text-emerald-500" />
        </motion.div>

        <h2 className="text-lg font-bold text-foreground text-center mb-2">
          Buat Password Baru
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Masukkan password baru untuk akun Anda.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); handleResetPassword() }} className="space-y-4 flex-1">
          {/* New Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password Baru</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouchedPassword(true)}
                placeholder="Minimal 8 karakter"
                className={`pr-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${passwordError ? "border-red-500 focus:border-red-500" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {touchedPassword && password && (
              <div className="space-y-1 mt-1">
                <p className={`text-xs ${password.length >= 8 ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {password.length >= 8 ? "✓" : "○"} Minimal 8 karakter
                </p>
                <p className={`text-xs ${/[a-z]/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {/[a-z]/.test(password) ? "✓" : "○"} Huruf kecil (a-z)
                </p>
                <p className={`text-xs ${/[A-Z]/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {/[A-Z]/.test(password) ? "✓" : "○"} Huruf besar (A-Z)
                </p>
                <p className={`text-xs ${/\d/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {/\d/.test(password) ? "✓" : "○"} Mengandung angka
                </p>
                <p className={`text-xs ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? "✓" : "○"} Karakter khusus (!@#$% dll)
                </p>
              </div>
            )}
            {passwordError && (
              <p className="text-xs text-red-500">{passwordError}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Konfirmasi Password</label>
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setTouchedConfirm(true)}
              placeholder="Ulangi password baru"
              className={`h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20 ${confirmError ? "border-red-500 focus:border-red-500" : ""}`}
            />
            {confirmError && (
              <p className="text-xs text-red-500">{confirmError}</p>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isLoading || !isFormValid}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-semibold text-base disabled:opacity-50"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      </div>
    </motion.div>
  )
}
