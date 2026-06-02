"use client"

import { motion } from "framer-motion"
import { CheckCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { PageHeader } from "@/components/ecommerce/shared"
import { useState, useEffect } from "react"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { pageVariants, pageTransition, type ResendVerificationResponse } from './shared'

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
