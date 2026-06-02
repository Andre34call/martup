/**
 * Image/Video display optimization utilities.
 * Uses Supabase Image Transformations to serve compressed/resized images.
 * Videos are optimized via native browser attributes.
 */

/** Preset sizes for different display contexts */
export const IMAGE_PRESETS = {
  /** Small thumbnails (avatars, story circles, product chips) */
  thumbnail: { width: 80, height: 80, quality: 70, resize: 'cover' as const },
  /** Small cards (product grid items, review images) */
  small: { width: 200, height: 200, quality: 75, resize: 'cover' as const },
  /** Medium (feed images, product detail images) */
  medium: { width: 480, height: 480, quality: 80, resize: 'contain' as const },
  /** Large (full-width feed images, hero images) */
  large: { width: 800, height: 800, quality: 85, resize: 'contain' as const },
  /** Original quality (for product detail zoom, etc.) */
  original: { width: 1200, height: 1200, quality: 90, resize: 'contain' as const },
} as const

export type ImagePreset = keyof typeof IMAGE_PRESETS

interface TransformOptions {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
}

/**
 * Check if a URL is a Supabase Storage public URL
 */
function isSupabaseUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    // Check if it's a supabase storage URL
    return parsed.pathname.includes('/storage/v1/object/public/') ||
           parsed.hostname.includes('supabase.co')
  } catch {
    // Relative URLs or blob URLs
    return false
  }
}

/**
 * Transform a Supabase Storage image URL to use the image transformation API.
 * This compresses and resizes images on-the-fly when displaying them.
 *
 * @param url - Original image URL
 * @param preset - Preset name or custom options
 * @returns Optimized image URL
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  preset: ImagePreset | TransformOptions = 'medium'
): string {
  if (!url) return ''

  // Don't transform blob URLs (local previews)
  if (url.startsWith('blob:')) return url

  // Don't transform data URLs
  if (url.startsWith('data:')) return url

  // Don't transform non-Supabase URLs
  if (!isSupabaseUrl(url)) return url

  try {
    const options = typeof preset === 'string' ? IMAGE_PRESETS[preset] : preset
    const urlObj = new URL(url)

    // Convert /object/public/ to /render/image/public/
    const path = urlObj.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')

    if (path === urlObj.pathname) {
      // Path didn't match the expected pattern, return original
      return url
    }

    urlObj.pathname = path

    if (options.width) urlObj.searchParams.set('width', String(options.width))
    if (options.height) urlObj.searchParams.set('height', String(options.height))
    if (options.quality) urlObj.searchParams.set('quality', String(options.quality))
    if (options.resize) urlObj.searchParams.set('resize', options.resize)

    return urlObj.toString()
  } catch {
    // If URL parsing fails, return original
    return url
  }
}

/**
 * Get an optimized video poster/preview URL.
 * For Supabase videos, this generates a thumbnail URL.
 *
 * @param videoUrl - Original video URL
 * @returns Thumbnail URL for video preview
 */
export function getVideoPosterUrl(videoUrl: string | null | undefined): string {
  if (!videoUrl) return ''

  // Don't transform blob URLs
  if (videoUrl.startsWith('blob:')) return ''

  // For Supabase videos, we can try to generate a thumbnail URL
  // by using the video path with image transformation
  if (isSupabaseUrl(videoUrl)) {
    try {
      // Replace video extension with a frame extraction
      // Supabase doesn't support video thumbnails natively,
      // so we just return empty (browser will show first frame)
      return ''
    } catch {
      return ''
    }
  }

  return ''
}

/**
 * Video optimization attributes for <video> elements.
 * Returns attributes that optimize video playback.
 */
export function getVideoAttributes(options?: { autoplay?: boolean }) {
  return {
    preload: 'metadata' as const,
    playsInline: true,
    ...(options?.autoplay ? { autoPlay: true, muted: true } : {}),
  }
}
