"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader, PrimaryButton, InlineSpinner } from "../shared"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Wallet, CreditCard, Check, ChevronRight, ChevronLeft,
  Upload, Copy, CheckCircle, Clock, Building2, Smartphone,
  ArrowRight, Info, ImageIcon, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { handleApiError } from '@/lib/handle-api-error'

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

const paymentMethods = [
  { key: "bank_transfer", label: "Transfer Bank", color: "bg-slate-600", icon: "🏦", desc: "BCA, Mandiri, BNI, dll" },
  { key: "gopay", label: "GoPay", color: "bg-green-500", icon: "💳", desc: "GoPay / GoPayLater" },
  { key: "ovo", label: "OVO", color: "bg-purple-500", icon: "💜", desc: "OVO Cash" },
  { key: "dana", label: "DANA", color: "bg-sky-500", icon: "🔵", desc: "DANA Balance" },
  { key: "shopeepay", label: "ShopeePay", color: "bg-orange-500", icon: "🧡", desc: "ShopeePay Balance" },
  { key: "linkaja", label: "LinkAja", color: "bg-red-500", icon: "🔴", desc: "LinkAja Syariah" },
]

// ==================== TYPES ====================

interface DestinationAccount {
  type: 'bank' | 'ewallet'
  bankName?: string
  accountNumber?: string
  accountHolder?: string
  ewalletName?: string  // Fallback: uses bankName if not set
  phoneNumber?: string  // Fallback: uses accountNumber if not set
}

interface DepositData {
  depositId: string
  amount: number
  method: string
  methodLabel: string
  status: string
  destinationAccount: DestinationAccount | null
  expiredAt: string
  message?: string
}

