"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatDate, formatRelativeTime } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { handleApiError } from '@/lib/handle-api-error'
import { PageHeader, SectionHeader, PrimaryButton, InlineSpinner } from "../shared"
import { useState, useEffect, useCallback } from "react"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Copy,
  Check,
  ImagePlus,
  AlertCircle,
  Timer,
  ArrowLeft,
  Eye,
  Building2,
  Smartphone,
  RefreshCw,
  Info,
  CreditCard,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { openSnapPayment } from '@/lib/midtrans'

// ==================== Types ====================

interface DepositDetail {
  id: string
  amount: number
  method: string
  status: 'pending' | 'proof_uploaded' | 'success' | 'failed' | 'expired'
  proofUrl: string | null
  adminNote: string | null
  destinationAccount: string | null
  senderName: string | null
  expiredAt: string | null
  createdAt: string
  updatedAt: string
  // Midtrans fields
  midtransOrderId?: string | null
  midtransTransactionId?: string | null
  snapToken?: string | null
  paymentType?: string | null
}

interface DepositDetailResponse {
  success: boolean
  data: DepositDetail
  error?: string
}

interface ProofUploadResponse {
  success: boolean
  data: {
    id: string
    status: string
    proofUrl: string
    message: string
  }
}

// ==================== Config ====================

