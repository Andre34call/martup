import { getCsrfToken } from '@/lib/csrf-client'
import { logger } from '@/lib/logger'

export interface UploadResult {
  url: string
  path: string
  type: 'image' | 'video'
}

function getUploadAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (typeof window !== 'undefined') {
    // Check both token storage keys for compatibility (same as getAuthHeaders)
    const token = localStorage.getItem('authToken') || localStorage.getItem('martup_token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
  }
  return headers
}

export async function uploadFile(
  file: File,
  bucket: string = 'products',
  folder: string = 'images'
): Promise<UploadResult> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)
    formData.append('folder', folder)

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: getUploadAuthHeaders(),
      body: formData,
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Upload failed')
    }

    return data.data
  } catch (error) {
    logger.error({ error, file: file.name, bucket, folder }, 'File upload failed')
    throw error
  }
}

export async function uploadMultipleFiles(
  files: File[],
  bucket: string = 'products',
  folder: string = 'images'
): Promise<UploadResult[]> {
  try {
    const results = await Promise.all(files.map((file) => uploadFile(file, bucket, folder)))
    return results
  } catch (error) {
    logger.error({ error, fileCount: files.length, bucket, folder }, 'Multiple file upload failed')
    throw error
  }
}
