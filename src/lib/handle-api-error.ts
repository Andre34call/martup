import { useAppStore } from '@/lib/store'

/**
 * Centralized API error handler for frontend components.
 * Replaces 20+ duplicated showToast("Gagal memuat X", "error") patterns.
 */
export function handleApiError(error: unknown, entityName: string) {
  const { showToast } = useAppStore.getState()
  
  if (error instanceof Error) {
    showToast(error.message || `Gagal memuat ${entityName}`, 'error')
  } else if (typeof error === 'string') {
    showToast(error, 'error')
  } else {
    showToast(`Gagal memuat ${entityName}`, 'error')
  }
}
