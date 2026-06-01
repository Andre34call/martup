"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore, useCartStore } from "@/lib/store"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, EmptyState, StatusBadge, TabBar } from "./shared"
import type { Order, OrderStatus } from "@/lib/types"
import { useState, useMemo, useCallback } from "react"
import {
  ArrowLeft, Package, CreditCard, Truck, CheckCircle2, Star,
  ChevronRight, MapPin, Clock, ShoppingBag, RotateCcw, Copy,
  Phone, MessageCircle, Store, Wallet, Receipt
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { apiClient } from "@/lib/api-client"

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
      return { label: "Terima" }
    default:
      return null
  }
}

// ==================== ORDER CARD ====================
function OrderCard({ order, onTap }: { order: Order; onTap: () => void }) {
  const { showToast, updateOrderStatus, setSelectedOrder, navigate, payForOrder, cancelOrder, products } = useAppStore()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const { addItem } = useCartStore()
  const primaryBtn = getActionButton(order)
  const secondaryBtn = getSecondaryButton(order)

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
                  // BUG 19 FIX: Sync status update to server via API
                  updateOrderStatus(order.id, "delivered")
                  apiClient.rawPut(`/api/orders/${order.id}/status`, { status: 'delivered' }).catch(() => {})
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
            <Button
              size="sm"
              variant={primaryBtn.variant}
              className="h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white"
              onClick={async (e) => {
                e.stopPropagation()
                if (order.status === "pending") {
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
                  } else {
                    // Wallet payment was processed
                    showToast("Pembayaran berhasil diproses!", "success")
                  }
                } else if (order.status === "shipped") {
                  onTap()
                } else if (order.status === "delivered") {
                  setSelectedOrder(order.id)
                  navigate("review")
                }
              }}
            >
              {primaryBtn.icon}
              <span className="ml-1">{primaryBtn.label}</span>
            </Button>
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
                // BUG 19 FIX: Sync cancel to server via the cancel API endpoint
                cancelOrder(order.id)
                apiClient.rawPost(`/api/orders/${order.id}/cancel`, { reason: 'Dibatalkan oleh pembeli' }).catch(() => {})
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
  const { showToast, updateOrderStatus, setSelectedOrder, navigate, setSelectedChatRoom, chatRooms, payForOrder, cancelOrder, products } = useAppStore()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const { addItem } = useCartStore()
  const activeStep = getActiveStep(order)

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
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              {order.status === "shipped" ? (
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
              </p>
              {order.shipping?.estimatedDays && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estimasi {order.shipping.estimatedDays} hari
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Shipping Tracking Timeline */}
        {order.status !== "cancelled" && order.status !== "refunded" && (
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
                {TRACKING_STEPS.map((step, idx) => {
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
                        {idx < TRACKING_STEPS.length - 1 && (
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

        {/* Shipping Address */}
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
                  <span className="text-xs text-muted-foreground">Tanggal Kirim</span>
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
              <Button
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold"
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
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold"
                onClick={() => setShowCancelDialog(true)}
              >
                Batalkan Pesanan
              </Button>
            </>
          )}
          {order.status === "shipped" && (
            <Button
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold"
              // BUG 19 FIX: Sync status update to server via API
              onClick={() => {
                updateOrderStatus(order.id, "delivered")
                apiClient.rawPut(`/api/orders/${order.id}/status`, { status: 'delivered' }).catch(() => {})
                showToast("Pesanan dikonfirmasi diterima!", "success")
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Konfirmasi Diterima
            </Button>
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
              <Button
                className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold"
                onClick={() => { setSelectedOrder(order.id); navigate("review") }}
              >
                <Star className="w-4 h-4 mr-2" />
                Beri Rating
              </Button>
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
                // BUG 19 FIX: Sync cancel to server via the cancel API endpoint
                cancelOrder(order.id)
                apiClient.rawPost(`/api/orders/${order.id}/cancel`, { reason: 'Dibatalkan oleh pembeli' }).catch(() => {})
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