const methodConfig: Record<string, { label: string; icon: string; color: string }> = {
  bank_transfer: { label: 'Virtual Account', icon: '🏦', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  gopay: { label: 'GoPay', icon: '💳', color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  shopeepay: { label: 'ShopeePay', icon: '🧡', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  qris: { label: 'QRIS', icon: '📱', color: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  midtrans: { label: 'Midtrans', icon: '💳', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  // Legacy methods (for old deposits)
  ovo: { label: 'OVO', icon: '💜', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  dana: { label: 'DANA', icon: '🔵', color: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' },
  linkaja: { label: 'LinkAja', icon: '🔴', color: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

// Midtrans payment type labels (for displaying what specific VA/e-wallet was used)
const midtransPaymentTypeLabels: Record<string, string> = {
  bca_va: 'BCA Virtual Account',
  bni_va: 'BNI Virtual Account',
  bri_va: 'BRI Virtual Account',
  mandiri_va: 'Mandiri Virtual Account',
  permata_va: 'Permata Virtual Account',
  other_va: 'Virtual Account Lainnya',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  qris: 'QRIS',
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Menunggu Bayar', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  proof_uploaded: { label: 'Menunggu Verifikasi', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  success: { label: 'Berhasil', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  failed: { label: 'Gagal', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  expired: { label: 'Kadaluarsa', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

// ==================== Countdown Timer ====================

function ExpiryCountdown({ expiredAt }: { expiredAt: string }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false })

  useEffect(() => {
    const calculate = () => {
      const end = new Date(expiredAt).getTime()
      const now = Date.now()
      const diff = Math.max(0, end - now)

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true })
        return
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
      })
    }

    calculate()
    const timer = setInterval(calculate, 1000)
    return () => clearInterval(timer)
  }, [expiredAt])

  if (timeLeft.expired) {
    return (
      <span className="text-sm font-medium text-red-500">Kadaluarsa</span>
    )
  }

  const pad = (n: number) => n.toString().padStart(2, '0')

  return (
    <div className="flex items-center gap-1.5">
      <Timer className="w-4 h-4 text-amber-500" />
      <div className="flex items-center gap-0.5">
        {[
          { value: pad(timeLeft.hours), label: 'jam' },
          { value: pad(timeLeft.minutes), label: 'min' },
          { value: pad(timeLeft.seconds), label: 'det' },
        ].map((item, idx) => (
          <span key={item.label} className="flex items-center gap-0.5">
            <motion.span
              key={item.value}
              initial={{ y: -3, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="min-w-[26px] h-7 flex items-center justify-center bg-amber-500 text-white text-xs font-bold rounded-md px-1"
            >
              {item.value}
            </motion.span>
            {idx < 2 && (
              <span className="text-xs text-amber-500 font-bold">:</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

// ==================== Copy Button ====================

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Tersalin</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>{label || 'Salin'}</span>
        </>
      )}
    </button>
  )
}

// ==================== Main Screen ====================

export function DepositDetailScreen() {
  const { selectedDepositId, showToast, goBack, navigate } = useAppStore()
  const [deposit, setDeposit] = useState<DepositDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [senderNameInput, setSenderNameInput] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const fetchDepositDetail = useCallback(async () => {
    if (!selectedDepositId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // Fetch single deposit detail by ID
      const res = await apiClient.get<DepositDetailResponse>(`/api/wallet/deposits/${selectedDepositId}`)
      if (res.success && res.data) {
        setDeposit(res.data)
      } else {
        showToast('Deposit tidak ditemukan', 'error')
        goBack()
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        showToast('Deposit tidak ditemukan', 'error')
        goBack()
      } else {
        handleApiError(error, 'detail deposit')
      }
    } finally {
      setIsLoading(false)
    }
  }, [selectedDepositId, showToast, goBack])

  useEffect(() => {
    fetchDepositDetail()
  }, [fetchDepositDetail])

  const handleFileSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showToast('Ukuran file maksimal 5MB', 'error')
          return
        }
        setSelectedFile(file)
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
      }
    }
    input.click()
  }

  const handleUploadProof = async () => {
    if (!selectedFile) {
      showToast('Pilih bukti pembayaran terlebih dahulu', 'error')
      return
    }
    if (!senderNameInput.trim()) {
      showToast('Masukkan nama pengirim', 'error')
      return
    }
    if (!deposit) return

    setIsUploading(true)
    try {
      // Step 1: Upload image to Supabase
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('bucket', 'deposits')
      formData.append('folder', 'proofs')

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok || !uploadData.data?.path) {
        throw new Error(uploadData.error || 'Gagal mengupload gambar')
      }

      // For private buckets (deposits), use proofPath instead of proofUrl
      const isPrivate = uploadData.data.isPrivate === true
      const proofPayload: Record<string, string> = {
        senderName: senderNameInput.trim(),
      }
      if (isPrivate) {
        proofPayload.proofPath = uploadData.data.path
      } else {
        proofPayload.proofUrl = uploadData.data.url || ''
      }

      // Step 2: Submit proof
      const proofRes = await apiClient.post<ProofUploadResponse>(
        `/api/wallet/deposits/${deposit.id}/proof`,
        proofPayload
      )

      if (proofRes.success) {
        setUploadSuccess(true)
        showToast('Bukti pembayaran berhasil dikirim! Menunggu verifikasi admin.', 'success')
        // Update local deposit state
        // Construct a reference URL from path for private buckets
        const referenceUrl = isPrivate
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/deposits/${uploadData.data.path}`
          : uploadData.data.url
        setDeposit(prev => prev ? {
          ...prev,
          status: 'proof_uploaded',
          proofUrl: referenceUrl,
          senderName: senderNameInput.trim(),
        } : null)
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        showToast(error.message, 'error')
      } else if (error instanceof Error) {
        showToast(error.message, 'error')
      } else {
        showToast('Gagal mengupload bukti pembayaran', 'error')
      }
    } finally {
      setIsUploading(false)
    }
  }

  // Parse destination account JSON
  const getDestinationInfo = (destAccount: string | null) => {
    if (!destAccount) return null
    try {
      return JSON.parse(destAccount)
    } catch {
      return null
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detail Top Up" />
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <InlineSpinner className="w-8 h-8 border-muted-foreground/30 border-t-foreground" />
          <span className="text-sm text-muted-foreground">Memuat detail...</span>
        </div>
      </div>
    )
  }

  if (!deposit) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detail Top Up" />
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Deposit tidak ditemukan</p>
        </div>
      </div>
    )
  }

  const method = methodConfig[deposit.method] || methodConfig.bank_transfer
  const destInfo = getDestinationInfo(deposit.destinationAccount)
  const isActive = deposit.status === 'pending' || deposit.status === 'proof_uploaded'
  const isMidtrans = !!deposit.midtransOrderId || !!deposit.snapToken

  // Reopen Midtrans Snap for pending deposits
  const handleReopenSnap = async () => {
    if (!deposit?.snapToken) return
    try {
      const result = await openSnapPayment(deposit.snapToken)
      if (result.status === 'success') {
        showToast('Pembayaran berhasil!', 'success')
        fetchDepositDetail() // Refresh status
      } else if (result.status === 'pending') {
        showToast('Pembayaran menunggu konfirmasi', 'info')
        fetchDepositDetail()
      } else if (result.status === 'error') {
        showToast('Pembayaran gagal', 'error')
        fetchDepositDetail()
      }
    } catch {
      showToast('Gagal membuka popup pembayaran', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Detail Top Up" />

      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* Amount & Status Hero */}
        <motion.div {...fadeIn}>
          <Card className="p-6 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-emerald-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            {/* Status icon */}
            {deposit.status === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </motion.div>
            )}
            {deposit.status === 'failed' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3"
              >
                <XCircle className="w-8 h-8 text-red-600" />
              </motion.div>
            )}
            {isActive && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3"
              >
                <Clock className="w-8 h-8 text-amber-600" />
              </motion.div>
            )}
            {deposit.status === 'expired' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3"
              >
                <Clock className="w-8 h-8 text-gray-500" />
              </motion.div>
            )}

            {/* Amount */}
            <p className="text-2xl font-bold text-foreground">{formatPrice(deposit.amount)}</p>

            {/* Status badge */}
            <div className="mt-2">
              <span className={`inline-flex items-center font-medium rounded-md text-xs px-2 py-1 ${statusConfig[deposit.status]?.className || statusConfig.pending.className}`}>
                {statusConfig[deposit.status]?.label || 'Unknown'}
              </span>
            </div>

            {/* Expiry countdown */}
            {isActive && deposit.expiredAt && (
              <div className="mt-3 flex justify-center">
                <ExpiryCountdown expiredAt={deposit.expiredAt} />
              </div>
            )}

            {/* Success message */}
            {deposit.status === 'success' && (
              <p className="text-sm text-emerald-600 mt-2 font-medium">
                Saldo berhasil ditambahkan
              </p>
            )}
          </Card>
        </motion.div>

        {/* Deposit Info */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Informasi Deposit" />
          <Card className="mt-3 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Metode</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{method.icon}</span>
                <span className="text-sm font-medium text-foreground">{method.label}</span>
              </div>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tanggal</span>
              <span className="text-sm font-medium text-foreground">{formatDate(deposit.createdAt)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Waktu</span>
              <span className="text-sm text-muted-foreground">{formatRelativeTime(deposit.createdAt)}</span>
            </div>
            {deposit.senderName && (
              <>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Nama Pengirim</span>
                  <span className="text-sm font-medium text-foreground">{deposit.senderName}</span>
                </div>
              </>
            )}
          </Card>
        </motion.div>

        {/* Midtrans Info (for Midtrans deposits) */}
        {isMidtrans && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Informasi Midtrans" icon={<CreditCard className="w-4 h-4" />} />
            <Card className="mt-3 p-4 space-y-3">
              {deposit.midtransOrderId && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Order ID</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-foreground">{deposit.midtransOrderId}</span>
                      <CopyButton text={deposit.midtransOrderId} label="Salin" />
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                </>
              )}
              {deposit.paymentType && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Tipe Pembayaran</span>
                    <span className="text-sm font-medium text-foreground">
                      {midtransPaymentTypeLabels[deposit.paymentType] || deposit.paymentType}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                </>
              )}
              {deposit.midtransTransactionId && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Transaction ID</span>
                    <span className="text-xs font-mono text-muted-foreground">{deposit.midtransTransactionId}</span>
                  </div>
                </>
              )}
              {deposit.status === 'pending' && deposit.snapToken && (
                <>
                  <div className="h-px bg-border" />
                  <PrimaryButton
                    onClick={handleReopenSnap}
                    className="w-full rounded-xl h-11"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Buka Kembali Pembayaran
                  </PrimaryButton>
                </>
              )}
              {deposit.status === 'pending' && (
                <div className="flex gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                    Pembayaran diproses otomatis via Midtrans. Saldo akan langsung masuk setelah pembayaran berhasil.
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Destination Account (for manual deposits only — pending & proof_uploaded) */}
        {!isMidtrans && (deposit.status === 'pending' || deposit.status === 'proof_uploaded') && (
          destInfo ? (
            <motion.div {...fadeIn}>
              <SectionHeader
                title="Rekening Tujuan"
                icon={destInfo.type === 'ewallet' ? <Smartphone className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              />
              <Card className="mt-3 p-4 space-y-3">
                {destInfo.type === 'ewallet' ? (
                  <>
                    {/* E-Wallet Name: prefer ewalletName, fallback to bankName */}
                    {(destInfo.ewalletName || destInfo.bankName) && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">E-Wallet</span>
                          <span className="text-sm font-bold text-foreground">
                            {destInfo.ewalletName || destInfo.bankName}
                          </span>
                        </div>
                        <div className="h-px bg-border" />
                      </>
                    )}
                    {/* Phone/Account Number */}
                    {(destInfo.phoneNumber || destInfo.accountNumber) && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">No. HP / Akun</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground font-mono">
                              {destInfo.phoneNumber || destInfo.accountNumber}
                            </span>
                            <CopyButton text={destInfo.phoneNumber || destInfo.accountNumber || ''} />
                          </div>
                        </div>
                        <div className="h-px bg-border" />
                      </>
                    )}
                    {/* Account Holder */}
                    {destInfo.accountHolder && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Atas Nama</span>
                        <span className="text-sm font-bold text-foreground">{destInfo.accountHolder}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Bank account rendering */}
                    {destInfo.bankName && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Bank</span>
                          <span className="text-sm font-bold text-foreground">{destInfo.bankName}</span>
                        </div>
                        <div className="h-px bg-border" />
                      </>
                    )}
                    {destInfo.accountNumber && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Nomor Rekening</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground font-mono">{destInfo.accountNumber}</span>
                            <CopyButton text={destInfo.accountNumber} />
                          </div>
                        </div>
                        <div className="h-px bg-border" />
                      </>
                    )}
                    {destInfo.accountHolder && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Atas Nama</span>
                          <span className="text-sm font-bold text-foreground">{destInfo.accountHolder}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </Card>
            </motion.div>
          ) : (
            /* No destination account — show warning */
            <motion.div {...fadeIn}>
              <div className="flex gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Rekening tujuan tidak tersedia
                  </p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/60">
                    Hubungi admin untuk informasi rekening tujuan transfer.
                  </p>
                </div>
              </div>
            </motion.div>
          )
        )}

        {/* Upload Proof Section (for manual deposits only — pending) */}
        {!isMidtrans && deposit.status === 'pending' && !uploadSuccess && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Upload Bukti Pembayaran" icon={<ImagePlus className="w-4 h-4" />} />
            <Card className="mt-3 p-4 space-y-4">
              {/* File picker */}
              <div
                onClick={handleFileSelect}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
              >
                {previewUrl ? (
                  <div className="space-y-2">
                    <div className="relative w-full max-h-48 overflow-hidden rounded-lg">
                      <img
                        src={previewUrl}
                        alt="Bukti pembayaran"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Ketuk untuk ganti gambar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImagePlus className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Pilih bukti pembayaran</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG maks. 5MB</p>
                  </div>
                )}
              </div>

              {/* Sender name input */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Nama Pengirim
                </label>
                <Input
                  value={senderNameInput}
                  onChange={(e) => setSenderNameInput(e.target.value)}
                  placeholder="Masukkan nama sesuai rekening"
                  className="h-10 rounded-xl"
                />
              </div>

              {/* Upload button */}
              <PrimaryButton
                onClick={handleUploadProof}
                disabled={!selectedFile || !senderNameInput.trim() || isUploading}
                className="w-full rounded-xl h-11 disabled:opacity-40"
              >
                {isUploading ? (
                  <>
                    <InlineSpinner className="mr-2" />
                    Mengupload...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Kirim Bukti Pembayaran
                  </>
                )}
              </PrimaryButton>
            </Card>
          </motion.div>
        )}

        {/* Upload success message */}
        {uploadSuccess && (
          <motion.div {...fadeIn}>
            <Card className="p-6 text-center border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Bukti pembayaran berhasil dikirim!
              </p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-500 mt-1">
                Admin akan memverifikasi pembayaran Anda
              </p>
              <PrimaryButton
                onClick={() => navigate('deposit-history')}
                className="mt-4 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Riwayat
              </PrimaryButton>
            </Card>
          </motion.div>
        )}

        {/* Proof Uploaded State */}
        {deposit.status === 'proof_uploaded' && deposit.proofUrl && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Bukti Pembayaran" icon={<Eye className="w-4 h-4" />} />
            <Card className="mt-3 p-4 space-y-3">
              <div className="relative w-full max-h-64 overflow-hidden rounded-lg bg-muted">
                <img
                  src={deposit.proofUrl}
                  alt="Bukti pembayaran"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Menunggu verifikasi admin</span>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Admin Note (for failed or proof_uploaded) */}
        {(deposit.status === 'failed' || (deposit.status === 'proof_uploaded' && deposit.adminNote)) && deposit.adminNote && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Catatan Admin" icon={<AlertCircle className="w-4 h-4" />} />
            <Card className={`mt-3 p-4 ${
              deposit.status === 'failed'
                ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10'
            }`}>
              <p className={`text-sm ${
                deposit.status === 'failed'
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}>
                {deposit.adminNote}
              </p>
            </Card>
          </motion.div>
        )}

        {/* Failed State - Action */}
        {deposit.status === 'failed' && (
          <motion.div {...fadeIn}>
            <Card className="p-5 text-center border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
              <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Top Up Ditolak
              </p>
              {deposit.adminNote && (
                <p className="text-xs text-red-600/70 dark:text-red-500 mt-1">
                  Alasan: {deposit.adminNote}
                </p>
              )}
            </Card>
          </motion.div>
        )}

        {/* Expired State - Action */}
        {deposit.status === 'expired' && (
          <motion.div {...fadeIn}>
            <Card className="p-5 text-center border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/10">
              <Clock className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Deposit Kadaluarsa
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Waktu pembayaran telah habis
              </p>
              <PrimaryButton
                onClick={() => navigate('deposit')}
                className="mt-4 rounded-xl"
              >
                Buat Top Up Baru
              </PrimaryButton>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
