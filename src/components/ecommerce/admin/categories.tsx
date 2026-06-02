"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Tags, Plus, Check, Ban, Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"
import { PageHeader, SectionHeader, SearchBar, EmptyState } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { LoadingSpinner } from "../loading-spinner"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { handleApiError } from '@/lib/handle-api-error'
import { stagger } from '@/lib/animations'

// ==================== TYPE DEFINITIONS ====================
interface CategoryItem {
  id: string
  name: string
  slug: string
  icon: string | null
  image: string | null
  parentId: string | null
  parent: { id: string; name: string; slug: string } | null
  sortOrder: number
  isActive: boolean
  productCount: number
  childrenCount: number
  createdAt: string
  updatedAt: string
}

// ==================== TYPE ALIASES (avoid TSX generic ambiguity) ====================
type CategoryListResponse = { success: boolean; data: CategoryItem[]; error?: string }
type CategoryMutationResponse = { success: boolean; error?: string }

// ==================== ADMIN CATEGORIES ====================
export function AdminCategories() {
  const { showToast } = useAppStore()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: "", icon: "", parentId: "", sortOrder: 0 })
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<CategoryListResponse>("/api/admin/categories")
      if (data.success) {
        setCategories(data.data)
      }
    } catch (err) {
      handleApiError(err, "kategori")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const filtered = categories.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "active" && c.isActive)
      || (statusFilter === "inactive" && !c.isActive)
    return matchesSearch && matchesStatus
  })

  const rootCategories = categories.filter(c => !c.parentId)

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showToast("Nama kategori wajib diisi", "error")
      return
    }
    try {
      const data = await apiClient.post<CategoryMutationResponse>("/api/admin/categories", {
        name: form.name,
        icon: form.icon || null,
        parentId: form.parentId || null,
        sortOrder: form.sortOrder,
        isActive: true,
      })
      if (data.success) {
        showToast("Kategori berhasil ditambahkan", "success")
        setShowAddForm(false)
        setForm({ name: "", icon: "", parentId: "", sortOrder: 0 })
        fetchCategories()
      } else {
        showToast(data.error || "Gagal menambahkan kategori", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal menambahkan kategori", "error")
    }
  }

  const handleUpdate = async (categoryId: string, updates: Record<string, unknown>) => {
    try {
      const data = await apiClient.put<CategoryMutationResponse>("/api/admin/categories", { categoryId, ...updates })
      if (data.success) {
        showToast("Kategori berhasil diperbarui", "success")
        fetchCategories()
      } else {
        showToast(data.error || "Gagal memperbarui kategori", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal memperbarui kategori", "error")
    }
  }

  const handleDelete = async (categoryId: string) => {
    try {
      const data = await apiClient.del<CategoryMutationResponse>("/api/admin/categories", { categoryId })
      if (data.success) {
        showToast("Kategori berhasil dihapus (nonaktif)", "success")
        fetchCategories()
      } else {
        showToast(data.error || "Gagal menghapus kategori", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal menghapus kategori", "error")
    }
  }

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Kategori" rightAction={
        <Button
          onClick={() => { setShowAddForm(!showAddForm) }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
        </Button>
      } />

      <div className="px-4 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari kategori..." />

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Aktif" },
            { key: "inactive", label: "Nonaktif" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === filter.key
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Add Category Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <SectionHeader title="Tambah Kategori Baru" icon={<Plus className="w-4 h-4" />} />
              <Card className="mt-3 p-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nama Kategori</label>
                  <Input
                    placeholder="Contoh: Elektronik"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Ikon (Opsional)</label>
                  <Input
                    placeholder="Contoh: 📱"
                    value={form.icon}
                    onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Kategori Induk</label>
                  <select
                    value={form.parentId}
                    onChange={(e) => setForm(f => ({ ...f, parentId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground focus:border-emerald-500 focus:ring-emerald-500/20"
                  >
                    <option value="">Tidak ada (Root)</option>
                    {rootCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Urutan Sortir</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.sortOrder}
                    onChange={(e) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setShowAddForm(false)}>
                    Batal
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10" onClick={handleCreate}>
                    Simpan
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category List */}
        <div className="space-y-2">
          {loading ? (
            <LoadingSpinner message="Memuat kategori..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Tags className="w-10 h-10 text-muted-foreground" />}
              title="Kategori Tidak Ditemukan"
              subtitle="Coba kata kunci lain atau tambahkan kategori baru"
            />
          ) : (
            filtered.map((category, i) => (
              <motion.div key={category.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      {category.icon ? (
                        <span className="text-lg">{category.icon}</span>
                      ) : (
                        <Tags className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{category.name}</p>
                        <Badge variant="outline" className={`text-[9px] ${
                          category.isActive ? "border-emerald-300 text-emerald-600" : "border-red-300 text-red-600"
                        }`}>
                          {category.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">/{category.slug}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{category.productCount} produk</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">Sort: {category.sortOrder}</span>
                        {category.parent && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-amber-600">Parent: {category.parent.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] rounded-lg"
                      onClick={() => handleUpdate(category.id, { isActive: !category.isActive })}
                    >
                      {category.isActive ? (
                        <><Ban className="w-3 h-3 mr-0.5" /> Nonaktifkan</>
                      ) : (
                        <><Check className="w-3 h-3 mr-0.5" /> Aktifkan</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => setConfirmAction({
                        action: () => handleDelete(category.id),
                        title: 'Hapus Kategori',
                        message: `Apakah Anda yakin ingin menghapus kategori "${category.name}"? Kategori akan dinonaktifkan.`
                      })}
                    >
                      <Trash2 className="w-3 h-3" />
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
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />
    </div>
  )
}
