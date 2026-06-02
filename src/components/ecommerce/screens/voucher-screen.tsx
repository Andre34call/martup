"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, EmptyState, PrimaryButton } from "../shared"
import { useState, useEffect, useMemo } from "react"
import { Ticket, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { logger } from '@/lib/logger'
import { apiClient } from '@/lib/api-client'

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
        const data = await apiClient.get<{ success: boolean; data?: any[] }>('/api/vouchers')
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
      } catch (error) {
        logger.warn({ component: 'vouchers', err: error }, 'Failed to fetch vouchers')
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
          <PrimaryButton onClick={handleUseCode} className="rounded-xl h-10 px-5">
            Pakai
          </PrimaryButton>
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
                      <PrimaryButton size="sm" onClick={() => handleUseVoucher(voucher)} className="h-7 text-[11px] rounded-lg">
                        Gunakan
                      </PrimaryButton>
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
