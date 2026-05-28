"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Wallet, Check, X, AlertTriangle, ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, EmptyState } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { LoadingSpinner } from "../loading-spinner"
import { getAuthHeaders } from '@/lib/store/getAuthHeaders'

// ==================== ANIMATION VARIANTS ====================
const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 }
}

const stagger = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
}

// ==================== TYPE DEFINITIONS ====================
interface DepositItem {
  id: string
  userId: string
  userName: string
  userEmail: string
  userPhone: string | null
  userAvatar: string | null
  amount: number
  method: string
  status: "pending" | "success" | "failed"
  proofUrl: string | null
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

// ==================== ADMIN DEPOSITS ====================
export function AdminDeposits() {
  const { showToast } = useAppStore()
  const [deposits, setDeposits] = useState<DepositItem[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  const fetchDeposits = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/deposits", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setDeposits(data.data)
      }
    } catch {
      showToast("Gagal memuat deposit", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchDeposits()
  }, [fetchDeposits])

  const filtered = deposits.filter(d => {
    return statusFilter === "all" || d.status === statusFilter
  })

  const pendingCount = deposits.filter(d => d.status === "pending").length
  const successCount = deposits.filter(d => d.status === "success").length
  const failedCount = deposits.filter(d => d.status === "failed").length

  const handleApprove = async (depositId: string) => {
    try {
      const res = await fetch("/api/admin/deposits", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ depositId, status: "success" }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Deposit disetujui - saldo ditambahkan", "success")
        fetchDeposits()
      } else {
        showToast(data.error || "Gagal menyetujui deposit", "error")
      }
    } catch {
      showToast("Gagal menyetujui deposit", "error")
    }
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    setConfirmAction({
      action: async () => {
        try {
          const res = await fetch("/api/admin/deposits", {
            method: "PUT",
            headers: getAuthHeaders(true),
            body: JSON.stringify({ depositId: showRejectModal, status: "failed", adminNote: rejectNote || "Ditolak oleh admin" }),
          })
          const data = await res.json()
          if (data.success) {
            showToast("Deposit ditolak", "info")
            setShowRejectModal(null)
            setRejectNote("")
            fetchDeposits()
          } else {
            showToast(data.error || "Gagal menolak deposit", "error")
          }
        } catch {
          showToast("Gagal menolak deposit", "error")
        }
      },
      title: 'Tolak Deposit',
      message: 'Apakah Anda yakin ingin menolak deposit ini? Dana tidak akan ditambahkan ke saldo user.'
    })
  }

  const methodLabel: Record<string, string> = {
    bank_transfer: "Transfer Bank",
    gopay: "GoPay",
    ovo: "OVO",
    dana: "DANA",
  }

  const methodEmoji: Record<string, string> = {
    bank_transfer: "🏦",
    gopay: "💳",
    ovo: "💜",
    dana: "🔵",
  }

  const statusLabelMap: Record<string, string> = {
    pending: "Pending",
    success: "Berhasil",
    failed: "Gagal",
  }

  const statusColorMap: Record<string, string> = {
    pending: "border-amber-300 text-amber-600",
    success: "border-emerald-300 text-emerald-600",
    failed: "border-red-300 text-red-600",
  }

  return (
    <div className="pb-20">
      <PageHeader title="Verifikasi Deposit" rightAction={
        <span className="text-xs text-muted-foreground">{pendingCount} pending</span>
      } />

      <div className="px-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <motion.div {...fadeIn} className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
            <p className="text-[10px] text-amber-600 font-medium">Pending</p>
          </motion.div>
          <motion.div {...fadeIn} className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{successCount}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Berhasil</p>
          </motion.div>
          <motion.div {...fadeIn} className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-600">{failedCount}</p>
            <p className="text-[10px] text-red-600 font-medium">Gagal</p>
          </motion.div>
        </div>

        {/* Total Pending Amount */}
        {pendingCount > 0 && (
          <motion.div {...fadeIn}>
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Total Deposit Pending</p>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                    {formatPrice(deposits.filter(d => d.status === "pending").reduce((sum, d) => sum + d.amount, 0))}
                  </p>
                </div>
                <Wallet className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "pending", label: "Pending" },
            { key: "success", label: "Berhasil" },
            { key: "failed", label: "Gagal" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === filter.key
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Deposit List */}
        <div className="space-y-3">
          {loading ? (
            <LoadingSpinner message="Memuat deposit..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Deposit"
              subtitle="Semua deposit sudah diproses"
            />
          ) : (
            filtered.map((deposit, i) => (
              <motion.div key={deposit.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{deposit.userName}</p>
                        <Badge variant="outline" className={`text-[10px] ${statusColorMap[deposit.status]}`}>
                          {statusLabelMap[deposit.status]}
                        </Badge>
                      </div>
                      <p className="text-base font-bold text-foreground mt-0.5">{formatPrice(deposit.amount)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(deposit.createdAt)}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Metode</span>
                      <span className="text-xs font-medium text-foreground">
                        {methodEmoji[deposit.method] || "💰"} {methodLabel[deposit.method] || deposit.method}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Email</span>
                      <span className="text-xs text-foreground">{deposit.userEmail}</span>
                    </div>
                    {deposit.proofUrl && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Bukti Transfer</span>
                        <a
                          href={deposit.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-cyan-600 hover:text-cyan-700 flex items-center gap-0.5"
                        >
                          Lihat <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {deposit.adminNote && (
                      <div className="flex items-start gap-1.5 mt-1 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                        <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">{deposit.adminNote}</span>
                      </div>
                    )}
                  </div>
                  {deposit.status === "pending" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleApprove(deposit.id)}
                      >
                        <Check className="w-3 h-3 mr-1" /> Setujui
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setShowRejectModal(deposit.id)}
                      >
                        <X className="w-3 h-3 mr-1" /> Tolak
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
            onClick={() => { setShowRejectModal(null); setRejectNote("") }}
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
                <h3 className="text-base font-bold">Tolak Deposit?</h3>
                <p className="text-sm text-muted-foreground">Dana tidak akan ditambahkan ke saldo pengguna</p>
              </div>
              <Input
                placeholder="Alasan penolakan (opsional)"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="rounded-xl"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl"
                  onClick={() => { setShowRejectModal(null); setRejectNote("") }}
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
