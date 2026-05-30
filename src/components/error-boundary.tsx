'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { captureException } from '@/lib/sentry'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.warn({ component: 'error-boundary', err: error, componentStack: errorInfo.componentStack }, 'ErrorBoundary caught')
    captureException(error, {
      componentStack: errorInfo.componentStack ?? undefined,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      
      const isDev = process.env.NODE_ENV === 'development'
      const errorMessage = this.state.error?.message || 'Unknown error'
      const errorStack = this.state.error?.stack || ''
      
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Terjadi Kesalahan</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-[280px]">
            Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.
          </p>
          {isDev && (
            <div className="mb-4 max-w-[400px] w-full text-left bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 overflow-auto max-h-48">
              <p className="text-xs font-mono text-red-700 dark:text-red-300 font-bold mb-1">{errorMessage}</p>
              <pre className="text-[10px] font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">{errorStack}</pre>
            </div>
          )}
          <Button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl h-10 px-6"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Coba Lagi
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
