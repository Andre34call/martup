import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { ProductSlice, AppStore } from './types'
import type { Product, ProductVariant, Category, Seller } from '../types'
import { apiClient } from '@/lib/api-client'

// Raw API types for product and category data
interface RawProductVariant {
  id: string
  productId: string
  name: string
  value: string
  sku?: string
  price?: number
  stock: number
  image?: string
}

interface RawProductSeller {
  id: string
  userId: string
  storeName: string
  storeSlug: string
  storeAvatar?: string
  storeDesc?: string
  isVerified: boolean
  isPremium: boolean
  rating: number
  totalSales: number
  totalProducts: number
  responseTime?: number
  bankName?: string
  bankAccount?: string
  bankHolder?: string
  autoReply?: string
}

interface RawProductCategory {
  id: string
  name: string
  slug: string
  icon?: string
  image?: string
}

interface RawProduct {
  id: string
  sellerId: string
  categoryId: string
  name: string
  slug: string
  description: string
  price: number
  discountPrice?: number
  images: string[] | string
  stock: number
  sold: number
  minOrder?: number
  weight: number
  condition?: string
  status: string
  rating: number
  reviewCount: number
  isFeatured: boolean
  isFlashSale: boolean
  flashSaleEnd?: string
  tags?: string[] | string
  variants?: RawProductVariant[]
  seller?: RawProductSeller
  category?: RawProductCategory
}

interface RawCategory {
  id: string
  name: string
  slug: string
  icon?: string
  image?: string
  parentId?: string | null
  productCount?: number
  _count?: { products?: number }
  children?: RawCategory[]
}

// API response types
type ProductsApiResponse = { data?: RawProduct[]; products?: RawProduct[]; [key: string]: unknown }
type CategoriesApiResponse = { data?: RawCategory[]; categories?: RawCategory[]; [key: string]: unknown }

export const createProductSlice: StateCreator<AppStore, [], [], ProductSlice> = (set, get) => ({
  products: [],
  addProduct: (product) => set((state) => ({
    products: [product, ...state.products]
  })),
  updateProduct: (product) => set((state) => ({
    products: state.products.map(p => p.id === product.id ? product : p)
  })),
  removeProduct: (id) => set((state) => ({
    products: state.products.filter(p => p.id !== id)
  })),
  categories: [],
  fetchProducts: async () => {
    try {
      const data = await apiClient.get<ProductsApiResponse>('/api/products', { limit: '100' })

      const products: Product[] = (data.data || data.products || []).map((p: RawProduct): Product => ({
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
        status: p.status as 'active' | 'draft' | 'blocked',
        rating: p.rating,
        reviewCount: p.reviewCount,
        isFeatured: p.isFeatured,
        isFlashSale: p.isFlashSale,
        flashSaleEnd: p.flashSaleEnd || undefined,
        tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : undefined),
        variants: (p.variants || []).map((v: RawProductVariant): ProductVariant => ({
          id: v.id,
          productId: v.productId,
          name: v.name,
          value: v.value,
          sku: v.sku || undefined,
          price: v.price || undefined,
          stock: v.stock,
          image: v.image || undefined,
        })),
        seller: p.seller ? {
          id: p.seller.id,
          userId: p.seller.userId,
          storeName: p.seller.storeName,
          storeSlug: p.seller.storeSlug,
          storeAvatar: p.seller.storeAvatar || undefined,
          storeDesc: p.seller.storeDesc || undefined,
          isVerified: p.seller.isVerified,
          isPremium: p.seller.isPremium,
          rating: p.seller.rating,
          totalSales: p.seller.totalSales,
          totalProducts: p.seller.totalProducts,
          responseTime: p.seller.responseTime || undefined,
          bankName: p.seller.bankName || undefined,
          bankAccount: p.seller.bankAccount || undefined,
          bankHolder: p.seller.bankHolder || undefined,
          autoReply: p.seller.autoReply || undefined,
        } as Seller : {
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
        category: p.category ? {
          id: p.category.id,
          name: p.category.name,
          slug: p.category.slug,
          icon: p.category.icon || undefined,
          image: p.category.image || undefined,
        } : {
          id: '',
          name: 'Uncategorized',
          slug: 'uncategorized',
        },
      }))

      set({ products })
    } catch (error) {
      logger.warn({ component: 'product', err: error }, 'Failed to fetch products')
    }
  },
  fetchCategories: async () => {
    try {
      const data = await apiClient.get<CategoriesApiResponse>('/api/categories')

      const mapCategory = (c: RawCategory): Category => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon || undefined,
        image: c.image || undefined,
        parentId: c.parentId || undefined,
        productCount: c.productCount || c._count?.products || 0,
        children: (c.children || []).map(mapCategory),
      })

      set({ categories: (data.data || data.categories || []).map(mapCategory) })
    } catch (error) {
      logger.warn({ component: 'product', err: error }, 'Failed to fetch categories')
    }
  },
})
