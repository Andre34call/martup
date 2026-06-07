"use client"

import { motion } from "framer-motion"
import { Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { useAppStore, useCartStore, useWishlistStore } from "@/lib/store"
import { PageHeader } from "@/components/ecommerce/shared"
import { useState, useEffect } from "react"
import type { User, UserRole } from "@/lib/types"
import { logger } from '@/lib/logger'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { setAuthFlagCookie } from '@/lib/session-cookie'
import { pageVariants, pageTransition, isValidPhone, type OtpSendResponse, type OtpVerifyResponse } from './shared'

// ==================== OTP SCREEN ====================
// SECURITY: Supports two modes:
// 1. Phone-based: User enters phone number (phone login flow)
// 2. UserId-based: From 2FA flow — phone is looked up server-side to prevent phone enumeration

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return phone
  const visibleStart = digits.slice(0, 4)
  const visibleEnd = digits.slice(-3)
  const maskedMiddle = '*'.repeat(Math.min(digits.length - 7, 4))
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
  const passedUserId = useAppStore((s) => s.otpUserId) || ""
  const passedMaskedPhone = useAppStore((s) => s.otpMaskedPhone) || ""

  // SECURITY: If we have a userId from 2FA flow, use userId-based OTP (no phone needed).
  // The server looks up the phone from the userId to prevent phone number enumeration.
  const is2FAFlow = !!passedUserId
  const displayPhone = is2FAFlow ? passedMaskedPhone : passedPhone

  const [phone, setPhone] = useState(passedPhone)
  const [step, setStep] = useState<'phone' | 'otp'>(
    is2FAFlow ? 'otp' : (passedPhone && isValidPhone(passedPhone) ? 'otp' : 'phone')
  )
  const [otp, setOtp] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [touchedPhone, setTouchedPhone] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)

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
    if (countdown > 0) return
    if (!is2FAFlow && (!phone || !isValidPhone(phone))) return
    await handleSendOTP()
  }

  const handlePhoneSubmit = async () => {
    setTouchedPhone(true)
    if (!phone || !isValidPhone(phone)) return
    await handleSendOTP()
  }

  const handleSendOTP = async () => {
    setIsSending(true)

    try {
      let data: OtpSendResponse

      if (is2FAFlow) {
        // SECURITY: Send userId instead of phone for 2FA flow
        // Server looks up the phone from userId to prevent phone enumeration
        data = await apiClient.post<OtpSendResponse>('/api/auth/otp/send', { userId: passedUserId })
      } else {
        const formattedPhone = phone.startsWith('+') ? phone : phone.startsWith('0') ? '+62' + phone.substring(1) : '+62' + phone
        data = await apiClient.post<OtpSendResponse>('/api/auth/otp/send', { phone: formattedPhone })
      }

      // Store requestId for verification — it binds the OTP send and verify steps
      if (data.requestId) {
        setRequestId(data.requestId)
      }
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

  // Auto-send OTP on mount for 2FA flow
  useEffect(() => {
    if (is2FAFlow && step === 'otp' && !requestId) {
      handleSendOTP()
    }
  }, [is2FAFlow])

  const handleVerify = async () => {
    if (otp.length !== 6) return
    if (!is2FAFlow && !phone) {
      showToast('Masukkan nomor HP terlebih dahulu', 'error')
      return
    }
    setIsVerifying(true)

    try {
      let data: OtpVerifyResponse

      if (is2FAFlow) {
        // SECURITY: Verify using userId for 2FA flow
        data = await apiClient.post<OtpVerifyResponse>('/api/auth/otp/verify', { userId: passedUserId, otpCode: otp, requestId: requestId || undefined })
      } else {
        const formattedPhone = phone.startsWith('+') ? phone : phone.startsWith('0') ? '+62' + phone.substring(1) : '+62' + phone
        data = await apiClient.post<OtpVerifyResponse>('/api/auth/otp/verify', { phone: formattedPhone, otpCode: otp, requestId: requestId || undefined })
      }

      if (data.user) {
        // Token is in httpOnly session cookie set by server
        setAuthFlagCookie()
        const user: User & { isSuperAdmin?: boolean } = {
          id: data.user.id,
          email: data.user.email || '',
          phone: data.user.phone || phone,
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
        const { fetchUserData, connectSocket } = useAppStore.getState()
        await fetchUserData(data.user.id)
        // Merge local cart to server & connect WebSocket
        useCartStore.getState().mergeLocalToServer(data.user.id)
        useWishlistStore.getState().syncWishlistFromServer(data.user.id)
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

  // Display text for the phone number (masked for 2FA, actual for phone login)
  const displayPhoneText = is2FAFlow
    ? displayPhone
    : maskPhone(phone)

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
      <PageHeader title={is2FAFlow ? "Verifikasi 2FA" : "Login OTP"} onBack={step === 'otp' && !is2FAFlow ? () => setStep('phone') : goBack} />

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

        {step === 'phone' && !is2FAFlow ? (
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
              {is2FAFlow ? 'Verifikasi 2FA' : 'Masukkan kode OTP'}
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Kode telah dikirim ke <span className="font-medium text-foreground">{displayPhoneText}</span>
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
