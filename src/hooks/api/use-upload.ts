'use client'

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

// ==================== Types ====================

interface UploadResult {
  url?: string  // Undefined for private buckets — use signed URL endpoint instead
  path: string
  type: 'image' | 'video'
  isPrivate?: boolean  // True for private buckets (payments, deposits)
}

interface UploadResponse {
  success: boolean
  data?: UploadResult
  error?: string
}

// ==================== Hooks ====================

export function useUpload() {
  return useMutation({
    mutationFn: async (params: { file: File; bucket?: string; folder?: string }) => {
      const formData = new FormData()
      formData.append('file', params.file)
      if (params.bucket) formData.append('bucket', params.bucket)
      if (params.folder) formData.append('folder', params.folder)
      return apiClient.upload<UploadResponse>('/api/upload', formData)
    },
  })
}

export function useUploadMultiple() {
  return useMutation({
    mutationFn: async (params: { files: File[]; bucket?: string; folder?: string }) => {
      const results: UploadResult[] = []
      for (const file of params.files) {
        const formData = new FormData()
        formData.append('file', file)
        if (params.bucket) formData.append('bucket', params.bucket)
        if (params.folder) formData.append('folder', params.folder)
        const response = await apiClient.upload<UploadResponse>('/api/upload', formData)
        if (response.success && response.data) {
          results.push(response.data)
        }
      }
      return results
    },
  })
}
