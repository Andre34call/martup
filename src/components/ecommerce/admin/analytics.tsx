"use client"

import { motion } from "framer-motion"
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts"
import { DollarSign, TrendingUp, BarChart3, CreditCard } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader, AdminScreenWrapper } from "../shared"
import { useState, useEffect } from "react"

// ==================== HELPER: Compute top sellers from store data ====================
function computeTopSellers(products: { sellerId: string; seller: { storeName: string }; price: number; sold: number; rating: number; reviewCount: number }[]) {
  const sellerMap = new Map<string, { name: string; revenue: number; orders: number; rating: number; ratingCount: number }>()
  for (const p of products) {
    const existing = sellerMap.get(p.sellerId)
    const revenue = p.sold * p.price
    if (existing) {
      existing.revenue += revenue
      existing.orders += p.sold
      existing.rating += p.rating * p.reviewCount
      existing.ratingCount += p.reviewCount
    } else {
      sellerMap.set(p.sellerId, {
        name: p.seller.storeName,
        revenue,
        orders: p.sold,
        rating: p.rating * p.reviewCount,
        ratingCount: p.reviewCount,
      })
    }
  }
  return Array.from(sellerMap.values())
    .map(s => ({ ...s, rating: s.ratingCount > 0 ? Math.round((s.rating / s.ratingCount) * 10) / 10 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
}

function computeCategoryPerformance(products: { categoryId: string; category: { name: string }; price: number; sold: number }[]) {
  const catMap = new Map<string, { name: string; revenue: number }>()
  for (const p of products) {
    const existing = catMap.get(p.categoryId)
    const revenue = p.sold * p.price
    if (existing) {
      existing.revenue += revenue
    } else {
      catMap.set(p.categoryId, { name: p.category.name, revenue })
    }
  }
  const entries = Array.from(catMap.values()).sort((a, b) => b.revenue - a.revenue)
  const totalRevenue = entries.reduce((sum, e) => sum + e.revenue, 0)
  return entries.map(e => ({
    name: e.name,
    revenue: e.revenue,
    percentage: totalRevenue > 0 ? Math.round((e.revenue / totalRevenue) * 100) : 0,
  }))
}

export function AdminAnalytics() {
  const { products, orders, withdrawRequests, adminStats, fetchAdminStats } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAdminStats().finally(() => setIsLoading(false))
  }, [fetchAdminStats])

  // Compute real data from store
  const topSellers = computeTopSellers(products)
  const categoryPerformance = computeCategoryPerformance(products)

  const stats = adminStats ? {
    totalUsers: adminStats.totalUsers,
    totalSellers: adminStats.totalSellers,
    totalOrders: adminStats.totalOrders,
    totalRevenue: adminStats.totalRevenue,
    pendingWithdrawals: adminStats.pendingWithdrawals,
    activeProducts: adminStats.activeProducts,
    revenueChart: adminStats.revenueChart,
    userGrowth: adminStats.userGrowth,
  } : {
    totalUsers: 0,
    totalSellers: 0,
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
    pendingWithdrawals: withdrawRequests.filter(w => w.status === 'pending').length,
    activeProducts: products.filter(p => p.status === 'active').length,
    revenueChart: [] as { date: string; revenue: number }[],
    userGrowth: [] as { date: string; users: number }[],
  }
  const [dateRange, setDateRange] = useState("30d")

  return (
    <AdminScreenWrapper title="Analitik Lengkap" isLoading={isLoading}>
      <PageHeader title="Analitik Lengkap" />

      <div className="px-4 space-y-4">
        {/* Date Range Picker */}
        <div className="flex gap-2">
          {[
            { key: "7d", label: "7 Hari" },
            { key: "30d", label: "30 Hari" },
            { key: "90d", label: "90 Hari" },
            { key: "1y", label: "1 Tahun" },
          ].map((range) => (
            <motion.button
              key={range.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDateRange(range.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateRange === range.key
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {range.label}
            </motion.button>
          ))}
        </div>

        {/* Revenue Breakdown */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Revenue Breakdown" icon={<DollarSign className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenueChart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="adminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `${(v / 1000000000).toFixed(1)}B`} />
                  <Tooltip
                    formatter={(value: number) => [formatPrice(value), "Revenue"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#adminRevenueGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Top Sellers */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Top Sellers" icon={<TrendingUp className="w-4 h-4" />} />
          <Card className="mt-3 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">#</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Toko</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Revenue</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">Data belum tersedia</td>
                    </tr>
                  ) : (
                    topSellers.map((seller, i) => (
                      <tr key={seller.name} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 text-xs font-bold text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{seller.name}</p>
                          <p className="text-[10px] text-muted-foreground">{seller.orders.toLocaleString()} pesanan</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">{formatPrice(seller.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-right text-foreground">{seller.rating}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Category Performance */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Performa Kategori" icon={<BarChart3 className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            {categoryPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Data belum tersedia</p>
            ) : (
              categoryPerformance.map((cat, i) => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">{cat.percentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percentage}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              ))
            )}
          </Card>
        </motion.div>

        {/* Payment Method Distribution */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Distribusi Metode Pembayaran" icon={<CreditCard className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            {(adminStats?.paymentMethodDistribution && adminStats.paymentMethodDistribution.length > 0) ? (
              adminStats.paymentMethodDistribution.map((pm, i) => (
                <div key={pm.method}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground capitalize">{pm.method || 'Lainnya'}</span>
                    <span className="text-xs text-muted-foreground">{pm.percentage}% ({pm.count})</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pm.percentage}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Data belum tersedia</p>
            )}
          </Card>
        </motion.div>
      </div>
    </AdminScreenWrapper>
  )
}
