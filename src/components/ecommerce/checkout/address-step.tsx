"use client"

import { motion } from "framer-motion"
import { MapPin, Check, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Address } from "@/lib/types"
import { CHECKOUT_STEPS } from "./shared"

// ==================== CHECKOUT STEP INDICATOR ====================
export function CheckoutStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        {CHECKOUT_STEPS.map((step, idx) => {
          const Icon = step.icon
          const isCompleted = idx < currentStep
          const isCurrent = idx === currentStep

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <motion.div
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                    backgroundColor: isCompleted ? '#10b981' : isCurrent ? '#10b981' : '#e5e7eb'
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCompleted || isCurrent
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </motion.div>
                <span className={`text-[10px] font-medium ${
                  isCurrent ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-muted-foreground'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < CHECKOUT_STEPS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-12px]">
                  <div className={`h-0.5 rounded-full ${
                    idx < currentStep ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== ADDRESS CARD ====================
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
