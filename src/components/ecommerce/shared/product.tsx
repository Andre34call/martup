"use client"

import { motion } from "framer-motion"
import { Heart, Star, Zap, Truck, Shield, RotateCcw } from "lucide-react"
import { useWishlistStore } from "@/lib/store"
import type { Product } from "@/lib/types"
import { useState } from "react"
import { PriceDisplay } from "./display"

// ==================== SAFE IMAGE (with broken image fallback) ====================
function SafeImage({ src, alt, className, fallbackChar }: {
  src: string
  alt: string
  className?: string
  fallbackChar?: string
}) {
  const [imgError, setImgError] = useState(false)

  // Validate URL - reject blob:, data: (large), and empty URLs
  const isValidUrl = !(!src || src.startsWith('blob:') || src.startsWith('data:text'))

  if (!isValidUrl || imgError) {
    const char = fallbackChar || alt?.charAt(0) || '?'
    const colors = [
      "bg-emerald-100 dark:bg-emerald-900/30",
      "bg-orange-100 dark:bg-orange-900/30",
      "bg-pink-100 dark:bg-pink-900/30",
      "bg-violet-100 dark:bg-violet-900/30",
      "bg-cyan-100 dark:bg-cyan-900/30",
      "bg-amber-100 dark:bg-amber-900/30",
    ]
    const colorIndex = alt ? alt.charCodeAt(0) % colors.length : 0
    return (
      <div className={`${className} flex items-center justify-center ${colors[colorIndex]}`}>
        <span className="text-3xl font-bold text-emerald-600/70">{char.toUpperCase()}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setImgError(true)}
      loading="lazy"
    />
  )
}

// ==================== PRODUCT CARD ====================
interface ProductCardProps {
  product: Product
  onClick?: () => void
  layout?: "grid" | "list"
}

export function ProductCard({ product, onClick, layout = "grid" }: ProductCardProps) {
  const { toggleWishlist, isWishlisted } = useWishlistStore()
  const wishlisted = isWishlisted(product.id)
  const discountPercent = product.discountPrice
    ? (product.price > 0 ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0)
    : 0

  const colors = [
    "bg-emerald-100 dark:bg-emerald-900/30",
    "bg-orange-100 dark:bg-orange-900/30",
    "bg-pink-100 dark:bg-pink-900/30",
    "bg-violet-100 dark:bg-violet-900/30",
    "bg-cyan-100 dark:bg-cyan-900/30",
    "bg-amber-100 dark:bg-amber-900/30",
  ]
  const colorIndex = product.id.charCodeAt(0) % colors.length

  if (layout === "list") {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        className="flex gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm cursor-pointer"
      >
        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
          {product.images && product.images.length > 0 && !product.images[0].startsWith('blob:') ? (
            <SafeImage
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
              fallbackChar={product.name.charAt(0)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${colors[colorIndex]}`}>
              <span className="text-2xl font-bold text-emerald-600">
                {product.name.charAt(0)}
              </span>
            </div>
          )}
          {product.isFlashSale && (
            <div className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" />
              FLASH
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium line-clamp-2 leading-tight">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{product.seller.storeName}</p>
          </div>
          <div className="flex items-end justify-between">
            <PriceDisplay
              price={product.price}
              discountPrice={product.discountPrice}
              size="sm"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span>·</span>
              <span>{product.sold} terjual</span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden cursor-pointer"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        {product.images && product.images.length > 0 && !product.images[0].startsWith('blob:') ? (
          <SafeImage
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover image-zoom"
            fallbackChar={product.name.charAt(0)}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${colors[colorIndex]}`}>
            <span className="text-4xl font-bold text-emerald-600/70">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Discount badge */}
        {discountPercent > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            -{discountPercent}%
          </div>
        )}

        {/* Flash sale badge */}
        {product.isFlashSale && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shimmer">
            <Zap className="w-2.5 h-2.5" />
            FLASH
          </div>
        )}

        {/* Wishlist button */}
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={(e) => {
            e.stopPropagation()
            toggleWishlist(product.id)
          }}
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-sm"
        >
          <motion.div
            animate={wishlisted ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${
                wishlisted
                  ? "fill-red-500 text-red-500"
                  : "text-gray-500"
              }`}
            />
          </motion.div>
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-xs font-medium line-clamp-2 leading-tight min-h-[2rem]">
          {product.name}
        </h3>

        <PriceDisplay
          price={product.price}
          discountPrice={product.discountPrice}
          size="sm"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            <span>{product.rating}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {product.sold > 1000 ? `${(product.sold / 1000).toFixed(1)}rb` : product.sold} terjual
          </span>
        </div>

        <p className="text-[10px] text-muted-foreground truncate">
          {product.seller.storeName}
        </p>
      </div>
    </motion.div>
  )
}

// ==================== FEATURE CHIP ====================
interface FeatureChipProps {
  icon: React.ReactNode
  label: string
}

export function FeatureChip({ icon, label }: FeatureChipProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  )
}

// ==================== PRODUCT FEATURES (shipping guarantees) ====================
export function ProductGuarantees() {
  return (
    <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-xl">
      <FeatureChip
        icon={<Truck className="w-4 h-4 text-emerald-500" />}
        label="Gratis Ongkir"
      />
      <FeatureChip
        icon={<Shield className="w-4 h-4 text-emerald-500" />}
        label="Garansi 7 Hari"
      />
      <FeatureChip
        icon={<RotateCcw className="w-4 h-4 text-emerald-500" />}
        label="Bisa Return"
      />
    </div>
  )
}

// ==================== PRODUCT CARD SKELETON ====================
export function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden animate-pulse">
      <div className="aspect-square bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    </div>
  )
}
