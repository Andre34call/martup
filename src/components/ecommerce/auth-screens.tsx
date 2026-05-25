"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, ArrowLeft, Smartphone, Mail, Apple } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { useAppStore } from "@/lib/store"
import { signIn } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import type { User } from "@/lib/types"

// ==================== VALIDATION HELPERS ====================
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
function isValidPhone(phone: string): boolean {
  return /^(0|\+62|62)\d{9,12}$/.test(phone.replace(/[\s-]/g, ''))
}
function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)
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
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-base"
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
  const [emailOrPhone, setEmailOrPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [touchedEmailOrPhone, setTouchedEmailOrPhone] = useState(false)
  const [touchedPassword, setTouchedPassword] = useState(false)

  const emailOrPhoneError = touchedEmailOrPhone && emailOrPhone
    ? (!isValidEmailOrPhone(emailOrPhone) ? "Masukkan email atau nomor HP yang valid" : "")
    : touchedEmailOrPhone && !emailOrPhone
    ? "Email / No. HP wajib diisi"
    : ""

  const passwordError = touchedPassword && !password
    ? "Password wajib diisi"
    : touchedPassword && password.length < 8
    ? "Password minimal 8 karakter"
    : ""

  const isFormValid = emailOrPhone && password && !emailOrPhoneError && !passwordError

  const handleLogin = async () => {
    setTouchedEmailOrPhone(true)
    setTouchedPassword(true)
    if (!isFormValid) return
    setIsLoading(true)

    try {
      // If input is a phone number, redirect to OTP flow with the phone number
      if (isValidPhone(emailOrPhone)) {
        // Navigate to OTP screen - the phone number will be passed via store
        useAppStore.setState({ otpPhoneNumber: emailOrPhone })
        navigate('otp')
        setIsLoading(false)
        return
      }

      // Email + password login
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailOrPhone, password }),
      })
      const data = await res.json()

      if (data.success && data.user) {
        // Store auth token
        if (data.token) {
          localStorage.setItem('authToken', data.token)
        }
        const user: User = {
          id: data.user.id,
          email: data.user.email,
          phone: data.user.phone || undefined,
          name: data.user.name,
          avatar: data.user.avatar || undefined,
          role: data.user.role || 'buyer',
          isVerified: data.user.isVerified || false,
          loyaltyPoints: data.user.loyaltyPoints || 0,
          coins: data.user.coins || 0,
        }
        login(user)
        const { fetchUserData } = useAppStore.getState()
        await fetchUserData(data.user.id)
      } else {
        showToast(data.error || 'Login gagal. Periksa email dan password Anda.', 'error')
      }
    } catch (error) {
      console.error('Login failed:', error)
      showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
    }

    setIsLoading(false)
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background px-6 pt-12 pb-8"
    >
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
      <div className="space-y-4 flex-1">
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

        {/* Forgot password */}
        <div className="flex justify-end">
          <button
            onClick={() => navigate("forgot-password")}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            Lupa Password?
          </button>
        </div>

        {/* Login button */}
        <Button
          onClick={handleLogin}
          disabled={isLoading || !isFormValid}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-base disabled:opacity-50"
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
            variant="outline"
            className="w-full h-12 rounded-xl font-medium text-sm border-border/50"
            onClick={() => showToast("Apple Sign-In segera hadir!", "info")}
            disabled={isLoading}
          >
            <Apple className="w-5 h-5 mr-2" />
            Masuk dengan Apple
          </Button>
        </div>

        {/* OTP login */}
        <button
          onClick={() => navigate("otp")}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
        >
          <Smartphone className="w-4 h-4" />
          Masuk dengan OTP
        </button>
      </div>

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
    ? (name.length < 3 ? "Nama minimal 3 karakter" : /^\d+$/.test(name) ? "Nama tidak boleh hanya angka" : "")
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
        : !/[a-zA-Z]/.test(password) ? "Password harus mengandung huruf"
        : !/\d/.test(password) ? "Password harus mengandung angka"
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      })
      const data = await res.json()

      if (data.success && data.user) {
        // Store auth token if provided
        if (data.token) {
          localStorage.setItem('authToken', data.token)
        }
        const user: User = {
          id: data.user.id,
          email: data.user.email,
          phone: data.user.phone || undefined,
          name: data.user.name,
          avatar: data.user.avatar || undefined,
          role: data.user.role || 'buyer',
          isVerified: data.user.isVerified || false,
          loyaltyPoints: data.user.loyaltyPoints || 0,
          coins: data.user.coins || 0,
        }
        login(user)
        showToast("Registrasi berhasil! 🎉", "success")
      } else {
        showToast(data.error || 'Registrasi gagal. Coba lagi.', "error")
      }
    } catch (error) {
      console.error('Register failed:', error)
      showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', "error")
    }

    setIsLoading(false)
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background px-6 pt-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("login")}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Buat Akun</h1>
          <p className="text-xs text-muted-foreground">Isi data untuk mendaftar</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4 flex-1 overflow-y-auto">
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
              <p className={`text-xs ${/[a-zA-Z]/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                {/[a-zA-Z]/.test(password) ? "✓" : "○"} Mengandung huruf
              </p>
              <p className={`text-xs ${/\d/.test(password) ? "text-emerald-500" : "text-muted-foreground"}`}>
                {/\d/.test(password) ? "✓" : "○"} Mengandung angka
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
          onClick={handleRegister}
          disabled={isLoading || !isFormValid}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-base disabled:opacity-50"
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
      </div>

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

      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone }),
      })
      const data = await res.json()

      if (data.success) {
        setStep('otp')
        setCountdown(60)
        // In dev mode, show the OTP for testing
        if (data.devOtp) {
          setDevOtp(data.devOtp)
          setOtp(data.devOtp) // Auto-fill in dev mode
        }
        showToast(data.message || 'Kode OTP telah dikirim', 'success')
      } else {
        showToast(data.error || 'Gagal mengirim OTP. Coba lagi.', 'error')
      }
    } catch (error) {
      console.error('OTP send failed:', error)
      showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
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

      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, otpCode: otp }),
      })
      const data = await res.json()
      if (data.success && data.user) {
        if (data.token) {
          localStorage.setItem('authToken', data.token)
        }
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          phone: data.user.phone || formattedPhone,
          name: data.user.name,
          avatar: data.user.avatar || undefined,
          role: data.user.role || 'buyer',
          isVerified: true,
          loyaltyPoints: data.user.loyaltyPoints || 0,
          coins: data.user.coins || 0,
        }
        login(user)
        const { fetchUserData } = useAppStore.getState()
        await fetchUserData(data.user.id)
        showToast('Login berhasil! 🎉', 'success')
      } else {
        showToast(data.error || 'Verifikasi OTP gagal. Coba lagi.', 'error')
      }
    } catch (error) {
      console.error('OTP verification failed:', error)
      showToast('Terjadi kesalahan koneksi. Coba lagi nanti.', 'error')
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
      className="min-h-screen flex flex-col bg-background px-6 pt-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={step === 'otp' ? () => setStep('phone') : goBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
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
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-base disabled:opacity-50"
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
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-base disabled:opacity-50"
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
  const { navigate, goBack } = useAppStore()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleReset = async () => {
    if (!email) return
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsLoading(false)
    setIsSent(true)
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col bg-background px-6 pt-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="text-xl font-bold text-foreground">Lupa Password</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
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
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contoh@email.com"
                  className="pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Submit button */}
            <Button
              onClick={handleReset}
              disabled={isLoading || !email}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-base disabled:opacity-50"
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
              <span className="text-4xl">📧</span>
            </motion.div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              Email Terkirim!
            </h2>
            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
              Kami telah mengirimkan link reset password ke{" "}
              <span className="font-medium text-foreground">{email}</span>. Silakan cek inbox Anda.
            </p>
            <Button
              onClick={() => navigate("login")}
              className="mt-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 px-8 font-semibold"
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
