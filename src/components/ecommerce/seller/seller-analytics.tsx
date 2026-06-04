"use client"

import { motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp, BarChart3, Eye } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn } from '@/lib/animations'
import { PageHeader, SectionHeader } from "../shared"
import type { Order } from "@/lib/types"
import { useState, useEffect } from "react"

export function SellerAnalytics() {
  const { products, orders, seller, sellerStats, fetchSellerStats, commissionRate } = useAppStore()

  // Derive sellerId from store seller
  const sellerId = seller?.id || ''

  // Fetch seller stats from API when seller ID becomes available
  useEffect(() => {
    if (sellerId) {
      fetchSellerStats()
    }
  }, [fetchSellerStats, sellerId])

  const sellerProducts = products.filter(p => p.sellerId === sellerId)
  const sellerOrders = orders.filter(o => o.sellerId === sellerId)
  const totalRevenue = sellerOrders
    .filter(o => o.status === 'paid' || o.status === 'delivered')
    .reduce((sum, o) => sum + o.subtotal * (1 - commissionRate), 0)

  // Use API stats when available, fallback to local computation
  const stats = sellerStats ? {
    totalRevenue: sellerStats.totalRevenue,
    totalOrders: sellerStats.totalOrders,
    totalProducts: sellerStats.totalProducts,
    totalSales: seller?.totalSales || 0,
    pendingOrders: sellerStats.pendingOrders,
    monthlyRevenue: sellerStats.monthlyRevenue,
    topProducts: sellerStats.topProducts,
    recentOrders: sellerStats.recentOrders,
  } : {
    totalRevenue,
    totalOrders: sellerOrders.length,
    totalProducts: sellerProducts.length,
    totalSales: seller?.totalSales || 0,
    pendingOrders: sellerOrders.filter(o => o.status === 'pending' || o.status === 'paid').length,
    monthlyRevenue: [] as { month: string; revenue: number }[],
    topProducts: [...sellerProducts]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 4)
      .map(p => ({ name: p.name, sold: p.sold, revenue: p.sold * p.price })),
    recentOrders: [] as Order[],
  }
  const [dateRange, setDateRange] = useState("30d")

  return (
    <div className="pb-20">
      <PageHeader title="Analitik" />

      <div className="px-4 space-y-4">
        {/* Date Range Selector */}
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
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {range.label}
            </motion.button>
          ))}
        </div>

        {/* Revenue Chart */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Grafik Penjualan" icon={<TrendingUp className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyRevenue} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: number) => [formatPrice(value), "Revenue"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Product Performance Table */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Performa Produk" icon={<BarChart3 className="w-4 h-4" />} />
          <Card className="mt-3 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">#</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Produk</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Terjual</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProducts.map((product, i) => (
                    <tr key={product.name} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-xs font-bold text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground">{product.sold}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">{formatPrice(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Customer Demographics Placeholder */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Demografi Pelanggan" icon={<Eye className="w-4 h-4" />} />
          <Card className="mt-3 p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Eye className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Data Demografi</p>
              <p className="text-xs text-muted-foreground mt-1">Data demografi pelanggan akan tersedia setelah mengumpulkan cukup data</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
