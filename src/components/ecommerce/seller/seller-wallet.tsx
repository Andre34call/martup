"use client"

import { motion } from "framer-motion"
import { TrendingUp, ChevronRight, Wallet, Banknote, Clock, ArrowUpRight, ArrowDownLeft, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, SectionHeader, EmptyState } from "../shared"
import { useState } from "react"

export function SellerWallet() {
  const { navigate, showToast, sellerBalance, sellerBankAccounts, withdrawRequests, seller, walletMutations } = useAppStore()

  // Derive sellerId from store seller
  const sellerId = seller?.id || ''

  // Current seller's withdraw requests
  const myWithdrawRequests = withdrawRequests.filter(w => w.sellerId === sellerId)
  const pendingWithdraws = myWithdrawRequests.filter(w => w.status === 'pending')
  const recentWithdraws = myWithdrawRequests.slice(0, 3)

  return (
    <div className="pb-20">
      <PageHeader title="Dompet Seller" />

      <div className="px-4 space-y-4">
        {/* Balance Card */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-sm text-emerald-100 font-medium">Saldo Tersedia</p>
              <p className="text-3xl font-bold mt-1">{formatPrice(sellerBalance.availableBalance)}</p>

              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-emerald-200">
                  <Clock className="w-3 h-3" />
                  <span>Pending: {formatPrice(sellerBalance.pendingBalance)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-200">
                  <Shield className="w-3 h-3" />
                  <span>Hold: {formatPrice(sellerBalance.holdBalance)}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <Button
                  onClick={() => navigate('seller-withdraw')}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl h-9 text-xs font-bold gap-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Tarik Dana
                </Button>
                <Button
                  onClick={() => navigate('seller-withdraw-history')}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 rounded-xl h-9 text-xs font-bold gap-1"
                >
                  <Clock className="w-3.5 h-3.5" /> Riwayat WD
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Balance Breakdown */}
        <motion.div {...fadeIn}>
          <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
            <h3 className="text-sm font-bold">Rincian Saldo</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tersedia untuk WD</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-600">{formatPrice(sellerBalance.availableBalance)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pesanan Belum Selesai</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-amber-600">{formatPrice(sellerBalance.pendingBalance)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ditahan (Dispute/Proses WD)</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-red-500">{formatPrice(sellerBalance.holdBalance)}</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground">Total Saldo</p>
                <p className="text-sm font-bold text-foreground">{formatPrice(sellerBalance.totalBalance)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div {...fadeIn} className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total Penjualan</span>
            </div>
            <p className="text-base font-bold text-foreground">{formatPrice(sellerBalance.totalBalance)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total WD</span>
            </div>
            <p className="text-base font-bold text-foreground">{formatPrice(sellerBalance.totalWithdrawn)}</p>
          </Card>
        </motion.div>

        {/* Pending Withdrawals Alert */}
        {pendingWithdraws.length > 0 && (
          <motion.div {...fadeIn}>
            <button
              onClick={() => navigate('seller-withdraw-history')}
              className="w-full bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{pendingWithdraws.length} Penarikan Pending</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Menunggu review admin</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500" />
            </button>
          </motion.div>
        )}

        {/* Commission Rate */}
        <motion.div {...fadeIn}>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Komisi Platform</p>
                  <p className="text-xs text-muted-foreground">Dipotong dari penjualan</p>
                </div>
              </div>
              <p className="text-lg font-bold text-foreground">5%</p>
            </div>
          </Card>
        </motion.div>

        {/* Bank Account Info */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Rekening Bank" actionLabel="Kelola" onAction={() => navigate('seller-settings')} />
          <div className="space-y-2 mt-3">
            {sellerBankAccounts.map((account) => {
              const bankLogos: Record<string, string> = { BCA: "🏦", Mandiri: "🏛️", BNI: "🏛️", BRI: "🏛️" }
              return (
                <Card key={account.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-lg">{bankLogos[account.bankName] || '🏦'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{account.bankName}</p>
                        {account.isDefault && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] px-1.5 py-0.5">
                            Utama
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{account.accountNumber} · {account.accountHolder}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </motion.div>

        {/* Recent Withdraw History */}
        {recentWithdraws.length > 0 && (
          <motion.div {...fadeIn}>
            <SectionHeader
              title="Penarikan Terakhir"
              actionLabel="Lihat Semua"
              onAction={() => navigate('seller-withdraw-history')}
            />
            <div className="space-y-2 mt-3">
              {recentWithdraws.map((wd) => {
                const statusColor = wd.status === 'completed' ? 'text-emerald-600' : wd.status === 'rejected' ? 'text-red-500' : 'text-amber-600'
                const statusLabel = wd.status === 'completed' ? 'Selesai' : wd.status === 'rejected' ? 'Ditolak' : wd.status === 'approved' ? 'Disetujui' : 'Pending'
                return (
                  <Card key={wd.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          wd.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/30' :
                          wd.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/30' :
                          'bg-amber-50 dark:bg-amber-900/30'
                        }`}>
                          <ArrowUpRight className={`w-4 h-4 ${statusColor}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">WD ke {wd.bankAccount.bankName}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(wd.requestDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{formatPrice(wd.amount)}</p>
                        <p className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Transaction History */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Riwayat Transaksi" />
          <div className="space-y-2 mt-3">
            {walletMutations.length === 0 ? (
              <EmptyState
                icon={<Wallet className="w-10 h-10 text-muted-foreground" />}
                title="Belum Ada Transaksi"
                subtitle="Riwayat transaksi akan muncul di sini"
              />
            ) : (
              walletMutations.map((tx, i) => (
                <motion.div key={tx.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          tx.type === "credit"
                            ? "bg-emerald-50 dark:bg-emerald-900/30"
                            : "bg-red-50 dark:bg-red-900/30"
                        }`}>
                          {tx.type === "credit"
                            ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                            : <ArrowUpRight className="w-4 h-4 text-red-600" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(tx.createdAt)}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${tx.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                        {tx.type === "credit" ? "+" : "-"}{formatPrice(tx.amount)}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
