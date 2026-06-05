"use client"

import { motion } from "framer-motion"
import { Package, Truck, Printer, MessageCircle, X, Upload, ImagePlus, CheckCircle, Clock, Eye } from "lucide-react"
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
import { useState, useEffect } from "react"

// ==================== SERVICE PROOF DATA TYPE ====================
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

// ==================== COUNTDOWN HELPER ====================
function computeCountdown(targetDate: string | null | undefined): string {
  if (!targetDate) return ""
  const target = new Date(targetDate).getTime()
  const now = Date.now()
  const diff = target - now
  if (diff <= 0) return "Otomatis dikonfirmasi"
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days} hari ${hours} jam lagi`
  if (hours > 0) return `${hours} jam ${minutes} menit lagi`
  return `${minutes} menit lagi`
}

function useCountdown(targetDate: string | null | undefined) {
  const [remaining, setRemaining] = useState(() => computeCountdown(targetDate))

  useEffect(() => {
    // Re-compute when targetDate changes — initial value is set by useState initializer
    const val = computeCountdown(targetDate)
    if (val !== remaining) {
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => setRemaining(val))
    }
    const interval = setInterval(() => {
      setRemaining(computeCountdown(targetDate))
    }, 60000)
    return () => clearInterval(interval)
  }, [targetDate, remaining])

  return remaining
}

export function SellerOrders() {
  const { navigate, updateOrderStatus, showToast, orders, updateOrderTracking, seller, reviews, fetchOrders } = useAppStore()
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

  // Service proof upload dialog state
  const [showServiceProofDialog, setShowServiceProofDialog] = useState(false)
  const [serviceProofOrderId, setServiceProofOrderId] = useState<string | null>(null)
  const [serviceProofImages, setServiceProofImages] = useState<string[]>([])
  const [serviceProofNewUrl, setServiceProofNewUrl] = useState("")
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)

  // Service proof view dialog state
  const [showServiceProofViewDialog, setShowServiceProofViewDialog] = useState(false)
  const [serviceProofViewData, setServiceProofViewData] = useState<ServiceProofData | null>(null)
  const [isLoadingProof, setIsLoadingProof] = useState(false)

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
        isServiceOrder: o.isServiceOrder || false,
        serviceProofImages: o.serviceProofImages,
        autoConfirmAt: o.autoConfirmAt,
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

  // Open service proof upload dialog
  const openServiceProofDialog = (orderId: string) => {
    setServiceProofOrderId(orderId)
    setServiceProofImages([])
    setServiceProofNewUrl("")
    setShowServiceProofDialog(true)
  }

  // Add image URL to service proof list
  const addServiceProofImage = () => {
    const url = serviceProofNewUrl.trim()
    if (!url) return
    if (serviceProofImages.length >= 5) {
      showToast("Maksimal 5 gambar", "error")
      return
    }
    try {
      new URL(url)
    } catch {
      showToast("URL tidak valid", "error")
      return
    }
    setServiceProofImages([...serviceProofImages, url])
    setServiceProofNewUrl("")
  }

  // Remove image from service proof list
  const removeServiceProofImage = (index: number) => {
    setServiceProofImages(serviceProofImages.filter((_, i) => i !== index))
  }

  // Upload image file and add to list
  const handleUploadImage = () => {
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
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'reviews')
        formData.append('folder', 'service-proof')
        const uploadData = await apiClient.upload<{ success: boolean; data?: { url: string }; error?: string }>('/api/upload', formData)
        if (!uploadData.success || !uploadData.data?.url) {
          showToast(uploadData.error || 'Gagal upload gambar', 'error')
          return
        }
        if (serviceProofImages.length >= 5) {
          showToast("Maksimal 5 gambar", "error")
          return
        }
        setServiceProofImages(prev => [...prev, uploadData.data!.url])
        showToast("Gambar berhasil diupload", "success")
      } catch {
        showToast('Gagal upload gambar', 'error')
      }
    }
    input.click()
  }

  // Submit service proof
  const submitServiceProof = async () => {
    if (!serviceProofOrderId || serviceProofImages.length === 0) {
      showToast("Tambahkan minimal 1 gambar bukti", "error")
      return
    }
    setIsSubmittingProof(true)
    try {
      const res = await apiClient.rawPost(`/api/orders/${serviceProofOrderId}/service-proof`, {
        proofImages: serviceProofImages,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengirim bukti penyelesaian')
      }
      // Refresh orders to get updated status
      const userId = useAppStore.getState().currentUser?.id
      if (userId) await fetchOrders(userId)
      showToast("Bukti penyelesaian Tolong Mas berhasil dikirim!", "success")
      setShowServiceProofDialog(false)
      setServiceProofOrderId(null)
      setServiceProofImages([])
    } catch (err: unknown) {
      const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Gagal mengirim bukti penyelesaian'
      showToast(message, "error")
    } finally {
      setIsSubmittingProof(false)
    }
  }

  // Fetch and show service proof details
  const openServiceProofView = async (orderId: string) => {
    setIsLoadingProof(true)
    setShowServiceProofViewDialog(true)
    try {
      const data = await apiClient.get<{ success: boolean; data: ServiceProofData }>(`/api/orders/${orderId}/service-proof`)
      if (data.success && data.data) {
        setServiceProofViewData(data.data)
      } else {
        showToast("Gagal memuat bukti penyelesaian", "error")
      }
    } catch (err: unknown) {
      const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Gagal memuat bukti penyelesaian'
      showToast(message, "error")
    } finally {
      setIsLoadingProof(false)
    }
  }

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
                      {order.isServiceOrder && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          Tolong Mas
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{order.date}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{order.buyerName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{order.items}</p>

                  {/* Service order: waiting for buyer confirmation */}
                  {order.isServiceOrder && order.status === "shipped" && order.serviceProofImages && order.serviceProofImages.length > 0 && (
                    <div className="mt-2 p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800/50">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Menunggu konfirmasi pembeli</span>
                      </div>
                      <div className="flex gap-1.5 mb-2">
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] rounded-md border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                        onClick={() => openServiceProofView(order.id)}
                      >
                        <Eye className="w-3 h-3 mr-1" /> Lihat Detail
                      </Button>
                    </div>
                  )}

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
                      {/* Service order processing: show upload proof button */}
                      {order.isServiceOrder && order.status === "processing" && (
                        <Button size="sm" className="h-8 text-xs rounded-lg bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white" onClick={() => openServiceProofDialog(order.id)}>
                          <Upload className="w-3 h-3 mr-1" /> Upload Bukti Tolong Mas
                        </Button>
                      )}
                      {/* Regular order processing: show ship button */}
                      {!order.isServiceOrder && order.status === "processing" && (
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

      {/* Service Proof Upload Dialog */}
      <Dialog open={showServiceProofDialog} onOpenChange={setShowServiceProofDialog}>
        <DialogContent className="max-w-[380px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-500" />
              Upload Bukti Penyelesaian Tolong Mas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              Upload bukti bahwa layanan telah diselesaikan. Pembeli akan mengonfirmasi dalam 3 hari atau otomatis dikonfirmasi.
            </p>

            {/* Existing images */}
            {serviceProofImages.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Gambar Bukti ({serviceProofImages.length}/5)</label>
                <div className="grid grid-cols-3 gap-2">
                  {serviceProofImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <div className="w-full aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={url} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={() => removeServiceProofImage(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload file button */}
            {serviceProofImages.length < 5 && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs rounded-lg border-purple-300 dark:border-purple-700 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                  onClick={handleUploadImage}
                >
                  <ImagePlus className="w-3.5 h-3.5 mr-1" /> Upload File
                </Button>
              </div>
            )}

            {/* URL input */}
            {serviceProofImages.length < 5 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Atau masukkan URL gambar</label>
                <div className="flex gap-2">
                  <Input
                    value={serviceProofNewUrl}
                    onChange={(e) => setServiceProofNewUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl h-9 text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addServiceProofImage()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs rounded-xl px-3"
                    onClick={addServiceProofImage}
                    disabled={!serviceProofNewUrl.trim()}
                  >
                    Tambah
                  </Button>
                </div>
              </div>
            )}

            {serviceProofImages.length === 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Minimal 1 gambar, maksimal 5 gambar
              </p>
            )}
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowServiceProofDialog(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={submitServiceProof}
              disabled={isSubmittingProof || serviceProofImages.length === 0}
              className="bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white rounded-xl h-10 flex-1"
            >
              {isSubmittingProof ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" /> Mengirim...</>
              ) : (
                <><Upload className="w-3.5 h-3.5 mr-1.5" /> Kirim Bukti</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Proof View Dialog (for shipped service orders) */}
      <Dialog open={showServiceProofViewDialog} onOpenChange={setShowServiceProofViewDialog}>
        <DialogContent className="max-w-[380px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-purple-500" />
              Bukti Penyelesaian Tolong Mas
            </DialogTitle>
          </DialogHeader>
          {isLoadingProof ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : serviceProofViewData ? (
            <div className="space-y-3 mt-2">
              {/* Status */}
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800/50">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                    {serviceProofViewData.buyerConfirmedAt
                      ? "Sudah dikonfirmasi pembeli"
                      : "Menunggu konfirmasi pembeli"}
                  </span>
                </div>
              </div>

              {/* Proof images */}
              {serviceProofViewData.proofImages.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Bukti Penyelesaian</label>
                  <div className="grid grid-cols-2 gap-2">
                    {serviceProofViewData.proofImages.map((img, idx) => (
                      <div key={idx} className="w-full aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={img} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline info */}
              <div className="space-y-1.5">
                {serviceProofViewData.sellerCompletedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Bukti dikirim</span>
                    <span className="text-xs text-foreground">
                      {new Date(serviceProofViewData.sellerCompletedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {serviceProofViewData.autoConfirmAt && !serviceProofViewData.buyerConfirmedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Auto konfirmasi</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <ServiceProofCountdown autoConfirmAt={serviceProofViewData.autoConfirmAt} />
                    </span>
                  </div>
                )}
                {serviceProofViewData.buyerConfirmedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Dikonfirmasi pembeli</span>
                    <span className="text-xs text-emerald-600 font-medium">
                      {new Date(serviceProofViewData.buyerConfirmedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Gagal memuat data</p>
          )}
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowServiceProofViewDialog(false)}
              className="rounded-xl h-10 w-full"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

// ==================== SERVICE PROOF COUNTDOWN COMPONENT ====================
function ServiceProofCountdown({ autoConfirmAt }: { autoConfirmAt: string }) {
  const remaining = useCountdown(autoConfirmAt)
  return <>{remaining}</>
}
