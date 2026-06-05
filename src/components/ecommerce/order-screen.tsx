"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore, useCartStore } from "@/lib/store"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, EmptyState, StatusBadge, TabBar, PrimaryButton } from "./shared"
import type { Order, OrderStatus } from "@/lib/types"
import { useState, useMemo, useCallback, useEffect } from "react"
import {
  ArrowLeft, Package, CreditCard, Truck, CheckCircle2, Star,
  ChevronRight, MapPin, Clock, ShoppingBag, RotateCcw, Copy,
  Phone, MessageCircle, Store, Wallet, Receipt, Landmark, Upload, ImagePlus, CheckCircle,
  Image as ImageIcon, Timer, Landmark as BankIcon, QrCode
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { apiClient } from "@/lib/api-client"

// ==================== PAYMENT REFERENCE PARSER ====================
// Parses paymentReference JSON from order and returns structured data
interface PaymentRefData {
  va_numbers?: Array<{ bank: string; va_number: string }>
  va_number?: string
  bank?: string
  permata_va_number?: string
  payment_code?: string
  bill_key?: string
  biller_code?: string
  qr_url?: string
  actions?: Array<{ name: string; url: string; method?: string }>
  payment_type?: string
}

function parsePaymentReference(ref: string | undefined): PaymentRefData | null {
  if (!ref) return null
  try {
    const parsed = JSON.parse(ref)
    if (parsed && (parsed.va_number || parsed.payment_code || parsed.bill_key || parsed.qr_url || parsed.actions)) {
      return parsed as PaymentRefData
    }
    return null
  } catch {
    return null
  }
}

// Display name for Midtrans payment type
function getPaymentTypeLabel(type: string | undefined): string {
  if (!type) return 'Transfer / E-Wallet'
  const map: Record<string, string> = {
    bank_transfer: 'Transfer Bank',
    gopay: 'GoPay',
    shopeepay: 'ShopeePay',
    qris: 'QRIS',
    cstore: 'Gerai (Indomaret/Alfamart)',
    danamon_online: 'Danamon Online',
    bca_klikpay: 'BCA KlikPay',
    bca_klikbca: 'KlikBCA',
    mandiri_clickpay: 'Mandiri ClickPay',
    bri_epay: 'BRI Epay',
    cimb_clicks: 'CIMB Clicks',
    card: 'Kartu Kredit/Debit',
    echannel: 'Mandiri Bill',
  }
  return map[type] || type
}

const ORDER_TABS = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Belum Bayar" },
  { key: "processing", label: "Diproses" },
  { key: "shipped", label: "Dikirim" },
  { key: "delivered", label: "Selesai" },
]

const tabStatusMap: Record<string, OrderStatus[]> = {
  all: [],
  pending: ["pending"],
  processing: ["paid", "processing"],
  shipped: ["shipped"],
  delivered: ["delivered"],
}

// Timeline steps for order tracking
const TRACKING_STEPS = [
  { key: "ordered", label: "Pesanan Dibuat", icon: ShoppingBag },
  { key: "paid", label: "Pembayaran Dikonfirmasi", icon: CreditCard },
  { key: "processing", label: "Sedang Diproses", icon: Package },
  { key: "shipped", label: "Pesanan Dikirim", icon: Truck },
  { key: "delivered", label: "Pesanan Diterima", icon: CheckCircle2 },
]

// Service order timeline steps (different labels)
const SERVICE_TRACKING_STEPS = [
  { key: "ordered", label: "Pesanan Dibuat", icon: ShoppingBag },
  { key: "paid", label: "Pembayaran Dikonfirmasi", icon: CreditCard },
  { key: "processing", label: "Tolong Mas Sedang Dikerjakan", icon: Package },
  { key: "shipped", label: "Bukti Tolong Mas Dikirim", icon: CheckCircle2 },
  { key: "delivered", label: "Tolong Mas Dikonfirmasi Selesai", icon: CheckCircle2 },
]

// Service proof data type
interface ServiceProofData {
  orderId: string
  orderNumber: string
  isServiceOrder: boolean
  status: string
  proofImages: string[]
  sellerCompletedAt: string | null
  autoConfirmAt: string | null
  buyerConfirmedAt: string | null
}

function getActiveStep(order: Order): number {
  switch (order.status) {
    case "pending": return 0
    case "paid": return 1
    case "processing": return 2
    case "shipped": return 3
    case "delivered": return 4
    case "cancelled": return -1
    case "refunded": return -1
    default: return 0
  }
}

