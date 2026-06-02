"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Heart, MessageCircle, ShoppingCart, Star, Truck, Shield, RotateCcw,
  Zap, Check, ChevronRight, Share2, MapPin, Clock, Award, Minus, Plus, Video, Share
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useAppStore, useCartStore, useWishlistStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { SHIPPING_OPTIONS } from "@/lib/constants"
import { apiClient } from "@/lib/api-client"
import {
  PageHeader, QuantitySelector, PriceDisplay, ProductCard, EmptyState,
  FlashSaleTimer, RatingStars, AvatarWithName, SellerBadge, PrimaryButton
} from "./shared"
import type { Product, ProductVariant } from "@/lib/types"
import { useState, useRef, useCallback, useMemo, useEffect } from "react"

// Rating distribution is computed dynamically from store reviews

// ==================== IMAGE GALLERY ====================
function ImageGallery({ images, videoUrl, isFlashSale }: { images: string[]; videoUrl?: string; isFlashSale: boolean }) {
  // Build media list: video first, then images
  const mediaItems: { type: 'video' | 'image'; url: string }[] = []
  if (videoUrl) {
    mediaItems.push({ type: 'video', url: videoUrl })
  }
  images.forEach(url => {
    mediaItems.push({ type: 'image', url })
  })

  const totalItems = mediaItems.length
  const hasMedia = totalItems > 0

  const [activeIndex, setActiveIndex] = useState(0)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeIndex < totalItems - 1) {
        setActiveIndex(prev => prev + 1)
      } else if (diff < 0 && activeIndex > 0) {
        setActiveIndex(prev => prev - 1)
      }
    }
  }

  const colors = [
    "bg-emerald-100 dark:bg-emerald-900/30",
    "bg-orange-100 dark:bg-orange-900/30",
    "bg-pink-100 dark:bg-pink-900/30",
  ]

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] overflow-hidden bg-muted"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            {hasMedia && mediaItems[activeIndex] ? (
              mediaItems[activeIndex].type === 'video' ? (
                <video
                  src={mediaItems[activeIndex].url}
                  className="w-full h-full object-cover"
                  controls
                  preload="metadata"
                  playsInline
                />
              ) : (
                <img
                  src={mediaItems[activeIndex].url}
                  alt={`Product image ${activeIndex + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                  loading="lazy"
                />
              )
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${colors[activeIndex % colors.length]}`}>
                <span className="text-6xl font-bold text-emerald-600/50">P</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Flash sale overlay badge */}
        {isFlashSale && (
          <div className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shimmer">
            <Zap className="w-3.5 h-3.5" />
            FLASH SALE
          </div>
        )}

        {/* Video indicator badge */}
        {hasMedia && mediaItems[activeIndex]?.type === 'video' && (
          <div className="absolute top-3 left-3 bg-purple-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
            <Video className="w-3 h-3" />
            VIDEO
          </div>
        )}

        {/* Media counter */}
        <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
          {activeIndex + 1}/{totalItems || 1}
        </div>
      </div>

      {/* Dot indicators */}
      {totalItems > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3">
          {mediaItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`transition-all duration-300 rounded-full ${
                idx === activeIndex
                  ? item.type === 'video'
                    ? "w-6 h-2 bg-purple-500"
                    : "w-6 h-2 bg-emerald-500"
                  : item.type === 'video'
                    ? "w-2 h-2 bg-purple-300 dark:bg-purple-600"
                    : "w-2 h-2 bg-gray-300 dark:bg-gray-600"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== VARIANT SELECTOR ====================
function VariantSelector({
  variants,
  selectedVariant,
  onSelect
}: {
  variants: ProductVariant[]
  selectedVariant: ProductVariant | null
  onSelect: (variant: ProductVariant) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!variants || variants.length === 0) return null

  // Group variants by name
  const groupedVariants: Record<string, ProductVariant[]> = {}
  variants.forEach(v => {
    if (!groupedVariants[v.name]) groupedVariants[v.name] = []
    groupedVariants[v.name].push(v)
  })

  return (
    <div className="space-y-3">
      {Object.entries(groupedVariants).map(([variantName, options]) => (
        <div key={variantName}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {variantName}:
              {selectedVariant && selectedVariant.name === variantName && (
                <span className="text-emerald-600 ml-1">{selectedVariant.value}</span>
              )}
            </span>
            {options.length > 3 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"
              >
                {isExpanded ? "Sembunyikan" : `Lihat Semua (${options.length})`}
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="w-3 h-3 rotate-90" />
                </motion.div>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(isExpanded ? options : options.slice(0, 5)).map((variant) => {
              const isSelected = selectedVariant?.id === variant.id
              return (
                <motion.button
                  key={variant.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelect(variant)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm"
                      : "bg-card border-border text-foreground hover:border-emerald-300"
                  }`}
                >
                  {variant.value}
                  {variant.price && variant.price > 0 && (
                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                      +{formatPrice(variant.price)}
                    </span>
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== MAIN COMPONENT ====================
export function ProductDetailScreen() {
  const { selectedProductId, navigate, goBack, setSelectedProduct, setSelectedSeller, setSelectedChatRoom, showToast, toggleFollowStore, isFollowingStore, chatRooms, products, reviews: storeReviews, createChatRoom, fetchProductReviews, isAuthenticated, currentUser, setShareToStreamProduct } = useAppStore()
  const { addItem } = useCartStore()
  const { toggleWishlist, isWishlisted } = useWishlistStore()

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [showAddedToast, setShowAddedToast] = useState(false)
  const [showShippingModal, setShowShippingModal] = useState(false)
  const [canReview, setCanReview] = useState(false)

  const product = products.find(p => p.id === selectedProductId)

  // Fetch reviews from API when product changes
  useEffect(() => {
    if (selectedProductId) {
      fetchProductReviews(selectedProductId)
    }
  }, [selectedProductId, fetchProductReviews])

  // Check if user can review this product (only if authenticated)
  useEffect(() => {
    if (!isAuthenticated || !selectedProductId) {
      return
    }
    let cancelled = false
    apiClient.get<{ success: boolean; canReview: boolean }>('/api/reviews/can-review', { productId: selectedProductId })
      .then((data) => {
        if (!cancelled) {
          setCanReview(data.canReview || false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanReview(false)
        }
      })
    return () => { cancelled = true }
  }, [isAuthenticated, selectedProductId])

  // Reset canReview when not authenticated or no product selected
  const effectiveCanReview = isAuthenticated && selectedProductId ? canReview : false

  // Derive effective variant - if selected variant doesn't belong to current product, treat as null
  const effectiveVariant = selectedVariant && product?.variants.some(v => v.id === selectedVariant.id)
    ? selectedVariant
    : null

  const handleBack = useCallback(() => {
    setSelectedProduct(null)
    goBack()
  }, [setSelectedProduct, goBack])

  const ratingDistribution = useMemo(() => {
    const productReviews = storeReviews.filter(r => r.productId === selectedProductId)
    const total = productReviews.length || 1
    return [5, 4, 3, 2, 1].map(stars => {
      const count = productReviews.filter(r => r.rating === stars).length
      return { stars, count, percent: Math.round((count / total) * 100) }
    })
  }, [storeReviews, selectedProductId])

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Detail Produk" onBack={handleBack} />
        <EmptyState
          icon={<ShoppingCart className="w-10 h-10 text-muted-foreground" />}
          title="Produk Tidak Ditemukan"
          subtitle="Produk yang kamu cari tidak tersedia"
          actionLabel="Kembali ke Home"
          onAction={handleBack}
        />
      </div>
    )
  }

  const wishlisted = isWishlisted(product.id)
  const currentPrice = product.discountPrice || product.price
  const effectivePrice = effectiveVariant?.price
    ? currentPrice + effectiveVariant.price
    : currentPrice
  const discountPercent = product.discountPrice
    ? (product.price > 0 ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0)
    : 0

  const relatedProducts = products.filter(
    p => p.id !== product.id && p.categoryId === product.categoryId
  ).slice(0, 6)

  const handleAddToCart = () => {
    addItem(product, effectiveVariant || undefined, quantity)
    setShowAddedToast(true)
    showToast("Ditambahkan ke keranjang!", "success")
    setTimeout(() => setShowAddedToast(false), 2000)
  }

  const handleBuyNow = () => {
    addItem(product, effectiveVariant || undefined, quantity)
    // Uncheck other items, only check the newly added one for checkout
    const { items, checkAll, toggleCheck } = useCartStore.getState()
    checkAll(false)
    // Find the just-added/updated item
    const targetItem = items.find(i =>
      i.productId === product.id && i.variantId === (effectiveVariant?.id || undefined)
    )
    if (targetItem) {
      toggleCheck(targetItem.id)
    }
    navigate('checkout')
  }

  const handleRelatedClick = (p: Product) => {
    setSelectedProduct(p.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleShareToStream = () => {
    if (!isAuthenticated) {
      showToast("Silakan login terlebih dahulu", "warning")
      navigate("login")
      return
    }
    setShareToStreamProduct({
      id: product.id,
      name: product.name,
      image: product.images?.[0],
      price: product.price,
      discountPrice: product.discountPrice ?? undefined,
    })
    navigate("stream-create")
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader
        title="Detail Produk"
        onBack={handleBack}
        rightAction={
          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleShareToStream}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              title="Bagikan ke Stream"
            >
              <Share className="w-5 h-5 text-emerald-600" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: product.name, url: window.location.href }).catch(() => {})
                } else {
                  navigator.clipboard?.writeText(window.location.href)
                  showToast("Link produk disalin!", "success")
                }
              }}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('cart')}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
            </motion.button>
          </div>
        }
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* 1. Image Gallery */}
        <ImageGallery
          images={product.images}
          videoUrl={product.videoUrl}
          isFlashSale={product.isFlashSale}
        />

        <div className="px-4 space-y-4">
          {/* 2. Price Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {product.discountPrice && (
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                      -{discountPercent}%
                    </Badge>
                    {product.isFlashSale && (
                      <Badge className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Flash Sale
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600">
                    {formatPrice(effectivePrice)}
                  </span>
                  {product.discountPrice && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.price)}
                    </span>
                  )}
                </div>
                {product.isFlashSale && product.flashSaleEnd && (
                  <div className="mt-2">
                    <FlashSaleTimer endDate={product.flashSaleEnd} size="sm" />
                  </div>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => toggleWishlist(product.id)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50"
              >
                <motion.div animate={wishlisted ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
                  <Heart
                    className={`w-5 h-5 transition-colors ${wishlisted ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
                  />
                </motion.div>
              </motion.button>
            </div>
          </motion.div>

          <Separator />

          {/* 3. Product Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            <h1 className="text-lg font-bold text-foreground leading-tight">{product.name}</h1>

            <div className="flex items-center gap-3 flex-wrap">
              <RatingStars rating={product.rating} size="sm" reviewCount={product.reviewCount} />
              <Separator orientation="vertical" className="h-4" />
              <span className="text-xs text-muted-foreground">
                {product.sold > 1000 ? `${(product.sold / 1000).toFixed(1)}rb` : product.sold} terjual
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-xs text-muted-foreground">
                Stok: {effectiveVariant ? effectiveVariant.stock : product.stock}
              </span>
            </div>

            {/* Variant selector */}
            {product.variants && product.variants.length > 0 && (
              <>
                <Separator />
                <VariantSelector
                  variants={product.variants}
                  selectedVariant={effectiveVariant}
                  onSelect={(v) => {
                    setSelectedVariant(v)
                    setQuantity(1)
                  }}
                />
              </>
            )}

            {/* Quantity */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Jumlah</span>
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                min={product.minOrder}
                max={effectiveVariant ? effectiveVariant.stock : product.stock}
                size="sm"
              />
            </div>

            {/* Product guarantees */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Truck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Gratis Ongkir</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Garansi 7 Hari</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RotateCcw className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Bisa Return</span>
              </div>
            </div>
          </motion.div>

          <Separator />

          {/* 4. Shipping Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-bold">Pengiriman</h3>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-medium px-2 py-0.5">
                <Truck className="w-3 h-3 mr-1" />
                Gratis Ongkir
              </Badge>
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] font-medium px-2 py-0.5">
                <Zap className="w-3 h-3 mr-1" />
                Same Day
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Estimasi tiba 2-3 hari</span>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-8 rounded-lg" onClick={() => { setShowShippingModal(true); showToast("Estimasi ongkir diperlihatkan", "info") }}>
                Cek Ongkir
              </Button>
            </div>
          </motion.div>

          <Separator />

          {/* 5. Store Preview Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-4 bg-card rounded-xl border border-border/50 space-y-3"
          >
            <div className="flex items-center justify-between">
              <AvatarWithName
                name={product.seller.storeName}
                subtitle={`⭐ ${product.seller.rating} · ${product.seller.totalProducts} produk · ~1 jam`}
                avatarUrl={product.seller.storeAvatar}
                size="md"
                isVerified={product.seller.isVerified}
              />
            </div>

            <div className="flex items-center gap-2">
              <SellerBadge
                isVerified={product.seller.isVerified}
                isPremium={product.seller.isPremium}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs rounded-lg border-emerald-500 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 dark:hover:bg-emerald-950/30"
                onClick={async () => {
                  const wasFollowing = isFollowingStore(product.sellerId)
                  await toggleFollowStore(product.sellerId)
                  showToast(wasFollowing ? "Berhenti mengikuti toko" : "Berhasil mengikuti toko!", "success")
                }}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {isFollowingStore(product.sellerId) ? "Mengikuti" : "Follow"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs rounded-lg"
                onClick={() => { setSelectedSeller(product.sellerId); navigate('seller-shop') }}
              >
                <Award className="w-3.5 h-3.5 mr-1" />
                Kunjungi Toko
              </Button>
            </div>
          </motion.div>

          <Separator />

          {/* 6. Product Description */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-bold">Deskripsi Produk</h3>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            <div className="space-y-2">
              <p className="text-sm font-medium">Highlight:</p>
              {[
                "Produk 100% Original & Bergaransi Resmi",
                "Pengiriman Cepat & Aman dengan Bubble Wrap",
                "Dukungan After-Sales Service",
                "Kondisi: Baru (New Sealed Box)",
              ].map((highlight, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{highlight}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Detail:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">Berat</span>
                <span className="text-foreground">{product.weight}g</span>
                <span className="text-muted-foreground">Kondisi</span>
                <span className="text-foreground">{product.condition === 'new' ? 'Baru' : 'Bekas'}</span>
                <span className="text-muted-foreground">Min. Pemesanan</span>
                <span className="text-foreground">{product.minOrder} buah</span>
                <span className="text-muted-foreground">Kategori</span>
                <span className="text-foreground">{product.category.name}</span>
              </div>
            </div>
          </motion.div>

          <Separator />

          {/* 7. Rating & Reviews Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Ulasan Pembeli</h3>
              <div className="flex items-center gap-2">
                {effectiveCanReview && (
                  <button
                    className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"
                    onClick={() => navigate('review')}
                  >
                    Beri Ulasan
                  </button>
                )}
                <button className="text-xs text-emerald-600 font-medium flex items-center gap-0.5" onClick={() => showToast("Semua ulasan ditampilkan", "info")}>
                  Lihat Semua
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Overall rating */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center justify-center min-w-[80px]">
                <span className="text-4xl font-bold text-foreground">{product.rating.toFixed(1)}</span>
                <RatingStars rating={product.rating} size="sm" showValue={false} />
                <span className="text-[10px] text-muted-foreground mt-1">
                  {product.reviewCount.toLocaleString()} ulasan
                </span>
              </div>

              {/* Star distribution bars */}
              <div className="flex-1 space-y-1.5">
                {ratingDistribution.map((item) => (
                  <div key={item.stars} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-3">{item.stars}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percent}%` }}
                        transition={{ duration: 0.5, delay: 0.4 + (5 - item.stars) * 0.05 }}
                        className="h-full bg-amber-400 rounded-full"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Review cards */}
            <div className="space-y-3">
              {storeReviews.filter(r => r.productId === product.id).length > 0 ? (
                storeReviews.filter(r => r.productId === product.id).map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-3 bg-muted/30 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <AvatarWithName
                      name={review.userName}
                      avatarUrl={review.userAvatar}
                      size="sm"
                    />
                    <RatingStars rating={review.rating} size="sm" showValue={false} />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.content}</p>
                  {/* Seller Reply */}
                  {review.sellerReply && (
                    <div className="mt-1 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Penjual</span>
                        {review.sellerReplyAt && (
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(review.sellerReplyAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{review.sellerReply}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </motion.div>
              ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada ulasan</p>
              )}
            </div>
          </motion.div>

          <Separator />

          {/* 8. Related Products */}
          {relatedProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-bold">Produk Serupa</h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {relatedProducts.map((rp) => (
                  <div key={rp.id} className="flex-shrink-0 w-[165px]">
                    <ProductCard
                      product={rp}
                      onClick={() => handleRelatedClick(rp)}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Added to cart toast */}
      <AnimatePresence>
        {showAddedToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <Check className="w-4 h-4" />
            Ditambahkan ke keranjang
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shipping Cost Modal */}
      <AnimatePresence>
        {showShippingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setShowShippingModal(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-t-2xl p-5 w-full max-w-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Estimasi Ongkos Kirim</h3>
                <button onClick={() => setShowShippingModal(false)} className="text-muted-foreground text-lg font-bold">✕</button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {SHIPPING_OPTIONS.map((opt) => (
                  <div key={`${opt.provider}-${opt.service}`} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{opt.logo}</span>
                      <div>
                        <p className="text-sm font-medium">{opt.name}</p>
                        <p className="text-[10px] text-muted-foreground">Estimasi {opt.estimatedDays}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold">{opt.price === 0 ? 'Gratis' : formatPrice(opt.price)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 9. Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/50 pb-safe">
        <div className="flex items-center gap-2 px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => toggleWishlist(product.id)}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-border bg-card"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${wishlisted ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
            />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleShareToStream}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30"
            title="Bagikan ke Stream"
          >
            <Share className="w-5 h-5 text-emerald-600" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              const room = chatRooms.find(r => r.seller.id === product.sellerId)
              if (room) {
                setSelectedChatRoom(room.id)
              } else {
                // Create a new chat room via API
                const roomId = await createChatRoom(product.sellerId, product.id)
                if (roomId) {
                  setSelectedChatRoom(roomId)
                } else {
                  showToast("Gagal membuat chat room", "error")
                  return
                }
              }
              navigate('chat-room')
            }}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-border bg-card"
          >
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </motion.button>

          <Button
            variant="outline"
            className="flex-1 h-11 text-sm font-bold rounded-xl border-emerald-500 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 dark:hover:bg-emerald-950/30"
            onClick={handleAddToCart}
          >
            Keranjang
          </Button>

          <PrimaryButton
            className="flex-1 h-11 text-sm font-bold rounded-xl"
            onClick={handleBuyNow}
          >
            Beli Sekarang
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
