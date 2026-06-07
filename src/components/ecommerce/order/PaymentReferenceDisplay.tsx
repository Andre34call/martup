"use client"

import { CreditCard, Copy, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { getPaymentTypeLabel } from "@/lib/payment-utils"
import type { Order } from "@/lib/types"
import type { PaymentRefData } from "./types"

interface PaymentReferenceDisplayProps {
  order: Order
  paymentRef: PaymentRefData
  onPayNow: () => void
  showToast: (message: string, type: "success" | "error" | "info" | "warning") => void
}

export function PaymentReferenceDisplay({ order, paymentRef, onPayNow, showToast }: PaymentReferenceDisplayProps) {
  return (
    <div className="px-4 pb-4">
      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/50 p-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-600" />
          Cara Pembayaran
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Selesaikan pembayaran menggunakan informasi berikut:
        </p>

        {/* Payment type label */}
        {paymentRef.payment_type && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Metode</span>
            <span className="text-xs font-medium text-foreground">{getPaymentTypeLabel(paymentRef.payment_type)}</span>
          </div>
        )}

        {/* VA Number display */}
        {paymentRef.va_number && (
          <div className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              {paymentRef.bank ? `Virtual Account ${paymentRef.bank.toUpperCase()}` : 'Nomor Virtual Account'}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-mono font-bold text-foreground tracking-wider">{paymentRef.va_number}</p>
              <button
                onClick={() => { navigator.clipboard?.writeText(paymentRef.va_number!); showToast('Nomor VA disalin!', 'success') }}
                className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Copy className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </div>
        )}

        {/* Multiple VA numbers if available */}
        {paymentRef.va_numbers && paymentRef.va_numbers.length > 1 && paymentRef.va_numbers.map((va, idx) => (
          <div key={idx} className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Virtual Account {va.bank.toUpperCase()}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-mono font-bold text-foreground tracking-wider">{va.va_number}</p>
              <button
                onClick={() => { navigator.clipboard?.writeText(va.va_number); showToast('Nomor VA disalin!', 'success') }}
                className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Copy className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </div>
        ))}

        {/* Payment Code (cstore / Indomaret / Alfamart) */}
        {paymentRef.payment_code && (
          <div className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Kode Pembayaran</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-mono font-bold text-foreground tracking-wider">{paymentRef.payment_code}</p>
              <button
                onClick={() => { navigator.clipboard?.writeText(paymentRef.payment_code!); showToast('Kode pembayaran disalin!', 'success') }}
                className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Copy className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </div>
        )}

        {/* Mandiri Bill (bill_key + biller_code) */}
        {paymentRef.bill_key && (
          <div className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Mandiri Bill Payment</p>
            <div className="space-y-1">
              {paymentRef.biller_code && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Kode Perusahaan</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono font-bold text-foreground">{paymentRef.biller_code}</span>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(paymentRef.biller_code!); showToast('Kode disalin!', 'success') }}
                      className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Copy className="w-3 h-3 text-blue-600" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">No. Bill</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono font-bold text-foreground">{paymentRef.bill_key}</span>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(paymentRef.bill_key!); showToast('No. Bill disalin!', 'success') }}
                    className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Copy className="w-3 h-3 text-blue-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR Code URL */}
        {paymentRef.qr_url && (
          <div className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50 text-center">
            <QrCode className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-2">Scan QR code untuk membayar</p>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg"
              onClick={() => window.open(paymentRef.qr_url, '_blank')}
            >
              Buka QR Code
            </Button>
          </div>
        )}

        {/* E-Wallet deep link (from actions) */}
        {paymentRef.actions && paymentRef.actions.length > 0 && paymentRef.actions.map((action, idx) => (
          <div key={idx} className="bg-white dark:bg-card rounded-lg p-3 mb-2 border border-blue-100 dark:border-blue-900/50">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs rounded-lg border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              onClick={() => window.open(action.url, '_blank')}
            >
              {action.name === 'deeplink-redirect' ? 'Buka Aplikasi E-Wallet' :
               action.name === 'qr-link' ? 'Lihat QR Code' :
               action.name}
            </Button>
          </div>
        ))}

        {/* Payment instructions */}
        <div className="mt-3 p-2.5 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-[10px] text-muted-foreground space-y-0.5">
            {paymentRef.va_number && (
              <>
                <span className="block">1. Login ke mobile/internet banking</span>
                <span className="block">2. Pilih Transfer ke Virtual Account</span>
                <span className="block">3. Masukkan nomor VA di atas</span>
                <span className="block">4. Konfirmasi dan bayar {formatPrice(order.totalAmount)}</span>
              </>
            )}
            {paymentRef.payment_code && (
              <>
                <span className="block">1. Kunjungi gerai Indomaret/Alfamart terdekat</span>
                <span className="block">2. Tunjukkan kode pembayaran di atas</span>
                <span className="block">3. Bayar sesuai nominal {formatPrice(order.totalAmount)}</span>
              </>
            )}
            {paymentRef.bill_key && (
              <>
                <span className="block">1. Login ke Mandiri Online</span>
                <span className="block">2. Pilih Pembayaran &rarr; Multi Payment</span>
                <span className="block">3. Masukkan kode perusahaan dan no. bill</span>
                <span className="block">4. Konfirmasi dan bayar {formatPrice(order.totalAmount)}</span>
              </>
            )}
            {paymentRef.qr_url && (
              <>
                <span className="block">1. Buka aplikasi e-wallet Anda</span>
                <span className="block">2. Scan QR code atau klik link di atas</span>
                <span className="block">3. Konfirmasi pembayaran {formatPrice(order.totalAmount)}</span>
              </>
            )}
          </p>
        </div>

        {/* Bayar Sekarang button — re-open Snap popup */}
        <Button
          className="w-full mt-3 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          onClick={onPayNow}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Bayar Sekarang
        </Button>
      </div>
    </div>
  )
}
