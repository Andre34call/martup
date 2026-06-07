import { z } from 'zod'

// ==================== Auth ====================
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'), // Accept any non-empty password for login (existing users may have shorter passwords)
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
  phone: z.string().optional(),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
    .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
    .regex(/\d/, 'Password harus mengandung angka')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password harus mengandung karakter khusus (!@#$% dll)'),
  role: z.enum(['buyer', 'seller']).optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
})

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
})

// Note: resetPasswordSchema does not have an email field, so no .toLowerCase() needed
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
    .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
    .regex(/\d/, 'Password harus mengandung angka')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password harus mengandung karakter khusus (!@#$% dll)'),
})

// ==================== User ====================
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string()
    .min(8, 'Password baru minimal 8 karakter')
    .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
    .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
    .regex(/\d/, 'Password harus mengandung angka')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password harus mengandung karakter khusus (!@#$% dll)'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
})

export const twoFactorActionSchema = z.object({
  action: z.enum(['send-otp', 'enable']),
  otpCode: z.string().length(6, 'Kode OTP harus 6 digit').optional(),
})

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password wajib diisi'),
})

// ==================== Admin ====================
export const adminUpdateUserSchema = z.object({
  userId: z.string().min(1, 'User ID wajib diisi'),
  updates: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().nullable().optional(),
    role: z.enum(['buyer', 'seller', 'admin']).optional(),
    isActive: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    divisionId: z.string().nullable().optional(),
  }),
})

export const adminDeleteUserSchema = z.object({
  userId: z.string().min(1, 'User ID wajib diisi'),
})

export const adminCategoryCreateSchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi').max(100),
  icon: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const adminCategoryUpdateSchema = z.object({
  categoryId: z.string().min(1, 'Category ID wajib diisi'),
  name: z.string().min(1).max(100).optional(),
  icon: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const adminCategoryDeleteSchema = z.object({
  categoryId: z.string().min(1, 'Category ID wajib diisi'),
})

export const adminVoucherCreateSchema = z.object({
  code: z.string().min(1, 'Kode voucher wajib diisi').max(50),
  name: z.string().min(1, 'Nama voucher wajib diisi').max(200),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive('Nilai harus positif'),
  minPurchase: z.number().min(0).optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().optional(),
  validFrom: z.string().min(1, 'Tanggal mulai wajib diisi'),
  validUntil: z.string().min(1, 'Tanggal selesai wajib diisi'),
  isActive: z.boolean().optional(),
})

export const adminDepositActionSchema = z.object({
  depositId: z.string().min(1, 'Deposit ID wajib diisi'),
  status: z.enum(['success', 'failed']),
  adminNote: z.string().max(500).optional(),
})

export const adminWithdrawalActionSchema = z.object({
  withdrawalId: z.string().min(1, 'Withdrawal ID wajib diisi'),
  status: z.enum(['approved', 'rejected', 'processed']),
  adminNote: z.string().max(500).optional(),
})

// ==================== Wallet ====================
export const walletDebitSchema = z.object({
  orderId: z.string().min(1, 'orderId wajib diisi'),
  amount: z.number().int().positive('Jumlah debit harus bilangan bulat lebih dari 0'),
  description: z.string().optional(),
})

export const walletDebitBatchSchema = z.object({
  orders: z.array(z.object({
    orderId: z.string().min(1, 'orderId wajib diisi'),
    amount: z.number().int().positive('Jumlah debit harus bilangan bulat lebih dari 0'),
  })).min(1, 'Minimal 1 pesanan untuk batch payment'),
  description: z.string().optional(),
})

// ==================== Payment ====================
export const paymentCreateSchema = z.object({
  orderId: z.string().min(1, 'orderId wajib diisi'),
})

// ==================== Orders ====================
export const createOrderSchema = z.object({
  userId: z.string().min(1, 'userId wajib diisi'),
  sellerId: z.string().min(1, 'sellerId wajib diisi'),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().min(0).optional(),
    subtotal: z.number().min(0).optional(),
    productName: z.string().optional(),
    variantId: z.string().nullable().optional(),
    variantName: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
  })).min(1, 'Items tidak boleh kosong'),
  addressId: z.string().nullable().optional(),
  subtotal: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  platformFee: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  paymentMethod: z.string().optional(),
  note: z.string().optional(),
  shipping: z.object({
    provider: z.string().optional(),
    service: z.string().optional(),
    estimatedDays: z.string().nullable().optional(),
  }).optional(),
  voucherCode: z.string().optional(),
})

