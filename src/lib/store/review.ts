import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { ReviewSlice, AppStore } from './types'
import type { Review } from '../types'
import { apiClient } from '@/lib/api-client'

// API response types
type ProductReviewsResponse = { success?: boolean; data?: any[]; [key: string]: any }

export const createReviewSlice: StateCreator<AppStore, [], [], ReviewSlice> = (set, get) => ({
  reviews: [],
  reviewedOrderIds: [],
  addReview: (review, orderId) => {
    // Call the API to persist the review (fire-and-forget)
    apiClient.post('/api/reviews', {
      productId: review.productId,
      rating: review.rating,
      content: review.content,
      images: review.images,
    }).catch((error) => {
      logger.warn({ component: 'review', err: error }, 'Create review API error')
    })

    // Also update local state for immediate UI feedback
    return set((state) => {
      const updatedProducts = state.products.map(p => {
        if (p.id !== review.productId) return p
        const productReviews = [...state.reviews.filter(r => r.productId === p.id), review]
        const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
        return { ...p, rating: Math.round(avgRating * 10) / 10, reviewCount: p.reviewCount + 1 }
      })
      return {
        reviews: [review, ...state.reviews],
        reviewedOrderIds: [...state.reviewedOrderIds, orderId],
        products: updatedProducts,
      }
    })
  },
  deleteReview: (reviewId) => set((state) => {
    const review = state.reviews.find(r => r.id === reviewId)
    if (!review) return state

    const remainingReviews = state.reviews.filter(r => r.id !== reviewId)
    const updatedProducts = state.products.map(p => {
      if (p.id !== review.productId) return p
      const productReviews = remainingReviews.filter(r => r.productId === p.id)
      const avgRating = productReviews.length > 0
        ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
        : 0
      return {
        ...p,
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: Math.max(0, p.reviewCount - 1),
      }
    })

    return {
      reviews: state.reviews.filter(r => r.id !== reviewId),
      products: updatedProducts,
    }
  }),
  updateReview: (reviewId, updates) => set((state) => {
    const review = state.reviews.find(r => r.id === reviewId)
    if (!review) return state

    const updatedReviews = state.reviews.map(r =>
      r.id === reviewId ? { ...r, ...updates } : r
    )

    const productId = review.productId
    const updatedProducts = state.products.map(p => {
      if (p.id !== productId) return p
      const productReviews = updatedReviews.filter(r => r.productId === p.id)
      const avgRating = productReviews.length > 0
        ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
        : 0
      return { ...p, rating: Math.round(avgRating * 10) / 10 }
    })

    return {
      reviews: updatedReviews,
      products: updatedProducts,
    }
  }),
  fetchProductReviews: async (productId) => {
    try {
      const data = await apiClient.get<ProductReviewsResponse>('/api/reviews', { productId })
      if (data.success && data.data) {
        const reviews: Review[] = (data.data as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => {
          const user = r.user as Record<string, unknown> | undefined
          return {
            id: r.id as string,
            userId: r.userId as string,
            productId: r.productId as string,
            rating: r.rating as number,
            content: r.content as string || undefined,
            images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images as string[]) || undefined,
            userName: (user?.name as string) || 'User',
            userAvatar: (user?.avatar as string) || undefined,
            createdAt: r.createdAt as string,
          }
        })
        set((state) => {
          // Replace reviews for this product, keep others
          const otherReviews = state.reviews.filter(r => r.productId !== productId)
          return { reviews: [...reviews, ...otherReviews] }
        })
      }
    } catch (error) {
      logger.warn({ component: 'review', err: error }, 'Fetch product reviews error')
    }
  },
})
