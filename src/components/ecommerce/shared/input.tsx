"use client"

import { motion } from "framer-motion"
import { Search, X, Plus, Minus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useState, useRef } from "react"

// ==================== SEARCH BAR ====================
interface SearchBarProps {
  value?: string
  onChange?: (value: string) => void
  onSearch?: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBar({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder = "Cari produk...",
  autoFocus = false,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState("")
  const value = controlledValue ?? internalValue
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue)
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange?.(newValue)
    }, 300)
  }

  const handleClear = () => {
    handleChange("")
    onChange?.("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.(value)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pl-9 pr-9 h-10 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </form>
  )
}

// ==================== QUANTITY SELECTOR ====================
interface QuantitySelectorProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: "sm" | "md"
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 999,
  size = "md",
}: QuantitySelectorProps) {
  const sizeMap = {
    sm: { button: "w-7 h-7", text: "text-xs w-8", icon: "w-3 h-3" },
    md: { button: "w-9 h-9", text: "text-sm w-10", icon: "w-4 h-4" },
  }
  const s = sizeMap[size]

  return (
    <div className="flex items-center gap-1">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={`${s.button} flex items-center justify-center rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors`}
      >
        <Minus className={s.icon} />
      </motion.button>
      <span className={`${s.text} text-center font-semibold text-foreground`}>
        {value}
      </span>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`${s.button} flex items-center justify-center rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors`}
      >
        <Plus className={s.icon} />
      </motion.button>
    </div>
  )
}
