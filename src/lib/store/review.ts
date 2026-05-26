import type { StateCreator } from 'zustand'
import type { ReviewSlice, AppStore } from './types'
import type { Review } from '../types'
import { getAuthHeaders } from './getAuthHeaders'

export const createReviewSlice: StateCreator<AppStore, [], [], ReviewSlice> = (set, get) => ({
  reviews: [],
  reviewedOrderIds: [],
  addReview: (review, orderId) => {
    // Call the API to persist the review
    fetch('/api/reviews', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        productId: review.productId,
        rating: review.rating,
        content: review.content,
        images: review.images,
      }),
    }).catch((error) => {
      console.error('Create review API error:', error)
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
      const res = await fetch(`/api/reviews?productId=${productId}`)
      if (!res.ok) throw new Error('Failed to fetch product reviews')
      const data = await res.json()
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
      console.error('Fetch product reviews error:', error)
    }
  },
})
