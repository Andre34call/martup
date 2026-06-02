"use client"

import { motion } from "framer-motion"
import { Settings as SettingsIcon, Camera, Edit, AtSign, Clock, AlertCircle, Check, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { fadeIn } from '@/lib/animations'
import { SectionHeader } from "../../shared"
import type { UsernameCheckStatus } from './shared'

// ==================== PROFILE SECTION ====================
export function ProfileSection({
  currentUser,
  avatarUrl,
  avatarError,
  onAvatarError,
  editField,
  editValue,
  onEditFieldChange,
  onEditValueChange,
  usernameCheckStatus,
  onUsernameCheckStatusChange,
  isUsernameOnCooldown,
  usernameCooldownDays,
  onEditField,
  onSaveField,
  onToggleEmailHidden,
  isSavingEmailHidden,
  onAvatarUpload,
  isUploadingAvatar,
  avatarInputRef,
  checkUsernameAvailability,
  updateProfile,
  showToast,
}: {
  currentUser: {
    name?: string | null
    username?: string | null
    email?: string | null
    phone?: string | null
    emailHidden?: boolean
    id?: string
  } | null
  avatarUrl: string | null
  avatarError: boolean
  onAvatarError: (error: boolean) => void
  editField: string | null
  editValue: string
  onEditFieldChange: (field: string | null) => void
  onEditValueChange: (value: string) => void
  usernameCheckStatus: UsernameCheckStatus
  onUsernameCheckStatusChange: (status: UsernameCheckStatus) => void
  isUsernameOnCooldown: boolean
  usernameCooldownDays: number
  onEditField: (field: string, value: string) => void
  onSaveField: () => Promise<void>
  onToggleEmailHidden: (checked: boolean) => Promise<void>
  isSavingEmailHidden: boolean
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  isUploadingAvatar: boolean
  avatarInputRef: React.RefObject<HTMLInputElement | null>
  checkUsernameAvailability: (value: string) => void
  updateProfile: (data: Record<string, unknown>) => Promise<void>
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}) {
  return (
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
            onChange={onAvatarUpload}
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
                  onError={() => onAvatarError(true)}
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
                  onChange={(e) => onEditValueChange(e.target.value)}
                  className="h-8 text-sm rounded-lg"
                  autoFocus
                />
                <Button size="sm" onClick={onSaveField} className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-[11px]">
                  Simpan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEditFieldChange(null)} className="h-8 px-2 rounded-lg text-[11px]">
                  Batal
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{currentUser?.name || "Ahmad Fauzi"}</p>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => onEditField("name", currentUser?.name || "Ahmad Fauzi")}>
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
              </div>
            )}
          </div>
        </div>
        <Separator />

        {/* Username Field */}
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <AtSign className="w-3 h-3 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Username</p>
              {isUsernameOnCooldown && editField !== "username" && (
                <span className="flex items-center gap-0.5 text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md font-medium">
                  <Clock className="w-2.5 h-2.5" />
                  {usernameCooldownDays}h lagi
                </span>
              )}
            </div>
            {editField === "username" ? (
              <div className="space-y-1.5 mt-1">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                  <Input
                    value={editValue}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
                      onEditValueChange(val)
                      checkUsernameAvailability(val)
                    }}
                    className="h-8 text-sm rounded-lg pl-7 pr-8"
                    placeholder="kholis"
                    maxLength={20}
                    autoFocus
                    disabled={isUsernameOnCooldown}
                  />
                  {/* Status indicator */}
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {usernameCheckStatus === 'checking' && (
                      <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                    )}
                    {usernameCheckStatus === 'available' && (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    {usernameCheckStatus === 'taken' && (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    )}
                    {usernameCheckStatus === 'invalid' && (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                </div>
                {/* Validation messages */}
                {usernameCheckStatus === 'available' && (
                  <p className="text-[10px] text-emerald-600 font-medium">Username tersedia!</p>
                )}
                {usernameCheckStatus === 'taken' && (
                  <p className="text-[10px] text-red-500 font-medium">Username sudah dipakai orang lain</p>
                )}
                {usernameCheckStatus === 'invalid' && (
                  <p className="text-[10px] text-amber-600 font-medium">3-20 karakter, huruf kecil, angka, _ atau -</p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (usernameCheckStatus !== 'available') {
                        showToast("Username tidak tersedia atau tidak valid", "error")
                        return
                      }
                      try {
                        await updateProfile({ username: editValue.trim().toLowerCase() })
                        showToast("Username berhasil diperbarui!", "success")
                        onEditFieldChange(null)
                        onEditValueChange("")
                        onUsernameCheckStatusChange('idle')
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "Gagal menyimpan username"
                        showToast(msg, "error")
                      }
                    }}
                    disabled={usernameCheckStatus !== 'available'}
                    className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-[11px]"
                  >
                    Simpan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { onEditFieldChange(null); onEditValueChange(""); onUsernameCheckStatusChange('idle') }} className="h-8 px-2 rounded-lg text-[11px]">
                    Batal
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Username hanya bisa diganti setiap 30 hari
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {currentUser?.username ? `@${currentUser.username}` : (
                    <span className="text-muted-foreground italic text-xs">Belum diatur</span>
                  )}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  onClick={() => {
                    if (isUsernameOnCooldown) {
                      showToast(`Username hanya bisa diganti setiap 30 hari. Tunggu ${usernameCooldownDays} hari lagi.`, "warning")
                      return
                    }
                    onEditField("username", currentUser?.username || "")
                    onUsernameCheckStatusChange('idle')
                  }}
                >
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
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Email</p>
              {currentUser?.emailHidden && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md">TERSEMBUNYI</span>
              )}
            </div>
            {editField === "email" ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={editValue}
                  onChange={(e) => onEditValueChange(e.target.value)}
                  className="h-8 text-sm rounded-lg"
                  autoFocus
                />
                <Button size="sm" onClick={onSaveField} className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-[11px]">
                  Simpan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEditFieldChange(null)} className="h-8 px-2 rounded-lg text-[11px]">
                  Batal
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{currentUser?.email || "ahmad@email.com"}</p>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => onEditField("email", currentUser?.email || "ahmad@email.com")}>
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
              </div>
            )}
          </div>
        </div>
        <Separator />

        {/* Hide Email Toggle */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              {currentUser?.emailHidden ? <EyeOff className="w-4 h-4 text-violet-600" /> : <Eye className="w-4 h-4 text-violet-600" />}
            </div>
            <div>
              <span className="text-sm font-medium text-foreground">Sembunyikan Email</span>
              <p className="text-xs text-muted-foreground">Email tidak terlihat oleh pengguna lain</p>
            </div>
          </div>
          {isSavingEmailHidden ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Switch
              checked={currentUser?.emailHidden ?? false}
              onCheckedChange={onToggleEmailHidden}
            />
          )}
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
                  onChange={(e) => onEditValueChange(e.target.value)}
                  className="h-8 text-sm rounded-lg"
                  autoFocus
                />
                <Button size="sm" onClick={onSaveField} className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-[11px]">
                  Simpan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEditFieldChange(null)} className="h-8 px-2 rounded-lg text-[11px]">
                  Batal
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{currentUser?.phone || "08123456789"}</p>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" onClick={() => onEditField("phone", currentUser?.phone || "08123456789")}>
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

