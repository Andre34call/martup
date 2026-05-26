"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore, getAuthHeaders } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { PageHeader, SectionHeader, EmptyState, SearchBar, WalletBalanceCard } from "./shared"
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Settings as SettingsIcon, Shield, Bell, Globe, Lock, Trash2, CreditCard, Ticket, Copy, Check, MapPin, Plus, Star, Camera, Send, RotateCcw, HelpCircle, ChevronDown, ChevronUp, MessageSquare, Phone, Heart, Store, Wallet, ArrowUpRight, Clock, Banknote, Edit, ChevronRight, Package, ImagePlus, Video, Play, X, Eye, EyeOff, KeyRound, ThumbsUp, ThumbsDown, Meh, CheckCircle2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

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
  const { currentUser, showToast, logout, avatarUrl, updateAvatar, updateProfile, settings, updateSettings, deleteAccount } = useAppStore()
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleEditField = (field: string, value: string) => {
    setEditField(field)
    setEditValue(value)
  }

  const handleSaveField = () => {
    if (!editValue.trim()) {
      showToast("Field tidak boleh kosong", "error")
      return
    }
    updateProfile({ [editField!]: editValue.trim() })
    showToast("Profil berhasil diperbarui!", "success")
    setEditField(null)
    setEditValue("")
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      showToast("File harus berupa gambar", "error")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran foto maksimal 5MB", "error")
      return
    }
    const url = URL.createObjectURL(file)
    updateAvatar(url)
    showToast("Foto profil berhasil diperbarui!", "success")
    e.target.value = ""
  }

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Semua field harus diisi", "error")
      return
    }
    if (newPassword.length < 8) {
      showToast("Password baru minimal 8 karakter", "error")
      return
    }
    if (newPassword !== confirmPassword) {
      showToast("Konfirmasi password tidak cocok", "error")
      return
    }
    showToast("Password berhasil diubah!", "success")
    setShowPasswordDialog(false)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleDeleteAccount = () => {
    if (confirm("Apakah kamu yakin ingin menghapus akun? Tindakan ini tidak bisa dibatalkan.")) {
      deleteAccount()
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
            {/* Avatar */}
            <div className="flex items-center justify-center mb-4">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => avatarInputRef.current?.click()}
                className="relative group"
              >
                {avatarUrl ? (
                  <div className="w-20 h-20 rounded-full overflow-hidden shadow-md ring-2 ring-emerald-500/30">
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold flex items-center justify-center text-2xl shadow-md">
                    {(currentUser?.name || "A").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-card group-hover:scale-110 transition-transform">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </motion.button>
            </div>

            {/* Name Field */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Nama</p>
                {editField === "name" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 text-sm rounded-lg"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveField} className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px]">
                      Simpan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditField(null)} className="h-8 px-2 rounded-lg text-[11px]">
                      Batal
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{currentUser?.name || "Ahmad Fauzi"}</p>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => handleEditField("name", currentUser?.name || "Ahmad Fauzi")}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Separator />
            {/* Email Field */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                {editField === "email" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 text-sm rounded-lg"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveField} className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px]">
                      Simpan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditField(null)} className="h-8 px-2 rounded-lg text-[11px]">
                      Batal
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{currentUser?.email || "ahmad@email.com"}</p>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => handleEditField("email", currentUser?.email || "ahmad@email.com")}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Separator />
            {/* Phone Field */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">No. Telepon</p>
                {editField === "phone" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 text-sm rounded-lg"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveField} className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px]">
                      Simpan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditField(null)} className="h-8 px-2 rounded-lg text-[11px]">
                      Batal
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{currentUser?.phone || "08123456789"}</p>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => handleEditField("phone", currentUser?.phone || "08123456789")}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Security */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Keamanan" icon={<Shield className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            <button className="w-full flex items-center justify-between py-1" onClick={() => setShowPasswordDialog(true)}>
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
              <Switch checked={settings.twoFactor} onCheckedChange={() => updateSettings({ twoFactor: !settings.twoFactor })} />
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
              <Switch checked={settings.pushNotif} onCheckedChange={() => updateSettings({ pushNotif: !settings.pushNotif })} />
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
              <Switch checked={settings.emailNotif} onCheckedChange={() => updateSettings({ emailNotif: !settings.emailNotif })} />
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

        {/* Legal */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Legal & Privasi" icon={<Shield className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="space-y-1">
              <button onClick={() => navigate('privacy-policy')} className="flex items-center justify-between w-full py-2.5 hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-foreground">Kebijakan Privasi</span>
                    <p className="text-xs text-muted-foreground">Cara kami melindungi data Anda</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              <button onClick={() => navigate('terms-of-service')} className="flex items-center justify-between w-full py-2.5 hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-foreground">Syarat & Ketentuan</span>
                    <p className="text-xs text-muted-foreground">Ketentuan penggunaan platform</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              <button onClick={() => navigate('refund-policy')} className="flex items-center justify-between w-full py-2.5 hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-foreground">Kebijakan Pengembalian Dana</span>
                    <p className="text-xs text-muted-foreground">Hak refund & proses klaim</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">Berbagi Data</span>
                    <p className="text-xs text-muted-foreground">Izinkan berbagi data untuk analitik</p>
                  </div>
                </div>
                <Switch checked={settings.dataSharing} onCheckedChange={() => updateSettings({ dataSharing: !settings.dataSharing })} />
              </div>
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

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Ubah Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Password Saat Ini <span className="text-red-500">*</span></label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  className="pr-10 rounded-xl h-10"
                />
                <button
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Password Baru <span className="text-red-500">*</span></label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="pr-10 rounded-xl h-10"
                />
                <button
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && newPassword.length < 8 && (
                <p className="text-[10px] text-red-500">Password minimal 8 karakter</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Konfirmasi Password Baru <span className="text-red-500">*</span></label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="rounded-xl h-10"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[10px] text-red-500">Password tidak cocok</p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button onClick={handleChangePassword} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10 flex-1">
              Ubah Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== VOUCHER SCREEN ====================
export function VoucherScreen() {
  const { vouchers, selectVoucher, showToast, goBack, usedVoucherIds } = useAppStore()
  const [activeTab, setActiveTab] = useState("available")
  const [code, setCode] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [apiVouchers, setApiVouchers] = useState<typeof vouchers>([])
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false)

  // Fetch vouchers from API on mount
  useEffect(() => {
    const fetchVouchers = async () => {
      setIsLoadingVouchers(true)
      try {
        const res = await fetch('/api/vouchers')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            const mapped = data.data.map((v: any) => ({
              id: v.id,
              code: v.code || '',
              name: v.name,
              description: v.description || '',
              type: v.type || 'fixed',
              value: v.value || 0,
              maxDiscount: v.maxDiscount || undefined,
              minPurchase: v.minPurchase || 0,
              isActive: v.isActive ?? true,
              validFrom: v.validFrom || new Date().toISOString(),
              validUntil: v.validUntil || new Date().toISOString(),
            }))
            setApiVouchers(mapped)
          }
        }
      } catch (error) {
        console.error('Failed to fetch vouchers:', error)
      }
      setIsLoadingVouchers(false)
    }
    fetchVouchers()
  }, [])

  // Merge API vouchers with store vouchers (API takes priority, avoid duplicates)
  const allVouchers = useMemo(() => {
    const apiIds = new Set(apiVouchers.map((v: typeof vouchers[0]) => v.id))
    const merged = [...apiVouchers, ...vouchers.filter((v: typeof vouchers[0]) => !apiIds.has(v.id))]
    return merged
  }, [apiVouchers, vouchers])

  const availableVouchers = allVouchers.filter(v => v.isActive && new Date(v.validUntil) > new Date() && !usedVoucherIds.includes(v.id))
  const usedVouchers = allVouchers.filter(v => usedVoucherIds.includes(v.id))
  const expiredVouchers = allVouchers.filter(v => new Date(v.validUntil) <= new Date())

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
    const found = allVouchers.find(v => v.code.toUpperCase() === trimmedCode)
    if (found) {
      selectVoucher(found)
      showToast(`Voucher "${found.name}" berhasil dipakai!`, "success")
      goBack()
    } else {
      showToast("Kode voucher tidak valid", "error")
    }
  }

  const handleUseVoucher = (voucher: typeof allVouchers[0]) => {
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

  const [isSaving, setIsSaving] = useState(false)

  const handleSaveAddress = async () => {
    if (!formLabel.trim() || !formRecipient.trim() || !formPhone.trim() || !formAddress.trim() || !formCity.trim() || !formProvince.trim() || !formPostalCode.trim()) {
      showToast("Semua field wajib diisi", "error")
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
    } catch {
      showToast("Gagal menyimpan alamat", "error")
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

// ==================== REVIEW SCREEN ====================

// --- Media types ---
interface ReviewImage {
  id: string
  url: string
  file: File
}

interface ReviewVideo {
  id: string
  url: string
  file: File
}

const MAX_IMAGES = 5
const MAX_VIDEO_SIZE_MB = 30
const MAX_IMAGE_SIZE_MB = 5

// Rating labels
const ratingLabels: Record<number, { text: string; color: string; icon: React.ReactNode }> = {
  1: { text: "Sangat Buruk", color: "text-red-500", icon: <ThumbsDown className="w-4 h-4" /> },
  2: { text: "Buruk", color: "text-orange-500", icon: <ThumbsDown className="w-4 h-4" /> },
  3: { text: "Biasa", color: "text-amber-500", icon: <Meh className="w-4 h-4" /> },
  4: { text: "Bagus", color: "text-emerald-500", icon: <ThumbsUp className="w-4 h-4" /> },
  5: { text: "Sangat Bagus", color: "text-emerald-600", icon: <ThumbsUp className="w-4 h-4" /> },
}

export function ReviewScreen() {
  const { showToast, goBack, navigate, orders, reviews: storeReviews, reviewedOrderIds, addReview, currentUser, avatarUrl } = useAppStore()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [reviewTexts, setReviewTexts] = useState<Record<string, string>>({})
  const [images, setImages] = useState<Record<string, ReviewImage[]>>({})
  const [videos, setVideos] = useState<Record<string, ReviewVideo | null>>({})
  const [anonymous, setAnonymous] = useState<Record<string, boolean>>({})
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const activeOrderIdRef = useRef<string | null>(null)

  // Get actual delivered orders that haven't been reviewed yet
  const deliveredOrders = orders.filter(o => o.status === 'delivered' && !reviewedOrderIds.includes(o.id))
  // Get delivered orders that have been reviewed
  const reviewedOrders = orders.filter(o => reviewedOrderIds.includes(o.id))

  // --- Image Upload Handlers ---
  const handleImageUpload = useCallback((orderId: string) => {
    activeOrderIdRef.current = orderId
    imageInputRef.current?.click()
  }, [])

  const onImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const orderId = activeOrderIdRef.current
    if (!orderId) return

    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const currentImages = images[orderId] || []
    const remainingSlots = MAX_IMAGES - currentImages.length
    const filesToAdd = files.slice(0, remainingSlots)

    if (files.length > remainingSlots) {
      showToast(`Maksimal ${MAX_IMAGES} foto per ulasan`, "error")
    }

    const newImages: ReviewImage[] = []
    for (const file of filesToAdd) {
      // Validate size
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        showToast(`Foto "${file.name}" melebihi ${MAX_IMAGE_SIZE_MB}MB`, "error")
        continue
      }
      // Validate type
      if (!file.type.startsWith("image/")) {
        showToast(`"${file.name}" bukan file gambar`, "error")
        continue
      }
      newImages.push({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        file,
      })
    }

    setImages(prev => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), ...newImages],
    }))

    // Reset input
    e.target.value = ""
  }, [images, showToast])

  const handleRemoveImage = useCallback((orderId: string, imageId: string) => {
    setImages(prev => {
      const updated = (prev[orderId] || []).filter(img => {
        if (img.id === imageId) {
          URL.revokeObjectURL(img.url)
          return false
        }
        return true
      })
      return { ...prev, [orderId]: updated }
    })
  }, [])

  // --- Video Upload Handlers ---
  const handleVideoUpload = useCallback((orderId: string) => {
    activeOrderIdRef.current = orderId
    videoInputRef.current?.click()
  }, [])

  const onVideoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const orderId = activeOrderIdRef.current
    if (!orderId) return

    const file = e.target.files?.[0]
    if (!file) return

    // Validate size
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      showToast(`Video melebihi ${MAX_VIDEO_SIZE_MB}MB`, "error")
      e.target.value = ""
      return
    }

    // Validate type
    if (!file.type.startsWith("video/")) {
      showToast("File harus berupa video", "error")
      e.target.value = ""
      return
    }

    // Remove existing video if any
    const existing = videos[orderId]
    if (existing) {
      URL.revokeObjectURL(existing.url)
    }

    setVideos(prev => ({
      ...prev,
      [orderId]: {
        id: `vid-${Date.now()}`,
        url: URL.createObjectURL(file),
        file,
      },
    }))

    e.target.value = ""
  }, [videos, showToast])

  const handleRemoveVideo = useCallback((orderId: string) => {
    const existing = videos[orderId]
    if (existing) {
      URL.revokeObjectURL(existing.url)
    }
    setVideos(prev => ({ ...prev, [orderId]: null }))
  }, [videos])

  const handleRating = useCallback((orderId: string, star: number) => {
    setRatings(prev => ({ ...prev, [orderId]: star }))
  }, [])

  const handleSubmitReview = useCallback((orderId: string) => {
    const rating = ratings[orderId]
    if (!rating) {
      showToast("Pilih rating terlebih dahulu", "error")
      return
    }

    const order = orders.find(o => o.id === orderId)
    if (!order) return

    // Get the first item's productId for the review
    const orderItem = order.items[0]
    const productId = orderItem?.productId || ''

    // Cleanup object URLs for images
    const orderImages = images[orderId] || []
    const imageUrls = orderImages.map(img => img.url)
    // Don't revoke URLs yet since they may be used for display in submitted reviews
    const orderVideo = videos[orderId]

    // Create the review object
    const review = {
      id: `rev-${Date.now()}`,
      userId: currentUser?.id || 'u1',
      productId,
      rating,
      content: reviewTexts[orderId] || undefined,
      images: imageUrls.length > 0 ? imageUrls : undefined,
      userName: anonymous[orderId] ? 'Pembeli' : (currentUser?.name || 'User'),
      userAvatar: anonymous[orderId] ? undefined : (avatarUrl || undefined),
      createdAt: new Date().toISOString(),
    }

    // Save to store
    addReview(review, orderId)

    // Clear local state
    setImages(prev => ({ ...prev, [orderId]: [] }))
    setVideos(prev => ({ ...prev, [orderId]: null }))
    setRatings(prev => ({ ...prev, [orderId]: 0 }))
    setReviewTexts(prev => ({ ...prev, [orderId]: "" }))

    // Show success animation
    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      showToast("Ulasan berhasil dikirim! 🎉", "success")
      // Navigate to orders page after short delay
      setTimeout(() => {
        navigate("orders")
      }, 500)
    }, 1500)
  }, [ratings, images, videos, reviewTexts, anonymous, orders, currentUser, avatarUrl, addReview, showToast, navigate])

  return (
    <div className="pb-24">
      <PageHeader title="Ulasan" />

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onImageChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onVideoChange}
      />

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            >
              <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {previewVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            >
              <video
                src={previewVideo}
                controls
                autoPlay
                className="max-w-[90vw] max-h-[80vh] rounded-xl"
              />
              <button
                onClick={() => setPreviewVideo(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-card rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </motion.div>
              <p className="text-lg font-bold text-foreground">Ulasan Terkirim!</p>
              <p className="text-sm text-muted-foreground text-center">Terima kasih atas ulasanmu 🎉</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 space-y-6">
        {/* ===== Belum Diulas ===== */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Belum Diulas" icon={<Star className="w-4 h-4" />} />
          <div className="space-y-4 mt-3">
            {deliveredOrders.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-10 h-10 text-muted-foreground" />}
                title="Semua Pesanan Diulas"
                subtitle="Tidak ada pesanan yang perlu diulas"
              />
            ) : (
              deliveredOrders.map((order, i) => {
                const orderImages = images[order.id] || []
                const orderVideo = videos[order.id]
                const rating = ratings[order.id] || 0
                const ratingInfo = ratingLabels[rating]
                const firstItem = order.items[0]

                return (
                  <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                    <Card className="p-4 space-y-4">
                      {/* Product Info */}
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                          {firstItem?.image ? (
                            <img src={firstItem.image} alt={firstItem.productName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2">{firstItem?.productName || 'Produk'}</p>
                          <p className="text-xs text-muted-foreground">{order.seller.storeName}</p>
                          <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(firstItem?.price || 0)}</p>
                        </div>
                      </div>

                      {/* Star Rating */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Bagaimana kualitas produk?</p>
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <motion.button
                              key={idx}
                              whileTap={{ scale: 0.75 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => handleRating(order.id, idx + 1)}
                              className="p-0.5"
                            >
                              <Star
                                className={`w-8 h-8 transition-all duration-150 ${
                                  rating >= idx + 1
                                    ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                                    : "text-gray-300 dark:text-gray-600 hover:text-amber-200"
                                }`}
                              />
                            </motion.button>
                          ))}
                          {ratingInfo && (
                            <motion.div
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-center gap-1 ml-2 ${ratingInfo.color}`}
                            >
                              {ratingInfo.icon}
                              <span className="text-xs font-semibold">{ratingInfo.text}</span>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Review Text */}
                      <div className="space-y-1.5">
                        <textarea
                          value={reviewTexts[order.id] || ""}
                          onChange={(e) => setReviewTexts(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Ceritakan pengalamanmu menggunakan produk ini..."
                          rows={3}
                          maxLength={500}
                          className="w-full rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none placeholder:text-muted-foreground/60"
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">Ulasan yang detail membantu pembeli lain</p>
                          <p className="text-[10px] text-muted-foreground">{(reviewTexts[order.id] || "").length}/500</p>
                        </div>
                      </div>

                      {/* Image Upload Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5" />
                            Foto Produk
                          </p>
                          <span className="text-[10px] text-muted-foreground">{orderImages.length}/{MAX_IMAGES}</span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {/* Image Previews */}
                          {orderImages.map((img) => (
                            <motion.div
                              key={img.id}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="relative group"
                            >
                              <div
                                className="w-20 h-20 rounded-lg overflow-hidden border border-border/50 cursor-pointer"
                                onClick={() => setPreviewImage(img.url)}
                              >
                                <img src={img.url} alt="Upload" className="w-full h-full object-cover" />
                              </div>
                              <button
                                onClick={() => handleRemoveImage(order.id, img.id)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setPreviewImage(img.url)}
                                className="absolute bottom-0.5 right-0.5 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </motion.div>
                          ))}

                          {/* Add Image Button */}
                          {orderImages.length < MAX_IMAGES && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleImageUpload(order.id)}
                              className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-emerald-400 bg-muted/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 flex flex-col items-center justify-center gap-0.5 transition-colors"
                            >
                              <ImagePlus className="w-5 h-5 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground font-medium">Tambah</span>
                            </motion.button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Format: JPG, PNG, WebP · Maks {MAX_IMAGE_SIZE_MB}MB/foto</p>
                      </div>

                      {/* Video Upload Section */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5" />
                          Video Ulasan
                        </p>

                        {orderVideo ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative group"
                          >
                            <div
                              className="relative w-full h-36 rounded-lg overflow-hidden border border-border/50 bg-black cursor-pointer"
                              onClick={() => setPreviewVideo(orderVideo.url)}
                            >
                              <video
                                src={orderVideo.url}
                                className="w-full h-full object-cover"
                                muted
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                  <Play className="w-5 h-5 text-foreground ml-0.5" />
                                </div>
                              </div>
                              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-medium">
                                VIDEO
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveVideo(order.id)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleVideoUpload(order.id)}
                            className="w-full h-20 rounded-lg border-2 border-dashed border-border hover:border-emerald-400 bg-muted/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 flex items-center gap-3 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                              <Video className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-medium text-foreground">Upload Video</p>
                              <p className="text-[10px] text-muted-foreground">Maks {MAX_VIDEO_SIZE_MB}MB · MP4, MOV, WebM</p>
                            </div>
                          </motion.button>
                        )}
                      </div>

                      {/* Anonymous Toggle */}
                      <div className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">Ulasan Anonim</p>
                            <p className="text-[10px] text-muted-foreground">Nama tidak ditampilkan</p>
                          </div>
                        </div>
                        <Switch
                          checked={anonymous[order.id] || false}
                          onCheckedChange={(v) => setAnonymous(prev => ({ ...prev, [order.id]: v }))}
                        />
                      </div>

                      {/* Submit Button */}
                      <Button
                        disabled={!rating}
                        onClick={() => handleSubmitReview(order.id)}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10 disabled:opacity-40 text-sm font-semibold"
                      >
                        <Send className="w-4 h-4 mr-1.5" /> Kirim Ulasan
                      </Button>
                    </Card>
                  </motion.div>
                )
              })
            )}
          </div>
        </motion.div>

        {/* ===== Sudah Diulas ===== */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Sudah Diulas" />
          <div className="space-y-3 mt-3">
            {reviewedOrders.length === 0 ? (
              <EmptyState
                icon={<Star className="w-10 h-10 text-muted-foreground" />}
                title="Belum Ada Ulasan"
                subtitle="Ulasan yang sudah dikirim akan muncul di sini"
              />
            ) : (
              reviewedOrders.map((order, i) => {
                // Find the review for this order
                const orderReview = storeReviews.find(r =>
                  r.productId === (order.items[0]?.productId || '') &&
                  reviewedOrderIds.includes(order.id)
                )
                if (!orderReview) return null

                return (
                  <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                    <Card className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{order.items[0]?.productName || 'Produk'}</p>
                            {orderReview.userName === 'Pembeli' && (
                              <Badge className="text-[8px] h-4 bg-muted text-muted-foreground border-0">Anonim</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star key={idx} className={`w-3.5 h-3.5 ${idx < orderReview.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                            ))}
                            <span className="text-[10px] font-medium text-foreground ml-1">{orderReview.rating}/5</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {new Date(orderReview.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {orderReview.content && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{orderReview.content}</p>
                      )}

                      {/* Submitted review images */}
                      {orderReview.images && orderReview.images.length > 0 && (
                        <div className="flex gap-2">
                          {orderReview.images.map((img, idx) => (
                            <div
                              key={idx}
                              className="w-16 h-16 rounded-lg overflow-hidden border border-border/50 cursor-pointer"
                              onClick={() => setPreviewImage(img)}
                            >
                              <img src={img} alt="Review" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )
              })
            )}
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
  const [evidenceImages, setEvidenceImages] = useState<{ id: string; url: string; file: File }[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const evidenceInputRef = useRef<HTMLInputElement>(null)

  const activeRefunds: { id: string; orderNumber: string; product: string; reason: string; status: string; date: string; timeline: string[] }[] = []

  const refundHistory: { id: string; orderNumber: string; product: string; amount: number; status: string; date: string }[] = []

  const handleSubmitRefund = () => {
    evidenceImages.forEach(img => URL.revokeObjectURL(img.url))
    setEvidenceImages([])
    showToast("Pengajuan refund berhasil dikirim!", "success")
    goBack()
  }

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 4 - evidenceImages.length
    const filesToAdd = files.slice(0, remaining)
    if (files.length > remaining) {
      showToast(`Maksimal 4 foto bukti`, "error")
    }
    const newImages: { id: string; url: string; file: File }[] = []
    for (const file of filesToAdd) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`Foto "${file.name}" melebihi 5MB`, "error")
        continue
      }
      if (!file.type.startsWith("image/")) {
        showToast(`"${file.name}" bukan file gambar`, "error")
        continue
      }
      newImages.push({
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        file,
      })
    }
    setEvidenceImages(prev => [...prev, ...newImages])
    e.target.value = ""
  }

  const handleRemoveEvidence = (imageId: string) => {
    setEvidenceImages(prev => {
      const img = prev.find(i => i.id === imageId)
      if (img) URL.revokeObjectURL(img.url)
      return prev.filter(i => i.id !== imageId)
    })
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
                      <label className="text-xs font-medium text-foreground">Pilih Pesanan <span className="text-red-500">*</span></label>
                      <select className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm">
                        <option>ORD-2024-003 - Lipstik Matte Velvet</option>
                        <option>ORD-2024-001 - iPhone 15 Pro Max</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Alasan <span className="text-red-500">*</span></label>
                      <select className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm">
                        <option>Barang rusak</option>
                        <option>Tidak sesuai deskripsi</option>
                        <option>Barang salah</option>
                        <option>Lainnya</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Deskripsi <span className="text-red-500">*</span></label>
                      <textarea
                        placeholder="Jelaskan masalahnya..."
                        className="w-full min-h-[60px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                      />
                    </div>
                    {/* Evidence Upload */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">Foto Bukti</label>
                      <input
                        ref={evidenceInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleEvidenceUpload}
                      />
                      <div className="flex gap-2 flex-wrap">
                        {evidenceImages.map((img) => (
                          <div key={img.id} className="relative group">
                            <div
                              className="w-16 h-16 rounded-lg overflow-hidden border border-border/50 cursor-pointer"
                              onClick={() => setPreviewImage(img.url)}
                            >
                              <img src={img.url} alt="Bukti" className="w-full h-full object-cover" />
                            </div>
                            <button
                              onClick={() => handleRemoveEvidence(img.id)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                        {evidenceImages.length < 4 && (
                          <button
                            onClick={() => evidenceInputRef.current?.click()}
                            className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-emerald-400 bg-muted/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 flex flex-col items-center justify-center gap-0.5 transition-colors"
                          >
                            <ImagePlus className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[8px] text-muted-foreground">Tambah</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Maks 4 foto · JPG, PNG · Maks 5MB/foto</p>
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

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={e => e.stopPropagation()}
            >
              <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

  const handleTopUp = async () => {
    const amount = selectedAmount || Number(customAmount)
    if (!amount || amount <= 0) {
      showToast("Pilih nominal top up terlebih dahulu", "error")
      return
    }
    try {
      // Create a deposit record via API
      const walletHeaders = getAuthHeaders(true)
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: walletHeaders,
        body: JSON.stringify({ userId: currentUser?.id, amount }),
      })
      const data = await res.json()
      if (data.success) {
        // Also update local state
        topUpWallet(amount)
        showToast(`Top up ${formatPrice(amount)} berhasil!`, "success")
        goBack()
      } else {
        // Fallback to local-only top up if API fails
        topUpWallet(amount)
        showToast(`Top up ${formatPrice(amount)} berhasil!`, "success")
        goBack()
      }
    } catch {
      // Fallback to local-only top up
      topUpWallet(amount)
      showToast(`Top up ${formatPrice(amount)} berhasil!`, "success")
      goBack()
    }
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
  const { currentUser, walletBalance, walletHoldBalance, withdrawWallet, sellerBankAccounts, withdrawRequests, showToast, goBack } = useAppStore()
  const [amount, setAmount] = useState("")

  const defaultBankAccount = sellerBankAccounts.find(a => a.isDefault) || sellerBankAccounts[0]
  const bankAccountLabel = defaultBankAccount
    ? `${defaultBankAccount.bankName} ****${defaultBankAccount.accountNumber.slice(-4)} - ${defaultBankAccount.accountHolder}`
    : "Belum ada rekening bank"

  const statusLabels: Record<string, string> = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak", processing: "Diproses", completed: "Berhasil" }
  const withdrawHistory = withdrawRequests.map(w => ({
    id: w.id,
    amount: w.amount,
    bank: `${w.bankAccount.bankName} ****${w.bankAccount.accountNumber.slice(-4)}`,
    status: statusLabels[w.status] || w.status,
    date: new Date(w.requestDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
  }))

  const handleWithdraw = () => {
    const withdrawAmount = Number(amount)
    if (!withdrawAmount || withdrawAmount <= 0) {
      showToast("Masukkan jumlah penarikan yang valid", "error")
      return
    }
    if (!defaultBankAccount) {
      showToast("Tambahkan rekening bank terlebih dahulu", "error")
      return
    }
    if (withdrawAmount > walletBalance) {
      showToast("Jumlah penarikan melebihi saldo tersedia", "error")
      return
    }
    withdrawWallet(withdrawAmount, bankAccountLabel)
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
            {defaultBankAccount ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{defaultBankAccount.bankName}</p>
                  <p className="text-xs text-muted-foreground">****{defaultBankAccount.accountNumber.slice(-4)} - {defaultBankAccount.accountHolder}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Belum ada rekening bank</p>
              </div>
            )}
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
