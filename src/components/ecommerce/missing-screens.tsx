"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/mock-data"
import { PageHeader, SectionHeader, EmptyState, SearchBar, WalletBalanceCard } from "./shared"
import { useState } from "react"
import { Settings as SettingsIcon, Shield, Bell, Globe, Lock, Trash2, CreditCard, Ticket, Copy, Check, MapPin, Plus, Star, Camera, Send, RotateCcw, HelpCircle, ChevronDown, ChevronUp, MessageSquare, Phone, Heart, Store, Wallet, ArrowUpRight, Clock, Banknote, Edit, ChevronRight, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

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

// ==================== SETTINGS SCREEN ====================
export function SettingsScreen() {
  const { currentUser, showToast, logout } = useAppStore()
  const [twoFactor, setTwoFactor] = useState(false)
  const [pushNotif, setPushNotif] = useState(true)
  const [emailNotif, setEmailNotif] = useState(true)
  const [dataSharing, setDataSharing] = useState(false)

  const handleDeleteAccount = () => {
    if (confirm("Apakah kamu yakin ingin menghapus akun? Tindakan ini tidak bisa dibatalkan.")) {
      logout()
      showToast("Akun berhasil dihapus", "success")
    }
  }

  return (
    <div className="pb-24">
      <PageHeader title="Pengaturan" />

      <div className="px-4 space-y-4">
        {/* Account */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Akun" icon={<SettingsIcon className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Nama</p>
                <p className="text-sm font-medium text-foreground">{currentUser?.name || "Ahmad Fauzi"}</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => showToast("Fitur edit segera hadir!", "info")}>
                <Edit className="w-3 h-3 mr-1" /> Edit
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{currentUser?.email || "ahmad@email.com"}</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => showToast("Fitur edit segera hadir!", "info")}>
                <Edit className="w-3 h-3 mr-1" /> Edit
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">No. Telepon</p>
                <p className="text-sm font-medium text-foreground">{currentUser?.phone || "08123456789"}</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => showToast("Fitur edit segera hadir!", "info")}>
                <Edit className="w-3 h-3 mr-1" /> Edit
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Security */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Keamanan" icon={<Shield className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            <button className="w-full flex items-center justify-between py-1" onClick={() => showToast("Fitur ubah password segera hadir!", "info")}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-foreground">Ubah Password</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <Separator />
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Two-Factor Auth</span>
                  <p className="text-xs text-muted-foreground">Keamanan ekstra untuk akun</p>
                </div>
              </div>
              <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
            </div>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Notifikasi" icon={<Bell className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Push Notification</span>
                  <p className="text-xs text-muted-foreground">Notifikasi di perangkat</p>
                </div>
              </div>
              <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
            </div>
            <Separator />
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Email Notification</span>
                  <p className="text-xs text-muted-foreground">Notifikasi via email</p>
                </div>
              </div>
              <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
            </div>
          </Card>
        </motion.div>

        {/* Preferences */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Preferensi" icon={<Globe className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            <div className="flex items-center justify-between py-1 cursor-pointer" onClick={() => showToast("Fitur ini segera hadir!", "info")}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-cyan-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Bahasa</span>
                  <p className="text-xs text-muted-foreground">Indonesia</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <Separator />
            <div className="flex items-center justify-between py-1 cursor-pointer" onClick={() => showToast("Fitur ini segera hadir!", "info")}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Wilayah</span>
                  <p className="text-xs text-muted-foreground">Indonesia</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Card>
        </motion.div>

        {/* Privacy */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Privasi" icon={<Shield className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">Berbagi Data</span>
                  <p className="text-xs text-muted-foreground">Izinkan berbagi data untuk analitik</p>
                </div>
              </div>
              <Switch checked={dataSharing} onCheckedChange={setDataSharing} />
            </div>
          </Card>
        </motion.div>

        {/* Delete Account */}
        <motion.div {...fadeIn} className="pt-2 pb-4">
          <Button variant="outline" onClick={handleDeleteAccount} className="w-full h-11 rounded-xl text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="w-4 h-4 mr-2" /> Hapus Akun
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== VOUCHER SCREEN ====================
export function VoucherScreen() {
  const { vouchers, selectVoucher, showToast, goBack } = useAppStore()
  const [activeTab, setActiveTab] = useState("available")
  const [code, setCode] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const availableVouchers = vouchers.filter(v => v.isActive && new Date(v.validUntil) > new Date())
  const usedVouchers: typeof vouchers = []
  const expiredVouchers = vouchers.filter(v => new Date(v.validUntil) <= new Date())

  const displayed = activeTab === "available" ? availableVouchers : activeTab === "used" ? usedVouchers : expiredVouchers

  const handleCopy = (voucherCode: string, id: string) => {
    navigator.clipboard?.writeText(voucherCode)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleUseCode = () => {
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) {
      showToast("Masukkan kode voucher terlebih dahulu", "error")
      return
    }
    const found = vouchers.find(v => v.code.toUpperCase() === trimmedCode)
    if (found) {
      selectVoucher(found)
      showToast(`Voucher "${found.name}" berhasil dipakai!`, "success")
      goBack()
    } else {
      showToast("Kode voucher tidak valid", "error")
    }
  }

  const handleUseVoucher = (voucher: typeof vouchers[0]) => {
    selectVoucher(voucher)
    showToast(`Voucher "${voucher.name}" berhasil dipakai!`, "success")
    goBack()
  }

  return (
    <div className="pb-24">
      <PageHeader title="Voucher Saya" />

      <div className="px-4 space-y-4">
        {/* Code Input */}
        <motion.div {...fadeIn} className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Masukkan Kode"
            className="flex-1 rounded-xl h-10"
          />
          <Button onClick={handleUseCode} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10 px-5">
            Pakai
          </Button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: "available", label: "Tersedia", count: availableVouchers.length },
            { key: "used", label: "Digunakan", count: usedVouchers.length },
            { key: "expired", label: "Expired", count: expiredVouchers.length },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors border ${
                activeTab === tab.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {tab.label} ({tab.count})
            </motion.button>
          ))}
        </div>

        {/* Voucher List */}
        <div className="space-y-3">
          {displayed.length === 0 ? (
            <EmptyState
              icon={<Ticket className="w-10 h-10 text-muted-foreground" />}
              title={activeTab === "available" ? "Tidak Ada Voucher" : activeTab === "used" ? "Belum Ada Voucher Digunakan" : "Tidak Ada Voucher Expired"}
              subtitle="Voucher yang kamu dapatkan akan muncul di sini"
            />
          ) : (
            displayed.map((voucher, i) => (
              <motion.div key={voucher.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4 overflow-hidden relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                  <div className="pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{voucher.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{voucher.description}</p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                        {voucher.type === "percentage" ? `${voucher.value}%` : formatPrice(voucher.value)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs font-mono font-bold text-foreground tracking-wider">{voucher.code}</span>
                        <motion.button
                          whileTap={{ scale: 0.8 }}
                          onClick={() => handleCopy(voucher.code, voucher.id)}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          {copiedId === voucher.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </motion.button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-[10px] text-muted-foreground">
                        <span>Min. belanja {formatPrice(voucher.minPurchase)}</span>
                        <span className="mx-1">·</span>
                        <span>s/d {new Date(voucher.validUntil).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      <Button size="sm" onClick={() => handleUseVoucher(voucher)} className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white">
                        Gunakan
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== ADDRESS SCREEN ====================
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

  const handleSaveAddress = () => {
    if (!formLabel.trim() || !formRecipient.trim() || !formPhone.trim() || !formAddress.trim() || !formCity.trim() || !formProvince.trim() || !formPostalCode.trim()) {
      showToast("Semua field wajib diisi", "error")
      return
    }

    if (editingId) {
      const existingAddr = addresses.find(a => a.id === editingId)
      updateAddress({
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
      addAddress({
        id: `a${Date.now()}`,
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
  }

  const handleSetDefault = (id: string) => {
    setDefaultAddress(id)
    showToast("Alamat utama berhasil diubah!", "success")
  }

  const handleDelete = (id: string) => {
    deleteAddress(id)
    showToast("Alamat berhasil dihapus", "success")
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
                    <label className="text-xs font-medium text-foreground">Label</label>
                    <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Rumah" className="rounded-xl h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Penerima</label>
                    <Input value={formRecipient} onChange={(e) => setFormRecipient(e.target.value)} placeholder="Nama" className="rounded-xl h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">No. Telepon</label>
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="08123456789" className="rounded-xl h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Alamat Lengkap</label>
                  <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Jl. ..." className="rounded-xl h-9" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Kota</label>
                    <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="Jakarta" className="rounded-xl h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Provinsi</label>
                    <Input value={formProvince} onChange={(e) => setFormProvince(e.target.value)} placeholder="DKI Jakarta" className="rounded-xl h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Kode Pos</label>
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

// ==================== REVIEW SCREEN ====================
export function ReviewScreen() {
  const { showToast, goBack } = useAppStore()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [reviews, setReviews] = useState<Record<string, string>>({})

  const deliveredOrders = [
    { id: "r1", productName: "Kemeja Flannel Premium Cotton", price: 149000, seller: "Fashion Hub", image: "" },
    { id: "r2", productName: "Sneakers Nike Air Max 90", price: 999000, seller: "Sport Zone", image: "" },
  ]

  const submittedReviews = [
    { id: "s1", productName: "iPhone 15 Pro Max 256GB", rating: 5, content: "Produk bagus, pengiriman cepat!", date: "18 Des 2024" },
    { id: "s2", productName: "Diffuser Aromatherapy Minimalis", rating: 4, content: "Aromanya enak, desain cantik. Pengepengan sedikit kurang rapi.", date: "15 Des 2024" },
  ]

  const handleRating = (orderId: string, star: number) => {
    setRatings(prev => ({ ...prev, [orderId]: star }))
  }

  const handleSubmitReview = () => {
    showToast("Ulasan berhasil dikirim!", "success")
    goBack()
  }

  return (
    <div className="pb-24">
      <PageHeader title="Ulasan" />

      <div className="px-4 space-y-6">
        {/* Unreviewed */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Belum Diulas" icon={<Star className="w-4 h-4" />} />
          <div className="space-y-3 mt-3">
            {deliveredOrders.map((order, i) => (
              <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{order.productName}</p>
                      <p className="text-xs text-muted-foreground">{order.seller}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(order.price)}</p>
                    </div>
                  </div>

                  {/* Star Rating Input */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <motion.button
                        key={idx}
                        whileTap={{ scale: 0.8 }}
                        onClick={() => handleRating(order.id, idx + 1)}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${(ratings[order.id] || 0) >= idx + 1 ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
                        />
                      </motion.button>
                    ))}
                    <span className="text-xs text-muted-foreground ml-2">
                      {ratings[order.id] ? `${ratings[order.id]}/5` : "Pilih rating"}
                    </span>
                  </div>

                  {/* Review Text */}
                  <textarea
                    value={reviews[order.id] || ""}
                    onChange={(e) => setReviews(prev => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="Tulis pengalamanmu..."
                    className="w-full min-h-[60px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                  />

                  {/* Photo placeholder */}
                  <div className="flex gap-2">
                    <div
                      className="w-16 h-16 rounded-lg bg-muted/50 border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => showToast("Fitur upload foto segera hadir!", "info")}
                    >
                      <Camera className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>

                  <Button
                    disabled={!ratings[order.id]}
                    onClick={handleSubmitReview}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-9 disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Kirim Ulasan
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Submitted Reviews */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Sudah Diulas" />
          <div className="space-y-3 mt-3">
            {submittedReviews.map((review, i) => (
              <motion.div key={review.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{review.productName}</p>
                      <div className="flex items-center gap-0.5 mt-1">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star key={idx} className={`w-3.5 h-3.5 ${idx < review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{review.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{review.content}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== REFUND SCREEN ====================
export function RefundScreen() {
  const { showToast, goBack } = useAppStore()
  const [activeTab, setActiveTab] = useState("active")
  const [showForm, setShowForm] = useState(false)

  const activeRefunds = [
    { id: "rf1", orderNumber: "ORD-2024-201", product: "Lipstik Matte Velvet", reason: "Barang rusak", status: "Diproses", date: "20 Des 2024", timeline: ["Pengajuan diajukan", "Menunggu review seller", "Diproses admin"] },
    { id: "rf2", orderNumber: "ORD-2024-202", product: "Skincare Set Glowing", reason: "Tidak sesuai deskripsi", status: "Dikirim balik", date: "18 Des 2024", timeline: ["Pengajuan diajukan", "Seller menyetujui", "Barang dikirim balik"] },
  ]

  const refundHistory = [
    { id: "rh1", orderNumber: "ORD-2024-100", product: "T-Shirt Premium", amount: 150000, status: "Selesai", date: "10 Nov 2024" },
    { id: "rh2", orderNumber: "ORD-2024-085", product: "Headset Bluetooth", amount: 350000, status: "Ditolak", date: "5 Okt 2024" },
  ]

  const handleSubmitRefund = () => {
    showToast("Pengajuan refund berhasil dikirim!", "success")
    goBack()
  }

  return (
    <div className="pb-24">
      <PageHeader title="Pengembalian" />

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: "active", label: "Aktif" },
            { key: "history", label: "Riwayat" },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors border ${
                activeTab === tab.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {activeTab === "active" ? (
          <>
            <div className="space-y-3">
              {activeRefunds.map((refund, i) => (
                <motion.div key={refund.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-mono text-muted-foreground">{refund.orderNumber}</p>
                        <p className="text-sm font-medium text-foreground mt-1">{refund.product}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{refund.reason}</p>
                      </div>
                      <Badge className={`text-[10px] ${
                        refund.status === "Diproses" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30" : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30"
                      }`}>{refund.status}</Badge>
                    </div>
                    {/* Timeline */}
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      {refund.timeline.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${idx === refund.timeline.length - 1 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                          <span className={`text-xs ${idx === refund.timeline.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">{refund.date}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            <Button
              onClick={() => setShowForm(!showForm)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Ajukan Pengembalian
            </Button>

            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <Card className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Pilih Pesanan</label>
                      <select className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm">
                        <option>ORD-2024-003 - Lipstik Matte Velvet</option>
                        <option>ORD-2024-001 - iPhone 15 Pro Max</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Alasan</label>
                      <select className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm">
                        <option>Barang rusak</option>
                        <option>Tidak sesuai deskripsi</option>
                        <option>Barang salah</option>
                        <option>Lainnya</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Deskripsi</label>
                      <textarea
                        placeholder="Jelaskan masalahnya..."
                        className="w-full min-h-[60px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                      />
                    </div>
                    <Button onClick={handleSubmitRefund} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10">
                      Kirim Pengajuan
                    </Button>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="space-y-3">
            {refundHistory.map((item, i) => (
              <motion.div key={item.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{item.orderNumber}</p>
                      <p className="text-sm font-medium text-foreground mt-1">{item.product}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(item.amount)}</p>
                    </div>
                    <Badge className={`text-[10px] ${item.status === "Selesai" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">{item.date}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== HELP SCREEN ====================
export function HelpScreen() {
  const { showToast, navigate } = useAppStore()
  const [searchHelp, setSearchHelp] = useState("")
  const [openSection, setOpenSection] = useState<string | null>(null)

  const faqSections = [
    {
      key: "orders",
      title: "Pesanan",
      icon: <Package className="w-4 h-4" />,
      questions: [
        { q: "Bagaimana cara melacak pesanan?", a: "Buka menu Pesanan, pilih pesanan yang ingin dilacak, lalu klik 'Lacak Pesanan' untuk melihat status pengiriman real-time." },
        { q: "Berapa lama estimasi pengiriman?", a: "Estimasi pengiriman tergantung lokasi dan kurir yang dipilih, biasanya 1-5 hari kerja untuk wilayah Jawa dan 3-7 hari kerja untuk luar Jawa." },
        { q: "Bagaimana cara membatalkan pesanan?", a: "Pesanan bisa dibatalkan sebelum seller memproses. Buka detail pesanan dan klik 'Batalkan Pesanan'." },
        { q: "Apa yang harus dilakukan jika pesanan tidak datang?", a: "Hubungi seller melalui fitur chat atau ajukan pengembalian jika melewati batas waktu pengiriman." },
      ]
    },
    {
      key: "payment",
      title: "Pembayaran",
      icon: <CreditCard className="w-4 h-4" />,
      questions: [
        { q: "Metode pembayaran apa saja yang tersedia?", a: "Kami menerima transfer bank, e-wallet (GoPay, OVO, DANA), kartu kredit/debit, dan COD." },
        { q: "Bagaimana jika pembayaran gagal?", a: "Pastikan saldo mencukupi dan koneksi stabil. Coba lagi atau gunakan metode pembayaran lain. Jika sudah terdeduk, hubungi CS." },
        { q: "Apakah bisa paylater?", a: "Ya, kami mendukung paylater melalui mitra tertentu. Pilih opsi paylater saat checkout." },
      ]
    },
    {
      key: "shipping",
      title: "Pengiriman",
      icon: <MapPin className="w-4 h-4" />,
      questions: [
        { q: "Kurir apa saja yang tersedia?", a: "JNE, SiCepat, J&T, AnterAja, dan Tiki tersedia untuk pengiriman." },
        { q: "Apakah ada gratis ongkir?", a: "Gratis ongkir tersedia untuk produk tertentu dan saat menggunakan voucher gratis ongkir." },
        { q: "Bisa ganti alamat setelah checkout?", a: "Hubungi seller sesegera mungkin melalui chat. Jika belum diproses, alamat masih bisa diubah." },
      ]
    },
    {
      key: "refund",
      title: "Pengembalian",
      icon: <RotateCcw className="w-4 h-4" />,
      questions: [
        { q: "Bagaimana cara mengajukan pengembalian?", a: "Buka pesanan yang sudah selesai, klik 'Ajukan Pengembalian' dan isi formulir pengembalian." },
        { q: "Berapa lama proses refund?", a: "Proses refund membutuhkan 3-7 hari kerja setelah barang diterima seller dan diverifikasi." },
        { q: "Apakah bisa return jika sudah buka packaging?", a: "Ya, selama kondisi barang masih baik dan dalam masa garansi return 7 hari." },
      ]
    },
    {
      key: "account",
      title: "Akun",
      icon: <Shield className="w-4 h-4" />,
      questions: [
        { q: "Bagaimana cara reset password?", a: "Klik 'Lupa Password' di halaman login, masukkan email, dan ikuti petunjuk di email." },
        { q: "Apakah bisa punya lebih dari satu akun?", a: "Satu nomor HP hanya bisa terdaftar pada satu akun. Gunakan fitur switch role untuk berbagai kebutuhan." },
        { q: "Bagaimana cara menghapus akun?", a: "Buka Pengaturan > scroll ke bawah > klik 'Hapus Akun'. Tindakan ini tidak bisa dibatalkan." },
      ]
    },
  ]

  const filteredSections = searchHelp.trim()
    ? faqSections.filter(section =>
        section.title.toLowerCase().includes(searchHelp.toLowerCase()) ||
        section.questions.some(q =>
          q.q.toLowerCase().includes(searchHelp.toLowerCase()) ||
          q.a.toLowerCase().includes(searchHelp.toLowerCase())
        )
      )
    : faqSections

  const handleContactCS = () => {
    showToast("Menghubungi Customer Service...", "info")
    navigate("chat")
  }

  return (
    <div className="pb-24">
      <PageHeader title="Pusat Bantuan" />

      <div className="px-4 space-y-4">
        <SearchBar value={searchHelp} onChange={setSearchHelp} placeholder="Cari pertanyaan..." />

        <div className="space-y-2">
          {filteredSections.map((section, i) => (
            <motion.div key={section.key} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="overflow-hidden">
                <button
                  onClick={() => setOpenSection(openSection === section.key ? null : section.key)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                      {section.icon}
                    </div>
                    <span className="text-sm font-medium text-foreground">{section.title}</span>
                  </div>
                  {openSection === section.key ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {openSection === section.key && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pb-4 space-y-3">
                    {section.questions
                      .filter(q =>
                        !searchHelp.trim() ||
                        q.q.toLowerCase().includes(searchHelp.toLowerCase()) ||
                        q.a.toLowerCase().includes(searchHelp.toLowerCase())
                      )
                      .map((q, idx) => (
                      <div key={idx} className="pl-12">
                        <p className="text-sm font-medium text-foreground">{q.q}</p>
                        <p className="text-xs text-muted-foreground mt-1">{q.a}</p>
                        {idx < section.questions.length - 1 && <Separator className="mt-3" />}
                      </div>
                    ))}
                  </motion.div>
                )}
              </Card>
            </motion.div>
          ))}
          {filteredSections.length === 0 && (
            <EmptyState
              icon={<HelpCircle className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ditemukan"
              subtitle="Coba kata kunci lain untuk menemukan bantuan"
            />
          )}
        </div>

        <Button onClick={handleContactCS} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11">
          <Phone className="w-4 h-4 mr-2" /> Hubungi CS
        </Button>
      </div>
    </div>
  )
}

// ==================== FOLLOWED STORES SCREEN ====================
export function FollowedStoresScreen() {
  const { setSelectedSeller, navigate } = useAppStore()
  const [following, setFollowing] = useState<Record<string, boolean>>({
    s1: true, s2: true, s4: true, s5: true, s3: true
  })

  const stores = [
    { id: "s1", name: "Gadget Pro Store", isVerified: true, rating: 4.9, products: 250, avatar: "" },
    { id: "s2", name: "Fashion Hub", isVerified: true, rating: 4.7, products: 120, avatar: "" },
    { id: "s4", name: "Home Living ID", isVerified: true, rating: 4.8, products: 180, avatar: "" },
    { id: "s5", name: "Sport Zone", isVerified: true, rating: 4.6, products: 95, avatar: "" },
    { id: "s3", name: "Beauty Corner", isVerified: false, rating: 4.5, products: 80, avatar: "" },
  ]

  const colors = ["bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-violet-500", "bg-cyan-500"]

  const handleStoreClick = (storeId: string) => {
    setSelectedSeller(storeId)
    navigate("seller-shop")
  }

  return (
    <div className="pb-24">
      <PageHeader title="Toko Favorit" />

      <div className="px-4 space-y-3">
        {stores.length === 0 ? (
          <EmptyState
            icon={<Heart className="w-10 h-10 text-muted-foreground" />}
            title="Belum Ada Toko Favorit"
            subtitle="Ikuti toko untuk mendapat update produk terbaru"
          />
        ) : (
          stores.map((store, i) => (
            <motion.div key={store.id} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="p-4 cursor-pointer" onClick={() => handleStoreClick(store.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${colors[i % colors.length]} text-white font-bold flex items-center justify-center text-lg flex-shrink-0`}>
                    {store.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{store.name}</p>
                      {store.isVerified && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-muted-foreground">{store.rating}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{store.products} produk</span>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); setFollowing(prev => ({ ...prev, [store.id]: !prev[store.id] })) }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      following[store.id]
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {following[store.id] ? "Mengikuti" : "Ikuti"}
                  </motion.button>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

// ==================== DEPOSIT SCREEN ====================
export function DepositScreen() {
  const { currentUser, walletBalance, topUpWallet, showToast, goBack } = useAppStore()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("gopay")

  const quickAmounts = [
    { label: "50K", value: 50000 },
    { label: "100K", value: 100000 },
    { label: "200K", value: 200000 },
    { label: "500K", value: 500000 },
    { label: "1M", value: 1000000 },
  ]

  const paymentMethods = [
    { key: "gopay", label: "GoPay", color: "bg-green-500" },
    { key: "ovo", label: "OVO", color: "bg-purple-500" },
    { key: "dana", label: "DANA", color: "bg-blue-500" },
    { key: "bank", label: "Bank Transfer", color: "bg-cyan-600" },
  ]

  const handleTopUp = () => {
    const amount = selectedAmount || Number(customAmount)
    if (!amount || amount <= 0) {
      showToast("Pilih nominal top up terlebih dahulu", "error")
      return
    }
    topUpWallet(amount)
    showToast(`Top up ${formatPrice(amount)} berhasil!`, "success")
    goBack()
  }

  return (
    <div className="pb-24">
      <PageHeader title="Top Up Saldo" />

      <div className="px-4 space-y-4">
        {/* Balance Card */}
        <motion.div {...fadeIn}>
          <WalletBalanceCard
            balance={walletBalance}
            coins={currentUser?.coins || 500}
            onTopUp={() => {}}
            onWithdraw={() => {}}
          />
        </motion.div>

        {/* Quick Amount */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pilih Nominal" />
          <div className="flex flex-wrap gap-2 mt-3">
            {quickAmounts.map((item) => (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setSelectedAmount(item.value); setCustomAmount("") }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                  selectedAmount === item.value
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {item.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Custom Amount */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Nominal Lain" />
          <div className="mt-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <Input
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null) }}
              placeholder="Masukkan nominal"
              className="pl-9 h-10 rounded-xl"
              type="number"
            />
          </div>
        </motion.div>

        {/* Payment Method */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Metode Pembayaran" icon={<CreditCard className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            {paymentMethods.map((method) => (
              <Card
                key={method.key}
                className={`p-3 cursor-pointer transition-colors ${paymentMethod === method.key ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10" : ""}`}
                onClick={() => setPaymentMethod(method.key)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${method.color} flex items-center justify-center text-white text-xs font-bold`}>
                    {method.label.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-foreground">{method.label}</span>
                  {paymentMethod === method.key && (
                    <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Deposit Button */}
        <motion.div {...fadeIn}>
          <Button
            disabled={!selectedAmount && !customAmount}
            onClick={handleTopUp}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11 disabled:opacity-40"
          >
            <Wallet className="w-4 h-4 mr-2" /> Top Up Sekarang
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== WITHDRAW SCREEN ====================
export function WithdrawScreen() {
  const { currentUser, walletBalance, walletHoldBalance, withdrawWallet, showToast, goBack } = useAppStore()
  const [amount, setAmount] = useState("")

  const bankAccount = "BCA ****1234 - Ahmad Fauzi"

  const withdrawHistory = [
    { id: "wh1", amount: 500000, bank: "BCA ****1234", status: "Berhasil", date: "15 Des 2024" },
    { id: "wh2", amount: 1000000, bank: "BCA ****1234", status: "Berhasil", date: "1 Des 2024" },
    { id: "wh3", amount: 300000, bank: "BCA ****1234", status: "Berhasil", date: "20 Nov 2024" },
  ]

  const handleWithdraw = () => {
    const withdrawAmount = Number(amount)
    if (!withdrawAmount || withdrawAmount <= 0) {
      showToast("Masukkan jumlah penarikan yang valid", "error")
      return
    }
    if (withdrawAmount > walletBalance) {
      showToast("Jumlah penarikan melebihi saldo tersedia", "error")
      return
    }
    withdrawWallet(withdrawAmount, bankAccount)
    showToast(`Penarikan ${formatPrice(withdrawAmount)} berhasil diajukan!`, "success")
    goBack()
  }

  return (
    <div className="pb-24">
      <PageHeader title="Tarik Dana" />

      <div className="px-4 space-y-4">
        {/* Balance Card */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="text-sm text-emerald-100 font-medium">Saldo Tersedia</p>
            <p className="text-3xl font-bold mt-1">{formatPrice(walletBalance)}</p>
            <p className="text-xs text-emerald-200 mt-1">Saldo tertahan: {formatPrice(walletHoldBalance)}</p>
          </div>
        </motion.div>

        {/* Amount Input */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Jumlah Penarikan" />
          <div className="mt-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Masukkan jumlah"
              className="pl-9 h-11 rounded-xl text-lg font-bold"
              type="number"
            />
          </div>
        </motion.div>

        {/* Bank Account */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Rekening Tujuan" icon={<Banknote className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">BCA</p>
                <p className="text-xs text-muted-foreground">****1234 - Ahmad Fauzi</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </div>
          </Card>
        </motion.div>

        {/* Withdraw Button */}
        <motion.div {...fadeIn}>
          <Button
            disabled={!amount || Number(amount) <= 0}
            onClick={handleWithdraw}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11 disabled:opacity-40"
          >
            <ArrowUpRight className="w-4 h-4 mr-2" /> Tarik Dana
          </Button>
        </motion.div>

        {/* Withdrawal History */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Riwayat Penarikan" />
          <div className="space-y-2 mt-3">
            {withdrawHistory.map((item, i) => (
              <motion.div key={item.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatPrice(item.amount)}</p>
                        <p className="text-xs text-muted-foreground">{item.bank}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{item.status}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">{item.date}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
