"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore, useWishlistStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, ProductCard, EmptyState, SearchBar, SectionHeader } from "./shared"
import type { Product } from "@/lib/types"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { ArrowLeft, Search, X, Clock, TrendingUp, Flame, Trash2, ChevronRight, Loader2, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiClient } from '@/lib/api-client'

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

interface SearchFacetCategory {
  slug: string
  name: string
  count: number
}

interface SearchFacetCondition {
  value: string
  count: number
}

interface SearchFacets {
  categories: SearchFacetCategory[]
  priceRange: { min: number; max: number }
  conditions: SearchFacetCondition[]
}

interface SearchPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface SearchResult {
  products: Product[]
  pagination: SearchPagination
  facets: SearchFacets
  query: string
}

type SearchApiResponse = { success: boolean; data: SearchResult; error?: string }

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'rating'

const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Relevan',
  price_asc: 'Harga Terendah',
  price_desc: 'Harga Tertinggi',
  newest: 'Terbaru',
  popular: 'Terpopuler',
  rating: 'Rating Tertinggi',
}

export function SearchScreen() {
  const { searchHistory, addSearchHistory, clearSearchHistory, navigate, setSelectedProduct, setSelectedCategory, selectedCategoryId, categories } = useAppStore()
  // Read initial query from store (set by other screens before navigation)
  const initialQuery = useRef(useAppStore.getState().searchQuery || "")
  const [query, setQuery] = useState(initialQuery.current)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.current)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Search API state
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('relevance')
  const [conditionFilter, setConditionFilter] = useState<string | null>(null)
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)

  // UI state
  const [showFilters, setShowFilters] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

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

  // Set category from navigation
  useEffect(() => {
    if (selectedCategoryId) {
      const cat = categories.find(c => c.id === selectedCategoryId)
      if (cat?.slug) {
        setSelectedCategorySlug(cat.slug)
      }
    }
  }, [selectedCategoryId, categories])

  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value)
      setCurrentPage(1)
    }, 300)
  }, [])

  const handleSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      addSearchHistory(trimmed)
      setDebouncedQuery(trimmed)
      setCurrentPage(1)
    }
  }, [addSearchHistory])

  const handleClearQuery = useCallback(() => {
    setQuery("")
    setDebouncedQuery("")
    setSearchResult(null)
    setError(null)
    setSelectedCategorySlug(null)
    setConditionFilter(null)
    setMinPrice("")
    setMaxPrice("")
    setSortBy('relevance')
    setCurrentPage(1)
    inputRef.current?.focus()
  }, [])

  const handleTrendingClick = useCallback((term: string) => {
    setQuery(term)
    setDebouncedQuery(term)
    addSearchHistory(term)
    setCurrentPage(1)
  }, [addSearchHistory])

  const handleHistoryClick = useCallback((term: string) => {
    setQuery(term)
    setDebouncedQuery(term)
    setCurrentPage(1)
  }, [])

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product.id)
    navigate("product-detail")
  }, [setSelectedProduct, navigate])

  const handleCategoryClick = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId)
    navigate("category")
  }, [setSelectedCategory, navigate])

  // Fetch search results from API
  useEffect(() => {
    // Don't search if query is too short
    if (debouncedQuery.trim().length < 2) {
      setSearchResult(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const fetchSearch = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const params: Record<string, string | undefined> = {
          q: debouncedQuery.trim(),
          category: selectedCategorySlug || undefined,
          sortBy: sortBy !== 'relevance' ? sortBy : undefined,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
          condition: conditionFilter || undefined,
          page: String(currentPage),
          limit: '20',
        }

        const data = await apiClient.get<SearchApiResponse>('/api/search', params)

        if (cancelled) return

        if (data.success && data.data) {
          setSearchResult(data.data)
        } else {
          setSearchResult(null)
        }
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat mencari'
        setError(message)
        setSearchResult(null)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchSearch()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, selectedCategorySlug, sortBy, minPrice, maxPrice, conditionFilter, currentPage])

  // Reset page when filters change (not page itself)
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategorySlug, sortBy, conditionFilter, minPrice, maxPrice])

  const isSearching = debouncedQuery.trim().length >= 2

  // Map search result products to match Product type expected by ProductCard
  const searchProducts = useMemo(() => {
    if (!searchResult?.products) return []
    return searchResult.products.map((p: any) => ({
      id: p.id as string,
      sellerId: (p.sellerId as string) || '',
      categoryId: (p.categoryId as string) || '',
      name: (p.name as string) || '',
      slug: (p.slug as string) || '',
      description: (p.description as string) || '',
      price: Number(p.price) || 0,
      discountPrice: p.discountPrice ? Number(p.discountPrice) : undefined,
      images: Array.isArray(p.images) ? p.images as string[] : [],
      videoUrl: p.videoUrl as string | undefined,
      stock: Number(p.stock) || 0,
      sold: Number(p.sold) || 0,
      minOrder: Number(p.minOrder) || 1,
      weight: Number(p.weight) || 0,
      condition: (p.condition as 'new' | 'used') || 'new',
      status: (p.status as 'active' | 'draft' | 'blocked') || 'active',
      rating: Number(p.rating) || 0,
      reviewCount: Number(p.reviewCount) || 0,
      isFeatured: Boolean(p.isFeatured),
      isFlashSale: Boolean(p.isFlashSale),
      flashSaleEnd: p.flashSaleEnd as string | undefined,
      tags: Array.isArray(p.tags) ? p.tags as string[] : undefined,
      variants: Array.isArray(p.variants)
        ? (p.variants as Record<string, unknown>[]).map(v => ({
            id: v.id as string,
            productId: v.productId as string,
            name: v.name as string,
            value: v.value as string,
            sku: v.sku as string | undefined,
            price: v.price ? Number(v.price) : undefined,
            stock: Number(v.stock) || 0,
            image: v.image as string | undefined,
          }))
        : [],
      seller: p.seller
        ? {
            id: (p.seller as Record<string, unknown>).id as string,
            storeName: (p.seller as Record<string, unknown>).storeName as string || 'Toko',
            storeSlug: (p.seller as Record<string, unknown>).storeSlug as string || '',
            storeAvatar: (p.seller as Record<string, unknown>).storeAvatar as string | undefined,
            storeDesc: (p.seller as Record<string, unknown>).storeDesc as string | undefined,
            isVerified: Boolean((p.seller as Record<string, unknown>).isVerified),
            isPremium: Boolean((p.seller as Record<string, unknown>).isPremium),
            rating: Number((p.seller as Record<string, unknown>).rating) || 0,
            totalSales: Number((p.seller as Record<string, unknown>).totalSales) || 0,
            totalProducts: Number((p.seller as Record<string, unknown>).totalProducts) || 0,
            responseTime: (p.seller as Record<string, unknown>).responseTime as number | undefined,
          }
        : {
            id: '',
            storeName: 'Toko',
            storeSlug: '',
            isVerified: false,
            isPremium: false,
            rating: 0,
            totalSales: 0,
            totalProducts: 0,
          },
      category: p.category
        ? {
            id: (p.category as Record<string, unknown>).id as string,
            name: (p.category as Record<string, unknown>).name as string || '',
            slug: (p.category as Record<string, unknown>).slug as string || '',
            icon: (p.category as Record<string, unknown>).icon as string | undefined,
          }
        : {
            id: '',
            name: '',
            slug: '',
          },
    })) as Product[]
  }, [searchResult])

  const { products: allStoreProducts } = useAppStore()
  const recentProducts = useMemo(() => allStoreProducts.slice(0, 6), [allStoreProducts])

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
              {/* Filter & Sort Bar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-background/80">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs gap-1"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Filter
                  {(selectedCategorySlug || conditionFilter || minPrice || maxPrice) && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">
                      {(selectedCategorySlug ? 1 : 0) + (conditionFilter ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0)}
                    </span>
                  )}
                </Button>

                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs gap-1"
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                  >
                    {SORT_LABELS[sortBy]}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  {showSortDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 min-w-[160px] py-1">
                      {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSortBy(key)
                            setShowSortDropdown(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${
                            sortBy === key ? 'text-emerald-600 font-medium' : 'text-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {(selectedCategorySlug || conditionFilter || minPrice || maxPrice) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs text-red-500 hover:text-red-600"
                    onClick={() => {
                      setSelectedCategorySlug(null)
                      setConditionFilter(null)
                      setMinPrice("")
                      setMaxPrice("")
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>

              {/* Expanded Filters Panel */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-border/30"
                  >
                    <div className="px-4 py-3 space-y-3">
                      {/* Category Facets */}
                      {searchResult?.facets?.categories && searchResult.facets.categories.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-2">Kategori</p>
                          <div className="flex flex-wrap gap-2">
                            {searchResult.facets.categories.map(cat => (
                              <button
                                key={cat.slug}
                                onClick={() => setSelectedCategorySlug(selectedCategorySlug === cat.slug ? null : cat.slug)}
                                className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                                  selectedCategorySlug === cat.slug
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-muted hover:bg-muted/80 text-foreground'
                                }`}
                              >
                                {cat.name} ({cat.count})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Condition Facets */}
                      {searchResult?.facets?.conditions && searchResult.facets.conditions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-2">Kondisi</p>
                          <div className="flex flex-wrap gap-2">
                            {searchResult.facets.conditions.map(cond => (
                              <button
                                key={cond.value}
                                onClick={() => setConditionFilter(conditionFilter === cond.value ? null : cond.value)}
                                className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                                  conditionFilter === cond.value
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-muted hover:bg-muted/80 text-foreground'
                                }`}
                              >
                                {cond.value === 'new' ? 'Baru' : 'Bekas'} ({cond.count})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Price Range */}
                      <div>
                        <p className="text-xs font-medium text-foreground mb-2">Rentang Harga</p>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={minPrice}
                            onChange={e => setMinPrice(e.target.value)}
                            className="h-8 text-xs rounded-lg flex-1"
                          />
                          <span className="text-xs text-muted-foreground">—</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            value={maxPrice}
                            onChange={e => setMaxPrice(e.target.value)}
                            className="h-8 text-xs rounded-lg flex-1"
                          />
                        </div>
                        {searchResult?.facets?.priceRange && searchResult.facets.priceRange.min > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatPrice(searchResult.facets.priceRange.min)} - {formatPrice(searchResult.facets.priceRange.max)}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    <p className="text-sm text-muted-foreground">Mencari...</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div className="px-4 py-8">
                  <EmptyState
                    icon={<Search className="w-10 h-10 text-muted-foreground" />}
                    title="Gagal Mencari"
                    subtitle={error}
                    actionLabel="Coba Lagi"
                    onAction={() => {
                      setError(null)
                      setDebouncedQuery(debouncedQuery)
                    }}
                  />
                </div>
              )}

              {/* Search Results */}
              {!isLoading && !error && (
                <>
                  {searchProducts.length > 0 ? (
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Ditemukan <span className="font-semibold text-foreground">{searchResult?.pagination?.total || searchProducts.length}</span> produk untuk &quot;{debouncedQuery}&quot;
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {searchProducts.map((product, idx) => (
                          <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                          >
                            <ProductCard
                              product={product}
                              onClick={() => handleProductClick(product)}
                            />
                          </motion.div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {searchResult?.pagination && searchResult.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          >
                            Sebelumnya
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from(
                              { length: Math.min(searchResult.pagination.totalPages, 5) },
                              (_, i) => {
                                let pageNum: number
                                if (searchResult.pagination.totalPages <= 5) {
                                  pageNum = i + 1
                                } else if (currentPage <= 3) {
                                  pageNum = i + 1
                                } else if (currentPage >= searchResult.pagination.totalPages - 2) {
                                  pageNum = searchResult.pagination.totalPages - 4 + i
                                } else {
                                  pageNum = currentPage - 2 + i
                                }
                                return (
                                  <Button
                                    key={pageNum}
                                    variant={currentPage === pageNum ? "default" : "outline"}
                                    size="sm"
                                    className={`h-8 w-8 rounded-lg text-xs p-0 ${
                                      currentPage === pageNum ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : ''
                                    }`}
                                    onClick={() => setCurrentPage(pageNum)}
                                  >
                                    {pageNum}
                                  </Button>
                                )
                              }
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={currentPage >= searchResult.pagination.totalPages}
                            onClick={() => setCurrentPage(p => Math.min(searchResult.pagination.totalPages, p + 1))}
                          >
                            Selanjutnya
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : debouncedQuery.trim().length >= 2 && searchResult !== null ? (
                    <EmptyState
                      icon={<Search className="w-10 h-10 text-muted-foreground" />}
                      title="Produk Tidak Ditemukan"
                      subtitle={`Tidak ada hasil untuk "${debouncedQuery}". Coba kata kunci lain.`}
                      actionLabel="Cari Lain"
                      onAction={handleClearQuery}
                    />
                  ) : debouncedQuery.trim().length >= 2 && searchResult === null && !isLoading ? null : null}
                </>
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
                  {categories.slice(0, 8).map((cat) => (
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
