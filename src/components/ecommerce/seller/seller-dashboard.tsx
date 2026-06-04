"use client"

import { motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import {
  Bell, Settings, Package, Box, Eye, Star, Plus, Gift, MessageCircle,
  BarChart3, Check, TrendingUp, ShoppingBag, Store
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { SectionHeader, StatusBadge } from "../shared"
import type { Order } from "@/lib/types"
import { useState, useRef, useEffect } from "react"
import { AnimatePresence } from "framer-motion"

export function SellerDashboard() {
  const { navigate, unreadNotificationCount, switchRole, userRole, orders, sellerBalance, currentUser, originalRole, products, seller, sellerStats, fetchSellerStats, commissionRate } = useAppStore()
  const sellerId = seller?.id || ''

  // Fetch seller stats from API when seller ID becomes available
  useEffect(() => {
    if (sellerId) {
      fetchSellerStats()
    }
  }, [fetchSellerStats, sellerId])

  // Compute real stats from store data for current seller (fallback)
  const sellerOrders = orders.filter(o => o.sellerId === sellerId)
  const totalRevenue = sellerOrders
    .filter(o => o.status === 'paid' || o.status === 'delivered')
    .reduce((sum, o) => sum + o.subtotal * (1 - commissionRate), 0)
  const totalOrders = sellerOrders.length
  const pendingOrders = sellerOrders.filter(o => o.status === 'pending' || o.status === 'paid').length
  const needToShip = sellerOrders.filter(o => o.status === 'paid' || o.status === 'processing').length
  const recentOrders = [...sellerOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  // Compute stats from store (replacing MOCK_SELLER_STATS)
  const sellerProducts = products.filter(p => p.sellerId === sellerId)
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
    totalOrders,
    totalProducts: sellerProducts.length,
    totalSales: seller?.totalSales || 0,
    pendingOrders,
    monthlyRevenue: [] as { month: string; revenue: number }[],
    topProducts: [...sellerProducts]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 4)
      .map(p => ({ name: p.name, sold: p.sold, revenue: p.sold * p.price })),
    recentOrders: [] as Order[],
  }
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const roleColors: Record<string, string> = {
    buyer: "bg-emerald-500",
    seller: "bg-orange-500",
    admin: "bg-purple-500",
  }

  return (
    <div className="pb-20">
      {/* Top Header */}
      <motion.div {...fadeIn} className="sticky top-0 z-40 glass">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-500" />
            <h1 className="text-base font-bold text-foreground">{seller?.storeName || 'My Store'}</h1>
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Check className="w-2.5 h-2.5" /> Verified
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("notification")}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("seller-settings")}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </motion.button>
            {/* Role Switcher */}
            <div className="relative" ref={roleMenuRef}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className={`w-2 h-2 rounded-full ${roleColors[userRole]}`} />
                <span className="text-[11px] font-medium text-foreground">Switch Role</span>
              </motion.button>
              <AnimatePresence>
                {showRoleMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 bg-card rounded-xl shadow-lg border border-border p-2 min-w-[160px] z-50"
                  >
                    <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">Switch Role</p>
                    {(["buyer", "seller", ...(['admin', 'manager'].includes(originalRole || '') ? ["admin" as const, "manager" as const] : [])] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => { switchRole(role); setShowRoleMenu(false) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          userRole === role
                            ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${roleColors[role]}`} />
                        <span className="font-medium capitalize">{role}</span>
                        {userRole === role && (
                          <Check className="w-3.5 h-3.5 ml-auto text-orange-600" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="px-4 pt-4 space-y-6">
        {/* Revenue Card */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-sm text-emerald-100 font-medium">Pendapatan Bulan Ini</p>
              <p className="text-3xl font-bold mt-1">{formatPrice(sellerBalance.availableBalance + sellerBalance.pendingBalance)}</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4 text-emerald-200" />
                <span className="text-sm text-emerald-100 font-medium">{totalRevenue > 0 ? 'Pendapatan bulan ini' : 'Belum ada pendapatan'}</span>
              </div>
              <Separator className="my-3 bg-emerald-400/30" />
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-emerald-200">Pesanan Baru</p>
                  <p className="text-lg font-bold">{pendingOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-200">Perlu Dikirim</p>
                  <p className="text-lg font-bold">{needToShip}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Grid */}
        <motion.div {...fadeIn} className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Pesanan", value: totalOrders.toLocaleString(), icon: Package, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
            { label: "Total Produk", value: stats.totalProducts.toLocaleString(), icon: Box, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400" },
            { label: "Total Terjual", value: stats.totalSales.toLocaleString(), icon: ShoppingBag, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-400" },
            { label: "Rating", value: seller?.rating?.toFixed(1) || "0", icon: Star, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400" },
          ].map((item, i) => (
            <motion.div key={item.label} custom={i} variants={stagger} initial="initial" animate="animate">
              <Card className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{item.value}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Revenue Chart */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Grafik Penjualan" icon={<BarChart3 className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="h-52">
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

        {/* Quick Actions */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Aksi Cepat" />
          <div className="flex gap-3 overflow-x-auto no-scrollbar mt-3 pb-1">
            {[
              { label: "Tambah Produk", icon: Plus, screen: "seller-add-product" as const, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
              { label: "Kelola Pesanan", icon: Package, screen: "seller-orders" as const, color: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
              { label: "Promo & Voucher", icon: Gift, screen: "seller-campaign" as const, color: "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" },
              { label: "Chat Pembeli", icon: MessageCircle, screen: "seller-chat" as const, color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" },
              { label: "Analitik", icon: BarChart3, screen: "seller-analytics" as const, color: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
            ].map((action) => (
              <motion.button
                key={action.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(action.screen)}
                className="flex flex-col items-center gap-2 flex-shrink-0"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Recent Orders */}
        <motion.div {...fadeIn}>
          <SectionHeader
            title="Pesanan Terbaru"
            actionLabel="Lihat Semua"
            onAction={() => navigate("seller-orders")}
          />
          <div className="space-y-2 mt-3">
            {(sellerStats ? stats.recentOrders : recentOrders).map((order, i) => (
              <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-mono text-muted-foreground">{order.orderNumber}</p>
                        <StatusBadge status={order.status} size="sm" />
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1 truncate">{order.address?.recipient || (order as unknown as Record<string, unknown>).buyerName as string || ''}</p>
                      <p className="text-xs text-muted-foreground truncate">{order.items?.map(it => it.productName).join(', ') || ''}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 flex-shrink-0">{formatPrice(order.totalAmount)}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Top Products */}
        <motion.div {...fadeIn}>
          <SectionHeader
            title="Produk Terlaris"
            actionLabel="Lihat Semua"
            onAction={() => navigate("seller-products")}
          />
          <div className="space-y-2 mt-3">
            {stats.topProducts.map((product, i) => (
              <motion.div key={product.name} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-emerald-600">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sold} terjual</p>
                    </div>
                    <p className="text-sm font-bold text-foreground flex-shrink-0">{formatPrice(product.revenue)}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
