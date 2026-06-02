"use client"

import { Button, ButtonProps } from "@/components/ui/button"
import { motion } from "framer-motion"

type PrimaryButtonProps = ButtonProps

export function PrimaryButton({ className, children, ...props }: PrimaryButtonProps) {
  return (
    <Button
      className={`bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white ${className || ""}`}
      {...props}
    >
      {children}
    </Button>
  )
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={`w-5 h-5 border-2 border-white/30 border-t-white rounded-full ${className || ""}`}
    />
  )
}

export function DarkSpinner({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={`w-5 h-5 border-2 border-muted-foreground/30 border-t-foreground rounded-full ${className || ""}`}
    />
  )
}
