import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { ProductSlice, AppStore } from './types'
import type { Product } from '../types'
import { apiClient } from '@/lib/api-client'
import type { ProductsResponse, CategoriesResponse, ProductRawData, ProductVariantRawData, CategoryRawData } from '@/lib/api-types'
import { safeJsonParse } from '@/lib/store-helpers'

/** Mapped category shape matching ProductSlice['categories'][number] */
type MappedCategory = ProductSlice['categories'][number]

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
      const data = await apiClient.get<ProductsResponse>('/api/products', { limit: '100' })

      const products: Product[] = (data.data || data.products || []).map((p: ProductRawData) => ({
        id: p.id,
        sellerId: p.sellerId,
        categoryId: p.categoryId,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        discountPrice: p.discountPrice || undefined,
        images: safeJsonParse<string[]>(p.images, []),
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
        tags: safeJsonParse<string[] | undefined>(p.tags, undefined),
        variants: (p.variants || []).map((v: ProductVariantRawData) => ({
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
          id: p.seller.id as string,
          userId: p.seller.userId as string,
          storeName: p.seller.storeName as string,
          storeSlug: p.seller.storeSlug as string,
          storeAvatar: (p.seller.storeAvatar as string) || undefined,
          storeDesc: (p.seller.storeDesc as string) || undefined,
          isVerified: p.seller.isVerified as boolean,
          isPremium: p.seller.isPremium as boolean,
          rating: p.seller.rating as number,
          totalSales: p.seller.totalSales as number,
          totalProducts: p.seller.totalProducts as number,
          responseTime: (p.seller.responseTime as number) || undefined,
          bankName: (p.seller.bankName as string) || undefined,
          bankAccount: (p.seller.bankAccount as string) || undefined,
          bankHolder: (p.seller.bankHolder as string) || undefined,
          autoReply: (p.seller.autoReply as string) || undefined,
        } : {
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
          id: p.category.id as string,
          name: p.category.name as string,
          slug: p.category.slug as string,
          icon: (p.category.icon as string) || undefined,
          image: (p.category.image as string) || undefined,
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
      const data = await apiClient.get<CategoriesResponse>('/api/categories')

      const mapCategory = (c: CategoryRawData): MappedCategory => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon || undefined,
        image: c.image || undefined,
        parentId: c.parentId || null,
        productCount: c.productCount || c._count?.products || 0,
        children: (c.children || []).map(mapCategory),
      })

      set({ categories: (data.data || data.categories || []).map(mapCategory) })
    } catch (error) {
      logger.warn({ component: 'product', err: error }, 'Failed to fetch categories')
    }
  },
})
