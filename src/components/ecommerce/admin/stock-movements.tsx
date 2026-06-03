"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  Package, ArrowUpDown, ArrowDown, ArrowUp, Search,
  Filter, RefreshCw, ChevronLeft, ChevronRight, Clock,
  ShoppingCart, XCircle, PlusCircle, Settings2, RotateCcw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PageHeader, EmptyState } from "../shared"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { fadeIn } from "@/lib/animations"

// ==================== TYPES ====================
interface StockLogVariant {
  id: string
  name: string
  value: string
  sku?: string
}

interface StockLogOrder {
  id: string
  orderNumber: string
}

interface StockLogProduct {
  id: string
  name: string
  slug: string
  images: string[]
  seller: {
    id: string
    storeName: string
  }
}

interface StockLogEntry {
  id: string
  productId: string
  variantId?: string | null
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reason?: string | null
  orderId?: string | null
  createdBy?: string | null
  createdAt: string
  product: StockLogProduct
  variant?: StockLogVariant | null
  order?: StockLogOrder | null
}

interface StockLogsResponse {
  success: boolean
  data: StockLogEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  error?: string
}

// ==================== TYPE CONFIG ====================
const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  order: { label: "Pesanan", color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/30", icon: ShoppingCart },
  cancel: { label: "Pembatalan", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/30", icon: XCircle },
  restock: { label: "Restock", color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30", icon: PlusCircle },
  adjustment: { label: "Penyesuaian", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30", icon: Settings2 },
  return: { label: "Pengembalian", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30", icon: RotateCcw },
}

// ==================== MAIN COMPONENT ====================
export function AdminStockMovements() {
  const { showToast } = useAppStore()

  const [logs, setLogs] = useState<StockLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterType, setFilterType] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: "20",
      }
      if (filterType) params.type = filterType

      const data = await apiClient.get<StockLogsResponse>('/api/admin/stock-logs', params)
      if (data.success && data.data) {
        setLogs(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      } else {
        showToast("Gagal memuat riwayat stok", "error")
      }
    } catch {
      showToast("Gagal memuat riwayat stok", "error")
    } finally {
      setIsLoading(false)
    }
  }, [page, filterType, showToast])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Filter logs by search query (client-side)
  const filteredLogs = searchQuery
    ? logs.filter(log =>
        log.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.order?.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.variant?.value?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Riwayat Stok" />

      <div className="px-4 space-y-4 pb-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            {...fadeIn}
            className="p-3 bg-card rounded-xl border border-border/50"
          >
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total Perubahan</span>
            </div>
            <span className="text-xl font-bold">{total}</span>
          </motion.div>
          <motion.div
            {...fadeIn}
            className="p-3 bg-card rounded-xl border border-border/50"
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpDown className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Halaman</span>
            </div>
            <span className="text-xl font-bold">{page} / {totalPages || 1}</span>
          </motion.div>
        </div>

        {/* Search & Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk, catatan, atau pesanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm rounded-xl"
            />
          </div>

          {/* Type Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => { setFilterType(""); setPage(1) }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !filterType
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Semua
            </button>
            {Object.entries(TYPE_CONFIG).map(([type, config]) => (
              <button
                key={type}
                onClick={() => { setFilterType(type); setPage(1) }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === type
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            className="text-xs h-8 rounded-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Logs List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 bg-card rounded-xl border border-border/50 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Package className="w-10 h-10 text-muted-foreground" />}
            title="Tidak Ada Riwayat Stok"
            subtitle="Belum ada perubahan stok yang tercatat"
          />
        ) : (
          <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
            {filteredLogs.map((log, idx) => {
              const typeConfig = TYPE_CONFIG[log.type] || TYPE_CONFIG.adjustment
              const TypeIcon = typeConfig.icon
              const isIncrease = log.quantity > 0

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="p-3 bg-card rounded-xl border border-border/50"
                >
                  <div className="flex items-start gap-3">
                    {/* Type Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeConfig.bgColor}`}>
                      <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium line-clamp-1 truncate">
                          {log.product?.name || 'Produk Tidak Ditemukan'}
                        </span>
                        <Badge className={`${typeConfig.bgColor} ${typeConfig.color} text-[9px] font-medium px-1.5 py-0 h-4 border-0`}>
                          {typeConfig.label}
                        </Badge>
                      </div>

                      {/* Variant info */}
                      {log.variant && (
                        <p className="text-[11px] text-muted-foreground">
                          Varian: {log.variant.name} - {log.variant.value}
                          {log.variant.sku && ` (${log.variant.sku})`}
                        </p>
                      )}

                      {/* Store info */}
                      {log.product?.seller && (
                        <p className="text-[11px] text-muted-foreground">
                          Toko: {log.product.seller.storeName}
                        </p>
                      )}

                      {/* Quantity change */}
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1">
                          {isIncrease ? (
                            <ArrowUp className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-red-500" />
                          )}
                          <span className={`text-xs font-bold ${isIncrease ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isIncrease ? '+' : ''}{log.quantity}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {log.previousStock} → {log.newStock}
                        </span>
                      </div>

                      {/* Note & Order */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {log.reason && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {log.reason}
                          </span>
                        )}
                        {log.order && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                            {log.order.orderNumber}
                          </Badge>
                        )}
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
