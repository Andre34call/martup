"use client"

import { motion } from "framer-motion"
import { Plus, Box, AlertTriangle, Edit, Trash2, Eye, EyeOff, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { apiClient } from '@/lib/api-client'
import { formatPrice } from "@/lib/utils"
import { stagger } from '@/lib/animations'
import { PageHeader, SearchBar, EmptyState } from "../shared"
import { useState, useEffect, useCallback } from "react"
import type { Product } from "@/lib/types"

// Raw API product type for seller products endpoint
interface RawSellerProduct {
  id: string
  sellerId: string
  categoryId: string
  name: string
  slug: string
  description: string
  price: number
  discountPrice?: number | null
  images: string[] | string
  videoUrl?: string | null
  stock: number
  sold: number
  minOrder?: number
  weight: number | null
  condition?: string
  productType?: string
  serviceDuration?: string | null
  serviceLocation?: string | null
  status: string
  rating: number
  reviewCount: number
  isFeatured: boolean
  isFlashSale: boolean
  flashSaleEnd?: string | null
  tags?: string[] | string | null
  variants?: Array<{
    id: string
    productId: string
    name: string
    value: string
    sku?: string | null
    price?: number | null
    stock: number
    image?: string | null
  }>
  category?: {
    id: string
    name: string
    slug: string
  }
}

function mapRawSellerProduct(p: RawSellerProduct): Product {
  return {
    id: p.id,
    sellerId: p.sellerId,
    categoryId: p.categoryId,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    discountPrice: p.discountPrice || undefined,
    images: Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? JSON.parse(p.images) : []),
    stock: p.stock,
    sold: p.sold,
    minOrder: p.minOrder || 1,
    weight: p.weight,
    condition: (p.condition as 'new' | 'used') || 'new',
    productType: (p.productType as 'product' | 'jasa') || 'product',
    serviceDuration: p.serviceDuration || undefined,
    serviceLocation: p.serviceLocation || undefined,
    status: p.status as 'active' | 'draft' | 'blocked',
    rating: p.rating,
    reviewCount: p.reviewCount,
    isFeatured: p.isFeatured,
    isFlashSale: p.isFlashSale,
    flashSaleEnd: p.flashSaleEnd || undefined,
    tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : undefined),
    variants: (p.variants || []).map(v => ({
      id: v.id,
      productId: v.productId,
      name: v.name,
      value: v.value,
      sku: v.sku || undefined,
      price: v.price || undefined,
      stock: v.stock,
      image: v.image || undefined,
    })),
    category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : { id: '', name: 'Uncategorized', slug: 'uncategorized' },
    seller: {
      id: '',
      userId: '',
      storeName: 'Unknown Seller',
      storeSlug: '',
      isVerified: false,
      isPremium: false,
      rating: 0,
      totalSales: 0,
      totalProducts: 0,
    },
  }
}

export function SellerProducts() {
  const { navigate, showToast, removeProduct, setSelectedProduct, seller } = useAppStore()
  const [search, setSearch] = useState("")

  // Fix 4: Fetch from server API instead of local store
  const sellerId = seller?.id || ''
  const [sellerProducts, setSellerProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchSellerProducts = useCallback(async () => {
    if (!sellerId) return
    setIsLoading(true)
    try {
      const data = await apiClient.get<{ success: boolean; data: RawSellerProduct[] }>('/api/seller/products', { sellerId })
      const products = (data.data || []).map(mapRawSellerProduct)
      setSellerProducts(products)
    } catch (error) {
      // Fallback: use local store products
      const localProducts = useAppStore.getState().products.filter(p => p.sellerId === sellerId)
      setSellerProducts(localProducts)
    } finally {
      setIsLoading(false)
    }
  }, [sellerId])

  useEffect(() => {
    fetchSellerProducts()
  }, [fetchSellerProducts])

  const filtered = sellerProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Fix 1: Toggle product visibility (active ↔ draft)
  const handleToggleStatus = async (product: Product) => {
    const newStatus = product.status === 'active' ? 'draft' : 'active'
    setTogglingId(product.id)
    try {
      const res = await apiClient.rawPut('/api/seller/products', {
        productId: product.id,
        status: newStatus,
      })
      const data = await res.json()
      if (data.success) {
        showToast(newStatus === 'active' ? "Produk diaktifkan" : "Produk disimpan sebagai draft", "success")
        // Update local list
        setSellerProducts(prev => prev.map(p =>
          p.id === product.id ? { ...p, status: newStatus as 'active' | 'draft' } : p
        ))
      } else {
        showToast(data.error || "Gagal mengubah status produk", "error")
      }
    } catch {
      showToast("Gagal mengubah status produk", "error")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="pb-20">
      <PageHeader title="Kelola Produk" rightAction={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 rounded-xl"
            onClick={fetchSellerProducts}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => navigate("seller-add-product")}
            className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-9 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
          </Button>
        </div>
      } />

      <div className="px-4 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Cari produk..." />

        {isLoading && sellerProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-muted-foreground">Memuat produk...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Box className="w-10 h-10 text-muted-foreground" />}
            title="Produk Tidak Ditemukan"
            subtitle={sellerProducts.length === 0 ? "Belum ada produk. Tambahkan produk pertama Anda." : "Coba kata kunci lain"}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((product, i) => (
              <motion.div key={product.id} custom={i} variants={stagger} initial="initial" animate="animate">
                <Card className="p-3">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Box className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-1">{product.name}</p>
                          {product.productType === 'jasa' ? (
                            <Badge className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0 rounded flex-shrink-0">
                              Tolong Mas
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 border-border text-muted-foreground flex-shrink-0">
                              Barang
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${product.status === "active" ? "border-emerald-300 text-emerald-600" : "border-amber-300 text-amber-600"}`}>
                          {product.status === "active" ? "Aktif" : "Draft"}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatPrice(product.discountPrice || product.price)}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">Stok: {product.stock}</span>
                        {product.stock < 10 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <AlertTriangle className="w-2.5 h-2.5" /> Stok Rendah
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{product.sold} terjual</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    {/* Fix 1: Toggle visibility button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-lg gap-1"
                      disabled={togglingId === product.id}
                      onClick={() => handleToggleStatus(product)}
                      title={product.status === 'active' ? 'Set Draft' : 'Set Active'}
                    >
                      {togglingId === product.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : product.status === 'active' ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">{product.status === 'active' ? 'Draft' : 'Aktif'}</span>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-lg" onClick={() => {
                      setSelectedProduct(product.id)
                      navigate("seller-add-product")
                    }}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={async () => {
                      if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return
                      try {
                        const res = await apiClient.rawDelete('/api/seller/products', { productId: product.id })
                        const data = await res.json()
                        if (data.success) {
                          removeProduct(product.id)
                          setSellerProducts(prev => prev.filter(p => p.id !== product.id))
                          showToast("Produk berhasil dihapus", "success")
                        } else {
                          showToast(data.error || "Gagal menghapus produk", "error")
                        }
                      } catch {
                        showToast("Gagal menghapus produk", "error")
                      }
                    }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
