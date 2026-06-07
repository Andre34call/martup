"use client"

import { motion } from "framer-motion"
import { useAppStore, useCartStore } from "@/lib/store"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatPrice } from "@/lib/utils"
import { StatusBadge, PrimaryButton } from "../shared"
import type { Order } from "@/lib/types"
import { useState, useCallback } from "react"
import {
  Package, CreditCard, Truck, CheckCircle2, Star,
  Store, Banknote, Timer
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { isCodOrder } from '@/lib/payment-utils'
import { ServiceProofCountdown } from './ServiceProofSection'

// ==================== ACTION BUTTON HELPERS ====================
function getActionButton(order: Order): { label: string; variant: "default" | "outline"; icon?: React.ReactNode } | null {
  switch (order.status) {
    case "pending":
      // COD orders don't need online payment — show different action
      if (isCodOrder(order)) {
        return null // No primary action for COD pending — info banner is shown instead
      }
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

// ==================== ORDER CARD ====================
export function OrderCard({ order, onTap }: { order: Order; onTap: () => void }) {
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
          {/* COD pending: show info badge instead of Bayar button */}
          {order.status === "pending" && isCodOrder(order) && (
            <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1">
              <Banknote className="w-3 h-3" />
              Bayar di Tempat
            </span>
          )}
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
              onClick={async (e) => {
                e.stopPropagation()
                if (order.status === "shipped") {
                  await updateOrderStatus(order.id, "delivered")
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

                  // COD: no payment needed — show info
                  if (isCodOrder(order)) {
                    showToast("Pembayaran dilakukan saat barang diterima (COD). Pesanan sedang menunggu diproses penjual.", "info")
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
              onClick={async () => {
                await cancelOrder(order.id)
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
