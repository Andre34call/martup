'use client'

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

// ==================== Types ====================

interface UploadResponse {
  url: string
  filename: string
}

// ==================== Hooks ====================

export function useUpload() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiClient.upload<UploadResponse>('/api/upload', formData)
    },
  })
}

export function useUploadMultiple() {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })
      return apiClient.upload<{ urls: string[] }>('/api/upload', formData)
    },
  })
}
