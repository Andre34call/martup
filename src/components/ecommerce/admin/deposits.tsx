"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Wallet, Check, X, AlertTriangle, ExternalLink,
  Eye, ChevronDown, ChevronUp, Clock, Shield, User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, EmptyState, PrimaryButton, InlineSpinner } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { handleApiError } from '@/lib/handle-api-error'

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
  status: "pending" | "proof_uploaded" | "success" | "failed" | "expired"
  proofUrl: string | null
  adminNote: string | null
  destinationAccount: string | null
  senderName: string | null
  expiredAt: string | null
  verifiedAt: string | null
  verifiedBy: string | null
  createdAt: string
  updatedAt: string
}

interface DepositListResponse {
  success: boolean
  data: {
    items: DepositItem[]
    total: number
    page: number
    limit: number
    totalPages: number
  }
  error?: string
}

type DepositMutationResponse = { success: boolean; error?: string }

// ==================== METHOD CONFIG ====================
const methodLabel: Record<string, string> = {
  bank_transfer: "Transfer Bank",
  gopay: "GoPay",
  ovo: "OVO",
  dana: "DANA",
  shopeepay: "ShopeePay",
  linkaja: "LinkAja",
}

const methodEmoji: Record<string, string> = {
  bank_transfer: "🏦",
  gopay: "💳",
  ovo: "💜",
  dana: "🔵",
  shopeepay: "🧡",
  linkaja: "🔴",
}

const statusLabelMap: Record<string, string> = {
  pending: "Menunggu Bayar",
  proof_uploaded: "Bukti Dikirim",
  success: "Berhasil",
  failed: "Gagal",
  expired: "Kadaluarsa",
}

const statusColorMap: Record<string, string> = {
  pending: "border-amber-300 text-amber-600",
  proof_uploaded: "border-cyan-300 text-cyan-600",
  success: "border-emerald-300 text-emerald-600",
  failed: "border-red-300 text-red-600",
  expired: "border-gray-300 text-gray-500",
}

