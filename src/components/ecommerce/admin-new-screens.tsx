"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Tags, Ticket, Wallet, Megaphone, Settings,
  ChevronRight, Eye, Trash2, Check, X, AlertTriangle,
  Plus, Clock, CreditCard, Store, ExternalLink, Save, ToggleLeft,
  Box, Zap, Gift, TrendingUp, Ban, Hash, Award,
  Percent, Banknote, ImageIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime, formatDate } from "@/lib/utils"
import { PageHeader, SectionHeader, SearchBar, EmptyState } from "./shared"
import { useState, useEffect, useCallback } from "react"
import { ConfirmDialog } from "./confirm-dialog"
import { LoadingSpinner } from "./loading-spinner"

import { getAuthHeaders } from '@/lib/store/getAuthHeaders'

// ==================== ANIMATION VARIANTS ====================
const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 }
}

const stagger = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
}

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

interface VoucherItem {
  id: string
  code: string
  name: string
  description: string | null
  type: "percentage" | "fixed"
  value: number
  minPurchase: number
  maxDiscount: number | null
  usageLimit: number | null
  usageCount: number
  perUserLimit: number
  sellerId: string | null
  sellerStoreName: string | null
  validFrom: string
  validUntil: string
  isActive: boolean
  totalUsages: number
  createdAt: string
}

