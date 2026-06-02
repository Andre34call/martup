"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Package, Truck, CreditCard, Check, X, Eye, Printer, Clock,
  ShieldCheck, ShieldAlert, ShieldOff, ShieldX, ImageIcon,
  Building2, User, MessageSquare, AlertTriangle, Loader2, ChevronDown, ChevronUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { formatPrice, formatDate } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, StatusBadge, EmptyState } from "./shared"
import type { OrderStatus, Order, PlatformBankAccountInfo } from "@/lib/types"
import { useState, useMemo, useEffect } from "react"
import { ConfirmDialog } from "./confirm-dialog"
import { LoadingSpinner } from "./loading-spinner"

// ==================== TYPES ====================
type AdminOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"
type PaymentStatusFilter = "all" | "unpaid" | "pending_verification" | "paid" | "failed"
type EscrowStatus = "none" | "held" | "released" | "refunded"

interface AdminOrder {
  id: string
  orderNumber: string
  buyerName: string
  items: { name: string; quantity: number }[]
  totalAmount: number
  status: AdminOrderStatus
  date: string
  paymentMethod: string
  paymentStatus: string
  paymentProofUrl?: string
  platformBankAccountId?: string
  platformBankAccount?: PlatformBankAccountInfo
  escrowStatus: EscrowStatus
  note?: string
}

// ==================== ORDER STATUS MAPPING ====================
function mapToAdminStatus(status: OrderStatus): AdminOrderStatus {
  switch (status) {
    case 'pending': return 'pending'
    case 'pending_verification': return 'pending'
    case 'paid': return 'processing'
    case 'processing': return 'processing'
    case 'shipped': return 'shipped'
    case 'delivered': return 'delivered'
    case 'cancelled': return 'cancelled'
    case 'refunded': return 'cancelled'
  }
}

function mapStoreOrderToAdminOrder(order: Order): AdminOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    buyerName: order.buyerName || 'Buyer',
    items: order.items.map(i => ({ name: i.productName, quantity: i.quantity })),
    totalAmount: order.totalAmount,
    status: mapToAdminStatus(order.status),
    date: formatDate(order.createdAt),
    paymentMethod: order.paymentMethod || 'COD',
    paymentStatus: order.paymentStatus || 'unpaid',
    paymentProofUrl: order.paymentProofUrl,
    platformBankAccountId: order.platformBankAccountId,
    platformBankAccount: order.platformBankAccount,
    escrowStatus: (order.escrowStatus || 'none') as EscrowStatus,
    note: order.note,
  }
}

// ==================== TAB CONFIG ====================
const orderTabs: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Diproses" },
  { key: "shipped", label: "Dikirim" },
  { key: "delivered", label: "Selesai" },
  { key: "cancelled", label: "Dibatalkan" },
]

// ==================== PAYMENT STATUS FILTER OPTIONS ====================
const paymentFilterOptions: { key: PaymentStatusFilter; label: string }[] = [
  { key: "all", label: "Semua Bayar" },
  { key: "unpaid", label: "Belum Bayar" },
  { key: "pending_verification", label: "Menunggu Verif" },
  { key: "paid", label: "Sudah Bayar" },
  { key: "failed", label: "Gagal" },
]

// ==================== STATUS TO ORDERSTATUS MAPPING ====================
const adminStatusToOrderStatus: Record<AdminOrderStatus, OrderStatus> = {
  pending: "pending",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
}

// ==================== STATUS ICON & COLOR ====================
const statusIconMap: Record<AdminOrderStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  processing: <Package className="w-4 h-4" />,
  shipped: <Truck className="w-4 h-4" />,
  delivered: <Check className="w-4 h-4" />,
  cancelled: <X className="w-4 h-4" />,
}

const statusColorMap: Record<AdminOrderStatus, string> = {
  pending: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
  processing: "text-violet-600 bg-violet-50 dark:bg-violet-900/30",
  shipped: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30",
  delivered: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
  cancelled: "text-red-600 bg-red-50 dark:bg-red-900/30",
}

