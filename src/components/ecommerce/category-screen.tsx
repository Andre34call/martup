"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from "@/lib/mock-data"
import { PageHeader, SearchBar, EmptyState, ProductCard, SectionHeader } from "./shared"
import type { Category, Product } from "@/lib/types"
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import {
  Grid3X3, ChevronDown, ChevronRight, Package,
  SlidersHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Sub-categories mock data
const SUB_CATEGORIES: Record<string, Category[]> = {
  cat1: [
    { id: "cat1-1", name: "iPhone", slug: "iphone", icon: "📱", parentId: "cat1", productCount: 3200 },
    { id: "cat1-2", name: "Samsung", slug: "samsung", icon: "📱", parentId: "cat1", productCount: 2800 },
    { id: "cat1-3", name: "Xiaomi", slug: "xiaomi", icon: "📱", parentId: "cat1", productCount: 4100 },
    { id: "cat1-4", name: "OPPO", slug: "oppo", icon: "📱", parentId: "cat1", productCount: 1900 },
    { id: "cat1-5", name: "Vivo", slug: "vivo", icon: "📱", parentId: "cat1", productCount: 1500 },
    { id: "cat1-6", name: "Realme", slug: "realme", icon: "📱", parentId: "cat1", productCount: 1200 },
    { id: "cat1-7", name: "Aksesoris HP", slug: "aksesoris-hp", icon: "📱", parentId: "cat1", productCount: 8200 },
  ],
  cat2: [
    { id: "cat2-1", name: "MacBook", slug: "macbook", icon: "💻", parentId: "cat2", productCount: 1200 },
    { id: "cat2-2", name: "Laptop Gaming", slug: "laptop-gaming", icon: "💻", parentId: "cat2", productCount: 2300 },
    { id: "cat2-3", name: "Laptop Office", slug: "laptop-office", icon: "💻", parentId: "cat2", productCount: 1800 },
    { id: "cat2-4", name: "Aksesoris Laptop", slug: "aksesoris-laptop", icon: "💻", parentId: "cat2", productCount: 3100 },
  ],
  cat3: [
    { id: "cat3-1", name: "Sneakers", slug: "sneakers", icon: "👟", parentId: "cat3", productCount: 8500 },
    { id: "cat3-2", name: "Sepatu Formal", slug: "sepatu-formal", icon: "👟", parentId: "cat3", productCount: 4200 },
    { id: "cat3-3", name: "Sandals", slug: "sandals", icon: "🩴", parentId: "cat3", productCount: 5600 },
    { id: "cat3-4", name: "Sepatu Olahraga", slug: "sepatu-olahraga", icon: "👟", parentId: "cat3", productCount: 4800 },
  ],
  cat4: [
    { id: "cat4-1", name: "Kemeja", slug: "kemeja", icon: "👔", parentId: "cat4", productCount: 9200 },
    { id: "cat4-2", name: "Kaos", slug: "kaos", icon: "👔", parentId: "cat4", productCount: 15000 },
    { id: "cat4-3", name: "Celana", slug: "celana", icon: "👔", parentId: "cat4", productCount: 8800 },
    { id: "cat4-4", name: "Jaket", slug: "jaket", icon: "👔", parentId: "cat4", productCount: 6500 },
  ],
  cat5: [
    { id: "cat5-1", name: "Dress", slug: "dress", icon: "👗", parentId: "cat5", productCount: 12000 },
    { id: "cat5-2", name: "Blouse", slug: "blouse", icon: "👗", parentId: "cat5", productCount: 8900 },
    { id: "cat5-3", name: "Rok", slug: "rok", icon: "👗", parentId: "cat5", productCount: 7600 },
    { id: "cat5-4", name: "Tas Wanita", slug: "tas-wanita", icon: "👜", parentId: "cat5", productCount: 14200 },
  ],
  cat6: [
    { id: "cat6-1", name: "Skincare", slug: "skincare", icon: "💄", parentId: "cat6", productCount: 12000 },
    { id: "cat6-2", name: "Makeup", slug: "makeup", icon: "💄", parentId: "cat6", productCount: 9800 },
    { id: "cat6-3", name: "Parfum", slug: "parfum", icon: "🌸", parentId: "cat6", productCount: 4500 },
    { id: "cat6-4", name: "Perawatan Rambut", slug: "perawatan-rambut", icon: "💇", parentId: "cat6", productCount: 5100 },
  ],
  cat7: [
    { id: "cat7-1", name: "Makanan Ringan", slug: "makanan-ringan", icon: "🍕", parentId: "cat7", productCount: 9800 },
    { id: "cat7-2", name: "Minuman", slug: "minuman", icon: "🥤", parentId: "cat7", productCount: 6700 },
    { id: "cat7-3", name: "Bumbu Dapur", slug: "bumbu-dapur", icon: "🌶️", parentId: "cat7", productCount: 4200 },
  ],
  cat8: [
    { id: "cat8-1", name: "TV", slug: "tv", icon: "📺", parentId: "cat8", productCount: 3200 },
    { id: "cat8-2", name: "Audio", slug: "audio", icon: "🔊", parentId: "cat8", productCount: 4500 },
    { id: "cat8-3", name: "Kamera", slug: "kamera", icon: "📷", parentId: "cat8", productCount: 2800 },
    { id: "cat8-4", name: "Gadget", slug: "gadget", icon: "🔌", parentId: "cat8", productCount: 8700 },
  ],
  cat9: [
    { id: "cat9-1", name: "Sepak Bola", slug: "sepak-bola", icon: "⚽", parentId: "cat9", productCount: 3200 },
    { id: "cat9-2", name: "Running", slug: "running", icon: "🏃", parentId: "cat9", productCount: 2800 },
    { id: "cat9-3", name: "Yoga", slug: "yoga", icon: "🧘", parentId: "cat9", productCount: 1900 },
    { id: "cat9-4", name: "Gym", slug: "gym", icon: "🏋️", parentId: "cat9", productCount: 4400 },
  ],
  cat10: [
    { id: "cat10-1", name: "Dapur", slug: "dapur", icon: "🍳", parentId: "cat10", productCount: 8900 },
    { id: "cat10-2", name: "Kamar Tidur", slug: "kamar-tidur", icon: "🛏️", parentId: "cat10", productCount: 7200 },
    { id: "cat10-3", name: "Dekorasi", slug: "dekorasi", icon: "🏠", parentId: "cat10", productCount: 9800 },
  ],
  cat11: [
    { id: "cat11-1", name: "Popok", slug: "popok", icon: "👶", parentId: "cat11", productCount: 4200 },
    { id: "cat11-2", name: "Susu Bayi", slug: "susu-bayi", icon: "🍼", parentId: "cat11", productCount: 3100 },
    { id: "cat11-3", name: "Mainan Anak", slug: "mainan-anak", icon: "🧸", parentId: "cat11", productCount: 6800 },
  ],
  cat12: [
    { id: "cat12-1", name: "Aksesoris Mobil", slug: "aksesoris-mobil", icon: "🚗", parentId: "cat12", productCount: 4200 },
    { id: "cat12-2", name: "Spare Part", slug: "spare-part", icon: "🔧", parentId: "cat12", productCount: 3100 },
    { id: "cat12-3", name: "Helm", slug: "helm", icon: "🪖", parentId: "cat12", productCount: 2400 },
  ],
  cat13: [
    { id: "cat13-1", name: "Fiksi", slug: "fiksi", icon: "📚", parentId: "cat13", productCount: 12000 },
    { id: "cat13-2", name: "Edukasi", slug: "edukasi", icon: "📚", parentId: "cat13", productCount: 9800 },
    { id: "cat13-3", name: "Komik", slug: "komik", icon: "📚", parentId: "cat13", productCount: 7500 },
  ],
  cat14: [
    { id: "cat14-1", name: "Console", slug: "console", icon: "🎮", parentId: "cat14", productCount: 2800 },
    { id: "cat14-2", name: "Game", slug: "game", icon: "🎮", parentId: "cat14", productCount: 6200 },
    { id: "cat14-3", name: "Aksesoris Gaming", slug: "aksesoris-gaming", icon: "🎮", parentId: "cat14", productCount: 6600 },
  ],
  cat15: [
    { id: "cat15-1", name: "Vitamin", slug: "vitamin", icon: "💊", parentId: "cat15", productCount: 5200 },
    { id: "cat15-2", name: "Obat", slug: "obat", icon: "💊", parentId: "cat15", productCount: 3800 },
    { id: "cat15-3", name: "Alat Kesehatan", slug: "alat-kesehatan", icon: "🩺", parentId: "cat15", productCount: 2400 },
  ],
  cat16: [
    { id: "cat16-1", name: "Lukisan", slug: "lukisan", icon: "🎨", parentId: "cat16", productCount: 2100 },
    { id: "cat16-2", name: "Musik", slug: "musik", icon: "🎵", parentId: "cat16", productCount: 3400 },
    { id: "cat16-3", name: "Koleksi", slug: "koleksi", icon: "🎨", parentId: "cat16", productCount: 3400 },
  ],
}

type SortOption = "popular" | "newest" | "price-low" | "price-high"

// ==================== CATEGORY ITEM WITH INLINE EXPANSION ====================
function CategoryItem({
  category,
  isExpanded,
  onToggle,
  products,
  selectedSubCategory,
  onSelectSub,
  onProductClick,
  sortOption,
  onSortChange,
}: {
  category: Category
  isExpanded: boolean
  onToggle: () => void
  products: Product[]
  selectedSubCategory: string | null
  onSelectSub: (subId: string | null) => void
  onProductClick: (product: Product) => void
  sortOption: SortOption
  onSortChange: (opt: SortOption) => void
}) {
  const subCategories = SUB_CATEGORIES[category.id] || []

  // Filter products by sub-category if selected
  const displayedProducts = useMemo(() => {
    let filtered = products
    if (selectedSubCategory) {
      // In a real app, we'd filter by sub-category. Here we show all for the parent category
      filtered = products
    }
    // Sort
    switch (sortOption) {
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
  }, [products, selectedSubCategory, sortOption])

  return (
    <div className="border-b border-border/30 last:border-0">
      {/* Category Header - Clickable to expand/collapse */}
      <motion.button
      whileTap={{ scale: 0.995 }}
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
        isExpanded
          ? "bg-emerald-100 dark:bg-emerald-900/40"
          : "bg-muted"
      }`}>
        {category.icon || "📦"}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold truncate ${isExpanded ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
            {category.name}
          </p>
          {isExpanded && (
            <Badge className="text-[9px] h-4 bg-emerald-500 text-white border-0">
              {products.length} produk
            </Badge>
          )}
        </div>
        {category.productCount && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {category.productCount.toLocaleString()} produk
          </p>
        )}
      </div>
      <motion.div
        animate={{ rotate: isExpanded ? 180 : 0 }}
        transition={{ duration: 0.2 }}
        className="flex-shrink-0"
      >
        <ChevronDown className={`w-5 h-5 ${isExpanded ? "text-emerald-600" : "text-muted-foreground"}`} />
      </motion.div>
    </motion.button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-4">
              {/* Sub-categories horizontal scroll */}
              {subCategories.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onSelectSub(null)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        !selectedSubCategory
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      <span>Semua</span>
                    </motion.button>
                    {subCategories.map((sub) => (
                      <motion.button
                        key={sub.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onSelectSub(sub.id)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                          selectedSubCategory === sub.id
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-card text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        <span className="text-sm">{sub.icon}</span>
                        <span>{sub.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort options */}
              <div className="px-4 pb-3">
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
                        onClick={() => onSortChange(opt.key)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
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
                        onClick={() => onProductClick(product)}
                        layout="grid"
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="px-4">
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                      <Package className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Belum Ada Produk</p>
                    <p className="text-xs text-muted-foreground mt-1">Produk di kategori ini segera hadir</p>
                  </div>
                </div>
              )}

              {/* See All in Search button */}
              {displayedProducts.length > 0 && (
                <div className="px-4 pt-3">
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    onClick={() => onProductClick(displayedProducts[0])}
                  >
                    Lihat Semua Produk {category.name}
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== CATEGORY SCREEN ====================
export function CategoryScreen() {
  const { navigate, setSelectedProduct, setSearchQuery: setStoreSearchQuery } = useAppStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [selectedSubCategories, setSelectedSubCategories] = useState<Record<string, string | null>>({})
  const [sortOptions, setSortOptions] = useState<Record<string, SortOption>>({})

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_CATEGORIES
    const q = searchQuery.toLowerCase()
    return MOCK_CATEGORIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const handleToggleCategory = useCallback((categoryId: string) => {
    setExpandedCategoryId((prev) => prev === categoryId ? null : categoryId)
  }, [])

  const handleSelectSubCategory = useCallback((categoryId: string, subId: string | null) => {
    setSelectedSubCategories((prev) => ({ ...prev, [categoryId]: subId }))
  }, [])

  const handleSortChange = useCallback((categoryId: string, opt: SortOption) => {
    setSortOptions((prev) => ({ ...prev, [categoryId]: opt }))
  }, [])

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product.id)
    navigate("product-detail")
  }, [setSelectedProduct, navigate])

  // Get products for a specific category
  const getProductsForCategory = useCallback((categoryId: string) => {
    return MOCK_PRODUCTS.filter((p) => p.categoryId === categoryId)
  }, [])

  // Auto-scroll expanded category into view
  const expandedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (expandedCategoryId && expandedRef.current) {
      // Small delay to let animation start
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }, 100)
    }
  }, [expandedCategoryId])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Kategori"
        showBack={false}
      />

      <div className="flex-1 pb-20">
        {/* Search Bar */}
        <div className="px-4 pb-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari kategori..."
          />
        </div>

        {/* Category List with Inline Expansion */}
        {filteredCategories.length > 0 ? (
          <div className="bg-card rounded-xl border border-border/50 mx-4 overflow-hidden">
            {filteredCategories.map((category, idx) => {
              const isExpanded = expandedCategoryId === category.id
              const products = getProductsForCategory(category.id)

              return (
                <div key={category.id} ref={isExpanded ? expandedRef : undefined}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                  >
                    <CategoryItem
                      category={category}
                      isExpanded={isExpanded}
                      onToggle={() => handleToggleCategory(category.id)}
                      products={products}
                      selectedSubCategory={selectedSubCategories[category.id] || null}
                      onSelectSub={(subId) => handleSelectSubCategory(category.id, subId)}
                      onProductClick={handleProductClick}
                      sortOption={sortOptions[category.id] || "popular"}
                      onSortChange={(opt) => handleSortChange(category.id, opt)}
                    />
                  </motion.div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Grid3X3 className="w-10 h-10 text-muted-foreground" />}
            title="Kategori Tidak Ditemukan"
            subtitle="Coba kata kunci lain untuk mencari kategori"
          />
        )}

        {/* Popular Categories Quick Access */}
        {!searchQuery && !expandedCategoryId && (
          <div className="px-4 pt-6">
            <SectionHeader title="Kategori Populer" />
            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {MOCK_CATEGORIES.slice(0, 8).map((cat, idx) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => {
                    setExpandedCategoryId(cat.id)
                  }}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-1.5 rounded-xl bg-card border border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-base">
                    {cat.icon || "📦"}
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 text-foreground">
                    {cat.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
