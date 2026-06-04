"use client"

import { motion } from "framer-motion"
import { Plus, Store, Truck, Calendar, Banknote, MessageCircle, AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAppStore } from "@/lib/store"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader } from "../shared"
import { type AuthMeResponse } from "./shared"
import { useState } from "react"

export function SellerSettings() {
  const { showToast, seller, deleteAccount, logout } = useAppStore()
  const [storeName, setStoreName] = useState(seller?.storeName || "My Store")
  const [storeDesc, setStoreDesc] = useState(seller?.storeDesc || "")
  const [storeAddress, setStoreAddress] = useState(seller?.storeAddress || "")
  const [storeCity, setStoreCity] = useState(seller?.storeCity || "")
  const [storeProvince, setStoreProvince] = useState(seller?.storeProvince || "")
  const [storePostalCode, setStorePostalCode] = useState(seller?.storePostalCode || "")
  const [autoReplyMsg, setAutoReplyMsg] = useState(seller?.autoReply || "Terima kasih sudah menghubungi kami. Kami akan membalas pesan Anda secepatnya.")
  const [bankAccount, setBankAccount] = useState(seller?.bankAccount || "")
  const [bankName, setBankName] = useState(seller?.bankName || "")
  const [bankHolder, setBankHolder] = useState(seller?.bankHolder || "")
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await apiClient.rawPut('/api/seller/profile', {
        storeName,
        storeDesc,
        storeAddress,
        storeCity,
        storeProvince,
        storePostalCode,
        autoReply: autoReplyMsg,
        bankAccount,
        bankName,
        bankHolder,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan')
      }
      showToast("Pengaturan berhasil disimpan!", "success")
    } catch (err: unknown) {
      const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan pengaturan'
      showToast(message, "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      const data = await apiClient.get<AuthMeResponse>('/api/auth/me')
      if (data?.user?.id) {
        await apiClient.rawDelete('/api/admin/users', { userId: data.user.id })
      }
    } catch {
      // Best effort server-side cleanup
    }
    deleteAccount()
    showToast("Akun berhasil dihapus", "success")
  }

  return (
    <div className="pb-20">
      <PageHeader title="Pengaturan Toko" />

      <div className="px-4 space-y-4">
        {/* Store Profile */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Profil Toko" icon={<Store className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nama Toko <span className="text-red-500">*</span></label>
              <Input value={storeName} onChange={e => setStoreName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Deskripsi Toko</label>
              <textarea
                value={storeDesc}
                onChange={e => setStoreDesc(e.target.value)}
                className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Alamat Toko (Asal Pengiriman)</label>
              <textarea
                value={storeAddress}
                onChange={e => setStoreAddress(e.target.value)}
                className="w-full min-h-[60px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                placeholder="Alamat jalan, nomor rumah, gedung, dll."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Kota</label>
                <Input value={storeCity} onChange={e => setStoreCity(e.target.value)} className="rounded-xl" placeholder="Jakarta" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Kode Pos</label>
                <Input value={storePostalCode} onChange={e => setStorePostalCode(e.target.value)} className="rounded-xl" placeholder="12345" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Provinsi</label>
              <Input value={storeProvince} onChange={e => setStoreProvince(e.target.value)} className="rounded-xl" placeholder="DKI Jakarta" />
            </div>
          </Card>
        </motion.div>

        {/* Store Banner */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Banner Toko" icon={<Calendar className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="h-32 rounded-xl bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
              <Plus className="w-8 h-8 text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Upload Banner</p>
              <p className="text-[10px] text-muted-foreground">1200 x 400 px</p>
            </div>
          </Card>
        </motion.div>

        {/* Bank Account */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Rekening Bank" icon={<Banknote className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nama Bank <span className="text-red-500">*</span></label>
              <Input value={bankName} onChange={e => setBankName(e.target.value)} className="rounded-xl" placeholder="Contoh: BCA" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nomor Rekening <span className="text-red-500">*</span></label>
              <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="rounded-xl" placeholder="Nomor rekening" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nama Pemilik <span className="text-red-500">*</span></label>
              <Input value={bankHolder} onChange={e => setBankHolder(e.target.value)} className="rounded-xl" placeholder="Nama sesuai rekening" />
            </div>
          </Card>
        </motion.div>

        {/* Shipping Settings */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pengiriman" icon={<Truck className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            {["JNE", "SiCepat", "J&T", "AnterAja"].map((courier) => (
              <div key={courier} className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">{courier}</span>
                <Switch defaultChecked={courier !== "AnterAja"} />
              </div>
            ))}
          </Card>
        </motion.div>

        {/* Auto-Reply Message */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pesan Auto-Reply" icon={<MessageCircle className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            <textarea
              value={autoReplyMsg}
              onChange={e => setAutoReplyMsg(e.target.value)}
              className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </Card>
        </motion.div>

        {/* Save Button */}
        <motion.div {...fadeIn}>
          <Button className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-11" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </motion.div>

        {/* Danger Zone - Delete Account */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Zona Bahaya" icon={<AlertTriangle className="w-4 h-4 text-red-500" />} />
          <Card className="mt-3 p-4 border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Hapus Akun Penjual</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tindakan ini tidak dapat dibatalkan. Semua data toko, produk, dan riwayat penjualan akan dihapus.</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-3 h-10 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/50 rounded-xl"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Hapus Akun
            </Button>
          </Card>
        </motion.div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600">Hapus Akun Penjual?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            Apakah Anda yakin ingin menghapus akun? Semua data toko, produk, pesanan, dan riwayat penjualan akan dihapus secara permanen. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
          </p>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={() => {
                handleDeleteAccount()
                setShowDeleteDialog(false)
              }}
              className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl h-10 flex-1"
            >
              Ya, Hapus Akun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