// ==================== PAYMENT STATUS CONFIG ====================
const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Belum Bayar", color: "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400" },
  pending_verification: { label: "Menunggu Verifikasi", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" },
  paid: { label: "Sudah Bayar", color: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" },
  failed: { label: "Gagal", color: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400" },
}

// ==================== ESCROW STATUS CONFIG ====================
const escrowStatusConfig: Record<EscrowStatus, { label: string; color: string; icon: React.ReactNode }> = {
  none: { label: "Tanpa Escrow", color: "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400", icon: <ShieldOff className="w-3 h-3" /> },
  held: { label: "Dana Ditahan", color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400", icon: <ShieldAlert className="w-3 h-3" /> },
  released: { label: "Dana Dicairkan", color: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <ShieldCheck className="w-3 h-3" /> },
  refunded: { label: "Dana Dikembalikan", color: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400", icon: <ShieldX className="w-3 h-3" /> },
}

// ==================== ACTION BUTTONS CONFIG ====================
function getOrderActions(status: AdminOrderStatus, paymentStatus: string): { label: string; icon: React.ReactNode; variant: "default" | "outline"; className: string }[] {
  // If payment is pending verification, no order status actions until verified
  if (paymentStatus === 'pending_verification') {
    return []
  }
  switch (status) {
    case "pending":
      return [
        { label: "Approve", icon: <Check className="w-3 h-3 mr-1" />, variant: "default", className: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white" },
        { label: "Batalkan", icon: <X className="w-3 h-3 mr-1" />, variant: "outline", className: "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" },
      ]
    case "processing":
      return [
        { label: "Kirim", icon: <Truck className="w-3 h-3 mr-1" />, variant: "default", className: "bg-cyan-500 hover:bg-cyan-600 text-white" },
      ]
    case "shipped":
      return [
        { label: "Selesai", icon: <Check className="w-3 h-3 mr-1" />, variant: "default", className: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white" },
      ]
    case "delivered":
      return []
    case "cancelled":
      return []
    default:
      return []
  }
}

// ==================== PARSE NOTE (sender info) ====================
interface SenderInfo {
  senderName?: string
  senderBank?: string
}

function parseSenderInfo(note?: string): SenderInfo | null {
  if (!note) return null
  try {
    const parsed = JSON.parse(note)
    if (parsed && typeof parsed === 'object') {
      return {
        senderName: parsed.senderName || undefined,
        senderBank: parsed.senderBank || undefined,
      }
    }
  } catch {
    // Not JSON — return the raw note as senderName
    return { senderName: note }
  }
  return null
}

// ==================== TYPE ALIASES ====================
type VerifyPaymentResponse = { success: boolean; error?: string; data?: any }

// ==================== COMPONENT ====================
export function AdminOrdersScreen() {
  const { adminOrders, showToast, setSelectedOrder, navigate, fetchAdminStats, fetchAdminOrders } = useAppStore()
  const [activeTab, setActiveTab] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatusFilter>("all")
  const [updating, setUpdating] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string } | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<PlatformBankAccountInfo[]>([])

  useEffect(() => {
    Promise.all([fetchAdminStats(), fetchAdminOrders()]).finally(() => setIsLoading(false))
  }, [fetchAdminStats, fetchAdminOrders])

  // Fetch platform bank accounts for display
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        type BankAccountsResponse = { success: boolean; data: PlatformBankAccountInfo[]; error?: string }
        const data = await apiClient.get<BankAccountsResponse>("/api/admin/bank-accounts")
        if (data.success && data.data) {
          setBankAccounts(data.data)
        }
      } catch {
        // Silently fail — bank account info is supplementary
      }
    }
    fetchBankAccounts()
  }, [])

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdating(orderId)
    try {
      const data = await apiClient.put<{ success: boolean; error?: string }>('/api/admin/orders', { orderId, status: newStatus })
      if (data.success) {
        await fetchAdminOrders()
      } else {
        showToast(data.error || 'Gagal mengubah status pesanan', 'error')
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : 'Gagal mengubah status pesanan', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const handleVerifyPayment = async (orderId: string, action: 'approve' | 'reject') => {
    setVerifyingOrderId(orderId)
    try {
      const body: { action: 'approve' | 'reject'; adminNote?: string } = { action }
      if (action === 'reject' && rejectNote.trim()) {
        body.adminNote = rejectNote.trim()
      }
      const data = await apiClient.put<VerifyPaymentResponse>(
        `/api/admin/orders/${orderId}/verify-payment`,
        body
      )
      if (data.success) {
        showToast(
          action === 'approve'
            ? 'Pembayaran berhasil diverifikasi'
            : 'Pembayaran ditolak',
          action === 'approve' ? 'success' : 'info'
        )
        setExpandedOrderId(null)
        setShowRejectInput(null)
        setRejectNote("")
        await fetchAdminOrders()
      } else {
        showToast(data.error || 'Gagal memverifikasi pembayaran', 'error')
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : 'Gagal memverifikasi pembayaran', 'error')
    } finally {
      setVerifyingOrderId(null)
    }
  }

  const orders = useMemo(() => adminOrders.map(mapStoreOrderToAdminOrder), [adminOrders])

  // Combined filter: status tab + payment status filter
  const filtered = useMemo(() => {
    let result = orders
    if (activeTab !== "all") {
      result = result.filter((o) => o.status === activeTab)
    }
    if (paymentFilter !== "all") {
      result = result.filter((o) => o.paymentStatus === paymentFilter)
    }
    return result
  }, [orders, activeTab, paymentFilter])

  const pendingCount = orders.filter((o) => o.status === "pending").length
  const processingCount = orders.filter((o) => o.status === "processing").length
  const shippedCount = orders.filter((o) => o.status === "shipped").length
  const deliveredCount = orders.filter((o) => o.status === "delivered").length
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length

  const pendingVerificationCount = orders.filter((o) => o.paymentStatus === 'pending_verification').length

  const tabCounts: Record<string, number> = {
    all: orders.length,
    pending: pendingCount,
    processing: processingCount,
    shipped: shippedCount,
    delivered: deliveredCount,
    cancelled: cancelledCount,
  }

  // Summary stats for top cards
  const summaryCards = [
    { label: "Pending", count: pendingCount, icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400" },
    { label: "Perlu Verif", count: pendingVerificationCount, icon: ShieldAlert, color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" },
    { label: "Dikirim", count: shippedCount, icon: Truck, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-400" },
    { label: "Selesai", count: deliveredCount, icon: Check, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
  ]

  // Helper to resolve bank account info from local cache
  const getBankAccountInfo = (accountId?: string): PlatformBankAccountInfo | undefined => {
    if (!accountId) return undefined
    return bankAccounts.find(b => b.id === accountId)
  }

  if (isLoading) return <div className="pb-20"><PageHeader title="Kelola Pesanan" /><LoadingSpinner message="Memuat pesanan..." /></div>

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Pesanan" />

      <div className="px-4 space-y-4">
        {/* Summary Stats */}
        <motion.div {...fadeIn} className="grid grid-cols-4 gap-2">
          {summaryCards.map((card, i) => (
            <motion.div key={card.label} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="p-3 text-center">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-foreground">{card.count}</p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Tab Filters (Order Status) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {orderTabs.map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {tab.label}
              <span className={`min-w-[18px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1 ${
                activeTab === tab.key
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}>
                {tabCounts[tab.key]}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Payment Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {paymentFilterOptions.map((opt) => (
            <motion.button
              key={opt.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPaymentFilter(opt.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors border ${
                paymentFilter === opt.key
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {opt.label}
              {opt.key === 'pending_verification' && pendingVerificationCount > 0 && (
                <span className={`min-w-[16px] h-3.5 flex items-center justify-center rounded-full text-[9px] font-bold px-0.5 ${
                  paymentFilter === opt.key ? "bg-white/20 text-white" : "bg-amber-500 text-white"
                }`}>
                  {pendingVerificationCount}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Order List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Pesanan"
              subtitle="Belum ada pesanan dengan filter ini"
            />
          ) : (
            filtered.map((order, i) => {
              const actions = getOrderActions(order.status, order.paymentStatus)
              const itemsText = order.items.length > 1
                ? `${order.items[0].name} +${order.items.length - 1} lainnya`
                : order.items[0].name
              const isExpanded = expandedOrderId === order.id
              const isPendingVerification = order.paymentStatus === 'pending_verification'
              const escrow = escrowStatusConfig[order.escrowStatus] || escrowStatusConfig.none
              const payment = paymentStatusConfig[order.paymentStatus] || paymentStatusConfig.unpaid

              return (
                <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-4">
                    {/* Order Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${statusColorMap[order.status]}`}>
                          {statusIconMap[order.status]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{order.orderNumber}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{order.buyerName}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={adminStatusToOrderStatus[order.status]} size="sm" />
                        {/* Escrow Badge */}
                        {order.escrowStatus !== 'none' && (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${escrow.color}`}>
                            {escrow.icon}
                            {escrow.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Order Details */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Package className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-foreground line-clamp-1">{itemsText}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{order.paymentMethod}</span>
                        </div>
                        <p className="text-sm font-bold text-emerald-600">{formatPrice(order.totalAmount)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{order.date}</span>
                        </div>
                        {/* Payment Status Badge */}
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${payment.color}`}>
                          {payment.label}
                        </span>
                      </div>
                    </div>

                    {/* Payment Verification Alert (for pending_verification) */}
                    {isPendingVerification && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                            Pembayaran menunggu verifikasi
                          </p>
                          <button
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            className="ml-auto p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                          >
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-amber-600" />
                              : <ChevronDown className="w-4 h-4 text-amber-600" />
                            }
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expanded Payment Verification Detail */}
                    <AnimatePresence>
                      {isPendingVerification && isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 p-3 bg-amber-50/80 dark:bg-amber-950/10 rounded-xl border border-amber-200/60 dark:border-amber-800/30 space-y-3">
                            {/* Header: Bukti Transfer Pembeli */}
                            <div className="flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-amber-600" />
                              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                Bukti Transfer Pembeli
                              </p>
                            </div>

                            {/* Payment Proof Image */}
                            {order.paymentProofUrl ? (
                              <div className="relative">
                                <button
                                  onClick={() => window.open(order.paymentProofUrl, "_blank")}
                                  className="block w-24 h-24 rounded-lg overflow-hidden border-2 border-amber-200 dark:border-amber-700 hover:opacity-80 transition-opacity"
                                >
                                  <img
                                    src={order.paymentProofUrl}
                                    alt="Bukti Transfer"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <p className="text-[10px] text-amber-500 mt-1">Tap untuk memperbesar</p>
                              </div>
                            ) : (
                              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-amber-300 dark:border-amber-700 flex items-center justify-center bg-white/50 dark:bg-amber-950/20">
                                <div className="text-center">
                                  <ImageIcon className="w-6 h-6 text-amber-400 mx-auto" />
                                  <p className="text-[9px] text-amber-500 mt-1">Tidak ada</p>
                                </div>
                              </div>
                            )}

                            {/* Sender Info (parsed from note) */}
                            {(() => {
                              const senderInfo = parseSenderInfo(order.note)
                              if (!senderInfo) return null
                              return (
                                <div className="space-y-1.5">
                                  {senderInfo.senderName && (
                                    <div className="flex items-center gap-2">
                                      <User className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                      <span className="text-[11px] text-muted-foreground">Pengirim:</span>
                                      <span className="text-[11px] font-medium text-foreground">{senderInfo.senderName}</span>
                                    </div>
                                  )}
                                  {senderInfo.senderBank && (
                                    <div className="flex items-center gap-2">
                                      <Building2 className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                      <span className="text-[11px] text-muted-foreground">Bank:</span>
                                      <span className="text-[11px] font-medium text-foreground">{senderInfo.senderBank}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* Platform Bank Account Info */}
                            {(() => {
                              const bankInfo = order.platformBankAccount || getBankAccountInfo(order.platformBankAccountId)
                              if (!bankInfo) return null
                              return (
                                <div className="p-2.5 bg-white dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-800/30">
                                  <p className="text-[10px] text-amber-600 font-medium mb-1">Rekening Tujuan MartUp</p>
                                  <p className="text-xs font-semibold text-foreground">{bankInfo.bankName}</p>
                                  <p className="text-xs text-muted-foreground font-mono tracking-wide">{bankInfo.accountNumber}</p>
                                  <p className="text-[10px] text-muted-foreground">a/n {bankInfo.accountHolder}</p>
                                </div>
                              )
                            })()}

                            <Separator />

                            {/* Action Buttons */}
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="flex-1 h-9 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                                  onClick={() => handleVerifyPayment(order.id, 'approve')}
                                  disabled={verifyingOrderId === order.id}
                                >
                                  {verifyingOrderId === order.id ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  Terima Pembayaran
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 font-semibold px-3"
                                  onClick={() => {
                                    if (showRejectInput === order.id) {
                                      // Submit reject if note entered
                                      handleVerifyPayment(order.id, 'reject')
                                    } else {
                                      setShowRejectInput(order.id)
                                    }
                                  }}
                                  disabled={verifyingOrderId === order.id}
                                >
                                  {verifyingOrderId === order.id ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                  ) : (
                                    <X className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  Tolak
                                </Button>
                              </div>

                              {/* Reject Note Input */}
                              <AnimatePresence>
                                {showRejectInput === order.id && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-start gap-2">
                                        <MessageSquare className="w-3.5 h-3.5 text-red-500 mt-2 flex-shrink-0" />
                                        <div className="flex-1">
                                          <label className="text-[10px] text-muted-foreground font-medium block mb-1">
                                            Alasan Penolakan
                                          </label>
                                          <Input
                                            value={rejectNote}
                                            onChange={(e) => setRejectNote(e.target.value)}
                                            placeholder="Masukkan alasan penolakan..."
                                            className="h-8 text-xs rounded-lg"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-[11px] rounded-lg"
                                          onClick={() => {
                                            setShowRejectInput(null)
                                            setRejectNote("")
                                          }}
                                        >
                                          Batal
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-7 text-[11px] rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold px-3"
                                          onClick={() => handleVerifyPayment(order.id, 'reject')}
                                          disabled={verifyingOrderId === order.id}
                                        >
                                          {verifyingOrderId === order.id ? (
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          ) : (
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                          )}
                                          Konfirmasi Tolak
                                        </Button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action Buttons */}
                    {actions.length > 0 && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                        {actions.map((action) => (
                          <Button
                            key={action.label}
                            variant={action.variant}
                            size="sm"
                            className={`h-8 text-[11px] rounded-lg ${action.className}`}
                            onClick={() => {
                              if (action.label === 'Approve') { handleStatusUpdate(order.id, 'paid'); showToast('Pesanan disetujui', 'success') }
                              else if (action.label === 'Batalkan') { setConfirmAction({ action: () => { handleStatusUpdate(order.id, 'cancelled'); showToast('Pesanan dibatalkan', 'info') }, title: 'Batalkan Pesanan', message: `Apakah Anda yakin ingin membatalkan pesanan ${order.orderNumber}? Tindakan ini tidak dapat dibatalkan.` }) }
                              else if (action.label === 'Kirim') { handleStatusUpdate(order.id, 'shipped'); showToast('Pesanan dikirim', 'success') }
                              else if (action.label === 'Selesai') { handleStatusUpdate(order.id, 'delivered'); showToast('Pesanan selesai', 'success') }
                            }}
                            disabled={updating === order.id}
                          >
                            {action.icon}
                            {action.label}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg ml-auto"
                          onClick={() => { setSelectedOrder(order.id); navigate('orders') }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Detail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg"
                          onClick={() => showToast("Invoice dicetak", "info")}
                        >
                          <Printer className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                    {/* Delivered / Cancelled - only show detail & print */}
                    {(order.status === "delivered" || order.status === "cancelled") && !isPendingVerification && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg ml-auto"
                          onClick={() => { setSelectedOrder(order.id); navigate('orders') }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Detail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg"
                          onClick={() => showToast("Invoice dicetak", "info")}
                        >
                          <Printer className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                    {/* For pending_verification orders without expanded view, still show Detail & Print */}
                    {isPendingVerification && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg ml-auto"
                          onClick={() => { setSelectedOrder(order.id); navigate('orders') }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Detail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px] rounded-lg"
                          onClick={() => showToast("Invoice dicetak", "info")}
                        >
                          <Printer className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
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
