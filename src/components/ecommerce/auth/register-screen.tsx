"use client"

import { motion } from "framer-motion"
import { Eye, EyeOff, Smartphone, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/ecommerce/shared"
import { useAppStore, useCartStore, useWishlistStore } from "@/lib/store"
import { useState } from "react"
import type { User, UserRole } from "@/lib/types"
import { logger } from '@/lib/logger'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { setAuthFlagCookie } from '@/lib/session-cookie'
import { pageVariants, pageTransition, isValidEmail, isValidPhone, isValidPassword, type RegisterResponse } from './shared'

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
        const { fetchUserData, connectSocket } = useAppStore.getState()
        await fetchUserData(data.user.id)
        useCartStore.getState().mergeLocalToServer(data.user.id)
        useWishlistStore.getState().syncWishlistFromServer(data.user.id)
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
