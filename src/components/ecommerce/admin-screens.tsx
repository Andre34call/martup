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
  Ban, FileText, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Plus,
  Building2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, SectionHeader, SearchBar, EmptyState } from "./shared"
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

// ==================== ADMIN DASHBOARD ====================
export function AdminDashboard() {
  const { navigate, switchRole, userRole, showToast, withdrawRequests, products, orders, adminUsers, fetchAdminUsers, fetchDivisions, divisions } = useAppStore()

  // Fetch admin data on mount
  useEffect(() => {
    fetchAdminUsers()
    fetchDivisions()
  }, [])

  // Stats derived from real data
  const stats = {
    totalUsers: adminUsers.length,
    totalSellers: adminUsers.filter(u => u.role === 'seller').length,
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
    pendingWithdrawals: withdrawRequests.filter(w => w.status === 'pending').length,
    activeProducts: products.filter(p => p.status === 'active').length,
    revenueChart: [] as { date: string; revenue: number }[],
    userGrowth: [] as { date: string; users: number }[],
    totalDivisions: divisions.length,
    totalStaff: adminUsers.filter(u => ['admin', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr'].includes(u.role)).length,
    pendingSellerVerifications: adminUsers.filter(u => u.role === 'seller' && !u.isVerified).length,
    openComplaints: 0,
    recentOrders: [] as { orderNumber: string; totalAmount: number; status: string; createdAt: string }[],
    recentUsers: [] as { name: string; email: string; role: string; createdAt: string }[],
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
    finance: "bg-emerald-600",
    pr: "bg-blue-500",
    tech: "bg-purple-600",
    cs: "bg-orange-600",
    marketing: "bg-pink-500",
    operations: "bg-amber-500",
    legal: "bg-red-500",
    hr: "bg-teal-500",
  }

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
              onClick={() => navigate('notification')}
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
                    {(["buyer", "seller", "admin", "finance", "pr", "tech", "cs", "marketing", "operations"] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => { switchRole(role); setShowRoleMenu(false) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          userRole === role
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${roleColors[role]}`} />
                        <span className="font-medium capitalize">{role}</span>
                        {userRole === role && (
                          <Check className="w-3.5 h-3.5 ml-auto text-purple-600" />
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
        {/* Loading State */}
        {!stats && (
          <motion.div {...fadeIn} className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
            </div>
          </motion.div>
        )}

        {/* Key Metrics Grid */}
        <motion.div {...fadeIn} className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Users", value: (stats?.totalUsers ?? 0).toLocaleString(), icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" },
            { label: "Total Revenue", value: formatPrice(stats?.totalRevenue ?? 0), icon: DollarSign, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
            { label: "Total Orders", value: (stats?.totalOrders ?? 0).toLocaleString(), icon: Package, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400" },
            { label: "Divisions", value: (stats?.totalDivisions ?? 0).toString(), icon: Building2, color: "text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400" },
            { label: "Staff Members", value: (stats?.totalStaff ?? 0).toString(), icon: Shield, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400" },
            { label: "Active Products", value: (stats?.activeProducts ?? 0).toLocaleString(), icon: Box, color: "text-pink-600 bg-pink-50 dark:bg-pink-900/30 dark:text-pink-400" },
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
            {(stats?.revenueChart && stats.revenueChart.length > 0) ? (
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
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => {
                      if (v >= 1000000000) return `${(v / 1000000000).toFixed(1)}B`
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
                      return v.toString()
                    }} />
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
            ) : (
              <div className="h-56 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No revenue data yet</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* User Growth Chart - Line Chart */}
        <motion.div {...fadeIn}>
          <SectionHeader title="User Growth" icon={<Users className="w-4 h-4" />} />
          <Card className="mt-3 p-4">
            {(stats?.userGrowth && stats.userGrowth.length > 0) ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.userGrowth} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => {
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
                      return v.toString()
                    }} />
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
            ) : (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No user growth data yet</p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Pending Actions */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Tindakan Diperlukan" icon={<AlertTriangle className="w-4 h-4" />} />
          <div className="space-y-2 mt-3">
            {[
              { label: "Permintaan Penarikan", count: stats?.pendingWithdrawals ?? 0, icon: DollarSign, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30", screen: "admin-withdraw" as const },
              { label: "Verifikasi Seller", count: stats?.pendingSellerVerifications ?? 0, icon: Shield, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30", screen: "admin-users" as const },
              { label: "Laporan Produk", count: 0, icon: Eye, color: "text-red-600 bg-red-50 dark:bg-red-900/30", screen: "admin-products" as const },
              { label: "Keluhan Terbuka", count: stats?.openComplaints ?? 0, icon: MessageSquare, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30", screen: "admin-complaints" as const },
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

        {/* Recent Activity */}
        {stats && (stats.recentOrders.length > 0 || stats.recentUsers.length > 0) && (
          <motion.div {...fadeIn}>
            <SectionHeader title="Aktivitas Terbaru" icon={<Clock className="w-4 h-4" />} />
            <div className="space-y-3 mt-3">
              {/* Recent Orders */}
              {stats.recentOrders.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Pesanan Terbaru</p>
                  <div className="space-y-2">
                    {stats.recentOrders.map((order, i) => (
                      <motion.div key={order.orderNumber} custom={i} variants={stagger} initial="initial" animate="animate">
                        <Card className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50 dark:bg-orange-900/30 text-orange-600">
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">#{order.orderNumber}</p>
                                <p className="text-xs text-muted-foreground">{formatPrice(order.totalAmount)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className={`text-[9px] ${
                                order.status === 'paid' ? 'border-emerald-300 text-emerald-600' :
                                order.status === 'delivered' ? 'border-blue-300 text-blue-600' :
                                order.status === 'pending' ? 'border-amber-300 text-amber-600' :
                                'border-gray-300 text-gray-600'
                              }`}>
                                {order.status}
                              </Badge>
                              <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(order.createdAt)}</p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {/* Recent Users */}
              {stats.recentUsers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">User Terbaru</p>
                  <div className="space-y-2">
                    {stats.recentUsers.map((user, i) => (
                      <motion.div key={user.email} custom={i} variants={stagger} initial="initial" animate="animate">
                        <Card className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-sm">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-600">
                                {user.role}
                              </Badge>
                              <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(user.createdAt)}</p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Quick Navigation */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Menu Admin" />
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: "Users", icon: Users, screen: "admin-users" as const, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30" },
              { label: "Divisions", icon: Building2, screen: "admin-divisions" as const, color: "bg-teal-50 text-teal-600 dark:bg-teal-900/30" },
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
  const { showToast, adminUsers, updateAdminUser, deleteAdminUser } = useAppStore()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")

  // Derive status from store fields for UI compatibility
  const users = adminUsers.map(u => ({
    ...u,
    status: u.isBlocked ? "blocked" : u.isVerified ? "active" : "pending" as string,
    joined: u.joinDate,
  }))

  const filtered = users.filter(u => {
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
            { key: "admin", label: "Admin" },
            { key: "finance", label: "Finance" },
            { key: "pr", label: "PR" },
            { key: "tech", label: "Tech" },
            { key: "cs", label: "CS" },
            { key: "marketing", label: "Marketing" },
            { key: "operations", label: "Ops" },
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
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
                        updateAdminUser(user.id, { isVerified: true })
                        showToast("User berhasil diverifikasi", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Verify
                      </Button>
                    )}
                    {user.status === "active" && (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-amber-600" onClick={() => {
                        updateAdminUser(user.id, { isBlocked: true })
                        showToast("User diblokir", "info")
                      }}>
                        <Ban className="w-3 h-3 mr-0.5" /> Block
                      </Button>
                    )}
                    {user.status === "blocked" && (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-blue-500 hover:bg-blue-600 text-white" onClick={() => {
                        updateAdminUser(user.id, { isBlocked: false })
                        showToast("User dibuka kembali", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Unblock
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => {
                      deleteAdminUser(user.id)
                      showToast("User dihapus", "info")
                    }}>
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
  const { showToast, products, updateProduct, removeProduct } = useAppStore()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Derive admin product list from store products
  const adminProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    seller: p.seller.storeName,
    price: p.price,
    status: p.status as 'active' | 'blocked' | 'draft',
  }))

  const filtered = adminProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.seller.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const flaggedProducts = adminProducts.filter(p => p.status === "blocked")

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
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
                        const storeProduct = products.find(sp => sp.id === product.id)
                        if (storeProduct) updateProduct({ ...storeProduct, status: 'active' })
                        showToast("Produk diapprove", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => {
                        removeProduct(product.id)
                        showToast("Produk dihapus", "info")
                      }}>
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
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
                        const storeProduct = products.find(sp => sp.id === product.id)
                        if (storeProduct) updateProduct({ ...storeProduct, status: 'active' })
                        showToast("Produk diapprove", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Approve
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => {
                        const storeProduct = products.find(sp => sp.id === product.id)
                        if (storeProduct) updateProduct({ ...storeProduct, status: 'blocked' })
                        showToast("Produk diblokir", "info")
                      }}>
                        <Ban className="w-3 h-3 mr-0.5" /> Block
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => {
                      removeProduct(product.id)
                      showToast("Produk dihapus", "info")
                    }}>
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
type ApiWithdrawal = {
  id: string
  sellerId: string
  sellerName: string
  sellerEmail: string
  amount: number
  bankAccount: string
  bankName: string
  bankHolder: string
  status: string
  adminNote: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

export function AdminWithdraw() {
  const { showToast } = useAppStore()
  const [withdrawals, setWithdrawals] = useState<ApiWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "processed" | "rejected" | "all">("pending")
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchWithdrawals = async () => {
    try {
      const res = await fetch('/api/admin/withdrawals')
      const data = await res.json()
      if (data.success) {
        setWithdrawals(data.withdrawals)
      }
    } catch {
      console.error('Failed to fetch withdrawals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWithdrawals() }, [])

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending')

  const displayed = activeTab === 'pending' ? pendingWithdrawals
    : activeTab === 'all' ? withdrawals
    : withdrawals.filter(w => w.status === activeTab)

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: id, updates: { status: 'approved' } }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Penarikan disetujui", "success")
        fetchWithdrawals()
      } else {
        showToast(data.error || 'Gagal menyetujui', "error")
      }
    } catch {
      showToast('Gagal menyetujui', "error")
    }
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: showRejectModal, updates: { status: 'rejected', adminNote: rejectReason || 'Tidak memenuhi syarat' } }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Penarikan ditolak", "info")
        fetchWithdrawals()
      } else {
        showToast(data.error || 'Gagal menolak', "error")
      }
    } catch {
      showToast('Gagal menolak', "error")
    }
    setShowRejectModal(null)
    setRejectReason('')
  }

  const handleMarkProcessed = async (id: string) => {
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: id, updates: { status: 'processed' } }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Penarikan selesai - dana telah ditransfer", "success")
        fetchWithdrawals()
      } else {
        showToast(data.error || 'Gagal memproses', "error")
      }
    } catch {
      showToast('Gagal memproses', "error")
    }
  }

  const statusColorMap: Record<string, string> = {
    pending: "border-amber-300 text-amber-600",
    approved: "border-blue-300 text-blue-600",
    processing: "border-purple-300 text-purple-600",
    processed: "border-emerald-300 text-emerald-600",
    completed: "border-emerald-300 text-emerald-600",
    rejected: "border-red-300 text-red-600",
  }

  const statusLabelMap: Record<string, string> = {
    pending: "Pending",
    approved: "Disetujui",
    processing: "Diproses",
    processed: "Selesai",
    completed: "Selesai",
    rejected: "Ditolak",
  }

  return (
    <div className="pb-20">
      <PageHeader title="Penarikan Dana" rightAction={
        <span className="text-xs text-muted-foreground">{pendingWithdrawals.length} pending</span>
      } />

      <div className="px-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{pendingWithdrawals.length}</p>
            <p className="text-[10px] text-amber-600 font-medium">Pending</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{withdrawals.filter(w => w.status === 'processed' || w.status === 'completed').length}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Selesai</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-600">{withdrawals.filter(w => w.status === 'rejected').length}</p>
            <p className="text-[10px] text-red-600 font-medium">Ditolak</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "pending" as const, label: "Pending" },
            { key: "approved" as const, label: "Approved" },
            { key: "processed" as const, label: "Selesai" },
            { key: "rejected" as const, label: "Ditolak" },
            { key: "all" as const, label: "Semua" },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors border whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-card text-foreground border-border"
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Total amount for pending */}
        {activeTab === 'pending' && pendingWithdrawals.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">Total Permintaan Pending</p>
                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                  {formatPrice(pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0))}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        )}

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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{withdrawal.sellerName}</p>
                        <Badge variant="outline" className={`text-[10px] ${statusColorMap[withdrawal.status]}`}>
                          {statusLabelMap[withdrawal.status]}
                        </Badge>
                      </div>
                      <p className="text-base font-bold text-foreground mt-0.5">{formatPrice(withdrawal.amount)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(withdrawal.createdAt)}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Bank</span>
                      <span className="text-xs font-medium text-foreground">{withdrawal.bankName} - ****{(withdrawal.bankAccount || '').slice(-4)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pemilik</span>
                      <span className="text-xs text-foreground">{withdrawal.bankHolder}</span>
                    </div>
                    {withdrawal.adminNote && (
                      <div className="flex items-start gap-1.5 mt-1 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-[10px] text-red-600 dark:text-red-400">{withdrawal.adminNote}</span>
                      </div>
                    )}
                  </div>
                  {withdrawal.status === 'pending' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Button size="sm" className="flex-1 h-8 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleApprove(withdrawal.id)}>
                        <Check className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setShowRejectModal(withdrawal.id)}>
                        <X className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                  {withdrawal.status === 'approved' && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <Button size="sm" className="w-full h-8 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white" onClick={() => handleMarkProcessed(withdrawal.id)}>
                        <Check className="w-3 h-3 mr-1" /> Tandai Selesai Transfer
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Reject modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
            onClick={() => setShowRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-base font-bold">Tolak Penarikan?</h3>
                <p className="text-sm text-muted-foreground">Dana akan dikembalikan ke saldo seller</p>
              </div>
              <Input
                placeholder="Alasan penolakan (opsional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="rounded-xl"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl"
                  onClick={() => { setShowRejectModal(null); setRejectReason('') }}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleReject}
                >
                  Tolak
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== ADMIN BANNER ====================
type ApiBanner = {
  id: string
  title: string
  image: string
  link: string | null
  position: string
  sortOrder: number
  isActive: boolean
  startDate: string | null
  endDate: string | null
  createdAt: string
}

export function AdminBanner() {
  const { showToast } = useAppStore()
  const [banners, setBanners] = useState<ApiBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPosition, setNewPosition] = useState('home_top')
  const [newLink, setNewLink] = useState('')
  const [newImage, setNewImage] = useState('')

  const fetchBanners = async () => {
    try {
      const res = await fetch('/api/admin/banners')
      const data = await res.json()
      if (data.success) {
        setBanners(data.banners)
      }
    } catch {
      console.error('Failed to fetch banners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBanners() }, [])

  const handleToggleActive = async (banner: ApiBanner) => {
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerId: banner.id, updates: { isActive: !banner.isActive } }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(!banner.isActive ? "Banner diaktifkan" : "Banner dinonaktifkan", "success")
        fetchBanners()
      }
    } catch {
      showToast('Gagal mengubah status banner', "error")
    }
  }

  const handleAddBanner = async () => {
    if (!newTitle || !newImage) {
      showToast('Judul dan gambar wajib diisi', "error")
      return
    }
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, image: newImage, position: newPosition, link: newLink || null }),
      })
      const data = await res.json()
      if (data.success) {
        showToast("Banner berhasil ditambahkan", "success")
        setShowAdd(false)
        setNewTitle('')
        setNewPosition('home_top')
        setNewLink('')
        setNewImage('')
        fetchBanners()
      } else {
        showToast(data.error || 'Gagal menambahkan banner', "error")
      }
    } catch {
      showToast('Gagal menambahkan banner', "error")
    }
  }

  const handleDeleteBanner = async (bannerId: string) => {
    try {
      const res = await fetch(`/api/admin/banners?bannerId=${bannerId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showToast("Banner dihapus", "info")
        fetchBanners()
      }
    } catch {
      showToast('Gagal menghapus banner', "error")
    }
  }

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
            {banners.map((banner, i) => (
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
                    <div className="flex items-center gap-2">
                      <Switch checked={banner.isActive} onCheckedChange={() => handleToggleActive(banner)} />
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteBanner(banner.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </motion.button>
                    </div>
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
                <Input placeholder="Contoh: Flash Sale Weekend" className="rounded-xl" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Posisi</label>
                <Input placeholder="Contoh: Home Top" className="rounded-xl" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Gambar Banner</label>
                <div className="h-28 rounded-xl bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors" onClick={() => setNewImage(newImage ? newImage : 'https://placehold.co/800x400/e2e8f0/64748b?text=Banner')}>
                  {newImage ? (
                    <p className="text-xs text-muted-foreground text-center px-4 break-all">{newImage}</p>
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Upload Banner</p>
                    </>
                  )}
                </div>
                <Input placeholder="URL gambar..." className="rounded-xl" value={newImage} onChange={(e) => setNewImage(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Link (Opsional)</label>
                <Input placeholder="https://..." className="rounded-xl" value={newLink} onChange={(e) => setNewLink(e.target.value)} />
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10" onClick={handleAddBanner}>
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
type AdminStats = {
  totalUsers: number
  totalSellers: number
  totalOrders: number
  totalRevenue: number
  activeProducts: number
  pendingWithdrawals: number
  totalDivisions: number
  totalStaff: number
  pendingSellerVerifications: number
  openComplaints: number
  revenueChart: { date: string; revenue: number }[]
  userGrowth: { date: string; users: number }[]
  topSellers: { name: string; revenue: number; orders: number }[]
  categoryPerformance: { name: string; revenue: number; percentage: number }[]
  recentOrders: { orderNumber: string; totalAmount: number; status: string; createdAt: string }[]
  recentUsers: { name: string; email: string; role: string; createdAt: string }[]
}

export function AdminAnalytics() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState("30d")

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        const data = await res.json()
        if (data.success) {
          setStats(data.stats)
        }
      } catch {
        console.error('Failed to fetch admin stats')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const topSellers = stats?.topSellers || []
  const categoryPerformance = stats?.categoryPerformance || []

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
                <AreaChart data={stats?.revenueChart || []} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Pesanan</th>
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
                        <td className="px-4 py-3 text-sm text-right text-muted-foreground">{seller.orders} pesanan</td>
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
          <Card className="mt-3 p-4">
            <p className="text-sm text-muted-foreground text-center py-4">Data belum tersedia</p>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

// ==================== ADMIN COMPLAINTS ====================
type ApiComplaint = {
  id: string
  orderId: string
  orderNumber: string
  orderStatus: string
  orderTotal: number
  paymentStatus: string
  userId: string
  userName: string
  userEmail: string
  userAvatar: string | null
  sellerId: string
  sellerName: string
  type: string
  reason: string
  description: string
  images: string[]
  status: string
  resolution: string | null
  refundAmount: number | null
  createdAt: string
  updatedAt: string
}

export function AdminComplaints() {
  const { showToast } = useAppStore()
  const [complaints, setComplaints] = useState<ApiComplaint[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("open")

  const fetchComplaints = async () => {
    try {
      const res = await fetch('/api/admin/complaints')
      const data = await res.json()
      if (data.success) {
        setComplaints(data.complaints)
      }
    } catch {
      console.error('Failed to fetch complaints')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchComplaints() }, [])

  const handleUpdateComplaint = async (complaintId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/admin/complaints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId, updates }),
      })
      const data = await res.json()
      if (data.success) {
        fetchComplaints()
        return true
      } else {
        showToast(data.error || 'Gagal memperbarui keluhan', "error")
        return false
      }
    } catch {
      showToast('Gagal memperbarui keluhan', "error")
      return false
    }
  }

  const filtered = activeTab === "all"
    ? complaints
    : complaints.filter(c => c.status === activeTab)

  const statusLabel: Record<string, string> = {
    open: "Terbuka",
    processing: "Diproses",
    resolved: "Diselesaikan",
    rejected: "Ditolak",
  }

  const statusColor: Record<string, string> = {
    open: "border-red-300 text-red-600",
    processing: "border-amber-300 text-amber-600",
    resolved: "border-emerald-300 text-emerald-600",
    rejected: "border-gray-300 text-gray-500",
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
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-muted-foreground">{complaint.orderNumber || complaint.orderId}</p>
                      {complaint.orderTotal > 0 && (
                        <span className="text-[10px] text-muted-foreground">· {formatPrice(complaint.orderTotal)}</span>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusColor[complaint.status]}`}>
                      {statusLabel[complaint.status] || complaint.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pembeli</p>
                      <p className="text-xs font-medium text-foreground">{complaint.userName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Seller</p>
                      <p className="text-xs font-medium text-foreground">{complaint.sellerName}</p>
                    </div>
                  </div>
                  <div className="mb-2">
                    <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">
                      {complaint.type}
                    </Badge>
                  </div>
                  {complaint.reason && (
                    <p className="text-xs font-medium text-foreground mb-1">{complaint.reason}</p>
                  )}
                  <p className="text-sm text-foreground">{complaint.description}</p>
                  {complaint.resolution && (
                    <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                      <p className="text-[10px] text-emerald-600 font-medium">Resolusi:</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">{complaint.resolution}</p>
                    </div>
                  )}
                  {complaint.refundAmount && complaint.refundAmount > 0 && (
                    <div className="mt-1 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <p className="text-[10px] text-blue-600 font-medium">Refund: {formatPrice(complaint.refundAmount)}</p>
                    </div>
                  )}

                  {complaint.status !== "resolved" && complaint.status !== "rejected" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      {complaint.status === "open" && (
                        <Button size="sm" className="h-7 text-[11px] rounded-lg bg-amber-500 hover:bg-amber-600 text-white" onClick={async () => {
                          const ok = await handleUpdateComplaint(complaint.id, { status: "processing" })
                          if (ok) showToast("Keluhan sedang diproses", "info")
                        }}>
                          <Clock className="w-3 h-3 mr-0.5" /> Proses
                        </Button>
                      )}
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={async () => {
                        const ok = await handleUpdateComplaint(complaint.id, { status: "resolved" })
                        if (ok) showToast("Keluhan diselesaikan", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Resolve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={async () => {
                        const ok = await handleUpdateComplaint(complaint.id, { status: "rejected" })
                        if (ok) showToast("Keluhan ditolak", "info")
                      }}>
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
