"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader, WalletBalanceCard } from "../shared"
import { useState } from "react"
import { CreditCard, Wallet, Check, Zap, Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { apiClient } from '@/lib/api-client'
import { PaymentChannelPicker } from "../payment-channel-picker"

type DepositCreateResponse = {
  success: boolean
  data?: { depositId: string; paymentUrl: string; reference?: string }
  error?: string
}

export function DepositScreen() {
  const { currentUser, walletBalance, topUpWallet, showToast, goBack } = useAppStore()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("duitku")
  // In-app payment channel selection for the Duitku flow ('' = pick on gateway page)
  const [selectedChannel, setSelectedChannel] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const topUpAmount = selectedAmount || (customAmount ? Number(customAmount) : 0)

  const quickAmounts = [
    { label: "50K", value: 50000 },
    { label: "100K", value: 100000 },
    { label: "200K", value: 200000 },
    { label: "500K", value: 500000 },
    { label: "1M", value: 1000000 },
  ]

  const paymentMethods = [
    { key: "duitku", label: "VA, QRIS, E-Wallet, Kartu", desc: "Konfirmasi otomatis & instan", color: "bg-emerald-600", instant: true },
    { key: "bank", label: "Transfer Bank Manual", desc: "Diverifikasi admin (1x24 jam)", color: "bg-cyan-600", instant: false },
  ]

  const handleTopUp = async () => {
    const amount = selectedAmount || Number(customAmount)
    if (!amount || amount <= 0) {
      showToast("Pilih nominal top up terlebih dahulu", "error")
      return
    }
    if (amount < 10000) {
      showToast("Top up minimal Rp 10.000", "error")
      return
    }

    if (paymentMethod === "duitku") {
      // Instant top-up via Duitku payment gateway
      setIsProcessing(true)
      try {
        const res = await apiClient.rawPost('/api/deposit/duitku/create', {
          amount,
          paymentMethod: selectedChannel || undefined,
        })
        const data: DepositCreateResponse = await res.json()

        if (data.success && data.data?.paymentUrl) {
          showToast("Invoice dibuat. Anda akan diarahkan ke halaman pembayaran...", "success")
          // Redirect to the Duitku payment page — user picks VA / QRIS / e-wallet there
          setTimeout(() => {
            window.location.href = data.data!.paymentUrl
          }, 600)
          return
        }
        showToast(data.error || "Gagal membuat invoice top up. Coba lagi.", "error")
      } catch {
        showToast("Terjadi kesalahan. Silakan coba lagi.", "error")
      } finally {
        setIsProcessing(false)
      }
      return
    }

    // Manual bank transfer — pending deposit verified by admin
    try {
      await topUpWallet(amount, 'bank_transfer')
      showToast(`Top up ${formatPrice(amount)} berhasil diajukan! Silakan lakukan transfer.`, "success")
      goBack()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Top up gagal'
      showToast(message, "error")
    }
  }

  return (
    <div className="pb-24">
      <PageHeader title="Top Up Saldo" />

      <div className="px-4 space-y-4">
        {/* Balance Card */}
        <motion.div {...fadeIn}>
          <WalletBalanceCard
            balance={walletBalance}
            coins={currentUser?.coins || 0}
            onTopUp={() => {}}
            onWithdraw={() => {}}
          />
        </motion.div>

        {/* Quick Amount */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pilih Nominal" />
          <div className="flex flex-wrap gap-2 mt-3">
            {quickAmounts.map((item) => (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setSelectedAmount(item.value); setCustomAmount("") }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                  selectedAmount === item.value
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {item.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Custom Amount */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Nominal Lain" />
          <div className="mt-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <Input
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null) }}
              placeholder="Masukkan nominal"
              className="pl-9 h-10 rounded-xl"
              type="number"
            />
          </div>
        </motion.div>

        {/* Payment Method */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Metode Pembayaran" icon={<CreditCard className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            {paymentMethods.map((method) => (
              <Card
                key={method.key}
                className={`p-3 cursor-pointer transition-colors ${paymentMethod === method.key ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10" : ""}`}
                onClick={() => setPaymentMethod(method.key)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${method.color} flex items-center justify-center text-white`}>
                    {method.instant ? <Zap className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground block truncate">{method.label}</span>
                    <span className="text-[11px] text-muted-foreground">{method.desc}</span>
                  </div>
                  {paymentMethod === method.key && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* In-app channel picker — instant (Duitku) method only */}
          {paymentMethod === "duitku" && (
            <PaymentChannelPicker
              amount={topUpAmount}
              value={selectedChannel}
              onChange={setSelectedChannel}
            />
          )}
        </motion.div>

        {/* Deposit Button */}
        <motion.div {...fadeIn}>
          <Button
            disabled={(!selectedAmount && !customAmount) || isProcessing}
            onClick={handleTopUp}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-11 disabled:opacity-40"
          >
            {isProcessing ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            ) : (
              <Wallet className="w-4 h-4 mr-2" />
            )}
            {isProcessing ? "Memproses..." : "Top Up Sekarang"}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
