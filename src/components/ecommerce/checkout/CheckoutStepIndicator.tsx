"use client"

import { motion } from "framer-motion"
import { MapPin, Truck, CreditCard, Check } from "lucide-react"

// ==================== CHECKOUT STEP INDICATOR ====================
const CHECKOUT_STEPS = [
  { key: 'address', label: 'Alamat', icon: MapPin },
  { key: 'shipping', label: 'Pengiriman', icon: Truck },
  { key: 'payment', label: 'Pembayaran', icon: CreditCard },
]

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
