"use client"

import { Star, Check, Award } from "lucide-react"
import { motion } from "framer-motion"
import { formatPrice } from "@/lib/utils"
import type { OrderStatus } from "@/lib/types"

// ==================== PRICE DISPLAY ====================
interface PriceDisplayProps {
  price: number
  discountPrice?: number
  size?: "sm" | "md" | "lg"
  showDiscount?: boolean
}

export function PriceDisplay({
  price,
  discountPrice,
  size = "md",
  showDiscount = true,
}: PriceDisplayProps) {
  const sizeMap = {
    sm: { main: "text-xs", original: "text-[10px]" },
    md: { main: "text-sm", original: "text-xs" },
    lg: { main: "text-lg", original: "text-sm" },
  }

  const discountPercent =
    discountPrice && showDiscount
      ? Math.round(((price - discountPrice) / price) * 100)
      : 0

  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className={`${sizeMap[size].main} font-bold text-emerald-600`}>
        {formatPrice(discountPrice || price)}
      </span>
      {discountPrice && showDiscount && (
        <>
          <span className={`${sizeMap[size].original} text-muted-foreground line-through`}>
            {formatPrice(price)}
          </span>
          {discountPercent > 0 && (
            <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1 py-0.5 rounded">
              -{discountPercent}%
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ==================== RATING STARS ====================
interface RatingStarsProps {
  rating: number
  maxRating?: number
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  reviewCount?: number
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = "sm",
  showValue = true,
  reviewCount,
}: RatingStarsProps) {
  const sizeMap = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }
  const textSizeMap = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxRating }).map((_, i) => {
          const filled = rating >= i + 1
          const halfFilled = !filled && rating >= i + 0.5

          return (
            <span key={i} className="relative">
              <Star
                className={`${sizeMap[size]} text-gray-300 dark:text-gray-600`}
              />
              {(filled || halfFilled) && (
                <Star
                  className={`${sizeMap[size]} absolute inset-0 fill-amber-400 text-amber-400`}
                  style={
                    halfFilled
                      ? { clipPath: "inset(0 50% 0 0)" }
                      : undefined
                  }
                />
              )}
            </span>
          )
        })}
      </div>
      {showValue && (
        <span className={`${textSizeMap[size]} font-medium text-foreground`}>
          {rating.toFixed(1)}
        </span>
      )}
      {reviewCount !== undefined && (
        <span className={`${textSizeMap[size]} text-muted-foreground`}>
          ({reviewCount.toLocaleString()})
        </span>
      )}
    </div>
  )
}

// ==================== STATUS BADGE ====================
interface StatusBadgeProps {
  status: OrderStatus
  size?: "sm" | "md"
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: {
    label: "Menunggu Pembayaran",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  paid: {
    label: "Dibayar",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  processing: {
    label: "Diproses",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  shipped: {
    label: "Dikirim",
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  delivered: {
    label: "Selesai",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  refunded: {
    label: "Dikembalikan",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400",
  },
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"

  return (
    <span className={`inline-flex items-center font-medium rounded-md ${config.className} ${sizeClasses}`}>
      {config.label}
    </span>
  )
}

// ==================== ROLE BADGE ====================
interface RoleBadgeProps {
  role: string
  size?: "sm" | "md"
}

const roleConfig: Record<string, { label: string; className: string }> = {
  buyer: {
    label: "Buyer",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  seller: {
    label: "Seller",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  manager: {
    label: "Manager",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  admin: {
    label: "Admin",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
}

export function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  const config = roleConfig[role] || {
    label: role?.charAt(0).toUpperCase() + role?.slice(1) || 'User',
    className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  }
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"

  return (
    <span className={`inline-flex items-center font-medium rounded-md ${config.className} ${sizeClasses}`}>
      {config.label}
    </span>
  )
}

// ==================== SELLER BADGE ====================
interface SellerBadgeProps {
  isVerified?: boolean
  isPremium?: boolean
  size?: "sm" | "md"
}

export function SellerBadge({ isVerified, isPremium, size = "sm" }: SellerBadgeProps) {
  const sizeClasses = size === "sm" ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5"

  return (
    <div className="flex items-center gap-1">
      {isVerified && (
        <span className={`${sizeClasses} inline-flex items-center gap-0.5 font-medium rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`}>
          <Check className="w-2.5 h-2.5" />
          Verified
        </span>
      )}
      {isPremium && (
        <span className={`${sizeClasses} inline-flex items-center gap-0.5 font-medium rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`}>
          <Award className="w-2.5 h-2.5" />
          Premium
        </span>
      )}
    </div>
  )
}

// ==================== COUNTER ANIMATION ====================
interface AnimatedCounterProps {
  value: number
  format?: (v: number) => string
}

export function AnimatedCounter({ value, format }: AnimatedCounterProps) {
  return (
    <motion.span
      key={value}
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="font-bold tabular-nums"
    >
      {format ? format(value) : value}
    </motion.span>
  )
}
