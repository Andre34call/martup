"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
// categories are now fetched from the store
import { PageHeader, SearchBar, EmptyState, ProductCard } from "./shared"
import type { Product } from "@/lib/types"
import { useState, useMemo, useCallback } from "react"
import {
  Grid3X3, ChevronRight, Package,
  SlidersHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type SortOption = "popular" | "newest" | "price-low" | "price-high"

// Sub-category type matching store category shape
interface SubCategory {
  id: string
  name: string
  slug: string
  icon?: string
  parentId?: string | null
  productCount?: number
  children?: SubCategory[]
}

// ==================== CATEGORY SCREEN (GRID LAYOUT) ====================
export function CategoryScreen() {
  const { navigate, setSelectedCategory, categories } = useAppStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase()
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.children && c.children.some((ch: SubCategory) => ch.name.toLowerCase().includes(q)))
    )
  }, [searchQuery, categories])

  const handleCategoryClick = useCallback((category: typeof categories[0]) => {
    if (category.children && category.children.length > 0) {
      // Toggle expand to show sub-categories
      setExpandedCategoryId(prev => prev === category.id ? null : category.id)
    } else {
      // No children — navigate directly to category detail
      setSelectedCategory(category.id)
      navigate("category-detail")
    }
  }, [setSelectedCategory, navigate])

  const handleSubCategoryClick = useCallback((subCatId: string) => {
    setSelectedCategory(subCatId)
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
          <div className="px-4 space-y-3">
            {filteredCategories.map((cat, idx) => {
              const isExpanded = expandedCategoryId === cat.id
              const hasChildren = cat.children && cat.children.length > 0

              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                >
                  {/* Main category button */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleCategoryClick(cat)}
                    className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-card border border-border/50 hover:bg-muted/20 active:bg-muted/30 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-xl flex-shrink-0">
                      {cat.icon || "📦"}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-sm font-medium text-foreground">
                        {cat.name}
                      </span>
                      {cat.productCount ? (
                        <span className="text-[10px] text-muted-foreground ml-2">
                          {cat.productCount.toLocaleString()} produk
                        </span>
                      ) : null}
                    </div>
                    {hasChildren && (
                      <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </motion.div>
                    )}
                  </motion.button>

                  {/* Sub-categories (expandable) */}
                  {hasChildren && isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="ml-4 mt-1 space-y-1"
                    >
                      {(cat.children as SubCategory[]).map((sub) => (
                        <motion.button
                          key={sub.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSubCategoryClick(sub.id)}
                          className="w-full flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-muted/30 active:bg-muted/50 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-sm flex-shrink-0">
                            {sub.icon || "📦"}
                          </div>
                          <span className="text-xs font-medium text-foreground flex-1 text-left">{sub.name}</span>
                          {sub.productCount ? (
                            <span className="text-[9px] text-muted-foreground">{sub.productCount} produk</span>
                          ) : null}
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
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

  // Get sub-categories from API data (category.children)
  const subCategories = useMemo(
    () => (category && category.children ? category.children : []),
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
        <PageHeader title="Kategori" onBack={() => goBack()} />
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
