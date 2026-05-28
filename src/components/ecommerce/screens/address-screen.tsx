"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { PageHeader, SectionHeader } from "../shared"
import { useState } from "react"
import { Plus, Edit, Trash2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

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

export function AddressScreen() {
  const { addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress, showToast } = useAppStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formLabel, setFormLabel] = useState("")
  const [formRecipient, setFormRecipient] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formCity, setFormCity] = useState("")
  const [formProvince, setFormProvince] = useState("")
  const [formPostalCode, setFormPostalCode] = useState("")

  const resetForm = () => {
    setFormLabel("")
    setFormRecipient("")
    setFormPhone("")
    setFormAddress("")
    setFormCity("")
    setFormProvince("")
    setFormPostalCode("")
    setEditingId(null)
  }

  const handleEdit = (addr: typeof addresses[0]) => {
    setEditingId(addr.id)
    setFormLabel(addr.label)
    setFormRecipient(addr.recipient)
    setFormPhone(addr.phone)
    setFormAddress(addr.address)
    setFormCity(addr.city)
    setFormProvince(addr.province)
    setFormPostalCode(addr.postalCode)
    setShowAddForm(true)
  }

  const [isSaving, setIsSaving] = useState(false)

  const handleSaveAddress = async () => {
    if (!formLabel.trim() || !formRecipient.trim() || !formPhone.trim() || !formAddress.trim() || !formCity.trim() || !formProvince.trim() || !formPostalCode.trim()) {
      showToast("Semua field wajib diisi", "error")
      return
    }

    // Validate phone format (Indonesian: starts with 0 or +62, 10-15 digits)
    const phoneDigits = formPhone.replace(/[^\d+]/g, '')
    if (!/^(0\d{9,14}|\+62\d{9,14})$/.test(phoneDigits)) {
      showToast("Format nomor HP tidak valid (gunakan 08xx atau +628xx, 10-15 digit)", "error")
      return
    }

    // Validate postal code (exactly 5 digits)
    if (!/^\d{5}$/.test(formPostalCode.trim())) {
      showToast("Kode pos harus 5 digit angka", "error")
      return
    }

    setIsSaving(true)
    try {
      if (editingId) {
        const existingAddr = addresses.find(a => a.id === editingId)
        await updateAddress({
          id: editingId,
          label: formLabel,
          recipient: formRecipient,
          phone: formPhone,
          address: formAddress,
          city: formCity,
          province: formProvince,
          postalCode: formPostalCode,
          isDefault: existingAddr?.isDefault || false,
        })
        showToast("Alamat berhasil diperbarui!", "success")
      } else {
        await addAddress({
          label: formLabel,
          recipient: formRecipient,
          phone: formPhone,
          address: formAddress,
          city: formCity,
          province: formProvince,
          postalCode: formPostalCode,
          isDefault: addresses.length === 0,
        })
        showToast("Alamat berhasil ditambahkan!", "success")
      }
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan alamat"
      showToast(message, "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultAddress(id)
      showToast("Alamat utama berhasil diubah!", "success")
    } catch {
      showToast("Gagal mengubah alamat utama", "error")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAddress(id)
      showToast("Alamat berhasil dihapus", "success")
    } catch {
      showToast("Gagal menghapus alamat", "error")
    }
  }

  const handleToggleAddForm = () => {
    if (showAddForm) {
      resetForm()
    }
    setShowAddForm(!showAddForm)
  }

  return (
    <div className="pb-24">
      <PageHeader title="Alamat" rightAction={
        <Button
          onClick={handleToggleAddForm}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> {editingId ? "Edit" : "Tambah"}
        </Button>
      } />

      <div className="px-4 space-y-4">
        {/* Address List */}
        <div className="space-y-3">
          {addresses.map((addr, i) => (
            <motion.div key={addr.id} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${addr.isDefault ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {addr.label}
                    </Badge>
                    {addr.isDefault && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Utama</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground mt-2">{addr.recipient}</p>
                <p className="text-xs text-muted-foreground">{addr.phone}</p>
                <p className="text-xs text-muted-foreground mt-1">{addr.address}, {addr.city}, {addr.province} {addr.postalCode}</p>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => handleEdit(addr)}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  {!addr.isDefault && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-emerald-600" onClick={() => handleSetDefault(addr.id)}>
                      Utamakan
                    </Button>
                  )}
                  {!addr.isDefault && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => handleDelete(addr.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Add/Edit Address Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <SectionHeader title={editingId ? "Edit Alamat" : "Tambah Alamat Baru"} icon={<Plus className="w-4 h-4" />} />
              <Card className="mt-3 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Label <span className="text-red-500">*</span></label>
                    <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Rumah" className="rounded-xl h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Penerima <span className="text-red-500">*</span></label>
                    <Input value={formRecipient} onChange={(e) => setFormRecipient(e.target.value)} placeholder="Nama" className="rounded-xl h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">No. Telepon <span className="text-red-500">*</span></label>
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="08123456789" className="rounded-xl h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Alamat Lengkap <span className="text-red-500">*</span></label>
                  <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Jl. ..." className="rounded-xl h-9" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Kota <span className="text-red-500">*</span></label>
                    <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="Jakarta" className="rounded-xl h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Provinsi <span className="text-red-500">*</span></label>
                    <Input value={formProvince} onChange={(e) => setFormProvince(e.target.value)} placeholder="DKI Jakarta" className="rounded-xl h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Kode Pos <span className="text-red-500">*</span></label>
                    <Input value={formPostalCode} onChange={(e) => setFormPostalCode(e.target.value)} placeholder="12345" className="rounded-xl h-9" />
                  </div>
                </div>
                <Button onClick={handleSaveAddress} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10">
                  Simpan Alamat
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
