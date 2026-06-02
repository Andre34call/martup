"use client"

import { motion } from "framer-motion"
import { Shield, Lock, ChevronRight, Phone, Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { fadeIn } from '@/lib/animations'
import { SectionHeader } from "../../shared"
import type { TwoFAStep } from './shared'

// ==================== SECURITY SECTION ====================
export function SecuritySection({
  twoFAEnabled,
  twoFALoading,
  showPasswordDialog,
  onShowPasswordDialogChange,
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  showCurrentPassword,
  onShowCurrentPasswordChange,
  showNewPassword,
  onShowNewPasswordChange,
  isChangingPassword,
  onChangePassword,
  on2FAToggle,
  show2FADialog,
  onShow2FADialogChange,
  show2FADisableDialog,
  onShow2FADisableDialogChange,
  twoFAStep,
  onTwoFAStepChange,
  twoFAOtp,
  onTwoFAOtpChange,
  twoFADevOtp,
  onTwoFADevOtpChange,
  twoFASending,
  on2FASendOtp,
  twoFAVerifying,
  on2FAVerify,
  twoFADisablePassword,
  onTwoFADisablePasswordChange,
  twoFADisableLoading,
  on2FADisable,
  twoFACountdown,
  currentUserPhone,
}: {
  twoFAEnabled: boolean
  twoFALoading: boolean
  showPasswordDialog: boolean
  onShowPasswordDialogChange: (show: boolean) => void
  currentPassword: string
  onCurrentPasswordChange: (value: string) => void
  newPassword: string
  onNewPasswordChange: (value: string) => void
  confirmPassword: string
  onConfirmPasswordChange: (value: string) => void
  showCurrentPassword: boolean
  onShowCurrentPasswordChange: (show: boolean) => void
  showNewPassword: boolean
  onShowNewPasswordChange: (show: boolean) => void
  isChangingPassword: boolean
  onChangePassword: () => Promise<void>
  on2FAToggle: (checked: boolean) => void
  show2FADialog: boolean
  onShow2FADialogChange: (show: boolean) => void
  show2FADisableDialog: boolean
  onShow2FADisableDialogChange: (show: boolean) => void
  twoFAStep: TwoFAStep
  onTwoFAStepChange: (step: TwoFAStep) => void
  twoFAOtp: string
  onTwoFAOtpChange: (otp: string) => void
  twoFADevOtp: string | null
  onTwoFADevOtpChange: (otp: string | null) => void
  twoFASending: boolean
  on2FASendOtp: () => Promise<void>
  twoFAVerifying: boolean
  on2FAVerify: () => Promise<void>
  twoFADisablePassword: string
  onTwoFADisablePasswordChange: (password: string) => void
  twoFADisableLoading: boolean
  on2FADisable: () => Promise<void>
  twoFACountdown: number
  currentUserPhone?: string | null
}) {
  return (
    <>
      {/* Security Card */}
      <motion.div {...fadeIn}>
        <SectionHeader title="Keamanan" icon={<Shield className="w-4 h-4" />} />
        <Card className="mt-3 p-4 space-y-3">
          <button className="w-full flex items-center justify-between py-1" onClick={() => onShowPasswordDialogChange(true)}>
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
                onCheckedChange={on2FAToggle}
              />
            )}
          </div>
        </Card>
      </motion.div>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={onShowPasswordDialogChange}>
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
                  onChange={(e) => onCurrentPasswordChange(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  className="pr-10 rounded-xl h-10"
                />
                <button
                  onClick={() => onShowCurrentPasswordChange(!showCurrentPassword)}
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
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="pr-10 rounded-xl h-10"
                />
                <button
                  onClick={() => onShowNewPasswordChange(!showNewPassword)}
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
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                placeholder="Ulangi password baru"
                className="rounded-xl h-10"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[10px] text-red-500">Password tidak cocok</p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => onShowPasswordDialogChange(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button onClick={onChangePassword} disabled={isChangingPassword} className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10 flex-1">
              {isChangingPassword ? 'Menyimpan...' : 'Ubah Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Enable Dialog */}
      <Dialog open={show2FADialog} onOpenChange={(open) => { onShow2FADialogChange(open); if (!open) { onTwoFAStepChange('otp'); onTwoFAOtpChange(''); onTwoFADevOtpChange(null); } }}>
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
              {currentUserPhone && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-foreground">{currentUserPhone.replace(/(\d{3})\d+(\d{3})/, '$1****$2')}</span>
                </div>
              )}
              <Button
                onClick={on2FASendOtp}
                disabled={twoFASending}
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10"
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
                      onTwoFAOtpChange(combined)
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
                    onClick={on2FASendOtp}
                    disabled={twoFASending}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    Kirim Ulang Kode
                  </button>
                )}
              </div>
              <Button
                onClick={on2FAVerify}
                disabled={twoFAVerifying || twoFAOtp.length !== 6}
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10"
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
            <Button variant="outline" onClick={() => { onShow2FADialogChange(false); onTwoFAStepChange('otp'); onTwoFAOtpChange(''); onTwoFADevOtpChange(null); }} className="rounded-xl h-9 w-full">
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Dialog */}
      <Dialog open={show2FADisableDialog} onOpenChange={onShow2FADisableDialogChange}>
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
                onChange={(e) => onTwoFADisablePasswordChange(e.target.value)}
                placeholder="Masukkan password"
                className="rounded-xl h-10"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => onShow2FADisableDialogChange(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={on2FADisable}
              disabled={twoFADisableLoading || !twoFADisablePassword}
              variant="destructive"
              className="rounded-xl h-10 flex-1"
            >
              {twoFADisableLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Nonaktifkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
