"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check, ArrowRight, ShieldCheck, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatPrice } from "@/lib/utils"
import type { Voucher } from "@/lib/types"

// ==================== PRICE SUMMARY ====================
export function PriceSummary({
  subtotal,
  shippingCost,
  voucherDiscount,
  platformFee,
  totalAmount,
  checkedCount,
}: {
  subtotal: number
  shippingCost: number
  voucherDiscount: number
  platformFee: number
  totalAmount: number
  checkedCount: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-card rounded-xl border border-border/50 p-4 space-y-2.5"
    >
      <h3 className="text-sm font-bold">Ringkasan Pembayaran</h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Subtotal ({checkedCount} produk)</span>
          <span className="text-sm font-medium">{formatPrice(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Ongkos Kirim</span>
          <span className="text-sm font-medium">
            {shippingCost > 0 ? formatPrice(shippingCost) : 'Pilih pengiriman'}
          </span>
        </div>

        {voucherDiscount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-600">Diskon Voucher</span>
            <span className="text-sm font-medium text-emerald-600">-{formatPrice(voucherDiscount)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Biaya Platform</span>
          <span className="text-sm font-medium">{formatPrice(platformFee)}</span>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">Total Pembayaran</span>
        <span className="text-lg font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</span>
      </div>

      {/* Security badge */}
      <div className="flex items-center gap-1.5 pt-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[10px] text-muted-foreground">Transaksi aman & terenkripsi</span>
      </div>

      {/* Cancel order link */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => {
            // Navigate back to cart - handled by parent
          }}
          className="text-xs text-muted-foreground hover:text-red-500 transition-colors underline underline-offset-2"
        >
          Batalkan Pesanan
        </button>
      </div>
    </motion.div>
  )
}

// ==================== STICKY BOTTOM CTA ====================
export function StickyBottomCTA({
  totalAmount,
  isReadyToPay,
  isProcessing,
  onPay,
}: {
  totalAmount: number
  isReadyToPay: boolean
  isProcessing: boolean
  onPay: () => void
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto max-w-[430px] md:max-w-[480px]">
        <div className="glass border-t border-border/50 pb-safe">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Pembayaran</p>
              <p className="text-lg font-bold text-emerald-600">{formatPrice(Math.max(0, totalAmount))}</p>
            </div>
            <Button
              className="h-11 px-8 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white disabled:opacity-50 gap-1.5"
              disabled={!isReadyToPay || isProcessing}
              onClick={onPay}
            >
              {isProcessing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Memproses...
                </>
              ) : (
                <>
                  Bayar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== SUCCESS MODAL ====================
export function SuccessModal({
  show,
  selectedPayment,
  orderNumber,
  totalAmount,
}: {
  show: boolean
  selectedPayment: string | null
  orderNumber: string
  totalAmount: number
}) {
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

// ==================== STEP HINTS ====================
export function StepHints({
  hasAddress,
  hasAllShipping,
}: {
  hasAddress: boolean
  hasAllShipping: boolean
}) {
  return (
    <>
      {!hasAddress && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800"
        >
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">Tambahkan alamat pengiriman untuk melanjutkan</p>
        </motion.div>
      )}
      {hasAddress && !hasAllShipping && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800"
        >
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">Pilih metode pengiriman untuk semua toko</p>
        </motion.div>
      )}
    </>
  )
}
