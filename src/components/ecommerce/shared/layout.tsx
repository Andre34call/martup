"use client"

import { motion } from "framer-motion"
import { ArrowLeft, ChevronRight, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"

// ==================== PAGE HEADER ====================
interface PageHeaderProps {
  title: string
  showBack?: boolean
  onBack?: () => void
  rightAction?: React.ReactNode
}

export function PageHeader({ title, showBack = true, onBack, rightAction }: PageHeaderProps) {
  const { goBack } = useAppStore()

  return (
    <div className="sticky top-0 z-40 glass">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack || goBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          )}
          <h1 className="text-base font-bold text-foreground">{title}</h1>
        </div>
        {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
      </div>
    </div>
  )
}

// ==================== SECTION HEADER ====================
interface SectionHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  actionLabel = "Lihat Semua",
  onAction,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && <span className="text-emerald-500">{icon}</span>}
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-0.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          {actionLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ==================== TAB BAR ====================
interface TabBarProps {
  tabs: { key: string; label: string; count?: number }[]
  activeTab: string
  onTabChange: (key: string) => void
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex border-b border-border overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === tab.key
              ? "text-emerald-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{tab.label}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
              activeTab === tab.key
                ? "bg-emerald-500 text-white"
                : "bg-muted text-muted-foreground"
            }`}>
              {tab.count > 99 ? "99+" : tab.count}
            </span>
          )}
          {activeTab === tab.key && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// ==================== EMPTY STATE ====================
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
        {icon || <Package className="w-10 h-10 text-muted-foreground" />}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {subtitle && (
        <p className="text-sm text-muted-foreground max-w-[250px]">{subtitle}</p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
          size="sm"
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}
