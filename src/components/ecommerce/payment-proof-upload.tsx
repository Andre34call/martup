"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import { useAppStore } from "@/lib/store"
import {
  Upload, Building2, CheckCircle2, Clock, ImageIcon, ChevronDown, Copy, X, Loader2, AlertTriangle
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

// ==================== TYPES ====================
interface BankAccount {
  id: string
  bankName: string
  bankCode?: string
  accountNumber: string
  accountHolder: string
  isDefault: boolean
}

interface PaymentProofUploadProps {
  orderId: string
  orderNumber: string
  totalAmount: number
  paymentStatus: string // 'unpaid' | 'pending_verification' | 'paid' | 'failed'
  currentProofUrl?: string | null
  currentBankAccountId?: string | null
}

// ==================== COMPONENT ====================
export function PaymentProofUpload({
  orderId,
  orderNumber,
  totalAmount,
  paymentStatus,
  currentProofUrl,
  currentBankAccountId,
}: PaymentProofUploadProps) {
  const { showToast, updateOrderPaymentStatus } = useAppStore()

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedBankId, setSelectedBankId] = useState<string | null>(currentBankAccountId || null)
  const [isLoadingBanks, setIsLoadingBanks] = useState(false)

  // Form state
  const [senderName, setSenderName] = useState("")
  const [senderBank, setSenderBank] = useState("")
  const [proofImage, setProofImage] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(currentProofUrl || null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Drag state
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch bank accounts on mount (when unpaid or failed)
  useEffect(() => {
    if (paymentStatus === "unpaid" || paymentStatus === "failed") {
      fetchBankAccounts()
    }
  }, [paymentStatus])

  const fetchBankAccounts = async () => {
    setIsLoadingBanks(true)
    try {
      type BankAccountsResponse = { success: boolean; data?: BankAccount[]; error?: string }
      const data = await apiClient.get<BankAccountsResponse>("/api/bank-accounts")
      if (data.success && data.data) {
        setBankAccounts(data.data)
        // Auto-select default bank account
        const defaultBank = data.data.find((b: BankAccount) => b.isDefault)
        if (defaultBank && !selectedBankId) {
          setSelectedBankId(defaultBank.id)
        }
      }
    } catch {
      showToast("Gagal memuat rekening bank", "error")
    } finally {
      setIsLoadingBanks(false)
    }
  }

  const handleCopyAccountNumber = useCallback((accountNumber: string) => {
    navigator.clipboard?.writeText(accountNumber).then(() => {
      showToast("Nomor rekening disalin!", "success")
    }).catch(() => {
      showToast("Gagal menyalin", "error")
    })
  }, [showToast])

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Hanya file gambar yang diperbolehkan", "error")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran file maksimal 5MB", "error")
      return
    }
    setProofImage(file)
    const reader = new FileReader()
    reader.onload = (e) => setProofPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [showToast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const removeProofImage = useCallback(() => {
    setProofImage(null)
    setProofPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!selectedBankId) {
      showToast("Pilih rekening tujuan transfer", "error")
      return
    }
    if (!senderName.trim()) {
      showToast("Masukkan nama pengirim", "error")
      return
    }
    if (!senderBank.trim()) {
      showToast("Masukkan bank pengirim", "error")
      return
    }
    if (!proofImage && !proofPreview) {
      showToast("Upload bukti transfer", "error")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("platformBankAccountId", selectedBankId)
      formData.append("senderName", senderName.trim())
      formData.append("senderBank", senderBank.trim())
      if (proofImage) {
        formData.append("proofImage", proofImage)
      }

      type ProofResponse = { success: boolean; error?: string }
      const data = await apiClient.upload<ProofResponse>(`/api/orders/${orderId}/payment-proof`, formData)

      if (data.success) {
        setUploadSuccess(true)
        showToast("Bukti transfer berhasil diupload! Menunggu verifikasi admin.", "success")
        // Update local order status
        if (updateOrderPaymentStatus) {
          updateOrderPaymentStatus(orderId, "pending_verification")
        }
      } else {
        showToast(data.error || "Gagal mengupload bukti transfer", "error")
      }
    } catch {
      showToast("Gagal mengupload bukti transfer. Silakan coba lagi.", "error")
    } finally {
      setIsUploading(false)
    }
  }, [selectedBankId, senderName, senderBank, proofImage, proofPreview, orderId, showToast, updateOrderPaymentStatus])

  // ==================== RENDER: PENDING VERIFICATION ====================
  if (paymentStatus === "pending_verification") {
    const selectedBank = bankAccounts.find(b => b.id === currentBankAccountId) || bankAccounts[0]

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Bukti Transfer Sedang Diverifikasi
            </h4>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Bukti transfer sedang diverifikasi oleh admin. Proses verifikasi biasanya memakan waktu 1x24 jam.
            </p>

            {/* Status Badge */}
            <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-md text-xs font-medium">
              <Clock className="w-3 h-3" />
              Menunggu Verifikasi Pembayaran
            </div>

            {/* Proof Image Preview */}
            {proofPreview && (
              <div className="mt-3">
                <button
                  onClick={() => window.open(proofPreview, "_blank")}
                  className="w-20 h-20 rounded-lg overflow-hidden border border-amber-200 dark:border-amber-800/50 hover:opacity-90 transition-opacity"
                >
                  <img src={proofPreview} alt="Bukti Transfer" className="w-full h-full object-cover" />
                </button>
                <p className="text-[10px] text-amber-500 mt-1">Tap untuk melihat</p>
              </div>
            )}

            {/* Bank Account Info */}
            {selectedBank && (
              <div className="mt-3 p-3 bg-white dark:bg-amber-950/40 rounded-lg border border-amber-100 dark:border-amber-800/30">
                <p className="text-[10px] text-amber-500 font-medium">Rekening Tujuan Transfer</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{selectedBank.bankName}</p>
                <p className="text-xs text-muted-foreground">{selectedBank.accountNumber} &middot; {selectedBank.accountHolder}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // ==================== RENDER: FAILED ====================
  if (paymentStatus === "failed") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Error Notice */}
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-800 dark:text-red-300">
                Bukti Transfer Ditolak
              </h4>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Bukti transfer ditolak. Silakan upload ulang bukti transfer yang benar.
              </p>
            </div>
          </div>
        </div>

        {/* Re-upload form */}
        <UploadForm
          bankAccounts={bankAccounts}
          isLoadingBanks={isLoadingBanks}
          selectedBankId={selectedBankId}
          setSelectedBankId={setSelectedBankId}
          senderName={senderName}
          setSenderName={setSenderName}
          senderBank={senderBank}
          setSenderBank={setSenderBank}
          proofPreview={proofPreview}
          isDragOver={isDragOver}
          fileInputRef={fileInputRef}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          handleFileSelect={handleFileSelect}
          removeProofImage={removeProofImage}
          handleCopyAccountNumber={handleCopyAccountNumber}
          totalAmount={totalAmount}
          isUploading={isUploading}
          handleSubmit={handleSubmit}
          uploadSuccess={uploadSuccess}
        />
      </motion.div>
    )
  }

  // ==================== RENDER: UNPAID (default) ====================
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {uploadSuccess ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Bukti Transfer Berhasil Diupload!
              </h4>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                Bukti transfer sedang menunggu verifikasi admin.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <UploadForm
          bankAccounts={bankAccounts}
          isLoadingBanks={isLoadingBanks}
          selectedBankId={selectedBankId}
          setSelectedBankId={setSelectedBankId}
          senderName={senderName}
          setSenderName={setSenderName}
          senderBank={senderBank}
          setSenderBank={setSenderBank}
          proofPreview={proofPreview}
          isDragOver={isDragOver}
          fileInputRef={fileInputRef}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          handleFileSelect={handleFileSelect}
          removeProofImage={removeProofImage}
          handleCopyAccountNumber={handleCopyAccountNumber}
          totalAmount={totalAmount}
          isUploading={isUploading}
          handleSubmit={handleSubmit}
          uploadSuccess={uploadSuccess}
        />
      )}
    </motion.div>
  )
}

