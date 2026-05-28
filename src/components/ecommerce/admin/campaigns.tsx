"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Megaphone, Check, X, Ban, Eye, Zap, ImageIcon, TrendingUp, Store, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { formatDate } from "@/lib/utils"
import { PageHeader, EmptyState } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { ConfirmDialog } from "../confirm-dialog"
import { getAuthHeaders } from '@/lib/store/getAuthHeaders'

// ==================== ANIMATION VARIANTS ====================
const stagger = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
}

// ==================== TYPE DEFINITIONS ====================
interface CampaignItem {
  id: string
  sellerId: string
  sellerStoreName: string
  sellerAvatar: string | null
  sellerVerified: boolean
  name: string
  type: string
  startDate: string
  endDate: string
  discount: number
  isActive: boolean
  isExpired: boolean
  isUpcoming: boolean
  createdAt: string
}

// ==================== ADMIN CAMPAIGNS ====================
export function AdminCampaigns() {
  const { showToast } = useAppStore()
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/campaigns", { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setCampaigns(data.data)
      }
    } catch {
      showToast("Gagal memuat kampanye", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const getCampaignStatus = (c: CampaignItem): string => {
    if (!c.isActive) return "inactive"
    if (c.isExpired) return "expired"
    if (c.isUpcoming) return "upcoming"
    return "active"
  }

  const filtered = campaigns.filter(c => {
    return statusFilter === "all" || getCampaignStatus(c) === statusFilter
  })

  const handleToggleActive = async (campaignId: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ campaignId, isActive: !isActive }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(isActive ? "Kampanye dinonaktifkan" : "Kampanye diaktifkan", "success")
        fetchCampaigns()
      } else {
        showToast(data.error || "Gagal memperbarui kampanye", "error")
      }
    } catch {
      showToast("Gagal memperbarui kampanye", "error")
    }
  }

  const typeLabel: Record<string, string> = {
    flash_sale: "Flash Sale",
    banner: "Banner",
    boost: "Boost",
  }

  const typeColor: Record<string, string> = {
    flash_sale: "bg-orange-50 dark:bg-orange-900/30 text-orange-600",
    banner: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600",
    boost: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600",
  }

  const typeIcon: Record<string, React.ReactNode> = {
    flash_sale: <Zap className="w-4 h-4" />,
    banner: <ImageIcon className="w-4 h-4" />,
    boost: <TrendingUp className="w-4 h-4" />,
  }

  const statusLabelMap: Record<string, string> = {
    active: "Aktif",
    inactive: "Nonaktif",
    expired: "Kedaluwarsa",
    upcoming: "Akan Datang",
  }

  const statusColorMap: Record<string, string> = {
    active: "border-emerald-300 text-emerald-600",
    inactive: "border-gray-300 text-gray-500",
    expired: "border-red-300 text-red-600",
    upcoming: "border-amber-300 text-amber-600",
  }

  return (
    <div className="pb-20">
      <PageHeader title="Moderasi Kampanye" rightAction={
        <span className="text-xs text-muted-foreground">{campaigns.filter(c => getCampaignStatus(c) === "active").length} aktif</span>
      } />

      <div className="px-4 space-y-4">
        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Aktif" },
            { key: "inactive", label: "Nonaktif" },
            { key: "expired", label: "Kedaluwarsa" },
            { key: "upcoming", label: "Akan Datang" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === filter.key
                  ? "bg-cyan-600 text-white border-cyan-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Campaign List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="w-10 h-10 text-muted-foreground" />}
              title="Kampanye Tidak Ditemukan"
              subtitle="Tidak ada kampanye dengan filter ini"
            />
          ) : (
            filtered.map((campaign, i) => {
              const cStatus = getCampaignStatus(campaign)
              const tColor = typeColor[campaign.type] || "bg-muted text-muted-foreground"
              return (
                <motion.div key={campaign.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tColor}`}>
                        {typeIcon[campaign.type] || <Megaphone className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{campaign.name}</p>
                          <Badge variant="outline" className={`text-[9px] ${statusColorMap[cStatus]}`}>
                            {statusLabelMap[cStatus]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-600">
                            {typeLabel[campaign.type] || campaign.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Diskon {campaign.discount}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Store className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{campaign.sellerStoreName}</span>
                          {campaign.sellerVerified && (
                            <Check className="w-3 h-3 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] rounded-lg"
                        onClick={() => setSelectedCampaign(campaign)}
                      >
                        <Eye className="w-3 h-3 mr-0.5" /> Detail
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] rounded-lg"
                        onClick={() => setConfirmAction({
                          action: () => handleToggleActive(campaign.id, campaign.isActive),
                          title: campaign.isActive ? 'Nonaktifkan Kampanye' : 'Aktifkan Kampanye',
                          message: campaign.isActive
                            ? `Apakah Anda yakin ingin menonaktifkan kampanye "${campaign.name}"? Kampanye tidak akan terlihat oleh pembeli.`
                            : `Apakah Anda yakin ingin mengaktifkan kampanye "${campaign.name}"? Kampanye akan terlihat oleh pembeli.`
                        })}
                      >
                        {campaign.isActive ? (
                          <><Ban className="w-3 h-3 mr-0.5" /> Tolak</>
                        ) : (
                          <><Check className="w-3 h-3 mr-0.5" /> Setujui</>
                        )}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Campaign Detail Modal */}
      <AnimatePresence>
        {selectedCampaign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setSelectedCampaign(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-2xl p-6 w-full max-w-md max-h-[70vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{selectedCampaign.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={`text-[10px] ${statusColorMap[getCampaignStatus(selectedCampaign)]}`}>
                      {statusLabelMap[getCampaignStatus(selectedCampaign)]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">
                      {typeLabel[selectedCampaign.type] || selectedCampaign.type}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Seller</span>
                    <span className="text-xs font-medium text-foreground">{selectedCampaign.sellerStoreName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Diskon</span>
                    <span className="text-xs font-bold text-orange-600">{selectedCampaign.discount}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Mulai</span>
                    <span className="text-xs text-foreground">{formatDate(selectedCampaign.startDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Berakhir</span>
                    <span className="text-xs text-foreground">{formatDate(selectedCampaign.endDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status Aktif</span>
                    <span className={`text-xs font-medium ${selectedCampaign.isActive ? "text-emerald-600" : "text-gray-500"}`}>
                      {selectedCampaign.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      if (!selectedCampaign.isActive) {
                        setConfirmAction({
                          action: () => handleToggleActive(selectedCampaign.id, false),
                          title: 'Aktifkan Kampanye',
                          message: `Apakah Anda yakin ingin mengaktifkan kampanye "${selectedCampaign.name}"? Kampanye akan terlihat oleh pembeli.`
                        })
                      }
                      setSelectedCampaign(null)
                    }}
                  >
                    <Check className="w-4 h-4 mr-1" /> Setujui
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => {
                      if (selectedCampaign.isActive) {
                        setConfirmAction({
                          action: () => handleToggleActive(selectedCampaign.id, true),
                          title: 'Nonaktifkan Kampanye',
                          message: `Apakah Anda yakin ingin menonaktifkan kampanye "${selectedCampaign.name}"? Kampanye tidak akan terlihat oleh pembeli.`
                        })
                      }
                      setSelectedCampaign(null)
                    }}
                  >
                    <X className="w-4 h-4 mr-1" /> Tolak
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />
    </div>
  )
}
