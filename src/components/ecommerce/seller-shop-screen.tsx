"use client"

import { motion } from "framer-motion"
import {
  Star, MapPin, Clock, Check, Award, MessageCircle, ChevronRight,
  ShoppingBag, Store, Users, TrendingUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/lib/store"
import { MOCK_PRODUCTS, formatPrice } from "@/lib/mock-data"
import {
  PageHeader, ProductCard, RatingStars, AvatarWithName, SellerBadge,
  EmptyState, CategoryPillList
} from "./shared"
import type { Product } from "@/lib/types"
import { useState, useMemo, useCallback } from "react"

// ==================== MAIN COMPONENT ====================
export function SellerShopScreen() {
  const { selectedSellerId, navigate, setSelectedProduct } = useAppStore()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "price-low" | "price-high">("popular")

  // Find all products for the selected seller
  const sellerProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter(p => p.sellerId === selectedSellerId)
  }, [selectedSellerId])

  // Get seller info from first product
  const seller = sellerProducts.length > 0 ? sellerProducts[0].seller : null

  // Get unique categories from seller's products
  const categories = useMemo(() => {
    const catMap = new Map<string, { id: string; name: string; icon?: string }>()
    sellerProducts.forEach(p => {
      if (!catMap.has(p.categoryId)) {
        catMap.set(p.categoryId, { id: p.categoryId, name: p.category.name })
      }
    })
    return Array.from(catMap.values())
  }, [sellerProducts])

  // Filter and sort products
  const displayProducts = useMemo(() => {
    let filtered = activeCategory
      ? sellerProducts.filter(p => p.categoryId === activeCategory)
      : sellerProducts

    switch (sortBy) {
      case "price-low":
        return [...filtered].sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price))
      case "price-high":
        return [...filtered].sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price))
      case "newest":
        return [...filtered]
      case "popular":
      default:
        return [...filtered].sort((a, b) => b.sold - a.sold)
    }
  }, [sellerProducts, activeCategory, sortBy])

  const handleBack = useCallback(() => {
    navigate('home')
  }, [navigate])

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product.id)
    navigate('product-detail')
  }, [setSelectedProduct, navigate])

  if (!seller) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Toko" onBack={handleBack} />
        <EmptyState
          icon={<Store className="w-10 h-10 text-muted-foreground" />}
          title="Toko Tidak Ditemukan"
          subtitle="Toko yang kamu cari tidak tersedia"
          actionLabel="Kembali ke Home"
          onAction={handleBack}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Toko" onBack={handleBack} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Store Banner */}
        <div className="relative h-32 bg-gradient-to-r from-emerald-500 to-emerald-700 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-50" />
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Store Info */}
        <div className="px-4 -mt-10 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-end gap-3">
              <AvatarWithName
                name={seller.storeName}
                avatarUrl={seller.storeAvatar}
                size="lg"
                isVerified={seller.isVerified}
              />
            </div>

            <div className="flex items-center gap-2">
              <SellerBadge
                isVerified={seller.isVerified}
                isPremium={seller.isPremium}
                size="md"
              />
            </div>

            {/* Store stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">{seller.rating}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" />
                <span>{seller.totalSales.toLocaleString()} terjual</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{seller.totalProducts} produk</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs rounded-lg border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Follow
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs rounded-lg"
                onClick={() => navigate('chat-room')}
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1" />
                Chat
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="px-4 mt-4">
          <Separator />
        </div>

        {/* Category pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="px-4 py-3"
        >
          <CategoryPillList
            categories={categories}
            activeId={activeCategory}
            onSelect={(id) => setActiveCategory(id || null)}
          />
        </motion.div>

        {/* Sort bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-4 pb-3"
        >
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { key: "popular" as const, label: "Terlaris" },
              { key: "newest" as const, label: "Terbaru" },
              { key: "price-low" as const, label: "Harga ↓" },
              { key: "price-high" as const, label: "Harga ↑" },
            ].map((sort) => (
              <button
                key={sort.key}
                onClick={() => setSortBy(sort.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  sortBy === sort.key
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {sort.label}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-auto">
              {displayProducts.length} produk
            </span>
          </div>
        </motion.div>

        {/* Product grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="px-4"
        >
          {displayProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {displayProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => handleProductClick(product)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ShoppingBag className="w-10 h-10 text-muted-foreground" />}
              title="Belum Ada Produk"
              subtitle="Toko ini belum memiliki produk di kategori ini"
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
