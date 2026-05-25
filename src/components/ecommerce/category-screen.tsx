"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
// categories are now fetched from the store
import { PageHeader, SearchBar, EmptyState, ProductCard } from "./shared"
import type { Category, Product } from "@/lib/types"
import { useState, useMemo, useCallback } from "react"
import {
  Grid3X3, ChevronRight, Package,
  SlidersHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Sub-categories mock data
const SUB_CATEGORIES: Record<string, Category[]> = {
  cat1: [
    { id: "cat1-1", name: "iPhone", slug: "iphone", icon: "📱", parentId: "cat1" },
    { id: "cat1-2", name: "Samsung", slug: "samsung", icon: "📱", parentId: "cat1" },
    { id: "cat1-3", name: "Xiaomi", slug: "xiaomi", icon: "📱", parentId: "cat1" },
    { id: "cat1-4", name: "OPPO", slug: "oppo", icon: "📱", parentId: "cat1" },
    { id: "cat1-5", name: "Vivo", slug: "vivo", icon: "📱", parentId: "cat1" },
    { id: "cat1-6", name: "Realme", slug: "realme", icon: "📱", parentId: "cat1" },
    { id: "cat1-7", name: "Aksesoris HP", slug: "aksesoris-hp", icon: "📱", parentId: "cat1" },
  ],
  cat2: [
    { id: "cat2-1", name: "MacBook", slug: "macbook", icon: "💻", parentId: "cat2" },
    { id: "cat2-2", name: "Laptop Gaming", slug: "laptop-gaming", icon: "💻", parentId: "cat2" },
    { id: "cat2-3", name: "Laptop Office", slug: "laptop-office", icon: "💻", parentId: "cat2" },
    { id: "cat2-4", name: "Aksesoris Laptop", slug: "aksesoris-laptop", icon: "💻", parentId: "cat2" },
  ],
  cat3: [
    { id: "cat3-1", name: "Sneakers", slug: "sneakers", icon: "👟", parentId: "cat3" },
    { id: "cat3-2", name: "Sepatu Formal", slug: "sepatu-formal", icon: "👟", parentId: "cat3" },
    { id: "cat3-3", name: "Sandals", slug: "sandals", icon: "🩴", parentId: "cat3" },
    { id: "cat3-4", name: "Sepatu Olahraga", slug: "sepatu-olahraga", icon: "👟", parentId: "cat3" },
  ],
  cat4: [
    { id: "cat4-1", name: "Kemeja", slug: "kemeja", icon: "👔", parentId: "cat4" },
    { id: "cat4-2", name: "Kaos", slug: "kaos", icon: "👔", parentId: "cat4" },
    { id: "cat4-3", name: "Celana", slug: "celana", icon: "👔", parentId: "cat4" },
    { id: "cat4-4", name: "Jaket", slug: "jaket", icon: "👔", parentId: "cat4" },
  ],
  cat5: [
    { id: "cat5-1", name: "Dress", slug: "dress", icon: "👗", parentId: "cat5" },
    { id: "cat5-2", name: "Blouse", slug: "blouse", icon: "👗", parentId: "cat5" },
    { id: "cat5-3", name: "Rok", slug: "rok", icon: "👗", parentId: "cat5" },
    { id: "cat5-4", name: "Tas Wanita", slug: "tas-wanita", icon: "👜", parentId: "cat5" },
  ],
  cat6: [
    { id: "cat6-1", name: "Skincare", slug: "skincare", icon: "💄", parentId: "cat6" },
    { id: "cat6-2", name: "Makeup", slug: "makeup", icon: "💄", parentId: "cat6" },
    { id: "cat6-3", name: "Parfum", slug: "parfum", icon: "🌸", parentId: "cat6" },
    { id: "cat6-4", name: "Perawatan Rambut", slug: "perawatan-rambut", icon: "💇", parentId: "cat6" },
  ],
  cat7: [
    { id: "cat7-1", name: "Makanan Ringan", slug: "makanan-ringan", icon: "🍕", parentId: "cat7" },
    { id: "cat7-2", name: "Minuman", slug: "minuman", icon: "🥤", parentId: "cat7" },
    { id: "cat7-3", name: "Bumbu Dapur", slug: "bumbu-dapur", icon: "🌶️", parentId: "cat7" },
  ],
  cat8: [
    { id: "cat8-1", name: "TV", slug: "tv", icon: "📺", parentId: "cat8" },
    { id: "cat8-2", name: "Audio", slug: "audio", icon: "🔊", parentId: "cat8" },
    { id: "cat8-3", name: "Kamera", slug: "kamera", icon: "📷", parentId: "cat8" },
    { id: "cat8-4", name: "Gadget", slug: "gadget", icon: "🔌", parentId: "cat8" },
  ],
  cat9: [
    { id: "cat9-1", name: "Sepak Bola", slug: "sepak-bola", icon: "⚽", parentId: "cat9" },
    { id: "cat9-2", name: "Running", slug: "running", icon: "🏃", parentId: "cat9" },
    { id: "cat9-3", name: "Yoga", slug: "yoga", icon: "🧘", parentId: "cat9" },
    { id: "cat9-4", name: "Gym", slug: "gym", icon: "🏋️", parentId: "cat9" },
  ],
  cat10: [
    { id: "cat10-1", name: "Dapur", slug: "dapur", icon: "🍳", parentId: "cat10" },
    { id: "cat10-2", name: "Kamar Tidur", slug: "kamar-tidur", icon: "🛏️", parentId: "cat10" },
    { id: "cat10-3", name: "Dekorasi", slug: "dekorasi", icon: "🏠", parentId: "cat10" },
  ],
  cat11: [
    { id: "cat11-1", name: "Popok", slug: "popok", icon: "👶", parentId: "cat11" },
    { id: "cat11-2", name: "Susu Bayi", slug: "susu-bayi", icon: "🍼", parentId: "cat11" },
    { id: "cat11-3", name: "Mainan Anak", slug: "mainan-anak", icon: "🧸", parentId: "cat11" },
  ],
  cat12: [
    { id: "cat12-1", name: "Aksesoris Mobil", slug: "aksesoris-mobil", icon: "🚗", parentId: "cat12" },
    { id: "cat12-2", name: "Spare Part", slug: "spare-part", icon: "🔧", parentId: "cat12" },
    { id: "cat12-3", name: "Helm", slug: "helm", icon: "🪖", parentId: "cat12" },
  ],
  cat13: [
    { id: "cat13-1", name: "Fiksi", slug: "fiksi", icon: "📚", parentId: "cat13" },
    { id: "cat13-2", name: "Edukasi", slug: "edukasi", icon: "📚", parentId: "cat13" },
    { id: "cat13-3", name: "Komik", slug: "komik", icon: "📚", parentId: "cat13" },
  ],
  cat14: [
    { id: "cat14-1", name: "Console", slug: "console", icon: "🎮", parentId: "cat14" },
    { id: "cat14-2", name: "Game", slug: "game", icon: "🎮", parentId: "cat14" },
    { id: "cat14-3", name: "Aksesoris Gaming", slug: "aksesoris-gaming", icon: "🎮", parentId: "cat14" },
  ],
  cat15: [
    { id: "cat15-1", name: "Vitamin", slug: "vitamin", icon: "💊", parentId: "cat15" },
    { id: "cat15-2", name: "Obat", slug: "obat", icon: "💊", parentId: "cat15" },
    { id: "cat15-3", name: "Alat Kesehatan", slug: "alat-kesehatan", icon: "🩺", parentId: "cat15" },
  ],
  cat16: [
    { id: "cat16-1", name: "Lukisan", slug: "lukisan", icon: "🎨", parentId: "cat16" },
    { id: "cat16-2", name: "Musik", slug: "musik", icon: "🎵", parentId: "cat16" },
    { id: "cat16-3", name: "Koleksi", slug: "koleksi", icon: "🎨", parentId: "cat16" },
  ],
}

type SortOption = "popular" | "newest" | "price-low" | "price-high"

// ==================== CATEGORY SCREEN (GRID LAYOUT) ====================
export function CategoryScreen() {
  const { navigate, setSelectedCategory, categories } = useAppStore()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase()
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    )
  }, [searchQuery, categories])

  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId)
    navigate("category-detail")
  }, [setSelectedCategory, navigate])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Kategori"
        showBack={false}
      />

      <div className="flex-1 pb-20">
        {/* Search Bar */}
        <div className="px-4 pb-4">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari kategori..."
          />
        </div>

        {/* Category Grid */}
        {filteredCategories.length > 0 ? (
          <div className="px-4">
            <div className="grid grid-cols-4 gap-2.5">
              {filteredCategories.map((cat, idx) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-xl bg-card border border-border/50 hover:bg-muted/20 active:bg-muted/30 transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-xl">
                    {cat.icon || "📦"}
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 text-foreground">
                    {cat.name}
                  </span>
                  {cat.productCount && (
                    <span className="text-[8px] text-muted-foreground">
                      {cat.productCount.toLocaleString()} produk
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Grid3X3 className="w-10 h-10 text-muted-foreground" />}
            title="Kategori Tidak Ditemukan"
            subtitle="Coba kata kunci lain untuk mencari kategori"
          />
        )}
      </div>
    </div>
  )
}

// ==================== CATEGORY DETAIL SCREEN ====================
export function CategoryDetailScreen() {
  const { navigate, goBack, selectedCategoryId, setSelectedProduct, products, categories } = useAppStore()
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null)
  const [sortOption, setSortOption] = useState<SortOption>("popular")

  // Find the selected category
  const category = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [selectedCategoryId, categories]
  )

  // Get sub-categories
  const subCategories = useMemo(
    () => (category ? SUB_CATEGORIES[category.id] || [] : []),
    [category]
  )

  // Get products for this category from store
  const categoryProducts = useMemo(
    () => (category ? products.filter((p) => p.categoryId === category.id) : []),
    [category, products]
  )

  // Sort products
  const displayedProducts = useMemo(() => {
    let sorted = [...categoryProducts]
    switch (sortOption) {
      case "price-low":
        return sorted.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price))
      case "price-high":
        return sorted.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price))
      case "newest":
        return sorted
      case "popular":
      default:
        return sorted.sort((a, b) => b.sold - a.sold)
    }
  }, [categoryProducts, sortOption])

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product.id)
    navigate("product-detail")
  }, [setSelectedProduct, navigate])

  if (!category) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <PageHeader title="Kategori" onAction={() => goBack()} />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Grid3X3 className="w-10 h-10 text-muted-foreground" />}
            title="Kategori Tidak Ditemukan"
            subtitle="Kembali dan pilih kategori lain"
            actionLabel="Kembali"
            onAction={() => goBack()}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header with category info */}
      <div className="sticky top-0 z-40">
        <div className="glass">
          <div className="flex items-center gap-3 h-14 px-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={goBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </motion.button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xl">{category.icon}</span>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-foreground truncate">{category.name}</h1>
              </div>
            </div>
            <Badge className="text-[9px] h-5 bg-emerald-500 text-white border-0 flex-shrink-0">
              {category.productCount?.toLocaleString() || categoryProducts.length} produk
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 pb-20">
        {/* Sub-categories grid */}
        {subCategories.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <div className="grid grid-cols-4 gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedSubCategory(null)}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1.5 rounded-xl border transition-colors ${
                  !selectedSubCategory
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                    : "bg-card border-border/50 hover:bg-muted/20"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${
                  !selectedSubCategory
                    ? "bg-emerald-100 dark:bg-emerald-900/50"
                    : "bg-muted"
                }`}>
                  🏷️
                </div>
                <span className={`text-[10px] font-medium text-center leading-tight ${
                  !selectedSubCategory ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                }`}>
                  Semua
                </span>
              </motion.button>
              {subCategories.map((sub) => (
                <motion.button
                  key={sub.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedSubCategory(sub.id === selectedSubCategory ? null : sub.id)}
                  className={`flex flex-col items-center gap-1.5 py-2.5 px-1.5 rounded-xl border transition-colors ${
                    selectedSubCategory === sub.id
                      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                      : "bg-card border-border/50 hover:bg-muted/20"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${
                    selectedSubCategory === sub.id
                      ? "bg-emerald-100 dark:bg-emerald-900/50"
                      : "bg-muted"
                  }`}>
                    {sub.icon || "📦"}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${
                    selectedSubCategory === sub.id ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                  }`}>
                    {sub.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Sort options */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <div className="flex gap-1.5">
              {([
                { key: "popular" as const, label: "Terlaris" },
                { key: "newest" as const, label: "Terbaru" },
                { key: "price-low" as const, label: "Harga ↓" },
                { key: "price-high" as const, label: "Harga ↑" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortOption(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    sortOption === opt.key
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {displayedProducts.length > 0 ? (
          <div className="px-4 grid grid-cols-2 gap-3">
            {displayedProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.2) }}
              >
                <ProductCard
                  product={product}
                  onClick={() => handleProductClick(product)}
                  layout="grid"
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="px-4">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Belum Ada Produk</p>
              <p className="text-xs text-muted-foreground mt-1">Produk di kategori ini segera hadir</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
