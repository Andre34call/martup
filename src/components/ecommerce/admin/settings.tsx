"use client"

import { motion } from "framer-motion"
import {
  Settings, Banknote, Box, ToggleLeft, Gift, Clock, Save, Landmark, Plus, Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useAppStore } from "@/lib/store"
import { PageHeader, SectionHeader } from "../shared"
import { fadeIn } from '@/lib/animations'
import { useState, useEffect, useCallback } from "react"
import { apiClient, ApiClientError } from '@/lib/api-client'
import { handleApiError } from '@/lib/handle-api-error'

// ==================== TYPE DEFINITIONS ====================
interface MartUpBankAccount {
  bankName: string
  accountNumber: string
  accountHolder: string
}

interface PlatformSettings {
  commissionRate: number
  minWithdrawal: number
  platformFee: number
  maxProductImages: number
  maxProductVariants: number
  voucherEnabled: boolean
  depositEnabled: boolean
  campaignEnabled: boolean
  chatEnabled: boolean
  reviewEnabled: boolean
  referralReward: number
  loyaltyPointsRate: number
  flashSaleEnabled: boolean
  autoConfirmDays: number
  returnWindowDays: number
  martupBankAccounts: MartUpBankAccount[]
}

// ==================== TYPE ALIASES (avoid TSX generic ambiguity) ====================
type SettingsResponse = { success: boolean; data: PlatformSettings; error?: string }

