"use client"

import { motion } from "framer-motion"
import { useAppStore, useCartStore } from "@/lib/store"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, StatusBadge, PrimaryButton } from "../shared"
import type { Order } from "@/lib/types"
import { useState, useCallback, useEffect } from "react"
import {
  Package, CreditCard, Truck, CheckCircle2, Star,
  MapPin, Clock, ShoppingBag, RotateCcw, Copy,
  MessageCircle, Store, Receipt, Banknote
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { apiClient } from "@/lib/api-client"
import { isCodOrder, getPaymentMethodLabel, parsePaymentReference, isMidtransPayment as isMidtransPaymentUtil, extractPaymentReference } from '@/lib/payment-utils'
import type { PaymentRefData, ServiceProofData } from './types'
import { PaymentReferenceDisplay } from './PaymentReferenceDisplay'
import { ServiceProofSection } from './ServiceProofSection'

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

// ==================== ORDER DETAIL ====================
export function OrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  const { showToast, updateOrderStatus, setSelectedOrder, navigate, setSelectedChatRoom, chatRooms, payForOrder, cancelOrder, products, fetchOrders } = useAppStore()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isConfirmingService, setIsConfirmingService] = useState(false)
  const [serviceProofData, setServiceProofData] = useState<ServiceProofData | null>(null)
  const [isLoadingServiceProof, setIsLoadingServiceProof] = useState(false)
  const { addItem } = useCartStore()
  const activeStep = getActiveStep(order)
  const isMidtransPayment = isMidtransPaymentUtil(order)
  const paymentRef = parsePaymentReference(order.paymentReference) as PaymentRefData | null
  const showPaymentRef = isMidtransPayment &&
    (order.paymentStatus === 'unpaid' || order.paymentStatus === 'pending') &&
    paymentRef &&
    !isCodOrder(order)

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
  const autoConfirmAt = serviceProofData?.autoConfirmAt ?? order.autoConfirmAt ?? null

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

  // Payment reference "Bayar Sekarang" handler
  const handlePayNow = useCallback(async () => {
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
            const ref = extractPaymentReference(snapResult.result as Record<string, unknown>)
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
    } else {
      showToast(result?.error || 'Gagal memproses pembayaran. Silakan coba lagi nanti.', 'error')
    }
  }, [order.id, payForOrder, showToast])

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
          <ServiceProofSection
            order={order}
            serviceProofData={serviceProofData}
            isLoadingServiceProof={isLoadingServiceProof}
            proofImages={proofImages}
            autoConfirmAt={autoConfirmAt}
          />
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
                <span className="text-xs font-medium text-foreground">{getPaymentMethodLabel(order.paymentMethod)}</span>
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
        {showPaymentRef && paymentRef && (
          <PaymentReferenceDisplay
            order={order}
            paymentRef={paymentRef}
            onPayNow={handlePayNow}
            showToast={showToast}
          />
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
          {/* COD: Show info banner instead of payment button */}
          {order.status === "pending" && isCodOrder(order) && (
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-800/50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-orange-800 dark:text-orange-300">
                    Bayar di Tempat (COD)
                  </h4>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Pembayaran dilakukan saat barang diterima. Pesanan Anda sedang menunggu diproses penjual.
                  </p>
                </div>
              </div>
            </div>
          )}
          {order.status === "pending" && !isCodOrder(order) && (
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
                    // No token and no redirect — payment method not supported or API error
                    showToast(result?.error || "Gagal memproses pembayaran. Silakan coba lagi nanti.", "error")
                  }
                }}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Bayar Sekarang
              </PrimaryButton>
            </>
          )}
          {/* Pending orders: cancel button */}
          {order.status === "pending" && (
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold"
              onClick={() => setShowCancelDialog(true)}
            >
              Batalkan Pesanan
            </Button>
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
              onClick={async () => {
                await updateOrderStatus(order.id, "delivered")
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
    </div>
  )
}
