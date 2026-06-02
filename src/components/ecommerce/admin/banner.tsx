"use client"

import { motion } from "framer-motion"
import {
  DollarSign, Plus, ImageIcon, Trash2, Upload
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useAppStore } from "@/lib/store"
import { PageHeader, SectionHeader, EmptyState, AdminScreenWrapper } from "../shared"
import { fadeIn, stagger } from '@/lib/animations'
import { useState, useRef, useEffect } from "react"
import { ConfirmDialog } from "../confirm-dialog"

import { apiClient, ApiClientError } from '@/lib/api-client'

const BANNER_POSITIONS = [
  { value: "home_top", label: "Home Atas" },
  { value: "home_mid", label: "Home Tengah" },
  { value: "home_bottom", label: "Home Bawah" },
  { value: "category_top", label: "Kategori Atas" },
  { value: "search_top", label: "Pencarian Atas" },
  { value: "product_detail", label: "Detail Produk" },
  { value: "checkout_top", label: "Checkout Atas" },
  { value: "popup", label: "Popup" },
] as const

// ==================== TYPE ALIASES (avoid TSX generic ambiguity) ====================
type BannerMutationResponse = { success: boolean; error?: string }
type UploadResponse = { success: boolean; data?: { url: string; path: string; type: 'image' | 'video' }; error?: string }

