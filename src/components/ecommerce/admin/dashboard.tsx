"use client"

import { motion } from "framer-motion"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line
} from "recharts"
import {
  Users, DollarSign, Package, Box, Bell, Settings,
  Check, AlertTriangle,
  TrendingUp, Megaphone, ImageIcon, BarChart3, MessageSquare,
  Building2, Tag, Wallet,
  ClipboardList, Shield, Store, Clock, Eye, Star, FolderTree
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, SectionHeader } from "../shared"
import { useState, useRef, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import { LoadingSpinner } from "../loading-spinner"
import { ELEVATED_ROLES } from "@/lib/types"

export function AdminDashboard() {
  const { navigate, switchRole, userRole, currentUser, originalRole, showToast, withdrawRequests, products, orders, adminUsers, adminStats, fetchAdminStats, fetchAdminUsers, fetchAdminWithdrawals, fetchDivisions, divisions } = useAppStore()

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
    totalStaff: adminStats.totalStaff ?? adminUsers.filter(u => ELEVATED_ROLES.includes(u.role as import('@/lib/types').UserRole)).length,
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
            {['admin', 'manager'].includes(originalRole || '') && (
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
