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
  Store, FolderTree, Tag, Wallet,
  Building2, Upload, Star, Edit, ClipboardList
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useAppStore } from "@/lib/store"
import type { WithdrawStatus } from "@/lib/types"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, SectionHeader, SearchBar, EmptyState } from "./shared"
import { useState, useRef, useEffect, useCallback } from "react"
import { AnimatePresence } from "framer-motion"
import { ConfirmDialog } from "./confirm-dialog"
import { LoadingSpinner } from "./loading-spinner"

import { getAuthHeaders } from '@/lib/store/getAuthHeaders'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

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

// ==================== ADMIN DASHBOARD ====================
export function AdminDashboard() {
  const { navigate, switchRole, userRole, currentUser, showToast, withdrawRequests, products, orders, adminUsers, adminStats, fetchAdminStats, fetchAdminUsers, fetchAdminWithdrawals, fetchDivisions, divisions } = useAppStore()

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAdminStats(), fetchAdminUsers(), fetchAdminWithdrawals(), fetchDivisions()]).finally(() => setIsLoading(false))
  }, [fetchAdminStats, fetchAdminUsers, fetchAdminWithdrawals, fetchDivisions])

  const stats = adminStats ? {
    totalUsers: adminStats.totalUsers,
    totalSellers: adminStats.totalSellers,
    totalOrders: adminStats.totalOrders,
    totalRevenue: adminStats.totalRevenue,
    pendingWithdrawals: adminStats.pendingWithdrawals,
    activeProducts: adminStats.activeProducts,
    revenueChart: adminStats.revenueChart,
    userGrowth: adminStats.userGrowth,
    totalDivisions: adminStats.totalDivisions ?? divisions.length,
    totalStaff: adminStats.totalStaff ?? adminUsers.filter(u => ['admin', 'manager', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr'].includes(u.role)).length,
    pendingSellerVerifications: adminStats.unverifiedSellers ?? adminUsers.filter(u => u.role === 'seller' && !u.isVerified).length,
    openComplaints: adminStats.openComplaints ?? 0,
    topSellers: adminStats.topSellers ?? [],
    categoryPerformance: adminStats.categoryPerformance ?? [],
    recentOrders: adminStats.recentOrders ?? [],
    recentUsers: adminStats.recentUsers ?? [],
  } : {
    totalUsers: adminUsers.length,
    totalSellers: 0,
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
    pendingWithdrawals: withdrawRequests.filter(w => w.status === 'pending').length,
    activeProducts: products.filter(p => p.status === 'active').length,
    revenueChart: [] as { date: string; revenue: number }[],
    userGrowth: [] as { date: string; users: number }[],
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
    manager: "bg-violet-500",
  }

  if (isLoading) return <div className="pb-20"><PageHeader title="MartUp Admin" /><div className="px-4"><LoadingSpinner message="Memuat dashboard..." /></div></div>

  return (
    <div className="pb-20">
      {/* Top Header */}
      <motion.div {...fadeIn} className="sticky top-0 z-40 glass">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground">MartUp Admin</h1>
            <Badge className={`text-white text-[10px] px-1.5 py-0.5 ${
              currentUser?.role === 'manager' ? 'bg-violet-600' : 'bg-blue-600'
            }`}>{currentUser?.role === 'manager' ? 'Manager' : 'Admin'}</Badge>
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
              onClick={() => navigate("admin-settings")}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </motion.button>
            {/* View Switcher - Only switches UI view, not actual role */}
            {['admin', 'manager'].includes(currentUser?.role || '') && (
            <div className="relative" ref={roleMenuRef}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className={`w-2 h-2 rounded-full ${roleColors[userRole]}`} />
                <span className="text-[11px] font-medium text-foreground">View</span>
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
                    <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">Switch View</p>
                    {(["buyer", "seller", "admin", "manager"] as const).map((role) => (
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
            )}
          </div>
        </div>
      </motion.div>

      <div className="px-4 pt-4 space-y-6">
        {/* Key Metrics Grid */}
        <motion.div {...fadeIn} className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Users", value: (stats?.totalUsers ?? 0).toLocaleString(), icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" },
            { label: "Total Sellers", value: (stats?.totalSellers ?? 0).toLocaleString(), icon: Store, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
            { label: "Total Orders", value: (stats?.totalOrders ?? 0).toLocaleString(), icon: Package, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400" },
            { label: "Active Products", value: (stats?.activeProducts ?? 0).toLocaleString(), icon: Box, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400" },
            { label: "Total Revenue", value: formatPrice(stats?.totalRevenue ?? 0), icon: DollarSign, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
            { label: "Divisions", value: (stats?.totalDivisions ?? 0).toString(), icon: Building2, color: "text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400" },
            { label: "Staff Members", value: (stats?.totalStaff ?? 0).toString(), icon: Shield, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400" },
            { label: "Pending Withdrawals", value: (stats?.pendingWithdrawals ?? 0).toLocaleString(), icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400" },
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
              { label: "Permintaan Penarikan", count: stats?.pendingWithdrawals ?? withdrawRequests.filter(w => w.status === 'pending').length, icon: DollarSign, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30", screen: "admin-withdraw" as const },
              { label: "Verifikasi Seller", count: stats?.pendingSellerVerifications ?? 0, icon: Shield, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30", screen: "admin-users" as const },
              { label: "Laporan Produk", count: 0, icon: Eye, color: "text-red-600 bg-red-50 dark:bg-red-900/30", screen: "admin-products" as const },
              { label: "Keluhan Terbuka", count: stats?.openComplaints ?? 0, icon: MessageSquare, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30", screen: "admin-complaints" as const },
              { label: "Alur Kerja Divisi", count: 0, icon: ClipboardList, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30", screen: "admin-workflow" as const },
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
              { label: "Divisions", icon: Building2, screen: "admin-divisions" as const, color: "bg-teal-50 text-teal-600 dark:bg-teal-900/30" },
              { label: "Workflow", icon: ClipboardList, screen: "admin-workflow" as const, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30" },
              { label: "Products", icon: Box, screen: "admin-products" as const, color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30" },
              { label: "Orders", icon: Package, screen: "admin-orders" as const, color: "bg-orange-50 text-orange-600 dark:bg-orange-900/30" },
              { label: "Withdraw", icon: DollarSign, screen: "admin-withdraw" as const, color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30" },
              { label: "Banners", icon: ImageIcon, screen: "admin-banner" as const, color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30" },
              { label: "Analytics", icon: BarChart3, screen: "admin-analytics" as const, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" },
              { label: "Complaints", icon: MessageSquare, screen: "admin-complaints" as const, color: "bg-red-50 text-red-600 dark:bg-red-900/30" },
              { label: "Categories", icon: FolderTree, screen: "admin-categories" as const, color: "bg-teal-50 text-teal-600 dark:bg-teal-900/30" },
              { label: "Vouchers", icon: Tag, screen: "admin-vouchers" as const, color: "bg-pink-50 text-pink-600 dark:bg-pink-900/30" },
              { label: "Deposits", icon: Wallet, screen: "admin-deposits" as const, color: "bg-lime-50 text-lime-600 dark:bg-lime-900/30" },
              { label: "Campaigns", icon: Megaphone, screen: "admin-campaigns" as const, color: "bg-violet-50 text-violet-600 dark:bg-violet-900/30" },
              { label: "Reviews", icon: Star, screen: "admin-reviews" as const, color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30" },
              { label: "Settings", icon: Settings, screen: "admin-settings" as const, color: "bg-slate-50 text-slate-600 dark:bg-slate-900/30" },
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
// SECURITY: No more hardcoded email — use the centralized SUPER_ADMIN_EMAIL from env
// This matches the backend env.SUPER_ADMIN_EMAIL which reads from environment variable
const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'kholisakm@gmail.com'

// Role hierarchy constants
const ELEVATED_ROLES = ['admin', 'manager', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr']
const DIVISION_ROLES = ['finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr']

export function AdminUsers() {
  const { showToast, adminUsers, updateAdminUser, deleteAdminUser, fetchAdminUsers, currentUser, divisions, fetchDivisions } = useAppStore()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  // Permission state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [promoteUser, setPromoteUser] = useState<{id: string; name: string; email: string; role: string} | null>(null)
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('')
  const [promoteLoading, setPromoteLoading] = useState(false)

  const isUserSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL && currentUser?.role === 'admin'
  const isUserManager = currentUser?.role === 'manager'
  const canPromote = isUserSuperAdmin || isUserManager // Manager + Super Admin can promote

  useEffect(() => {
    Promise.all([fetchAdminUsers(), fetchDivisions()]).finally(() => setIsLoading(false))
    setIsSuperAdmin(isUserSuperAdmin)
  }, [fetchAdminUsers, fetchDivisions, isUserSuperAdmin])

  const handleUpdateUser = async (userId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ userId, updates }),
      })
      const data = await res.json()
      if (data.success) {
        fetchAdminUsers()
        return true
      } else {
        showToast(data.error || 'Gagal mengupdate user', "error")
        return false
      }
    } catch {
      showToast('Gagal mengupdate user', "error")
      return false
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users', { method: 'DELETE', headers: getAuthHeaders(true), body: JSON.stringify({ userId }) })
      const data = await res.json()
      if (data.success) {
        showToast("User dihapus", "info")
        fetchAdminUsers()
      } else {
        showToast(data.error || 'Gagal menghapus user', "error")
      }
    } catch {
      showToast('Gagal menghapus user', "error")
    }
  }

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

  if (isLoading) return <div className="pb-20"><PageHeader title="Kelola Users" /><LoadingSpinner message="Memuat users..." /></div>

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
            { key: "manager", label: "Manager" },
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
                          user.email === SUPER_ADMIN_EMAIL ? "border-purple-300 text-purple-600" :
                          user.role === "manager" ? "border-violet-300 text-violet-600" :
                          user.role === "admin" ? "border-purple-300 text-purple-600" :
                          user.role === "seller" ? "border-orange-300 text-orange-600" :
                          user.role === "finance" ? "border-emerald-300 text-emerald-600" :
                          user.role === "pr" ? "border-blue-300 text-blue-600" :
                          user.role === "tech" ? "border-purple-300 text-purple-500" :
                          user.role === "cs" ? "border-orange-300 text-orange-500" :
                          user.role === "marketing" ? "border-pink-300 text-pink-600" :
                          user.role === "operations" ? "border-amber-300 text-amber-600" :
                          user.role === "legal" ? "border-red-300 text-red-500" :
                          user.role === "hr" ? "border-teal-300 text-teal-600" :
                          "border-emerald-300 text-emerald-600"
                        }`}>
                          {user.email === SUPER_ADMIN_EMAIL ? '👑 Super Admin' : user.role === 'manager' ? '👔 Manager' : user.role}
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
                        handleUpdateUser(user.id, { isVerified: true })
                        showToast("User berhasil diverifikasi", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Verify
                      </Button>
                    )}
                    {user.status === "active" && (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-amber-600" onClick={() => setConfirmAction({
                        action: () => { handleUpdateUser(user.id, { isBlocked: true }).then(() => showToast("User diblokir", "info")) },
                        title: 'Blokir User',
                        message: `Apakah Anda yakin ingin memblokir ${user.name}? User tidak akan dapat mengakses akunnya.`
                      })}>
                        <Ban className="w-3 h-3 mr-0.5" /> Block
                      </Button>
                    )}
                    {user.status === "blocked" && (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-blue-500 hover:bg-blue-600 text-white" onClick={() => {
                        handleUpdateUser(user.id, { isBlocked: false })
                        showToast("User dibuka kembali", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Unblock
                      </Button>
                    )}
                    {/* Promote to Division/Admin - Manager and Super Admin can promote non-elevated users */}
                    {canPromote && !ELEVATED_ROLES.includes(user.role) && user.email !== SUPER_ADMIN_EMAIL && (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-purple-500 hover:bg-purple-600 text-white" onClick={() => {
                        setPromoteUser({ id: user.id, name: user.name, email: user.email, role: user.role })
                        setSelectedDivisionId('')
                      }}>
                        <Shield className="w-3 h-3 mr-0.5" /> Promote
                      </Button>
                    )}
                    {/* Demote / Remove from Division — Manager can demote division admins, Super Admin can demote anyone */}
                    {((isSuperAdmin && ELEVATED_ROLES.includes(user.role)) || (isUserManager && DIVISION_ROLES.includes(user.role))) && user.email !== SUPER_ADMIN_EMAIL && (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20" onClick={() => setConfirmAction({
                        action: () => { handleUpdateUser(user.id, { role: 'buyer', divisionId: null }).then(() => showToast(`${user.name} telah dikembalikan menjadi buyer`, "info")) },
                        title: 'Kembalikan ke Buyer',
                        message: `Apakah Anda yakin ingin menghapus akses ${user.role === 'admin' ? 'admin' : user.role} dari ${user.name}? User akan kembali menjadi buyer.`
                      })}>
                        <Shield className="w-3 h-3 mr-0.5" /> Demote
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setConfirmAction({
                      action: () => { handleDeleteUser(user.id) },
                      title: 'Hapus User',
                      message: `Apakah Anda yakin ingin menghapus ${user.name}? Tindakan ini tidak dapat dibatalkan.`
                    })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />

      {/* Promote to Division Dialog - Super Admin Only */}
      <Dialog open={!!promoteUser} onOpenChange={(open) => { if (!open) setPromoteUser(null) }}>
        <DialogContent className="max-w-[380px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Promosikan User</DialogTitle>
          </DialogHeader>
          {promoteUser && (
            <div className="space-y-4 mt-2">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center flex-shrink-0">
                  {promoteUser.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{promoteUser.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{promoteUser.email}</p>
                  <Badge variant="outline" className="text-[9px] mt-0.5">{promoteUser.role}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Pilih Role</label>
                <p className="text-[10px] text-muted-foreground">User akan mendapatkan akses sesuai role yang dipilih.</p>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {/* Option: Manager — Super Admin only */}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setSelectedDivisionId('__manager__')}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                        selectedDivisionId === '__manager__'
                          ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Manager</p>
                        <p className="text-[10px] text-muted-foreground">Mengawasi semua divisi, bisa promosi ke admin divisi</p>
                      </div>
                      {selectedDivisionId === '__manager__' && (
                        <Check className="w-4 h-4 text-violet-600 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  )}
                  {/* Option: Regular Admin (no division) */}
                  <button
                    type="button"
                    onClick={() => setSelectedDivisionId('__admin__')}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                      selectedDivisionId === '__admin__'
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/30'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Admin</p>
                      <p className="text-[10px] text-muted-foreground">Akses penuh ke panel admin (tanpa divisi spesifik)</p>
                    </div>
                    {selectedDivisionId === '__admin__' && (
                      <Check className="w-4 h-4 text-purple-600 ml-auto flex-shrink-0" />
                    )}
                  </button>
                  {/* Division Options */}
                  {divisions.filter(d => d.isActive).map(division => (
                    <button
                      key={division.id}
                      type="button"
                      onClick={() => setSelectedDivisionId(division.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                        selectedDivisionId === division.id
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 text-lg">
                        {division.icon || '🏢'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{division.name}</p>
                        <p className="text-[10px] text-muted-foreground">{division.memberCount} anggota{division.headUser ? ` · Head: ${division.headUser.name}` : ''}</p>
                      </div>
                      {selectedDivisionId === division.id && (
                        <Check className="w-4 h-4 text-emerald-600 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning about role hierarchy */}
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  {isSuperAdmin 
                    ? 'Sebagai Super Admin, Anda dapat mempromosikan user ke role apapun termasuk Manager.'
                    : 'Sebagai Manager, Anda dapat mempromosikan user ke admin divisi. Hanya Super Admin yang bisa promosi ke Manager.'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setPromoteUser(null)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              disabled={!selectedDivisionId || promoteLoading}
              onClick={async () => {
                if (!promoteUser || !selectedDivisionId) return
                setPromoteLoading(true)
                try {
                  let payload: Record<string, unknown>
                  if (selectedDivisionId === '__manager__') {
                    // Promote to Manager — Super Admin only
                    payload = { userId: promoteUser.id, promoteToManager: true }
                  } else if (selectedDivisionId === '__admin__') {
                    // Promote to regular Admin (no division)
                    payload = { userId: promoteUser.id, divisionId: null }
                  } else {
                    // Promote to division admin
                    payload = { userId: promoteUser.id, divisionId: selectedDivisionId }
                  }

                  const res = await fetch('/api/admin/users', {
                    method: 'PATCH',
                    headers: getAuthHeaders(true),
                    body: JSON.stringify(payload),
                  })
                  const data = await res.json()
                  if (data.success) {
                    showToast(data.message || `${promoteUser.name} berhasil dipromosikan`, 'success')
                    setPromoteUser(null)
                    fetchAdminUsers()
                    fetchDivisions()
                  } else {
                    showToast(data.error || 'Gagal mempromosikan user', 'error')
                  }
                } catch {
                  showToast('Gagal mempromosikan user', 'error')
                } finally {
                  setPromoteLoading(false)
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white rounded-xl h-10 flex-1"
            >
              {promoteLoading ? 'Memproses...' : 'Promosikan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== ADMIN PRODUCTS ====================
interface AdminProductItem {
  id: string
  name: string
  description: string
  price: number
  discountPrice: number | null
  images: string[]
  videoUrl: string | null
  sellerName: string
  status: string
  sold: number
  isFeatured: boolean
  categoryId: string
  categoryName: string
  stock: number
  weight: number
  condition: string
  tags: string[]
}

export function AdminProducts() {
  const { showToast } = useAppStore()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [adminProducts, setAdminProducts] = useState<AdminProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)
  const [editProduct, setEditProduct] = useState<AdminProductItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editDiscountPrice, setEditDiscountPrice] = useState("")
  const [editStock, setEditStock] = useState("")
  const [editWeight, setEditWeight] = useState("")
  const [editCondition, setEditCondition] = useState("")
  const [editCategoryId, setEditCategoryId] = useState("")
  const [editImages, setEditImages] = useState<string[]>([])
  const [editVideoUrl, setEditVideoUrl] = useState("")
  const [editTags, setEditTags] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [categories, setCategories] = useState<{id: string; name: string}[]>([])

  const fetchAdminProducts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/products?limit=500', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        const mapped: AdminProductItem[] = (data.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: Number(p.price),
          discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
          images: Array.isArray(p.images) ? p.images : [],
          videoUrl: p.videoUrl || null,
          sellerName: p.seller?.storeName || 'Unknown',
          status: p.status,
          sold: p.sold,
          isFeatured: p.isFeatured,
          categoryId: p.categoryId || '',
          categoryName: p.category?.name || '',
          stock: p.stock || 0,
          weight: p.weight || 0,
          condition: p.condition || 'new',
          tags: Array.isArray(p.tags) ? p.tags : [],
        }))
        setAdminProducts(mapped)
      }
    } catch {
      showToast("Gagal memuat produk", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchAdminProducts()
  }, [fetchAdminProducts])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/admin/categories', { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.success) {
          setCategories((data.data || []).map((c: any) => ({ id: c.id, name: c.name })))
        }
      } catch {}
    }
    fetchCategories()
  }, [])

  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ productId, status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setAdminProducts(prev => prev.map(p => p.id === productId ? { ...p, status: newStatus } : p))
        showToast(newStatus === 'active' ? "Produk diapprove" : "Produk diblokir", "success")
      } else {
        showToast(data.error || "Gagal mengubah status produk", "error")
      }
    } catch {
      showToast("Gagal mengubah status produk", "error")
    }
  }

  const handleDelete = async (productId: string) => {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'DELETE',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ productId }),
      })
      const data = await res.json()
      if (data.success) {
        setAdminProducts(prev => prev.filter(p => p.id !== productId))
        showToast("Produk dihapus", "info")
      } else {
        showToast(data.error || "Gagal menghapus produk", "error")
      }
    } catch {
      showToast("Gagal menghapus produk", "error")
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingImage(true)
    try {
      const newImages: string[] = [...editImages]
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'products')
        formData.append('folder', 'images')
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: (() => {
            const h: Record<string, string> = {}
            if (typeof window !== 'undefined') {
              const token = localStorage.getItem('authToken') || localStorage.getItem('martup_token')
              if (token) h['Authorization'] = `Bearer ${token}`
              const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1]
              if (csrfToken) h['x-csrf-token'] = decodeURIComponent(csrfToken)
            }
            return h
          })(),
          body: formData,
        })
        const data = await res.json()
        if (data.success && data.data?.url) {
          newImages.push(data.data.url)
        } else {
          showToast(`Gagal upload ${file.name}`, 'error')
        }
      }
      setEditImages(newImages)
      showToast('Gambar berhasil diupload', 'success')
    } catch {
      showToast('Gagal upload gambar', 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingVideo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'products')
      formData.append('folder', 'videos')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: (() => {
          const h: Record<string, string> = {}
          if (typeof window !== 'undefined') {
            const token = localStorage.getItem('authToken') || localStorage.getItem('martup_token')
            if (token) h['Authorization'] = `Bearer ${token}`
            const csrfToken = document.cookie.match(/csrf_token=([^;]+)/)?.[1]
            if (csrfToken) h['x-csrf-token'] = decodeURIComponent(csrfToken)
          }
          return h
        })(),
        body: formData,
      })
      const data = await res.json()
      if (data.success && data.data?.url) {
        setEditVideoUrl(data.data.url)
        showToast('Video berhasil diupload', 'success')
      } else {
        showToast(data.error || 'Gagal upload video', 'error')
      }
    } catch {
      showToast('Gagal upload video', 'error')
    } finally {
      setUploadingVideo(false)
    }
  }

  const handleEditProduct = async (productId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ productId, ...updates }),
      })
      const data = await res.json()
      if (data.success) {
        setAdminProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updates, price: Number(updates.price ?? p.price) } : p))
        showToast("Produk berhasil diupdate", "success")
        return true
      } else {
        showToast(data.error || "Gagal mengupdate produk", "error")
        return false
      }
    } catch {
      showToast("Gagal mengupdate produk", "error")
      return false
    }
  }

  const filtered = adminProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sellerName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const flaggedProducts = adminProducts.filter(p => p.status === "blocked")

  if (loading) return <div className="pb-20"><PageHeader title="Moderasi Produk" /><LoadingSpinner message="Memuat produk..." /></div>

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
            { key: "draft", label: "Draft" },
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
                      <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {product.images && product.images.length > 0 ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                          <Badge variant="outline" className="text-[9px] border-red-300 text-red-600">Blocked</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{product.sellerName} · {formatPrice(product.price)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-2 border-t border-red-100 dark:border-red-900/30">
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleStatusChange(product.id, 'active')}>
                        <Check className="w-3 h-3 mr-0.5" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-blue-500" onClick={() => {
                        setEditProduct(product)
                        setEditName(product.name)
                        setEditDescription(product.description)
                        setEditPrice(product.price.toString())
                        setEditDiscountPrice(product.discountPrice ? product.discountPrice.toString() : "")
                        setEditStock(product.stock.toString())
                        setEditWeight(product.weight.toString())
                        setEditCondition(product.condition || 'new')
                        setEditCategoryId(product.categoryId || '')
                        setEditImages(product.images || [])
                        setEditVideoUrl(product.videoUrl || '')
                        setEditTags((product.tags || []).join(', '))
                      }}>
                        <Edit className="w-3 h-3 mr-0.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => setConfirmAction({
                        action: () => handleDelete(product.id),
                        title: 'Hapus Produk',
                        message: `Apakah Anda yakin ingin menghapus "${product.name}"? Tindakan ini tidak dapat dibatalkan.`
                      })}>
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
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Box className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <Badge variant="outline" className={`text-[9px] ${
                          product.status === "active" ? "border-emerald-300 text-emerald-600" :
                          product.status === "draft" ? "border-amber-300 text-amber-600" :
                          "border-red-300 text-red-600"
                        }`}>
                          {product.status === "active" ? "Aktif" : product.status === "draft" ? "Draft" : "Blocked"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{product.sellerName} · Terjual {product.sold}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(product.price)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-blue-500" onClick={() => {
                      setEditProduct(product)
                      setEditName(product.name)
                      setEditDescription(product.description)
                      setEditPrice(product.price.toString())
                      setEditDiscountPrice(product.discountPrice ? product.discountPrice.toString() : "")
                      setEditStock(product.stock.toString())
                      setEditWeight(product.weight.toString())
                      setEditCondition(product.condition || 'new')
                      setEditCategoryId(product.categoryId || '')
                      setEditImages(product.images || [])
                      setEditVideoUrl(product.videoUrl || '')
                      setEditTags((product.tags || []).join(', '))
                    }}>
                      <Edit className="w-3 h-3 mr-0.5" /> Edit
                    </Button>
                    {product.status === "blocked" ? (
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handleStatusChange(product.id, 'active')}>
                        <Check className="w-3 h-3 mr-0.5" /> Approve
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => setConfirmAction({
                        action: () => handleStatusChange(product.id, 'blocked'),
                        title: 'Blokir Produk',
                        message: `Apakah Anda yakin ingin memblokir "${product.name}"? Produk tidak akan terlihat oleh pembeli.`
                      })}>
                        <Ban className="w-3 h-3 mr-0.5" /> Block
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => setConfirmAction({
                      action: () => handleDelete(product.id),
                      title: 'Hapus Produk',
                      message: `Apakah Anda yakin ingin menghapus "${product.name}"? Tindakan ini tidak dapat dibatalkan.`
                    })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <Dialog open={!!editProduct} onOpenChange={(open) => { if (!open) setEditProduct(null) }}>
        <DialogContent className="max-w-[420px] max-h-[85vh] overflow-y-auto rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit Produk</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {/* Basic Info */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Nama Produk</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Deskripsi</label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Price & Stock Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Harga (Rp)</label>
                <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Diskon (Rp)</label>
                <Input type="number" value={editDiscountPrice} onChange={e => setEditDiscountPrice(e.target.value)} placeholder="0" className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Stok</label>
                <Input type="number" value={editStock} onChange={e => setEditStock(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Berat (gram)</label>
                <Input type="number" value={editWeight} onChange={e => setEditWeight(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            {/* Category & Condition */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Kategori</label>
                <select
                  value={editCategoryId}
                  onChange={e => setEditCategoryId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Pilih Kategori</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Kondisi</label>
                <select
                  value={editCondition}
                  onChange={e => setEditCondition(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="new">Baru</option>
                  <option value="used">Bekas</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Tags (pisah koma)</label>
              <Input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="tag1, tag2, tag3" className="rounded-xl" />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Gambar Produk</label>
              <div className="flex flex-wrap gap-2">
                {editImages.map((img, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={img} alt={`Product ${idx+1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingImage ? (
                    <span className="text-[9px] text-muted-foreground">Uploading...</span>
                  ) : (
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  )}
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">Klik × untuk menghapus gambar. Klik icon upload untuk menambah.</p>
            </div>

            {/* Video */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Video Produk</label>
              {editVideoUrl && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <video src={editVideoUrl} className="w-20 h-14 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{editVideoUrl.split('/').pop()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditVideoUrl('')}
                    className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              )}
              <label className={`flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-border cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground ${uploadingVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingVideo ? 'Uploading...' : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Upload Video
                  </>
                )}
                <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoUpload} className="hidden" />
              </label>
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setEditProduct(null)} className="rounded-xl h-10 flex-1">
              Batal
            </Button>
            <Button
              onClick={async () => {
                if (!editProduct) return
                const tagArray = editTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
                const success = await handleEditProduct(editProduct.id, {
                  name: editName.trim(),
                  description: editDescription.trim(),
                  price: Number(editPrice),
                  discountPrice: editDiscountPrice ? Number(editDiscountPrice) : null,
                  stock: Number(editStock),
                  weight: Number(editWeight),
                  condition: editCondition,
                  categoryId: editCategoryId || undefined,
                  images: editImages,
                  videoUrl: editVideoUrl || null,
                  tags: tagArray.length > 0 ? tagArray : undefined,
                })
                if (success) setEditProduct(null)
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-10 flex-1"
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />
    </div>
  )
}

// ==================== ADMIN WITHDRAW ====================
export function AdminWithdraw() {
  const { showToast, withdrawRequests, updateWithdrawStatus, fetchAdminWithdrawals } = useAppStore()
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "completed" | "rejected" | "all">("pending")
  const [isLoading, setIsLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)

  useEffect(() => {
    fetchAdminWithdrawals().finally(() => setIsLoading(false))
  }, [fetchAdminWithdrawals])
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const pendingWithdrawals = withdrawRequests.filter(w => w.status === 'pending')
  const historyWithdrawals = withdrawRequests.filter(w => w.status !== 'pending')

  const displayed = activeTab === 'pending' ? pendingWithdrawals
    : activeTab === 'all' ? withdrawRequests
    : withdrawRequests.filter(w => w.status === activeTab)

  const handleApprove = (id: string) => {
    updateWithdrawStatus(id, 'approved')
    showToast("Penarikan disetujui", "success")
  }

  const handleReject = () => {
    if (!showRejectModal) return
    setConfirmAction({
      action: () => { updateWithdrawStatus(showRejectModal, 'rejected', rejectReason || 'Tidak memenuhi syarat'); showToast("Penarikan ditolak", "info"); setShowRejectModal(null); setRejectReason('') },
      title: 'Tolak Penarikan',
      message: 'Apakah Anda yakin ingin menolak permintaan penarikan ini? Dana tidak akan ditransfer ke penjual.'
    })
  }

  const handleMarkCompleted = (id: string) => {
    updateWithdrawStatus(id, 'completed')
    showToast("Penarikan selesai - dana telah ditransfer", "success")
  }

  const statusColorMap: Record<WithdrawStatus, string> = {
    pending: "border-amber-300 text-amber-600",
    approved: "border-blue-300 text-blue-600",
    processing: "border-purple-300 text-purple-600",
    processed: "border-purple-300 text-purple-600",
    completed: "border-emerald-300 text-emerald-600",
    rejected: "border-red-300 text-red-600",
  }

  const statusLabelMap: Record<WithdrawStatus, string> = {
    pending: "Pending",
    approved: "Disetujui",
    processing: "Diproses",
    processed: "Diproses",
    completed: "Selesai",
    rejected: "Ditolak",
  }

  if (isLoading) return <div className="pb-20"><PageHeader title="Penarikan Dana" /><LoadingSpinner message="Memuat penarikan..." /></div>

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
            <p className="text-lg font-bold text-emerald-600">{withdrawRequests.filter(w => w.status === 'completed').length}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Selesai</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-600">{withdrawRequests.filter(w => w.status === 'rejected').length}</p>
            <p className="text-[10px] text-red-600 font-medium">Ditolak</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "pending" as const, label: "Pending" },
            { key: "approved" as const, label: "Approved" },
            { key: "completed" as const, label: "Selesai" },
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
                      <p className="text-[10px] text-muted-foreground">Net: {formatPrice(withdrawal.netAmount)} · Fee: {formatPrice(withdrawal.adminFee)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatRelativeTime(withdrawal.requestDate)}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Bank</span>
                      <span className="text-xs font-medium text-foreground">{withdrawal.bankAccount.bankName} - ****{withdrawal.bankAccount.accountNumber.slice(-4)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pemilik</span>
                      <span className="text-xs text-foreground">{withdrawal.bankAccount.accountHolder}</span>
                    </div>
                    {withdrawal.rejectionReason && (
                      <div className="flex items-start gap-1.5 mt-1 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-[10px] text-red-600 dark:text-red-400">{withdrawal.rejectionReason}</span>
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
                      <Button size="sm" className="w-full h-8 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white" onClick={() => handleMarkCompleted(withdrawal.id)}>
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
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />
    </div>
  )
}

// ==================== ADMIN BANNER ====================
const BANNER_POSITIONS = [
  { value: "home_top", label: "Home Atas" },
  { value: "home_mid", label: "Home Tengah" },
  { value: "home_bottom", label: "Home Bawah" },
  { value: "category_top", label: "Kategori Atas" },
  { value: "search_top", label: "Pencarian Atas" },
  { value: "product_detail", label: "Detail Produk" },
  { value: "checkout_top", label: "Checkout Atas" },
  { value: "popup", label: "Popup" },
] as const

export function AdminBanner() {
  const { showToast, adminBanners, fetchAdminBanners } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newBannerTitle, setNewBannerTitle] = useState("")
  const [newBannerPosition, setNewBannerPosition] = useState("home_top")
  const [newBannerImageUrl, setNewBannerImageUrl] = useState("")
  const [newBannerLink, setNewBannerLink] = useState("")
  const [newBannerSortOrder, setNewBannerSortOrder] = useState(0)
  const [newBannerStartDate, setNewBannerStartDate] = useState("")
  const [newBannerEndDate, setNewBannerEndDate] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{action: () => void, title: string, message: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAdminBanners().finally(() => setIsLoading(false))
  }, [fetchAdminBanners])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadHeaders: Record<string, string> = {}
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken')
        if (token) uploadHeaders['Authorization'] = `Bearer ${token}`
      }
      const uploadRes = await fetch('/api/upload', { method: 'POST', headers: uploadHeaders, body: formData })
      const uploadData = await uploadRes.json()
      if (uploadData.success) {
        setNewBannerImageUrl(uploadData.url)
        showToast('Gambar berhasil diupload', 'success')
      } else {
        showToast(uploadData.error || 'Gagal mengupload gambar', 'error')
      }
    } catch {
      showToast('Gagal mengupload gambar', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleToggleActive = async (bannerId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ bannerId, isActive: !isActive }),
      })
      const data = await res.json()
      if (data.success) {
        fetchAdminBanners()
        showToast(!isActive ? "Banner diaktifkan" : "Banner dinonaktifkan", "success")
      } else {
        showToast(data.error || "Gagal mengubah status banner", "error")
      }
    } catch {
      showToast("Gagal mengubah status banner", "error")
    }
  }

  const handleDeleteBanner = async (bannerId: string) => {
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'DELETE',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ bannerId }),
      })
      const data = await res.json()
      if (data.success) {
        fetchAdminBanners()
        showToast('Banner berhasil dihapus', 'success')
      } else {
        showToast(data.error || 'Gagal menghapus banner', 'error')
      }
    } catch {
      showToast('Gagal menghapus banner', 'error')
    }
  }

  const handleAddBanner = async () => {
    if (!newBannerTitle || !newBannerPosition) {
      showToast('Judul dan posisi wajib diisi', 'error')
      return
    }
    if (!newBannerImageUrl) {
      showToast('Gambar banner wajib diisi', 'error')
      return
    }

    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: newBannerTitle,
        image: newBannerImageUrl,
        position: newBannerPosition,
        isActive: true,
        sortOrder: newBannerSortOrder,
      }
      if (newBannerLink) body.link = newBannerLink
      if (newBannerStartDate) body.startDate = newBannerStartDate
      if (newBannerEndDate) body.endDate = newBannerEndDate

      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Banner berhasil ditambahkan', 'success')
        setNewBannerTitle('')
        setNewBannerPosition('home_top')
        setNewBannerImageUrl('')
        setNewBannerLink('')
        setNewBannerSortOrder(0)
        setNewBannerStartDate('')
        setNewBannerEndDate('')
        setShowAdd(false)
        fetchAdminBanners()
      } else {
        showToast(data.error || 'Gagal menambahkan banner', 'error')
      }
    } catch {
      showToast('Gagal menambahkan banner', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const getPositionLabel = (position: string) => {
    const found = BANNER_POSITIONS.find(p => p.value === position)
    return found ? found.label : position
  }

  if (isLoading) return <div className="pb-20"><PageHeader title="Kelola Banner" /><LoadingSpinner message="Memuat banner..." /></div>

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
            {adminBanners.length === 0 ? (
              <EmptyState icon={<ImageIcon className="w-12 h-12" />} title="Belum ada banner" subtitle="Tambahkan banner baru untuk ditampilkan di aplikasi" />
            ) : (
              adminBanners.map((banner, i) => (
                <motion.div key={banner.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {banner.image ? (
                          <img src={banner.image} alt={banner.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-emerald-400 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{banner.title}</p>
                          <p className="text-xs text-muted-foreground">{getPositionLabel(banner.position)}</p>
                          {banner.sortOrder > 0 && (
                            <p className="text-[10px] text-muted-foreground">Urutan: {banner.sortOrder}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={banner.isActive} onCheckedChange={() => handleToggleActive(banner.id, banner.isActive)} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setConfirmAction({
                            action: () => handleDeleteBanner(banner.id),
                            title: 'Hapus Banner',
                            message: `Apakah Anda yakin ingin menghapus "${banner.title}"? Tindakan ini tidak dapat dibatalkan.`
                          })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Add New Banner Form */}
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <SectionHeader title="Tambah Banner Baru" icon={<Plus className="w-4 h-4" />} />
            <Card className="mt-3 p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Judul Banner</label>
                <Input value={newBannerTitle} onChange={(e) => setNewBannerTitle(e.target.value)} placeholder="Contoh: Flash Sale Weekend" className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Posisi</label>
                <select
                  value={newBannerPosition}
                  onChange={(e) => setNewBannerPosition(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {BANNER_POSITIONS.map((pos) => (
                    <option key={pos.value} value={pos.value}>{pos.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Gambar Banner</label>
                <div className="flex gap-2">
                  <Input value={newBannerImageUrl} onChange={(e) => setNewBannerImageUrl(e.target.value)} placeholder="https://example.com/banner.jpg" className="rounded-xl flex-1" />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl h-10 px-3 flex-shrink-0"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {newBannerImageUrl && (
                  <div className="h-28 rounded-xl overflow-hidden bg-muted">
                    <img src={newBannerImageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Link (Opsional)</label>
                <Input value={newBannerLink} onChange={(e) => setNewBannerLink(e.target.value)} placeholder="https://..." className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Urutan Sortir</label>
                <Input
                  type="number"
                  value={newBannerSortOrder}
                  onChange={(e) => setNewBannerSortOrder(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="rounded-xl"
                  min={0}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Tanggal Mulai</label>
                  <Input
                    type="date"
                    value={newBannerStartDate}
                    onChange={(e) => setNewBannerStartDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Tanggal Berakhir</label>
                  <Input
                    type="date"
                    value={newBannerEndDate}
                    onChange={(e) => setNewBannerEndDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
                disabled={isSaving}
                onClick={handleAddBanner}
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Menyimpan...
                  </div>
                ) : (
                  'Simpan Banner'
                )}
              </Button>
            </Card>
          </motion.div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
      />
    </div>
  )
}

// ==================== ADMIN ANALYTICS ====================
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

  if (isLoading) return <div className="pb-20"><PageHeader title="Analitik Lengkap" /><LoadingSpinner message="Memuat analitik..." /></div>

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
    </div>
  )
}

// ==================== ADMIN COMPLAINTS ====================
export function AdminComplaints() {
  const { showToast, adminComplaints, updateAdminComplaint, fetchAdminComplaints } = useAppStore()
  const [activeTab, setActiveTab] = useState("open")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAdminComplaints().finally(() => setIsLoading(false))
  }, [fetchAdminComplaints])

  const filtered = activeTab === "all"
    ? adminComplaints
    : adminComplaints.filter(c => c.status === activeTab)

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
    rejected: "border-red-300 text-red-600",
  }

  if (isLoading) return <div className="pb-20"><PageHeader title="Keluhan" /><LoadingSpinner message="Memuat keluhan..." /></div>

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
            { key: "rejected", label: "Ditolak" },
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
                      <p className="text-xs font-medium text-foreground">{complaint.buyer || complaint.userName}</p>
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
                        <Button size="sm" className="h-7 text-[11px] rounded-lg bg-amber-500 hover:bg-amber-600 text-white" onClick={() => {
                          updateAdminComplaint(complaint.id, { status: "processing" })
                          showToast("Keluhan sedang diproses", "info")
                        }}>
                          <Clock className="w-3 h-3 mr-0.5" /> Proses
                        </Button>
                      )}
                      <Button size="sm" className="h-7 text-[11px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
                        updateAdminComplaint(complaint.id, { status: "resolved" })
                        showToast("Keluhan diselesaikan", "success")
                      }}>
                        <Check className="w-3 h-3 mr-0.5" /> Resolve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg text-red-500" onClick={() => {
                        updateAdminComplaint(complaint.id, { status: "rejected" })
                        showToast("Keluhan ditolak", "info")
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

// ==================== ADMIN REVIEWS ====================
interface AdminReviewItem {
  id: string
  userId: string
  productId: string
  rating: number
  content: string | null
  images: unknown[]
  sellerReply: string | null
  sellerReplyAt: string | null
  isHidden: boolean
  createdAt: string
  user: { id: string; name: string; avatar: string | null; email: string }
  product: { id: string; name: string; seller: { id: string; storeName: string } }
}

export function AdminReviews() {
  const { showToast } = useAppStore()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [adminReviews, setAdminReviews] = useState<AdminReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string } | null>(null)

  const fetchAdminReviews = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      params.set("limit", "200")
      const res = await fetch(`/api/admin/reviews?${params.toString()}`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setAdminReviews(data.data || [])
      } else {
        showToast(data.error || "Gagal memuat reviews", "error")
      }
    } catch {
      showToast("Gagal memuat reviews", "error")
    } finally {
      setLoading(false)
    }
  }, [showToast, statusFilter])

  useEffect(() => {
    fetchAdminReviews()
  }, [fetchAdminReviews])

  const handleToggleHidden = async (reviewId: string, currentHidden: boolean) => {
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ reviewId, isHidden: !currentHidden }),
      })
      const data = await res.json()
      if (data.success) {
        setAdminReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, isHidden: !currentHidden } : r))
        )
        showToast(!currentHidden ? "Review disembunyikan" : "Review ditampilkan kembali", "success")
      } else {
        showToast(data.error || "Gagal mengubah status review", "error")
      }
    } catch {
      showToast("Gagal mengubah status review", "error")
    }
  }

  const handleDelete = async (reviewId: string) => {
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "DELETE",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ reviewId }),
      })
      const data = await res.json()
      if (data.success) {
        setAdminReviews((prev) => prev.filter((r) => r.id !== reviewId))
        showToast("Review dihapus", "info")
      } else {
        showToast(data.error || "Gagal menghapus review", "error")
      }
    } catch {
      showToast("Gagal menghapus review", "error")
    }
  }

  const filtered = adminReviews.filter((r) => {
    const matchesSearch =
      r.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (r.content || "").toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  const hiddenCount = adminReviews.filter((r) => r.isHidden).length

  if (loading) return <div className="pb-20"><PageHeader title="Moderasi Review" /><LoadingSpinner message="Memuat reviews..." /></div>

  return (
    <div className="pb-20">
      <PageHeader title="Moderasi Review" />

      <div className="px-4 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari review, user, atau produk..." />

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: `Semua (${adminReviews.length})` },
            { key: "visible", label: `Terlihat (${adminReviews.length - hiddenCount})` },
            { key: "hidden", label: `Tersembunyi (${hiddenCount})` },
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

        {/* Review List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Star className="w-10 h-10 text-muted-foreground" />}
              title="Review Tidak Ditemukan"
              subtitle="Coba kata kunci lain"
            />
          ) : (
            filtered.map((review, i) => (
              <motion.div key={review.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className={`p-3 ${review.isHidden ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                      {review.user?.name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{review.user?.name || "Unknown"}</p>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3 h-3 ${idx < review.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                        {review.isHidden && (
                          <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600">Tersembunyi</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Produk: {review.product?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Toko: {review.product?.seller?.storeName || "Unknown"}</p>
                      {review.content && (
                        <p className="text-xs text-foreground mt-1 line-clamp-2">{review.content}</p>
                      )}
                      {review.sellerReply && (
                        <div className="mt-1.5 pl-2 border-l-2 border-emerald-300 dark:border-emerald-700">
                          <p className="text-[10px] text-emerald-600 font-medium">Balasan Penjual:</p>
                          <p className="text-xs text-foreground line-clamp-2">{review.sellerReply}</p>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(review.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-7 text-[11px] rounded-lg ${review.isHidden ? "text-emerald-600" : "text-amber-600"}`}
                      onClick={() => handleToggleHidden(review.id, review.isHidden)}
                    >
                      {review.isHidden ? (
                        <><Eye className="w-3 h-3 mr-0.5" /> Tampilkan</>
                      ) : (
                        <><Eye className="w-3 h-3 mr-0.5" /> Sembunyikan</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() =>
                        setConfirmAction({
                          action: () => handleDelete(review.id),
                          title: "Hapus Review",
                          message: `Apakah Anda yakin ingin menghapus review dari ${review.user?.name || "Unknown"}? Tindakan ini tidak dapat dibatalkan.`,
                        })
                      }
                    >
                      <Trash2 className="w-3 h-3 mr-0.5" /> Hapus
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.action()}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
      />
    </div>
  )
}
