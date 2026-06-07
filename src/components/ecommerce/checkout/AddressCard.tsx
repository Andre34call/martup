"use client"

import { motion } from "framer-motion"
import { MapPin, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Address } from "@/lib/types"

export function AddressCard({ address, onChange }: { address: Address | null; onChange: () => void }) {
  if (!address) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onChange}
        className="w-full p-4 bg-card rounded-xl border border-dashed border-emerald-500 flex items-center justify-center gap-2 text-emerald-600"
      >
        <MapPin className="w-5 h-5" />
        <span className="text-sm font-medium">Tambah Alamat Pengiriman</span>
      </motion.button>
    )
  }

  return (
    <div className="p-4 bg-card rounded-xl border border-border/50">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">{address.recipient}</span>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] px-1.5 py-0.5">
                {address.label}
              </Badge>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{address.phone}</p>
              {address.phone && !address.phone.startsWith('0') && !address.phone.startsWith('+') && (
                <div className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span className="text-[10px]">Nomor telepon harus diawali dengan "0" atau "+"</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {address.address}, {address.city}, {address.province} {address.postalCode}
            </p>
          </div>
        </div>
        <button
          onClick={onChange}
          className="text-xs text-emerald-600 font-medium flex-shrink-0 ml-2"
        >
          Ubah
        </button>
      </div>
    </div>
  )
}
