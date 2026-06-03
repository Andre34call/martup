"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader, PrimaryButton, InlineSpinner } from "../shared"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Wallet, CreditCard, Check, ChevronRight, ChevronLeft,
  Copy, CheckCircle, Clock, Building2, Smartphone,
  ArrowRight, Info, AlertCircle, QrCode, RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { handleApiError } from '@/lib/handle-api-error'
import { openSnapPayment } from '@/lib/midtrans'

// ==================== CONSTANTS ====================

const MIN_AMOUNT = 10_000
const MAX_AMOUNT = 10_000_000

const quickAmounts = [
  { label: "25K", value: 25_000 },
  { label: "50K", value: 50_000 },
  { label: "100K", value: 100_000 },
  { label: "200K", value: 200_000 },
  { label: "500K", value: 500_000 },
  { label: "1M", value: 1_000_000 },
]

// Midtrans-supported payment methods for deposits
const paymentMethods = [
  {
    key: "bank_transfer",
    label: "Virtual Account",
    color: "bg-slate-600",
    icon: <Building2 className="w-5 h-5 text-white" />,
    desc: "BCA, BNI, BRI, Mandiri, Permata",
  },
  {
    key: "gopay",
    label: "GoPay",
    color: "bg-green-500",
    icon: <Smartphone className="w-5 h-5 text-white" />,
    desc: "GoPay / GoPayLater",
  },
  {
    key: "shopeepay",
    label: "ShopeePay",
    color: "bg-orange-500",
    icon: <Smartphone className="w-5 h-5 text-white" />,
    desc: "ShopeePay Balance",
  },
  {
    key: "qris",
    label: "QRIS",
    color: "bg-red-500",
    icon: <QrCode className="w-5 h-5 text-white" />,
    desc: "Scan QR — semua e-wallet & bank",
  },
]

// ==================== TYPES ====================

interface MidtransDepositData {
  depositId: string
  amount: number
  method: string
  methodLabel: string
  status: string
  snapToken: string
  redirectUrl?: string
  midtransOrderId: string
  expiredAt: string
  message?: string
}

type Step = 1 | 2 | 3

type PaymentResult = {
  status: 'success' | 'pending' | 'error' | 'closed'
  result?: {
    status_code?: string
    transaction_status?: string
    order_id?: string
    payment_type?: string
    gross_amount?: string
    [key: string]: unknown
  }
}

// ==================== ANIMATION VARIANTS ====================

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
}

