"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Search, Bell, MessageCircle, ChevronRight, Zap, Package, ShoppingCart } from "lucide-react"
import { useAppStore, useCartStore } from "@/lib/store"
import { ProductCard, FlashSaleTimer, CategoryPill, SectionHeader, EmptyState } from "./shared"
import type { Product } from "@/lib/types"
import { useState, useEffect, useCallback, useRef } from "react"

// ==================== SECURITY HELPERS ====================

/**
 * Validate that a URL uses a safe protocol (http: or https:).
 * Prevents XSS via javascript:, data:, vbscript: and other dangerous URI schemes.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Safely open a URL in a new tab with noopener/noreferrer protection.
 * Prevents reverse tabnapping attacks where the opened page can access window.opener.
 */
function safeWindowOpen(url: string): void {
  if (isSafeUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// ==================== (banners now from DB via homeBanners) ====================

// ==================== QUICK ACTIONS DATA ====================
const quickActionsRow1 = [
  { icon: "⚡", label: "Flash Sale", key: "flash-sale" },
  { icon: "🎫", label: "Voucher", key: "voucher" },
  { icon: "💰", label: "Top-Up", key: "topup" },
  { icon: "🚚", label: "Gratis Ongkir", key: "free-ship" },
  { icon: "🪙", label: "Coin", key: "coin" },
]

const quickActionsRow2 = [
  { icon: "📺", label: "Live", key: "live" },
  { icon: "🔥", label: "Baru", key: "new" },
  { icon: "🇮🇩", label: "Lokal", key: "local" },
  { icon: "🎪", label: "Badut", key: "promo" },
  { icon: "➕", label: "Lainnya", key: "more" },
]

// ==================== HOME SCREEN ====================
export function HomeScreen() {
  const { navigate, unreadNotificationCount, totalUnreadChats, setSelectedProduct, setSelectedCategory, setSearchQuery, showToast, products, categories, isAuthenticated, homeBanners, fetchHomeBanners } = useAppStore()
  const { getTotalItemCount } = useCartStore()
  const cartCount = getTotalItemCount()
  const [currentBanner, setCurrentBanner] = useState(0)
  const [showLoadingMore, setShowLoadingMore] = useState(false)
  const [activeProductType, setActiveProductType] = useState<'all' | 'product' | 'jasa'>('all')

  // Handle quick action button clicks
  const handleQuickAction = useCallback((key: string) => {
    switch (key) {
      case "flash-sale":
        setSearchQuery("Flash Sale")
        navigate("search")
        break
      case "voucher":
        navigate("voucher")
        break
      case "topup":
        navigate("deposit")
        break
      case "free-ship":
        setSearchQuery("Gratis Ongkir")
        navigate("search")
        break
      case "coin":
        navigate("wallet")
        break
      case "live":
        showToast("Fitur Live Streaming segera hadir!", "info")
        break
      case "new":
        setSearchQuery("Baru")
        navigate("search")
        break
      case "local":
        navigate("category")
        break
      case "promo":
        navigate("voucher")
        break
      case "more":
        showToast("Menu lainnya segera hadir!", "info")
        break
    }
  }, [setSearchQuery, navigate, showToast])

  // Fetch home banners on mount
  useEffect(() => {
    fetchHomeBanners()
  }, [fetchHomeBanners])

  // Auto-play banner carousel
  useEffect(() => {
    if (homeBanners.length <= 1) return
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % homeBanners.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [homeBanners.length])

  // Filter products for flash sale
  const flashSaleProducts = products.filter((p) => p.isFlashSale)

  // Filter products by product type (Barang / Tolong Mas)
  const filteredProducts = activeProductType === 'all'
    ? products
    : products.filter((p) => p.productType === activeProductType)

  // Handle product click
  const handleProductClick = useCallback(
    (product: Product) => {
      setSelectedProduct(product.id)
      navigate("product-detail")
    },
    [setSelectedProduct, navigate]
  )

  // Infinite scroll placeholder
  const feedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShowLoadingMore(true)
          setTimeout(() => setShowLoadingMore(false), 1500)
        }
      },
      { threshold: 1.0 }
    )

    const sentinelEl = document.getElementById("feed-sentinel")
    if (sentinelEl) observer.observe(sentinelEl)

    return () => observer.disconnect()
  }, [products])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-background pb-20"
    >
      {/* ===== TOP BAR ===== */}
      <div className="sticky top-0 z-40 glass">
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Logo */}
          <span className="text-xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent flex-shrink-0">
            MartUp
          </span>

          {/* Search bar */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("search")}
            className="flex-1 flex items-center gap-2 h-9 px-3 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground text-sm"
          >
            <Search className="w-4 h-4" />
          </motion.button>

          {/* Cart icon */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("cart")}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <ShoppingCart className="w-5 h-5 text-foreground" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold px-1"
              >
                {cartCount > 99 ? "99+" : cartCount}
              </motion.span>
            )}
          </motion.button>

          {/* Notification bell */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("notification")}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5 text-foreground" />
            {unreadNotificationCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1"
              >
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </motion.span>
            )}
          </motion.button>

          {/* Chat icon */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("chat")}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-foreground" />
            {totalUnreadChats > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1"
              >
                {totalUnreadChats > 99 ? "99+" : totalUnreadChats}
              </motion.span>
            )}
          </motion.button>
        </div>
      </div>

      {/* ===== PRODUCT TYPE TOGGLE (BARANG / TOLONG MAS) — STICKY BELOW HEADER ===== */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 py-2">
        <div className="flex gap-2">
          {[
            { key: 'all' as const, label: 'Semua', icon: '🔥' },
            { key: 'product' as const, label: '📦 Barang', icon: '📦' },
            { key: 'jasa' as const, label: '🤝 Tolong Mas', icon: '🤝' },
          ].map((type) => (
            <motion.button
              key={type.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveProductType(type.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeProductType === type.key
                  ? type.key === 'jasa'
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                    : type.key === 'product'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white shadow-md'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ===== BANNER CAROUSEL ===== */}
      <div className="px-4 pt-3">
        <div className="relative h-44 rounded-2xl overflow-hidden">
          {homeBanners.length > 0 ? (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentBanner}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => {
                    const banner = homeBanners[currentBanner]
                    // SECURITY: Validate URL protocol before opening to prevent XSS
                    // (e.g. javascript: URIs in banner.link from DB)
                    if (banner?.link && isSafeUrl(banner.link)) {
                      safeWindowOpen(banner.link)
                    }
                  }}
                  className="absolute inset-0 cursor-pointer"
                >
                  <img
                    src={homeBanners[currentBanner].image}
                    alt={homeBanners[currentBanner].title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h2 className="text-lg font-bold text-white drop-shadow-sm">
                      {homeBanners[currentBanner].title}
                    </h2>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {homeBanners.map((_, idx) => (
                  <button key={idx} onClick={() => setCurrentBanner(idx)} className="focus:outline-none">
                    <motion.div
                      animate={{
                        width: idx === currentBanner ? 20 : 6,
                        backgroundColor: idx === currentBanner ? "#ffffff" : "rgba(255,255,255,0.5)",
                      }}
                      transition={{ duration: 0.3 }}
                      className="h-1.5 rounded-full"
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Fallback gradient banner when no dynamic banners exist */
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500 flex flex-col items-center justify-center text-white">
              <h2 className="text-2xl font-extrabold drop-shadow-sm">MartUp 🔥</h2>
              <p className="text-sm font-medium opacity-90 mt-1">Belanja Mudah & Hemat!</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== QUICK ACTIONS ===== */}
      <div className="px-4 pt-4 space-y-3">
        {/* Row 1 */}
        <div className="grid grid-cols-5 gap-2">
          {quickActionsRow1.map((action) => (
            <motion.button
              key={action.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleQuickAction(action.key)}
              className="flex flex-col items-center gap-1.5 py-2"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-[10px] font-medium text-foreground leading-tight text-center">
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-5 gap-2">
          {quickActionsRow2.map((action) => (
            <motion.button
              key={action.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleQuickAction(action.key)}
              className="flex flex-col items-center gap-1.5 py-2"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-[10px] font-medium text-foreground leading-tight text-center">
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ===== FLASH SALE SECTION ===== */}
      {flashSaleProducts.length > 0 && (
        <div className="pt-5">
          <div className="px-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-bold text-foreground">Flash Sale</h2>
                <FlashSaleTimer
                  endDate={flashSaleProducts[0].flashSaleEnd || "2025-12-31T23:59:59Z"}
                  size="sm"
                />
              </div>
              <button
                onClick={() => {
                  setSearchQuery("Flash Sale")
                  navigate("search")
                }}
                className="flex items-center gap-0.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 active:text-emerald-800 transition-colors"
              >
                Lihat Semua
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Horizontal scrollable flash sale cards */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {flashSaleProducts.map((product) => (
              <motion.div
                key={product.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleProductClick(product)}
                className="flex-shrink-0 w-[155px] bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden">
                  {product.images && product.images.length > 0 && !product.images[0].startsWith('blob:') ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const fallback = target.nextElementSibling as HTMLDivElement
                        if (fallback) fallback.style.display = 'flex'
                      }}
                      loading="lazy"
                    />
                  ) : null}
                  <div
                    className={`w-full h-full flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 ${product.images && product.images.length > 0 && !product.images[0]?.startsWith('blob:') ? 'hidden' : ''}`}
                  >
                    <span className="text-xl font-bold text-orange-500">
                      {product.name.charAt(0)}
                    </span>
                  </div>
                  {/* Discount badge */}
                  {product.discountPrice && (
                    <div className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                      -{product.price > 0 ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0}%
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-2 space-y-1">
                  <h3 className="text-[11px] font-medium line-clamp-2 leading-tight min-h-[1.5rem]">
                    {product.name}
                  </h3>
                  {product.discountPrice && (
                    <p className="text-xs font-bold text-emerald-600">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(product.discountPrice)}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {product.sold > 1000
                      ? `${(product.sold / 1000).toFixed(1)}rb`
                      : product.sold}{" "}
                    terjual
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CATEGORY SECTION ===== */}
      <div className="pt-5 px-4">
        <SectionHeader
          title="Kategori Pilihan"
          onAction={() => navigate("category")}
          actionLabel="Lihat Semua"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.slice(0, 10).map((cat) => (
            <CategoryPill
              key={cat.id}
              id={cat.id}
              name={cat.name}
              icon={cat.icon}
              onClick={() => {
                setSelectedCategory(cat.id)
                navigate("category-detail")
              }}
            />
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">Memuat kategori...</p>
          )}
        </div>
      </div>

      {/* ===== PRODUCT FEED ===== */}
      <div className="pt-5 px-4" ref={feedRef}>
        <SectionHeader
          title={activeProductType === 'jasa' ? '🤝 Tolong Mas' : activeProductType === 'product' ? '📦 Barang' : 'Rekomendasi Untukmu'}
          subtitle={activeProductType === 'jasa' ? 'Layanan dari seller terpercaya' : activeProductType === 'product' ? 'Produk fisik dikirim ke rumahmu' : 'Berdasarkan preferensimu'}
          onAction={() => navigate("search")}
          actionLabel="Lihat Semua"
        />

        {filteredProducts.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {filteredProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
              >
                <ProductCard
                  product={product}
                  onClick={() => handleProductClick(product)}
                  layout="grid"
                  showShareToStream
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Package className="w-10 h-10 text-muted-foreground" />}
            title={activeProductType === 'jasa' ? 'Belum Ada Layanan Tolong Mas' : 'Belum Ada Produk'}
            subtitle={activeProductType === 'jasa' ? 'Layanan Tolong Mas akan muncul ketika seller mulai menawarkan jasa' : 'Produk akan muncul ketika seller mulai berjualan'}
            actionLabel="Jelajahi Kategori"
            onAction={() => navigate("category")}
          />
        )}

        {/* Infinite scroll sentinel & loading indicator */}
        <div id="feed-sentinel" className="h-4" />

        <AnimatePresence>
          {showLoadingMore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-6 gap-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
              />
              <span className="text-sm text-muted-foreground">Memuat lebih banyak...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
