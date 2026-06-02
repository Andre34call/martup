/**
 * Shared upload limits for the entire application.
 * All components and API routes should reference these constants
 * to ensure consistent file size validation across the app.
 *
 * Updated limits for high-quality media:
 * - Image: 100MB (supports high-res photos, PNG, large banners)
 * - Video: 250MB (supports long-form video content, 4K clips)
 * - Avatar: 5MB (profile photo standard)
 * - Banner: 100MB (supports animated/video banners)
 */

export const UPLOAD_LIMITS = {
  // General image/video limits (used by API routes as fallback)
  MAX_IMAGE_SIZE_MB: 100,
  MAX_VIDEO_SIZE_MB: 250,

  // Avatar/profile photo limits
  MAX_AVATAR_SIZE_MB: 5,

  // Banner limits
  MAX_BANNER_SIZE_MB: 100,

  // Product image limits
  MAX_PRODUCT_IMAGES: 8,
  MAX_PRODUCT_IMAGE_SIZE_MB: 100,

  // Product video limits
  MAX_PRODUCT_VIDEO_SIZE_MB: 250,

  // Review image limits
  MAX_REVIEW_IMAGES: 5,
  MAX_REVIEW_IMAGE_SIZE_MB: 100,

  // Review video limits
  MAX_REVIEW_VIDEO_SIZE_MB: 250,

  // Stream/social image limits
  MAX_STREAM_IMAGE_SIZE_MB: 100,

  // Stream/social video limits
  MAX_STREAM_VIDEO_SIZE_MB: 250,

  // Complaint evidence limits
  MAX_COMPLAINT_IMAGES: 4,
  MAX_COMPLAINT_IMAGE_SIZE_MB: 100,

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
