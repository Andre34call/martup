"use client"

import { motion } from "framer-motion"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line
} from "recharts"
import {
  Users, DollarSign, Package, Box, Bell, Settings, Search,
  ChevronRight, Shield, Eye, Trash2, Check, X, AlertTriangle,
  TrendingUp, Megaphone, ImageIcon, Calendar, BarChart3, MessageSquare,
  Ban, FileText, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useAppStore } from "@/lib/store"
import { MOCK_ADMIN_STATS, MOCK_PRODUCTS, formatPrice } from "@/lib/mock-data"
import { PageHeader, SectionHeader, StatusBadge, SearchBar, EmptyState } from "./shared"
import type { Order, OrderStatus } from "@/lib/types"
import { useState } from "react"

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

// ==================== MOCK DATA ====================
const mockAdminUsers = [
  { id: "u1", name: "Ahmad Fauzi", email: "ahmad@email.com", role: "buyer" as const, status: "active", joined: "15 Jan 2024" },
  { id: "u2", name: "Gadget Pro Store", email: "gadget@email.com", role: "seller" as const, status: "active", joined: "20 Feb 2024" },
  { id: "u3", name: "Fashion Hub", email: "fashion@email.com", role: "seller" as const, status: "active", joined: "5 Mar 2024" },
  { id: "u4", name: "Beauty Corner", email: "beauty@email.com", role: "seller" as const, status: "pending", joined: "10 Apr 2024" },
  { id: "u5", name: "Siti Nurhaliza", email: "siti@email.com", role: "buyer" as const, status: "active", joined: "1 Mei 2024" },
  { id: "u6", name: "Budi Santoso", email: "budi@email.com", role: "buyer" as const, status: "blocked", joined: "12 Jun 2024" },
  { id: "u7", name: "Home Living ID", email: "home@email.com", role: "seller" as const, status: "active", joined: "8 Jul 2024" },
  { id: "u8", name: "Sport Zone", email: "sport@email.com", role: "seller" as const, status: "active", joined: "22 Agu 2024" },
  { id: "u9", name: "Dewi Lestari", email: "dewi@email.com", role: "buyer" as const, status: "active", joined: "15 Sep 2024" },
  { id: "u10", name: "Rudi Hartono", email: "rudi@email.com", role: "buyer" as const, status: "active", joined: "3 Okt 2024" },
  { id: "u11", name: "Maya Putri", email: "maya@email.com", role: "buyer" as const, status: "active", joined: "18 Nov 2024" },
  { id: "u12", name: "Tech World", email: "tech@email.com", role: "seller" as const, status: "pending", joined: "1 Des 2024" },
]

const mockAdminProducts = [
  { id: "p1", name: "iPhone 15 Pro Max", seller: "Gadget Pro Store", price: 21999000, status: "active" as const },
  { id: "p2", name: "Samsung Galaxy S24 Ultra", seller: "Gadget Pro Store", price: 17999000, status: "active" as const },
  { id: "p3", name: "Kemeja Flannel Premium", seller: "Fashion Hub", price: 149000, status: "active" as const },
  { id: "p4", name: "Gaun Midi Elegant", seller: "Fashion Hub", price: 359000, status: "active" as const },
  { id: "p5", name: "Sneakers Nike Air Max 90", seller: "Sport Zone", price: 999000, status: "active" as const },
  { id: "p6", name: "Lipstik Matte Velvet", seller: "Beauty Corner", price: 55000, status: "blocked" as const },
  { id: "p7", name: "Skincare Set Glowing", seller: "Beauty Corner", price: 245000, status: "active" as const },
  { id: "p8", name: "Produk Ilegal XXX", seller: "Bad Seller", price: 500000, status: "blocked" as const },
]

