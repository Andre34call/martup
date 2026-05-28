"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { PageHeader } from "../shared"
import { useState, useRef } from "react"
import { RotateCcw, X, ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { stagger } from '@/lib/animations'

export function RefundScreen() {
  const { showToast, goBack } = useAppStore()
  const [activeTab, setActiveTab] = useState("active")
  const [showForm, setShowForm] = useState(false)
  const [evidenceImages, setEvidenceImages] = useState<{ id: string; url: string; file: File }[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const evidenceInputRef = useRef<HTMLInputElement>(null)

  const activeRefunds: { id: string; orderNumber: string; product: string; reason: string; status: string; date: string; timeline: string[] }[] = []

  const refundHistory: { id: string; orderNumber: string; product: string; amount: number; status: string; date: string }[] = []

  const handleSubmitRefund = () => {
    evidenceImages.forEach(img => URL.revokeObjectURL(img.url))
    setEvidenceImages([])
    showToast("Pengajuan refund berhasil dikirim!", "success")
    goBack()
  }

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
            <div className="space-y-3">
              {activeRefunds.map((refund, i) => (
                <motion.div key={refund.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-mono text-muted-foreground">{refund.orderNumber}</p>
                        <p className="text-sm font-medium text-foreground mt-1">{refund.product}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{refund.reason}</p>
                      </div>
                      <Badge className={`text-[10px] ${
                        refund.status === "Diproses" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30" : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30"
                      }`}>{refund.status}</Badge>
                    </div>
                    {/* Timeline */}
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      {refund.timeline.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${idx === refund.timeline.length - 1 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                          <span className={`text-xs ${idx === refund.timeline.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">{refund.date}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            <Button
              onClick={() => setShowForm(!showForm)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Ajukan Pengembalian
            </Button>

            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <Card className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Pilih Pesanan <span className="text-red-500">*</span></label>
                      <select className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm">
                        <option>ORD-2024-003 - Lipstik Matte Velvet</option>
                        <option>ORD-2024-001 - iPhone 15 Pro Max</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Alasan <span className="text-red-500">*</span></label>
                      <select className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm">
                        <option>Barang rusak</option>
                        <option>Tidak sesuai deskripsi</option>
                        <option>Barang salah</option>
                        <option>Lainnya</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Deskripsi <span className="text-red-500">*</span></label>
                      <textarea
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
                    <Button onClick={handleSubmitRefund} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10">
                      Kirim Pengajuan
                    </Button>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="space-y-3">
            {refundHistory.map((item, i) => (
              <motion.div key={item.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{item.orderNumber}</p>
                      <p className="text-sm font-medium text-foreground mt-1">{item.product}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(item.amount)}</p>
                    </div>
                    <Badge className={`text-[10px] ${item.status === "Selesai" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">{item.date}</p>
                </Card>
              </motion.div>
            ))}
          </div>
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
