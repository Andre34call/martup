"use client"

import type { LucideIcon } from "lucide-react"

// ==================== SHARED TYPES ====================
export type UsernameCheckStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export type TwoFAStep = 'otp' | 'verify'

// ==================== SHARED CONSTANTS ====================
export const USERNAME_REGEX = /^[a-z0-9_-]{3,20}$/
export const USERNAME_COOLDOWN_DAYS = 30
export const MAX_AVATAR_SIZE_MB = 5
