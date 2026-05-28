"use client"

import { motion } from "framer-motion"
import {
  Box, AlertTriangle, Check, Ban, Trash2, Edit, Upload
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, SectionHeader, SearchBar, EmptyState } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { LoadingSpinner } from "../loading-spinner"
import { apiClient } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface AdminProductItem {
  id: string
  name: string
  description: string
  price: number
  discountPrice: number | null
  images: string[]
  videoUrl: string | null
  sellerName: string
  status: string
  sold: number
  isFeatured: boolean
  categoryId: string
  categoryName: string
  stock: number
  weight: number
  condition: string
  tags: string[]
}

export function AdminProducts() {
  const { showToast } = useAppStore()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [adminProducts, setAdminProducts] = useState<AdminProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)
  const [editProduct, setEditProduct] = useState<AdminProductItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editDiscountPrice, setEditDiscountPrice] = useState("")
  const [editStock, setEditStock] = useState("")
  const [editWeight, setEditWeight] = useState("")
  const [editCondition, setEditCondition] = useState("")
  const [editCategoryId, setEditCategoryId] = useState("")
  const [editImages, setEditImages] = useState<string[]>([])
  const [editVideoUrl, setEditVideoUrl] = useState("")
  const [editTags, setEditTags] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [categories, setCategories] = useState<{id: string; name: string}[]>([])

  const fetchAdminProducts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<{ success: boolean; data: any[] }>('/api/admin/products', { limit: '500' })
      if (data.success) {
        const mapped: AdminProductItem[] = (data.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: Number(p.price),
          discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
          images: Array.isArray(p.images) ? p.images : [],
          videoUrl: p.videoUrl || null,
          sellerName: p.seller?.storeName || 'Unknown',
          status: p.status,
          sold: p.sold,
          isFeatured: p.isFeatured,
          categoryId: p.categoryId || '',
          categoryName: p.category?.name || '',
          stock: p.stock || 0,
          weight: p.weight || 0,
          condition: p.condition || 'new',
          tags: Array.isArray(p.tags) ? p.tags : [],
        }))
        setAdminProducts(mapped)
      }
    } catch {
      showToast("Gagal memuat produk", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchAdminProducts()
  }, [fetchAdminProducts])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await apiClient.get<{ success: boolean; data: any[] }>('/api/admin/categories')
        if (data.success) {
          setCategories((data.data || []).map((c: any) => ({ id: c.id, name: c.name })))
        }
      } catch {}
    }
    fetchCategories()
  }, [])

  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      const data = await apiClient.put<{ success: boolean; error?: string }>('/api/admin/products', { productId, status: newStatus })
      if (data.success) {
        setAdminProducts(prev => prev.map(p => p.id === productId ? { ...p, status: newStatus } : p))
        showToast(newStatus === 'active' ? "Produk diapprove" : "Produk diblokir", "success")
      } else {
        showToast(data.error || "Gagal mengubah status produk", "error")
      }
    } catch {
      showToast("Gagal mengubah status produk", "error")
    }
  }

  const handleDelete = async (productId: string) => {
    try {
      const data = await apiClient.del<{ success: boolean; error?: string }>('/api/admin/products', { productId })
      if (data.success) {
        setAdminProducts(prev => prev.filter(p => p.id !== productId))
        showToast("Produk dihapus", "info")
      } else {
        showToast(data.error || "Gagal menghapus produk", "error")
      }
    } catch {
      showToast("Gagal menghapus produk", "error")
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingImage(true)
    try {
      const newImages: string[] = [...editImages]
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'products')
        formData.append('folder', 'images')
        const data = await apiClient.upload<{ success: boolean; data?: { url: string }; error?: string }>('/api/upload', formData)
        if (data.success && data.data?.url) {
          newImages.push(data.data.url)
        } else {
          showToast(`Gagal upload ${file.name}`, 'error')
        }
      }
      setEditImages(newImages)
      showToast('Gambar berhasil diupload', 'success')
    } catch {
      showToast('Gagal upload gambar', 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingVideo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'products')
      formData.append('folder', 'videos')
      const data = await apiClient.upload<{ success: boolean; data?: { url: string }; error?: string }>('/api/upload', formData)
      if (data.success && data.data?.url) {
        setEditVideoUrl(data.data.url)
        showToast('Video berhasil diupload', 'success')
      } else {
        showToast(data.error || 'Gagal upload video', 'error')
      }
    } catch {
      showToast('Gagal upload video', 'error')
    } finally {
      setUploadingVideo(false)
    }
  }

  const handleEditProduct = async (productId: string, updates: Record<string, unknown>) => {
    try {
      const data = await apiClient.put<{ success: boolean; error?: string }>('/api/admin/products', { productId, ...updates })
      if (data.success) {
        setAdminProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updates, price: Number(updates.price ?? p.price) } : p))
        showToast("Produk berhasil diupdate", "success")
        return true
      } else {
        showToast(data.error || "Gagal mengupdate produk", "error")
        return false
      }
    } catch {
      showToast("Gagal mengupdate produk", "error")
      return false
    }
  }

  const filtered = adminProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sellerName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const flaggedProducts = adminProducts.filter(p => p.status === "blocked")

  if (loading) return <div className="pb-20"><PageHeader title="Moderasi Produk" /><LoadingSpinner message="Memuat produk..." /></div>

  return (
    <div className="pb-20">
      <PageHeader title="Moderasi Produk" />

      <div className="px-4 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari produk atau seller..." />

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Aktif" },
            { key: "blocked", label: "Diblokir" },
            { key: "draft", label: "Draft" },
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

        {/* Flagged Products Section */}
        {statusFilter === "all" && flaggedProducts.length > 0 && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Produk Ditandai" icon={<AlertTriangle className="w-4 h-4 text-red-500" />} />
            <div className="space-y-2 mt-3">
              {flaggedProducts.map((product, i) => (
                <motion.div key={product.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-3 border-red-200 dark:border-red-900/50">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {product.images && product.images.length > 0 ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                          <Badge variant="outline" className="text-[9px] border-red-300 text-red-600">Blocked</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{product.sellerName} · {formatPrice(product.price)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-2 border-t border-red-100 dark:border-red-900/30">
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleStatusChange(product.id, 'active')}>
                        <Check className="w-3 h-3 mr-0.5" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-blue-500" onClick={() => {
                        setEditProduct(product)
                        setEditName(product.name)
                        setEditDescription(product.description)
                        setEditPrice(product.price.toString())
                        setEditDiscountPrice(product.discountPrice ? product.discountPrice.toString() : "")
                        setEditStock(product.stock.toString())
                        setEditWeight(product.weight.toString())
                        setEditCondition(product.condition || 'new')
                        setEditCategoryId(product.categoryId || '')
                        setEditImages(product.images || [])
                        setEditVideoUrl(product.videoUrl || '')
                        setEditTags((product.tags || []).join(', '))
                      }}>
                        <Edit className="w-3 h-3 mr-0.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => setConfirmAction({
                        action: () => handleDelete(product.id),
                        title: 'Hapus Produk',
                        message: `Apakah Anda yakin ingin menghapus "${product.name}"? Tindakan ini tidak dapat dibatalkan.`
                      })}>
                        <Trash2 className="w-3 h-3 mr-0.5" /> Delete
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Product List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Box className="w-10 h-10 text-muted-foreground" />}
              title="Produk Tidak Ditemukan"
              subtitle="Coba kata kunci lain"
            />
          ) : (
            filtered.map((product, i) => (
              <motion.div key={product.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Box className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <Badge variant="outline" className={`text-[9px] ${
                          product.status === "active" ? "border-emerald-300 text-emerald-600" :
                          product.status === "draft" ? "border-amber-300 text-amber-600" :
                          "border-red-300 text-red-600"
                        }`}>
                          {product.status === "active" ? "Aktif" : product.status === "draft" ? "Draft" : "Blocked"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{product.sellerName} · Terjual {product.sold}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(product.price)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-blue-500" onClick={() => {
                      setEditProduct(product)
                      setEditName(product.name)
                      setEditDescription(product.description)
                      setEditPrice(product.price.toString())
                      setEditDiscountPrice(product.discountPrice ? product.discountPrice.toString() : "")
                      setEditStock(product.stock.toString())
                      setEditWeight(product.weight.toString())
                      setEditCondition(product.condition || 'new')
                      setEditCategoryId(product.categoryId || '')
                      setEditImages(product.images || [])
                      setEditVideoUrl(product.videoUrl || '')
                      setEditTags((product.tags || []).join(', '))
                    }}>
                      <Edit className="w-3 h-3 mr-0.5" /> Edit
                    </Button>
                    {product.status === "blocked" ? (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleStatusChange(product.id, 'active')}>
                        <Check className="w-3 h-3 mr-0.5" /> Approve
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => setConfirmAction({
                        action: () => handleStatusChange(product.id, 'blocked'),
                        title: 'Blokir Produk',
                        message: `Apakah Anda yakin ingin memblokir "${product.name}"? Produk tidak akan terlihat oleh pembeli.`
                      })}>
                        <Ban className="w-3 h-3 mr-0.5" /> Block
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => setConfirmAction({
                      action: () => handleDelete(product.id),
                      title: 'Hapus Produk',
                      message: `Apakah Anda yakin ingin menghapus "${product.name}"? Tindakan ini tidak dapat dibatalkan.`
                    })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <Dialog open={!!editProduct} onOpenChange={(open) => { if (!open) setEditProduct(null) }}>
        <DialogContent className="max-w-[420px] max-h-[85vh] overflow-y-auto rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit Produk</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {/* Basic Info */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nama Produk</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Deskripsi</label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Price & Stock Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Harga (Rp)</label>
                <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Diskon (Rp)</label>
                <Input type="number" value={editDiscountPrice} onChange={e => setEditDiscountPrice(e.target.value)} placeholder="0" className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Stok</label>
                <Input type="number" value={editStock} onChange={e => setEditStock(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Berat (gram)</label>
                <Input type="number" value={editWeight} onChange={e => setEditWeight(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            {/* Category & Condition */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Kategori</label>
                <select
                  value={editCategoryId}
                  onChange={e => setEditCategoryId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Pilih Kategori</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Kondisi</label>
                <select
                  value={editCondition}
                  onChange={e => setEditCondition(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="new">Baru</option>
                  <option value="used">Bekas</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Tags (pisah koma)</label>
              <Input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="tag1, tag2, tag3" className="rounded-xl" />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Gambar Produk</label>
              <div className="flex flex-wrap gap-2">
                {editImages.map((img, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={img} alt={`Product ${idx+1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingImage ? (
                    <span className="text-[9px] text-muted-foreground">Uploading...</span>
                  ) : (
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  )}
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">Klik × untuk menghapus gambar. Klik icon upload untuk menambah.</p>
            </div>

            {/* Video */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Video Produk</label>
              {editVideoUrl && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <video src={editVideoUrl} className="w-20 h-14 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{editVideoUrl.split('/').pop()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditVideoUrl('')}
                    className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              )}
              <label className={`flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-border cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground ${uploadingVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingVideo ? 'Uploading...' : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Upload Video
                  </>
                )}
                <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoUpload} className="hidden" />
              </label>
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setEditProduct(null)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!editProduct) return
                const tagArray = editTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
                const success = await handleEditProduct(editProduct.id, {
                  name: editName.trim(),
                  description: editDescription.trim(),
                  price: Number(editPrice),
                  discountPrice: editDiscountPrice ? Number(editDiscountPrice) : null,
                  stock: Number(editStock),
                  weight: Number(editWeight),
                  condition: editCondition,
                  categoryId: editCategoryId || undefined,
                  images: editImages,
                  videoUrl: editVideoUrl || null,
                  tags: tagArray.length > 0 ? tagArray : undefined,
                })
                if (success) setEditProduct(null)
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10 flex-1"
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />
    </div>
  )
}
