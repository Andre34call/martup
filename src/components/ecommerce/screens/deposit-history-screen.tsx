"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { handleApiError } from '@/lib/handle-api-error'
import { PageHeader, TabBar, EmptyState, InlineSpinner } from "../shared"
import { useState, useEffect, useCallback } from "react"
import { ChevronRight, History } from "lucide-react"
import { Card } from "@/components/ui/card"

// ==================== Types ====================

interface DepositItem {
  id: string
  amount: number
  method: string
  status: 'pending' | 'proof_uploaded' | 'success' | 'failed' | 'expired'
  proofUrl: string | null
  adminNote: string | null
  destinationAccount: string | null
  senderName: string | null
  expiredAt: string | null
  createdAt: string
  updatedAt: string
}

interface DepositsResponse {
  success: boolean
  data: {
    items: DepositItem[]
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ==================== Config ====================

const methodConfig: Record<string, { label: string; icon: string; color: string }> = {
  bank_transfer: { label: 'Transfer Bank', icon: '🏦', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  gopay: { label: 'GoPay', icon: '💳', color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  ovo: { label: 'OVO', icon: '💜', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  dana: { label: 'DANA', icon: '🔵', color: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' },
  shopeepay: { label: 'ShopeePay', icon: '🧡', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  linkaja: { label: 'LinkAja', icon: '🔴', color: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Menunggu Bayar', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  proof_uploaded: { label: 'Menunggu Verifikasi', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  success: { label: 'Berhasil', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  failed: { label: 'Gagal', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  expired: { label: 'Kadaluarsa', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

const filterTabs = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Pending' },
  { key: 'proof_uploaded', label: 'Verifikasi' },
  { key: 'success', label: 'Berhasil' },
  { key: 'failed', label: 'Gagal' },
  { key: 'expired', label: 'Kadaluarsa' },
]

// ==================== Deposit Status Badge ====================

function DepositStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.pending
  return (
    <span className={`inline-flex items-center font-medium rounded-md text-[10px] px-1.5 py-0.5 ${config.className}`}>
      {config.label}
    </span>
  )
}

// ==================== Deposit Item Card ====================

function DepositItemCard({ deposit, onClick }: { deposit: DepositItem; onClick: () => void }) {
  const method = methodConfig[deposit.method] || methodConfig.bank_transfer

  return (
    <motion.div custom={0} variants={stagger} initial="initial" animate="animate">
      <Card
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted"
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          {/* Method icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${method.color}`}>
            {method.icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-foreground truncate">
                {formatPrice(deposit.amount)}
              </p>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-xs text-muted-foreground">{method.label}</p>
              <DepositStatusBadge status={deposit.status} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatRelativeTime(deposit.createdAt)}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ==================== Main Screen ====================

export function DepositHistoryScreen() {
  const { showToast, navigate, setSelectedDeposit } = useAppStore()
  const [activeTab, setActiveTab] = useState('all')
  const [deposits, setDeposits] = useState<DepositItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchDeposits = useCallback(async (pageNum: number = 1, status?: string, showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true)
    } else if (pageNum === 1) {
      setIsLoading(true)
    }

    try {
      const params: Record<string, string | undefined> = {
        page: String(pageNum),
        limit: '20',
      }
      if (status && status !== 'all') {
        params.status = status
      }
      const res = await apiClient.get<DepositsResponse>('/api/wallet/deposits', params)
      if (res.success && res.data) {
        if (pageNum === 1) {
          setDeposits(res.data.items)
        } else {
          setDeposits(prev => [...prev, ...res.data.items])
        }
        setTotalPages(res.data.totalPages)
        setTotal(res.data.total)
      }
    } catch (error) {
      handleApiError(error, 'riwayat deposit')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Fetch on mount and when tab changes
  useEffect(() => {
    setPage(1)
    fetchDeposits(1, activeTab)
  }, [activeTab, fetchDeposits])

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  const handleDepositClick = (deposit: DepositItem) => {
    setSelectedDeposit(deposit.id)
    navigate('deposit-detail')
  }

  const handleRefresh = () => {
    fetchDeposits(1, activeTab, true)
  }

  const handleLoadMore = () => {
    if (page < totalPages) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchDeposits(nextPage, activeTab)
    }
  }

  // Filtered deposits (client-side backup if API doesn't filter)
  const filteredDeposits = activeTab === 'all'
    ? deposits
    : deposits.filter(d => d.status === activeTab)

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Riwayat Top Up" />

      {/* Filter Tabs */}
      <motion.div {...fadeIn}>
        <TabBar
          tabs={filterTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </motion.div>

      <div className="px-4 pt-4 pb-24 space-y-3">
        {/* Pull to refresh */}
        {isRefreshing && (
          <div className="flex items-center justify-center py-4 gap-2">
            <InlineSpinner className="border-emerald-500/30 border-t-emerald-500" />
            <span className="text-sm text-muted-foreground">Memperbarui...</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !isRefreshing && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <InlineSpinner className="w-8 h-8 border-muted-foreground/30 border-t-foreground" />
            <span className="text-sm text-muted-foreground">Memuat riwayat...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredDeposits.length === 0 && (
          <EmptyState
            icon={<History className="w-10 h-10 text-muted-foreground" />}
            title="Belum Ada Riwayat"
            subtitle="Riwayat top up saldo Anda akan muncul di sini"
            actionLabel="Top Up Sekarang"
            onAction={() => navigate('deposit')}
          />
        )}

        {/* Deposit list */}
        {!isLoading && filteredDeposits.length > 0 && (
          <div className="space-y-2">
            {/* Total count */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">
                {total} transaksi
              </p>
              <button
                onClick={handleRefresh}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                Refresh
              </button>
            </div>

            {filteredDeposits.map((deposit, i) => (
              <motion.div
                key={deposit.id}
                custom={i}
                variants={stagger}
                initial="initial"
                animate="animate"
              >
                <DepositItemCard
                  deposit={deposit}
                  onClick={() => handleDepositClick(deposit)}
                />
              </motion.div>
            ))}

            {/* Load more */}
            {page < totalPages && (
              <motion.div {...fadeIn} className="pt-2">
                <button
                  onClick={handleLoadMore}
                  className="w-full py-3 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-xl transition-colors"
                >
                  Muat Lebih Banyak
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
