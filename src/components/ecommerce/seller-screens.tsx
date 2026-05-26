"use client"

import { motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import {
  Bell, Settings, Package, Box, Eye, Star, Plus, Gift, MessageCircle,
  BarChart3, Check, TrendingUp, ChevronRight, ArrowLeft, Search,
  Edit, Trash2, Truck, Printer, Calendar, Wallet, Banknote, Clock,
  Megaphone, Zap, Tag, Store, AlertTriangle, ArrowUpRight, ArrowDownLeft, Shield,
  ShoppingBag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAppStore, getAuthHeaders } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, SectionHeader, StatusBadge, SearchBar, EmptyState, WalletBalanceCard } from "./shared"
import type { Order } from "@/lib/types"
import { useState, useRef, useEffect } from "react"
import { AnimatePresence } from "framer-motion"

// ==================== ANIMATION VARIANTS ====================
const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 }
}

const stagger = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
}

// ==================== (mock data removed — all data from store) ====================

// ==================== SELLER DASHBOARD ====================
export function SellerDashboard() {
  const { navigate, unreadNotificationCount, switchRole, userRole, orders, sellerBalance, currentUser, products, seller, sellerStats, fetchSellerStats } = useAppStore()
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
    .reduce((sum, o) => sum + o.subtotal * 0.95, 0)
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
                    {(["buyer", "seller", ...(currentUser?.role === 'admin' ? ["admin" as const] : [])] as const).map((role) => (
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
                      <p className="text-sm font-medium text-foreground mt-1 truncate">{order.address?.recipient || (order as Record<string, unknown>).buyerName as string || ''}</p>
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

// ==================== SELLER PRODUCTS ====================
export function SellerProducts() {
  const { navigate, showToast, products, removeProduct, setSelectedProduct, seller } = useAppStore()
  const [search, setSearch] = useState("")

  // Derive sellerId from store seller
  const sellerId = seller?.id || ''

  // Filter products for current seller
  const sellerProducts = products.filter(p => p.sellerId === sellerId)
  const filtered = sellerProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Produk" rightAction={
        <Button
          onClick={() => navigate("seller-add-product")}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
        </Button>
      } />

      <div className="px-4 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari produk..." />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Box className="w-10 h-10 text-muted-foreground" />}
            title="Produk Tidak Ditemukan"
            subtitle="Coba kata kunci lain"
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((product, i) => (
              <motion.div key={product.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Box className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground line-clamp-1">{product.name}</p>
                        <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${product.status === "active" ? "border-emerald-300 text-emerald-600" : "border-amber-300 text-amber-600"}`}>
                          {product.status === "active" ? "Aktif" : "Draft"}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(product.discountPrice || product.price)}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">Stok: {product.stock}</span>
                        {product.stock < 10 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <AlertTriangle className="w-2.5 h-2.5" /> Stok Rendah
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{product.sold} terjual</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg" onClick={() => {
                      setSelectedProduct(product.id)
                      navigate("seller-add-product")
                    }}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={async () => {
                      try {
                        const res = await fetch('/api/seller/products', {
                          method: 'DELETE',
                          headers: getAuthHeaders(true),
                          body: JSON.stringify({ productId: product.id }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          removeProduct(product.id)
                          showToast("Produk berhasil dihapus", "success")
                        } else {
                          showToast(data.error || "Gagal menghapus produk", "error")
                        }
                      } catch {
                        showToast("Gagal menghapus produk", "error")
                      }
                    }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== SELLER ORDERS ====================
export function SellerOrders() {
  const { navigate, updateOrderStatus, showToast, orders, updateOrderTracking, seller } = useAppStore()
  const [activeTab, setActiveTab] = useState("all")
  const [showTrackingDialog, setShowTrackingDialog] = useState(false)
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null)
  const [trackingNumber, setTrackingNumber] = useState("")

  // Derive sellerId from store seller
  const sellerId = seller?.id || ''

  // Map real store orders for current seller to display format
  const sellerOrders = orders
    .filter(o => o.sellerId === sellerId)
    .map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      buyerName: o.address.recipient,
      items: o.items.map(i => `${i.productName} x${i.quantity}`).join(', '),
      amount: o.totalAmount,
      status: o.status,
      date: new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    }))

  const tabs = [
    { key: "all", label: "Semua", count: sellerOrders.length },
    { key: "processing", label: "Perlu Diproses", count: sellerOrders.filter(o => o.status === "paid" || o.status === "processing").length },
    { key: "shipped", label: "Dikirim", count: sellerOrders.filter(o => o.status === "shipped").length },
    { key: "delivered", label: "Selesai", count: sellerOrders.filter(o => o.status === "delivered").length },
  ]

  const filtered = activeTab === "all"
    ? sellerOrders
    : activeTab === "processing"
      ? sellerOrders.filter(o => o.status === "paid" || o.status === "processing" || o.status === "pending")
      : activeTab === "shipped"
        ? sellerOrders.filter(o => o.status === "shipped")
        : sellerOrders.filter(o => o.status === "delivered")

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Pesanan" />

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
                activeTab === tab.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Order Cards */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Pesanan"
              subtitle="Pesanan akan muncul di sini"
            />
          ) : (
            filtered.map((order, i) => (
              <motion.div key={order.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-muted-foreground">{order.orderNumber}</p>
                      <StatusBadge status={order.status} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">{order.date}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{order.buyerName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{order.items}</p>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-foreground">{formatPrice(order.amount)}</p>
                    <div className="flex gap-2">
                      {order.status === "paid" && (
                        <Button size="sm" className="h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
                          updateOrderStatus(order.id, 'processing')
                          // Also update via API
                          fetch('/api/orders', {
                            method: 'PUT',
                            headers: getAuthHeaders(true),
                            body: JSON.stringify({ orderId: order.id, status: 'processing' }),
                          }).catch(() => {})
                          showToast("Pesanan sedang diproses", "success")
                        }}>
                          <Package className="w-3 h-3 mr-1" /> Proses
                        </Button>
                      )}
                      {order.status === "processing" && (
                        <Button size="sm" className="h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
                          setTrackingOrderId(order.id)
                          setTrackingNumber("")
                          setShowTrackingDialog(true)
                        }}>
                          <Truck className="w-3 h-3 mr-1" /> Kirim
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => showToast("Invoice dicetak", "info")}>
                        <Printer className="w-3 h-3 mr-1" /> Invoice
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Tracking Number Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Masukkan Nomor Resi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <label className="text-xs font-medium text-foreground">No. Resi Pengiriman <span className="text-red-500">*</span></label>
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Contoh: JNE1234567890"
              className="rounded-xl h-10"
              autoFocus
            />
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={() => {
                if (!trackingNumber.trim()) {
                  showToast("Masukkan nomor resi", "error")
                  return
                }
                if (trackingOrderId) {
                  updateOrderTracking(trackingOrderId, trackingNumber.trim())
                  updateOrderStatus(trackingOrderId, 'shipped')
                  // Also update via API
                  fetch('/api/orders', {
                    method: 'PUT',
                    headers: getAuthHeaders(true),
                    body: JSON.stringify({ orderId: trackingOrderId, status: 'shipped', trackingNumber: trackingNumber.trim() }),
                  }).catch(() => {})
                  showToast("Pesanan sedang dikirim", "success")
                }
                setShowTrackingDialog(false)
                setTrackingOrderId(null)
                setTrackingNumber("")
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10 flex-1"
            >
              Kirim Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== SELLER ANALYTICS ====================
export function SellerAnalytics() {
  const { products, orders, seller, sellerStats, fetchSellerStats } = useAppStore()

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
    .reduce((sum, o) => sum + o.subtotal * 0.95, 0)

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

// ==================== SELLER WALLET ====================
export function SellerWallet() {
  const { navigate, showToast, sellerBalance, sellerBankAccounts, withdrawRequests, seller, walletMutations } = useAppStore()

  // Derive sellerId from store seller
  const sellerId = seller?.id || ''

  // Current seller's withdraw requests
  const myWithdrawRequests = withdrawRequests.filter(w => w.sellerId === sellerId)
  const pendingWithdraws = myWithdrawRequests.filter(w => w.status === 'pending')
  const recentWithdraws = myWithdrawRequests.slice(0, 3)

  return (
    <div className="pb-20">
      <PageHeader title="Dompet Seller" />

      <div className="px-4 space-y-4">
        {/* Balance Card */}
        <motion.div {...fadeIn}>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-sm text-emerald-100 font-medium">Saldo Tersedia</p>
              <p className="text-3xl font-bold mt-1">{formatPrice(sellerBalance.availableBalance)}</p>

              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-emerald-200">
                  <Clock className="w-3 h-3" />
                  <span>Pending: {formatPrice(sellerBalance.pendingBalance)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-200">
                  <Shield className="w-3 h-3" />
                  <span>Hold: {formatPrice(sellerBalance.holdBalance)}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <Button
                  onClick={() => navigate('seller-withdraw')}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl h-9 text-xs font-bold gap-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Tarik Dana
                </Button>
                <Button
                  onClick={() => navigate('seller-withdraw-history')}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 rounded-xl h-9 text-xs font-bold gap-1"
                >
                  <Clock className="w-3.5 h-3.5" /> Riwayat WD
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Balance Breakdown */}
        <motion.div {...fadeIn}>
          <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
            <h3 className="text-sm font-bold">Rincian Saldo</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tersedia untuk WD</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-600">{formatPrice(sellerBalance.availableBalance)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pesanan Belum Selesai</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-amber-600">{formatPrice(sellerBalance.pendingBalance)}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ditahan (Dispute/Proses WD)</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-red-500">{formatPrice(sellerBalance.holdBalance)}</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground">Total Saldo</p>
                <p className="text-sm font-bold text-foreground">{formatPrice(sellerBalance.totalBalance)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div {...fadeIn} className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total Penjualan</span>
            </div>
            <p className="text-base font-bold text-foreground">{formatPrice(sellerBalance.totalBalance)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total WD</span>
            </div>
            <p className="text-base font-bold text-foreground">{formatPrice(sellerBalance.totalWithdrawn)}</p>
          </Card>
        </motion.div>

        {/* Pending Withdrawals Alert */}
        {pendingWithdraws.length > 0 && (
          <motion.div {...fadeIn}>
            <button
              onClick={() => navigate('seller-withdraw-history')}
              className="w-full bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{pendingWithdraws.length} Penarikan Pending</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Menunggu review admin</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500" />
            </button>
          </motion.div>
        )}

        {/* Commission Rate */}
        <motion.div {...fadeIn}>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Komisi Platform</p>
                  <p className="text-xs text-muted-foreground">Dipotong dari penjualan</p>
                </div>
              </div>
              <p className="text-lg font-bold text-foreground">5%</p>
            </div>
          </Card>
        </motion.div>

        {/* Bank Account Info */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Rekening Bank" actionLabel="Kelola" onAction={() => navigate('seller-settings')} />
          <div className="space-y-2 mt-3">
            {sellerBankAccounts.map((account) => {
              const bankLogos: Record<string, string> = { BCA: "🏦", Mandiri: "🏛️", BNI: "🏛️", BRI: "🏛️" }
              return (
                <Card key={account.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-lg">{bankLogos[account.bankName] || '🏦'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{account.bankName}</p>
                        {account.isDefault && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] px-1.5 py-0.5">
                            Utama
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{account.accountNumber} · {account.accountHolder}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </motion.div>

        {/* Recent Withdraw History */}
        {recentWithdraws.length > 0 && (
          <motion.div {...fadeIn}>
            <SectionHeader
              title="Penarikan Terakhir"
              actionLabel="Lihat Semua"
              onAction={() => navigate('seller-withdraw-history')}
            />
            <div className="space-y-2 mt-3">
              {recentWithdraws.map((wd) => {
                const statusColor = wd.status === 'completed' ? 'text-emerald-600' : wd.status === 'rejected' ? 'text-red-500' : 'text-amber-600'
                const statusLabel = wd.status === 'completed' ? 'Selesai' : wd.status === 'rejected' ? 'Ditolak' : wd.status === 'approved' ? 'Disetujui' : 'Pending'
                return (
                  <Card key={wd.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          wd.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/30' :
                          wd.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/30' :
                          'bg-amber-50 dark:bg-amber-900/30'
                        }`}>
                          <ArrowUpRight className={`w-4 h-4 ${statusColor}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">WD ke {wd.bankAccount.bankName}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(wd.requestDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{formatPrice(wd.amount)}</p>
                        <p className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Transaction History */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Riwayat Transaksi" />
          <div className="space-y-2 mt-3">
            {walletMutations.length === 0 ? (
              <EmptyState
                icon={<Wallet className="w-10 h-10 text-muted-foreground" />}
                title="Belum Ada Transaksi"
                subtitle="Riwayat transaksi akan muncul di sini"
              />
            ) : (
              walletMutations.map((tx, i) => (
                <motion.div key={tx.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          tx.type === "credit"
                            ? "bg-emerald-50 dark:bg-emerald-900/30"
                            : "bg-red-50 dark:bg-red-900/30"
                        }`}>
                          {tx.type === "credit"
                            ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                            : <ArrowUpRight className="w-4 h-4 text-red-600" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(tx.createdAt)}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${tx.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                        {tx.type === "credit" ? "+" : "-"}{formatPrice(tx.amount)}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== SELLER CHAT ====================
export function SellerChat() {
  const { navigate, setSelectedChatRoom, chatRooms } = useAppStore()
  const [autoReply, setAutoReply] = useState(false)

  return (
    <div className="pb-20">
      <PageHeader title="Chat Pembeli" />

      <div className="px-4 space-y-4">
        {/* Auto-Reply Toggle */}
        <motion.div {...fadeIn}>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-Reply</p>
                  <p className="text-xs text-muted-foreground">Balas otomatis saat offline</p>
                </div>
              </div>
              <Switch checked={autoReply} onCheckedChange={setAutoReply} />
            </div>
          </Card>
        </motion.div>

        {/* Chat List */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Daftar Chat" />
          <div className="space-y-2 mt-3">
            {chatRooms.length === 0 ? (
              <EmptyState
                icon={<MessageCircle className="w-10 h-10 text-muted-foreground" />}
                title="Belum Ada Chat"
                subtitle="Chat dari pembeli akan muncul di sini"
              />
            ) : (
              chatRooms.map((room, i) => (
                <motion.div key={room.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => {
                    setSelectedChatRoom(room.id)
                    navigate("chat-room")
                  }}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center">
                          {room.seller?.storeName?.charAt(0) || '?'}
                        </div>
                        {room.unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                            {room.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{room.seller?.storeName || 'Pembeli'}</p>
                          <p className="text-[10px] text-muted-foreground">{formatRelativeTime(room.lastMessageTime)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{room.lastMessage}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== SELLER SETTINGS ====================
export function SellerSettings() {
  const { showToast, seller } = useAppStore()
  const [storeName, setStoreName] = useState(seller?.storeName || "My Store")
  const [storeDesc, setStoreDesc] = useState(seller?.storeDesc || "")
  const [autoReplyMsg, setAutoReplyMsg] = useState(seller?.autoReply || "Terima kasih sudah menghubungi kami. Kami akan membalas pesan Anda secepatnya.")

  return (
    <div className="pb-20">
      <PageHeader title="Pengaturan Toko" />

      <div className="px-4 space-y-4">
        {/* Store Profile */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Profil Toko" icon={<Store className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nama Toko <span className="text-red-500">*</span></label>
              <Input value={storeName} onChange={e => setStoreName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Deskripsi Toko</label>
              <textarea
                value={storeDesc}
                onChange={e => setStoreDesc(e.target.value)}
                className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>
          </Card>
        </motion.div>

        {/* Store Banner */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Banner Toko" icon={<Calendar className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="h-32 rounded-xl bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
              <Plus className="w-8 h-8 text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Upload Banner</p>
              <p className="text-[10px] text-muted-foreground">1200 x 400 px</p>
            </div>
          </Card>
        </motion.div>

        {/* Bank Account */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Rekening Bank" icon={<Banknote className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nama Bank <span className="text-red-500">*</span></label>
              <Input defaultValue={seller?.bankName || ""} className="rounded-xl" placeholder="Contoh: BCA" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nomor Rekening <span className="text-red-500">*</span></label>
              <Input defaultValue={seller?.bankAccount || ""} className="rounded-xl" placeholder="Nomor rekening" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nama Pemilik <span className="text-red-500">*</span></label>
              <Input defaultValue={seller?.bankHolder || ""} className="rounded-xl" placeholder="Nama sesuai rekening" />
            </div>
          </Card>
        </motion.div>

        {/* Shipping Settings */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pengiriman" icon={<Truck className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            {["JNE", "SiCepat", "J&T", "AnterAja"].map((courier) => (
              <div key={courier} className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">{courier}</span>
                <Switch defaultChecked={courier !== "AnterAja"} />
              </div>
            ))}
          </Card>
        </motion.div>

        {/* Auto-Reply Message */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Pesan Auto-Reply" icon={<MessageCircle className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            <textarea
              value={autoReplyMsg}
              onChange={e => setAutoReplyMsg(e.target.value)}
              className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </Card>
        </motion.div>

        {/* Save Button */}
        <motion.div {...fadeIn}>
          <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11" onClick={() => showToast("Pengaturan berhasil disimpan!", "success")}>
            Simpan Pengaturan
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== SELLER CAMPAIGN ====================
export function SellerCampaign() {
  const { navigate } = useAppStore()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="pb-20">
      <PageHeader title="Kampanye & Promo" rightAction={
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Buat Kampanye
        </Button>
      } />

      <div className="px-4 space-y-4">
        {/* Active Campaigns */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Kampanye Aktif" icon={<Megaphone className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            <EmptyState
              icon={<Megaphone className="w-10 h-10 text-muted-foreground" />}
              title="Belum Ada Kampanye"
              subtitle="Buat kampanye atau promo untuk menarik lebih banyak pembeli"
            />
          </div>
        </motion.div>

        {/* Create Campaign Form */}
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <SectionHeader title="Buat Kampanye Baru" icon={<Plus className="w-4 h-4" />} />
            <Card className="mt-3 p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Nama Kampanye <span className="text-red-500">*</span></label>
                <Input placeholder="Contoh: Flash Sale Akhir Tahun" className="rounded-xl" />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium text-foreground">Tipe Kampanye <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl text-xs h-9">
                    <Zap className="w-3 h-3 mr-1" /> Flash Sale
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl text-xs h-9">
                    <Tag className="w-3 h-3 mr-1" /> Voucher
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Diskon (%) <span className="text-red-500">*</span></label>
                <Input type="number" placeholder="10" className="rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Mulai <span className="text-red-500">*</span></label>
                  <Input type="date" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Berakhir <span className="text-red-500">*</span></label>
                  <Input type="date" className="rounded-xl" />
                </div>
              </div>

              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10">
                Buat Kampanye
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Flash Sale Setup */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Flash Sale Setup" icon={<Zap className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="flex flex-col items-center justify-center text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                <Zap className="w-7 h-7 text-orange-500" />
              </div>
              <p className="text-sm font-medium text-foreground">Buat Flash Sale</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Tampilkan produk dengan diskon spesial untuk waktu terbatas</p>
              <Button
                onClick={() => setShowCreate(true)}
                variant="outline"
                className="mt-3 rounded-xl text-xs"
              >
                Setup Flash Sale
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Voucher Creation */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Voucher Creation" icon={<Gift className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="flex flex-col items-center justify-center text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mb-3">
                <Gift className="w-7 h-7 text-violet-500" />
              </div>
              <p className="text-sm font-medium text-foreground">Buat Voucher</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Buat voucher diskon untuk menarik lebih banyak pembeli</p>
              <Button
                onClick={() => setShowCreate(true)}
                variant="outline"
                className="mt-3 rounded-xl text-xs"
              >
                Buat Voucher
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
