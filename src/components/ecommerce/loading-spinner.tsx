"use client"

import { motion } from "framer-motion"

export function LoadingSpinner({ message = 'Memuat...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full"
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
