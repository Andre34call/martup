"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { PageHeader, SectionHeader, RoleBadge } from "./shared"
import { useState, useMemo, useRef } from "react"
import { useTheme } from 'next-themes'
import {
  ArrowLeft, User, Edit, Wallet, Coins, Ticket, Package, Truck,
  Star, MapPin, Heart, Store, HelpCircle, Settings as SettingsIcon,
  Shield, Bell, Globe, ChevronRight, LogOut, Moon, Sun,
  CreditCard, Clock, Check, Store as StoreIcon, LayoutDashboard,
  Camera, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

// Default values for unauthenticated users — NOT a mock, just sensible defaults
const DEFAULT_USER_VALUES = {
  name: "New Member",
  email: "",
  memberSince: new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
}

// ==================== MENU ITEM ====================
function MenuItem({
  icon,
  label,
  value,
  badge,
  onClick,
  iconColor = "text-emerald-500",
}: {
  icon: React.ReactNode
  label: string
  value?: string
  badge?: number
  onClick?: () => void
  iconColor?: string
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/30 transition-colors"
    >
      <div className={`w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        {icon}
      </div>
      <span className="flex-1 text-left text-sm text-foreground">{label}</span>
      {value && (
        <span className="text-xs text-muted-foreground mr-1">{value}</span>
      )}
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 mr-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </motion.button>
  )
}

// ==================== PROFILE SCREEN ====================
export function ProfileScreen() {
  const { currentUser, userRole, switchRole, orders, navigate, logout, showToast, avatarUrl, updateAvatar, walletBalance, walletCoins, vouchers } = useAppStore()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      showToast("File harus berupa gambar", "error")
      return
    }
    const url = URL.createObjectURL(file)
    updateAvatar(url)
    showToast("Foto profil berhasil diperbarui!", "success")
    e.target.value = ""
  }
  const { theme, setTheme } = useTheme()
  const isDarkMode = theme === 'dark'

  const userName = currentUser?.name || DEFAULT_USER_VALUES.name
  const userEmail = currentUser?.email || DEFAULT_USER_VALUES.email
  const memberSince = currentUser?.id
    ? new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
    : DEFAULT_USER_VALUES.memberSince

  // Count orders by status
  const orderCounts = useMemo(() => ({
    pending: orders.filter((o) => o.status === "pending").length,
    processing: orders.filter((o) => ["paid", "processing"].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  }), [orders])

  const handleDarkModeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light')
  }

  const handleRoleSwitch = async (role: string) => {
    showToast(role === 'seller' ? "Mempersiapkan mode Seller..." : `Beralih ke mode ${role}`, "info")
    try {
      await switchRole(role as import('@/lib/types').UserRole)
    } catch {
      showToast("Gagal beralih role", "error")
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Profil"
        showBack={false}
        rightAction={
          <button
            onClick={() => navigate("settings")}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <SettingsIcon className="w-5 h-5 text-muted-foreground" />
          </button>
        }
      />

      <div className="flex-1 pb-20 overflow-y-auto">
        {/* Profile Header */}
        <div className="px-4 pt-2 pb-4">
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative group"
                >
                  {avatarUrl ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden shadow-md ring-2 ring-emerald-500/30">
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold flex items-center justify-center text-xl shadow-md">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-card">
                    <Camera className="w-2.5 h-2.5 text-white" />
                  </div>
                </motion.button>
                <div className="absolute -bottom-1 -right-1">
                  <RoleBadge role={userRole} size="sm" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground">{userName}</h2>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Member sejak {memberSince}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4 h-9 rounded-xl text-xs font-medium"
              onClick={() => navigate("settings")}
            >
              <Edit className="w-3.5 h-3.5 mr-1.5" />
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("wallet")}
              className="bg-card rounded-xl border border-border/50 p-3 text-center"
            >
              <p className="text-sm font-bold text-emerald-600">{formatPrice(walletBalance)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Saldo</p>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("wallet")}
              className="bg-card rounded-xl border border-border/50 p-3 text-center"
            >
              <p className="text-sm font-bold text-amber-500">{walletCoins.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Koin</p>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("voucher")}
              className="bg-card rounded-xl border border-border/50 p-3 text-center"
            >
              <p className="text-sm font-bold text-orange-500">{vouchers.filter(v => v.isActive).length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Kupon</p>
            </motion.button>
          </div>
        </div>

        {/* Pesanan Section */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">Pesanan</h3>
              <button
                onClick={() => navigate("orders")}
                className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"
              >
                Lihat Semua
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("orders")}
                className="flex flex-col items-center gap-1.5 py-2"
              >
                <div className="relative">
                  <CreditCard className="w-6 h-6 text-amber-500" />
                  {orderCounts.pending > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5">
                      {orderCounts.pending}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">Belum Bayar</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("orders")}
                className="flex flex-col items-center gap-1.5 py-2"
              >
                <div className="relative">
                  <Package className="w-6 h-6 text-violet-500" />
                  {orderCounts.processing > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5">
                      {orderCounts.processing}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">Diproses</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("orders")}
                className="flex flex-col items-center gap-1.5 py-2"
              >
                <div className="relative">
                  <Truck className="w-6 h-6 text-cyan-500" />
                  {orderCounts.shipped > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5">
                      {orderCounts.shipped}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">Dikirim</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("orders")}
                className="flex flex-col items-center gap-1.5 py-2"
              >
                <div className="relative">
                  <Star className="w-6 h-6 text-emerald-500" />
                  {orderCounts.delivered > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5">
                      {orderCounts.delivered}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">Review</span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Layanan Section */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-bold text-foreground mb-1">Layanan</h3>
            <MenuItem
              icon={<MapPin className="w-4 h-4" />}
              label="Alamat"
              onClick={() => navigate("address")}
            />
            <MenuItem
              icon={<Ticket className="w-4 h-4" />}
              label="Voucher Saya"
              badge={vouchers.filter(v => v.isActive).length}
              onClick={() => navigate("voucher")}
            />
            <MenuItem
              icon={<Heart className="w-4 h-4" />}
              label="Wishlist"
              onClick={() => navigate("wishlist")}
            />
            <MenuItem
              icon={<Store className="w-4 h-4" />}
              label="Toko Favorit"
              onClick={() => navigate("followed-stores")}
            />
            <MenuItem
              icon={<HelpCircle className="w-4 h-4" />}
              label="Bantuan"
              onClick={() => navigate("help")}
            />
          </div>
        </div>

        {/* Pengaturan Section */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <h3 className="text-sm font-bold text-foreground mb-1">Pengaturan</h3>
            <MenuItem
              icon={<SettingsIcon className="w-4 h-4" />}
              label="Pengaturan"
              onClick={() => navigate("settings")}
            />
            <MenuItem
              icon={<Shield className="w-4 h-4" />}
              label="Keamanan"
              onClick={() => { navigate("settings"); showToast("Halaman keamanan", "info") }}
            />
            <MenuItem
              icon={<Bell className="w-4 h-4" />}
              label="Notifikasi"
              onClick={() => navigate("notification")}
            />
            <MenuItem
              icon={<Globe className="w-4 h-4" />}
              label="Bahasa"
              value="Indonesia"
              onClick={() => showToast("Fitur bahasa segera hadir!", "info")}
            />
          </div>
        </div>

        {/* Dark Mode Toggle */}
        <div className="px-4 pb-4">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  {isDarkMode ? (
                    <Moon className="w-4 h-4 text-violet-500" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                </div>
                <span className="text-sm text-foreground">Mode Gelap</span>
              </div>
              <Switch
                checked={isDarkMode}
                onCheckedChange={handleDarkModeToggle}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Bisnis Section */}
        <div className="px-4 pb-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleRoleSwitch("seller")}
            className="w-full"
          >
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 text-white text-left shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <StoreIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Jual di MartUp</p>
                  <p className="text-xs opacity-90 mt-0.5">Mulai berjualan dan raih penghasilan</p>
                </div>
                <ChevronRight className="w-5 h-5 opacity-70" />
              </div>
            </div>
          </motion.button>
        </div>

        {/* Admin Panel - Only show if user is actually an admin */}
        {currentUser?.role === 'admin' && (
          <div className="px-4 pb-4">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => handleRoleSwitch("admin")}
              className="w-full"
            >
              <div className="bg-gradient-to-r from-purple-600 to-violet-600 rounded-xl p-4 text-white text-left shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">Admin Panel</p>
                    <p className="text-xs opacity-90 mt-0.5">Kelola platform MartUp</p>
                  </div>
                  <ChevronRight className="w-5 h-5 opacity-70" />
                </div>
              </div>
            </motion.button>
          </div>
        )}

        {/* Role Switcher — Hidden in production; only visible in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="px-4 pb-4">
            <div className="bg-card rounded-xl border border-border/50 p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Switch Role (Dev Only)</h3>
              <div className="flex gap-2">
                {(["buyer", "seller", ...(currentUser?.role === 'admin' ? ["admin" as const] : [])] as const).map((role) => {
                  const roleIcons = { buyer: User, seller: Store, admin: LayoutDashboard }
                  const RoleIcon = roleIcons[role]
                  const roleColors = {
                    buyer: userRole === "buyer" ? "bg-emerald-500 text-white border-emerald-500" : "bg-muted text-muted-foreground border-border",
                    seller: userRole === "seller" ? "bg-orange-500 text-white border-orange-500" : "bg-muted text-muted-foreground border-border",
                    admin: userRole === "admin" ? "bg-purple-500 text-white border-purple-500" : "bg-muted text-muted-foreground border-border",
                  }
                  return (
                    <motion.button
                      key={role}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRoleSwitch(role)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${roleColors[role]}`}
                    >
                      <RoleIcon className="w-4 h-4" />
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                      {userRole === role && <Check className="w-3.5 h-3.5" />}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <div className="px-4 pb-8">
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Keluar
          </Button>
        </div>
      </div>
    </div>
  )
}
