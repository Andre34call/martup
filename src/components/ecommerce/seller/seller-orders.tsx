"use client"

import { motion } from "framer-motion"
import { Package, Truck, Printer, MessageCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAppStore } from "@/lib/store"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { formatPrice } from "@/lib/utils"
import { stagger } from '@/lib/animations'
import { PageHeader, StatusBadge, EmptyState } from "../shared"
import { useState } from "react"

export function SellerOrders() {
  const { navigate, updateOrderStatus, showToast, orders, updateOrderTracking, seller, reviews } = useAppStore()
  const [activeTab, setActiveTab] = useState("all")
  const [showTrackingDialog, setShowTrackingDialog] = useState(false)
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null)
  const [trackingNumber, setTrackingNumber] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [showReplyDialog, setShowReplyDialog] = useState(false)
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  // Derive sellerId from store seller
  const sellerId = seller?.id || ''

  // Map real store orders for current seller to display format
  const sellerOrders = orders
    .filter(o => o.sellerId === sellerId)
    .map(o => {
      // Find reviews for this order's products that don't have a seller reply yet
      const orderProductIds = o.items.map(i => i.productId)
      const unrepliedReviews = reviews.filter(r =>
        orderProductIds.includes(r.productId) && !r.sellerReply
      )
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        buyerName: o.address?.recipient ?? '-',
        items: o.items.map(i => `${i.productName} x${i.quantity}`).join(', '),
        itemIds: o.items.map(i => i.id),
        amount: o.totalAmount,
        status: o.status,
        date: new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        hasUnrepliedReview: unrepliedReviews.length > 0,
        firstUnrepliedReviewId: unrepliedReviews[0]?.id || null,
      }
    })

  const tabs = [
    { key: "all", label: "Semua", count: sellerOrders.length },
    { key: "processing", label: "Perlu Diproses", count: sellerOrders.filter(o => o.status === "paid" || o.status === "processing").length },
    { key: "shipped", label: "Dikirim", count: sellerOrders.filter(o => o.status === "shipped").length },
    { key: "delivered", label: "Selesai", count: sellerOrders.filter(o => o.status === "delivered").length },
  ]

  const filtered = activeTab === "all"
    ? sellerOrders
    : activeTab === "processing"
      ? sellerOrders.filter(o => o.status === "paid" || o.status === "processing" || o.status === "pending")
      : activeTab === "shipped"
        ? sellerOrders.filter(o => o.status === "shipped")
        : sellerOrders.filter(o => o.status === "delivered")

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Pesanan" />

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
                activeTab === tab.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Order Cards */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Pesanan"
              subtitle="Pesanan akan muncul di sini"
            />
          ) : (
            filtered.map((order, i) => (
              <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-muted-foreground">{order.orderNumber}</p>
                      <StatusBadge status={order.status} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">{order.date}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{order.buyerName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{order.items}</p>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-foreground">{formatPrice(order.amount)}</p>
                    <div className="flex gap-2">
                      {order.status === "paid" && (
                        <Button size="sm" className="h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white" onClick={async () => {
                          try {
                            const res = await apiClient.rawPut(`/api/orders/${order.id}/status`, { status: 'processing' })
                            const data = await res.json()
                            if (!res.ok || !data.success) {
                              throw new Error(data.error || 'Gagal mengubah status')
                            }
                            updateOrderStatus(order.id, 'processing')
                            showToast("Pesanan sedang diproses", "success")
                          } catch (err: unknown) {
                            const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Gagal mengubah status pesanan'
                            showToast(message, "error")
                          }
                        }}>
                          <Package className="w-3 h-3 mr-1" /> Proses
                        </Button>
                      )}
                      {order.status === "processing" && (
                        <Button size="sm" className="h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white" onClick={() => {
                          setTrackingOrderId(order.id)
                          setTrackingNumber("")
                          setShowTrackingDialog(true)
                        }}>
                          <Truck className="w-3 h-3 mr-1" /> Kirim
                        </Button>
                      )}
                      {(order.status === "paid" || order.status === "processing") && (
                        <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => {
                          setCancelOrderId(order.id)
                          setCancelReason("")
                          setShowCancelDialog(true)
                        }}>
                          <X className="w-3 h-3 mr-1" /> Batalkan
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => showToast("Invoice dicetak", "info")}>
                        <Printer className="w-3 h-3 mr-1" /> Invoice
                      </Button>
                      {order.status === "delivered" && order.hasUnrepliedReview && order.firstUnrepliedReviewId && (
                        <Button size="sm" className="h-8 text-xs rounded-lg bg-amber-500 hover:bg-amber-600 text-white" onClick={() => {
                          setReplyReviewId(order.firstUnrepliedReviewId!)
                          setReplyContent("")
                          setShowReplyDialog(true)
                        }}>
                          <MessageCircle className="w-3 h-3 mr-1" /> Balas Ulasan
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Tracking Number Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Masukkan Nomor Resi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <label className="text-xs font-medium text-foreground">No. Resi Pengiriman <span className="text-red-500">*</span></label>
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Contoh: JNE1234567890"
              className="rounded-xl h-10"
              autoFocus
            />
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!trackingNumber.trim()) {
                  showToast("Masukkan nomor resi", "error")
                  return
                }
                if (trackingOrderId) {
                  try {
                    const res = await apiClient.rawPut(`/api/orders/${trackingOrderId}/status`, { status: 'shipped', trackingNumber: trackingNumber.trim() })
                    const data = await res.json()
                    if (!res.ok || !data.success) {
                      throw new Error(data.error || 'Gagal mengubah status')
                    }
                    updateOrderTracking(trackingOrderId, trackingNumber.trim())
                    updateOrderStatus(trackingOrderId, 'shipped')
                    showToast("Pesanan sedang dikirim", "success")
                  } catch (err: unknown) {
                    const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Gagal mengubah status pesanan'
                    showToast(message, "error")
                    return // Don't close dialog on error
                  }
                }
                setShowTrackingDialog(false)
                setTrackingOrderId(null)
                setTrackingNumber("")
              }}
              className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10 flex-1"
            >
              Kirim Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Batalkan Pesanan</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <label className="text-xs font-medium text-foreground">Alasan Pembatalan <span className="text-red-500">*</span></label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Contoh: Stok habis, tidak bisa memenuhi pesanan..."
              className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              autoFocus
            />
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!cancelReason.trim()) {
                  showToast("Masukkan alasan pembatalan", "error")
                  return
                }
                if (cancelOrderId) {
                  try {
                    const res = await apiClient.rawPut(`/api/orders/${cancelOrderId}/status`, { status: 'cancelled', cancelReason: cancelReason.trim() })
                    const data = await res.json()
                    if (!res.ok || !data.success) {
                      throw new Error(data.error || 'Gagal membatalkan pesanan')
                    }
                    updateOrderStatus(cancelOrderId, 'cancelled')
                    showToast("Pesanan dibatalkan", "info")
                  } catch (err: unknown) {
                    const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Gagal membatalkan pesanan'
                    showToast(message, "error")
                    return
                  }
                }
                setShowCancelDialog(false)
                setCancelOrderId(null)
                setCancelReason("")
              }}
              className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl h-10 flex-1"
            >
              Batalkan Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply to Review Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Balas Ulasan</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <label className="text-xs font-medium text-foreground">Balasan Anda <span className="text-red-500">*</span></label>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Tulis balasan untuk ulasan pembeli..."
              maxLength={500}
              className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground text-right">{replyContent.length}/500</p>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowReplyDialog(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              disabled={isSubmittingReply || !replyContent.trim()}
              onClick={async () => {
                if (!replyContent.trim() || !replyReviewId) return
                setIsSubmittingReply(true)
                try {
                  const res = await apiClient.rawPut('/api/reviews/reply', { reviewId: replyReviewId, reply: replyContent.trim() })
                  const data = await res.json()
                  if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Gagal membalas ulasan')
                  }
                  showToast("Balasan berhasil dikirim!", "success")
                  setShowReplyDialog(false)
                  setReplyReviewId(null)
                  setReplyContent("")
                } catch (err: unknown) {
                  const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Gagal membalas ulasan'
                  showToast(message, "error")
                } finally {
                  setIsSubmittingReply(false)
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-10 flex-1"
            >
              {isSubmittingReply ? 'Mengirim...' : 'Kirim Balasan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
