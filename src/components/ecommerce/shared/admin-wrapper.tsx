"use client"

import { PageHeader } from "./layout"
import { LoadingSpinner } from "../loading-spinner"

interface AdminScreenWrapperProps {
  title: string
  isLoading: boolean
  children: React.ReactNode
}

export function AdminScreenWrapper({ title, isLoading, children }: AdminScreenWrapperProps) {
  if (isLoading) {
    return (
      <div className="pb-20">
        <PageHeader title={title} />
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner message={`Memuat ${title}...`} />
        </div>
      </div>
    )
  }
  return <div className="pb-20">{children}</div>
}
