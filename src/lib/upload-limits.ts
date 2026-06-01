/**
 * Shared upload limits for the entire application.
 * All components and API routes should reference these constants
 * to ensure consistent file size validation across the app.
 *
 * Standard/common limits based on major platforms:
 * - Avatar: 5MB (Twitter, common standard)
 * - Product images: 10MB (Shopee, Tokopedia standard)
 * - Product video: 50MB (e-commerce standard)
 * - Review images: 10MB (common standard)
 * - Review video: 50MB (common standard)
 * - Stream/social images: 10MB (Instagram-like)
 * - Stream/social video: 100MB (social media standard)
 * - Banner: 10MB (common standard)
 * - Complaint/evidence: 10MB (common standard)
 */

export const UPLOAD_LIMITS = {
  // General image/video limits (used by API routes as fallback)
  MAX_IMAGE_SIZE_MB: 10,
  MAX_VIDEO_SIZE_MB: 100,

  // Avatar/profile photo limits
  MAX_AVATAR_SIZE_MB: 5,

  // Banner limits
  MAX_BANNER_SIZE_MB: 10,

  // Product image limits
  MAX_PRODUCT_IMAGES: 8,
  MAX_PRODUCT_IMAGE_SIZE_MB: 10,

  // Product video limits
  MAX_PRODUCT_VIDEO_SIZE_MB: 50,

  // Review image limits
  MAX_REVIEW_IMAGES: 5,
  MAX_REVIEW_IMAGE_SIZE_MB: 10,

  // Review video limits
  MAX_REVIEW_VIDEO_SIZE_MB: 50,

  // Stream/social image limits
  MAX_STREAM_IMAGE_SIZE_MB: 10,

  // Stream/social video limits
  MAX_STREAM_VIDEO_SIZE_MB: 100,

  // Complaint evidence limits
  MAX_COMPLAINT_IMAGES: 4,
  MAX_COMPLAINT_IMAGE_SIZE_MB: 10,

  // Allowed file types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'] as const,

  // Helper to get max size in bytes
  mbToBytes: (mb: number) => mb * 1024 * 1024,
} as const

/**
 * Format file size for display
 */
export function formatFileSize(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)}GB`
  return `${mb}MB`
}