type Step = 1 | 2 | 3

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
    { num: 3, label: "Transfer" },
  ]

  return (
    <div className="flex items-center justify-center gap-0 px-4 py-4">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          {/* Step circle + label */}
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
          {/* Connecting line */}
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

  // Step 3: Deposit data & proof upload
  const [depositData, setDepositData] = useState<DepositData | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [senderName, setSenderName] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [proofUploaded, setProofUploaded] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Computed: effective amount
  const effectiveAmount = selectedAmount || (customAmount ? Number(customAmount) : 0)

  // ==================== COUNTDOWN TIMER ====================

  useEffect(() => {
    if (!depositData?.expiredAt || proofUploaded) return

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
  }, [depositData?.expiredAt, proofUploaded])

  // ==================== VALIDATION ====================

  const isAmountValid = effectiveAmount >= MIN_AMOUNT && effectiveAmount <= MAX_AMOUNT

  const canAdvanceStep1 = isAmountValid
  const canAdvanceStep2 = selectedMethod !== null

  // ==================== NAVIGATION HELPERS ====================

  const goToStep = (step: Step) => {
    setDirection(step > currentStep ? 1 : -1)
    setCurrentStep(step)
  }

  const handleNext = () => {
    if (currentStep === 1 && canAdvanceStep1) {
      goToStep(2)
    } else if (currentStep === 2 && canAdvanceStep2) {
      createDeposit()
    }
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

  // ==================== CREATE DEPOSIT ====================

  const createDeposit = async () => {
    if (!selectedMethod || !effectiveAmount) return
    setIsCreating(true)

    try {
      const result = await apiClient.post<{ success: boolean; data: DepositData }>(
        '/api/wallet/topup',
        { amount: effectiveAmount, method: selectedMethod, senderName: senderName || undefined }
      )

      setDepositData(result.data)
      goToStep(3)
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

  // ==================== FILE HANDLING ====================

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showToast("Hanya file gambar yang diperbolehkan", "error")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran file maksimal 5MB", "error")
      return
    }

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  // ==================== UPLOAD PROOF ====================

  const handleUploadProof = async () => {
    if (!selectedFile || !depositData) return
    setIsUploading(true)

    try {
      // Step 1: Upload image to Supabase
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("bucket", "deposits")
      formData.append("folder", "proofs")

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      const uploadData = await uploadRes.json()

      if (!uploadData.data?.url) {
        throw new Error("Gagal mengunggah bukti transfer")
      }

      // Step 2: Submit proof URL
      await apiClient.post(`/api/wallet/deposits/${depositData.depositId}/proof`, {
        proofUrl: uploadData.data.url,
        senderName: senderName || undefined,
      })

      setProofUploaded(true)
      showToast("Bukti transfer berhasil diunggah!", "success")
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, "error")
      } else if (error instanceof Error) {
        showToast(error.message, "error")
      } else {
        showToast("Gagal mengunggah bukti transfer", "error")
      }
    } finally {
      setIsUploading(false)
    }
  }

  // ==================== CLEANUP PREVIEW URL ====================

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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
          subtitle="Pilih metode pembayaran"
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
                  <div className={`w-10 h-10 rounded-xl ${method.color} flex items-center justify-center text-lg flex-shrink-0`}>
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
    </motion.div>
  )

  // ==================== RENDER: STEP 3 - TRANSFER INSTRUCTIONS ====================

  const renderStep3 = () => {
    if (isCreating) {
      return (
        <motion.div
          key="step3-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <InlineSpinner className="w-8 h-8 border-emerald-500/30 border-t-emerald-500" />
          <p className="text-sm text-muted-foreground mt-4">Membuat deposit...</p>
        </motion.div>
      )
    }

    if (proofUploaded) {
      return renderSuccessState()
    }

    if (!depositData) return null

    const { destinationAccount } = depositData
    const isBank = destinationAccount?.type === "bank"
    const isEwallet = destinationAccount?.type === "ewallet"

    // Resolve e-wallet display name: ewalletName takes priority, falls back to bankName
    const ewalletDisplayName = destinationAccount?.ewalletName || destinationAccount?.bankName || "-"
    // Resolve phone/account: phoneNumber takes priority, falls back to accountNumber
    const ewalletNumber = destinationAccount?.phoneNumber || destinationAccount?.accountNumber || "-"

    return (
      <motion.div
        key="step3"
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
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">Total Transfer</p>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 text-center mt-1">
              {formatPrice(depositData.amount)}
            </p>
            <p className="text-[10px] text-emerald-500/70 dark:text-emerald-400/60 text-center mt-1">
              Pastikan jumlah transfer sesuai
            </p>
          </Card>
        </motion.div>

        {/* Destination Account */}
        {destinationAccount ? (
          <motion.div {...fadeIn}>
            <SectionHeader
              title="Tujuan Transfer"
              subtitle={depositData.methodLabel}
              icon={isBank ? <Building2 className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            />
            <Card className="mt-3 p-4 space-y-3">
              {isBank ? (
                <>
                  {/* Bank Name */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Nama Bank</span>
                    <span className="text-sm font-semibold text-foreground">
                      {destinationAccount.bankName || "-"}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  {/* Account Number */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Nomor Rekening</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground tracking-wide">
                        {destinationAccount.accountNumber || "-"}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => copyToClipboard(destinationAccount.accountNumber || "")}
                        className="w-7 h-7 rounded-lg bg-muted hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                      </motion.button>
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  {/* Account Holder */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Atas Nama</span>
                    <span className="text-sm font-semibold text-foreground">
                      {destinationAccount.accountHolder || "-"}
                    </span>
                  </div>
                </>
              ) : isEwallet ? (
                <>
                  {/* E-Wallet Name */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">E-Wallet</span>
                    <span className="text-sm font-semibold text-foreground">
                      {ewalletDisplayName}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  {/* Phone/Account */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">No. HP / Akun</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground tracking-wide">
                        {ewalletNumber}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => copyToClipboard(ewalletNumber)}
                        className="w-7 h-7 rounded-lg bg-muted hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                      </motion.button>
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  {/* Account Holder */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Atas Nama</span>
                    <span className="text-sm font-semibold text-foreground">
                      {destinationAccount.accountHolder || "-"}
                    </span>
                  </div>
                </>
              ) : (
                /* Unknown type fallback — show all fields */
                <>
                  {destinationAccount.bankName && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Bank/E-Wallet</span>
                        <span className="text-sm font-semibold text-foreground">{destinationAccount.bankName}</span>
                      </div>
                      <div className="h-px bg-border" />
                    </>
                  )}
                  {destinationAccount.accountNumber && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Nomor Rekening</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground tracking-wide">{destinationAccount.accountNumber}</span>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => copyToClipboard(destinationAccount.accountNumber || "")}
                            className="w-7 h-7 rounded-lg bg-muted hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-emerald-600" />
                          </motion.button>
                        </div>
                      </div>
                      <div className="h-px bg-border" />
                    </>
                  )}
                  {destinationAccount.accountHolder && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Atas Nama</span>
                      <span className="text-sm font-semibold text-foreground">{destinationAccount.accountHolder}</span>
                    </div>
                  )}
                </>
              )}
            </Card>
          </motion.div>
        ) : (
          /* No destination account configured */
          <motion.div {...fadeIn}>
            <div className="flex gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  Rekening tujuan belum dikonfigurasi
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/60">
                  Silakan hubungi admin untuk mendapatkan informasi rekening tujuan transfer.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info note */}
        <motion.div {...fadeIn}>
          <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              Transfer tepat sesuai nominal yang tertera. Setelah transfer, unggah bukti transfer di bawah untuk mempercepat verifikasi.
            </p>
          </div>
        </motion.div>

        {/* Sender Name */}
        <motion.div {...fadeIn}>
          <SectionHeader
            title="Nama Pengirim (Opsional)"
            subtitle="Untuk verifikasi pembayaran"
            icon={<CreditCard className="w-4 h-4" />}
          />
          <div className="mt-3">
            <Input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Nama sesuai rekening pengirim"
              className="h-11 rounded-xl"
            />
          </div>
        </motion.div>

        {/* Upload Proof */}
        <motion.div {...fadeIn}>
          <SectionHeader
            title="Unggah Bukti Transfer"
            subtitle="Format: JPG, PNG (Maks. 5MB)"
            icon={<ImageIcon className="w-4 h-4" />}
          />
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            {previewUrl ? (
              <Card className="p-3 space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-muted">
                  <img
                    src={previewUrl}
                    alt="Bukti transfer"
                    className="w-full max-h-48 object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl text-xs"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                  >
                    Ganti Foto
                  </Button>
                  <PrimaryButton
                    className="flex-1 h-10 rounded-xl text-xs"
                    onClick={handleUploadProof}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <InlineSpinner className="w-4 h-4 mr-2" />
                        Mengunggah...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Kirim Bukti
                      </>
                    )}
                  </PrimaryButton>
                </div>
              </Card>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleFileSelect}
                className="w-full py-8 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-emerald-400 dark:hover:border-emerald-600 bg-muted/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Pilih Foto Bukti Transfer</span>
                <span className="text-xs text-muted-foreground/70">Ketuk untuk memilih file</span>
              </motion.button>
            )}
          </div>
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
        Bukti Terkirim!
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-muted-foreground text-center max-w-[260px] mb-2"
      >
        Bukti transfer berhasil diunggah. Tim kami akan memverifikasi pembayaran Anda.
      </motion.p>

      {depositData && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-6"
        >
          {formatPrice(depositData.amount)}
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

  // ==================== MAIN RENDER ====================

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageHeader title="Top Up Saldo" />

      {/* Step Indicator */}
      {!proofUploaded && <StepIndicator currentStep={currentStep} />}

      {/* Content */}
      <div className="flex-1 px-4 pb-28 overflow-y-auto">
        <AnimatePresence mode="wait" custom={direction}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </AnimatePresence>
      </div>

      {/* Bottom Action Bar */}
      {!proofUploaded && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border px-4 py-3 z-50">
          <div className="flex gap-3 max-w-lg mx-auto">
            <Button
              variant="outline"
              className="h-11 rounded-xl flex-1"
              onClick={handleBack}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {currentStep === 1 ? "Kembali" : "Kembali"}
            </Button>

            {currentStep < 3 && (
              <PrimaryButton
                className="h-11 rounded-xl flex-1"
                disabled={
                  (currentStep === 1 && !canAdvanceStep1) ||
                  (currentStep === 2 && !canAdvanceStep2) ||
                  isCreating
                }
                onClick={handleNext}
              >
                {isCreating ? (
                  <InlineSpinner className="w-4 h-4 mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-1" />
                )}
                {currentStep === 1 ? "Lanjut" : "Buat Deposit"}
              </PrimaryButton>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
