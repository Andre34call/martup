"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Flag, Loader2, AlertTriangle, MessageSquare, Ban, ShieldAlert, HelpCircle } from "lucide-react"
import { apiClient, ApiClientError } from "@/lib/api-client"
import { useAppStore } from "@/lib/store"

// ==================== TYPES ====================
export type ReportReason = "spam" | "harassment" | "inappropriate_content" | "scam" | "other"

interface ReportDialogProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  postOwnerName: string
}

// ==================== REPORT REASONS ====================
const REPORT_REASONS: { value: ReportReason; label: string; description: string; icon: typeof Flag; color: string }[] = [
  { value: "spam", label: "Spam", description: "Konten spam atau promosi berlebihan", icon: MessageSquare, color: "text-orange-500" },
  { value: "harassment", label: "Pelecehan", description: "Mengintimidasi atau melecehkan orang lain", icon: AlertTriangle, color: "text-red-500" },
  { value: "inappropriate_content", label: "Konten Tidak Pantas", description: "Konten tidak senonoh atau kekerasan", icon: ShieldAlert, color: "text-pink-500" },
  { value: "scam", label: "Penipuan", description: "Upaya penipuan atau konten menyesatkan", icon: Ban, color: "text-amber-500" },
  { value: "other", label: "Lainnya", description: "Alasan lain yang tidak tercantum", icon: HelpCircle, color: "text-muted-foreground" },
]

// ==================== STREAM REPORT DIALOG ====================
export function StreamReportDialog({ isOpen, onClose, postId, postOwnerName }: ReportDialogProps) {
  const showToast = useAppStore((s) => s.showToast)
  const setOverlayOpen = useAppStore((s) => s.setOverlayOpen)
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Signal overlay state to hide bottom nav
  const handleOpen = useCallback(() => {
    setOverlayOpen(true)
  }, [setOverlayOpen])

  const handleClose = useCallback(() => {
    setOverlayOpen(false)
    // Reset state when dialog closes
    setSelectedReason(null)
    setDescription("")
    setIsSubmitting(false)
    onClose()
  }, [setOverlayOpen, onClose])

  // Trigger overlay on open
  if (isOpen) {
    handleOpen()
  }

  // ==================== SUBMIT REPORT ====================
  const handleSubmit = useCallback(async () => {
    if (!selectedReason || isSubmitting) return

    setIsSubmitting(true)
    try {
      await apiClient.post(`/api/stream/${postId}/report`, {
        reason: selectedReason,
        description: description.trim() || undefined,
      })
      showToast("Laporan berhasil dikirim. Terima kasih!", "success")
      handleClose()
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        showToast("Anda sudah melaporkan postingan ini", "error")
      } else if (error instanceof ApiClientError) {
        showToast(error.message || "Gagal mengirim laporan", "error")
      } else {
        showToast("Gagal mengirim laporan. Coba lagi nanti.", "error")
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedReason, isSubmitting, postId, description, showToast, handleClose])

  // ==================== RENDER ====================
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-background rounded-t-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "85vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-border/50 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <h2 className="text-base font-semibold text-foreground">
                    Laporkan Postingan
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                  Postingan dari {postOwnerName}
                </p>
              </div>

              {/* Close button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4 text-foreground" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-4 py-3 space-y-3">
              {/* Reason selection */}
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason.value
                  const Icon = reason.icon

                  return (
                    <motion.button
                      key={reason.value}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedReason(reason.value)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-border/50 hover:border-border bg-background"
                      }`}
                    >
                      {/* Radio indicator */}
                      <div className="flex-shrink-0">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <Icon className={`w-5 h-5 ${reason.color}`} />
                      </div>

                      {/* Label & description */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            isSelected
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-foreground"
                          }`}
                        >
                          {reason.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {reason.description}
                        </p>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              {/* Description input (optional) */}
              <AnimatePresence>
                {selectedReason && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="relative">
                      <textarea
                        value={description}
                        onChange={(e) => {
                          if (e.target.value.length <= 500) {
                            setDescription(e.target.value)
                          }
                        }}
                        placeholder="Jelaskan alasan laporan Anda (opsional)"
                        rows={3}
                        className="w-full resize-none rounded-xl bg-muted/50 border border-border/50 px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                      />
                      <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground">
                        {description.length}/500
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Submit button */}
            <div className="px-4 py-3 border-t border-border/50 bg-background pb-safe flex-shrink-0">
              <motion.button
                whileTap={selectedReason && !isSubmitting ? { scale: 0.98 } : {}}
                onClick={handleSubmit}
                disabled={!selectedReason || isSubmitting}
                className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                  selectedReason && !isSubmitting
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4" />
                    Kirim Laporan
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
