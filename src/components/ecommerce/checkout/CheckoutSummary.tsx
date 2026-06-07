"use client"

import { ShieldCheck } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { formatPrice } from "@/lib/utils"

interface CheckoutSummaryProps {
  checkedCount: number
  subtotal: number
  shippingCost: number
  voucherDiscount: number
  platformFee: number
  totalAmount: number
  onCancel: () => void
}

export function CheckoutSummary({
  checkedCount,
  subtotal,
  shippingCost,
  voucherDiscount,
  platformFee,
  totalAmount,
  onCancel,
}: CheckoutSummaryProps) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2.5">
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
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-red-500 transition-colors underline underline-offset-2"
        >
          Batalkan Pesanan
        </button>
      </div>
    </div>
  )
}
