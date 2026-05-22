"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore, useWishlistStore } from "@/lib/store"
import { MOCK_CATEGORIES, formatPrice, formatRelativeTime } from "@/lib/mock-data"
import { PageHeader, ProductCard, EmptyState, SearchBar, SectionHeader } from "./shared"
import type { Product } from "@/lib/types"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { ArrowLeft, Search, X, Clock, TrendingUp, Flame, Trash2, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const TRENDING_SEARCHES = [
  "iPhone 15",
  "Skincare",
  "Sepatu Nike",
  "Laptop Gaming",
  "Baju Lebaran",
  "Headphone",
  "Tas Wanita",
  "Samsung Galaxy",
  "PS5",
  "Makeup",
]

export function SearchScreen() {
  const { searchHistory, addSearchHistory, clearSearchHistory, navigate, setSelectedProduct, setSelectedCategory, selectedCategoryId, products } = useAppStore()
  // Read initial query from store (set by other screens before navigation)
  const initialQuery = useRef(useAppStore.getState().searchQuery || "")
  const [query, setQuery] = useState(initialQuery.current)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.current)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Clear store's searchQuery after consuming it
  useEffect(() => {
    if (initialQuery.current) {
      useAppStore.getState().setSearchQuery("")
      initialQuery.current = ""
    }
  }, [])

  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value)
    }, 300)
  }, [])

  const handleSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      addSearchHistory(trimmed)
      setDebouncedQuery(trimmed)
    }
  }, [addSearchHistory])

  const handleClearQuery = useCallback(() => {
    setQuery("")
    setDebouncedQuery("")
    inputRef.current?.focus()
  }, [])

  const handleTrendingClick = useCallback((term: string) => {
    setQuery(term)
    setDebouncedQuery(term)
    addSearchHistory(term)
  }, [addSearchHistory])

  const handleHistoryClick = useCallback((term: string) => {
    setQuery(term)
    setDebouncedQuery(term)
  }, [])

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product.id)
    navigate("product-detail")
  }, [setSelectedProduct, navigate])

  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId)
    navigate("category")
  }, [setSelectedCategory, navigate])

  const searchResults = useMemo(() => {
    let results = products

    // Filter by selectedCategoryId if set (coming from category screen)
    if (selectedCategoryId) {
      results = results.filter(p => p.categoryId === selectedCategoryId)
    }

    if (!debouncedQuery.trim()) {
      return selectedCategoryId ? results : []
    }

    const q = debouncedQuery.toLowerCase()
    const isFlashSaleSearch = q.includes("flash sale") || q.includes("flashsale")

    return results.filter((p) => {
      // If searching for flash sale, include all flash sale products
      if (isFlashSaleSearch && p.isFlashSale) return true

      // Normal search
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.name.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)) ||
        p.seller.storeName.toLowerCase().includes(q)
      )
    })
  }, [debouncedQuery, selectedCategoryId, products])

  const recentProducts = useMemo(() => products.slice(0, 6), [products])

  const isSearching = debouncedQuery.trim().length > 0

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Sticky Search Bar */}
      <div className="sticky top-0 z-40 glass">
        <div className="flex items-center gap-2 h-14 px-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("home")}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(query)
              }}
              placeholder="Cari produk, kategori, atau toko..."
              className="pl-9 pr-9 h-10 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
            {query && (
              <button
                onClick={handleClearQuery}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {query.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => handleSearch(query)}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex-shrink-0"
            >
              Cari
            </motion.button>
          )}
        </div>
      </div>

      <div className="flex-1 pb-20">
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {searchResults.length > 0 ? (
                <div className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Ditemukan <span className="font-semibold text-foreground">{searchResults.length}</span> produk untuk &quot;{debouncedQuery}&quot;
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {searchResults.map((product, idx) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <ProductCard
                          product={product}
                          onClick={() => handleProductClick(product)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Search className="w-10 h-10 text-muted-foreground" />}
                  title="Produk Tidak Ditemukan"
                  subtitle={`Tidak ada hasil untuk "${debouncedQuery}". Coba kata kunci lain.`}
                  actionLabel="Cari Lain"
                  onAction={handleClearQuery}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="default"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Search History */}
              {searchHistory.length > 0 && (
                <div className="px-4 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <SectionHeader
                      title="Pencarian Terakhir"
                      icon={<Clock className="w-4 h-4" />}
                    />
                    <button
                      onClick={clearSearchHistory}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((term, idx) => (
                      <motion.button
                        key={`${term}-${idx}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleHistoryClick(term)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/70 hover:bg-muted text-sm text-foreground transition-colors"
                      >
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{term}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Searches */}
              <div className="px-4">
                <SectionHeader
                  title="Trending 🔥"
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <div className="mt-3 space-y-1">
                  {TRENDING_SEARCHES.map((term, idx) => (
                    <motion.button
                      key={term}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleTrendingClick(term)}
                      className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold ${
                          idx < 3
                            ? "bg-emerald-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-left text-sm text-foreground">{term}</span>
                      {idx < 3 && (
                        <Flame className="w-4 h-4 text-orange-500" />
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Category Grid */}
              <div className="px-4">
                <SectionHeader
                  title="Kategori"
                  icon={<Search className="w-4 h-4" />}
                  actionLabel="Semua"
                  onAction={() => navigate("category")}
                />
                <div className="grid grid-cols-4 gap-3 mt-3">
                  {MOCK_CATEGORIES.slice(0, 8).map((cat) => (
                    <motion.button
                      key={cat.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCategoryClick(cat.id)}
                      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-xl">
                        {cat.icon || "📦"}
                      </div>
                      <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2">
                        {cat.name}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Recent Products */}
              <div className="px-4 pb-4">
                <SectionHeader
                  title="Terakhir Dilihat"
                  icon={<Clock className="w-4 h-4" />}
                  actionLabel="Lihat Semua"
                  onAction={() => navigate("home")}
                />
                <div className="flex gap-3 overflow-x-auto no-scrollbar mt-3 -mx-4 px-4">
                  {recentProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleProductClick(product)}
                      className="flex-shrink-0 w-32 cursor-pointer"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-1.5">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
                            <span className="text-lg font-bold text-emerald-600">
                              {product.name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] font-medium line-clamp-2 leading-tight">{product.name}</p>
                      <p className="text-xs font-bold text-emerald-600 mt-0.5">
                        {formatPrice(product.discountPrice || product.price)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