const mockWithdrawals = [
  { id: "w1", sellerName: "Gadget Pro Store", amount: 25000000, bank: "BCA - ****1234", requestDate: "20 Des 2024", status: "pending" as const },
  { id: "w2", sellerName: "Fashion Hub", amount: 15000000, bank: "Mandiri - ****5678", requestDate: "20 Des 2024", status: "pending" as const },
  { id: "w3", sellerName: "Home Living ID", amount: 8000000, bank: "BNI - ****9012", requestDate: "19 Des 2024", status: "pending" as const },
  { id: "w4", sellerName: "Sport Zone", amount: 5500000, bank: "BRI - ****3456", requestDate: "19 Des 2024", status: "pending" as const },
  { id: "w5", sellerName: "Beauty Corner", amount: 3200000, bank: "BCA - ****7890", requestDate: "18 Des 2024", status: "approved" as const },
]

const mockBanners = [
  { id: "b1", title: "Flash Sale Akhir Tahun", position: "Home Top", isActive: true },
  { id: "b2", title: "Diskon Elektronik 50%", position: "Category - Elektronik", isActive: true },
  { id: "b3", title: "Gratis Ongkir Minimal Belanja 100K", position: "Home Middle", isActive: false },
]

const mockComplaints = [
  { id: "c1", orderId: "ORD-2024-201", buyer: "Ahmad Fauzi", seller: "Gadget Pro Store", type: "Barang Tidak Sesuai", description: "iPhone yang dikirim warna berbeda dari pesanan", status: "open" as const },
  { id: "c2", orderId: "ORD-2024-202", buyer: "Siti Nurhaliza", seller: "Fashion Hub", type: "Pengiriman Lambat", description: "Sudah 7 hari belum dikirim", status: "open" as const },
  { id: "c3", orderId: "ORD-2024-203", buyer: "Budi Santoso", seller: "Beauty Corner", type: "Produk Palsu", description: "Skincare yang diterima bukan original", status: "processing" as const },
  { id: "c4", orderId: "ORD-2024-204", buyer: "Dewi Lestari", seller: "Home Living ID", type: "Barang Rusak", description: "Diffuser diterima dalam keadaan pecah", status: "open" as const },
  { id: "c5", orderId: "ORD-2024-205", buyer: "Rudi Hartono", seller: "Sport Zone", type: "Refund Ditolak", description: "Seller menolak refund tanpa alasan jelas", status: "resolved" as const },
]

const mockTopSellers = [
  { name: "Gadget Pro Store", revenue: 4500000000, orders: 15000, rating: 4.9 },
  { name: "Home Living ID", revenue: 2800000000, orders: 12000, rating: 4.8 },
  { name: "Fashion Hub", revenue: 1900000000, orders: 8000, rating: 4.7 },
  { name: "Sport Zone", revenue: 1200000000, orders: 6000, rating: 4.6 },
  { name: "Beauty Corner", revenue: 850000000, orders: 3000, rating: 4.5 },
]

const mockCategoryPerformance = [
  { name: "Handphone", revenue: 3500000000, percentage: 28 },
  { name: "Laptop", revenue: 2500000000, percentage: 20 },
  { name: "Fashion", revenue: 2000000000, percentage: 16 },
  { name: "Kecantikan", revenue: 1500000000, percentage: 12 },
  { name: "Elektronik", revenue: 1200000000, percentage: 10 },
  { name: "Lainnya", revenue: 1800000000, percentage: 14 },
]

const mockPaymentMethods = [
  { name: "Midtrans", percentage: 35 },
  { name: "GoPay", percentage: 25 },
  { name: "OVO", percentage: 18 },
  { name: "DANA", percentage: 12 },
  { name: "COD", percentage: 7 },
  { name: "Transfer Bank", percentage: 3 },
]

