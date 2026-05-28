"use client"

import { motion } from "framer-motion"
import { Star, ChevronRight, Store, Check, Plus, DollarSign, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { SellerBadge } from "./display"

// ==================== CATEGORY PILL ====================
interface CategoryPillProps {
  id: string
  name: string
  icon?: string
  isActive?: boolean
  onClick?: () => void
}

export function CategoryPill({ name, icon, isActive, onClick }: CategoryPillProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
        isActive
          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
          : "bg-card text-foreground border-border hover:bg-muted"
      }`}
    >
      {icon && <span className="text-base">{icon}</span>}
      <span>{name}</span>
    </motion.button>
  )
}

// ==================== CATEGORY PILL LIST ====================
interface CategoryPillListProps {
  categories: { id: string; name: string; icon?: string }[]
  activeId?: string | null
  onSelect?: (id: string) => void
}

export function CategoryPillList({ categories, activeId, onSelect }: CategoryPillListProps) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
      <CategoryPill
        id="all"
        name="Semua"
        icon="🏷️"
        isActive={!activeId}
        onClick={() => onSelect?.("")}
      />
      {categories.map((cat) => (
        <CategoryPill
          key={cat.id}
          id={cat.id}
          name={cat.name}
          icon={cat.icon}
          isActive={activeId === cat.id}
          onClick={() => onSelect?.(cat.id)}
        />
      ))}
    </div>
  )
}

// ==================== VOUCHER CARD ====================
interface VoucherCardProps {
  code: string
  name: string
  description?: string
  validUntil: string
  isActive?: boolean
  isClaimed?: boolean
  onClaim?: () => void
}

export function VoucherCard({
  code,
  name,
  description,
  validUntil,
  isActive = true,
  isClaimed = false,
  onClaim,
}: VoucherCardProps) {
  return (
    <div className="relative flex overflow-hidden rounded-xl border border-border bg-card">
      {/* Left accent */}
      <div className="w-1.5 bg-emerald-500 flex-shrink-0" />
      {/* Content */}
      <div className="flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-foreground">{name}</h4>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <Badge variant="outline" className="text-[9px] font-bold text-emerald-600 border-emerald-200 dark:border-emerald-800">
            {code}
          </Badge>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-muted-foreground">
            s/d {new Date(validUntil).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {onClaim && !isClaimed && isActive && (
            <Button
              size="sm"
              onClick={onClaim}
              className="h-7 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Pakai
            </Button>
          )}
          {isClaimed && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" />
              Digunakan
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== WALLET BALANCE CARD ====================
interface WalletBalanceCardProps {
  balance: number
  coins: number
  onTopUp?: () => void
  onWithdraw?: () => void
}

export function WalletBalanceCard({ balance, coins, onTopUp, onWithdraw }: WalletBalanceCardProps) {
  return (
    <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium opacity-90">Saldo MartPay</span>
        <DollarSign className="w-5 h-5 opacity-70" />
      </div>
      <p className="text-2xl font-bold mb-1">{formatPrice(balance)}</p>
      <div className="flex items-center gap-1 text-xs opacity-80 mb-4">
        <Gift className="w-3.5 h-3.5" />
        <span>{coins} Koin</span>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onTopUp}
          className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl backdrop-blur-sm"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Top Up
        </Button>
        <Button
          size="sm"
          onClick={onWithdraw}
          variant="outline"
          className="flex-1 bg-transparent hover:bg-white/10 text-white border-white/30 rounded-xl"
        >
          Tarik
        </Button>
      </div>
    </div>
  )
}

// ==================== STORE CARD ====================
interface StoreCardProps {
  storeName: string
  storeAvatar?: string
  isVerified?: boolean
  isPremium?: boolean
  rating: number
  totalSales: number
  totalProducts: number
  onClick?: () => void
}

export function StoreCard({
  storeName,
  storeAvatar,
  isVerified,
  isPremium,
  rating,
  totalSales,
  totalProducts,
  onClick,
}: StoreCardProps) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 cursor-pointer"
    >
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {storeAvatar ? (
          <img src={storeAvatar} alt={storeName} className="w-full h-full object-cover" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; if (img.nextElementSibling) (img.nextElementSibling as HTMLElement).style.display = 'flex' }} />
        ) : null}
        <div className="w-full h-full items-center justify-center" style={{ display: storeAvatar ? 'none' : 'flex' }}>
          <Store className="w-6 h-6 text-muted-foreground" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-sm font-medium text-foreground truncate">{storeName}</h4>
          <SellerBadge isVerified={isVerified} isPremium={isPremium} size="sm" />
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {rating}
          </span>
          <span>{totalSales.toLocaleString()} terjual</span>
          <span>{totalProducts} produk</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </motion.div>
  )
}
