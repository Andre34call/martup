"use client"

import { motion } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { useState, useEffect } from "react"
import { MartUpLogo, pageVariants, pageTransition } from "./shared"

// ==================== SPLASH SCREEN ====================
export function SplashScreen() {
  const { navigate, isAuthenticated } = useAppStore()
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((prev) => (prev + 1) % 4)
    }, 500)

    const navTimer = setTimeout(() => {
      if (isAuthenticated) {
        navigate("home")
      } else {
        navigate("onboarding")
      }
    }, 2000)

    return () => {
      clearInterval(dotTimer)
      clearTimeout(navTimer)
    }
  }, [navigate, isAuthenticated])

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-emerald-50 dark:from-background dark:to-emerald-950/20"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <MartUpLogo size="lg" />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-sm text-muted-foreground font-medium"
        >
          Shop Smart, Live Better
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="mt-12 flex items-center gap-1.5"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: i < dots ? [1, 1.3, 1] : 1,
              backgroundColor: i < dots ? "#10b981" : "#d1d5db",
            }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
            className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600"
          />
        ))}
      </motion.div>
    </motion.div>
  )
}