interface DepositItem {
  id: string
  userId: string
  userName: string
  userEmail: string
  userPhone: string | null
  userAvatar: string | null
  amount: number
  method: string
  status: "pending" | "success" | "failed"
  proofUrl: string | null
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

interface CampaignItem {
  id: string
  sellerId: string
  sellerStoreName: string
  sellerAvatar: string | null
  sellerVerified: boolean
  name: string
  type: string
  startDate: string
  endDate: string
  discount: number
  isActive: boolean
  isExpired: boolean
  isUpcoming: boolean
  createdAt: string
}

interface PlatformSettings {
  commissionRate: number
  minWithdrawal: number
  platformFee: number
  maxProductImages: number
  maxProductVariants: number
  voucherEnabled: boolean
  depositEnabled: boolean
  campaignEnabled: boolean
  chatEnabled: boolean
  reviewEnabled: boolean
  referralReward: number
  loyaltyPointsRate: number
  flashSaleEnabled: boolean
  autoConfirmDays: number
  returnWindowDays: number
}

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
      const res = await fetch("/api/admin/categories", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch {
      showToast("Gagal memuat kategori", "error")
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
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          name: form.name,
          icon: form.icon || null,
          parentId: form.parentId || null,
          sortOrder: form.sortOrder,
          isActive: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Kategori berhasil ditambahkan", "success")
        setShowAddForm(false)
        setForm({ name: "", icon: "", parentId: "", sortOrder: 0 })
        fetchCategories()
      } else {
        showToast(data.error || "Gagal menambahkan kategori", "error")
      }
    } catch {
      showToast("Gagal menambahkan kategori", "error")
    }
  }

  const handleUpdate = async (categoryId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ categoryId, ...updates }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Kategori berhasil diperbarui", "success")
        fetchCategories()
      } else {
        showToast(data.error || "Gagal memperbarui kategori", "error")
      }
    } catch {
      showToast("Gagal memperbarui kategori", "error")
    }
  }

  const handleDelete = async (categoryId: string) => {
    try {
      const res = await fetch("/api/admin/categories", {
        method: "DELETE",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ categoryId }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Kategori berhasil dihapus (nonaktif)", "success")
        fetchCategories()
      } else {
        showToast(data.error || "Gagal menghapus kategori", "error")
      }
    } catch {
      showToast("Gagal menghapus kategori", "error")
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

// ==================== ADMIN VOUCHERS ====================
export function AdminVouchers() {
  const { showToast } = useAppStore()
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    code: "", name: "", type: "percentage" as "percentage" | "fixed",
    value: 0, minPurchase: 0, maxDiscount: 0, usageLimit: 0, perUserLimit: 1,
    validFrom: "", validUntil: "",
  })
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/vouchers", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setVouchers(data.data)
      }
    } catch {
      showToast("Gagal memuat voucher", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchVouchers()
  }, [fetchVouchers])

  const getVoucherStatus = (v: VoucherItem): string => {
    const now = new Date()
    if (!v.isActive) return "inactive"
    if (new Date(v.validUntil) < now) return "expired"
    return "active"
  }

  const filtered = vouchers.filter(v => {
    const matchesSearch = v.code.toLowerCase().includes(search.toLowerCase()) || v.name.toLowerCase().includes(search.toLowerCase())
    const vStatus = getVoucherStatus(v)
    const matchesStatus = statusFilter === "all" || vStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleCreate = async () => {
    if (!form.code || !form.name || !form.validFrom || !form.validUntil) {
      showToast("Kode, nama, dan tanggal wajib diisi", "error")
      return
    }
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          name: form.name,
          type: form.type,
          value: form.value,
          minPurchase: form.minPurchase,
          maxDiscount: form.maxDiscount || null,
          usageLimit: form.usageLimit || null,
          perUserLimit: form.perUserLimit,
          validFrom: form.validFrom,
          validUntil: form.validUntil,
          isActive: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Voucher berhasil ditambahkan", "success")
        setShowAddForm(false)
        setForm({ code: "", name: "", type: "percentage", value: 0, minPurchase: 0, maxDiscount: 0, usageLimit: 0, perUserLimit: 1, validFrom: "", validUntil: "" })
        fetchVouchers()
      } else {
        showToast(data.error || "Gagal menambahkan voucher", "error")
      }
    } catch {
      showToast("Gagal menambahkan voucher", "error")
    }
  }

  const handleToggle = async (voucherId: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ voucherId, isActive: !isActive }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(isActive ? "Voucher dinonaktifkan" : "Voucher diaktifkan", "success")
        fetchVouchers()
      } else {
        showToast(data.error || "Gagal memperbarui voucher", "error")
      }
    } catch {
      showToast("Gagal memperbarui voucher", "error")
    }
  }

  const handleDelete = async (voucherId: string) => {
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "DELETE",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ voucherId }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Voucher berhasil dihapus", "success")
        fetchVouchers()
      } else {
        showToast(data.error || "Gagal menghapus voucher", "error")
      }
    } catch {
      showToast("Gagal menghapus voucher", "error")
    }
  }

  const statusLabelMap: Record<string, string> = {
    active: "Aktif",
    expired: "Kedaluwarsa",
    inactive: "Nonaktif",
  }

  const statusColorMap: Record<string, string> = {
    active: "border-emerald-300 text-emerald-600",
    expired: "border-red-300 text-red-600",
    inactive: "border-gray-300 text-gray-500",
  }

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Voucher" rightAction={
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
        </Button>
      } />

      <div className="px-4 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari kode atau nama voucher..." />

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Aktif" },
            { key: "expired", label: "Kedaluwarsa" },
            { key: "inactive", label: "Nonaktif" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === filter.key
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Add Voucher Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <SectionHeader title="Tambah Voucher Baru" icon={<Plus className="w-4 h-4" />} />
              <Card className="mt-3 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Kode Voucher</label>
                    <Input
                      placeholder="DISKON20"
                      value={form.code}
                      onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Nama</label>
                    <Input
                      placeholder="Diskon Akhir Tahun"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Tipe</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm(f => ({ ...f, type: e.target.value as "percentage" | "fixed" }))}
                      className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground focus:border-orange-500 focus:ring-orange-500/20"
                    >
                      <option value="percentage">Persentase (%)</option>
                      <option value="fixed">Nominal Tetap (Rp)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Nilai {form.type === "percentage" ? "(%)" : "(Rp)"}</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.value || ""}
                      onChange={(e) => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Min. Pembelian (Rp)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.minPurchase || ""}
                      onChange={(e) => setForm(f => ({ ...f, minPurchase: parseFloat(e.target.value) || 0 }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Max. Diskon (Rp)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.maxDiscount || ""}
                      onChange={(e) => setForm(f => ({ ...f, maxDiscount: parseFloat(e.target.value) || 0 }))}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Batas Penggunaan</label>
                    <Input
                      type="number"
                      placeholder="Kosongkan = tak terbatas"
                      value={form.usageLimit || ""}
                      onChange={(e) => setForm(f => ({ ...f, usageLimit: parseInt(e.target.value) || 0 }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Per User</label>
                    <Input
                      type="number"
                      value={form.perUserLimit}
                      onChange={(e) => setForm(f => ({ ...f, perUserLimit: parseInt(e.target.value) || 1 }))}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Berlaku Dari</label>
                    <Input
                      type="date"
                      value={form.validFrom}
                      onChange={(e) => setForm(f => ({ ...f, validFrom: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Berlaku Sampai</label>
                    <Input
                      type="date"
                      value={form.validUntil}
                      onChange={(e) => setForm(f => ({ ...f, validUntil: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setShowAddForm(false)}>
                    Batal
                  </Button>
                  <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-10" onClick={handleCreate}>
                    Simpan Voucher
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voucher List */}
        <div className="space-y-2">
          {loading ? (
            <LoadingSpinner message="Memuat voucher..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Ticket className="w-10 h-10 text-muted-foreground" />}
              title="Voucher Tidak Ditemukan"
              subtitle="Coba kata kunci lain atau tambahkan voucher baru"
            />
          ) : (
            filtered.map((voucher, i) => {
              const vStatus = getVoucherStatus(voucher)
              return (
                <motion.div key={voucher.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                        {voucher.type === "percentage" ? (
                          <Percent className="w-4 h-4 text-orange-600" />
                        ) : (
                          <Banknote className="w-4 h-4 text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{voucher.name}</p>
                          <Badge variant="outline" className={`text-[9px] ${statusColorMap[vStatus]}`}>
                            {statusLabelMap[vStatus]}
                          </Badge>
                        </div>
                        <p className="text-xs font-mono text-orange-600 font-bold">{voucher.code}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {voucher.type === "percentage" ? `${voucher.value}%` : formatPrice(voucher.value)} diskon
                          </span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">
                            Min. {formatPrice(voucher.minPurchase)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {voucher.usageCount}/{voucher.usageLimit ?? "∞"} digunakan
                          </span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(voucher.validFrom)} - {formatDate(voucher.validUntil)}
                          </span>
                        </div>
                        {voucher.sellerStoreName && (
                          <p className="text-[10px] text-amber-600 mt-0.5">Seller: {voucher.sellerStoreName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] rounded-lg"
                        onClick={() => handleToggle(voucher.id, voucher.isActive)}
                      >
                        {voucher.isActive ? (
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
                          action: () => handleDelete(voucher.id),
                          title: 'Hapus Voucher',
                          message: `Apakah Anda yakin ingin menghapus voucher "${voucher.name}" (${voucher.code})? Tindakan ini tidak dapat dibatalkan.`
                        })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )
            })
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

// ==================== ADMIN DEPOSITS ====================
export function AdminDeposits() {
  const { showToast } = useAppStore()
  const [deposits, setDeposits] = useState<DepositItem[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  const fetchDeposits = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/deposits", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setDeposits(data.data)
      }
    } catch {
      showToast("Gagal memuat deposit", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchDeposits()
  }, [fetchDeposits])

  const filtered = deposits.filter(d => {
    return statusFilter === "all" || d.status === statusFilter
  })

  const pendingCount = deposits.filter(d => d.status === "pending").length
  const successCount = deposits.filter(d => d.status === "success").length
  const failedCount = deposits.filter(d => d.status === "failed").length

  const handleApprove = async (depositId: string) => {
    try {
      const res = await fetch("/api/admin/deposits", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ depositId, status: "success" }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Deposit disetujui - saldo ditambahkan", "success")
        fetchDeposits()
      } else {
        showToast(data.error || "Gagal menyetujui deposit", "error")
      }
    } catch {
      showToast("Gagal menyetujui deposit", "error")
    }
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    setConfirmAction({
      action: async () => {
        try {
          const res = await fetch("/api/admin/deposits", {
            method: "PUT",
            headers: getAuthHeaders(true),
            body: JSON.stringify({ depositId: showRejectModal, status: "failed", adminNote: rejectNote || "Ditolak oleh admin" }),
          })
          const data = await res.json()
          if (data.success) {
            showToast("Deposit ditolak", "info")
            setShowRejectModal(null)
            setRejectNote("")
            fetchDeposits()
          } else {
            showToast(data.error || "Gagal menolak deposit", "error")
          }
        } catch {
          showToast("Gagal menolak deposit", "error")
        }
      },
      title: 'Tolak Deposit',
      message: 'Apakah Anda yakin ingin menolak deposit ini? Dana tidak akan ditambahkan ke saldo user.'
    })
  }

  const methodLabel: Record<string, string> = {
    bank_transfer: "Transfer Bank",
    gopay: "GoPay",
    ovo: "OVO",
    dana: "DANA",
  }

  const methodEmoji: Record<string, string> = {
    bank_transfer: "🏦",
    gopay: "💳",
    ovo: "💜",
    dana: "🔵",
  }

  const statusLabelMap: Record<string, string> = {
    pending: "Pending",
    success: "Berhasil",
    failed: "Gagal",
  }

  const statusColorMap: Record<string, string> = {
    pending: "border-amber-300 text-amber-600",
    success: "border-emerald-300 text-emerald-600",
    failed: "border-red-300 text-red-600",
  }

  return (
    <div className="pb-20">
      <PageHeader title="Verifikasi Deposit" rightAction={
        <span className="text-xs text-muted-foreground">{pendingCount} pending</span>
      } />

      <div className="px-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <motion.div {...fadeIn} className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
            <p className="text-[10px] text-amber-600 font-medium">Pending</p>
          </motion.div>
          <motion.div {...fadeIn} className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{successCount}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Berhasil</p>
          </motion.div>
          <motion.div {...fadeIn} className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-600">{failedCount}</p>
            <p className="text-[10px] text-red-600 font-medium">Gagal</p>
          </motion.div>
        </div>

        {/* Total Pending Amount */}
        {pendingCount > 0 && (
          <motion.div {...fadeIn}>
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Total Deposit Pending</p>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                    {formatPrice(deposits.filter(d => d.status === "pending").reduce((sum, d) => sum + d.amount, 0))}
                  </p>
                </div>
                <Wallet className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "pending", label: "Pending" },
            { key: "success", label: "Berhasil" },
            { key: "failed", label: "Gagal" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === filter.key
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Deposit List */}
        <div className="space-y-3">
          {loading ? (
            <LoadingSpinner message="Memuat deposit..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Deposit"
              subtitle="Semua deposit sudah diproses"
            />
          ) : (
            filtered.map((deposit, i) => (
              <motion.div key={deposit.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{deposit.userName}</p>
                        <Badge variant="outline" className={`text-[10px] ${statusColorMap[deposit.status]}`}>
                          {statusLabelMap[deposit.status]}
                        </Badge>
                      </div>
                      <p className="text-base font-bold text-foreground mt-0.5">{formatPrice(deposit.amount)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(deposit.createdAt)}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Metode</span>
                      <span className="text-xs font-medium text-foreground">
                        {methodEmoji[deposit.method] || "💰"} {methodLabel[deposit.method] || deposit.method}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Email</span>
                      <span className="text-xs text-foreground">{deposit.userEmail}</span>
                    </div>
                    {deposit.proofUrl && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Bukti Transfer</span>
                        <a
                          href={deposit.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-cyan-600 hover:text-cyan-700 flex items-center gap-0.5"
                        >
                          Lihat <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {deposit.adminNote && (
                      <div className="flex items-start gap-1.5 mt-1 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                        <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">{deposit.adminNote}</span>
                      </div>
                    )}
                  </div>
                  {deposit.status === "pending" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleApprove(deposit.id)}
                      >
                        <Check className="w-3 h-3 mr-1" /> Setujui
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setShowRejectModal(deposit.id)}
                      >
                        <X className="w-3 h-3 mr-1" /> Tolak
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
            onClick={() => { setShowRejectModal(null); setRejectNote("") }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-base font-bold">Tolak Deposit?</h3>
                <p className="text-sm text-muted-foreground">Dana tidak akan ditambahkan ke saldo pengguna</p>
              </div>
              <Input
                placeholder="Alasan penolakan (opsional)"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="rounded-xl"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl"
                  onClick={() => { setShowRejectModal(null); setRejectNote("") }}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleReject}
                >
                  Tolak
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

// ==================== ADMIN CAMPAIGNS ====================
export function AdminCampaigns() {
  const { showToast } = useAppStore()
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/campaigns", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setCampaigns(data.data)
      }
    } catch {
      showToast("Gagal memuat kampanye", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const getCampaignStatus = (c: CampaignItem): string => {
    if (!c.isActive) return "inactive"
    if (c.isExpired) return "expired"
    if (c.isUpcoming) return "upcoming"
    return "active"
  }

  const filtered = campaigns.filter(c => {
    return statusFilter === "all" || getCampaignStatus(c) === statusFilter
  })

  const handleToggleActive = async (campaignId: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ campaignId, isActive: !isActive }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(isActive ? "Kampanye dinonaktifkan" : "Kampanye diaktifkan", "success")
        fetchCampaigns()
      } else {
        showToast(data.error || "Gagal memperbarui kampanye", "error")
      }
    } catch {
      showToast("Gagal memperbarui kampanye", "error")
    }
  }

  const typeLabel: Record<string, string> = {
    flash_sale: "Flash Sale",
    banner: "Banner",
    boost: "Boost",
  }

  const typeColor: Record<string, string> = {
    flash_sale: "bg-orange-50 dark:bg-orange-900/30 text-orange-600",
    banner: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600",
    boost: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600",
  }

  const typeIcon: Record<string, React.ReactNode> = {
    flash_sale: <Zap className="w-4 h-4" />,
    banner: <ImageIcon className="w-4 h-4" />,
    boost: <TrendingUp className="w-4 h-4" />,
  }

  const statusLabelMap: Record<string, string> = {
    active: "Aktif",
    inactive: "Nonaktif",
    expired: "Kedaluwarsa",
    upcoming: "Akan Datang",
  }

  const statusColorMap: Record<string, string> = {
    active: "border-emerald-300 text-emerald-600",
    inactive: "border-gray-300 text-gray-500",
    expired: "border-red-300 text-red-600",
    upcoming: "border-amber-300 text-amber-600",
  }

  return (
    <div className="pb-20">
      <PageHeader title="Moderasi Kampanye" rightAction={
        <span className="text-xs text-muted-foreground">{campaigns.filter(c => getCampaignStatus(c) === "active").length} aktif</span>
      } />

      <div className="px-4 space-y-4">
        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Aktif" },
            { key: "inactive", label: "Nonaktif" },
            { key: "expired", label: "Kedaluwarsa" },
            { key: "upcoming", label: "Akan Datang" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === filter.key
                  ? "bg-cyan-600 text-white border-cyan-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Campaign List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="w-10 h-10 text-muted-foreground" />}
              title="Kampanye Tidak Ditemukan"
              subtitle="Tidak ada kampanye dengan filter ini"
            />
          ) : (
            filtered.map((campaign, i) => {
              const cStatus = getCampaignStatus(campaign)
              const tColor = typeColor[campaign.type] || "bg-muted text-muted-foreground"
              return (
                <motion.div key={campaign.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tColor}`}>
                        {typeIcon[campaign.type] || <Megaphone className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{campaign.name}</p>
                          <Badge variant="outline" className={`text-[9px] ${statusColorMap[cStatus]}`}>
                            {statusLabelMap[cStatus]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-600">
                            {typeLabel[campaign.type] || campaign.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Diskon {campaign.discount}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Store className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{campaign.sellerStoreName}</span>
                          {campaign.sellerVerified && (
                            <Check className="w-3 h-3 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] rounded-lg"
                        onClick={() => setSelectedCampaign(campaign)}
                      >
                        <Eye className="w-3 h-3 mr-0.5" /> Detail
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] rounded-lg"
                        onClick={() => setConfirmAction({
                          action: () => handleToggleActive(campaign.id, campaign.isActive),
                          title: campaign.isActive ? 'Nonaktifkan Kampanye' : 'Aktifkan Kampanye',
                          message: campaign.isActive
                            ? `Apakah Anda yakin ingin menonaktifkan kampanye "${campaign.name}"? Kampanye tidak akan terlihat oleh pembeli.`
                            : `Apakah Anda yakin ingin mengaktifkan kampanye "${campaign.name}"? Kampanye akan terlihat oleh pembeli.`
                        })}
                      >
                        {campaign.isActive ? (
                          <><Ban className="w-3 h-3 mr-0.5" /> Tolak</>
                        ) : (
                          <><Check className="w-3 h-3 mr-0.5" /> Setujui</>
                        )}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Campaign Detail Modal */}
      <AnimatePresence>
        {selectedCampaign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setSelectedCampaign(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-2xl p-6 w-full max-w-md max-h-[70vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{selectedCampaign.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={`text-[10px] ${statusColorMap[getCampaignStatus(selectedCampaign)]}`}>
                      {statusLabelMap[getCampaignStatus(selectedCampaign)]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">
                      {typeLabel[selectedCampaign.type] || selectedCampaign.type}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Seller</span>
                    <span className="text-xs font-medium text-foreground">{selectedCampaign.sellerStoreName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Diskon</span>
                    <span className="text-xs font-bold text-orange-600">{selectedCampaign.discount}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Mulai</span>
                    <span className="text-xs text-foreground">{formatDate(selectedCampaign.startDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Berakhir</span>
                    <span className="text-xs text-foreground">{formatDate(selectedCampaign.endDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status Aktif</span>
                    <span className={`text-xs font-medium ${selectedCampaign.isActive ? "text-emerald-600" : "text-gray-500"}`}>
                      {selectedCampaign.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      if (!selectedCampaign.isActive) {
                        setConfirmAction({
                          action: () => handleToggleActive(selectedCampaign.id, false),
                          title: 'Aktifkan Kampanye',
                          message: `Apakah Anda yakin ingin mengaktifkan kampanye "${selectedCampaign.name}"? Kampanye akan terlihat oleh pembeli.`
                        })
                      }
                      setSelectedCampaign(null)
                    }}
                  >
                    <Check className="w-4 h-4 mr-1" /> Setujui
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => {
                      if (selectedCampaign.isActive) {
                        setConfirmAction({
                          action: () => handleToggleActive(selectedCampaign.id, true),
                          title: 'Nonaktifkan Kampanye',
                          message: `Apakah Anda yakin ingin menonaktifkan kampanye "${selectedCampaign.name}"? Kampanye tidak akan terlihat oleh pembeli.`
                        })
                      }
                      setSelectedCampaign(null)
                    }}
                  >
                    <X className="w-4 h-4 mr-1" /> Tolak
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

// ==================== ADMIN SETTINGS ====================
export function AdminSettings() {
  const { showToast, fetchPlatformSettings } = useAppStore()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/settings", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        // Sync to global store so other components (checkout, etc.) can use settings
        fetchPlatformSettings()
      }
    } catch {
      showToast("Gagal memuat pengaturan", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast, fetchPlatformSettings])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    if (!settings) return
    try {
      setSaving(true)
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Pengaturan berhasil disimpan", "success")
        setSettings(data.data)
        // Sync updated settings to global store
        fetchPlatformSettings()
      } else {
        showToast(data.error || "Gagal menyimpan pengaturan", "error")
      }
    } catch {
      showToast("Gagal menyimpan pengaturan", "error")
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof PlatformSettings, value: number | boolean) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  if (loading) {
    return (
      <div className="pb-20">
        <PageHeader title="Pengaturan Platform" />
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="pb-20">
      <PageHeader title="Pengaturan Platform" showBack={true} />

      <div className="px-4 space-y-4 pt-2">
        {/* Financial Settings */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Keuangan" icon={<Banknote className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Komisi Platform</p>
                <p className="text-[10px] text-muted-foreground">Persentase dari setiap transaksi</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={settings.commissionRate}
                  onChange={(e) => updateSetting("commissionRate", parseFloat(e.target.value) || 0)}
                  className="w-20 h-8 text-center text-sm rounded-lg"
                  min={0}
                  max={100}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Min. Penarikan</p>
                <p className="text-[10px] text-muted-foreground">Jumlah minimum untuk penarikan</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  type="number"
                  value={settings.minWithdrawal}
                  onChange={(e) => updateSetting("minWithdrawal", parseFloat(e.target.value) || 0)}
                  className="w-28 h-8 text-center text-sm rounded-lg"
                  min={0}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Biaya Platform</p>
                <p className="text-[10px] text-muted-foreground">Biaya per transaksi</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  type="number"
                  value={settings.platformFee}
                  onChange={(e) => updateSetting("platformFee", parseFloat(e.target.value) || 0)}
                  className="w-28 h-8 text-center text-sm rounded-lg"
                  min={0}
                />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Product Limits */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Batas Produk" icon={<Box className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Maks. Gambar Produk</p>
                <p className="text-[10px] text-muted-foreground">Jumlah gambar per produk</p>
              </div>
              <Input
                type="number"
                value={settings.maxProductImages}
                onChange={(e) => updateSetting("maxProductImages", parseInt(e.target.value) || 1)}
                className="w-20 h-8 text-center text-sm rounded-lg"
                min={1}
                max={20}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Maks. Varian Produk</p>
                <p className="text-[10px] text-muted-foreground">Jumlah varian per produk</p>
              </div>
              <Input
                type="number"
                value={settings.maxProductVariants}
                onChange={(e) => updateSetting("maxProductVariants", parseInt(e.target.value) || 1)}
                className="w-20 h-8 text-center text-sm rounded-lg"
                min={1}
                max={20}
              />
            </div>
          </Card>
        </motion.div>

        {/* Feature Toggles */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Fitur Platform" icon={<ToggleLeft className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            {[
              { key: "voucherEnabled" as const, label: "Voucher", desc: "Aktifkan sistem voucher" },
              { key: "depositEnabled" as const, label: "Deposit", desc: "Aktifkan top-up saldo" },
              { key: "campaignEnabled" as const, label: "Kampanye", desc: "Aktifkan kampanye seller" },
              { key: "flashSaleEnabled" as const, label: "Flash Sale", desc: "Aktifkan fitur flash sale" },
              { key: "chatEnabled" as const, label: "Chat", desc: "Aktifkan fitur chat" },
              { key: "reviewEnabled" as const, label: "Review", desc: "Aktifkan ulasan produk" },
            ].map((item, idx) => (
              <div key={item.key}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={settings[item.key] as boolean}
                    onCheckedChange={(checked) => updateSetting(item.key, checked)}
                  />
                </div>
                {idx < 5 && <Separator className="mt-4" />}
              </div>
            ))}
          </Card>
        </motion.div>

        {/* Rewards */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Hadiah & Loyalitas" icon={<Gift className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Hadiah Referral</p>
                <p className="text-[10px] text-muted-foreground">Bonus untuk undangan berhasil</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  type="number"
                  value={settings.referralReward}
                  onChange={(e) => updateSetting("referralReward", parseFloat(e.target.value) || 0)}
                  className="w-28 h-8 text-center text-sm rounded-lg"
                  min={0}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Rate Poin Loyalitas</p>
                <p className="text-[10px] text-muted-foreground">Poin per Rp10.000 pembelanjaan</p>
              </div>
              <Input
                type="number"
                value={settings.loyaltyPointsRate}
                onChange={(e) => updateSetting("loyaltyPointsRate", parseFloat(e.target.value) || 0)}
                className="w-20 h-8 text-center text-sm rounded-lg"
                min={0}
              />
            </div>
          </Card>
        </motion.div>

        {/* Order Settings */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pengaturan Pesanan" icon={<Clock className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Auto Konfirmasi</p>
                <p className="text-[10px] text-muted-foreground">Otomatis konfirmasi setelah (hari)</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={settings.autoConfirmDays}
                  onChange={(e) => updateSetting("autoConfirmDays", parseInt(e.target.value) || 1)}
                  className="w-20 h-8 text-center text-sm rounded-lg"
                  min={1}
                  max={30}
                />
                <span className="text-xs text-muted-foreground">hari</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Jendela Pengembalian</p>
                <p className="text-[10px] text-muted-foreground">Batas waktu pengembalian setelah terima</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={settings.returnWindowDays}
                  onChange={(e) => updateSetting("returnWindowDays", parseInt(e.target.value) || 1)}
                  className="w-20 h-8 text-center text-sm rounded-lg"
                  min={1}
                  max={30}
                />
                <span className="text-xs text-muted-foreground">hari</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Global Save Button */}
        <motion.div {...fadeIn}>
          <Button
            className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
