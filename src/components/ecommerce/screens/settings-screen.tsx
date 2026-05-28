"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader } from "../shared"
import { useState, useRef, useEffect } from "react"
import { Settings as SettingsIcon, Shield, Bell, Globe, Lock, Trash2, MapPin, Camera, RotateCcw, ChevronRight, Phone, MessageSquare, Edit, FileText, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export function SettingsScreen() {
  const { currentUser, showToast, logout, avatarUrl, uploadAvatar, updateProfile, settings, updateSettings, deleteAccount, navigate } = useAppStore()
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [twoFALoading, setTwoFALoading] = useState(true)
  const [show2FADialog, setShow2FADialog] = useState(false)
  const [show2FADisableDialog, setShow2FADisableDialog] = useState(false)
  const [twoFAStep, setTwoFAStep] = useState<'otp' | 'verify'>('otp')
  const [twoFAOtp, setTwoFAOtp] = useState("")
  const [twoFADevOtp, setTwoFADevOtp] = useState<string | null>(null)
  const [twoFASending, setTwoFASending] = useState(false)
  const [twoFAVerifying, setTwoFAVerifying] = useState(false)
  const [twoFADisablePassword, setTwoFADisablePassword] = useState("")
  const [twoFADisableLoading, setTwoFADisableLoading] = useState(false)
  const [twoFACountdown, setTwoFACountdown] = useState(0)

  // Load 2FA status from API on mount
  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        const data = await apiClient.get<{ success: boolean; data?: { twoFactorEnabled: boolean } }>('/api/user/2fa')
        if (data.success && data.data) {
          setTwoFAEnabled(data.data.twoFactorEnabled)
          updateSettings({ twoFactor: data.data.twoFactorEnabled })
        }
      } catch {
        // Silently fail, will default to false
      }
      setTwoFALoading(false)
    }
    fetch2FAStatus()
  }, [updateSettings])

  // Countdown timer for OTP resend
  useEffect(() => {
    if (twoFACountdown <= 0) return
    const timer = setInterval(() => setTwoFACountdown((prev) => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [twoFACountdown])

  // Handle 2FA toggle
  const handle2FAToggle = (checked: boolean) => {
    if (checked) {
      if (!currentUser?.phone) {
        showToast('Nomor HP harus diatur terlebih dahulu untuk mengaktifkan 2FA', 'error')
        return
      }
      setTwoFAStep('otp')
      setTwoFAOtp("")
      setTwoFADevOtp(null)
      setShow2FADialog(true)
    } else {
      setTwoFADisablePassword("")
      setShow2FADisableDialog(true)
    }
  }

  // Send OTP for 2FA enable
  const handle2FASendOtp = async () => {
    setTwoFASending(true)
    try {
      const data = await apiClient.post<{ success: boolean; message?: string; error?: string; devOtp?: string }>('/api/user/2fa', { action: 'send-otp' })
      if (data.success) {
        setTwoFAStep('verify')
        setTwoFACountdown(60)
        if (data.devOtp) {
          setTwoFADevOtp(data.devOtp)
          setTwoFAOtp(data.devOtp)
        }
        showToast(data.message || 'Kode OTP telah dikirim', 'success')
      } else {
        showToast(data.error || 'Gagal mengirim OTP', 'error')
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : 'Terjadi kesalahan koneksi', 'error')
    }
    setTwoFASending(false)
  }

  // Verify OTP and enable 2FA
  const handle2FAVerify = async () => {
    if (twoFAOtp.length !== 6) return
    setTwoFAVerifying(true)
    try {
      const data = await apiClient.post<{ success: boolean; error?: string }>('/api/user/2fa', { action: 'enable', otpCode: twoFAOtp })
      if (data.success) {
        setTwoFAEnabled(true)
        updateSettings({ twoFactor: true })
        setShow2FADialog(false)
        showToast('Two-Factor Authentication berhasil diaktifkan!', 'success')
      } else {
        showToast(data.error || 'Verifikasi gagal', 'error')
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : 'Terjadi kesalahan koneksi', 'error')
    }
    setTwoFAVerifying(false)
  }

  // Disable 2FA
  const handle2FADisable = async () => {
    if (!twoFADisablePassword) {
      showToast('Password wajib diisi', 'error')
      return
    }
    setTwoFADisableLoading(true)
    try {
      const data = await apiClient.del<{ success: boolean; error?: string }>('/api/user/2fa', { password: twoFADisablePassword })
      if (data.success) {
        setTwoFAEnabled(false)
        updateSettings({ twoFactor: false })
        setShow2FADisableDialog(false)
        showToast('Two-Factor Authentication berhasil dinonaktifkan', 'success')
      } else {
        showToast(data.error || 'Gagal menonaktifkan 2FA', 'error')
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : 'Terjadi kesalahan koneksi', 'error')
    }
    setTwoFADisableLoading(false)
  }

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

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setIsUploadingAvatar(true)
    try {
      await uploadAvatar(file)
      showToast("Foto profil berhasil diperbarui!", "success")
    } catch {
      showToast("Gagal mengunggah foto profil", "error")
    } finally {
      setIsUploadingAvatar(false)
    }
    e.target.value = ""
  }

  const handleChangePassword = async () => {
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
    if (newPassword === currentPassword) {
      showToast("Password baru harus berbeda dari password saat ini", "error")
      return
    }

    setIsChangingPassword(true)
    try {
      const res = await apiClient.rawPost('/api/user/password', { currentPassword, newPassword, confirmPassword })
      const data = await res.json()

      if (!res.ok || !data.success) {
        showToast(data.error || 'Gagal mengubah password', 'error')
        return
      }

      showToast('Password berhasil diubah!', 'success')
      setShowPasswordDialog(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      showToast('Terjadi kesalahan jaringan. Coba lagi.', 'error')
    } finally {
      setIsChangingPassword(false)
    }
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
                onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                className="relative group"
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                ) : avatarUrl && !avatarError ? (
                  <div className="w-20 h-20 rounded-full overflow-hidden shadow-md ring-2 ring-emerald-500/30">
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold flex items-center justify-center text-2xl shadow-md">
                    {(currentUser?.name || "A").charAt(0).toUpperCase()}
                  </div>
                )}
                {!isUploadingAvatar && (
                  <div className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-card group-hover:scale-110 transition-transform">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
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
              {twoFALoading ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <Switch
                  checked={twoFAEnabled}
                  onCheckedChange={handle2FAToggle}
                />
              )}
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
            <Button onClick={handleChangePassword} disabled={isChangingPassword} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10 flex-1">
              {isChangingPassword ? 'Menyimpan...' : 'Ubah Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Enable Dialog */}
      <Dialog open={show2FADialog} onOpenChange={(open) => { setShow2FADialog(open); if (!open) { setTwoFAStep('otp'); setTwoFAOtp(''); setTwoFADevOtp(null); } }}>
        <DialogContent className="max-w-[340px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Aktifkan Two-Factor Auth
            </DialogTitle>
          </DialogHeader>
          {twoFAStep === 'otp' ? (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Kami akan mengirimkan kode OTP ke nomor HP Anda untuk memverifikasi identitas.
              </p>
              {currentUser?.phone && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-foreground">{currentUser.phone.replace(/(\d{3})\d+(\d{3})/, '$1****$2')}</span>
                </div>
              )}
              <Button
                onClick={handle2FASendOtp}
                disabled={twoFASending}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10"
              >
                {twoFASending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Kirim Kode OTP'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Masukkan 6 digit kode OTP yang dikirim ke HP Anda.
              </p>
              <div className="flex justify-center gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={twoFAOtp[i] || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      const newOtp = twoFAOtp.split('')
                      newOtp[i] = val
                      const combined = newOtp.join('').slice(0, 6)
                      setTwoFAOtp(combined)
                      // Auto-focus next input
                      if (val && i < 5) {
                        const nextInput = e.target.nextElementSibling as HTMLInputElement
                        nextInput?.focus()
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !twoFAOtp[i] && i > 0) {
                        const prevInput = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                        prevInput?.focus()
                      }
                    }}
                    className="w-10 h-12 text-center text-lg font-bold rounded-xl border-2 border-border focus:border-emerald-500 focus:ring-emerald-500/20 outline-none"
                  />
                ))}
              </div>
              {twoFADevOtp && (
                <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                  🔧 Dev mode — OTP: <span className="font-mono font-bold">{twoFADevOtp}</span>
                </p>
              )}
              <div className="text-center">
                {twoFACountdown > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Kirim ulang dalam <span className="font-semibold text-emerald-600">{twoFACountdown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handle2FASendOtp}
                    disabled={twoFASending}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    Kirim Ulang Kode
                  </button>
                )}
              </div>
              <Button
                onClick={handle2FAVerify}
                disabled={twoFAVerifying || twoFAOtp.length !== 6}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10"
              >
                {twoFAVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Verifikasi & Aktifkan'
                )}
              </Button>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setShow2FADialog(false); setTwoFAStep('otp'); setTwoFAOtp(''); setTwoFADevOtp(null); }} className="rounded-xl h-9 w-full">
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Dialog */}
      <Dialog open={show2FADisableDialog} onOpenChange={setShow2FADisableDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              Nonaktifkan Two-Factor Auth
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Masukkan password Anda untuk memverifikasi identitas dan menonaktifkan 2FA.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Password Saat Ini <span className="text-red-500">*</span></label>
              <Input
                type="password"
                value={twoFADisablePassword}
                onChange={(e) => setTwoFADisablePassword(e.target.value)}
                placeholder="Masukkan password"
                className="rounded-xl h-10"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShow2FADisableDialog(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={handle2FADisable}
              disabled={twoFADisableLoading || !twoFADisablePassword}
              variant="destructive"
              className="rounded-xl h-10 flex-1"
            >
              {twoFADisableLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Nonaktifkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
