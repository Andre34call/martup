"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Ticket, Plus, Check, Ban, Trash2, Percent, Banknote
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatDate } from "@/lib/utils"
import { stagger } from '@/lib/animations'
import { PageHeader, SectionHeader, SearchBar, EmptyState } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { LoadingSpinner } from "../loading-spinner"
import { apiClient, ApiClientError } from '@/lib/api-client'

// ==================== TYPE DEFINITIONS ====================
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

// ==================== TYPE ALIASES (avoid TSX generic ambiguity) ====================
type VoucherListResponse = { success: boolean; data: VoucherItem[]; error?: string }
type VoucherMutationResponse = { success: boolean; error?: string }

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
      const data = await apiClient.get<VoucherListResponse>("/api/admin/vouchers")
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
      const data = await apiClient.post<VoucherMutationResponse>("/api/admin/vouchers", {
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
      })
      if (data.success) {
        showToast("Voucher berhasil ditambahkan", "success")
        setShowAddForm(false)
        setForm({ code: "", name: "", type: "percentage", value: 0, minPurchase: 0, maxDiscount: 0, usageLimit: 0, perUserLimit: 1, validFrom: "", validUntil: "" })
        fetchVouchers()
      } else {
        showToast(data.error || "Gagal menambahkan voucher", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal menambahkan voucher", "error")
    }
  }

  const handleToggle = async (voucherId: string, isActive: boolean) => {
    try {
      const data = await apiClient.put<VoucherMutationResponse>("/api/admin/vouchers", { voucherId, isActive: !isActive })
      if (data.success) {
        showToast(isActive ? "Voucher dinonaktifkan" : "Voucher diaktifkan", "success")
        fetchVouchers()
      } else {
        showToast(data.error || "Gagal memperbarui voucher", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal memperbarui voucher", "error")
    }
  }

  const handleDelete = async (voucherId: string) => {
    try {
      const data = await apiClient.del<VoucherMutationResponse>("/api/admin/vouchers", { voucherId })
      if (data.success) {
        showToast("Voucher berhasil dihapus", "success")
        fetchVouchers()
      } else {
        showToast(data.error || "Gagal menghapus voucher", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal menghapus voucher", "error")
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
