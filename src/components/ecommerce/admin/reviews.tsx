"use client"

import { motion } from "framer-motion"
import {
  Star, Eye, Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { formatRelativeTime } from "@/lib/utils"
import { stagger } from '@/lib/animations'
import { PageHeader, SearchBar, EmptyState, AdminScreenWrapper } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { ConfirmDialog } from "../confirm-dialog"

import { apiClient } from '@/lib/api-client'
import { handleApiError } from '@/lib/handle-api-error'

interface AdminReviewItem {
  id: string
  userId: string
  productId: string
  rating: number
  content: string | null
  images: unknown[]
  sellerReply: string | null
  sellerReplyAt: string | null
  isHidden: boolean
  createdAt: string
  user: { id: string; name: string; avatar: string | null; email: string }
  product: { id: string; name: string; seller: { id: string; storeName: string } }
}

export function AdminReviews() {
  const { showToast } = useAppStore()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [adminReviews, setAdminReviews] = useState<AdminReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string } | null>(null)

  const fetchAdminReviews = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      params.set("limit", "200")
      const data = await apiClient.get<{ success: boolean; data: AdminReviewItem[]; error?: string }>(`/api/admin/reviews?${params.toString()}`)
      if (data.success) {
        setAdminReviews(data.data || [])
      } else {
        showToast(data.error || "Gagal memuat reviews", "error")
      }
    } catch (err) {
      handleApiError(err, "reviews")
    } finally {
      setLoading(false)
    }
  }, [showToast, statusFilter])

  useEffect(() => {
    fetchAdminReviews()
  }, [fetchAdminReviews])

  const handleToggleHidden = async (reviewId: string, currentHidden: boolean) => {
    try {
      const res = await apiClient.rawPut("/api/admin/reviews", { reviewId, isHidden: !currentHidden })
      const data = await res.json()
      if (data.success) {
        setAdminReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, isHidden: !currentHidden } : r))
        )
        showToast(!currentHidden ? "Review disembunyikan" : "Review ditampilkan kembali", "success")
      } else {
        showToast(data.error || "Gagal mengubah status review", "error")
      }
    } catch {
      showToast("Gagal mengubah status review", "error")
    }
  }

  const handleDelete = async (reviewId: string) => {
    try {
      const res = await apiClient.rawDelete("/api/admin/reviews", { reviewId })
      const data = await res.json()
      if (data.success) {
        setAdminReviews((prev) => prev.filter((r) => r.id !== reviewId))
        showToast("Review dihapus", "info")
      } else {
        showToast(data.error || "Gagal menghapus review", "error")
      }
    } catch {
      showToast("Gagal menghapus review", "error")
    }
  }

  const filtered = adminReviews.filter((r) => {
    const matchesSearch =
      r.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (r.content || "").toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  const hiddenCount = adminReviews.filter((r) => r.isHidden).length

  return (
    <AdminScreenWrapper title="Moderasi Review" isLoading={loading}>
      <PageHeader title="Moderasi Review" />

      <div className="px-4 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari review, user, atau produk..." />

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: `Semua (${adminReviews.length})` },
            { key: "visible", label: `Terlihat (${adminReviews.length - hiddenCount})` },
            { key: "hidden", label: `Tersembunyi (${hiddenCount})` },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === filter.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Review List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Star className="w-10 h-10 text-muted-foreground" />}
              title="Review Tidak Ditemukan"
              subtitle="Coba kata kunci lain"
            />
          ) : (
            filtered.map((review, i) => (
              <motion.div key={review.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className={`p-3 ${review.isHidden ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                      {review.user?.name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{review.user?.name || "Unknown"}</p>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3 h-3 ${idx < review.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                        {review.isHidden && (
                          <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600">Tersembunyi</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Produk: {review.product?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Toko: {review.product?.seller?.storeName || "Unknown"}</p>
                      {review.content && (
                        <p className="text-xs text-foreground mt-1 line-clamp-2">{review.content}</p>
                      )}
                      {review.sellerReply && (
                        <div className="mt-1.5 pl-2 border-l-2 border-emerald-300 dark:border-emerald-700">
                          <p className="text-[10px] text-emerald-600 font-medium">Balasan Penjual:</p>
                          <p className="text-xs text-foreground line-clamp-2">{review.sellerReply}</p>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(review.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-7 text-[11px] rounded-lg ${review.isHidden ? "text-emerald-600" : "text-amber-600"}`}
                      onClick={() => handleToggleHidden(review.id, review.isHidden)}
                    >
                      {review.isHidden ? (
                        <><Eye className="w-3 h-3 mr-0.5" /> Tampilkan</>
                      ) : (
                        <><Eye className="w-3 h-3 mr-0.5" /> Sembunyikan</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() =>
                        setConfirmAction({
                          action: () => handleDelete(review.id),
                          title: "Hapus Review",
                          message: `Apakah Anda yakin ingin menghapus review dari ${review.user?.name || "Unknown"}? Tindakan ini tidak dapat dibatalkan.`,
                        })
                      }
                    >
                      <Trash2 className="w-3 h-3 mr-0.5" /> Hapus
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
      />
    </AdminScreenWrapper>
  )
}
