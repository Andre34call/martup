"use client"

import { motion } from "framer-motion"
import { Plus, Megaphone, Zap, Tag, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader, EmptyState } from "../shared"
import { useState } from "react"

export function SellerCampaign() {
  const { navigate } = useAppStore()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="pb-20">
      <PageHeader title="Kampanye & Promo" rightAction={
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Buat Kampanye
        </Button>
      } />

      <div className="px-4 space-y-4">
        {/* Active Campaigns */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Kampanye Aktif" icon={<Megaphone className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            <EmptyState
              icon={<Megaphone className="w-10 h-10 text-muted-foreground" />}
              title="Belum Ada Kampanye"
              subtitle="Buat kampanye atau promo untuk menarik lebih banyak pembeli"
            />
          </div>
        </motion.div>

        {/* Create Campaign Form */}
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <SectionHeader title="Buat Kampanye Baru" icon={<Plus className="w-4 h-4" />} />
            <Card className="mt-3 p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Nama Kampanye <span className="text-red-500">*</span></label>
                <Input placeholder="Contoh: Flash Sale Akhir Tahun" className="rounded-xl" />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium text-foreground">Tipe Kampanye <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl text-xs h-9">
                    <Zap className="w-3 h-3 mr-1" /> Flash Sale
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl text-xs h-9">
                    <Tag className="w-3 h-3 mr-1" /> Voucher
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Diskon (%) <span className="text-red-500">*</span></label>
                <Input type="number" placeholder="10" className="rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Mulai <span className="text-red-500">*</span></label>
                  <Input type="date" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Berakhir <span className="text-red-500">*</span></label>
                  <Input type="date" className="rounded-xl" />
                </div>
              </div>

              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10">
                Buat Kampanye
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Flash Sale Setup */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Flash Sale Setup" icon={<Zap className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="flex flex-col items-center justify-center text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                <Zap className="w-7 h-7 text-orange-500" />
              </div>
              <p className="text-sm font-medium text-foreground">Buat Flash Sale</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Tampilkan produk dengan diskon spesial untuk waktu terbatas</p>
              <Button
                onClick={() => setShowCreate(true)}
                variant="outline"
                className="mt-3 rounded-xl text-xs"
              >
                Setup Flash Sale
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Voucher Creation */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Voucher Creation" icon={<Gift className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="flex flex-col items-center justify-center text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mb-3">
                <Gift className="w-7 h-7 text-violet-500" />
              </div>
              <p className="text-sm font-medium text-foreground">Buat Voucher</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Buat voucher diskon untuk menarik lebih banyak pembeli</p>
              <Button
                onClick={() => setShowCreate(true)}
                variant="outline"
                className="mt-3 rounded-xl text-xs"
              >
                Buat Voucher
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
