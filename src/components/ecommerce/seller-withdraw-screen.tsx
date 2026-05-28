"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowUpRight, ArrowDownLeft, Banknote, Clock, Check, X, ChevronRight,
  ArrowLeft, Plus, Trash2, Shield, AlertTriangle, CheckCircle2, Loader2,
  Wallet, FileText, Copy, Info, Building2, CircleDollarSign
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, SectionHeader, StatusBadge, EmptyState } from "./shared"
import type { BankAccount, WithdrawRequest, WithdrawStatus } from "@/lib/types"
import { useState, useMemo } from "react"

// ==================== BANK LOGOS ====================
const BANK_INFO: Record<string, { name: string; color: string; icon: string }> = {
  bca: { name: "BCA", color: "bg-blue-600", icon: "BCA" },
  mandiri: { name: "Mandiri", color: "bg-blue-800", icon: "MDR" },
  bni: { name: "BNI", color: "bg-orange-600", icon: "BNI" },
  bri: { name: "BRI", color: "bg-blue-500", icon: "BRI" },
  cimb: { name: "CIMB Niaga", color: "bg-red-600", icon: "CIMB" },
  danamon: { name: "Danamon", color: "bg-yellow-500", icon: "DNMN" },
  permata: { name: "Permata", color: "bg-green-600", icon: "PRMT" },
  bsi: { name: "BSI", color: "bg-emerald-700", icon: "BSI" },
  btn: { name: "BTN", color: "bg-orange-500", icon: "BTN" },
  neo: { name: "Bank Neo", color: "bg-violet-600", icon: "NEO" },
  seabank: { name: "SeaBank", color: "bg-sky-500", icon: "SEA" },
  jago: { name: "Bank Jago", color: "bg-emerald-500", icon: "JAGO" },
}

function getBankInfo(code: string) {
  return BANK_INFO[code] || { name: code, color: "bg-gray-500", icon: code.slice(0, 3).toUpperCase() }
}

// ==================== WITHDRAW STATUS BADGE ====================
function WithdrawStatusBadge({ status }: { status: WithdrawStatus }) {
  const config: Record<WithdrawStatus, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: "Menunggu", color: "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-900/20", icon: Clock },
    approved: { label: "Disetujui", color: "border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-900/20", icon: CheckCircle2 },
    processing: { label: "Diproses", color: "border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-900/20", icon: Loader2 },
    processed: { label: "Diproses", color: "border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-900/20", icon: Loader2 },
    completed: { label: "Berhasil", color: "border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20", icon: CheckCircle2 },
    rejected: { label: "Ditolak", color: "border-red-300 text-red-600 bg-red-50 dark:bg-red-900/20", icon: X },
  }
  const c = config[status]
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${c.color}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  )
}

// ==================== SELLER WITHDRAW SCREEN (Multi-step) ====================
const PLATFORM_FEE_RATE = 0.05
const getSellerIncome = (order: { subtotal: number }) => Math.round(order.subtotal * (1 - PLATFORM_FEE_RATE))

