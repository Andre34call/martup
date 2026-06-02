"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { PageHeader, EmptyState } from "../shared"
import { useState, useRef, useCallback, useEffect } from "react"
import { RotateCcw, X, ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { stagger } from '@/lib/animations'
import { apiClient, ApiClientError } from '@/lib/api-client'

// ==================== TYPE ALIASES ====================
// Defined at top level to avoid TSX generic parsing ambiguity

type ComplaintItem = {
  id: string
  orderId: string
  userId: string
  type: string
  reason: string
  description: string | null
  images: string | null
  status: string
  resolution: string | null
  refundAmount: number | null
  createdAt: string
  updatedAt: string
  order: {
    orderNumber: string
    totalAmount: number
    items: Array<{
      productName: string
      image: string | null
    }>
  }
}

type ComplaintsResponse = { success: boolean; data: ComplaintItem[]; error?: string }
type ComplaintCreateResponse = { success: boolean; data: ComplaintItem; error?: string }
type UploadResponse = { success: boolean; data?: { url: string }; error?: string }

// ==================== STATUS MAPPING ====================

const STATUS_LABELS: Record<string, string> = {
  open: "Diajukan",
  processing: "Diproses",
  resolved: "Selesai",
  rejected: "Ditolak",
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30",
}

const COMPLAINT_TYPES: { value: string; label: string }[] = [
  { value: "refund", label: "Refund" },
  { value: "return", label: "Retur" },
  { value: "complain", label: "Komplain" },
]

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "Barang rusak", label: "Barang rusak" },
  { value: "Tidak sesuai deskripsi", label: "Tidak sesuai deskripsi" },
  { value: "Barang salah", label: "Barang salah" },
  { value: "Barang tidak diterima", label: "Barang tidak diterima" },
  { value: "Lainnya", label: "Lainnya" },
]