// ==================== ADMIN DASHBOARD ====================
export function AdminDashboard() {
  const { navigate } = useAppStore()
  const stats = MOCK_ADMIN_STATS

  return (
    <div className="pb-20">
      {/* Top Header */}
      <motion.div {...fadeIn} className="sticky top-0 z-40 glass">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground">MartUp Admin</h1>
            <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("admin-analytics")}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="px-4 pt-4 space-y-6">
        {/* Key Metrics Grid */}
        <motion.div {...fadeIn} className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Users", value: "125K", icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" },
            { label: "Total Revenue", value: "Rp 12.5B", icon: DollarSign, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
            { label: "Total Orders", value: "450K", icon: Package, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400" },
            { label: "Active Products", value: "850K", icon: Box, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400" },
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

        {/* Revenue Chart - Area Chart */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Revenue Overview" icon={<DollarSign className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenueChart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revenueGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* User Growth Chart - Line Chart */}
        <motion.div {...fadeIn}>
          <SectionHeader title="User Growth" icon={<Users className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.userGrowth} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value: number) => [value.toLocaleString(), "Users"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                  />
                  <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Pending Actions */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Tindakan Diperlukan" icon={<AlertTriangle className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            {[
              { label: "Permintaan Penarikan", count: 23, icon: DollarSign, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30", screen: "admin-withdraw" as const },
              { label: "Verifikasi Seller", count: 5, icon: Shield, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30", screen: "admin-users" as const },
              { label: "Laporan Produk", count: 3, icon: Eye, color: "text-red-600 bg-red-50 dark:bg-red-900/30", screen: "admin-products" as const },
              { label: "Keluhan Terbuka", count: 8, icon: MessageSquare, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30", screen: "admin-complaints" as const },
            ].map((item, i) => (
              <motion.div key={item.label} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.count} pending</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-lg"
                      onClick={() => navigate(item.screen)}
                    >
                      Review
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Navigation */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Menu Admin" />
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: "Users", icon: Users, screen: "admin-users" as const, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30" },
              { label: "Products", icon: Box, screen: "admin-products" as const, color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30" },
              { label: "Withdraw", icon: DollarSign, screen: "admin-withdraw" as const, color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30" },
              { label: "Banners", icon: ImageIcon, screen: "admin-banner" as const, color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30" },
              { label: "Analytics", icon: BarChart3, screen: "admin-analytics" as const, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" },
              { label: "Complaints", icon: MessageSquare, screen: "admin-complaints" as const, color: "bg-red-50 text-red-600 dark:bg-red-900/30" },
            ].map((item) => (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(item.screen)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-foreground">{item.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== ADMIN USERS ====================
export function AdminUsers() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")

  const filtered = mockAdminUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === "all" || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Users" />

      <div className="px-4 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari user..." />

        {/* Role Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "buyer", label: "Buyer" },
            { key: "seller", label: "Seller" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setRoleFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                roleFilter === filter.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* User Table */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="w-10 h-10 text-muted-foreground" />}
              title="User Tidak Ditemukan"
              subtitle="Coba kata kunci lain"
            />
          ) : (
            filtered.map((user, i) => (
              <motion.div key={user.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center flex-shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        <Badge variant="outline" className={`text-[9px] ${
                          user.role === "seller" ? "border-orange-300 text-orange-600" : "border-emerald-300 text-emerald-600"
                        }`}>
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[9px] ${
                          user.status === "active" ? "border-emerald-300 text-emerald-600" :
                          user.status === "pending" ? "border-amber-300 text-amber-600" :
                          "border-red-300 text-red-600"
                        }`}>
                          {user.status === "active" ? "Aktif" : user.status === "pending" ? "Pending" : "Blocked"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">Bergabung {user.joined}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    {user.status === "pending" && (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Check className="w-3 h-3 mr-0.5" /> Verify
                      </Button>
                    )}
                    {user.status === "active" && (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-amber-600">
                        <Ban className="w-3 h-3 mr-0.5" /> Block
                      </Button>
                    )}
                    {user.status === "blocked" && (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-blue-500 hover:bg-blue-600 text-white">
                        <Check className="w-3 h-3 mr-0.5" /> Unblock
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== ADMIN PRODUCTS ====================
export function AdminProducts() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filtered = mockAdminProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.seller.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const flaggedProducts = mockAdminProducts.filter(p => p.status === "blocked")

  return (
    <div className="pb-20">
      <PageHeader title="Moderasi Produk" />

      <div className="px-4 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari produk atau seller..." />

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Aktif" },
            { key: "blocked", label: "Diblokir" },
          ].map((filter) => (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                statusFilter === filter.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Flagged Products Section */}
        {statusFilter === "all" && flaggedProducts.length > 0 && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Produk Ditandai" icon={<AlertTriangle className="w-4 h-4 text-red-500" />} />
            <div className="space-y-2 mt-3">
              {flaggedProducts.map((product, i) => (
                <motion.div key={product.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-3 border-red-200 dark:border-red-900/50">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                          <Badge variant="outline" className="text-[9px] border-red-300 text-red-600">Blocked</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{product.seller} · {formatPrice(product.price)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-2 border-t border-red-100 dark:border-red-900/30">
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Check className="w-3 h-3 mr-0.5" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500">
                        <Trash2 className="w-3 h-3 mr-0.5" /> Delete
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Product List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Box className="w-10 h-10 text-muted-foreground" />}
              title="Produk Tidak Ditemukan"
              subtitle="Coba kata kunci lain"
            />
          ) : (
            filtered.map((product, i) => (
              <motion.div key={product.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Box className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <Badge variant="outline" className={`text-[9px] ${
                          product.status === "active" ? "border-emerald-300 text-emerald-600" : "border-red-300 text-red-600"
                        }`}>
                          {product.status === "active" ? "Aktif" : "Blocked"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{product.seller}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(product.price)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                    {product.status === "blocked" ? (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Check className="w-3 h-3 mr-0.5" /> Approve
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500">
                        <Ban className="w-3 h-3 mr-0.5" /> Block
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== ADMIN WITHDRAW ====================
export function AdminWithdraw() {
  const [activeTab, setActiveTab] = useState("pending")

  const pendingWithdrawals = mockWithdrawals.filter(w => w.status === "pending")
  const historyWithdrawals = mockWithdrawals.filter(w => w.status !== "pending")

  const displayed = activeTab === "pending" ? pendingWithdrawals : historyWithdrawals

  return (
    <div className="pb-20">
      <PageHeader title="Penarikan Dana" />

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-colors border ${
              activeTab === "pending"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-card text-foreground border-border"
            }`}
          >
            Pending ({pendingWithdrawals.length})
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-colors border ${
              activeTab === "history"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-card text-foreground border-border"
            }`}
          >
            Riwayat
          </motion.button>
        </div>

        {/* Withdrawal List */}
        <div className="space-y-3">
          {displayed.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Permintaan"
              subtitle="Semua permintaan penarikan sudah diproses"
            />
          ) : (
            displayed.map((withdrawal, i) => (
              <motion.div key={withdrawal.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{withdrawal.sellerName}</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{formatPrice(withdrawal.amount)}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${
                      withdrawal.status === "pending" ? "border-amber-300 text-amber-600" :
                      withdrawal.status === "approved" ? "border-emerald-300 text-emerald-600" :
                      "border-red-300 text-red-600"
                    }`}>
                      {withdrawal.status === "pending" ? "Pending" : withdrawal.status === "approved" ? "Approved" : "Rejected"}
                    </Badge>
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Bank</span>
                      <span className="text-xs font-medium text-foreground">{withdrawal.bank}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Tanggal</span>
                      <span className="text-xs text-foreground">{withdrawal.requestDate}</span>
                    </div>
                  </div>
                  {withdrawal.status === "pending" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button size="sm" className="flex-1 h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Check className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg text-red-500">
                        <X className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== ADMIN BANNER ====================
export function AdminBanner() {
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Banner" rightAction={
        <Button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
        </Button>
      } />

      <div className="px-4 space-y-4">
        {/* Current Banners */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Banner Aktif" icon={<ImageIcon className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            {mockBanners.map((banner, i) => (
              <motion.div key={banner.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-emerald-400 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{banner.title}</p>
                        <p className="text-xs text-muted-foreground">{banner.position}</p>
                      </div>
                    </div>
                    <Switch checked={banner.isActive} />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Add New Banner Form */}
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <SectionHeader title="Tambah Banner Baru" icon={<Plus className="w-4 h-4" />} />
            <Card className="mt-3 p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Judul Banner</label>
                <Input placeholder="Contoh: Flash Sale Weekend" className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Posisi</label>
                <Input placeholder="Contoh: Home Top" className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Gambar Banner</label>
                <div className="h-28 rounded-xl bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors">
                  <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Upload Banner</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Link (Opsional)</label>
                <Input placeholder="https://..." className="rounded-xl" />
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10">
                Simpan Banner
              </Button>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ==================== ADMIN ANALYTICS ====================
export function AdminAnalytics() {
  const stats = MOCK_ADMIN_STATS
  const [dateRange, setDateRange] = useState("30d")

  return (
    <div className="pb-20">
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
                  {mockTopSellers.map((seller, i) => (
                    <tr key={seller.name} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-xs font-bold text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{seller.name}</p>
                        <p className="text-[10px] text-muted-foreground">{seller.orders.toLocaleString()} pesanan</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">{formatPrice(seller.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground">{seller.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Category Performance */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Performa Kategori" icon={<BarChart3 className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            {mockCategoryPerformance.map((cat, i) => (
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
            ))}
          </Card>
        </motion.div>

        {/* Payment Method Distribution */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Distribusi Metode Pembayaran" icon={<CreditCard className="w-4 h-4" />} />
          <Card className="mt-3 p-4 space-y-3">
            {mockPaymentMethods.map((method, i) => (
              <div key={method.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{method.name}</span>
                  <span className="text-xs text-muted-foreground">{method.percentage}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${method.percentage}%` }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="h-full bg-blue-500 rounded-full"
                  />
                </div>
              </div>
            ))}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== ADMIN COMPLAINTS ====================
export function AdminComplaints() {
  const [activeTab, setActiveTab] = useState("open")

  const filtered = activeTab === "all"
    ? mockComplaints
    : mockComplaints.filter(c => c.status === activeTab)

  const statusLabel: Record<string, string> = {
    open: "Terbuka",
    processing: "Diproses",
    resolved: "Diselesaikan",
  }

  const statusColor: Record<string, string> = {
    open: "border-red-300 text-red-600",
    processing: "border-amber-300 text-amber-600",
    resolved: "border-emerald-300 text-emerald-600",
  }

  return (
    <div className="pb-20">
      <PageHeader title="Keluhan" />

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "Semua" },
            { key: "open", label: "Terbuka" },
            { key: "processing", label: "Diproses" },
            { key: "resolved", label: "Diselesaikan" },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Complaints List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-10 h-10 text-muted-foreground" />}
              title="Tidak Ada Keluhan"
              subtitle="Semua keluhan sudah ditangani"
            />
          ) : (
            filtered.map((complaint, i) => (
              <motion.div key={complaint.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-mono text-muted-foreground">{complaint.orderId}</p>
                    <Badge variant="outline" className={`text-[10px] ${statusColor[complaint.status]}`}>
                      {statusLabel[complaint.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pembeli</p>
                      <p className="text-xs font-medium text-foreground">{complaint.buyer}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Seller</p>
                      <p className="text-xs font-medium text-foreground">{complaint.seller}</p>
                    </div>
                  </div>
                  <div className="mb-2">
                    <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">
                      {complaint.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{complaint.description}</p>

                  {complaint.status !== "resolved" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      {complaint.status === "open" && (
                        <Button size="sm" className="h-7 text-[11px] rounded-lg bg-amber-500 hover:bg-amber-600 text-white">
                          <Clock className="w-3 h-3 mr-0.5" /> Proses
                        </Button>
                      )}
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Check className="w-3 h-3 mr-0.5" /> Resolve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500">
                        <X className="w-3 h-3 mr-0.5" /> Reject
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