export function AdminBanner() {
  const { showToast, adminBanners, fetchAdminBanners } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newBannerTitle, setNewBannerTitle] = useState("")
  const [newBannerPosition, setNewBannerPosition] = useState("home_top")
  const [newBannerImageUrl, setNewBannerImageUrl] = useState("")
  const [newBannerLink, setNewBannerLink] = useState("")
  const [newBannerSortOrder, setNewBannerSortOrder] = useState(0)
  const [newBannerStartDate, setNewBannerStartDate] = useState("")
  const [newBannerEndDate, setNewBannerEndDate] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAdminBanners().finally(() => setIsLoading(false))
  }, [fetchAdminBanners])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'banners')
      formData.append('folder', 'images')
      const uploadData = await apiClient.upload<UploadResponse>('/api/upload', formData)
      if (uploadData.success && uploadData.data?.url) {
        setNewBannerImageUrl(uploadData.data.url)
        showToast('Gambar berhasil diupload', 'success')
      } else {
        showToast(uploadData.error || 'Gagal mengupload gambar', 'error')
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : 'Gagal mengupload gambar', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleToggleActive = async (bannerId: string, isActive: boolean) => {
    try {
      const data = await apiClient.put<BannerMutationResponse>('/api/admin/banners', { bannerId, isActive: !isActive })
      if (data.success) {
        fetchAdminBanners()
        showToast(!isActive ? "Banner diaktifkan" : "Banner dinonaktifkan", "success")
      } else {
        showToast(data.error || "Gagal mengubah status banner", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal mengubah status banner", "error")
    }
  }

  const handleDeleteBanner = async (bannerId: string) => {
    try {
      const data = await apiClient.del<BannerMutationResponse>('/api/admin/banners', { bannerId })
      if (data.success) {
        fetchAdminBanners()
        showToast('Banner berhasil dihapus', 'success')
      } else {
        showToast(data.error || 'Gagal menghapus banner', 'error')
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : 'Gagal menghapus banner', 'error')
    }
  }

  const handleAddBanner = async () => {
    if (!newBannerTitle || !newBannerPosition) {
      showToast('Judul dan posisi wajib diisi', 'error')
      return
    }
    if (!newBannerImageUrl) {
      showToast('Gambar banner wajib diisi', 'error')
      return
    }

    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: newBannerTitle,
        image: newBannerImageUrl,
        position: newBannerPosition,
        isActive: true,
        sortOrder: newBannerSortOrder,
      }
      if (newBannerLink) body.link = newBannerLink
      if (newBannerStartDate) body.startDate = newBannerStartDate
      if (newBannerEndDate) body.endDate = newBannerEndDate

      const data = await apiClient.post<BannerMutationResponse>('/api/admin/banners', body)
      if (data.success) {
        showToast('Banner berhasil ditambahkan', 'success')
        setNewBannerTitle('')
        setNewBannerPosition('home_top')
        setNewBannerImageUrl('')
        setNewBannerLink('')
        setNewBannerSortOrder(0)
        setNewBannerStartDate('')
        setNewBannerEndDate('')
        setShowAdd(false)
        fetchAdminBanners()
      } else {
        showToast(data.error || 'Gagal menambahkan banner', 'error')
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : 'Gagal menambahkan banner', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const getPositionLabel = (position: string) => {
    const found = BANNER_POSITIONS.find(p => p.value === position)
    return found ? found.label : position
  }

  return (
    <AdminScreenWrapper title="Kelola Banner" isLoading={isLoading}>
      <PageHeader title="Kelola Banner" rightAction={
        <Button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
        </Button>
      } />

      <div className="px-4 space-y-4">
        {/* Current Banners */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Banner Aktif" icon={<ImageIcon className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            {adminBanners.length === 0 ? (
              <EmptyState icon={<ImageIcon className="w-12 h-12" />} title="Belum ada banner" subtitle="Tambahkan banner baru untuk ditampilkan di aplikasi" />
            ) : (
              adminBanners.map((banner, i) => (
                <motion.div key={banner.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {banner.image ? (
                          <img src={banner.image} alt={banner.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-emerald-400 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{banner.title}</p>
                          <p className="text-xs text-muted-foreground">{getPositionLabel(banner.position)}</p>
                          {banner.sortOrder > 0 && (
                            <p className="text-[10px] text-muted-foreground">Urutan: {banner.sortOrder}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={banner.isActive} onCheckedChange={() => handleToggleActive(banner.id, banner.isActive)} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setConfirmAction({
                            action: () => handleDeleteBanner(banner.id),
                            title: 'Hapus Banner',
                            message: `Apakah Anda yakin ingin menghapus "${banner.title}"? Tindakan ini tidak dapat dibatalkan.`
                          })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Add New Banner Form */}
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <SectionHeader title="Tambah Banner Baru" icon={<Plus className="w-4 h-4" />} />
            <Card className="mt-3 p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Judul Banner</label>
                <Input value={newBannerTitle} onChange={(e) => setNewBannerTitle(e.target.value)} placeholder="Contoh: Flash Sale Weekend" className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Posisi</label>
                <select
                  value={newBannerPosition}
                  onChange={(e) => setNewBannerPosition(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {BANNER_POSITIONS.map((pos) => (
                    <option key={pos.value} value={pos.value}>{pos.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Gambar Banner</label>
                <div className="flex gap-2">
                  <Input value={newBannerImageUrl} onChange={(e) => setNewBannerImageUrl(e.target.value)} placeholder="https://example.com/banner.jpg" className="rounded-xl flex-1" />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl h-10 px-3 flex-shrink-0"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {newBannerImageUrl && (
                  <div className="h-28 rounded-xl overflow-hidden bg-muted">
                    <img src={newBannerImageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Link (Opsional)</label>
                <Input value={newBannerLink} onChange={(e) => setNewBannerLink(e.target.value)} placeholder="https://..." className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Urutan Sortir</label>
                <Input
                  type="number"
                  value={newBannerSortOrder}
                  onChange={(e) => setNewBannerSortOrder(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="rounded-xl"
                  min={0}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Tanggal Mulai</label>
                  <Input
                    type="date"
                    value={newBannerStartDate}
                    onChange={(e) => setNewBannerStartDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Tanggal Berakhir</label>
                  <Input
                    type="date"
                    value={newBannerEndDate}
                    onChange={(e) => setNewBannerEndDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
                disabled={isSaving}
                onClick={handleAddBanner}
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Menyimpan...
                  </div>
                ) : (
                  'Simpan Banner'
                )}
              </Button>
            </Card>
          </motion.div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />
    </AdminScreenWrapper>
  )
}
