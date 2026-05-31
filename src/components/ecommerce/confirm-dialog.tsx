"use client"

import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, ShieldAlert, Info, CheckCircle2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
}

const variantConfig = {
  danger: {
    icon: ShieldAlert,
    gradient: 'from-red-500 via-rose-500 to-pink-500',
    bgGlow: 'bg-red-500/20',
    borderGlow: 'border-red-500/30',
    iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
    buttonBg: 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 active:from-red-700 active:to-rose-800',
    shadow: 'shadow-red-500/25',
  },
  warning: {
    icon: AlertTriangle,
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    bgGlow: 'bg-amber-500/20',
    borderGlow: 'border-amber-500/30',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    buttonBg: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:from-amber-700 active:to-orange-800',
    shadow: 'shadow-amber-500/25',
  },
  info: {
    icon: Info,
    gradient: 'from-cyan-500 via-teal-500 to-emerald-500',
    bgGlow: 'bg-cyan-500/20',
    borderGlow: 'border-cyan-500/30',
    iconBg: 'bg-gradient-to-br from-cyan-500 to-teal-600',
    buttonBg: 'bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 active:from-cyan-700 active:to-teal-800',
    shadow: 'shadow-cyan-500/25',
  },
  success: {
    icon: CheckCircle2,
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    bgGlow: 'bg-emerald-500/20',
    borderGlow: 'border-emerald-500/30',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600',
    buttonBg: 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 active:from-emerald-700 active:to-green-800',
    shadow: 'shadow-emerald-500/25',
  },
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Konfirmasi', cancelLabel = 'Batal', variant = 'danger' }: ConfirmDialogProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.8 }}
            className="relative bg-card rounded-3xl shadow-2xl border border-border/50 w-full max-w-[340px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top gradient accent */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${config.gradient}`} />

            {/* Glow effect behind icon */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none">
              <div className={`w-full h-full rounded-full ${config.bgGlow}`} />
            </div>

            <div className="relative px-6 pt-6 pb-5">
              {/* Close button */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/80 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </motion.button>

              {/* Icon with animated ring */}
              <div className="flex justify-center mb-5">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="relative"
                >
                  {/* Animated ring */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                    className={`absolute inset-0 rounded-2xl border-2 ${config.borderGlow}`}
                  />
                  {/* Icon container */}
                  <div className={`w-16 h-16 rounded-2xl ${config.iconBg} shadow-lg ${config.shadow} flex items-center justify-center`}>
                    <Icon className="w-8 h-8 text-white" strokeWidth={1.5} />
                  </div>
                </motion.div>
              </div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-center mb-2"
              >
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
              </motion.div>

              {/* Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-6"
              >
                <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
              </motion.div>

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex gap-3"
              >
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-semibold border-border/50 hover:bg-muted/80"
                  onClick={onClose}
                >
                  {cancelLabel}
                </Button>
                <Button
                  className={`flex-1 h-11 rounded-xl font-semibold text-white shadow-lg ${config.buttonBg} ${config.shadow} transition-all`}
                  onClick={() => { onConfirm(); onClose() }}
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {confirmLabel}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
