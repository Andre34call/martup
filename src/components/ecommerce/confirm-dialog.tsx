"use client"

import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Konfirmasi', cancelLabel = 'Batal', variant = 'danger' }: ConfirmDialogProps) {
  const variantStyles = {
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    info: 'bg-blue-500 hover:bg-blue-600 text-white',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card rounded-2xl shadow-xl border border-border p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{title}</h3>
              </div>
              <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-10 rounded-lg" onClick={onClose}>{cancelLabel}</Button>
              <Button className={`flex-1 h-10 rounded-lg ${variantStyles[variant]}`} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
