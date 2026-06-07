"use client"

import { motion } from "framer-motion"
import { CreditCard, Wallet, Smartphone, Banknote } from "lucide-react"
import { formatPrice } from "@/lib/utils"

// ==================== PAYMENT METHODS ====================
const PAYMENT_METHODS = [
  { id: "wallet", name: "MartUp Pay", icon: Wallet, description: "Bayar cepat dari saldo", color: "emerald" },
  { id: "midtrans", name: "Transfer & E-Wallet", icon: Smartphone, description: "VA, GoPay, OVO, Dana, ShopeePay", color: "blue" },
  { id: "card", name: "Kartu Kredit/Debit", icon: CreditCard, description: "Visa, Mastercard, JCB", color: "purple" },
  { id: "cod", name: "Bayar di Tempat (COD)", icon: Banknote, description: "Bayar saat barang diterima", color: "orange" },
]

interface PaymentMethodSelectorProps {
  selectedPayment: string | null
  onSelectPayment: (methodId: string) => void
  walletBalance: number
  totalAmount: number
  showToast: (message: string, type: "success" | "error" | "warning" | "info") => void
}

export function PaymentMethodSelector({
  selectedPayment,
  onSelectPayment,
  walletBalance,
  totalAmount,
  showToast,
}: PaymentMethodSelectorProps) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-bold">Metode Pembayaran</h3>
      </div>

      <div className="space-y-2">
        {PAYMENT_METHODS.map((method) => {
          const isSelected = selectedPayment === method.id
          const Icon = method.icon
          const isWalletInsufficient = method.id === 'wallet' && walletBalance < totalAmount

          return (
            <motion.button
              key={method.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (isWalletInsufficient) {
                  showToast("Saldo tidak mencukupi. Silakan top up terlebih dahulu.", "error")
                  return
                }
                onSelectPayment(method.id)
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isSelected
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500"
                  : isWalletInsufficient
                    ? "bg-muted/30 border-border/30 opacity-60"
                    : "bg-background border-border/50 hover:border-emerald-300"
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600"
              }`}>
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>

              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                method.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                method.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                method.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                'bg-orange-100 dark:bg-orange-900/30'
              }`}>
                <Icon className={`w-5 h-5 ${
                  method.color === 'emerald' ? 'text-emerald-600' :
                  method.color === 'blue' ? 'text-blue-600' :
                  method.color === 'purple' ? 'text-purple-600' :
                  'text-orange-600'
                }`} />
              </div>

              <div className="flex-1 text-left min-w-0">
                <p className={`text-sm font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                  {method.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {method.id === 'wallet'
                    ? `Saldo: ${formatPrice(walletBalance)}${isWalletInsufficient ? ' (tidak cukup)' : ''}`
                    : method.description
                  }
                </p>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