function getActionButton(order: Order): { label: string; variant: "default" | "outline"; icon?: React.ReactNode } | null {
  switch (order.status) {
    case "pending":
      return { label: "Bayar", variant: "default", icon: <CreditCard className="w-3.5 h-3.5" /> }
    case "shipped":
      if (order.isServiceOrder) {
        return { label: "Konfirmasi", variant: "default", icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
      }
      return { label: "Lacak", variant: "default", icon: <Truck className="w-3.5 h-3.5" /> }
    case "delivered":
      return { label: "Review", variant: "default", icon: <Star className="w-3.5 h-3.5" /> }
    default:
      return null
  }
}

function getSecondaryButton(order: Order): { label: string } | null {
  switch (order.status) {
    case "delivered":
      return { label: "Beli Lagi" }
    case "shipped":
      if (order.isServiceOrder) {
        return null // No secondary button for service orders — primary is "Konfirmasi"
      }
      return { label: "Terima" }
    default:
      return null
  }
}

// ==================== SERVICE PROOF COUNTDOWN ====================
function ServiceProofCountdown({ autoConfirmAt }: { autoConfirmAt: string }) {
  const [remaining, setRemaining] = useState("")

  useEffect(() => {
    const update = () => {
      const target = new Date(autoConfirmAt).getTime()
      const now = Date.now()
      const diff = target - now
      if (diff <= 0) { setRemaining("Otomatis dikonfirmasi"); return }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      if (days > 0) {
        setRemaining(`${days} hari ${hours} jam lagi`)
      } else if (hours > 0) {
        setRemaining(`${hours} jam ${minutes} menit lagi`)
      } else {
        setRemaining(`${minutes} menit lagi`)
      }
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [autoConfirmAt])

  return <>{remaining}</>
}

// ==================== ORDER CARD ====================
function OrderCard({ order, onTap }: { order: Order; onTap: () => void }) {
  const { showToast, updateOrderStatus, setSelectedOrder, navigate, payForOrder, cancelOrder, products, fetchOrders } = useAppStore()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const { addItem } = useCartStore()
  const primaryBtn = getActionButton(order)
  const secondaryBtn = getSecondaryButton(order)

  // Confirm service completion via API
  const confirmServiceOrder = useCallback(async (orderId: string) => {
    setIsConfirming(true)
    try {
      const res = await apiClient.rawPut(`/api/orders/${orderId}`, { status: 'delivered' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengkonfirmasi')
      }
      updateOrderStatus(orderId, 'delivered')
      const userId = useAppStore.getState().currentUser?.id
      if (userId) await fetchOrders(userId)
      showToast("Tolong Mas dikonfirmasi selesai! Dana escrow akan dilepas.", "success")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengkonfirmasi Tolong Mas'
      showToast(message, "error")
    } finally {
      setIsConfirming(false)
    }
  }, [updateOrderStatus, showToast, fetchOrders])

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={onTap}
      className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{order.seller.storeName}</span>
          {order.isServiceOrder && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              Tolong Mas
            </span>
          )}
        </div>
        <StatusBadge status={order.status} size="sm" />
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex gap-3">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {item.image ? (
                <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">{item.productName}</p>
              {item.variantName && (
                <p className="text-xs text-muted-foreground mt-0.5">Varian: {item.variantName}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold text-emerald-600">{formatPrice(item.price)}</span>
                <span className="text-xs text-muted-foreground">x{item.quantity}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Service order: waiting for buyer confirmation banner */}
      {order.isServiceOrder && order.status === "shipped" && order.serviceProofImages && order.serviceProofImages.length > 0 && (
        <div className="px-4 pb-2">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Bukti Tolong Mas telah dikirim</span>
            </div>
            <div className="flex gap-1.5">
              {order.serviceProofImages.slice(0, 3).map((img, idx) => (
                <div key={idx} className="w-10 h-10 rounded-md overflow-hidden border border-purple-200 dark:border-purple-800/50">
                  <img src={img} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
              {order.serviceProofImages.length > 3 && (
                <div className="w-10 h-10 rounded-md bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center border border-purple-200 dark:border-purple-800/50">
                  <span className="text-[10px] font-medium text-purple-600">+{order.serviceProofImages.length - 3}</span>
                </div>
              )}
            </div>
            {order.autoConfirmAt && (
              <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1.5 flex items-center gap-1">
                <Timer className="w-3 h-3" />
                Auto konfirmasi <ServiceProofCountdown autoConfirmAt={order.autoConfirmAt} />
              </p>
            )}
          </div>
        </div>
      )}

      {/* Total */}
      <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {order.items.length} produk
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Total Pesanan:</span>
          <span className="text-sm font-bold text-foreground">{formatPrice(order.totalAmount)}</span>
        </div>
      </div>

      {/* Actions */}
      {(primaryBtn || secondaryBtn || order.status === "pending") && (
        <div className="px-4 py-3 border-t border-border/30 flex items-center justify-end gap-2">
          {order.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs rounded-lg text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={(e) => {
                e.stopPropagation()
                setShowCancelDialog(true)
              }}
            >
              Batalkan
            </Button>
          )}
          {secondaryBtn && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs rounded-lg"
              onClick={(e) => {
                e.stopPropagation()
                if (order.status === "shipped") {
                  updateOrderStatus(order.id, "delivered")
                  showToast("Pesanan dikonfirmasi diterima!", "success")
                } else if (order.status === "delivered") {
                  const product = products.find(p => p.id === order.items[0]?.productId)
                  if (product) {
                    addItem(product)
                    showToast("Produk ditambahkan ke keranjang", "success")
                  } else {
                    showToast("Produk tidak ditemukan", "error")
                  }
                }
              }}
            >
              {secondaryBtn.label}
            </Button>
          )}
          {primaryBtn && (
            <PrimaryButton
              size="sm"
              className={`h-8 text-xs rounded-lg ${order.isServiceOrder && order.status === "shipped" ? "bg-purple-500 hover:bg-purple-600 active:bg-purple-700" : ""}`}
              disabled={isConfirming}
              onClick={async (e) => {
                e.stopPropagation()
                if (order.status === "pending") {
                  const paymentMethod = order.paymentMethod?.toLowerCase() || ''

                  // COD: no payment needed
                  if (paymentMethod === 'cod') {
                    showToast("Pembayaran dilakukan saat barang diterima (COD).", "info")
                    return
                  }

                  // Escrow: navigate to order detail for bank info & proof upload
                  if (paymentMethod.includes('escrow')) {
                    onTap()
                    return
                  }

                  const result = await payForOrder(order.id)
                  if (result?.token) {
                    // Midtrans payment — open Snap popup
                    try {
                      const { openSnapPayment } = await import('@/lib/midtrans')
                      const snapResult = await openSnapPayment(result.token)
                      if (snapResult.status === 'success') {
                        showToast('Pembayaran berhasil!', 'success')
                      } else if (snapResult.status === 'pending') {
                        showToast('Pembayaran tertunda. Selesaikan pembayaran Anda.', 'warning')
                      } else if (snapResult.status === 'closed') {
                        showToast('Pembayaran dibatalkan. Anda bisa membayar nanti.', 'warning')
                      } else {
                        showToast('Pembayaran gagal. Silakan coba lagi.', 'error')
                      }
                    } catch {
                      showToast('Gagal membuka halaman pembayaran.', 'error')
                    }
                  } else if (result?.redirectUrl) {
                    // Fallback: redirect to Midtrans payment page
                    window.open(result.redirectUrl, '_blank')
                  } else if (paymentMethod === 'wallet') {
                    // Wallet payment was actually processed
                    showToast("Pembayaran berhasil diproses!", "success")
                  } else {
                    // No token, no redirect, and not a wallet payment — open order detail
                    // so the user can see payment instructions / take next steps
                    onTap()
                  }
                } else if (order.status === "shipped" && order.isServiceOrder) {
                  // Service order: confirm via API to release escrow
                  await confirmServiceOrder(order.id)
                } else if (order.status === "shipped") {
                  onTap()
                } else if (order.status === "delivered") {
                  setSelectedOrder(order.id)
                  navigate("review")
                }
              }}
            >
              {isConfirming ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
              ) : (
                primaryBtn.icon
              )}
              <span className="ml-1">{isConfirming ? "Mengkonfirmasi..." : primaryBtn.label}</span>
            </PrimaryButton>
          )}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-[320px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Batalkan Pesanan?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Apakah kamu yakin ingin membatalkan pesanan {order.orderNumber}?</p>
          <DialogFooter className="mt-3 gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="rounded-xl h-10 flex-1">
              Tidak
            </Button>
            <Button
              onClick={() => {
                cancelOrder(order.id)
                showToast("Pesanan berhasil dibatalkan", "success")
                setShowCancelDialog(false)
              }}
              className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl h-10 flex-1"
            >
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ==================== ORDER DETAIL ====================
function OrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  const { showToast, updateOrderStatus, setSelectedOrder, navigate, setSelectedChatRoom, chatRooms, payForOrder, cancelOrder, products, fetchOrders } = useAppStore()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [escrowBankAccounts, setEscrowBankAccounts] = useState<{ bankName: string; accountNumber: string; accountHolder: string }[]>([])
  const [isUploadingProof, setIsUploadingProof] = useState(false)
  const [isConfirmingService, setIsConfirmingService] = useState(false)
  const [serviceProofData, setServiceProofData] = useState<ServiceProofData | null>(null)
  const [isLoadingServiceProof, setIsLoadingServiceProof] = useState(false)
  const { addItem } = useCartStore()
  const activeStep = getActiveStep(order)
  const isEscrowOrder = order.paymentMethod?.toLowerCase().includes('escrow')
  const isMidtransPayment = (order.paymentMethod?.toLowerCase().includes('midtrans') ||
    order.paymentMethod?.toLowerCase().includes('transfer') ||
    order.paymentMethod?.toLowerCase().includes('ewallet') ||
    order.paymentMethod?.toLowerCase().includes('e-wallet') ||
    order.paymentMethod?.toLowerCase().includes('gopay') ||
    order.paymentMethod?.toLowerCase().includes('shopeepay') ||
    order.paymentMethod?.toLowerCase().includes('qris') ||
    order.paymentMethod?.toLowerCase().includes('kartu') ||
    order.paymentMethod?.toLowerCase().includes('card')) &&
    !isEscrowOrder
  const paymentRef = parsePaymentReference(order.paymentReference)
  const showPaymentRef = isMidtransPayment &&
    (order.paymentStatus === 'unpaid' || order.paymentStatus === 'pending') &&
    paymentRef

  // Fetch service proof data for service orders
  useEffect(() => {
    if (order.isServiceOrder && (order.status === 'shipped' || order.status === 'delivered')) {
      setIsLoadingServiceProof(true)
      apiClient.get<{ success: boolean; data: ServiceProofData }>(`/api/orders/${order.id}/service-proof`)
        .then(data => {
          if (data.success && data.data) {
            setServiceProofData(data.data)
          }
        })
        .catch(() => {
          // silently fail — use local order data as fallback
        })
        .finally(() => setIsLoadingServiceProof(false))
    }
  }, [order.id, order.isServiceOrder, order.status])

  // The proof images to display — prefer API data, fall back to order data
  const proofImages = serviceProofData?.proofImages || order.serviceProofImages || []
  const autoConfirmAt = serviceProofData?.autoConfirmAt || order.autoConfirmAt

  // Fetch MartUp bank accounts for escrow orders
  const fetchBankAccounts = useCallback(async () => {
    try {
      const data = await apiClient.get<{ success: boolean; data: { bankName: string; accountNumber: string; accountHolder: string }[] }>('/api/settings/bank-accounts')
      if (data.success && data.data) {
        setEscrowBankAccounts(data.data)
      }
    } catch {
      // silently fail
    }
  }, [])

  // Fetch bank accounts when escrow order needs payment
  useState(() => {
    if (isEscrowOrder && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'pending_verification')) {
      fetchBankAccounts()
    }
  })

  // Upload payment proof for escrow orders
  const handleUploadPaymentProof = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file maksimal 5MB', 'error')
        return
      }

      setIsUploadingProof(true)
      try {
        // Upload image
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'reviews')
        formData.append('folder', 'images')
        const uploadData = await apiClient.upload<{ success: boolean; data?: { url: string }; error?: string }>('/api/upload', formData)
        if (!uploadData.success || !uploadData.data?.url) {
          showToast(uploadData.error || 'Gagal upload bukti pembayaran', 'error')
          return
        }

        // Prompt for bank name
        const bankName = prompt('Masukkan nama bank pengirim (contoh: BCA, Mandiri):')
        if (!bankName?.trim()) {
          showToast('Nama bank wajib diisi', 'error')
          return
        }

        // Submit payment proof
        const confirmData = await apiClient.post<{ success: boolean; error?: string }>(`/api/orders/${order.id}/confirm-payment`, {
          proofUrl: uploadData.data.url,
          bankName: bankName.trim(),
        })
        if (confirmData.success) {
          showToast('Bukti pembayaran berhasil diupload! Menunggu verifikasi admin.', 'success')
          // Update local order
          updateOrderStatus(order.id, order.status)
        } else {
          showToast(confirmData.error || 'Gagal mengirim bukti pembayaran', 'error')
        }
      } catch (err) {
        showToast('Terjadi kesalahan saat upload bukti', 'error')
      } finally {
        setIsUploadingProof(false)
      }
    }
    input.click()
  }, [order.id, order.status, showToast, updateOrderStatus])

  // Confirm service completion via API
  const handleConfirmService = useCallback(async () => {
    setIsConfirmingService(true)
    try {
      const res = await apiClient.rawPut(`/api/orders/${order.id}`, { status: 'delivered' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengkonfirmasi')
      }
      updateOrderStatus(order.id, 'delivered')
      const userId = useAppStore.getState().currentUser?.id
      if (userId) await fetchOrders(userId)
      showToast("Tolong Mas dikonfirmasi selesai! Dana escrow akan dilepas.", "success")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengkonfirmasi Tolong Mas'
      showToast(message, "error")
    } finally {
      setIsConfirmingService(false)
    }
  }, [order.id, updateOrderStatus, showToast, fetchOrders])

  // Choose timeline steps based on order type
  const trackingSteps = order.isServiceOrder ? SERVICE_TRACKING_STEPS : TRACKING_STEPS

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title={`Pesanan ${order.orderNumber}`}
        onBack={onBack}
        rightAction={
          <button
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            onClick={() => {
              const room = chatRooms.find(r => r.seller.id === order.sellerId)
              if (room) { setSelectedChatRoom(room.id); navigate("chat-room") }
              else { showToast("Chat belum tersedia", "info") }
            }}
          >
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        }
      />

      <div className="flex-1 pb-20">
        {/* Status Banner */}
        <div className="px-4 py-4">
          <div className={`${order.isServiceOrder ? 'bg-purple-50 dark:bg-purple-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'} rounded-xl p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-full ${order.isServiceOrder ? 'bg-purple-500' : 'bg-emerald-500'} flex items-center justify-center flex-shrink-0`}>
              {order.status === "shipped" && order.isServiceOrder ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : order.status === "shipped" ? (
                <Truck className="w-5 h-5 text-white" />
              ) : order.status === "delivered" ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : order.status === "pending" ? (
                <Clock className="w-5 h-5 text-white" />
              ) : (
                <Package className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                <StatusBadge status={order.status} size="md" />
                {order.isServiceOrder && (
                  <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    Tolong Mas
                  </span>
                )}
              </p>
              {order.isServiceOrder && order.status === "shipped" && (
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                  Bukti Tolong Mas telah dikirim, menunggu konfirmasi Anda
                </p>
              )}
              {!order.isServiceOrder && order.shipping?.estimatedDays && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estimasi {order.shipping.estimatedDays} hari
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Shipping Tracking Timeline */}
        {order.status !== "cancelled" && order.status !== "refunded" && !order.isServiceOrder && (
          <div className="px-4 pb-4">
            <div className="bg-card rounded-xl border border-border/50 p-4">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-500" />
                Lacak Pengiriman
              </h3>
              {order.shipping?.trackingNumber && (
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/30">
                  <div>
                    <p className="text-xs text-muted-foreground">No. Resi</p>
                    <p className="text-sm font-semibold text-foreground">{order.shipping.trackingNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{order.shipping.provider} {order.shipping.service}</p>
                    <button
                      onClick={() => navigator.clipboard?.writeText(order.shipping?.trackingNumber || "")}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}

              {/* Vertical Timeline */}
              <div className="space-y-0">
                {trackingSteps.map((step, idx) => {
                  const isCompleted = idx <= activeStep
                  const isCurrent = idx === activeStep
                  const StepIcon = step.icon

                  return (
                    <div key={step.key} className="flex gap-3">
                      {/* Timeline indicator */}
                      <div className="flex flex-col items-center">
                        <motion.div
                          initial={false}
                          animate={{
                            scale: isCurrent ? [1, 1.2, 1] : 1,
                            backgroundColor: isCompleted ? "#10b981" : "#e5e7eb",
                          }}
                          transition={{ duration: 0.5 }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? "bg-emerald-500" : "bg-muted"
                          }`}
                        >
                          <StepIcon className={`w-4 h-4 ${isCompleted ? "text-white" : "text-muted-foreground"}`} />
                        </motion.div>
                        {idx < trackingSteps.length - 1 && (
                          <div className={`w-0.5 h-8 ${idx < activeStep ? "bg-emerald-500" : "bg-border"}`} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-emerald-600 mt-0.5">Sedang berlangsung</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Service Order Timeline (simplified) */}
        {order.status !== "cancelled" && order.status !== "refunded" && order.isServiceOrder && (
          <div className="px-4 pb-4">
            <div className="bg-card rounded-xl border border-border/50 p-4">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-500" />
                Status Tolong Mas
              </h3>
              <div className="space-y-0">
                {trackingSteps.map((step, idx) => {
                  const isCompleted = idx <= activeStep
                  const isCurrent = idx === activeStep
                  const StepIcon = step.icon

                  return (
                    <div key={step.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <motion.div
                          initial={false}
                          animate={{
                            scale: isCurrent ? [1, 1.2, 1] : 1,
                            backgroundColor: isCompleted ? "#a855f7" : "#e5e7eb",
                          }}
                          transition={{ duration: 0.5 }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? "bg-purple-500" : "bg-muted"
                          }`}
                        >
                          <StepIcon className={`w-4 h-4 ${isCompleted ? "text-white" : "text-muted-foreground"}`} />
                        </motion.div>
                        {idx < trackingSteps.length - 1 && (
                          <div className={`w-0.5 h-8 ${idx < activeStep ? "bg-purple-500" : "bg-border"}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-purple-600 mt-0.5">Sedang berlangsung</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Service Proof Images — show for service orders with status shipped or later */}
        {order.isServiceOrder && (order.status === "shipped" || order.status === "delivered") && (
          <div className="px-4 pb-4">
            <div className="bg-card rounded-xl border border-border/50 p-4">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                Bukti Penyelesaian Tolong Mas
              </h3>
              {isLoadingServiceProof ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : proofImages.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {proofImages.map((img, idx) => (
                      <div key={idx} className="w-full aspect-square rounded-lg overflow-hidden border border-border/50">
                        <img src={img} alt={`Bukti Tolong Mas ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  {serviceProofData?.sellerCompletedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Dikirim: {new Date(serviceProofData.sellerCompletedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {!serviceProofData?.sellerCompletedAt && order.shippedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Dikirim: {new Date(order.shippedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Belum ada bukti penyelesaian dari penjual.</p>
              )}

              {/* Auto-confirm countdown notice */}
              {order.status === "shipped" && autoConfirmAt && (
                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/50">
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" />
                    <span className="font-medium">Auto konfirmasi:</span>{' '}
                    <ServiceProofCountdown autoConfirmAt={autoConfirmAt} />
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Jika tidak dikonfirmasi, pesanan akan otomatis dikonfirmasi dan dana escrow dilepas.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shipping Address — only for non-service orders */}
        {!order.isServiceOrder && order.address && (
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500" />
              Alamat Pengiriman
            </h3>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-foreground">{order.address.recipient}</p>
                <span className="text-xs text-muted-foreground">{order.address.phone}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {order.address.address}, {order.address.city}, {order.address.province} {order.address.postalCode}
              </p>
              {order.address.label && (
                <span className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {order.address.label}
                </span>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Product Items */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-500" />
                {order.seller.storeName}
              </h3>
              <button
                className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"
                onClick={() => {
                  const room = chatRooms.find(r => r.seller.id === order.sellerId)
                  if (room) { setSelectedChatRoom(room.id); navigate("chat-room") }
                  else { showToast("Chat belum tersedia", "info") }
                }}
              >
                <MessageCircle className="w-3 h-3" />
                Chat
              </button>
            </div>
            {order.items.map((item, idx) => (
              <div key={item.id}>
                <div className="flex gap-3 py-2">
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">{item.productName}</p>
                    {item.variantName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.variantName}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-emerald-600">{formatPrice(item.price)}</span>
                      <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                    </div>
                  </div>
                </div>
                {idx < order.items.length - 1 && <Separator className="my-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Payment Info */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              Rincian Pembayaran
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Metode Pembayaran</span>
                <span className="text-xs font-medium text-foreground">{order.paymentMethod || "COD"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Subtotal Produk</span>
                <span className="text-xs text-foreground">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ongkos Kirim</span>
                <span className="text-xs text-foreground">{formatPrice(order.shippingCost)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Diskon</span>
                  <span className="text-xs text-emerald-600">-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              {order.platformFee > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Biaya Layanan</span>
                  <span className="text-xs text-foreground">{formatPrice(order.platformFee)}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-sm font-bold text-emerald-600">{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cara Pembayaran — show for Midtrans pending/unpaid orders with payment reference */}
        {showPaymentRef && (
          <div className="px-4 pb-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/50 p-4">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Cara Pembayaran
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Selesaikan pembayaran menggunakan informasi berikut:
              </p>

              {/* Payment type label */}
              {paymentRef.payment_type && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Metode</span>
                  <span className="text-xs font-medium text-foreground">{getPaymentTypeLabel(paymentRef.payment_type)}</span>
                </div>
              )}

              {/* VA Number display */}
              {paymentRef.va_number && (
                <div className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    {paymentRef.bank ? `Virtual Account ${paymentRef.bank.toUpperCase()}` : 'Nomor Virtual Account'}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-mono font-bold text-foreground tracking-wider">{paymentRef.va_number}</p>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(paymentRef.va_number!); showToast('Nomor VA disalin!', 'success') }}
                      className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                </div>
              )}

              {/* Multiple VA numbers if available */}
              {paymentRef.va_numbers && paymentRef.va_numbers.length > 1 && paymentRef.va_numbers.map((va, idx) => (
                <div key={idx} className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Virtual Account {va.bank.toUpperCase()}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-mono font-bold text-foreground tracking-wider">{va.va_number}</p>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(va.va_number); showToast('Nomor VA disalin!', 'success') }}
                      className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Payment Code (cstore / Indomaret / Alfamart) */}
              {paymentRef.payment_code && (
                <div className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Kode Pembayaran</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-mono font-bold text-foreground tracking-wider">{paymentRef.payment_code}</p>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(paymentRef.payment_code!); showToast('Kode pembayaran disalin!', 'success') }}
                      className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                </div>
              )}

              {/* Mandiri Bill (bill_key + biller_code) */}
              {paymentRef.bill_key && (
                <div className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Mandiri Bill Payment</p>
                  <div className="space-y-1">
                    {paymentRef.biller_code && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Kode Perusahaan</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono font-bold text-foreground">{paymentRef.biller_code}</span>
                          <button
                            onClick={() => { navigator.clipboard?.writeText(paymentRef.biller_code!); showToast('Kode disalin!', 'success') }}
                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <Copy className="w-3 h-3 text-blue-600" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">No. Bill</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono font-bold text-foreground">{paymentRef.bill_key}</span>
                        <button
                          onClick={() => { navigator.clipboard?.writeText(paymentRef.bill_key!); showToast('No. Bill disalin!', 'success') }}
                          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* QR Code URL */}
              {paymentRef.qr_url && (
                <div className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50 text-center">
                  <QrCode className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-2">Scan QR code untuk membayar</p>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg"
                    onClick={() => window.open(paymentRef.qr_url, '_blank')}
                  >
                    Buka QR Code
                  </Button>
                </div>
              )}

              {/* E-Wallet deep link (from actions) */}
              {paymentRef.actions && paymentRef.actions.length > 0 && paymentRef.actions.map((action, idx) => (
                <div key={idx} className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs rounded-lg border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={() => window.open(action.url, '_blank')}
                  >
                    {action.name === 'deeplink-redirect' ? 'Buka Aplikasi E-Wallet' :
                     action.name === 'qr-link' ? 'Lihat QR Code' :
                     action.name}
                  </Button>
                </div>
              ))}

              {/* Payment instructions */}
              <div className="mt-3 p-2.5 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-[10px] text-muted-foreground space-y-0.5">
                  {paymentRef.va_number && (
                    <>
                      <span className="block">1. Login ke mobile/internet banking</span>
                      <span className="block">2. Pilih Transfer ke Virtual Account</span>
                      <span className="block">3. Masukkan nomor VA di atas</span>
                      <span className="block">4. Konfirmasi dan bayar {formatPrice(order.totalAmount)}</span>
                    </>
                  )}
                  {paymentRef.payment_code && (
                    <>
                      <span className="block">1. Kunjungi gerai Indomaret/Alfamart terdekat</span>
                      <span className="block">2. Tunjukkan kode pembayaran di atas</span>
                      <span className="block">3. Bayar sesuai nominal {formatPrice(order.totalAmount)}</span>
                    </>
                  )}
                  {paymentRef.bill_key && (
                    <>
                      <span className="block">1. Login ke Mandiri Online</span>
                      <span className="block">2. Pilih Pembayaran &rarr; Multi Payment</span>
                      <span className="block">3. Masukkan kode perusahaan dan no. bill</span>
                      <span className="block">4. Konfirmasi dan bayar {formatPrice(order.totalAmount)}</span>
                    </>
                  )}
                  {paymentRef.qr_url && (
                    <>
                      <span className="block">1. Buka aplikasi e-wallet Anda</span>
                      <span className="block">2. Scan QR code atau klik link di atas</span>
                      <span className="block">3. Konfirmasi pembayaran {formatPrice(order.totalAmount)}</span>
                    </>
                  )}
                </p>
              </div>

              {/* Bayar Sekarang button — re-open Snap popup */}
              <Button
                className="w-full mt-3 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                onClick={async () => {
                  const result = await payForOrder(order.id)
                  if (result?.token) {
                    try {
                      const { openSnapPayment } = await import('@/lib/midtrans')
                      const snapResult = await openSnapPayment(result.token)
                      if (snapResult.status === 'success') {
                        showToast('Pembayaran berhasil!', 'success')
                      } else if (snapResult.status === 'pending') {
                        showToast('Pembayaran tertunda. Selesaikan pembayaran Anda.', 'warning')
                        // Save updated payment reference
                        try {
                          const ref = (await import('@/components/ecommerce/checkout-screen')).extractPaymentReference?.(snapResult.result as Record<string, unknown>)
                          if (ref) {
                            await apiClient.rawPost('/api/payment/save-reference', {
                              orderId: order.id,
                              paymentReference: JSON.stringify(ref),
                            })
                          }
                        } catch { /* non-critical */ }
                      } else if (snapResult.status === 'closed') {
                        showToast('Pembayaran dibatalkan. Anda bisa membayar nanti.', 'warning')
                      } else {
                        showToast('Pembayaran gagal. Silakan coba lagi.', 'error')
                      }
                    } catch {
                      showToast('Gagal membuka halaman pembayaran.', 'error')
                    }
                  } else if (result?.redirectUrl) {
                    window.open(result.redirectUrl, '_blank')
                  }
                }}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Bayar Sekarang
              </Button>
            </div>
          </div>
        )}

        {/* Escrow Payment Info — show for escrow orders */}
        {isEscrowOrder && order.paymentStatus !== 'paid' && (
          <div className="px-4 pb-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 p-4">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-600" />
                Pembayaran Escrow
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Transfer ke rekening MartUp. Dana akan ditahan sampai Anda konfirmasi barang diterima.
              </p>

              {order.paymentStatus === 'unpaid' && (
                <>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">Rekening Tujuan:</p>
                  {escrowBankAccounts.length > 0 ? escrowBankAccounts.map((acc, idx) => (
                    <div key={idx} className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-amber-100 dark:border-amber-900/50">
                      <p className="text-sm font-bold text-foreground">{acc.bankName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-lg font-mono font-bold text-foreground">{acc.accountNumber}</p>
                        <button
                          onClick={() => { navigator.clipboard?.writeText(acc.accountNumber); showToast('Nomor rekening disalin!', 'success') }}
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">a.n. {acc.accountHolder}</p>
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground">Belum ada rekening MartUp. Hubungi admin.</p>
                  )}
                  <div className="mt-3 p-2 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Total Transfer: {formatPrice(order.totalAmount)}</p>
                  </div>
                  <Button
                    className="w-full mt-3 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
                    onClick={handleUploadPaymentProof}
                    disabled={isUploadingProof}
                  >
                    {isUploadingProof ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {isUploadingProof ? 'Mengupload...' : 'Upload Bukti Transfer'}
                  </Button>
                </>
              )}

              {order.paymentStatus === 'pending_verification' && (
                <div className="flex items-center gap-2 p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Menunggu Verifikasi</p>
                    <p className="text-[10px] text-muted-foreground">Bukti transfer Anda sedang diverifikasi admin MartUp.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Show proof image if already uploaded */}
        {isEscrowOrder && order.paymentProof && (
          <div className="px-4 pb-4">
            <div className="bg-card rounded-xl border border-border/50 p-4">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Bukti Pembayaran
              </h3>
              <img src={order.paymentProof} alt="Bukti transfer" className="w-full rounded-lg border border-border/30 max-h-48 object-cover" />
              {order.paymentBankName && (
                <p className="text-xs text-muted-foreground mt-2">Bank pengirim: {order.paymentBankName}</p>
              )}
            </div>
          </div>
        )}

        {/* Order Info */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Info Pesanan</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">No. Pesanan</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">{order.orderNumber}</span>
                  <button onClick={() => navigator.clipboard?.writeText(order.orderNumber)}>
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tanggal Pesan</span>
                <span className="text-xs text-foreground">{formatRelativeTime(order.createdAt)}</span>
              </div>
              {order.paidAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tanggal Bayar</span>
                  <span className="text-xs text-foreground">{formatRelativeTime(order.paidAt)}</span>
                </div>
              )}
              {order.shippedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{order.isServiceOrder ? 'Bukti Dikirim' : 'Tanggal Kirim'}</span>
                  <span className="text-xs text-foreground">{formatRelativeTime(order.shippedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="px-4 pb-4 space-y-3">
          {order.status === "pending" && (
            <>
              <PrimaryButton
                className="w-full h-12 rounded-xl text-sm font-semibold"
                onClick={async () => {
                  const result = await payForOrder(order.id)
                  if (result?.token) {
                    try {
                      const { openSnapPayment } = await import('@/lib/midtrans')
                      const snapResult = await openSnapPayment(result.token)
                      if (snapResult.status === 'success') {
                        showToast('Pembayaran berhasil!', 'success')
                      } else if (snapResult.status === 'pending') {
                        showToast('Pembayaran tertunda. Selesaikan pembayaran Anda.', 'warning')
                      } else if (snapResult.status === 'closed') {
                        showToast('Pembayaran dibatalkan. Anda bisa membayar nanti.', 'warning')
                      } else {
                        showToast('Pembayaran gagal. Silakan coba lagi.', 'error')
                      }
                    } catch {
                      showToast('Gagal membuka halaman pembayaran.', 'error')
                    }
                  } else if (result?.redirectUrl) {
                    window.open(result.redirectUrl, '_blank')
                  } else {
                    showToast("Pembayaran berhasil diproses!", "success")
                  }
                }}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Bayar Sekarang
              </PrimaryButton>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold"
                onClick={() => setShowCancelDialog(true)}
              >
                Batalkan Pesanan
              </Button>
            </>
          )}
          {/* Service order: shipped status — confirm service completion */}
          {order.isServiceOrder && order.status === "shipped" && (
            <PrimaryButton
              className="w-full h-12 rounded-xl text-sm font-semibold bg-purple-500 hover:bg-purple-600 active:bg-purple-700"
              disabled={isConfirmingService}
              onClick={handleConfirmService}
            >
              {isConfirmingService ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {isConfirmingService ? "Mengkonfirmasi..." : "Konfirmasi Tolong Mas Selesai"}
            </PrimaryButton>
          )}
          {/* Regular order: shipped status — confirm delivery */}
          {!order.isServiceOrder && order.status === "shipped" && (
            <PrimaryButton
              className="w-full h-12 rounded-xl text-sm font-semibold"
              onClick={() => {
                updateOrderStatus(order.id, "delivered")
                showToast("Pesanan dikonfirmasi diterima!", "success")
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Konfirmasi Diterima
            </PrimaryButton>
          )}
          {order.status === "delivered" && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl text-sm font-semibold"
                onClick={() => {
                  order.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId)
                    if (product) addItem(product)
                  })
                  showToast("Produk ditambahkan ke keranjang", "success")
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Beli Lagi
              </Button>
              <PrimaryButton
                className="flex-1 h-12 rounded-xl text-sm font-semibold"
                onClick={() => { setSelectedOrder(order.id); navigate("review") }}
              >
                <Star className="w-4 h-4 mr-2" />
                Beri Rating
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-[320px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Batalkan Pesanan?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Apakah kamu yakin ingin membatalkan pesanan {order.orderNumber}?</p>
          <DialogFooter className="mt-3 gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="rounded-xl h-10 flex-1">
              Tidak
            </Button>
            <Button
              onClick={() => {
                cancelOrder(order.id)
                showToast("Pesanan berhasil dibatalkan", "success")
                setShowCancelDialog(false)
              }}
              className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl h-10 flex-1"
            >
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== ORDER SCREEN ====================
export function OrderScreen() {
  const { orders, navigate, selectedOrderId, setSelectedOrder } = useAppStore()
  const [activeTab, setActiveTab] = useState("all")

  const filteredOrders = useMemo(() => {
    const statuses = tabStatusMap[activeTab]
    if (!statuses || statuses.length === 0) return orders
    return orders.filter((o) => statuses.includes(o.status))
  }, [orders, activeTab])

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return orders.find((o) => o.id === selectedOrderId) || null
  }, [orders, selectedOrderId])

  const tabCounts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    processing: orders.filter((o) => ["paid", "processing"].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  }), [orders])

  const tabsWithCounts = ORDER_TABS.map((tab) => ({
    ...tab,
    count: tabCounts[tab.key as keyof typeof tabCounts] || 0,
  }))

  const handleOrderTap = useCallback((orderId: string) => {
    setSelectedOrder(orderId)
  }, [setSelectedOrder])

  const handleBackFromDetail = useCallback(() => {
    setSelectedOrder(null)
  }, [setSelectedOrder])

  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} onBack={handleBackFromDetail} />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader title="Pesanan Saya" />

      <div className="flex-1 pb-20">
        {/* Tab Bar */}
        <div className="sticky top-14 z-30 bg-background">
          <TabBar
            tabs={tabsWithCounts}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Order List */}
        <div className="p-4 space-y-3">
          <AnimatePresence mode="wait">
            {filteredOrders.length > 0 ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {filteredOrders.map((order, idx) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <OrderCard order={order} onTap={() => handleOrderTap(order.id)} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`empty-${activeTab}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <EmptyState
                  icon={<Package className="w-10 h-10 text-muted-foreground" />}
                  title="Belum Ada Pesanan"
                  subtitle="Pesanan kamu akan muncul di sini"
                  actionLabel="Mulai Belanja"
                  onAction={() => navigate("home")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
