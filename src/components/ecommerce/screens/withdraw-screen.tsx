"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, SectionHeader } from "../shared"
import { useState } from "react"
import { ArrowUpRight, Banknote, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function WithdrawScreen() {
  const { currentUser, walletBalance, walletHoldBalance, withdrawWallet, sellerBankAccounts, withdrawRequests, showToast, goBack } = useAppStore()
  const [amount, setAmount] = useState("")

  const defaultBankAccount = sellerBankAccounts.find(a => a.isDefault) || sellerBankAccounts[0]
  const bankAccountLabel = defaultBankAccount
    ? `${defaultBankAccount.bankName} ****${defaultBankAccount.accountNumber.slice(-4)} - ${defaultBankAccount.accountHolder}`
    : "Belum ada rekening bank"

  const statusLabels: Record<string, string> = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak", processing: "Diproses", completed: "Berhasil" }
  const withdrawHistory = withdrawRequests.map(w => ({
    id: w.id,
    amount: w.amount,
    bank: `${w.bankAccount.bankName} ****${w.bankAccount.accountNumber.slice(-4)}`,
    status: statusLabels[w.status] || w.status,
    date: new Date(w.requestDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
  }))

  const handleWithdraw = async () => {
    const withdrawAmount = Number(amount)
    if (!withdrawAmount || withdrawAmount <= 0) {
      showToast("Masukkan jumlah penarikan yang valid", "error")
      return
    }
    if (!defaultBankAccount) {
      showToast("Tambahkan rekening bank terlebih dahulu", "error")
      return
    }
    if (withdrawAmount > walletBalance) {
      showToast("Jumlah penarikan melebihi saldo tersedia", "error")
      return
    }
    try {
      // withdrawWallet now calls the API internally
      await withdrawWallet(withdrawAmount, bankAccountLabel, {
        bankAccount: defaultBankAccount.accountNumber,
        bankName: defaultBankAccount.bankName,
        bankHolder: defaultBankAccount.accountHolder,
      })
      showToast(`Penarikan ${formatPrice(withdrawAmount)} berhasil diajukan!`, "success")
      goBack()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Penarikan gagal'
      showToast(message, "error")
    }
  }

  return (
    <div className="pb-24">
      <PageHeader title="Tarik Dana" />

      <div className="px-4 space-y-4">
        {/* Balance Card */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="text-sm text-emerald-100 font-medium">Saldo Tersedia</p>
            <p className="text-3xl font-bold mt-1">{formatPrice(walletBalance)}</p>
            <p className="text-xs text-emerald-200 mt-1">Saldo tertahan: {formatPrice(walletHoldBalance)}</p>
          </div>
        </motion.div>

        {/* Amount Input */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Jumlah Penarikan" />
          <div className="mt-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Masukkan jumlah"
              className="pl-9 h-11 rounded-xl text-lg font-bold"
              type="number"
            />
          </div>
        </motion.div>

        {/* Bank Account */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Rekening Tujuan" icon={<Banknote className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            {defaultBankAccount ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{defaultBankAccount.bankName}</p>
                  <p className="text-xs text-muted-foreground">****{defaultBankAccount.accountNumber.slice(-4)} - {defaultBankAccount.accountHolder}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Belum ada rekening bank</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Withdraw Button */}
        <motion.div {...fadeIn}>
          <Button
            disabled={!amount || Number(amount) <= 0}
            onClick={handleWithdraw}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11 disabled:opacity-40"
          >
            <ArrowUpRight className="w-4 h-4 mr-2" /> Tarik Dana
          </Button>
        </motion.div>

        {/* Withdrawal History */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Riwayat Penarikan" />
          <div className="space-y-2 mt-3">
            {withdrawHistory.map((item, i) => (
              <motion.div key={item.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatPrice(item.amount)}</p>
                        <p className="text-xs text-muted-foreground">{item.bank}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{item.status}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">{item.date}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
