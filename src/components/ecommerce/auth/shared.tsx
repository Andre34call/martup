"use client"

import { loginSchema } from '@/lib/validations'

// ==================== TYPE ALIASES ====================
export type LoginResponse = { success: boolean; requiresVerification?: boolean; requires2FA?: boolean; email?: string; phone?: string; userId?: string; message?: string; token?: string; isSuperAdmin?: boolean; user?: { id: string; email: string; phone?: string; name: string; avatar?: string; role?: string; isVerified?: boolean; loyaltyPoints?: number; coins?: number; twoFactorEnabled?: boolean }; devOtp?: string; error?: string }
export type RegisterResponse = { success: boolean; requiresVerification?: boolean; message?: string; token?: string; isSuperAdmin?: boolean; user?: { id: string; email: string; phone?: string; name: string; avatar?: string; role?: string; isVerified?: boolean; loyaltyPoints?: number; coins?: number; twoFactorEnabled?: boolean }; devVerifyUrl?: string; error?: string }
export type ResendVerificationResponse = { success: boolean; alreadyVerified?: boolean; message?: string; devVerifyUrl?: string; error?: string }
export type OtpSendResponse = { success: boolean; message?: string; devOtp?: string; error?: string }
export type OtpVerifyResponse = { success: boolean; token?: string; user?: { id: string; email?: string; phone?: string; name: string; avatar?: string; role?: string; loyaltyPoints?: number; coins?: number; twoFactorEnabled?: boolean }; error?: string }
export type ForgotPasswordResponse = { success: boolean; message?: string; error?: string }
export type ResetPasswordResponse = { success: boolean; message?: string; error?: string }

// ==================== VALIDATION HELPERS ====================
export function isValidEmail(email: string): boolean {
  return loginSchema.shape.email.safeParse(email).success
}

export function isValidPhone(phone: string): boolean {
  return /^(0|\+62|62)\d{9,12}$/.test(phone.replace(/[\s-]/g, ''))
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
}

export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++

  if (score <= 2) return { score, label: 'Lemah', color: 'bg-red-500' }
  if (score <= 3) return { score, label: 'Sedang', color: 'bg-yellow-500' }
  if (score <= 4) return { score, label: 'Kuat', color: 'bg-emerald-400' }
  return { score, label: 'Sangat Kuat', color: 'bg-emerald-600' }
}

export function getPasswordRules(password: string) {
  return [
    { label: 'Minimal 8 karakter', met: password.length >= 8 },
    { label: 'Huruf kecil (a-z)', met: /[a-z]/.test(password) },
    { label: 'Huruf besar (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Angka (0-9)', met: /\d/.test(password) },
    { label: 'Karakter khusus (!@#$% dll)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ]
}

export function isValidEmailOrPhone(value: string): boolean {
  return isValidEmail(value) || isValidPhone(value)
}

// ==================== PAGE ANIMATION VARIANTS ====================
export const pageVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
}

export const pageTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
}

// ==================== LOGO COMPONENT ====================
export function MartUpLogo({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-5xl",
  }

  return (
    <span
      className={`${sizeMap[size]} font-extrabold bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 bg-clip-text text-transparent`}
    >
      MartUp
    </span>
  )
}
