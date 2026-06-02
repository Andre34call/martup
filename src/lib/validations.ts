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

// ==================== Wallet ====================
export const walletDebitSchema = z.object({
  orderId: z.string().min(1, 'orderId wajib diisi'),
  amount: z.number().positive('Jumlah debit harus lebih dari 0'),
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
  addressId: z.string().min(1, 'addressId wajib diisi').optional(),
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
  amount: z.number().positive('Amount must be a positive number'),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  bankHolder: z.string().optional(),
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
