"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, Truck, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import type { ShippingOption } from "@/lib/types"

// ==================== SHIPPING SELECTOR ====================
export function ShippingSelector({
  selectedShipping,
  onSelect,
  options,
  isLoading,
  error,
  onRetry
}: {
  selectedShipping: ShippingOption | null
  onSelect: (option: ShippingOption) => void
  options: ShippingOption[]
  isLoading?: boolean
  error?: string
  onRetry?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Show error state instead of shipping options
  if (error && !isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-red-600">Gagal Menghitung Ongkir</span>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-xl">
          <p className="text-xs text-red-600 dark:text-red-400">
            Gagal menghitung ongkir ke alamat ini. Pastikan kota tujuan valid atau coba lagi.
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2 h-7 text-[11px] rounded-lg border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Hitung Ulang
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium">
            {isLoading ? 'Menghitung ongkir...' : selectedShipping ? selectedShipping.name : 'Pilih Pengiriman'}
          </span>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 p-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                  />
                  <span className="text-xs text-muted-foreground">Menghitung ongkos kirim...</span>
                </div>
              ) : options.length === 0 ? (
                <div className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Ongkir tidak tersedia untuk alamat ini. Silakan gunakan kota yang valid.</p>
                </div>
              ) : (
                options.map((option) => {
                  const isSelected = selectedShipping?.service === option.service && selectedShipping?.provider === option.provider

                  return (
                    <motion.button
                      key={`${option.provider}-${option.service}`}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onSelect(option)
                        setIsExpanded(false)
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500"
                          : "bg-card border-border/50 hover:border-emerald-300"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <span className="text-lg flex-shrink-0">{option.logo}</span>

                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium">{option.name}</p>
                        <p className="text-[10px] text-muted-foreground">Estimasi {option.estimatedDays}</p>
                      </div>

                      <span className="text-sm font-bold text-foreground flex-shrink-0">
                        {option.price === 0 ? 'Gratis' : formatPrice(option.price)}
                      </span>
                    </motion.button>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedShipping && !isExpanded && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
          <Clock className="w-3 h-3" />
          <span>Estimasi tiba {selectedShipping.estimatedDays}</span>
          <span>·</span>
          <span className="font-medium text-foreground">{formatPrice(selectedShipping.price)}</span>
        </div>
      )}
    </div>
  )
}
