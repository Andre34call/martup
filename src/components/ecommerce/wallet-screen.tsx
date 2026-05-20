"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/mock-data"
import { PageHeader, SectionHeader, EmptyState } from "./shared"
import type { WalletMutation } from "@/lib/types"
import { useState, useMemo } from "react"
import {
  ArrowUpCircle, ArrowDownCircle, Plus, Wallet as WalletIcon,
  ArrowUpRight, ArrowDownRight, History, Send, Banknote,
  TrendingUp, Gift, Clock, CreditCard, Shield, Eye, EyeOff
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const MOCK_BALANCE = 1190000
const MOCK_HOLD_BALANCE = 50000
const MOCK_COINS = 2500

// ==================== QUICK ACTION BUTTON ====================
function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-2"
    >
      <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-[11px] font-medium text-foreground">{label}</span>
    </motion.button>
  )
}

// ==================== MUTATION ITEM ====================
function MutationItem({ mutation }: { mutation: WalletMutation }) {
  const isCredit = mutation.type === "credit"

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-3"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isCredit
          ? "bg-emerald-50 dark:bg-emerald-950/30"
          : "bg-red-50 dark:bg-red-950/30"
      }`}>
        {isCredit ? (
          <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
        ) : (
          <ArrowDownCircle className="w-5 h-5 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{mutation.description}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(mutation.createdAt)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
          {isCredit ? "+" : "-"}{formatPrice(mutation.amount)}
        </p>
        <p className="text-[10px] text-muted-foreground">{formatPrice(mutation.balance)}</p>
      </div>
    </motion.div>
  )
}

// ==================== WALLET SCREEN ====================
export function WalletScreen() {
  const { walletMutations } = useAppStore()
  const [showBalance, setShowBalance] = useState(true)
  const [filterType, setFilterType] = useState<"all" | "credit" | "debit">("all")

  const filteredMutations = useMemo(() => {
    if (filterType === "all") return walletMutations
    return walletMutations.filter((m) => m.type === filterType)
  }, [walletMutations, filterType])

  const totalCredit = useMemo(
    () => walletMutations.filter((m) => m.type === "credit").reduce((sum, m) => sum + m.amount, 0),
    [walletMutations]
  )

  const totalDebit = useMemo(
    () => walletMutations.filter((m) => m.type === "debit").reduce((sum, m) => sum + m.amount, 0),
    [walletMutations]
  )

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="MartUp Pay"
        rightAction={
          <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <History className="w-5 h-5 text-muted-foreground" />
          </button>
        }
      />

      <div className="flex-1 pb-20">
        {/* Balance Card */}
        <div className="px-4 pt-2 pb-4">
          <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 rounded-2xl p-5 text-white relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium opacity-90">Saldo MartUp Pay</span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowBalance(!showBalance)}
                  className="opacity-80 hover:opacity-100 transition-opacity"
                >
                  {showBalance ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </motion.button>
              </div>

              <motion.p
                key={showBalance ? "show" : "hide"}
                initial={{ y: -5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl font-bold mb-2"
              >
                {showBalance ? formatPrice(MOCK_BALANCE) : "••••••••"}
              </motion.p>

              <div className="flex items-center gap-2 text-xs opacity-80">
                <Shield className="w-3.5 h-3.5" />
                <span>Hold: {showBalance ? formatPrice(MOCK_HOLD_BALANCE) : "•••••"}</span>
              </div>

              <div className="flex items-center gap-1.5 mt-1 text-xs opacity-80">
                <Gift className="w-3.5 h-3.5" />
                <span>{MOCK_COINS.toLocaleString()} Koin</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <div className="grid grid-cols-4 gap-2">
              <QuickAction
                icon={<Plus className="w-5 h-5 text-emerald-600" />}
                label="Top Up"
              />
              <QuickAction
                icon={<ArrowUpRight className="w-5 h-5 text-emerald-600" />}
                label="Withdraw"
              />
              <QuickAction
                icon={<Send className="w-5 h-5 text-emerald-600" />}
                label="Transfer"
              />
              <QuickAction
                icon={<Clock className="w-5 h-5 text-emerald-600" />}
                label="Riwayat"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Pemasukan</span>
              </div>
              <p className="text-base font-bold text-emerald-600">{formatPrice(totalCredit)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Pengeluaran</span>
              </div>
              <p className="text-base font-bold text-red-500">{formatPrice(totalDebit)}</p>
            </div>
          </div>
        </div>

        {/* Mutations List */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader
              title="Riwayat Transaksi"
              icon={<History className="w-4 h-4" />}
            />
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-3">
            {[
              { key: "all" as const, label: "Semua" },
              { key: "credit" as const, label: "Masuk" },
              { key: "debit" as const, label: "Keluar" },
            ].map((f) => (
              <motion.button
                key={f.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === f.key
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </motion.button>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border/50 px-4">
            <AnimatePresence mode="wait">
              {filteredMutations.length > 0 ? (
                <motion.div
                  key={filterType}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {filteredMutations.map((mutation, idx) => (
                    <div key={mutation.id}>
                      <MutationItem mutation={mutation} />
                      {idx < filteredMutations.length - 1 && (
                        <Separator className="opacity-50" />
                      )}
                    </div>
                  ))}
                </motion.div>
              ) : (
                <EmptyState
                  icon={<WalletIcon className="w-10 h-10 text-muted-foreground" />}
                  title="Belum Ada Transaksi"
                  subtitle="Riwayat transaksi akan muncul di sini"
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="px-4 pt-4 pb-4">
          <div className="flex gap-3">
            <Button className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              Top Up
            </Button>
            <Button variant="outline" className="flex-1 h-12 rounded-xl text-sm font-semibold">
              <Banknote className="w-4 h-4 mr-2" />
              Tarik Dana
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