export function RefundScreen() {
  const { showToast, goBack, orders, currentUser } = useAppStore()
  const [activeTab, setActiveTab] = useState("active")
  const [showForm, setShowForm] = useState(false)
  const [evidenceImages, setEvidenceImages] = useState<{ id: string; url: string; file: File }[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const evidenceInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [selectedType, setSelectedType] = useState("refund")
  const [selectedReason, setSelectedReason] = useState("")
  const [description, setDescription] = useState("")

  // Data state
  const [activeRefunds, setActiveRefunds] = useState<ComplaintItem[]>([])
  const [refundHistory, setRefundHistory] = useState<ComplaintItem[]>([])
  const [isLoadingActive, setIsLoadingActive] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ==================== FETCH COMPLAINTS ====================

  const fetchActiveRefunds = useCallback(async () => {
    if (!currentUser) return
    setIsLoadingActive(true)
    try {
      const data = await apiClient.get<ComplaintsResponse>('/api/complaints', {
        status: 'open,processing',
      })
      if (data.success && Array.isArray(data.data)) {
        setActiveRefunds(data.data)
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        showToast(err.message, 'error')
      } else {
        showToast('Gagal memuat pengajuan aktif', 'error')
      }
    } finally {
      setIsLoadingActive(false)
    }
  }, [currentUser, showToast])

  const fetchRefundHistory = useCallback(async () => {
    if (!currentUser) return
    setIsLoadingHistory(true)
    try {
      const data = await apiClient.get<ComplaintsResponse>('/api/complaints', {
        status: 'resolved,rejected',
      })
      if (data.success && Array.isArray(data.data)) {
        setRefundHistory(data.data)
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        showToast(err.message, 'error')
      } else {
        showToast('Gagal memuat riwayat pengembalian', 'error')
      }
    } finally {
      setIsLoadingHistory(false)
    }
  }, [currentUser, showToast])

  // Fetch data on mount and when tab changes
  useEffect(() => {
    fetchActiveRefunds()
    fetchRefundHistory()
  }, [fetchActiveRefunds, fetchRefundHistory])

  // ==================== ELIGIBLE ORDERS ====================
  // Only show orders that are delivered/paid and don't already have a complaint

  const complaintOrderIds = new Set([
    ...activeRefunds.map(c => c.orderId),
    ...refundHistory.map(c => c.orderId),
  ])

  const eligibleOrders = orders.filter(
    o => (o.status === 'delivered' || o.status === 'paid') && !complaintOrderIds.has(o.id)
  )

  // ==================== SUBMIT COMPLAINT ====================

  const handleSubmitRefund = async () => {
    if (!selectedOrderId) {
      showToast('Pilih pesanan terlebih dahulu', 'error')
      return
    }
    if (!selectedReason) {
      showToast('Pilih alasan pengembalian', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      // Upload evidence images first
      const uploadedImageUrls: string[] = []
      for (const img of evidenceImages) {
        try {
          const formData = new FormData()
          formData.append('file', img.file)
          formData.append('bucket', 'products')
          formData.append('folder', 'images')
          const uploadData = await apiClient.upload<UploadResponse>('/api/upload', formData)
          if (uploadData.success && uploadData.data?.url) {
            uploadedImageUrls.push(uploadData.data.url)
          }
        } catch {
          showToast(`Gagal upload foto bukti`, 'error')
        }
      }

      // Create complaint
      const data = await apiClient.post<ComplaintCreateResponse>('/api/complaints', {
        orderId: selectedOrderId,
        type: selectedType,
        reason: selectedReason,
        description: description.trim() || undefined,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
      })

      if (data.success) {
        // Clean up object URLs
        evidenceImages.forEach(img => URL.revokeObjectURL(img.url))
        setEvidenceImages([])
        setSelectedOrderId("")
        setSelectedType("refund")
        setSelectedReason("")
        setDescription("")
        setShowForm(false)
        showToast("Pengajuan refund berhasil dikirim!", "success")

        // Refresh data
        fetchActiveRefunds()
        fetchRefundHistory()
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        showToast(err.message, 'error')
      } else {
        showToast('Gagal mengirim pengajuan', 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==================== EVIDENCE IMAGE HANDLERS ====================

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 4 - evidenceImages.length
    const filesToAdd = files.slice(0, remaining)
    if (files.length > remaining) {
      showToast(`Maksimal 4 foto bukti`, "error")
    }
    const newImages: { id: string; url: string; file: File }[] = []
    for (const file of filesToAdd) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`Foto "${file.name}" melebihi 5MB`, "error")
        continue
      }
      if (!file.type.startsWith("image/")) {
        showToast(`"${file.name}" bukan file gambar`, "error")
        continue
      }
      newImages.push({
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        file,
      })
    }
    setEvidenceImages(prev => [...prev, ...newImages])
    e.target.value = ""
  }

  const handleRemoveEvidence = (imageId: string) => {
    setEvidenceImages(prev => {
      const img = prev.find(i => i.id === imageId)
      if (img) URL.revokeObjectURL(img.url)
      return prev.filter(i => i.id !== imageId)
    })
  }

  // ==================== HELPERS ====================

  function formatDate(dateStr: string): string {
    try {
      const d = typeof dateStr === 'string' ? new Date(dateStr) : new Date()
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  function getComplaintProduct(complaint: ComplaintItem): string {
    if (complaint.order?.items?.length) {
      return complaint.order.items[0].productName
    }
    return 'Produk'
  }

  function parseImages(images: string | null): string[] {
    if (!images) return []
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function getTimeline(complaint: ComplaintItem): string[] {
    const steps: string[] = ['Pengajuan dibuat']
    if (complaint.status === 'processing' || complaint.status === 'resolved') {
      steps.push('Sedang diproses')
    }
    if (complaint.status === 'resolved') {
      steps.push(complaint.resolution || 'Selesai')
    }
    if (complaint.status === 'rejected') {
      steps.push(complaint.resolution || 'Ditolak')
    }
    return steps
  }

  // ==================== RENDER ====================

  return (
    <div className="pb-24">
      <PageHeader title="Pengembalian" />

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: "active", label: "Aktif" },
            { key: "history", label: "Riwayat" },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors border ${
                activeTab === tab.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {activeTab === "active" ? (
          <>
            {/* Loading state */}
            {isLoadingActive ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <span className="ml-2 text-sm text-muted-foreground">Memuat...</span>
              </div>
            ) : activeRefunds.length === 0 ? (
              <EmptyState
                icon={<RotateCcw className="w-10 h-10 text-muted-foreground" />}
                title="Belum ada pengajuan aktif"
                description="Ajukan pengembalian jika ada masalah dengan pesanan Anda"
              />
            ) : (
              <div className="space-y-3">
                {activeRefunds.map((refund, i) => (
                  <motion.div key={refund.id} custom={i} variants={stagger} initial="initial" animate="animate">
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-muted-foreground">{refund.order?.orderNumber || '-'}</p>
                          <p className="text-sm font-medium text-foreground mt-1">{getComplaintProduct(refund)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{refund.reason}</p>
                        </div>
                        <Badge className={`text-[10px] ${STATUS_COLORS[refund.status] || STATUS_COLORS.open}`}>
                          {STATUS_LABELS[refund.status] || refund.status}
                        </Badge>
                      </div>
                      {/* Timeline */}
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                        {getTimeline(refund).map((step, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${idx === getTimeline(refund).length - 1 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                            <span className={`text-xs ${idx === getTimeline(refund).length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">{formatDate(refund.createdAt)}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            <Button
              onClick={() => setShowForm(!showForm)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Ajukan Pengembalian
            </Button>

            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <Card className="p-4 space-y-3">
                    {/* Order Select */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Pilih Pesanan <span className="text-red-500">*</span></label>
                      <select
                        value={selectedOrderId}
                        onChange={e => setSelectedOrderId(e.target.value)}
                        className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                      >
                        <option value="">-- Pilih Pesanan --</option>
                        {eligibleOrders.map(order => (
                          <option key={order.id} value={order.id}>
                            {order.orderNumber} - {order.items[0]?.productName || 'Produk'}
                          </option>
                        ))}
                      </select>
                      {eligibleOrders.length === 0 && (
                        <p className="text-[10px] text-muted-foreground">Tidak ada pesanan yang eligible untuk pengembalian</p>
                      )}
                    </div>

                    {/* Type Select */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Jenis Pengajuan <span className="text-red-500">*</span></label>
                      <select
                        value={selectedType}
                        onChange={e => setSelectedType(e.target.value)}
                        className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                      >
                        {COMPLAINT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Reason Select */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Alasan <span className="text-red-500">*</span></label>
                      <select
                        value={selectedReason}
                        onChange={e => setSelectedReason(e.target.value)}
                        className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
                      >
                        <option value="">-- Pilih Alasan --</option>
                        {REASON_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Deskripsi</label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Jelaskan masalahnya..."
                        className="w-full min-h-[60px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                      />
                    </div>

                    {/* Evidence Upload */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">Foto Bukti</label>
                      <input
                        ref={evidenceInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleEvidenceUpload}
                      />
                      <div className="flex gap-2 flex-wrap">
                        {evidenceImages.map((img) => (
                          <div key={img.id} className="relative group">
                            <div
                              className="w-16 h-16 rounded-lg overflow-hidden border border-border/50 cursor-pointer"
                              onClick={() => setPreviewImage(img.url)}
                            >
                              <img src={img.url} alt="Bukti" className="w-full h-full object-cover" />
                            </div>
                            <button
                              onClick={() => handleRemoveEvidence(img.id)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                        {evidenceImages.length < 4 && (
                          <button
                            onClick={() => evidenceInputRef.current?.click()}
                            className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-emerald-400 bg-muted/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 flex flex-col items-center justify-center gap-0.5 transition-colors"
                          >
                            <ImagePlus className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[8px] text-muted-foreground">Tambah</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Maks 4 foto · JPG, PNG · Maks 5MB/foto</p>
                    </div>

                    <Button
                      onClick={handleSubmitRefund}
                      disabled={isSubmitting}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengirim...
                        </>
                      ) : (
                        'Kirim Pengajuan'
                      )}
                    </Button>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <>
            {/* History Tab */}
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <span className="ml-2 text-sm text-muted-foreground">Memuat...</span>
              </div>
            ) : refundHistory.length === 0 ? (
              <EmptyState
                icon={<RotateCcw className="w-10 h-10 text-muted-foreground" />}
                title="Belum ada riwayat pengembalian"
                description="Riwayat pengajuan yang sudah selesai akan muncul di sini"
              />
            ) : (
              <div className="space-y-3">
                {refundHistory.map((item, i) => (
                  <motion.div key={item.id} custom={i} variants={stagger} initial="initial" animate="animate">
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-muted-foreground">{item.order?.orderNumber || '-'}</p>
                          <p className="text-sm font-medium text-foreground mt-1">{getComplaintProduct(item)}</p>
                          <p className="text-sm font-bold text-emerald-600 mt-0.5">
                            {item.refundAmount ? formatPrice(Number(item.refundAmount)) : formatPrice(item.order?.totalAmount || 0)}
                          </p>
                        </div>
                        <Badge className={`text-[10px] ${STATUS_COLORS[item.status] || STATUS_COLORS.rejected}`}>
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      </div>
                      {/* Show resolution for resolved/rejected */}
                      {item.resolution && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Resolusi:</span> {item.resolution}
                          </p>
                        </div>
                      )}
                      {/* Evidence images */}
                      {(() => {
                        const imgs = parseImages(item.images)
                        if (imgs.length === 0) return null
                        return (
                          <div className="mt-2 pt-2 border-t border-border/50 flex gap-1.5 flex-wrap">
                            {imgs.map((imgUrl, idx) => (
                              <div
                                key={idx}
                                className="w-10 h-10 rounded-md overflow-hidden border border-border/50 cursor-pointer"
                                onClick={() => setPreviewImage(imgUrl)}
                              >
                                <img src={imgUrl} alt={`Bukti ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                      <p className="text-[10px] text-muted-foreground mt-2">{formatDate(item.createdAt)}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            >
              <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
