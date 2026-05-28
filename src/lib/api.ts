// API Client for MartUp - handles all communication with the backend

import type { User, Seller, Product, Category, CartItem, Order, ChatRoom, ChatMessage, Notification, Voucher, Address, WalletMutation, SellerStats } from './types'

const API_BASE = '/api'

function getAuthHeaders(): HeadersInit {
  const userId = typeof window !== 'undefined' ? localStorage.getItem('martup_user_id') : null
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ==================== AUTH ====================
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ user: User; seller?: Seller; wallet: { balance: number; holdBalance: number }; addresses: Address[] }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { name: string; email: string; phone: string; password: string; role: string }) =>
    apiFetch<{ user: User; seller?: Seller }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () =>
    apiFetch<{ user: User; seller?: Seller; wallet: { balance: number; holdBalance: number }; addresses: Address[] }>('/auth/me'),
}

// ==================== PRODUCTS ====================
export const productsApi = {
  list: (params?: { categoryId?: string; search?: string; minPrice?: number; maxPrice?: number; sort?: string; condition?: string; sellerId?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.set(k, String(v)) })
    }
    return apiFetch<{ products: Product[]; total: number; page: number; totalPages: number }>(`/products?${query.toString()}`)
  },

  get: (id: string) =>
    apiFetch<{ product: Product }>(`/products/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<{ product: Product }>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<{ product: Product }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/products/${id}`, { method: 'DELETE' }),
}

// ==================== CATEGORIES ====================
export const categoriesApi = {
  list: () =>
    apiFetch<{ categories: Category[] }>('/categories'),
}

// ==================== CART ====================
export const cartApi = {
  get: () =>
    apiFetch<{ items: CartItem[] }>('/cart'),

  add: (productId: string, variantId?: string, quantity?: number) =>
    apiFetch<{ item: CartItem }>('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId, variantId, quantity: quantity || 1 }),
    }),

  update: (id: string, data: { quantity?: number; isChecked?: boolean }) =>
    apiFetch<{ item: CartItem }>(`/cart/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/cart/${id}`, { method: 'DELETE' }),

  clear: (ids?: string[]) =>
    apiFetch<{ success: boolean }>('/cart/clear', {
      method: 'POST',
      body: JSON.stringify({ itemIds: ids }),
    }),
}

// ==================== ORDERS ====================
export const ordersApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, String(v)) })
    }
    return apiFetch<{ orders: Order[]; total: number }>(`/orders?${query.toString()}`)
  },

  get: (id: string) =>
    apiFetch<{ order: Order }>(`/orders/${id}`),

  create: (data: {
    addressId: string
    paymentMethod: string
    items: { cartItemId: string; shippingProvider: string; shippingService: string; shippingCost: number }[]
    voucherCode?: string
    coinAmount?: number
    note?: string
  }) =>
    apiFetch<{ order: Order }>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStatus: (id: string, data: { status: string; trackingNumber?: string }) =>
    apiFetch<{ order: Order }>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  payOrder: (id: string) =>
    apiFetch<{ order: Order }>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ paymentAction: 'pay' }),
    }),
}

// ==================== CHAT ====================
export const chatApi = {
  getRooms: () =>
    apiFetch<{ rooms: ChatRoom[] }>('/chat/rooms'),

  createRoom: (sellerId: string, productId?: string) =>
    apiFetch<{ room: ChatRoom }>('/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ sellerId, productId }),
    }),

  getMessages: (roomId: string, page?: number) =>
    apiFetch<{ messages: ChatMessage[]; total: number }>(`/chat/rooms/${roomId}/messages${page ? `?page=${page}` : ''}`),

  sendMessage: (roomId: string, content: string, type?: string) =>
    apiFetch<{ message: ChatMessage }>(`/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type: type || 'text' }),
    }),
}

// ==================== SELLER ====================
export const sellerApi = {
  getStats: () =>
    apiFetch<SellerStats>('/seller/stats'),
}

// ==================== UPLOAD ====================
export const uploadApi = {
  upload: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const userId = typeof window !== 'undefined' ? localStorage.getItem('martup_user_id') : null
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: userId ? { 'x-user-id': userId } : {},
      body: formData,
    })
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },
}

// ==================== WALLET ====================
export const walletApi = {
  get: () =>
    apiFetch<{ balance: number; holdBalance: number; coins: number; mutations: WalletMutation[] }>('/wallet'),

  topUp: (amount: number) =>
    apiFetch<{ balance: number }>('/wallet', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
}

// ==================== WISHLIST ====================
export const wishlistApi = {
  list: () =>
    apiFetch<{ products: Product[] }>('/wishlist'),

  add: (productId: string) =>
    apiFetch<{ success: boolean }>('/wishlist', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),

  remove: (productId: string) =>
    apiFetch<{ success: boolean }>('/wishlist', {
      method: 'DELETE',
      body: JSON.stringify({ productId }),
    }),
}

// ==================== NOTIFICATIONS ====================
export const notificationsApi = {
  list: () =>
    apiFetch<{ notifications: Notification[] }>('/notifications'),

  markRead: (id: string) =>
    apiFetch<{ success: boolean }>('/notifications', {
      method: 'PUT',
      body: JSON.stringify({ id }),
    }),

  markAllRead: () =>
    apiFetch<{ success: boolean }>('/notifications', {
      method: 'PUT',
      body: JSON.stringify({ markAll: true }),
    }),
}

// ==================== VOUCHERS ====================
export const vouchersApi = {
  list: () =>
    apiFetch<{ vouchers: Voucher[] }>('/vouchers'),
}

// ==================== ADDRESSES ====================
export const addressesApi = {
  list: () =>
    apiFetch<{ addresses: Address[] }>('/addresses'),

  create: (data: Omit<Address, 'id'>) =>
    apiFetch<{ address: Address }>('/addresses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Address>) =>
    apiFetch<{ address: Address }>(`/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/addresses/${id}`, { method: 'DELETE' }),
}
