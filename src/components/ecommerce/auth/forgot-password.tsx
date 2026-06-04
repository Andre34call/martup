"use client"

import { motion } from "framer-motion"
import { Mail, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"
import { PageHeader } from "@/components/ecommerce/shared"
import { useState } from "react"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { pageVariants, pageTransition, isValidEmail, type ForgotPasswordResponse } from './shared'

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
