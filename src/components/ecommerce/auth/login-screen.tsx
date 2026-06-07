"use client"

import { motion } from "framer-motion"
import { Eye, EyeOff, Smartphone, Mail, Apple } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useAppStore, useCartStore, useWishlistStore } from "@/lib/store"
import { PageHeader } from "@/components/ecommerce/shared"
import { signIn } from "next-auth/react"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import type { User, UserRole } from "@/lib/types"
import { logger } from '@/lib/logger'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { setAuthFlagCookie } from '@/lib/session-cookie'
import { MartUpLogo, pageVariants, pageTransition, isValidPhone, isValidEmailOrPhone, type LoginResponse } from './shared'

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
        OAuthAccountNotLinked: 'Email sudah terdaftar. Login dengan password, lalu hubungkan Google di pengaturan akun.',
        EmailCreateAccount: 'Gagal membuat akun dengan email ini.',
        Callback: 'Terjadi kesalahan saat login. Coba lagi.',
        google_oauth_not_configured: 'Login Google belum dikonfigurasi. Hubungi admin.',
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
      // SECURITY: Pass userId (not phone) to prevent phone number enumeration.
      // The OTP send endpoint looks up the phone server-side from the userId.
      if (data.success && data.requires2FA) {
        useAppStore.setState({ 
          otpPhoneNumber: '', 
          otpUserId: data.userId || '',
          otpMaskedPhone: data.maskedPhone || '',
        })
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
        const { fetchUserData, connectSocket } = useAppStore.getState()
        await fetchUserData(data.user.id)
        // Merge local cart to server & connect WebSocket
        useCartStore.getState().mergeLocalToServer(data.user.id)
        useWishlistStore.getState().syncWishlistFromServer(data.user.id)
        connectSocket()
      } else {
        // Show the server error message (e.g., "Email atau password salah")
        showToast(data.error || 'Login gagal. Periksa email dan password Anda.', 'error')
      }
    } catch (error) {
      logger.warn({ component: 'auth', err: error }, 'Login failed')
      if (error instanceof ApiClientError) {
        showToast(error.message, 'error')
      } else {
        showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
      }
    }

    setIsLoading(false)
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      // For OAuth providers (Google), we MUST use redirect: true (default).
      // With redirect: false, NextAuth returns the OAuth URL but doesn't navigate,
      // so the user never reaches Google's consent screen.
      // Errors are handled via URL ?error= param (see useEffect above).
      await signIn('google', { callbackUrl: '/' })
      // Note: After this call, the browser will redirect to Google.
      // If Google auth fails, it redirects back with ?error= in the URL.
      // If it succeeds, the user lands on the home page authenticated.
      // We don't set isLoading=false here because the page will navigate away.
    } catch (err) {
      showToast('Gagal terhubung ke Google. Coba lagi.', 'error')
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