// ==================== STEP INDICATOR ====================

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { num: 1, label: "Nominal" },
    { num: 2, label: "Bayar" },
    { num: 3, label: "Selesai" },
  ]

  return (
    <div className="flex items-center justify-center gap-0 px-4 py-4">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <motion.div
              animate={{
                scale: currentStep === step.num ? 1.1 : 1,
                backgroundColor: currentStep >= step.num ? "#10b981" : "#e5e7eb",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-8 h-8 rounded-full flex items-center justify-center"
            >
              {currentStep > step.num ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              ) : (
                <span className={`text-xs font-bold ${currentStep >= step.num ? "text-white" : "text-muted-foreground"}`}>
                  {step.num}
                </span>
              )}
            </motion.div>
            <span className={`text-[10px] font-medium ${currentStep >= step.num ? "text-emerald-600" : "text-muted-foreground"}`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className="w-12 sm:w-16 h-0.5 mx-1 mb-5 relative overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: currentStep > step.num ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export function DepositScreen() {
  const { currentUser, walletBalance, walletCoins, showToast, goBack, navigate } = useAppStore()

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [direction, setDirection] = useState(1)

  // Step 1: Amount
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")

  // Step 2: Payment method
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  // Step 3: Deposit data & payment status
  const [depositData, setDepositData] = useState<MidtransDepositData | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSnapOpen, setIsSnapOpen] = useState(false)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [depositStatus, setDepositStatus] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState("")

  // Computed: effective amount
  const effectiveAmount = selectedAmount || (customAmount ? Number(customAmount) : 0)

  // ==================== COUNTDOWN TIMER ====================

  useEffect(() => {
    if (!depositData?.expiredAt) return
    if (depositStatus === 'success' || depositStatus === 'failed' || depositStatus === 'expired') return

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiry = new Date(depositData.expiredAt).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setTimeRemaining("Waktu habis")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      )
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [depositData?.expiredAt, depositStatus])

  // ==================== POLLING DEPOSIT STATUS ====================

  const pollDepositStatus = useCallback(async (depositId: string): Promise<string | null> => {
    try {
      const result = await apiClient.get<{
        success: boolean
        data: { status: string }
      }>(`/api/deposit/status?depositId=${depositId}`)
      return result.data.status
    } catch {
      return null
    }
  }, [])

  // Start polling after Snap popup closes or on pending
  useEffect(() => {
    if (!depositData?.depositId || isPolling) return
    if (depositStatus === 'success' || depositStatus === 'failed' || depositStatus === 'expired') return

    // Only poll if payment was made (pending or success from Snap callback)
    if (!paymentResult || paymentResult.status === 'closed') return

    setIsPolling(true)

    const poll = async () => {
      const status = await pollDepositStatus(depositData.depositId)
      if (status) {
        setDepositStatus(status)
        if (status === 'success' || status === 'failed' || status === 'expired') {
          setIsPolling(false)
          return
        }
      }
      // Continue polling
      setTimeout(poll, 3000)
    }

    // Initial check after 2 seconds
    const timer = setTimeout(poll, 2000)
    return () => {
      clearTimeout(timer)
      setIsPolling(false)
    }
  }, [depositData?.depositId, paymentResult, depositStatus, pollDepositStatus, isPolling])

  // ==================== VALIDATION ====================

  const isAmountValid = effectiveAmount >= MIN_AMOUNT && effectiveAmount <= MAX_AMOUNT
  const canAdvanceStep1 = isAmountValid
  const canAdvanceStep2 = selectedMethod !== null

  // ==================== NAVIGATION HELPERS ====================

  const goToStep = (step: Step) => {
    setDirection(step > currentStep ? 1 : -1)
    setCurrentStep(step)
  }

  const handleBack = () => {
    if (currentStep === 1) {
      goBack()
    } else {
      goToStep((currentStep - 1) as Step)
    }
  }

  // ==================== COPY TO CLIPBOARD ====================

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Berhasil disalin!", "success")
    }).catch(() => {
      showToast("Gagal menyalin", "error")
    })
  }

  // ==================== CREATE MIDTRANS DEPOSIT & OPEN SNAP ====================

  const handlePayment = async () => {
    if (!selectedMethod || !effectiveAmount) return
    setIsCreating(true)

    try {
      // Step 1: Create Midtrans deposit — get snap token
      const result = await apiClient.post<{
        success: boolean
        data: MidtransDepositData
      }>('/api/deposit/midtrans/create', {
        amount: effectiveAmount,
        method: selectedMethod,
      })

      const deposit = result.data
      setDepositData(deposit)

      // Step 2: Open Midtrans Snap popup
      setIsSnapOpen(true)
      goToStep(3)

      const snapResult = await openSnapPayment(deposit.snapToken)
      setPaymentResult(snapResult)
      setIsSnapOpen(false)

      // Step 3: Handle the result
      if (snapResult.status === 'success') {
        showToast('Pembayaran berhasil diproses!', 'success')
        // Polling will pick up the status
      } else if (snapResult.status === 'pending') {
        showToast('Pembayaran menunggu konfirmasi. Silakan selesaikan pembayaran.', 'info')
      } else if (snapResult.status === 'error') {
        showToast('Pembayaran gagal. Silakan coba lagi.', 'error')
      } else if (snapResult.status === 'closed') {
        showToast('Popup pembayaran ditutup. Anda bisa membuka kembali.', 'info')
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, "error")
      } else {
        handleApiError(error, "top up")
      }
    } finally {
      setIsCreating(false)
    }
  }

  // ==================== RE-OPEN SNAP ====================

  const handleReopenSnap = async () => {
    if (!depositData?.snapToken) return
    try {
      setIsSnapOpen(true)
      const snapResult = await openSnapPayment(depositData.snapToken)
      setPaymentResult(snapResult)
      setIsSnapOpen(false)

      if (snapResult.status === 'success') {
        showToast('Pembayaran berhasil diproses!', 'success')
      } else if (snapResult.status === 'pending') {
        showToast('Pembayaran menunggu konfirmasi.', 'info')
      } else if (snapResult.status === 'error') {
        showToast('Pembayaran gagal. Silakan coba lagi.', 'error')
      }
    } catch {
      setIsSnapOpen(false)
      showToast('Gagal membuka popup pembayaran', 'error')
    }
  }

  // ==================== RENDER: STEP 1 - CHOOSE AMOUNT ====================

  const renderStep1 = () => (
    <motion.div
      key="step1"
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="space-y-5"
    >
      {/* Quick Amount Buttons */}
      <motion.div {...fadeIn}>
        <SectionHeader
          title="Pilih Nominal"
          icon={<Wallet className="w-4 h-4" />}
        />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {quickAmounts.map((item) => (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSelectedAmount(item.value)
                setCustomAmount("")
              }}
              className={`py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                selectedAmount === item.value
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30"
                  : "bg-card text-foreground border-border hover:border-emerald-300 dark:hover:border-emerald-700"
              }`}
            >
              {item.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Custom Amount */}
      <motion.div {...fadeIn}>
        <SectionHeader
          title="Nominal Lain"
          subtitle={`Min. ${formatPrice(MIN_AMOUNT)} — Max. ${formatPrice(MAX_AMOUNT)}`}
          icon={<CreditCard className="w-4 h-4" />}
        />
        <div className="mt-3 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
            Rp
          </span>
          <Input
            value={customAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "")
              setCustomAmount(val)
              if (val) setSelectedAmount(null)
            }}
            placeholder="Masukkan nominal"
            className="pl-10 h-12 rounded-xl text-base font-medium"
            inputMode="numeric"
          />
        </div>
        {customAmount && !isAmountValid && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-500 mt-1.5 flex items-center gap-1"
          >
            <Info className="w-3 h-3" />
            Nominal harus antara {formatPrice(MIN_AMOUNT)} - {formatPrice(MAX_AMOUNT)}
          </motion.p>
        )}
      </motion.div>

      {/* Amount Summary */}
      {effectiveAmount > 0 && isAmountValid && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800"
        >
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Total Top Up</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {formatPrice(effectiveAmount)}
          </p>
        </motion.div>
      )}

      {/* Info about Midtrans */}
      <motion.div {...fadeIn}>
        <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Pembayaran diproses otomatis via Midtrans. Saldo akan langsung masuk setelah pembayaran berhasil — tanpa perlu verifikasi admin.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )

  // ==================== RENDER: STEP 2 - CHOOSE PAYMENT METHOD ====================

  const renderStep2 = () => (
    <motion.div
      key="step2"
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="space-y-5"
    >
      {/* Amount Recap */}
      <motion.div {...fadeIn}>
        <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Nominal Top Up</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatPrice(effectiveAmount)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Payment Methods */}
      <motion.div {...fadeIn}>
        <SectionHeader
          title="Metode Pembayaran"
          subtitle="Diproses otomatis via Midtrans"
          icon={<CreditCard className="w-4 h-4" />}
        />
        <div className="space-y-2 mt-3">
          {paymentMethods.map((method) => (
            <motion.div
              key={method.key}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={`p-3.5 cursor-pointer transition-all border-2 ${
                  selectedMethod === method.key
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-sm"
                    : "border-border hover:border-emerald-200 dark:hover:border-emerald-800"
                }`}
                onClick={() => setSelectedMethod(method.key)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${method.color} flex items-center justify-center flex-shrink-0`}>
                    {method.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.desc}</p>
                  </div>
                  {selectedMethod === method.key ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    </motion.div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Sandbox notice */}
      <motion.div {...fadeIn}>
        <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            Mode Sandbox aktif — pembayaran tidak akan benar-benar terbayar. Ini untuk testing saja.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )

  // ==================== RENDER: STEP 3 - PAYMENT STATUS ====================

  const renderStep3 = () => {
    if (isCreating && !depositData) {
      return (
        <motion.div
          key="step3-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <InlineSpinner className="w-8 h-8 border-emerald-500/30 border-t-emerald-500" />
          <p className="text-sm text-muted-foreground mt-4">Membuat transaksi pembayaran...</p>
        </motion.div>
      )
    }

    if (isSnapOpen) {
      return (
        <motion.div
          key="step3-snap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <InlineSpinner className="w-8 h-8 border-emerald-500/30 border-t-emerald-500" />
          <p className="text-sm text-muted-foreground mt-4">Menunggu pembayaran di popup Midtrans...</p>
          <p className="text-xs text-muted-foreground mt-2">Jangan tutup halaman ini</p>
        </motion.div>
      )
    }

    // Payment successful
    if (depositStatus === 'success') {
      return renderSuccessState()
    }

    // Payment failed
    if (depositStatus === 'failed' || depositStatus === 'expired') {
      return renderFailedState()
    }

    // Pending or waiting for payment
    if (!depositData) return null

    return renderPendingState()
  }

  // ==================== RENDER: PENDING STATE ====================

  const renderPendingState = () => {
    if (!depositData) return null

    return (
      <motion.div
        key="step3-pending"
        custom={direction}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="space-y-4"
      >
        {/* Timer */}
        <motion.div {...fadeIn}>
          <div className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl ${
            timeRemaining === "Waktu habis"
              ? "bg-red-50 dark:bg-red-900/20 text-red-600"
              : "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
          }`}>
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">
              {timeRemaining === "Waktu habis" ? "Waktu pembayaran habis" : "Batas waktu pembayaran"}
            </span>
            {timeRemaining !== "Waktu habis" && (
              <span className="text-sm font-bold">{timeRemaining}</span>
            )}
          </div>
        </motion.div>

        {/* Transfer Amount */}
        <motion.div {...fadeIn}>
          <Card className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">Total Pembayaran</p>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 text-center mt-1">
              {formatPrice(depositData.amount)}
            </p>
            <p className="text-[10px] text-emerald-500/70 dark:text-emerald-400/60 text-center mt-1">
              via {depositData.methodLabel}
            </p>
          </Card>
        </motion.div>

        {/* Order ID */}
        <motion.div {...fadeIn}>
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Order ID</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-foreground">{depositData.midtransOrderId}</span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => copyToClipboard(depositData.midtransOrderId)}
                  className="w-6 h-6 rounded-lg bg-muted hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center transition-colors"
                >
                  <Copy className="w-3 h-3 text-emerald-600" />
                </motion.button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Status Info */}
        {isPolling && (
          <motion.div {...fadeIn}>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <InlineSpinner className="w-4 h-4 border-blue-500/30 border-t-blue-500" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Memeriksa status pembayaran...
              </p>
            </div>
          </motion.div>
        )}

        {/* Info */}
        <motion.div {...fadeIn}>
          <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                {paymentResult?.status === 'pending'
                  ? 'Pembayaran sedang diproses. Untuk VA, selesaikan transfer sebelum batas waktu.'
                  : paymentResult?.status === 'closed'
                    ? 'Anda menutup popup pembayaran. Klik tombol di bawah untuk membuka kembali.'
                    : 'Selesaikan pembayaran di popup Midtrans. Saldo akan otomatis masuk setelah pembayaran berhasil.'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div {...fadeIn} className="space-y-3">
          <PrimaryButton
            className="w-full rounded-xl h-12"
            onClick={handleReopenSnap}
            disabled={isSnapOpen}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Buka Kembali Pembayaran
          </PrimaryButton>

          <Button
            variant="outline"
            className="w-full rounded-xl h-12"
            onClick={() => navigate('deposit-history')}
          >
            <Clock className="w-4 h-4 mr-2" />
            Lihat Riwayat Deposit
          </Button>
        </motion.div>
      </motion.div>
    )
  }

  // ==================== RENDER: SUCCESS STATE ====================

  const renderSuccessState = () => (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-col items-center justify-center py-8 px-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-5"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.3 }}
        >
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </motion.div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-xl font-bold text-foreground mb-2"
      >
        Top Up Berhasil!
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-muted-foreground text-center max-w-[280px] mb-2"
      >
        Saldo Anda telah ditambahkan secara otomatis melalui Midtrans.
      </motion.p>

      {depositData && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-6"
        >
          +{formatPrice(depositData.amount)}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full space-y-3"
      >
        <PrimaryButton
          className="w-full rounded-xl h-12"
          onClick={() => navigate('deposit-history')}
        >
          <Clock className="w-4 h-4 mr-2" />
          Lihat Riwayat
        </PrimaryButton>

        <Button
          variant="outline"
          className="w-full rounded-xl h-12"
          onClick={() => goBack()}
        >
          Kembali ke Dompet
        </Button>
      </motion.div>
    </motion.div>
  )

  // ==================== RENDER: FAILED STATE ====================

  const renderFailedState = () => (
    <motion.div
      key="failed"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-col items-center justify-center py-8 px-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.3 }}
        >
          <AlertCircle className="w-10 h-10 text-red-500" />
        </motion.div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-xl font-bold text-foreground mb-2"
      >
        {depositStatus === 'expired' ? 'Pembayaran Kadaluarsa' : 'Pembayaran Gagal'}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-muted-foreground text-center max-w-[280px] mb-6"
      >
        {depositStatus === 'expired'
          ? 'Batas waktu pembayaran telah habis. Silakan buat top up baru.'
          : 'Pembayaran tidak berhasil. Silakan coba lagi.'}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="w-full space-y-3"
      >
        <PrimaryButton
          className="w-full rounded-xl h-12"
          onClick={() => {
            setCurrentStep(1)
            setDirection(-1)
            setDepositData(null)
            setPaymentResult(null)
            setDepositStatus(null)
            setIsPolling(false)
            setSelectedMethod(null)
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Top Up Lagi
        </PrimaryButton>

        <Button
          variant="outline"
          className="w-full rounded-xl h-12"
          onClick={() => goBack()}
        >
          Kembali ke Dompet
        </Button>
      </motion.div>
    </motion.div>
  )

  // ==================== MAIN RENDER ====================

  // Determine if step 3 is in a final state
  const isFinalState = depositStatus === 'success' || depositStatus === 'failed' || depositStatus === 'expired'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageHeader title="Top Up Saldo" />

      {/* Step Indicator — hide when in success/failed state */}
      {!isFinalState && <StepIndicator currentStep={currentStep} />}

      {/* Content */}
      <div className="flex-1 px-4 pb-28 overflow-y-auto">
        <AnimatePresence mode="wait" custom={direction}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </AnimatePresence>
      </div>

      {/* Bottom Action Bar */}
      {!isFinalState && currentStep < 3 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border px-4 py-3 z-50">
          <div className="flex gap-3 max-w-lg mx-auto">
            <Button
              variant="outline"
              className="h-11 rounded-xl flex-1"
              onClick={handleBack}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Kembali
            </Button>

            <PrimaryButton
              className="h-11 rounded-xl flex-1"
              disabled={
                (currentStep === 1 && !canAdvanceStep1) ||
                (currentStep === 2 && !canAdvanceStep2) ||
                isCreating
              }
              onClick={currentStep === 1 ? () => goToStep(2) : handlePayment}
            >
              {isCreating ? (
                <InlineSpinner className="w-4 h-4 mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-1" />
              )}
              {currentStep === 1 ? "Lanjut" : "Bayar Sekarang"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}
