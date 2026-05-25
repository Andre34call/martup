// ==================== BACKWARD-COMPATIBLE RE-EXPORT ====================
// This file re-exports everything from the modularized store directory.
// All existing imports from '@/lib/store' continue to work unchanged.

export { useAppStore, useCartStore, useWishlistStore, getAuthHeaders } from './store/index'
