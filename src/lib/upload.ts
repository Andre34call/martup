import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'

export interface UploadResult {
  url: string
  path: string
  type: 'image' | 'video'
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

    const data = await apiClient.upload<{ success: boolean; data: UploadResult; error?: string }>(
      '/api/upload',
      formData
    )

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