// ==================== ADMIN SETTINGS ====================
export function AdminSettings() {
  const { showToast, fetchPlatformSettings } = useAppStore()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<SettingsResponse>("/api/admin/settings")
      if (data.success) {
        setSettings(data.data)
        // Sync to global store so other components (checkout, etc.) can use settings
        fetchPlatformSettings()
      }
    } catch (err) {
      handleApiError(err, "pengaturan")
    } finally {
      setLoading(false)
    }
  }, [showToast, fetchPlatformSettings])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    if (!settings) return
    try {
      setSaving(true)
      const data = await apiClient.put<SettingsResponse>("/api/admin/settings", settings)
      if (data.success) {
        showToast("Pengaturan berhasil disimpan", "success")
        setSettings(data.data)
        // Sync updated settings to global store
        fetchPlatformSettings()
      } else {
        showToast(data.error || "Gagal menyimpan pengaturan", "error")
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Gagal menyimpan pengaturan", "error")
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof PlatformSettings, value: number | boolean | MartUpBankAccount[]) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  const addBankAccount = () => {
    if (!settings) return
    const updated = [...(settings.martupBankAccounts || []), { bankName: '', accountNumber: '', accountHolder: '' }]
    updateSetting('martupBankAccounts', updated)
  }

  const removeBankAccount = (index: number) => {
    if (!settings) return
    const updated = settings.martupBankAccounts.filter((_, i) => i !== index)
    updateSetting('martupBankAccounts', updated)
  }

  const updateBankAccount = (index: number, field: keyof MartUpBankAccount, value: string) => {
    if (!settings) return
    const updated = settings.martupBankAccounts.map((acc, i) =>
      i === index ? { ...acc, [field]: value } : acc
    )
    updateSetting('martupBankAccounts', updated)
  }

  if (loading) {
    return (
      <div className="pb-20">
        <PageHeader title="Pengaturan Platform" />
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="pb-20">
      <PageHeader title="Pengaturan Platform" showBack={true} />

      <div className="px-4 space-y-4 pt-2">
        {/* Financial Settings */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Keuangan" icon={<Banknote className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Komisi Platform</p>
                <p className="text-[10px] text-muted-foreground">Persentase dari setiap transaksi</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={settings.commissionRate}
                  onChange={(e) => updateSetting("commissionRate", parseFloat(e.target.value) || 0)}
                  className="w-20 h-8 text-center text-sm rounded-lg"
                  min={0}
                  max={100}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Min. Penarikan</p>
                <p className="text-[10px] text-muted-foreground">Jumlah minimum untuk penarikan</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  type="number"
                  value={settings.minWithdrawal}
                  onChange={(e) => updateSetting("minWithdrawal", parseFloat(e.target.value) || 0)}
                  className="w-28 h-8 text-center text-sm rounded-lg"
                  min={0}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Biaya Platform</p>
                <p className="text-[10px] text-muted-foreground">Biaya per transaksi</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  type="number"
                  value={settings.platformFee}
                  onChange={(e) => updateSetting("platformFee", parseFloat(e.target.value) || 0)}
                  className="w-28 h-8 text-center text-sm rounded-lg"
                  min={0}
                />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Product Limits */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Batas Produk" icon={<Box className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Maks. Gambar Produk</p>
                <p className="text-[10px] text-muted-foreground">Jumlah gambar per produk</p>
              </div>
              <Input
                type="number"
                value={settings.maxProductImages}
                onChange={(e) => updateSetting("maxProductImages", parseInt(e.target.value) || 1)}
                className="w-20 h-8 text-center text-sm rounded-lg"
                min={1}
                max={20}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Maks. Varian Produk</p>
                <p className="text-[10px] text-muted-foreground">Jumlah varian per produk</p>
              </div>
              <Input
                type="number"
                value={settings.maxProductVariants}
                onChange={(e) => updateSetting("maxProductVariants", parseInt(e.target.value) || 1)}
                className="w-20 h-8 text-center text-sm rounded-lg"
                min={1}
                max={20}
              />
            </div>
          </Card>
        </motion.div>

        {/* Feature Toggles */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Fitur Platform" icon={<ToggleLeft className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            {[
              { key: "voucherEnabled" as const, label: "Voucher", desc: "Aktifkan sistem voucher" },
              { key: "depositEnabled" as const, label: "Deposit", desc: "Aktifkan top-up saldo" },
              { key: "campaignEnabled" as const, label: "Kampanye", desc: "Aktifkan kampanye seller" },
              { key: "flashSaleEnabled" as const, label: "Flash Sale", desc: "Aktifkan fitur flash sale" },
              { key: "chatEnabled" as const, label: "Chat", desc: "Aktifkan fitur chat" },
              { key: "reviewEnabled" as const, label: "Review", desc: "Aktifkan ulasan produk" },
            ].map((item, idx) => (
              <div key={item.key}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={settings[item.key] as boolean}
                    onCheckedChange={(checked) => updateSetting(item.key, checked)}
                  />
                </div>
                {idx < 5 && <Separator className="mt-4" />}
              </div>
            ))}
          </Card>
        </motion.div>

        {/* Rewards */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Hadiah & Loyalitas" icon={<Gift className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Hadiah Referral</p>
                <p className="text-[10px] text-muted-foreground">Bonus untuk undangan berhasil</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Rp</span>
                <Input
                  type="number"
                  value={settings.referralReward}
                  onChange={(e) => updateSetting("referralReward", parseFloat(e.target.value) || 0)}
                  className="w-28 h-8 text-center text-sm rounded-lg"
                  min={0}
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Rate Poin Loyalitas</p>
                <p className="text-[10px] text-muted-foreground">Poin per Rp10.000 pembelanjaan</p>
              </div>
              <Input
                type="number"
                value={settings.loyaltyPointsRate}
                onChange={(e) => updateSetting("loyaltyPointsRate", parseFloat(e.target.value) || 0)}
                className="w-20 h-8 text-center text-sm rounded-lg"
                min={0}
              />
            </div>
          </Card>
        </motion.div>

        {/* Rekening MartUp (Escrow) */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Rekening MartUp" icon={<Landmark className="w-4 h-4" />} />
          <p className="text-[10px] text-muted-foreground mt-1 px-1">
            Rekening tujuan escrow — buyer transfer ke rekening ini, dana ditahan sampai pesanan selesai
          </p>
          <Card className="mt-3 p-4 space-y-3">
            {(settings.martupBankAccounts || []).length === 0 && (
              <div className="text-center py-4">
                <Landmark className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">Belum ada rekening MartUp</p>
                <p className="text-[10px] text-muted-foreground">Tambahkan rekening untuk menerima pembayaran escrow</p>
              </div>
            )}
            {(settings.martupBankAccounts || []).map((acc, idx) => (
              <div key={idx} className="relative border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-600">Rekening #{idx + 1}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                    onClick={() => removeBankAccount(idx)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Nama Bank</label>
                    <select
                      value={acc.bankName}
                      onChange={(e) => updateBankAccount(idx, 'bankName', e.target.value)}
                      className="w-full h-8 text-sm rounded-md border bg-background px-2 mt-0.5"
                    >
                      <option value="">-- Pilih Bank --</option>
                      <option value="BCA">BCA</option>
                      <option value="Mandiri">Mandiri</option>
                      <option value="BNI">BNI</option>
                      <option value="BRI">BRI</option>
                      <option value="BSI">BSI</option>
                      <option value="CIMB Niaga">CIMB Niaga</option>
                      <option value="Danamon">Danamon</option>
                      <option value="Permata">Permata</option>
                      <option value="BTN">BTN</option>
                      <option value="Maybank">Maybank</option>
                      <option value="OCBC NISP">OCBC NISP</option>
                      <option value="Panin Bank">Panin Bank</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Nomor Rekening</label>
                    <Input
                      value={acc.accountNumber}
                      onChange={(e) => updateBankAccount(idx, 'accountNumber', e.target.value)}
                      placeholder="Contoh: 1234567890"
                      className="h-8 text-sm mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Atas Nama</label>
                    <Input
                      value={acc.accountHolder}
                      onChange={(e) => updateBankAccount(idx, 'accountHolder', e.target.value)}
                      placeholder="Contoh: PT MartUp Indonesia"
                      className="h-8 text-sm mt-0.5"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full h-9 text-xs rounded-lg border-dashed border-amber-600/50 text-amber-600 hover:bg-amber-50"
              onClick={addBankAccount}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Tambah Rekening
            </Button>
          </Card>
        </motion.div>

        {/* Order Settings */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pengaturan Pesanan" icon={<Clock className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Auto Konfirmasi</p>
                <p className="text-[10px] text-muted-foreground">Otomatis konfirmasi setelah (hari)</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={settings.autoConfirmDays}
                  onChange={(e) => updateSetting("autoConfirmDays", parseInt(e.target.value) || 1)}
                  className="w-20 h-8 text-center text-sm rounded-lg"
                  min={1}
                  max={30}
                />
                <span className="text-xs text-muted-foreground">hari</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Jendela Pengembalian</p>
                <p className="text-[10px] text-muted-foreground">Batas waktu pengembalian setelah terima</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={settings.returnWindowDays}
                  onChange={(e) => updateSetting("returnWindowDays", parseInt(e.target.value) || 1)}
                  className="w-20 h-8 text-center text-sm rounded-lg"
                  min={1}
                  max={30}
                />
                <span className="text-xs text-muted-foreground">hari</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Global Save Button */}
        <motion.div {...fadeIn}>
          <Button
            className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
