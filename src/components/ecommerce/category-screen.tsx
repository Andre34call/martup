"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { MOCK_CATEGORIES } from "@/lib/mock-data"
import { PageHeader, SearchBar, EmptyState } from "./shared"
import type { Category } from "@/lib/types"
import { useState, useMemo, useCallback } from "react"
import {
  Grid3X3, ChevronRight, ArrowLeft, Search, Package
} from "lucide-react"
import { Button } from "@/components/ui/button"

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

// ==================== CATEGORY SCREEN ====================
export function CategoryScreen() {
  const { navigate, setSelectedCategory, setSearchQuery: setStoreSearchQuery } = useAppStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_CATEGORIES
    const q = searchQuery.toLowerCase()
    return MOCK_CATEGORIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null
    return MOCK_CATEGORIES.find((c) => c.id === selectedCategoryId) || null
  }, [selectedCategoryId])

  const subCategories = useMemo(() => {
    if (!selectedCategoryId) return []
    return SUB_CATEGORIES[selectedCategoryId] || []
  }, [selectedCategoryId])

  const handleCategoryTap = useCallback((categoryId: string) => {
    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId(null)
    } else {
      setSelectedCategoryId(categoryId)
    }
  }, [selectedCategoryId])

  const handleSubCategoryTap = useCallback((subCat: Category) => {
    setSelectedCategory(subCat.id)
    setStoreSearchQuery(subCat.name)
    navigate("search")
  }, [setSelectedCategory, setStoreSearchQuery, navigate])

  const handleBackFromSub = useCallback(() => {
    setSelectedCategoryId(null)
  }, [])

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
        <div className="px-4">
          {filteredCategories.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {filteredCategories.map((category, idx) => (
                <motion.button
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCategoryTap(category.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all ${
                    selectedCategoryId === category.id
                      ? "bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500"
                      : "bg-card border border-border/50 hover:bg-muted/30"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                    selectedCategoryId === category.id
                      ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : "bg-muted"
                  }`}>
                    {category.icon || "📦"}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${
                    selectedCategoryId === category.id ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                  }`}>
                    {category.name}
                  </span>
                  {category.productCount && (
                    <span className="text-[8px] text-muted-foreground">
                      {category.productCount.toLocaleString()} produk
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Grid3X3 className="w-10 h-10 text-muted-foreground" />}
              title="Kategori Tidak Ditemukan"
              subtitle="Coba kata kunci lain untuk mencari kategori"
            />
          )}
        </div>

        {/* Sub Categories Panel */}
        <AnimatePresence>
          {selectedCategoryId && selectedCategory && subCategories.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{selectedCategory.icon}</span>
                    <h3 className="text-base font-bold text-foreground">{selectedCategory.name}</h3>
                  </div>
                  <button
                    onClick={handleBackFromSub}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Tutup
                  </button>
                </div>
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  {subCategories.map((subCat, idx) => (
                    <motion.button
                      key={subCat.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSubCategoryTap(subCat)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-base flex-shrink-0">
                        {subCat.icon || "📦"}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-foreground">{subCat.name}</p>
                        {subCat.productCount && (
                          <p className="text-[10px] text-muted-foreground">
                            {subCat.productCount.toLocaleString()} produk
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </motion.button>
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
