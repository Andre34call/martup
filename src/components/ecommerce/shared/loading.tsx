"use client"

import { motion } from "framer-motion"
import { Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { ProductCardSkeleton } from "./product"

// ==================== FLASH SALE TIMER ====================
interface FlashSaleTimerProps {
  endDate: string
  size?: "sm" | "md" | "lg"
}

function calculateTimeLeftFromEnd(endDate: string) {
  const end = new Date(endDate).getTime()
  const now = Date.now()
  const diff = Math.max(0, end - now)

  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0 }

  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  }
}

export function FlashSaleTimer({ endDate, size = "md" }: FlashSaleTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeftFromEnd(endDate))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeftFromEnd(endDate))
    }, 1000)

    return () => clearInterval(timer)
  }, [endDate])

  const sizeClasses = {
    sm: "text-xs min-w-[24px] h-6",
    md: "text-sm min-w-[30px] h-8",
    lg: "text-lg min-w-[40px] h-10",
  }

  const separatorSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  }

  const pad = (n: number) => n.toString().padStart(2, "0")

  return (
    <div className="flex items-center gap-1">
      <Clock className={`${size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5"} text-orange-500`} />
      <div className="flex items-center gap-0.5">
        {[
          { value: pad(timeLeft.hours), label: "jam" },
          { value: pad(timeLeft.minutes), label: "min" },
          { value: pad(timeLeft.seconds), label: "det" },
        ].map((item, idx) => (
          <span key={item.label} className="flex items-center gap-0.5">
            <motion.span
              key={item.value}
              initial={{ y: -5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`${sizeClasses[size]} flex items-center justify-center bg-orange-500 text-white font-bold rounded-md px-1`}
            >
              {item.value}
            </motion.span>
            {idx < 2 && (
              <span className={`${separatorSizeClasses[size]} text-orange-500 font-bold`}>:</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

// ==================== HOME SCREEN SKELETON ====================
export function HomeScreenSkeleton() {
  return (
    <div className="space-y-6 p-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 bg-muted rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
        </div>
      </div>
      {/* Search skeleton */}
      <div className="h-10 bg-muted rounded-xl animate-pulse" />
      {/* Banner skeleton */}
      <div className="h-40 bg-muted rounded-2xl animate-pulse" />
      {/* Category skeleton */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-muted rounded-xl animate-pulse" />
            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
      {/* Product grid skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// ==================== LIST SKELETON ====================
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 bg-card rounded-xl border border-border/50 animate-pulse">
          <div className="w-20 h-20 bg-muted rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-5 bg-muted rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