// ==================== UPLOAD FORM SUB-COMPONENT ====================
interface UploadFormProps {
  bankAccounts: BankAccount[]
  isLoadingBanks: boolean
  selectedBankId: string | null
  setSelectedBankId: (id: string | null) => void
  senderName: string
  setSenderName: (v: string) => void
  senderBank: string
  setSenderBank: (v: string) => void
  proofPreview: string | null
  isDragOver: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: () => void
  handleDrop: (e: React.DragEvent) => void
  handleFileSelect: (file: File) => void
  removeProofImage: () => void
  handleCopyAccountNumber: (accountNumber: string) => void
  totalAmount: number
  isUploading: boolean
  handleSubmit: () => void
  uploadSuccess: boolean
}

function UploadForm({
  bankAccounts,
  isLoadingBanks,
  selectedBankId,
  setSelectedBankId,
  senderName,
  setSenderName,
  senderBank,
  setSenderBank,
  proofPreview,
  isDragOver,
  fileInputRef,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileSelect,
  removeProofImage,
  handleCopyAccountNumber,
  totalAmount,
  isUploading,
  handleSubmit,
  uploadSuccess,
}: UploadFormProps) {
  return (
    <>
      {/* Section: Transfer ke Rekening MartUp */}
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-600" />
          Transfer ke Rekening MartUp
        </h3>
        <p className="text-[10px] text-muted-foreground mb-3">
          Total yang harus ditransfer: <span className="font-bold text-amber-600">{formatPrice(totalAmount)}</span>
        </p>

        {/* Bank Account Cards */}
        {isLoadingBanks ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            <span className="text-xs text-muted-foreground ml-2">Memuat rekening...</span>
          </div>
        ) : bankAccounts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Rekening belum tersedia</p>
        ) : (
          <div className="space-y-2">
            {bankAccounts.map((bank) => {
              const isSelected = selectedBankId === bank.id

              return (
                <motion.button
                  key={bank.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedBankId(bank.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                      : "border-border/50 bg-card hover:border-amber-300 dark:hover:border-amber-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{bank.bankName}</span>
                        {bank.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-mono font-semibold text-foreground tracking-wider">
                          {bank.accountNumber}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyAccountNumber(bank.accountNumber)
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                        >
                          <Copy className="w-3 h-3 text-amber-600" />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">a.n. {bank.accountHolder}</p>
                    </div>
                    {/* Radio indicator */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${
                      isSelected ? "border-amber-500 bg-amber-500" : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* Section: Form Fields */}
      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ChevronDown className="w-4 h-4 text-amber-600" />
          Informasi Pengirim
        </h3>

        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Nama Pengirim</label>
          <Input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Nama sesuai rekening"
            className="h-10 text-sm rounded-lg"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Bank Pengirim</label>
          <Input
            value={senderBank}
            onChange={(e) => setSenderBank(e.target.value)}
            placeholder="Contoh: BCA, BRI, Mandiri"
            className="h-10 text-sm rounded-lg"
          />
        </div>
      </div>

      {/* Section: Upload Bukti Transfer */}
      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Upload className="w-4 h-4 text-amber-600" />
          Upload Bukti Transfer
        </h3>

        {/* Drag and drop upload area */}
        {!proofPreview ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                : "border-border/50 hover:border-amber-400 dark:hover:border-amber-700"
            }`}
          >
            <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Tap atau seret gambar bukti transfer di sini
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, max 5MB</p>
          </div>
        ) : (
          <div className="relative inline-block">
            <img
              src={proofPreview}
              alt="Bukti Transfer"
              className="w-24 h-24 rounded-lg object-cover border border-border/30"
            />
            <button
              onClick={removeProofImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
          }}
        />
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={isUploading || uploadSuccess}
        className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-sm font-semibold"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Mengupload...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload Bukti Transfer
          </>
        )}
      </Button>
    </>
  )
}
