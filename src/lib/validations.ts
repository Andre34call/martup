import { z } from 'zod'

// ==================== Auth ====================
export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Email tidak valid'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  role: z.enum(['buyer', 'seller']).optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email tidak valid'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})

// ==================== User ====================
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
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
  updates: z.record(z.unknown()),
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

// Helper to validate request body with Zod
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const firstError = result.error.issues[0]
  return { success: false, error: firstError?.message || 'Validasi gagal' }
}
