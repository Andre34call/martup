"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, Timer } from "lucide-react"
import type { Order } from "@/lib/types"
import type { ServiceProofData } from "./types"

// ==================== SERVICE PROOF COUNTDOWN ====================
export function ServiceProofCountdown({ autoConfirmAt }: { autoConfirmAt: string }) {
  const [remaining, setRemaining] = useState("")

  useEffect(() => {
    const update = () => {
      const target = new Date(autoConfirmAt).getTime()
      const now = Date.now()
      const diff = target - now
      if (diff <= 0) { setRemaining("Otomatis dikonfirmasi"); return }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      if (days > 0) {
        setRemaining(`${days} hari ${hours} jam lagi`)
      } else if (hours > 0) {
        setRemaining(`${hours} jam ${minutes} menit lagi`)
      } else {
        setRemaining(`${minutes} menit lagi`)
      }
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [autoConfirmAt])

  return <>{remaining}</>
}

// ==================== SERVICE PROOF SECTION ====================
export function ServiceProofSection({
  order,
  serviceProofData,
  isLoadingServiceProof,
  proofImages,
  autoConfirmAt,
}: {
  order: Order
  serviceProofData: ServiceProofData | null
  isLoadingServiceProof: boolean
  proofImages: string[]
  autoConfirmAt: string | null
}) {
  return (
    <div className="px-4 pb-4">
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-purple-500" />
          Bukti Penyelesaian Tolong Mas
        </h3>
        {isLoadingServiceProof ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : proofImages.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {proofImages.map((img, idx) => (
                <div key={idx} className="w-full aspect-square rounded-lg overflow-hidden border border-border/50">
                  <img src={img} alt={`Bukti Tolong Mas ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            {serviceProofData?.sellerCompletedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Dikirim: {new Date(serviceProofData.sellerCompletedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {!serviceProofData?.sellerCompletedAt && order.shippedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Dikirim: {new Date(order.shippedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Belum ada bukti penyelesaian dari penjual.</p>
        )}

        {/* Auto-confirm countdown notice */}
        {order.status === "shipped" && autoConfirmAt && (
          <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/50">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Timer className="w-3.5 h-3.5" />
              <span className="font-medium">Auto konfirmasi:</span>{' '}
              <ServiceProofCountdown autoConfirmAt={autoConfirmAt} />
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Jika tidak dikonfirmasi, pesanan akan otomatis dikonfirmasi dan dana escrow dilepas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
