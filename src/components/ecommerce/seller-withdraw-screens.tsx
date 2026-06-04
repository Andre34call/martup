"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowUpRight, ArrowDownLeft, Check, Clock, AlertTriangle,
  ChevronRight, Wallet, Banknote, Building2, Info, Shield,
  ArrowRight, X, Plus, CheckCircle2, XCircle, Loader2,
  TrendingUp, Package, CreditCard
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, SectionHeader, EmptyState, PrimaryButton, InlineSpinner } from "./shared"
import type { BankAccount, WithdrawRequest, WithdrawStatus } from "@/lib/types"
import { useState, useMemo } from "react"

// ==================== WITHDRAW STATUS CONFIG ====================
const statusConfig: Record<WithdrawStatus, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Menunggu Review", color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: Clock },
  approved: { label: "Disetujui", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800", icon: CheckCircle2 },
  processing: { label: "Diproses", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800", icon: Loader2 },
  processed: { label: "Diproses", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800", icon: Loader2 },
  completed: { label: "Selesai", color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  rejected: { label: "Ditolak", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", icon: XCircle },
}

// ==================== BANK LOGOS ====================
const bankLogos: Record<string, string> = {
  BCA: "🏦", Mandiri: "🏛️", BNI: "🏛️", BRI: "🏛️",
  CIMB: "🏦", Danamon: "🏦", Permata: "🏦", BS: "🏦",
}

// ==================== STEP INDICATOR ====================
const WD_STEPS = [
  { key: 'amount', label: 'Nominal', icon: Wallet },
  { key: 'bank', label: 'Rekening', icon: Building2 },
  { key: 'confirm', label: 'Konfirmasi', icon: Check },
]

function WithdrawStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        {WD_STEPS.map((step, idx) => {
          const Icon = step.icon
          const isCompleted = idx < currentStep
          const isCurrent = idx === currentStep

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted || isCurrent
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
                </motion.div>
                <span className={`text-[10px] font-medium ${isCurrent ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
              {idx < WD_STEPS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-12px]">
                  <div className={`h-0.5 rounded-full ${idx < currentStep ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== QUICK AMOUNT BUTTONS ====================
function QuickAmountButton({ amount, label, onClick }: { amount: number; label: string; onClick: (amount: number) => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => onClick(amount)}
      className="flex-shrink-0 px-4 py-2 rounded-xl border border-border/50 bg-card text-sm font-medium text-foreground hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
    >
      {label}
    </motion.button>
  )
}

// ==================== BANK ACCOUNT SELECTOR ====================
function BankAccountSelector({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: BankAccount[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {accounts.map((account) => {
        const isSelected = selectedId === account.id
        const logo = bankLogos[account.bankName] || '🏦'

        return (
          <motion.button
            key={account.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(account.id)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
              isSelected
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500"
                : "bg-card border-border/50 hover:border-emerald-300"
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600"
            }`}>
              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <span className="text-2xl flex-shrink-0">{logo}</span>
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">{account.bankName}</p>
                {account.isDefault && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] px-1.5 py-0.5">
                    Utama
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{account.accountNumber} · {account.accountHolder}</p>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ==================== WITHDRAW REQUEST CARD ====================
function WithdrawRequestCard({ request }: { request: WithdrawRequest }) {
  const config = statusConfig[request.status]
  const StatusIcon = config.icon
  const logo = bankLogos[request.bankAccount.bankName] || '🏦'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border/50 overflow-hidden"
    >
      {/* Status header */}
      <div className={`px-4 py-2.5 flex items-center justify-between border-b ${config.bgColor}`}>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${config.color} ${request.status === 'processing' ? 'animate-spin' : ''}`} />
          <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(request.requestDate)}</span>
      </div>

      {/* Amount */}
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground">Jumlah Penarikan</p>
        <p className="text-lg font-bold text-foreground">{formatPrice(request.amount)}</p>
      </div>

      <Separator className="opacity-50" />

      {/* Details */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Biaya Admin</span>
          <span className="text-xs font-medium text-foreground">{formatPrice(request.adminFee)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Diterima</span>
          <span className="text-xs font-bold text-emerald-600">{formatPrice(request.netAmount)}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-lg">{logo}</span>
          <div>
            <p className="text-xs font-medium text-foreground">{request.bankAccount.bankName} · {request.bankAccount.accountNumber.slice(-4)}</p>
            <p className="text-[10px] text-muted-foreground">{request.bankAccount.accountHolder}</p>
          </div>
        </div>
        {request.estimatedArrival && (request.status === 'pending' || request.status === 'approved') && (
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Estimasi tiba: {request.estimatedArrival}</span>
          </div>
        )}
        {request.rejectionReason && (
          <div className="flex items-center gap-1.5 mt-1 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
            <span className="text-[10px] text-red-600 dark:text-red-400">{request.rejectionReason}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ==================== SELLER WITHDRAW (Multi-step) ====================
export function SellerWithdrawScreen() {
  const { sellerBalance, sellerBankAccounts, requestWithdraw, showToast, navigate, addBankAccount } = useAppStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [amount, setAmount] = useState('')
  const [selectedBankId, setSelectedBankId] = useState<string | null>(
    sellerBankAccounts.find(a => a.isDefault)?.id || null
  )
  const [showAddBank, setShowAddBank] = useState(false)
  const [newBankName, setNewBankName] = useState('')
  const [newAccountNumber, setNewAccountNumber] = useState('')
  const [newAccountHolder, setNewAccountHolder] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const availableBalance = sellerBalance.availableBalance
  const parsedAmount = parseInt(amount.replace(/\D/g, '')) || 0
  const adminFee = parsedAmount > 0 ? 1000 : 0
  const netAmount = parsedAmount - adminFee
  const minWithdraw = 10000

  const canProceedToStep1 = parsedAmount >= minWithdraw && parsedAmount <= availableBalance
  const canProceedToStep2 = selectedBankId !== null
  const canSubmit = canProceedToStep1 && canProceedToStep2

  const handleQuickAmount = (val: number) => {
    if (val === 0) {
      setAmount(availableBalance.toString())
    } else {
      setAmount(val.toString())
    }
  }

  const handleAddBank = () => {
    if (!newBankName || !newAccountNumber || !newAccountHolder) {
      showToast("Lengkapi data rekening", "error")
      return
    }
    const newAccount: BankAccount = {
      id: `ba${Date.now()}`,
      bankName: newBankName,
      accountNumber: newAccountNumber,
      accountHolder: newAccountHolder,
      isDefault: sellerBankAccounts.length === 0,
    }
    addBankAccount(newAccount)
    setSelectedBankId(newAccount.id)
    setShowAddBank(false)
    setNewBankName('')
    setNewAccountNumber('')
    setNewAccountHolder('')
    showToast("Rekening berhasil ditambahkan", "success")
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      await requestWithdraw(parsedAmount, selectedBankId!)
      setIsSubmitting(false)
      showToast("Permintaan penarikan berhasil diajukan!", "success")
      setTimeout(() => {
        navigate('seller-wallet')
      }, 1500)
    } catch {
      setIsSubmitting(false)
      showToast("Gagal mengajukan penarikan dana", "error")
    }
  }

  const selectedBank = sellerBankAccounts.find(a => a.id === selectedBankId)

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Tarik Dana" />

      <WithdrawStepIndicator currentStep={currentStep} />

      <AnimatePresence mode="wait">
        {/* ====== STEP 0: AMOUNT ====== */}
        {currentStep === 0 && (
          <motion.div
            key="step-amount"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="px-4 space-y-4"
          >
            {/* Available balance */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
              <p className="text-sm text-emerald-100">Saldo Tersedia untuk WD</p>
              <p className="text-3xl font-bold mt-1">{formatPrice(availableBalance)}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-emerald-200">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Pending: {formatPrice(sellerBalance.pendingBalance)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>Hold: {formatPrice(sellerBalance.holdBalance)}</span>
                </div>
              </div>
            </div>

            {/* Amount input */}
            <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
              <label className="text-sm font-bold text-foreground">Nominal Penarikan</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">Rp</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount ? parseInt(amount).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    setAmount(val)
                  }}
                  className="pl-12 h-14 text-2xl font-bold rounded-xl border-2 focus:border-emerald-500"
                />
              </div>
              {parsedAmount > availableBalance && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Saldo tidak mencukupi
                </p>
              )}
              {parsedAmount > 0 && parsedAmount < minWithdraw && (
                <p className="text-xs text-amber-500 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Minimum penarikan {formatPrice(minWithdraw)}
                </p>
              )}

              {/* Quick amounts */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <QuickAmountButton amount={100000} label="100rb" onClick={handleQuickAmount} />
                <QuickAmountButton amount={500000} label="500rb" onClick={handleQuickAmount} />
                <QuickAmountButton amount={1000000} label="1jt" onClick={handleQuickAmount} />
                <QuickAmountButton amount={5000000} label="5jt" onClick={handleQuickAmount} />
                <QuickAmountButton amount={0} label="Semua" onClick={handleQuickAmount} />
              </div>

              {/* Fee preview */}
              {parsedAmount >= minWithdraw && (
                <div className="bg-muted/30 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Nominal</span>
                    <span className="font-medium">{formatPrice(parsedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Biaya Admin</span>
                    <span className="font-medium text-red-500">-{formatPrice(adminFee)}</span>
                  </div>
                  <Separator className="opacity-50" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">Diterima</span>
                    <span className="font-bold text-emerald-600">{formatPrice(Math.max(0, netAmount))}</span>
                  </div>
                </div>
              )}
            </div>

            <PrimaryButton
              className="w-full h-12 rounded-xl font-bold text-sm gap-1.5"
              disabled={!canProceedToStep1}
              onClick={() => setCurrentStep(1)}
            >
              Lanjut Pilih Rekening
              <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </motion.div>
        )}

        {/* ====== STEP 1: BANK ACCOUNT ====== */}
        {currentStep === 1 && (
          <motion.div
            key="step-bank"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="px-4 space-y-4"
          >
            <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-foreground">Pilih Rekening Tujuan</label>
                <button
                  onClick={() => setShowAddBank(!showAddBank)}
                  className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  Tambah
                </button>
              </div>

              <BankAccountSelector
                accounts={sellerBankAccounts}
                selectedId={selectedBankId}
                onSelect={setSelectedBankId}
              />
            </div>

            {/* Add bank account form */}
            <AnimatePresence>
              {showAddBank && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
                    <h4 className="text-sm font-bold">Tambah Rekening Baru</h4>
                    <Input
                      placeholder="Nama Bank (BCA, Mandiri, dll)"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      className="rounded-xl h-10"
                    />
                    <Input
                      placeholder="Nomor Rekening"
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value)}
                      className="rounded-xl h-10"
                      inputMode="numeric"
                    />
                    <Input
                      placeholder="Nama Pemilik Rekening"
                      value={newAccountHolder}
                      onChange={(e) => setNewAccountHolder(e.target.value)}
                      className="rounded-xl h-10"
                    />
                    <PrimaryButton
                      className="w-full h-10 rounded-xl text-sm font-bold"
                      onClick={handleAddBank}
                    >
                      Simpan Rekening
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl font-bold text-sm"
                onClick={() => setCurrentStep(0)}
              >
                Kembali
              </Button>
              <PrimaryButton
                className="flex-1 h-12 rounded-xl font-bold text-sm gap-1.5"
                disabled={!canProceedToStep2}
                onClick={() => setCurrentStep(2)}
              >
                Lanjut Konfirmasi
                <ArrowRight className="w-4 h-4" />
              </PrimaryButton>
            </div>
          </motion.div>
        )}

        {/* ====== STEP 2: CONFIRMATION ====== */}
        {currentStep === 2 && (
          <motion.div
            key="step-confirm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="px-4 space-y-4"
          >
            {/* Summary */}
            <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Konfirmasi Penarikan
              </h3>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nominal</span>
                  <span className="text-sm font-bold">{formatPrice(parsedAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Biaya Admin</span>
                  <span className="text-sm font-medium text-red-500">-{formatPrice(adminFee)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Total Diterima</span>
                  <span className="text-lg font-bold text-emerald-600">{formatPrice(Math.max(0, netAmount))}</span>
                </div>
              </div>
            </div>

            {/* Bank destination */}
            {selectedBank && (
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <p className="text-xs text-muted-foreground mb-2">Rekening Tujuan</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{bankLogos[selectedBank.bankName] || '🏦'}</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{selectedBank.bankName}</p>
                    <p className="text-xs text-muted-foreground">{selectedBank.accountNumber} · {selectedBank.accountHolder}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Estimated arrival */}
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 flex items-start gap-3 border border-blue-200 dark:border-blue-800">
              <Clock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Estimasi Waktu</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Dana akan tiba dalam 1-2 hari kerja setelah disetujui admin</p>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-xl">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Penarikan akan melalui proses review admin. Jika disetujui, dana akan ditransfer ke rekening tujuan.
                Komisi platform 5% sudah dipotong dari saldo tersedia.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl font-bold text-sm"
                onClick={() => setCurrentStep(1)}
              >
                Kembali
              </Button>
              <PrimaryButton
                className="flex-1 h-12 rounded-xl font-bold text-sm gap-1.5"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <>
                    <InlineSpinner className="w-4 h-4" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Ajukan Penarikan
                  </>
                )}
              </PrimaryButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== SELLER WITHDRAW HISTORY ====================
export function SellerWithdrawHistoryScreen() {
  const { withdrawRequests, currentUser } = useAppStore()
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "completed" | "rejected">("all")

  // Derive sellerId from store
  const sellerId = useAppStore((s) => s.seller?.id) || 's1'

  // Only show current seller's withdraw requests
  const myRequests = withdrawRequests.filter(w => w.sellerId === sellerId)

  const filteredRequests = useMemo(() => {
    if (activeTab === "all") return myRequests
    return myRequests.filter(w => w.status === activeTab)
  }, [myRequests, activeTab])

  const pendingCount = myRequests.filter(w => w.status === 'pending').length
  const completedCount = myRequests.filter(w => w.status === 'completed').length
  const rejectedCount = myRequests.filter(w => w.status === 'rejected').length

  const tabs = [
    { key: "all" as const, label: "Semua", count: myRequests.length },
    { key: "pending" as const, label: "Pending", count: pendingCount },
    { key: "completed" as const, label: "Selesai", count: completedCount },
    { key: "rejected" as const, label: "Ditolak", count: rejectedCount },
  ]

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Riwayat Penarikan" />

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
                activeTab === tab.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Request list */}
        <div className="space-y-3">
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={<Banknote className="w-10 h-10 text-muted-foreground" />}
              title="Belum Ada Riwayat"
              subtitle="Riwayat penarikan dana akan muncul di sini"
            />
          ) : (
            filteredRequests.map((request) => (
              <WithdrawRequestCard key={request.id} request={request} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
