"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader, WalletBalanceCard } from "../shared"
import { useState } from "react"
import { CreditCard, Wallet, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function DepositScreen() {
  const { currentUser, walletBalance, topUpWallet, showToast, goBack } = useAppStore()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("gopay")

  const quickAmounts = [
    { label: "50K", value: 50000 },
    { label: "100K", value: 100000 },
    { label: "200K", value: 200000 },
    { label: "500K", value: 500000 },
    { label: "1M", value: 1000000 },
  ]

  const paymentMethods = [
    { key: "gopay", label: "GoPay", color: "bg-green-500" },
    { key: "ovo", label: "OVO", color: "bg-purple-500" },
    { key: "dana", label: "DANA", color: "bg-blue-500" },
    { key: "bank", label: "Bank Transfer", color: "bg-cyan-600" },
  ]

  const handleTopUp = async () => {
    const amount = selectedAmount || Number(customAmount)
    if (!amount || amount <= 0) {
      showToast("Pilih nominal top up terlebih dahulu", "error")
      return
    }
    try {
      // topUpWallet now calls the API internally — creates PENDING deposit
      // Map UI method key to API method name
      const methodMap: Record<string, string> = { gopay: 'gopay', ovo: 'ovo', dana: 'dana', bank: 'bank_transfer' }
      await topUpWallet(amount, methodMap[paymentMethod] || 'bank_transfer')
      showToast(`Top up ${formatPrice(amount)} berhasil diajukan! Menunggu pembayaran.`, "success")
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
            coins={currentUser?.coins || 500}
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
                  <div className={`w-9 h-9 rounded-xl ${method.color} flex items-center justify-center text-white text-xs font-bold`}>
                    {method.label.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-foreground">{method.label}</span>
                  {paymentMethod === method.key && (
                    <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Deposit Button */}
        <motion.div {...fadeIn}>
          <Button
            disabled={!selectedAmount && !customAmount}
            onClick={handleTopUp}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-11 disabled:opacity-40"
          >
            <Wallet className="w-4 h-4 mr-2" /> Top Up Sekarang
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
