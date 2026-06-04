"use client"

// Shared types and constants used by multiple seller screens

// Type alias for apiClient generics (avoids TSX parsing ambiguity)
export type AuthMeResponse = { user?: { id: string } }
