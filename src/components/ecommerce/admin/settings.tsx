"use client"

import { motion } from "framer-motion"
import {
  Settings, Banknote, Box, ToggleLeft, Gift, Clock, Save
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useAppStore } from "@/lib/store"
import { PageHeader, SectionHeader } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { getAuthHeaders } from '@/lib/store/getAuthHeaders'

// ==================== ANIMATION VARIANTS ====================
const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 }
}

// ==================== TYPE DEFINITIONS ====================
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
}

// ==================== ADMIN SETTINGS ====================
export function AdminSettings() {
  const { showToast, fetchPlatformSettings } = useAppStore()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/settings", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        // Sync to global store so other components (checkout, etc.) can use settings
        fetchPlatformSettings()
      }
    } catch {
      showToast("Gagal memuat pengaturan", "error")
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
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Pengaturan berhasil disimpan", "success")
        setSettings(data.data)
        // Sync updated settings to global store
        fetchPlatformSettings()
      } else {
        showToast(data.error || "Gagal menyimpan pengaturan", "error")
      }
    } catch {
      showToast("Gagal menyimpan pengaturan", "error")
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof PlatformSettings, value: number | boolean) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
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
