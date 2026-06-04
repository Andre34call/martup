"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Building2, Plus, Pencil, Trash2, Star, Check, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { useAppStore } from "@/lib/store"
import { apiClient, ApiClientError } from "@/lib/api-client"
import { SectionHeader } from "../shared"
import { fadeIn } from "@/lib/animations"
import { useState, useEffect, useCallback } from "react"

// ==================== TYPE DEFINITIONS ====================
interface PlatformBankAccount {
  id: string
  bankName: string
  bankCode: string | null
  accountNumber: string
  accountHolder: string
  branch: string | null
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ==================== TYPE ALIASES (avoid TSX generic ambiguity) ====================
type BankAccountListResponse = { success: boolean; data: PlatformBankAccount[]; error?: string }
type BankAccountMutationResponse = { success: boolean; data: PlatformBankAccount; error?: string }

// ==================== COMMON BANKS ====================
const COMMON_BANKS = [
  { name: "BCA", code: "014", color: "#003399" },
  { name: "Mandiri", code: "008", color: "#003366" },
  { name: "BNI", code: "009", color: "#F15A22" },
  { name: "BRI", code: "002", color: "#00529C" },
  { name: "BSI", code: "451", color: "#006B3F" },
  { name: "CIMB", code: "022", color: "#7B0E24" },
  { name: "Danamon", code: "011", color: "#FDDA24" },
  { name: "Permata", code: "013", color: "#005BAA" },
  { name: "OCBC", code: "702", color: "#E31937" },
  { name: "Panin", code: "019", color: "#006341" },
] as const

// ==================== HELPERS ====================
function getBankColor(bankName: string): string {
  const match = COMMON_BANKS.find(
    (b) => b.name.toLowerCase() === bankName.toLowerCase()
  )
  return match?.color || "#6B7280"
}

function getBankCode(bankName: string): string | undefined {
  const match = COMMON_BANKS.find(
    (b) => b.name.toLowerCase() === bankName.toLowerCase()
  )
  return match?.code
}

function formatAccountNumber(accountNumber: string): string {
  // Format: groups of 4 digits for readability
  return accountNumber.replace(/(.{4})/g, "$1 ").trim()
}

// ==================== FORM STATE ====================
interface BankAccountForm {
  bankName: string
  bankCode: string
  accountNumber: string
  accountHolder: string
  branch: string
  sortOrder: number
  isDefault: boolean
  isActive: boolean
}

const emptyForm: BankAccountForm = {
  bankName: "",
  bankCode: "",
  accountNumber: "",
  accountHolder: "",
  branch: "",
  sortOrder: 0,
  isDefault: false,
  isActive: true,
}

// ==================== PLATFORM BANK ACCOUNTS COMPONENT ====================
export function PlatformBankAccounts() {
  const { showToast } = useAppStore()
  const [bankAccounts, setBankAccounts] = useState<PlatformBankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BankAccountForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ==================== FETCH ====================
  const fetchBankAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<BankAccountListResponse>("/api/admin/bank-accounts")
      if (data.success) {
        setBankAccounts(data.data)
      }
    } catch {
      showToast("Gagal memuat rekening bank", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchBankAccounts()
  }, [fetchBankAccounts])

  // ==================== HANDLERS ====================
  const handleAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const handleEdit = (account: PlatformBankAccount) => {
    setEditingId(account.id)
    setForm({
      bankName: account.bankName,
      bankCode: account.bankCode || "",
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      branch: account.branch || "",
      sortOrder: account.sortOrder,
      isDefault: account.isDefault,
      isActive: account.isActive,
    })
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.bankName.trim()) {
      showToast("Nama bank wajib diisi", "error")
      return
    }
    if (!form.accountNumber.trim()) {
      showToast("Nomor rekening wajib diisi", "error")
      return
    }
    if (!form.accountHolder.trim()) {
      showToast("Nama pemilik rekening wajib diisi", "error")
      return
    }

    try {
      setSaving(true)
      const payload = {
        bankName: form.bankName.trim(),
        bankCode: form.bankCode.trim() || undefined,
        accountNumber: form.accountNumber.trim(),
        accountHolder: form.accountHolder.trim(),
        branch: form.branch.trim() || undefined,
        sortOrder: form.sortOrder,
        isDefault: form.isDefault,
        isActive: form.isActive,
      }

      if (editingId) {
        const data = await apiClient.put<BankAccountMutationResponse>(
          `/api/admin/bank-accounts/${editingId}`,
          payload
        )
        if (data.success) {
          showToast("Rekening berhasil diperbarui", "success")
        } else {
          showToast(data.error || "Gagal memperbarui rekening", "error")
          return
        }
      } else {
        const data = await apiClient.post<BankAccountMutationResponse>(
          "/api/admin/bank-accounts",
          payload
        )
        if (data.success) {
          showToast("Rekening berhasil ditambahkan", "success")
        } else {
          showToast(data.error || "Gagal menambahkan rekening", "error")
          return
        }
      }

      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      fetchBankAccounts()
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : "Gagal menyimpan rekening",
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (account: PlatformBankAccount) => {
    if (account.isDefault) return
    try {
      const data = await apiClient.put<BankAccountMutationResponse>(
        `/api/admin/bank-accounts/${account.id}`,
        { isDefault: true }
      )
      if (data.success) {
        showToast("Rekening default berhasil diubah", "success")
        fetchBankAccounts()
      } else {
        showToast(data.error || "Gagal mengubah rekening default", "error")
      }
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : "Gagal mengubah rekening default",
        "error"
      )
    }
  }