// ==================== ADMIN DEPOSITS ====================
export function AdminDeposits() {
  const { showToast } = useAppStore()
  const [deposits, setDeposits] = useState<DepositItem[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const fetchDeposits = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (statusFilter !== "all") params.status = statusFilter
      const data = await apiClient.get<DepositListResponse>("/api/admin/deposits", params)
      if (data.success && data.data) {
        setDeposits(data.data.items || [])
      }
    } catch (err) {
      handleApiError(err, "deposit")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, showToast])

  useEffect(() => {
    fetchDeposits()
  }, [fetchDeposits])

  const pendingCount = deposits.filter(d => d.status === "pending").length
  const proofCount = deposits.filter(d => d.status === "proof_uploaded").length
  const successCount = deposits.filter(d => d.status === "success").length
  const failedCount = deposits.filter(d => d.status === "failed").length

  const needsActionCount = pendingCount + proofCount

  const handleApprove = async (depositId: string) => {
    setApprovingId(depositId)
    try {
      const data = await apiClient.put<DepositMutationResponse>("/api/admin/deposits", { depositId, status: "success" })
      if (data.success) {
        showToast("Deposit disetujui - saldo ditambahkan", "success")
        fetchDeposits()
      } else {
        showToast(data.error || "Gagal menyetujui deposit", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal menyetujui deposit", "error")
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    setConfirmAction({
      action: async () => {
        try {
          const data = await apiClient.put<DepositMutationResponse>("/api/admin/deposits", { depositId: showRejectModal, status: "failed", adminNote: rejectNote || "Ditolak oleh admin" })
          if (data.success) {
            showToast("Deposit ditolak", "info")
            setShowRejectModal(null)
            setRejectNote("")
            fetchDeposits()
          } else {
            showToast(data.error || "Gagal menolak deposit", "error")
          }
        } catch (err) {
          showToast(err instanceof ApiClientError ? err.message : "Gagal menolak deposit", "error")
        }
      },
      title: 'Tolak Deposit',
      message: 'Apakah Anda yakin ingin menolak deposit ini? Dana tidak akan ditambahkan ke saldo user.'
    })
  }

  // Parse destination account JSON
  const getDestInfo = (destJson: string | null) => {
    if (!destJson) return null
    try { return JSON.parse(destJson) } catch { return null }
  }

  return (
    <div className="pb-20">
      <PageHeader title="Verifikasi Deposit" rightAction={
        <span className="text-xs text-muted-foreground">{needsActionCount} perlu aksi</span>
      } />

      <div className="px-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <motion.div {...fadeIn} className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
            <p className="text-[10px] text-amber-600 font-medium">Pending</p>
          </motion.div>
          <motion.div {...fadeIn} className="bg-cyan-50 dark:bg-cyan-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-cyan-600">{proofCount}</p>
            <p className="text-[10px] text-cyan-600 font-medium">Bukti</p>
          </motion.div>
          <motion.div {...fadeIn} className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{successCount}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Berhasil</p>
          </motion.div>
        </div>

        {/* Total Needs Action Amount */}
        {needsActionCount > 0 && (
          <motion.div {...fadeIn}>
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Total Perlu Verifikasi</p>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                    {formatPrice(deposits.filter(d => d.status === "pending" || d.status === "proof_uploaded").reduce((sum, d) => sum + d.amount, 0))}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "pending", label: "Pending" },
            { key: "proof_uploaded", label: "Bukti" },
            { key: "success", label: "Berhasil" },
            { key: "failed", label: "Gagal" },
            { key: "expired", label: "Kadaluarsa" },
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
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <InlineSpinner className="w-8 h-8 border-purple-500/30 border-t-purple-500" />
              <span className="text-sm text-muted-foreground">Memuat deposit...</span>
            </div>
          ) : deposits.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Deposit"
              subtitle="Semua deposit sudah diproses"
            />
          ) : (
            deposits.map((deposit, i) => {
              const isExpanded = expandedId === deposit.id
              const destInfo = getDestInfo(deposit.destinationAccount)
              const needsAction = deposit.status === "pending" || deposit.status === "proof_uploaded"

              return (
                <motion.div key={deposit.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className={`p-4 ${needsAction ? 'border-amber-200 dark:border-amber-800/50' : ''}`}>
                    {/* Header */}
                    <div
                      className="flex items-start justify-between gap-2 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : deposit.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{deposit.userName}</p>
                          <Badge variant="outline" className={`text-[10px] ${statusColorMap[deposit.status]}`}>
                            {statusLabelMap[deposit.status]}
                          </Badge>
                          {needsAction && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          )}
                        </div>
                        <p className="text-base font-bold text-foreground mt-0.5">{formatPrice(deposit.amount)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground">{formatRelativeTime(deposit.createdAt)}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Quick info row (always visible) */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{methodEmoji[deposit.method] || "💰"} {methodLabel[deposit.method] || deposit.method}</span>
                      {deposit.proofUrl && (
                        <span className="flex items-center gap-1 text-cyan-600">
                          <Eye className="w-3 h-3" /> Bukti
                        </span>
                      )}
                      {deposit.senderName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {deposit.senderName}
                        </span>
                      )}
                    </div>

                    {/* Expanded Detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <Separator className="my-3" />

                          {/* User info */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Email</span>
                              <span className="text-xs text-foreground">{deposit.userEmail}</span>
                            </div>
                            {deposit.userPhone && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Telepon</span>
                                <span className="text-xs text-foreground">{deposit.userPhone}</span>
                              </div>
                            )}
                            {deposit.senderName && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Nama Pengirim</span>
                                <span className="text-xs font-medium text-foreground">{deposit.senderName}</span>
                              </div>
                            )}
                            {destInfo && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Rekening Tujuan</span>
                                  <span className="text-xs text-foreground">{destInfo.bankName || destInfo.type}</span>
                                </div>
                                {destInfo.accountNumber && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">No. Rekening</span>
                                    <span className="text-xs font-mono font-medium text-foreground">{destInfo.accountNumber}</span>
                                  </div>
                                )}
                              </>
                            )}
                            {deposit.expiredAt && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Kadaluarsa</span>
                                <span className={`text-xs ${new Date(deposit.expiredAt) < new Date() ? 'text-red-500' : 'text-foreground'}`}>
                                  {new Date(deposit.expiredAt).toLocaleString('id-ID')}
                                </span>
                              </div>
                            )}
                            {deposit.verifiedAt && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Diverifikasi</span>
                                <span className="text-xs text-foreground">{new Date(deposit.verifiedAt).toLocaleString('id-ID')}</span>
                              </div>
                            )}
                          </div>

                          {/* Proof Image (inline) */}
                          {deposit.proofUrl && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Bukti Transfer</p>
                              <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
                                <img
                                  src={deposit.proofUrl}
                                  alt="Bukti transfer"
                                  className="w-full max-h-64 object-contain"
                                />
                              </div>
                              <a
                                href={deposit.proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" /> Buka di tab baru
                              </a>
                            </div>
                          )}

                          {/* Admin Note */}
                          {deposit.adminNote && (
                            <div className="flex items-start gap-1.5 mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                              <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">{deposit.adminNote}</span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          {needsAction && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                              <PrimaryButton
                                size="sm"
                                className="flex-1 h-9 text-xs rounded-lg"
                                onClick={() => handleApprove(deposit.id)}
                                disabled={approvingId === deposit.id}
                              >
                                {approvingId === deposit.id ? (
                                  <InlineSpinner className="w-3 h-3 mr-1" />
                                ) : (
                                  <Check className="w-3 h-3 mr-1" />
                                )}
                                Setujui
                              </PrimaryButton>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-9 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => setShowRejectModal(deposit.id)}
                              >
                                <X className="w-3 h-3 mr-1" /> Tolak
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              )
            })
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
                  className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white"
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
