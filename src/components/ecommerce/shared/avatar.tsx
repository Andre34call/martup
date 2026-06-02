"use client"

import { useState } from "react"

interface AvatarWithFallbackProps {
  src: string | null | undefined
  name: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
}

export function AvatarWithFallback({ src, name, size = "md", className }: AvatarWithFallbackProps) {
  const [imgError, setImgError] = useState(false)
  const initials = name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??"
  const sizeClass = sizeClasses[size]

  return (
    <div className={`relative shrink-0 ${className || ""}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          className={`${sizeClass} rounded-full object-cover`}
        />
      ) : (
        <div className={`${sizeClass} rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-semibold text-emerald-700 dark:text-emerald-300`}>
          {initials}
        </div>
      )}
    </div>
  )
}
