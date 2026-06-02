"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { PageHeader, SectionHeader } from "../../shared"
import { useState, useRef, useEffect, useCallback } from "react"
import { Bell, Globe, Lock, MapPin, MessageSquare, FileText, RotateCcw, Shield, Settings as SettingsIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ProfileSection } from './profile-section'
import { SecuritySection } from './security-section'
import { AccountSection } from './account-section'
import type { UsernameCheckStatus, TwoFAStep } from './shared'
import { USERNAME_REGEX, USERNAME_COOLDOWN_DAYS, MAX_AVATAR_SIZE_MB } from './shared'

// ==================== MAIN SETTINGS SCREEN ====================
export function SettingsScreen() {
  const { currentUser, showToast, logout, avatarUrl, uploadAvatar, updateProfile, settings, updateSettings, deleteAccount, navigate } = useAppStore()
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<UsernameCheckStatus>('idle')
  const [usernameCheckDebounce, setUsernameCheckDebounce] = useState<NodeJS.Timeout | null>(null)
  const [avatarError, setAvatarError] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [twoFALoading, setTwoFALoading] = useState(true)
  const [show2FADialog, setShow2FADialog] = useState(false)
  const [show2FADisableDialog, setShow2FADisableDialog] = useState(false)
  const [twoFAStep, setTwoFAStep] = useState<TwoFAStep>('otp')
  const [twoFAOtp, setTwoFAOtp] = useState("")
  const [twoFADevOtp, setTwoFADevOtp] = useState<string | null>(null)
  const [twoFASending, setTwoFASending] = useState(false)
  const [twoFAVerifying, setTwoFAVerifying] = useState(false)
  const [twoFADisablePassword, setTwoFADisablePassword] = useState("")
  const [twoFADisableLoading, setTwoFADisableLoading] = useState(false)
  const [twoFACountdown, setTwoFACountdown] = useState(0)

  // Password state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Other state
  const [isSavingEmailHidden, setIsSavingEmailHidden] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

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

  const handleSaveField = async () => {
    if (!editValue.trim()) {
      showToast("Field tidak boleh kosong", "error")
      return
    }
    try {
      await updateProfile({ [editField!]: editValue.trim() })
      showToast("Profil berhasil diperbarui!", "success")
      setEditField(null)
      setEditValue("")
    } catch {
      showToast("Gagal menyimpan profil", "error")
    }
  }

  // Check username availability (debounced)
  const checkUsernameAvailability = useCallback((value: string) => {
    if (usernameCheckDebounce) clearTimeout(usernameCheckDebounce)

    const trimmed = value.trim().toLowerCase()

    if (!trimmed) {
      setUsernameCheckStatus('idle')
      return
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameCheckStatus('invalid')
      return
    }

    // Same as current username
    if (trimmed === currentUser?.username) {
      setUsernameCheckStatus('available')
      return
    }

    setUsernameCheckStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.get<{ success: boolean; data: Array<{ id: string }> }>(
          "/api/user/search",
          { q: trimmed, limit: "1" }
        )
        if (data.success && data.data) {
          const exactMatch = data.data.find(u => u.id !== currentUser?.id)
          setUsernameCheckStatus(exactMatch ? 'taken' : 'available')
        } else {
          setUsernameCheckStatus('available')
        }
      } catch {
        setUsernameCheckStatus('idle')
      }
    }, 400)
    setUsernameCheckDebounce(timer)
  }, [currentUser, usernameCheckDebounce])

  // Calculate remaining cooldown days for username change
  const getUsernameCooldownDays = useCallback(() => {
    if (!currentUser?.usernameChangedAt) return 0
    const lastChange = new Date(currentUser.usernameChangedAt)
    const now = new Date()
    const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.ceil(USERNAME_COOLDOWN_DAYS - daysSinceLastChange))
  }, [currentUser?.usernameChangedAt])

  const isUsernameOnCooldown = getUsernameCooldownDays() > 0

  const handleToggleEmailHidden = async (checked: boolean) => {
    setIsSavingEmailHidden(true)
    try {
      await updateProfile({ emailHidden: checked })
      showToast(checked ? "Email disembunyikan" : "Email ditampilkan", "success")
    } catch {
      showToast("Gagal mengubah pengaturan email", "error")
    } finally {
      setIsSavingEmailHidden(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      showToast("File harus berupa gambar", "error")
      return
    }
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
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
        {/* Profile Section */}
        <ProfileSection
          currentUser={currentUser}
          avatarUrl={avatarUrl}
          avatarError={avatarError}
          onAvatarError={setAvatarError}
          editField={editField}
          editValue={editValue}
          onEditFieldChange={setEditField}
          onEditValueChange={setEditValue}
          usernameCheckStatus={usernameCheckStatus}
          onUsernameCheckStatusChange={setUsernameCheckStatus}
          isUsernameOnCooldown={isUsernameOnCooldown}
          usernameCooldownDays={getUsernameCooldownDays()}
          onEditField={handleEditField}
          onSaveField={handleSaveField}
          onToggleEmailHidden={handleToggleEmailHidden}
          isSavingEmailHidden={isSavingEmailHidden}
          onAvatarUpload={handleAvatarUpload}
          isUploadingAvatar={isUploadingAvatar}
          avatarInputRef={avatarInputRef}
          checkUsernameAvailability={checkUsernameAvailability}
          updateProfile={updateProfile}
          showToast={showToast}
        />

        {/* Security Section */}
        <SecuritySection
          twoFAEnabled={twoFAEnabled}
          twoFALoading={twoFALoading}
          showPasswordDialog={showPasswordDialog}
          onShowPasswordDialogChange={setShowPasswordDialog}
          currentPassword={currentPassword}
          onCurrentPasswordChange={setCurrentPassword}
          newPassword={newPassword}
          onNewPasswordChange={setNewPassword}
          confirmPassword={confirmPassword}
          onConfirmPasswordChange={setConfirmPassword}
          showCurrentPassword={showCurrentPassword}
          onShowCurrentPasswordChange={setShowCurrentPassword}
          showNewPassword={showNewPassword}
          onShowNewPasswordChange={setShowNewPassword}
          isChangingPassword={isChangingPassword}
          onChangePassword={handleChangePassword}
          on2FAToggle={handle2FAToggle}
          show2FADialog={show2FADialog}
          onShow2FADialogChange={setShow2FADialog}
          show2FADisableDialog={show2FADisableDialog}
          onShow2FADisableDialogChange={setShow2FADisableDialog}
          twoFAStep={twoFAStep}
          onTwoFAStepChange={setTwoFAStep}
          twoFAOtp={twoFAOtp}
          onTwoFAOtpChange={setTwoFAOtp}
          twoFADevOtp={twoFADevOtp}
          onTwoFADevOtpChange={setTwoFADevOtp}
          twoFASending={twoFASending}
          on2FASendOtp={handle2FASendOtp}
          twoFAVerifying={twoFAVerifying}
          on2FAVerify={handle2FAVerify}
          twoFADisablePassword={twoFADisablePassword}
          onTwoFADisablePasswordChange={setTwoFADisablePassword}
          twoFADisableLoading={twoFADisableLoading}
          on2FADisable={handle2FADisable}
          twoFACountdown={twoFACountdown}
          currentUserPhone={currentUser?.phone}
        />

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
        <AccountSection onDeleteAccount={handleDeleteAccount} />
      </div>
    </div>
  )
}
