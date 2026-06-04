"use client"

import { motion } from "framer-motion"
import { Eye, EyeOff, CheckCircle, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"
import { PageHeader } from "@/components/ecommerce/shared"
import { useState } from "react"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { pageVariants, pageTransition, type ResetPasswordResponse } from './shared'

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
    }
    setIsLoading(false)
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
