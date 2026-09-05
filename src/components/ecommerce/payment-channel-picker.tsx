"use client"

// ==================== PAYMENT CHANNEL PICKER ====================
// Shared in-app payment channel selector for the Duitku redirect flow.
// Fetches the active channels for a given amount from /api/payment/methods
// (grouped: QRIS / E-Wallet / Virtual Account / Card / Retail) and lets the
// user pick BEFORE redirecting — the gateway then skips its own channel list
// and opens the chosen channel directly (shorter payment page).
//
// value semantics:
//   ''   → no in-app selection (user picks on the gateway page — default)
//   code → channel code (e.g. 'SP', 'OV', 'BC') sent as paymentMethod

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  QrCode, Wallet, Landmark, CreditCard, Store, LayoutGrid,
  Loader2, AlertTriangle, Info, RefreshCw, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { formatPrice } from "@/lib/utils"
import { logger } from '@/lib/logger'

export interface PaymentChannel {
  code: string
  name: string
  image?: string
  fee: number
}

export interface PaymentChannelGroup {
  key: 'qris' | 'ewallet' | 'va' | 'card' | 'retail' | 'other'
  label: string
  methods: PaymentChannel[]
}

type MethodsResponse = {
  success: boolean
  data?: { configured: boolean; groups?: PaymentChannelGroup[]; unavailable?: boolean }
  error?: string
}

const GROUP_ICONS: Record<string, typeof QrCode> = {
  qris: QrCode,
  ewallet: Wallet,
  va: Landmark,
  card: CreditCard,
  retail: Store,
  other: LayoutGrid,
}

// E-wallets / cards commonly cap single transactions around Rp 2 jt.
// Above that, Virtual Account is the reliable choice.
const VA_RECOMMEND_THRESHOLD = 2_000_000

function feeLabel(fee: number): string | null {
  if (!fee || fee <= 0) return null
  // Gateway returns ratios (< 1, e.g. 0.7 = 0.7%) or flat rupiah amounts (e.g. 6500)
  if (fee < 1) return `Biaya ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(fee)}%`
  return `Biaya ${formatPrice(fee)}`
}

interface PickerState {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'empty'
  groups: PaymentChannelGroup[]
}

export function PaymentChannelPicker({
  amount,
  value,
  onChange,
}: {
  amount: number
  value: string
  onChange: (code: string) => void
}) {
  const [state, setState] = useState<PickerState>({ status: 'idle', groups: [] })
  const [expanded, setExpanded] = useState(true)
  const requestIdRef = useRef(0)

  const fetchMethods = useCallback(async (fetchAmount: number) => {
    if (!fetchAmount || fetchAmount <= 0) {
      setState({ status: 'idle', groups: [] })
      return
    }
    const requestId = ++requestIdRef.current
    setState((prev) => ({ status: 'loading', groups: prev.groups }))
    try {
      const res = await apiClient.get<MethodsResponse>('/api/payment/methods', {
        amount: String(Math.round(fetchAmount)),
      })
      if (requestId !== requestIdRef.current) return // stale response
      if (res.success && res.data?.groups && res.data.groups.length > 0) {
        setState({ status: 'ready', groups: res.data.groups })
      } else if (res.success && res.data?.unavailable) {
        setState({ status: 'empty', groups: [] })
      } else if (res.success && res.data && !res.data.configured) {
        setState({ status: 'empty', groups: [] })
      } else {
        setState({ status: 'error', groups: [] })
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      logger.warn({ component: 'PaymentChannelPicker', err }, 'Failed to load payment channels')
      setState({ status: 'error', groups: [] })
    }
  }, [])

  // Debounced fetch when the amount changes (500ms)
  useEffect(() => {
    const timer = setTimeout(() => { void fetchMethods(amount) }, 500)
    return () => clearTimeout(timer)
  }, [amount, fetchMethods])

  const selectedChannel = state.groups
    .flatMap((g) => g.methods)
    .find((m) => m.code === value)

  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-background/60 overflow-hidden">
      {/* Header (collapsible) */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2.5 p-3 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">Pilih Channel Pembayaran</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {selectedChannel
              ? `Dibuka langsung: ${selectedChannel.name}`
              : 'Opsional — langsung ke channel pilihanmu'}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* VA recommendation for big amounts */}
          {amount >= VA_RECOMMEND_THRESHOLD && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 p-2.5">
              <Info className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-300">
                Untuk nominal ≥ {formatPrice(VA_RECOMMEND_THRESHOLD)}, gunakan <span className="font-semibold">Virtual Account</span> — e-wallet &amp; kartu biasanya punya limit per transaksi.
              </p>
            </div>
          )}

          {/* Body */}
          {state.status === 'idle' && (
            <p className="text-[11px] text-muted-foreground px-1 py-2">
              Masukkan/pilih nominal untuk melihat channel yang tersedia.
            </p>
          )}

          {state.status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-5 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Memuat channel pembayaran...</span>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs">Daftar channel tidak dapat dimuat.</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => { void fetchMethods(amount) }}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Coba lagi
              </Button>
            </div>
          )}

          {state.status === 'empty' && (
            <p className="text-[11px] text-muted-foreground px-1 py-2">
              Daftar channel tidak tersedia — kamu tetap bisa memilih channel di halaman pembayaran.
            </p>
          )}

          {state.status === 'ready' && (
            <>
              {/* Default option — gateway-side selection */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange('')}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                  value === ''
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500'
                    : 'bg-card border-border/50 hover:border-emerald-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  value === '' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {value === '' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <LayoutGrid className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-medium">Semua Metode</p>
                  <p className="text-[10px] text-muted-foreground">Pilih nanti di halaman pembayaran</p>
                </div>
              </motion.button>

              {/* Channel groups (scrollable) */}
              <div className="max-h-72 overflow-y-auto space-y-3 pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
                {state.groups.map((group) => {
                  const GroupIcon = GROUP_ICONS[group.key] ?? LayoutGrid
                  return (
                    <div key={group.key}>
                      <div className="flex items-center gap-1.5 px-1 mb-1.5">
                        <GroupIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {group.methods.map((channel) => {
                          const isSelected = value === channel.code
                          const fee = feeLabel(channel.fee)
                          return (
                            <motion.button
                              type="button"
                              key={channel.code}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => onChange(channel.code)}
                              className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                                isSelected
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500'
                                  : 'bg-card border-border/50 hover:border-emerald-300'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>

                              {channel.image ? (
                                <img
                                  src={channel.image}
                                  alt={channel.name}
                                  className="w-8 h-8 rounded-lg object-contain bg-white flex-shrink-0"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <GroupIcon className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}

                              <div className="flex-1 text-left min-w-0">
                                <p className="text-xs font-medium truncate">{channel.name}</p>
                                {fee && <p className="text-[10px] text-muted-foreground">{fee}</p>}
                              </div>
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