export const updateOrderSchema = z.object({
  orderId: z.string().min(1, 'orderId wajib diisi'),
  status: z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  paymentStatus: z.enum(['unpaid', 'paid', 'failed', 'refunded', 'pending']).optional(),
  trackingNumber: z.string().optional(),
  cancelReason: z.string().optional(),
})

// ==================== Addresses ====================
export const createAddressSchema = z.object({
  label: z.string().min(1, 'Label wajib diisi').max(50, 'Label maksimal 50 karakter'),
  recipient: z.string().min(1, 'Recipient wajib diisi').max(100, 'Recipient maksimal 100 karakter'),
  phone: z.string().min(1, 'Phone wajib diisi'),
  address: z.string().min(1, 'Address wajib diisi').max(500, 'Address maksimal 500 karakter'),
  city: z.string().min(1, 'City wajib diisi').max(100, 'City maksimal 100 karakter'),
  province: z.string().min(1, 'Province wajib diisi').max(100, 'Province maksimal 100 karakter'),
  postalCode: z.string().min(1, 'Postal code wajib diisi'),
  isDefault: z.boolean().optional(),
})

export const updateAddressSchema = z.object({
  addressId: z.string().min(1, 'addressId wajib diisi'),
  label: z.string().min(1).max(50).optional(),
  recipient: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  address: z.string().min(1).max(500).optional(),
  city: z.string().min(1).max(100).optional(),
  province: z.string().min(1).max(100).optional(),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const deleteAddressSchema = z.object({
  addressId: z.string().min(1, 'addressId wajib diisi'),
})

// ==================== Seller ====================
export const sellerRegisterSchema = z.object({
  userId: z.string().min(1, 'userId wajib diisi'),
  storeName: z.string().min(1, 'Nama toko wajib diisi').max(100, 'Nama toko maksimal 100 karakter'),
  storeDesc: z.string().max(500).optional(),
  storeAddress: z.string().max(500).optional(),
  storeAvatar: z.string().optional(),
  storeBanner: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  bankHolder: z.string().optional(),
})

export const sellerProfileUpdateSchema = z.object({
  storeName: z.string().min(1, 'Nama toko tidak boleh kosong').max(100).optional(),
  storeDesc: z.string().max(1000).optional(),
  storeAddress: z.string().max(500).optional(),
  storeCity: z.string().max(100).optional(),
  storeProvince: z.string().max(100).optional(),
  storePostalCode: z.string().max(10).optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  bankHolder: z.string().optional(),
  autoReply: z.string().max(500).optional(),
})

export const sellerWithdrawSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer'),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  bankHolder: z.string().optional(),
})

// ==================== Cart ====================
// Cart item add
export const cartAddSchema = z.object({
  productId: z.string().min(1, 'productId wajib diisi'),
  variantId: z.string().nullable().optional(),
  quantity: z.number().int().min(1, 'Quantity minimal 1').max(99, 'Quantity maksimal 99'),
})

// Cart item merge
export const cartMergeSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().nullable().optional(),
    quantity: z.number().int().min(1).max(99),
  })).min(1, 'Items tidak boleh kosong'),
})

// Cart item update
export const cartUpdateSchema = z.object({
  cartItemId: z.string().min(1, 'cartItemId wajib diisi'),
  quantity: z.number().int().min(1).max(99).optional(),
  isChecked: z.boolean().optional(),
}).refine(data => data.quantity !== undefined || data.isChecked !== undefined, {
  message: 'Minimal quantity atau isChecked harus diisi',
})

// Cart item delete
export const cartDeleteSchema = z.object({
  cartItemId: z.union([
    z.string().min(1, 'cartItemId wajib diisi'),
    z.array(z.string().min(1)).min(1, 'Minimal 1 cartItemId'),
  ]),
})

// ==================== Review ====================
// Review create
export const reviewCreateSchema = z.object({
  productId: z.string().min(1, 'productId wajib diisi'),
  orderItemId: z.string().min(1, 'orderItemId wajib diisi'),
  rating: z.number().int().min(1, 'Rating minimal 1').max(5, 'Rating maksimal 5'),
  content: z.string().max(1000, 'Ulasan maksimal 1000 karakter').optional(),
  images: z.array(z.string().url()).max(5, 'Maksimal 5 gambar').optional(),
})

// Review update
export const reviewUpdateSchema = z.object({
  reviewId: z.string().min(1, 'reviewId wajib diisi'),
  rating: z.number().int().min(1).max(5).optional(),
  content: z.string().max(1000).optional(),
  images: z.array(z.string().url()).max(5).optional(),
})

