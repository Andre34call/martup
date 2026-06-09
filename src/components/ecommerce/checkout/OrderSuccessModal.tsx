"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface OrderSuccessModalProps {
  show: boolean
  selectedPayment: string | null
  orderNumber: string
  totalAmount: number
}

export function OrderSuccessModal({ show, selectedPayment, orderNumber, totalAmount }: OrderSuccessModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-card rounded-2xl p-8 w-full max-w-sm text-center space-y-4 shadow-xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
              className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
              >
                <Check className="w-10 h-10 text-emerald-500" strokeWidth={3} />
              </motion.div>
            </motion.div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">
                {selectedPayment === 'wallet' ? 'Pembayaran Berhasil!' : 'Pesanan Dibuat!'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedPayment === 'wallet'
                  ? 'Terima kasih atas pesananmu. Pesanan sedang diproses oleh penjual.'
                  : selectedPayment === 'cod'
                    ? 'Pesanan berhasil dibuat. Pembayaran akan dilakukan saat barang diterima.'
                    : 'Pesanan berhasil dibuat. Silakan selesaikan pembayaran sebelum batas waktu.'
                }
              </p>
            </div>

            <div className="bg-muted/30 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">No. Pesanan</span>
                <span className="font-medium">{orderNumber}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Mengalihkan ke halaman pesanan...</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