  const handleToggleActive = async (account: PlatformBankAccount) => {
    try {
      const data = await apiClient.put<BankAccountMutationResponse>(
        `/api/admin/bank-accounts/${account.id}`,
        { isActive: !account.isActive }
      )
      if (data.success) {
        showToast(
          account.isActive ? "Rekening dinonaktifkan" : "Rekening diaktifkan",
          "success"
        )
        fetchBankAccounts()
      } else {
        showToast(data.error || "Gagal mengubah status rekening", "error")
      }
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : "Gagal mengubah status rekening",
        "error"
      )
    }
  }

  const handleDelete = async (account: PlatformBankAccount) => {
    try {
      setDeletingId(account.id)
      const data = await apiClient.del<BankAccountMutationResponse>(
        `/api/admin/bank-accounts/${account.id}`
      )
      if (data.success) {
        showToast("Rekening berhasil dihapus", "success")
        fetchBankAccounts()
      } else {
        showToast(data.error || "Gagal menghapus rekening", "error")
      }
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : "Gagal menghapus rekening",
        "error"
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleBankNameSelect = (value: string) => {
    const code = getBankCode(value) || ""
    setForm((prev) => ({ ...prev, bankName: value, bankCode: code }))
  }

  // ==================== RENDER ====================
  return (
    <motion.div {...fadeIn}>
      <SectionHeader title="Rekening MartUp" icon={<Building2 className="w-4 h-4" />} />

      {/* Add Button */}
      <div className="mt-3">
        <Button
          onClick={handleAdd}
          className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
          disabled={showForm && !editingId}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Rekening
        </Button>
      </div>

      {/* Inline Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <Card className="mt-3 p-4 space-y-3 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {editingId ? "Edit Rekening" : "Rekening Baru"}
                </p>
                <button
                  onClick={handleCancel}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Bank Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Nama Bank *
                </label>
                <Select
                  value={form.bankName}
                  onValueChange={handleBankNameSelect}
                >
                  <SelectTrigger className="w-full h-9 text-sm rounded-lg">
                    <SelectValue placeholder="Pilih bank..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_BANKS.map((bank) => (
                      <SelectItem key={bank.name} value={bank.name}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: bank.color }}
                          />
                          {bank.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bank Code */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Kode Bank
                </label>
                <Input
                  value={form.bankCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, bankCode: e.target.value }))}
                  placeholder="Opsional"
                  className="h-9 text-sm rounded-lg"
                />
              </div>

              {/* Account Number */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Nomor Rekening *
                </label>
                <Input
                  value={form.accountNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                  placeholder="Masukkan nomor rekening"
                  className="h-9 text-sm rounded-lg"
                />
              </div>

              {/* Account Holder */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Nama Pemilik Rekening *
                </label>
                <Input
                  value={form.accountHolder}
                  onChange={(e) => setForm((prev) => ({ ...prev, accountHolder: e.target.value }))}
                  placeholder="Masukkan nama pemilik"
                  className="h-9 text-sm rounded-lg"
                />
              </div>

              {/* Branch */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Cabang
                </label>
                <Input
                  value={form.branch}
                  onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
                  placeholder="Opsional"
                  className="h-9 text-sm rounded-lg"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Urutan
                </label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))
                  }
                  className="h-9 text-sm rounded-lg w-20"
                  min={0}
                />
              </div>

              <Separator />

              {/* Toggles */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Rekening Default</p>
                  <p className="text-[10px] text-muted-foreground">Ditampilkan utama ke pembeli</p>
                </div>
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Aktif</p>
                  <p className="text-[10px] text-muted-foreground">Rekening dapat digunakan</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {saving ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="h-9 rounded-lg text-sm px-4"
                >
                  Batal
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bank Account List */}
      <div className="mt-3 space-y-3">
        {loading ? (
          <Card className="p-4">
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </Card>
        ) : bankAccounts.length === 0 ? (
          <Card className="p-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Belum ada rekening bank
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Tambahkan rekening untuk menerima pembayaran
              </p>
            </div>
          </Card>
        ) : (
          bankAccounts.map((account) => {
            const bankColor = getBankColor(account.bankName)
            return (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Bank Color Indicator */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs"
                      style={{ backgroundColor: bankColor }}
                    >
                      {account.bankName.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Bank Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">
                          {account.bankName}
                        </p>
                        {/* Status Badges */}
                        {account.isDefault && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Star className="w-2.5 h-2.5" />
                            Default
                          </span>
                        )}
                        {account.isActive ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            Nonaktif
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-foreground mt-0.5 font-mono tracking-wide">
                        {formatAccountNumber(account.accountNumber)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        a/n {account.accountHolder}
                      </p>
                      {account.branch && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          Cabang: {account.branch}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEdit(account)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    <button
                      onClick={() => handleSetDefault(account)}
                      disabled={account.isDefault}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                        account.isDefault
                          ? "cursor-default"
                          : "hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      }`}
                      title={account.isDefault ? "Sudah default" : "Set sebagai default"}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          account.isDefault
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => handleToggleActive(account)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                        account.isActive
                          ? "hover:bg-red-50 dark:hover:bg-red-950/30"
                          : "hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      }`}
                      title={account.isActive ? "Nonaktifkan" : "Aktifkan"}
                    >
                      <Switch
                        checked={account.isActive}
                        className="scale-75 origin-center"
                      />
                    </button>

                    <div className="flex-1" />

                    <button
                      onClick={() => handleDelete(account)}
                      disabled={deletingId === account.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Hapus"
                    >
                      {deletingId === account.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </button>
                  </div>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}