// Review delete
export const reviewDeleteSchema = z.object({
  reviewId: z.string().min(1, 'reviewId wajib diisi'),
})

// ==================== Wishlist ====================
export const wishlistAddSchema = z.object({
  productId: z.string().min(1, 'productId wajib diisi'),
})

export const wishlistDeleteSchema = z.object({
  productId: z.string().optional(),
  wishlistId: z.string().optional(),
}).refine(data => data.productId || data.wishlistId, {
  message: 'productId atau wishlistId wajib diisi',
})

// ==================== Notification ====================
export const notificationMarkReadSchema = z.object({
  notificationId: z.string().min(1, 'notificationId wajib diisi').optional(),
  markAll: z.boolean().optional(),
  userId: z.string().optional(),
}).refine(data => data.notificationId || (data.markAll && data.userId), {
  message: 'notificationId atau (markAll + userId) wajib diisi',
})

// ==================== Product (Seller) ====================
export const productCreateSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi').max(70, 'Nama produk maksimal 70 karakter'),
  description: z.string().max(2000, 'Deskripsi maksimal 2000 karakter').optional(),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  discountPrice: z.number().min(0).nullable().optional(),
  stock: z.number().int().min(0, 'Stok tidak boleh negatif'),
  categoryId: z.string().min(1, 'Kategori wajib diisi'),
  images: z.array(z.string()).min(1, 'Minimal 1 gambar').max(8, 'Maksimal 8 gambar'),
  video: z.string().nullable().optional(),
  weight: z.number().min(0, 'Berat tidak boleh negatif').optional(),
  minOrder: z.number().int().min(1).optional(),
  condition: z.enum(['new', 'used']).optional(),
  productType: z.enum(['barang', 'jasa']).optional(),
  variants: z.array(z.object({
    name: z.string().min(1).max(50),
    stock: z.number().int().min(0),
    price: z.number().min(0),
  })).optional(),
}).refine(data => {
  if (data.discountPrice !== undefined && data.discountPrice !== null && data.discountPrice >= data.price) {
    return false
  }
  return true
}, { message: 'Harga diskon harus lebih kecil dari harga normal', path: ['discountPrice'] })

export const productUpdateSchema = z.object({
  name: z.string().min(1).max(70).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).optional(),
  discountPrice: z.number().min(0).nullable().optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().min(1).optional(),
  images: z.array(z.string()).min(1).max(8).optional(),
  video: z.string().nullable().optional(),
  weight: z.number().min(0).optional(),
  minOrder: z.number().int().min(1).optional(),
  condition: z.enum(['new', 'used']).optional(),
  productType: z.enum(['barang', 'jasa']).optional(),
  status: z.enum(['active', 'draft', 'blocked']).optional(),
  variants: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(50),
    stock: z.number().int().min(0),
    price: z.number().min(0),
  })).optional(),
}).refine(data => {
  if (data.discountPrice !== undefined && data.discountPrice !== null && data.price !== undefined && data.discountPrice >= data.price) {
    return false
  }
  return true
}, { message: 'Harga diskon harus lebih kecil dari harga normal', path: ['discountPrice'] })

// ==================== Chat ====================
export const chatMessageSchema = z.object({
  roomId: z.string().min(1, 'roomId wajib diisi'),
  content: z.string().min(1, 'Pesan tidak boleh kosong').max(2000, 'Pesan maksimal 2000 karakter'),
  image: z.string().url().optional(),
})

// ==================== Complaint / Refund ====================
export const complaintCreateSchema = z.object({
  orderId: z.string().min(1, 'orderId wajib diisi'),
  reason: z.string().min(1, 'Alasan wajib diisi').max(500, 'Alasan maksimal 500 karakter'),
  description: z.string().max(2000).optional(),
  images: z.array(z.string().url()).max(5).optional(),
})

// ==================== OTP ====================
export const otpSendSchema = z.object({
  phone: z.string().min(1, 'Nomor telepon wajib diisi'),
  userId: z.string().optional(),
})

export const otpVerifySchema = z.object({
  phone: z.string().optional(),
  userId: z.string().optional(),
  code: z.string().length(6, 'Kode OTP harus 6 digit'),
}).refine(data => data.phone || data.userId, {
  message: 'Nomor telepon atau userId wajib diisi',
})

// Helper to validate request body with Zod
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const firstError = result.error.issues[0]
  return { success: false, error: firstError?.message || 'Validasi gagal' }
}