export function SellerWithdrawScreen() {
  const { goBack, walletBalance, walletHoldBalance, sellerBankAccounts, requestWithdraw, showToast, navigate, orders, seller } = useAppStore()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1) // 1=Select Bank, 2=Amount, 3=Confirm, 4=Success
  const [selectedBankId, setSelectedBankId] = useState<string>(
    sellerBankAccounts.find(a => a.isDefault)?.id || ""
  )
  const [amount, setAmount] = useState("")
  const [refNumber, setRefNumber] = useState("")
  const [showAddBank, setShowAddBank] = useState(false)

  // Add bank form state
  const [newBankCode, setNewBankCode] = useState("bca")
  const [newAccountNumber, setNewAccountNumber] = useState("")
  const [newAccountHolder, setNewAccountHolder] = useState("")

  const availableBalance = walletBalance
  const minWithdraw = 10000
  const adminFee = useMemo(() => {
    const amt = parseInt(amount) || 0
    return amt > 0 ? Math.max(1000, Math.min(amt * 0.01, 10000)) : 0
  }, [amount])
  const netAmount = (parseInt(amount) || 0) - adminFee

  const selectedBank = sellerBankAccounts.find(a => a.id === selectedBankId)

  // Order-based fund source
  const sellerOrders = orders.filter(o => o.sellerId === seller?.id)
  const deliveredOrders = sellerOrders.filter(o => o.status === 'delivered')
  const totalDeliveredIncome = deliveredOrders.reduce((sum, o) => sum + getSellerIncome(o), 0)

  // Quick amount options
  const quickAmounts = useMemo(() => {
    const options = [10000, 50000, 100000, 500000, 1000000]
    return options.filter(a => a <= availableBalance)
  }, [availableBalance])

  const handleAddBank = () => {
    if (!newAccountNumber || !newAccountHolder) {
      showToast("Lengkapi data rekening bank", "error")
      return
    }
    if (newAccountNumber.length < 6) {
      showToast("Nomor rekening minimal 6 digit", "error")
      return
    }

    const { addBankAccount } = useAppStore.getState()
    addBankAccount({
      id: `ba-${Date.now()}`,
      bankName: getBankInfo(newBankCode).name,
      accountNumber: newAccountNumber,
      accountHolder: newAccountHolder,
      isDefault: sellerBankAccounts.length === 0,
    })

    showToast("Rekening bank berhasil ditambahkan!", "success")
    setNewAccountNumber("")
    setNewAccountHolder("")
    setShowAddBank(false)

    // Auto-select the newly added bank
    const accounts = useAppStore.getState().sellerBankAccounts
    if (accounts.length > 0) {
      setSelectedBankId(accounts[accounts.length - 1].id)
    }
  }

  const handleStep2Next = () => {
    const amt = parseInt(amount) || 0
    if (amt < minWithdraw) {
      showToast(`Minimal penarikan ${formatPrice(minWithdraw)}`, "error")
      return
    }
    if (amt > availableBalance) {
      showToast("Jumlah melebihi saldo tersedia", "error")
      return
    }
    if (!selectedBankId) {
      showToast("Pilih rekening tujuan terlebih dahulu", "error")
      return
    }
    setStep(3)
  }

  const handleConfirm = () => {
    requestWithdraw(parseInt(amount), selectedBankId)
    setRefNumber(`WD-${Date.now()}`)
    setStep(4)
    showToast("Penarikan dana berhasil diajukan!", "success")
  }

  const handleCopyRef = () => {
    navigator.clipboard.writeText(refNumber).then(() => {
      showToast("Nomor referensi disalin!", "success")
    }).catch(() => {
      showToast("Gagal menyalin", "error")
    })
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <PageHeader
        title={step === 4 ? "Penarikan Berhasil" : "Tarik Dana"}
        onBack={step > 1 && step < 4 ? () => setStep((step - 1) as 1 | 2 | 3) : undefined}
      />

      <div className="px-4 space-y-4">
        {/* Progress Indicator */}
        {step < 4 && (
          <motion.div {...fadeIn} className="flex items-center gap-2 px-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`h-1.5 rounded-full flex-1 transition-colors ${
                  s <= step ? "bg-emerald-500" : "bg-muted"
                }`} />
              </div>
            ))}
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
              {step === 1 ? "Pilih Rekening" : step === 2 ? "Masukkan Jumlah" : "Konfirmasi"}
            </span>
          </motion.div>
        )}

        {/* Available Balance (always visible) */}
        {step < 4 && (
          <motion.div {...fadeIn}>
            <Card className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Saldo Tersedia</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatPrice(availableBalance)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {walletHoldBalance > 0 && (
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
                      Tertahan: {formatPrice(walletHoldBalance)}
                    </p>
                  )}
                  {totalDeliveredIncome > 0 && (
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
                      Dari {deliveredOrders.length} pesanan selesai
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* ===== STEP 1: Select/Add Bank Account ===== */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {/* Bank Account List */}
              <div>
                <SectionHeader title="Pilih Rekening Tujuan" icon={<Building2 className="w-4 h-4" />} />
                <div className="space-y-2 mt-3">
                  {sellerBankAccounts.length === 0 && !showAddBank && (
                    <EmptyState
                      icon={<Building2 className="w-10 h-10 text-muted-foreground" />}
                      title="Belum Ada Rekening"
                      subtitle="Tambahkan rekening bank untuk menerima dana"
                    />
                  )}
                  {sellerBankAccounts.map((account, i) => {
                    const bankInfo = getBankInfo(account.bankCode || account.bankName?.toLowerCase() || 'bca')
                    const isSelected = selectedBankId === account.id
                    return (
                      <motion.div key={account.id} custom={i} variants={stagger} initial="initial" animate="animate">
                        <Card
                          className={`p-3 cursor-pointer transition-all ${
                            isSelected
                              ? "ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-700"
                              : "hover:border-muted-foreground/30"
                          }`}
                          onClick={() => setSelectedBankId(account.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${bankInfo.color} text-white font-bold text-xs flex items-center justify-center flex-shrink-0`}>
                              {bankInfo.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{account.bankName}</p>
                                {account.isDefault && (
                                  <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-600 h-4">Utama</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">{account.accountNumber}</p>
                              <p className="text-xs text-muted-foreground">a/n {account.accountHolder}</p>
                            </div>
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Add Bank Account */}
              <AnimatePresence>
                {showAddBank && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Card className="p-4 space-y-3 border-dashed border-2">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Tambah Rekening Baru
                      </p>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">Nama Bank</label>
                        <select
                          value={newBankCode}
                          onChange={e => setNewBankCode(e.target.value)}
                          className="w-full h-10 rounded-xl border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        >
                          {Object.entries(BANK_INFO).map(([code, info]) => (
                            <option key={code} value={code}>{info.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">Nomor Rekening</label>
                        <Input
                          value={newAccountNumber}
                          onChange={e => setNewAccountNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="Masukkan nomor rekening"
                          className="rounded-xl"
                          maxLength={20}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">Nama Pemilik Rekening</label>
                        <Input
                          value={newAccountHolder}
                          onChange={e => setNewAccountHolder(e.target.value)}
                          placeholder="Nama sesuai buku rekening"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddBank}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-9 text-xs"
                        >
                          Simpan Rekening
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddBank(false)}
                          className="rounded-xl h-9 text-xs"
                        >
                          Batal
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showAddBank && (
                <Button
                  variant="outline"
                  onClick={() => setShowAddBank(true)}
                  className="w-full rounded-xl h-10 text-xs border-dashed border-2"
                >
                  <Plus className="w-4 h-4 mr-2" /> Tambah Rekening Bank
                </Button>
              )}

              {/* Next Button */}
              <Button
                disabled={!selectedBankId}
                onClick={() => setStep(2)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11 disabled:opacity-40"
              >
                Lanjutkan <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* ===== STEP 2: Enter Amount ===== */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {/* Selected Bank Summary */}
              {selectedBank && (
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${getBankInfo(selectedBank.bankCode || selectedBank.bankName?.toLowerCase() || 'bca').color} text-white font-bold text-[10px] flex items-center justify-center`}>
                      {getBankInfo(selectedBank.bankCode || selectedBank.bankName?.toLowerCase() || 'bca').icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{selectedBank.bankName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedBank.accountNumber} · a/n {selectedBank.accountHolder}</p>
                    </div>
                    <button onClick={() => setStep(1)} className="text-[10px] font-medium text-emerald-600">Ubah</button>
                  </div>
                </Card>
              )}

              {/* Amount Input */}
              <div>
                <SectionHeader title="Jumlah Penarikan" icon={<CircleDollarSign className="w-4 h-4" />} />
                <div className="mt-3 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">Rp</span>
                  <Input
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setAmount(val)
                    }}
                    placeholder="0"
                    className="pl-11 h-14 rounded-2xl text-2xl font-bold"
                    inputMode="numeric"
                  />
                </div>
                <div className="flex items-center justify-between mt-2 px-1">
                  <button
                    onClick={() => setAmount(String(availableBalance))}
                    className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Tarik Semua
                  </button>
                  <p className="text-[10px] text-muted-foreground">
                    Min. {formatPrice(minWithdraw)}
                  </p>
                </div>
              </div>

              {/* Quick Amounts */}
              <div>
                <SectionHeader title="Nominal Cepat" />
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {quickAmounts.map((qa) => (
                    <motion.button
                      key={qa}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAmount(String(qa))}
                      className={`py-2.5 rounded-xl text-xs font-medium transition-colors border ${
                        parseInt(amount) === qa
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {qa >= 1000000 ? `${(qa / 1000000).toFixed(qa % 1000000 === 0 ? 0 : 1)}jt` : `${(qa / 1000)}rb`}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Fee Preview */}
              {parseInt(amount) > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Jumlah penarikan</span>
                      <span className="text-sm font-medium text-foreground">{formatPrice(parseInt(amount) || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Biaya admin (1%, max 10rb)</span>
                      <span className="text-sm font-medium text-red-500">-{formatPrice(adminFee)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Dana diterima</span>
                      <span className="text-sm font-bold text-emerald-600">{formatPrice(netAmount)}</span>
                    </div>
                    <div className="flex items-start gap-2 mt-1">
                      <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground">
                        Dana akan diterima dalam 1-3 hari kerja setelah disetujui admin
                      </p>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Fund Source Breakdown */}
              {deliveredOrders.length > 0 && (
                <motion.div {...fadeIn}>
                  <SectionHeader title="Sumber Dana" icon={<CircleDollarSign className="w-4 h-4" />} />
                  <Card className="mt-3">
                    <div className="divide-y divide-border/30">
                      {deliveredOrders.slice(0, 5).map((order) => (
                        <div key={order.id} className="px-4 py-2.5 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-muted-foreground">{order.orderNumber}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{order.items.map(i => i.productName).join(', ')}</p>
                          </div>
                          <p className="text-xs font-medium text-emerald-600 flex-shrink-0 ml-2">+{formatPrice(getSellerIncome(order))}</p>
                        </div>
                      ))}
                      {deliveredOrders.length > 5 && (
                        <div className="px-4 py-2 text-center">
                          <p className="text-[10px] text-muted-foreground">+{deliveredOrders.length - 5} pesanan lainnya</p>
                        </div>
                      )}
                      <div className="px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-900/10">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-foreground">Total dari Pesanan</span>
                          <span className="text-xs font-bold text-emerald-600">{formatPrice(totalDeliveredIncome)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Next Button */}
              <Button
                disabled={!amount || parseInt(amount) < minWithdraw || parseInt(amount) > availableBalance}
                onClick={handleStep2Next}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11 disabled:opacity-40"
              >
                Lanjutkan <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* ===== STEP 3: Confirm ===== */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <motion.div {...fadeIn}>
                <Card className="p-5 space-y-4">
                  {/* Confirmation Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Konfirmasi Penarikan</p>
                      <p className="text-xs text-muted-foreground">Pastikan data penarikan sudah benar</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Bank Info */}
                  {selectedBank && (
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${getBankInfo(selectedBank.bankCode || selectedBank.bankName?.toLowerCase() || 'bca').color} text-white font-bold text-[10px] flex items-center justify-center`}>
                        {getBankInfo(selectedBank.bankCode || selectedBank.bankName?.toLowerCase() || 'bca').icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{selectedBank.bankName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{selectedBank.accountNumber}</p>
                        <p className="text-xs text-muted-foreground">a/n {selectedBank.accountHolder}</p>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Amount Details */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Jumlah Penarikan</span>
                      <span className="text-sm font-medium text-foreground">{formatPrice(parseInt(amount))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Biaya Admin</span>
                      <span className="text-sm font-medium text-red-500">-{formatPrice(adminFee)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Dana Diterima</span>
                      <span className="text-lg font-bold text-emerald-600">{formatPrice(netAmount)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Processing Info */}
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Estimasi Waktu Proses</p>
                      <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">1-3 hari kerja setelah disetujui admin</p>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Warning */}
              <motion.div {...fadeIn}>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/50">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    Pastikan nomor rekening sudah benar. Dana yang sudah ditransfer tidak dapat dikembalikan jika rekening tujuan salah.
                  </p>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-xl h-11 text-xs"
                >
                  Kembali
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11"
                >
                  <Check className="w-4 h-4 mr-2" /> Tarik Dana
                </Button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 4: Success ===== */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              {/* Success Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="flex flex-col items-center text-center pt-4"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Penarikan Diajukan!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Permintaan penarikan dana Anda sedang diproses
                </p>
              </motion.div>

              {/* Reference Number */}
              <motion.div {...fadeIn} className="delay-200">
                <Card className="p-4">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground font-medium">Nomor Referensi</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <p className="text-base font-mono font-bold text-foreground">{refNumber}</p>
                      <button onClick={handleCopyRef} className="p-1 rounded-lg hover:bg-muted transition-colors">
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Summary */}
              <motion.div {...fadeIn} className="delay-300">
                <Card className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Jumlah</span>
                    <span className="text-sm font-medium text-foreground">{formatPrice(parseInt(amount))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Biaya Admin</span>
                    <span className="text-sm font-medium text-red-500">-{formatPrice(adminFee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Dana Diterima</span>
                    <span className="text-sm font-bold text-emerald-600">{formatPrice(netAmount)}</span>
                  </div>
                  <Separator />
                  {selectedBank && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Rekening</span>
                      <span className="text-xs font-medium text-foreground">{selectedBank.bankName} ****{selectedBank.accountNumber.slice(-4)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <WithdrawStatusBadge status="pending" />
                  </div>
                </Card>
              </motion.div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => navigate("seller-withdraw-history")}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11"
                >
                  <FileText className="w-4 h-4 mr-2" /> Lihat Riwayat Penarikan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("seller-wallet")}
                  className="w-full rounded-xl h-11"
                >
                  Kembali ke Dompet
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ==================== SELLER WITHDRAW HISTORY SCREEN ====================
export function SellerWithdrawHistoryScreen() {
  const { goBack, withdrawRequests, showToast, sellerBankAccounts, removeBankAccount, setDefaultBankAccount } = useAppStore()
  const [activeTab, setActiveTab] = useState<"all" | WithdrawStatus>("all")
  const [showBankManager, setShowBankManager] = useState(false)

  const tabs = [
    { key: "all" as const, label: "Semua" },
    { key: "pending" as const, label: "Menunggu" },
    { key: "processing" as const, label: "Diproses" },
    { key: "completed" as const, label: "Berhasil" },
    { key: "rejected" as const, label: "Ditolak" },
  ]

  const filtered = activeTab === "all"
    ? withdrawRequests
    : withdrawRequests.filter(r => r.status === activeTab)

  const pendingCount = withdrawRequests.filter(r => r.status === "pending").length
  const totalWithdrawn = withdrawRequests
    .filter(r => r.status === "completed")
    .reduce((sum, r) => sum + r.netAmount, 0)

  return (
    <div className="pb-24">
      <PageHeader title="Riwayat Penarikan" />

      <div className="px-4 space-y-4">
        {/* Summary Cards */}
        <motion.div {...fadeIn} className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground">Menunggu Proses</p>
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Ditarik</p>
            <p className="text-lg font-bold text-emerald-600">{formatPrice(totalWithdrawn)}</p>
          </Card>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1 text-[10px]">
                  ({withdrawRequests.filter(r => r.status === tab.key).length})
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Withdrawal List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-10 h-10 text-muted-foreground" />}
              title="Belum Ada Penarikan"
              subtitle="Riwayat penarikan dana akan muncul di sini"
            />
          ) : (
            filtered.map((request, i) => (
              <motion.div key={request.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-xl ${getBankInfo(request.bankAccount.bankCode || request.bankAccount.bankName?.toLowerCase() || 'bca').color} text-white font-bold text-[9px] flex items-center justify-center flex-shrink-0`}>
                        {getBankInfo(request.bankAccount.bankCode || request.bankAccount.bankName?.toLowerCase() || 'bca').icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {request.bankAccount.bankName} ****{request.bankAccount.accountNumber.slice(-4)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {request.id.slice(0, 12)}
                        </p>
                      </div>
                    </div>
                    <WithdrawStatusBadge status={request.status} />
                  </div>

                  <Separator className="my-3" />

                  {/* Details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Jumlah</span>
                      <span className="text-sm font-medium text-foreground">{formatPrice(request.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Biaya Admin</span>
                      <span className="text-xs text-red-500">-{formatPrice(request.adminFee)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Dana Diterima</span>
                      <span className="text-sm font-bold text-emerald-600">{formatPrice(request.netAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Tanggal</span>
                      <span className="text-xs text-foreground">
                        {new Date(request.requestDate).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {request.status === 'completed' && request.completedDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Selesai</span>
                        <span className="text-xs text-foreground">
                          {new Date(request.completedDate).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    {request.status === 'rejected' && request.rejectionReason && (
                      <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">Alasan Penolakan:</p>
                        <p className="text-[10px] text-red-500 dark:text-red-400">{request.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Bank Account Manager */}
        <motion.div {...fadeIn}>
          <SectionHeader
            title="Kelola Rekening"
            icon={<Building2 className="w-4 h-4" />}
            actionLabel={showBankManager ? "Tutup" : "Kelola"}
            onAction={() => setShowBankManager(!showBankManager)}
          />
          <AnimatePresence>
            {showBankManager && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 mt-3">
                  {sellerBankAccounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Belum ada rekening terdaftar</p>
                  ) : (
                    sellerBankAccounts.map((account) => {
                      const bankInfo = getBankInfo(account.bankCode || account.bankName?.toLowerCase() || 'bca')
                      return (
                        <Card key={account.id} className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg ${bankInfo.color} text-white font-bold text-[9px] flex items-center justify-center flex-shrink-0`}>
                              {bankInfo.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{account.bankName}</p>
                                {account.isDefault && (
                                  <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-600 h-4">Utama</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">{account.accountNumber}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {!account.isDefault && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[10px] text-emerald-600"
                                  onClick={() => {
                                    setDefaultBankAccount(account.id)
                                    showToast("Rekening utama diperbarui", "success")
                                  }}
                                >
                                  Set Utama
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] text-red-500"
                                onClick={() => {
                                  removeBankAccount(account.id)
                                  showToast("Rekening dihapus", "info")
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      )
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
