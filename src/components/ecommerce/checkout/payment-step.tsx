"use client"

import { motion } from "framer-motion"
import { CreditCard, ShieldCheck, Info, Landmark, Copy, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PAYMENT_METHODS, type EscrowBankAccount } from "./shared"

// ==================== PAYMENT METHOD SELECTOR ====================
export function PaymentMethodSelector({
  selectedPayment,
  onSelectPayment,
  walletBalance,
  totalAmount,
  escrowBankAccounts,
  isLoadingBankAccounts,
  copiedAccountId,
  onCopyAccountNumber,
}: {
  selectedPayment: string | null
  onSelectPayment: (id: string) => void
  walletBalance: number
  totalAmount: number
  escrowBankAccounts: EscrowBankAccount[]
  isLoadingBankAccounts: boolean
  copiedAccountId: string | null
  onCopyAccountNumber: (accountNumber: string, accountId: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-xl border border-border/50 p-4 space-y-3"
    >
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
                  onSelectPayment('__insufficient__')
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
                method.color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30' :
                'bg-orange-100 dark:bg-orange-900/30'
              }`}>
                <Icon className={`w-5 h-5 ${
                  method.color === 'emerald' ? 'text-emerald-600' :
                  method.color === 'blue' ? 'text-blue-600' :
                  method.color === 'purple' ? 'text-purple-600' :
                  method.color === 'amber' ? 'text-amber-600' :
                  'text-orange-600'
                }`} />
              </div>

              <div className="flex-1 text-left min-w-0">
                <p className={`text-sm font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                  {method.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {method.id === 'wallet'
                    ? `Saldo: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(walletBalance)}${isWalletInsufficient ? ' (tidak cukup)' : ''}`
                    : method.description
                  }
                </p>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Escrow Bank Account Info */}
      {selectedPayment === 'escrow' && (
        <EscrowBankAccounts
          bankAccounts={escrowBankAccounts}
          isLoading={isLoadingBankAccounts}
          copiedAccountId={copiedAccountId}
          onCopyAccountNumber={onCopyAccountNumber}
        />
      )}
    </motion.div>
  )
}

// ==================== ESCROW BANK ACCOUNTS ====================
function EscrowBankAccounts({
  bankAccounts,
  isLoading,
  copiedAccountId,
  onCopyAccountNumber,
}: {
  bankAccounts: EscrowBankAccount[]
  isLoading: boolean
  copiedAccountId: string | null
  onCopyAccountNumber: (accountNumber: string, accountId: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 mt-2">
        <ShieldCheck className="w-4 h-4 text-amber-500" />
        <h4 className="text-sm font-bold text-foreground">Rekening Escrow MartUp</h4>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full"
          />
          <span className="text-xs text-muted-foreground">Memuat rekening...</span>
        </div>
      ) : bankAccounts.length === 0 ? (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400">Rekening MartUp belum tersedia. Silakan hubungi admin.</p>
        </div>
      ) : (
        bankAccounts.map((acc, idx) => (
          <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-1.5">
              <Landmark className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-foreground">{acc.bankName}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-mono font-bold text-foreground tracking-wider">{acc.accountNumber}</span>
              <button
                onClick={() => onCopyAccountNumber(acc.accountNumber, `${idx}`)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                {copiedAccountId === `${idx}` ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-amber-600" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">a/n <span className="font-medium text-foreground">{acc.accountHolder}</span></p>
          </div>
        ))
      )}

      <div className="flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg">
        <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Transfer sesuai total pesanan. Dana akan ditahan MartUp sampai Anda konfirmasi barang diterima.
        </p>
      </div>
    </motion.div>
  )
}
