"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  DollarSign, Check, X, AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import type { WithdrawStatus } from "@/lib/types"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, SectionHeader, EmptyState } from "../shared"
import { useState, useEffect } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { LoadingSpinner } from "../loading-spinner"

// ==================== ANIMATION VARIANTS ====================
const stagger = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
}

export function AdminWithdraw() {
  const { showToast, withdrawRequests, updateWithdrawStatus, fetchAdminWithdrawals } = useAppStore()
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "completed" | "rejected" | "all">("pending")
  const [isLoading, setIsLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  useEffect(() => {
    fetchAdminWithdrawals().finally(() => setIsLoading(false))
  }, [fetchAdminWithdrawals])
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const pendingWithdrawals = withdrawRequests.filter(w => w.status === 'pending')
  const historyWithdrawals = withdrawRequests.filter(w => w.status !== 'pending')

  const displayed = activeTab === 'pending' ? pendingWithdrawals
    : activeTab === 'all' ? withdrawRequests
    : withdrawRequests.filter(w => w.status === activeTab)

  const handleApprove = (id: string) => {
    updateWithdrawStatus(id, 'approved')
    showToast("Penarikan disetujui", "success")
  }

  const handleReject = () => {
    if (!showRejectModal) return
    setConfirmAction({
      action: () => { updateWithdrawStatus(showRejectModal, 'rejected', rejectReason || 'Tidak memenuhi syarat'); showToast("Penarikan ditolak", "info"); setShowRejectModal(null); setRejectReason('') },
      title: 'Tolak Penarikan',
      message: 'Apakah Anda yakin ingin menolak permintaan penarikan ini? Dana tidak akan ditransfer ke penjual.'
    })
  }

  const handleMarkCompleted = (id: string) => {
    updateWithdrawStatus(id, 'completed')
    showToast("Penarikan selesai - dana telah ditransfer", "success")
  }

  const statusColorMap: Record<WithdrawStatus, string> = {
    pending: "border-amber-300 text-amber-600",
    approved: "border-blue-300 text-blue-600",
    processing: "border-purple-300 text-purple-600",
    processed: "border-purple-300 text-purple-600",
    completed: "border-emerald-300 text-emerald-600",
    rejected: "border-red-300 text-red-600",
  }

  const statusLabelMap: Record<WithdrawStatus, string> = {
    pending: "Pending",
    approved: "Disetujui",
    processing: "Diproses",
    processed: "Diproses",
    completed: "Selesai",
    rejected: "Ditolak",
  }

  if (isLoading) return <div className="pb-20"><PageHeader title="Penarikan Dana" /><LoadingSpinner message="Memuat penarikan..." /></div>

  return (
    <div className="pb-20">
      <PageHeader title="Penarikan Dana" rightAction={
        <span className="text-xs text-muted-foreground">{pendingWithdrawals.length} pending</span>
      } />

      <div className="px-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{pendingWithdrawals.length}</p>
            <p className="text-[10px] text-amber-600 font-medium">Pending</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{withdrawRequests.filter(w => w.status === 'completed').length}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Selesai</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-600">{withdrawRequests.filter(w => w.status === 'rejected').length}</p>
            <p className="text-[10px] text-red-600 font-medium">Ditolak</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "pending" as const, label: "Pending" },
            { key: "approved" as const, label: "Approved" },
            { key: "completed" as const, label: "Selesai" },
            { key: "rejected" as const, label: "Ditolak" },
            { key: "all" as const, label: "Semua" },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors border whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-card text-foreground border-border"
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Total amount for pending */}
        {activeTab === 'pending' && pendingWithdrawals.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">Total Permintaan Pending</p>
                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                  {formatPrice(pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0))}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        )}

        {/* Withdrawal List */}
        <div className="space-y-3">
          {displayed.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Permintaan"
              subtitle="Semua permintaan penarikan sudah diproses"
            />
          ) : (
            displayed.map((withdrawal, i) => (
              <motion.div key={withdrawal.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{withdrawal.sellerName}</p>
                        <Badge variant="outline" className={`text-[10px] ${statusColorMap[withdrawal.status]}`}>
                          {statusLabelMap[withdrawal.status]}
                        </Badge>
                      </div>
                      <p className="text-base font-bold text-foreground mt-0.5">{formatPrice(withdrawal.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">Net: {formatPrice(withdrawal.netAmount)} · Fee: {formatPrice(withdrawal.adminFee)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(withdrawal.requestDate)}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Bank</span>
                      <span className="text-xs font-medium text-foreground">{withdrawal.bankAccount.bankName} - ****{withdrawal.bankAccount.accountNumber.slice(-4)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pemilik</span>
                      <span className="text-xs text-foreground">{withdrawal.bankAccount.accountHolder}</span>
                    </div>
                    {withdrawal.rejectionReason && (
                      <div className="flex items-start gap-1.5 mt-1 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-[10px] text-red-600 dark:text-red-400">{withdrawal.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                  {withdrawal.status === 'pending' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button size="sm" className="flex-1 h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleApprove(withdrawal.id)}>
                        <Check className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setShowRejectModal(withdrawal.id)}>
                        <X className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                  {withdrawal.status === 'approved' && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <Button size="sm" className="w-full h-8 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white" onClick={() => handleMarkCompleted(withdrawal.id)}>
                        <Check className="w-3 h-3 mr-1" /> Tandai Selesai Transfer
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Reject modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
            onClick={() => setShowRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-base font-bold">Tolak Penarikan?</h3>
                <p className="text-sm text-muted-foreground">Dana akan dikembalikan ke saldo seller</p>
              </div>
              <Input
                placeholder="Alasan penolakan (opsional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="rounded-xl"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl"
                  onClick={() => { setShowRejectModal(null); setRejectReason('') }}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleReject}
                >
                  Tolak
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />
    </div>
  )
}
